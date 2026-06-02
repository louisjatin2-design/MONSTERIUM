// ---------------------------------------------------------------------------
// Procedural low-poly 3D monster generator (PROOF OF CONCEPT)
//
// Each monster is built from an ARCHETYPE chosen by its element family
// (biped / quadruped / aquatic / avian / spectral / critter) plus per-monster
// seeded variation (proportions, horns, eye count, spots, tail, wings). The
// element drives a baked colour gradient + crest + eye colour; rarity adds
// embellishments. So every species gets a genuinely different silhouette while
// staying tiny (a few thousand triangles) and 100% generated from data.
// ---------------------------------------------------------------------------
import * as THREE from 'three';

export interface MonsterVisualSpec {
  id: string;
  elementColor: number;
  accentColor: number;
  rarityRank: number;
  element: string;
}

// --- deterministic RNG -----------------------------------------------------
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function mulberry32(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shade(hex: number, f: number): number {
  const c = new THREE.Color(hex);
  c.r = THREE.MathUtils.clamp(c.r * f, 0, 1);
  c.g = THREE.MathUtils.clamp(c.g * f, 0, 1);
  c.b = THREE.MathUtils.clamp(c.b * f, 0, 1);
  return c.getHex();
}
function mat(color: number, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.55, metalness: 0.05, ...opts });
}
const ICO = (r: number, d = 1) => new THREE.IcosahedronGeometry(r, d);
const CONE = (r: number, h: number, seg = 5) => new THREE.ConeGeometry(r, h, seg);
const SPH = (r: number, w = 12, h = 10) => new THREE.SphereGeometry(r, w, h);

// --- per-element art -------------------------------------------------------
interface ElementArt { grad: [number, number, number]; eye: number; crest: string; family: string; }
const ELEMENT_ART: Record<string, ElementArt> = {
  Fire:     { grad: [0xffe24a, 0xff7a1f, 0xe23a5e], eye: 0x8a0f12, crest: 'flame', family: 'biped' },
  Combat:   { grad: [0xffb07a, 0xff6347, 0xb03020], eye: 0x6a1208, crest: 'horns', family: 'biped' },
  Demon:    { grad: [0xff5a4a, 0xb01818, 0x5e0808], eye: 0xffcc00, crest: 'horns', family: 'biped' },
  Magic:    { grad: [0xf2b8ff, 0xda70d6, 0x8a2a86], eye: 0x4a0a48, crest: 'horns', family: 'biped' },
  Psycho:   { grad: [0xffc0ff, 0xee82ee, 0xa040a0], eye: 0x5a1a5a, crest: 'horns', family: 'biped' },
  Water:    { grad: [0x9fe0ff, 0x2f8fe0, 0x14579e], eye: 0x0d3a6a, crest: 'fin',   family: 'aquatic' },
  Ice:      { grad: [0xffffff, 0xe2f3ff, 0xa9d8f0], eye: 0x1fa8e6, crest: 'shard', family: 'aquatic' },
  Crystal:  { grad: [0xffffff, 0xd6f7ff, 0x8fd8e8], eye: 0x2aa0c0, crest: 'shard', family: 'aquatic' },
  Air:      { grad: [0xffffff, 0xd6efff, 0xaad0ea], eye: 0x4a7fa0, crest: 'fluff', family: 'avian' },
  Electric: { grad: [0xfff7a8, 0xffd400, 0xd98e00], eye: 0x6a4a00, crest: 'bolt',  family: 'avian' },
  Sound:    { grad: [0xffc6e6, 0xff69b4, 0xc03a7a], eye: 0x5a1838, crest: 'bolt',  family: 'avian' },
  Earth:    { grad: [0xc79a5c, 0x8a5a2a, 0x55351a], eye: 0x2a1808, crest: 'rock',  family: 'quadruped' },
  Metal:    { grad: [0xeef1f5, 0xb6bcc6, 0x7a818c], eye: 0x303640, crest: 'rock',  family: 'quadruped' },
  Sand:     { grad: [0xf6e0a8, 0xe0b46a, 0xb07f3a], eye: 0x5a3a14, crest: 'rock',  family: 'quadruped' },
  Plant:    { grad: [0x9fe06a, 0x3fae3a, 0x1f6e22], eye: 0x123a10, crest: 'leaf',  family: 'quadruped' },
  Poison:   { grad: [0xd06aff, 0x8b008b, 0x4a0040], eye: 0xbaff3a, crest: 'leaf',  family: 'quadruped' },
  Darkness: { grad: [0x6a4a9a, 0x33155a, 0x140828], eye: 0xb98cff, crest: 'horns', family: 'spectral' },
  Void:     { grad: [0x3a2f6a, 0x161038, 0x05030f], eye: 0x8a6aff, crest: 'horns', family: 'spectral' },
  Cosmos:   { grad: [0x6a78d8, 0x283e8a, 0x101a4a], eye: 0xaad0ff, crest: 'fluff', family: 'spectral' },
  Time:     { grad: [0xbac6d4, 0x708090, 0x3a4450], eye: 0xd0e0f0, crest: 'fluff', family: 'spectral' },
  Light:    { grad: [0xffffe0, 0xfff099, 0xe0c860], eye: 0xc89a20, crest: 'fluff', family: 'critter' },
  Angel:    { grad: [0xfffef0, 0xfff6c8, 0xe8d89a], eye: 0x9a7a40, crest: 'fluff', family: 'critter' },
  Glitch:   { grad: [0x00ff66, 0x00aa44, 0x004a22], eye: 0xff00aa, crest: 'bolt',  family: 'biped' },
};
function artFor(spec: MonsterVisualSpec): ElementArt {
  return ELEMENT_ART[spec.element] ?? {
    grad: [shade(spec.elementColor, 1.55), spec.elementColor, shade(spec.elementColor, 0.55)],
    eye: shade(spec.elementColor, 0.4), crest: 'horns', family: 'critter',
  };
}

