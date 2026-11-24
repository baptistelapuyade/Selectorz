-- M2 Teil 1 (Plan vom 24.11.2026): Lesefunktionen für die Oberfläche der Track-Ketten.
-- Namen der anderen Person: Name der veröffentlichten Seite, sonst der beim Beitritt angegebene Kontoname.

create or replace function private.person_name(acc uuid) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce(nullif(p.published->>'display_name', ''), nullif(a.display_name, ''), 'A Selectorz DJ')
  from public.accounts a
  left join public.profiles p on p.account_id = a.id and p.status = 'published'
  where a.id = acc;
$$;

create or replace function private.person_handle(acc uuid) returns text
language sql stable security definer set search_path = '' as $$
  select p.handle::text from public.profiles p where p.account_id = acc and p.status = 'published';
$$;

revoke all on function private.person_name(uuid), private.person_handle(uuid) from public, anon, authenticated;

-- Einladung ansehen: jetzt mit dem Seitennamen von A (vorher leerer Kontoname), Kommentar und Ziel
drop function public.peek_invite(text);
create function public.peek_invite(p_token text)
returns table (chain_id uuid, title text, state public.chain_state, creator_name text, creator_handle text,
               track_title text, track_artist text, track_url text, track_comment text, target int,
               invite_open boolean, is_creator boolean, is_participant boolean)
language sql stable security definer set search_path = '' as $$
  select ch.id, ch.title, ch.state, private.person_name(ch.creator_id), private.person_handle(ch.creator_id),
         e.title, e.artist, e.url, e.comment, ch.target,
         (i.status = 'open' and i.expires_at > now() and ch.state = 'waiting_for_partner'),
         coalesce(ch.creator_id = (select auth.uid()), false),
         exists (select 1 from public.chain_participants cp where cp.chain_id = ch.id and cp.account_id = (select auth.uid()))
  from public.chain_invites i
  join public.chains ch on ch.id = i.chain_id
  join public.chain_entries e on e.chain_id = ch.id and e.position = 1
  where i.token_hash = private.hash_token(p_token);
$$;
grant execute on function public.peek_invite(text) to anon, authenticated;

-- Eine Runde, wie die teilnehmenden Personen sie sehen (sonst null)
create or replace function public.chain_view(p_chain uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', ch.id, 'title', ch.title, 'state', ch.state, 'target', ch.target, 'version', ch.version,
    'created_at', ch.created_at, 'completed_at', ch.completed_at, 'ended_at', ch.ended_at,
    'my_role', me.role,
    'my_turn', coalesce(ch.turn_account_id = me.account_id, false),
    'invite_open', exists (select 1 from public.chain_invites i where i.chain_id = ch.id and i.status = 'open' and i.expires_at > now()),
    'participants', (
      select jsonb_agg(jsonb_build_object('role', p.role, 'name', private.person_name(p.account_id),
                                          'handle', private.person_handle(p.account_id), 'me', p.account_id = me.account_id) order by p.role)
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

-- Meine Runden für Home: neueste Bewegung zuerst
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
             'my_turn', coalesce(ch.turn_account_id = me.account_id, false),
             'other', (select jsonb_build_object('name', private.person_name(o.account_id), 'handle', private.person_handle(o.account_id))
                       from public.chain_participants o where o.chain_id = ch.id and o.account_id <> me.account_id),
             'last', (select jsonb_build_object('title', e.title, 'artist', e.artist, 'mine', e.author_id = me.account_id)
                      from public.chain_entries e where e.chain_id = ch.id order by e.position desc limit 1),
             'updated_at', greatest(ch.created_at, coalesce(ch.completed_at, ch.created_at), coalesce(ch.ended_at, ch.created_at),
                                    coalesce((select max(e.created_at) from public.chain_entries e where e.chain_id = ch.id), ch.created_at))
           ) as j
    from public.chains ch
    join public.chain_participants me on me.chain_id = ch.id and me.account_id = (select auth.uid())
  ) r;
$$;

revoke all on function public.chain_view(uuid), public.my_rounds() from public, anon;
grant execute on function public.chain_view(uuid), public.my_rounds() to authenticated;
