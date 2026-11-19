-- Selectorz Kern-Datenmodell (PRD 15.2, 15.3, 17).
-- Grundsatz: Jede Tabelle hat RLS. Alles, was mehrere Zeilen zusammen ändert
-- (Kette starten, beitreten, Zug, Freigabe, Blockieren, Veröffentlichen), läuft
-- als eine Funktion mit Sperre, damit nichts doppelt oder halb passiert.

create extension if not exists citext with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Typen
-- ---------------------------------------------------------------------------
create type public.profile_status as enum ('draft', 'published', 'withdrawn', 'suspended');
create type public.chain_state as enum ('waiting_for_partner', 'active', 'completed', 'archived');
create type public.chain_role as enum ('A', 'B');
create type public.invite_status as enum ('open', 'claimed', 'revoked');
create type public.report_target as enum ('profile', 'chain', 'entry', 'account');
create type public.report_status as enum ('new', 'reviewed', 'action_taken', 'dismissed');

-- ---------------------------------------------------------------------------
-- Konten (eins pro Login)
-- ---------------------------------------------------------------------------
create table public.accounts (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 60),
  notify_email boolean not null default true,
  is_admin boolean not null default false,
  suspended_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.accounts enable row level security;

-- Konto automatisch beim ersten Login anlegen
create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.accounts (id) values (new.id) on conflict do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

create function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select is_admin from public.accounts where id = (select auth.uid())), false);
$$;


create policy accounts_select_own on public.accounts for select to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()));
create policy accounts_update_own on public.accounts for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
-- Nur diese Spalten darf man selbst ändern (nicht is_admin, nicht suspended_at)
revoke update on public.accounts from authenticated;
grant update (display_name, notify_email) on public.accounts to authenticated;

-- ---------------------------------------------------------------------------
-- Profile: öffentliche Fassung getrennt vom Entwurf (PROFILE-03, PROFILE-06)
-- ---------------------------------------------------------------------------
create function private.handle_ok(h text) returns boolean
language sql immutable set search_path = '' as $$
  select h ~ '^[a-z0-9](?:[a-z0-9_.]{1,28}[a-z0-9])$'
     and h not in ('admin', 'api', 'app', 'auth', 'chain', 'chains', 'help', 'home', 'invite',
                   'licenses', 'login', 'logout', 'mix', 'privacy', 'profile', 'report',
                   'selection', 'selections', 'selectorz', 'settings', 'support', 'terms', 'www');
$$;

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null unique references public.accounts (id) on delete cascade,
  handle extensions.citext not null unique check (private.handle_ok(handle::text)),
  status public.profile_status not null default 'draft',
  published jsonb,             -- Momentaufnahme beim Veröffentlichen; nur das sieht die Öffentlichkeit
  published_at timestamptz,
  created_at timestamptz not null default now(),
  check (status <> 'published' or published is not null)
);
alter table public.profiles enable row level security;

-- Entwurf: nur für die Person selbst
create table public.profile_drafts (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 60),
  bio text not null default '' check (char_length(bio) <= 280),
  city text not null default '' check (char_length(city) <= 60),
  genres text[] not null default '{}' check (cardinality(genres) <= 3),
  plays text[] not null default '{}' check (cardinality(plays) <= 3),
  look text not null default 'day' check (look in ('day', 'night')),
  accent text not null default '#8C93FF' check (accent ~ '^#[0-9A-Fa-f]{6}$'),
  photo_path text,
  links jsonb not null default '[]' check (jsonb_typeof(links) = 'array' and jsonb_array_length(links) <= 6),
  updated_at timestamptz not null default now()
);
alter table public.profile_drafts enable row level security;

create table public.profile_sections (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('star_track', 'set_openers', 'set_closers', 'tracks', 'mix', 'transition', 'text')),
  title text not null default '' check (char_length(title) <= 60),
  position int not null check (position between 1 and 8),
  visible boolean not null default true,
  content jsonb not null default '{}' check (jsonb_typeof(content) = 'object'),
  updated_at timestamptz not null default now(),
  unique (profile_id, position) deferrable initially deferred
);
create index profile_sections_profile_idx on public.profile_sections (profile_id);
alter table public.profile_sections enable row level security;

