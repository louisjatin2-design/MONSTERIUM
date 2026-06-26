// ---------------------------------------------------------------------------
// Procedural low-poly 3D monster generator
//
// Each monster is built from an ARCHETYPE chosen by its element family
// (biped / quadruped / aquatic / avian / spectral / critter) plus per-monster
// seeded variation (proportions, horns, eye count, ears, back-ridge, belly
// patch, tail tip, spots, wings). The element drives a baked colour gradient +
// crest + eye colour; rarity adds embellishments; the FACTION adds good/evil
// lore traits. Every species therefore gets a genuinely different, detailed
// silhouette while staying tiny (a few thousand triangles) and 100% generated
// from data.
//
// AGE STAGES — a monster renders as a DIFFERENT model for each evolution stage
// (Baby → Juvenile → Adult → Elder). A `STAGE_PROFILE` reshapes the same base
// species: babies are big-headed, big-eyed and crest-less; juveniles sprout a
// small crest and ridge; adults reach full proportions and ornaments; elders
// grow bulkier with a mane, extra horns and battle scars. The species identity
// (colours, ears, ridge type, …) is seeded independently of the stage, so a
// monster keeps its look as it ages — it just grows into it.
// ---------------------------------------------------------------------------
import * as THREE from 'three';

export type VisualStage = 'Baby' | 'Juvenile' | 'Adult' | 'Elder';

export interface MonsterVisualSpec {
  id: string;
  elementColor: number;
  accentColor: number;
  rarityRank: number;
  element: string;
  // Gruppe 2 — Gut/Böse-Designs: die Fraktion (aus getMonsterFaction) verleiht
  // dem Modell sichtbare Lore-Merkmale. 'Good' → leuchtende Beschützer-Aura,
  // 'Evil' → finstere Dämonen-Hörner/Glut. Optional; Default = neutral.
  faction?: 'Good' | 'Evil' | 'Neutral';
  // Evolutionsstufe → eigenes Modell pro Alter (Baby/Juvenile/Adult/Elder).
  // Optional; Default = 'Adult' (volle Proportionen).
  stage?: VisualStage;
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
const pickInt = (rng: () => number, a: number, b: number) => a + Math.floor(rng() * (b - a + 1));

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
const BOX = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);

// --- age-stage profiles ----------------------------------------------------
// Each stage reshapes the SAME species into a recognisably different model.
interface StageProfile {
  key: VisualStage;
  body: number;        // torso bulk multiplier
  head: number;        // head size relative to body (babies are big-headed)
  limb: number;        // limb length/thickness (babies stubby, elders sturdy)
  eye: number;         // eye size (babies have huge eyes)
  crest: number;       // crest/horn growth (0 = not grown in yet)
  feature: number;     // 0..3 → how many detail features have grown in
  wings: boolean;      // can wings appear at this age?
  mane: boolean;       // elder neck mane / beard
  extraHorns: boolean; // elder secondary horns
  scars: boolean;      // elder battle scars / cracks
  weather: number;     // colour multiplier (elders weather a little darker)
  detail: number;      // geometry subdivision bump for adults/elders
}
const STAGE_PROFILES: Record<VisualStage, StageProfile> = {
  Baby:     { key: 'Baby',     body: 0.82, head: 1.42, limb: 0.78, eye: 1.4,  crest: 0.0,  feature: 0, wings: false, mane: false, extraHorns: false, scars: false, weather: 1.06, detail: 0 },
  Juvenile: { key: 'Juvenile', body: 0.92, head: 1.16, limb: 0.9,  eye: 1.15, crest: 0.55, feature: 1, wings: true,  mane: false, extraHorns: false, scars: false, weather: 1.0,  detail: 0 },
  Adult:    { key: 'Adult',    body: 1.0,  head: 1.0,  limb: 1.0,  eye: 1.0,  crest: 1.0,  feature: 2, wings: true,  mane: false, extraHorns: false, scars: false, weather: 1.0,  detail: 1 },
  Elder:    { key: 'Elder',    body: 1.12, head: 0.96, limb: 1.1,  eye: 0.92, crest: 1.3,  feature: 3, wings: true,  mane: true,  extraHorns: true,  scars: true,  weather: 0.86, detail: 1 },
};

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

