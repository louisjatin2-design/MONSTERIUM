import type { ObstacleDef } from '@gtypes/game';

// Terrain obstacles that dot every island (Monster-Legends style). The player
// taps one to clear it for gold; clearing returns a small one-off reward so the
// island feels alive and rewarding to tidy up before building.
export const OBSTACLE_DEFS: Record<string, ObstacleDef> = {
  rock_small: {
    id: 'rock_small', name: 'Felsbrocken', type: 'rock',
    tilesW: 1, tilesH: 1, clearCost: 150,
    clearReward: { gold: 40, xp: 5 },
  },
  ancient_tree: {
    id: 'ancient_tree', name: 'Alter Baum', type: 'tree',
    tilesW: 1, tilesH: 1, clearCost: 300,
    clearReward: { food: 30, xp: 8 },
  },
  thorn_bush: {
    id: 'thorn_bush', name: 'Dornenbusch', type: 'bush',
    tilesW: 1, tilesH: 1, clearCost: 100,
    clearReward: { food: 15, xp: 3 },
  },
  crystal_cluster: {
    id: 'crystal_cluster', name: 'Kristallcluster', type: 'crystal',
    tilesW: 1, tilesH: 1, clearCost: 500,
    clearReward: { gold: 120, xp: 15 },
  },
  glow_mushroom: {
    id: 'glow_mushroom', name: 'Leuchtpilz', type: 'mushroom',
    tilesW: 1, tilesH: 1, clearCost: 200,
    clearReward: { food: 40, xp: 6 },
  },
  bone_pile: {
    id: 'bone_pile', name: 'Knochenhaufen', type: 'bones',
    tilesW: 1, tilesH: 1, clearCost: 250,
    clearReward: { gold: 60, xp: 10 },
  },
};