// Bake a top->bottom vertical gradient into a geometry as vertex colours.
function applyVerticalGradient(geo: THREE.BufferGeometry, stops: number[]): void {
  geo.computeBoundingBox();
  const bb = geo.boundingBox!;
  const span = (bb.max.y - bb.min.y) || 1;
  const cs = stops.map((c) => new THREE.Color(c));
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const out = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = (pos.getY(i) - bb.min.y) / span;
    const u = (1 - t) * (cs.length - 1);
    const lo = Math.min(Math.floor(u), cs.length - 2);
    out.copy(cs[lo]).lerp(cs[lo + 1], u - lo);
    colors[i * 3] = out.r; colors[i * 3 + 1] = out.g; colors[i * 3 + 2] = out.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}
function gradMesh(geo: THREE.BufferGeometry, grad: number[]): THREE.Mesh {
  applyVerticalGradient(geo, grad);
  const m = new THREE.Mesh(geo, mat(0xffffff, { vertexColors: true, roughness: 0.5 }));
  m.castShadow = true;
  return m;
}

// --- crest (head ornament) -------------------------------------------------
function buildCrest(art: ElementArt, rng: () => number): THREE.Object3D {
  const g = new THREE.Group();
  const [hot, mid, deep] = art.grad;
  switch (art.crest) {
    case 'flame': {
      const n = 7;
      for (let i = 0; i < n; i++) {
        const f = (i / (n - 1)) * 2 - 1;
        const h = 1.0 - Math.abs(f) * 0.5 + rng() * 0.12;
        const fl = new THREE.Mesh(CONE(0.14 - Math.abs(f) * 0.03, h, 4), mat(i % 2 ? hot : mid, { emissive: 0xff5a00, emissiveIntensity: 0.8, roughness: 0.4 }));
        fl.position.set(f * 0.4, h * 0.42, -0.04 - Math.abs(f) * 0.04);
        fl.rotation.set(-0.28, 0, f * -0.55); g.add(fl);
      }
      break;
    }
    case 'shard': {
      const n = 6;
      const m = mat(shade(hot, 1.02), { metalness: 0.35, roughness: 0.12, transparent: true, opacity: 0.92, emissive: deep, emissiveIntensity: 0.15 });
      for (let i = 0; i < n; i++) {
        const f = (i / (n - 1)) * 2 - 1; const h = 0.9 - Math.abs(f) * 0.4;
        const s = new THREE.Mesh(CONE(0.09 - Math.abs(f) * 0.02, h, 4), m);
        s.position.set(f * 0.36, h * 0.46, -0.02); s.rotation.set(-0.1, rng() * 0.4, f * -0.5); g.add(s);
      }
      break;
    }
    case 'bolt': {
      const m = mat(hot, { emissive: 0xffd000, emissiveIntensity: 0.85, roughness: 0.3 });
      for (const sgn of [-1, 0, 1]) {
        const s = new THREE.Mesh(CONE(0.09, sgn === 0 ? 0.62 : 0.44, 3), m);
        s.position.set(sgn * 0.28, sgn === 0 ? 0.32 : 0.22, -0.02); s.rotation.z = sgn * -0.45; g.add(s);
      }
      break;
    }
    case 'fin': {
      const fin = new THREE.Mesh(CONE(0.13, 0.62, 3), mat(mid, { metalness: 0.2, roughness: 0.3 }));
      fin.position.set(0, 0.3, -0.05); fin.rotation.x = -0.2; fin.scale.set(0.4, 1, 1.3); g.add(fin);
      break;
    }
    case 'leaf': {
      for (const sgn of [-1, 1, 0]) {
        const leaf = new THREE.Mesh(CONE(0.11, 0.5, 3), mat(hot, { roughness: 0.6 }));
        leaf.position.set(sgn * 0.16, 0.28, -0.04); leaf.rotation.set(-0.3, 0, sgn * -0.5); leaf.scale.set(0.5, 1, 1); g.add(leaf);
      }
      break;
    }
    case 'fluff': {
      for (const [x, y, r] of [[-0.16, 0.16, 0.14], [0.16, 0.16, 0.14], [0, 0.26, 0.18]] as const) {
        const puff = new THREE.Mesh(ICO(r, 1), mat(hot, { roughness: 0.85 })); puff.position.set(x, y, -0.04); g.add(puff);
      }
      break;
    }
    default: { // horns
      for (const sgn of [-1, 1]) {
        const horn = new THREE.Mesh(CONE(0.09, 0.46, 4), mat(deep, { roughness: 0.5 }));
        horn.position.set(sgn * 0.3, 0.18, -0.02); horn.rotation.z = sgn * -0.35; g.add(horn);
      }
    }
  }
  return g;
}