// --- shared face (eyes / brows / cheeks / smile), facing +z ----------------
// `frontZ` is the eyeball plane (placed right on the head's front surface so
// the eyes are seated in the body, never floating); `spacingR` is the head
// radius and drives eye separation + cheek/mouth offsets.
interface FaceOpts { eyeCount: number; eyeR: number; cheeks: boolean; brows: boolean; iris: number; rng: () => number; }
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
  // Brows give older monsters a fiercer, more characterful face.
  if (o.brows) {
    const bm = mat(shade(o.iris, 0.45), { roughness: 0.5 });
    for (const fx of xs) {
      const br = new THREE.Mesh(BOX(r * 1.3, r * 0.32, r * 0.32), bm);
      br.position.set(cx + fx * spacingR, cy + r * 1.15, ballZ + r * 0.2);
      br.rotation.z = (fx === 0 ? 0 : fx > 0 ? -1 : 1) * 0.28;
      group.add(br);
    }
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
// Per-species detail features. These read from a STABLE trait set (seeded from
// the id, independent of the age stage) and a StageProfile that gates how much
// of each feature has grown in. The same monster therefore keeps its identity
// across ages while clearly looking like a different model at each stage.
// ===========================================================================
interface SpeciesTraits {
  earType: number;     // 0 none · 1 pointy · 2 round · 3 long/floppy
  ridgeType: number;   // 0 none · 1 spikes · 2 plates · 3 tall sail
  bellyPatch: boolean;
  bellyColor: number;
  brows: boolean;
  tailTip: number;     // 0 none · 1 spike · 2 tuft · 3 orb
  spineMode: 'vertical' | 'horizontal';
}

function speciesTraits(id: string, grad: [number, number, number], family: string): SpeciesTraits {
  const t = mulberry32(hashStr(id + '#traits'));
  return {
    earType: family === 'avian' || family === 'aquatic' ? (t() < 0.3 ? 1 : 0) : pickInt(t, 0, 3),
    ridgeType: pickInt(t, 0, 3),
    bellyPatch: t() < 0.55,
    bellyColor: shade(grad[0], 1.22),
    brows: t() < 0.5,
    tailTip: pickInt(t, 0, 3),
    spineMode: family === 'quadruped' || family === 'aquatic' ? 'horizontal' : 'vertical',
  };
}

function addEars(group: THREE.Group, head: Head, color: number, type: number, prof: StageProfile) {
  if (!type) return;
  const r = head.r;
  const cute = prof.key === 'Baby' ? 1.15 : 1;
  for (const s of [-1, 1]) {
    let ear: THREE.Mesh;
    if (type === 1) { // pointy
      ear = limb(CONE(0.12, 0.42, 4), color);
      ear.position.set(head.x + s * r * 0.95, head.y + r * 0.2, head.z - 0.06);
      ear.rotation.z = s * -0.45;
    } else if (type === 2) { // round
      ear = limb(ICO(0.17, 1), color); ear.scale.set(0.7, 0.95, 0.45);
      ear.position.set(head.x + s * r * 1.02, head.y + r * 0.05, head.z - 0.06);
    } else { // long / floppy
      ear = limb(CONE(0.1, 0.6, 4), color); ear.scale.set(0.7, 1, 0.55);
      ear.position.set(head.x + s * r * 0.92, head.y - r * 0.1, head.z - 0.06);
      ear.rotation.z = s * -1.0;
    }
    ear.scale.multiplyScalar(cute);
    group.add(ear);
  }
}

function addBackRidge(group: THREE.Group, grad: [number, number, number], jit: (h: number) => number, head: Head, type: number, mode: 'vertical' | 'horizontal', prof: StageProfile) {
  if (!type) return;
  const col = jit(grad[2]);
  const n = type === 3 ? 6 : type === 2 ? 5 : 4;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const bell = 0.55 + (1 - Math.abs(t - 0.4) * 1.6);      // bigger mid-back
    const sz = (type === 2 ? 0.2 : 0.17) * Math.max(0.4, bell) * (0.7 + prof.feature * 0.12);
    let geo: THREE.BufferGeometry;
    if (type === 2) geo = BOX(0.07, sz * 1.5, 0.24);        // plates
    else if (type === 3) geo = CONE(0.05, sz * 2.6, 3);     // tall sail
    else geo = CONE(0.1, sz * 1.7, 4);                      // spikes
    const sp = new THREE.Mesh(geo, mat(col, { roughness: 0.6 }));
    if (mode === 'horizontal') {
      sp.position.set(0, head.y * 0.9 + 0.05, head.z - 0.25 - t * 1.25);
    } else {
      sp.position.set(0, head.y * 0.78 - t * (head.y * 0.55), -0.42);
      sp.rotation.x = -0.32;
    }
    sp.castShadow = true;
    group.add(sp);
  }
}

