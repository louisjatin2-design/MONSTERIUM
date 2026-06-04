-- ── Gruppe 10 — PvP-Arena (asynchrones Spieler-gegen-Spieler) ────────────────
-- Echtes PvP über Supabase, passend zur bestehenden Snapshot-Architektur:
--   • Jeder Spieler hinterlegt ein VERTEIDIGUNGS-TEAM (Snapshot seiner Monster).
--   • Das Matchmaking sucht einen Gegner mit ähnlichem PvP-Rating (Elo).
--   • Der Angreifer kämpft lokal (KI-gesteuert) gegen diesen Team-Snapshot;
--     das Ergebnis aktualisiert das Rating und wird als Match protokolliert.
-- Treibt src/net/supabaseService.ts (PvP-Methoden) und die PvP-Arena-UI.
-- TODO(security): Mit Supabase-Auth profile_id = auth.uid() erzwingen und das
-- Rating serverseitig (RPC/Edge Function) berechnen, damit Clients nicht
-- beliebige Werte schreiben können.

-- ── Verteidigungs-Teams + PvP-Rating ─────────────────────────────────────────
create table if not exists public.pvp_teams (
  profile_id   text primary key references public.profiles(id) on delete cascade,
  name         text not null default 'Hüter',
  rating       int  not null default 1000,   -- Elo-artiges PvP-Rating
  wins         int  not null default 0,
  losses       int  not null default 0,
  team         jsonb not null default '[]'::jsonb,  -- [{defId,name,level,rankStars,rarity,rarityRank}]
  updated_at   timestamptz not null default now()
);

-- Matchmaking sortiert/filtert nach Rating.
create index if not exists pvp_teams_rating_idx on public.pvp_teams (rating desc);

-- ── Match-Historie ───────────────────────────────────────────────────────────
create table if not exists public.pvp_matches (
  id             uuid primary key default gen_random_uuid(),
  attacker_id    text not null,
  attacker_name  text not null default 'Hüter',
  defender_id    text not null,
  defender_name  text not null default 'Hüter',
  attacker_won   boolean not null,
  rating_delta   int  not null default 0,
  created_at     timestamptz not null default now()
);

create index if not exists pvp_matches_attacker_idx on public.pvp_matches (attacker_id, created_at desc);
create index if not exists pvp_matches_defender_idx on public.pvp_matches (defender_id, created_at desc);

-- ── Row Level Security ───────────────────────────────────────────────────────
alter table public.pvp_teams   enable row level security;
alter table public.pvp_matches enable row level security;

-- Teams: jeder darf lesen (Matchmaking); anon darf (vorerst) eigene Zeile upserten.
drop policy if exists pvp_teams_read   on public.pvp_teams;
drop policy if exists pvp_teams_insert on public.pvp_teams;
drop policy if exists pvp_teams_update on public.pvp_teams;
create policy pvp_teams_read   on public.pvp_teams for select using (true);
create policy pvp_teams_insert on public.pvp_teams for insert with check (true);
create policy pvp_teams_update on public.pvp_teams for update using (true) with check (true);

-- Matches: lesbar; anlegen offen (anon).
drop policy if exists pvp_matches_read   on public.pvp_matches;
drop policy if exists pvp_matches_insert on public.pvp_matches;
create policy pvp_matches_read   on public.pvp_matches for select using (true);
create policy pvp_matches_insert on public.pvp_matches for insert with check (true);

-- ── Tabellen-Rechte für die PostgREST-Rollen ─────────────────────────────────
grant select, insert, update on public.pvp_teams   to anon, authenticated;
grant select, insert         on public.pvp_matches to anon, authenticated;
