import Phaser from 'phaser';
import { MONSTER_DEFS } from '@data/monsters';
import { ELEMENT_COLORS } from '@data/elements';
import { RARITY_COLORS } from '@data/rarities';

// A cute, cartoonish little creature: round body, big shiny eyes,
// rosy cheeks, a smile, a soft shadow, and a gentle idle bob.
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

    // Ground shadow (stays put while the body bobs).
    const shadow = scene.add.ellipse(0, r * 0.9, r * 1.5, r * 0.5, 0x000000, 0.22);

    // Inner container holds everything that bobs.
    const inner = scene.add.container(0, 0);

    // Rarity glow ring.
    const glow = scene.add.circle(0, 0, r + 3, ringColor, 0.55);
    // Body with a thick cartoon outline.
    const body = scene.add.circle(0, 0, r, bodyColor, 1);
    body.setStrokeStyle(3, 0x000000, 0.55);
    // A lighter belly highlight for a rounder, toy-like look.
    const belly = scene.add.circle(0, r * 0.25, r * 0.6, 0xffffff, 0.18);

    // Big shiny eyes.
    const eyeOff = r * 0.34;
    const eyeY = -r * 0.18;
    const eyeR = r * 0.26;
    const eyeWL = scene.add.circle(-eyeOff, eyeY, eyeR, 0xffffff);
    const eyeWR = scene.add.circle(eyeOff, eyeY, eyeR, 0xffffff);
    const pupL = scene.add.circle(-eyeOff, eyeY + 1, eyeR * 0.55, 0x18203a);
    const pupR = scene.add.circle(eyeOff, eyeY + 1, eyeR * 0.55, 0x18203a);
    const shineL = scene.add.circle(-eyeOff - eyeR * 0.2, eyeY - eyeR * 0.2, eyeR * 0.22, 0xffffff);
    const shineR = scene.add.circle(eyeOff - eyeR * 0.2, eyeY - eyeR * 0.2, eyeR * 0.22, 0xffffff);

    // Rosy cheeks.
    const cheekL = scene.add.circle(-eyeOff * 1.25, r * 0.18, r * 0.16, 0xff8aa0, 0.6);
    const cheekR = scene.add.circle(eyeOff * 1.25, r * 0.18, r * 0.16, 0xff8aa0, 0.6);

    // Smile (a small arc).
    const mouth = scene.add.graphics();
    mouth.lineStyle(2.5, 0x18203a, 0.8);
    mouth.beginPath();
    mouth.arc(0, r * 0.12, r * 0.32, Phaser.Math.DegToRad(20), Phaser.Math.DegToRad(160), false);
    mouth.strokePath();

    inner.add([glow, body, belly, cheekL, cheekR, eyeWL, eyeWR, pupL, pupR, shineL, shineR, mouth]);

    const parts: Phaser.GameObjects.GameObject[] = [shadow, inner];

    if (showName) {
      const nameTag = scene.add.text(0, r + 6, def.name, {
        fontSize: '10px',
        color: '#ffffff',
        fontStyle: 'bold',
        backgroundColor: '#00000099',
        padding: { x: 4, y: 1 },
      }).setOrigin(0.5, 0);
      parts.push(nameTag);
    }

    this.add(parts);

    // Gentle idle bob — only the inner body moves, shadow stays grounded.
    const bob = scene.tweens.add({
      targets: inner,
      y: -r * 0.18,
      duration: 900 + Math.random() * 400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
      delay: Math.random() * 600,
    });
    this.once(Phaser.GameObjects.Events.DESTROY, () => bob.stop());

    scene.add.existing(this);
  }
}
