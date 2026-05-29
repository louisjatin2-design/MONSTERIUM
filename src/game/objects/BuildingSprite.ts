import Phaser from 'phaser';
import { BUILDING_DEFS } from '@data/buildings';
import type { BuildingInstance } from '@gtypes/game';

const CATEGORY_COLORS: Record<string, number> = {
  Habitat:         0x44aa44,
  Temple:          0xaa8800,
  Farm:            0x88aa00,
  BreedingStation: 0xaa4488,
  Hatchery:        0x4488aa,
};

const CATEGORY_LETTERS: Record<string, string> = {
  Habitat:         'H',
  Temple:          'T',
  Farm:            'F',
  BreedingStation: 'B',
  Hatchery:        'E',
};

export class BuildingSprite extends Phaser.GameObjects.Container {
  instanceId: string;
  private bg: Phaser.GameObjects.Rectangle;
  private label: Phaser.GameObjects.Text;
  private nameText: Phaser.GameObjects.Text;
  private constructionOverlay: Phaser.GameObjects.Rectangle;

  constructor(
    scene: Phaser.Scene,
    building: BuildingInstance,
    tileSize: number
  ) {
    const def = BUILDING_DEFS[building.defId];
    const pixelX = building.tileX * tileSize;
    const pixelY = building.tileY * tileSize;
    const w = def.tilesW * tileSize;
    const h = def.tilesH * tileSize;

    super(scene, pixelX, pixelY);
    this.instanceId = building.instanceId;

    const color = CATEGORY_COLORS[def.category] ?? 0x888888;

    this.bg = scene.add.rectangle(w / 2, h / 2, w - 4, h - 4, color, 0.85);
    this.bg.setStrokeStyle(2, 0xffffff, 0.7);

    const letter = CATEGORY_LETTERS[def.category] ?? '?';
    this.label = scene.add.text(w / 2, h / 2 - 8, letter, {
      fontSize: `${Math.floor(tileSize * 0.5)}px`,
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.nameText = scene.add.text(w / 2, h / 2 + 10, def.name, {
      fontSize: '9px',
      color: '#ffffff',
      wordWrap: { width: w - 8 },
    }).setOrigin(0.5);

    this.constructionOverlay = scene.add.rectangle(w / 2, h / 2, w - 4, h - 4, 0x000000, 0.5);
    this.constructionOverlay.setVisible(building.constructionEndMs !== null);

    this.add([this.bg, this.label, this.nameText, this.constructionOverlay]);

    this.setSize(w, h);
    this.setInteractive();

    scene.add.existing(this);
  }

  setUnderConstruction(isUnder: boolean) {
    this.constructionOverlay.setVisible(isUnder);
  }
}
