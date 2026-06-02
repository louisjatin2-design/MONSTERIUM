// ---------------------------------------------------------------------------
// World3D — a real 3D (Three.js) overworld for MONSTERIUM.
//
// Renders the current island, its placed buildings, assigned monsters and
// uncleared obstacles in 3D using the low-poly generators. It reads everything
// from the game store and routes pointer clicks through the SAME EventBus
// events the 2D island used, so every existing React panel keeps working:
//   building → its panel · empty buildable tile → build menu · monster → detail
//
// Mounted behind the ?world3d=1 flag so the live Phaser game stays the default.
// Battles still run in Phaser (this view hides while a battle is active).
// ---------------------------------------------------------------------------
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EventBus, GameEvents } from '@game/EventBus';
import { useGameStore } from '@store/gameStore';
import { ELEMENT_COLORS } from '@data/elements';
import { RARITY_COLORS, RARITY_RANK } from '@data/rarities';
import { MONSTER_DEFS } from '@data/monsters';
import { BUILDING_DEFS } from '@data/buildings';
import { ISLAND_DEFS } from '@data/islands';
import type { BuildingInstance } from '@gtypes/game';
import { buildLowPolyMonster, type MonsterVisualSpec } from '../../proto3d/lowpolyMonster';
import { buildLowPolyBuilding } from '../../proto3d/lowpolyBuilding';
import { buildLowPolyIsland, buildObstacle, gridToWorld, worldToGrid, islandGrid, TOP_Y } from '../../proto3d/lowpolyIsland';

function monsterSpec(defId: string, id: string): MonsterVisualSpec {
  const def = MONSTER_DEFS[defId];
  const el = def?.elements[0] ?? 'Fire';
  return {
    id,
    element: el,
    elementColor: (ELEMENT_COLORS as Record<string, number>)[el] ?? 0x888888,
    accentColor: parseInt((RARITY_COLORS[def?.rarity ?? 'Common']).replace('#', ''), 16),
    rarityRank: RARITY_RANK[def?.rarity ?? 'Common'],
  };
}

function panelForBuilding(b: BuildingInstance) {
  const def = BUILDING_DEFS[b.defId];
  if (!def) return;
  switch (def.category) {
    case 'BreedingStation': EventBus.emit(GameEvents.OPEN_BREEDING_PANEL, {}); break;
    case 'Hatchery':        EventBus.emit(GameEvents.OPEN_HATCHERY_PANEL, {}); break;
    case 'Farm':            EventBus.emit(GameEvents.OPEN_FARM_PANEL, { instanceId: b.instanceId }); break;
    default:                EventBus.emit(GameEvents.OPEN_HABITAT_PANEL, { instanceId: b.instanceId });
  }
}