// --- shared face (eyes / cheeks / smile), facing +z ------------------------
// `frontZ` is the eyeball plane (placed right on the head's front surface so
// the eyes are seated in the body, never floating); `spacingR` is the head
// radius and drives eye separation + cheek/mouth offsets.
interface FaceOpts { eyeCount: number; eyeR: number; cheeks: boolean; iris: number; rng: () => number; }
function addFace(group: THREE.Group, cx: number, cy: number, frontZ: number, spacingR: number, o: FaceOpts) {
  const white = mat(0xffffff, { roughness: 0.2 });
  const dark = mat(0x080a14, { roughness: 0.12 });
  const irisM = mat(o.iris, { roughness: 0.18, metalness: 0.25, emissive: o.iris, emissiveIntensity: 0.18 });
  const r = o.eyeR;
  // Seat the eyeball so only its front pokes out of the surface.
  const ballZ = frontZ - r * 0.45;
  const xs = o.eyeCount === 1 ? [0] : o.eyeCount === 3 ? [-0.5, 0, 0.5] : [-0.45, 0.45];
  for (const fx of xs) {
    const ex = cx + fx * spacingR, ey = cy;
    const ball = new THREE.Mesh(SPH(r, 14, 12), white); ball.position.set(ex, ey, ballZ); group.add(ball);
    const ir = new THREE.Mesh(ICO(r * 0.7, 0), irisM); ir.position.set(ex, ey, ballZ + r * 0.55); group.add(ir);
    const pu = new THREE.Mesh(SPH(r * 0.4, 10, 8), dark); pu.position.set(ex, ey, ballZ + r * 0.82); group.add(pu);
    const sh = new THREE.Mesh(SPH(r * 0.2, 8, 8), white); sh.position.set(ex - r * 0.28, ey + r * 0.34, ballZ + r * 0.9); group.add(sh);
  }
  if (o.cheeks) {
    const cm = mat(0xff9ab0, { emissive: 0xff5577, emissiveIntensity: 0.22, roughness: 0.6 });
    for (const sgn of [-1, 1]) {
      const ch = new THREE.Mesh(SPH(spacingR * 0.22, 10, 8), cm); ch.scale.set(1, 0.65, 0.45);
      ch.position.set(cx + sgn * spacingR * 0.66, cy - spacingR * 0.3, ballZ - r * 0.1); group.add(ch);
    }
  }
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(spacingR * 0.22, spacingR * 0.05, 8, 12, Math.PI), dark);
  mouth.rotation.z = Math.PI; mouth.position.set(cx, cy - spacingR * 0.42, ballZ + r * 0.55); group.add(mouth);
}

