-- Name gemeinsam (PO 27.11.2026, Boards „Abschluss · Name A/B/C“): Eine Person schlägt vor, die andere stimmt zu.
-- Der gültige Name (chains.title) ändert sich erst mit der Zustimmung. Der Startname gilt als Vorschlag der
-- startenden Person, bis beide sich geeinigt haben. Direktes Umbenennen entfällt.

alter table public.chains
  add column title_suggestion text check (char_length(title_suggestion) between 1 and 60),
  add column title_suggested_by uuid references public.accounts (id) on delete set null,
  add column title_together boolean not null default false;

drop function public.rename_chain(uuid, text);

-- offener Vorschlag und wer ihn gemacht hat
create function private.title_pending(p_chain uuid) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce(ch.title_suggestion, case when btrim(ch.title) <> '' and not ch.title_together then ch.title end)
  from public.chains ch where ch.id = p_chain;
$$;
create function private.title_pending_by(p_chain uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select case when ch.title_suggestion is not null then ch.title_suggested_by
              when btrim(ch.title) <> '' and not ch.title_together then ch.creator_id end
  from public.chains ch where ch.id = p_chain;
$$;

create function public.suggest_chain_title(p_chain uuid, p_title text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  t text := left(btrim(coalesce(p_title, '')), 60);
begin
  if me is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if not exists (select 1 from public.chain_participants where chain_id = p_chain and account_id = me) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if t = '' then raise exception 'empty_title' using errcode = '22023'; end if;
  update public.chains set title_suggestion = t, title_suggested_by = me, version = version + 1 where id = p_chain;
end $$;

create function public.accept_chain_title(p_chain uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  t text;
  who uuid;
begin
  if me is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  perform 1 from public.chains where id = p_chain for update;
  if not exists (select 1 from public.chain_participants where chain_id = p_chain and account_id = me) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  t := private.title_pending(p_chain);
  who := private.title_pending_by(p_chain);
  if t is null then raise exception 'no_suggestion' using errcode = '22023'; end if;
  if who = me then raise exception 'not_allowed' using errcode = '42501'; end if;
  update public.chains set title = t, title_together = true, title_suggestion = null, title_suggested_by = null, version = version + 1
    where id = p_chain;
end $$;

revoke all on function private.title_pending(uuid), private.title_pending_by(uuid) from public, anon, authenticated;
revoke all on function public.suggest_chain_title(uuid, text), public.accept_chain_title(uuid) from public, anon;
grant execute on function public.suggest_chain_title(uuid, text), public.accept_chain_title(uuid) to authenticated;

create or replace function public.chain_view(p_chain uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', ch.id, 'title', ch.title, 'state', ch.state, 'target', ch.target, 'version', ch.version,
    'created_at', ch.created_at, 'completed_at', ch.completed_at, 'ended_at', ch.ended_at,
    'ended_by_me', coalesce(ch.ended_by = me.account_id, false),
    -- Name gemeinsam: offener Vorschlag (ausdrücklich oder Startname, solange nicht zugestimmt)
    'title_suggestion', private.title_pending(ch.id),
    'title_suggested_by_me', coalesce(private.title_pending_by(ch.id) = me.account_id, false),
    'title_together', ch.title_together,
    'my_role', me.role,
    'my_turn', coalesce(ch.turn_account_id = me.account_id, false),
    'invite_open', exists (select 1 from public.chain_invites i where i.chain_id = ch.id and i.status = 'open' and i.expires_at > now()),
    'public', private.chain_is_public(ch.id),
    'participants', (
      select jsonb_agg(private.person_json(p.account_id, p.role)
                       || jsonb_build_object('me', p.account_id = me.account_id, 'approved', p.approved_at is not null) order by p.role)
      from public.chain_participants p where p.chain_id = ch.id),
    'entries', coalesce((
      select jsonb_agg(jsonb_build_object('position', e.position, 'role', p.role, 'title', e.title, 'artist', e.artist,
                                          'url', e.url, 'comment', e.comment, 'created_at', e.created_at) order by e.position)
      from public.chain_entries e join public.chain_participants p on p.chain_id = e.chain_id and p.account_id = e.author_id
      where e.chain_id = ch.id), '[]'::jsonb)
  )
  from public.chains ch
  join public.chain_participants me on me.chain_id = ch.id and me.account_id = (select auth.uid())
  where ch.id = p_chain;
$$;

