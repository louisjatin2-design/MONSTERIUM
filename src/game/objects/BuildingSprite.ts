import Phaser from 'phaser';
import { BUILDING_DEFS } from '@data/buildings';
import { ELEMENT_COLORS } from '@data/elements';
import { project, footprintCorners, TILE_W } from '@game/iso';
import type { BuildingInstance } from '@gtypes/game';

type Pt = { x: number; y: number };

function darken(color: number, f: number): number {
  const r = Math.max(0, Math.min(255, ((color >> 16) & 0xff) * f));
  const g = Math.max(0, Math.min(255, ((color >> 8) & 0xff) * f));
  const b = Math.max(0, Math.min(255, (color & 0xff) * f));
  return (r << 16) | (g << 8) | b;
}

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
      g.lineStyle(2.5, 0x1a1208, 0.55); g.strokePoints([l, f, uf, ul], true, true);
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
        g.lineStyle(2.5, 0x1a1208, 0.6); g.strokePoints([p1, p2, apex], true, true);
      }
      return apex;
    };

    // Soft ground shadow.
    const shadow = scene.add.graphics();
    shadow.fillStyle(0x000000, 0.32);
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
      this.buildTemple(g, scene, def.linkedElement, building.level, ground, right.x, front.y, isoBox, extras);
    } else if (def.category === 'Hatchery') {
      this.buildHatchery(g, scene, ground, right.x, front.y, isoBox, extras);
    } else if (def.category === 'BreedingStation') {
      this.buildBreeding(g, scene, ground, right.x, front.y, extras);
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

  // ---- Temple: 3-tier Japanese pagoda, element-tinted -------------------
  private buildTemple(
    g: Phaser.GameObjects.Graphics, scene: Phaser.Scene, element: string | undefined,
    buildingLevel: number, ground: Pt[], halfW: number, halfH: number,
    isoBox: (gx: number, gy: number, dw: number, dh: number, h: number, top: number, lft: number, rgt: number) => { ub: Pt; ur: Pt; uf: Pt; ul: Pt },
    extras: Phaser.GameObjects.GameObject[],
  ) {
    const elColor = (element && (ELEMENT_COLORS as Record<string, number>)[element]) || 0xf2c14e;
    const roofTop = elColor;
    const roofMid = darken(elColor, 0.78);
    const roofDark = darken(elColor, 0.6);
    const wall = 0xe9ddc4, wallL = 0xd2c4a4, wallR = 0xb6a684;
    const woodDark = 0x7a4a2a;

    // Stone ground platform.
    g.fillStyle(0xb8ad97, 1); g.fillPoints(ground, true);
    g.lineStyle(2, 0x000000, 0.2); g.strokePoints(ground, true, true);

    // A flared pagoda roof: wide isometric "diamond" eaves + short ridge.
    const flaredRoof = (cx: number, cy: number, dw: number, dh: number, lift: number) => {
      const b = { x: cx, y: cy - dh - lift }, r = { x: cx + dw, y: cy - lift };
      const f = { x: cx, y: cy + dh - lift }, l = { x: cx - dw, y: cy - lift };
      // underside shadow (eaves)
      g.fillStyle(woodDark, 1);
      g.fillPoints([{ x: l.x, y: l.y + 4 }, { x: f.x, y: f.y + 4 }, { x: r.x, y: r.y + 4 }, f, l], true);
      // top surface, split front/back for shading
      g.fillStyle(roofMid, 1); g.fillPoints([b, r, f, l], true);
      g.fillStyle(roofTop, 1); g.fillPoints([b, r, { x: cx, y: cy - lift }, l], true);
      g.lineStyle(2, darken(elColor, 0.45), 0.9); g.strokePoints([b, r, f, l], true, true);
      // ridge cap
      g.fillStyle(roofDark, 1); g.fillRect(cx - dw * 0.16, cy - dh * 0.5 - lift, dw * 0.32, 4);
      return { topY: cy - lift };
    };

    // Three diminishing tiers (wall box + flared roof each).
    const tiers = [
      { dw: halfW * 0.74, dh: halfH * 0.74, wh: 16, rdw: halfW * 0.98, rdh: halfH * 0.98 },
      { dw: halfW * 0.54, dh: halfH * 0.54, wh: 14, rdw: halfW * 0.72, rdh: halfH * 0.72 },
      { dw: halfW * 0.34, dh: halfH * 0.34, wh: 12, rdw: halfW * 0.48, rdh: halfH * 0.48 },
    ];

    let baseY = halfH * 0.82;
    let lastRoofTopY = 0;
    tiers.forEach((t, i) => {
      // wall box for this tier
      const boxTop = isoBox(0, baseY, t.dw, t.dh, t.wh, wall, wallL, wallR);
      // a thin door/lattice on the front-right wall of the ground tier
      if (i === 0) {
        const mx = (boxTop.uf.x + boxTop.ur.x) / 2;
        const my = (boxTop.uf.y + boxTop.ur.y) / 2 + 5;
        g.fillStyle(woodDark, 1); g.fillRect(mx - 5, my, 10, t.wh - 2);
        g.lineStyle(1, 0x000000, 0.3); g.strokeRect(mx - 5, my, 10, t.wh - 2);
      }
      // flared roof sits on top of the wall box
      const roofCy = boxTop.ub.y + t.dh;
      const rr = flaredRoof(0, roofCy, t.rdw, t.rdh, 0);
      lastRoofTopY = rr.topY;
      // next tier starts above this roof
      baseY = roofCy - t.dh - t.wh - 2;
    });

    // Golden finial (sōrin) on the very top.
    g.fillStyle(0xffe27a, 1); g.fillCircle(0, lastRoofTopY - 6, 3.5);
    g.fillStyle(darken(elColor, 0.7), 1); g.fillRect(-1.2, lastRoofTopY - 14, 2.4, 10);

    // Element-themed effect: drifting particles tinted to the element,
    // emitted from the top of the pagoda (WebGL bloom makes them glow).
    const emberKey = 'fx-ember';
    if (!scene.textures.exists(emberKey)) {
      const tex = scene.textures.createCanvas(emberKey, 16, 16);
      const ctx = tex?.getContext();
      if (ctx) {
        const grd = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
        grd.addColorStop(0, 'rgba(255,255,255,1)');
        grd.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grd; ctx.fillRect(0, 0, 16, 16);
        tex?.refresh();
      }
    }
    const tint = elColor;
    const emitter = scene.add.particles(0, lastRoofTopY - 6, emberKey, {
      lifespan: 1600,
      speedY: { min: -18, max: -34 },
      speedX: { min: -8, max: 8 },
      scale: { start: 0.5 + buildingLevel * 0.04, end: 0 },
      alpha: { start: 0.85, end: 0 },
      frequency: 220,
      quantity: 1,
      tint,
      blendMode: scene.sys.game.renderer.type === Phaser.WEBGL ? 'ADD' : 'NORMAL',
    });
    extras.push(emitter);
    this.once(Phaser.GameObjects.Events.DESTROY, () => emitter.destroy());
  }

  // ---- Hatchery: Reichstag-style neoclassical hall + glass dome ---------
  private buildHatchery(
    g: Phaser.GameObjects.Graphics, scene: Phaser.Scene, ground: Pt[], halfW: number, halfH: number,
    isoBox: (gx: number, gy: number, dw: number, dh: number, h: number, top: number, lft: number, rgt: number) => { ub: Pt; ur: Pt; uf: Pt; ul: Pt },
    extras: Phaser.GameObjects.GameObject[],
  ) {
    // Distinct colour per part so every element reads on its own.
    const WALL = 0xe8d6a8, WALL_L = 0xcdb87f, WALL_R = 0xa8915c;   // warm sandstone hall
    const COL = 0xfdfbf2, COL_LINE = 0x6b5a36;                      // bright ivory columns
    const PED = 0xd96a4a, PED_LINE = 0x8a3a24;                      // terracotta pediment
    const TUR = 0xc24a5a, TUR_L = 0x9d3848, TUR_R = 0x7c2937;       // red corner turrets
    const DRUM = 0x4f7da6, DRUM_L = 0x3d6488, DRUM_R = 0x2c4d6b;    // blue-grey drum
    const OUTLINE = 0x1a1208;

    // Stone plaza floor.
    g.fillStyle(0xcfc4a4, 1); g.fillPoints(ground, true);
    g.lineStyle(2, OUTLINE, 0.3); g.strokePoints(ground, true, true);

    // Main rectangular hall (the big sandstone block).
    const hallTop = isoBox(0, halfH * 0.72, halfW * 0.82, halfH * 0.82, 26, WALL, WALL_L, WALL_R);
    const cx = 0;

    // Dark cornice band running along the two visible top edges.
    g.lineStyle(3.5, 0x5a4a2a, 1);
    g.beginPath(); g.moveTo(hallTop.ul.x, hallTop.ul.y); g.lineTo(hallTop.uf.x, hallTop.uf.y);
    g.lineTo(hallTop.ur.x, hallTop.ur.y); g.strokePath();

    // Portico columns along the front-right wall (the colonnade look).
    const colTop = hallTop.uf, colBot = { x: hallTop.uf.x, y: hallTop.uf.y + 26 };
    const colTopR = hallTop.ur, colBotR = { x: hallTop.ur.x, y: hallTop.ur.y + 26 };
    const nCols = 5;
    for (let i = 1; i < nCols; i++) {
      const t = i / nCols;
      const tx = colTop.x + (colTopR.x - colTop.x) * t;
      const tyTop = colTop.y + (colTopR.y - colTop.y) * t;
      const byBot = colBot.y + (colBotR.y - colBot.y) * t;
      g.fillStyle(COL, 1); g.fillRect(tx - 2.2, tyTop, 4.4, byBot - tyTop);
      g.lineStyle(1.5, COL_LINE, 0.9); g.strokeRect(tx - 2.2, tyTop, 4.4, byBot - tyTop);
    }
    // Same on the front-left wall.
    const lTop = hallTop.ul, lBot = { x: hallTop.ul.x, y: hallTop.ul.y + 26 };
    for (let i = 1; i < nCols; i++) {
      const t = i / nCols;
      const tx = lTop.x + (colTop.x - lTop.x) * t;
      const tyTop = lTop.y + (colTop.y - lTop.y) * t;
      const byBot = lBot.y + (colBot.y - lBot.y) * t;
      g.fillStyle(0xe9e2cf, 1); g.fillRect(tx - 2.2, tyTop, 4.4, byBot - tyTop);
      g.lineStyle(1.5, COL_LINE, 0.8); g.strokeRect(tx - 2.2, tyTop, 4.4, byBot - tyTop);
    }

    // Front pediment (triangular gable) above the entrance — terracotta.
    const pedApex = { x: (colTop.x + colTopR.x) / 2, y: (colTop.y + colTopR.y) / 2 - 16 };
    g.fillStyle(PED, 1);
    g.fillTriangle(colTop.x, colTop.y, colTopR.x, colTopR.y, pedApex.x, pedApex.y);
    g.lineStyle(2.5, PED_LINE, 1);
    g.strokeTriangle(colTop.x, colTop.y, colTopR.x, colTopR.y, pedApex.x, pedApex.y);

    // Four corner pavilion turrets (Reichstag's corner towers) — red.
    const corner = (p: Pt) => {
      isoBox(p.x, p.y, halfW * 0.17, halfH * 0.17, 36, TUR, TUR_L, TUR_R);
    };
    corner({ x: hallTop.ub.x, y: hallTop.ub.y + halfH * 0.66 });
    corner({ x: hallTop.ur.x, y: hallTop.ur.y + halfH * 0.66 });
    corner({ x: hallTop.ul.x, y: hallTop.ul.y + halfH * 0.66 });

    // Central drum + the famous glass cupola — blue-grey drum.
    const drumCy = hallTop.ub.y + halfH * 0.82;
    isoBox(cx, drumCy, halfW * 0.34, halfH * 0.34, 14, DRUM, DRUM_L, DRUM_R);
    const ringY = drumCy - 14;
    g.fillStyle(0x6f93b6, 1); g.fillEllipse(cx, ringY, halfW * 0.66, halfH * 0.66);
    g.lineStyle(2, OUTLINE, 0.5); g.strokeEllipse(cx, ringY, halfW * 0.66, halfH * 0.66);

    // Glass dome — saturated blue so it clearly differs from the drum.
    const domeR = halfW * 0.36;
    const domeCy = ringY - 1;
    g.fillStyle(0x1f5a90, 0.7); g.fillEllipse(cx, domeCy, domeR * 2, domeR * 0.6);
    g.fillStyle(0x4aa6e0, 0.85);
    g.beginPath(); g.arc(cx, domeCy, domeR, Phaser.Math.DegToRad(180), Phaser.Math.DegToRad(360), false);
    g.closePath(); g.fillPath();
    g.fillStyle(0x8fd0f5, 0.8);
    g.beginPath(); g.arc(cx, domeCy, domeR, Phaser.Math.DegToRad(205), Phaser.Math.DegToRad(295), false);
    g.closePath(); g.fillPath();
    // glazing bars: vertical meridians + 2 horizontal rings (dark, clearly visible)
    g.lineStyle(1.2, 0x1f4a70, 0.8);
    for (let a = 185; a < 360; a += 22) {
      const ax = cx + Math.cos(Phaser.Math.DegToRad(a)) * domeR;
      const ay = domeCy + Math.sin(Phaser.Math.DegToRad(a)) * domeR;
      g.beginPath(); g.moveTo(cx, domeCy); g.lineTo(ax, ay); g.strokePath();
    }
    for (const rr of [0.66, 0.34]) {
      g.beginPath(); g.arc(cx, domeCy, domeR * rr, Phaser.Math.DegToRad(180), Phaser.Math.DegToRad(360), false); g.strokePath();
    }
    g.lineStyle(2.5, 0x16395a, 1);
    g.beginPath(); g.arc(cx, domeCy, domeR, Phaser.Math.DegToRad(180), Phaser.Math.DegToRad(360), false); g.strokePath();
    // glint + finial
    g.fillStyle(0xffffff, 0.7); g.fillEllipse(cx - domeR * 0.35, domeCy - domeR * 0.45, domeR * 0.3, domeR * 0.18);
    g.fillStyle(0xffe27a, 1); g.fillCircle(cx, domeCy - domeR - 3, 3);
    g.lineStyle(1.5, 0x9a7a20, 1); g.strokeCircle(cx, domeCy - domeR - 3, 3);

    // Soft glow pulsing inside the dome.
    if (scene.sys.game.renderer.type === Phaser.WEBGL) {
      const glow = scene.add.ellipse(cx, domeCy - domeR * 0.4, domeR * 1.1, domeR * 0.7, 0x9fe8ff, 0.32);
      extras.push(glow);
      const tw = scene.tweens.add({ targets: glow, alpha: 0.1, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.once(Phaser.GameObjects.Events.DESTROY, () => tw.stop());
    }
  }

  // ---- Breeding Station: Monster Legends "breeding mountain" ------------
  private buildBreeding(
    g: Phaser.GameObjects.Graphics, scene: Phaser.Scene, ground: Pt[], halfW: number, halfH: number,
    extras: Phaser.GameObjects.GameObject[],
  ) {
    const cx = 0;
    // Grassy mound base.
    g.fillStyle(0x4f9e3a, 1); g.fillPoints(ground, true);
    g.fillStyle(0x3f7d2e, 0.6);
    g.fillEllipse(cx, halfH * 0.5, halfW * 1.4, halfH * 1.2);
    g.lineStyle(2, 0x000000, 0.18); g.strokePoints(ground, true, true);

    // Two craggy rock spires forming an archway (the breeding cave).
    const ROCK = 0x8a6f86, ROCK_L = 0x735a70, ROCK_R = 0x5d475a, ROCK_TOP = 0x9c83a0;
    const spire = (baseX: number, lean: number, h: number, w: number) => {
      const bx = baseX, by = halfH * 0.55;
      const tx = baseX + lean, ty = by - h;
      // left face
      g.fillStyle(ROCK_L, 1);
      g.fillPoints([{ x: bx - w, y: by }, { x: bx, y: by + 4 }, { x: tx, y: ty }, { x: tx - w * 0.5, y: ty + 6 }], true);
      // right face
      g.fillStyle(ROCK_R, 1);
      g.fillPoints([{ x: bx, y: by + 4 }, { x: bx + w, y: by }, { x: tx + w * 0.5, y: ty + 6 }, { x: tx, y: ty }], true);
      // front highlight
      g.fillStyle(ROCK, 1);
      g.fillPoints([{ x: bx - w, y: by }, { x: tx - w * 0.5, y: ty + 6 }, { x: tx, y: ty }, { x: tx + w * 0.5, y: ty + 6 }, { x: bx + w, y: by }], true);
      g.lineStyle(2, 0x000000, 0.22);
      g.strokePoints([{ x: bx - w, y: by }, { x: tx, y: ty }, { x: bx + w, y: by }], false, false);
      // snow/cap
      g.fillStyle(ROCK_TOP, 0.9); g.fillEllipse(tx, ty + 2, w * 0.7, 5);
      return { tx, ty };
    };
    const leftSpire = spire(-halfW * 0.5, halfW * 0.18, 46, halfW * 0.28);
    const rightSpire = spire(halfW * 0.5, -halfW * 0.18, 52, halfW * 0.3);

    // Stone arch connecting the two spires.
    g.lineStyle(6, ROCK, 1);
    g.beginPath();
    g.moveTo(leftSpire.tx, leftSpire.ty + 6);
    g.lineTo((leftSpire.tx + rightSpire.tx) / 2, Math.min(leftSpire.ty, rightSpire.ty) - 8);
    g.lineTo(rightSpire.tx, rightSpire.ty + 6);
    g.strokePath();

    // Glowing heart-shaped portal between the spires.
    const portalY = halfH * 0.18;
    const heart = scene.add.graphics();
    const drawHeart = (gg: Phaser.GameObjects.Graphics, s: number, color: number, alpha: number) => {
      gg.fillStyle(color, alpha);
      gg.fillCircle(-s * 0.5, -s * 0.25, s * 0.55);
      gg.fillCircle(s * 0.5, -s * 0.25, s * 0.55);
      gg.fillTriangle(-s * 1.02, -s * 0.02, s * 1.02, -s * 0.02, 0, s * 1.05);
    };
    // dark portal recess
    g.fillStyle(0x2a1226, 1); g.fillEllipse(cx, portalY, halfW * 0.7, halfH * 0.95);

    // Pulsing aura sits BEHIND the hearts (added first so it renders below).
    const isGL = scene.sys.game.renderer.type === Phaser.WEBGL;
    let aura: Phaser.GameObjects.Ellipse | undefined;
    if (isGL) {
      aura = scene.add.ellipse(cx, portalY, halfW * 1.1, halfH * 1.3, 0xff77b8, 0.4);
      extras.push(aura);
    }

    // glowing heart
    drawHeart(heart, halfW * 0.34, 0xff5fa5, 0.95);
    heart.setPosition(cx, portalY);
    extras.push(heart);
    // inner bright heart
    const heartCore = scene.add.graphics();
    drawHeart(heartCore, halfW * 0.2, 0xffd0e8, 0.95);
    heartCore.setPosition(cx, portalY - 1);
    extras.push(heartCore);

    // Pulsing glow animation (real bloom on WebGL).
    if (isGL && aura) {
      const tw = scene.tweens.add({ targets: [aura, heart], alpha: { from: 1, to: 0.55 }, scale: { from: 1, to: 1.08 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.once(Phaser.GameObjects.Events.DESTROY, () => tw.stop());
    }
    if (scene.textures.exists('fx-ember')) {
      const p = scene.add.particles(cx, portalY, 'fx-ember', {
        lifespan: 1500, speedY: { min: -14, max: -30 }, speedX: { min: -10, max: 10 },
        scale: { start: 0.4, end: 0 }, alpha: { start: 0.8, end: 0 },
        frequency: 280, quantity: 1, tint: 0xff9ed0,
        blendMode: isGL ? 'ADD' : 'NORMAL',
      });
      extras.push(p);
      this.once(Phaser.GameObjects.Events.DESTROY, () => p.destroy());
    }
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
