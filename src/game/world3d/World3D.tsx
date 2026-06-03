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
import { getMonsterFaction } from '@data/factions';
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
    // Gruppe 2: Fraktion treibt die sichtbaren Gut/Böse-Designmerkmale.
    faction: def ? getMonsterFaction(def) : 'Neutral',
  };
}

// ── Gruppe 1: Day/Night-Cycle nach Geräteuhrzeit ───────────────────────────
// Zentrale Funktion, die aus einem Date den kompletten Beleuchtungs-/Himmel-
// Zustand ableitet: Sonnenstand, Lichtfarbe/-stärke, Ambient, Fog- und
// Himmelsfarben sowie ein Nacht-/Lampenlicht-Faktor. Alles smooth über die
// Sonnenhöhe interpoliert, damit Übergänge (Dämmerung etc.) fließend sind.
export interface DayNightState {
  sun: THREE.Vector3;       // Richtung zur Sonne (normalisiert × Radius)
  altitude: number;         // -1 (tiefe Nacht) … +1 (Zenit)
  light: number;            // 0 = Nacht, 1 = Tag (smooth)
  night: number;            // 1 - light, für Lampen/Mond
  lightColor: THREE.Color;  // Farbe des Richtungslichts (Sonne/Mond)
  lightIntensity: number;
  ambientColor: THREE.Color;
  ambientIntensity: number;
  skyTop: THREE.Color;
  skyHorizon: THREE.Color;
  fog: THREE.Color;
  moonVisible: boolean;
}

