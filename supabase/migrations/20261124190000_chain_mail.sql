-- M2 Teil 2b: Ketten-Mails (NOTIFY-01..06, NOTIFY-08). Ereignisse entstehen schon bei jedem Zug (private.notify).
-- Hier: Erinnerung nach drei Tagen, Abholen mit Sperre (kein Doppelversand) und Abschluss je Ereignis.
-- Nur der Server mit Generalschlüssel (service_role) ruft diese Funktionen auf.

alter table public.notification_events drop constraint notification_events_status_check;
alter table public.notification_events add constraint notification_events_status_check
  check (status in ('pending', 'sending', 'sent', 'failed', 'skipped'));
alter table public.notification_events add column claimed_at timestamptz;
alter table public.notification_events add column attempts int not null default 0;

-- Genau eine Erinnerung pro Zug, wenn er seit p_after offen ist (NOTIFY-06). Schlüssel enthält die Zugnummer.
create or replace function public.queue_reminders(p_after interval default interval '3 days') returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  insert into public.notification_events (kind, recipient_id, chain_id, dedupe_key)
  select 'reminder', ch.turn_account_id, ch.id, 'remind:' || ch.id || ':' || (cnt.n + 1)
  from public.chains ch
  cross join lateral (select count(*)::int as n, max(e.created_at) as last from public.chain_entries e where e.chain_id = ch.id) cnt
  where ch.state = 'active' and ch.turn_account_id is not null and cnt.last < now() - p_after
  on conflict (dedupe_key) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

-- Offene Ereignisse abholen und sperren. Was nicht mehr passt, wird übersprungen statt verschickt:
-- Mails abgeschaltet, Runde beendet, Zug schon weiter (veraltete Zug-Mail/Erinnerung), blockiert.
create or replace function public.claim_notifications(p_limit int default 20) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare out jsonb;
begin
  -- Hängengebliebene Sperren (Absturz beim Versand) nach 10 Minuten freigeben, höchstens drei Versuche
  update public.notification_events set status = 'pending'
    where status = 'sending' and claimed_at < now() - interval '10 minutes' and attempts < 3;
  update public.notification_events set status = 'failed'
    where status = 'sending' and claimed_at < now() - interval '10 minutes' and attempts >= 3;

  update public.notification_events n set status = 'skipped'
  from public.chains ch, public.accounts a
  where n.status = 'pending' and ch.id = n.chain_id and a.id = n.recipient_id
    and (
      not a.notify_email
      or a.suspended_at is not null
      or (n.kind in ('your_turn', 'reminder') and (ch.state <> 'active' or ch.turn_account_id is distinct from n.recipient_id))
      or (n.kind = 'completed' and ch.state <> 'completed')
      or exists (select 1 from public.chain_participants o where o.chain_id = ch.id and o.account_id <> n.recipient_id
                 and private.blocked_between(o.account_id, n.recipient_id))
    );

  with picked as (
    select id from public.notification_events
    where status = 'pending' order by created_at limit p_limit
    for update skip locked
  ), upd as (
    update public.notification_events n set status = 'sending', claimed_at = now(), attempts = n.attempts + 1
    from picked where n.id = picked.id
    returning n.id, n.kind, n.recipient_id, n.chain_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', u.id, 'kind', u.kind,
    'to', (select au.email from auth.users au where au.id = u.recipient_id),
    'chain', jsonb_build_object('id', ch.id, 'title', ch.title, 'target', ch.target,
      'count', (select count(*) from public.chain_entries e where e.chain_id = ch.id)),
    'other', (select jsonb_build_object('name', private.person_name(o.account_id))
              from public.chain_participants o where o.chain_id = ch.id and o.account_id <> u.recipient_id),
    'last', (select jsonb_build_object('title', e.title, 'artist', e.artist, 'comment', e.comment, 'mine', e.author_id = u.recipient_id,
                                       'at', e.created_at)
             from public.chain_entries e where e.chain_id = ch.id order by e.position desc limit 1)
  )), '[]'::jsonb) into out
  from upd u join public.chains ch on ch.id = u.chain_id;
  return out;
end $$;

create or replace function public.finish_notification(p_id uuid, p_ok boolean) returns void
language sql security definer set search_path = '' as $$
  update public.notification_events
    set status = case when p_ok then 'sent' when attempts >= 3 then 'failed' else 'pending' end,
        sent_at = case when p_ok then now() else sent_at end
    where id = p_id and status = 'sending';
$$;

revoke all on function public.queue_reminders(interval), public.claim_notifications(int), public.finish_notification(uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.queue_reminders(interval), public.claim_notifications(int), public.finish_notification(uuid, boolean)
  to service_role;