// short stubby limb (cone or ico) helper
function limb(geo: THREE.BufferGeometry, color: number): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat(color, { roughness: 0.6 })); m.castShadow = true; return m;
}

// optional wings (rarity / seed)
function addWings(group: THREE.Group, y: number, z: number, color: number) {
  for (const sgn of [-1, 1]) {
    const wing = new THREE.Mesh(CONE(0.28, 0.7, 3), mat(color, { roughness: 0.5, transparent: true, opacity: 0.92 }));
    wing.scale.set(0.5, 1, 0.15);
    wing.position.set(sgn * 0.55, y, z);
    wing.rotation.set(0.3, 0, sgn * 1.15);
    group.add(wing);
  }
}

// ===========================================================================
export function buildLowPolyMonster(spec: MonsterVisualSpec): THREE.Group {
  const rng = mulberry32(hashStr(spec.id));
  const art = artFor(spec);
  // Per-monster jitter so two same-element monsters still differ.
  const jit = (hex: number) => shade(hex, 0.9 + rng() * 0.22);
  const grad: [number, number, number] = [jit(art.grad[0]), jit(art.grad[1]), jit(art.grad[2])];
  const mid = grad[1], deep = grad[2];

  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const eyeR = 0.18 + rng() * 0.06;
  const eyeCount = rng() < 0.12 ? (rng() < 0.5 ? 1 : 3) : 2;
  const cheeks = art.family !== 'spectral' && art.family !== 'quadruped' ? rng() < 0.8 : rng() < 0.3;
  const wings = spec.rarityRank >= 4 || rng() < 0.18;
  const faceOpts: FaceOpts = { eyeCount, eyeR, cheeks, iris: art.eye, rng };

  const headTop = (art.family === 'biped' ? buildBiped
    : art.family === 'quadruped' ? buildQuadruped
    : art.family === 'aquatic' ? buildAquatic
    : art.family === 'avian' ? buildAvian
    : art.family === 'spectral' ? buildSpectral
    : buildCritter)(body, grad, faceOpts, rng, jit);

  // Crest on the head crown.
  const crest = buildCrest(art, rng);
  crest.position.set(headTop.x, headTop.y, headTop.z);
  crest.scale.setScalar(headTop.r * 1.4);
  body.add(crest);

  if (wings) addWings(body, headTop.y * 0.55, -0.3, jit(mid));

  // Spots / pattern for extra individuality.
  if (rng() < 0.5) {
    const spotM = mat(shade(deep, rng() < 0.5 ? 0.7 : 1.4), { roughness: 0.6 });
    const count = 2 + Math.floor(rng() * 4);
    for (let i = 0; i < count; i++) {
      const sp = new THREE.Mesh(ICO(0.06 + rng() * 0.05, 0), spotM);
      sp.position.set((rng() - 0.5) * 0.9, headTop.y * (0.3 + rng() * 0.4), 0.35 + rng() * 0.3);
      body.add(sp);
    }
  }

  // Rarity orbit gems.
  if (spec.rarityRank > 0) {
    const gemMat = mat(spec.accentColor, { emissive: spec.accentColor, emissiveIntensity: 0.5 + spec.rarityRank * 0.12, metalness: 0.4, roughness: 0.2 });
    const gemCount = Math.min(spec.rarityRank, 6);
    const orbit = new THREE.Group(); orbit.name = 'rarityOrbit';
    for (let i = 0; i < gemCount; i++) {
      const a = (i / gemCount) * Math.PI * 2;
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.1, 0), gemMat);
      gem.position.set(Math.cos(a) * 1.05, headTop.y * 0.7, Math.sin(a) * 1.05); orbit.add(gem);
    }
    body.add(orbit);
  }

  // Ground shadow.
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.8, 14), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22 }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.01; root.add(shadow);

  root.userData.body = body;
  return root;
}

