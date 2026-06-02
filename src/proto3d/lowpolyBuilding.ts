// ---------------------------------------------------------------------------
// Procedural low-poly 3D BUILDING generator (PROOF OF CONCEPT)
//
// Data-driven from BUILDING_DEFS: category + linked element + footprint size
// decide the structure, so all 30+ buildings are covered by one generator.
// Returns a THREE.Group whose footprint is centred on the origin, sitting on
// the ground plane (y = 0). One unit == one map tile.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { ELEMENT_COLORS } from '@data/elements';
import type { BuildingDef } from '@gtypes/game';
import { box, pyramid, mat, shade, ICO, CONE, seededRng } from './ll';

const TILE = 1;

function elementColor(el?: string): number {
  return (el && (ELEMENT_COLORS as Record<string, number>)[el]) || 0x8a8f99;
}

// Anything spinning/pulsing is tagged so the scene can animate it.
function tag(o: THREE.Object3D, name: string) { o.name = name; return o; }

export function buildLowPolyBuilding(def: BuildingDef): THREE.Group {
  const g = new THREE.Group();
  const W = def.tilesW * TILE;
  const H = def.tilesH * TILE;
  const rng = seededRng(def.id);
  const el = def.linkedElement;
  const elc = elementColor(el);

  // Ground pad shared by every building (slightly inset from the footprint).
  const pad = box(W * 0.98, 0.08, H * 0.98, 0, shade(elc, 0.5), { roughness: 0.95 });
  g.add(pad);

  switch (def.category) {
    case 'Habitat': buildHabitat(g, W, H, elc, el, def.minRarityRank ?? 0, rng); break;
    case 'Temple':  buildTemple(g, W, H, elc); break;
    case 'Farm':    buildFarm(g, W, H, rng); break;
    case 'Hatchery': buildHatchery(g, W, H); break;
    case 'BreedingStation': buildBreeding(g, W, H); break;
    default: g.add(box(W * 0.7, 0.6, H * 0.7, 0.08, elc));
  }
  return g;
}

// Habitat themes group the 23 elements into a handful of detailed biomes.
type HabitatTheme = 'volcanic' | 'aquatic' | 'verdant' | 'rocky' | 'aerial' | 'arcane';
const THEME_OF: Record<string, HabitatTheme> = {
  Fire: 'volcanic', Demon: 'volcanic', Combat: 'volcanic',
  Water: 'aquatic', Ice: 'aquatic', Crystal: 'aquatic',
  Plant: 'verdant', Poison: 'verdant',
  Earth: 'rocky', Metal: 'rocky', Sand: 'rocky',
  Air: 'aerial', Electric: 'aerial', Sound: 'aerial',
  Light: 'arcane', Angel: 'arcane', Magic: 'arcane', Psycho: 'arcane',
  Darkness: 'arcane', Void: 'arcane', Cosmos: 'arcane', Time: 'arcane',
};

