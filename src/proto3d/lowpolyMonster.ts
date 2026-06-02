// ---------------------------------------------------------------------------
// Procedural low-poly 3D monster generator (PROOF OF CONCEPT)
//
// Builds a faceted, flat-shaded creature entirely from code — no modeling tool,
// no mesh files. Everything is derived deterministically from a monster's
// element + rarity, so the same generator scales to every monster for free.
//
// Art direction (matching the reference look): a vertical colour GRADIENT baked
// into the body via vertex colours (hot top -> deep bottom), a chibi head/body
// silhouette with stubby arms + legs, big faceted "gem" eyes, and a per-element
// CREST (flame fan, ice shards, bolts, rock chunks...). The crest + palette +
// eye colour are what make each element feel individual.
// ---------------------------------------------------------------------------
import * as THREE from 'three';

export interface MonsterVisualSpec {
  /** Stable id — seeds the deterministic per-monster variation. */
  id: string;
  /** Primary body colour (hex) — used as the gradient mid-tone fallback. */
  elementColor: number;
  /** Rarity accent / aura colour (hex). */
  accentColor: number;
  /** Rarity rank 0..7 — drives glow strength and gem count. */
  rarityRank: number;
  /** Element name — selects palette, crest and eye colour. */
  element: string;
}

// --- tiny deterministic RNG so each monster looks consistent every load ----
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

// Flat-shaded standard material — the source of the crisp low-poly facets.
function mat(color: number, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.55, metalness: 0.05, ...opts });
}

// Low-poly primitives (low detail/segment counts == few triangles).
const ICO = (r: number, d = 1) => new THREE.IcosahedronGeometry(r, d);
const CONE = (r: number, h: number, seg = 5) => new THREE.ConeGeometry(r, h, seg);

// --- Per-element art tables -------------------------------------------------
// Body gradient, top (hot/light) -> bottom (deep). Eye = iris gem colour.
interface ElementArt { grad: [number, number, number]; eye: number; crest: string; }
const ELEMENT_ART: Record<string, ElementArt> = {
  Fire:     { grad: [0xffe24a, 0xff7a1f, 0xe23a5e], eye: 0x8a0f12, crest: 'flame' },
  Combat:   { grad: [0xffb07a, 0xff6347, 0xb03020], eye: 0x6a1208, crest: 'flame' },
  Demon:    { grad: [0xff5a4a, 0xb01818, 0x5e0808], eye: 0xffcc00, crest: 'horns' },
  Water:    { grad: [0x9fe0ff, 0x2f8fe0, 0x14579e], eye: 0x0d3a6a, crest: 'fin' },
  Ice:      { grad: [0xffffff, 0xe2f3ff, 0xa9d8f0], eye: 0x1fa8e6, crest: 'shard' },
  Crystal:  { grad: [0xffffff, 0xd6f7ff, 0x8fd8e8], eye: 0x2aa0c0, crest: 'shard' },
  Electric: { grad: [0xfff7a8, 0xffd400, 0xd98e00], eye: 0x6a4a00, crest: 'bolt'  },
  Earth:    { grad: [0xc79a5c, 0x8a5a2a, 0x55351a], eye: 0x2a1808, crest: 'rock'  },
  Metal:    { grad: [0xeef1f5, 0xb6bcc6, 0x7a818c], eye: 0x303640, crest: 'rock'  },
  Sand:     { grad: [0xf6e0a8, 0xe0b46a, 0xb07f3a], eye: 0x5a3a14, crest: 'rock'  },
  Air:      { grad: [0xffffff, 0xd6efff, 0xaad0ea], eye: 0x4a7fa0, crest: 'fluff' },
  Plant:    { grad: [0x9fe06a, 0x3fae3a, 0x1f6e22], eye: 0x123a10, crest: 'leaf'  },
  Poison:   { grad: [0xd06aff, 0x8b008b, 0x4a0040], eye: 0xbaff3a, crest: 'horns' },
  Light:    { grad: [0xffffe0, 0xfff099, 0xe0c860], eye: 0xc89a20, crest: 'fluff' },
  Darkness: { grad: [0x6a4a9a, 0x33155a, 0x140828], eye: 0xb98cff, crest: 'horns' },
  Magic:    { grad: [0xf2b8ff, 0xda70d6, 0x8a2a86], eye: 0x4a0a48, crest: 'horns' },
  Psycho:   { grad: [0xffc0ff, 0xee82ee, 0xa040a0], eye: 0x5a1a5a, crest: 'horns' },
};

