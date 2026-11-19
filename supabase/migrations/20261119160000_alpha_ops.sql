-- Alpha-Betrieb: Feedback mit Spam-Schutz, Einstellungen (Blockierte), Konto löschen (PRD 11.4, TRUST-06, TRUST-09).

-- ---------------------------------------------------------------------------
-- Feedback: nur noch über submit_feedback (Ratenlimit pro Browser/IP-Hash)
-- ---------------------------------------------------------------------------
alter table public.feedback add column rate_key text not null default '';
create index feedback_rate_idx on public.feedback (rate_key, created_at);
drop policy feedback_insert on public.feedback;

create function public.submit_feedback(
  p_page text, p_kind text, p_message text, p_contact_ok boolean,
  p_user_agent text default '', p_rate_key text default ''
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  fid uuid;
begin
  if p_rate_key <> '' and (
    select count(*) from public.feedback
    where rate_key = p_rate_key and created_at > now() - interval '10 minutes'
  ) >= 5 then
    raise exception 'rate_limited' using errcode = '54000';
  end if;
  insert into public.feedback (account_id, page, kind, message, contact_ok, user_agent, rate_key)
  values ((select auth.uid()), left(coalesce(p_page, ''), 300), p_kind, btrim(p_message),
          coalesce(p_contact_ok, false), left(coalesce(p_user_agent, ''), 400), left(coalesce(p_rate_key, ''), 100))
  returning id into fid;
  return fid;
end $$;
grant execute on function public.submit_feedback(text, text, text, boolean, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Einstellungen: blockierte Personen mit Namen (Konten sind sonst privat)
-- ---------------------------------------------------------------------------
create function public.my_blocks()
returns table (account_id uuid, display_name text, blocked_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select b.blocked_id, coalesce(nullif(a.display_name, ''), 'A DJ'), b.created_at
  from public.blocks b join public.accounts a on a.id = b.blocked_id
  where b.blocker_id = (select auth.uid())
  order by b.created_at desc;
$$;
grant execute on function public.my_blocks() to authenticated;

-- ---------------------------------------------------------------------------
-- Konto löschen (PRD 11.4): fremde Inhalte bleiben heil
-- Gemeinsame Ketten bleiben für die andere Person lesbar; die Tracks der
-- gelöschten Person bleiben an ihrer Position, ohne Namen („Deleted DJ“).
-- ---------------------------------------------------------------------------
alter table public.chains alter column creator_id drop not null;
alter table public.chains drop constraint chains_creator_id_fkey,
  add constraint chains_creator_id_fkey foreign key (creator_id) references public.accounts (id) on delete set null;
alter table public.chain_entries alter column author_id drop not null;
alter table public.chain_entries drop constraint chain_entries_author_id_fkey,
  add constraint chain_entries_author_id_fkey foreign key (author_id) references public.accounts (id) on delete set null;

-- Vor dem Löschen: offene Runden beenden, Einladungen ungültig machen, Mails stoppen.
-- Die eigentliche Löschung des Logins macht der Server mit dem Secret Key.
create function public.prepare_account_deletion() returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  update public.chains ch set state = 'archived', turn_account_id = null, ended_at = now(), version = version + 1
    where ch.state in ('waiting_for_partner', 'active')
      and exists (select 1 from public.chain_participants p where p.chain_id = ch.id and p.account_id = me);
  update public.chain_invites i set status = 'revoked'
    where i.status = 'open'
      and exists (select 1 from public.chain_participants p where p.chain_id = i.chain_id and p.account_id = me);
  update public.profiles set status = 'withdrawn', published = null, published_at = null where account_id = me;
  update public.notification_events n set status = 'skipped'
    where n.status = 'pending'
      and n.chain_id in (select p.chain_id from public.chain_participants p where p.account_id = me);
end $$;
grant execute on function public.prepare_account_deletion() to authenticated;
