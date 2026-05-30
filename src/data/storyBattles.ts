import type { StoryBattle } from '@gtypes/game';

// ── MONSTERIUM: Der Riss ──────────────────────────────────────────────────
// Ein erzählerischer Kampagnenbogen im Geiste düsterer "Warden"-Geschichten:
// Ein Riss hat sich zwischen den Welten geöffnet, und eine kriechende
// Verderbnis – der Glitch – verwandelt friedliche Monster in rasende Echos
// ihrer selbst. Du bist der/die letzte HÜTER:IN von Monsterium. Du sperrst
// die Verderbten nicht weg – du zähmst sie, baust ihnen einen Lebensraum und
// stellst sie zwischen die Welt und das, was am Ende des Risses wartet.

export const STORY_INTRO =
  'Der Riss hat sich geöffnet. Aus ihm kriecht der Glitch – eine Verderbnis, ' +
  'die Monster in rasende Echos verwandelt. Du bist Monsteriums letzte:r Hüter:in. ' +
  'Zähme sie. Gib ihnen ein Zuhause. Halte den Riss zurück.';

export const STORY_BATTLES: StoryBattle[] = [
  {
    id: 'sb_01', name: 'Kapitel 1 — Der erste Riss',
    description: 'Über der Smaragdinsel flackert der Himmel. Drei Flammlinge, vom ' +
      'Glitch berührt, brennen ohne zu erlöschen. Bring sie zur Ruhe — oder zähme sie.',
    enemyMonsterDefs: ['flameling', 'flameling', 'pebblor'],
    enemyLevels: [1, 1, 1],
    rewards: { xp: 200, gold: 150 },
  },
  {
    id: 'sb_02', name: 'Kapitel 2 — Die steigende Flut',
    description: 'Die Verderbnis sickert ins Meer. Verzerrte Aquawelpen türmen das ' +
      'Wasser zu einer Wand auf, die den Weg zur nächsten Insel versperrt.',
    enemyMonsterDefs: ['aquapup', 'aquapup', 'frostpaw'],
    enemyLevels: [3, 3, 2],
    rewards: { xp: 350, gold: 250 },
  },
  {
    id: 'sb_03', name: 'Kapitel 3 — Statik im Sturm',
    description: 'Auf dem Grat knistert der Glitch wie Strom. Ein junges Voltkit ' +
      'hat überlebt — wenn du es rettest, kämpft es an deiner Seite.',
    enemyMonsterDefs: ['voltkit', 'voltkit', 'zephyrling'],
    enemyLevels: [5, 5, 4],
    rewards: { xp: 500, gold: 400, monsterDefId: 'voltkit' },
  },
  {
    id: 'sb_04', name: 'Kapitel 4 — Schatten im Canyon',
    description: 'Etwas folgt dir durch die Schlucht. Ein Schattenfuchs, halb in ' +
      'einer anderen Dimension — und der Glitch zerrt ihn ganz hinüber.',
    enemyMonsterDefs: ['shadowfox', 'pebblor', 'pebblor'],
    enemyLevels: [6, 5, 5],
    rewards: { xp: 700, gold: 550 },
  },
  {
    id: 'sb_05', name: 'Kapitel 5 — Der gefallene Wächter',
    description: 'Luminos bewachte einst den Tempel. Jetzt brennt sein Licht falsch ' +
      'und verkehrt. Befreie ihn von der Verderbnis und sein Glanz gehört dir.',
    enemyMonsterDefs: ['luminos', 'aquapup', 'flameling'],
    enemyLevels: [8, 6, 6],
    rewards: { xp: 900, gold: 700, monsterDefId: 'luminos' },
  },
  {
    id: 'sb_06', name: 'Kapitel 6 — Die Eiserne Bastion',
    description: 'Tausend gefallene Ritter, vereint in Eisenhaut, verteidigen eine ' +
      'uralte Festung. Der Glitch hat ihren Schwur in blinde Wut verkehrt.',
    enemyMonsterDefs: ['ironhide', 'ironhide', 'pebblor'],
    enemyLevels: [10, 9, 8],
    rewards: { xp: 1200, gold: 900 },
  },
  {
    id: 'sb_07', name: 'Kapitel 7 — Der psychische Sturm',
    description: 'Psychoveil nährt sich von Albträumen — und der Riss schenkt ihm ' +
      'endlos viele. Es greift nicht deine Monster an, sondern deinen Verstand.',
    enemyMonsterDefs: ['psychoveil', 'venomscale', 'shadowfox'],
    enemyLevels: [12, 11, 10],
    rewards: { xp: 1600, gold: 1200 },
  },
  {
    id: 'sb_08', name: 'Kapitel 8 — Belagerung aus Eis',
    description: 'Ein 10.000 Jahre alter Gletscher erwacht. Glaciara führt eine ' +
      'frostige Armee — zähme ihre Königin und der Winter dient dir.',
    enemyMonsterDefs: ['glaciara', 'frostpaw', 'aquapup'],
    enemyLevels: [14, 13, 12],
    rewards: { xp: 2000, gold: 1600, monsterDefId: 'glaciara' },
  },
  {
    id: 'sb_09', name: 'Kapitel 9 — Der Void-Riss',
    description: 'Der Riss reißt weiter auf. Voidspecter gleiten herein — Wesen, ' +
      'die in dieser Dimension gar nicht existieren. Du siehst sie nur, weil du es glaubst.',
    enemyMonsterDefs: ['voidspecter', 'shadowfox', 'psychoveil'],
    enemyLevels: [16, 15, 14],
    rewards: { xp: 3000, gold: 2500 },
  },
  {
    id: 'sb_10', name: 'Kapitel 10 — Das Erwachen',
    description: 'Am Rand der Zeit windet sich Timewyrm. Es hat das Ende deiner ' +
      'Geschichte längst gesehen — und schweigt. Zwing es, dir seine Macht zu leihen.',
    enemyMonsterDefs: ['timewyrm', 'voidspecter', 'glitchfiend'],
    enemyLevels: [20, 18, 16],
    rewards: { xp: 5000, gold: 4000, monsterDefId: 'timewyrm' },
  },
  {
    id: 'sb_11', name: 'Kapitel 11 — Der Glitch im Kern',
    description: 'Du erreichst das Herz des Risses. Glitchfiend ist keine Kreatur — ' +
      'es ist die Verderbnis selbst, die Bewusstsein erlangt hat. Dein Blick gleitet von ihm ab.',
    enemyMonsterDefs: ['glitchfiend', 'voidspecter', 'timewyrm'],
    enemyLevels: [24, 22, 20],
    rewards: { xp: 7500, gold: 6000 },
  },
  {
    id: 'sb_12', name: 'Kapitel 12 — Das Wesen am Ende',
    description: 'Hinter dem Riss träumt das Universum von sich selbst. Cosmolord war ' +
      'beim ersten Stern dabei und wird beim letzten dabei sein. Es hat dich gewählt — ' +
      'warum, weiß niemand. Bestehe, und Monsterium gehört wieder dir.',
    enemyMonsterDefs: ['cosmolord', 'glitchfiend', 'timewyrm'],
    enemyLevels: [30, 26, 24],
    rewards: { xp: 12000, gold: 10000, monsterDefId: 'cosmolord' },
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
