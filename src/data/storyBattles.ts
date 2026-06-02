import type { StoryBattle } from '@gtypes/game';

export const STORY_INTRO =
  'Der Riss hat sich geöffnet. Aus ihm kriecht der Glitch – eine Verderbnis, ' +
  'die Monster in rasende Echos verwandelt. Du bist Monsteriums letzte:r Hüter:in. ' +
  'Zähme sie. Gib ihnen ein Zuhause. Halte den Riss zurück.';

// ── Compact helper ─────────────────────────────────────────────────────────────
function b(
  id: string, name: string, desc: string,
  e1: string, e2: string, e3: string,
  l1: number, l2: number, l3: number,
  gold: number, xp: number,
  diamonds?: number, monsterDefId?: string,
): StoryBattle {
  return {
    id, name, description: desc,
    enemyMonsterDefs: [e1, e2, e3],
    enemyLevels: [l1, l2, l3],
    rewards: { gold, xp, diamonds, monsterDefId },
  };
}

// Boss variant: same signature as b(), but flags the fight as a boss (the lead
// enemy e1 is drawn oversized) and turns it into a two-wave gauntlet — a wave of
// guards first, then the boss line-up. The player's HP/energy carry between
// waves, so a boss is a genuine multi-fight endurance test.
function boss(
  id: string, name: string, desc: string,
  e1: string, e2: string, e3: string,
  l1: number, l2: number, l3: number,
  gold: number, xp: number,
  diamonds?: number, monsterDefId?: string,
): StoryBattle {
  return {
    ...b(id, name, desc, e1, e2, e3, l1, l2, l3, gold, xp, diamonds, monsterDefId),
    isBoss: true,
    waves: [
      // Wave 1 — the boss's guards, a notch below full strength.
      { enemyMonsterDefs: [e2, e3, e3], enemyLevels: [Math.max(1, l2 - 2), Math.max(1, l3 - 2), Math.max(1, l3 - 3)] },
      // Wave 2 — the boss itself (e1) flanked by its elite escort.
      { enemyMonsterDefs: [e1, e2, e3], enemyLevels: [l1, l2, l3] },
    ],
  };
}

// ── World definitions ──────────────────────────────────────────────────────────
export interface StoryWorld {
  name: string;
  emoji: string;
  bgFrom: string;
  bgTo: string;
  pathColor: string;
  accent: string;
  first: number;   // index of first battle in STORY_BATTLES
  count: number;   // how many battles belong to this world
}

export const STORY_WORLDS: StoryWorld[] = [
  { name: 'Der erste Riss',   emoji: '🌀', bgFrom: '#1a0533', bgTo: '#330a66', pathColor: '#9955dd', accent: '#cc88ff', first: 0,  count: 13 },
  { name: 'Vulkangipfel',     emoji: '🌋', bgFrom: '#2d0800', bgTo: '#6c1800', pathColor: '#cc4400', accent: '#ff7744', first: 13, count: 12 },
  { name: 'Meerestiefen',     emoji: '🌊', bgFrom: '#001428', bgTo: '#003066', pathColor: '#2266cc', accent: '#55aaff', first: 25, count: 12 },
  { name: 'Kristallhöhlen',   emoji: '💎', bgFrom: '#0a1520', bgTo: '#142a3a', pathColor: '#336699', accent: '#77bbee', first: 37, count: 12 },
  { name: 'Sturmgebirge',     emoji: '⚡', bgFrom: '#0c0c2a', bgTo: '#1a1a55', pathColor: '#5555cc', accent: '#aaaaff', first: 49, count: 12 },
  { name: 'Schattenreich',    emoji: '🌑', bgFrom: '#0a0a16', bgTo: '#1a0a28', pathColor: '#6633aa', accent: '#9966cc', first: 61, count: 12 },
  { name: 'Sonnentempel',     emoji: '☀️', bgFrom: '#1c1200', bgTo: '#3a2600', pathColor: '#cc9900', accent: '#ffdd44', first: 73, count: 12 },
  { name: 'Frostöde',         emoji: '❄️', bgFrom: '#001622', bgTo: '#002e44', pathColor: '#2299bb', accent: '#77ddff', first: 85, count: 12 },
  { name: 'Der Letzte Riss',  emoji: '💀', bgFrom: '#000000', bgTo: '#1a0022', pathColor: '#880088', accent: '#ff88ff', first: 97, count: 12 },
];