// --- Habitat: a detailed, themed enclosure ---------------------------------
function buildHabitat(g: THREE.Group, W: number, H: number, elc: number, el: string | undefined,
                      prestige: number, rng: () => number) {
  const theme = (el && THEME_OF[el]) || 'verdant';
  const groundCol = themeGround(theme, elc);

  // Layered terrain: base soil + a raised central mound for depth.
  g.add(box(W * 0.94, 0.14, H * 0.94, 0.08, groundCol, { roughness: 1 }));
  const mound = new THREE.Mesh(ICO(W * 0.4, 1), mat(shade(groundCol, 1.08), { roughness: 1 }));
  mound.scale.set(1, 0.32, 1); mound.position.y = 0.16; mound.receiveShadow = true; g.add(mound);
  // Scatter of ground patches for texture.
  for (let i = 0; i < 5; i++) {
    const patch = new THREE.Mesh(ICO(0.12 + rng() * 0.08, 0), mat(shade(groundCol, 0.85)));
    patch.scale.y = 0.3; patch.position.set((rng() - 0.5) * W * 0.7, 0.15, (rng() - 0.5) * H * 0.7); g.add(patch);
  }

  // Perimeter fence: posts + rails, with a gate arch at the front.
  buildFence(g, W, H, theme, elc);

  // A den / shelter the resident lives in.
  buildDen(g, theme, elc, -W * 0.22, -H * 0.18, rng);

  // Central element feature.
  buildHabitatFeature(g, theme, elc, W);

  // Themed scatter props.
  for (let i = 0; i < 3 + Math.floor(rng() * 2); i++) {
    buildHabitatProp(g, theme, elc, (rng() - 0.5) * W * 0.7, (rng() - 0.5) * H * 0.7, rng);
  }

  // Element totem/banner so each habitat is identifiable.
  const pole = box(0.06, 0.9, 0.06, 0.14, 0x5a4a3a); pole.position.set(W * 0.4, 0, H * 0.4); g.add(pole);
  const flag = box(0.04, 0.3, 0.34, 0.7, elc, { emissive: elc, emissiveIntensity: 0.35 });
  flag.position.set(W * 0.4, 0, H * 0.4 - 0.2); g.add(flag);

  // Prestige habitats: glowing rarity pillars in each corner.
  if (prestige >= 5) {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const pil = box(0.16, 0.9, 0.16, 0.08, shade(elc, 1.3), { emissive: elc, emissiveIntensity: 0.6 });
      pil.position.set(sx * W * 0.42, 0, sz * H * 0.42); g.add(pil);
      const cap = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), mat(elc, { emissive: elc, emissiveIntensity: 0.8 }));
      cap.position.set(sx * W * 0.42, 1.05, sz * H * 0.42); g.add(tag(cap, 'pulse'));
    }
  }
}

function themeGround(theme: HabitatTheme, elc: number): number {
  switch (theme) {
    case 'volcanic': return 0x3a2018;
    case 'aquatic':  return shade(elc, 0.85);
    case 'verdant':  return 0x3f7d2e;
    case 'rocky':    return 0x7a6a52;
    case 'aerial':   return 0xcfe3f5;
    case 'arcane':   return shade(elc, 0.4);
  }
}

function buildFence(g: THREE.Group, W: number, H: number, theme: HabitatTheme, elc: number) {
  const postCol = theme === 'volcanic' ? 0x2a1a14 : theme === 'arcane' ? shade(elc, 0.6) : 0x8a5a2a;
  const railCol = shade(postCol, 1.3);
  const hw = W * 0.46, hd = H * 0.46, ph = 0.34;
  const postsPerSide = Math.max(2, Math.round(W));
  const place = (x: number, z: number) => { const p = box(0.08, ph, 0.08, 0.1, postCol); p.position.set(x, 0, z); g.add(p); };
  for (let i = 0; i <= postsPerSide; i++) {
    const tx = -hw + (i / postsPerSide) * 2 * hw;
    place(tx, -hd); place(tx, hd);
    const tz = -hd + (i / postsPerSide) * 2 * hd;
    place(-hw, tz); place(hw, tz);
  }
  // Rails (thin long boxes) on back and sides; front left open for a gate.
  const rail = (w: number, d: number, x: number, z: number) => { const r = box(w, 0.05, d, 0.34, railCol); r.position.set(x, 0, z); g.add(r); };
  rail(2 * hw, 0.05, 0, -hd); rail(0.05, 2 * hd, -hw, 0); rail(0.05, 2 * hd, hw, 0);
  // Front gate arch.
  for (const s of [-1, 1]) { const pillar = box(0.12, 0.6, 0.12, 0.1, postCol); pillar.position.set(s * W * 0.18, 0, hd); g.add(pillar); }
  const lintel = box(W * 0.42, 0.12, 0.14, 0.6, postCol); lintel.position.set(0, 0, hd); g.add(lintel);
}

