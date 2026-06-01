import type { RarityType } from '@gtypes/game';

// ── Quests ─────────────────────────────────────────────────────────────────────
// Clear, always-visible objectives. Progress is derived from a snapshot of game
// state (counters tracked in the store + derivable values), so quests survive
// reloads without any per-event bookkeeping.

export interface QuestProgressSnapshot {
  playerLevel: number;
  storyProgress: number;
  pokedexSeen: number;
  monstersOwned: number;
  buildingsBuilt: number;          // total buildings placed
  feeds: number;                   // lifetime feed actions
  breeds: number;                  // lifetime breedings started
  hatches: number;                 // lifetime eggs hatched
  collects: number;                // lifetime collect actions
  battlesWon: number;              // lifetime battles won (story + pvp)
  highestRarityOwned: number;      // RARITY_RANK of the best owned monster
}

export interface QuestReward {
  gold?: number;
  diamonds?: number;
  food?: number;
  eggDefId?: string;
}

export interface QuestDef {
  id: string;
  category: 'Beginner' | 'Breeding' | 'Combat' | 'Collection' | 'Builder';
  title: string;
  description: string;
  goal: number;
  /** Pull the current progress value for this quest from the snapshot. */
  measure: (s: QuestProgressSnapshot) => number;
  reward: QuestReward;
  icon: string;
}

export const QUESTS: QuestDef[] = [
  // ── Beginner ──────────────────────────────────────────────────────────────
  {
    id: 'q_first_feed', category: 'Beginner', icon: '🌾',
    title: 'Erste Mahlzeit', description: 'Füttere ein Monster 1×.',
    goal: 1, measure: s => s.feeds, reward: { gold: 300, food: 100 },
  },
  {
    id: 'q_first_breed', category: 'Beginner', icon: '💞',
    title: 'Frischer Wind', description: 'Starte deine erste Zucht.',
    goal: 1, measure: s => s.breeds, reward: { gold: 500, diamonds: 5 },
  },
  {
    id: 'q_first_hatch', category: 'Beginner', icon: '🥚',
    title: 'Neues Leben', description: 'Lass dein erstes Ei schlüpfen.',
    goal: 1, measure: s => s.hatches, reward: { gold: 500, food: 200 },
  },
  {
    id: 'q_first_win', category: 'Beginner', icon: '⚔️',
    title: 'Erster Sieg', description: 'Gewinne einen Kampf.',
    goal: 1, measure: s => s.battlesWon, reward: { gold: 400, diamonds: 5 },
  },

  // ── Breeding ──────────────────────────────────────────────────────────────
  {
    id: 'q_breed_10', category: 'Breeding', icon: '🧬',
    title: 'Zuchtmeister I', description: 'Starte 10 Zuchten.',
    goal: 10, measure: s => s.breeds, reward: { gold: 2000, diamonds: 15 },
  },
  {
    id: 'q_hatch_25', category: 'Breeding', icon: '🐣',
    title: 'Brutpfleger', description: 'Lass 25 Eier schlüpfen.',
    goal: 25, measure: s => s.hatches, reward: { gold: 5000, diamonds: 30 },
  },

  // ── Combat ────────────────────────────────────────────────────────────────
  {
    id: 'q_story_5', category: 'Combat', icon: '🗺️',
    title: 'Abenteurer', description: 'Schließe 5 Story-Kapitel ab.',
    goal: 5, measure: s => s.storyProgress, reward: { gold: 1500, diamonds: 10 },
  },
  {
    id: 'q_story_25', category: 'Combat', icon: '🏔️',
    title: 'Held von Monsterium', description: 'Schließe 25 Story-Kapitel ab.',
    goal: 25, measure: s => s.storyProgress, reward: { gold: 8000, diamonds: 50 },
  },
  {
    id: 'q_win_50', category: 'Combat', icon: '🔥',
    title: 'Kriegsveteran', description: 'Gewinne 50 Kämpfe.',
    goal: 50, measure: s => s.battlesWon, reward: { gold: 6000, diamonds: 40 },
  },

  // ── Collection ────────────────────────────────────────────────────────────
  {
    id: 'q_pokedex_25', category: 'Collection', icon: '📖',
    title: 'Sammler I', description: 'Entdecke 25 Monster.',
    goal: 25, measure: s => s.pokedexSeen, reward: { gold: 2500, diamonds: 15 },
  },
  {
    id: 'q_pokedex_75', category: 'Collection', icon: '📚',
    title: 'Sammler II', description: 'Entdecke 75 Monster.',
    goal: 75, measure: s => s.pokedexSeen, reward: { gold: 10000, diamonds: 60 },
  },
  {
    id: 'q_own_15', category: 'Collection', icon: '👾',
    title: 'Volle Habitate', description: 'Besitze 15 Monster gleichzeitig.',
    goal: 15, measure: s => s.monstersOwned, reward: { gold: 3000, diamonds: 20 },
  },

  // ── Builder ───────────────────────────────────────────────────────────────
  {
    id: 'q_build_5', category: 'Builder', icon: '🏗️',
    title: 'Stadtplaner', description: 'Errichte 5 Gebäude.',
    goal: 5, measure: s => s.buildingsBuilt, reward: { gold: 2000, food: 500 },
  },
  {
    id: 'q_level_10', category: 'Builder', icon: '⭐',
    title: 'Aufsteiger', description: 'Erreiche Spielerlevel 10.',
    goal: 10, measure: s => s.playerLevel, reward: { gold: 3000, diamonds: 25 },
  },
];

export function questProgress(q: QuestDef, snap: QuestProgressSnapshot): number {
  return Math.min(q.goal, q.measure(snap));
}

export function isQuestComplete(q: QuestDef, snap: QuestProgressSnapshot): boolean {
  return q.measure(snap) >= q.goal;
}

export const QUEST_CATEGORIES: Array<QuestDef['category']> = [
  'Beginner', 'Breeding', 'Combat', 'Collection', 'Builder',
];

// Re-export for callers that want to label rarity in rewards.
export type { RarityType };