function addBellyPatch(group: THREE.Group, color: number, family: string, head: Head) {
  const patch = new THREE.Mesh(SPH(0.34, 12, 10), mat(color, { roughness: 0.72 }));
  patch.scale.set(0.66, 1.0, 0.34);
  const y = family === 'quadruped' ? 0.55 : family === 'aquatic' ? 0.9 : head.y * 0.42 + 0.2;
  const z = family === 'quadruped' ? 0.5 : family === 'avian' ? 0.42 : 0.5;
  patch.position.set(0, y, z);
  group.add(patch);
}

function addTailTip(group: THREE.Group, color: number, type: number, mode: 'vertical' | 'horizontal') {
  if (!type) return;
  const pos = mode === 'horizontal'
    ? new THREE.Vector3(0, 0.62, -1.05)
    : new THREE.Vector3(0, 0.42, -0.86);
  let mesh: THREE.Mesh;
  if (type === 1) { mesh = limb(CONE(0.13, 0.32, 4), color); mesh.rotation.x = -0.6; }
  else if (type === 2) { mesh = limb(ICO(0.17, 1), color); mesh.scale.set(1, 1.2, 1); }
  else { mesh = limb(ICO(0.15, 0), shade(color, 1.3)); (mesh.material as THREE.MeshStandardMaterial).metalness = 0.35; }
  mesh.position.copy(pos);
  group.add(mesh);
}

// --- elder-only ornaments --------------------------------------------------
function addMane(group: THREE.Group, head: Head, color: number) {
  const m = mat(color, { roughness: 0.9 });
  const n = 11;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const tuft = new THREE.Mesh(CONE(0.12, 0.42, 3), m);
    const rr = head.r * 1.0;
    tuft.position.set(head.x + Math.cos(a) * rr, head.y - head.r * 0.55, head.z + Math.sin(a) * rr * 0.7);
    tuft.rotation.set(Math.sin(a) * 0.6, 0, Math.cos(a) * -0.7);
    group.add(tuft);
  }
}
function addElderHorns(group: THREE.Group, head: Head, color: number) {
  const m = mat(color, { roughness: 0.45, metalness: 0.15 });
  for (const s of [-1, 1]) {
    const horn = new THREE.Mesh(CONE(0.1, 0.62, 4), m);
    horn.position.set(head.x + s * head.r * 0.7, head.y + head.r * 0.35, head.z - head.r * 0.3);
    horn.rotation.set(-0.5, 0, s * -0.75);
    group.add(horn);
  }
}
function addScars(group: THREE.Group, head: Head, rng: () => number) {
  const m = mat(0x1a1414, { roughness: 0.8 });
  const n = 2 + Math.floor(rng() * 2);
  for (let i = 0; i < n; i++) {
    const scar = new THREE.Mesh(BOX(0.03, 0.22 + rng() * 0.18, 0.03), m);
    scar.position.set((rng() - 0.5) * 0.7, head.y * (0.3 + rng() * 0.4), 0.42 + rng() * 0.18);
    scar.rotation.z = (rng() - 0.5) * 1.4;
    group.add(scar);
  }
}