function buildDen(g: THREE.Group, theme: HabitatTheme, elc: number, x: number, z: number, rng: () => number) {
  const den = new THREE.Group(); den.position.set(x, 0, z);
  if (theme === 'volcanic' || theme === 'rocky') {
    // Stone cave: a chunky rock dome with a dark opening.
    const dome = new THREE.Mesh(ICO(0.5, 1), mat(theme === 'volcanic' ? 0x4a3530 : 0x8a7a64, { roughness: 1 }));
    dome.scale.set(1.1, 0.85, 1); dome.position.y = 0.32; den.add(dome);
    const mouthM = new THREE.Mesh(SPHTODO(0.22), mat(0x0a0608)); mouthM.scale.set(1, 1.2, 0.5); mouthM.position.set(0, 0.28, 0.42); den.add(mouthM);
  } else if (theme === 'verdant') {
    // Hollow log.
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 8), mat(0x6b4a2a, { roughness: 1 }));
    log.rotation.z = Math.PI / 2; log.position.y = 0.3; den.add(log);
    const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.2, 8), mat(0x1a0f08));
    hole.rotation.z = Math.PI / 2; hole.position.set(0.42, 0.3, 0); den.add(hole);
    const moss = new THREE.Mesh(ICO(0.34, 1), mat(0x4f9e3a)); moss.scale.set(1, 0.4, 1); moss.position.set(0, 0.62, 0); den.add(moss);
  } else if (theme === 'aquatic') {
    // Coral/shell shelter.
    const shell = new THREE.Mesh(SPHHALF(0.45), mat(shade(elc, 1.25), { roughness: 0.4, metalness: 0.2 }));
    shell.position.y = 0.08; den.add(shell);
    for (let i = 0; i < 3; i++) { const c = new THREE.Mesh(CONE(0.06, 0.4, 4), mat(shade(elc, 1.4), { emissive: elc, emissiveIntensity: 0.2 })); c.position.set((rng() - 0.5) * 0.4, 0.2, (rng() - 0.5) * 0.4); den.add(c); }
  } else if (theme === 'aerial') {
    // Nest on a little perch.
    const post = box(0.12, 0.5, 0.12, 0.14, 0x8a6a4a); den.add(post);
    const nest = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.1, 6, 10), mat(0x9a7a4a, { roughness: 1 })); nest.rotation.x = Math.PI / 2; nest.position.y = 0.64; den.add(nest);
  } else {
    // Arcane pedestal with a floating orb.
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 0.4, 6), mat(shade(elc, 0.7))); ped.position.y = 0.28; den.add(ped);
    const orb = new THREE.Mesh(ICO(0.2, 1), mat(elc, { emissive: elc, emissiveIntensity: 0.7 })); orb.position.y = 0.78; den.add(tag(orb, 'pulse'));
  }
  den.traverse((o) => { (o as THREE.Mesh).castShadow = true; });
  g.add(den);
}

