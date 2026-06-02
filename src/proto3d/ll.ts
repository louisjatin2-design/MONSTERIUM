// Shared low-poly helpers for the 3D asset generators (buildings, islands).
import * as THREE from 'three';

export function shade(hex: number, f: number): number {
  const c = new THREE.Color(hex);
  c.r = THREE.MathUtils.clamp(c.r * f, 0, 1);
  c.g = THREE.MathUtils.clamp(c.g * f, 0, 1);
  c.b = THREE.MathUtils.clamp(c.b * f, 0, 1);
  return c.getHex();
}

// Flat-shaded standard material — the crisp low-poly facet look.
export function mat(color: number, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.7, metalness: 0.04, ...opts });
}

// A flat-shaded box mesh whose BOTTOM sits at y0 (so things stack on a ground).
export function box(w: number, h: number, d: number, y0: number, color: number,
                    opts: Partial<THREE.MeshStandardMaterialParameters> = {}): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, opts));
  m.position.y = y0 + h / 2;
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

// A square (4-sided) pyramid roof covering a box of side `baseW`, base at y0.
export function pyramid(baseW: number, baseD: number, height: number, y0: number, color: number,
                        opts: Partial<THREE.MeshStandardMaterialParameters> = {}): THREE.Mesh {
  const r = Math.max(baseW, baseD) * 0.72;
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, height, 4), mat(color, opts));
  m.rotation.y = Math.PI / 4;          // align flat faces to the box
  m.scale.z = baseD / baseW || 1;      // match a rectangular footprint
  m.position.y = y0 + height / 2;
  m.castShadow = true;
  return m;
}

export const ICO = (r: number, d = 0) => new THREE.IcosahedronGeometry(r, d);
export const CONE = (r: number, h: number, seg = 5) => new THREE.ConeGeometry(r, h, seg);

// Deterministic RNG seeded from a string.
export function seededRng(str: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  let seed = h >>> 0;
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
