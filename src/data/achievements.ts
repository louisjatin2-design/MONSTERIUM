// ── Achievements / Trophäen (Gruppe 5) ──────────────────────────────────────
// Kleine Meilensteine für besondere Aktionen, jeweils mit einer einmaligen
// Belohnung. Der Fortschritt wird aus den Lifetime-Statistiken des Spielers
// und seinem Bestand abgeleitet.

export interface AchievementReward {
  gold?: number;
  diamonds?: number;
  food?: number;
}

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  // Kennzahl, gegen die der Schwellenwert geprüft wird.
  metric:
    | 'evolutions' | 'rankUps' | 'bossRaidWins' | 'battlesWon'
    | 'breeds' | 'hatches' | 'buildingsBuilt' | 'feeds'
    | 'monstersOwned' | 'highestRarityOwned';
  threshold: number;
  reward: AchievementReward;
}

export interface AchievementSnapshot {
  evolutions: number;
  rankUps: number;
  bossRaidWins: number;
  battlesWon: number;
  breeds: number;
  hatches: number;
  buildingsBuilt: number;
  feeds: number;
  monstersOwned: number;
  highestRarityOwned: number;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_evolution', name: 'Erste Entwicklung', description: 'Entwickle dein erstes Monster.', icon: '✨', metric: 'evolutions', threshold: 1, reward: { gold: 1000, diamonds: 5 } },
  { id: 'evolve_10',       name: 'Meister der Evolution', description: 'Entwickle 10 Monster.', icon: '🌟', metric: 'evolutions', threshold: 10, reward: { diamonds: 25 } },
  { id: 'first_rankup',    name: 'Erster Rank-Up', description: 'Führe im Labor deinen ersten Rank-Up durch.', icon: '🧪', metric: 'rankUps', threshold: 1, reward: { gold: 5000, diamonds: 10 } },
  { id: 'first_boss',      name: 'Boss-Bezwinger', description: 'Gewinne deinen ersten Boss-Raid.', icon: '👹', metric: 'bossRaidWins', threshold: 1, reward: { diamonds: 20 } },
  { id: 'win_10',          name: 'Kämpfernatur', description: 'Gewinne 10 Kämpfe.', icon: '⚔️', metric: 'battlesWon', threshold: 10, reward: { gold: 2000 } },
  { id: 'win_50',          name: 'Veteran', description: 'Gewinne 50 Kämpfe.', icon: '🏆', metric: 'battlesWon', threshold: 50, reward: { diamonds: 30 } },
  { id: 'breed_5',         name: 'Züchter', description: 'Züchte 5 Mal.', icon: '🥚', metric: 'breeds', threshold: 5, reward: { gold: 1500 } },
  { id: 'hatch_10',        name: 'Brutmeister', description: 'Brüte 10 Eier aus.', icon: '🐣', metric: 'hatches', threshold: 10, reward: { food: 2000 } },
  { id: 'build_10',        name: 'Baumeister', description: 'Errichte 10 Gebäude.', icon: '🏗️', metric: 'buildingsBuilt', threshold: 10, reward: { gold: 3000 } },
  { id: 'collector_25',    name: 'Sammler', description: 'Besitze 25 Monster gleichzeitig.', icon: '📚', metric: 'monstersOwned', threshold: 25, reward: { diamonds: 15 } },
  { id: 'legendary_owner', name: 'Legendär', description: 'Besitze ein legendäres oder höheres Monster.', icon: '⭐', metric: 'highestRarityOwned', threshold: 4, reward: { diamonds: 25 } },
  { id: 'mythic_owner',    name: 'Mythisch', description: 'Besitze ein mythisches oder höheres Monster.', icon: '✸', metric: 'highestRarityOwned', threshold: 6, reward: { diamonds: 50 } },
];

export function achievementProgress(a: AchievementDef, snap: AchievementSnapshot): number {
  return snap[a.metric] ?? 0;
}

export function isAchievementComplete(a: AchievementDef, snap: AchievementSnapshot): boolean {
  return achievementProgress(a, snap) >= a.threshold;
}
