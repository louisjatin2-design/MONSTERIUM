import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type {
  MonsterInstance, BuildingInstance, Egg, EvolutionStage, ActiveBreeding, BuildingCategory,
} from '@gtypes/game';
import { MONSTER_DEFS } from '@data/monsters';
import { BUILDING_DEFS } from '@data/buildings';
import { ISLAND_DEFS } from '@data/islands';
import { OBSTACLE_DEFS } from '@data/obstacles';
import { RARITY_HATCH_TIME_SEC, RARITY_BREED_TIME_SEC, RARITY_RANK } from '@data/rarities';
import { calculateXpToLevel, calculateFeedCost, calculateSellValue, calculateEggSellValue } from '@systems/EconomySystem';
import {
  getUnlockedMoves, getMaxAttackSlots, getNextEvolutionStage,
  pickRandomNewAttack, getTrainableAttacks, getAttackTrainCost,
  EVOLUTION_LEVELS,
} from '@systems/ProgressionSystem';
import { calculateBreedOutcomes, rollBreedOutcome } from '@systems/BreedingSystem';
import { getLevelReward } from '@data/levelRewards';
import { QUESTS, isQuestComplete, type QuestProgressSnapshot } from '@data/quests';

// Simple uid generator (no external dependency)
function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ─── Account-scoped save storage ────────────────────────────────────────
// Each logged-in account keeps its OWN save game. We namespace the persisted
// key by username ("monsterium-save::alice") so two players on one device
// don't clobber each other. `activeSaveUser` tracks who the store is bound to;
// the auth store flips it via activateSaveFor() on login/logout.
const SAVE_KEY = 'monsterium-save';

// On a fresh page load, figure out who was logged in last (the auth store
// persists currentUser) so we hydrate from the right account's save.
function readPersistedUser(): string | null {
  try {
    const raw = localStorage.getItem('monsterium-auth');
    if (!raw) return null;
    return JSON.parse(raw)?.state?.currentUser ?? null;
  } catch {
    return null;
  }
}

let activeSaveUser: string | null = readPersistedUser();

function scopedKey(name: string): string {
  return activeSaveUser ? `${name}::${activeSaveUser}` : name;
}

// localStorage adapter that transparently namespaces every key by the active
// account. Falls back to the bare key when nobody is logged in.
const accountScopedStorage = {
  getItem: (name: string) => localStorage.getItem(scopedKey(name)),
  setItem: (name: string, value: string) => localStorage.setItem(scopedKey(name), value),
  removeItem: (name: string) => localStorage.removeItem(scopedKey(name)),
};

// Build the snapshot quests measure progress against, from live store state.
function buildQuestSnapshot(s: GameStoreState): QuestProgressSnapshot {
  const owned = Object.values(s.monsters);
  let highestRarity = 0;
  for (const m of owned) {
    const def = MONSTER_DEFS[m.defId];
    if (def) highestRarity = Math.max(highestRarity, RARITY_RANK[def.rarity]);
  }
  return {
    playerLevel: s.playerLevel,
    storyProgress: s.storyProgress,
    pokedexSeen: s.pokedexSeen.length,
    monstersOwned: owned.length,
    buildingsBuilt: s.stats.buildingsBuilt,
    feeds: s.stats.feeds,
    breeds: s.stats.breeds,
    hatches: s.stats.hatches,
    collects: s.stats.collects,
    battlesWon: s.stats.battlesWon,
    highestRarityOwned: highestRarity,
  };
}

interface GameStoreState {
  gold: number;
  diamonds: number;
  food: number;
  playerLevel: number;
  playerXp: number;
  trophies: number;
  monsters: Record<string, MonsterInstance>;
  buildings: Record<string, BuildingInstance>;
  eggs: Egg[];           // incubating in the hatchery (timer running)
  storedEggs: Egg[];     // in the Lager (storage) — not incubating
  activeBreedings: ActiveBreeding[];
  lastBreedPair: { parent1Id: string; parent2Id: string } | null;
  unlockedIslands: string[];
  islandFragments: Record<string, number>;
  // Keys ("islandId:tileX,tileY") of terrain obstacles the player has cleared.
  clearedObstacles: string[];
  storyProgress: number;
  pokedexSeen: string[];
  currentIslandId: string;
  tutorialStep: number; // 0 = not started; advances through the onboarding flow
  pendingLevelRewards: number[]; // account levels reached but not yet claimed
  // Lifetime counters that drive quests (never reset).
  stats: {
    feeds: number;
    breeds: number;
    hatches: number;
    collects: number;
    battlesWon: number;
    buildingsBuilt: number;
  };
  claimedQuests: string[]; // quest ids already collected
  redeemedCheatCodes: string[]; // one-time cheat codes already used
}

interface GameStoreActions {
  // Resources
  addGold: (n: number) => void;
  spendGold: (n: number) => boolean;
  addDiamonds: (n: number) => void;
  spendDiamonds: (n: number) => boolean;
  addFood: (n: number) => void;
  spendFood: (n: number) => boolean;
  convertGoldToFood: (foodAmount: number) => boolean;

  // Buildings
  placeBuilding: (defId: string, islandId: string, tileX: number, tileY: number) => string | null;
  /** Relocate a building to a new tile on its current island. Returns false if not found. */
  moveBuilding: (instanceId: string, tileX: number, tileY: number) => boolean;
  /** Tear down a Habitat or Farm, refunding half its build cost and releasing
   *  any resident monsters back to "unassigned". Returns the gold refunded. */
  demolishBuilding: (instanceId: string) => number;
  upgradeBuilding: (instanceId: string) => void;
  collectGold: (instanceId: string) => void;
  /** Collect accumulated output from every building (optionally limited to a
   *  category, e.g. 'Habitat' for gold or 'Farm' for food). Returns totals. */
  collectAll: (category?: BuildingCategory) => { gold: number; food: number };