type Head = { x: number; y: number; z: number; r: number };

// --- ARCHETYPES ------------------------------------------------------------
function feet(group: THREE.Group, color: number, y: number, spread: number, z: number) {
  for (const s of [-1, 1]) {
    const f = limb(ICO(0.24, 1), color); f.scale.set(1.05, 0.8, 1.35); f.position.set(s * spread, y, z); group.add(f);
  }
}

function buildCritter(body: THREE.Group, grad: [number, number, number], fo: FaceOpts, rng: () => number, jit: (h: number) => number): Head {
  const w = 0.95 + rng() * 0.18;
  const bGeo = ICO(0.88, 1); const bm = gradMesh(bGeo, grad);
  bm.scale.set(0.96, 1.3 * w, 0.92); bm.position.y = 1.06; body.add(bm);
  for (const s of [-1, 1]) { const a = limb(ICO(0.2, 1), jit(grad[1])); a.scale.set(0.85, 1.3, 0.85); a.position.set(s * 0.78, 0.66, 0.16); a.rotation.z = s * 0.6; body.add(a); }
  feet(body, jit(grad[2]), 0.17, 0.4, 0.28);
  addFace(body, 0, 1.24, 0.78, 0.55, fo);
  return { x: 0, y: 2.0, z: 0.02, r: 0.6 };
}

function buildBiped(body: THREE.Group, grad: [number, number, number], fo: FaceOpts, rng: () => number, jit: (h: number) => number): Head {
  const th = 0.9 + rng() * 0.4;          // torso height variation
  const torso = gradMesh(ICO(0.62, 1), grad); torso.scale.set(0.82, th, 0.72); torso.position.y = 0.9; body.add(torso);
  const head = gradMesh(ICO(0.5, 1), grad); head.scale.set(1, 0.95, 0.95); head.position.y = 0.9 + th * 0.62 + 0.32; body.add(head);
  const hy = head.position.y;
  // arms
  for (const s of [-1, 1]) { const a = limb(CONE(0.16, 0.6, 5), jit(grad[1])); a.position.set(s * 0.62, 1.0, 0.05); a.rotation.z = s * 1.0; body.add(a); }
  // legs
  for (const s of [-1, 1]) { const l = limb(ICO(0.2, 1), jit(grad[2])); l.scale.set(1, 1.3, 1.2); l.position.set(s * 0.3, 0.28, 0.12); body.add(l); }
  // tail
  if (rng() < 0.7) for (let i = 0; i < 3; i++) { const t = limb(ICO(0.16 - i * 0.04, 0), jit(grad[2])); t.position.set(0, 0.7 - i * 0.12, -0.5 - i * 0.22); body.add(t); }
  addFace(body, 0, hy + 0.02, 0.46, 0.4, fo);
  return { x: 0, y: hy + 0.5, z: 0.02, r: 0.5 };
}

function buildQuadruped(body: THREE.Group, grad: [number, number, number], fo: FaceOpts, rng: () => number, jit: (h: number) => number): Head {
  const len = 1.2 + rng() * 0.3;
  const torso = gradMesh(ICO(0.62, 1), grad); torso.scale.set(0.85, 0.82, len); torso.position.set(0, 0.62, -0.1); body.add(torso);
  const head = gradMesh(ICO(0.46, 1), grad); head.scale.set(1, 0.9, 0.95); head.position.set(0, 0.74, 0.62); body.add(head);
  // 4 legs
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const l = limb(new THREE.CylinderGeometry(0.12, 0.1, 0.5, 6), jit(grad[2])); l.position.set(sx * 0.34, 0.25, 0.32 + sz * 0.42 - 0.1); body.add(l); }
  // tail
  for (let i = 0; i < 3; i++) { const t = limb(ICO(0.14 - i * 0.03, 0), jit(grad[2])); t.position.set(0, 0.62 + i * 0.06, -0.7 - i * 0.2); body.add(t); }
  addFace(body, 0, 0.8, 1.02, 0.4, fo);
  return { x: 0, y: 1.12, z: 0.55, r: 0.46 };
}

