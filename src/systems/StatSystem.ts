import type { MonsterInstance, MonsterBaseStats } from '@gtypes/game';
import { MONSTER_DEFS } from '@data/monsters';
import { getArmorBonus } from '@data/armor';

// Per-level stat growth. Kept in one place so the battle engine and the
// monster detail screen always show the same numbers.
export const STAT_GROWTH_PER_LEVEL = 0.08;

export function statScale(level: number): number {
  return 1 + (level - 1) * STAT_GROWTH_PER_LEVEL;
}

export interface ScaledStats {
  hp: number;
  attack: number;
  defense: number;
  speed: number;
  energy: number;
}

// Stats for a monster at a given level (base stats × level scaling).
export function scaledStats(base: MonsterBaseStats, level: number): ScaledStats {
  const f = statScale(level);
  return {
    hp: Math.floor(base.hp * f),
    attack: Math.floor(base.attack * f),
    defense: Math.floor(base.defense * f),
    speed: Math.floor(base.speed * f),
    energy: base.energy, // energy/stamina doesn't scale with level
  };
}

// Convenience: scaled stats for a live monster instance, including any equipped
// armor's flat bonuses (Gruppe 7).
export function instanceStats(m: MonsterInstance): ScaledStats {
  const def = MONSTER_DEFS[m.defId];
  if (!def) return { hp: m.maxHp, attack: 0, defense: 0, speed: 0, energy: 0 };
  const base = scaledStats(def.baseStats, m.level);
  const armor = getArmorBonus(m.equippedArmorId);
  return {
    hp: base.hp + (armor.hp ?? 0),
    attack: base.attack + (armor.attack ?? 0),
    defense: base.defense,
    speed: base.speed + (armor.speed ?? 0),
    energy: base.energy + (armor.energy ?? 0),
  };
}
