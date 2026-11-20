-- M1b „Profil erstellen“ (Plan vom 20.11.2026)
-- Profil, Entwurf, erste Section und Veröffentlichung in einem Schritt; Handle-Prüfung; Foto-Speicher.

-- Reservierte Handles: dieselbe Liste wie web/src/lib/handles.ts (plus neue Seiten wie /start).
create or replace function private.handle_ok(h text) returns boolean
language sql immutable set search_path = '' as $$
  select h ~ '^[a-z0-9](?:[a-z0-9_.]{1,28}[a-z0-9])$'
     and h not in ('admin', 'api', 'app', 'auth', 'build', 'chain', 'chains', 'create', 'feedback', 'help', 'home',
                   'imprint', 'invite', 'licenses', 'login', 'logout', 'mix', 'new', 'preview', 'privacy', 'profile',
                   'report', 'selection', 'selections', 'selectorz', 'settings', 'start', 'support', 'terms', 'www');
$$;

-- Ist ein Handle frei? Für die Meldung beim Tippen; verrät nur ja/nein.
create function public.handle_available(h text) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.handle_ok(h) and not exists (select 1 from public.profiles where handle = h::extensions.citext);
$$;
revoke all on function public.handle_available(text) from public;
grant execute on function public.handle_available(text) to anon, authenticated;

-- Ein Track in einer Section: https-Link, Titel, optional Artist und Anbieter.
create function private.track_ok(t jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(t) = 'object'
     and coalesce(t->>'url', '') ~ '^https://[^\s]+$' and char_length(t->>'url') <= 500
     and char_length(btrim(coalesce(t->>'title', ''))) between 1 and 200
     and char_length(coalesce(t->>'artist', '')) <= 200
     and coalesce(t->>'provider', 'other') in ('soundcloud', 'youtube', 'mixcloud', 'bandcamp', 'other');
$$;

-- Erste Section beim Erstellen: eigener Mix („My sound“, genau einer) oder 1 bis 3 „Set openers“.
create function private.first_section_ok(s jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare
  items jsonb;
  t jsonb;
begin
  if jsonb_typeof(s) <> 'object' or jsonb_typeof(s->'content') <> 'object' then return false; end if;
  if s->>'kind' = 'mix' then items := s->'content'->'mixes';
  elsif s->>'kind' = 'set_openers' then items := s->'content'->'tracks';
  else return false;
  end if;
  if jsonb_typeof(items) <> 'array' then return false; end if;
  if jsonb_array_length(items) > (case when s->>'kind' = 'mix' then 1 else 3 end) then return false; end if;
  for t in select * from jsonb_array_elements(items) loop
    if not private.track_ok(t) then return false; end if;
  end loop;
  return true;
end $$;

create function public.create_and_publish_profile(
  p_handle text, p_display_name text, p_genres text[], p_plays text[], p_city text,
  p_look text, p_photo_path text, p_section jsonb
) returns public.profiles
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  h text := lower(btrim(coalesce(p_handle, '')));
  pid uuid;
  items jsonb;
begin
  if me is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if exists (select 1 from public.profiles where account_id = me) then
    raise exception 'profile_exists' using errcode = '23505';
  end if;
  if not private.handle_ok(h) then raise exception 'invalid_handle' using errcode = '22023'; end if;
  if p_photo_path is not null and p_photo_path !~ ('^' || me::text || '/[A-Za-z0-9_-]{1,64}\.(png|webp)$') then
    raise exception 'invalid_photo' using errcode = '22023';
  end if;
  if not private.first_section_ok(p_section) then raise exception 'invalid_section' using errcode = '22023'; end if;
  items := coalesce(p_section->'content'->'mixes', p_section->'content'->'tracks');

  begin
    insert into public.profiles (account_id, handle) values (me, h) returning id into pid;
  exception when unique_violation then
    raise exception 'handle_taken' using errcode = '23505';
  end;

  insert into public.profile_drafts (profile_id, display_name, city, genres, plays, look, accent, photo_path)
  values (
    pid, btrim(coalesce(p_display_name, '')), btrim(coalesce(p_city, '')),
    coalesce(p_genres, '{}'), coalesce(p_plays, '{}'),
    case when p_look = 'night' then 'night' else 'day' end,
    case when p_look = 'night' then '#F0532A' else '#8C93FF' end,
    p_photo_path
  );
  if jsonb_array_length(items) > 0 then
    insert into public.profile_sections (profile_id, kind, title, position, content)
    values (pid, p_section->>'kind', coalesce(p_section->>'title', ''), 1, p_section->'content');
  end if;

  -- Pflichtangaben prüft publish_profile (Name, Foto, Genre, Musik); Fehler rollt alles zurück.
  return public.publish_profile();
end $$;
revoke all on function public.create_and_publish_profile(text, text, text[], text[], text, text, text, jsonb) from public, anon;
grant execute on function public.create_and_publish_profile(text, text, text[], text[], text, text, text, jsonb) to authenticated;

-- Foto-Speicher: nur das fertige Punkteraster (PNG/WebP, höchstens 1 MB), öffentlich lesbar.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 1048576, array['image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Schreiben nur in den eigenen Ordner <account-id>/… (TRUST-03). Lesen geht über die öffentliche URL,
-- daher keine Select-Policy: Auflisten fremder Ordner ist nicht möglich.
create policy avatars_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatars_update_own on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatars_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
-- Eigene Objekte lesen (nötig für Überschreiben per upsert), fremde nicht.
create policy avatars_select_own on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
