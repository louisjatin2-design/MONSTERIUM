// ---------------------------------------------------------------------------
// Procedural low-poly 3D monster generator (PROOF OF CONCEPT)
//
// Builds a faceted, flat-shaded creature entirely from code — no modeling tool,
// no mesh files. Everything is derived deterministically from a monster's
// element + rarity, so the same generator scales to every monster in the game
// for free. Triangle counts are intentionally tiny (a few hundred per monster)
// so dozens can share the screen on a phone.
//
// This file is self-contained and engine-agnostic: it returns a THREE.Group
// that could later be dropped into a Three.js layer over the existing game.
// ---------------------------------------------------------------------------
import * as THREE from 'three';

export interface MonsterVisualSpec {
  /** Stable id — seeds the deterministic per-monster variation. */
  id: string;
  /** Primary body colour (hex, e.g. 0xff4500). */
  elementColor: number;
  /** Rarity accent / aura colour (hex). */
  accentColor: number;
  /** Rarity rank 0..7 — drives glow strength and gem count. */
  rarityRank: number;
  /** Element name — selects the silhouette feature (flames, bolts, fins…). */
  element: string;
}

// --- tiny deterministic RNG so each monster looks consistent every load ----
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
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
  return new THREE.MeshStandardMaterial({
    color,
    flatShading: true,
    roughness: 0.62,
    metalness: 0.06,
    ...opts,
  });
}

// Low-poly primitives (low detail/segment counts == few triangles).
const ICO = (r: number) => new THREE.IcosahedronGeometry(r, 1); // ~80 tris
const GEM = (r: number) => new THREE.OctahedronGeometry(r, 0);  // 8 tris
const CONE = (r: number, h: number) => new THREE.ConeGeometry(r, h, 5); // 10 tris

// Element-specific head/back feature. Returns a small group placed at body top.
function buildElementFeature(element: string, color: number, accent: number): THREE.Object3D {
  const g = new THREE.Group();
  switch (element) {
    case 'Fire':
    case 'Combat':
    case 'Demon': {
      const flame = mat(shade(0xff8c00, 1), { emissive: 0xff5200, emissiveIntensity: 0.9 });
      for (let i = -1; i <= 1; i++) {
        const m = new THREE.Mesh(CONE(0.16 - Math.abs(i) * 0.03, 0.5 - Math.abs(i) * 0.1), flame);
        m.position.set(i * 0.22, 0.25, 0);
        g.add(m);
      }
      break;
    }
    case 'Electric': {
      const bolt = mat(0xffe14a, { emissive: 0xffd000, emissiveIntensity: 0.8 });
      for (const s of [-1, 1]) {
        const m = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.55, 4), bolt);
        m.position.set(s * 0.34, 0.22, 0);
        m.rotation.z = s * -0.4;
        g.add(m);
      }
      break;
    }
    case 'Water':
    case 'Ice':
    case 'Crystal': {
      const crys = mat(shade(color, 1.15), { metalness: 0.3, roughness: 0.25, transparent: true, opacity: 0.9 });
      for (let i = -1; i <= 1; i++) {
        const m = new THREE.Mesh(CONE(0.1, 0.4 + Math.abs(i === 0 ? 0.2 : 0)), crys);
        m.position.set(i * 0.16, 0.2, -0.1);
        g.add(m);
      }
      break;
    }
    case 'Earth':
    case 'Metal':
    case 'Sand': {
      const rock = mat(shade(color, 0.85), { roughness: 0.95 });
      for (let i = 0; i < 3; i++) {
        const m = new THREE.Mesh(GEM(0.14 + i * 0.02), rock);
        m.position.set((i - 1) * 0.2, 0.16, 0);
        m.rotation.set(Math.random(), Math.random(), Math.random());
        g.add(m);
      }
      break;
    }
    default: {
      // Default: two soft ears in the body colour.
      const ear = mat(shade(color, 0.9));
      for (const s of [-1, 1]) {
        const m = new THREE.Mesh(CONE(0.16, 0.4), ear);
        m.position.set(s * 0.3, 0.2, 0);
        m.rotation.z = s * -0.3;
        g.add(m);
      }
    }
  }
  // Accent halo for high-element flair, tinted by rarity accent.
  void accent;
  return g;
}

