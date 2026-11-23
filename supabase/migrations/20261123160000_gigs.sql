-- Next gigs (Alpha P0, Briefing vom 23.11.2026, Projekt-Doc Gigs_Briefing).
-- Gigs gehen sofort live (kein „Publish changes“). Öffentlich sichtbar bis 12 Uhr am Folgetag (Berlin),
-- danach bleiben sie gespeichert („Played at“). Nur für veröffentlichte Seiten öffentlich lesbar.

create table public.gigs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  date date not null,
  event text not null check (char_length(btrim(event)) between 1 and 80),
  city text not null check (char_length(btrim(city)) between 1 and 60),
  url text check (url is null or (url ~ '^https://[^\s]+\.[^\s]+$' and char_length(url) <= 500)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index gigs_profile_date_idx on public.gigs (profile_id, date);
alter table public.gigs enable row level security;

-- „Heute“ für Gigs: bis 12 Uhr mittags gilt noch der Vortag (Sets gehen oft bis in den Morgen)
create function private.gig_day() returns date
language sql stable set search_path = '' as $$
  select ((now() at time zone 'Europe/Berlin') - interval '12 hours')::date;
$$;

create function private.profile_is_public(p uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = p and status = 'published');
$$;

create policy gigs_read on public.gigs for select to anon, authenticated
  using (
    (select private.owns_profile(profile_id))
    or ((select private.profile_is_public(profile_id)) and date >= (select private.gig_day()))
  );
create policy gigs_insert_own on public.gigs for insert to authenticated
  with check ((select private.owns_profile(profile_id)));
create policy gigs_update_own on public.gigs for update to authenticated
  using ((select private.owns_profile(profile_id))) with check ((select private.owns_profile(profile_id)));
create policy gigs_delete_own on public.gigs for delete to authenticated
  using ((select private.owns_profile(profile_id)));

-- Plausible Daten beim Eintragen oder Verschieben; höchstens 50 Gigs pro Seite
create function private.gigs_check() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.date is distinct from old.date then
    if new.date < private.gig_day() - 1 or new.date > private.gig_day() + 730 then
      raise exception 'invalid_gig_date' using errcode = '22023';
    end if;
  end if;
  if tg_op = 'INSERT' and (select count(*) from public.gigs where profile_id = new.profile_id) >= 50 then
    raise exception 'too_many_gigs' using errcode = '23514';
  end if;
  new.event := btrim(new.event);
  new.city := btrim(new.city);
  new.updated_at := now();
  return new;
end $$;
create trigger gigs_check before insert or update on public.gigs
  for each row execute function private.gigs_check();
