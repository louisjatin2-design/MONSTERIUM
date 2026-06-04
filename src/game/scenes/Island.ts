import Phaser from 'phaser';
import { useGameStore } from '@store/gameStore';
import { ISLAND_DEFS } from '@data/islands';
import { BUILDING_DEFS } from '@data/buildings';
import { MONSTER_DEFS } from '@data/monsters';
import { RARITY_RANK } from '@data/rarities';
import { EventBus, GameEvents } from '@game/EventBus';
import { OBSTACLE_DEFS } from '@data/obstacles';
import { GridTile } from '@game/objects/GridTile';
import { BuildingSprite } from '@game/objects/BuildingSprite';
import { MonsterSprite } from '@game/objects/MonsterSprite';
import { EggSprite } from '@game/objects/EggSprite';
import { ObstacleSprite } from '@game/objects/ObstacleSprite';
import {
  project, worldToGrid, worldToGridWithOffset, setIsoOffset, pointInPolygon, footprintCorners,
  GRID_COLS, GRID_ROWS, ISLAND_CENTER, TILE_W, TILE_H, LAND_THICK,
} from '@game/iso';
import type { BuildingInstance, RarityType, EvolutionStage } from '@gtypes/game';

// One island block in the 2D build overlay, in the inner world-container's
// local coordinate space (top-left at ox/oy), used for manual hit-testing.
interface OverlayIsland {
  id: string; ox: number; oy: number; isActive: boolean; locked: boolean; cost: number;
}

// Per-island colour theme so each landmass in the world reads distinctly
// (Monster-Legends style: lush, volcanic, oceanic, …).
interface IslandTheme {
  emoji: string;
  grass1: number; grass2: number; // top checkerboard
  cliff: number;                  // underside rock
  path: number;                   // bridge rope colour
}
const ISLAND_THEMES: Record<string, IslandTheme> = {
  emerald_isle:  { emoji: '🌿', grass1: 0x5a9e44, grass2: 0x64a84c, cliff: 0x4a3a22, path: 0xccaa66 },
  volcanic_peak: { emoji: '🌋', grass1: 0x8a3320, grass2: 0x9e4326, cliff: 0x3a1810, path: 0xdd7744 },
  ocean_depths:  { emoji: '🌊', grass1: 0x2a7a9e, grass2: 0x3290b0, cliff: 0x143a4a, path: 0x66ccdd },
  whispering_woods: { emoji: '🌲', grass1: 0x2f7a2f, grass2: 0x399139, cliff: 0x2a3a18, path: 0x9ec46a },
  sky_sanctuary:    { emoji: '☁️', grass1: 0x8fc8d8, grass2: 0xa6dce8, cliff: 0x5a7a8a, path: 0xeaf7ff },
  crystal_caverns:  { emoji: '💎', grass1: 0x5fa6c4, grass2: 0x78c2dc, cliff: 0x2a5a6e, path: 0xd6f7ff },
  void_rift:        { emoji: '🌌', grass1: 0x2a2450, grass2: 0x352d66, cliff: 0x14102a, path: 0x6a5ab6 },
};
const DEFAULT_ISLAND_THEME: IslandTheme = { emoji: '🏝️', grass1: 0x5a9e44, grass2: 0x64a84c, cliff: 0x4a3a22, path: 0xccaa66 };

// How much bigger a monster reads as it matures, so an Elder dwarfs a Baby —
// realistic proportions within the pen rather than a fixed size for everyone.
const STAGE_SIZE_SCALE: Record<EvolutionStage, number> = {
  Baby: 0.74, Juvenile: 0.88, Adult: 1.0, Elder: 1.16,
};

export class Island extends Phaser.Scene {
  // The whole archipelago is drawn at once: every unlocked island lives in the
  // same world at its own geographic offset, so the player roams one continuous
  // map instead of switching between islands. Tiles are kept per-island.
  private islandTiles: Map<string, GridTile[][]> = new Map();
  // islandId → world-space offset of that island's grid origin.
  private islandLayout: Map<string, { x: number; y: number }> = new Map();
  private buildingSprites: Map<string, BuildingSprite> = new Map();
  private residentSprites: Map<string, MonsterSprite[]> = new Map();
  private residentSignature: Map<string, string> = new Map();
  private eggSprites: Map<string, EggSprite> = new Map();
  private eggSignature = '';
  // Terrain obstacles on the current island, keyed by "tileX,tileY".
  private obstacleSprites: Map<string, ObstacleSprite> = new Map();
  private placementHighlight?: Phaser.GameObjects.Graphics;
  private unsubscribe?: () => void;

  // Neighbour islands drawn beside the active one to form one big world.
  // Each region records a world-space bounding box for tap handling.
  private neighborRegions: {
    islandId: string; locked: boolean; cost: number;
    minX: number; maxX: number; minY: number; maxY: number;
  }[] = [];

  private isDragging = false;
  private dragMoved = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private camStartX = 0;
  private camStartY = 0;

  // Pinch-to-zoom state (two-finger). Tracks the distance between the two
  // active pointers at the start of a pinch so we can scale relative to it.
  private pinchStartDist = 0;
  private pinchStartZoom = 1;
  // MIN_ZOOM is relaxed at runtime to whatever framing fits the current
  // viewport (so portrait phones can still see the whole island + neighbours).
  private MIN_ZOOM = 0.4;
  private readonly MAX_ZOOM = 2.4;
  // How far a pointer may move and still count as a tap (not a pan). Fingers
  // wobble several px during a normal tap, so this must be generous on touch —
  // a too-small value made buildings feel un-tappable on phones.
  private readonly DRAG_SLOP = 16;

  // Debounce handle for viewport resize / orientation-change relayouts.
  private resizeTimer?: Phaser.Time.TimerEvent;

  // Pan/zoom state for the flat 2D build overlay (independent of the camera,
  // applied directly to the overlay's inner "world" container).
  private overlayWorld?: Phaser.GameObjects.Container;
  private overlayPanX = 0;
  private overlayPanY = 0;
  private overlayZoom = 1;
  private overlayDragging = false;
  private overlayPinchDist = 0;
  private overlayPinchZoom = 1;

  private placementMode = false;
  private placementDefId = '';
  // When set, placement mode is relocating this existing building instead of
  // building a brand-new one.
  private moveInstanceId: string | null = null;
  // Last-known grid position of each spawned building ("tileX,tileY"), so the
  // reconcile pass can detect a move and respawn the sprite at its new spot.
  private buildingPos: Map<string, string> = new Map();
  private hoverCol = -1;
  private hoverRow = -1;
  private hoverIsland = '';

  // 2D top-down build overlay (shown only while placing a building).
  private buildOverlay?: Phaser.GameObjects.Container;
  private buildOverlayCells: Phaser.GameObjects.Rectangle[][] = [];
  private readonly BUILD_CELL = 24; // px per grid cell in the flat 2D view
  private suppressTapUntil = 0;     // ignore iso taps briefly after a 2D placement
  // Layout of the 2D overlay in the inner "world" container's local space, so
  // taps/hover can be hit-tested directly from the screen pointer (avoiding
  // Phaser's offset input transform on a screen-fixed, zoomed-camera overlay).
  private overlayLayout?: { cell: number; W2: number; H2: number; islands: OverlayIsland[] };

  constructor() { super('Island'); }