function buildHabitatFeature(g: THREE.Group, theme: HabitatTheme, elc: number, W: number) {
  const f = new THREE.Group(); f.position.set(W * 0.12, 0, H0(W));
  if (theme === 'volcanic') {
    const pit = new THREE.Mesh(new THREE.CylinderGeometry(W * 0.18, W * 0.22, 0.16, 8), mat(0x1a0e0a)); pit.position.y = 0.18; f.add(pit);
    const lava = new THREE.Mesh(new THREE.CylinderGeometry(W * 0.15, W * 0.15, 0.06, 8), mat(0xff5a1f, { emissive: 0xff3a00, emissiveIntensity: 1.0 })); lava.position.y = 0.26; f.add(tag(lava, 'pulse'));
    for (let i = 0; i < 3; i++) { const r = new THREE.Mesh(ICO(0.14, 0), mat(0x2a1a14)); r.position.set((i - 1) * 0.3, 0.22, 0.2); f.add(r); }
  } else if (theme === 'aquatic') {
    const pool = new THREE.Mesh(new THREE.CylinderGeometry(W * 0.26, W * 0.26, 0.12, 10), mat(shade(elc, 1.25), { metalness: 0.3, roughness: 0.2, transparent: true, opacity: 0.9 })); pool.position.y = 0.2; f.add(pool);
    const rock = new THREE.Mesh(ICO(0.3, 0), mat(0x6a7a8a)); rock.position.set(W * 0.18, 0.28, -W * 0.1); f.add(rock);
  } else if (theme === 'verdant') {
    for (let i = 0; i < 3; i++) { const bush = new THREE.Mesh(ICO(0.22 + i * 0.04, 1), mat(shade(0x3fae3a, 0.8 + i * 0.2))); bush.position.set((i - 1) * 0.34, 0.2, 0); f.add(bush);
      const flower = new THREE.Mesh(ICO(0.07, 0), mat(elc, { emissive: elc, emissiveIntensity: 0.3 })); flower.position.set((i - 1) * 0.34, 0.42, 0.1); f.add(flower); }
  } else if (theme === 'rocky') {
    for (let i = 0; i < 4; i++) { const ore = new THREE.Mesh(CONE(0.08, 0.35, 4), mat(shade(elc, 1.2), { emissive: elc, emissiveIntensity: 0.3, metalness: 0.4 })); ore.position.set((rng2(i)) * 0.5, 0.2, 0); ore.rotation.z = (i - 1.5) * 0.2; f.add(ore); }
    const boulder = new THREE.Mesh(ICO(0.34, 0), mat(0x7a6a52)); boulder.position.set(-0.2, 0.28, 0.1); f.add(boulder);
  } else if (theme === 'aerial') {
    const cloud = new THREE.Group();
    for (const [cx, cy] of [[-0.2, 0], [0.2, 0], [0, 0.12]] as const) { const puff = new THREE.Mesh(ICO(0.2, 1), mat(0xffffff, { emissive: 0xcfe3ff, emissiveIntensity: 0.2 })); puff.position.set(cx, 0.6 + cy, 0); cloud.add(puff); }
    f.add(tag(cloud, 'pulse'));
  } else {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.05, 6, 16), mat(elc, { emissive: elc, emissiveIntensity: 0.8 })); ring.position.y = 0.5; f.add(tag(ring, 'spin'));
    const core = new THREE.Mesh(ICO(0.16, 1), mat(shade(elc, 1.4), { emissive: elc, emissiveIntensity: 1.0 })); core.position.y = 0.5; f.add(core);
  }
  f.traverse((o) => { (o as THREE.Mesh).castShadow = true; });
  g.add(f);
}

function buildHabitatProp(g: THREE.Group, theme: HabitatTheme, elc: number, x: number, z: number, rng: () => number) {
  let m: THREE.Object3D;
  if (theme === 'verdant') { m = new THREE.Mesh(CONE(0.12, 0.4, 5), mat(0x2f7d2e)); m.position.y = 0.2 + 0.14; }
  else if (theme === 'aquatic') { m = new THREE.Mesh(ICO(0.12, 1), mat(shade(elc, 1.3), { emissive: elc, emissiveIntensity: 0.2 })); m.position.y = 0.2; }
  else if (theme === 'volcanic') { m = new THREE.Mesh(ICO(0.13, 0), mat(0x2a1a14)); m.position.y = 0.2; }
  else if (theme === 'aerial') { m = new THREE.Mesh(ICO(0.12, 1), mat(0xffffff, { emissive: 0xcfe3ff, emissiveIntensity: 0.2 })); m.position.y = 0.5; }
  else { m = new THREE.Mesh(ICO(0.15, 0), mat(0x7a6a52)); m.position.y = 0.2; }
  m.position.x = x; m.position.z = z;
  (m as THREE.Mesh).castShadow = true; (m as THREE.Mesh).rotation?.set?.(rng(), rng(), rng());
  g.add(m);
}

