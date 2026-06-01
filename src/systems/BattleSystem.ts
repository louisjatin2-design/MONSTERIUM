import type { BattleCombatant, StatusEffect, TraitType, ActiveStatusEffect } from '@gtypes/game';
import { MONSTER_DEFS } from '@data/monsters';
import { ATTACKS } from '@data/attacks';
import { getElementBonus } from '@data/elements';
import { STATUS_DEFAULT_ROUNDS } from '@data/statusEffects';

export function resolveTurnOrder(combatants: BattleCombatant[]): BattleCombatant[] {
  return [...combatants]
    .filter(c => c.currentHp > 0)
    .sort((a, b) => {
      const spdA = getEffectiveSpeed(a);
      const spdB = getEffectiveSpeed(b);
      return spdB - spdA;
    });
}

/**
 * Builds a complete turn queue for one meta-round using a speed-budget system.
 *
 * Each monster starts with a budget equal to its effective speed. The smallest
 * budget among all living monsters is the step size. Every iteration, all
 * monsters whose budget ≥ step act (sorted fastest-first), then have the step
 * subtracted from their budget. This continues until no monster has budget ≥
 * step, at which point the meta-round ends.
 *
 * Example – speeds [120, 80, 60], step = 60:
 *   iter 1 → all three act (120, 80, 60), budgets become [60, 20, 0]
 *   iter 2 → only 120 acts, budget becomes [0, 20, 0]
 *   → queue: A B C A  (A acts twice, B once, C once)
 *
 * Example – speeds [300, 100], step = 100:
 *   iter 1 → both act [300→200, 100→0]
 *   iter 2 → only 300 [200→100]
 *   iter 3 → only 300 [100→0]
 *   → queue: A B A A  (A acts 3×, B acts 1×)
 */
