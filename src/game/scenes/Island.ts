import Phaser from 'phaser';
import { useGameStore } from '@store/gameStore';
import { ISLAND_DEFS } from '@data/islands';
import { BUILDING_DEFS } from '@data/buildings';
import { EventBus, GameEvents } from '@game/EventBus';
import { GridTile } from '@game/objects/GridTile';
import { BuildingSprite } from '@game/objects/BuildingSprite';
import { MonsterSprite } from '@game/objects/MonsterSprite';
import { EggSprite } from '@game/objects/EggSprite';
import {
  project, worldToGrid, pointInPolygon, footprintCorners,
  GRID_COLS, GRID_ROWS, CONTENT_W, CONTENT_H, ISLAND_CENTER, TILE_W, TILE_H, LAND_THICK,
} from '@game/iso';
import type { BuildingInstance } from '@gtypes/game';

export class Island extends Phaser.Scene {
  private tiles: GridTile[][] = [];
  private buildingSprites: Map<string, BuildingSprite> = new Map();
  private residentSprites: Map<string, MonsterSprite[]> = new Map();
  private residentSignature: Map<string, string> = new Map();
  private eggSprites: Map<string, EggSprite> = new Map();
  private eggSignature = '';
  private placementHighlight?: Phaser.GameObjects.Graphics;
  private unsubscribe?: () => void;

  private isDragging = false;
  private dragMoved = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private camStartX = 0;
  private camStartY = 0;

  private placementMode = false;
  private placementDefId = '';
  private hoverCol = -1;
  private hoverRow = -1;

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

    // Camera bounds + center on the island.
    this.cameras.main.setBounds(0, 0, CONTENT_W, CONTENT_H);
    this.cameras.main.centerOn(ISLAND_CENTER.x, ISLAND_CENTER.y);
    this.applyCameraFX();

    // Spawn pre-placed buildings + their residents.
    for (const b of Object.values(state.buildings)) {
      if (b.islandId === state.currentIslandId) this.spawnBuilding(b);
    }

    // Pointer handling: drag-to-pan + tap detection.
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.isDragging = true;
      this.dragMoved = false;
      this.dragStartX = p.x;
      this.dragStartY = p.y;
      this.camStartX = this.cameras.main.scrollX;
      this.camStartY = this.cameras.main.scrollY;
    });

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.isDragging && !this.placementMode) {
        const dx = p.x - this.dragStartX;
        const dy = p.y - this.dragStartY;
        if (Math.abs(dx) + Math.abs(dy) > 6) this.dragMoved = true;
        this.cameras.main.scrollX = this.camStartX - dx;
        this.cameras.main.scrollY = this.camStartY - dy;
      } else {
        this.updateHover(p);
      }
    });

    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      this.isDragging = false;
      if (this.dragMoved) return; // it was a pan, not a tap
      this.handleTap(p);
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

    // Otherwise an empty land tile → build menu.
    const { col, row } = worldToGrid(w.x, w.y);
    if (this.inBounds(col, row) && this.tiles[row][col].isLand) {
      EventBus.emit(GameEvents.OPEN_BUILD_MENU, { tileX: col, tileY: row });
    }
  }

  private inBounds(col: number, row: number): boolean {
    return col >= 0 && col < GRID_COLS && row >= 0 && row < GRID_ROWS;
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
  }
}
