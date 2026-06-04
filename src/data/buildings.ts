import type { BuildingDef, ElementType } from '@gtypes/game';

function makeHabitatLevels(baseGold: number, baseCapacity: number) {
  return Array.from({ length: 5 }, (_, i) => ({
    level: i + 1,
    upgradeCost: Math.floor(baseGold * Math.pow(2.5, i)),
    upgradeTimeSec: (i + 1) * 300,
    goldPerHour: Math.floor(baseGold * 0.5 * Math.pow(1.8, i)),
    monsterCapacity: baseCapacity + i,
  }));
}

// Tempel haben 9 Stufen, sodass die Levelgrenze eines Monsters von 10 (kein
// Tempel) bis auf 100 (Tempel-Stufe 9) steigt — siehe ProgressionSystem.
function makeTempleLevels(baseGold: number) {
  return Array.from({ length: 9 }, (_, i) => ({
    level: i + 1,
    upgradeCost: Math.floor(baseGold * Math.pow(3, i)),
    upgradeTimeSec: (i + 1) * 600,
    levelCapBonus: 10,
    trainingSlotsTotal: 1 + Math.floor((i) / 2),
  }));
}

// Prestige habitats (Elite / Mythic / Transcendent) are single-tier: they exist
// only at level 1 and house exactly ONE monster, no matter what. They make up
// for the tiny capacity with a very high passive gold rate and a large footprint.
function makePrestigeHabitatLevels(goldPerHour: number) {
  return [
    { level: 1, upgradeCost: 0, upgradeTimeSec: 0, goldPerHour, monsterCapacity: 1 },
  ];
}

