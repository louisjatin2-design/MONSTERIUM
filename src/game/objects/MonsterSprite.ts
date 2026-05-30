import Phaser from 'phaser';
import { MONSTER_DEFS } from '@data/monsters';
import { ELEMENT_COLORS } from '@data/elements';
import { RARITY_COLORS } from '@data/rarities';

// Element-specific accent decorations added on top of the base body.
type ElementDeco = (scene: Phaser.Scene, r: number) => Phaser.GameObjects.GameObject[];

const ELEMENT_DECOS: Partial<Record<string, ElementDeco>> = {
  Fire: (scene, r) => {
    const g = scene.add.graphics();
    g.fillStyle(0xff8800, 0.75);
    // Three flame petals above head.
    for (let i = -1; i <= 1; i++) {
      g.fillEllipse(i * r * 0.28, -r * 0.8 - r * 0.15, r * 0.22, r * 0.42);
    }
    return [g];
  },
  Water: (scene, r) => {
    const g = scene.add.graphics();
    g.fillStyle(0x88ddff, 0.55);
    g.fillEllipse(0, -r * 0.75, r * 0.5, r * 0.35);
    return [g];
  },
  Electric: (scene, r) => {
    const g = scene.add.graphics();
    g.fillStyle(0xffee00, 0.85);
    // Lightning bolt ears.
    g.fillTriangle(-r * 0.6, -r * 0.6, -r * 0.38, -r * 0.95, -r * 0.22, -r * 0.5);
    g.fillTriangle(r * 0.6, -r * 0.6, r * 0.38, -r * 0.95, r * 0.22, -r * 0.5);
    return [g];
  },
  Ice: (scene, r) => {
    const g = scene.add.graphics();
    g.fillStyle(0xccf0ff, 0.65);
    // Snowflake arms on top.
    for (let a = 0; a < 6; a++) {
      const ang = (a / 6) * Math.PI * 2;
      const ex = Math.cos(ang) * r * 0.45;
      const ey = -r * 0.75 + Math.sin(ang) * r * 0.25;
      g.fillCircle(ex, ey, r * 0.06);
    }
    g.fillCircle(0, -r * 0.75, r * 0.1);
    return [g];
  },
  Darkness: (scene, r) => {
    const g = scene.add.graphics();
    g.fillStyle(0x6600cc, 0.6);
    // Bat-wing ears.
    g.fillTriangle(-r * 0.72, -r * 0.4, -r * 0.38, -r * 0.9, -r * 0.1, -r * 0.35);
    g.fillTriangle(r * 0.72, -r * 0.4, r * 0.38, -r * 0.9, r * 0.1, -r * 0.35);
    return [g];
  },
  Light: (scene, r) => {
    const g = scene.add.graphics();
    g.fillStyle(0xffee88, 0.4);
    // Halo ring.
    g.strokeCircle(0, -r * 0.82, r * 0.32);
    g.lineStyle(2.5, 0xffee44, 0.7);
    g.strokeCircle(0, -r * 0.82, r * 0.32);
    return [g];
  },
  Poison: (scene, r) => {
    const g = scene.add.graphics();
    g.fillStyle(0x88008b, 0.55);
    // Small forked tongue at the bottom.
    g.fillTriangle(-r * 0.08, r * 0.45, r * 0.08, r * 0.45, 0, r * 0.62);
    g.fillStyle(0xcc44ff, 0.5);
    g.fillCircle(-r * 0.55, -r * 0.6, r * 0.12);
    g.fillCircle(r * 0.55, -r * 0.6, r * 0.12);
    return [g];
  },
};

export class MonsterSprite extends Phaser.GameObjects.Container {
  defId: string;

