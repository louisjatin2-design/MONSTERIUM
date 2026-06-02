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

// --- Habitat: tinted yard, low rim wall, element prop ----------------------
function buildHabitat(g: THREE.Group, W: number, H: number, elc: number, el: string | undefined,
                      prestige: number, rng: () => number) {
  const soil = shade(elc, 0.7);
  g.add(box(W * 0.92, 0.12, H * 0.92, 0.08, soil, { roughness: 1 }));

  // Low rim wall around the yard.
  const t = 0.1, rh = 0.28, hw = W * 0.46, hd = H * 0.46;
  const wallCol = shade(elc, 0.45);
  g.add(box(W * 0.92, rh, t, 0.08, wallCol)).position.z = -hd;
  g.add(box(W * 0.92, rh, t, 0.08, wallCol)).position.z = hd;
  g.add(box(t, rh, H * 0.92, 0.08, wallCol)).position.x = -hw;
  g.add(box(t, rh, H * 0.92, 0.08, wallCol)).position.x = hw;

  // Centre element prop.
  const prop = new THREE.Group();
  if (el === 'Water' || el === 'Ice') {
    const pool = new THREE.Mesh(new THREE.CylinderGeometry(W * 0.22, W * 0.22, 0.1, 8),
      mat(shade(elc, 1.2), { metalness: 0.3, roughness: 0.2 }));
    pool.position.y = 0.2; prop.add(pool);
  } else if (el === 'Fire' || el === 'Demon') {
    const pit = new THREE.Mesh(new THREE.CylinderGeometry(W * 0.16, W * 0.2, 0.18, 8), mat(0x2a1a14));
    pit.position.y = 0.18; prop.add(pit);
    const flame = new THREE.Mesh(CONE(0.18, 0.5, 5), mat(0xff7a1f, { emissive: 0xff5a00, emissiveIntensity: 0.9 }));
    flame.position.y = 0.5; prop.add(tag(flame, 'pulse'));
  } else {
    const rock = new THREE.Mesh(ICO(W * 0.18, 0), mat(shade(elc, 1.1), { emissive: elc, emissiveIntensity: 0.2 }));
    rock.position.y = 0.28; rock.rotation.set(rng(), rng(), rng()); prop.add(rock);
  }
  g.add(prop);

  // Prestige habitats get a glowing rarity pillar in each corner.
  if (prestige >= 5) {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const pil = box(0.16, 0.7, 0.16, 0.08, shade(elc, 1.3), { emissive: elc, emissiveIntensity: 0.5 });
      pil.position.set(sx * hw * 0.9, 0, sz * hd * 0.9);
      g.add(pil);
    }
  }
}

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

// --- Farm: field + barn + spinning windmill --------------------------------
function buildFarm(g: THREE.Group, W: number, H: number, rng: () => number) {
  g.add(box(W * 0.92, 0.12, H * 0.92, 0.08, 0x9c6b3f, { roughness: 1 }));
  // Crop rows.
  for (let i = 0; i < 5; i++) {
    const row = box(W * 0.8, 0.06, 0.1, 0.18, 0x4eb24e);
    row.position.z = (i / 4 - 0.5) * H * 0.7; g.add(row);
  }
  // Barn (front-left) with pyramid roof.
  const bx = -W * 0.22, bz = H * 0.22;
  const barn = box(W * 0.34, 0.5, H * 0.34, 0.14, 0xc24233); barn.position.set(bx, 0, bz); g.add(barn);
  const roof = pyramid(W * 0.42, H * 0.42, 0.32, 0.64, 0x5a4030); roof.position.x = bx; roof.position.z = bz; g.add(roof);
  // Windmill (back-right): tower + cap + spinning sails.
  const mx = W * 0.26, mz = -H * 0.26;
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(W * 0.1, W * 0.13, 0.9, 7), mat(0xd8c6a4));
  tower.position.set(mx, 0.45 + 0.08, mz); g.add(tower);
  const sails = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const blade = box(0.5, 0.12, 0.04, -0.06, 0xf3ecda);
    blade.position.x = 0.28; blade.rotation.z = (i / 4) * Math.PI * 2;
    const arm = new THREE.Group(); arm.rotation.z = (i / 4) * Math.PI * 2; arm.add(blade); sails.add(arm);
  }
  sails.position.set(mx, 0.98, mz - W * 0.14); tag(sails, 'spin'); g.add(sails);
  // Hay bales.
  for (let i = 0; i < 2; i++) {
    const hay = box(0.22, 0.2, 0.3, 0.08, 0xe0c050);
    hay.position.set(W * 0.28 + i * 0.05, 0, H * 0.3); g.add(hay);
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
