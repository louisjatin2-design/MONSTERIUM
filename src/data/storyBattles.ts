import type { StoryBattle } from '@gtypes/game';

export const STORY_BATTLES: StoryBattle[] = [
  {
    id: 'sb_01', name: 'The First Spark',
    description: 'A rival trainer challenges you with basic fire monsters.',
    enemyMonsterDefs: ['flameling', 'flameling', 'pebblor'],
    enemyLevels: [1, 1, 1],
    rewards: { xp: 200, gold: 150 },
  },
  {
    id: 'sb_02', name: 'Tidal Clash',
    description: 'Water monsters block the path to the next island.',
    enemyMonsterDefs: ['aquapup', 'aquapup', 'frostpaw'],
    enemyLevels: [3, 3, 2],
    rewards: { xp: 350, gold: 250 },
  },
  {
    id: 'sb_03', name: 'Storm Warning',
    description: 'Electric creatures swarm the ridge.',
    enemyMonsterDefs: ['voltkit', 'voltkit', 'zephyrling'],
    enemyLevels: [5, 5, 4],
    rewards: { xp: 500, gold: 400, monsterDefId: 'voltkit' },
  },
  {
    id: 'sb_04', name: 'Shadow of the Canyon',
    description: 'A rare dark monster lurks in the shadows.',
    enemyMonsterDefs: ['shadowfox', 'pebblor', 'pebblor'],
    enemyLevels: [6, 5, 5],
    rewards: { xp: 700, gold: 550 },
  },
  {
    id: 'sb_05', name: 'Keeper of Light',
    description: 'Luminos guards the temple entrance.',
    enemyMonsterDefs: ['luminos', 'aquapup', 'flameling'],
    enemyLevels: [8, 6, 6],
    rewards: { xp: 900, gold: 700, monsterDefId: 'luminos' },
  },
  {
    id: 'sb_06', name: 'The Iron Fortress',
    description: 'Metal and Earth monsters defend an ancient stronghold.',
    enemyMonsterDefs: ['ironhide', 'ironhide', 'pebblor'],
    enemyLevels: [10, 9, 8],
    rewards: { xp: 1200, gold: 900 },
  },
  {
    id: 'sb_07', name: 'Psychic Storm',
    description: 'A Psychoveil and its allies assault your mind.',
    enemyMonsterDefs: ['psychoveil', 'venomscale', 'shadowfox'],
    enemyLevels: [12, 11, 10],
    rewards: { xp: 1600, gold: 1200 },
  },
  {
    id: 'sb_08', name: 'Glacial Siege',
    description: 'Glaciara leads a frozen army.',
    enemyMonsterDefs: ['glaciara', 'frostpaw', 'aquapup'],
    enemyLevels: [14, 13, 12],
    rewards: { xp: 2000, gold: 1600, monsterDefId: 'glaciara' },
  },
  {
    id: 'sb_09', name: 'Void Rift',
    description: 'Creatures from the void breach your island.',
    enemyMonsterDefs: ['voidspecter', 'shadowfox', 'psychoveil'],
    enemyLevels: [16, 15, 14],
    rewards: { xp: 3000, gold: 2500 },
  },
  {
    id: 'sb_10', name: 'The Awakening',
    description: 'The legendary Timewyrm stands in your way.',
    enemyMonsterDefs: ['timewyrm', 'voidspecter', 'glitchfiend'],
    enemyLevels: [20, 18, 16],
    rewards: { xp: 5000, gold: 4000, monsterDefId: 'timewyrm' },
  },
];

export const LEAGUES = [
  { name: 'Stone',    minTrophies: 0,    color: '#888888' },
  { name: 'Bronze',   minTrophies: 100,  color: '#CD7F32' },
  { name: 'Silver',   minTrophies: 300,  color: '#C0C0C0' },
  { name: 'Gold',     minTrophies: 600,  color: '#FFD700' },
  { name: 'Champion', minTrophies: 1000, color: '#FF44AA' },
];

export const TROPHY_PATH_MILESTONES = [50, 100, 200, 350, 500, 750, 1000];