export function World3D({ hidden }: { hidden: boolean }) {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mount = mountRef.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const size = () => ({ w: mount.clientWidth || window.innerWidth, h: mount.clientHeight || window.innerHeight });
    const { w, h } = size();
    renderer.setSize(w, h);
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.display = 'block';

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x141033);
    scene.fog = new THREE.Fog(0x141033, 34, 70);

    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 300);
    camera.position.set(0, 16, 22);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 0, 0);
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.minDistance = 8;
    controls.maxDistance = 48;

    scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x402a55, 0.95));
    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(16, 28, 18);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    const sc = key.shadow.camera as THREE.OrthographicCamera;
    sc.near = 1; sc.far = 90; sc.left = -24; sc.right = 24; sc.top = 24; sc.bottom = -24;
    scene.add(key);

    // World group is rebuilt whenever the relevant store slices change.
    let world = new THREE.Group();
    scene.add(world);
    const pickBuildings: THREE.Object3D[] = [];
    const pickMonsters: THREE.Object3D[] = [];
    let groundMeshes: THREE.Object3D[] = [];
    const monsterBodies: THREE.Group[] = [];

    function clearWorld() {
      scene.remove(world);
      world.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => x.dispose());
      });
      world = new THREE.Group();
      scene.add(world);
      pickBuildings.length = 0; pickMonsters.length = 0; monsterBodies.length = 0;
      groundMeshes = [];
    }

    function rebuild() {
      clearWorld();
      const s = useGameStore.getState();
      const islandDef = ISLAND_DEFS[s.currentIslandId];
      if (!islandDef) return;
      const grid = islandGrid(islandDef);

      const island = buildLowPolyIsland(islandDef);
      island.traverse((o) => { if ((o as THREE.Mesh).isMesh) groundMeshes.push(o); });
      world.add(island);

      const cleared: Set<string> = new Set(s.clearedObstacles ?? []);
      for (const ob of islandDef.obstacles ?? []) {
        const k = `${islandDef.id}:${ob.tileX},${ob.tileY}`;
        if (cleared.has(k)) continue;
        const w0 = gridToWorld(ob.tileX + 0.5, ob.tileY + 0.5, grid);
        const prop = buildObstacle(ob.defId);
        prop.position.set(w0.x, TOP_Y, w0.z);
        world.add(prop);
      }

      const buildings = Object.values(s.buildings).filter((b) => b.islandId === s.currentIslandId);
      for (const b of buildings) {
        const def = BUILDING_DEFS[b.defId];
        if (!def) continue;
        const grp = buildLowPolyBuilding(def);
        const w0 = gridToWorld(b.tileX + def.tilesW / 2, b.tileY + def.tilesH / 2, grid);
        grp.position.set(w0.x, TOP_Y, w0.z);
        grp.userData.instanceId = b.instanceId;
        world.add(grp);
        pickBuildings.push(grp);

        // Residents roam just outside their habitat.
        const residents = b.monsterIds ?? [];
        residents.slice(0, 4).forEach((mid, i) => {
          const inst = s.monsters[mid];
          if (!inst) return;
          const m = buildLowPolyMonster(monsterSpec(inst.defId, mid));
          m.scale.setScalar(0.4);
          const a = (i / Math.max(1, residents.length)) * Math.PI * 2;
          m.position.set(w0.x + Math.cos(a) * (def.tilesW * 0.6), TOP_Y, w0.z + Math.sin(a) * (def.tilesH * 0.6) + def.tilesH * 0.5);
          m.userData.monsterInstanceId = mid;
          world.add(m);
          pickMonsters.push(m);
          monsterBodies.push(m);
        });
      }
    }

    rebuild();
    // Frame the camera on the island span.
    const fit = () => {
      const def = ISLAND_DEFS[useGameStore.getState().currentIslandId];
      const g = def ? islandGrid(def) : { cols: 20, rows: 15 };
      const span = Math.max(g.cols, g.rows);
      camera.position.set(0, span * 0.85, span * 1.1);
      controls.target.set(0, 0, 0);
      controls.update();
    };
    fit();

    // Rebuild only when the rendered slices actually change.
    let lastKey = '';
    const sliceKey = () => {
      const s = useGameStore.getState();
      const b = Object.values(s.buildings)
        .filter((x) => x.islandId === s.currentIslandId)
        .map((x) => `${x.instanceId}@${x.tileX},${x.tileY}#${x.level}:${(x.monsterIds ?? []).join('+')}`)
        .join('|');
      return `${s.currentIslandId}~${(s.clearedObstacles ?? []).join(',')}~${b}`;
    };
    lastKey = sliceKey();
    let lastIslandId = useGameStore.getState().currentIslandId;
    const unsub = useGameStore.subscribe(() => {
      const k = sliceKey();
      if (k !== lastKey) { lastKey = k; rebuild(); }
      const isl = k.split('~')[0];
      if (isl !== lastIslandId) { lastIslandId = isl; fit(); }
    });

    // --- click vs. orbit-drag detection + raycast routing ------------------
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let downX = 0, downY = 0, downT = 0;
    const onDown = (e: PointerEvent) => { downX = e.clientX; downY = e.clientY; downT = performance.now(); };
    const onUp = (e: PointerEvent) => {
      const moved = Math.hypot(e.clientX - downX, e.clientY - downY);
      if (moved > 6 || performance.now() - downT > 500) return; // it was a drag
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);

      const findTagged = (list: THREE.Object3D[], key: string) => {
        const hits = raycaster.intersectObjects(list, true);
        if (!hits.length) return null;
        let o: THREE.Object3D | null = hits[0].object;
        while (o && o.userData[key] === undefined) o = o.parent;
        return o?.userData[key] as string | undefined ?? null;
      };

      const mId = findTagged(pickMonsters, 'monsterInstanceId');
      const bId = mId ? null : findTagged(pickBuildings, 'instanceId');
      // Whichever was nearer along the ray wins; check distances.
      const nearest = (list: THREE.Object3D[]) => raycaster.intersectObjects(list, true)[0]?.distance ?? Infinity;
      const dM = pickMonsters.length ? nearest(pickMonsters) : Infinity;
      const dB = pickBuildings.length ? nearest(pickBuildings) : Infinity;

      if (mId && dM <= dB) { EventBus.emit(GameEvents.OPEN_MONSTER_DETAIL, { instanceId: mId }); return; }
      if (bId) { const b = useGameStore.getState().buildings[bId]; if (b) panelForBuilding(b); return; }

      // Empty ground → build menu for that tile (if it's a buildable land tile).
      const gh = raycaster.intersectObjects(groundMeshes, true)[0];
      if (gh) {
        const s = useGameStore.getState();
        const def = ISLAND_DEFS[s.currentIslandId];
        const grid = islandGrid(def);
        const { col, row } = worldToGrid(gh.point.x, gh.point.z, grid);
        const land = !!def.tileMask[row]?.[col];
        const occupied = Object.values(s.buildings).some((b) => b.islandId === s.currentIslandId
          && col >= b.tileX && col < b.tileX + (BUILDING_DEFS[b.defId]?.tilesW ?? 1)
          && row >= b.tileY && row < b.tileY + (BUILDING_DEFS[b.defId]?.tilesH ?? 1));
        if (land && !occupied) EventBus.emit(GameEvents.OPEN_BUILD_MENU, { tileX: col, tileY: row });
      }
    };
    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointerup', onUp);

    // --- animation loop ----------------------------------------------------
    const clock = new THREE.Clock();
    let raf = 0;
    const tick = () => {
      const t = clock.getElapsedTime();
      world.traverse((o) => {
        if (o.name === 'spin') o.rotation.z = t * 1.2;
        else if (o.name === 'pulse') { const sc2 = 1 + Math.sin(t * 2) * 0.08; o.scale.setScalar(sc2); }
      });
      monsterBodies.forEach((m, i) => {
        const body = m.userData.body as THREE.Group | undefined;
        if (body) body.position.y = Math.sin(t * 2 + i) * 0.05;
        const orbit = body?.getObjectByName('rarityOrbit');
        if (orbit) orbit.rotation.y = t * 1.2;
      });
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();

    const onResize = () => {
      const { w: nw, h: nh } = size();
      camera.aspect = nw / nh; camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointerup', onUp);
      unsub();
      controls.dispose();
      clearWorld();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div
      ref={mountRef}
      style={{
        position: 'absolute', inset: 0, zIndex: 40,
        display: hidden ? 'none' : 'block',
        pointerEvents: hidden ? 'none' : 'auto',
      }}
    />
  );
}
