import Phaser from 'phaser';
import { project, tileDepth, TILE_W, TILE_H, LAND_THICK, WATER_THICK } from '@game/iso';

// Cartoon palette — bright, saturated, with a thick darker outline.
const LAND_TOP        = 0x7ec850;
const LAND_TOP_ALT    = 0x86d05a; // checkerboard variation
const LAND_HOVER      = 0xa6e878;
const LAND_SIDE_LEFT  = 0xb07a48;
const LAND_SIDE_RIGHT = 0x8a5c33;
const LAND_OUTLINE    = 0x4f8a32;

const WATER_TOP       = 0x4aa6e8;
const WATER_TOP_ALT   = 0x54b0f0;
const WATER_SIDE      = 0x2f7cc0;
const WATER_OUTLINE   = 0x2d7fc0;

export class GridTile {
  isLand: boolean;
  tileX: number;
  tileY: number;
  private gfx: Phaser.GameObjects.Graphics;
  private cx: number;
  private cy: number;
  private hovering = false;

  constructor(scene: Phaser.Scene, tileX: number, tileY: number, isLand: boolean) {
    this.tileX = tileX;
    this.tileY = tileY;
    this.isLand = isLand;

    const c = project(tileX + 0.5, tileY + 0.5);
    this.cx = c.x;
    this.cy = c.y;

    this.gfx = scene.add.graphics();
    this.gfx.setDepth(tileDepth(tileX, tileY));
    this.draw();
  }

  private topPoints() {
    const { cx, cy } = this;
    return [
      { x: cx,             y: cy - TILE_H / 2 },
      { x: cx + TILE_W / 2, y: cy },
      { x: cx,             y: cy + TILE_H / 2 },
      { x: cx - TILE_W / 2, y: cy },
    ];
  }

  private draw() {
    const g = this.gfx;
    g.clear();

    const thick = this.isLand ? LAND_THICK : WATER_THICK;
    const checker = (this.tileX + this.tileY) % 2 === 0;

    const top = this.topPoints();
    const bottom = top[2];   // front corner
    const left = top[3];
    const right = top[1];

    // Side faces (give the tile a 3D "block" thickness).
    const leftSidePts = [
      left,
      bottom,
      { x: bottom.x, y: bottom.y + thick },
      { x: left.x,   y: left.y + thick },
    ];
    const rightSidePts = [
      right,
      bottom,
      { x: bottom.x, y: bottom.y + thick },
      { x: right.x,  y: right.y + thick },
    ];

    g.fillStyle(this.isLand ? LAND_SIDE_LEFT : WATER_SIDE, 1);
    g.fillPoints(leftSidePts, true);
    g.fillStyle(this.isLand ? LAND_SIDE_RIGHT : WATER_SIDE, 1);
    g.fillPoints(rightSidePts, true);

    // Top face.
    let topColor: number;
    if (this.hovering && this.isLand) topColor = LAND_HOVER;
    else if (this.isLand) topColor = checker ? LAND_TOP : LAND_TOP_ALT;
    else topColor = checker ? WATER_TOP : WATER_TOP_ALT;

    g.fillStyle(topColor, 1);
    g.fillPoints(top, true);

    // Cartoon outline on the top diamond.
    g.lineStyle(1.5, this.isLand ? LAND_OUTLINE : WATER_OUTLINE, 0.85);
    g.strokePoints(top, true, true);
  }

  highlight() {
    if (!this.isLand || this.hovering) return;
    this.hovering = true;
    this.draw();
  }

  resetColor() {
    if (!this.hovering) return;
    this.hovering = false;
    this.draw();
  }

  destroy() {
    this.gfx.destroy();
  }
}