// ===========================================================================
export function buildLowPolyMonster(spec: MonsterVisualSpec): THREE.Group {
  const rng = mulberry32(hashStr(spec.id));
  const art = artFor(spec);
  const prof = STAGE_PROFILES[spec.stage ?? 'Adult'];
  // Per-monster jitter so two same-element monsters still differ. Elders weather
  // a touch darker (prof.weather) so age reads in the palette too.
  const jit = (hex: number) => shade(hex, (0.9 + rng() * 0.22) * prof.weather);
  const grad: [number, number, number] = [jit(art.grad[0]), jit(art.grad[1]), jit(art.grad[2])];
  const mid = grad[1], deep = grad[2];

  // Species identity (stable across ages).
  const traits = speciesTraits(spec.id, grad, art.family);

  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const eyeR = (0.18 + rng() * 0.06) * prof.eye;
  const eyeCount = rng() < 0.12 ? (rng() < 0.5 ? 1 : 3) : 2;
  const cheeksSeed = art.family !== 'spectral' && art.family !== 'quadruped' ? rng() < 0.8 : rng() < 0.3;
  const cheeks = prof.key === 'Baby' ? true : cheeksSeed;           // babies always rosy-cheeked
  const wings = (spec.rarityRank >= 4 || rng() < 0.18) && prof.wings;
  const showBrows = traits.brows && prof.feature >= 2;              // brows on adults/elders
  const faceOpts: FaceOpts = { eyeCount, eyeR, cheeks, brows: showBrows, iris: art.eye, rng };

  const headTop = (art.family === 'biped' ? buildBiped
    : art.family === 'quadruped' ? buildQuadruped
    : art.family === 'aquatic' ? buildAquatic
    : art.family === 'avian' ? buildAvian
    : art.family === 'spectral' ? buildSpectral
    : buildCritter)(body, grad, faceOpts, rng, jit, prof);

  // Crest on the head crown — grows in with age (babies show only a soft bud).
  if (prof.crest > 0.05) {
    const crest = buildCrest(art, rng);
    crest.position.set(headTop.x, headTop.y, headTop.z);
    crest.scale.setScalar(headTop.r * 1.4 * prof.crest);
    body.add(crest);
  } else {
    const bud = new THREE.Mesh(ICO(headTop.r * 0.32, 1), mat(jit(mid), { roughness: 0.7 }));
    bud.position.set(headTop.x, headTop.y + headTop.r * 0.1, headTop.z - 0.04);
    body.add(bud);
  }

  // Ears — part of the species silhouette from birth (babies get cuter ones).
  addEars(body, headTop, jit(mid), traits.earType, prof);

  // Back ridge sprouts from juvenile up, growing taller each stage.
  if (prof.feature >= 1) addBackRidge(body, grad, jit, headTop, traits.ridgeType, traits.spineMode, prof);

  // Belly patch — a lighter front, present once a bit grown.
  if (traits.bellyPatch && prof.feature >= 1) addBellyPatch(body, traits.bellyColor, art.family, headTop);

  // Tail-tip ornament fully forms on adults/elders.
  if (prof.feature >= 2) addTailTip(body, jit(deep), traits.tailTip, traits.spineMode);

  if (wings) addWings(body, headTop.y * 0.55, -0.3, jit(mid));

  // Elder-only ornaments: a neck mane, secondary horns and battle scars.
  if (prof.mane) addMane(body, headTop, jit(deep));
  if (prof.extraHorns) addElderHorns(body, headTop, deep);
  if (prof.scars) addScars(body, headTop, mulberry32(hashStr(spec.id + '#scars')));

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

  // --- Gruppe 2: Fraktions-Design (Gut vs. Böse) ----------------------------
  // Gut = legendärer Beschützer (leuchtender Heiligenschein + helle Aura),
  // Böse = zerstörerischer Dämon (geschwungene Glut-Hörner + rote Aura-Glut).
  // Je höher die Seltenheit, desto ausgeprägter das Merkmal.
  if (spec.faction === 'Good') {
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(0.5, 0.05, 8, 24),
      mat(0xffe066, { emissive: 0xffd24a, emissiveIntensity: 0.9, metalness: 0.3, roughness: 0.2 }),
    );
    halo.name = 'pulse';
    halo.rotation.x = Math.PI / 2;
    halo.position.set(headTop.x, headTop.y + 0.55 + spec.rarityRank * 0.05, headTop.z);
    body.add(halo);
  } else if (spec.faction === 'Evil') {
    const glow = mat(0xff3b3b, { emissive: 0xc41818, emissiveIntensity: 0.7 + spec.rarityRank * 0.12, roughness: 0.4 });
    for (const sgn of [-1, 1]) {
      const horn = new THREE.Mesh(CONE(0.1, 0.55 + spec.rarityRank * 0.06, 4), glow);
      horn.position.set(headTop.x + sgn * 0.34, headTop.y + 0.22, headTop.z - 0.04);
      horn.rotation.z = sgn * -0.55;
      body.add(horn);
    }
  }

  // Ground shadow. Faction tints it (gold for protectors, blood-red for demons).
  const shadowColor = spec.faction === 'Good' ? 0x6a5a10 : spec.faction === 'Evil' ? 0x3a0808 : 0x000000;
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.8, 14), new THREE.MeshBasicMaterial({ color: shadowColor, transparent: true, opacity: 0.22 }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.01; root.add(shadow);

  root.userData.body = body;
  root.userData.stage = prof.key;
  return root;
}

