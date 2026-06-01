import Phaser from 'phaser';
import { useGameStore } from '@store/gameStore';
import { ISLAND_DEFS } from '@data/islands';
import { BUILDING_DEFS } from '@data/buildings';
import { EventBus, GameEvents } from '@game/EventBus';
import { OBSTACLE_DEFS } from '@data/obstacles';
import { GridTile } from '@game/objects/GridTile';
import { BuildingSprite } from '@game/objects/BuildingSprite';
import { MonsterSprite } from '@game/objects/MonsterSprite';
import { EggSprite } from '@game/objects/EggSprite';
import { ObstacleSprite } from '@game/objects/ObstacleSprite';
import {
  project, worldToGrid, pointInPolygon, footprintCorners,
  GRID_COLS, GRID_ROWS, ISLAND_CENTER, TILE_W, TILE_H, LAND_THICK,
} from '@game/iso';
import type { BuildingInstance } from '@gtypes/game';

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
};
const DEFAULT_ISLAND_THEME: IslandTheme = { emoji: '🏝️', grass1: 0x5a9e44, grass2: 0x64a84c, cliff: 0x4a3a22, path: 0xccaa66 };

export class Island extends Phaser.Scene {
  private tiles: GridTile[][] = [];
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
  private readonly MIN_ZOOM = 0.4;
  private readonly MAX_ZOOM = 2.4;

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
  private hoverCol = -1;
  private hoverRow = -1;

  // 2D top-down build overlay (shown only while placing a building).
  private buildOverlay?: Phaser.GameObjects.Container;
  private buildOverlayCells: Phaser.GameObjects.Rectangle[][] = [];
  private readonly BUILD_CELL = 24; // px per grid cell in the flat 2D view
  private suppressTapUntil = 0;     // ignore iso taps briefly after a 2D placement

  constructor() { super('Island'); }

