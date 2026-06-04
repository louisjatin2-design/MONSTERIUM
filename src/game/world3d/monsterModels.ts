// ---------------------------------------------------------------------------
// Monster 3D model + animation pipeline (Meshy AI drop-in)
//
// This module lets you swap the procedurally-generated low-poly monsters for
// real 3D models (e.g. exported from Meshy AI) WITHOUT touching any game code.
//
//   • Drop a model file into   src/assets/monsters3d/<defId>.glb
//   • Drop animations into      src/assets/animations/<name>.glb
//
// Everything here is convention-based and picked up at build time via Vite's
// import.meta.glob, so the folders can start empty (the game falls back to the
// procedural monsters) and start showing your models the moment you add a file.
//
// <defId> is the monster's id from src/data/monsters.ts (e.g. "shadowfox").
// See the README files in those folders for the full workflow.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Vite resolves these globs at build time to a map of { '/src/assets/.../x.glb':
// 'https://.../x.glb' }. Empty folders → empty maps → procedural fallback. The
// `eager` form gives us the final asset URL strings directly.
// Build filename → url lookups (lowercased, without extension/path) so callers
// can ask by convention name regardless of where Vite hashed the asset to.
function baseName(path: string): string {
  const file = path.split('/').pop() ?? path;
  return file.replace(/\.glb$/i, '').toLowerCase();
}

// Wrapped so a discovery problem can never crash module load — empty/missing
// folders just mean "no custom models" (procedural fallback).
const modelByName = new Map<string, string>();
const animByName = new Map<string, string>();
try {
  const MODEL_URLS = import.meta.glob('/src/assets/monsters3d/*.glb', {
    eager: true, query: '?url', import: 'default',
  }) as Record<string, string>;
  for (const [p, url] of Object.entries(MODEL_URLS)) modelByName.set(baseName(p), url);
} catch (err) { console.warn('[monsterModels] model discovery failed', err); }
try {
  const ANIM_URLS = import.meta.glob('/src/assets/animations/*.glb', {
    eager: true, query: '?url', import: 'default',
  }) as Record<string, string>;
  for (const [p, url] of Object.entries(ANIM_URLS)) animByName.set(baseName(p), url);
} catch (err) { console.warn('[monsterModels] anim discovery failed', err); }

/** True if a custom model file exists for this monster def id. */
export function hasMonsterModel(defId: string): boolean {
  return modelByName.has(defId.toLowerCase());
}

/** All animation names available in src/assets/animations (without extension). */
export function availableAnimations(): string[] {
  return [...animByName.keys()];
}

// Lazily constructed on first actual use so nothing runs at module-load time.
let loader: GLTFLoader | null = null;
function getLoader(): GLTFLoader {
  if (!loader) loader = new GLTFLoader();
  return loader;
}

export interface LoadedModel {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
}

const modelCache = new Map<string, Promise<LoadedModel | null>>();
const animCache = new Map<string, Promise<THREE.AnimationClip[]>>();

function loadGltf(url: string): Promise<LoadedModel> {
  return new Promise((resolve, reject) => {
    getLoader().load(
      url,
      gltf => resolve({ scene: gltf.scene as unknown as THREE.Group, animations: gltf.animations }),
      undefined,
      reject,
    );
  });
}

/**
 * Load the custom model for a monster def id, or null if none is provided.
 * Result is cloned per call so the same model can appear many times on screen.
 * Pulls in any matching shared animation clips from src/assets/animations too.
 */
export async function loadMonsterModel(defId: string): Promise<LoadedModel | null> {
  const key = defId.toLowerCase();
  const url = modelByName.get(key);
  if (!url) return null;

  if (!modelCache.has(key)) {
    modelCache.set(key, (async () => {
      try {
        const base = await loadGltf(url);
        const shared = await loadSharedAnimations();
        // Keep the original as a template; callers clone it.
        base.scene.userData.__template = true;
        base.animations = [...base.animations, ...shared];
        return base;
      } catch (err) {
        console.warn(`[monsterModels] failed to load ${url}`, err);
        return null;
      }
    })());
  }
  const tpl = await modelCache.get(key)!;
  if (!tpl) return null;
  // Clone so multiple instances don't share a transform.
  return { scene: tpl.scene.clone(true) as THREE.Group, animations: tpl.animations };
}

/** Load every shared animation clip from src/assets/animations once, cached. */
export async function loadSharedAnimations(): Promise<THREE.AnimationClip[]> {
  const clips: THREE.AnimationClip[] = [];
  await Promise.all([...animByName.entries()].map(async ([name, url]) => {
    if (!animCache.has(name)) {
      animCache.set(name, loadGltf(url).then(g => {
        // Name each clip after its file so callers can find e.g. "attack".
        g.animations.forEach(c => { c.name = c.name && c.name !== 'mixamo.com' ? c.name : name; });
        return g.animations;
      }).catch(err => { console.warn(`[monsterModels] anim ${url} failed`, err); return []; }));
    }
    clips.push(...await animCache.get(name)!);
  }));
  return clips;
}

/**
 * Normalize a loaded model so it sits on the ground (y=0) and is `targetHeight`
 * units tall — matching the scale of the procedural monsters so swapping a model
 * in doesn't change its footprint in the habitat or battle stage.
 */
export function normalizeModel(obj: THREE.Object3D, targetHeight = 1): void {
  const box = new THREE.Box3().setFromObject(obj);
  const size = new THREE.Vector3();
  box.getSize(size);
  const h = size.y || 1;
  const scale = targetHeight / h;
  obj.scale.multiplyScalar(scale);
  // Re-measure after scaling to drop the model onto the ground plane.
  const box2 = new THREE.Box3().setFromObject(obj);
  obj.position.y -= box2.min.y;
  obj.traverse(o => { o.castShadow = true; o.receiveShadow = false; });
}

/**
 * Replace a procedural monster group's visible meshes with a custom model, if
 * one exists. Safe to fire-and-forget: the procedural body shows until (and
 * unless) the model resolves. Returns the AnimationMixer when a model loaded.
 */
export async function attachMonsterModel(
  group: THREE.Object3D,
  defId: string,
  targetHeight = 1,
): Promise<THREE.AnimationMixer | null> {
  const loaded = await loadMonsterModel(defId);
  if (!loaded) return null;
  // Hide the procedural meshes (keep userData/animation hooks on the group).
  for (const child of [...group.children]) child.visible = false;
  normalizeModel(loaded.scene, targetHeight);
  group.add(loaded.scene);

  if (loaded.animations.length === 0) return null;
  const mixer = new THREE.AnimationMixer(loaded.scene);
  // Auto-play an "idle" clip if one is provided.
  const idle = loaded.animations.find(c => /idle/i.test(c.name)) ?? loaded.animations[0];
  if (idle) mixer.clipAction(idle).play();
  group.userData.mixer = mixer;
  group.userData.clips = loaded.animations;
  return mixer;
}
