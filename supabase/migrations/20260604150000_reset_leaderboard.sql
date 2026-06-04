-- ── Leaderboard-Reset ───────────────────────────────────────────────────────
-- Einmaliger Reset: entfernt alle bisherigen Profil-Zeilen (u. a. Alt-Einträge,
-- die noch eine E-Mail als Anzeigenamen hatten). Neue Profile werden beim
-- nächsten Login mit dem Benutzernamen neu angelegt. Clan-Mitgliedschaften
-- hängen per FK an profiles und werden dabei mit zurückgesetzt.
delete from public.profiles;