type Head = { x: number; y: number; z: number; r: number };

// --- ARCHETYPES ------------------------------------------------------------
// Each archetype takes the StageProfile so it can reshape proportions per age:
// body bulk, head size, limb length and where the head crown sits.
function feet(group: THREE.Group, color: number, y: number, spread: number, z: number, limbMul: number) {
  for (const s of [-1, 1]) {
    const f = limb(ICO(0.24, 1), color); f.scale.set(1.05, 0.8 * limbMul, 1.35); f.position.set(s * spread, y, z); group.add(f);
  }
}

function buildCritter(body: THREE.Group, grad: [number, number, number], fo: FaceOpts, rng: () => number, jit: (h: number) => number, prof: StageProfile): Head {
  const w = 0.95 + rng() * 0.18;
  const bGeo = ICO(0.88, 1 + prof.detail); const bm = gradMesh(bGeo, grad);
  bm.scale.set(0.96 * prof.body, 1.3 * w * prof.body, 0.92 * prof.body); bm.position.y = 1.06 * prof.body; body.add(bm);
  for (const s of [-1, 1]) { const a = limb(ICO(0.2, 1), jit(grad[1])); a.scale.set(0.85, 1.3 * prof.limb, 0.85); a.position.set(s * 0.78 * prof.body, 0.66 * prof.body, 0.16); a.rotation.z = s * 0.6; body.add(a); }
  feet(body, jit(grad[2]), 0.17, 0.4 * prof.body, 0.28, prof.limb);
  const hy = 1.24 * prof.body;
  addFace(body, 0, hy, 0.78 * prof.body, 0.55 * prof.head, fo);
  return { x: 0, y: hy + 0.7 * prof.head, z: 0.02, r: 0.6 * prof.head };
}

