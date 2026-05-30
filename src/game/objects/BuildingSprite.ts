import Phaser from 'phaser';
import { BUILDING_DEFS } from '@data/buildings';
import { project, footprintCorners, TILE_W } from '@game/iso';
import type { BuildingInstance } from '@gtypes/game';

// Cartoon building styling per category: { roof, leftWall, rightWall, icon }
const CATEGORY_STYLE: Record<string, { roof: number; left: number; right: number; icon: string }> = {
  Habitat:         { roof: 0x5fc96e, left: 0x3f9e54, right: 0x2f7d40, icon: '🏠' },
  Temple:          { roof: 0xf2c14e, left: 0xd9a23a, right: 0xb5852b, icon: '⛩️' },
  Farm:            { roof: 0xcbe85f, left: 0xa6c23f, right: 0x86a230, icon: '🌾' },
  BreedingStation: { roof: 0xee85b5, left: 0xc85f94, right: 0xa84a7a, icon: '💞' },
  Hatchery:        { roof: 0x63b8ec, left: 0x3f95c8, right: 0x2f78a8, icon: '🥚' },
};

export class BuildingSprite extends Phaser.GameObjects.Container {
  instanceId: string;
  // World-space silhouette polygon for hit-testing (set by Island).
  silhouette: { x: number; y: number }[] = [];
  private boxGfx: Phaser.GameObjects.Graphics;
  private constructionOverlay: Phaser.GameObjects.Graphics;
  private clockText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, building: BuildingInstance, _tileSize: number) {
    const def = BUILDING_DEFS[building.defId];
    const W = def.tilesW, H = def.tilesH;

    // Anchor the container at the footprint center in world space.
    const center = project(building.tileX + W / 2, building.tileY + H / 2);
    super(scene, center.x, center.y);
    this.instanceId = building.instanceId;

    const style = CATEGORY_STYLE[def.category] ?? CATEGORY_STYLE.Habitat;
    const BH = 26 + Math.min(W, H) * 7; // building height

    // Corners relative to the container center.
    const corners = footprintCorners(building.tileX, building.tileY, W, H);
    const rel = (p: { x: number; y: number }) => ({ x: p.x - center.x, y: p.y - center.y });
    const back = rel(corners.back);
    const right = rel(corners.right);
    const front = rel(corners.front);
    const left = rel(corners.left);
    const up = (p: { x: number; y: number }) => ({ x: p.x, y: p.y - BH });

    // Soft drop shadow on the ground.
    const shadow = scene.add.graphics();
    shadow.fillStyle(0x000000, 0.18);
    shadow.fillPoints([
      { x: back.x, y: back.y + 4 }, { x: right.x, y: right.y + 4 },
      { x: front.x, y: front.y + 4 }, { x: left.x, y: left.y + 4 },
    ], true);

    this.boxGfx = scene.add.graphics();
    const g = this.boxGfx;

    // Left wall (front-left face).
    g.fillStyle(style.left, 1);
    g.fillPoints([left, front, up(front), up(left)], true);
    g.lineStyle(2, 0x000000, 0.25);
    g.strokePoints([left, front, up(front), up(left)], true, true);

    // Right wall (front-right face).
    g.fillStyle(style.right, 1);
    g.fillPoints([front, right, up(right), up(front)], true);
    g.strokePoints([front, right, up(right), up(front)], true, true);

    // Roof (top diamond) — brightest, with a cartoon outline.
    const roofPts = [up(back), up(right), up(front), up(left)];
    g.fillStyle(style.roof, 1);
    g.fillPoints(roofPts, true);
    g.lineStyle(2.5, 0x000000, 0.3);
    g.strokePoints(roofPts, true, true);

    // Icon on the roof.
    const icon = scene.add.text(0, -BH - 2, style.icon, {
      fontSize: `${Math.floor(18 + Math.min(W, H) * 4)}px`,
    }).setOrigin(0.5);

    // Name label below the building.
    const nameText = scene.add.text(0, front.y + 8, def.name, {
      fontSize: '11px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
      align: 'center',
      wordWrap: { width: W * TILE_W },
    }).setOrigin(0.5, 0);

    // Construction overlay (darkened roof + clock).
    this.constructionOverlay = scene.add.graphics();
    this.constructionOverlay.fillStyle(0x000022, 0.55);
    this.constructionOverlay.fillPoints(roofPts, true);
    this.clockText = scene.add.text(0, -BH - 2, '⏳', { fontSize: '22px' }).setOrigin(0.5);
    const underConstruction = building.constructionEndMs !== null;
    this.constructionOverlay.setVisible(underConstruction);
    this.clockText.setVisible(underConstruction);

    this.add([shadow, this.boxGfx, icon, nameText, this.constructionOverlay, this.clockText]);
    scene.add.existing(this);

    // World-space silhouette (roof + two front walls) for click hit-testing.
    const upW = (p: { x: number; y: number }) => ({ x: p.x, y: p.y - BH });
    this.silhouette = [
      upW(corners.back), upW(corners.right), corners.right,
      corners.front, corners.left, upW(corners.left),
    ];
  }

  setUnderConstruction(isUnder: boolean) {
    this.constructionOverlay.setVisible(isUnder);
    this.clockText.setVisible(isUnder);
  }
}