create function private.owns_profile(p uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = p and account_id = (select auth.uid()));
$$;

-- Öffentlich lesbar: nur veröffentlichte Profile, und dort nur die Momentaufnahme
create policy profiles_read on public.profiles for select to anon, authenticated
  using (status = 'published' or account_id = (select auth.uid()) or (select private.is_admin()));
create policy profiles_insert_own on public.profiles for insert to authenticated
  with check (account_id = (select auth.uid()) and status = 'draft' and published is null);
-- Handle ändern nur im Entwurf; Status nur über Funktionen
create policy profiles_update_own on public.profiles for update to authenticated
  using (account_id = (select auth.uid()) and status = 'draft')
  with check (account_id = (select auth.uid()));
revoke update on public.profiles from authenticated;
grant update (handle) on public.profiles to authenticated;

create policy drafts_own on public.profile_drafts for all to authenticated
  using ((select private.owns_profile(profile_id))) with check ((select private.owns_profile(profile_id)));
create policy sections_own on public.profile_sections for all to authenticated
  using ((select private.owns_profile(profile_id))) with check ((select private.owns_profile(profile_id)));

-- Veröffentlichen: Entwurf prüfen und als Momentaufnahme kopieren (PROFILE-04, PROFILE-06)
create function public.publish_profile() returns public.profiles
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
    'photo_path', d.photo_path, 'links', d.links,
    'sections', coalesce((
      select jsonb_agg(jsonb_build_object('kind', s.kind, 'title', s.title, 'content', s.content) order by s.position)
      from public.profile_sections s where s.profile_id = p.id and s.visible
    ), '[]'::jsonb)
  );
  update public.profiles set status = 'published', published = snap, published_at = now()
    where id = p.id returning * into p;
  return p;
end $$;

-- Zurückziehen: öffentliche Fassung weg (PROFILE-07)
create function public.withdraw_profile() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  update public.profiles set status = 'withdrawn', published = null, published_at = null
    where account_id = (select auth.uid()) and status = 'published';
end $$;

-- ---------------------------------------------------------------------------
-- Track-Ketten (PRD 11)
-- ---------------------------------------------------------------------------
create table public.chains (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.accounts (id) on delete cascade,
  title text not null default '' check (char_length(title) <= 60),
  state public.chain_state not null default 'waiting_for_partner',
  target int not null default 6 check (target between 2 and 12),
  turn_account_id uuid references public.accounts (id) on delete set null,
  version int not null default 1,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  ended_at timestamptz
);
create index chains_creator_idx on public.chains (creator_id);
create index chains_turn_idx on public.chains (turn_account_id);
alter table public.chains enable row level security;

create table public.chain_participants (
  chain_id uuid not null references public.chains (id) on delete cascade,
  role public.chain_role not null,
  account_id uuid not null references public.accounts (id) on delete cascade,
  joined_at timestamptz not null default now(),
  approved_at timestamptz,     -- Freigabe zum Veröffentlichen (PUBLISH-01)
  primary key (chain_id, role),
  unique (chain_id, account_id)
);
create index chain_participants_account_idx on public.chain_participants (account_id);
alter table public.chain_participants enable row level security;

create table public.chain_entries (
  id uuid primary key default gen_random_uuid(),
  chain_id uuid not null references public.chains (id) on delete cascade,
  position int not null check (position between 1 and 12),
  author_id uuid not null references public.accounts (id) on delete cascade,
  url text not null check (url ~ '^https://' and char_length(url) <= 500),
  url_key text not null,      -- normalisierte URL gegen Duplikate (CHAIN-12)
  title text not null check (char_length(title) between 1 and 200),
  artist text not null default '' check (char_length(artist) <= 200),
  comment text not null default '' check (char_length(comment) <= 140),
  request_id uuid not null,   -- gleiche Anfrage zweimal = ein Eintrag (CHAIN-07)
  created_at timestamptz not null default now(),
  unique (chain_id, position),
  unique (chain_id, request_id),
  unique (chain_id, url_key)
);
create index chain_entries_author_idx on public.chain_entries (author_id);
alter table public.chain_entries enable row level security;