export function buildTurnQueue(combatants: BattleCombatant[]): BattleCombatant[] {
  const alive = combatants.filter(c => c.currentHp > 0);
  if (alive.length === 0) return [];

  const speedOf = new Map<string, number>();
  for (const c of alive) speedOf.set(c.instanceId, getEffectiveSpeed(c));

  const minSpeed = Math.min(...speedOf.values());
  if (minSpeed <= 0) return [...alive]; // safety fallback

  const budget = new Map<string, number>([...speedOf]);
  const queue: BattleCombatant[] = [];
  const MAX_TURNS = alive.length * 8; // hard cap to prevent infinite loops

  while (queue.length < MAX_TURNS) {
    // Collect monsters that can still act this meta-round
    const acting = alive
      .filter(c => (budget.get(c.instanceId) ?? 0) >= minSpeed)
      .sort((a, b) => (budget.get(b.instanceId) ?? 0) - (budget.get(a.instanceId) ?? 0));

    if (acting.length === 0) break;

    for (const c of acting) {
      queue.push(c);
      budget.set(c.instanceId, (budget.get(c.instanceId) ?? 0) - minSpeed);
    }
  }

  return queue;
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
  // Scaling inputs — default to neutral so older callers keep their behaviour.
  attackerLevel?: number;        // monster level (attacks scale with it)
  attackerRarityRank?: number;   // RARITY_RANK of the attacker's species
  campaignDamageMultiplier?: number; // early-campaign boost for the player
}): number {
  const {
    attackerATK, movePower, minigameScore,
    attackerElement, defenderElements, defenderDEF,
    attackerTrait, attackerStatuses,
    attackerCurrentHp, attackerMaxHp,
    attackerLevel = 1,
    attackerRarityRank = 0,
    campaignDamageMultiplier = 1,
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

  // Attacks land harder the higher the monster's level and the rarer its
  // species — on top of the raw stat scaling the combatant already carries.
  const scale = levelRarityDamageScale(attackerLevel, attackerRarityRank);

  const damage = Math.floor(
    (atk * movePower * (minigameScore / 100) * (1 + elementBonus)) / defenderDEF * 10
    * scale * Math.max(0, campaignDamageMultiplier)
  );
  return Math.max(0, damage);
}

// ── Campaign balance & scaling ──────────────────────────────────────────────

// How many story battles count as the "early campaign" (all of World 1).
export const EARLY_CAMPAIGN_BATTLES = 12;

/**
 * Player monsters hit harder during the first 12 campaign battles so new
 * Hüter:innen can find their footing. The boost is strongest at the very first
 * fight (+60% damage) and tapers smoothly to nothing once World 1 is cleared.
 * Returns a neutral 1 for arena fights or any battle past the early campaign.
 */
export function earlyCampaignDamageBonus(storyIndex: number | undefined): number {
  if (storyIndex === undefined || storyIndex < 0) return 1;
  if (storyIndex >= EARLY_CAMPAIGN_BATTLES) return 1;
  const t = storyIndex / EARLY_CAMPAIGN_BATTLES; // 0 → 1 across World 1
  return 1 + 0.6 * (1 - t);
}

/**
 * Attacks scale proportionally to the attacker's level and species rarity:
 *   • +1.2% damage per level   (Lv 1 → +0%, Lv 100 → +~119%)
 *   • +6%  damage per rarity rank (Common +0% … Transcendent +42%)
 * Applies to every combatant so stronger, rarer monsters feel meaningfully
 * more powerful than their raw stats alone would suggest.
 */
export function levelRarityDamageScale(level: number, rarityRank: number): number {
  const levelScale  = 1 + Math.max(0, level - 1) * 0.012;
  const rarityScale = 1 + Math.max(0, rarityRank) * 0.06;
  return levelScale * rarityScale;
}

// Baseline uplift applied to every campaign victory reward (gold/XP/diamonds).
export const CAMPAIGN_REWARD_MULTIPLIER = 1.5;

/**
 * Better campaign rewards: every story victory pays out 1.5× by default, with
 * an extra top-up during World 1 (up to +50% more at the very first fight) so
 * early progression feels generous. Non-campaign fights pass `undefined` and
 * get no uplift.
 */
export function campaignRewardMultiplier(storyIndex: number | undefined): number {
  if (storyIndex === undefined || storyIndex < 0) return 1;
  let mult = CAMPAIGN_REWARD_MULTIPLIER;
  if (storyIndex < EARLY_CAMPAIGN_BATTLES) {
    const t = storyIndex / EARLY_CAMPAIGN_BATTLES; // 0 → 1 across World 1
    mult += 0.5 * (1 - t);
  }
  return mult;
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

/**
 * Adds a status effect to a combatant without ever creating duplicates.
 *
 * If the same effect is already active, its duration is refreshed to the
 * longer of the current and incoming durations instead of pushing a second
 * copy. This stops DOT effects (Burn/Poison) from stacking their per-round
 * damage and keeps the on-card indicator showing one badge per effect.
 */
export function addStatusEffect(
  combatant: BattleCombatant,
  effect: StatusEffect,
  rounds: number = STATUS_DEFAULT_ROUNDS,
  value?: number,
): void {
  const existing = combatant.statusEffects.find(e => e.effect === effect);
  if (existing) {
    existing.remainingRounds = Math.max(existing.remainingRounds, rounds);
    if (value !== undefined) existing.value = value;
    return;
  }
  combatant.statusEffects.push({ effect, remainingRounds: rounds, value });
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

// How much charge a monster's ULTIMA needs before it can fire. The ult's base
// damage scales with the monster's attack stat, so monsters with a weaker ult
// (lower attack) charge faster by requiring less charge; hard hitters need
// closer to a full bar. Attack stat typically spans ~80 (weak) to ~280 (strong).
export function ultChargeCostFor(attackStat: number): number {
  const MIN_ATK = 80, MAX_ATK = 280;
  const MIN_COST = 50, MAX_COST = 100;
  const t = Math.max(0, Math.min(1, (attackStat - MIN_ATK) / (MAX_ATK - MIN_ATK)));
  return Math.round(MIN_COST + t * (MAX_COST - MIN_COST));
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
    moveCooldowns: {},
  };
}

// How many rounds a move must recharge after use. Strong/OP attacks get a
// cooldown so they can't be spammed; an explicit MoveDef.cooldown wins.
export function getMoveCooldown(move: { power: number; cooldown?: number }): number {
  if (typeof move.cooldown === 'number') return move.cooldown;
  if (move.power >= 2.4) return 3;
  if (move.power >= 2.0) return 2;
  if (move.power >= 1.7) return 1;
  return 0;
}

// Tick every cooldown on a combatant down by one round (called once per round).
export function tickMoveCooldowns(c: BattleCombatant): void {
  for (const id of Object.keys(c.moveCooldowns)) {
    c.moveCooldowns[id] = Math.max(0, (c.moveCooldowns[id] ?? 0) - 1);
    if (c.moveCooldowns[id] === 0) delete c.moveCooldowns[id];
  }
}
