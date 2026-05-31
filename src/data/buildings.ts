import type { BuildingDef } from '@gtypes/game';

function makeHabitatLevels(baseGold: number, baseCapacity: number) {
  return Array.from({ length: 5 }, (_, i) => ({
    level: i + 1,
    upgradeCost: Math.floor(baseGold * Math.pow(2.5, i)),
    upgradeTimeSec: (i + 1) * 300,
    goldPerHour: Math.floor(baseGold * 0.5 * Math.pow(1.8, i)),
    monsterCapacity: baseCapacity + i,
  }));
}

function makeTempleLevels(baseGold: number) {
  return Array.from({ length: 8 }, (_, i) => ({
    level: i + 1,
    upgradeCost: Math.floor(baseGold * Math.pow(3, i)),
    upgradeTimeSec: (i + 1) * 600,
    levelCapBonus: 10,
    trainingSlotsTotal: 1 + Math.floor((i) / 2),
  }));
}

function makeFarmLevels(baseGold: number, baseFoodPerHour: number) {
  return Array.from({ length: 5 }, (_, i) => ({
    level: i + 1,
    upgradeCost: Math.floor(baseGold * Math.pow(2, i)),
    upgradeTimeSec: (i + 1) * 120,
    // Boosted production so feeding (now far cheaper) stays sustainable.
    foodPerHour: Math.floor(baseFoodPerHour * Math.pow(2.2, i)),
  }));
}

