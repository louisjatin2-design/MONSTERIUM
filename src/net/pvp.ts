// ── Gruppe 10 — PvP-Arena: gemeinsame Logik (Rating, Bot-Gegner, Teams) ──────
// Von der lokalen Mock-Implementierung (onlineService.ts) UND dem echten
// Supabase-Adapter (supabaseService.ts) genutzt, damit beide identisch rechnen.
import { useGameStore } from '@store/gameStore';
import { MONSTER_DEFS } from '@data/monsters';
import { RARITY_RANK } from '@data/rarities';
import type { PvpTeamMonster, PvpOpponent } from './types';

// Jeder Spieler startet mit diesem Rating. Bei der Gegnersuche werden bevorzugt
// Spieler in diesem Rating-Band gematcht.
export const PVP_START_RATING = 1000;
// Elo-K-Faktor: wie stark ein einzelnes Match das Rating bewegt.
export const PVP_K_FACTOR = 32;
// Maximales Verteidigungs-/Angriffsteam (passt zu MAX_TEAM im TeamSelectPanel).
export const PVP_TEAM_SIZE = 3;
// Trophäen-Gewinn pro PvP-Sieg (zusätzlich zur Rating-Änderung; speist die
// bestehende Trophäen-Bestenliste).
export const PVP_WIN_TROPHIES = 25;

/**
 * Elo-artige Rating-Änderung für den Angreifer.
 *   expected = 1 / (1 + 10^((gegner - selbst) / 400))
 *   delta    = round(K * (score - expected))   (score: 1 Sieg, 0 Niederlage)
 * Ein Sieg gegen einen stärkeren Gegner bringt mehr, eine Niederlage gegen einen
 * schwächeren kostet mehr. Das resultierende Rating fällt nie unter 0.
 */
export function ratingDelta(selfRating: number, opponentRating: number, won: boolean): number {
  const expected = 1 / (1 + Math.pow(10, (opponentRating - selfRating) / 400));
  const score = won ? 1 : 0;
  return Math.round(PVP_K_FACTOR * (score - expected));
}

export function applyRatingDelta(selfRating: number, delta: number): number {
  return Math.max(0, selfRating + delta);
}

/** Baut aus dem aktuellen Spielstand ein vernünftiges Standard-Verteidigungsteam. */
export function buildDefaultDefenseTeam(): PvpTeamMonster[] {
  const s = useGameStore.getState();
  return Object.values(s.monsters)
    .sort((a, b) => b.level - a.level)
    .slice(0, PVP_TEAM_SIZE)
    .map(m => toTeamMonster(m.defId, m.level, m.rankStars ?? 0, m.name));
}

/** Normalisiert ein Monster zu einem PvP-Team-Snapshot (mit Rarität/Rang). */
export function toTeamMonster(defId: string, level: number, rankStars: number, name?: string): PvpTeamMonster {
  const d = MONSTER_DEFS[defId];
  return {
    defId,
    name: name ?? d?.name ?? defId,
    level: Math.max(1, Math.floor(level)),
    rankStars: Math.max(0, Math.floor(rankStars)),
    rarity: d?.rarity ?? 'Common',
    rarityRank: d ? RARITY_RANK[d.rarity] : 0,
  };
}

const ALL_DEF_IDS = Object.keys(MONSTER_DEFS);

function seeded(n: number): () => number {
  let x = n + 0x9e3779b9;
  return () => { x = Math.imul(x ^ (x >>> 15), 1 | x); x ^= x + Math.imul(x ^ (x >>> 7), 61 | x); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
}

const BOT_NAMES = [
  'Aurelia', 'Kraxx', 'Nyx', 'Volt', 'Seraphine', 'Grimm', 'Lyra', 'Onyx',
  'Vesper', 'Cinder', 'Mira', 'Draxen', 'Selka', 'Thorne', 'Yuki', 'Rook',
];

/**
 * Erzeugt einen simulierten PvP-Gegner. Wird genutzt, wenn (noch) keine echten
 * gegnerischen Verteidigungs-Teams im Backend liegen — so ist die Arena immer
 * spielbar. Das Team-Level wird grob am eigenen Rating ausgerichtet, damit der
 * Kampf fair bleibt.
 */
export function makeBotOpponent(selfRating: number, seed = Math.floor(Math.random() * 1e9)): PvpOpponent {
  const r = seeded(seed);
  const name = BOT_NAMES[Math.floor(r() * BOT_NAMES.length)] ?? 'Rivale';
  // Gegner-Rating ±120 um das eigene, nie unter 100.
  const rating = Math.max(100, Math.round(selfRating + (r() - 0.5) * 240));
  // Team-Level steigt mit dem Rating (Start ~Lv 8, +1 Level pro ~25 Ratingpunkte
  // über dem Start), leicht streuend.
  const baseLevel = Math.max(5, Math.round(8 + (rating - PVP_START_RATING) / 25));
  const team: PvpTeamMonster[] = Array.from({ length: PVP_TEAM_SIZE }, () => {
    const defId = ALL_DEF_IDS[Math.floor(r() * ALL_DEF_IDS.length)] ?? ALL_DEF_IDS[0];
    const level = Math.max(1, baseLevel + Math.floor((r() - 0.5) * 6));
    const rankStars = r() < 0.25 ? 1 + Math.floor(r() * 3) : 0;
    return toTeamMonster(defId, level, rankStars);
  });
  return { id: `bot_${seed}`, name, rating, team, isBot: true };
}

/** Wählt aus einer Liste von Gegnern den ratingnächsten (mit etwas Zufall). */
export function pickClosestOpponent<T extends { rating: number }>(opponents: T[], selfRating: number): T | null {
  if (opponents.length === 0) return null;
  const sorted = [...opponents].sort(
    (a, b) => Math.abs(a.rating - selfRating) - Math.abs(b.rating - selfRating),
  );
  // Unter den 3 nächsten zufällig wählen, damit nicht immer derselbe kommt.
  const pool = sorted.slice(0, Math.min(3, sorted.length));
  return pool[Math.floor(Math.random() * pool.length)] ?? sorted[0];
}
