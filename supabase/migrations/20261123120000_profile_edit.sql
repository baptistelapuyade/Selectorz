-- Profil bearbeiten (M1c Teil 1, Plan vom 23.11.2026).
-- Änderungen landen im Entwurf. Die öffentliche Seite ändert sich erst mit „Publish changes“.
-- „Discard changes“ stellt den zuletzt veröffentlichten Entwurf wieder her (inklusive ausgeblendeter Sections).

-- „About you“: kurzer Satz unter dem Namen (vorher 280 Zeichen, bisher nie befüllt)
alter table public.profile_drafts drop constraint profile_drafts_bio_check;
alter table public.profile_drafts add constraint profile_drafts_bio_check check (char_length(bio) <= 160);

-- Kopie des Entwurfs beim letzten Veröffentlichen (nur für die Person selbst, über die Entwurfs-RLS)
alter table public.profile_drafts add column last_published jsonb;

-- Die Kopie setzt nur das Veröffentlichen; selbst schreiben darf man nur die Entwurfsfelder.
revoke insert, update on public.profile_drafts from anon, authenticated;
grant insert (profile_id, display_name, bio, city, genres, plays, look, accent, photo_path, photo_style, links, updated_at)
  on public.profile_drafts to authenticated;
grant update (display_name, bio, city, genres, plays, look, accent, photo_path, photo_style, links, updated_at)
  on public.profile_drafts to authenticated;

