-- ── Auktionshaus — Verkäufer-Erlös (90 %) ───────────────────────────────────
-- Markiert, ob der Erlös eines verkauften Inserats dem Verkäufer bereits
-- gutgeschrieben wurde. collectSoldProceeds() zahlt jeden Verkauf genau einmal
-- aus (atomarer PATCH where proceeds_collected=false).
-- TODO(security): mit Supabase-Auth nur dem Verkäufer (seller_id = auth.uid())
--   erlauben, den eigenen Erlös einzulösen.

alter table public.auctions
  add column if not exists proceeds_collected boolean not null default false;

-- Schnelle Suche nach noch nicht ausgezahlten, verkauften Inseraten je Verkäufer.
create index if not exists auctions_proceeds_idx
  on public.auctions (seller_id, status, proceeds_collected);