function buildBiped(body: THREE.Group, grad: [number, number, number], fo: FaceOpts, rng: () => number, jit: (h: number) => number, prof: StageProfile): Head {
  const th = (0.9 + rng() * 0.4) * prof.body;          // torso height variation
  const torso = gradMesh(ICO(0.62, 1 + prof.detail), grad); torso.scale.set(0.82 * prof.body, th, 0.72 * prof.body); torso.position.y = 0.9; body.add(torso);
  const head = gradMesh(ICO(0.5, 1 + prof.detail), grad); head.scale.set(prof.head, 0.95 * prof.head, 0.95 * prof.head); head.position.y = 0.9 + th * 0.62 + 0.32 * prof.head; body.add(head);
  const hy = head.position.y;
  const hr = 0.5 * prof.head;
  // arms
  for (const s of [-1, 1]) { const a = limb(CONE(0.16, 0.6 * prof.limb, 5), jit(grad[1])); a.position.set(s * 0.62 * prof.body, 1.0, 0.05); a.rotation.z = s * 1.0; body.add(a); }
  // legs
  for (const s of [-1, 1]) { const l = limb(ICO(0.2, 1), jit(grad[2])); l.scale.set(1, 1.3 * prof.limb, 1.2); l.position.set(s * 0.3, 0.28 * prof.limb, 0.12); body.add(l); }
  // tail
  if (rng() < 0.7) for (let i = 0; i < 3; i++) { const t = limb(ICO(0.16 - i * 0.04, 0), jit(grad[2])); t.position.set(0, 0.7 - i * 0.12, -0.5 - i * 0.22); body.add(t); }
  addFace(body, 0, hy + 0.02, 0.46 * prof.head, 0.4 * prof.head, fo);
  return { x: 0, y: hy + hr, z: 0.02, r: hr };
}

function buildQuadruped(body: THREE.Group, grad: [number, number, number], fo: FaceOpts, rng: () => number, jit: (h: number) => number, prof: StageProfile): Head {
  const len = (1.2 + rng() * 0.3) * prof.body;
  const torso = gradMesh(ICO(0.62, 1 + prof.detail), grad); torso.scale.set(0.85 * prof.body, 0.82 * prof.body, len); torso.position.set(0, 0.62 * prof.body, -0.1); body.add(torso);
  const head = gradMesh(ICO(0.46, 1 + prof.detail), grad); head.scale.set(prof.head, 0.9 * prof.head, 0.95 * prof.head); head.position.set(0, 0.74 * prof.body, 0.62); body.add(head);
  // 4 legs
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const l = limb(new THREE.CylinderGeometry(0.12, 0.1, 0.5 * prof.limb, 6), jit(grad[2])); l.position.set(sx * 0.34, 0.25 * prof.limb, 0.32 + sz * 0.42 - 0.1); body.add(l); }
  // tail
  for (let i = 0; i < 3; i++) { const t = limb(ICO(0.14 - i * 0.03, 0), jit(grad[2])); t.position.set(0, 0.62 + i * 0.06, -0.7 - i * 0.2); body.add(t); }
  addFace(body, 0, 0.8 * prof.body, 1.02, 0.4 * prof.head, fo);
  return { x: 0, y: head.position.y + 0.38 * prof.head, z: 0.55, r: 0.46 * prof.head };
}

function buildAquatic(body: THREE.Group, grad: [number, number, number], fo: FaceOpts, rng: () => number, jit: (h: number) => number, prof: StageProfile): Head {
  const bGeo = ICO(0.8, 1 + prof.detail); const bm = gradMesh(bGeo, grad);
  bm.scale.set(0.95 * prof.body, 1.0 * prof.body, (1.25 + rng() * 0.2) * prof.body); bm.position.y = 0.95 * prof.body; body.add(bm);
  // tail fin
  for (const sgn of [-1, 1]) { const tf = limb(CONE(0.16, 0.5, 3), jit(grad[1])); tf.scale.set(0.4, 1, 1); tf.position.set(0, 0.95 * prof.body + sgn * 0.18, -1.05 * prof.body); tf.rotation.x = Math.PI / 2 + sgn * 0.5; body.add(tf); }
  // side fins
  for (const s of [-1, 1]) { const sf = limb(CONE(0.14, 0.4, 3), jit(grad[1])); sf.scale.set(0.4, 1, 1); sf.position.set(s * 0.7 * prof.body, 0.85 * prof.body, 0.1); sf.rotation.z = s * 1.4; body.add(sf); }
  const hy = 1.06 * prof.body;
  addFace(body, 0, hy, 1.0 * prof.body, 0.5 * prof.head, fo);
  return { x: 0, y: hy + 0.64 * prof.head, z: 0.05, r: 0.5 * prof.head };
}

