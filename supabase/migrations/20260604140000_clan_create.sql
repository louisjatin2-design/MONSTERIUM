-- ── Gruppe 10 — Clan-Erstellung erlauben ────────────────────────────────────
-- Spieler dürfen jetzt Clans anlegen (im Client kostet das 100 Diamanten).
-- TODO(security): mit Supabase-Auth einschränken/raten-limitieren.
drop policy if exists clans_insert on public.clans;
create policy clans_insert on public.clans for insert with check (true);
grant insert on public.clans to anon, authenticated;