  create() {
    const state = useGameStore.getState();
    if (!ISLAND_DEFS[state.currentIslandId]) return;

    this.cameras.main.setBackgroundColor(0x5ab4e0); // aerial sky
    this.addSkyBackdrop();

    // Lay out every island in one shared world (geographically separated) and
    // draw them all at once — the player roams a single continuous archipelago
    // rather than swapping between islands.
    this.computeIslandLayout();
    const world = this.drawAllIslands(state);

    // Camera bounds span the whole world, padded so you can pan a little past
    // the edges.
    const PAD = 260;
    this.cameras.main.setBounds(
      world.minX - PAD, world.minY - PAD,
      (world.maxX - world.minX) + PAD * 2,
      (world.maxY - world.minY) + PAD * 2,
    );
    // Centre on whichever island the player is currently acting on.
    const startOff = this.offsetFor(state.currentIslandId);
    this.cameras.main.centerOn(ISLAND_CENTER.x + startOff.x, ISLAND_CENTER.y + startOff.y);
    // Pick a zoom that frames the world like the old FIT scaling, but since the
    // canvas now fills the whole viewport (RESIZE) the surrounding sky fills any
    // leftover space instead of black bars. Relax MIN_ZOOM so portrait phones
    // can still pinch out to the full archipelago.
    const fit = this.computeFitZoom();
    this.MIN_ZOOM = Math.min(this.MIN_ZOOM, fit * 0.7);
    this.cameras.main.setZoom(Phaser.Math.Clamp(fit, this.MIN_ZOOM, this.MAX_ZOOM));
    this.applyCameraFX();

    // Drifting clouds — added now that the camera frame is final so they can be
    // placed in world space relative to the live view (see addClouds).
    this.addClouds();

    // Spawn pre-placed buildings + their residents across ALL unlocked islands.
    for (const b of Object.values(state.buildings)) {
      if (state.unlockedIslands.includes(b.islandId)) this.spawnBuilding(b);
    }

    // Scatter every unlocked island's terrain obstacles (those not yet cleared).
    this.spawnObstacles(state);
    setIsoOffset(0, 0);

    // Enable up to 3 simultaneous pointers so pinch-to-zoom works on touch.
    this.input.addPointer(2);

    // Pointer handling: drag-to-pan + tap detection (works for both the iso
    // world and the flat 2D build overlay, depending on placement mode).
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      // Two fingers down → begin a pinch-zoom instead of a pan.
      if (this.beginPinchIfTwoPointers()) return;

      if (this.placementMode) {
        // Pan the 2D overlay.
        this.overlayDragging = true;
        this.dragMoved = false;
        this.dragStartX = p.x;
        this.dragStartY = p.y;
        this.camStartX = this.overlayPanX;
        this.camStartY = this.overlayPanY;
        return;
      }
      this.isDragging = true;
      this.dragMoved = false;
      this.dragStartX = p.x;
      this.dragStartY = p.y;
      this.camStartX = this.cameras.main.scrollX;
      this.camStartY = this.cameras.main.scrollY;
    });

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      // Active two-finger pinch takes priority over panning.
      if (this.updatePinch()) return;

      if (this.placementMode) {
        if (this.overlayDragging) {
          const dx = p.x - this.dragStartX;
          const dy = p.y - this.dragStartY;
          if (Math.hypot(dx, dy) > this.DRAG_SLOP) this.dragMoved = true;
          this.overlayPanX = this.camStartX + dx;
          this.overlayPanY = this.camStartY + dy;
          this.applyOverlayTransform();
        } else if (this.placementDefId !== '') {
          // Live footprint preview under the cursor (matches our own hit-test).
          const hit = this.overlayCellAt(p.x, p.y);
          if (hit?.isActive) this.previewBuildAt(hit.col, hit.row);
        }
        return;
      }

      if (this.isDragging) {
        const z = this.cameras.main.zoom;
        const dx = (p.x - this.dragStartX) / z;
        const dy = (p.y - this.dragStartY) / z;
        if (Math.hypot(p.x - this.dragStartX, p.y - this.dragStartY) > this.DRAG_SLOP) this.dragMoved = true;
        this.cameras.main.scrollX = this.camStartX - dx;
        this.cameras.main.scrollY = this.camStartY - dy;
      } else {
        this.updateHover(p);
      }
    });

    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      const wasPinching = this.pinchStartDist > 0 || this.overlayPinchDist > 0;
      // Count fingers STILL down (the one that just lifted already reads
      // isDown=false here). When fewer than two remain, the pinch is over —
      // clear its state so subsequent single taps register again. (The old
      // check used input.manager.pointersTotal, which is the configured pointer
      // count, not how many are down, so it never reset → taps died after zoom.)
      const downCount = [this.input.pointer1, this.input.pointer2, this.input.pointer3]
        .filter(pt => pt && pt.isDown).length;
      if (downCount < 2) {
        this.pinchStartDist = 0;
        this.overlayPinchDist = 0;
      }
      if (wasPinching) {
        // Lifting a finger out of a pinch must not count as a tap.
        this.isDragging = false;
        this.overlayDragging = false;
        return;
      }
      this.isDragging = false;
      this.overlayDragging = false;
      if (this.dragMoved) return; // it was a pan, not a tap
      // While the 2D build overlay is up we hit-test it ourselves from the raw
      // screen point — the overlay is screen-fixed (scrollFactor 0) so Phaser's
      // per-object input transform is thrown off by the zoomed/scrolled camera,
      // which made overlay clicks register offset from where they happened.
      if (this.placementMode) { this.handleOverlayTap(p); return; }
      if (Date.now() < this.suppressTapUntil) return;
      this.handleTap(p);
    });

    // Mouse-wheel zoom: zooms the iso camera, or the 2D overlay in build mode.
    this.input.on('wheel', (
      _p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number,
    ) => {
      const pointer = this.input.activePointer;
      if (this.placementMode) {
        this.zoomOverlayBy(dy > 0 ? 0.9 : 1.1, pointer);
      } else {
        this.zoomCameraBy(dy > 0 ? 0.9 : 1.1, pointer);
      }
    });

    // Subscribe to store: new buildings, construction state, residents.
    this.unsubscribe = useGameStore.subscribe((s) => this.reconcile(s));

    // Spawn eggs on pedestals around the hatchery.
    this.refreshEggs(state);

    // EventBus wiring.
    EventBus.on(GameEvents.OPEN_BUILD_OVERLAY, this.onOpenBuildOverlay, this);
    EventBus.on(GameEvents.ENTER_PLACEMENT_MODE, this.onEnterPlacement, this);
    EventBus.on(GameEvents.ENTER_MOVE_MODE, this.onEnterMoveMode, this);
    EventBus.on(GameEvents.PANEL_CLOSED, this.onPanelClosed, this);
    EventBus.on(GameEvents.START_BATTLE, this.onStartBattle, this);
    EventBus.on(GameEvents.ISLAND_CHANGED, this.onIslandChanged, this);
    EventBus.on(GameEvents.HATCH_EGG_ANIMATE, this.onHatchAnimate, this);

    // Reframe when the viewport changes size (orientation flip / window resize)
    // so the game always fills the screen in both portrait and landscape.
    this.scale.on('resize', this.onResize, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.onShutdown());
  }

  update() {
    const now = Date.now();
    // Live countdowns floating above any building that is being built OR upgraded.
    const buildings = useGameStore.getState().buildings;
    for (const [id, sprite] of this.buildingSprites) {
      const b = buildings[id];
      if (!b) continue;
      if (b.constructionEndMs) sprite.showBuildTimer('🏗️', b.constructionEndMs - now);
      else if (b.upgradeEndMs) sprite.showBuildTimer('⬆️', b.upgradeEndMs - now);
      else sprite.hideBuildTimer();
    }
    if (this.eggSprites.size === 0) return;
    const eggs = useGameStore.getState().eggs;
    for (const egg of eggs) {
      const spr = this.eggSprites.get(egg.id);
      if (spr) spr.updateTimer(egg.hatchEndMs - now);
    }
  }

  // ---- Visuals / atmosphere --------------------------------------------

  private isWebGL(): boolean {
    return this.sys.game.renderer.type === Phaser.WEBGL;
  }

  // Draws the whole island underside as ONE continuous rocky cliff, so the
  // perimeter reads as an organic floating rock instead of stacked diamonds.
  // The bottom edge is irregular and a few hanging boulders break the line.
  private drawLandmass(mask: boolean[][]) {
    const g = this.add.graphics();
    g.setDepth(-100); // above the sky, below every grass top (depth >= 0)

    const isLand = (c: number, r: number) =>
      r >= 0 && r < GRID_ROWS && c >= 0 && c < GRID_COLS && !!mask[r]?.[c];

    // Deterministic pseudo-random so the cliff is stable between frames.
    const rnd = (a: number, b: number) => {
      const x = Math.sin(a * 91.7 + b * 47.3) * 43758.5453;
      return x - Math.floor(x);
    };

    // 8 vertical rock bands: earthy dirt at the top → dark stone at the base.
    const BANDS = [0xb88848, 0xa67838, 0x8f632e, 0x785024, 0x60401c, 0x4a3014, 0x36220e, 0x241608];
    const N = BANDS.length;

    type Cell = { col: number; row: number; cx: number; cy: number; thick: number; front: boolean };
    const cells: Cell[] = [];

    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        if (!isLand(col, row)) continue;
        // A tile shows cliff only if the tile diagonally in front (col+1,row+1)
        // is open air. Those front-edge tiles get extra, irregular depth.
        const frontOpen = !isLand(col + 1, row + 1);
        const sideOpen  = !isLand(col + 1, row) || !isLand(col, row + 1);
        const front = frontOpen || sideOpen;
        const extra = front ? 18 + rnd(col, row) * 34 : 4;
        const c = project(col + 0.5, row + 0.5);
        cells.push({ col, row, cx: c.x, cy: c.y, thick: LAND_THICK + extra, front });
      }
    }

    // Render back-to-front so nearer cliffs overlap farther ones cleanly.
    cells.sort((a, b) => (a.col + a.row) - (b.col + b.row));

    for (const cell of cells) {
      const left  = { x: cell.cx - TILE_W / 2, y: cell.cy };
      const front = { x: cell.cx,              y: cell.cy + TILE_H / 2 };
      const right = { x: cell.cx + TILE_W / 2, y: cell.cy };

      for (let k = 0; k < N; k++) {
        const y0 = (k       / N) * cell.thick;
        const y1 = ((k + 1) / N) * cell.thick;
        g.fillStyle(BANDS[k], 1);
        g.fillPoints([
          { x: left.x,  y: left.y  + y0 },
          { x: front.x, y: front.y + y0 },
          { x: right.x, y: right.y + y0 },
          { x: right.x, y: right.y + y1 },
          { x: front.x, y: front.y + y1 },
          { x: left.x,  y: left.y  + y1 },
        ], true);
      }

      // Front-edge detailing: cracks, shadow streaks and a hanging boulder.
      if (cell.front) {
        // Vertical crack
        if (rnd(cell.row, cell.col) > 0.5) {
          g.lineStyle(1.5, 0x140c06, 0.4);
          const fx = front.x + (rnd(cell.col, cell.row) - 0.5) * TILE_W * 0.4;
          g.beginPath();
          g.moveTo(fx, front.y + cell.thick * 0.15);
          g.lineTo(fx + (rnd(cell.col, 7) - 0.5) * 8, front.y + cell.thick * 0.8);
          g.strokePath();
        }
        // A chunky hanging boulder below the front point, breaking the base line.
        if (rnd(cell.col * 2, cell.row) > 0.55) {
          const bx = front.x + (rnd(cell.row, cell.col * 3) - 0.5) * TILE_W * 0.35;
          const by = front.y + cell.thick;
          const bw = 10 + rnd(cell.col, cell.row * 2) * 14;
          const bh = 14 + rnd(cell.row * 3, cell.col) * 26;
          g.fillStyle(0x241608, 1);
          g.fillPoints([
            { x: bx - bw / 2, y: by - 4 },
            { x: bx + bw / 2, y: by - 4 },
            { x: bx + bw * 0.28, y: by + bh * 0.6 },
            { x: bx, y: by + bh },
            { x: bx - bw * 0.3, y: by + bh * 0.55 },
          ], true);
          g.fillStyle(0x36220e, 0.7);
          g.fillEllipse(bx - bw * 0.12, by + bh * 0.18, bw * 0.5, bh * 0.4);
        }
      }
    }

    // Soft drop-shadow puff far below the island, grounding it in the sky.
    const shKey = 'fx-island-shadow';
    if (!this.textures.exists(shKey)) {
      const w = 360, h = 120;
      const tex = this.textures.createCanvas(shKey, w, h);
      const ctx = tex?.getContext();
      if (ctx) {
        const grd = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
        grd.addColorStop(0.0, 'rgba(20,40,70,0.30)');
        grd.addColorStop(1.0, 'rgba(20,40,70,0)');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        tex?.refresh();
      }
    }
    const sc = project(GRID_COLS / 2, GRID_ROWS / 2 + 4);
    this.add.image(sc.x, sc.y + LAND_THICK + 80, shKey)
      .setDepth(-200).setScale(2.4, 1.6).setAlpha(0.8);
  }

  // Floating-island sky: deep blue overhead, lighter at the horizon, clouds
  // drifting both above and below the island mass.
  private addSkyBackdrop() {
    const W = this.scale.width, H = this.scale.height;

    // Full aerial-sky gradient — no meadow, no ground, only sky.
    const skyKey = 'fx-sky-float';
    if (!this.textures.exists(skyKey)) {
      const tex = this.textures.createCanvas(skyKey, 8, H);
      const ctx = tex?.getContext();
      if (ctx) {
        // Bright, friendly daytime sky — no dark navy band at the top. Goes
        // from a clear sky-blue overhead down to a pale, hazy horizon.
        const grd = ctx.createLinearGradient(0, 0, 0, H);
        grd.addColorStop(0.00, '#3f8fce');
        grd.addColorStop(0.22, '#57a6dd');
        grd.addColorStop(0.50, '#79c0ea');
        grd.addColorStop(0.80, '#a6d9f3');
        grd.addColorStop(1.00, '#d6effb');
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, 8, H);
        tex?.refresh();
      }
    }
    this.add.image(0, 0, skyKey)
      .setOrigin(0, 0).setScrollFactor(0).setDepth(-1000)
      .setDisplaySize(W, H);

    // Glowing sun near top-right.
    const sunKey = 'fx-sun';
    if (!this.textures.exists(sunKey)) {
      const s = 256;
      const tex = this.textures.createCanvas(sunKey, s, s);
      const ctx = tex?.getContext();
      if (ctx) {
        const grd = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
        grd.addColorStop(0.00, 'rgba(255,248,214,0.95)');
        grd.addColorStop(0.35, 'rgba(255,235,160,0.55)');
        grd.addColorStop(1.00, 'rgba(255,235,160,0)');
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, s, s);
        tex?.refresh();
      }
    }
    this.add.image(W * 0.82, H * 0.12, sunKey)
      .setScrollFactor(0).setDepth(-990).setScale(2.6).setAlpha(0.88);

    // Clouds are spawned later in create(), AFTER the camera has been centred
    // and zoomed, so they can be laid out relative to the live world view.

    // Soft misty haze at the very bottom — horizon atmosphere.
    const hazeKey = 'fx-haze-float';
    if (!this.textures.exists(hazeKey)) {
      const tex = this.textures.createCanvas(hazeKey, 8, 140);
      const ctx = tex?.getContext();
      if (ctx) {
        const grd = ctx.createLinearGradient(0, 0, 0, 140);
        grd.addColorStop(0.0, 'rgba(180,220,248,0)');
        grd.addColorStop(1.0, 'rgba(200,232,252,0.45)');
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, 8, 140);
        tex?.refresh();
      }
    }
    this.add.image(0, H * 0.62, hazeKey)
      .setOrigin(0, 0).setScrollFactor(0).setDepth(-960)
      .setDisplaySize(W, H * 0.38);

    // (No darkening overlay — the world reads bright and clear on phones,
    // including outdoors / in sunlight, so every tap target stays legible.)
  }

  // Realistic canvas-texture clouds using layered radial gradients.
  // Three shape variants are baked once and reused at different scales.
  private addClouds() {
    // Bake cloud textures once (guarded by exists check).
    this.bakeCloudTexture('cld-a', 360, 180, 0); // classic puffy cumulus
    this.bakeCloudTexture('cld-b', 280, 140, 1); // wide flat cloud bank
    this.bakeCloudTexture('cld-c', 220, 120, 2); // tall billowing tower

    // Thin high-altitude cirrus streaks (separate horizontal stripes).
    this.bakeCirrusTexture('cld-ci', 420, 60);

    // Unlike the old screen-pinned clouds (scrollFactor 0, which dragged them
    // along with the camera like a lens overlay), these live in WORLD space at
    // the default scroll factor. They drift across the sky on their own timers,
    // so the camera reveals them with natural parallax instead of carrying them
    // — i.e. the clouds move independently of the camera. `fx`/`fy` are the
    // spawn point as a fraction of the live world view.
    const groups: { fx: number; fy: number; key: string; sc: number; al: number; depth: number; dur: number }[] = [
      // High cumulus — above the island
      { fx: 0.04, fy: 0.09, key: 'cld-a', sc: 1.05, al: 0.88, depth: -870, dur: 84000 },
      { fx: 0.40, fy: 0.06, key: 'cld-c', sc: 0.80, al: 0.75, depth: -876, dur: 61000 },
      { fx: 0.76, fy: 0.17, key: 'cld-b', sc: 0.90, al: 0.80, depth: -882, dur: 73000 },
      // Cirrus high up — very light streaks
      { fx: 0.20, fy: 0.04, key: 'cld-ci', sc: 1.30, al: 0.45, depth: -895, dur: 110000 },
      { fx: 0.65, fy: 0.02, key: 'cld-ci', sc: 0.90, al: 0.38, depth: -898, dur: 130000 },
      // Low cumulus — below the island (sells the floating feel)
      { fx: 0.10, fy: 0.71, key: 'cld-a', sc: 1.50, al: 0.70, depth: -848, dur: 96000 },
      { fx: 0.50, fy: 0.79, key: 'cld-b', sc: 1.20, al: 0.65, depth: -853, dur: 70000 },
      { fx: 0.80, fy: 0.67, key: 'cld-c', sc: 0.95, al: 0.72, depth: -857, dur: 80000 },
    ];

    const cam = this.cameras.main;
    // Spawn on the next tick: cam.worldView is only refreshed during the
    // camera's preRender, so it isn't reliable in the same frame create() runs.
    this.time.delayedCall(0, () => {
      for (const d of groups) {
        const img = this.add.image(0, 0, d.key);
        img.setDepth(d.depth).setScale(d.sc).setAlpha(d.al); // scrollFactor stays 1 (world-anchored)
        const view = cam.worldView;
        img.x = view.x + d.fx * view.width;
        img.y = view.y + d.fy * view.height;

        const drift = () => {
          const v = cam.worldView;
          this.tweens.add({
            targets: img,
            x: v.right + img.displayWidth,
            duration: d.dur * (0.88 + Math.random() * 0.24),
            ease: 'Linear',
            onComplete: () => {
              // Re-enter from the left edge of whatever the camera currently
              // frames, and keep the cloud in its sky band — clouds therefore
              // keep sweeping across the sky regardless of where the camera has
              // panned.
              const v2 = cam.worldView;
              img.x = v2.x - img.displayWidth;
              img.y = v2.y + d.fy * v2.height;
              drift();
            },
          });
        };
        drift();
      }
    });
  }

  // Bakes a cumulus cloud as a canvas texture using layered radial gradients.
  // Each variant has a different puff layout; all share the same rendering logic.
  private bakeCloudTexture(key: string, w: number, h: number, variant: number) {
    if (this.textures.exists(key)) return;
    const tex = this.textures.createCanvas(key, w, h);
    const ctx = tex?.getContext();
    if (!ctx) return;

    ctx.clearRect(0, 0, w, h);

    // Puff definitions: [cx%, cy%, radius%] — all relative to texture size.
    const puffSets = [
      // variant 0 — classic puffy cumulus
      [
        [0.50, 0.44, 0.30], [0.30, 0.54, 0.24], [0.70, 0.51, 0.23],
        [0.16, 0.64, 0.18], [0.84, 0.62, 0.17], [0.42, 0.31, 0.21],
        [0.60, 0.34, 0.19], [0.06, 0.73, 0.13], [0.94, 0.71, 0.11],
        [0.50, 0.20, 0.15],
      ],
      // variant 1 — wide flat cloud bank
      [
        [0.50, 0.55, 0.27], [0.24, 0.58, 0.23], [0.76, 0.55, 0.25],
        [0.08, 0.65, 0.18], [0.92, 0.63, 0.17], [0.38, 0.44, 0.19],
        [0.62, 0.46, 0.18], [0.50, 0.36, 0.14],
      ],
      // variant 2 — tall billowing tower
      [
        [0.50, 0.32, 0.33], [0.34, 0.50, 0.26], [0.66, 0.48, 0.24],
        [0.20, 0.63, 0.20], [0.80, 0.61, 0.18], [0.50, 0.18, 0.22],
        [0.38, 0.26, 0.17], [0.62, 0.28, 0.16], [0.50, 0.08, 0.14],
      ],
    ];

    const puffs = puffSets[Math.min(variant, puffSets.length - 1)];
    const dim = Math.min(w, h);

    for (const [fpx, fpy, fpr] of puffs) {
      const px = fpx * w, py = fpy * h, pr = fpr * dim;
      // Brighter towards the top (sunlit), slightly blue-white.
      const topness  = 1 - fpy;           // 1 at top, 0 at bottom
      const bright   = Math.round(215 + topness * 40);   // 215–255
      const blueShift = Math.round(topness * 12);

      const grad = ctx.createRadialGradient(px, py - pr * 0.15, 0, px, py, pr);
      grad.addColorStop(0.00, `rgba(${bright},${bright},${Math.min(255, bright + blueShift)}, 0.92)`);
      grad.addColorStop(0.45, `rgba(${bright - 18},${bright - 18},${Math.min(255, bright - 6)}, 0.62)`);
      grad.addColorStop(0.80, `rgba(200,215,235, 0.22)`);
      grad.addColorStop(1.00, `rgba(190,210,230, 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(px, py, pr, pr * 0.88, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Blue-grey shadow cast on the flat underside.
    const shadowGrad = ctx.createLinearGradient(0, h * 0.48, 0, h * 0.92);
    shadowGrad.addColorStop(0.0, 'rgba(110,145,185, 0)');
    shadowGrad.addColorStop(1.0, 'rgba( 90,125,170, 0.32)');
    ctx.fillStyle = shadowGrad;
    ctx.fillRect(0, h * 0.48, w, h * 0.52);

    // Thin bright highlight along the very top.
    const hiliteGrad = ctx.createLinearGradient(0, 0, 0, h * 0.22);
    hiliteGrad.addColorStop(0.0, 'rgba(255,255,255, 0.28)');
    hiliteGrad.addColorStop(1.0, 'rgba(255,255,255, 0)');
    ctx.fillStyle = hiliteGrad;
    ctx.fillRect(0, 0, w, h * 0.22);

    tex?.refresh();
  }

  // Thin wispy cirrus streaks — horizontal gradient bands, very transparent.
  private bakeCirrusTexture(key: string, w: number, h: number) {
    if (this.textures.exists(key)) return;
    const tex = this.textures.createCanvas(key, w, h);
    const ctx = tex?.getContext();
    if (!ctx) return;

    ctx.clearRect(0, 0, w, h);

    // Two offset horizontal streaks.
    const streaks = [
      { y: 0.30, thickness: 0.28 },
      { y: 0.68, thickness: 0.18 },
    ];
    for (const s of streaks) {
      const cy = s.y * h, halfH = (s.thickness / 2) * h;
      const grad = ctx.createRadialGradient(w * 0.5, cy, 0, w * 0.5, cy, w * 0.52);
      grad.addColorStop(0.0,  'rgba(240,248,255, 0.55)');
      grad.addColorStop(0.55, 'rgba(230,242,255, 0.25)');
      grad.addColorStop(1.0,  'rgba(220,238,255, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, cy - halfH, w, halfH * 2);
    }

    tex?.refresh();
  }

  // World post-processing removed — it washed out shapes. We rely on
  // high-contrast colours and strong outlines in the sprites instead.
  private applyCameraFX() {
    /* intentionally empty: no camera-wide shaders */
  }

  // ---- Zoom (camera + overlay) ------------------------------------------

  private clampZoom(z: number): number {
    return Phaser.Math.Clamp(z, this.MIN_ZOOM, this.MAX_ZOOM);
  }

  // Zoom factor that frames the 1280×720 design space inside the live viewport
  // (the same factor the old Scale.FIT used), so the island looks correctly
  // sized on phones, tablets and desktop alike.
  private computeFitZoom(): number {
    return Math.min(this.scale.width / 1280, this.scale.height / 720);
  }

  // Viewport changed (orientation flip / browser resize). Rebuild the scene once
  // the size settles so the sky, camera framing and layout match the new size.
  private onResize = () => {
    this.resizeTimer?.remove();
    // Skip mid-placement: the 2D overlay rebuilds itself on the next open.
    this.resizeTimer = this.time.delayedCall(180, () => {
      if (this.scene.isActive() && !this.placementMode) this.scene.restart();
    });
  };

  // Zoom the iso camera toward a focal SCREEN point — the mouse cursor for a
  // wheel zoom, or the midpoint of the two fingers for a pinch — keeping the
  // world point under that focal point pinned exactly in place. So it always
  // zooms in on wherever you're pointing / swiping, not the screen centre.
  //
  // The maths is done by hand instead of via cam.getWorldPoint(): after
  // setZoom() the camera's transform matrix isn't rebuilt until the next
  // preRender, so reading world points back in the same frame returns stale
  // values — which made the zoom drift toward the centre rather than the focal
  // point. midPoint = scroll + half-viewport (independent of zoom); the world
  // point under screen (fx,fy) is midPoint + (focal − half) / zoom.
  private zoomCameraToFocal(targetZoom: number, fx: number, fy: number) {
    const cam = this.cameras.main;
    const z0 = cam.zoom;
    const z1 = this.clampZoom(targetZoom);
    if (z1 === z0) return;
    const halfW = cam.width / 2, halfH = cam.height / 2;
    const worldX = cam.scrollX + halfW + (fx - halfW) / z0;
    const worldY = cam.scrollY + halfH + (fy - halfH) / z0;
    cam.setZoom(z1);
    cam.scrollX = worldX - halfW - (fx - halfW) / z1;
    cam.scrollY = worldY - halfH - (fy - halfH) / z1;
  }

  // Zoom the iso camera by a multiplicative factor, keeping the point under
  // the pointer fixed on screen (focal zoom, Monster-Legends style).
  private zoomCameraBy(factor: number, pointer: Phaser.Input.Pointer) {
    this.zoomCameraToFocal(this.cameras.main.zoom * factor, pointer.x, pointer.y);
  }

  // Two pointers down? Start tracking the pinch (camera or overlay).
  private beginPinchIfTwoPointers(): boolean {
    const p1 = this.input.pointer1, p2 = this.input.pointer2;
    if (!p1?.isDown || !p2?.isDown) return false;
    const dist = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
    if (this.placementMode) {
      this.overlayPinchDist = dist;
      this.overlayPinchZoom = this.overlayZoom;
    } else {
      this.pinchStartDist = dist;
      this.pinchStartZoom = this.cameras.main.zoom;
    }
    return true;
  }

  // While two fingers are down, scale relative to the initial pinch distance.
  // Returns true if a pinch is actively being handled.
  private updatePinch(): boolean {
    const p1 = this.input.pointer1, p2 = this.input.pointer2;
    if (!p1?.isDown || !p2?.isDown) return false;
    const dist = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
    const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 } as Phaser.Input.Pointer;

    if (this.placementMode && this.overlayPinchDist > 0) {
      const target = this.clampZoom(this.overlayPinchZoom * (dist / this.overlayPinchDist));
      this.setOverlayZoom(target, mid);
      this.dragMoved = true;
      return true;
    }
    if (!this.placementMode && this.pinchStartDist > 0) {
      // Zoom toward the midpoint of the two fingers — i.e. wherever you're
      // pinching/swiping — and let that midpoint move as the fingers do.
      this.zoomCameraToFocal(this.pinchStartZoom * (dist / this.pinchStartDist), mid.x, mid.y);
      this.dragMoved = true;
      return true;
    }
    return false;
  }

  // ---- 2D overlay pan/zoom ----------------------------------------------

  private applyOverlayTransform() {
    if (!this.overlayWorld) return;
    const { width, height } = this.scale;
    this.overlayWorld.setPosition(width / 2 + this.overlayPanX, height / 2 + this.overlayPanY);
    this.overlayWorld.setScale(this.overlayZoom);
  }

  // Zoom the overlay by a factor, keeping the focal screen point fixed.
  private zoomOverlayBy(factor: number, pointer: Phaser.Input.Pointer) {
    this.setOverlayZoom(this.clampZoom(this.overlayZoom * factor), pointer);
  }

  // Set overlay zoom to an absolute value, keeping the focal point fixed.
  private setOverlayZoom(target: number, focal: { x: number; y: number }) {
    if (!this.overlayWorld) return;
    const { width, height } = this.scale;
    const cx = width / 2 + this.overlayPanX;
    const cy = height / 2 + this.overlayPanY;
    // World-local coordinate currently under the focal point.
    const localX = (focal.x - cx) / this.overlayZoom;
    const localY = (focal.y - cy) / this.overlayZoom;
    this.overlayZoom = target;
    // Re-anchor pan so that local point stays under the focal screen point.
    this.overlayPanX = focal.x - width / 2 - localX * this.overlayZoom;
    this.overlayPanY = focal.y - height / 2 - localY * this.overlayZoom;
    this.applyOverlayTransform();
  }

  // Compass directions used to place the unlockable islands AROUND the active
  // one (Monster-Legends style). Diagonals are normalised so they sit at the
  // same radius as the cardinal directions.
  private static readonly RING_DIRS = [
    { dx:  1, dy:  0 },                                   // East
    { dx:  0, dy:  1 },                                   // South
    { dx: -1, dy:  0 },                                   // West
    { dx:  0, dy: -1 },                                   // North
    { dx:  0.7071, dy:  0.7071 },                         // South-East
    { dx: -0.7071, dy:  0.7071 },                         // South-West
    { dx: -0.7071, dy: -0.7071 },                         // North-West
    { dx:  0.7071, dy: -0.7071 },                         // North-East
  ];

  // Assign every island a fixed world-space offset: the starter island sits at
  // the origin and the rest are spread evenly around it so they're clearly
  // separated but reachable by panning across one continuous world.
  private computeIslandLayout() {
    this.islandLayout.clear();
    const ids = Object.keys(ISLAND_DEFS);
    const starter = ids[0];
    this.islandLayout.set(starter, { x: 0, y: 0 });
    const others = ids.slice(1);
    const RX = (GRID_COLS + GRID_ROWS) * (TILE_W / 2) * 1.15 + 120;
    const RY = (GRID_COLS + GRID_ROWS) * (TILE_H / 2) * 1.55 + 130;
    const n = Math.max(1, others.length);
    others.forEach((id, i) => {
      const ang = (i / n) * Math.PI * 2 - Math.PI / 2; // first neighbour at top
      this.islandLayout.set(id, { x: Math.cos(ang) * RX, y: Math.sin(ang) * RY });
    });
  }

  private offsetFor(islandId: string): { x: number; y: number } {
    return this.islandLayout.get(islandId) ?? { x: 0, y: 0 };
  }

  // Draw every island at its world offset at once. Unlocked islands get the full
  // interactive grid (build-able tiles); locked islands are greyed-out plots
  // showing a 🔒 and their price, tappable to unlock. Returns the world-space
  // bounding box covering the whole archipelago for the camera bounds.
  private drawAllIslands(
    state: ReturnType<typeof useGameStore.getState>,
  ): { minX: number; maxX: number; minY: number; maxY: number } {
    this.neighborRegions = [];
    this.islandTiles.clear();

    let worldMinX = Infinity, worldMaxX = -Infinity, worldMinY = Infinity, worldMaxY = -Infinity;
    const centers = new Map<string, { x: number; y: number }>();

    for (const island of Object.values(ISLAND_DEFS)) {
      const offset = this.offsetFor(island.id);
      setIsoOffset(offset.x, offset.y);
      const unlocked = state.unlockedIslands.includes(island.id);
      const theme = ISLAND_THEMES[island.id] ?? DEFAULT_ISLAND_THEME;

      // Island bounding box (in absolute world space) from its land tiles.
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (let row = 0; row < GRID_ROWS; row++) {
        for (let col = 0; col < GRID_COLS; col++) {
          if (!island.tileMask[row]?.[col]) continue;
          const c = project(col + 0.5, row + 0.5);
          minX = Math.min(minX, c.x - TILE_W / 2); maxX = Math.max(maxX, c.x + TILE_W / 2);
          minY = Math.min(minY, c.y - TILE_H / 2); maxY = Math.max(maxY, c.y + TILE_H / 2);
        }
      }
      if (!isFinite(minX)) continue;
      const center = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
      centers.set(island.id, center);

      if (unlocked) {
        // Full landmass + interactive isometric grid.
        this.drawLandmass(island.tileMask);
        const grid: GridTile[][] = [];
        for (let row = 0; row < GRID_ROWS; row++) {
          grid[row] = [];
          for (let col = 0; col < GRID_COLS; col++) {
            grid[row][col] = new GridTile(this, col, row, island.tileMask[row][col]);
          }
        }
        this.islandTiles.set(island.id, grid);
        this.add.text(center.x, minY - 30, `${theme.emoji} ${island.name}`, {
          fontSize: '20px', color: '#ffffff', fontStyle: 'bold',
          stroke: '#000000', strokeThickness: 5,
        }).setOrigin(0.5).setDepth(40);
      } else {
        // Greyed-out locked plot the player can tap to unlock.
        this.drawLockedPlot(island, theme, center, minX, maxX, minY, maxY);
        this.neighborRegions.push({
          islandId: island.id, locked: true, cost: island.goldCost ?? 0,
          minX, maxX, minY: minY - 34, maxY: maxY + 28,
        });
      }

      worldMinX = Math.min(worldMinX, minX); worldMaxX = Math.max(worldMaxX, maxX);
      worldMinY = Math.min(worldMinY, minY - 40); worldMaxY = Math.max(worldMaxY, maxY + LAND_THICK + 30);
    }

    // Connecting bridges from the starter island out to each other island, so
    // the archipelago reads as one connected world.
    setIsoOffset(0, 0);
    const starterId = Object.keys(ISLAND_DEFS)[0];
    const hub = centers.get(starterId);
    if (hub) {
      for (const [id, c] of centers) {
        if (id === starterId) continue;
        const theme = ISLAND_THEMES[id] ?? DEFAULT_ISLAND_THEME;
        this.drawBridge(hub, c, theme.path, !state.unlockedIslands.includes(id));
      }
    }

    return { minX: worldMinX, maxX: worldMaxX, minY: worldMinY, maxY: worldMaxY };
  }

  // Draw a locked island as a dimmed grey plot with a 🔒 and its gold price.
  // Assumes the iso offset is already set to this island's slot.
  private drawLockedPlot(
    island: typeof ISLAND_DEFS[string],
    _theme: IslandTheme,
    center: { x: number; y: number },
    minX: number, maxX: number, minY: number, maxY: number,
  ) {
    const cost = island.goldCost ?? 0;
    const cliff = this.add.graphics(); cliff.setDepth(-60);
    const grass = this.add.graphics(); grass.setDepth(-50);
    const thickness = 26;
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        if (!island.tileMask[row]?.[col]) continue;
        const c = project(col + 0.5, row + 0.5);
        const left = { x: c.x - TILE_W / 2, y: c.y };
        const bottom = { x: c.x, y: c.y + TILE_H / 2 };
        const right = { x: c.x + TILE_W / 2, y: c.y };
        const top = { x: c.x, y: c.y - TILE_H / 2 };
        cliff.fillStyle(0x3a3a3a, 0.6);
        cliff.fillPoints([
          left, bottom, right,
          { x: right.x, y: right.y + thickness },
          { x: bottom.x, y: bottom.y + thickness },
          { x: left.x, y: left.y + thickness },
        ], true);
        const checker = (col + row) % 2 === 0;
        grass.fillStyle(checker ? 0x6b6b6b : 0x767676, 0.7);
        grass.fillPoints([top, right, bottom, left], true);
        grass.lineStyle(1, 0x000000, 0.12);
        grass.strokePoints([top, right, bottom, left], true, true);
      }
    }
    this.add.text(center.x, minY - 30, `🔒 ${island.name}`, {
      fontSize: '20px', color: '#cccccc', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(40);
    this.add.text(center.x, center.y - 16, '🔒', { fontSize: '52px' }).setOrigin(0.5).setDepth(40);
    this.add.text(center.x, center.y + 34, `🪙 ${cost}`, {
      fontSize: '22px', color: '#ffd700', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(40);
    this.add.text(center.x, maxY + 10, 'Tippen zum Freischalten', {
      fontSize: '12px', color: '#dddddd', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(40);
    void maxX;
  }

  // A rope-and-plank bridge connecting two island anchors, so the world reads
  // as one connected archipelago rather than detached tiles.
  private drawBridge(from: { x: number; y: number }, to: { x: number; y: number }, color: number, dim: boolean) {
    const g = this.add.graphics();
    g.setDepth(-70);
    const alpha = dim ? 0.4 : 0.85;
    // Perpendicular offset so the two rope lines run parallel in ANY direction.
    const len = Math.max(1, Phaser.Math.Distance.Between(from.x, from.y, to.x, to.y));
    const nx = -(to.y - from.y) / len * 6; // normal × half-width
    const ny =  (to.x - from.x) / len * 6;
    // Two rope lines.
    g.lineStyle(3, color, alpha);
    g.lineBetween(from.x + nx, from.y + ny, to.x + nx, to.y + ny);
    g.lineBetween(from.x - nx, from.y - ny, to.x - nx, to.y - ny);
    // Planks, evenly spaced along the full length (works for any direction).
    const steps = Math.max(4, Math.floor(len / 26));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const px = from.x + (to.x - from.x) * t;
      const py = from.y + (to.y - from.y) * t;
      g.fillStyle(0x8a5a2a, alpha);
      g.fillRect(px - 6, py - 8, 12, 16);
    }
  }

  // Did the player tap a neighbour island? Handle switch / unlock if so.
  private handleNeighborTap(wx: number, wy: number): boolean {
    for (const r of this.neighborRegions) {
      if (wx >= r.minX && wx <= r.maxX && wy >= r.minY && wy <= r.maxY) {
        this.switchOrUnlockIsland(r.islandId, r.locked, r.cost);
        return true;
      }
    }
    return false;
  }

  // Switch to an island, or — if it's still locked — offer to unlock it for
  // gold (falling back to the islands panel if the player can't afford it).
  // Shared by the iso world and the 2D build overlay.
  private switchOrUnlockIsland(islandId: string, locked: boolean, cost: number) {
    const store = useGameStore.getState();
    if (locked) {
      if (store.gold < cost) {
        EventBus.emit(GameEvents.OPEN_ISLANDS_PANEL, {});
        return;
      }
      if (confirm(`Insel für 🪙 ${cost} Gold freischalten?`)) {
        if (store.purchaseIsland(islandId)) {
          store.setCurrentIsland(islandId);
          EventBus.emit(GameEvents.ISLAND_CHANGED, { islandId });
        }
      }
    } else {
      store.setCurrentIsland(islandId);
      EventBus.emit(GameEvents.ISLAND_CHANGED, { islandId });
    }
  }

  // ---- Input helpers ----------------------------------------------------

  private updateHover(p: Phaser.Input.Pointer) {
    const w = this.cameras.main.getWorldPoint(p.x, p.y);

    // Find which unlocked island's land tile (if any) sits under the cursor.
    let foundIsland = '', fcol = -1, frow = -1;
    for (const islandId of useGameStore.getState().unlockedIslands) {
      const off = this.offsetFor(islandId);
      const { col, row } = worldToGridWithOffset(w.x, w.y, off.x, off.y);
      const grid = this.islandTiles.get(islandId);
      if (this.inBounds(col, row) && grid?.[row]?.[col]?.isLand) {
        foundIsland = islandId; fcol = col; frow = row; break;
      }
    }

    if (foundIsland === this.hoverIsland && fcol === this.hoverCol && frow === this.hoverRow) return;
    // Clear the previously hovered tile.
    const prev = this.islandTiles.get(this.hoverIsland);
    if (prev && this.inBounds(this.hoverCol, this.hoverRow)) {
      prev[this.hoverRow][this.hoverCol].resetColor();
    }
    this.hoverIsland = foundIsland;
    this.hoverCol = fcol;
    this.hoverRow = frow;
    if (foundIsland && !this.placementMode) {
      this.islandTiles.get(foundIsland)![frow][fcol].highlight();
    }
  }

  private handleTap(p: Phaser.Input.Pointer) {
    const w = this.cameras.main.getWorldPoint(p.x, p.y);

    if (this.placementMode) {
      const { col, row } = worldToGrid(w.x, w.y);
      this.tryPlaceBuilding(col, row);
      return;
    }

    // Tapping a neighbouring island switches to / unlocks it.
    if (this.handleNeighborTap(w.x, w.y)) return;

    // Eggs first — they sit on top of everything near the hatchery.
    for (const spr of this.eggSprites.values()) {
      const dx = w.x - spr.x, dy = w.y - spr.y;
      if (dx * dx + dy * dy <= spr.hitRadius * spr.hitRadius) {
        EventBus.emit(GameEvents.OPEN_HATCH_CONFIRM, { eggId: spr.eggId });
        return;
      }
    }

    // Buildings first (front-to-back), using their world silhouettes.
    const sorted = [...this.buildingSprites.values()].sort((a, b) => b.depth - a.depth);
    for (const sprite of sorted) {
      if (pointInPolygon(w.x, w.y, sprite.silhouette)) {
        const b = useGameStore.getState().buildings[sprite.instanceId];
        if (b) this.onBuildingClick(b);
        return;
      }
    }

    // Tapping a terrain obstacle offers to clear it for gold.
    if (this.handleObstacleTap(w.x, w.y)) return;

    // Otherwise an empty land tile → build menu. Work out which unlocked island
    // the tap landed on, make it the active build target, then open the menu.
    for (const islandId of useGameStore.getState().unlockedIslands) {
      const off = this.offsetFor(islandId);
      const { col, row } = worldToGridWithOffset(w.x, w.y, off.x, off.y);
      const grid = this.islandTiles.get(islandId);
      if (this.inBounds(col, row) && grid?.[row]?.[col]?.isLand) {
        const store = useGameStore.getState();
        if (store.currentIslandId !== islandId) store.setCurrentIsland(islandId);
        EventBus.emit(GameEvents.OPEN_BUILD_MENU, { tileX: col, tileY: row });
        return;
      }
    }
  }

  private inBounds(col: number, row: number): boolean {
    return col >= 0 && col < GRID_COLS && row >= 0 && row < GRID_ROWS;
  }

  // ---- Terrain obstacles ------------------------------------------------

  private obstacleKey(islandId: string, tileX: number, tileY: number): string {
    return `${islandId}:${tileX},${tileY}`;
  }

  // Spawn every uncleared obstacle across all unlocked islands, each at its slot.
  private spawnObstacles(s: ReturnType<typeof useGameStore.getState>) {
    for (const islandId of s.unlockedIslands) {
      const islandDef = ISLAND_DEFS[islandId];
      if (!islandDef?.obstacles) continue;
      const off = this.offsetFor(islandId);
      setIsoOffset(off.x, off.y);
      for (const o of islandDef.obstacles) {
        const key = this.obstacleKey(islandId, o.tileX, o.tileY);
        if (s.clearedObstacles.includes(key)) continue;
        if (this.obstacleSprites.has(key)) continue;
        this.obstacleSprites.set(key, new ObstacleSprite(this, o));
      }
    }
  }

  // True if an uncleared obstacle covers the given tile on the active island.
  private tileHasObstacle(col: number, row: number, islandId: string): boolean {
    const islandDef = ISLAND_DEFS[islandId];
    const cleared = useGameStore.getState().clearedObstacles;
    for (const o of islandDef?.obstacles ?? []) {
      if (cleared.includes(this.obstacleKey(islandId, o.tileX, o.tileY))) continue;
      const od = OBSTACLE_DEFS[o.defId];
      const w = od?.tilesW ?? 1, h = od?.tilesH ?? 1;
      if (col >= o.tileX && col < o.tileX + w && row >= o.tileY && row < o.tileY + h) return true;
    }
    return false;
  }

  // Player tapped an obstacle → offer to clear it for gold (returns reward).
  private handleObstacleTap(wx: number, wy: number): boolean {
    for (const [key, spr] of this.obstacleSprites) {
      if (!pointInPolygon(wx, wy, spr.silhouette)) continue;
      const def = OBSTACLE_DEFS[spr.defId];
      if (!def) return true;
      const store = useGameStore.getState();
      if (store.gold < def.clearCost) {
        this.floatText(spr.x, spr.y - 30, `🪙 ${def.clearCost} nötig`, '#ff8a8a');
        return true;
      }
      const reward = def.clearReward;
      const parts = [
        reward.gold ? `🪙 ${reward.gold}` : '',
        reward.food ? `🍖 ${reward.food}` : '',
        reward.xp ? `⭐ ${reward.xp}` : '',
      ].filter(Boolean).join('  ');
      const msg = `${def.name} für 🪙 ${def.clearCost} entfernen?` +
        (parts ? `\nBelohnung: ${parts}` : '');
      if (confirm(msg)) {
        // The obstacle's island is encoded in its map key ("islandId:x,y").
        const obstacleIsland = key.split(':')[0];
        if (store.clearObstacle(obstacleIsland, spr.tileX, spr.tileY)) {
          this.floatText(spr.x, spr.y - 20, parts ? `+${parts}` : 'Entfernt!', '#bdf5a0');
          spr.destroy();
          this.obstacleSprites.delete(key);
        }
      }
      return true;
    }
    return false;
  }

  // A small reward/info text that floats up and fades out.
  private floatText(x: number, y: number, text: string, color: string) {
    const t = this.add.text(x, y, text, {
      fontSize: '15px', color, fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 4, align: 'center',
    }).setOrigin(0.5).setDepth(9500);
    this.tweens.add({
      targets: t, y: y - 36, alpha: 0, duration: 1200, ease: 'Cubic.easeOut',
      onComplete: () => t.destroy(),
    });
  }

  // ---- Buildings & residents -------------------------------------------

  private onBuildingClick(building: BuildingInstance) {
    const def = BUILDING_DEFS[building.defId];
    if (!def) return;
    switch (def.category) {
      case 'Habitat':
        EventBus.emit(GameEvents.OPEN_HABITAT_PANEL, { instanceId: building.instanceId });
        break;
      case 'BreedingStation':
        EventBus.emit(GameEvents.OPEN_BREEDING_PANEL, {});
        break;
      case 'Hatchery':
        EventBus.emit(GameEvents.OPEN_HATCHERY_PANEL, {});
        break;
      case 'Farm':
        EventBus.emit(GameEvents.OPEN_FARM_PANEL, { instanceId: building.instanceId });
        break;
      case 'Temple':
        EventBus.emit(GameEvents.OPEN_HABITAT_PANEL, { instanceId: building.instanceId });
        break;
    }
  }

  private spawnBuilding(b: BuildingInstance) {
    const def = BUILDING_DEFS[b.defId];
    if (!def) return;
    const off = this.offsetFor(b.islandId);
    setIsoOffset(off.x, off.y);
    const sprite = new BuildingSprite(this, b, TILE_W);
    sprite.setDepth(100 + b.tileX + b.tileY + def.tilesW + def.tilesH);
    this.buildingSprites.set(b.instanceId, sprite);
    this.buildingPos.set(b.instanceId, `${b.tileX},${b.tileY}`);
    this.refreshResidents(b);
  }

  // Show resident monsters as little characters standing on a habitat.
  private refreshResidents(b: BuildingInstance) {
    const def = BUILDING_DEFS[b.defId];
    if (!def || def.category !== 'Habitat') return;

    const sig = b.monsterIds.join(',');
    if (this.residentSignature.get(b.instanceId) === sig) return;
    this.residentSignature.set(b.instanceId, sig);

    // Project residents in this building's island slot.
    const off = this.offsetFor(b.islandId);
    setIsoOffset(off.x, off.y);

    // Clear old.
    for (const m of this.residentSprites.get(b.instanceId) ?? []) m.destroy();
    this.residentSprites.set(b.instanceId, []);

    const monsters = useGameStore.getState().monsters;
    const ids = b.monsterIds.filter(id => monsters[id]).slice(0, 4);
    const W = def.tilesW, H = def.tilesH;
    const center = project(b.tileX + W / 2, b.tileY + H / 2);
    const baseDepth = 100 + b.tileX + b.tileY + W + H;

    // The pen's walkable ground as an isometric diamond. Half-extents come
    // straight from the footprint, shrunk so residents stay inside the fence,
    // and lifted a touch so they appear to stand on the floor.
    const footW = (W + H) * (TILE_W / 2);     // diamond width in px (128 for 2×2)
    const area = {
      cx: center.x,
      cy: center.y - 12,
      hw: footW / 2 * 0.58,
      hh: (W + H) * (TILE_H / 2) / 2 * 0.55,
      baseDepth: baseDepth + 0.5,
    };

    // Scale every resident to the pen: fewer monsters read bigger, a crowded
    // pen packs smaller ones, and rarity + evolution stage set realistic
    // relative proportions on top of that.
    const n = ids.length;
    const crowd = 1 / (1 + 0.16 * (n - 1));          // 1 → .86 → .76 → .68
    const baseSize = footW * 0.30 * crowd;            // ~38px for a lone resident

    const sprites: MonsterSprite[] = [];
    ids.forEach((id, i) => {
      const inst = monsters[id];
      const mdef = MONSTER_DEFS[inst.defId];
      const rarityScale = mdef ? 0.9 + RARITY_RANK[mdef.rarity as RarityType] * 0.06 : 1;
      const stageScale = STAGE_SIZE_SCALE[inst.stage] ?? 1;
      const size = Phaser.Math.Clamp(baseSize * rarityScale * stageScale, footW * 0.16, footW * 0.46);

      // Spread the starting spots so a freshly populated pen doesn't stack them
      // on one tile; roaming redistributes them from there.
      const startX = area.cx + (n === 1 ? 0 : (i / (n - 1) - 0.5) * area.hw * 1.1);
      const startY = area.cy + (i % 2 === 0 ? -area.hh * 0.35 : area.hh * 0.35);

      const ms = new MonsterSprite(this, inst.defId, startX, startY, size, false);
      ms.enableRoaming(area);
      sprites.push(ms);
    });
    this.residentSprites.set(b.instanceId, sprites);
  }

  // Place eggs on pedestals fanned out in front of the hatchery.
  private refreshEggs(s: ReturnType<typeof useGameStore.getState>) {
    const sig = s.eggs.map(e => e.id).join(',');
    if (sig === this.eggSignature) return;
    this.eggSignature = sig;

    // Anchor the eggs to a hatchery — prefer the one on the island the player is
    // currently acting on, else any hatchery across the unlocked islands.
    const hatchery = Object.values(s.buildings).find(
      b => b.islandId === s.currentIslandId && BUILDING_DEFS[b.defId]?.category === 'Hatchery',
    ) ?? Object.values(s.buildings).find(
      b => s.unlockedIslands.includes(b.islandId) && BUILDING_DEFS[b.defId]?.category === 'Hatchery',
    );
    if (hatchery) {
      const off = this.offsetFor(hatchery.islandId);
      setIsoOffset(off.x, off.y);
    }

    // Remove eggs no longer present.
    const liveIds = new Set(s.eggs.map(e => e.id));
    for (const [id, spr] of this.eggSprites) {
      if (!liveIds.has(id)) { spr.destroy(); this.eggSprites.delete(id); }
    }

    if (!hatchery) return;
    const hd = BUILDING_DEFS[hatchery.defId];
    const { tileX, tileY } = hatchery;
    const W = hd.tilesW, H = hd.tilesH;
    const OUT = 0.45; // how far outside the footprint the pedestals hug

    // Pedestal slots that hug the hatchery's two camera-facing edges, so the
    // eggs sit attached to the building base. Each slot carries its grid
    // coords so we can project to iso space and depth-sort correctly.
    const slots: { col: number; row: number }[] = [];
    // Front-left edge (row = tileY + H), walking across the columns.
    for (let c = 0; c < W; c++) {
      slots.push({ col: tileX + c + 0.5, row: tileY + H + OUT });
    }
    // Right-front edge (col = tileX + W), walking down the rows.
    for (let r = 0; r < H; r++) {
      slots.push({ col: tileX + W + OUT, row: tileY + r + 0.5 });
    }
    // Front corner gets an extra slot for overflow.
    slots.push({ col: tileX + W + OUT, row: tileY + H + OUT });

    // Lay each egg onto the next pedestal slot, anchored to the hatchery.
    s.eggs.forEach((egg, i) => {
      if (this.eggSprites.has(egg.id)) return;
      const slot = slots[i % slots.length];
      // Stack extra eggs slightly outward if we run out of distinct slots.
      const ring = Math.floor(i / slots.length);
      const p = project(slot.col + ring * 0.3, slot.row + ring * 0.3);
      const spr = new EggSprite(this, egg, p.x, p.y);
      // Grid-based depth keeps eggs grounded against the building.
      spr.setDepth(120 + (slot.col + slot.row) + ring);
      spr.updateTimer(egg.hatchEndMs - Date.now());
      this.eggSprites.set(egg.id, spr);
    });
  }

  // Reconcile Phaser visuals with store changes (new buildings, construction, residents).
  private reconcile(s: ReturnType<typeof useGameStore.getState>) {
    // Drop sprites for buildings that were demolished or sit on an island that
    // is no longer present.
    for (const [id, sprite] of this.buildingSprites) {
      const b = s.buildings[id];
      if (!b || !s.unlockedIslands.includes(b.islandId)) {
        sprite.destroy();
        this.buildingSprites.delete(id);
        this.buildingPos.delete(id);
        for (const m of this.residentSprites.get(id) ?? []) m.destroy();
        this.residentSprites.delete(id);
        this.residentSignature.delete(id);
      }
    }

    for (const b of Object.values(s.buildings)) {
      if (!s.unlockedIslands.includes(b.islandId)) continue;
      if (!this.buildingSprites.has(b.instanceId)) {
        this.spawnBuilding(b);
      } else if (this.buildingPos.get(b.instanceId) !== `${b.tileX},${b.tileY}`) {
        // The building was relocated — respawn it cleanly at the new tile.
        this.buildingSprites.get(b.instanceId)!.destroy();
        this.buildingSprites.delete(b.instanceId);
        for (const m of this.residentSprites.get(b.instanceId) ?? []) m.destroy();
        this.residentSprites.delete(b.instanceId);
        this.residentSignature.delete(b.instanceId);
        this.spawnBuilding(b);
      } else {
        const sprite = this.buildingSprites.get(b.instanceId)!;
        sprite.setUnderConstruction(b.constructionEndMs !== null);
        this.refreshResidents(b);
      }
    }
    this.refreshEggs(s);

    // Spawn obstacles for any newly unlocked islands not yet scattered.
    this.spawnObstacles(s);

    // Drop any obstacle sprites that have since been cleared (key = "island:x,y").
    for (const [key, spr] of this.obstacleSprites) {
      const obstacleIsland = key.split(':')[0];
      if (s.clearedObstacles.includes(this.obstacleKey(obstacleIsland, spr.tileX, spr.tileY))) {
        spr.destroy();
        this.obstacleSprites.delete(key);
      }
    }
  }

  // React asked us to play the hatch animation for an egg, then commit it.
  private onHatchAnimate = (data: { eggId: string }) => {
    const spr = this.eggSprites.get(data.eggId);
    if (!spr) {
      // No sprite (e.g. hatched from panel) — commit immediately.
      useGameStore.getState().hatchEgg(data.eggId);
      return;
    }
    this.eggSprites.delete(data.eggId);
    this.eggSignature = ''; // force re-sync afterwards
    spr.playHatchAnimation(() => {
      useGameStore.getState().hatchEgg(data.eggId);
    });
  };

  // ---- Placement mode ---------------------------------------------------

  private onEnterPlacement = (data: { defId: string }) => {
    this.placementMode = true;
    this.placementDefId = data.defId;
    this.input.keyboard?.once('keydown-ESC', () => this.exitPlacementMode());
    // Switch to a flat 2D grid view for clear, precise placement.
    this.showBuildOverlay();
  };

  // BAUEN tab → open the 2D top-down island view with NO building chosen yet
  // (browse mode). Tapping an empty land tile opens the building list for that
  // spot, which then enters per-building placement via ENTER_PLACEMENT_MODE.
  private onOpenBuildOverlay = () => {
    this.placementMode = true;
    this.placementDefId = ''; // empty → browse mode (tap a tile to pick a building)
    this.input.keyboard?.once('keydown-ESC', () => this.exitPlacementMode());
    this.showBuildOverlay();
  };

  // Relocate an existing building: reuse the 2D build overlay, but on a tap we
  // move the chosen instance instead of creating a new one.
  private onEnterMoveMode = (data: { instanceId: string }) => {
    const b = useGameStore.getState().buildings[data.instanceId];
    if (!b) return;
    this.placementMode = true;
    this.moveInstanceId = data.instanceId;
    this.placementDefId = b.defId;
    this.input.keyboard?.once('keydown-ESC', () => this.exitPlacementMode());
    this.showBuildOverlay();
  };

  private onPanelClosed = () => {
    if (this.placementMode) this.exitPlacementMode();
  };

  private onStartBattle = (data: { playerTeam: string[]; enemyTeam: string[] }) => {
    this.scene.launch('Battle', data);
    this.scene.pause();
    // Tell React the fight is on so it hides the normal HUD / rails and shows
    // only the battle screen (BATTLE_ENDED restores the chrome afterwards).
    EventBus.emit(GameEvents.BATTLE_STARTED, {});
  };

  // Rebuild the whole island view when the player switches islands.
  private onIslandChanged = (data?: { islandId?: string }) => {
    const id = data?.islandId ?? useGameStore.getState().currentIslandId;
    // A newly unlocked island isn't drawn yet → rebuild the whole world. An
    // already-drawn island just needs the camera to glide over to it (no more
    // hard "switch": it's all one map now).
    if (!this.islandTiles.has(id)) {
      this.scene.restart();
      return;
    }
    const off = this.offsetFor(id);
    this.cameras.main.pan(ISLAND_CENTER.x + off.x, ISLAND_CENTER.y + off.y, 480, 'Sine.easeInOut');
  };

  private exitPlacementMode() {
    if (!this.placementMode) return; // guard against re-entry from PANEL_CLOSED
    this.placementMode = false;
    this.placementDefId = '';
    this.moveInstanceId = null;
    this.placementHighlight?.destroy();
    this.placementHighlight = undefined;
    this.hideBuildOverlay();
    // Notify React to restore the floating HUD / rails (covers ESC-cancel too).
    EventBus.emit(GameEvents.PANEL_CLOSED, {});
  }

  // ---- 2D top-down build overlay ----------------------------------------
  // A screen-fixed modal that shows ALL islands in a flat top-down view at
  // once (the active one buildable, the rest as mini-maps arranged in the same
  // ring as the iso world). It supports the same drag-to-pan and pinch/wheel
  // zoom as the main camera, so building works just like Monster Legends.
  private showBuildOverlay() {
    this.hideBuildOverlay();
    const state = useGameStore.getState();
    const currentId = state.currentIslandId;
    const islandDef = ISLAND_DEFS[currentId];
    if (!islandDef) return;

    const { width, height } = this.scale;
    const cell = this.BUILD_CELL;
    const W2 = GRID_COLS * cell;
    const H2 = GRID_ROWS * cell;
    const ringX = W2 + 40; // 2D spacing between island blocks (kept tight)
    const ringY = H2 + 40;

    // Root (screen-fixed) overlay container.
    const root = this.add.container(0, 0).setDepth(5000).setScrollFactor(0);

    // Dim backdrop (non-interactive — pan is handled at the scene level).
    const backdrop = this.add.rectangle(width / 2, height / 2, width, height, 0x05060f, 0.82);
    root.add(backdrop);

    // Inner pannable / zoomable "world" holding every island top-down.
    const world = this.add.container(0, 0);
    root.add(world);
    this.overlayWorld = world;

    // Reset pan/zoom; fit the active island comfortably in the viewport.
    this.overlayPanX = 0;
    this.overlayPanY = 0;
    this.overlayZoom = this.clampZoom(Math.min((width * 0.5) / W2, (height * 0.6) / H2));

    // Top-left local coord of an island grid (active island centred at 0,0).
    const originOf = (dir: { dx: number; dy: number } | null) =>
      dir ? { x: dir.dx * ringX - W2 / 2, y: dir.dy * ringY - H2 / 2 }
          : { x: -W2 / 2, y: -H2 / 2 };

    // Accumulate block layout (in world-container local space) for manual
    // screen-pointer hit-testing in handleOverlayTap / overlayCellAt.
    const layoutIslands: OverlayIsland[] = [];

    // Draw every OTHER island as a non-buildable mini-map (tap to switch/unlock).
    const others = Object.values(ISLAND_DEFS).filter(d => d.id !== currentId);
    others.forEach((isl, i) => {
      const dir = Island.RING_DIRS[i % Island.RING_DIRS.length];
      const o = originOf(dir);
      const locked = !state.unlockedIslands.includes(isl.id);
      const theme = ISLAND_THEMES[isl.id] ?? DEFAULT_ISLAND_THEME;
      const cost = isl.goldCost ?? 0;

      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          if (!isl.tileMask[r]?.[c]) continue;
          const checker = (c + r) % 2 === 0;
          const fill = locked ? (checker ? 0x5a5a5a : 0x676767)
                              : (checker ? theme.grass1 : theme.grass2);
          const rect = this.add.rectangle(
            o.x + c * cell + cell / 2, o.y + r * cell + cell / 2,
            cell - 2, cell - 2, fill, locked ? 0.6 : 0.9)
            .setStrokeStyle(1, 0x0c1622);
          world.add(rect);
        }
      }

      // Record this neighbour block for whole-island tap (switch / unlock).
      layoutIslands.push({ id: isl.id, ox: o.x, oy: o.y, isActive: false, locked, cost });

      const label = this.add.text(o.x + W2 / 2, o.y - 16, `${theme.emoji} ${isl.name}`, {
        fontSize: '14px', color: locked ? '#cccccc' : '#ffffff', fontStyle: 'bold',
        stroke: '#000', strokeThickness: 4,
      }).setOrigin(0.5);
      world.add(label);
      if (locked) {
        const lk = this.add.text(o.x + W2 / 2, o.y + H2 / 2, `🔒 ${cost}`, {
          fontSize: '18px', color: '#ffd700', fontStyle: 'bold', stroke: '#000', strokeThickness: 4,
        }).setOrigin(0.5);
        world.add(lk);
      }
    });

    // Draw the ACTIVE island as the build grid. Cells are NOT made interactive;
    // taps/hover are hit-tested from the raw screen pointer (see handleOverlayTap)
    // because the screen-fixed overlay over a zoomed camera throws off Phaser's
    // per-object input transform.
    const o0 = originOf(null);
    layoutIslands.push({ id: currentId, ox: o0.x, oy: o0.y, isActive: true, locked: false, cost: 0 });
    this.buildOverlayCells = [];
    for (let row = 0; row < GRID_ROWS; row++) {
      this.buildOverlayCells[row] = [];
      for (let col = 0; col < GRID_COLS; col++) {
        const isLand = islandDef.tileMask[row]?.[col];
        const rect = this.add.rectangle(
          o0.x + col * cell + cell / 2, o0.y + row * cell + cell / 2,
          cell - 2, cell - 2, isLand ? 0x2e7d32 : 0x16273a, isLand ? 0.95 : 0.5)
          .setStrokeStyle(1, 0x0c1622);
        world.add(rect);
        this.buildOverlayCells[row][col] = rect;
      }
    }

    const curTheme = ISLAND_THEMES[currentId] ?? DEFAULT_ISLAND_THEME;
    const curLabel = this.add.text(o0.x + W2 / 2, o0.y - 16,
      `${curTheme.emoji} ${islandDef.name}`, {
        fontSize: '15px', color: '#bff5a8', fontStyle: 'bold', stroke: '#000', strokeThickness: 4,
      }).setOrigin(0.5);
    world.add(curLabel);

    // Mark already-occupied footprints + obstacle tiles on the active island.
    // While relocating, the moving building's own tiles stay free (you can drop
    // it back onto its current spot or any other open ground).
    for (const b of Object.values(state.buildings)) {
      if (b.islandId !== currentId) continue;
      if (b.instanceId === this.moveInstanceId) continue;
      const bd = BUILDING_DEFS[b.defId];
      if (!bd) continue;
      for (let r = b.tileY; r < b.tileY + bd.tilesH; r++) {
        for (let c = b.tileX; c < b.tileX + bd.tilesW; c++) {
          const rect = this.buildOverlayCells[r]?.[c];
          if (rect) rect.setFillStyle(0x553333, 0.95);
        }
      }
    }
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        if (!this.tileHasObstacle(c, r, currentId)) continue;
        const rect = this.buildOverlayCells[r]?.[c];
        if (rect) rect.setFillStyle(0x6a4a2a, 0.95);
      }
    }

    // Fixed UI: title + hint (added last so they stay on top, screen-fixed).
    // Browse mode (no building chosen) shows a "pick a tile" prompt instead.
    const browsing = this.placementDefId === '';
    const moving = this.moveInstanceId !== null;
    const def = BUILDING_DEFS[this.placementDefId];
    const titleText = moving
      ? `↔️ Verschieben — ${def?.name ?? ''} (neues Feld antippen)`
      : browsing
        ? '🏗️ 2D-Baumodus — Feld zum Bauen antippen'
        : `🏗️ 2D-Baumodus — ${def?.name ?? ''}  (${def?.tilesW ?? 1}×${def?.tilesH ?? 1})`;
    const title = this.add.text(width / 2, 26, titleText,
      { fontSize: '16px', color: '#ffffff', fontStyle: 'bold', stroke: '#000', strokeThickness: 3 })
      .setOrigin(0.5);
    root.add(title);
    const hintText = moving
      ? 'Ziehen = Karte bewegen · Pinch = Zoom · Grün = freies Feld · ✕ Fertig / ESC = Abbrechen'
      : browsing
        ? 'Ziehen = Karte bewegen · Pinch = Zoom · Grün = freies Feld · ✕ Fertig / ESC = Abbrechen'
        : 'Ziehen = Karte bewegen · Pinch = Zoom · Grün = baubar · ✕ Fertig / ESC = Abbrechen';
    const hint = this.add.text(width / 2, height - 20, hintText,
      { fontSize: '12px', color: '#aabbcc' }).setOrigin(0.5);
    root.add(hint);

    this.buildOverlay = root;
    this.overlayLayout = { cell, W2, H2, islands: layoutIslands };
    this.applyOverlayTransform();
  }

  // Map a raw screen pointer to an overlay island block + (for the active
  // island) the grid cell under it. Returns null when outside every block.
  private overlayCellAt(px: number, py: number):
    { id: string; isActive: boolean; locked: boolean; cost: number; col: number; row: number } | null {
    const layout = this.overlayLayout;
    if (!layout) return null;
    const { width, height } = this.scale;
    // Convert the screen pointer into the world-container's local space. The
    // overlay is screen-fixed (scrollFactor 0) but the camera still applies its
    // ZOOM to it, so we invert the camera with getWorldPoint, undo the scroll
    // (which scrollFactor 0 ignores), then undo our own overlay pan/zoom.
    const cam = this.cameras.main;
    const w = cam.getWorldPoint(px, py);
    const cx = w.x - cam.scrollX;
    const cy = w.y - cam.scrollY;
    const localX = (cx - (width / 2 + this.overlayPanX)) / this.overlayZoom;
    const localY = (cy - (height / 2 + this.overlayPanY)) / this.overlayZoom;
    for (const isl of layout.islands) {
      if (localX < isl.ox || localX > isl.ox + layout.W2) continue;
      if (localY < isl.oy || localY > isl.oy + layout.H2) continue;
      const col = Math.floor((localX - isl.ox) / layout.cell);
      const row = Math.floor((localY - isl.oy) / layout.cell);
      return { id: isl.id, isActive: isl.isActive, locked: isl.locked, cost: isl.cost, col, row };
    }
    return null;
  }

  // Handle a tap on the 2D overlay, hit-tested from the raw screen pointer.
  private handleOverlayTap(p: Phaser.Input.Pointer) {
    const hit = this.overlayCellAt(p.x, p.y);
    if (!hit) return;
    if (!hit.isActive) {
      // Tapped a neighbour mini-map → switch to / unlock that island.
      this.switchOrUnlockIsland(hit.id, hit.locked, hit.cost);
      return;
    }
    if (!this.inBounds(hit.col, hit.row)) return;
    // Guard the trailing iso-layer pointerup from this same click.
    this.suppressTapUntil = Date.now() + 350;
    // Browse mode (no building chosen): open the build menu for that tile.
    // Otherwise place / relocate the selected building.
    if (this.placementDefId === '') {
      EventBus.emit(GameEvents.OPEN_BUILD_MENU, { tileX: hit.col, tileY: hit.row });
    } else {
      this.tryPlaceBuilding(hit.col, hit.row);
    }
  }

  // Tint the hovered footprint green (valid) or red (blocked).
  private previewBuildAt(col: number, row: number) {
    if (!this.buildOverlay) return;
    const def = BUILDING_DEFS[this.placementDefId];
    if (!def) return;
    const islandId = useGameStore.getState().currentIslandId;
    const islandDef = ISLAND_DEFS[islandId];
    const valid = this.canPlace(col, row, def.tilesW, def.tilesH, islandDef, islandId, this.moveInstanceId);

    // Repaint base colours first.
    const state = useGameStore.getState();
    const occupied = new Set<string>();
    for (const b of Object.values(state.buildings)) {
      if (b.islandId !== islandId) continue;
      if (b.instanceId === this.moveInstanceId) continue;
      const bd = BUILDING_DEFS[b.defId];
      if (!bd) continue;
      for (let r = b.tileY; r < b.tileY + bd.tilesH; r++)
        for (let c = b.tileX; c < b.tileX + bd.tilesW; c++) occupied.add(`${c},${r}`);
    }
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const rect = this.buildOverlayCells[r]?.[c];
        if (!rect) continue;
        const isLand = islandDef.tileMask[r]?.[c];
        if (occupied.has(`${c},${r}`)) rect.setFillStyle(0x553333, 0.9);
        else if (this.tileHasObstacle(c, r, islandId)) rect.setFillStyle(0x6a4a2a, 0.9);
        else rect.setFillStyle(isLand ? 0x2e7d32 : 0x16273a, isLand ? 0.9 : 0.5);
      }
    }
    // Tint the footprint under the cursor.
    const color = valid ? 0x66ff66 : 0xff4444;
    for (let r = row; r < row + def.tilesH; r++) {
      for (let c = col; c < col + def.tilesW; c++) {
        const rect = this.buildOverlayCells[r]?.[c];
        if (rect) rect.setFillStyle(color, 0.85);
      }
    }
  }

  private hideBuildOverlay() {
    this.buildOverlay?.destroy(true);
    this.buildOverlay = undefined;
    this.overlayWorld = undefined;
    this.buildOverlayCells = [];
    this.overlayLayout = undefined;
    this.overlayDragging = false;
    this.overlayPinchDist = 0;
  }

  private tryPlaceBuilding(col: number, row: number) {
    const def = BUILDING_DEFS[this.placementDefId];
    if (!def) return;
    const islandId = useGameStore.getState().currentIslandId;
    const islandDef = ISLAND_DEFS[islandId];

    const valid = this.canPlace(col, row, def.tilesW, def.tilesH, islandDef, islandId, this.moveInstanceId);
    if (!valid) { this.flashPlacement(col, row, def.tilesW, def.tilesH, 0xff3333); return; }

    if (this.moveInstanceId) {
      useGameStore.getState().moveBuilding(this.moveInstanceId, col, row);
    } else {
      useGameStore.getState().placeBuilding(this.placementDefId, islandId, col, row);
    }
    this.exitPlacementMode(); // emits PANEL_CLOSED → React restores the chrome
  }

  private canPlace(
    col: number, row: number, w: number, h: number,
    islandDef: { tileMask: boolean[][] }, islandId: string,
    ignoreId: string | null = null,
  ): boolean {
    for (let r = row; r < row + h; r++) {
      for (let c = col; c < col + w; c++) {
        if (!this.inBounds(c, r)) return false;
        if (!islandDef.tileMask[r][c]) return false;
        if (this.tileHasObstacle(c, r, islandId)) return false;
      }
    }
    for (const b of Object.values(useGameStore.getState().buildings)) {
      if (b.islandId !== islandId) continue;
      if (ignoreId && b.instanceId === ignoreId) continue;
      const bd = BUILDING_DEFS[b.defId];
      if (!bd) continue;
      if (col < b.tileX + bd.tilesW && col + w > b.tileX &&
          row < b.tileY + bd.tilesH && row + h > b.tileY) {
        return false;
      }
    }
    return true;
  }

  private flashPlacement(col: number, row: number, w: number, h: number, color: number) {
    this.placementHighlight?.destroy();
    const c = footprintCorners(col, row, w, h);
    const g = this.add.graphics();
    g.fillStyle(color, 0.4);
    g.fillPoints([c.back, c.right, c.front, c.left], true);
    g.setDepth(300);
    this.placementHighlight = g;
    this.time.delayedCall(500, () => {
      g.destroy();
      if (this.placementHighlight === g) this.placementHighlight = undefined;
    });
  }

  // ---- Lifecycle --------------------------------------------------------

  private onShutdown() {
    this.unsubscribe?.();
    this.resizeTimer?.remove();
    this.scale.off('resize', this.onResize, this);
    EventBus.off(GameEvents.OPEN_BUILD_OVERLAY, this.onOpenBuildOverlay, this);
    EventBus.off(GameEvents.ENTER_PLACEMENT_MODE, this.onEnterPlacement, this);
    EventBus.off(GameEvents.ENTER_MOVE_MODE, this.onEnterMoveMode, this);
    EventBus.off(GameEvents.PANEL_CLOSED, this.onPanelClosed, this);
    EventBus.off(GameEvents.START_BATTLE, this.onStartBattle, this);
    EventBus.off(GameEvents.ISLAND_CHANGED, this.onIslandChanged, this);
    EventBus.off(GameEvents.HATCH_EGG_ANIMATE, this.onHatchAnimate, this);
    this.buildingSprites.clear();
    this.buildingPos.clear();
    this.residentSprites.clear();
    this.residentSignature.clear();
    this.eggSprites.clear();
    this.obstacleSprites.clear();
  }
}
