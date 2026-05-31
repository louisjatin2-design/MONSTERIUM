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
  | 'Stun' | 'Blind' | 'DefDown' | 'AtkDown';

export type TraitType =
  | 'Mania' | 'Tough' | 'Swift' | 'Undead' | 'Fireproof'
  | 'Berserk' | 'Lucky' | 'Echo' | 'Guardian' | 'None';

export type EvolutionStage = 'Baby' | 'Juvenile' | 'Adult';

export type BuildingCategory =
  | 'Habitat' | 'Temple' | 'Farm' | 'BreedingStation' | 'Hatchery';

export type MinigameType = 'TimingBar' | 'AimClick' | 'ButtonSequence';

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
  equippedMoveIds: string[];
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
}

export interface Egg {
  id: string;
  monsterDefId: string;
  hatchStartMs: number;
  hatchEndMs: number;
  hatcherySlot: number;
  isUnique: boolean;
  parentIds?: [string, string];
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
