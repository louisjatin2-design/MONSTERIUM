// ---------------------------------------------------------------------------
// MONSTERIUM low-poly 3D GALLERY (PROOF OF CONCEPT)
//
// One page, several views (?view=):
//   world     — a populated Emerald Isle: island + buildings + roaming monsters
//   monsters  — every monster in the game, in a grid
//   buildings — one of every building type
//   islands   — all island silhouettes side by side
// Everything is generated in code from the game's own data.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ELEMENT_COLORS } from '@data/elements';
import { RARITY_COLORS, RARITY_RANK } from '@data/rarities';
import { MONSTER_DEFS } from '@data/monsters';
import { BUILDING_DEFS } from '@data/buildings';
import { ISLAND_DEFS } from '@data/islands';
import { buildLowPolyMonster, countTriangles, type MonsterVisualSpec } from './lowpolyMonster';
import { buildLowPolyBuilding } from './lowpolyBuilding';
import { buildLowPolyIsland, gridToWorld, islandGrid, TOP_Y } from './lowpolyIsland';

const view = new URLSearchParams(location.search).get('view') ?? 'world';

const app = document.getElementById('app')!;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x141033);
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 500);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x402a55, 0.95));
const key = new THREE.DirectionalLight(0xffffff, 1.5);
key.position.set(12, 22, 14);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
const sc = key.shadow.camera as THREE.OrthographicCamera;
sc.near = 1; sc.far = 120; sc.left = -30; sc.right = 30; sc.top = 30; sc.bottom = -30;
scene.add(key);

function monsterSpec(id: string): MonsterVisualSpec {
  const def = MONSTER_DEFS[id];
  const el = def.elements[0];
  return {
    id, element: el,
    elementColor: (ELEMENT_COLORS as Record<string, number>)[el] ?? 0x888888,
    accentColor: parseInt(RARITY_COLORS[def.rarity].replace('#', ''), 16),
    rarityRank: RARITY_RANK[def.rarity],
  };
}

let totalTris = 0;
let info = '';
const monsterAnims: THREE.Group[] = [];

// ---------------------------------------------------------------------------
function buildWorld() {
  const def = ISLAND_DEFS.emerald_isle;
  const grid = islandGrid(def);
  const island = buildLowPolyIsland(def);
  totalTris += countTriangles(island);
  scene.add(island);

  // A sample build layout on free tiles.
  const layout: { id: string; x: number; y: number }[] = [
    { id: 'habitat_fire', x: 5, y: 4 },
    { id: 'habitat_water', x: 8, y: 4 },
    { id: 'habitat_plant', x: 11, y: 4 },
    { id: 'temple_fire', x: 5, y: 7 },
    { id: 'hatchery', x: 9, y: 8 },
    { id: 'breeding_station', x: 11, y: 7 },
    { id: 'farm_basic', x: 6, y: 10 },
  ];
  for (const b of layout) {
    const bdef = BUILDING_DEFS[b.id]; if (!bdef) continue;
    const grp = buildLowPolyBuilding(bdef);
    const w = gridToWorld(b.x + bdef.tilesW / 2, b.y + bdef.tilesH / 2, grid);
    grp.position.set(w.x, TOP_Y, w.z);
    totalTris += countTriangles(grp);
    scene.add(grp);
  }

  // A few monsters roaming the grass.
  const roam = ['flameling', 'aquapup', 'voltkit', 'frostpaw', 'pebblor', 'zephyrling'];
  const spots = [[7, 6], [10, 6], [8, 10], [12, 9], [6, 8], [13, 5]];
  roam.forEach((id, i) => {
    if (!MONSTER_DEFS[id]) return;
    const m = buildLowPolyMonster(monsterSpec(id));
    m.scale.setScalar(0.42);
    const w = gridToWorld(spots[i][0] + 0.5, spots[i][1] + 0.5, grid);
    m.position.set(w.x, TOP_Y, w.z);
    totalTris += countTriangles(m);
    monsterAnims.push(m); scene.add(m);
  });

  camera.position.set(0, 14, 20);
  controls.target.set(0, 0, 0);
  info = `Emerald Isle · ${layout.length} buildings · ${roam.length} monsters`;
}

// ---------------------------------------------------------------------------
function buildGrid(items: THREE.Group[], cols: number, gap: number, y: number) {
  const rows = Math.ceil(items.length / cols);
  items.forEach((it, i) => {
    const c = i % cols, r = Math.floor(i / cols);
    it.position.set((c - (cols - 1) / 2) * gap, y, (r - (rows - 1) / 2) * gap);
    scene.add(it);
  });
  return { rows, cols };
}

