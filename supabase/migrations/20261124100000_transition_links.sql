-- M1c Teil 2 (Plan vom 23.11.2026, freigegeben 24.11.): Proud transition und Links im Editor.
-- Transition: leer erlaubt (gerade angelegt), sonst Start vor Ende und höchstens 3 Minuten.
-- Links: höchstens 6, je Name (1–40 Zeichen) und https-Adresse; gehören zum Entwurf (live mit „Publish changes“).

create or replace function private.section_ok(k text, title text, c jsonb) returns boolean
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
    -- leer (gerade angelegt) ist erlaubt; sonst Link, Start vor Ende, höchstens 3 Minuten
    if coalesce(c->>'url', '') = '' then return true; end if;
    return (c->>'url') ~ '^https://[^\s]+$' and char_length(c->>'url') <= 500
       and char_length(coalesce(c->>'title', '')) <= 200
       and jsonb_typeof(c->'start') = 'number' and jsonb_typeof(c->'end') = 'number'
       and (c->>'start')::numeric >= 0 and (c->>'end')::numeric > (c->>'start')::numeric
       and (c->>'end')::numeric - (c->>'start')::numeric <= 180;
  end if;
  return false;
end $$;

create function private.links_ok(l jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare
  x jsonb;
begin
  if l is null or jsonb_typeof(l) <> 'array' or jsonb_array_length(l) > 6 then return false; end if;
  for x in select * from jsonb_array_elements(l) loop
    if jsonb_typeof(x) <> 'object'
       or char_length(btrim(coalesce(x->>'label', ''))) not between 1 and 40
       or coalesce(x->>'url', '') !~ '^https://[^\s]+\.[^\s]+$'
       or char_length(x->>'url') > 500 then
      return false;
    end if;
  end loop;
  return true;
end $$;

alter table public.profile_drafts add constraint profile_drafts_links_ok check (private.links_ok(links)) not valid;

create or replace function public.save_profile_draft(p_draft jsonb) returns jsonb
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
  if not private.links_ok(coalesce(p_draft->'links', '[]'::jsonb)) then raise exception 'invalid_links' using errcode = '22023'; end if;
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
    links = coalesce(p_draft->'links', '[]'::jsonb),
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