function artFor(spec: MonsterVisualSpec): ElementArt {
  const a = ELEMENT_ART[spec.element];
  if (a) return a;
  // Derive a sensible gradient from the base colour for any other element.
  return {
    grad: [shade(spec.elementColor, 1.55), spec.elementColor, shade(spec.elementColor, 0.55)],
    eye: shade(spec.elementColor, 0.4),
    crest: 'horns',
  };
}

// Bake a vertical gradient (top->bottom) into a geometry as vertex colours.
function applyVerticalGradient(geo: THREE.BufferGeometry, stops: number[]): void {
  geo.computeBoundingBox();
  const bb = geo.boundingBox!;
  const span = (bb.max.y - bb.min.y) || 1;
  const cs = stops.map((c) => new THREE.Color(c));
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const out = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = (pos.getY(i) - bb.min.y) / span;     // 0 bottom -> 1 top
    const u = (1 - t) * (cs.length - 1);            // 0 = top stop
    const lo = Math.min(Math.floor(u), cs.length - 2);
    out.copy(cs[lo]).lerp(cs[lo + 1], u - lo);
    colors[i * 3] = out.r; colors[i * 3 + 1] = out.g; colors[i * 3 + 2] = out.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

// --- Per-element crest on the head -----------------------------------------
function buildCrest(art: ElementArt, rng: () => number): THREE.Object3D {
  const g = new THREE.Group();
  const [hot, mid, deep] = art.grad;
  switch (art.crest) {
    case 'flame': {
      // A tall back-leaning crown of flame spikes, dramatic in the centre.
      const n = 7;
      for (let i = 0; i < n; i++) {
        const f = (i / (n - 1)) * 2 - 1;            // -1..1 across the head
        const h = 1.35 - Math.abs(f) * 0.6 + rng() * 0.12;
        const flame = new THREE.Mesh(CONE(0.17 - Math.abs(f) * 0.04, h, 4), mat(i % 2 ? hot : mid, {
          emissive: 0xff5a00, emissiveIntensity: 0.8, roughness: 0.4,
        }));
        flame.position.set(f * 0.42, h * 0.42, -0.04 - Math.abs(f) * 0.04);
        flame.rotation.set(-0.28, 0, f * -0.55);
        g.add(flame);
      }
      break;
    }
    case 'shard': {
      // Tall sharp ice crystals fanning up off the crown.
      const n = 6;
      const m = mat(shade(hot, 1.02), { metalness: 0.35, roughness: 0.12, transparent: true, opacity: 0.92, emissive: deep, emissiveIntensity: 0.15 });
      for (let i = 0; i < n; i++) {
        const f = (i / (n - 1)) * 2 - 1;
        const h = 1.1 - Math.abs(f) * 0.45;
        const s = new THREE.Mesh(CONE(0.1 - Math.abs(f) * 0.02, h, 4), m);
        s.position.set(f * 0.38, h * 0.46, -0.02);
        s.rotation.set(-0.1, rng() * 0.4, f * -0.5);
        g.add(s);
      }
      break;
    }
    case 'bolt': {
      const m = mat(hot, { emissive: 0xffd000, emissiveIntensity: 0.85, roughness: 0.3 });
      for (const sgn of [-1, 0, 1]) {
        const s = new THREE.Mesh(CONE(0.1, sgn === 0 ? 0.7 : 0.5, 3), m);
        s.position.set(sgn * 0.3, sgn === 0 ? 0.35 : 0.25, -0.05);
        s.rotation.z = sgn * -0.45;
        g.add(s);
      }
      break;
    }
    case 'fin': {
      const m = mat(mid, { metalness: 0.2, roughness: 0.3 });
      const fin = new THREE.Mesh(CONE(0.14, 0.7, 3), m);
      fin.position.set(0, 0.32, -0.12); fin.rotation.x = -0.25;
      fin.scale.set(0.4, 1, 1.4);
      g.add(fin);
      break;
    }
    case 'rock': {
      const m = mat(deep, { roughness: 0.95 });
      for (let i = 0; i < 3; i++) {
        const chunk = new THREE.Mesh(ICO(0.16 + rng() * 0.05, 0), m);
        chunk.position.set((i - 1) * 0.22, 0.12 + rng() * 0.06, -0.05);
        chunk.rotation.set(rng() * 3, rng() * 3, rng() * 3);
        g.add(chunk);
      }
      break;
    }
    case 'leaf': {
      const m = mat(hot, { roughness: 0.6 });
      for (const sgn of [-1, 1, 0]) {
        const leaf = new THREE.Mesh(CONE(0.12, 0.55, 3), m);
        leaf.position.set(sgn * 0.18, 0.3, -0.05);
        leaf.rotation.set(-0.3, 0, sgn * -0.5);
        leaf.scale.set(0.5, 1, 1);
        g.add(leaf);
      }
      break;
    }
    case 'fluff': {
      const m = mat(hot, { roughness: 0.85 });
      for (const [x, y, r] of [[-0.18, 0.18, 0.16], [0.18, 0.18, 0.16], [0, 0.3, 0.2]] as const) {
        const puff = new THREE.Mesh(ICO(r, 1), m);
        puff.position.set(x, y, -0.05);
        g.add(puff);
      }
      break;
    }
    default: { // horns
      const m = mat(deep, { roughness: 0.5 });
      for (const sgn of [-1, 1]) {
        const horn = new THREE.Mesh(CONE(0.1, 0.5, 4), m);
        horn.position.set(sgn * 0.32, 0.2, -0.02);
        horn.rotation.z = sgn * -0.35;
        g.add(horn);
      }
    }
  }
  return g;
}

/**
 * Build a complete low-poly monster as a THREE.Group, feet at y≈0.
 */
export function buildLowPolyMonster(spec: MonsterVisualSpec): THREE.Group {
  const rng = mulberry32(hashStr(spec.id));
  const art = artFor(spec);
  const [topCol, midCol, deepCol] = art.grad;

  const root = new THREE.Group();
  const body = new THREE.Group(); // everything that "bobs"
  root.add(body);

  const wobble = 0.95 + rng() * 0.18;

  // --- Body: a chibi egg with the gradient baked in ----------------------
  const bodyGeo = ICO(0.88, 1);
  applyVerticalGradient(bodyGeo, [topCol, midCol, deepCol]);
  const bodyMesh = new THREE.Mesh(bodyGeo, mat(0xffffff, { vertexColors: true, roughness: 0.5 }));
  bodyMesh.scale.set(0.96, 1.32 * wobble, 0.92);
  bodyMesh.position.y = 1.08;
  bodyMesh.castShadow = true;
  body.add(bodyMesh);

  // Lighter muzzle/face patch so the eyes sit on a brighter mask.
  const face = new THREE.Mesh(ICO(0.52, 1), mat(shade(topCol, 1.04), { roughness: 0.55 }));
  face.scale.set(1.0, 0.82, 0.5);
  face.position.set(0, 1.12, 0.6);
  body.add(face);

  // --- Eyes: big faceted gem eyes ----------------------------------------
  const white = mat(0xffffff, { roughness: 0.2 });
  const dark = mat(0x080a14, { roughness: 0.12 });
  const iris = mat(art.eye, { roughness: 0.18, metalness: 0.25, emissive: art.eye, emissiveIntensity: 0.18 });
  const eyeY = 1.24;
  for (const s of [-1, 1]) {
    const eyeball = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 14), white);
    eyeball.position.set(s * 0.27, eyeY, 0.64);
    body.add(eyeball);
    const irisMesh = new THREE.Mesh(ICO(0.18, 0), iris); // faceted -> gem
    irisMesh.position.set(s * 0.27, eyeY, 0.8);
    body.add(irisMesh);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), dark);
    pupil.position.set(s * 0.27, eyeY, 0.9);
    body.add(pupil);
    const shine = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), white);
    shine.position.set(s * 0.27 - 0.07, eyeY + 0.1, 0.94);
    body.add(shine);
  }

  // --- Rosy cheeks + little smile ----------------------------------------
  const cheekMat = mat(0xff9ab0, { emissive: 0xff5577, emissiveIntensity: 0.22, roughness: 0.6 });
  for (const s of [-1, 1]) {
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), cheekMat);
    cheek.scale.set(1, 0.65, 0.45);
    cheek.position.set(s * 0.5, 1.06, 0.64);
    body.add(cheek);
  }
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.022, 8, 12, Math.PI), dark);
  mouth.rotation.z = Math.PI;
  mouth.position.set(0, 1.06, 0.86);
  body.add(mouth);

  // --- Stubby arms (hanging at the belly sides) --------------------------
  const limbMat = mat(midCol, { roughness: 0.55 });
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(ICO(0.22, 1), limbMat);
    arm.scale.set(0.85, 1.35, 0.85);
    arm.position.set(s * 0.8, 0.66, 0.16);
    arm.rotation.z = s * 0.6;
    arm.castShadow = true;
    body.add(arm);
  }

  // --- Stubby legs / feet (splayed and visible at the front) -------------
  const footMat = mat(deepCol, { roughness: 0.6 });
  for (const s of [-1, 1]) {
    const foot = new THREE.Mesh(ICO(0.28, 1), footMat);
    foot.scale.set(1.05, 0.85, 1.4);
    foot.position.set(s * 0.4, 0.17, 0.3);
    foot.castShadow = true;
    body.add(foot);
  }

  // --- Element crest, sitting up on the crown ----------------------------
  const crest = buildCrest(art, rng);
  crest.position.set(0, 2.05, 0.02);
  body.add(crest);

  // --- Rarity flair: orbiting gems ---------------------------------------
  if (spec.rarityRank > 0) {
    const gemMat = mat(spec.accentColor, {
      emissive: spec.accentColor, emissiveIntensity: 0.5 + spec.rarityRank * 0.12,
      metalness: 0.4, roughness: 0.2,
    });
    const gemCount = Math.min(spec.rarityRank, 6);
    const orbit = new THREE.Group();
    orbit.name = 'rarityOrbit';
    for (let i = 0; i < gemCount; i++) {
      const a = (i / gemCount) * Math.PI * 2;
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.1, 0), gemMat);
      gem.position.set(Math.cos(a) * 1.15, 1.0, Math.sin(a) * 1.15);
      orbit.add(gem);
    }
    body.add(orbit);
  }

  // Ground shadow disc (cheap fake-AO).
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.78, 14),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.01;
  root.add(shadow);

  root.userData.body = body;
  return root;
}

// Count triangles in a group — used by the demo to show the efficiency story.
export function countTriangles(obj: THREE.Object3D): number {
  let tris = 0;
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.geometry) {
      const g = m.geometry as THREE.BufferGeometry;
      if (g.index) tris += g.index.count / 3;
      else if (g.attributes.position) tris += g.attributes.position.count / 3;
    }
  });
  return Math.round(tris);
}
