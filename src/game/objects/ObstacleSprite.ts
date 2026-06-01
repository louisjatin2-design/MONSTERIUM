import Phaser from 'phaser';
import { OBSTACLE_DEFS } from '@data/obstacles';
import { project, footprintCorners, TILE_W, TILE_H } from '@game/iso';
import type { ObstaclePlacement, ObstacleType } from '@gtypes/game';

type Pt = { x: number; y: number };

// A single terrain obstacle (rock / tree / bush / crystal / mushroom / bones)
// rendered as a small isometric prop on one land tile. Carries a world-space
// silhouette polygon so the Island scene can hit-test taps for clearing it.
export class ObstacleSprite extends Phaser.GameObjects.Container {
  readonly tileX: number;
  readonly tileY: number;
  readonly defId: string;
  silhouette: Pt[] = [];

  constructor(scene: Phaser.Scene, placement: ObstaclePlacement) {
    const def = OBSTACLE_DEFS[placement.defId];
    const W = def?.tilesW ?? 1, H = def?.tilesH ?? 1;
    const center = project(placement.tileX + W / 2, placement.tileY + H / 2);
    super(scene, center.x, center.y);

    this.tileX = placement.tileX;
    this.tileY = placement.tileY;
    this.defId = placement.defId;

    const g = scene.add.graphics();

    // Soft ground shadow grounding the prop on its tile.
    g.fillStyle(0x000000, 0.22);
    g.fillEllipse(0, TILE_H * 0.18, TILE_W * 0.5, TILE_H * 0.5);

    let topY = -10; // how tall the prop rises, for the hit silhouette
    switch (def?.type as ObstacleType) {
      case 'rock':     topY = this.drawRock(g); break;
      case 'tree':     topY = this.drawTree(g); break;
      case 'bush':     topY = this.drawBush(g); break;
      case 'crystal':  topY = this.drawCrystal(g); break;
      case 'mushroom': topY = this.drawMushroom(g); break;
      case 'bones':    topY = this.drawBones(g); break;
      default:         topY = this.drawRock(g); break;
    }

    this.add(g);
    scene.add.existing(this);

    // Depth like a 1×1 building so it sorts correctly among other props.
    this.setDepth(100 + placement.tileX + placement.tileY + 1.5);

    // World-space silhouette: the tile diamond, raised by the prop height.
    const corners = footprintCorners(placement.tileX, placement.tileY, W, H);
    const lift = (p: Pt): Pt => ({ x: p.x, y: p.y + topY });
    this.silhouette = [
      lift(corners.back), lift(corners.right), corners.right,
      corners.front, corners.left, lift(corners.left),
    ];
  }

  // ---- Per-type isometric art (all relative to the container centre) ----

  private drawRock(g: Phaser.GameObjects.Graphics): number {
    // A chunky grey boulder with a lighter sunlit cap and a small companion.
    g.fillStyle(0x6b6f76, 1);
    g.fillPoints([
      { x: -16, y: 4 }, { x: -8, y: -16 }, { x: 6, y: -20 },
      { x: 16, y: -6 }, { x: 12, y: 8 }, { x: -6, y: 12 },
    ], true);
    g.fillStyle(0x868b93, 1);
    g.fillPoints([{ x: -8, y: -16 }, { x: 6, y: -20 }, { x: 8, y: -10 }, { x: -4, y: -6 }], true);
    g.lineStyle(2, 0x3c4047, 0.7);
    g.strokePoints([
      { x: -16, y: 4 }, { x: -8, y: -16 }, { x: 6, y: -20 },
      { x: 16, y: -6 }, { x: 12, y: 8 }, { x: -6, y: 12 },
    ], true, true);
    // Companion pebble.
    g.fillStyle(0x5b6068, 1);
    g.fillEllipse(16, 8, 14, 8);
    return -20;
  }

