import Phaser from 'phaser';

export interface TileOptions {
  x: number;
  y: number;
  size: number;
  isLand: boolean;
}

export class GridTile extends Phaser.GameObjects.Rectangle {
  isLand: boolean;
  tileX: number;
  tileY: number;

  constructor(scene: Phaser.Scene, tileX: number, tileY: number, size: number, isLand: boolean) {
    const px = tileX * size + size / 2;
    const py = tileY * size + size / 2;
    const fillColor = isLand ? 0x3a7d44 : 0x1a4a7a;
    const strokeColor = isLand ? 0x2d6235 : 0x1a3d6a;
    super(scene, px, py, size - 1, size - 1, fillColor);
    this.setStrokeStyle(1, strokeColor, 0.5);
    this.isLand = isLand;
    this.tileX = tileX;
    this.tileY = tileY;
    scene.add.existing(this);
  }

  highlight(color: number) {
    this.setFillStyle(color);
  }

  resetColor() {
    this.setFillStyle(this.isLand ? 0x3a7d44 : 0x1a4a7a);
  }
}
