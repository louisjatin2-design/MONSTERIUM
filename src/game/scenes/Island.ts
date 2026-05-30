import Phaser from 'phaser';
import { useGameStore } from '@store/gameStore';
import { ISLAND_DEFS } from '@data/islands';
import { BUILDING_DEFS } from '@data/buildings';
import { EventBus, GameEvents } from '@game/EventBus';
import { GridTile } from '@game/objects/GridTile';
import { BuildingSprite } from '@game/objects/BuildingSprite';
import { MonsterSprite } from '@game/objects/MonsterSprite';
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

    // EventBus wiring.
    EventBus.on(GameEvents.ENTER_PLACEMENT_MODE, this.onEnterPlacement, this);
    EventBus.on(GameEvents.PANEL_CLOSED, this.onPanelClosed, this);
    EventBus.on(GameEvents.START_BATTLE, this.onStartBattle, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.onShutdown());
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
  }

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
    this.buildingSprites.clear();
    this.residentSprites.clear();
    this.residentSignature.clear();
  }
}
