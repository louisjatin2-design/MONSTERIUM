import { MONSTER_DEFS } from '@data/monsters';
import { ATTACKS } from '@data/attacks';
import type { BuildingInstance, MonsterInstance, EvolutionStage, ElementType } from '@gtypes/game';
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
  const known = instance.knownMoveIds ?? instance.equippedMoveIds ?? [];
  const unknown = def.availableMoveIds.filter(id => !known.includes(id));
  if (unknown.length === 0) return null;
  return unknown[Math.floor(Math.random() * unknown.length)];
}

/** All attacks whose element matches one of the monster's elements that it doesn't know yet. */
export function getTrainableAttacks(instance: MonsterInstance): string[] {
  const def = MONSTER_DEFS[instance.defId];
  if (!def) return [];
  const known = instance.knownMoveIds ?? instance.equippedMoveIds ?? [];
  const defElements = def.elements as string[];
  return Object.keys(ATTACKS).filter(id => {
    if (known.includes(id)) return false;
    return defElements.includes(ATTACKS[id].element);
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

// ── Labor / Rank-Up (Gruppe 5) ──────────────────────────────────────────────
export const MAX_RANK_STARS = 5;        // 5 Sterne maximal
export const BASE_MAX_LEVEL = 100;       // Basis-Levelgrenze
export const LEVELS_PER_RANK = 10;       // +10 Level je Rank-Up (→ 150)

/** Hartes Level-Limit eines Monsters, abhängig von seinen Rank-Up-Sternen. */
export function getMonsterMaxLevel(rankStars: number | undefined): number {
  const stars = Math.min(MAX_RANK_STARS, rankStars ?? 0);
  return BASE_MAX_LEVEL + stars * LEVELS_PER_RANK;
}

/** Ob ein Monster im Labor zusammengeführt werden kann: gleicher Typ, beide auf
 *  ihrem aktuellen Maximallevel und noch nicht auf 5 Sternen. */
export function canRankUp(a: MonsterInstance, b: MonsterInstance): boolean {
  if (a.instanceId === b.instanceId) return false;
  if (a.defId !== b.defId) return false;
  const aStars = a.rankStars ?? 0;
  const bStars = b.rankStars ?? 0;
  if (aStars >= MAX_RANK_STARS) return false;
  if (aStars !== bStars) return false; // gleiche Rangstufe zusammenführen
  if (a.level < getMonsterMaxLevel(aStars)) return false;
  if (b.level < getMonsterMaxLevel(bStars)) return false;
  return true;
}

// ── Tempel-Level-Cap (Gruppe 6) ─────────────────────────────────────────────
// Tempel begrenzen, wie hoch ein Monster überhaupt gelevelt werden kann. Ohne
// passenden Tempel ist bei Level 10 Schluss; jede Tempel-Stufe hebt die Grenze
// um 10 (Stufe 1 → Lv 20, Stufe 2 → Lv 30 … Stufe 9 → Lv 100).
export const TEMPLE_BASE_CAP = 10;
export const TEMPLE_CAP_PER_LEVEL = 10;
export const TEMPLE_HARD_CAP = 100;

/** Höchste Tempel-Stufe, die einem bestimmten Element zugutekommt (passender
 *  Element-Tempel ODER Universal-Tempel). Bauten im Bau zählen nicht. */
export function getApplicableTempleLevel(
  element: ElementType,
  buildings: Record<string, BuildingInstance>,
): number {
  let best = 0;
  for (const b of Object.values(buildings)) {
    const def = BUILDING_DEFS[b.defId];
    if (!def || def.category !== 'Temple' || b.constructionEndMs) continue;
    // Universal-Tempel (kein linkedElement) wirkt für jedes Element.
    if (!def.linkedElement || def.linkedElement === element) {
      best = Math.max(best, b.level);
    }
  }
  return best;
}

/** Effektive Tempel-Stufe eines Monsters: das Minimum über ALLE seine Elemente
 *  — bei zwei Elementen müssen also beide Tempel hochgestuft sein. */
export function getMonsterTempleLevel(
  instance: MonsterInstance,
  buildings: Record<string, BuildingInstance>,
): number {
  const def = MONSTER_DEFS[instance.defId];
  if (!def || def.elements.length === 0) return 0;
  let min = Infinity;
  for (const el of def.elements) {
    min = Math.min(min, getApplicableTempleLevel(el, buildings));
  }
  return Number.isFinite(min) ? min : 0;
}

/** Tempel-begrenzte Levelgrenze (10…100), abhängig von den Tempeln. */
export function getTempleCappedLevel(
  instance: MonsterInstance,
  buildings: Record<string, BuildingInstance>,
): number {
  const tl = getMonsterTempleLevel(instance, buildings);
  return Math.min(TEMPLE_HARD_CAP, TEMPLE_BASE_CAP + tl * TEMPLE_CAP_PER_LEVEL);
}

/** Tatsächliche Maximal-Level eines Monsters: Tempel-Cap (bis 100) plus die
 *  Rank-Up-Erweiterung aus dem Labor (+10 je Stern). */
export function getEffectiveMaxLevel(
  instance: MonsterInstance,
  buildings: Record<string, BuildingInstance>,
): number {
  const stars = Math.min(MAX_RANK_STARS, instance.rankStars ?? 0);
  return getTempleCappedLevel(instance, buildings) + stars * LEVELS_PER_RANK;
}

// Legacy-Helfer (Element-agnostisch) — bleibt für Abwärtskompatibilität.
export function getMonsterLevelCap(temples: BuildingInstance[]): number {
  const highestTempleLevel = temples.reduce((max, t) => Math.max(max, t.level), 0);
  return TEMPLE_BASE_CAP + (highestTempleLevel + 1) * TEMPLE_CAP_PER_LEVEL;
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
