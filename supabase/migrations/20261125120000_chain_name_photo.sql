-- Korrektur Ketten-Screens nach Board (25.11.2026): Name der Auswahl im Abschluss („Name it“) und
-- Profilfotos in der Hülle (geteiltes EP). Fotos nur von veröffentlichten Seiten, die ohnehin öffentlich sind.

-- Name ändern: beide Teilnehmenden, jederzeit; höchstens 60 Zeichen (wie beim Start)
create or replace function public.rename_chain(p_chain uuid, p_title text) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid());
begin
  if me is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if not exists (select 1 from public.chain_participants where chain_id = p_chain and account_id = me) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  update public.chains set title = left(btrim(coalesce(p_title, '')), 60) where id = p_chain;
end $$;
revoke all on function public.rename_chain(uuid, text) from public, anon;
grant execute on function public.rename_chain(uuid, text) to authenticated;

-- Foto (Pfad, Stil, Look) der veröffentlichten Seite
create or replace function private.person_photo(acc uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when p.published->>'photo_path' is null then null
    else jsonb_build_object('path', p.published->>'photo_path', 'style', p.published->>'photo_style',
                            'look', coalesce(p.published->>'look', 'day')) end
  from public.profiles p where p.account_id = acc and p.status = 'published';
$$;
revoke all on function private.person_photo(uuid) from public, anon, authenticated;

create or replace function private.person_json(acc uuid, r public.chain_role) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('role', r, 'name', private.person_name(acc), 'handle', private.person_handle(acc),
                            'color', private.person_color(acc), 'instagram', private.person_instagram(acc),
                            'photo', private.person_photo(acc));
$$;

-- Einladung vergeben (DeskErrTaken3): wer spielt schon mit (nur Vorname) und die Farben beider.
-- Der Vorname der zweiten Person erscheint nur, wenn die Runde schon zwei DJs hat.
drop function public.peek_invite(text);
create function public.peek_invite(p_token text)
returns table (chain_id uuid, title text, state public.chain_state, creator_name text, creator_handle text,
               track_title text, track_artist text, track_url text, track_comment text, target int,
               invite_open boolean, is_creator boolean, is_participant boolean,
               creator_color text, partner_name text, partner_color text)
language sql stable security definer set search_path = '' as $$
  select ch.id, ch.title, ch.state, private.person_name(ch.creator_id), private.person_handle(ch.creator_id),
         e.title, e.artist, e.url, e.comment, ch.target,
         (i.status = 'open' and i.expires_at > now() and ch.state = 'waiting_for_partner'),
         coalesce(ch.creator_id = (select auth.uid()), false),
         exists (select 1 from public.chain_participants cp where cp.chain_id = ch.id and cp.account_id = (select auth.uid())),
         private.person_color(ch.creator_id),
         split_part(private.person_name(b.account_id), ' ', 1),
         private.person_color(b.account_id)
  from public.chain_invites i
  join public.chains ch on ch.id = i.chain_id
  join public.chain_entries e on e.chain_id = ch.id and e.position = 1
  left join public.chain_participants b on b.chain_id = ch.id and b.role = 'B'
  where i.token_hash = private.hash_token(p_token);
$$;
grant execute on function public.peek_invite(text) to anon, authenticated;

-- Beendete Runde (DeskErrEnded „Kofi ended this round.“): wer beendet hat
alter table public.chains add column ended_by uuid references public.accounts (id) on delete set null;

create or replace function public.end_chain(p_chain uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.chains where id = p_chain for update;
  if not private.is_participant(p_chain) then raise exception 'not_allowed' using errcode = '42501'; end if;
  update public.chains set state = 'archived', turn_account_id = null, ended_at = now(), ended_by = (select auth.uid()), version = version + 1
    where id = p_chain and state in ('waiting_for_partner', 'active');
  update public.chain_invites set status = 'revoked' where chain_id = p_chain and status = 'open';
end $$;

create or replace function public.chain_view(p_chain uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', ch.id, 'title', ch.title, 'state', ch.state, 'target', ch.target, 'version', ch.version,
    'created_at', ch.created_at, 'completed_at', ch.completed_at, 'ended_at', ch.ended_at,
    'ended_by_me', coalesce(ch.ended_by = me.account_id, false),
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

-- Home (M1cHomeRounds): Farben beider, letzter Track mit Link und Kommentar (abspielbar in der großen Karte)
create or replace function public.my_rounds() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(r.j order by r.at desc), '[]'::jsonb)
  from (
    select greatest(ch.created_at, coalesce(ch.completed_at, ch.created_at), coalesce(ch.ended_at, ch.created_at),
                    coalesce((select max(e.created_at) from public.chain_entries e where e.chain_id = ch.id), ch.created_at)) as at,
           jsonb_build_object(
             'id', ch.id, 'title', ch.title, 'state', ch.state, 'target', ch.target,
             'count', (select count(*) from public.chain_entries e where e.chain_id = ch.id),
             'my_role', me.role,
             'my_color', private.person_color(me.account_id),
             'my_turn', coalesce(ch.turn_account_id = me.account_id, false),
             'my_yes', me.approved_at is not null,
             'other_yes', coalesce((select o.approved_at is not null from public.chain_participants o
                                    where o.chain_id = ch.id and o.account_id <> me.account_id), false),
             'public', private.chain_is_public(ch.id),
             'other', (select jsonb_build_object('name', private.person_name(o.account_id), 'handle', private.person_handle(o.account_id),
                                          'color', private.person_color(o.account_id))
                       from public.chain_participants o where o.chain_id = ch.id and o.account_id <> me.account_id),
             'last', (select jsonb_build_object('title', e.title, 'artist', e.artist, 'mine', e.author_id = me.account_id,
                                          'position', e.position, 'url', e.url, 'comment', e.comment)
                      from public.chain_entries e where e.chain_id = ch.id order by e.position desc limit 1),
             'updated_at', greatest(ch.created_at, coalesce(ch.completed_at, ch.created_at), coalesce(ch.ended_at, ch.created_at),
                                    coalesce((select max(e.created_at) from public.chain_entries e where e.chain_id = ch.id), ch.created_at))
           ) as j
    from public.chains ch
    join public.chain_participants me on me.chain_id = ch.id and me.account_id = (select auth.uid())
  ) r;
$$;
