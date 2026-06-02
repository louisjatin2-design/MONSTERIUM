// ---------------------------------------------------------------------------
// Procedural low-poly 3D ISLAND generator (PROOF OF CONCEPT)
//
// Turns an IslandDef tile mask into a floating low-poly island: grass-topped
// tiles forming the silhouette, a craggy rock underside, and scattered
// obstacle props. Element-buffed islands tint the grass. Returns a THREE.Group
// centred on the origin; the grass surface top is at y = TOP_Y.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { ELEMENT_COLORS } from '@data/elements';
import type { IslandDef } from '@gtypes/game';
import { box, mat, shade, ICO, CONE, seededRng } from './ll';

export const TOP_Y = 0.3; // grass surface height above y=0

interface Grid { cols: number; rows: number; }

// Map a (fractional) tile coord to a centred world position.
export function gridToWorld(col: number, row: number, grid: Grid) {
  return { x: col - grid.cols / 2, z: row - grid.rows / 2 };
}

export function islandGrid(def: IslandDef): Grid {
  return { cols: def.tileMask[0].length, rows: def.tileMask.length };
}

function grassColor(def: IslandDef): number {
  const buff = def.buffElement;
  if (buff && (ELEMENT_COLORS as Record<string, number>)[buff]) {
    // Blend the element colour toward a grassy green so it still reads as land.
    const c = new THREE.Color((ELEMENT_COLORS as Record<string, number>)[buff]);
    c.lerp(new THREE.Color(0x4f9e3a), 0.45);
    return c.getHex();
  }
  return 0x4f9e3a;
}

export function buildLowPolyIsland(def: IslandDef): THREE.Group {
  const g = new THREE.Group();
  const grid = islandGrid(def);
  const rng = seededRng(def.id);
  const grass = grassColor(def);
  const dirt = shade(grass, 0.55);

  // Bounds of the filled silhouette (for the underside spike).
  let minC = 99, maxC = -1, minR = 99, maxR = -1, n = 0;
  def.tileMask.forEach((rowArr, r) => rowArr.forEach((on, c) => {
    if (!on) return; n++;
    minC = Math.min(minC, c); maxC = Math.max(maxC, c);
    minR = Math.min(minR, r); maxR = Math.max(maxR, r);
  }));

  // Grass tiles (each slightly varied for low-poly texture).
  const isFilled = (c: number, r: number) => !!def.tileMask[r]?.[c];
  def.tileMask.forEach((rowArr, r) => rowArr.forEach((on, c) => {
    if (!on) return;
    const w = gridToWorld(c + 0.5, r + 0.5, grid);
    const tint = shade(grass, 0.9 + rng() * 0.2);
    const tile = box(1.0, TOP_Y, 1.0, 0, tint, { roughness: 1 });
    tile.position.set(w.x, 0, w.z);
    g.add(tile);
    // Rocky skirt under edge tiles (those touching empty space).
    const edge = !isFilled(c - 1, r) || !isFilled(c + 1, r) || !isFilled(c, r - 1) || !isFilled(c, r + 1);
    if (edge) {
      const skirt = box(1.0, 0.7, 1.0, -0.7, dirt, { roughness: 1 });
      skirt.position.set(w.x, 0, w.z);
      g.add(skirt);
    }
  }));

  // Floating rock underside — a big downward spike beneath the centre.
  const cx = gridToWorld((minC + maxC) / 2 + 0.5, (minR + maxR) / 2 + 0.5, grid);
  const span = Math.max(maxC - minC, maxR - minR) + 1;
  const spike = new THREE.Mesh(CONE(span * 0.42, span * 0.7, 7), mat(shade(dirt, 0.8), { roughness: 1 }));
  spike.rotation.x = Math.PI;
  spike.position.set(cx.x, -0.7 - span * 0.32, cx.z);
  g.add(spike);
  // A couple of smaller offset chunks for an irregular silhouette.
  for (let i = 0; i < 3; i++) {
    const chunk = new THREE.Mesh(ICO(span * (0.12 + rng() * 0.08), 0), mat(shade(dirt, 0.7)));
    chunk.position.set(cx.x + (rng() - 0.5) * span * 0.5, -0.8 - rng() * span * 0.4, cx.z + (rng() - 0.5) * span * 0.5);
    g.add(chunk);
  }

  // Obstacle props.
  for (const ob of def.obstacles ?? []) {
    const w = gridToWorld(ob.tileX + 0.5, ob.tileY + 0.5, grid);
    const prop = buildObstacle(ob.defId, seededRng(def.id + ob.defId + ob.tileX + ob.tileY));
    prop.position.set(w.x, TOP_Y, w.z);
    g.add(prop);
  }
  return g;
}

// Small low-poly terrain props referenced by island obstacle lists.
export function buildObstacle(defId: string, rng: () => number = seededRng(defId)): THREE.Group {
  const g = new THREE.Group();
  switch (defId) {
    case 'ancient_tree': {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.5, 6), mat(0x6b4a2a));
      trunk.position.y = 0.25; g.add(trunk);
      const crown = new THREE.Mesh(ICO(0.34, 1), mat(0x2f7d2e));
      crown.position.y = 0.62; crown.scale.y = 1.1; g.add(crown);
      break;
    }
    case 'thorn_bush': {
      const bush = new THREE.Mesh(ICO(0.24, 1), mat(0x355f24)); bush.position.y = 0.2; g.add(bush);
      for (let i = 0; i < 4; i++) {
        const thorn = new THREE.Mesh(CONE(0.03, 0.16, 4), mat(0x6e9140));
        thorn.position.set((rng() - 0.5) * 0.4, 0.3, (rng() - 0.5) * 0.4); g.add(thorn);
      }
      break;
    }
    case 'crystal_cluster': {
      for (let i = 0; i < 4; i++) {
        const c = new THREE.Mesh(CONE(0.07, 0.3 + rng() * 0.25, 4),
          mat(0x88e0f0, { metalness: 0.4, roughness: 0.15, emissive: 0x2aa0c0, emissiveIntensity: 0.4, transparent: true, opacity: 0.9 }));
        c.position.set((rng() - 0.5) * 0.3, 0.15, (rng() - 0.5) * 0.3);
        c.rotation.z = (rng() - 0.5) * 0.5; g.add(c);
      }
      break;
    }
    case 'glow_mushroom': {
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.22, 6), mat(0xe8e0d0));
      stem.position.y = 0.11; g.add(stem);
      const cap = new THREE.Mesh(ICO(0.16, 1), mat(0xff66cc, { emissive: 0xff3aa0, emissiveIntensity: 0.6 }));
      cap.position.y = 0.26; cap.scale.y = 0.6; g.add(cap);
      break;
    }
    case 'bone_pile': {
      for (let i = 0; i < 4; i++) {
        const bone = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 5), mat(0xe6e0cf));
        bone.position.set((rng() - 0.5) * 0.3, 0.06, (rng() - 0.5) * 0.3);
        bone.rotation.set(rng(), rng(), Math.PI / 2 + (rng() - 0.5)); g.add(bone);
      }
      break;
    }
    default: { // rock_small
      const rock = new THREE.Mesh(ICO(0.22, 0), mat(0x8a8f99, { roughness: 1 }));
      rock.position.y = 0.16; rock.rotation.set(rng(), rng(), rng()); g.add(rock);
    }
  }
  g.traverse((o) => { (o as THREE.Mesh).castShadow = true; });
  return g;
}