  create() {
    const state = useGameStore.getState();
    const islandDef = ISLAND_DEFS[state.currentIslandId];
    if (!islandDef) return;

    this.cameras.main.setBackgroundColor(0x5ab4e0); // aerial sky
    this.addSkyBackdrop();

    // Unified organic landmass (rock cliff) drawn under all the grass tops.
    this.drawLandmass(islandDef.tileMask);

    // Draw isometric tile grid.
    for (let row = 0; row < GRID_ROWS; row++) {
      this.tiles[row] = [];
      for (let col = 0; col < GRID_COLS; col++) {
        const isLand = islandDef.tileMask[row][col];
        this.tiles[row][col] = new GridTile(this, col, row, isLand);
      }
    }

    // Draw the other islands as dimmed neighbours arranged AROUND this one,
    // forming one big pannable world (Monster-Legends style). Returns the
    // world-space bounding box of the whole archipelago.
    const world = this.drawNeighborIslands(state);

    // Camera bounds span the whole world (active island + all neighbours),
    // padded so you can pan a little past the edges.
    const PAD = 260;
    this.cameras.main.setBounds(
      world.minX - PAD, world.minY - PAD,
      (world.maxX - world.minX) + PAD * 2,
      (world.maxY - world.minY) + PAD * 2,
    );
    this.cameras.main.centerOn(ISLAND_CENTER.x, ISLAND_CENTER.y);
    this.cameras.main.setZoom(1);
    this.applyCameraFX();

    // Spawn pre-placed buildings + their residents.
    for (const b of Object.values(state.buildings)) {
      if (b.islandId === state.currentIslandId) this.spawnBuilding(b);
    }

    // Scatter the island's terrain obstacles (those not yet cleared).
    this.spawnObstacles(state);

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
          if (Math.abs(dx) + Math.abs(dy) > 6) this.dragMoved = true;
          this.overlayPanX = this.camStartX + dx;
          this.overlayPanY = this.camStartY + dy;
          this.applyOverlayTransform();
        }
        return;
      }

      if (this.isDragging) {
        const z = this.cameras.main.zoom;
        const dx = (p.x - this.dragStartX) / z;
        const dy = (p.y - this.dragStartY) / z;
        if (Math.abs(p.x - this.dragStartX) + Math.abs(p.y - this.dragStartY) > 6) this.dragMoved = true;
        this.cameras.main.scrollX = this.camStartX - dx;
        this.cameras.main.scrollY = this.camStartY - dy;
      } else {
        this.updateHover(p);
      }
    });

    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      // End a pinch once a finger lifts.
      if (this.pinchStartDist > 0 || this.overlayPinchDist > 0) {
        if (this.input.manager.pointersTotal <= 2) {
          this.pinchStartDist = 0;
          this.overlayPinchDist = 0;
        }
        return;
      }
      this.isDragging = false;
      this.overlayDragging = false;
      if (this.dragMoved) return; // it was a pan, not a tap
      // While the 2D build overlay is up (or just handled a placement), the
      // overlay's own rectangles own all clicks — ignore the iso-layer tap so
      // we don't double-place or select a building underneath.
      if (this.placementMode || Date.now() < this.suppressTapUntil) return;
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
    EventBus.on(GameEvents.ENTER_PLACEMENT_MODE, this.onEnterPlacement, this);
    EventBus.on(GameEvents.PANEL_CLOSED, this.onPanelClosed, this);
    EventBus.on(GameEvents.START_BATTLE, this.onStartBattle, this);
    EventBus.on(GameEvents.ISLAND_CHANGED, this.onIslandChanged, this);
    EventBus.on(GameEvents.HATCH_EGG_ANIMATE, this.onHatchAnimate, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.onShutdown());
  }

  update() {
    if (this.eggSprites.size === 0) return;
    const now = Date.now();
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
        const grd = ctx.createLinearGradient(0, 0, 0, H);
        grd.addColorStop(0.00, '#0d2a5e');
        grd.addColorStop(0.22, '#1e5aa0');
        grd.addColorStop(0.50, '#4a9fd8');
        grd.addColorStop(0.80, '#90cce8');
        grd.addColorStop(1.00, '#c8e8f8');
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

    // Drifting clouds above and below the island.
    this.addClouds(W, H);

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

    // Subtle overall darkness overlay (no shaders needed).
    this.add.rectangle(0, 0, W, H, 0x0a0a18, 0.22)
      .setOrigin(0, 0).setScrollFactor(0).setDepth(9000);
  }

  // Realistic canvas-texture clouds using layered radial gradients.
  // Three shape variants are baked once and reused at different scales.
  private addClouds(W: number, H: number) {
    // Bake cloud textures once (guarded by exists check).
    this.bakeCloudTexture('cld-a', 360, 180, 0); // classic puffy cumulus
    this.bakeCloudTexture('cld-b', 280, 140, 1); // wide flat cloud bank
    this.bakeCloudTexture('cld-c', 220, 120, 2); // tall billowing tower

    // Thin high-altitude cirrus streaks (separate horizontal stripes).
    this.bakeCirrusTexture('cld-ci', 420, 60);

    const groups: { sx: number; sy: number; key: string; sc: number; al: number; depth: number; dur: number }[] = [
      // High cumulus — above the island
      { sx: W * 0.04, sy: H * 0.09, key: 'cld-a', sc: 1.05, al: 0.88, depth: -870, dur: 84000 },
      { sx: W * 0.40, sy: H * 0.06, key: 'cld-c', sc: 0.80, al: 0.75, depth: -876, dur: 61000 },
      { sx: W * 0.76, sy: H * 0.17, key: 'cld-b', sc: 0.90, al: 0.80, depth: -882, dur: 73000 },
      // Cirrus high up — very light streaks
      { sx: W * 0.20, sy: H * 0.04, key: 'cld-ci', sc: 1.30, al: 0.45, depth: -895, dur: 110000 },
      { sx: W * 0.65, sy: H * 0.02, key: 'cld-ci', sc: 0.90, al: 0.38, depth: -898, dur: 130000 },
      // Low cumulus — below the island (sells the floating feel)
      { sx: W * 0.10, sy: H * 0.71, key: 'cld-a', sc: 1.50, al: 0.70, depth: -848, dur: 96000 },
      { sx: W * 0.50, sy: H * 0.79, key: 'cld-b', sc: 1.20, al: 0.65, depth: -853, dur: 70000 },
      { sx: W * 0.80, sy: H * 0.67, key: 'cld-c', sc: 0.95, al: 0.72, depth: -857, dur: 80000 },
    ];

    for (const d of groups) {
      const img = this.add.image(d.sx, d.sy, d.key);
      img.setScrollFactor(0).setDepth(d.depth).setScale(d.sc).setAlpha(d.al);

      const drift = () => {
        this.tweens.add({
          targets: img,
          x: img.x + W + 500,
          duration: d.dur * (0.88 + Math.random() * 0.24),
          ease: 'Linear',
          onComplete: () => {
            img.x = -img.displayWidth - 30;
            drift();
          },
        });
      };
      drift();
    }
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

  // Zoom the iso camera by a multiplicative factor, keeping the point under
  // the pointer fixed on screen (focal zoom, Monster-Legends style).
  private zoomCameraBy(factor: number, pointer: Phaser.Input.Pointer) {
    const cam = this.cameras.main;
    const before = cam.getWorldPoint(pointer.x, pointer.y);
    const next = this.clampZoom(cam.zoom * factor);
    if (next === cam.zoom) return;
    cam.setZoom(next);
    const after = cam.getWorldPoint(pointer.x, pointer.y);
    cam.scrollX += before.x - after.x;
    cam.scrollY += before.y - after.y;
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
      const cam = this.cameras.main;
      const before = cam.getWorldPoint(mid.x, mid.y);
      cam.setZoom(this.clampZoom(this.pinchStartZoom * (dist / this.pinchStartDist)));
      const after = cam.getWorldPoint(mid.x, mid.y);
      cam.scrollX += before.x - after.x;
      cam.scrollY += before.y - after.y;
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

  // Render every OTHER island as a dimmed neighbour arranged in a ring AROUND
  // the active one, so the whole game reads as a single big floating world.
  // Locked islands are greyed out with a 🔒 and their gold price. Tapping a
  // neighbour switches to it (or, if locked and affordable, offers to unlock
  // it). Returns the world-space bounding box covering every island so the
  // camera bounds can encompass the whole archipelago.
  private drawNeighborIslands(
    state: ReturnType<typeof useGameStore.getState>,
  ): { minX: number; maxX: number; minY: number; maxY: number } {
    this.neighborRegions = [];
    const others = Object.values(ISLAND_DEFS).filter(d => d.id !== state.currentIslandId);

    // Ring radius: comfortably clear of the active island's iso footprint.
    const RX = (GRID_COLS + GRID_ROWS) * (TILE_W / 2) + 240;
    const RY = (GRID_COLS + GRID_ROWS) * (TILE_H / 2) + 260;

    // Track the bounding box of the whole world (start with the active island).
    let worldMinX = project(0, GRID_ROWS).x - TILE_W;
    let worldMaxX = project(GRID_COLS, 0).x + TILE_W;
    let worldMinY = project(0, 0).y - 60;
    let worldMaxY = project(GRID_COLS, GRID_ROWS).y + LAND_THICK + 100;

    const activeCenter = { x: ISLAND_CENTER.x, y: ISLAND_CENTER.y };

    others.forEach((island, i) => {
      const dir = Island.RING_DIRS[i % Island.RING_DIRS.length];
      // The island's own projected centre (no offset) coincides with the active
      // island's centre, so the offset that lands its centre on the ring is:
      const offsetX = dir.dx * RX;
      const offsetY = dir.dy * RY;
      const locked = !state.unlockedIslands.includes(island.id);
      const cost = island.goldCost ?? 0;
      const theme = ISLAND_THEMES[island.id] ?? DEFAULT_ISLAND_THEME;

      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

      // Compute the projected centre of every land tile first (also gives bounds).
      const tiles: { cx: number; cy: number; col: number; row: number }[] = [];
      for (let row = 0; row < GRID_ROWS; row++) {
        for (let col = 0; col < GRID_COLS; col++) {
          if (!island.tileMask[row]?.[col]) continue;
          const c = project(col + 0.5, row + 0.5);
          const cx = c.x + offsetX, cy = c.y + offsetY;
          tiles.push({ cx, cy, col, row });
          minX = Math.min(minX, cx - TILE_W / 2); maxX = Math.max(maxX, cx + TILE_W / 2);
          minY = Math.min(minY, cy - TILE_H / 2); maxY = Math.max(maxY, cy + TILE_H / 2);
        }
      }
      if (tiles.length === 0) return; // empty mask, skip
      const midX = (minX + maxX) / 2;
      const islandCenter = { x: midX, y: (minY + maxY) / 2 };

      // 1) Connecting bridge from the active island out to this neighbour,
      //    so the world reads as one connected archipelago.
      this.drawBridge(activeCenter, islandCenter, theme.path, locked);

      // 2) Cliff underside — one dark band beneath each tile for floating depth.
      const cliff = this.add.graphics();
      cliff.setDepth(-60);
      const thickness = 26;
      for (const t of tiles) {
        const left  = { x: t.cx - TILE_W / 2, y: t.cy };
        const bottom = { x: t.cx, y: t.cy + TILE_H / 2 };
        const right = { x: t.cx + TILE_W / 2, y: t.cy };
        cliff.fillStyle(locked ? 0x3a3a3a : theme.cliff, locked ? 0.6 : 0.95);
        cliff.fillPoints([
          left, bottom, right,
          { x: right.x, y: right.y + thickness },
          { x: bottom.x, y: bottom.y + thickness },
          { x: left.x, y: left.y + thickness },
        ], true);
      }

      // 3) Grass tops, coloured per the island's theme.
      const g = this.add.graphics();
      g.setDepth(-50);
      for (const t of tiles) {
        const top    = { x: t.cx, y: t.cy - TILE_H / 2 };
        const right  = { x: t.cx + TILE_W / 2, y: t.cy };
        const bottom = { x: t.cx, y: t.cy + TILE_H / 2 };
        const left   = { x: t.cx - TILE_W / 2, y: t.cy };
        const checker = (t.col + t.row) % 2 === 0;
        const fill = locked
          ? (checker ? 0x6b6b6b : 0x767676)
          : (checker ? theme.grass1 : theme.grass2);
        g.fillStyle(fill, locked ? 0.7 : 0.95);
        g.fillPoints([top, right, bottom, left], true);
        g.lineStyle(1, 0x000000, 0.12);
        g.strokePoints([top, right, bottom, left], true, true);
      }

      // 4) Labels.
      this.add.text(midX, minY - 30, `${theme.emoji} ${island.name}`, {
        fontSize: '20px', color: locked ? '#cccccc' : '#ffffff', fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 5,
      }).setOrigin(0.5).setDepth(40);

      if (locked) {
        this.add.text(islandCenter.x, islandCenter.y - 16, '🔒', { fontSize: '52px' })
          .setOrigin(0.5).setDepth(40);
        this.add.text(islandCenter.x, islandCenter.y + 34, `🪙 ${cost}`, {
          fontSize: '22px', color: '#ffd700', fontStyle: 'bold',
          stroke: '#000000', strokeThickness: 4,
        }).setOrigin(0.5).setDepth(40);
        this.add.text(midX, maxY + 10, 'Tippen zum Freischalten', {
          fontSize: '12px', color: '#dddddd', stroke: '#000000', strokeThickness: 3,
        }).setOrigin(0.5).setDepth(40);
      } else {
        this.add.text(midX, maxY + 10, 'Tippen zum Besuchen', {
          fontSize: '12px', color: '#bff5a8', stroke: '#000000', strokeThickness: 3,
        }).setOrigin(0.5).setDepth(40);
      }

      this.neighborRegions.push({ islandId: island.id, locked, cost, minX, maxX, minY: minY - 34, maxY: maxY + 28 });

      // Grow the world bounding box to include this neighbour.
      worldMinX = Math.min(worldMinX, minX);
      worldMaxX = Math.max(worldMaxX, maxX);
      worldMinY = Math.min(worldMinY, minY - 34);
      worldMaxY = Math.max(worldMaxY, maxY + 28);
    });

    return { minX: worldMinX, maxX: worldMaxX, minY: worldMinY, maxY: worldMaxY };
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
    const { col, row } = worldToGrid(w.x, w.y);
    if (col === this.hoverCol && row === this.hoverRow) return;
    // Clear previous.
    if (this.inBounds(this.hoverCol, this.hoverRow)) {
      this.tiles[this.hoverRow][this.hoverCol].resetColor();
    }
    this.hoverCol = col;
    this.hoverRow = row;
    if (this.inBounds(col, row) && !this.placementMode) {
      this.tiles[row][col].highlight();
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

    // Otherwise an empty land tile → build menu.
    const { col, row } = worldToGrid(w.x, w.y);
    if (this.inBounds(col, row) && this.tiles[row][col].isLand) {
      EventBus.emit(GameEvents.OPEN_BUILD_MENU, { tileX: col, tileY: row });
    }
  }

  private inBounds(col: number, row: number): boolean {
    return col >= 0 && col < GRID_COLS && row >= 0 && row < GRID_ROWS;
  }

  // ---- Terrain obstacles ------------------------------------------------

  private obstacleKey(islandId: string, tileX: number, tileY: number): string {
    return `${islandId}:${tileX},${tileY}`;
  }

  // Spawn every uncleared obstacle defined on the active island.
  private spawnObstacles(s: ReturnType<typeof useGameStore.getState>) {
    const islandDef = ISLAND_DEFS[s.currentIslandId];
    for (const o of islandDef?.obstacles ?? []) {
      if (s.clearedObstacles.includes(this.obstacleKey(s.currentIslandId, o.tileX, o.tileY))) continue;
      const spr = new ObstacleSprite(this, o);
      this.obstacleSprites.set(`${o.tileX},${o.tileY}`, spr);
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
        if (store.clearObstacle(store.currentIslandId, spr.tileX, spr.tileY)) {
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
    const sprite = new BuildingSprite(this, b, TILE_W);
    sprite.setDepth(100 + b.tileX + b.tileY + def.tilesW + def.tilesH);
    this.buildingSprites.set(b.instanceId, sprite);
    this.refreshResidents(b);
  }

  // Show resident monsters as little characters standing on a habitat.
  private refreshResidents(b: BuildingInstance) {
    const def = BUILDING_DEFS[b.defId];
    if (!def || def.category !== 'Habitat') return;

    const sig = b.monsterIds.join(',');
    if (this.residentSignature.get(b.instanceId) === sig) return;
    this.residentSignature.set(b.instanceId, sig);

    // Clear old.
    for (const m of this.residentSprites.get(b.instanceId) ?? []) m.destroy();
    this.residentSprites.set(b.instanceId, []);

    const monsters = useGameStore.getState().monsters;
    const ids = b.monsterIds.filter(id => monsters[id]).slice(0, 4);
    const center = project(b.tileX + def.tilesW / 2, b.tileY + def.tilesH / 2);
    const BH = 26 + Math.min(def.tilesW, def.tilesH) * 7;
    const baseDepth = 100 + b.tileX + b.tileY + def.tilesW + def.tilesH;

    const sprites: MonsterSprite[] = [];
    ids.forEach((id, i) => {
      const inst = monsters[id];
      const n = ids.length;
      const ox = (i - (n - 1) / 2) * 22;
      const oy = -BH + 6 + (i % 2) * 8;
      const ms = new MonsterSprite(this, inst.defId, center.x + ox, center.y + oy, 34, false);
      ms.setDepth(baseDepth + 0.5 + i * 0.01);
      sprites.push(ms);
    });
    this.residentSprites.set(b.instanceId, sprites);
  }

  // Place eggs on pedestals fanned out in front of the hatchery.
  private refreshEggs(s: ReturnType<typeof useGameStore.getState>) {
    const sig = s.eggs.map(e => e.id).join(',');
    if (sig === this.eggSignature) return;
    this.eggSignature = sig;

    // Find the hatchery on the current island for an anchor point.
    const hatchery = Object.values(s.buildings).find(
      b => b.islandId === s.currentIslandId && BUILDING_DEFS[b.defId]?.category === 'Hatchery',
    );

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
    const islandId = s.currentIslandId;
    for (const b of Object.values(s.buildings)) {
      if (b.islandId !== islandId) continue;
      if (!this.buildingSprites.has(b.instanceId)) {
        this.spawnBuilding(b);
      } else {
        const sprite = this.buildingSprites.get(b.instanceId)!;
        sprite.setUnderConstruction(b.constructionEndMs !== null);
        this.refreshResidents(b);
      }
    }
    this.refreshEggs(s);

    // Drop any obstacle sprites that have since been cleared.
    for (const [key, spr] of this.obstacleSprites) {
      if (s.clearedObstacles.includes(this.obstacleKey(islandId, spr.tileX, spr.tileY))) {
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

  private onPanelClosed = () => {
    if (this.placementMode) this.exitPlacementMode();
  };

  private onStartBattle = (data: { playerTeam: string[]; enemyTeam: string[] }) => {
    this.scene.launch('Battle', data);
    this.scene.pause();
  };

  // Rebuild the whole island view when the player switches islands.
  private onIslandChanged = () => {
    this.scene.restart();
  };

  private exitPlacementMode() {
    this.placementMode = false;
    this.placementDefId = '';
    this.placementHighlight?.destroy();
    this.placementHighlight = undefined;
    this.hideBuildOverlay();
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
    const ringX = W2 + 130; // 2D spacing between island blocks
    const ringY = H2 + 130;

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

      // A transparent whole-island tap target (switch / unlock).
      const hit = this.add.rectangle(o.x + W2 / 2, o.y + H2 / 2, W2, H2, 0xffffff, 0.001)
        .setInteractive({ useHandCursor: true });
      hit.on('pointerup', () => {
        if (this.dragMoved) return; // it was a pan
        this.switchOrUnlockIsland(isl.id, locked, cost);
      });
      world.add(hit);

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

    // Draw the ACTIVE island as the interactive build grid.
    const o0 = originOf(null);
    this.buildOverlayCells = [];
    for (let row = 0; row < GRID_ROWS; row++) {
      this.buildOverlayCells[row] = [];
      for (let col = 0; col < GRID_COLS; col++) {
        const isLand = islandDef.tileMask[row]?.[col];
        const rect = this.add.rectangle(
          o0.x + col * cell + cell / 2, o0.y + row * cell + cell / 2,
          cell - 2, cell - 2, isLand ? 0x2e7d32 : 0x16273a, isLand ? 0.95 : 0.5)
          .setStrokeStyle(1, 0x0c1622);
        if (isLand) rect.setInteractive({ useHandCursor: true });
        rect.on('pointerover', () => this.previewBuildAt(col, row));
        rect.on('pointerup', () => {
          if (this.dragMoved) return; // it was a pan, not a placement tap
          // Guard the trailing iso-layer pointerup from this same click.
          this.suppressTapUntil = Date.now() + 350;
          this.tryPlaceBuilding(col, row);
        });
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
    for (const b of Object.values(state.buildings)) {
      if (b.islandId !== currentId) continue;
      const bd = BUILDING_DEFS[b.defId];
      if (!bd) continue;
      for (let r = b.tileY; r < b.tileY + bd.tilesH; r++) {
        for (let c = b.tileX; c < b.tileX + bd.tilesW; c++) {
          const rect = this.buildOverlayCells[r]?.[c];
          if (rect) { rect.setFillStyle(0x553333, 0.95); rect.disableInteractive(); }
        }
      }
    }
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        if (!this.tileHasObstacle(c, r, currentId)) continue;
        const rect = this.buildOverlayCells[r]?.[c];
        if (rect) { rect.setFillStyle(0x6a4a2a, 0.95); rect.disableInteractive(); }
      }
    }

    // Fixed UI: title + hint (added last so they stay on top, screen-fixed).
    const def = BUILDING_DEFS[this.placementDefId];
    const title = this.add.text(width / 2, 26,
      `🏗️ 2D-Baumodus — ${def?.name ?? ''}  (${def?.tilesW ?? 1}×${def?.tilesH ?? 1})`,
      { fontSize: '16px', color: '#ffffff', fontStyle: 'bold', stroke: '#000', strokeThickness: 3 })
      .setOrigin(0.5);
    root.add(title);
    const hint = this.add.text(width / 2, height - 20,
      'Ziehen = Karte bewegen · Mausrad / Pinch = Zoom · Grün = baubar · ESC = Abbrechen',
      { fontSize: '12px', color: '#aabbcc' }).setOrigin(0.5);
    root.add(hint);

    this.buildOverlay = root;
    this.applyOverlayTransform();
  }

  // Tint the hovered footprint green (valid) or red (blocked).
  private previewBuildAt(col: number, row: number) {
    if (!this.buildOverlay) return;
    const def = BUILDING_DEFS[this.placementDefId];
    if (!def) return;
    const islandId = useGameStore.getState().currentIslandId;
    const islandDef = ISLAND_DEFS[islandId];
    const valid = this.canPlace(col, row, def.tilesW, def.tilesH, islandDef, islandId);

    // Repaint base colours first.
    const state = useGameStore.getState();
    const occupied = new Set<string>();
    for (const b of Object.values(state.buildings)) {
      if (b.islandId !== islandId) continue;
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
    this.overlayDragging = false;
    this.overlayPinchDist = 0;
  }

  private tryPlaceBuilding(col: number, row: number) {
    const def = BUILDING_DEFS[this.placementDefId];
    if (!def) return;
    const islandId = useGameStore.getState().currentIslandId;
    const islandDef = ISLAND_DEFS[islandId];

    const valid = this.canPlace(col, row, def.tilesW, def.tilesH, islandDef, islandId);
    if (!valid) { this.flashPlacement(col, row, def.tilesW, def.tilesH, 0xff3333); return; }

    useGameStore.getState().placeBuilding(this.placementDefId, islandId, col, row);
    this.exitPlacementMode();
    EventBus.emit(GameEvents.PANEL_CLOSED, {});
  }

  private canPlace(
    col: number, row: number, w: number, h: number,
    islandDef: { tileMask: boolean[][] }, islandId: string,
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
    EventBus.off(GameEvents.ENTER_PLACEMENT_MODE, this.onEnterPlacement, this);
    EventBus.off(GameEvents.PANEL_CLOSED, this.onPanelClosed, this);
    EventBus.off(GameEvents.START_BATTLE, this.onStartBattle, this);
    EventBus.off(GameEvents.ISLAND_CHANGED, this.onIslandChanged, this);
    EventBus.off(GameEvents.HATCH_EGG_ANIMATE, this.onHatchAnimate, this);
    this.buildingSprites.clear();
    this.residentSprites.clear();
    this.residentSignature.clear();
    this.eggSprites.clear();
    this.obstacleSprites.clear();
  }
}
