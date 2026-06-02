import { ALL_MONSTER_IDS, MONSTER_DEFS } from '@data/monsters';
import { RARITY_RANK } from '@data/rarities';
import type { RarityType } from '@gtypes/game';

// ── Account level-up rewards ───────────────────────────────────────────────────
// These are PLAYER/account rewards (not per-monster). Every level grants gold +
// food that scales with level; milestone levels add diamonds and, at the big
// breakpoints, a guaranteed egg of escalating rarity.

export interface LevelReward {
  gold: number;
  diamonds: number;
  food: number;
  eggDefId?: string;     // a specific monster egg, if this level grants one
  eggRarity?: RarityType; // the tier the egg was rolled from (for display)
  headline?: string;      // optional flavour line for milestone levels
}

// Milestone → minimum rarity tier the granted egg should be rolled from.
const EGG_MILESTONES: Record<number, RarityType> = {
  3:   'Rare',
  5:   'Rare',
  8:   'SuperRare',
  12:  'SuperRare',
  16:  'Epic',
  20:  'Epic',
  25:  'Legendary',
  30:  'Legendary',
  40:  'Elite',
  50:  'Mythic',
  65:  'Mythic',
  80:  'Transcendent',
  100: 'Transcendent',
};

const HEADLINES: Record<number, string> = {
  5:   'Aufstrebender Hüter!',
  10:  'Erfahrener Züchter!',
  25:  'Meister von Monsterium!',
  50:  'Legendärer Hüter!',
  100: 'Wächter der Ewigkeit!',
};

// Pick a deterministic-but-varied egg from a rarity tier for a given level, so a
// save always shows the same reward for the same level.
function pickEggForRarity(rarity: RarityType, level: number): string | undefined {
  const pool = ALL_MONSTER_IDS.filter(id => MONSTER_DEFS[id]?.rarity === rarity);
  if (pool.length === 0) return undefined;
  return pool[level % pool.length];
}

export function getLevelReward(level: number): LevelReward {
  const gold = 500 + level * 250;
  const food = 200 + level * 80;
  // Diamonds every 5 levels, larger at round milestones. Kept deliberately lean
  // so diamonds stay a scarce premium currency.
  let diamonds = 0;
  if (level % 25 === 0) diamonds = 40;
  else if (level % 10 === 0) diamonds = 15;
  else if (level % 5 === 0) diamonds = 5;

  const reward: LevelReward = { gold, diamonds, food };

  const eggRarity = EGG_MILESTONES[level];
  if (eggRarity) {
    reward.eggRarity = eggRarity;
    reward.eggDefId = pickEggForRarity(eggRarity, level);
  }
  if (HEADLINES[level]) reward.headline = HEADLINES[level];

  return reward;
}

// Convenience for previews — the next milestone egg level after `level`.
export function nextEggMilestone(level: number): number | null {
  const milestones = Object.keys(EGG_MILESTONES).map(Number).sort((a, b) => a - b);
  for (const m of milestones) if (m > level) return m;
  return null;
}

// Used to sort/validate — exported so other modules can show roadmap.
export const EGG_MILESTONE_LEVELS = Object.keys(EGG_MILESTONES).map(Number).sort((a, b) => a - b);
export { RARITY_RANK };
