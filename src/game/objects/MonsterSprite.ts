import Phaser from 'phaser';
import { MONSTER_DEFS } from '@data/monsters';
import { ELEMENT_COLORS } from '@data/elements';
import { RARITY_COLORS } from '@data/rarities';

export class MonsterSprite extends Phaser.GameObjects.Container {
  defId: string;

  constructor(scene: Phaser.Scene, defId: string, x: number, y: number, size = 60) {
    super(scene, x, y);
    this.defId = defId;

    const def = MONSTER_DEFS[defId];
    if (!def) { scene.add.existing(this); return; }

    const bodyColor = ELEMENT_COLORS[def.elements[0]] ?? 0x888888;
    const borderColor = parseInt(RARITY_COLORS[def.rarity].replace('#', ''), 16);
    const r = size / 2;

    // Glow ring (rarity)
    const glow = scene.add.circle(0, 0, r + 4, borderColor, 0.6);
    // Body
    const body = scene.add.circle(0, 0, r, bodyColor, 1);
    body.setStrokeStyle(2, 0xffffff, 0.5);

    // Eyes
    const eyeOff = r * 0.3;
    const eyeR = r * 0.15;
    const eyeL = scene.add.circle(-eyeOff, -eyeOff * 0.5, eyeR, 0xffffff);
    const eyeR2 = scene.add.circle(eyeOff, -eyeOff * 0.5, eyeR, 0xffffff);
    const pupilL = scene.add.circle(-eyeOff, -eyeOff * 0.5, eyeR * 0.5, 0x000000);
    const pupilR = scene.add.circle(eyeOff, -eyeOff * 0.5, eyeR * 0.5, 0x000000);

    // Name tag
    const nameTag = scene.add.text(0, r + 8, def.name, {
      fontSize: '10px',
      color: '#ffffff',
      backgroundColor: '#00000088',
      padding: { x: 3, y: 1 },
    }).setOrigin(0.5, 0);

    this.add([glow, body, eyeL, eyeR2, pupilL, pupilR, nameTag]);
    this.setSize(size + 8, size + 24);
    scene.add.existing(this);
  }
}
