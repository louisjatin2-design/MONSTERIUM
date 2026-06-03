// ── Gruppe 5 — Season Pass (zeitlich begrenzter Battle Pass) ────────────────
// Eine Saison läuft SEASON_LENGTH_DAYS Tage. Tägliche Aufgaben geben Saison-XP;
// mit steigender XP schaltet man gestaffelte Belohnungs-Stufen frei. Läuft die
// Saison ab, startet automatisch eine neue (Fortschritt zurückgesetzt).
// Tägliche Aufgaben messen den Zuwachs der vorhandenen Lifetime-Stats seit
// Tagesbeginn (Baseline) — kein zusätzliches Tracking pro Aktion nötig.

export const SEASON_LENGTH_DAYS = 28;
export const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type SeasonStatKey = 'battlesWon' | 'feeds' | 'hatches' | 'breeds' | 'collects';

export interface SeasonDailyTask {
  id: string;
  label: string;
  stat: SeasonStatKey;
  goal: number;
  xp: number;     // Saison-XP bei Abschluss
}

// Tägliche Aufgaben-Pool (fix; täglich gleicher Satz — bewusst einfach gehalten).
// TODO: später rotierende/zufällige Tagesaufgaben pro dayKey.
export const SEASON_DAILY_TASKS: SeasonDailyTask[] = [
  { id: 'd_battle', label: 'Gewinne 1 Kampf',     stat: 'battlesWon', goal: 1, xp: 40 },
  { id: 'd_feed',   label: 'Füttere 10×',          stat: 'feeds',      goal: 10, xp: 30 },
  { id: 'd_hatch',  label: 'Brüte 1 Ei aus',       stat: 'hatches',    goal: 1, xp: 50 },
];

export interface SeasonReward {
  gold?: number;
  diamonds?: number;
  food?: number;
  eggDefId?: string;
}

export interface SeasonTier {
  tier: number;
  xpNeeded: number;
  reward: SeasonReward;
}

// 15 Stufen, je 100 XP Abstand, mit steigenden Belohnungen + Highlight-Eier.
export const SEASON_TIERS: SeasonTier[] = Array.from({ length: 15 }, (_, i) => {
  const tier = i + 1;
  const reward: SeasonReward = { gold: 200 * tier };
  if (tier % 5 === 0) reward.diamonds = 10 * (tier / 5);   // jede 5. Stufe: Diamanten
  else if (tier % 2 === 0) reward.food = 50 * tier;        // gerade Stufen: Futter
  if (tier === 10) reward.eggDefId = 'flameling';          // Highlight-Belohnung
  if (tier === 15) reward.eggDefId = 'aquapup';            // Saison-Finale
  return { tier, xpNeeded: tier * 100, reward };
});

/** YYYY-MM-DD-Schlüssel der lokalen Geräteuhrzeit für die Tages-Rollover-Logik. */
export function dayKeyOf(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/** Lesbare Saison-Kennung (z. B. „S5") aus dem Startzeitpunkt. */
export function seasonIdOf(startMs: number): string {
  return `S${Math.floor(startMs / (SEASON_LENGTH_DAYS * MS_PER_DAY))}`;
}

export function rewardLabel(r: SeasonReward): string {
  const parts: string[] = [];
  if (r.gold) parts.push(`🪙 ${r.gold}`);
  if (r.diamonds) parts.push(`💎 ${r.diamonds}`);
  if (r.food) parts.push(`🌾 ${r.food}`);
  if (r.eggDefId) parts.push(`🥚 ${r.eggDefId}`);
  return parts.join('  ');
}