function smoothstep(a: number, b: number, x: number): number {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

// Schlüsselfarben (HEX) für Tag / Nacht / Dämmerung.
const SKY = {
  dayTop: 0x2b6fd6, dayHorizon: 0xbfe3ff,
  nightTop: 0x070518, nightHorizon: 0x191240,
  sunset: 0xff8c42, sunColor: 0xfff2cc, moonColor: 0x9fb4ff,
};

export function getDayNightState(date: Date): DayNightState {
  const hours = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
  // 6:00 = Sonnenaufgang (Horizont), 12:00 = Zenit, 18:00 = Untergang, 0:00 = tiefe Nacht.
  const dayT = ((hours - 6) / 24) * Math.PI * 2;
  const altitude = Math.sin(dayT);
  const R = 120;
  const sun = new THREE.Vector3(-Math.cos(dayT) * R, altitude * R, -38);

  const light = smoothstep(-0.18, 0.22, altitude);     // Nacht → Tag
  const night = 1 - light;
  // Dämmerungs-Glut, wenn die Sonne nahe am Horizont steht.
  const twilight = THREE.MathUtils.clamp(1 - Math.abs(altitude) / 0.28, 0, 1)
    * (altitude > -0.32 ? 1 : 0);

  const lerpC = (a: number, b: number, t: number) => new THREE.Color(a).lerp(new THREE.Color(b), t);
  const skyTop = lerpC(SKY.nightTop, SKY.dayTop, light);
  const skyHorizon = lerpC(SKY.nightHorizon, SKY.dayHorizon, light)
    .lerp(new THREE.Color(SKY.sunset), twilight * 0.7);
  const lightColor = lerpC(SKY.moonColor, SKY.sunColor, light)
    .lerp(new THREE.Color(SKY.sunset), twilight * 0.55);
  const ambientColor = skyTop.clone().lerp(new THREE.Color(0xffffff), 0.25);

  return {
    sun, altitude, light, night, lightColor,
    lightIntensity: 0.18 + light * 1.35,
    ambientColor,
    ambientIntensity: 0.35 + light * 0.7,
    skyTop, skyHorizon,
    fog: skyHorizon.clone(),
    moonVisible: altitude < 0.12,
  };
}

// Weiche Wolken-Textur (radialer Alpha-Verlauf) — einmal erzeugt, geteilt.
function makeCloudTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 6, 64, 64, 62);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
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
    scene.fog = new THREE.Fog(0x141033, 38, 95);

    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 400);
    camera.position.set(0, 16, 22);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 0, 0);
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.minDistance = 8;
    controls.maxDistance = 48;

    // ── Gruppe 1: Lichter (vom Day/Night-Cycle pro Frame angesteuert) ───────
    const hemi = new THREE.HemisphereLight(0xbfd4ff, 0x402a55, 0.95);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 1.4);   // Sonne/Mond
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    const sc = key.shadow.camera as THREE.OrthographicCamera;
    sc.near = 1; sc.far = 200; sc.left = -28; sc.right = 28; sc.top = 28; sc.bottom = -28;
    scene.add(key);
    // Sanftes Fülllicht (wird nachts zu kühlem Mondlicht).
    const fill = new THREE.DirectionalLight(0x9fb4ff, 0.25);
    fill.position.set(-12, 10, -16);
    scene.add(fill);

    // ── Gruppe 1: layerbasierter Parallax-Himmel (bricht beim Zoomen nicht) ──
    // Großer nach innen gerichteter Sky-Dome mit Vertikal-Gradient via Shader.
    // Keine Overlays — der Verlauf ist Teil der 3D-Szene und skaliert sauber.
    const skyUniforms = {
      topColor: { value: new THREE.Color(SKY.nightTop) },
      bottomColor: { value: new THREE.Color(SKY.nightHorizon) },
      offset: { value: 20 },
      exponent: { value: 0.7 },
    };
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(200, 32, 16),
      new THREE.ShaderMaterial({
        uniforms: skyUniforms,
        side: THREE.BackSide,
        depthWrite: false,
        vertexShader: `varying vec3 vW; void main(){ vec4 wp = modelMatrix * vec4(position,1.0); vW = wp.xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `uniform vec3 topColor; uniform vec3 bottomColor; uniform float offset; uniform float exponent; varying vec3 vW; void main(){ float hgt = normalize(vW + vec3(0.0, offset, 0.0)).y; gl_FragColor = vec4(mix(bottomColor, topColor, pow(max(hgt,0.0), exponent)), 1.0); }`,
      }),
    );
    scene.add(sky);

    // Sonne + Mond (emissive Scheiben mit Halo) — Position folgt der Uhrzeit.
    const makeOrb = (color: number, r: number, haloColor: number) => {
      const grp = new THREE.Group();
      grp.add(new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), new THREE.MeshBasicMaterial({ color })));
      const halo = new THREE.Mesh(new THREE.SphereGeometry(r * 2.4, 16, 12), new THREE.MeshBasicMaterial({ color: haloColor, transparent: true, opacity: 0.25, depthWrite: false }));
      grp.add(halo);
      return grp;
    };
    const sunOrb = makeOrb(0xfff2cc, 7, 0xffcf6a);
    const moonOrb = makeOrb(0xeaf0ff, 5, 0x8fa6ff);
    scene.add(sunOrb, moonOrb);

    // Mehrere unabhängige Wolken-Layer (Tiefe durch verschiedene Höhe, Größe,
    // Geschwindigkeit, Opazität). Sprites stehen immer zur Kamera → Fernwolken.
    const cloudTex = makeCloudTexture();
    const cloudLayers: { sprites: THREE.Sprite[]; speed: number; baseOpacity: number; spanX: number }[] = [];
    const CLOUD_DEFS = [
      { count: 7, y: 42, radius: 95, scale: 30, speed: 0.6, opacity: 0.75 },
      { count: 6, y: 55, radius: 120, scale: 46, speed: 0.35, opacity: 0.55 },
      { count: 5, y: 70, radius: 150, scale: 64, speed: 0.18, opacity: 0.4 },
    ];
    for (const cd of CLOUD_DEFS) {
      const sprites: THREE.Sprite[] = [];
      const spanX = cd.radius * 2;
      for (let i = 0; i < cd.count; i++) {
        const spMat = new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: cd.opacity, depthWrite: false, fog: false });
        const sp = new THREE.Sprite(spMat);
        const s = cd.scale * (0.7 + Math.random() * 0.6);
        sp.scale.set(s * 1.7, s, 1);
        sp.position.set((Math.random() - 0.5) * spanX, cd.y + (Math.random() - 0.5) * 10, -cd.radius * (0.5 + Math.random() * 0.5));
        scene.add(sp);
        sprites.push(sp);
      }
      cloudLayers.push({ sprites, speed: cd.speed, baseOpacity: cd.opacity, spanX });
    }

    // Day/Night auf Lichter, Himmel, Fog, Sonne/Mond & Wolken anwenden.
    const applyDayNight = () => {
      const st = getDayNightState(new Date());
      key.position.copy(st.sun);
      key.intensity = st.lightIntensity;
      key.color.copy(st.lightColor);
      fill.intensity = 0.12 + st.night * 0.45;
      hemi.color.copy(st.skyTop);
      hemi.groundColor.set(0x2a1d3a);
      hemi.intensity = st.ambientIntensity;
      skyUniforms.topColor.value.copy(st.skyTop);
      skyUniforms.bottomColor.value.copy(st.skyHorizon);
      scene.background = st.skyHorizon.clone();
      (scene.fog as THREE.Fog).color.copy(st.fog);
      sunOrb.position.copy(st.sun);
      sunOrb.visible = st.altitude > -0.18;
      moonOrb.position.copy(st.sun).multiplyScalar(-1); // dem Sonnenstand gegenüber
      moonOrb.visible = st.moonVisible;
      // Wolken nachts dunkler/leiser; Lampenlicht-Faktor liegt in st.night.
      for (const layer of cloudLayers) {
        const op = layer.baseOpacity * (0.25 + st.light * 0.75);
        const tint = 0.45 + st.light * 0.55;
        for (const sp of layer.sprites) {
          (sp.material as THREE.SpriteMaterial).opacity = op;
          (sp.material as THREE.SpriteMaterial).color.setRGB(tint, tint, tint * 1.02);
        }
      }
      lampGroup.visible = st.night > 0.25;
      lampGroup.children.forEach((l) => { (l as THREE.PointLight).intensity = st.night * 1.4; });
    };

    // Warmes Lampenlicht für die Nacht — pro Gebäude eine Punktlichtquelle, die
    // mit dem Nacht-Faktor heller wird (siehe applyDayNight / rebuild).
    const lampGroup = new THREE.Group();
    scene.add(lampGroup);

    // ── Gruppe 2: Wettereffekte ────────────────────────────────────────────
    // Rein visueller, NICHT persistierter Wetter-Zyklus (klar → Regen → Sturm).
    // Beeinflusst sichtbar Stimmung/Verhalten der Monster: bei Regen ducken sie
    // sich und wandern langsamer, bei Sturm sind sie aufgewühlt (schneller).
    // TODO: später echten Wetter-Zustand in den Store (mit migrate) + Kopplung
    //       an Habitat/Insel; aktuell deterministisch über einen Timer.
    type Weather = 'clear' | 'rain' | 'storm';
    const weather = { kind: 'clear' as Weather, timer: 14, rain: 0 /* 0..1 sichtbare Stärke */ };
    let weatherSpeedMul = 1; // an die Wander-AI gekoppelt
    // Regen als Punktwolke um das Kamera-Ziel.
    const RAIN_N = 1400;
    const rainGeo = new THREE.BufferGeometry();
    const rainPos = new Float32Array(RAIN_N * 3);
    for (let i = 0; i < RAIN_N; i++) {
      rainPos[i * 3] = (Math.random() - 0.5) * 80;
      rainPos[i * 3 + 1] = Math.random() * 60;
      rainPos[i * 3 + 2] = (Math.random() - 0.5) * 80;
    }
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
    const rain = new THREE.Points(rainGeo, new THREE.PointsMaterial({
      color: 0xaecbe6, size: 0.18, transparent: true, opacity: 0, depthWrite: false, fog: false,
    }));
    rain.visible = false;
    scene.add(rain);
    // Eigene Lichtquelle für Blitze (unabhängig vom Day/Night-Cycle).
    const lightning = new THREE.AmbientLight(0xcfe0ff, 0);
    scene.add(lightning);

    const updateWeather = (dt: number) => {
      weather.timer -= dt;
      if (weather.timer <= 0) {
        // Nächsten Zustand wählen (gewichtet: meist klar).
        const r = Math.random();
        weather.kind = r < 0.55 ? 'clear' : r < 0.85 ? 'rain' : 'storm';
        weather.timer = 12 + Math.random() * 18;
      }
      const target = weather.kind === 'clear' ? 0 : weather.kind === 'rain' ? 0.6 : 1;
      weather.rain += (target - weather.rain) * Math.min(1, dt * 0.6); // sanfter Übergang
      // Monster-Verhalten: Regen bremst, Sturm wühlt auf.
      weatherSpeedMul = weather.kind === 'storm'
        ? 1 + weather.rain * 0.8
        : 1 - weather.rain * 0.55;

      const visible = weather.rain > 0.02;
      rain.visible = visible;
      if (visible) {
        const mat = rain.material as THREE.PointsMaterial;
        mat.opacity = weather.rain * (weather.kind === 'storm' ? 0.85 : 0.55);
        const fall = (weather.kind === 'storm' ? 70 : 42) * dt;
        const cx = controls.target.x, cz = controls.target.z;
        const pos = rainGeo.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < RAIN_N; i++) {
          let y = pos.getY(i) - fall;
          if (y < 0) {
            y = 60;
            pos.setX(i, cx + (Math.random() - 0.5) * 80);
            pos.setZ(i, cz + (Math.random() - 0.5) * 80);
          }
          pos.setY(i, y);
        }
        pos.needsUpdate = true;
      }
      // Blitze nur im Sturm, gelegentlich.
      if (weather.kind === 'storm' && Math.random() < dt * 0.6) lightning.intensity = 1.8;
      else lightning.intensity = Math.max(0, lightning.intensity - dt * 6);
    };

    // World group is rebuilt whenever the relevant store slices change.
    let world = new THREE.Group();
    scene.add(world);
    const pickBuildings: THREE.Object3D[] = [];
    const pickMonsters: THREE.Object3D[] = [];
    let groundMeshes: THREE.Object3D[] = [];
    const monsterBodies: THREE.Group[] = [];
    // Kurzlebige Emote-Symbole (❤️/✨/…), die über glücklichen Monstern aufsteigen.
    const emoteSprites: THREE.Sprite[] = [];

    function clearWorld() {
      scene.remove(world);
      world.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => x.dispose());
      });
      world = new THREE.Group();
      scene.add(world);
      // Lampen werden pro Gebäude neu gesetzt → bei jedem Rebuild leeren.
      lampGroup.children.slice().forEach((l) => lampGroup.remove(l));
      pickBuildings.length = 0; pickMonsters.length = 0; monsterBodies.length = 0;
      emoteSprites.length = 0;
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

        // Gruppe 1: warmes Lampenlicht pro Gebäude (nachts hell, tags aus).
        const lamp = new THREE.PointLight(0xffcf8a, 0, 9, 1.6);
        lamp.position.set(w0.x, TOP_Y + 2.4, w0.z);
        lampGroup.add(lamp);

        // Gruppe 2: Bewohner streifen frei im Habitat umher (Wander-AI).
        // Größe proportional zur Habitatgröße + Seltenheit + Level, damit der
        // Lebensraum natürlich wirkt (große/seltene Monster sind sichtbar größer).
        const residents = b.monsterIds ?? [];
        // Radius des Habitat-Areals (in Welt-Einheiten), in dem gewandert wird.
        const roamR = Math.max(def.tilesW, def.tilesH) * 0.8 + 0.6;
        residents.slice(0, 4).forEach((mid, i) => {
          const inst = s.monsters[mid];
          if (!inst) return;
          const def0 = MONSTER_DEFS[inst.defId];
          const rarityRank = RARITY_RANK[def0?.rarity ?? 'Common'];
          // Habitat-relative Grundgröße + Seltenheits-/Level-/Evolutions-Aufschlag,
          // damit ein ausgewachsener, seltener Bewohner sichtbar größer wirkt als
          // ein Jungtier — realistische Proportionen im Lebensraum.
          const habitatScale = 0.28 + Math.min(def.tilesW, def.tilesH) * 0.04;
          const stageMul = inst.stage === 'Baby' ? 0.8 : inst.stage === 'Juvenile' ? 0.92 : inst.stage === 'Elder' ? 1.12 : 1;
          const sizeMul = habitatScale * stageMul * (1 + rarityRank * 0.08 + Math.min(inst.level ?? 1, 100) * 0.0015);
          const m = buildLowPolyMonster(monsterSpec(inst.defId, mid));
          m.scale.setScalar(sizeMul);
          const a = (i / Math.max(1, residents.length)) * Math.PI * 2;
          const hx = w0.x + Math.cos(a) * roamR * 0.6;
          const hz = w0.z + Math.sin(a) * roamR * 0.6;
          m.position.set(hx, TOP_Y, hz);
          m.userData.monsterInstanceId = mid;
          // Wander-Zustand: Heimatzentrum, aktuelles Ziel, Tempo, Phasen-Offset.
          m.userData.wander = {
            cx: w0.x, cz: w0.z, r: roamR,
            tx: hx, tz: hz,
            speed: 0.5 + Math.random() * 0.6,
            phase: Math.random() * Math.PI * 2,
          };
          // Lustige Extra-Animationen: gelegentliches Hüpfen, Drehen oder ein
          // aufsteigendes Emote-Symbol. `cd` zählt bis zur nächsten Aktion runter.
          m.userData.fun = { cd: 1 + Math.random() * 5, mode: 'none' as 'none' | 'hop' | 'spin', tp: 0, dur: 0 };
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

    // --- Emote-Symbole (kleine Stimmungs-Sprites über den Monstern) --------
    // Jedes Symbol wird einmal in eine Canvas-Textur gebacken und geteilt.
    const EMOTES = ['❤️', '✨', '🎵', '😄', '💤', '⭐'];
    const emoteTex: Record<string, THREE.Texture> = {};
    for (const ch of EMOTES) {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const ctx = c.getContext('2d')!;
      ctx.font = '48px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ch, 32, 36);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      emoteTex[ch] = tex;
    }
    // Lasse ein zufälliges Emote über dem Monster aufsteigen und ausblenden.
    const spawnEmote = (m: THREE.Group) => {
      const ch = EMOTES[Math.floor(Math.random() * EMOTES.length)];
      const spMat = new THREE.SpriteMaterial({ map: emoteTex[ch], transparent: true, depthWrite: false, fog: false });
      const sp = new THREE.Sprite(spMat);
      sp.scale.set(0.9, 0.9, 1);
      // Kopfhöhe grob aus der Monstergröße ableiten, damit das Symbol darüber sitzt.
      sp.userData = { life: 0, dur: 1.5, mon: m, top: 2.3 * (m.scale.x || 1) };
      sp.position.set(m.position.x, m.position.y + sp.userData.top, m.position.z);
      world.add(sp);
      emoteSprites.push(sp);
    };

    // --- animation loop ----------------------------------------------------
    const clock = new THREE.Clock();
    let raf = 0;
    applyDayNight();        // initialer Himmel-/Lichtzustand
    let dnAccum = 0;        // Day/Night nur ~2× pro Sekunde neu berechnen
    const tick = () => {
      // WICHTIG: erst das Frame-Delta holen, dann die akkumulierte Zeit lesen.
      // clock.getElapsedTime() ruft intern selbst getDelta() auf — würde man es
      // zuerst aufrufen, läge das verbrauchte Delta beim nächsten getDelta() bei
      // ~0 und JEDE delta-basierte Bewegung (Wandern, Wetter, Wolken, Flourishes)
      // stünde still. Daher: getDelta() zuerst, t danach aus der Property.
      const dt = clock.getDelta();
      const t = clock.elapsedTime;

      // Gruppe 1: Day/Night-Cycle (Uhrzeit) — günstig, daher gedrosselt.
      dnAccum += dt;
      if (dnAccum > 0.5) { dnAccum = 0; applyDayNight(); }

      // Gruppe 2: Wetter aktualisieren (Regen-Partikel, Blitze, Stimmung).
      updateWeather(dt);

      // Gruppe 1: Wolken driften je Layer unterschiedlich schnell und wrappen.
      for (const layer of cloudLayers) {
        for (const sp of layer.sprites) {
          sp.position.x += layer.speed * dt;
          if (sp.position.x > layer.spanX / 2) sp.position.x = -layer.spanX / 2;
        }
      }

      world.traverse((o) => {
        if (o.name === 'spin') o.rotation.z = t * 1.2;
        else if (o.name === 'pulse') { const sc2 = 1 + Math.sin(t * 2) * 0.08; o.scale.setScalar(sc2); }
      });

      // Gruppe 2: Monster wandern zufällig im Habitat + sanftes Wippen.
      monsterBodies.forEach((m, i) => {
        const w = m.userData.wander as
          | { cx: number; cz: number; r: number; tx: number; tz: number; speed: number; phase: number }
          | undefined;
        if (w) {
          const dx = w.tx - m.position.x, dz = w.tz - m.position.z;
          const dist = Math.hypot(dx, dz);
          if (dist < 0.25) {
            // Neues Ziel innerhalb des Habitat-Radius wählen.
            const a = Math.random() * Math.PI * 2;
            const rr = Math.sqrt(Math.random()) * w.r;
            w.tx = w.cx + Math.cos(a) * rr;
            w.tz = w.cz + Math.sin(a) * rr;
          } else {
            // Gruppe 2: Wetter moduliert das Wander-Tempo (Regen bremst, Sturm wühlt auf).
            const step = Math.min(w.speed * weatherSpeedMul * dt, dist);
            m.position.x += (dx / dist) * step;
            m.position.z += (dz / dist) * step;
            // In Laufrichtung drehen (sanft).
            const targetRot = Math.atan2(dx, dz);
            let d = targetRot - m.rotation.y;
            while (d > Math.PI) d -= Math.PI * 2;
            while (d < -Math.PI) d += Math.PI * 2;
            m.rotation.y += d * Math.min(1, dt * 6);
          }
        }
        const body = m.userData.body as THREE.Group | undefined;

        // Gruppe 2: lustige Extra-Animationen (Hüpfen / Drehen / Emote).
        const fun = m.userData.fun as
          | { cd: number; mode: 'none' | 'hop' | 'spin'; tp: number; dur: number }
          | undefined;
        let hopOffset = 0;
        if (fun) {
          if (fun.mode === 'none') {
            fun.cd -= dt;
            if (fun.cd <= 0) {
              const r = Math.random();
              if (r < 0.4) { fun.mode = 'hop'; fun.tp = 0; fun.dur = 0.5; }
              else if (r < 0.7) { fun.mode = 'spin'; fun.tp = 0; fun.dur = 0.7; }
              else { spawnEmote(m); fun.cd = 3 + Math.random() * 5; }
            }
          } else if (fun.mode === 'hop') {
            fun.tp += dt;
            const k = Math.min(1, fun.tp / fun.dur);
            hopOffset = Math.sin(k * Math.PI) * 0.6;   // sanfter Sprungbogen
            if (fun.tp >= fun.dur) { fun.mode = 'none'; fun.cd = 2.5 + Math.random() * 5; }
          } else if (fun.mode === 'spin') {
            fun.tp += dt;
            const k = Math.min(1, fun.tp / fun.dur);
            if (body) body.rotation.y = k * Math.PI * 2;   // eine fröhliche Pirouette
            if (fun.tp >= fun.dur) { if (body) body.rotation.y = 0; fun.mode = 'none'; fun.cd = 2.5 + Math.random() * 5; }
          }
        }

        // Sanftes Idle-Wippen, kombiniert mit einem laufenden Hüpfer.
        if (body) body.position.y = Math.sin(t * 2 + i) * 0.05 + hopOffset;
        const orbit = body?.getObjectByName('rarityOrbit');
        if (orbit) orbit.rotation.y = t * 1.2;
      });

      // Emote-Symbole steigen auf und blenden aus; folgen dabei ihrem Monster.
      for (let i = emoteSprites.length - 1; i >= 0; i--) {
        const sp = emoteSprites[i];
        const ud = sp.userData as { life: number; dur: number; mon: THREE.Group; top: number };
        ud.life += dt;
        const k = ud.life / ud.dur;
        if (k >= 1) {
          world.remove(sp);
          (sp.material as THREE.Material).dispose();
          emoteSprites.splice(i, 1);
          continue;
        }
        sp.position.set(ud.mon.position.x, ud.mon.position.y + ud.top + k * 0.9, ud.mon.position.z);
        (sp.material as THREE.SpriteMaterial).opacity = 1 - k * k;
      }
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
      // Gruppe 1: Himmel/Sonne/Mond/Wolken (einmalig, an scene) aufräumen.
      sky.geometry.dispose(); (sky.material as THREE.Material).dispose();
      [sunOrb, moonOrb].forEach((g) => g.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => x.dispose());
      }));
      cloudLayers.forEach((l) => l.sprites.forEach((sp) => (sp.material as THREE.Material).dispose()));
      cloudTex.dispose();
      Object.values(emoteTex).forEach((t) => t.dispose());
      rainGeo.dispose(); (rain.material as THREE.Material).dispose();
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
