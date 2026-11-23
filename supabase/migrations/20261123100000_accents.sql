-- Akzentfarbe (PROFILE-11, Plan M1b Teil 2 vom 23.11.2026): 8 kuratierte Farben pro Look, Text darauf WCAG AA.
-- Gleiche Liste wie web/src/lib/accents.ts.
create function private.accent_ok(look text, accent text) returns boolean
language sql immutable set search_path = '' as $$
  select upper(accent) = any (case look
    when 'night' then array['#F0532A', '#FF5C5C', '#FF5FD2', '#8C93FF', '#3FD0E0', '#4FE0A0', '#E4F45A', '#FFB020']
    else array['#8C93FF', '#6EC1FF', '#5ED6A8', '#FFC845', '#FF9F4A', '#FF8A6B', '#FF9BD2', '#C9B8FF']
  end);
$$;

-- Nur Farben aus der Palette des gewählten Looks (bestehende Entwürfe nutzen die Standardfarben)
alter table public.profile_drafts add constraint profile_drafts_accent_palette check (private.accent_ok(look, accent));

-- Anlegen und Veröffentlichen mit Akzentfarbe (neuer Parameter, daher alte Fassung ersetzen)
drop function public.create_and_publish_profile(text, text, text[], text[], text, text, text, jsonb, text);
create function public.create_and_publish_profile(
  p_handle text, p_display_name text, p_genres text[], p_plays text[], p_city text,
  p_look text, p_photo_path text, p_section jsonb, p_photo_style text default 'dots', p_accent text default null
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
  if coalesce(p_photo_style, 'dots') not in ('dots', 'bw') then raise exception 'invalid_photo' using errcode = '22023'; end if;
  if p_accent is not null and not private.accent_ok(case when p_look = 'night' then 'night' else 'day' end, p_accent) then
    raise exception 'invalid_accent' using errcode = '22023';
  end if;
  if not private.first_section_ok(p_section) then raise exception 'invalid_section' using errcode = '22023'; end if;
  items := coalesce(p_section->'content'->'mixes', p_section->'content'->'tracks');

  begin
    insert into public.profiles (account_id, handle) values (me, h) returning id into pid;
  exception when unique_violation then
    raise exception 'handle_taken' using errcode = '23505';
  end;

  insert into public.profile_drafts (profile_id, display_name, city, genres, plays, look, accent, photo_path, photo_style)
  values (
    pid, btrim(coalesce(p_display_name, '')), btrim(coalesce(p_city, '')),
    coalesce(p_genres, '{}'), coalesce(p_plays, '{}'),
    case when p_look = 'night' then 'night' else 'day' end,
    coalesce(upper(p_accent), case when p_look = 'night' then '#F0532A' else '#8C93FF' end),
    p_photo_path, coalesce(p_photo_style, 'dots')
  );
  if jsonb_array_length(items) > 0 then
    insert into public.profile_sections (profile_id, kind, title, position, content)
    values (pid, p_section->>'kind', coalesce(p_section->>'title', ''), 1, p_section->'content');
  end if;

  -- Pflichtangaben prüft publish_profile (Name, Foto, Genre, Musik); Fehler rollt alles zurück.
  return public.publish_profile();
end $$;
revoke all on function public.create_and_publish_profile(text, text, text[], text[], text, text, text, jsonb, text, text) from public, anon;
grant execute on function public.create_and_publish_profile(text, text, text[], text[], text, text, text, jsonb, text, text) to authenticated;
