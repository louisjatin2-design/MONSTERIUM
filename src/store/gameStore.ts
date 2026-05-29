import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type {
  MonsterInstance, BuildingInstance, Egg, EvolutionStage,
} from '@gtypes/game';
import { MONSTER_DEFS } from '@data/monsters';
import { BUILDING_DEFS } from '@data/buildings';
import { RARITY_HATCH_TIME_SEC } from '@data/rarities';
import { calculateXpToLevel, calculateFeedCost } from '@systems/EconomySystem';
import { getUnlockedMoves } from '@systems/ProgressionSystem';

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

  // Buildings
  placeBuilding: (defId: string, islandId: string, tileX: number, tileY: number) => string | null;
  upgradeBuilding: (instanceId: string) => void;
  collectGold: (instanceId: string) => void;

  // Monsters
  addMonster: (defId: string, isUnique?: boolean, parentIds?: [string, string]) => MonsterInstance;
  feedMonster: (instanceId: string, foodAmount: number) => void;
  assignToHabitat: (monsterId: string, habitatId: string) => void;
  removeFromHabitat: (monsterId: string) => void;
  addXpToMonster: (instanceId: string, amount: number) => void;
  evolveMonster: (instanceId: string) => void;
  equipMove: (instanceId: string, moveId: string, replaceSlot?: number) => void;
  updateRelationship: (id1: string, id2: string, delta: number) => void;

  // Eggs & Breeding
  addEgg: (monsterDefId: string, hatchTimeOverrideSec?: number, isUnique?: boolean, parentIds?: [string, string]) => void;
  hatchEgg: (eggId: string) => MonsterInstance | null;
  speedUpEgg: (eggId: string) => void;

  // Progression
  addPlayerXp: (amount: number) => void;
  addTrophies: (amount: number) => void;
  advanceStory: () => void;
  unlockIsland: (islandId: string) => void;
  setCurrentIsland: (islandId: string) => void;
  addPokedexEntry: (defId: string) => void;

  // Timer tick (called every second from App.tsx)
  tickTimers: () => void;
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
        const accumulated = b.goldAccumulated;
        if (accumulated <= 0) return;
        set((s) => {
          s.gold += Math.floor(accumulated);
          s.buildings[instanceId].goldAccumulated = 0;
          s.buildings[instanceId].lastCollectedMs = Date.now();
        });
      },

      addMonster: (defId, isUnique = false, parentIds) => {
        const def = MONSTER_DEFS[defId];
        if (!def) throw new Error(`Unknown monster def: ${defId}`);
        const id = 'm_' + uid();
        const instance: MonsterInstance = {
          instanceId: id,
          defId,
          level: 1,
          xp: 0,
          stage: 'Baby',
          equippedMoveIds: [def.availableMoveIds[0]].filter(Boolean),
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
        const cost = calculateFeedCost(monster.level);
        const times = Math.floor(foodAmount / cost);
        if (times <= 0) return;
        if (!get().spendFood(times * cost)) return;
        set((s) => {
          const m = s.monsters[instanceId];
          const xpGain = times * 50;
          m.xp += xpGain;
          // Level up check
          let xpNeeded = calculateXpToLevel(m.level);
          while (m.xp >= xpNeeded && m.level < 100) {
            m.xp -= xpNeeded;
            m.level++;
            xpNeeded = calculateXpToLevel(m.level);
            // Unlock new move
            const unlockedMoves = getUnlockedMoves(m.defId, m.level);
            const newMove = unlockedMoves[unlockedMoves.length - 1];
            if (newMove && !m.equippedMoveIds.includes(newMove) && m.equippedMoveIds.length < 4) {
              m.equippedMoveIds.push(newMove);
            }
          }
        });
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
            if (newMove && !m.equippedMoveIds.includes(newMove) && m.equippedMoveIds.length < 4) {
              m.equippedMoveIds.push(newMove);
            }
          }
        });
      },

      evolveMonster: (instanceId) => {
        set((s) => {
          const m = s.monsters[instanceId];
          if (!m) return;
          if (m.stage === 'Baby' && m.level >= 10) m.stage = 'Juvenile';
          else if (m.stage === 'Juvenile' && m.level >= 20) m.stage = 'Adult';
        });
      },

      equipMove: (instanceId, moveId, replaceSlot) => {
        set((s) => {
          const m = s.monsters[instanceId];
          if (!m) return;
          if (replaceSlot !== undefined && replaceSlot >= 0 && replaceSlot < 4) {
            m.equippedMoveIds[replaceSlot] = moveId;
          } else if (m.equippedMoveIds.length < 4) {
            m.equippedMoveIds.push(moveId);
          }
        });
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
        const egg: Egg = {
          id: 'egg_' + uid(),
          monsterDefId,
          hatchEndMs: Date.now() + hatchSec * 1000,
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

            // Accumulate food for Farms
            if (def?.category === 'Farm' && !b.constructionEndMs) {
              const levelData = def.levels[b.level - 1];
              if (levelData?.foodPerHour) {
                const elapsed = (now - b.lastCollectedMs) / 3_600_000;
                const produced = Math.floor(levelData.foodPerHour * elapsed);
                if (produced > 0) {
                  s.food += produced;
                  b.lastCollectedMs = now;
                }
              }
            }
          }
        });
      },
    })),
    {
      name: 'monsterium-save',
      version: 1,
    }
  )
);
