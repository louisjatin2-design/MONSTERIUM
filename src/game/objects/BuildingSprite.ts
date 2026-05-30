import Phaser from 'phaser';
import { BUILDING_DEFS } from '@data/buildings';
import { project, footprintCorners, TILE_W } from '@game/iso';
import type { BuildingInstance } from '@gtypes/game';

type Pt = { x: number; y: number };

// Element-specific habitat ground: [soil, soilAccent, prop accent].
const HABITAT_GROUND: Record<string, { soil: number; soil2: number; accent: number }> = {
  Fire:     { soil: 0x4a2418, soil2: 0x6a3220, accent: 0xff6a22 },
  Water:    { soil: 0x2f7d5a, soil2: 0x3a9468, accent: 0x49b0e8 },
  Electric: { soil: 0xc9b13e, soil2: 0xd9c452, accent: 0xfff04a },
  Earth:    { soil: 0x9a6b38, soil2: 0xb07f46, accent: 0x6f4a24 },
  Air:      { soil: 0x9fd6c8, soil2: 0xb6e3d6, accent: 0xeaf7f4 },
  Ice:      { soil: 0xcfe6f2, soil2: 0xe2f1f9, accent: 0x9fd0ec },
  Darkness: { soil: 0x2c1c40, soil2: 0x3a2755, accent: 0x7a3fb0 },
  Light:    { soil: 0xd9cd84, soil2: 0xe8df9e, accent: 0xfff2a0 },
  Metal:    { soil: 0x8b929c, soil2: 0xa2a9b3, accent: 0xc7ccd2 },
  Poison:   { soil: 0x5a7a32, soil2: 0x6e9140, accent: 0xa6e34a },
};
const DEFAULT_GROUND = { soil: 0x5fb23e, soil2: 0x6ec24a, accent: 0x8fd96a };

// Colors for the simple boxed buildings (breeding / hatchery).
const GENERIC_STYLE: Record<string, { roof: number; left: number; right: number; icon: string }> = {
  BreedingStation: { roof: 0xee5fa5, left: 0xc24a82, right: 0xa23a6c, icon: '💞' },
  Hatchery:        { roof: 0x4fb0ec, left: 0x3a8cc4, right: 0x2d6fa2, icon: '🥚' },
};

