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

    // --- placement / move mode -------------------------------------------
    type Mode = { kind: 'normal' } | { kind: 'place'; defId: string } | { kind: 'move'; instanceId: string; defId: string };
    let mode: Mode = { kind: 'normal' };
    let ghost: THREE.Group | null = null;
    const removeGhost = () => { if (ghost) { world.remove(ghost); ghost = null; } };
    const makeGhost = (defId: string) => {
      removeGhost();
      ghost = buildLowPolyBuilding(BUILDING_DEFS[defId]);
      ghost.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          const mats = Array.isArray(m.material) ? m.material : [m.material];
          mats.forEach((mm) => { const sm = mm as THREE.MeshStandardMaterial; sm.transparent = true; sm.opacity = 0.55; sm.depthWrite = false; });
        }
      });
      world.add(ghost);
    };
    const tintGhost = (ok: boolean) => {
      ghost?.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          const mats = Array.isArray(m.material) ? m.material : [m.material];
          mats.forEach((mm) => { const sm = mm as THREE.MeshStandardMaterial; sm.emissive = new THREE.Color(ok ? 0x33ff66 : 0xff3333); sm.emissiveIntensity = 0.45; });
        }
      });
    };
    const enterMode = (m: Mode) => {
      mode = m;
      if (m.kind === 'place' || m.kind === 'move') makeGhost(m.defId);
      else removeGhost();
    };
    const onEnterPlacement = (d: { defId: string }) => enterMode({ kind: 'place', defId: d.defId });
    const onEnterMove = (d: { instanceId: string }) => {
      const b = useGameStore.getState().buildings[d.instanceId];
      if (b) enterMode({ kind: 'move', instanceId: d.instanceId, defId: b.defId });
    };
    const onPanelClosed = () => enterMode({ kind: 'normal' });
    EventBus.on(GameEvents.ENTER_PLACEMENT_MODE, onEnterPlacement);
    EventBus.on(GameEvents.ENTER_MOVE_MODE, onEnterMove);
    EventBus.on(GameEvents.PANEL_CLOSED, onPanelClosed);

    function canPlace(defId: string, col: number, row: number, ignoreId?: string): boolean {
      const s = useGameStore.getState();
      const def = BUILDING_DEFS[defId];
      const island = ISLAND_DEFS[s.currentIslandId];
      if (!def || !island) return false;
      const cleared = new Set(s.clearedObstacles ?? []);
      for (let dx = 0; dx < def.tilesW; dx++) for (let dy = 0; dy < def.tilesH; dy++) {
        const c = col + dx, r = row + dy;
        if (!island.tileMask[r]?.[c]) return false;
        const occupied = Object.values(s.buildings).some((b) => b.islandId === s.currentIslandId && b.instanceId !== ignoreId
          && c >= b.tileX && c < b.tileX + (BUILDING_DEFS[b.defId]?.tilesW ?? 1)
          && r >= b.tileY && r < b.tileY + (BUILDING_DEFS[b.defId]?.tilesH ?? 1));
        if (occupied) return false;
        const onObstacle = (island.obstacles ?? []).some((ob) => ob.tileX === c && ob.tileY === r && !cleared.has(`${island.id}:${ob.tileX},${ob.tileY}`));
        if (onObstacle) return false;
      }
      return true;
    }

    // --- pointer routing ---------------------------------------------------
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const setNdc = (e: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
    };
    const groundTile = () => {
      const gh = raycaster.intersectObjects(groundMeshes, true)[0];
      if (!gh) return null;
      const def = ISLAND_DEFS[useGameStore.getState().currentIslandId];
      const { col, row } = worldToGrid(gh.point.x, gh.point.z, islandGrid(def));
      return { col, row };
    };

    let downX = 0, downY = 0, downT = 0;
    const onDown = (e: PointerEvent) => { downX = e.clientX; downY = e.clientY; downT = performance.now(); };
    const onMove = (e: PointerEvent) => {
      if (mode.kind === 'normal' || !ghost) return;
      setNdc(e);
      const t = groundTile();
      if (!t) { ghost.visible = false; return; }
      ghost.visible = true;
      const def = BUILDING_DEFS[mode.defId];
      const grid = islandGrid(ISLAND_DEFS[useGameStore.getState().currentIslandId]);
      const w0 = gridToWorld(t.col + def.tilesW / 2, t.row + def.tilesH / 2, grid);
      ghost.position.set(w0.x, TOP_Y, w0.z);
      tintGhost(canPlace(mode.defId, t.col, t.row, mode.kind === 'move' ? mode.instanceId : undefined));
    };
    const onUp = (e: PointerEvent) => {
      const moved = Math.hypot(e.clientX - downX, e.clientY - downY);
      if (moved > 6 || performance.now() - downT > 500) return; // a drag → orbit
      setNdc(e);

      // Placement / move: a tap drops the building on a valid tile.
      if (mode.kind === 'place' || mode.kind === 'move') {
        const t = groundTile();
        if (!t) return;
        const ignore = mode.kind === 'move' ? mode.instanceId : undefined;
        if (!canPlace(mode.defId, t.col, t.row, ignore)) return;
        const s = useGameStore.getState();
        const ok = mode.kind === 'place'
          ? s.placeBuilding(mode.defId, s.currentIslandId, t.col, t.row) !== null
          : s.moveBuilding(mode.instanceId, t.col, t.row);
        if (ok) { enterMode({ kind: 'normal' }); EventBus.emit(GameEvents.PANEL_CLOSED, {}); }
        return;
      }

      const findTagged = (list: THREE.Object3D[], key: string) => {
        const hits = raycaster.intersectObjects(list, true);
        if (!hits.length) return null;
        let o: THREE.Object3D | null = hits[0].object;
        while (o && o.userData[key] === undefined) o = o.parent;
        return (o?.userData[key] as string | undefined) ?? null;
      };
      const nearest = (list: THREE.Object3D[]) => raycaster.intersectObjects(list, true)[0]?.distance ?? Infinity;
      const mId = findTagged(pickMonsters, 'monsterInstanceId');
      const bId = findTagged(pickBuildings, 'instanceId');
      const dM = pickMonsters.length ? nearest(pickMonsters) : Infinity;
      const dB = pickBuildings.length ? nearest(pickBuildings) : Infinity;

      if (mId && dM <= dB) { EventBus.emit(GameEvents.OPEN_MONSTER_DETAIL, { instanceId: mId }); return; }
      if (bId) { const b = useGameStore.getState().buildings[bId]; if (b) panelForBuilding(b); return; }

      // Empty ground → either clear an obstacle there, or open the build menu.
      const t = groundTile();
      if (!t) return;
      const s = useGameStore.getState();
      const def = ISLAND_DEFS[s.currentIslandId];
      if (!def.tileMask[t.row]?.[t.col]) return;
      const cleared = new Set(s.clearedObstacles ?? []);
      const ob = (def.obstacles ?? []).find((o) => o.tileX === t.col && o.tileY === t.row && !cleared.has(`${def.id}:${o.tileX},${o.tileY}`));
      if (ob) { s.clearObstacle(s.currentIslandId, ob.tileX, ob.tileY); return; }
      const occupied = Object.values(s.buildings).some((b) => b.islandId === s.currentIslandId
        && t.col >= b.tileX && t.col < b.tileX + (BUILDING_DEFS[b.defId]?.tilesW ?? 1)
        && t.row >= b.tileY && t.row < b.tileY + (BUILDING_DEFS[b.defId]?.tilesH ?? 1));
      if (!occupied) EventBus.emit(GameEvents.OPEN_BUILD_MENU, { tileX: t.col, tileY: t.row });
    };
    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointermove', onMove);
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
      renderer.domElement.removeEventListener('pointermove', onMove);
      renderer.domElement.removeEventListener('pointerup', onUp);
      EventBus.off(GameEvents.ENTER_PLACEMENT_MODE, onEnterPlacement);
      EventBus.off(GameEvents.ENTER_MOVE_MODE, onEnterMove);
      EventBus.off(GameEvents.PANEL_CLOSED, onPanelClosed);
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