create table public.chain_invites (
  id uuid primary key default gen_random_uuid(),
  chain_id uuid not null references public.chains (id) on delete cascade,
  token_hash bytea not null unique,   -- nur der Hash, nie das Token selbst (INVITE-01)
  status public.invite_status not null default 'open',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days',
  claimed_by uuid references public.accounts (id) on delete set null
);
create index chain_invites_chain_idx on public.chain_invites (chain_id);
alter table public.chain_invites enable row level security;

create function private.is_participant(c uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.chain_participants where chain_id = c and account_id = (select auth.uid()));
$$;

-- Öffentlich nur, wenn abgeschlossen und beide freigegeben haben (PUBLISH-01..03)
create function private.chain_is_public(c uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.chains where id = c and state = 'completed')
     and (select count(*) from public.chain_participants where chain_id = c and approved_at is not null) = 2;
$$;

create policy chains_read on public.chains for select to anon, authenticated
  using ((select private.is_participant(id)) or (select private.chain_is_public(id)) or (select private.is_admin()));
create policy participants_read on public.chain_participants for select to anon, authenticated
  using ((select private.is_participant(chain_id)) or (select private.chain_is_public(chain_id)) or (select private.is_admin()));
create policy entries_read on public.chain_entries for select to anon, authenticated
  using ((select private.is_participant(chain_id)) or (select private.chain_is_public(chain_id)) or (select private.is_admin()));
create policy invites_read on public.chain_invites for select to authenticated
  using (exists (select 1 from public.chains ch where ch.id = chain_id and ch.creator_id = (select auth.uid())));
-- Kein direktes Schreiben: alles läuft über die Funktionen unten.

create function private.url_key(u text) returns text
language sql immutable set search_path = '' as $$
  select regexp_replace(
           regexp_replace(lower(split_part(split_part(u, '#', 1), '?', 1)), '^https://(www\.|m\.)?', ''),
           '/+$', '');
$$;

create function private.new_token() returns text
language sql volatile set search_path = '' as $$
  select translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '-_');
$$;

create function private.hash_token(t text) returns bytea
language sql immutable set search_path = '' as $$
  select extensions.digest(t, 'sha256');
$$;


-- Kette starten: Track 1 und Einladungslink in einem Schritt (CHAIN-01)
create function public.start_chain(
  p_title text, p_url text, p_track_title text, p_artist text default '',
  p_comment text default '', p_request_id uuid default gen_random_uuid()
) returns table (chain_id uuid, invite_token text)
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  c uuid;
  tok text;
begin
  if me is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if exists (select 1 from public.accounts where id = me and suspended_at is not null) then
    raise exception 'suspended' using errcode = '42501';
  end if;
  insert into public.chains (creator_id, title) values (me, coalesce(p_title, '')) returning id into c;
  insert into public.chain_participants (chain_id, role, account_id) values (c, 'A', me);
  insert into public.chain_entries (chain_id, position, author_id, url, url_key, title, artist, comment, request_id)
    values (c, 1, me, p_url, private.url_key(p_url), p_track_title, coalesce(p_artist, ''), coalesce(p_comment, ''), p_request_id);
  tok := private.new_token();
  insert into public.chain_invites (chain_id, token_hash) values (c, private.hash_token(tok));
  return query select c, tok;
end $$;

