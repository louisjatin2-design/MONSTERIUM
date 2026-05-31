import Phaser from 'phaser';
import { project, tileDepth, TILE_W, TILE_H, LAND_THICK } from '@game/iso';

const LAND_TOP     = 0x7ec850;
const LAND_TOP_ALT = 0x86d05a;
const LAND_HOVER   = 0xa6e878;
const LAND_OUTLINE = 0x4f8a32;

// Rocky cliff underside — 6 bands, earthy top to dark stone bottom.
// Left face is slightly lighter than right to give 3-D shading.
const ROCK_L = [0xb88848, 0xa0703a, 0x88582c, 0x6a4020, 0x502e14, 0x381e0a];
const ROCK_R = [0xa07838, 0x886030, 0x704a22, 0x523416, 0x3c240e, 0x281406];

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

    // Water tiles are invisible — they show the sky behind the island.
    if (isLand) this.draw();
  }

  private topPoints() {
    const { cx, cy } = this;
    return [
      { x: cx,              y: cy - TILE_H / 2 }, // back
      { x: cx + TILE_W / 2, y: cy },              // right
      { x: cx,              y: cy + TILE_H / 2 }, // front
      { x: cx - TILE_W / 2, y: cy },              // left
    ];
  }

  private draw() {
    const g = this.gfx;
    g.clear();
    if (!this.isLand) return;

    const top   = this.topPoints();
    const front = top[2]; // front/bottom corner of the diamond
    const left  = top[3];
    const right = top[1];
    const N     = ROCK_L.length;
    const thick = LAND_THICK;

    // ── Rocky cliff sides, banded top → bottom ──────────────────────────
    for (let k = 0; k < N; k++) {
      const y0 = (k       / N) * thick;
      const y1 = ((k + 1) / N) * thick;

      g.fillStyle(ROCK_L[k], 1);
      g.fillPoints([
        { x: left.x,  y: left.y  + y0 },
        { x: front.x, y: front.y + y0 },
        { x: front.x, y: front.y + y1 },
        { x: left.x,  y: left.y  + y1 },
      ], true);

      g.fillStyle(ROCK_R[k], 1);
      g.fillPoints([
        { x: right.x, y: right.y + y0 },
        { x: front.x, y: front.y + y0 },
        { x: front.x, y: front.y + y1 },
        { x: right.x, y: right.y + y1 },
      ], true);
    }

    // Subtle horizontal cracks between rock bands
    g.lineStyle(1, 0x100804, 0.3);
    for (let k = 1; k < N; k++) {
      const yK = (k / N) * thick;
      g.beginPath(); g.moveTo(left.x,  left.y  + yK); g.lineTo(front.x, front.y + yK); g.strokePath();
      g.beginPath(); g.moveTo(right.x, right.y + yK); g.lineTo(front.x, front.y + yK); g.strokePath();
    }

    // Dark bottom edge outline
    g.lineStyle(2, 0x0c0604, 0.8);
    g.beginPath();
    g.moveTo(left.x,  left.y  + thick);
    g.lineTo(front.x, front.y + thick);
    g.lineTo(right.x, right.y + thick);
    g.strokePath();

    // ── Grassy top face ──────────────────────────────────────────────────
    const checker = (this.tileX + this.tileY) % 2 === 0;
    const topColor = this.hovering ? LAND_HOVER : (checker ? LAND_TOP : LAND_TOP_ALT);
    g.fillStyle(topColor, 1);
    g.fillPoints(top, true);

    g.lineStyle(1.5, LAND_OUTLINE, 0.85);
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
