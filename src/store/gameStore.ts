import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type {
  MonsterInstance, BuildingInstance, Egg, EvolutionStage, ActiveBreeding,
} from '@gtypes/game';
import { MONSTER_DEFS } from '@data/monsters';
import { BUILDING_DEFS } from '@data/buildings';
import { ISLAND_DEFS } from '@data/islands';
import { RARITY_HATCH_TIME_SEC, RARITY_BREED_TIME_SEC, RARITY_RANK } from '@data/rarities';
import { calculateXpToLevel, calculateFeedCost, calculateSellValue } from '@systems/EconomySystem';
import {
  getUnlockedMoves, getMaxAttackSlots, getNextEvolutionStage,
  pickRandomNewAttack, getTrainableAttacks, getAttackTrainCost,
  EVOLUTION_LEVELS,
} from '@systems/ProgressionSystem';
import { calculateBreedOutcomes, rollBreedOutcome } from '@systems/BreedingSystem';

// Simple uid generator (no external dependency)
function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
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
  eggs: Egg[];
  activeBreedings: ActiveBreeding[];
  lastBreedPair: { parent1Id: string; parent2Id: string } | null;
  unlockedIslands: string[];
  islandFragments: Record<string, number>;
  storyProgress: number;
  pokedexSeen: string[];
  currentIslandId: string;
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
  upgradeBuilding: (instanceId: string) => void;
  collectGold: (instanceId: string) => void;

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
  hatchEgg: (eggId: string) => MonsterInstance | null;
  speedUpEgg: (eggId: string) => void;
  startBreeding: (parent1Id: string, parent2Id: string) => boolean;
  collectBreedingEgg: (id: string) => void;
  speedUpBreeding: (id: string) => void;
  cancelBreeding: (id: string) => void;
  breedingCapacity: () => number;
  eggCapacity: () => number;

  // Progression
  addPlayerXp: (amount: number) => void;
  addTrophies: (amount: number) => void;
  advanceStory: () => void;
  unlockIsland: (islandId: string) => void;
  purchaseIsland: (islandId: string) => boolean;
  setCurrentIsland: (islandId: string) => void;
  addPokedexEntry: (defId: string) => void;

  // Timer tick (called every second from App.tsx)
  tickTimers: () => void;

  // Cheat codes — returns true if the code was valid.
  redeemCheatCode: (code: string) => boolean;
}

type GameStore = GameStoreState & GameStoreActions;

const INITIAL_STATE: GameStoreState = {
  gold: 2000,
  diamonds: 50,
  food: 500,
  playerLevel: 1,
  playerXp: 0,
  trophies: 0,
  monsters: {},
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
      monsterIds: [],
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
      monsterIds: [],
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
  activeBreedings: [],
  lastBreedPair: null,
  unlockedIslands: ['emerald_isle'],
  islandFragments: {},
  storyProgress: 0,
  pokedexSeen: ['flameling', 'aquapup'],
  currentIslandId: 'emerald_isle',
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
        });
        return id;
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
        });
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
        const value = calculateSellValue(RARITY_RANK[def.rarity], monster.level);
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
        const egg: Egg = {
          id: 'egg_' + uid(),
          monsterDefId,
          hatchStartMs: now,
          hatchEndMs: now + hatchSec * 1000,
          hatcherySlot: get().eggs.length,
          isUnique,
          parentIds,
        };
        set((s) => { s.eggs.push(egg); });
      },

      hatchEgg: (eggId) => {
        const egg = get().eggs.find(e => e.id === eggId);
        if (!egg) return null;
        if (Date.now() < egg.hatchEndMs) return null;
        set((s) => { s.eggs = s.eggs.filter(e => e.id !== eggId); });
        return get().addMonster(egg.monsterDefId, egg.isUnique, egg.parentIds);
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
        });
        // Breeding together deepens the bond between the two parents.
        get().updateRelationship(parent1Id, parent2Id, 50);
        return true;
      },

      collectBreedingEgg: (id) => {
        const ab = get().activeBreedings.find(b => b.id === id);
        if (!ab) return;
        if (Date.now() < ab.endMs) return;
        if (get().eggs.length >= get().eggCapacity()) return;
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
            xpNeeded = calculateXpToLevel(s.playerLevel);
          }
        });
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
        if (normalized !== 'Iiwnddehb') return false;
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
      },
    })),
    {
      name: 'monsterium-save',
      version: 3,
      migrate: (persisted: any, _version: number) => {
        if (persisted && typeof persisted === 'object') {
          // v1→v2: single activeBreeding slot became an array.
          if (!Array.isArray(persisted.activeBreedings)) {
            persisted.activeBreedings = persisted.activeBreeding
              ? [{ id: 'br_legacy', ...persisted.activeBreeding }]
              : [];
          }
          delete persisted.activeBreeding;
          // v2→v3: add knownMoveIds and maxAttackSlots to existing monsters.
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
