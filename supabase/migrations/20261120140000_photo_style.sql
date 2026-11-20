-- Foto-Stil (PRD 14.11, PO-Feedback 20.11.2026): Punkteraster (Standard) oder Schwarz-Weiß ohne Raster.
-- Beim Raster liegen zwei Masken im Speicher: <name>.png (Day, Punkte für Schatten) und <name>-night.png
-- (Night, Punkte für Licht). Vorher entstand bei Night ein Negativ.
alter table public.profile_drafts add column photo_style text not null default 'dots' check (photo_style in ('dots', 'bw'));

-- Veröffentlichen übernimmt den Foto-Stil in die öffentliche Fassung.
create or replace function public.publish_profile() returns public.profiles
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  p public.profiles;
  d public.profile_drafts;
  snap jsonb;
begin
  if me is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select * into p from public.profiles where account_id = me for update;
  if not found then raise exception 'no_profile' using errcode = 'P0002'; end if;
  if p.status = 'suspended' then raise exception 'suspended' using errcode = '42501'; end if;
  select * into d from public.profile_drafts where profile_id = p.id;
  if d is null or d.display_name = '' or d.photo_path is null or cardinality(d.genres) = 0 then
    raise exception 'incomplete_profile' using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.profile_sections s
    where s.profile_id = p.id and s.visible and s.kind in ('star_track', 'set_openers', 'set_closers', 'tracks', 'mix', 'transition')
  ) then
    raise exception 'needs_music_link' using errcode = '23514';
  end if;

  snap := jsonb_build_object(
    'handle', p.handle::text, 'display_name', d.display_name, 'bio', d.bio, 'city', d.city,
    'genres', to_jsonb(d.genres), 'plays', to_jsonb(d.plays), 'look', d.look, 'accent', d.accent,
    'photo_path', d.photo_path, 'photo_style', d.photo_style, 'links', d.links,
    'sections', coalesce((
      select jsonb_agg(jsonb_build_object('kind', s.kind, 'title', s.title, 'content', s.content) order by s.position)
      from public.profile_sections s where s.profile_id = p.id and s.visible
    ), '[]'::jsonb)
  );
  update public.profiles set status = 'published', published = snap, published_at = now()
    where id = p.id returning * into p;
  return p;
end $$;

-- Anlegen und Veröffentlichen mit Foto-Stil (neuer Parameter, daher alte Fassung ersetzen)
drop function public.create_and_publish_profile(text, text, text[], text[], text, text, text, jsonb);
create function public.create_and_publish_profile(
  p_handle text, p_display_name text, p_genres text[], p_plays text[], p_city text,
  p_look text, p_photo_path text, p_section jsonb, p_photo_style text default 'dots'
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
    case when p_look = 'night' then '#F0532A' else '#8C93FF' end,
    p_photo_path, coalesce(p_photo_style, 'dots')
  );
  if jsonb_array_length(items) > 0 then
    insert into public.profile_sections (profile_id, kind, title, position, content)
    values (pid, p_section->>'kind', coalesce(p_section->>'title', ''), 1, p_section->'content');
  end if;

  -- Pflichtangaben prüft publish_profile (Name, Foto, Genre, Musik); Fehler rollt alles zurück.
  return public.publish_profile();
end $$;
revoke all on function public.create_and_publish_profile(text, text, text[], text[], text, text, text, jsonb, text) from public, anon;
grant execute on function public.create_and_publish_profile(text, text, text[], text[], text, text, text, jsonb, text) to authenticated;
