-- ── Gruppe 10 — Clan-Chat ────────────────────────────────────────────────────
-- Nachrichten innerhalb eines Clans. Mitglieder-Elo kommt aus pvp_teams.rating;
-- das Clan-Ranking (Gesamt-Elo) wird im Client aus den Mitglieder-Ratings summiert.
-- TODO(security): mit Supabase-Auth auf Clan-Mitglieder beschränken + Realtime.
create table if not exists public.clan_messages (
  id          uuid primary key default gen_random_uuid(),
  clan_id     uuid not null references public.clans(id) on delete cascade,
  profile_id  text not null,
  author_name text not null default 'Hüter',
  body        text not null check (char_length(body) between 1 and 500),
  created_at  timestamptz not null default now()
);

create index if not exists clan_messages_clan_idx on public.clan_messages (clan_id, created_at);

alter table public.clan_messages enable row level security;

drop policy if exists clan_messages_read   on public.clan_messages;
drop policy if exists clan_messages_insert on public.clan_messages;
create policy clan_messages_read   on public.clan_messages for select using (true);
create policy clan_messages_insert on public.clan_messages for insert with check (true);

grant select, insert on public.clan_messages to anon, authenticated;