  // Monsters
  addMonster: (defId: string, isUnique?: boolean, parentIds?: [string, string]) => MonsterInstance;
  feedMonster: (instanceId: string, foodAmount: number) => void;
  sellMonster: (instanceId: string) => number;
  assignToHabitat: (monsterId: string, habitatId: string) => void;
  removeFromHabitat: (monsterId: string) => void;
  addXpToMonster: (instanceId: string, amount: number) => void;
  evolveMonster: (instanceId: string) => void;
  equipMove: (instanceId: string, moveId: string, replaceSlot?: number) => void;
  updateRelationship: (id1: string, id2: string, delta: number) => void;

  // Attack management
  /** Learn an attack (adds to knownMoveIds, auto-equips if slot free). */
  learnAttack: (instanceId: string, moveId: string) => boolean;
  /** Equip a known attack into a battle slot (unequips replaceId if slots full). */
  equipAttack: (instanceId: string, moveId: string, replaceId?: string) => void;
  /** Remove an attack from equipped slots (stays in knownMoveIds). */
  unequipAttack: (instanceId: string, moveId: string) => void;
  /** Pay gold/diamonds to teach a trainable attack. Returns false if not affordable. */
  trainAttack: (instanceId: string, moveId: string) => boolean;

  // Eggs & Breeding
  addEgg: (monsterDefId: string, hatchTimeOverrideSec?: number, isUnique?: boolean, parentIds?: [string, string]) => void;
  /** Move a stored egg into the hatchery (starts the incubation timer). */
  moveEggToHatchery: (eggId: string) => boolean;
  /** Sell a stored egg for gold. Returns the gold gained (0 if not found). */
  sellEgg: (eggId: string) => number;
  hatchEgg: (eggId: string) => MonsterInstance | null;
  hatchEggToHabitat: (eggId: string, habitatId: string) => MonsterInstance | null;
  eligibleHabitats: (monsterDefId: string) => string[];
  speedUpEgg: (eggId: string) => void;
  startBreeding: (parent1Id: string, parent2Id: string) => boolean;
  collectBreedingEgg: (id: string) => void;
  speedUpBreeding: (id: string) => void;
  cancelBreeding: (id: string) => void;
  breedingCapacity: () => number;
  eggCapacity: () => number;

  // Progression
  addPlayerXp: (amount: number) => void;
  /** Claim the account-level reward for a level in pendingLevelRewards. */
  claimLevelReward: (level: number) => void;
  addTrophies: (amount: number) => void;
  advanceStory: () => void;
  unlockIsland: (islandId: string) => void;
  purchaseIsland: (islandId: string) => boolean;
  /** Clear a terrain obstacle for gold, granting its one-off reward. */
  clearObstacle: (islandId: string, tileX: number, tileY: number) => boolean;
  setCurrentIsland: (islandId: string) => void;
  addPokedexEntry: (defId: string) => void;
  setTutorialStep: (step: number) => void;

  // Timer tick (called every second from App.tsx)
  tickTimers: () => void;

  // Quests
  /** Mark a battle as won (drives combat quests). */
  recordBattleWon: () => void;
  /** Claim a completed quest's reward. Returns false if not claimable. */
  claimQuest: (questId: string) => boolean;

  // Cheat codes — returns true if the code was valid.
  redeemCheatCode: (code: string) => boolean;

  // Wipe the in-memory state back to a brand-new game. Used when switching to
  // an account that has no save yet (see activateSaveFor).
  hardReset: () => void;
}

type GameStore = GameStoreState & GameStoreActions;

const INITIAL_STATE: GameStoreState = {
  gold: 2000,
  diamonds: 50,
  food: 500,
  playerLevel: 1,
  playerXp: 0,
  trophies: 0,
  monsters: {
    // Two starter monsters so the tutorial can teach breeding right away.
    'm_starter_fire': {
      instanceId: 'm_starter_fire', defId: 'flameling', level: 1, xp: 0, stage: 'Baby',
      equippedMoveIds: ['ember'], knownMoveIds: ['ember'], maxAttackSlots: 2,
      currentHp: 300, maxHp: 300, statusEffects: [],
      habitatId: 'b_habitat_fire_start', relationshipScores: {}, isUnique: false, name: 'Flameling',
    },
    'm_starter_water': {
      instanceId: 'm_starter_water', defId: 'aquapup', level: 1, xp: 0, stage: 'Baby',
      equippedMoveIds: ['aquajet'], knownMoveIds: ['aquajet'], maxAttackSlots: 2,
      currentHp: 320, maxHp: 320, statusEffects: [],
      habitatId: 'b_habitat_water_start', relationshipScores: {}, isUnique: false, name: 'Aquapup',
    },
  },
  buildings: {
    // Pre-placed starter buildings
    'b_breeding': {
      instanceId: 'b_breeding',
      defId: 'breeding_station',
      islandId: 'emerald_isle',
      tileX: 8, tileY: 6,
      level: 1,
      constructionEndMs: null,
      upgradeEndMs: null,
      monsterIds: [],
      goldAccumulated: 0,
      lastCollectedMs: Date.now(),
    },
    'b_hatchery': {
      instanceId: 'b_hatchery',
      defId: 'hatchery',
      islandId: 'emerald_isle',
      tileX: 11, tileY: 6,
      level: 1,
      constructionEndMs: null,
      upgradeEndMs: null,
      monsterIds: [],
      goldAccumulated: 0,
      lastCollectedMs: Date.now(),
    },
    'b_habitat_fire_start': {
      instanceId: 'b_habitat_fire_start',
      defId: 'habitat_fire',
      islandId: 'emerald_isle',
      tileX: 5, tileY: 4,
      level: 1,
      constructionEndMs: null,
      upgradeEndMs: null,
      monsterIds: ['m_starter_fire'],
      goldAccumulated: 0,
      lastCollectedMs: Date.now(),
    },
    'b_habitat_water_start': {
      instanceId: 'b_habitat_water_start',
      defId: 'habitat_water',
      islandId: 'emerald_isle',
      tileX: 5, tileY: 7,
      level: 1,
      constructionEndMs: null,
      upgradeEndMs: null,
      monsterIds: ['m_starter_water'],
      goldAccumulated: 0,
      lastCollectedMs: Date.now(),
    },
    'b_farm_start': {
      instanceId: 'b_farm_start',
      defId: 'farm_basic',
      islandId: 'emerald_isle',
      tileX: 14, tileY: 7,
      level: 1,
      constructionEndMs: null,
      upgradeEndMs: null,
      monsterIds: [],
      goldAccumulated: 0,
      lastCollectedMs: Date.now(),
    },
  },
  eggs: [],
  storedEggs: [],
  activeBreedings: [],
  lastBreedPair: null,
  unlockedIslands: ['emerald_isle'],
  islandFragments: {},
  clearedObstacles: [],
  storyProgress: 0,
  pokedexSeen: ['flameling', 'aquapup'],
  currentIslandId: 'emerald_isle',
  tutorialStep: 0,
  pendingLevelRewards: [],
  stats: { feeds: 0, breeds: 0, hatches: 0, collects: 0, battlesWon: 0, buildingsBuilt: 0 },
  claimedQuests: [],
  redeemedCheatCodes: [],
};