function buildAvian(body: THREE.Group, grad: [number, number, number], fo: FaceOpts, rng: () => number, jit: (h: number) => number, prof: StageProfile): Head {
  const bm = gradMesh(ICO(0.62, 1 + prof.detail), grad); bm.scale.set(0.95 * prof.body, 1.05 * prof.body, 0.95 * prof.body); bm.position.y = 0.85 * prof.body; body.add(bm);
  const head = gradMesh(ICO(0.42, 1 + prof.detail), grad); head.scale.setScalar(prof.head); head.position.set(0, 0.85 * prof.body + 0.6 * prof.head, 0.08); body.add(head);
  const hy = head.position.y;
  // beak
  const beak = limb(CONE(0.12, 0.26, 4), 0xffb02a); beak.rotation.x = Math.PI / 2; beak.position.set(0, hy - 0.05, 0.42 * prof.head + 0.2); body.add(beak);
  // wings
  for (const s of [-1, 1]) { const wg = limb(CONE(0.26, 0.7 * prof.limb, 3), jit(grad[1])); wg.scale.set(0.45, 1, 0.18); wg.position.set(s * 0.5 * prof.body, 0.9 * prof.body, -0.05); wg.rotation.set(0.2, 0, s * 1.2); body.add(wg); }
  // legs
  for (const s of [-1, 1]) { const l = limb(new THREE.CylinderGeometry(0.05, 0.05, 0.4 * prof.limb, 5), 0xffb02a); l.position.set(s * 0.18, 0.3 * prof.limb, 0.05); body.add(l); }
  // tail feathers
  for (const sgn of [-1, 0, 1]) { const t = limb(CONE(0.1, 0.45, 3), jit(grad[2])); t.scale.set(0.5, 1, 1); t.position.set(sgn * 0.12, 0.75 * prof.body, -0.6); t.rotation.x = -1.9; body.add(t); }
  addFace(body, 0, hy + 0.05, 0.46 * prof.head, 0.34 * prof.head, fo);
  return { x: 0, y: hy + 0.4 * prof.head, z: 0.05, r: 0.42 * prof.head };
}

function buildSpectral(body: THREE.Group, grad: [number, number, number], fo: FaceOpts, rng: () => number, jit: (h: number) => number, prof: StageProfile): Head {
  const bm = gradMesh(ICO(0.72, 1 + prof.detail), grad); bm.scale.set(0.95 * prof.body, 1.15 * prof.body, 0.92 * prof.body); bm.position.y = 1.1 * prof.body;
  (bm.material as THREE.MeshStandardMaterial).transparent = true;
  (bm.material as THREE.MeshStandardMaterial).opacity = 0.92;
  (bm.material as THREE.MeshStandardMaterial).emissive = new THREE.Color(grad[2]);
  (bm.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.25;
  body.add(bm);
  // wispy tail (tapering downward, no legs)
  for (let i = 0; i < 4; i++) { const t = limb(ICO(0.3 - i * 0.06, 1), jit(grad[2])); t.position.set(Math.sin(i) * 0.1, 0.65 * prof.body - i * 0.16, 0); body.add(t); }
  // floating wisp arms
  for (const s of [-1, 1]) { const a = limb(ICO(0.14, 1), jit(grad[1])); a.position.set(s * 0.7 * prof.body, 1.0 * prof.body, 0.1); body.add(a); }
  const hy = 1.2 * prof.body;
  addFace(body, 0, hy, 0.64 * prof.body, 0.5 * prof.head, { ...fo, eyeR: fo.eyeR * 1.1 });
  return { x: 0, y: hy + 0.75 * prof.head, z: 0.02, r: 0.55 * prof.head };
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
