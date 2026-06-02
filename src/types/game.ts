export type ElementType =
  | 'Fire' | 'Water' | 'Electric' | 'Earth' | 'Air' | 'Ice'
  | 'Darkness' | 'Light' | 'Metal' | 'Poison' | 'Combat' | 'Magic'
  | 'Angel' | 'Demon' | 'Plant' | 'Glitch' | 'Time' | 'Crystal'
  | 'Sand' | 'Sound' | 'Void' | 'Cosmos' | 'Psycho';

export type RarityType =
  | 'Common' | 'Rare' | 'SuperRare' | 'Epic'
  | 'Legendary' | 'Elite' | 'Mythic' | 'Transcendent';

export type StatusEffect =
  | 'Burn' | 'Freeze' | 'Paralyze' | 'Poison'
  | 'Stun' | 'Blind' | 'DefDown' | 'AtkDown'
  // Positive buffs applied by support attacks.
  | 'AtkUp' | 'DefUp';

export type TraitType =
  | 'Mania' | 'Tough' | 'Swift' | 'Undead' | 'Fireproof'
  | 'Berserk' | 'Lucky' | 'Echo' | 'Guardian' | 'None';

export type EvolutionStage = 'Baby' | 'Juvenile' | 'Adult' | 'Elder';

export type BuildingCategory =
  | 'Habitat' | 'Temple' | 'Farm' | 'BreedingStation' | 'Hatchery';

export type MinigameType = 'TimingBar' | 'AimClick' | 'ButtonSequence' | 'MashButton' | 'SwipePath';

export type AttackTargeting = 'single' | 'aoe';

// Support attacks don't damage the enemy — they aid the caster's own side.
//   heal     → restore HP (amount = fraction of maxHp, scaled by minigame score)
//   cleanse  → strip all negative status effects
//   energize → restore battle energy (amount = flat energy points)
//   atkBuff  → grant the AtkUp buff (boosts damage dealt)
//   defBuff  → grant the DefUp buff (reduces damage taken)
export type SupportKind = 'heal' | 'cleanse' | 'energize' | 'atkBuff' | 'defBuff';

export interface SupportEffect {
  kind: SupportKind;
  // heal: fraction of maxHp (0..1); energize: flat energy points. Unused by buffs.
  amount?: number;
  // When true the effect hits the whole living team; otherwise just the caster.
  team?: boolean;
}

export interface MonsterBaseStats {
  hp: number;
  attack: number;
  defense: number;
  speed: number;
  energy: number;
}

export interface MonsterDef {
  id: string;
  name: string;
  elements: [ElementType, ...ElementType[]];
  rarity: RarityType;
  baseStats: MonsterBaseStats;
  availableMoveIds: string[];
  trait: TraitType;
  breedCompatibility: string[];
  lore: string;
  evolutionStages: [string, string, string];
}

export interface MonsterInstance {
  instanceId: string;
  defId: string;
  level: number;
  xp: number;
  stage: EvolutionStage;
  equippedMoveIds: string[];   // currently active in battle, max = maxAttackSlots
  knownMoveIds: string[];      // every attack this instance has ever learned
  maxAttackSlots: number;      // 2 → 3 → 4 → 5 as stages unlock
  currentHp: number;
  maxHp: number;
  statusEffects: ActiveStatusEffect[];
  habitatId: string | null;
  relationshipScores: Record<string, number>;
  isUnique: boolean;
  parentIds?: [string, string];
  name: string;
}

export interface ActiveStatusEffect {
  effect: StatusEffect;
  remainingRounds: number;
  value?: number;
}

export interface MoveDef {
  id: string;
  name: string;
  element: ElementType;
  power: number;
  minigameType: MinigameType;
  statusEffect?: { effect: StatusEffect; threshold: number };
  description: string;
  // 'aoe' hits every enemy; 'single' (default) hits one chosen target.
  targeting?: AttackTargeting;
  // Rounds this move must recharge after use before it can be picked again.
  // Optional; if omitted it's derived from power (strong moves get a cooldown).
  cooldown?: number;
  // Battle-energy this move drains from the caster. Optional — many basic
  // attacks cost nothing; heavy hitters, AoE blasts and support moves do.
  energyCost?: number;
  // Present only on support moves; when set the move aids the caster's team
  // instead of damaging the enemy (power is typically 0).
  support?: SupportEffect;
}