  constructor(scene: Phaser.Scene, defId: string, x: number, y: number, size = 44, showName = true) {
    super(scene, x, y);
    this.defId = defId;

    const def = MONSTER_DEFS[defId];
    if (!def) { scene.add.existing(this); return; }

    const bodyColor = ELEMENT_COLORS[def.elements[0]] ?? 0x888888;
    const ringColor = parseInt(RARITY_COLORS[def.rarity].replace('#', ''), 16);
    const r = size / 2;

    // Ground shadow.
    const shadow = scene.add.ellipse(0, r * 0.9, r * 1.6, r * 0.5, 0x000000, 0.2);

    // Inner container bobs.
    const inner = scene.add.container(0, 0);

    // Rarity glow ring.
    const glow = scene.add.circle(0, 0, r + 4, ringColor, 0.5);
    glow.setStrokeStyle(2, ringColor, 0.8);

    // Body.
    const body = scene.add.circle(0, 0, r, bodyColor, 1);
    body.setStrokeStyle(3.5, 0x000000, 0.5);

    // Lighter belly.
    const belly = scene.add.circle(r * 0.05, r * 0.22, r * 0.56, 0xffffff, 0.18);

    // Subtle second body-color gradient highlight.
    const highlight = scene.add.circle(-r * 0.3, -r * 0.3, r * 0.4, 0xffffff, 0.12);

    // Element-specific decoration (spawned before eyes so eyes stay on top).
    const decoFn = ELEMENT_DECOS[def.elements[0]];
    const decoObjects: Phaser.GameObjects.GameObject[] = decoFn ? decoFn(scene, r) : [];

    // Eyes.
    const eyeOff = r * 0.33;
    const eyeY   = -r * 0.16;
    const eyeR   = r * 0.27;
    const eyeWL  = scene.add.circle(-eyeOff, eyeY, eyeR, 0xffffff);
    const eyeWR  = scene.add.circle(eyeOff,  eyeY, eyeR, 0xffffff);
    const pupL   = scene.add.circle(-eyeOff + eyeR * 0.1, eyeY + eyeR * 0.1, eyeR * 0.52, 0x0a1020);
    const pupR   = scene.add.circle(eyeOff  + eyeR * 0.1, eyeY + eyeR * 0.1, eyeR * 0.52, 0x0a1020);
    // Pupil glint.
    const shineL = scene.add.circle(-eyeOff - eyeR * 0.18, eyeY - eyeR * 0.18, eyeR * 0.22, 0xffffff);
    const shineR = scene.add.circle(eyeOff  - eyeR * 0.18, eyeY - eyeR * 0.18, eyeR * 0.22, 0xffffff);

    // Rosy cheeks.
    const cheekL = scene.add.circle(-eyeOff * 1.28, r * 0.2, r * 0.17, 0xff88a0, 0.65);
    const cheekR = scene.add.circle(eyeOff  * 1.28, r * 0.2, r * 0.17, 0xff88a0, 0.65);

    // Smile arc.
    const mouth = scene.add.graphics();
    mouth.lineStyle(2.5, 0x0a1020, 0.8);
    mouth.beginPath();
    mouth.arc(0, r * 0.14, r * 0.3, Phaser.Math.DegToRad(18), Phaser.Math.DegToRad(162), false);
    mouth.strokePath();

    inner.add([
      glow, body, belly, highlight,
      ...decoObjects,
      cheekL, cheekR,
      eyeWL, eyeWR, pupL, pupR, shineL, shineR,
      mouth,
    ]);

    const parts: Phaser.GameObjects.GameObject[] = [shadow, inner];

    if (showName) {
      const nameTag = scene.add.text(0, r + 7, def.name, {
        fontSize: '10px',
        color: '#ffffff',
        fontStyle: 'bold',
        backgroundColor: '#1a0a3099',
        padding: { x: 5, y: 2 },
      }).setOrigin(0.5, 0);
      parts.push(nameTag);
    }

    this.add(parts);

    // Idle bob.
    const bob = scene.tweens.add({
      targets: inner,
      y: -r * 0.2,
      duration: 880 + Math.random() * 440,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
      delay: Math.random() * 700,
    });
    this.once(Phaser.GameObjects.Events.DESTROY, () => bob.stop());

    scene.add.existing(this);
  }
}
