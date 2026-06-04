-- ── Gruppe 10 — Multiplayer-Schema (Profile, Clans, Clan-Mitglieder) ─────────
-- Treibt Bestenlisten, Freundesliste (Profile) und das Clan-System im Client
-- (src/net/supabaseService.ts). Schreibzugriff ist vorerst anon-offen, da noch
-- kein Supabase-Auth angebunden ist.
-- TODO(security): Sobald Supabase-Auth genutzt wird, RLS auf auth.uid() = id
-- verschärfen und die offenen insert/update/delete-Policies entfernen.

-- ── Profile ─────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id            text primary key,                 -- account-gebundene Spieler-ID
  name          text not null default 'Hüter',
  player_level  int  not null default 1,
  trophies      int  not null default 0,
  battles_won   int  not null default 0,
  monsters_owned int not null default 0,
  rarest_rank   int  not null default 0,
  top_monsters  jsonb not null default '[]'::jsonb,
  updated_at    timestamptz not null default now()
);

-- Indizes für die Bestenlisten-Sortierung.
create index if not exists profiles_trophies_idx    on public.profiles (trophies desc);
create index if not exists profiles_battles_idx     on public.profiles (battles_won desc);
create index if not exists profiles_rarest_idx      on public.profiles (rarest_rank desc);
create index if not exists profiles_level_idx       on public.profiles (player_level desc);

-- ── Clans ───────────────────────────────────────────────────────────────────
create table if not exists public.clans (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  tag         text not null,
  description text not null default '',
  trophies    int  not null default 0,
  max_members int  not null default 30,
  created_at  timestamptz not null default now()
);

create table if not exists public.clan_members (
  clan_id    uuid not null references public.clans(id) on delete cascade,
  profile_id text not null references public.profiles(id) on delete cascade,
  joined_at  timestamptz not null default now(),
  primary key (clan_id, profile_id)
);

-- ── Row Level Security ───────────────────────────────────────────────────────
alter table public.profiles     enable row level security;
alter table public.clans        enable row level security;
alter table public.clan_members enable row level security;

-- Profile: jeder darf lesen; anon darf (vorerst) eigene Zeile upserten.
drop policy if exists profiles_read   on public.profiles;
drop policy if exists profiles_insert on public.profiles;
drop policy if exists profiles_update on public.profiles;
create policy profiles_read   on public.profiles for select using (true);
create policy profiles_insert on public.profiles for insert with check (true);
create policy profiles_update on public.profiles for update using (true) with check (true);

-- Clans: nur lesbar (Seeding erfolgt per Migration als Owner, umgeht RLS).
drop policy if exists clans_read on public.clans;
create policy clans_read on public.clans for select using (true);

-- Clan-Mitglieder: lesbar; beitreten/verlassen offen (anon).
drop policy if exists clan_members_read   on public.clan_members;
drop policy if exists clan_members_insert on public.clan_members;
drop policy if exists clan_members_delete on public.clan_members;
create policy clan_members_read   on public.clan_members for select using (true);
create policy clan_members_insert on public.clan_members for insert with check (true);
create policy clan_members_delete on public.clan_members for delete using (true);

-- ── Tabellen-Rechte für die PostgREST-Rollen ─────────────────────────────────
grant select, insert, update on public.profiles     to anon, authenticated;
grant select                  on public.clans        to anon, authenticated;
grant select, insert, delete  on public.clan_members to anon, authenticated;

-- ── Start-Clans (idempotent) ─────────────────────────────────────────────────
insert into public.clans (name, tag, description, trophies, max_members) values
  ('Emberguard',  'EMB',  'Feuer-Veteranen, die den Riss zurückdrängen.', 18400, 30),
  ('Tidecallers', 'TIDE', 'Wasser-Taktiker mit eiserner Disziplin.',      15120, 30),
  ('Voidborn',    'VOID', 'Sammler seltenster Dämonen.',                  21030, 30),
  ('Dawnseekers', 'DAWN', 'Beschützer-Gilde, Einsteiger willkommen.',      9800, 30)
on conflict (name) do nothing;
