-- M2 Teil 2a: Abschluss, gemeinsame Freigabe und öffentliche Selection (PUBLISH-01..06, SHARE-07/12).
-- Öffentlich nur über SECURITY-DEFINER-Funktionen, die private.chain_is_public prüfen.

-- Personenfarbe: Akzent der veröffentlichten Seite, sonst null (Oberfläche nimmt dann die Rollenfarbe)
create or replace function private.person_color(acc uuid) returns text
language sql stable security definer set search_path = '' as $$
  select nullif(p.published->>'accent', '') from public.profiles p where p.account_id = acc and p.status = 'published';
$$;

-- Instagram-Handle aus den Links der veröffentlichten Seite (für die @-Erwähnung, SHARE-12)
create or replace function private.person_instagram(acc uuid) returns text
language sql stable security definer set search_path = '' as $$
  select (regexp_match(l->>'url', '^https://(?:www\.)?instagram\.com/([A-Za-z0-9._]{1,30})/?(?:[?#].*)?$'))[1]
  from public.profiles p, jsonb_array_elements(coalesce(p.published->'links', '[]'::jsonb)) l
  where p.account_id = acc and p.status = 'published'
    and l->>'url' ~ '^https://(www\.)?instagram\.com/[A-Za-z0-9._]{1,30}/?([?#].*)?$'
  limit 1;
$$;

create or replace function private.person_json(acc uuid, r public.chain_role) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('role', r, 'name', private.person_name(acc), 'handle', private.person_handle(acc),
                            'color', private.person_color(acc), 'instagram', private.person_instagram(acc));
$$;

revoke all on function private.person_color(uuid), private.person_instagram(uuid), private.person_json(uuid, public.chain_role)
  from public, anon, authenticated;

-- Kettenansicht: dazu Freigaben je Person, öffentlich ja/nein, Farben und Instagram
create or replace function public.chain_view(p_chain uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', ch.id, 'title', ch.title, 'state', ch.state, 'target', ch.target, 'version', ch.version,
    'created_at', ch.created_at, 'completed_at', ch.completed_at, 'ended_at', ch.ended_at,
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

-- Meine Runden: dazu Freigabestand für „Needs a yes“, „Public“, „Private“ auf Home
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
             'my_yes', me.approved_at is not null,
             'other_yes', coalesce((select o.approved_at is not null from public.chain_participants o
                                    where o.chain_id = ch.id and o.account_id <> me.account_id), false),
             'public', private.chain_is_public(ch.id),
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

-- Öffentliche Selection: nur abgeschlossen und mit beiden Freigaben, sonst null (PUBLISH-01/02)
create or replace function public.selection_view(p_chain uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', ch.id, 'title', ch.title, 'target', ch.target, 'completed_at', ch.completed_at,
    'participants', (select jsonb_agg(private.person_json(p.account_id, p.role) order by p.role)
                     from public.chain_participants p where p.chain_id = ch.id),
    'entries', (select jsonb_agg(jsonb_build_object('position', e.position, 'role', p.role, 'title', e.title, 'artist', e.artist,
                                                    'url', e.url, 'comment', e.comment) order by e.position)
                from public.chain_entries e join public.chain_participants p on p.chain_id = e.chain_id and p.account_id = e.author_id
                where e.chain_id = ch.id)
  )
  from public.chains ch
  where ch.id = p_chain and private.chain_is_public(ch.id);
$$;

-- Selections auf einem veröffentlichten Profil (PUBLISH-06); nur öffentliche Ketten
create or replace function public.profile_selections(p_handle text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', ch.id, 'title', ch.title, 'completed_at', ch.completed_at,
           'me', private.person_json(me.account_id, me.role),
           'other', private.person_json(o.account_id, o.role),
           'tracks', (select jsonb_agg(jsonb_build_object('title', e.title, 'artist', e.artist) order by e.position)
                      from public.chain_entries e where e.chain_id = ch.id and e.position <= 3)
         ) order by ch.completed_at desc), '[]'::jsonb)
  from public.profiles pr
  join public.chain_participants me on me.account_id = pr.account_id
  join public.chain_participants o on o.chain_id = me.chain_id and o.account_id <> me.account_id
  join public.chains ch on ch.id = me.chain_id
  where pr.handle = p_handle::extensions.citext and pr.status = 'published' and private.chain_is_public(ch.id);
$$;

revoke all on function public.chain_view(uuid), public.my_rounds(), public.selection_view(uuid), public.profile_selections(text) from public, anon;
grant execute on function public.chain_view(uuid), public.my_rounds() to authenticated;
grant execute on function public.selection_view(uuid), public.profile_selections(text) to anon, authenticated;