function buildAquatic(body: THREE.Group, grad: [number, number, number], fo: FaceOpts, rng: () => number, jit: (h: number) => number): Head {
  const bGeo = ICO(0.8, 1); const bm = gradMesh(bGeo, grad);
  bm.scale.set(0.95, 1.0, 1.25 + rng() * 0.2); bm.position.y = 0.95; body.add(bm);
  // tail fin
  for (const sgn of [-1, 1]) { const tf = limb(CONE(0.16, 0.5, 3), jit(grad[1])); tf.scale.set(0.4, 1, 1); tf.position.set(0, 0.95 + sgn * 0.18, -1.05); tf.rotation.x = Math.PI / 2 + sgn * 0.5; body.add(tf); }
  // side fins
  for (const s of [-1, 1]) { const sf = limb(CONE(0.14, 0.4, 3), jit(grad[1])); sf.scale.set(0.4, 1, 1); sf.position.set(s * 0.7, 0.85, 0.1); sf.rotation.z = s * 1.4; body.add(sf); }
  addFace(body, 0, 1.06, 1.0, 0.5, fo);
  return { x: 0, y: 1.7, z: 0.05, r: 0.5 };
}

function buildAvian(body: THREE.Group, grad: [number, number, number], fo: FaceOpts, rng: () => number, jit: (h: number) => number): Head {
  const bm = gradMesh(ICO(0.62, 1), grad); bm.scale.set(0.95, 1.05, 0.95); bm.position.y = 0.85; body.add(bm);
  const head = gradMesh(ICO(0.42, 1), grad); head.position.set(0, 1.45, 0.08); body.add(head);
  // beak
  const beak = limb(CONE(0.12, 0.26, 4), 0xffb02a); beak.rotation.x = Math.PI / 2; beak.position.set(0, 1.4, 0.5); body.add(beak);
  // wings
  for (const s of [-1, 1]) { const wg = limb(CONE(0.26, 0.7, 3), jit(grad[1])); wg.scale.set(0.45, 1, 0.18); wg.position.set(s * 0.5, 0.9, -0.05); wg.rotation.set(0.2, 0, s * 1.2); body.add(wg); }
  // legs
  for (const s of [-1, 1]) { const l = limb(new THREE.CylinderGeometry(0.05, 0.05, 0.4, 5), 0xffb02a); l.position.set(s * 0.18, 0.3, 0.05); body.add(l); }
  // tail feathers
  for (const sgn of [-1, 0, 1]) { const t = limb(CONE(0.1, 0.45, 3), jit(grad[2])); t.scale.set(0.5, 1, 1); t.position.set(sgn * 0.12, 0.75, -0.6); t.rotation.x = -1.9; body.add(t); }
  addFace(body, 0, 1.5, 0.48, 0.34, fo);
  return { x: 0, y: 1.85, z: 0.05, r: 0.42 };
}

function buildSpectral(body: THREE.Group, grad: [number, number, number], fo: FaceOpts, rng: () => number, jit: (h: number) => number): Head {
  const bm = gradMesh(ICO(0.72, 1), grad); bm.scale.set(0.95, 1.15, 0.92); bm.position.y = 1.1;
  (bm.material as THREE.MeshStandardMaterial).transparent = true;
  (bm.material as THREE.MeshStandardMaterial).opacity = 0.92;
  (bm.material as THREE.MeshStandardMaterial).emissive = new THREE.Color(grad[2]);
  (bm.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.25;
  body.add(bm);
  // wispy tail (tapering downward, no legs)
  for (let i = 0; i < 4; i++) { const t = limb(ICO(0.3 - i * 0.06, 1), jit(grad[2])); t.position.set(Math.sin(i) * 0.1, 0.65 - i * 0.16, 0); body.add(t); }
  // floating wisp arms
  for (const s of [-1, 1]) { const a = limb(ICO(0.14, 1), jit(grad[1])); a.position.set(s * 0.7, 1.0, 0.1); body.add(a); }
  addFace(body, 0, 1.2, 0.64, 0.5, { ...fo, eyeR: fo.eyeR * 1.1 });
  return { x: 0, y: 1.95, z: 0.02, r: 0.55 };
}

export function countTriangles(obj: THREE.Object3D): number {
  let tris = 0;
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.geometry) {
      const g = m.geometry as THREE.BufferGeometry;
      if (g.index) tris += g.index.count / 3; else if (g.attributes.position) tris += g.attributes.position.count / 3;
    }
  });
  return Math.round(tris);
}
