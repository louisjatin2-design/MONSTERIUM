import Phaser from 'phaser';
import { useGameStore } from '@store/gameStore';
import { ISLAND_DEFS } from '@data/islands';
import { BUILDING_DEFS } from '@data/buildings';
import { EventBus, GameEvents } from '@game/EventBus';
import { GridTile } from '@game/objects/GridTile';
import { BuildingSprite } from '@game/objects/BuildingSprite';
import type { BuildingInstance } from '@gtypes/game';

const TILE_SIZE = 64;

export class Island extends Phaser.Scene {
  private tiles: GridTile[][] = [];
  private buildingSprites: Map<string, BuildingSprite> = new Map();
  private unsubscribe?: () => void;
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private camStartX = 0;
  private camStartY = 0;
  private placementMode = false;
  private placementDefId = '';
  private placementHighlights: Phaser.GameObjects.Rectangle[] = [];

  constructor() { super('Island'); }

  create() {
    const state = useGameStore.getState();
    const islandDef = ISLAND_DEFS[state.currentIslandId];
    if (!islandDef) return;

    const totalW = 20 * TILE_SIZE;
    const totalH = 15 * TILE_SIZE;

    // Draw tile grid
    for (let row = 0; row < 15; row++) {
      this.tiles[row] = [];
      for (let col = 0; col < 20; col++) {
        const isLand = islandDef.tileMask[row][col];
        const tile = new GridTile(this, col, row, TILE_SIZE, isLand);
        this.tiles[row][col] = tile;

        if (isLand) {
          tile.setInteractive({ useHandCursor: true });
          tile.on('pointerdown', () => this.onTileClick(col, row));
          tile.on('pointerover', () => {
            if (!this.placementMode) tile.highlight(0x5aad64);
          });
          tile.on('pointerout', () => tile.resetColor());
        }
      }
    }

    // Camera setup
    this.cameras.main.setBounds(0, 0, totalW, totalH);
    this.cameras.main.setBackgroundColor(0x1a3a5a);

    // Center camera on island center
    this.cameras.main.centerOn(totalW / 2, totalH / 2);

    // Drag to pan
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.button === 0 && !this.placementMode) {
        this.isDragging = true;
        this.dragStartX = p.x;
        this.dragStartY = p.y;
        this.camStartX = this.cameras.main.scrollX;
        this.camStartY = this.cameras.main.scrollY;
      }
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.isDragging) {
        this.cameras.main.scrollX = this.camStartX - (p.x - this.dragStartX);
        this.cameras.main.scrollY = this.camStartY - (p.y - this.dragStartY);
      }
    });
    this.input.on('pointerup', () => { this.isDragging = false; });

    // Spawn pre-placed buildings
    const buildings = state.buildings;
    for (const b of Object.values(buildings)) {
      if (b.islandId === state.currentIslandId) {
        this.spawnBuilding(b);
      }
    }

    // Subscribe to store for new buildings (Zustand v5 single-callback form)
    this.unsubscribe = useGameStore.subscribe((state) => {
        const islandId = state.currentIslandId;
        for (const b of Object.values(state.buildings)) {
          if (b.islandId === islandId && !this.buildingSprites.has(b.instanceId)) {
            this.spawnBuilding(b);
          }
          const sprite = this.buildingSprites.get(b.instanceId);
          if (sprite) sprite.setUnderConstruction(b.constructionEndMs !== null);
        }
      }
    );

    // EventBus: enter placement mode
    EventBus.on(GameEvents.ENTER_PLACEMENT_MODE, (data: { defId: string }) => {
      this.enterPlacementMode(data.defId);
    });

    EventBus.on(GameEvents.PANEL_CLOSED, () => {
      if (this.placementMode) this.exitPlacementMode();
    });

    // Battle event
    EventBus.on(GameEvents.START_BATTLE, (data: { playerTeam: string[]; enemyTeam: string[] }) => {
      this.scene.launch('Battle', data);
      this.scene.pause();
    });

    // Story mode button in top-right (permanent shortcut)
    const storyBtn = this.add.text(20, 20, '⚔ Story', {
      fontSize: '18px',
      color: '#ffffff',
      backgroundColor: '#00000099',
      padding: { x: 8, y: 4 },
    }).setScrollFactor(0).setInteractive({ useHandCursor: true });
    storyBtn.on('pointerdown', () => EventBus.emit(GameEvents.OPEN_POKEDEX));

    const pvpBtn = this.add.text(110, 20, '🏆 PvP', {
      fontSize: '18px',
      color: '#ffffff',
      backgroundColor: '#00000099',
      padding: { x: 8, y: 4 },
    }).setScrollFactor(0).setInteractive({ useHandCursor: true });
  }

  private onTileClick(col: number, row: number) {
    if (this.placementMode) {
      this.tryPlaceBuilding(col, row);
      return;
    }
    // Check if a building occupies this tile
    const buildings = useGameStore.getState().buildings;
    for (const b of Object.values(buildings)) {
      if (b.islandId !== useGameStore.getState().currentIslandId) continue;
      const def = BUILDING_DEFS[b.defId];
      if (!def) continue;
      if (
        col >= b.tileX && col < b.tileX + def.tilesW &&
        row >= b.tileY && row < b.tileY + def.tilesH
      ) {
        this.onBuildingClick(b);
        return;
      }
    }
    // Open build menu
    EventBus.emit(GameEvents.OPEN_BUILD_MENU, { tileX: col, tileY: row });
  }

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
    }
  }

  private spawnBuilding(b: BuildingInstance) {
    const sprite = new BuildingSprite(this, b, TILE_SIZE);
    sprite.on('pointerdown', () => this.onBuildingClick(b));
    this.buildingSprites.set(b.instanceId, sprite);
  }

  private enterPlacementMode(defId: string) {
    this.placementMode = true;
    this.placementDefId = defId;
    // Add ESC listener
    this.input.keyboard?.once('keydown-ESC', () => this.exitPlacementMode());
  }

  private exitPlacementMode() {
    this.placementMode = false;
    this.placementDefId = '';
    this.clearHighlights();
  }

  private clearHighlights() {
    for (const h of this.placementHighlights) h.destroy();
    this.placementHighlights = [];
  }

  private tryPlaceBuilding(col: number, row: number) {
    const def = BUILDING_DEFS[this.placementDefId];
    if (!def) return;
    const islandId = useGameStore.getState().currentIslandId;
    const islandDef = ISLAND_DEFS[islandId];

    // Check all tiles are land and unoccupied
    for (let r = row; r < row + def.tilesH; r++) {
      for (let c = col; c < col + def.tilesW; c++) {
        if (r >= 15 || c >= 20) { this.showPlacementError(col, row, def); return; }
        if (!islandDef.tileMask[r][c]) { this.showPlacementError(col, row, def); return; }
      }
    }

    // Check overlap with existing buildings
    const buildings = Object.values(useGameStore.getState().buildings);
    for (const b of buildings) {
      if (b.islandId !== islandId) continue;
      const bd = BUILDING_DEFS[b.defId];
      if (!bd) continue;
      if (
        col < b.tileX + bd.tilesW && col + def.tilesW > b.tileX &&
        row < b.tileY + bd.tilesH && row + def.tilesH > b.tileY
      ) {
        this.showPlacementError(col, row, def);
        return;
      }
    }

    // Place it
    useGameStore.getState().placeBuilding(this.placementDefId, islandId, col, row);
    this.exitPlacementMode();
    EventBus.emit(GameEvents.PANEL_CLOSED, {});
  }

  private showPlacementError(col: number, row: number, def: { tilesW: number; tilesH: number }) {
    this.clearHighlights();
    const h = this.add.rectangle(
      col * TILE_SIZE + (def.tilesW * TILE_SIZE) / 2,
      row * TILE_SIZE + (def.tilesH * TILE_SIZE) / 2,
      def.tilesW * TILE_SIZE - 4,
      def.tilesH * TILE_SIZE - 4,
      0xff0000, 0.4
    );
    this.placementHighlights.push(h);
    this.time.delayedCall(600, () => this.clearHighlights());
  }

  shutdown() {
    this.unsubscribe?.();
    EventBus.removeAllListeners(GameEvents.ENTER_PLACEMENT_MODE);
    EventBus.removeAllListeners(GameEvents.START_BATTLE);
  }
}