// ── STORY BATTLES (100 total) ──────────────────────────────────────────────────

export const STORY_BATTLES: StoryBattle[] = [

  // ── World 1: Der erste Riss (0-11) ────────────────────────────────────────
  b('sb_01','Kapitel 1 — Der erste Riss',
    'Über der Smaragdinsel flackert der Himmel. Drei Flammlinge, vom Glitch berührt, brennen ohne zu erlöschen.',
    'flameling','flameling','pebblor', 1,1,1, 150,200),

  b('sb_02','Kapitel 2 — Die steigende Flut',
    'Die Verderbnis sickert ins Meer. Verzerrte Aquawelpen türmen das Wasser zu einer Wand.',
    'aquapup','aquapup','frostpaw', 3,3,2, 250,350),

  b('sb_03','Kapitel 3 — Statik im Sturm',
    'Auf dem Grat knistert der Glitch wie Strom. Ein junges Voltkit hat überlebt.',
    'voltkit','voltkit','zephyrling', 5,5,4, 400,500, 10,'voltkit'),

  b('sb_04','Kapitel 4 — Schatten im Canyon',
    'Etwas folgt dir durch die Schlucht. Ein Schattenfuchs, halb in einer anderen Dimension.',
    'shadowfox','pebblor','pebblor', 6,5,5, 550,700),

  b('sb_05','Kapitel 5 — Der gefallene Wächter',
    'Luminos bewachte einst den Tempel. Jetzt brennt sein Licht falsch und verkehrt.',
    'luminos','aquapup','flameling', 8,6,6, 700,900, 15,'luminos'),

  b('sb_06','Kapitel 6 — Die Eiserne Bastion',
    'Tausend gefallene Ritter, vereint in Eisenhaut, verteidigen eine uralte Festung.',
    'ironhide','ironhide','pebblor', 10,9,8, 900,1200, 10),

  b('sb_07','Kapitel 7 — Der psychische Sturm',
    'Psychoveil nährt sich von Albträumen — und der Riss schenkt ihm endlos viele.',
    'psychoveil','venomscale','shadowfox', 12,11,10, 1200,1600),

  b('sb_08','Kapitel 8 — Belagerung aus Eis',
    'Ein 10.000 Jahre alter Gletscher erwacht. Glaciara führt eine frostige Armee.',
    'glaciara','frostpaw','aquapup', 14,13,12, 1600,2000, 20,'glaciara'),

  b('sb_09','Kapitel 9 — Der Void-Riss',
    'Der Riss reißt weiter auf. Voidspecter gleiten herein — Wesen, die hier nicht existieren.',
    'voidspecter','shadowfox','psychoveil', 16,15,14, 2500,3000, 25),

  b('sb_10','Kapitel 10 — Das Erwachen',
    'Am Rand der Zeit windet sich Timewyrm. Es hat das Ende deiner Geschichte längst gesehen.',
    'timewyrm','voidspecter','glitchfiend', 20,18,16, 4000,5000, 40,'timewyrm'),

  b('sb_11','Kapitel 11 — Der Glitch im Kern',
    'Du erreichst das Herz des Risses. Glitchfiend ist die Verderbnis selbst, die Bewusstsein erlangt hat.',
    'glitchfiend','voidspecter','timewyrm', 24,22,20, 6000,7500, 50),

  b('sb_12','Kapitel 12 — Das Wesen am Ende',
    'Hinter dem Riss träumt das Universum von sich selbst. Cosmolord war beim ersten Stern dabei.',
    'cosmolord','glitchfiend','timewyrm', 30,26,24, 10000,12000, 100,'cosmolord'),

  // ── World 1 BOSS: Der Eiserne Koloss (physical) ──────────────────────────
  boss('sb_b1','Stage-Boss — Der Eiserne Koloss',
    'Der Riss spuckt einen Kriegstitan aus, der seit Anbeginn der Zeit kämpft. Kein Echo, kein Glitch — nur rohe, brachiale Gewalt aus Eisen und Stein.',
    'ironbreaker','ironhide','pebblor', 32,30,28, 12000,13000, 80,'ironbreaker'),

  // ── World 2: Vulkangipfel (13-24) ─────────────────────────────────────────
  b('sb_13','Lavawall-Wächter',
    'Blazecroc läuft Amok im Lavastrom. Das Feuer gehorcht nur ihm.',
    'blazecroc','ironhide','flameling', 28,26,24, 5500,2200),

  b('sb_14','Aschepfad',
    'Der Glitch verwandelt Asche in Tentakel, die nach dir greifen.',
    'blazecroc','blazecroc','pebblor', 30,29,27, 7000,2800, 20),

  b('sb_15','Feuermaul-Dämon',
    'Ein Blazecroc mit drei Mäulern — geboren im Riss selbst.',
    'blazecroc','angelfire','flameling', 32,30,28, 9000,3600),

  b('sb_16','Die brennende Kaserne',
    'Hundert Eisenhäute, verschmolzen vom Glitch zu einem Wesen.',
    'angelfire','blazecroc','ironhide', 34,32,30, 11000,4500, 25),

  b('sb_17','Schmiedegeister',
    'Die alten Schmiedegeister der Vulkaninsel wachen über ihr Feuer.',
    'ironhide','ironhide','blazecroc', 36,35,33, 13000,5500),

  b('sb_18','Vulkansturm',
    'Der Gipfel explodiert. Angelfire reitet die Schockwelle.',
    'angelfire','angelfire','blazecroc', 38,37,35, 15000,7000, 30),

  b('sb_19','Titan aus Feuer',
    'Timewyrm hat Zeit selbst gefressen, um hier zu erscheinen.',
    'timewyrm','angelfire','blazecroc', 40,38,36, 17500,8500, 40),

  b('sb_20','Der Gipfel brennt',
    'Kein Ausweg. Du kämpfst oder du fällst vom Gipfel.',
    'timewyrm','angelfire','angelfire', 42,41,40, 20000,10000, 50),

  b('sb_21','Magma-Thron',
    'Hinter dem Krater schläft etwas Uraltes. Es schläft nicht mehr.',
    'timewyrm','timewyrm','angelfire', 44,43,42, 22000,11500, 55),

  b('sb_22','Vulkanfürst',
    'Der Glitch hat den Vulkan selbst belebt. Cosmolord leitet das Feuer.',
    'cosmolord','timewyrm','angelfire', 46,45,44, 25000,13000, 60),

  b('sb_23','Aschentitan',
    'Alles brennt. Nur wer das Feuer zähmt, überlebt.',
    'cosmolord','cosmolord','timewyrm', 48,47,46, 28000,14500, 65),

  // ── World 2 BOSS: Der Lavachampion (physical) ────────────────────────────
  boss('sb_b2','Stage-Boss — Der Lavachampion',
    'Aus dem Krater steigt ein Faustkämpfer aus geschmolzenem Gestein. Er trägt keine Magie in sich — nur Muskeln, Feuer und einen Kinnhaken, der Felsen spaltet.',
    'blazechamp','ironchamp','blazecroc', 50,48,46, 32000,16000, 70,'blazechamp'),

  // ── World 3: Meerestiefen (25-36) ─────────────────────────────────────────
  b('sb_24','Gezeitenbruch',
    'Die Verderbnis sickert in die Tiefsee. Aquawelpen türmen Tsunamis.',
    'aquapup','aquapup','frostpaw', 45,44,43, 22000,10000),

  b('sb_25','Eisige Strömung',
    'Glaciara führt ein Eisheer durch gestohlene Meeresströmungen.',
    'glaciara','frostpaw','aquapup', 47,46,45, 27000,12000, 35),

  b('sb_26','Korallengeist',
    'Verrottete Korallen tanzen. Der Glitch macht Totes lebendig.',
    'glaciara','glaciara','aquapup', 49,48,47, 32000,14000),

  b('sb_27','Tiefenhorror',
    'Voidspecter taucht aus dem Abgrund. Es kann überall sein.',
    'voidspecter','aquapup','glaciara', 51,49,48, 37000,16000, 45),

  b('sb_28','Strudel des Vergessens',
    'Ein Strudel, der nicht Wasser, sondern Zeit verschluckt.',
    'glaciara','voidspecter','stormbeak', 52,51,50, 42000,18000),

  b('sb_29','Sturm über dem Abgrund',
    'Stormbeak teilt den Ozean. Blitz und Wasser verbünden sich.',
    'stormbeak','stormbeak','glaciara', 53,52,51, 47000,20000, 55),

  b('sb_30','Meeresdrache',
    'Timewyrm schwingt sich aus der Tiefe. Es ist uralt und hungrig.',
    'timewyrm','glaciara','voidspecter', 54,53,52, 52000,22000),

  b('sb_31','Der schlafende Leviathan',
    'Zwei Timewyrms — eine Seele, durch den Riss gespalten.',
    'timewyrm','timewyrm','glaciara', 55,54,53, 57000,24000, 65),

  b('sb_32','Abgrundgeist',
    'Doppelter Voidspecter. Die Realität bricht unter dem Druck zusammen.',
    'voidspecter','voidspecter','timewyrm', 56,55,54, 62000,26000),

  b('sb_33','Tiefsee-Thron',
    'Der Glitch hat einen Thron aus Knochen im Ozean gebaut. Du zerstörst ihn.',
    'timewyrm','voidspecter','glaciara', 58,57,56, 68000,29000, 80),

  b('sb_34','Meeresgott',
    'Cosmolord regiert die Tiefe. Kein Licht kommt hier an — außer deinem.',
    'cosmolord','timewyrm','voidspecter', 60,59,58, 75000,32000, 85,'stormbeak'),

  // ── World 3 BOSS: Der Tiefendruck-Koloss (physical) ──────────────────────
  boss('sb_b3','Stage-Boss — Der Tiefendruck-Koloss',
    'Im lichtlosen Abgrund wuchs ein Golem aus Eis und Stein, geformt vom Druck der ganzen See. Er bewegt sich langsam — aber jeder Schlag zermalmt wie eine Tiefseegrube.',
    'icegolem','voidtitan','glaciara', 62,60,58, 85000,36000, 95,'icegolem'),

  // ── World 4: Kristallhöhlen (37-48) ───────────────────────────────────────
  b('sb_35','Erster Kristall',
    'Tief in der Erde funkeln Kristalle — und blinzeln zurück.',
    'crystaldrake','ironhide','pebblor', 58,57,56, 72000,31000),

  b('sb_36','Kristallsturm',
    'Der Glitch macht aus Kristall Waffen. Zwei Kristalldrachen greifen an.',
    'crystaldrake','crystaldrake','ironhide', 60,59,58, 79000,34000, 60),

  b('sb_37','Metallseele',
    'Ironhide wurde zur lebenden Festung. Kein Angriff dringt durch.',
    'ironhide','crystaldrake','voidspecter', 61,60,59, 86000,37000),

  b('sb_38','Saphirabgrund',
    'Voidspecter und Kristalldrachen — eine unheilige Allianz.',
    'voidspecter','crystaldrake','crystaldrake', 62,61,60, 93000,40000, 70,'crystaldrake'),

  b('sb_39','Geisterkristall',
    'Glitchfiend hat sich in den Kristall eingeschlossen. Brich es frei.',
    'glitchfiend','glitchfiend','crystaldrake', 63,62,61, 100000,43000),

  b('sb_40','Die Fundgrube',
    'Unter der Fundgrube liegt die Wurzel des Glitch. Du gehst hinunter.',
    'voidspecter','glitchfiend','crystaldrake', 64,63,62, 107000,46000, 80),

  b('sb_41','Metallgott',
    'Cosmolord schmiedet sich eine Rüstung aus reinem Kristall.',
    'cosmolord','crystaldrake','glitchfiend', 65,64,63, 115000,50000),

  b('sb_42','Tiefstollen-Schrecken',
    'Zwei Glitchfiends tanzen im Dunkel. Der Kristall gibt ihnen Form.',
    'cosmolord','glitchfiend','glitchfiend', 66,65,64, 123000,54000, 90),

  b('sb_43','Kristall-Seele',
    'Der Kristall selbst beginnt zu denken. Timewyrm lenkt seine Gedanken.',
    'cosmolord','glitchfiend','timewyrm', 67,66,65, 131000,58000),

  b('sb_44','Der lebende Stein',
    'Uralte Gesteinsformationen erwachen. Der Glitch hat sie geduldig gewartet.',
    'cosmolord','cosmolord','glitchfiend', 69,68,67, 140000,62000, 100),

  b('sb_45','Kristallthron',
    'Auf dem Kristallthron sitzt das Echo aller Welten. Es erkennt dich.',
    'cosmolord','timewyrm','glitchfiend', 71,70,69, 150000,66000, 110),

  // ── World 4 BOSS: Terraemperor, der lebende Berg (physical) ──────────────
  boss('sb_b4','Stage-Boss — Der lebende Berg',
    'Die Kristallhöhle war nie eine Höhle. Sie war sein Rücken. Terraemperor erwacht, und der ganze Stollen ist sein Körper — eine wandelnde Gebirgskette aus Erz und Kristall.',
    'terraemperor','crystaldrake','marbleguard', 73,71,69, 165000,72000, 120,'terraemperor'),

  // ── World 5: Sturmgebirge (49-60) ─────────────────────────────────────────
  b('sb_46','Blitzsturm',
    'Stormbeak formiert einen Schwarm. Die Luft selbst knistert gefährlich.',
    'stormbeak','stormbeak','voltkit', 68,67,66, 148000,65000),

  b('sb_47','Donnervogel',
    'Ein einzelner Donnervogel, dreimal so groß wie normal — Glitch-Mutation.',
    'stormbeak','glitchfiend','voltkit', 70,69,68, 157000,69000, 80,'stormbeak'),

  b('sb_48','Windbarrikade',
    'Zephyrlinge blockieren jeden Aufstieg. Die Bergluft gehört ihnen.',
    'zephyrling','zephyrling','stormbeak', 71,70,69, 166000,73000),

  b('sb_49','Superzelle',
    'Der Glitch hat eine ewige Gewitterzelle erschaffen. Stormbeak ist ihr Kern.',
    'stormbeak','glitchfiend','glitchfiend', 72,71,70, 176000,77000, 90),

  b('sb_50','Elektrogeist',
    'Timewyrm hat sich in Blitz verwandelt. Es trifft überall gleichzeitig.',
    'timewyrm','stormbeak','glitchfiend', 73,72,71, 186000,81000),

  b('sb_51','Das Auge des Sturms',
    'Im Zentrum der Superzelle wartet Cosmolord. Kein Lärm, nur Tod.',
    'cosmolord','timewyrm','stormbeak', 74,73,72, 196000,86000, 100),

  b('sb_52','Blitzgipfel',
    'Der Gipfel ist eine einzige Entladung. Glitchfiend kanalisiert sie.',
    'glitchfiend','cosmolord','timewyrm', 75,74,73, 207000,91000),

  b('sb_53','Sturmkönig',
    'Zwei Cosmolords, getrennt durch den Riss, vereint im Sturm.',
    'cosmolord','cosmolord','glitchfiend', 76,75,74, 218000,96000, 115),

  b('sb_54','Endloser Sturm',
    'Der Sturm hört nie auf. Timewyrm hält die Zeit im Blitz gefangen.',
    'timewyrm','cosmolord','cosmolord', 77,76,75, 230000,101000),

  b('sb_55','Der Donnerthron',
    'Auf dem Gipfel sitzt ein Thron aus Blitz. Du nimmst ihn ein.',
    'cosmolord','glitchfiend','timewyrm', 79,78,77, 242000,107000, 130),

  b('sb_56','Sturmgott',
    'Der Glitch hat ein Sturmwesen geformt, das Kontinente verschieben kann.',
    'cosmolord','cosmolord','timewyrm', 81,80,79, 255000,113000, 140),

  // ── World 5 BOSS: Der Metallkönig (physical) ─────────────────────────────
  boss('sb_b5','Stage-Boss — Der Metallkönig',
    'Auf dem höchsten Grat steht ein Titan, geschmiedet aus jedem Erz des Gebirges. Der Sturm prallt an ihm ab. Metalking hat noch nie ein Duell verloren — und will, dass es so bleibt.',
    'metalking','ironbreaker','ironchamp', 83,81,79, 280000,124000, 150,'metalking'),

  // ── World 6: Schattenreich (61-72) ────────────────────────────────────────
  b('sb_57','Dunkelheit erwacht',
    'Das Schattenreich öffnet sich. Shadowfox ist der erste, der dich begrüßt.',
    'shadowfox','shadowfox','venomscale', 78,77,76, 252000,110000),

  b('sb_58','Seelenfresser',
    'Voidspecter saugt Seelen. Im Schattenreich gibt es viele.',
    'voidspecter','shadowfox','glitchfiend', 79,78,77, 265000,116000, 100),

  b('sb_59','Schwarze Stille',
    'Zwei Voidspecter schaffen eine Zone des absoluten Schweigens.',
    'voidspecter','voidspecter','shadowfox', 80,79,78, 279000,122000),

  b('sb_60','Giftschatten',
    'Venomscale infiziert den Schatten selbst. Alles, was du berührst, vergiftet dich.',
    'venomscale','voidspecter','glitchfiend', 81,80,79, 293000,128000, 115),

  b('sb_61','Schattengott',
    'Glitchfiend und Cosmolord haben das Schattenreich unter sich aufgeteilt.',
    'glitchfiend','cosmolord','voidspecter', 82,81,80, 308000,134000),

  b('sb_62','Schwarze Sonne',
    'Eine Sonne, die Licht verschluckt. Cosmolord thront in ihrer Mitte.',
    'cosmolord','glitchfiend','glitchfiend', 83,82,81, 323000,141000, 130),

  b('sb_63','Nekromassive',
    'Cosmolord hat tote Sterne gesammelt. Timewyrm formt sie zu Waffen.',
    'cosmolord','cosmolord','timewyrm', 84,83,82, 339000,148000),

  b('sb_64','Shadowlord-Erweckung',
    'Timewyrm, Cosmolord, Glitchfiend — das Schattenreich hat eine Dreifaltigkeit.',
    'timewyrm','cosmolord','glitchfiend', 85,84,83, 355000,155000, 145),

  b('sb_65','Der tote Stern',
    'Timewyrm und zwei Cosmolords — das Universum selbst weint.',
    'timewyrm','cosmolord','cosmolord', 86,85,84, 372000,162000),

  b('sb_66','Grenze der Finsternis',
    'Drei Cosmolords am Ende des Schattenreichs. Du gehst durch sie durch.',
    'cosmolord','cosmolord','cosmolord', 87,87,86, 390000,170000, 165),

  b('sb_67','Schattenfürst',
    'Der Fürst des Schattenreichs ist erwacht. Er hat keine Form mehr.',
    'cosmolord','timewyrm','glitchfiend', 89,88,87, 410000,178000, 175),

  // ── World 6 BOSS: Der Leerkoloss (physical) ──────────────────────────────
  boss('sb_b6','Stage-Boss — Der Leerkoloss',
    'Drei Kräfte, die sich auslöschen sollten — Erde, Stahl und Leere — taten es nicht. Voidgiant stapft durch das Schattenreich, und der Boden, den er berührt, zerfällt zu nichts.',
    'voidgiant','voidtitan','ironbreaker', 90,89,88, 450000,196000, 190,'voidgiant'),

  // ── World 7: Sonnentempel (73-84) ─────────────────────────────────────────
  b('sb_68','Goldenes Tor',
    'Das goldene Tor des Tempels ist versiegelt. Luminos bewacht es.',
    'luminos','luminos','angelfire', 86,85,84, 405000,176000),

  b('sb_69','Lichtwächter',
    'Angelfire führt die Lichtwächter. Der Glitch hat ihr Licht umgekehrt.',
    'angelfire','luminos','cosmolord', 87,86,85, 423000,184000, 130),

  b('sb_70','Strahlende Aura',
    'Zwei Angelfires entfalten eine Aura, die alles versengt.',
    'angelfire','angelfire','cosmolord', 88,87,86, 441000,192000),

  b('sb_71','Himmelssturm',
    'Cosmolord und Angelfire vereinen Licht und Kosmos zu einem einzigen Sturm.',
    'cosmolord','angelfire','timewyrm', 89,88,87, 460000,200000, 145),

  b('sb_72','Das erste Licht',
    'Timewyrm zeigt dir den Ursprung des Lichts — und das, was davor kam.',
    'timewyrm','cosmolord','angelfire', 90,89,88, 480000,209000),

  b('sb_73','Sonnenschild',
    'Zwei Cosmolords formen einen Schild aus reinem Sternenlicht.',
    'cosmolord','cosmolord','angelfire', 91,91,90, 500000,218000, 160),

  b('sb_74','Heiliger Sturm',
    'Der Glitch hat das Heilige korrumpiert. Cosmolord ist sein Werkzeug.',
    'cosmolord','timewyrm','glitchfiend', 92,91,91, 521000,227000),

  b('sb_75','Tempel des Kosmos',
    'Timewyrm und zwei Cosmolords halten den Tempel für den Glitch.',
    'timewyrm','cosmolord','cosmolord', 93,92,92, 543000,237000, 175),

  b('sb_76','Göttlicher Riss',
    'Der Riss zieht sich durch den Sonnentempel selbst. Drei Cosmolords bewachen ihn.',
    'cosmolord','cosmolord','cosmolord', 93,93,92, 566000,247000),

  b('sb_77','Die letzte Prüfung',
    'Cosmolord, Timewyrm, Glitchfiend — die letzte Prüfung des Sonnentempels.',
    'cosmolord','timewyrm','glitchfiend', 94,93,93, 590000,258000, 190),

  b('sb_78','Sonnenthron',
    'Auf dem Sonnenthron sitzt das Licht selbst — und es ist böse geworden.',
    'cosmolord','cosmolord','timewyrm', 95,94,94, 615000,269000, 200),

  // ── World 7 BOSS: Der Heilige Champion (physical) ────────────────────────
  boss('sb_b7','Stage-Boss — Der Heilige Champion',
    'Der Tempelhüter braucht keine Strahlen oder Sprüche. Holychampion segnet seine Fäuste mit dem Licht jedes Ordens und schlägt zu, bis selbst Dämonen es sich anders überlegen.',
    'holychampion','terraangel','metalangel', 96,95,94, 660000,290000, 215,'holychampion'),

  // ── World 8: Frostöde (85-96) ─────────────────────────────────────────────
  b('sb_79','Gefrorene Zeit',
    'Timewyrm hat die Zeit im Eis eingeschlossen. Alles steht still.',
    'glaciara','glaciara','timewyrm', 92,92,91, 608000,265000),

  b('sb_80','Eisige Dunkelheit',
    'Glitchfiend und Glaciara teilen die Frostöde auf.',
    'timewyrm','glitchfiend','glaciara', 93,92,92, 632000,276000, 160),

  b('sb_81','Blizzardgeist',
    'Glitchfiend reitet einen Blizzard, der nie enden wird.',
    'glitchfiend','glaciara','voidspecter', 94,93,93, 657000,287000),

  b('sb_82','Tundra-Alptraum',
    'Voidspecter und Timewyrm frieren deine Gedanken. Du kämpfst blind.',
    'voidspecter','timewyrm','glaciara', 95,94,94, 683000,298000, 175),

  b('sb_83','Weißer Abgrund',
    'Ein unendlich weißes Nichts. In seiner Mitte: Cosmolord.',
    'timewyrm','cosmolord','glaciara', 95,95,94, 710000,310000),

  b('sb_84','Ewiges Eis',
    'Cosmolord, Timewyrm, Glitchfiend — das Eis friert sie nie ein.',
    'cosmolord','timewyrm','glitchfiend', 96,95,95, 738000,322000, 190),

  b('sb_85','Frostseele',
    'Zwei Glitchfiends haben ihre Seelen im Eis konserviert.',
    'glitchfiend','glitchfiend','cosmolord', 97,96,96, 767000,335000),

  b('sb_86','Polarnacht',
    'Zwei Cosmolords und Timewyrm — die Polarnacht dauert tausend Jahre.',
    'cosmolord','cosmolord','timewyrm', 97,97,96, 797000,348000, 210),

  b('sb_87','Eiszeit',
    'Cosmolord, Glitchfiend, Timewyrm. Die Eiszeit beginnt.',
    'cosmolord','glitchfiend','timewyrm', 98,97,97, 828000,362000),

  b('sb_88','Tundraboss',
    'Drei Cosmolords. Die Frostöde gehört ihnen — noch.',
    'cosmolord','cosmolord','cosmolord', 98,98,97, 860000,376000, 230),

  b('sb_89','Endloser Winter',
    'Das Eis schmilzt nie. Timewyrm und Cosmolords halten die Kälte.',
    'timewyrm','cosmolord','cosmolord', 99,98,98, 894000,391000, 245),

  // ── World 8 BOSS: Der Eiserne Souverän (physical) ────────────────────────
  boss('sb_b8','Stage-Boss — Der Eiserne Souverän',
    'Tief in der Frostöde wartet der Souverän aller physischen Kraft. Ironsovereign hielt einst einen Meteor mit der Handfläche auf — aus Verärgerung. Das Eis bricht an seiner Rüstung.',
    'ironsovereign','icegolem','voidgiant', 100,99,98, 960000,420000, 270,'ironsovereign'),

  // ── World 9: Der Letzte Riss (97-108) ─────────────────────────────────────
  b('sb_90','Die Schwelle',
    'Du stehst vor dem Letzten Riss. Cosmolord, Timewyrm, Glitchfiend. Kein Zurück.',
    'cosmolord','timewyrm','glitchfiend', 99,99,98, 930000,407000),

  b('sb_91','Jenseits der Zeit',
    'Zwei Timewyrms aus zwei Zeitlinien. Der Riss hat sie zusammengeführt.',
    'timewyrm','timewyrm','cosmolord', 100,99,99, 967000,423000, 250),

  b('sb_92','Letzte Bastion',
    'Zwei Cosmolords halten die letzte Mauer des Universums.',
    'cosmolord','cosmolord','glitchfiend', 100,100,99, 1005000,440000),

  b('sb_93','Ewige Verderbnis',
    'Zwei Glitchfiends — die Verderbnis hat sich selbst geklont.',
    'glitchfiend','glitchfiend','cosmolord', 100,100,99, 1044000,457000, 275),

  b('sb_94','Das Omnikollektiv',
    'Cosmolord, Glitchfiend, Timewyrm. Drei Gottheiten, ein Wille.',
    'cosmolord','glitchfiend','timewyrm', 100,100,100, 1085000,475000),

  b('sb_95','Universumbruch',
    'Drei Cosmolords. Das Universum bricht. Du hältst es zusammen.',
    'cosmolord','cosmolord','cosmolord', 100,100,100, 1127000,493000, 300),

  b('sb_96','Der Erste und der Letzte',
    'Timewyrm war beim ersten Moment dabei und wird beim letzten dabei sein.',
    'timewyrm','cosmolord','cosmolord', 100,100,100, 1170000,512000),

  b('sb_97','Riss ohne Ende',
    'Glitchfiend, Cosmolord, Timewyrm. Der Riss hat kein Ende. Aber du gibst ihm eines.',
    'glitchfiend','cosmolord','timewyrm', 100,100,100, 1215000,532000, 350),

  b('sb_98','Schweigen vor dem Sturm',
    'Zwei Cosmolords im absoluten Schweigen. Dann brichst du es.',
    'cosmolord','cosmolord','glitchfiend', 100,100,100, 1261000,552000),

  b('sb_99','Das Erwachen 2.0',
    'Der Riss öffnet sich vollständig. Drei Cosmolords stehen dahinter. Du gehst hindurch.',
    'cosmolord','cosmolord','glitchfiend', 100,100,100, 1309000,573000, 400),

  b('sb_100','MONSTERIUM: DAS LETZTE KAPITEL',
    'Jenseits des Risses liegt Stille. Drei Cosmolords. Das Schicksal Monsteriums liegt in deinen Händen.',
    'cosmolord','cosmolord','cosmolord', 100,100,100, 2000000,1000000, 500),

  // ── World 9 BOSS: URKRAFT — Allmight (physical, final) ────────────────────
  boss('sb_b9','Stage-Boss — URKRAFT',
    'Jenseits aller Echos und jeden Glitches steht das erste Monster, das je existierte: die Vereinigung von Erde, Feuer und Meer. Allmight braucht keine Magie. Es IST die rohe Kraft, aus der alles entstand — und es will sehen, ob du würdig bist.',
    'allmight','worldshatter','ironsovereign', 100,100,100, 2500000,1250000, 600,'allmight'),
];

export const LEAGUES = [
  { name: 'Stone',    minTrophies: 0,    color: '#888888' },
  { name: 'Bronze',   minTrophies: 100,  color: '#CD7F32' },
  { name: 'Silver',   minTrophies: 300,  color: '#C0C0C0' },
  { name: 'Gold',     minTrophies: 600,  color: '#FFD700' },
  { name: 'Champion', minTrophies: 1000, color: '#FF44AA' },
];

export const TROPHY_PATH_MILESTONES = [50, 100, 200, 350, 500, 750, 1000];