// Farm economy is tuned so that:
//   1. Upgrading an existing farm is always a better deal than building a
//      brand-new one — production (×2.1 / level) grows faster than the upgrade
//      cost (×1.6 / level), so the per-gold food yield of every upgrade beats
//      the yield of a fresh build (whose cost is ~2× the upgrade base).
//   2. Higher-tier farms are more gold-efficient than lower-tier ones, so
//      investing in better farms pays off (see per-farm baseFood/baseGold).
function makeFarmLevels(baseGold: number, baseFoodPerHour: number) {
  return Array.from({ length: 5 }, (_, i) => ({
    level: i + 1,
    upgradeCost: Math.floor(baseGold * Math.pow(1.6, i)),
    upgradeTimeSec: (i + 1) * 120,
    foodPerHour: Math.floor(baseFoodPerHour * Math.pow(2.1, i)),
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
  habitat_plant: {
    id: 'habitat_plant', name: 'Plant Habitat', category: 'Habitat',
    tilesW: 2, tilesH: 2, linkedElement: 'Plant',
    goldCost: 600, buildTimeSec: 15,
    levels: makeHabitatLevels(600, 3),
    description: 'Houses Plant-type monsters.',
  },
  habitat_combat: {
    id: 'habitat_combat', name: 'Combat Habitat', category: 'Habitat',
    tilesW: 2, tilesH: 2, linkedElement: 'Combat',
    goldCost: 700, buildTimeSec: 20,
    levels: makeHabitatLevels(700, 3),
    description: 'Houses Combat-type monsters.',
  },
  habitat_sand: {
    id: 'habitat_sand', name: 'Sand Habitat', category: 'Habitat',
    tilesW: 2, tilesH: 2, linkedElement: 'Sand',
    goldCost: 700, buildTimeSec: 20,
    levels: makeHabitatLevels(700, 3),
    description: 'Houses Sand-type monsters.',
  },
  habitat_sound: {
    id: 'habitat_sound', name: 'Sound Habitat', category: 'Habitat',
    tilesW: 2, tilesH: 2, linkedElement: 'Sound',
    goldCost: 800, buildTimeSec: 25,
    levels: makeHabitatLevels(800, 3),
    description: 'Houses Sound-type monsters.',
  },
  habitat_crystal: {
    id: 'habitat_crystal', name: 'Crystal Habitat', category: 'Habitat',
    tilesW: 2, tilesH: 2, linkedElement: 'Crystal',
    goldCost: 1200, buildTimeSec: 45,
    levels: makeHabitatLevels(1000, 3),
    description: 'Houses Crystal-type monsters.',
  },
  habitat_magic: {
    id: 'habitat_magic', name: 'Magic Habitat', category: 'Habitat',
    tilesW: 2, tilesH: 2, linkedElement: 'Magic',
    goldCost: 1400, buildTimeSec: 50,
    levels: makeHabitatLevels(1100, 3),
    description: 'Houses Magic-type monsters.',
  },
  habitat_psycho: {
    id: 'habitat_psycho', name: 'Psycho Habitat', category: 'Habitat',
    tilesW: 2, tilesH: 2, linkedElement: 'Psycho',
    goldCost: 1600, buildTimeSec: 60,
    levels: makeHabitatLevels(1200, 3),
    unlockLevel: 6,
    description: 'Houses Psycho-type monsters. Freigeschaltet ab Level 6.',
  },
  habitat_angel: {
    id: 'habitat_angel', name: 'Angel Habitat', category: 'Habitat',
    tilesW: 2, tilesH: 2, linkedElement: 'Angel',
    goldCost: 1800, buildTimeSec: 70,
    levels: makeHabitatLevels(1300, 3),
    unlockLevel: 7,
    description: 'Houses Angel-type monsters. Freigeschaltet ab Level 7.',
  },
  habitat_demon: {
    id: 'habitat_demon', name: 'Demon Habitat', category: 'Habitat',
    tilesW: 2, tilesH: 2, linkedElement: 'Demon',
    goldCost: 1800, buildTimeSec: 70,
    levels: makeHabitatLevels(1300, 3),
    unlockLevel: 7,
    description: 'Houses Demon-type monsters. Freigeschaltet ab Level 7.',
  },
  habitat_time: {
    id: 'habitat_time', name: 'Time Habitat', category: 'Habitat',
    tilesW: 2, tilesH: 2, linkedElement: 'Time',
    goldCost: 2200, buildTimeSec: 90,
    levels: makeHabitatLevels(1500, 3),
    unlockLevel: 10,
    description: 'Houses Time-type monsters. Freigeschaltet ab Level 10.',
  },
  habitat_glitch: {
    id: 'habitat_glitch', name: 'Glitch Habitat', category: 'Habitat',
    tilesW: 2, tilesH: 2, linkedElement: 'Glitch',
    goldCost: 2500, buildTimeSec: 100,
    levels: makeHabitatLevels(1600, 3),
    unlockLevel: 12,
    description: 'Houses Glitch-type monsters. Freigeschaltet ab Level 12.',
  },
  habitat_cosmos: {
    id: 'habitat_cosmos', name: 'Cosmos Habitat', category: 'Habitat',
    tilesW: 2, tilesH: 2, linkedElement: 'Cosmos',
    goldCost: 3000, buildTimeSec: 120,
    levels: makeHabitatLevels(1800, 3),
    unlockLevel: 14,
    description: 'Houses Cosmos-type monsters. Freigeschaltet ab Level 14.',
  },
  habitat_void: {
    id: 'habitat_void', name: 'Void Habitat', category: 'Habitat',
    tilesW: 2, tilesH: 2, linkedElement: 'Void',
    goldCost: 3000, buildTimeSec: 120,
    levels: makeHabitatLevels(1800, 3),
    unlockLevel: 14,
    description: 'Houses Void-type monsters. Freigeschaltet ab Level 14.',
  },
  habitat_legendary: {
    id: 'habitat_legendary', name: 'Legendary Habitat', category: 'Habitat',
    tilesW: 3, tilesH: 3,
    goldCost: 5000, buildTimeSec: 600,
    levels: makeHabitatLevels(3000, 2),
    unlockLevel: 8,
    minRarityRank: 4, // Legendary+
    description: 'Houses Legendary and above monsters. Freigeschaltet ab Level 8.',
  },
  // --- Prestige habitats: ever larger, hold a single monster, level 1 only ---
  habitat_elite: {
    id: 'habitat_elite', name: 'Elite Habitat', category: 'Habitat',
    tilesW: 4, tilesH: 4,
    goldCost: 12000, buildTimeSec: 1200,
    levels: makePrestigeHabitatLevels(2500),
    unlockLevel: 15,
    minRarityRank: 5, // Elite+
    description: 'Riesiger Prestige-Lebensraum für ein einziges Elite-Monster. Bleibt auf Level 1. Freigeschaltet ab Level 15.',
  },
  habitat_mythic: {
    id: 'habitat_mythic', name: 'Mythic Habitat', category: 'Habitat',
    tilesW: 5, tilesH: 5,
    goldCost: 30000, buildTimeSec: 2400,
    levels: makePrestigeHabitatLevels(5000),
    unlockLevel: 25,
    minRarityRank: 6, // Mythic+
    description: 'Noch größerer Prestige-Lebensraum für ein einziges Mythic-Monster. Bleibt auf Level 1. Freigeschaltet ab Level 25.',
  },
  habitat_transcendent: {
    id: 'habitat_transcendent', name: 'Transcendental Habitat', category: 'Habitat',
    tilesW: 6, tilesH: 6,
    goldCost: 75000, buildTimeSec: 4800,
    levels: makePrestigeHabitatLevels(10000),
    unlockLevel: 35,
    minRarityRank: 7, // Transcendent only
    description: 'Der größte Lebensraum überhaupt — beherbergt ein einziges Transcendental-Monster. Bleibt auf Level 1. Freigeschaltet ab Level 35.',
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
    unlockLevel: 12,
    description: 'Extends level cap for any monster type. Freigeschaltet ab Level 12.',
  },
  // --- Farms ---
  farm_basic: {
    id: 'farm_basic', name: 'Basic Farm', category: 'Farm',
    tilesW: 2, tilesH: 2,
    goldCost: 1200, buildTimeSec: 5,
    // baseFood/baseGold = 6.7 — entry tier. Upgrade base 600, build cost 1200 (2×).
    levels: makeFarmLevels(600, 4000),
    description: 'Produces food. Upgrading it is cheaper per food than building a second one.',
  },
  farm_advanced: {
    id: 'farm_advanced', name: 'Advanced Farm', category: 'Farm',
    tilesW: 2, tilesH: 2,
    goldCost: 3000, buildTimeSec: 60,
    // baseFood/baseGold = 8.0 — clearly better gold-efficiency than the basic farm.
    levels: makeFarmLevels(1500, 12000),
    description: 'Produces food far more efficiently than a Basic Farm. Worth the bigger investment.',
  },
  farm_mythic: {
    id: 'farm_mythic', name: 'Mythic Farm', category: 'Farm',
    tilesW: 3, tilesH: 2,
    goldCost: 8000, buildTimeSec: 600,
    // baseFood/baseGold = 10.0 — the most gold-efficient farm in the game.
    levels: makeFarmLevels(4000, 40000),
    unlockLevel: 18,
    description: 'The most efficient food production in the game. Freigeschaltet ab Level 18.',
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
  // Late-game building: the Labor (rank-up lab). Built on the island once you
  // reach the unlock level; tapping it opens the rank-up panel (OPEN_LAB).
  lab: {
    id: 'lab', name: 'Labor', category: 'Lab',
    tilesW: 3, tilesH: 3,
    goldCost: 50000, buildTimeSec: 1800,
    unlockLevel: 20,
    levels: [{ level: 1, upgradeCost: 0, upgradeTimeSec: 0 }],
    description: 'Late-Game-Gebäude. Führe hier zwei identische Monster auf Maximallevel zu einem Rank-Up zusammen (permanente Kampf-Boni).',
  },
};

// ── Element-Tempel für alle übrigen Elemente (Gruppe 6) ─────────────────────
// Fire & Water sind oben bereits definiert. Damit auch zwei-elementige Monster
// (die BEIDE Tempel benötigen) und seltene Elemente eine Tempel-Option haben,
// werden die restlichen Element-Tempel hier generiert.
const ELEMENT_TEMPLE_ELEMENTS: ElementType[] = [
  'Electric', 'Earth', 'Air', 'Ice', 'Darkness', 'Light', 'Metal', 'Poison',
  'Combat', 'Magic', 'Angel', 'Demon', 'Plant', 'Glitch', 'Time', 'Crystal',
  'Sand', 'Sound', 'Void', 'Cosmos', 'Psycho',
];

for (const el of ELEMENT_TEMPLE_ELEMENTS) {
  const id = `temple_${el.toLowerCase()}`;
  if (BUILDING_DEFS[id]) continue;
  BUILDING_DEFS[id] = {
    id, name: `${el} Temple`, category: 'Temple',
    tilesW: 3, tilesH: 3, linkedElement: el,
    goldCost: 2500, buildTimeSec: 300,
    levels: makeTempleLevels(2500),
    description: `Hebt die Levelgrenze für ${el}-Monster um 10 pro Tempel-Stufe an.`,
  };
}

export const BUILDABLE_BUILDING_IDS = Object.keys(BUILDING_DEFS).filter(
  id => id !== 'breeding_station' && id !== 'hatchery'
);
