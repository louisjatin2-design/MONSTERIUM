// ---------------------------------------------------------------------------
// Low-poly 3D monster — PROOF OF CONCEPT demo scene.
//
// Renders a few procedurally generated monsters on rotating pedestals so the
// faceted look and the (tiny) triangle budget can be reviewed before any of
// this touches the real game. Open /monster3d.html (vite dev or after build).
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ELEMENT_COLORS } from '@data/elements';
import { RARITY_COLORS, RARITY_RANK } from '@data/rarities';
import { MONSTER_DEFS } from '@data/monsters';
import { buildLowPolyMonster, countTriangles, type MonsterVisualSpec } from './lowpolyMonster';

// Pick a handful of real monsters spanning elements + rarities.
const SHOWCASE = ['flameling', 'frostpaw', 'aquapup', 'voltkit', 'pebblor'];

const app = document.getElementById('app')!;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x141033);
scene.fog = new THREE.Fog(0x141033, 14, 30);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 3.2, 9);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 1, 0);
controls.maxPolarAngle = Math.PI * 0.52;

// --- Lighting: ambient + key directional so flat facets catch the light ----
scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x402a55, 0.9));
const key = new THREE.DirectionalLight(0xffffff, 1.4);
key.position.set(4, 8, 5);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
key.shadow.camera.near = 1;
key.shadow.camera.far = 30;
(key.shadow.camera as THREE.OrthographicCamera).left = -8;
(key.shadow.camera as THREE.OrthographicCamera).right = 8;
(key.shadow.camera as THREE.OrthographicCamera).top = 8;
(key.shadow.camera as THREE.OrthographicCamera).bottom = -8;
scene.add(key);

// --- Ground plane -----------------------------------------------------------
const ground = new THREE.Mesh(
  new THREE.CircleGeometry(14, 48),
  new THREE.MeshStandardMaterial({ color: 0x2a2150, roughness: 0.95 }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Portrait mode: /monster3d.html?solo=flameling shows one big front-on creature.
const soloId = new URLSearchParams(location.search).get('solo');
const ROW = soloId ? [soloId] : SHOWCASE;
if (soloId) {
  camera.position.set(0, 1.4, 5);
  controls.target.set(0, 1.1, 0);
}

// --- Build the showcase row -------------------------------------------------
const pivots: THREE.Group[] = [];
let totalTris = 0;
const names: string[] = [];

const spacing = 2.6;
ROW.forEach((id, i) => {
  const def = MONSTER_DEFS[id];
  if (!def) return;
  const el = def.elements[0];
  const spec: MonsterVisualSpec = {
    id,
    element: el,
    elementColor: ELEMENT_COLORS[el] ?? 0x888888,
    accentColor: parseInt(RARITY_COLORS[def.rarity].replace('#', ''), 16),
    rarityRank: RARITY_RANK[def.rarity],
  };
  const monster = buildLowPolyMonster(spec);
  totalTris += countTriangles(monster);
  names.push(`${def.name} (${el})`);

  const pivot = new THREE.Group();
  pivot.position.x = (i - (ROW.length - 1) / 2) * spacing;
  if (soloId) monster.scale.setScalar(1.5);
  pivot.add(monster);
  scene.add(pivot);
  pivots.push(pivot);
});

// --- HUD: the efficiency story ----------------------------------------------
const hud = document.createElement('div');
hud.style.cssText =
  'position:fixed;top:12px;left:12px;font:13px/1.5 ui-monospace,monospace;' +
  'color:#cfe3ff;background:#0a0820cc;padding:10px 14px;border-radius:8px;' +
  'border:1px solid #ffffff22;pointer-events:none;max-width:340px';
hud.innerHTML =
  `<b style="color:#fff">MONSTERIUM · low-poly 3D proof</b><br>` +
  `${ROW.length} monster${ROW.length > 1 ? 's' : ''} · <b>${totalTris.toLocaleString()} triangles total</b> ` +
  `(~${Math.round(totalTris / ROW.length)} each)<br>` +
  `<span style="color:#8fd9ff">${names.join(' · ')}</span><br>` +
  `<span style="opacity:.7">drag to orbit · scroll to zoom · all generated in code</span>`;
document.body.appendChild(hud);

// --- Animate ----------------------------------------------------------------
const clock = new THREE.Clock();
function tick() {
  const t = clock.getElapsedTime();
  pivots.forEach((p, i) => {
    // Solo: gentle sway so the face stays toward the camera. Row: full spin.
    p.rotation.y = soloId ? Math.sin(t * 0.5) * 0.5 : t * 0.4 + i;
    const body = p.children[0]?.userData.body as THREE.Group | undefined;
    if (body) body.position.y = Math.sin(t * 2 + i) * 0.08;
    const orbit = body?.getObjectByName('rarityOrbit');
    if (orbit) orbit.rotation.y = t * 1.2;
  });
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