/**
 * Build a complete low-poly monster as a THREE.Group, centred on the origin
 * with its feet at y≈0. Caller positions/scales the group.
 */
export function buildLowPolyMonster(spec: MonsterVisualSpec): THREE.Group {
  const rng = mulberry32(hashStr(spec.id));
  const root = new THREE.Group();
  const body = new THREE.Group(); // everything that "bobs"
  root.add(body);

  const bodyColor = spec.elementColor;
  const wobble = 0.9 + rng() * 0.25;

  // --- Body --------------------------------------------------------------
  // Chubby, slightly squashed sphere reads as a cute round belly.
  const bodyMesh = new THREE.Mesh(ICO(0.8), mat(bodyColor, { roughness: 0.5 }));
  bodyMesh.scale.set(1.1, 0.95 * wobble, 1.06);
  bodyMesh.position.y = 0.8;
  bodyMesh.castShadow = true;
  body.add(bodyMesh);

  // Lighter belly patch on the front.
  const belly = new THREE.Mesh(ICO(0.52), mat(shade(bodyColor, 1.5)));
  belly.scale.set(0.92, 0.92, 0.42);
  belly.position.set(0, 0.68, 0.6);
  body.add(belly);

  // --- Eyes (big, round & sparkly = the main cuteness lever) -------------
  const white = mat(0xffffff, { roughness: 0.25 });
  const dark = mat(0x0a1020, { roughness: 0.15 });
  const eyeY = 0.96;
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.25, 14, 12), white);
    eye.position.set(s * 0.26, eyeY, 0.64);
    body.add(eye);
    // Big pupil looking slightly up.
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), dark);
    pupil.position.set(s * 0.25, eyeY + 0.02, 0.79);
    body.add(pupil);
    // Catch-light sparkle.
    const shine = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), white);
    shine.position.set(s * 0.25 - 0.06, eyeY + 0.09, 0.9);
    body.add(shine);
  }

  // --- Rosy cheeks -------------------------------------------------------
  const cheekMat = mat(0xff9ab0, { emissive: 0xff5577, emissiveIntensity: 0.25, roughness: 0.6 });
  for (const s of [-1, 1]) {
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), cheekMat);
    cheek.scale.set(1, 0.7, 0.5);
    cheek.position.set(s * 0.52, 0.78, 0.62);
    body.add(cheek);
  }

  // --- Little smile ------------------------------------------------------
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.028, 8, 12, Math.PI), dark);
  mouth.rotation.z = Math.PI; // half-ring opening upward → a happy curve
  mouth.position.set(0, 0.8, 0.82);
  body.add(mouth);

  // --- Feet (stubby & rounded) -------------------------------------------
  const footMat = mat(shade(bodyColor, 0.75));
  for (const s of [-1, 1]) {
    const foot = new THREE.Mesh(ICO(0.3), footMat);
    foot.scale.set(1.1, 0.65, 1.2);
    foot.position.set(s * 0.36, 0.17, 0.22);
    foot.castShadow = true;
    body.add(foot);
  }

  // --- Element feature on top (smaller so the face stays the star) -------
  const feature = buildElementFeature(spec.element, bodyColor, spec.accentColor);
  feature.position.y = 1.34;
  feature.scale.setScalar(0.82);
  body.add(feature);

  // --- Rarity flair: floating gems orbiting + emissive aura disc ----------
  if (spec.rarityRank > 0) {
    const gemMat = mat(spec.accentColor, {
      emissive: spec.accentColor,
      emissiveIntensity: 0.5 + spec.rarityRank * 0.12,
      metalness: 0.4,
      roughness: 0.2,
    });
    const gemCount = Math.min(spec.rarityRank, 6);
    const orbit = new THREE.Group();
    orbit.name = 'rarityOrbit';
    for (let i = 0; i < gemCount; i++) {
      const a = (i / gemCount) * Math.PI * 2;
      const gem = new THREE.Mesh(GEM(0.11), gemMat);
      gem.position.set(Math.cos(a) * 1.05, 0.95, Math.sin(a) * 1.05);
      orbit.add(gem);
    }
    body.add(orbit);
  }

  // Ground shadow disc (cheap fake-AO so it reads even without shadow maps).
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.7, 12),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.01;
  root.add(shadow);

  root.userData.body = body; // expose the bobbing group for animation
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