function buildMonsters() {
  const ids = Object.keys(MONSTER_DEFS);
  const groups = ids.map((id) => {
    const m = buildLowPolyMonster(monsterSpec(id));
    totalTris += countTriangles(m);
    monsterAnims.push(m);
    return m;
  });
  const cols = 18;
  const { rows } = buildGrid(groups, cols, 3, 0);
  const span = Math.max(cols, rows) * 3;
  camera.position.set(0, span * 0.7, span * 0.9);
  controls.target.set(0, 1, 0);
  info = `${ids.length} monsters — every species, generated from data`;
}

function buildBuildings() {
  const ids = Object.keys(BUILDING_DEFS);
  const groups = ids.map((id) => {
    const g = buildLowPolyBuilding(BUILDING_DEFS[id]);
    totalTris += countTriangles(g);
    return g;
  });
  const cols = 7;
  const { rows } = buildGrid(groups, cols, 5, 0);
  const span = Math.max(cols, rows) * 5;
  camera.position.set(0, span * 0.6, span * 0.85);
  controls.target.set(0, 0, 0);
  info = `${ids.length} building types — habitats, temples, farms, hatchery, breeding`;
}

function buildIslands() {
  const ids = Object.keys(ISLAND_DEFS);
  let x = 0;
  const gap = 26;
  ids.forEach((id, i) => {
    const isl = buildLowPolyIsland(ISLAND_DEFS[id]);
    totalTris += countTriangles(isl);
    isl.position.set((i - (ids.length - 1) / 2) * gap, 0, 0);
    scene.add(isl);
    x = i;
  });
  void x;
  const span = ids.length * gap;
  camera.position.set(0, span * 0.3, span * 0.55);
  controls.target.set(0, -2, 0);
  info = `${ids.length} islands — each silhouette from its tile mask`;
}

// Close-up of a single building: ?solo=habitat_fire
const solo = new URLSearchParams(location.search).get('solo');

if (solo && BUILDING_DEFS[solo]) {
  const def = BUILDING_DEFS[solo];
  const grp = buildLowPolyBuilding(def);
  totalTris += countTriangles(grp);
  scene.add(grp);
  const r = Math.max(def.tilesW, def.tilesH);
  camera.position.set(r * 1.6, r * 1.4, r * 2.2);
  controls.target.set(0, 0.4, 0);
  info = `${def.name} — close-up`;
} else {
  // The catalog grids hold thousands of meshes; shadow maps would re-render
  // them all every frame, so reserve real shadows for the world view.
  if (view !== 'world') { renderer.shadowMap.enabled = false; key.castShadow = false; }
  switch (view) {
    case 'monsters': buildMonsters(); break;
    case 'buildings': buildBuildings(); break;
    case 'islands': buildIslands(); break;
    default: buildWorld();
  }
}

// --- HUD with view switcher -------------------------------------------------
const hud = document.createElement('div');
hud.style.cssText =
  'position:fixed;top:12px;left:12px;font:13px/1.6 ui-monospace,monospace;color:#cfe3ff;' +
  'background:#0a0820cc;padding:10px 14px;border-radius:8px;border:1px solid #ffffff22;max-width:380px';
const link = (v: string, label: string) =>
  `<a href="?view=${v}" style="color:${v === view ? '#fff' : '#7fb0ff'};text-decoration:none;margin-right:10px;font-weight:${v === view ? 700 : 400}">${label}</a>`;
hud.innerHTML =
  `<b style="color:#fff">MONSTERIUM · low-poly 3D</b><br>` +
  `<span style="color:#8fd9ff">${info}</span><br>` +
  `<b>${totalTris.toLocaleString()} triangles</b> · all generated in code<br>` +
  `<div style="margin-top:6px">${link('world', 'World')}${link('monsters', 'Monsters')}${link('buildings', 'Buildings')}${link('islands', 'Islands')}</div>` +
  `<span style="opacity:.6">drag to orbit · scroll to zoom</span>`;
document.body.appendChild(hud);

// --- Animate ----------------------------------------------------------------
const clock = new THREE.Clock();
function animateTagged(t: number) {
  scene.traverse((o) => {
    if (o.name === 'spin') o.rotation.z = t * 1.2;
    else if (o.name === 'pulse') {
      const s = 1 + Math.sin(t * 2) * 0.08;
      o.scale.setScalar(s);
    }
  });
}
function tick() {
  const t = clock.getElapsedTime();
  monsterAnims.forEach((m, i) => {
    const body = m.userData.body as THREE.Group | undefined;
    if (body) {
      body.position.y = Math.sin(t * 2 + i) * 0.06;
      const orbit = body.getObjectByName('rarityOrbit');
      if (orbit) orbit.rotation.y = t * 1.2;
    }
  });
  animateTagged(t);
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
