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
  GRID_COLS, GRID_ROWS, CONTENT_W, CONTENT_H, ISLAND_CENTER, TILE_W,
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

    this.cameras.main.setBackgroundColor(0x4a9e30); // lush green meadow
    this.addSkyBackdrop();

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

  // A soft sky→horizon→meadow gradient pinned behind the world, plus a
  // glowing sun that bloom turns into real atmospheric light.
  private addSkyBackdrop() {
    const W = this.scale.width, H = this.scale.height;

    const skyKey = 'fx-sky';
    if (!this.textures.exists(skyKey)) {
      const tex = this.textures.createCanvas(skyKey, 8, H);
      const ctx = tex?.getContext();
      if (ctx) {
        const grd = ctx.createLinearGradient(0, 0, 0, H);
        grd.addColorStop(0.0, '#9fd8ff');
        grd.addColorStop(0.45, '#cdeede');
        grd.addColorStop(0.7, '#7ecb52');
        grd.addColorStop(1.0, '#3f8f2c');
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, 8, H);
        tex?.refresh();
      }
    }
    const sky = this.add.image(0, 0, skyKey).setOrigin(0, 0).setScrollFactor(0).setDepth(-1000);
    sky.setDisplaySize(W, H);

    const sunKey = 'fx-sun';
    if (!this.textures.exists(sunKey)) {
      const s = 256;
      const tex = this.textures.createCanvas(sunKey, s, s);
      const ctx = tex?.getContext();
      if (ctx) {
        const grd = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
        grd.addColorStop(0.0, 'rgba(255,248,214,0.95)');
        grd.addColorStop(0.35, 'rgba(255,238,170,0.55)');
        grd.addColorStop(1.0, 'rgba(255,238,170,0)');
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, s, s);
        tex?.refresh();
      }
    }
    this.add.image(W * 0.82, H * 0.16, sunKey)
      .setScrollFactor(0.08).setDepth(-990).setScale(2.2).setAlpha(0.9);

    // Subtle dark overlay to dim the overall brightness (no shader needed).
    this.add.rectangle(0, 0, W, H, 0x0a0a18, 0.22)
      .setOrigin(0, 0).setScrollFactor(0).setDepth(9000);
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
    EventBus.off(GameEvents.HATCH_EGG_ANIMATE, this.onHatchAnimate, this);
    this.buildingSprites.clear();
    this.residentSprites.clear();
    this.residentSignature.clear();
    this.eggSprites.clear();
  }
}