-- ---------------------------------------------------------------------------
-- Inhalt einer Section prüfen (gilt für jedes Schreiben, auch direkt über RLS)
-- ---------------------------------------------------------------------------
create function private.section_ok(k text, title text, c jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare
  items jsonb;
  t jsonb;
begin
  if c is null or jsonb_typeof(c) <> 'object' or char_length(coalesce(title, '')) > 60 then return false; end if;
  if char_length(coalesce(c->>'note', '')) > 140 then return false; end if;
  if k = 'mix' or k in ('set_openers', 'set_closers', 'tracks') then
    items := c->(case when k = 'mix' then 'mixes' else 'tracks' end);
    if items is null then return true; end if;
    if jsonb_typeof(items) <> 'array' or jsonb_array_length(items) > (case when k = 'mix' then 1 else 3 end) then return false; end if;
    for t in select * from jsonb_array_elements(items) loop
      if not private.track_ok(t) then return false; end if;
    end loop;
    return true;
  elsif k = 'star_track' then
    return c->'track' is null or jsonb_typeof(c->'track') = 'null' or private.track_ok(c->'track');
  elsif k = 'text' then
    return jsonb_typeof(coalesce(c->'text', '""')) = 'string' and char_length(coalesce(c->>'text', '')) <= 280;
  elsif k = 'transition' then
    return coalesce(c->>'url', '') ~ '^https://[^\s]+$' and char_length(c->>'url') <= 500
       and jsonb_typeof(c->'start') = 'number' and jsonb_typeof(c->'end') = 'number'
       and (c->>'start')::numeric >= 0 and (c->>'end')::numeric > (c->>'start')::numeric;
  end if;
  return false;
end $$;

-- Hat die Section etwas zum Zeigen? (leere Sections bleiben im Entwurf, gehen aber nicht live)
create function private.section_filled(k text, c jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select case
    when k = 'mix' then jsonb_array_length(coalesce(c->'mixes', '[]')) > 0
    when k in ('set_openers', 'set_closers', 'tracks') then jsonb_array_length(coalesce(c->'tracks', '[]')) > 0
    when k = 'star_track' then jsonb_typeof(c->'track') = 'object'
    when k = 'text' then btrim(coalesce(c->>'text', '')) <> ''
    when k = 'transition' then coalesce(c->>'url', '') <> ''
    else false
  end;
$$;

-- Bestehende Zeilen sind vom Bauen geprüft; ab jetzt gilt die Prüfung für alle neuen Werte.
alter table public.profile_sections
  add constraint profile_sections_content_ok check (private.section_ok(kind, title, content)) not valid;

-- ---------------------------------------------------------------------------
-- Ganzer Entwurf als JSON (Grundlage für „hat Änderungen“ und „verwerfen“)
-- ---------------------------------------------------------------------------
create function private.draft_json(pid uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'display_name', d.display_name, 'bio', d.bio, 'city', d.city,
    'genres', to_jsonb(d.genres), 'plays', to_jsonb(d.plays), 'look', d.look, 'accent', d.accent,
    'photo_path', d.photo_path, 'photo_style', d.photo_style, 'links', d.links,
    'sections', coalesce((
      select jsonb_agg(jsonb_build_object('kind', s.kind, 'title', s.title, 'visible', s.visible, 'content', s.content) order by s.position)
      from public.profile_sections s where s.profile_id = pid
    ), '[]'::jsonb)
  )
  from public.profile_drafts d where d.profile_id = pid;
$$;
revoke all on function private.draft_json(uuid) from public, anon, authenticated;

create function private.edit_state(pid uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', p.id, 'handle', p.handle::text, 'status', p.status, 'published_at', p.published_at,
    'draft', private.draft_json(p.id),
    'changed', p.status = 'published' and private.draft_json(p.id) is distinct from d.last_published
  )
  from public.profiles p join public.profile_drafts d on d.profile_id = p.id
  where p.id = pid;
$$;
revoke all on function private.edit_state(uuid) from public, anon, authenticated;

-- Eigenes Profil zum Bearbeiten (null, wenn es noch keins gibt)
create function public.my_profile() returns jsonb
language sql stable security definer set search_path = '' as $$
  select private.edit_state(p.id) from public.profiles p where p.account_id = (select auth.uid());
$$;
revoke all on function public.my_profile() from public, anon;
grant execute on function public.my_profile() to authenticated;

-- ---------------------------------------------------------------------------
-- Entwurf speichern: Grunddaten und alle Sections in einem Schritt (Reihenfolge = Position)
-- ---------------------------------------------------------------------------
create function public.save_profile_draft(p_draft jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  p public.profiles;
  secs jsonb := coalesce(p_draft->'sections', '[]'::jsonb);
  s jsonb;
  v_look text := case when p_draft->>'look' = 'night' then 'night' else 'day' end;
  v_photo text := nullif(p_draft->>'photo_path', '');
  i int := 0;
begin
  if me is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select * into p from public.profiles where account_id = me for update;
  if not found then raise exception 'no_profile' using errcode = 'P0002'; end if;
  if p.status = 'suspended' then raise exception 'suspended' using errcode = '42501'; end if;
  if jsonb_typeof(p_draft) <> 'object' or jsonb_typeof(secs) <> 'array' then raise exception 'invalid_draft' using errcode = '22023'; end if;
  if jsonb_array_length(secs) > 8 then raise exception 'too_many_sections' using errcode = '23514'; end if;
  if v_photo is not null and v_photo !~ ('^' || me::text || '/[A-Za-z0-9_-]{1,64}\.(png|webp)$') then
    raise exception 'invalid_photo' using errcode = '22023';
  end if;
  if coalesce(p_draft->>'photo_style', 'dots') not in ('dots', 'bw') then raise exception 'invalid_photo' using errcode = '22023'; end if;
  if not private.accent_ok(v_look, coalesce(p_draft->>'accent', '')) then raise exception 'invalid_accent' using errcode = '22023'; end if;
  for s in select * from jsonb_array_elements(secs) loop
    if not private.section_ok(s->>'kind', s->>'title', s->'content') then
      raise exception 'invalid_section' using errcode = '22023';
    end if;
  end loop;

  update public.profile_drafts set
    display_name = btrim(coalesce(p_draft->>'display_name', '')),
    bio = btrim(coalesce(p_draft->>'bio', '')),
    city = btrim(coalesce(p_draft->>'city', '')),
    genres = coalesce((select array_agg(x) from jsonb_array_elements_text(p_draft->'genres') x), '{}'),
    plays = coalesce((select array_agg(x) from jsonb_array_elements_text(p_draft->'plays') x), '{}'),
    look = v_look,
    accent = upper(p_draft->>'accent'),
    photo_path = v_photo,
    photo_style = coalesce(p_draft->>'photo_style', 'dots'),
    updated_at = now()
  where profile_id = p.id;

  delete from public.profile_sections where profile_id = p.id;
  for s in select * from jsonb_array_elements(secs) loop
    i := i + 1;
    insert into public.profile_sections (profile_id, kind, title, position, visible, content)
    values (p.id, s->>'kind', coalesce(s->>'title', ''), i, coalesce((s->>'visible')::boolean, true), s->'content');
  end loop;

  return private.edit_state(p.id);
end $$;
revoke all on function public.save_profile_draft(jsonb) from public, anon;
grant execute on function public.save_profile_draft(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Veröffentlichen: nur gefüllte, sichtbare Sections; „About you“ kommt mit; Kopie für „verwerfen“
-- ---------------------------------------------------------------------------
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
    where s.profile_id = p.id and s.visible and s.kind <> 'text' and private.section_filled(s.kind, s.content)
  ) then
    raise exception 'needs_music_link' using errcode = '23514';
  end if;

  snap := jsonb_build_object(
    'handle', p.handle::text, 'display_name', d.display_name, 'bio', d.bio, 'city', d.city,
    'genres', to_jsonb(d.genres), 'plays', to_jsonb(d.plays), 'look', d.look, 'accent', d.accent,
    'photo_path', d.photo_path, 'photo_style', d.photo_style, 'links', d.links,
    'sections', coalesce((
      select jsonb_agg(jsonb_build_object('kind', s.kind, 'title', s.title, 'content', s.content) order by s.position)
      from public.profile_sections s
      where s.profile_id = p.id and s.visible and private.section_filled(s.kind, s.content)
    ), '[]'::jsonb)
  );
  update public.profiles set status = 'published', published = snap, published_at = now()
    where id = p.id returning * into p;
  update public.profile_drafts set last_published = private.draft_json(p.id) where profile_id = p.id;
  return p;
end $$;

-- Verwerfen: Entwurf auf den Stand beim letzten Veröffentlichen zurücksetzen
create function public.discard_profile_changes() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  p public.profiles;
  lp jsonb;
  s jsonb;
  i int := 0;
begin
  if me is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select * into p from public.profiles where account_id = me for update;
  if not found then raise exception 'no_profile' using errcode = 'P0002'; end if;
  select last_published into lp from public.profile_drafts where profile_id = p.id;
  if lp is null then raise exception 'nothing_to_discard' using errcode = 'P0002'; end if;

  update public.profile_drafts set
    display_name = lp->>'display_name', bio = coalesce(lp->>'bio', ''), city = coalesce(lp->>'city', ''),
    genres = coalesce((select array_agg(x) from jsonb_array_elements_text(lp->'genres') x), '{}'),
    plays = coalesce((select array_agg(x) from jsonb_array_elements_text(lp->'plays') x), '{}'),
    look = lp->>'look', accent = lp->>'accent', photo_path = lp->>'photo_path',
    photo_style = coalesce(lp->>'photo_style', 'dots'), links = coalesce(lp->'links', '[]'), updated_at = now()
  where profile_id = p.id;
  delete from public.profile_sections where profile_id = p.id;
  for s in select * from jsonb_array_elements(coalesce(lp->'sections', '[]')) loop
    i := i + 1;
    insert into public.profile_sections (profile_id, kind, title, position, visible, content)
    values (p.id, s->>'kind', coalesce(s->>'title', ''), i, coalesce((s->>'visible')::boolean, true), s->'content');
  end loop;
  return private.edit_state(p.id);
end $$;
revoke all on function public.discard_profile_changes() from public, anon;
grant execute on function public.discard_profile_changes() to authenticated;

-- Bisher veröffentlichte Profile: Entwurf und öffentliche Fassung sind gleich (Bearbeiten gab es noch nicht)
update public.profile_drafts d set last_published = private.draft_json(d.profile_id)
  from public.profiles p where p.id = d.profile_id and p.status = 'published';
