import { MONSTER_DEFS } from '@data/monsters';
import { ATTACKS } from '@data/attacks';
import type { BuildingInstance, MonsterInstance, EvolutionStage } from '@gtypes/game';
import { BUILDING_DEFS } from '@data/buildings';

export const EVOLUTION_LEVELS: Record<EvolutionStage, number> = {
  Baby: 0,
  Juvenile: 25,
  Adult: 50,
  Elder: 75,
};

export const EVOLUTION_ORDER: EvolutionStage[] = ['Baby', 'Juvenile', 'Adult', 'Elder'];

export function getMaxAttackSlots(stage: EvolutionStage): number {
  return { Baby: 2, Juvenile: 3, Adult: 4, Elder: 5 }[stage];
}

export function getNextEvolutionStage(stage: EvolutionStage): EvolutionStage | null {
  const idx = EVOLUTION_ORDER.indexOf(stage);
  return idx >= 0 && idx < EVOLUTION_ORDER.length - 1 ? EVOLUTION_ORDER[idx + 1] : null;
}

export function getEvolutionStageName(defId: string, stage: EvolutionStage): string {
  const def = MONSTER_DEFS[defId];
  if (!def) return stage;
  const names = def.evolutionStages;
  if (stage === 'Baby') return names[0];
  if (stage === 'Juvenile') return names[1];
  if (stage === 'Adult') return names[2];
  return names[2] + ' Elder'; // 4th stage derived
}

export function isEvolutionReady(instance: MonsterInstance): boolean {
  const next = getNextEvolutionStage(instance.stage);
  if (!next) return false;
  return instance.level >= EVOLUTION_LEVELS[next];
}

/** Returns a random attack ID from the monster's pool that it hasn't learned yet. */
export function pickRandomNewAttack(instance: MonsterInstance): string | null {
  const def = MONSTER_DEFS[instance.defId];
  if (!def) return null;
  const unknown = def.availableMoveIds.filter(id => !instance.knownMoveIds.includes(id));
  if (unknown.length === 0) return null;
  return unknown[Math.floor(Math.random() * unknown.length)];
}

/** All attacks whose element matches one of the monster's elements that it doesn't know yet. */
export function getTrainableAttacks(instance: MonsterInstance): string[] {
  const def = MONSTER_DEFS[instance.defId];
  if (!def) return [];
  return Object.keys(ATTACKS).filter(id => {
    if (instance.knownMoveIds.includes(id)) return false;
    return def.elements.includes(ATTACKS[id].element as typeof def.elements[number]);
  });
}

export function getAttackTrainCost(moveId: string): { gold: number; diamonds: number } {
  const move = ATTACKS[moveId];
  if (!move) return { gold: 500, diamonds: 0 };
  if (move.power <= 1.2) return { gold: 200, diamonds: 0 };
  if (move.power <= 1.8) return { gold: 500, diamonds: 0 };
  if (move.power <= 2.4) return { gold: 1200, diamonds: 0 };
  return { gold: 0, diamonds: 10 };
}

export function getMonsterLevelCap(temples: BuildingInstance[]): number {
  const highestTempleLevel = temples.reduce((max, t) => Math.max(max, t.level), 0);
  return 20 + highestTempleLevel * 10;
}

export function getUnlockedMoves(defId: string, monsterLevel: number): string[] {
  const def = MONSTER_DEFS[defId];
  if (!def) return [];
  const unlockedCount = Math.min(def.availableMoveIds.length, 1 + Math.floor(monsterLevel / 10));
  return def.availableMoveIds.slice(0, unlockedCount);
}

export function getTemples(buildings: Record<string, BuildingInstance>): BuildingInstance[] {
  return Object.values(buildings).filter(b => {
    const def = BUILDING_DEFS[b.defId];
    return def?.category === 'Temple' && !b.constructionEndMs;
  });
}

export function getEvolutionStageLevel(stage: string): number {
  if (stage === 'Juvenile') return EVOLUTION_LEVELS.Juvenile;
  if (stage === 'Adult') return EVOLUTION_LEVELS.Adult;
  if (stage === 'Elder') return EVOLUTION_LEVELS.Elder;
  return 0;
}

export function getTempleTrainingSlots(templeLevel: number): number {
  return 1 + Math.floor(templeLevel / 2);
}