// tiny helpers used above
function SPHTODO(r: number) { return new THREE.SphereGeometry(r, 8, 6); }
function SPHHALF(r: number) { return new THREE.SphereGeometry(r, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2); }
function H0(_W: number) { return 0; }
let _rngState = 1;
function rng2(i: number) { _rngState = (_rngState * 9301 + i * 49297) % 233280; return (_rngState / 233280) * 2 - 1; }

// --- Temple: 3-tier pagoda tinted by element -------------------------------
function buildTemple(g: THREE.Group, W: number, H: number, elc: number) {
  const stone = 0xcabfa8;
  g.add(box(W * 0.86, 0.22, H * 0.86, 0.08, stone));   // stepped stone base
  let y = 0.3;
  let tw = W * 0.62, td = H * 0.62;
  const wallCol = 0xf2e8d0;
  for (let tier = 0; tier < 3; tier++) {
    g.add(box(tw, 0.42, td, y, wallCol));               // wall
    const eaveY = y + 0.42;
    g.add(pyramid(tw * 1.35, td * 1.35, 0.34, eaveY, elc, { emissive: elc, emissiveIntensity: 0.12 }));
    y = eaveY + 0.22;
    tw *= 0.66; td *= 0.66;
  }
  // Sōrin finial.
  const finial = new THREE.Mesh(CONE(0.1, 0.45, 6), mat(0xffd700, { emissive: 0xffcc00, emissiveIntensity: 0.5, metalness: 0.5 }));
  finial.position.y = y + 0.2; g.add(finial);
}

// --- Farm: tilled field + barn + a proper animated windmill -----------------
function buildFarm(g: THREE.Group, W: number, H: number, rng: () => number) {
  g.add(box(W * 0.92, 0.12, H * 0.92, 0.08, 0x9c6b3f, { roughness: 1 }));
  // Crop rows with little green tufts.
  for (let i = 0; i < 5; i++) {
    const z = (i / 4 - 0.5) * H * 0.62;
    const row = box(W * 0.5, 0.05, 0.08, 0.18, 0x6b4a2a); row.position.set(-W * 0.16, 0, z); g.add(row);
    for (let k = 0; k < 4; k++) { const tuft = new THREE.Mesh(CONE(0.04, 0.14, 4), mat(0x4eb24e)); tuft.position.set(-W * 0.36 + k * (W * 0.4 / 3), 0.24, z); g.add(tuft); }
  }

  const base = 0.2; // top of the field surface

  // --- Barn (front-left): body + gable roof + door ---
  const bx = -W * 0.24, bz = H * 0.24;
  const barnW = W * 0.32, barnD = H * 0.3, barnH = 0.42;
  const barn = box(barnW, barnH, barnD, base, 0xc24233); barn.position.x = bx; barn.position.z = bz; g.add(barn);
  const roof = pyramid(barnW * 1.12, barnD * 1.12, 0.26, base + barnH, 0x5a4030);
  roof.position.x = bx; roof.position.z = bz; g.add(roof);
  const door = box(barnW * 0.34, barnH * 0.7, 0.03, base, 0x3a241a); door.position.x = bx; door.position.z = bz + barnD / 2; g.add(door);

  // --- Windmill (back-right): the animated centrepiece ---
  const mx = W * 0.26, mz = -H * 0.22;
  const towerH = 0.95, topR = W * 0.11, botR = W * 0.15;
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(topR, botR, towerH, 8), mat(0xe6d8b8, { roughness: 0.9 }));
  tower.position.set(mx, base + towerH / 2, mz); tower.castShadow = true; g.add(tower);
  // Wooden bands.
  for (const by of [0.35, 0.7]) { const band = new THREE.Mesh(new THREE.CylinderGeometry(topR + 0.02, botR + 0.02, 0.05, 8), mat(0x8a6a3a)); band.position.set(mx, base + by, mz); g.add(band); }
  // Conical cap.
  const cap = new THREE.Mesh(CONE(topR + 0.06, 0.32, 8), mat(0x7a3a24)); cap.position.set(mx, base + towerH + 0.12, mz); cap.castShadow = true; g.add(cap);

  // Sail wheel — 4 sails on arms, mounted on the FRONT of the cap, spinning.
  const hubY = base + towerH - 0.02;
  const hubZ = mz + topR + 0.12;
  const wheel = new THREE.Group();
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.12, 8), mat(0x5a3a20));
  hub.rotation.x = Math.PI / 2; wheel.add(hub);
  for (let i = 0; i < 4; i++) {
    const arm = new THREE.Group(); arm.rotation.z = (i / 4) * Math.PI * 2;
    const spar = box(0.04, 0.62, 0.04, 0, 0x6b4a2a); spar.position.y = 0.31; arm.add(spar);
    // Sail cloth offset to one side of the spar (classic windmill look).
    const sail = box(0.17, 0.42, 0.02, 0, 0xf3ecda, { roughness: 0.8 });
    sail.position.set(0.13, 0.34, 0); arm.add(sail);
    wheel.add(arm);
  }
  wheel.position.set(mx, hubY, hubZ);
  wheel.traverse((o) => { (o as THREE.Mesh).castShadow = true; });
  tag(wheel, 'spin'); g.add(wheel);

  // Hay bales for flavour.
  for (let i = 0; i < 2; i++) {
    const hay = box(0.2, 0.18, 0.28, 0.08, 0xe0c050); hay.position.set(W * 0.3, 0, H * 0.28 - i * 0.34);
    hay.rotation.y = rng(); g.add(hay);
  }
}

