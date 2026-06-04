-- ── Gruppe 8/10 — Auktionshaus (Monster-Handel zwischen Spielern) ────────────
-- Spieler stellen Monster (Snapshot: Spezies/Level/Rang) zum Verkauf ein; ein
-- Käufer erwirbt sie für Gold/Diamanten. Der atomare Statuswechsel active→sold
-- (PATCH … where status=active) verhindert Doppelkäufe.
-- TODO(security): mit Supabase-Auth seller_id = auth.uid() erzwingen.

create table if not exists public.auctions (
  id           uuid primary key default gen_random_uuid(),
  seller_id    text not null,
  seller_name  text not null default 'Hüter',
  def_id       text not null,
  monster_name text not null,
  level        int  not null default 1,
  rank_stars   int  not null default 0,
  rarity       text not null default 'Common',
  price        int  not null check (price >= 0),
  currency     text not null default 'gold' check (currency in ('gold','diamonds')),
  status       text not null default 'active' check (status in ('active','sold')),
  buyer_id     text,
  created_at   timestamptz not null default now()
);

create index if not exists auctions_active_idx on public.auctions (status, created_at desc);

alter table public.auctions enable row level security;

drop policy if exists auctions_read   on public.auctions;
drop policy if exists auctions_insert on public.auctions;
drop policy if exists auctions_update on public.auctions;
create policy auctions_read   on public.auctions for select using (true);
create policy auctions_insert on public.auctions for insert with check (true);
create policy auctions_update on public.auctions for update using (true) with check (true);

grant select, insert, update on public.auctions to anon, authenticated;
