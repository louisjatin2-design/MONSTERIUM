import Phaser from 'phaser';
import { project, tileDepth, TILE_W, TILE_H } from '@game/iso';

// Organic grass palette — several close greens picked pseudo-randomly per
// tile so the surface reads as natural turf rather than a checkerboard.
const GRASS = [0x76c24a, 0x7ec850, 0x84d058, 0x70bc44, 0x88d460];
const GRASS_DARK  = 0x5ea63a; // shaded dips
const GRASS_LIGHT = 0x9ade6e; // sunlit patches
const LAND_HOVER  = 0xb4f088;

// Deterministic pseudo-random in [0,1) from two ints.
function hash2(a: number, b: number): number {
  const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export class GridTile {
  isLand: boolean;
  tileX: number;
  tileY: number;
  private gfx: Phaser.GameObjects.Graphics;
  private cx: number;
  private cy: number;
  private hovering = false;
  private baseColor: number;

  constructor(scene: Phaser.Scene, tileX: number, tileY: number, isLand: boolean) {
    this.tileX = tileX;
    this.tileY = tileY;
    this.isLand = isLand;

    const c = project(tileX + 0.5, tileY + 0.5);
    this.cx = c.x;
    this.cy = c.y;

    // Pick an organic grass shade for this tile.
    const r = hash2(tileX, tileY);
    if (r < 0.12) this.baseColor = GRASS_DARK;
    else if (r > 0.88) this.baseColor = GRASS_LIGHT;
    else this.baseColor = GRASS[Math.floor(hash2(tileY, tileX) * GRASS.length) % GRASS.length];

    this.gfx = scene.add.graphics();
    // Grass tops sit above the unified landmass cliff (drawn by the scene).
    this.gfx.setDepth(tileDepth(tileX, tileY));

    // Water tiles are invisible — open sky shows through around the island.
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

    const top = this.topPoints();
    g.fillStyle(this.hovering ? LAND_HOVER : this.baseColor, 1);
    g.fillPoints(top, true);

    // Faint same-hue speckles for texture (no hard grid lines).
    if (!this.hovering) {
      const r = hash2(this.tileX * 3.3, this.tileY * 1.7);
      if (r > 0.55) {
        g.fillStyle(r > 0.8 ? GRASS_LIGHT : GRASS_DARK, 0.35);
        const sx = this.cx + (hash2(this.tileX, this.tileY * 2) - 0.5) * TILE_W * 0.4;
        const sy = this.cy + (hash2(this.tileX * 2, this.tileY) - 0.5) * TILE_H * 0.4;
        g.fillEllipse(sx, sy, 12, 6);
      }
    }
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