export const useGameStore = create<GameStore>()(
  persist(
    immer((set, get) => ({
      ...INITIAL_STATE,

      addGold: (n) => set((s) => { s.gold += n; }),
      spendGold: (n) => {
        if (get().gold < n) return false;
        set((s) => { s.gold -= n; });
        return true;
      },
      addDiamonds: (n) => set((s) => { s.diamonds += n; }),
      spendDiamonds: (n) => {
        if (get().diamonds < n) return false;
        set((s) => { s.diamonds -= n; });
        return true;
      },
      addFood: (n) => set((s) => { s.food += n; }),
      spendFood: (n) => {
        if (get().food < n) return false;
        set((s) => { s.food -= n; });
        return true;
      },
      // Convert gold into food at a fixed 20 : 1 rate (gold : food).
      convertGoldToFood: (foodAmount) => {
        if (foodAmount <= 0) return false;
        const goldCost = foodAmount * 20;
        if (!get().spendGold(goldCost)) return false;
        set((s) => { s.food += foodAmount; });
        return true;
      },

      placeBuilding: (defId, islandId, tileX, tileY) => {
        const def = BUILDING_DEFS[defId];
        if (!def) return null;
        // Gate buildings that require a higher player level.
        if (def.unlockLevel && get().playerLevel < def.unlockLevel) return null;
        if (!get().spendGold(def.goldCost)) return null;
        const id = 'b_' + uid();
        const endMs = def.buildTimeSec > 0 ? Date.now() + def.buildTimeSec * 1000 : null;
        set((s) => {
          s.buildings[id] = {
            instanceId: id,
            defId,
            islandId,
            tileX,
            tileY,
            level: 1,
            constructionEndMs: endMs,
            upgradeEndMs: null,
            monsterIds: [],
            goldAccumulated: 0,
            lastCollectedMs: Date.now(),
          };
          s.stats.buildingsBuilt += 1;
        });
        return id;
      },

      moveBuilding: (instanceId, tileX, tileY) => {
        const b = get().buildings[instanceId];
        if (!b) return false;
        set((s) => {
          const bb = s.buildings[instanceId];
          if (bb) { bb.tileX = tileX; bb.tileY = tileY; }
        });
        return true;
      },

      demolishBuilding: (instanceId) => {
        const b = get().buildings[instanceId];
        if (!b) return 0;
        const def = BUILDING_DEFS[b.defId];
        if (!def) return 0;
        // Only Habitats and Farms can be torn down.
        if (def.category !== 'Habitat' && def.category !== 'Farm') return 0;
        const refund = Math.floor(def.goldCost * 0.5);
        set((s) => {
          // Release any residents back to the unassigned pool.
          for (const mId of b.monsterIds) {
            const m = s.monsters[mId];
            if (m) m.habitatId = null;
          }
          delete s.buildings[instanceId];
          s.gold += refund;
        });
        return refund;
      },

      upgradeBuilding: (instanceId) => {
        const b = get().buildings[instanceId];
        if (!b) return;
        const def = BUILDING_DEFS[b.defId];
        if (!def) return;
        const nextLevel = def.levels[b.level]; // levels are 0-indexed for upgrades
        if (!nextLevel) return;
        if (!get().spendGold(nextLevel.upgradeCost)) return;
        const endMs = nextLevel.upgradeTimeSec > 0 ? Date.now() + nextLevel.upgradeTimeSec * 1000 : null;
        set((s) => {
          s.buildings[instanceId].upgradeEndMs = endMs;
        });
      },

      collectGold: (instanceId) => {
        const b = get().buildings[instanceId];
        if (!b) return;
        const def = BUILDING_DEFS[b.defId];
        const accumulated = b.goldAccumulated;
        if (accumulated <= 0) return;
        set((s) => {
          if (def?.category === 'Farm') {
            s.food += Math.floor(accumulated);
          } else {
            s.gold += Math.floor(accumulated);
          }
          s.buildings[instanceId].goldAccumulated = 0;
          s.buildings[instanceId].lastCollectedMs = Date.now();
          s.stats.collects += 1;
        });
      },

      collectAll: (category) => {
        let goldGained = 0;
        let foodGained = 0;
        set((s) => {
          for (const b of Object.values(s.buildings)) {
            const def = BUILDING_DEFS[b.defId];
            if (!def) continue;
            if (category && def.category !== category) continue;
            const amount = Math.floor(b.goldAccumulated);
            if (amount <= 0) continue;
            if (def.category === 'Farm') {
              s.food += amount;
              foodGained += amount;
            } else {
              s.gold += amount;
              goldGained += amount;
            }
            b.goldAccumulated = 0;
            b.lastCollectedMs = Date.now();
            s.stats.collects += 1;
          }
        });
        return { gold: goldGained, food: foodGained };
      },

      addMonster: (defId, isUnique = false, parentIds) => {
        const def = MONSTER_DEFS[defId];
        if (!def) throw new Error(`Unknown monster def: ${defId}`);
        const id = 'm_' + uid();
        const startMoves = def.availableMoveIds.slice(0, 2).filter(Boolean);
        const instance: MonsterInstance = {
          instanceId: id,
          defId,
          level: 1,
          xp: 0,
          stage: 'Baby',
          equippedMoveIds: startMoves,
          knownMoveIds: [...startMoves],
          maxAttackSlots: 2,
          currentHp: def.baseStats.hp,
          maxHp: def.baseStats.hp,
          statusEffects: [],
          habitatId: null,
          relationshipScores: {},
          isUnique,
          parentIds,
          name: def.name,
        };
        set((s) => {
          s.monsters[id] = instance;
          if (!s.pokedexSeen.includes(defId)) {
            s.pokedexSeen.push(defId);
          }
        });
        return instance;
      },

      feedMonster: (instanceId, foodAmount) => {
        const monster = get().monsters[instanceId];
        if (!monster) return;
        if (monster.level >= 100) return;
        const cost = calculateFeedCost(monster.level);
        // One feed cycle per call. Always exactly 4 feed cycles per level-up.
        if (foodAmount < cost) return;
        if (!get().spendFood(cost)) return;
        set((s) => {
          const m = s.monsters[instanceId];
          if (m.level >= 100) return;
          s.stats.feeds += 1;
          // Each feed grants a quarter of the XP needed for the current level,
          // so a level always takes 4 feed cycles (Monster-Legends style steps).
          m.xp += Math.ceil(calculateXpToLevel(m.level) / 4);
          let xpNeeded = calculateXpToLevel(m.level);
          while (m.xp >= xpNeeded && m.level < 100) {
            m.xp -= xpNeeded;
            m.level++;
            xpNeeded = calculateXpToLevel(m.level);
            // Unlock new move from pool (every 10 levels)
            const unlockedMoves = getUnlockedMoves(m.defId, m.level);
            const newMove = unlockedMoves[unlockedMoves.length - 1];
            if (newMove) {
              if (!m.knownMoveIds) m.knownMoveIds = [...m.equippedMoveIds];
              if (!m.knownMoveIds.includes(newMove)) m.knownMoveIds.push(newMove);
              if (!m.equippedMoveIds.includes(newMove) && m.equippedMoveIds.length < (m.maxAttackSlots ?? 4)) {
                m.equippedMoveIds.push(newMove);
              }
            }
          }
        });
      },

      sellMonster: (instanceId) => {
        const monster = get().monsters[instanceId];
        if (!monster) return 0;
        const def = MONSTER_DEFS[monster.defId];
        if (!def) return 0;
        const value = calculateSellValue(RARITY_RANK[def.rarity], monster.level, monster.isUnique);
        set((s) => {
          const m = s.monsters[instanceId];
          if (!m) return;
          // Detach from any habitat first.
          if (m.habitatId && s.buildings[m.habitatId]) {
            const hab = s.buildings[m.habitatId];
            hab.monsterIds = hab.monsterIds.filter(id => id !== instanceId);
          }
          delete s.monsters[instanceId];
          s.gold += value;
        });
        return value;
      },

      assignToHabitat: (monsterId, habitatId) => {
        set((s) => {
          const m = s.monsters[monsterId];
          if (!m) return;
          // Remove from old habitat
          if (m.habitatId && s.buildings[m.habitatId]) {
            const oldHabitat = s.buildings[m.habitatId];
            oldHabitat.monsterIds = oldHabitat.monsterIds.filter(id => id !== monsterId);
          }
          m.habitatId = habitatId;
          if (s.buildings[habitatId]) {
            s.buildings[habitatId].monsterIds.push(monsterId);
          }
        });
      },

      removeFromHabitat: (monsterId) => {
        set((s) => {
          const m = s.monsters[monsterId];
          if (!m || !m.habitatId) return;
          if (s.buildings[m.habitatId]) {
            const hab = s.buildings[m.habitatId];
            hab.monsterIds = hab.monsterIds.filter(id => id !== monsterId);
          }
          m.habitatId = null;
        });
      },

      addXpToMonster: (instanceId, amount) => {
        set((s) => {
          const m = s.monsters[instanceId];
          if (!m) return;
          m.xp += amount;
          let xpNeeded = calculateXpToLevel(m.level);
          while (m.xp >= xpNeeded && m.level < 100) {
            m.xp -= xpNeeded;
            m.level++;
            xpNeeded = calculateXpToLevel(m.level);
            const unlockedMoves = getUnlockedMoves(m.defId, m.level);
            const newMove = unlockedMoves[unlockedMoves.length - 1];
            if (newMove) {
              if (!m.knownMoveIds) m.knownMoveIds = [...m.equippedMoveIds];
              if (!m.knownMoveIds.includes(newMove)) m.knownMoveIds.push(newMove);
              if (!m.equippedMoveIds.includes(newMove) && m.equippedMoveIds.length < (m.maxAttackSlots ?? 4)) {
                m.equippedMoveIds.push(newMove);
              }
            }
          }
        });
      },

      evolveMonster: (instanceId) => {
        set((s) => {
          const m = s.monsters[instanceId];
          if (!m) return;
          const next = getNextEvolutionStage(m.stage);
          if (!next) return;
          if (m.level < EVOLUTION_LEVELS[next]) return;
          m.stage = next;
          m.maxAttackSlots = getMaxAttackSlots(next);
          // Ensure knownMoveIds exists before calling pickRandomNewAttack
          if (!m.knownMoveIds) m.knownMoveIds = [...m.equippedMoveIds];
          const newAttack = pickRandomNewAttack(m as MonsterInstance);
          if (newAttack) {
            if (!m.knownMoveIds.includes(newAttack)) m.knownMoveIds.push(newAttack);
            if (m.equippedMoveIds.length < m.maxAttackSlots) {
              m.equippedMoveIds.push(newAttack);
            }
          }
        });
      },

      equipMove: (instanceId, moveId, replaceSlot) => {
        set((s) => {
          const m = s.monsters[instanceId];
          if (!m) return;
          const slots = m.maxAttackSlots ?? 4;
          if (replaceSlot !== undefined && replaceSlot >= 0 && replaceSlot < slots) {
            m.equippedMoveIds[replaceSlot] = moveId;
          } else if (m.equippedMoveIds.length < slots) {
            m.equippedMoveIds.push(moveId);
          }
        });
      },

      learnAttack: (instanceId, moveId) => {
        const m = get().monsters[instanceId];
        if (!m) return false;
        set((s) => {
          const mon = s.monsters[instanceId];
          if (!mon) return;
          if (!mon.knownMoveIds) mon.knownMoveIds = [...mon.equippedMoveIds];
          if (!mon.knownMoveIds.includes(moveId)) mon.knownMoveIds.push(moveId);
          if (mon.equippedMoveIds.length < mon.maxAttackSlots && !mon.equippedMoveIds.includes(moveId)) {
            mon.equippedMoveIds.push(moveId);
          }
        });
        return true;
      },

      equipAttack: (instanceId, moveId, replaceId) => {
        set((s) => {
          const m = s.monsters[instanceId];
          if (!m) return;
          if (!m.knownMoveIds) m.knownMoveIds = [...m.equippedMoveIds];
          if (!m.knownMoveIds.includes(moveId)) return;
          if (m.equippedMoveIds.includes(moveId)) return;
          if (replaceId) {
            const idx = m.equippedMoveIds.indexOf(replaceId);
            if (idx >= 0) m.equippedMoveIds[idx] = moveId;
          } else if (m.equippedMoveIds.length < m.maxAttackSlots) {
            m.equippedMoveIds.push(moveId);
          }
        });
      },

      unequipAttack: (instanceId, moveId) => {
        set((s) => {
          const m = s.monsters[instanceId];
          if (!m) return;
          if (m.equippedMoveIds.length <= 1) return; // keep at least one attack
          m.equippedMoveIds = m.equippedMoveIds.filter(id => id !== moveId);
        });
      },

      trainAttack: (instanceId, moveId) => {
        const m = get().monsters[instanceId];
        if (!m) return false;
        const trainable = getTrainableAttacks(m);
        if (!trainable.includes(moveId)) return false;
        const cost = getAttackTrainCost(moveId);
        if (cost.diamonds > 0) {
          if (!get().spendDiamonds(cost.diamonds)) return false;
        } else {
          if (!get().spendGold(cost.gold)) return false;
        }
        get().learnAttack(instanceId, moveId);
        return true;
      },

      updateRelationship: (id1, id2, delta) => {
        set((s) => {
          const m1 = s.monsters[id1];
          const m2 = s.monsters[id2];
          if (m1) {
            m1.relationshipScores[id2] = Math.min(1000,
              Math.max(0, (m1.relationshipScores[id2] ?? 0) + delta));
          }
          if (m2) {
            m2.relationshipScores[id1] = Math.min(1000,
              Math.max(0, (m2.relationshipScores[id1] ?? 0) + delta));
          }
        });
      },

      addEgg: (monsterDefId, hatchTimeOverrideSec, isUnique = false, parentIds) => {
        const def = MONSTER_DEFS[monsterDefId];
        if (!def) return;
        const hatchSec = hatchTimeOverrideSec ?? RARITY_HATCH_TIME_SEC[def.rarity];
        const now = Date.now();
        // New eggs land in the Lager (storage) first — not incubating. We encode
        // the intended hatch duration in hatchStartMs/hatchEndMs so the timer can
        // begin when the player moves the egg into the hatchery.
        const egg: Egg = {
          id: 'egg_' + uid(),
          monsterDefId,
          hatchStartMs: now,
          hatchEndMs: now + hatchSec * 1000,
          hatcherySlot: 0,
          isUnique,
          parentIds,
          inStorage: true,
        };
        set((s) => { s.storedEggs.push(egg); });
      },

      // Move a stored egg into the hatchery, starting its incubation timer.
      // Returns false if the hatchery is full.
      moveEggToHatchery: (eggId) => {
        const egg = get().storedEggs.find(e => e.id === eggId);
        if (!egg) return false;
        if (get().eggs.length >= get().eggCapacity()) return false;
        const durationMs = Math.max(0, egg.hatchEndMs - egg.hatchStartMs);
        const now = Date.now();
        set((s) => {
          s.storedEggs = s.storedEggs.filter(e => e.id !== eggId);
          s.eggs.push({
            ...egg,
            inStorage: false,
            hatchStartMs: now,
            hatchEndMs: now + durationMs,
            hatcherySlot: s.eggs.length,
          });
        });
        return true;
      },

      // Sell a stored egg for gold based on its monster's rarity.
      sellEgg: (eggId) => {
        const egg = get().storedEggs.find(e => e.id === eggId);
        if (!egg) return 0;
        const def = MONSTER_DEFS[egg.monsterDefId];
        const rank = def ? RARITY_RANK[def.rarity] : 0;
        // Eggs sell for less than the baby they hatch into (see calculateEggSellValue).
        const value = calculateEggSellValue(rank, egg.isUnique);
        set((s) => {
          s.storedEggs = s.storedEggs.filter(e => e.id !== eggId);
          s.gold += value;
        });
        return value;
      },

      hatchEgg: (eggId) => {
        const egg = get().eggs.find(e => e.id === eggId);
        if (!egg) return null;
        if (Date.now() < egg.hatchEndMs) return null;
        set((s) => { s.eggs = s.eggs.filter(e => e.id !== eggId); s.stats.hatches += 1; });
        return get().addMonster(egg.monsterDefId, egg.isUnique, egg.parentIds);
      },

      // Habitats on the current island that can house this monster (matching
      // element + free space). 'Legendary' habitats (no linked element) accept all.
      eligibleHabitats: (monsterDefId) => {
        const def = MONSTER_DEFS[monsterDefId];
        if (!def) return [];
        const state = get();
        return Object.values(state.buildings).filter(b => {
          const bd = BUILDING_DEFS[b.defId];
          if (!bd || bd.category !== 'Habitat') return false;
          if (b.islandId !== state.currentIslandId) return false;
          if (b.constructionEndMs) return false;
          const levelData = bd.levels[b.level - 1];
          const cap = levelData?.monsterCapacity ?? 3;
          if (b.monsterIds.length >= cap) return false;
          // Prestige habitats only accept monsters of a minimum rarity.
          if (bd.minRarityRank != null && RARITY_RANK[def.rarity] < bd.minRarityRank) return false;
          if (bd.linkedElement) return def.elements.includes(bd.linkedElement);
          return true; // legendary / prestige habitat (any element)
        }).map(b => b.instanceId);
      },

      // Hatch an egg and immediately move the new monster into a habitat.
      // Returns null (and does nothing) if the habitat isn't valid/free.
      hatchEggToHabitat: (eggId, habitatId) => {
        const egg = get().eggs.find(e => e.id === eggId);
        if (!egg) return null;
        if (Date.now() < egg.hatchEndMs) return null;
        if (!get().eligibleHabitats(egg.monsterDefId).includes(habitatId)) return null;
        set((s) => { s.eggs = s.eggs.filter(e => e.id !== eggId); s.stats.hatches += 1; });
        const monster = get().addMonster(egg.monsterDefId, egg.isUnique, egg.parentIds);
        get().assignToHabitat(monster.instanceId, habitatId);
        return monster;
      },

      speedUpEgg: (eggId) => {
        const egg = get().eggs.find(e => e.id === eggId);
        if (!egg) return;
        const secondsLeft = Math.max(0, (egg.hatchEndMs - Date.now()) / 1000);
        const diamondCost = Math.ceil(secondsLeft / 60);
        if (!get().spendDiamonds(diamondCost)) return;
        set((s) => {
          const e = s.eggs.find(x => x.id === eggId);
          if (e) e.hatchEndMs = Date.now();
        });
      },

      breedingCapacity: () => {
        const station = Object.values(get().buildings).find(
          b => BUILDING_DEFS[b.defId]?.category === 'BreedingStation'
        );
        return station ? station.level : 1;
      },

      eggCapacity: () => {
        const hatchery = Object.values(get().buildings).find(
          b => BUILDING_DEFS[b.defId]?.category === 'Hatchery'
        );
        const level = hatchery ? hatchery.level : 1;
        return 1 + level * 2; // L1=3, L2=5, L3=7, L4=9
      },

      startBreeding: (parent1Id, parent2Id) => {
        const m1 = get().monsters[parent1Id];
        const m2 = get().monsters[parent2Id];
        if (!m1 || !m2 || parent1Id === parent2Id) return false;
        if (get().activeBreedings.length >= get().breedingCapacity()) return false;

        const rel = m1.relationshipScores[parent2Id] ?? 0;
        const outcomes = calculateBreedOutcomes(m1, m2, rel);
        if (outcomes.length === 0) return false;

        const resultDefId = rollBreedOutcome(outcomes);
        const resultIsUnique = outcomes.find(o => o.monsterDefId === resultDefId)?.isHybrid ?? false;
        const def = MONSTER_DEFS[resultDefId];
        const breedSec = RARITY_BREED_TIME_SEC[def?.rarity ?? 'Common'] ?? 30;
        const now = Date.now();

        set((s) => {
          s.activeBreedings.push({
            id: 'br_' + uid(),
            parent1Id, parent2Id,
            startMs: now,
            endMs: now + breedSec * 1000,
            outcomes,
            resultDefId,
            resultIsUnique,
          });
          s.lastBreedPair = { parent1Id, parent2Id };
          s.stats.breeds += 1;
        });
        // Breeding together deepens the bond between the two parents.
        get().updateRelationship(parent1Id, parent2Id, 50);
        return true;
      },

      collectBreedingEgg: (id) => {
        const ab = get().activeBreedings.find(b => b.id === id);
        if (!ab) return;
        if (Date.now() < ab.endMs) return;
        // Collected eggs go to the Lager (storage), which is uncapped — the
        // hatchery capacity only limits how many can incubate at once.
        get().addEgg(ab.resultDefId, undefined, ab.resultIsUnique, [ab.parent1Id, ab.parent2Id]);
        set((s) => { s.activeBreedings = s.activeBreedings.filter(b => b.id !== id); });
      },

      speedUpBreeding: (id) => {
        const ab = get().activeBreedings.find(b => b.id === id);
        if (!ab) return;
        const secondsLeft = Math.max(0, (ab.endMs - Date.now()) / 1000);
        const diamondCost = Math.ceil(secondsLeft / 60);
        if (diamondCost > 0 && !get().spendDiamonds(diamondCost)) return;
        set((s) => {
          const b = s.activeBreedings.find(x => x.id === id);
          if (b) b.endMs = Date.now();
        });
      },

      cancelBreeding: (id) => {
        set((s) => { s.activeBreedings = s.activeBreedings.filter(b => b.id !== id); });
      },

      addPlayerXp: (amount) => {
        set((s) => {
          s.playerXp += amount;
          let xpNeeded = calculateXpToLevel(s.playerLevel);
          while (s.playerXp >= xpNeeded) {
            s.playerXp -= xpNeeded;
            s.playerLevel++;
            // Queue a claimable account-level reward for the new level.
            if (!s.pendingLevelRewards.includes(s.playerLevel)) {
              s.pendingLevelRewards.push(s.playerLevel);
            }
            xpNeeded = calculateXpToLevel(s.playerLevel);
          }
        });
      },

      claimLevelReward: (level) => {
        if (!get().pendingLevelRewards.includes(level)) return;
        const reward = getLevelReward(level);
        set((s) => {
          s.gold += reward.gold;
          s.diamonds += reward.diamonds;
          s.food += reward.food;
          s.pendingLevelRewards = s.pendingLevelRewards.filter(l => l !== level);
        });
        // Milestone egg goes to the storage/hatchery flow via addEgg.
        if (reward.eggDefId) {
          get().addEgg(reward.eggDefId, undefined, false);
        }
      },

      recordBattleWon: () => {
        set((s) => { s.stats.battlesWon += 1; });
      },

      claimQuest: (questId) => {
        const quest = QUESTS.find(q => q.id === questId);
        if (!quest) return false;
        if (get().claimedQuests.includes(questId)) return false;
        const snap = buildQuestSnapshot(get());
        if (!isQuestComplete(quest, snap)) return false;
        set((s) => {
          if (quest.reward.gold) s.gold += quest.reward.gold;
          if (quest.reward.diamonds) s.diamonds += quest.reward.diamonds;
          if (quest.reward.food) s.food += quest.reward.food;
          s.claimedQuests.push(questId);
        });
        if (quest.reward.eggDefId) get().addEgg(quest.reward.eggDefId, undefined, false);
        return true;
      },

      addTrophies: (amount) => {
        set((s) => { s.trophies = Math.max(0, s.trophies + amount); });
      },

      advanceStory: () => {
        set((s) => { s.storyProgress++; });
      },

      unlockIsland: (islandId) => {
        set((s) => {
          if (!s.unlockedIslands.includes(islandId)) {
            s.unlockedIslands.push(islandId);
          }
        });
      },

      purchaseIsland: (islandId) => {
        if (get().unlockedIslands.includes(islandId)) return true;
        const def = ISLAND_DEFS[islandId];
        if (!def) return false;
        const cost = def.goldCost ?? 0;
        if (!get().spendGold(cost)) return false;
        set((s) => {
          if (!s.unlockedIslands.includes(islandId)) s.unlockedIslands.push(islandId);
        });
        return true;
      },

      clearObstacle: (islandId, tileX, tileY) => {
        const key = `${islandId}:${tileX},${tileY}`;
        if (get().clearedObstacles.includes(key)) return false;
        const placement = ISLAND_DEFS[islandId]?.obstacles?.find(
          o => o.tileX === tileX && o.tileY === tileY,
        );
        if (!placement) return false;
        const od = OBSTACLE_DEFS[placement.defId];
        if (!od) return false;
        if (!get().spendGold(od.clearCost)) return false;
        set((s) => {
          s.clearedObstacles.push(key);
          if (od.clearReward.gold) s.gold += od.clearReward.gold;
          if (od.clearReward.food) s.food += od.clearReward.food;
        });
        if (od.clearReward.xp) get().addPlayerXp(od.clearReward.xp);
        return true;
      },

      setCurrentIsland: (islandId) => {
        set((s) => { s.currentIslandId = islandId; });
      },

      addPokedexEntry: (defId) => {
        set((s) => {
          if (!s.pokedexSeen.includes(defId)) {
            s.pokedexSeen.push(defId);
          }
        });
      },

      setTutorialStep: (step) => {
        set((s) => { s.tutorialStep = step; });
      },

      tickTimers: () => {
        const now = Date.now();
        set((s) => {
          // Complete constructions
          for (const b of Object.values(s.buildings)) {
            if (b.constructionEndMs && now >= b.constructionEndMs) {
              b.constructionEndMs = null;
            }
            if (b.upgradeEndMs && now >= b.upgradeEndMs) {
              b.level++;
              b.upgradeEndMs = null;
            }

            // Accumulate gold for Habitats
            const def = BUILDING_DEFS[b.defId];
            if (def?.category === 'Habitat' && !b.constructionEndMs) {
              const levelData = def.levels[b.level - 1];
              if (levelData?.goldPerHour) {
                const elapsed = (now - b.lastCollectedMs) / 3_600_000;
                const maxAccum = levelData.goldPerHour * 12;
                b.goldAccumulated = Math.min(levelData.goldPerHour * elapsed, maxAccum);
              }
            }

            // Accumulate food for Farms (same pattern as gold: player clicks to collect)
            if (def?.category === 'Farm' && !b.constructionEndMs) {
              const levelData = def.levels[b.level - 1];
              if (levelData?.foodPerHour) {
                const elapsed = (now - b.lastCollectedMs) / 3_600_000;
                const maxAccum = levelData.foodPerHour * 8; // 8-hour cap
                b.goldAccumulated = Math.min(levelData.foodPerHour * elapsed, maxAccum);
              }
            }
          }
        });
      },

      // Secret cheat codes. "Iiwnddehb" unlocks effectively infinite
      // resources and reveals every monster in the Pokedex.
      redeemCheatCode: (code) => {
        const normalized = code.trim();

        // "Iiwnddehb" — repeatable god-mode code.
        if (normalized === 'Iiwnddehb') {
          const INF = 999_999_999;
          set((s) => {
            s.gold = INF;
            s.diamonds = INF;
            s.food = INF;
            // Reveal the whole Pokedex.
            for (const defId of Object.keys(MONSTER_DEFS)) {
              if (!s.pokedexSeen.includes(defId)) s.pokedexSeen.push(defId);
            }
            // Unlock every island.
            for (const islandId of Object.keys(ISLAND_DEFS)) {
              if (!s.unlockedIslands.includes(islandId)) s.unlockedIslands.push(islandId);
            }
          });
          return true;
        }

        // "GEM25" — one-time gift: 25 Diamanten (Gema) + 10.000 Gold.
        // Each player may redeem it only once.
        if (normalized === 'GEM25') {
          if (get().redeemedCheatCodes.includes('GEM25')) return false;
          set((s) => {
            s.diamonds += 25;
            s.gold += 10_000;
            s.redeemedCheatCodes.push('GEM25');
          });
          return true;
        }

        return false;
      },

      hardReset: () => set((s) => { Object.assign(s, structuredClone(INITIAL_STATE)); }),
    })),
    {
      name: SAVE_KEY,
      storage: createJSONStorage(() => accountScopedStorage),
      version: 10,
      migrate: (persisted: any, version: number) => {
        // v10: one-time hard reset — wipe every existing save back to a fresh
        // start (all players reset to 0) so the rebalanced egg/monster sale
        // values and farm production stats load cleanly. Any save below v10 is
        // discarded and replaced with the initial state.
        if (version < 10) {
          return structuredClone(INITIAL_STATE);
        }
        if (persisted && typeof persisted === 'object') {
          // v1→v2: single activeBreeding slot became an array.
          if (!Array.isArray(persisted.activeBreedings)) {
            persisted.activeBreedings = persisted.activeBreeding
              ? [{ id: 'br_legacy', ...persisted.activeBreeding }]
              : [];
          }
          delete persisted.activeBreeding;
          // Add the tutorial flag; existing players skip onboarding.
          if (typeof persisted.tutorialStep !== 'number') {
            persisted.tutorialStep = 99;
          }
          // Account level-up reward queue (existing players start empty).
          if (!Array.isArray(persisted.pendingLevelRewards)) {
            persisted.pendingLevelRewards = [];
          }
          // Quest stat counters + claimed-quest list.
          if (!persisted.stats || typeof persisted.stats !== 'object') {
            persisted.stats = { feeds: 0, breeds: 0, hatches: 0, collects: 0, battlesWon: 0, buildingsBuilt: 0 };
          }
          if (!Array.isArray(persisted.claimedQuests)) {
            persisted.claimedQuests = [];
          }
          // One-time cheat-code redemption tracking.
          if (!Array.isArray(persisted.redeemedCheatCodes)) {
            persisted.redeemedCheatCodes = [];
          }
          // Egg storage (Lager). Existing incubating eggs keep running.
          if (!Array.isArray(persisted.storedEggs)) {
            persisted.storedEggs = [];
          }
          // Cleared-obstacle tracking.
          if (!Array.isArray(persisted.clearedObstacles)) {
            persisted.clearedObstacles = [];
          }
          if (Array.isArray(persisted.eggs)) {
            for (const e of persisted.eggs) {
              if (typeof e.inStorage !== 'boolean') e.inStorage = false;
            }
          }
          // Add knownMoveIds and maxAttackSlots to existing monsters.
          if (persisted.monsters && typeof persisted.monsters === 'object') {
            for (const m of Object.values(persisted.monsters) as any[]) {
              if (!Array.isArray(m.knownMoveIds)) {
                m.knownMoveIds = Array.isArray(m.equippedMoveIds) ? [...m.equippedMoveIds] : [];
              }
              if (typeof m.maxAttackSlots !== 'number') {
                m.maxAttackSlots = 2;
              }
            }
          }
        }
        return persisted;
      },
    }
  )
);

// Bind the game store to a specific account's save (or detach it when logged
// out). Called by the auth store on login/register/logout. If the account
// already has a save we re-hydrate from it; otherwise we start a fresh game so
// the new player never inherits the previous account's monsters.
export function activateSaveFor(username: string | null): void {
  activeSaveUser = username;
  const hasSave = localStorage.getItem(scopedKey(SAVE_KEY)) != null;
  if (hasSave) {
    void useGameStore.persist.rehydrate();
  } else {
    useGameStore.getState().hardReset();
  }
}
