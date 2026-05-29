import type { MonsterInstance, BreedOutcome } from '@gtypes/game';
import { MONSTER_DEFS, ALL_MONSTER_IDS, HYBRID_TABLE } from '@data/monsters';
import { RARITY_RANK } from '@data/rarities';

export function calculateBreedOutcomes(
  parent1: MonsterInstance,
  parent2: MonsterInstance,
  relationScore: number
): BreedOutcome[] {
  const def1 = MONSTER_DEFS[parent1.defId];
  const def2 = MONSTER_DEFS[parent2.defId];
  if (!def1 || !def2) return [];

  const combinedElements = new Set([...def1.elements, ...def2.elements]);
  const minRarityRank = Math.max(RARITY_RANK[def1.rarity], RARITY_RANK[def2.rarity]);

  // Build candidate pool
  const candidates: Array<{ defId: string; weight: number }> = [];
  for (const id of ALL_MONSTER_IDS) {
    const def = MONSTER_DEFS[id];
    if (!def) continue;
    if (RARITY_RANK[def.rarity] < minRarityRank) continue;
    const overlap = def.elements.filter(e => combinedElements.has(e)).length;
    if (overlap === 0) continue;
    const rarityPenalty = Math.pow(0.4, RARITY_RANK[def.rarity] - minRarityRank);
    candidates.push({ defId: id, weight: overlap * rarityPenalty });
  }

  if (candidates.length === 0) {
    // Fallback: same as higher-rarity parent
    candidates.push({ defId: parent1.defId, weight: 1 });
  }

  // Hybrid injection
  const pairKey = [parent1.defId, parent2.defId].sort().join('-');
  const hybridDefId = HYBRID_TABLE[pairKey];
  let hybridChance = 0.05;
  if (def1.breedCompatibility.includes(parent2.defId) || def2.breedCompatibility.includes(parent1.defId)) {
    hybridChance += 0.15;
  }
  hybridChance += (relationScore / 10000);

  let totalWeight = candidates.reduce((sum, c) => sum + c.weight, 0);

  if (hybridDefId) {
    const hybridWeight = (totalWeight / (1 - hybridChance)) * hybridChance;
    candidates.push({ defId: hybridDefId, weight: hybridWeight });
    totalWeight += hybridWeight;
  }

  // Normalize and build outcomes
  return candidates.map(c => ({
    monsterDefId: c.defId,
    probability: c.weight / totalWeight,
    isHybrid: c.defId === hybridDefId,
  })).sort((a, b) => b.probability - a.probability);
}

export function rollBreedOutcome(outcomes: BreedOutcome[]): string {
  const roll = Math.random();
  let cumulative = 0;
  for (const outcome of outcomes) {
    cumulative += outcome.probability;
    if (roll <= cumulative) return outcome.monsterDefId;
  }
  return outcomes[outcomes.length - 1]?.monsterDefId ?? 'flameling';
}

export function getRelationScore(parent1: MonsterInstance, parent2: MonsterInstance): number {
  return parent1.relationshipScores[parent2.instanceId] ?? 0;
}