export class BuildingSprite extends Phaser.GameObjects.Container {
  instanceId: string;
  silhouette: Pt[] = [];
  private constructionOverlay: Phaser.GameObjects.Graphics;
  private clockText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, building: BuildingInstance, _tileSize: number) {
    const def = BUILDING_DEFS[building.defId];
    const W = def.tilesW, H = def.tilesH;

    const center = project(building.tileX + W / 2, building.tileY + H / 2);
    super(scene, center.x, center.y);
    this.instanceId = building.instanceId;

    // Footprint ground corners relative to the container center.
    const corners = footprintCorners(building.tileX, building.tileY, W, H);
    const rel = (p: Pt): Pt => ({ x: p.x - center.x, y: p.y - center.y });
    const back = rel(corners.back), right = rel(corners.right);
    const front = rel(corners.front), left = rel(corners.left);
    const ground: Pt[] = [back, right, front, left];

    const lerp = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

    const g = scene.add.graphics();

    // Reusable isometric box. Returns its top corners for roof placement.
    const isoBox = (gx: number, gy: number, dw: number, dh: number, h: number,
                    top: number, lft: number, rgt: number) => {
      const b = { x: gx, y: gy - dh }, r = { x: gx + dw, y: gy };
      const f = { x: gx, y: gy + dh }, l = { x: gx - dw, y: gy };
      const ub = { x: b.x, y: b.y - h }, ur = { x: r.x, y: r.y - h };
      const uf = { x: f.x, y: f.y - h }, ul = { x: l.x, y: l.y - h };
      g.fillStyle(lft, 1); g.fillPoints([l, f, uf, ul], true);
      g.lineStyle(1.5, 0x000000, 0.22); g.strokePoints([l, f, uf, ul], true, true);
      g.fillStyle(rgt, 1); g.fillPoints([f, r, ur, uf], true); g.strokePoints([f, r, ur, uf], true, true);
      g.fillStyle(top, 1); g.fillPoints([ub, ur, uf, ul], true); g.strokePoints([ub, ur, uf, ul], true, true);
      return { ub, ur, uf, ul };
    };

    const pyramidRoof = (t: { ub: Pt; ur: Pt; uf: Pt; ul: Pt }, rh: number, colA: number, colB: number) => {
      const apex = { x: (t.ub.x + t.uf.x) / 2, y: Math.min(t.ub.y, t.uf.y) - rh };
      const faces: [Pt, Pt, number][] = [
        [t.ul, t.ub, colA], [t.ub, t.ur, colA], [t.ur, t.uf, colB], [t.uf, t.ul, colB],
      ];
      for (const [p1, p2, col] of faces) {
        g.fillStyle(col, 1); g.fillPoints([p1, p2, apex], true);
        g.lineStyle(1.5, 0x000000, 0.25); g.strokePoints([p1, p2, apex], true, true);
      }
      return apex;
    };

    // Soft ground shadow.
    const shadow = scene.add.graphics();
    shadow.fillStyle(0x000000, 0.2);
    shadow.fillPoints([
      { x: back.x, y: back.y + 5 }, { x: right.x, y: right.y + 5 },
      { x: front.x, y: front.y + 5 }, { x: left.x, y: left.y + 5 },
    ], true);

    const extras: Phaser.GameObjects.GameObject[] = [];

    // ---- Per-category construction --------------------------------------
    if (def.category === 'Farm') {
      this.buildFarm(g, scene, ground, back, right, front, left, lerp, isoBox, pyramidRoof,
        (x, fx, fy) => { const p = project(building.tileX + fx, building.tileY + fy); return { x: p.x - center.x, y: p.y - center.y }; },
        extras);
    } else if (def.category === 'Habitat') {
      this.buildHabitat(g, def.linkedElement, ground, back, right, front, left, lerp);
    } else if (def.category === 'Temple') {
      this.buildTemple(g, ground, right.x, front.y, isoBox, pyramidRoof);
    } else {
      this.buildGeneric(g, def.category, right.x, front.y, Math.min(W, H), isoBox, pyramidRoof, front.y, extras, scene);
    }

    // Name label below the footprint.
    const nameText = scene.add.text(0, front.y + 8, def.name, {
      fontSize: '10px', color: '#ffffff', fontStyle: 'bold',
      stroke: '#1a0a30', strokeThickness: 3, align: 'center',
      wordWrap: { width: W * TILE_W }, backgroundColor: '#00000055', padding: { x: 3, y: 1 },
    }).setOrigin(0.5, 0);

    // Construction overlay (darkened footprint + clock).
    this.constructionOverlay = scene.add.graphics();
    this.constructionOverlay.fillStyle(0x000022, 0.55);
    this.constructionOverlay.fillPoints(ground, true);
    this.clockText = scene.add.text(0, -24, '⏳', { fontSize: '22px' }).setOrigin(0.5);
    const underConstruction = building.constructionEndMs !== null;
    this.constructionOverlay.setVisible(underConstruction);
    this.clockText.setVisible(underConstruction);

    this.add([shadow, g, ...extras, nameText, this.constructionOverlay, this.clockText]);
    scene.add.existing(this);

    // Hit-test silhouette (footprint raised by a category-appropriate height).
    const HITH = def.category === 'Temple' ? 46 : def.category === 'Farm' ? 32
      : def.category === 'Habitat' ? 18 : 28 + Math.min(W, H) * 8;
    const upW = (p: Pt): Pt => ({ x: p.x, y: p.y - HITH });
    this.silhouette = [
      upW(corners.back), upW(corners.right), corners.right,
      corners.front, corners.left, upW(corners.left),
    ];
  }

  // ---- Farm: tilled field + barn + animated windmill --------------------
  private buildFarm(
    g: Phaser.GameObjects.Graphics, scene: Phaser.Scene, ground: Pt[],
    back: Pt, right: Pt, front: Pt, left: Pt,
    lerp: (a: Pt, b: Pt, t: number) => Pt,
    isoBox: (gx: number, gy: number, dw: number, dh: number, h: number, top: number, lft: number, rgt: number) => { ub: Pt; ur: Pt; uf: Pt; ul: Pt },
    pyramidRoof: (t: { ub: Pt; ur: Pt; uf: Pt; ul: Pt }, rh: number, a: number, b: number) => Pt,
    gp: (x: 0, fx: number, fy: number) => Pt,
    extras: Phaser.GameObjects.GameObject[],
  ) {
    const SOIL = 0x9c6b3f, SOIL_DARK = 0x7a5430, CROP = 0x4eb24e;
    // Field base.
    g.fillStyle(SOIL, 1); g.fillPoints(ground, true);
    g.lineStyle(2, 0x000000, 0.2); g.strokePoints(ground, true, true);
    // Furrow rows running along the column axis, with crop tufts.
    const rows = 7;
    for (let k = 1; k < rows; k++) {
      const t = k / rows;
      const a = lerp(back, left, t), b = lerp(right, front, t);
      g.lineStyle(2, SOIL_DARK, 0.7); g.beginPath();
      g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.strokePath();
      g.fillStyle(CROP, 0.85);
      for (let s = 1; s < 6; s++) {
        const p = lerp(a, b, s / 6);
        g.fillEllipse(p.x, p.y - 2, 3.5, 2.2);
      }
    }

    // Barn (front-left): red body + grey gable-ish pyramid roof + door.
    const barnG = gp(0, 0.62, 1.18);
    const barnTop = isoBox(barnG.x, barnG.y, 13, 6.5, 19, 0xc24233, 0x9c3528, 0x7f2a20);
    pyramidRoof(barnTop, 11, 0x5a4030, 0x443022);
    // door
    g.fillStyle(0x3a241a, 1); g.fillRect(barnG.x - 4, barnG.y - 12, 8, 12);
    g.fillStyle(0xe8d8b0, 0.9); g.fillRect(barnG.x - 1.2, barnG.y - 12, 2.4, 12);

    // Windmill (back-right): tapered stone tower + cap + spinning sails.
    const millG = gp(0, 1.45, 0.55);
    const towerH = 34;
    const towerTop = isoBox(millG.x, millG.y, 8, 4, towerH, 0xd8c6a4, 0xb7a079, 0x95805d);
    // cap dome
    isoBox(millG.x, (towerTop.ub.y + towerTop.uf.y) / 2, 6, 3, 7, 0x8a4a2a, 0x6f3a20, 0x5a2f1a);
    const hub: Pt = { x: millG.x, y: millG.y - towerH - 5 };

    const blades = scene.add.graphics();
    const armL = 17, armW = 4.5;
    blades.fillStyle(0xf3ecda, 1);
    blades.fillRect(-armL, -armW / 2, armL * 2, armW);
    blades.fillRect(-armW / 2, -armL, armW, armL * 2);
    blades.lineStyle(1, 0x6a4a2a, 0.85);
    blades.strokeRect(-armL, -armW / 2, armL * 2, armW);
    blades.strokeRect(-armW / 2, -armL, armW, armL * 2);
    blades.fillStyle(0x6a4a2a, 1); blades.fillCircle(0, 0, 3.5);
    blades.setPosition(hub.x, hub.y);
    blades.scaleY = 0.62;
    extras.push(blades);
    const spin = scene.tweens.add({ targets: blades, rotation: Math.PI * 2, duration: 7000, repeat: -1 });
    this.once(Phaser.GameObjects.Events.DESTROY, () => spin.stop());

    // A couple of hay bales for flavor (front-right).
    const hay = gp(0, 1.55, 1.5);
    isoBox(hay.x, hay.y, 5, 2.5, 5, 0xe0c050, 0xc2a23c, 0xa6892f);
  }

  // ---- Habitat: element ground + perimeter fence + small prop -----------
  private buildHabitat(
    g: Phaser.GameObjects.Graphics, element: string | undefined, ground: Pt[],
    back: Pt, right: Pt, front: Pt, left: Pt,
    lerp: (a: Pt, b: Pt, t: number) => Pt,
  ) {
    const c = (element && HABITAT_GROUND[element]) || DEFAULT_GROUND;
    // Ground.
    g.fillStyle(c.soil, 1); g.fillPoints(ground, true);
    // Patchy texture.
    g.fillStyle(c.soil2, 0.55);
    for (const [u, v] of [[0.3, 0.35], [0.6, 0.55], [0.4, 0.7], [0.7, 0.3]]) {
      const p = lerp(lerp(back, left, v), lerp(right, front, v), u);
      g.fillEllipse(p.x, p.y, 12, 7);
    }
    g.lineStyle(2, 0x000000, 0.18); g.strokePoints(ground, true, true);

    // Element prop near the back so it doesn't hide residents.
    const propAt = lerp(lerp(back, left, 0.3), lerp(right, front, 0.3), 0.5);
    if (element === 'Water') {
      g.fillStyle(0x2f73c0, 1); g.fillEllipse(propAt.x, propAt.y, 26, 14);
      g.fillStyle(0x5aa6e8, 0.8); g.fillEllipse(propAt.x - 3, propAt.y - 2, 14, 7);
    } else if (element === 'Fire') {
      g.fillStyle(0x2a1a14, 1); g.fillEllipse(propAt.x, propAt.y + 2, 18, 9);
      g.fillStyle(0xff6a22, 1); g.fillTriangle(propAt.x - 6, propAt.y, propAt.x + 6, propAt.y, propAt.x, propAt.y - 16);
      g.fillStyle(0xffd23f, 1); g.fillTriangle(propAt.x - 3, propAt.y, propAt.x + 3, propAt.y, propAt.x, propAt.y - 9);
    } else {
      g.fillStyle(c.accent, 0.9); g.fillEllipse(propAt.x, propAt.y, 14, 8);
      g.fillStyle(c.soil2, 1); g.fillEllipse(propAt.x + 6, propAt.y + 3, 9, 5);
    }

    // Perimeter fence: posts + top rail on each edge (small gate gap at front).
    const FH = 11, FENCE = 0x8a5a2a, RAIL = 0xa6713a;
    const edge = (a: Pt, b: Pt, gap = false) => {
      const n = 4;
      const ups: Pt[] = [];
      for (let i = 0; i <= n; i++) {
        if (gap && (i === 2)) { ups.push(null as unknown as Pt); continue; }
        const p = lerp(a, b, i / n);
        const u = { x: p.x, y: p.y - FH };
        ups.push(u);
        g.lineStyle(2.5, FENCE, 1); g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(u.x, u.y); g.strokePath();
      }
      g.lineStyle(2, RAIL, 1);
      for (let i = 0; i < ups.length - 1; i++) {
        if (!ups[i] || !ups[i + 1]) continue;
        g.beginPath(); g.moveTo(ups[i].x, ups[i].y); g.lineTo(ups[i + 1].x, ups[i + 1].y); g.strokePath();
      }
    };
    edge(back, right);          // back-right edge
    edge(back, left);           // back-left edge
    edge(right, front);         // right-front edge
    edge(left, front, true);    // front-left edge with a gate gap
  }

  // ---- Temple: stone base + columns + golden roof -----------------------
  private buildTemple(
    g: Phaser.GameObjects.Graphics, ground: Pt[], halfW: number, halfH: number,
    isoBox: (gx: number, gy: number, dw: number, dh: number, h: number, top: number, lft: number, rgt: number) => { ub: Pt; ur: Pt; uf: Pt; ul: Pt },
    pyramidRoof: (t: { ub: Pt; ur: Pt; uf: Pt; ul: Pt }, rh: number, a: number, b: number) => Pt,
  ) {
    // Ground platform tint.
    g.fillStyle(0x9a9488, 1); g.fillPoints(ground, true);
    g.lineStyle(2, 0x000000, 0.2); g.strokePoints(ground, true, true);
    // Stepped stone base.
    const base = isoBox(0, halfH * 0.82, halfW * 0.82, halfH * 0.82, 10, 0xcfc7b4, 0xb3aa96, 0x968d79);
    // Columns at the four base-top corners.
    const colH = 26;
    const colAt = (p: Pt) => isoBox(p.x, p.y + colH, 3.5, 2, colH, 0xe6ddc8, 0xc9bfa6, 0xada389);
    const tops = [
      colAt({ x: base.ub.x, y: base.ub.y }), colAt({ x: base.ur.x, y: base.ur.y }),
      colAt({ x: base.uf.x, y: base.uf.y }), colAt({ x: base.ul.x, y: base.ul.y }),
    ];
    // Golden roof spanning the column tops.
    const roofCorners = {
      ub: tops[0].ub, ur: tops[1].ub, uf: tops[2].ub, ul: tops[3].ub,
    };
    pyramidRoof(roofCorners, 18, 0xf2c14e, 0xcf9a28);
  }

  // ---- Generic boxed building (breeding station / hatchery) -------------
  private buildGeneric(
    g: Phaser.GameObjects.Graphics, category: string, halfW: number, halfH: number, minDim: number,
    isoBox: (gx: number, gy: number, dw: number, dh: number, h: number, top: number, lft: number, rgt: number) => { ub: Pt; ur: Pt; uf: Pt; ul: Pt },
    pyramidRoof: (t: { ub: Pt; ur: Pt; uf: Pt; ul: Pt }, rh: number, a: number, b: number) => Pt,
    frontY: number,
    extras: Phaser.GameObjects.GameObject[],
    scene: Phaser.Scene,
  ) {
    const style = GENERIC_STYLE[category] ?? GENERIC_STYLE.Hatchery;
    const BH = 22 + minDim * 7;
    const top = isoBox(0, halfH * 0.86, halfW * 0.84, halfH * 0.84, BH, style.left, style.left, style.right);
    const apex = pyramidRoof(top, 10 + minDim * 3, style.roof, style.roof);
    const icon = scene.add.text(apex.x, apex.y - 4, style.icon, {
      fontSize: `${Math.floor(16 + minDim * 4)}px`,
    }).setOrigin(0.5);
    extras.push(icon);
  }

  setUnderConstruction(isUnder: boolean) {
    this.constructionOverlay.setVisible(isUnder);
    this.clockText.setVisible(isUnder);
  }
}
