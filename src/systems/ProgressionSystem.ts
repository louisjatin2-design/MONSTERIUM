import { MONSTER_DEFS } from '@data/monsters';
import type { BuildingInstance } from '@gtypes/game';
import { BUILDING_DEFS } from '@data/buildings';

export function getMonsterLevelCap(temples: BuildingInstance[]): number {
  const highestTempleLevel = temples.reduce((max, t) => Math.max(max, t.level), 0);
  return 20 + highestTempleLevel * 10;
}

export function getUnlockedMoves(defId: string, monsterLevel: number): string[] {
  const def = MONSTER_DEFS[defId];
  if (!def) return [];
  const unlockedCount = Math.min(4, 1 + Math.floor(monsterLevel / 5));
  return def.availableMoveIds.slice(0, unlockedCount);
}

export function getTemples(buildings: Record<string, BuildingInstance>): BuildingInstance[] {
  return Object.values(buildings).filter(b => {
    const def = BUILDING_DEFS[b.defId];
    return def?.category === 'Temple' && !b.constructionEndMs;
  });
}

export function getEvolutionStageLevel(stage: string): number {
  if (stage === 'Juvenile') return 10;
  if (stage === 'Adult') return 20;
  return 0;
}

export function getTempleTrainingSlots(templeLevel: number): number {
  return 1 + Math.floor(templeLevel / 2);
}
