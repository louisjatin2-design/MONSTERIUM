import Phaser from 'phaser';
import { BUILDING_DEFS } from '@data/buildings';
import { project, footprintCorners, TILE_W } from '@game/iso';
import type { BuildingInstance } from '@gtypes/game';

// Warm Monster Legends-inspired palette per category.
const CATEGORY_STYLE: Record<string, {
  base: number; baseShade: number; roof: number; roofDark: number;
  accent: number; icon: string;
}> = {
  Habitat:         { base: 0xf5e6c0, baseShade: 0xd9c48a, roof: 0x4fcf6e, roofDark: 0x2e9e4a, accent: 0x88eea0, icon: '🏠' },
  Temple:          { base: 0xfaf0d0, baseShade: 0xe0d09a, roof: 0xf2c14e, roofDark: 0xcc9a28, accent: 0xffe880, icon: '⛩️' },
  Farm:            { base: 0xeef5d0, baseShade: 0xccd8a0, roof: 0xa8dd44, roofDark: 0x7aaa22, accent: 0xccee66, icon: '🌾' },
  BreedingStation: { base: 0xfae0f0, baseShade: 0xe0b0d0, roof: 0xee4da0, roofDark: 0xcc2a80, accent: 0xff88cc, icon: '💞' },
  Hatchery:        { base: 0xd8eef8, baseShade: 0xa8cce8, roof: 0x44aaee, roofDark: 0x2278cc, accent: 0x88ccff, icon: '🥚' },
};

export class BuildingSprite extends Phaser.GameObjects.Container {
  instanceId: string;
  silhouette: { x: number; y: number }[] = [];
  private boxGfx: Phaser.GameObjects.Graphics;
  private constructionOverlay: Phaser.GameObjects.Graphics;
  private clockText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, building: BuildingInstance, _tileSize: number) {
    const def = BUILDING_DEFS[building.defId];
    const W = def.tilesW, H = def.tilesH;

    const center = project(building.tileX + W / 2, building.tileY + H / 2);
    super(scene, center.x, center.y);
    this.instanceId = building.instanceId;

    const style = CATEGORY_STYLE[def.category] ?? CATEGORY_STYLE.Habitat;
    const BH = 28 + Math.min(W, H) * 9;

    const corners = footprintCorners(building.tileX, building.tileY, W, H);
    const rel = (p: { x: number; y: number }) => ({ x: p.x - center.x, y: p.y - center.y });
    const back  = rel(corners.back);
    const right = rel(corners.right);
    const front = rel(corners.front);
    const left  = rel(corners.left);
    const up = (p: { x: number; y: number }, dy = BH) => ({ x: p.x, y: p.y - dy });

    // Soft drop shadow.
    const shadow = scene.add.graphics();
    shadow.fillStyle(0x000000, 0.22);
    shadow.fillPoints([
      { x: back.x - 2, y: back.y + 6 },
      { x: right.x + 2, y: right.y + 6 },
      { x: front.x + 2, y: front.y + 6 },
      { x: left.x - 2, y: left.y + 6 },
    ], true);

    this.boxGfx = scene.add.graphics();
    const g = this.boxGfx;

    // Base walls — warm cream/ivory.
    g.fillStyle(style.baseShade, 1);
    g.fillPoints([left, front, up(front, BH * 0.45), up(left, BH * 0.45)], true);
    g.lineStyle(1.5, 0x000000, 0.2);
    g.strokePoints([left, front, up(front, BH * 0.45), up(left, BH * 0.45)], true, true);

    g.fillStyle(style.base, 1);
    g.fillPoints([front, right, up(right, BH * 0.45), up(front, BH * 0.45)], true);
    g.strokePoints([front, right, up(right, BH * 0.45), up(front, BH * 0.45)], true, true);

    // Window cutouts on front-right wall.
    const wx = (front.x + right.x) / 2;
    const wy = (front.y + right.y) / 2 - BH * 0.2;
    g.fillStyle(0x224466, 1);
    g.fillRect(wx - 4, wy - 5, 8, 7);
    g.fillStyle(0x88ccff, 0.7);
    g.fillRect(wx - 3, wy - 4, 6, 5);
    g.lineStyle(1, 0x000000, 0.3);
    g.strokeRect(wx - 4, wy - 5, 8, 7);

    // Upper walls (element-colored upper section).
    g.fillStyle(style.roofDark, 1);
    g.fillPoints([
      up(left, BH * 0.45), up(front, BH * 0.45), up(front), up(left),
    ], true);
    g.lineStyle(1.5, 0x000000, 0.18);
    g.strokePoints([up(left, BH * 0.45), up(front, BH * 0.45), up(front), up(left)], true, true);

    g.fillStyle(style.roof, 1);
    g.fillPoints([
      up(front, BH * 0.45), up(right, BH * 0.45), up(right), up(front),
    ], true);
    g.strokePoints([up(front, BH * 0.45), up(right, BH * 0.45), up(right), up(front)], true, true);

    // Roof diamond with dome highlight.
    const roofPts = [up(back), up(right), up(front), up(left)];
    g.fillStyle(style.roof, 1);
    g.fillPoints(roofPts, true);
    g.lineStyle(2.5, 0x000000, 0.28);
    g.strokePoints(roofPts, true, true);

    // Dome highlight on roof.
    const roofCX = (back.x + front.x) / 2;
    const roofCY = -BH - 4;
    g.fillStyle(style.accent, 0.35);
    g.fillEllipse(roofCX - 4, roofCY + 5, 18, 10);

    // Icon on the roof peak.
    const icon = scene.add.text(0, -BH - 6, style.icon, {
      fontSize: `${Math.floor(16 + Math.min(W, H) * 4)}px`,
    }).setOrigin(0.5);

    // Name label.
    const nameText = scene.add.text(0, front.y + 10, def.name, {
      fontSize: '10px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#1a0a30',
      strokeThickness: 3,
      align: 'center',
      wordWrap: { width: W * TILE_W },
      backgroundColor: '#00000055',
      padding: { x: 3, y: 1 },
    }).setOrigin(0.5, 0);

    // Construction overlay.
    this.constructionOverlay = scene.add.graphics();
    this.constructionOverlay.fillStyle(0x000022, 0.55);
    this.constructionOverlay.fillPoints(roofPts, true);
    this.clockText = scene.add.text(0, -BH - 2, '⏳', { fontSize: '22px' }).setOrigin(0.5);
    const underConstruction = building.constructionEndMs !== null;
    this.constructionOverlay.setVisible(underConstruction);
    this.clockText.setVisible(underConstruction);

    this.add([shadow, this.boxGfx, icon, nameText, this.constructionOverlay, this.clockText]);
    scene.add.existing(this);

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