-- Einladung neu erzeugen; alte wird ungültig (CHAIN-11, INVITE-02)
create function public.renew_invite(p_chain uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  tok text;
begin
  perform 1 from public.chains
    where id = p_chain and creator_id = (select auth.uid()) and state = 'waiting_for_partner' for update;
  if not found then raise exception 'not_allowed' using errcode = '42501'; end if;
  update public.chain_invites set status = 'revoked' where chain_id = p_chain and status = 'open';
  tok := private.new_token();
  insert into public.chain_invites (chain_id, token_hash) values (p_chain, private.hash_token(tok));
  return tok;
end $$;

create function public.revoke_invite(p_chain uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.chains where id = p_chain and creator_id = (select auth.uid()) for update;
  if not found then raise exception 'not_allowed' using errcode = '42501'; end if;
  update public.chain_invites set status = 'revoked' where chain_id = p_chain and status = 'open';
end $$;

-- Einladung ansehen, ohne beizutreten (CHAIN-03): nur Name von A, Titel und Track 1
create function public.peek_invite(p_token text)
returns table (chain_id uuid, title text, state public.chain_state, creator_name text,
               track_title text, track_artist text, track_url text, invite_open boolean)
language sql stable security definer set search_path = '' as $$
  select ch.id, ch.title, ch.state, a.display_name, e.title, e.artist, e.url,
         (i.status = 'open' and i.expires_at > now() and ch.state = 'waiting_for_partner')
  from public.chain_invites i
  join public.chains ch on ch.id = i.chain_id
  join public.accounts a on a.id = ch.creator_id
  join public.chain_entries e on e.chain_id = ch.id and e.position = 1
  where i.token_hash = private.hash_token(p_token);
$$;

-- Beitreten und Track 2 setzen: eine Operation (CHAIN-02..04, AUTH-04, 15.3)
create function public.join_chain(
  p_token text, p_url text, p_track_title text, p_artist text default '',
  p_comment text default '', p_request_id uuid default gen_random_uuid()
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  inv public.chain_invites;
  ch public.chains;
begin
  if me is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select * into inv from public.chain_invites where token_hash = private.hash_token(p_token);
  if not found then raise exception 'invite_not_found' using errcode = 'P0002'; end if;

  select * into ch from public.chains where id = inv.chain_id for update;

  -- gleiche Anfrage noch einmal (Doppelklick, Retry): gleiches Ergebnis
  if exists (select 1 from public.chain_entries where chain_id = ch.id and request_id = p_request_id and author_id = me) then
    return ch.id;
  end if;
  if ch.creator_id = me then raise exception 'own_invite' using errcode = '42501'; end if;
  if inv.status = 'revoked' or inv.expires_at <= now() then raise exception 'invite_revoked' using errcode = '42501'; end if;
  if inv.status = 'claimed' or ch.state <> 'waiting_for_partner' then raise exception 'chain_taken' using errcode = '23505'; end if;
  if exists (select 1 from public.accounts where id = me and suspended_at is not null) then
    raise exception 'suspended' using errcode = '42501';
  end if;
  if private.blocked_between(me, ch.creator_id) then raise exception 'blocked' using errcode = '42501'; end if;

  insert into public.chain_participants (chain_id, role, account_id) values (ch.id, 'B', me);
  update public.chain_invites set status = 'claimed', claimed_by = me where id = inv.id;
  insert into public.chain_entries (chain_id, position, author_id, url, url_key, title, artist, comment, request_id)
    values (ch.id, 2, me, p_url, private.url_key(p_url), p_track_title, coalesce(p_artist, ''), coalesce(p_comment, ''), p_request_id);
  update public.chains set state = 'active', turn_account_id = ch.creator_id, version = version + 1 where id = ch.id;
  perform private.notify('your_turn', ch.creator_id, ch.id, 'turn:' || ch.id || ':3');
  return ch.id;
end $$;

-- Nächster Track (CHAIN-05..09). p_position = erwartete Position (veralteter Stand fällt auf)
create function public.add_track(
  p_chain uuid, p_position int, p_url text, p_track_title text, p_artist text default '',
  p_comment text default '', p_request_id uuid default gen_random_uuid()
) returns public.chains
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  ch public.chains;
  other uuid;
  n int;
begin
  if me is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select * into ch from public.chains where id = p_chain for update;
  if not found or not exists (select 1 from public.chain_participants where chain_id = p_chain and account_id = me) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if exists (select 1 from public.chain_entries where chain_id = p_chain and request_id = p_request_id and author_id = me) then
    return ch;   -- Wiederholung derselben Anfrage
  end if;
  if ch.state <> 'active' then raise exception 'chain_not_active' using errcode = '42501'; end if;
  if ch.turn_account_id is distinct from me then raise exception 'not_your_turn' using errcode = '42501'; end if;
  select count(*) into n from public.chain_entries where chain_id = p_chain;
  if p_position <> n + 1 then raise exception 'stale' using errcode = '40001'; end if;
  if exists (select 1 from public.chain_entries where chain_id = p_chain and url_key = private.url_key(p_url)) then
    raise exception 'duplicate_track' using errcode = '23505';
  end if;

  insert into public.chain_entries (chain_id, position, author_id, url, url_key, title, artist, comment, request_id)
    values (p_chain, n + 1, me, p_url, private.url_key(p_url), p_track_title, coalesce(p_artist, ''), coalesce(p_comment, ''), p_request_id);
  select account_id into other from public.chain_participants where chain_id = p_chain and account_id <> me;

  if n + 1 >= ch.target then
    update public.chains set state = 'completed', turn_account_id = null, completed_at = now(), version = version + 1
      where id = p_chain returning * into ch;
    perform private.notify('completed', me, p_chain, 'done:' || p_chain || ':' || me);
    perform private.notify('completed', other, p_chain, 'done:' || p_chain || ':' || other);
  else
    update public.chains set turn_account_id = other, version = version + 1 where id = p_chain returning * into ch;
    perform private.notify('your_turn', other, p_chain, 'turn:' || p_chain || ':' || (n + 2));
  end if;
  return ch;
end $$;

-- Runde beenden/verlassen (CHAIN-10) und Freigabe (PUBLISH-01..03)
create function public.end_chain(p_chain uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.chains where id = p_chain for update;
  if not private.is_participant(p_chain) then raise exception 'not_allowed' using errcode = '42501'; end if;
  update public.chains set state = 'archived', turn_account_id = null, ended_at = now(), version = version + 1
    where id = p_chain and state in ('waiting_for_partner', 'active');
  update public.chain_invites set status = 'revoked' where chain_id = p_chain and status = 'open';
end $$;

create function public.set_chain_approval(p_chain uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.chains where id = p_chain and state = 'completed') then
    raise exception 'chain_not_completed' using errcode = '42501';
  end if;
  update public.chain_participants
    set approved_at = case when p_approve then coalesce(approved_at, now()) else null end
    where chain_id = p_chain and account_id = (select auth.uid());
  if not found then raise exception 'not_allowed' using errcode = '42501'; end if;
end $$;

-- ---------------------------------------------------------------------------
-- Benachrichtigungen (NOTIFY-01): jedes Ereignis genau einmal
-- ---------------------------------------------------------------------------
create table public.notification_events (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  recipient_id uuid not null references public.accounts (id) on delete cascade,
  chain_id uuid references public.chains (id) on delete cascade,
  dedupe_key text not null unique,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'skipped')),
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index notification_events_pending_idx on public.notification_events (created_at) where status = 'pending';
create index notification_events_recipient_idx on public.notification_events (recipient_id);
create index notification_events_chain_idx on public.notification_events (chain_id);
alter table public.notification_events enable row level security;
-- Keine Policies: nur der Server (service_role) liest und versendet.

create function private.notify(kind text, recipient uuid, chain uuid, dedupe text) returns void
language sql security definer set search_path = '' as $$
  insert into public.notification_events (kind, recipient_id, chain_id, dedupe_key)
  values (kind, recipient, chain, dedupe) on conflict (dedupe_key) do nothing;
$$;

-- ---------------------------------------------------------------------------
-- Melden und Blockieren (TRUST-05, TRUST-06)
-- ---------------------------------------------------------------------------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.accounts (id) on delete set null,
  target_type public.report_target not null,
  target_id uuid not null,
  reason text not null check (reason in ('spam', 'offensive', 'impersonation', 'copyright', 'other')),
  note text not null default '' check (char_length(note) <= 1000),
  status public.report_status not null default 'new',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create index reports_status_idx on public.reports (status, created_at);
create index reports_reporter_idx on public.reports (reporter_id);
alter table public.reports enable row level security;

create policy reports_insert on public.reports for insert to authenticated
  with check (reporter_id = (select auth.uid()) and status = 'new');
create policy reports_read on public.reports for select to authenticated
  using (reporter_id = (select auth.uid()) or (select private.is_admin()));
create policy reports_admin_update on public.reports for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create table public.blocks (
  blocker_id uuid not null references public.accounts (id) on delete cascade,
  blocked_id uuid not null references public.accounts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index blocks_blocked_idx on public.blocks (blocked_id);
alter table public.blocks enable row level security;

-- Blockiert zwischen zwei Konten (in beide Richtungen)
create function private.blocked_between(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  );
$$;

create policy blocks_read_own on public.blocks for select to authenticated
  using (blocker_id = (select auth.uid()));
create policy blocks_delete_own on public.blocks for delete to authenticated
  using (blocker_id = (select auth.uid()));

-- Blockieren beendet laufende gemeinsame Runden (TRUST-06)
create function public.block_account(p_account uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if p_account = me then raise exception 'cannot_block_self' using errcode = '22023'; end if;
  insert into public.blocks (blocker_id, blocked_id) values (me, p_account) on conflict do nothing;
  update public.chains ch set state = 'archived', turn_account_id = null, ended_at = now(), version = version + 1
    where ch.state in ('waiting_for_partner', 'active')
      and exists (select 1 from public.chain_participants a where a.chain_id = ch.id and a.account_id = me)
      and exists (select 1 from public.chain_participants b where b.chain_id = ch.id and b.account_id = p_account);
  update public.notification_events n set status = 'skipped'
    where n.status = 'pending' and n.recipient_id in (me, p_account)
      and n.chain_id in (select c.chain_id from public.chain_participants c where c.account_id = me
                         intersect select c.chain_id from public.chain_participants c where c.account_id = p_account);
end $$;

-- Sperren durch Betrieb (TRUST-05): Profil offline, Konto kann nichts Neues starten
create function public.admin_suspend(p_account uuid, p_suspend boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'not_allowed' using errcode = '42501'; end if;
  update public.accounts set suspended_at = case when p_suspend then now() else null end where id = p_account;
  if p_suspend then
    update public.profiles set status = 'suspended', published = null, published_at = null where account_id = p_account;
    update public.chains ch set state = 'archived', turn_account_id = null, ended_at = now()
      where ch.state in ('waiting_for_partner', 'active')
        and exists (select 1 from public.chain_participants p where p.chain_id = ch.id and p.account_id = p_account);
  else
    update public.profiles set status = 'draft' where account_id = p_account and status = 'suspended';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Feedback aus der Alpha (auch ohne Login)
-- ---------------------------------------------------------------------------
create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.accounts (id) on delete set null,
  page text not null default '' check (char_length(page) <= 300),
  kind text not null default 'idea' check (kind in ('bug', 'idea', 'confusing', 'love', 'other')),
  message text not null check (char_length(message) between 1 and 3000),
  contact_ok boolean not null default false,
  user_agent text not null default '' check (char_length(user_agent) <= 400),
  created_at timestamptz not null default now(),
  handled_at timestamptz
);
create index feedback_created_idx on public.feedback (created_at);
create index feedback_account_idx on public.feedback (account_id);
alter table public.feedback enable row level security;

create policy feedback_insert on public.feedback for insert to anon, authenticated
  with check (handled_at is null and (account_id is null or account_id = (select auth.uid())));
create policy feedback_admin_read on public.feedback for select to authenticated
  using ((select private.is_admin()));
create policy feedback_admin_update on public.feedback for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- ---------------------------------------------------------------------------
-- Rechte auf Funktionen: nur angemeldete Personen (peek_invite auch ohne Login)
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon;
grant execute on function public.peek_invite(text) to anon, authenticated;
grant execute on function
  public.publish_profile(), public.withdraw_profile(),
  public.start_chain(text, text, text, text, text, uuid),
  public.renew_invite(uuid), public.revoke_invite(uuid),
  public.join_chain(text, text, text, text, text, uuid),
  public.add_track(uuid, int, text, text, text, text, uuid),
  public.end_chain(uuid), public.set_chain_approval(uuid, boolean),
  public.block_account(uuid), public.admin_suspend(uuid, boolean)
  to authenticated;
