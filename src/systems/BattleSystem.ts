import type { BattleCombatant, StatusEffect, TraitType, ActiveStatusEffect } from '@gtypes/game';
import { MONSTER_DEFS } from '@data/monsters';
import { ATTACKS } from '@data/attacks';
import { getElementBonus } from '@data/elements';

export function resolveTurnOrder(combatants: BattleCombatant[]): BattleCombatant[] {
  return [...combatants]
    .filter(c => c.currentHp > 0)
    .sort((a, b) => {
      const spdA = getEffectiveSpeed(a);
      const spdB = getEffectiveSpeed(b);
      return spdB - spdA;
    });
}

function getEffectiveSpeed(c: BattleCombatant): number {
  let spd = c.speedStat;
  if (c.trait === 'Swift') spd = Math.floor(spd * 1.2);
  if (c.statusEffects.some(e => e.effect === 'Paralyze')) spd = Math.floor(spd * 0.5);
  return spd;
}

export function calculateDamage(params: {
  attackerATK: number;
  movePower: number;
  minigameScore: number;
  attackerElement: string;
  defenderElements: string[];
  defenderDEF: number;
  attackerTrait: TraitType;
  attackerStatuses: ActiveStatusEffect[];
  attackerCurrentHp: number;
  attackerMaxHp: number;
}): number {
  const {
    attackerATK, movePower, minigameScore,
    attackerElement, defenderElements, defenderDEF,
    attackerTrait, attackerStatuses,
    attackerCurrentHp, attackerMaxHp,
  } = params;

  let atk = attackerATK;

  // Status effects
  if (attackerStatuses.some(e => e.effect === 'AtkDown')) atk = Math.floor(atk * 0.75);

  // Trait: Berserk doubles attack when below 30% HP
  if (attackerTrait === 'Berserk' && attackerCurrentHp / attackerMaxHp < 0.3) {
    atk = Math.floor(atk * 2);
  }

  const elementBonus = getElementBonus(
    attackerElement as Parameters<typeof getElementBonus>[0],
    defenderElements as Parameters<typeof getElementBonus>[1]
  );

  const damage = Math.floor(
    (atk * movePower * (minigameScore / 100) * (1 + elementBonus)) / defenderDEF * 10
  );
  return Math.max(0, damage);
}

export function applyStatusEffect(
  effect: StatusEffect,
  score: number,
  threshold: number,
  targetTrait: TraitType
): boolean {
  if (score < threshold) return false;
  if (targetTrait === 'Fireproof' && effect === 'Burn') return false;
  return true;
}

export function processStatusTick(combatant: BattleCombatant): number {
  let dotDamage = 0;
  const remaining: ActiveStatusEffect[] = [];

  for (const se of combatant.statusEffects) {
    if (se.effect === 'Burn') {
      dotDamage += Math.floor(combatant.maxHp * 0.05);
    } else if (se.effect === 'Poison') {
      dotDamage += Math.floor(combatant.maxHp * 0.07);
    }
    const rounds = se.remainingRounds - 1;
    if (rounds > 0) remaining.push({ ...se, remainingRounds: rounds });
  }

  combatant.statusEffects = remaining;
  return dotDamage;
}

export function gainUltCharge(c: BattleCombatant, damageDealt: number): void {
  c.ultCharge = Math.min(100, c.ultCharge + Math.floor(damageDealt * 0.22));
}

export function generateAiAttack(
  equippedMoves: string[]
): { moveId: string; accuracy: number } {
  const moveId = equippedMoves[Math.floor(Math.random() * equippedMoves.length)] ?? 'ember';
  const accuracy = 40 + Math.random() * 50;
  return { moveId, accuracy };
}

export function buildCombatant(
  instanceId: string,
  defId: string,
  level: number,
  equippedMoveIds: string[],
  isPlayer: boolean,
  name: string
): BattleCombatant {
  const def = MONSTER_DEFS[defId];
  const scalingFactor = 1 + (level - 1) * 0.08;
  return {
    instanceId,
    defId,
    level,
    currentHp: Math.floor(def.baseStats.hp * scalingFactor),
    maxHp: Math.floor(def.baseStats.hp * scalingFactor),
    attackStat: Math.floor(def.baseStats.attack * scalingFactor),
    defenseStat: Math.floor(def.baseStats.defense * scalingFactor),
    speedStat: Math.floor(def.baseStats.speed * scalingFactor),
    statusEffects: [],
    trait: def.trait,
    isPlayer,
    equippedMoveIds,
    name,
    ultCharge: 0,
  };
}