// --- Hatchery: domed neoclassical hall -------------------------------------
function buildHatchery(g: THREE.Group, W: number, H: number) {
  g.add(box(W * 0.78, 0.6, H * 0.78, 0.08, 0xe8d6a8));   // sandstone hall
  // Colonnade (front).
  for (let i = 0; i < 5; i++) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 6), mat(0xfdfbf2));
    col.position.set((i / 4 - 0.5) * W * 0.72, 0.38, H * 0.4); g.add(col);
  }
  // Drum + glass dome.
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(W * 0.26, W * 0.26, 0.22, 10), mat(0x4f7da6));
  drum.position.y = 0.78; g.add(drum);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(W * 0.26, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    mat(0x4aa6e0, { transparent: true, opacity: 0.85, emissive: 0x2a6aa0, emissiveIntensity: 0.3 }));
  dome.position.y = 0.89; g.add(tag(dome, 'pulse'));
  const egg = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), mat(0xfff4e0));
  egg.scale.y = 1.3; egg.position.set(-W * 0.1, 0.28, H * 0.36); g.add(egg);
}

// --- Breeding Station: grassy mound + rock arch + glowing heart -------------
function buildBreeding(g: THREE.Group, W: number, H: number) {
  g.add(box(W * 0.92, 0.14, H * 0.92, 0.08, 0x4f9e3a, { roughness: 1 }));
  const rock = 0x8a6f86;
  for (const sx of [-1, 1]) {
    const spire = new THREE.Mesh(CONE(W * 0.18, 1.0, 5), mat(rock));
    spire.position.set(sx * W * 0.28, 0.6, -H * 0.1); g.add(spire);
  }
  // Heart portal: two spheres + a downward cone, emissive pink.
  const heart = new THREE.Group();
  const hm = mat(0xff5fa5, { emissive: 0xff3a8a, emissiveIntensity: 0.7 });
  for (const sx of [-1, 1]) {
    const lobe = new THREE.Mesh(ICO(0.16, 1), hm); lobe.position.set(sx * 0.12, 0.1, 0); heart.add(lobe);
  }
  const tip = new THREE.Mesh(CONE(0.26, 0.34, 5), hm); tip.rotation.x = Math.PI; tip.position.y = -0.18; heart.add(tip);
  heart.position.set(0, 0.7, H * 0.05); tag(heart, 'pulse'); g.add(heart);
}