export interface BuildingLevelData {
  level: number;
  upgradeCost: number;
  upgradeTimeSec: number;
  goldPerHour?: number;
  foodPerHour?: number;
  levelCapBonus?: number;
  trainingSlotsTotal?: number;
  monsterCapacity?: number;
}

export interface BuildingDef {
  id: string;
  name: string;
  category: BuildingCategory;
  tilesW: number;
  tilesH: number;
  linkedElement?: ElementType;
  goldCost: number;
  buildTimeSec: number;
  levels: BuildingLevelData[];
  description: string;
  // Minimum player (user) level required before this building can be built.
  // Omitted means available from the start.
  unlockLevel?: number;
  // Minimum monster rarity rank this habitat will accept (e.g. Elite habitats
  // only house Elite-and-above monsters). Omitted means any rarity is allowed.
  minRarityRank?: number;
}

export interface BuildingInstance {
  instanceId: string;
  defId: string;
  islandId: string;
  tileX: number;
  tileY: number;
  level: number;
  constructionEndMs: number | null;
  upgradeEndMs: number | null;
  monsterIds: string[];
  goldAccumulated: number;
  lastCollectedMs: number;
}

// Decorative-but-blocking terrain features scattered across an island, in the
// style of Monster Legends. Each obstacle occupies one or more land tiles and
// must be cleared (for gold) before the player can build there — clearing it
// yields a small one-off reward.
export type ObstacleType = 'rock' | 'tree' | 'bush' | 'crystal' | 'mushroom' | 'bones';

export interface ObstacleDef {
  id: string;
  name: string;
  type: ObstacleType;
  tilesW: number;
  tilesH: number;
  clearCost: number;                                   // gold to clear away
  clearReward: { gold?: number; food?: number; xp?: number };
}

// A concrete obstacle placement on an island's grid.
export interface ObstaclePlacement {
  defId: string;
  tileX: number;
  tileY: number;
}

export interface IslandDef {
  id: string;
  name: string;
  tileMask: boolean[][];
  buffElement?: ElementType;
  unlockCondition: string;
  goldCost?: number;
  diamondCost?: number;
  fragmentsRequired?: number;
  theme: string;
  // Pre-placed terrain obstacles that block building until cleared.
  obstacles?: ObstaclePlacement[];
}

export interface Egg {
  id: string;
  monsterDefId: string;
  hatchStartMs: number;
  hatchEndMs: number;
  hatcherySlot: number;
  isUnique: boolean;
  parentIds?: [string, string];
  // When true the egg sits in the Lager (storage) and is NOT incubating; the
  // player must move it to the hatchery (which starts the timer) or sell it.
  inStorage: boolean;
}

export interface BattleCombatant {
  instanceId: string;
  defId: string;
  level: number;
  currentHp: number;
  maxHp: number;
  attackStat: number;
  defenseStat: number;
  speedStat: number;
  statusEffects: ActiveStatusEffect[];
  trait: TraitType;
  isPlayer: boolean;
  equippedMoveIds: string[];
  name: string;
  ultCharge: number;  // 0–100; fills as this monster deals damage
  // Battle energy spent by costly attacks. Separate from HP and ult charge;
  // regenerates a chunk every round so it refills within ~2–3 rounds.
  energy: number;
  maxEnergy: number;
  // moveId → rounds remaining before it can be used again (strong moves only).
  moveCooldowns: Record<string, number>;
}

export interface BreedOutcome {
  monsterDefId: string;
  probability: number;
  isHybrid: boolean;
}

export interface ActiveBreeding {
  id: string;
  parent1Id: string;
  parent2Id: string;
  startMs: number;
  endMs: number;
  // Frozen probability table — shown to the player exactly once per breeding.
  outcomes: BreedOutcome[];
  // The actual rolled result, hidden until the egg is collected.
  resultDefId: string;
  resultIsUnique: boolean;
}

export interface StoryBattle {
  id: string;
  name: string;
  description: string;
  enemyMonsterDefs: string[];
  enemyLevels: number[];
  rewards: { xp: number; gold: number; diamonds?: number; monsterDefId?: string };
}

export interface LeagueInfo {
  name: string;
  minTrophies: number;
  color: string;
}