export const BUILDING_DEFS: Record<string, BuildingDef> = {
  // --- Habitats ---
  habitat_fire: {
    id: 'habitat_fire', name: 'Fire Habitat', category: 'Habitat',
    tilesW: 2, tilesH: 2, linkedElement: 'Fire',
    goldCost: 500, buildTimeSec: 10,
    levels: makeHabitatLevels(500, 3),
    description: 'Houses Fire-type monsters. Generates gold over time.',
  },
  habitat_water: {
    id: 'habitat_water', name: 'Water Habitat', category: 'Habitat',
    tilesW: 2, tilesH: 2, linkedElement: 'Water',
    goldCost: 500, buildTimeSec: 10,
    levels: makeHabitatLevels(500, 3),
    description: 'Houses Water-type monsters.',
  },
  habitat_electric: {
    id: 'habitat_electric', name: 'Electric Habitat', category: 'Habitat',
    tilesW: 2, tilesH: 2, linkedElement: 'Electric',
    goldCost: 600, buildTimeSec: 15,
    levels: makeHabitatLevels(600, 3),
    description: 'Houses Electric-type monsters.',
  },
  habitat_earth: {
    id: 'habitat_earth', name: 'Earth Habitat', category: 'Habitat',
    tilesW: 2, tilesH: 2, linkedElement: 'Earth',
    goldCost: 600, buildTimeSec: 15,
    levels: makeHabitatLevels(600, 3),
    description: 'Houses Earth-type monsters.',
  },
  habitat_air: {
    id: 'habitat_air', name: 'Air Habitat', category: 'Habitat',
    tilesW: 2, tilesH: 2, linkedElement: 'Air',
    goldCost: 600, buildTimeSec: 15,
    levels: makeHabitatLevels(600, 3),
    description: 'Houses Air-type monsters.',
  },
  habitat_ice: {
    id: 'habitat_ice', name: 'Ice Habitat', category: 'Habitat',
    tilesW: 2, tilesH: 2, linkedElement: 'Ice',
    goldCost: 600, buildTimeSec: 15,
    levels: makeHabitatLevels(600, 3),
    description: 'Houses Ice-type monsters.',
  },
  habitat_darkness: {
    id: 'habitat_darkness', name: 'Darkness Habitat', category: 'Habitat',
    tilesW: 2, tilesH: 2, linkedElement: 'Darkness',
    goldCost: 1000, buildTimeSec: 30,
    levels: makeHabitatLevels(800, 3),
    description: 'Houses Darkness-type monsters.',
  },
  habitat_light: {
    id: 'habitat_light', name: 'Light Habitat', category: 'Habitat',
    tilesW: 2, tilesH: 2, linkedElement: 'Light',
    goldCost: 1000, buildTimeSec: 30,
    levels: makeHabitatLevels(800, 3),
    description: 'Houses Light-type monsters.',
  },
  habitat_metal: {
    id: 'habitat_metal', name: 'Metal Habitat', category: 'Habitat',
    tilesW: 2, tilesH: 2, linkedElement: 'Metal',
    goldCost: 1200, buildTimeSec: 45,
    levels: makeHabitatLevels(900, 3),
    description: 'Houses Metal-type monsters.',
  },
  habitat_poison: {
    id: 'habitat_poison', name: 'Poison Habitat', category: 'Habitat',
    tilesW: 2, tilesH: 2, linkedElement: 'Poison',
    goldCost: 1200, buildTimeSec: 45,
    levels: makeHabitatLevels(900, 3),
    description: 'Houses Poison-type monsters.',
  },
  habitat_legendary: {
    id: 'habitat_legendary', name: 'Legendary Habitat', category: 'Habitat',
    tilesW: 3, tilesH: 3,
    goldCost: 5000, buildTimeSec: 600,
    levels: makeHabitatLevels(3000, 2),
    description: 'Houses Legendary and above monsters.',
  },
  // --- Temples ---
  temple_fire: {
    id: 'temple_fire', name: 'Fire Temple', category: 'Temple',
    tilesW: 3, tilesH: 3, linkedElement: 'Fire',
    goldCost: 2000, buildTimeSec: 300,
    levels: makeTempleLevels(2000),
    description: 'Extends level cap for Fire-type monsters by 10 per temple level.',
  },
  temple_water: {
    id: 'temple_water', name: 'Water Temple', category: 'Temple',
    tilesW: 3, tilesH: 3, linkedElement: 'Water',
    goldCost: 2000, buildTimeSec: 300,
    levels: makeTempleLevels(2000),
    description: 'Extends level cap for Water-type monsters.',
  },
  temple_universal: {
    id: 'temple_universal', name: 'Universal Temple', category: 'Temple',
    tilesW: 3, tilesH: 3,
    goldCost: 8000, buildTimeSec: 900,
    levels: makeTempleLevels(8000),
    description: 'Extends level cap for any monster type.',
  },
  // --- Farms ---
  farm_basic: {
    id: 'farm_basic', name: 'Basic Farm', category: 'Farm',
    tilesW: 2, tilesH: 2,
    goldCost: 300, buildTimeSec: 5,
    levels: makeFarmLevels(300, 120),
    description: 'Produces food slowly. Converts gold to food over time.',
  },
  farm_advanced: {
    id: 'farm_advanced', name: 'Advanced Farm', category: 'Farm',
    tilesW: 2, tilesH: 2,
    goldCost: 1500, buildTimeSec: 60,
    levels: makeFarmLevels(1500, 400),
    description: 'Produces food quickly. Requires more gold investment.',
  },
  farm_mythic: {
    id: 'farm_mythic', name: 'Mythic Farm', category: 'Farm',
    tilesW: 3, tilesH: 2,
    goldCost: 10000, buildTimeSec: 600,
    levels: makeFarmLevels(10000, 1000),
    description: 'Massive food production for end-game feeding needs.',
  },
  // --- Special ---
  breeding_station: {
    id: 'breeding_station', name: 'Breeding Station', category: 'BreedingStation',
    tilesW: 2, tilesH: 3,
    goldCost: 0, buildTimeSec: 0,
    // Each level unlocks one more simultaneous breeding slot (1 → 2 → 3 → 4).
    levels: [
      { level: 1, upgradeCost: 0,     upgradeTimeSec: 0 },
      { level: 2, upgradeCost: 3000,  upgradeTimeSec: 300,  trainingSlotsTotal: 2 },
      { level: 3, upgradeCost: 12000, upgradeTimeSec: 1800, trainingSlotsTotal: 3 },
      { level: 4, upgradeCost: 40000, upgradeTimeSec: 7200, trainingSlotsTotal: 4 },
    ],
    description: 'Where two monsters come together to create a new egg. Each level adds a breeding slot.',
  },
  hatchery: {
    id: 'hatchery', name: 'Hatchery', category: 'Hatchery',
    tilesW: 2, tilesH: 2,
    goldCost: 0, buildTimeSec: 0,
    // Each level adds two egg slots (3 → 5 → 7 → 9).
    levels: [
      { level: 1, upgradeCost: 0,     upgradeTimeSec: 0 },
      { level: 2, upgradeCost: 2000,  upgradeTimeSec: 300 },
      { level: 3, upgradeCost: 8000,  upgradeTimeSec: 900 },
      { level: 4, upgradeCost: 25000, upgradeTimeSec: 3600 },
    ],
    description: 'Hatches monster eggs. Upgrade for more slots.',
  },
};

export const BUILDABLE_BUILDING_IDS = Object.keys(BUILDING_DEFS).filter(
  id => id !== 'breeding_station' && id !== 'hatchery'
);