  private drawTree(g: Phaser.GameObjects.Graphics): number {
    // Brown trunk + layered round canopy.
    g.fillStyle(0x6b4423, 1);
    g.fillRect(-3.5, -22, 7, 24);
    g.fillStyle(0x4f3219, 1);
    g.fillRect(0.5, -22, 3, 24);
    g.fillStyle(0x2f7d32, 1);
    g.fillCircle(0, -30, 16);
    g.fillCircle(-11, -24, 11);
    g.fillCircle(11, -24, 11);
    g.fillStyle(0x49a84d, 0.9);
    g.fillCircle(-4, -34, 9);
    g.fillCircle(6, -30, 7);
    return -46;
  }

  private drawBush(g: Phaser.GameObjects.Graphics): number {
    // Low clustered shrub with a couple of berries.
    g.fillStyle(0x3a6e2c, 1);
    g.fillCircle(-9, -6, 10);
    g.fillCircle(9, -6, 10);
    g.fillCircle(0, -12, 12);
    g.fillStyle(0x57954a, 0.9);
    g.fillCircle(-4, -14, 6);
    g.fillCircle(7, -9, 5);
    g.fillStyle(0xd8434f, 1);
    g.fillCircle(-6, -7, 2.2);
    g.fillCircle(8, -10, 2.2);
    return -24;
  }

  private drawCrystal(g: Phaser.GameObjects.Graphics): number {
    // Cluster of glowing violet/cyan shards.
    const shard = (x: number, h: number, w: number, c1: number, c2: number) => {
      g.fillStyle(c2, 1);
      g.fillPoints([{ x: x - w, y: 2 }, { x: x, y: -h }, { x: x, y: 2 }], true);
      g.fillStyle(c1, 1);
      g.fillPoints([{ x: x, y: -h }, { x: x + w, y: 2 }, { x: x, y: 2 }], true);
      g.lineStyle(1.2, 0x2a1d4a, 0.7);
      g.strokePoints([{ x: x - w, y: 2 }, { x: x, y: -h }, { x: x + w, y: 2 }], true, true);
    };
    shard(-9, 18, 6, 0x9a5cf0, 0x6f3fc0);
    shard(9, 16, 6, 0x6fd0f0, 0x47a8d0);
    shard(0, 30, 7, 0xb47cff, 0x8a4ee0);
    g.fillStyle(0xe9d8ff, 0.85);
    g.fillCircle(0, -22, 2.6);
    return -32;
  }

  private drawMushroom(g: Phaser.GameObjects.Graphics): number {
    // Pale stem + spotted red cap (one tall, one short).
    const cap = (x: number, h: number, cw: number) => {
      g.fillStyle(0xf0e6d2, 1);
      g.fillRect(x - 2.5, -h + 6, 5, h - 4);
      g.fillStyle(0xd8434f, 1);
      g.fillEllipse(x, -h + 6, cw, cw * 0.7);
      g.fillStyle(0xffe9e0, 0.95);
      g.fillCircle(x - cw * 0.18, -h + 4, 1.8);
      g.fillCircle(x + cw * 0.2, -h + 7, 1.6);
    };
    cap(-7, 16, 14);
    cap(7, 26, 18);
    return -28;
  }

  private drawBones(g: Phaser.GameObjects.Graphics): number {
    // A weathered skull on a small pile of bones.
    g.fillStyle(0xe8e2d0, 1);
    g.fillRoundedRect(-12, -2, 8, 5, 2); // bone shafts
    g.fillRoundedRect(2, 0, 10, 4, 2);
    g.fillStyle(0xede7d6, 1);
    g.fillCircle(0, -10, 9); // cranium
    g.fillRect(-5, -6, 10, 7); // jaw block
    g.fillStyle(0x2a2622, 1); // eye sockets + nose
    g.fillCircle(-3.5, -11, 2.2);
    g.fillCircle(3.5, -11, 2.2);
    g.fillTriangle(-1.5, -6, 1.5, -6, 0, -8.5);
    g.lineStyle(1, 0x9a907a, 0.8);
    g.strokeCircle(0, -10, 9);
    return -22;
  }
}
