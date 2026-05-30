import Phaser from 'phaser';
import { EventBus, GameEvents } from '@game/EventBus';
import { MonsterSprite } from '@game/objects/MonsterSprite';

export class MainMenu extends Phaser.Scene {
  constructor() { super('MainMenu'); }

  create() {
    const { width, height } = this.scale;

    // Warm sky gradient (layered translucent bands).
    this.add.rectangle(width / 2, height / 2, width, height, 0x8fd6f5);
    this.add.rectangle(width / 2, height * 0.78, width, height * 0.44, 0xb6e8a0, 0.9);
    // Sun.
    this.add.circle(width * 0.82, height * 0.2, 60, 0xfff2a0, 0.9);
    this.add.circle(width * 0.82, height * 0.2, 80, 0xfff2a0, 0.3);

    // Fluffy cartoon clouds.
    for (let i = 0; i < 5; i++) {
      const cx = Phaser.Math.Between(60, width - 60);
      const cy = Phaser.Math.Between(40, height * 0.4);
      const cloud = this.add.container(cx, cy);
      const s = Phaser.Math.FloatBetween(0.7, 1.3);
      [[-22, 4, 18], [0, -6, 26], [24, 4, 20], [4, 10, 30]].forEach(([dx, dy, r]) => {
        cloud.add(this.add.circle(dx * s, dy * s, r * s, 0xffffff, 0.95));
      });
      this.tweens.add({
        targets: cloud, x: cx + Phaser.Math.Between(30, 80),
        duration: Phaser.Math.Between(6000, 12000), yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    }

    // Title with a chunky cartoon outline.
    this.add.text(width / 2, height * 0.22, 'MONSTERIUM', {
      fontSize: '64px',
      color: '#ffd23f',
      fontStyle: 'bold',
      stroke: '#7a4a00',
      strokeThickness: 8,
    }).setOrigin(0.5).setShadow(0, 5, '#00000044', 6);

    this.add.text(width / 2, height * 0.33, '✨ Breed · Battle · Conquer ✨', {
      fontSize: '20px',
      color: '#3a5a2a',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // A few cute monsters bouncing along the meadow.
    const showcase = ['flameling', 'aquapup', 'voltkit', 'zephyrling', 'luminos'];
    showcase.forEach((id, i) => {
      const x = width * (0.2 + i * 0.15);
      new MonsterSprite(this, id, x, height * 0.6, 56, false);
    });

    // Rounded cartoon buttons.
    this.makeButton(width / 2, height * 0.75, '▶  Play', 0x4caf50, () => {
      this.scene.start('Island');
    });
    this.makeButton(width / 2, height * 0.85, '📖  Pokédex', 0x3f8fd6, () => {
      this.scene.start('Island');
      this.time.delayedCall(500, () => EventBus.emit(GameEvents.OPEN_POKEDEX));
    });
    this.makeButton(width / 2, height * 0.95, '🛒  Shop', 0xe0699a, () => {
      this.scene.start('Island');
      this.time.delayedCall(500, () => EventBus.emit(GameEvents.OPEN_SHOP));
    });
  }

  private makeButton(x: number, y: number, label: string, color: number, cb: () => void) {
    const w = 240, h = 52;
    const g = this.add.graphics();
    const drawBtn = (fill: number, lift: number) => {
      g.clear();
      g.fillStyle(0x000000, 0.2);
      g.fillRoundedRect(x - w / 2, y - h / 2 + 4 - lift, w, h, 16);
      g.fillStyle(fill, 1);
      g.fillRoundedRect(x - w / 2, y - h / 2 - lift, w, h, 16);
      g.lineStyle(3, 0xffffff, 0.9);
      g.strokeRoundedRect(x - w / 2, y - h / 2 - lift, w, h, 16);
    };
    drawBtn(color, 0);

    const txt = this.add.text(x, y, label, {
      fontSize: '24px', color: '#ffffff', fontStyle: 'bold',
      stroke: '#00000055', strokeThickness: 3,
    }).setOrigin(0.5);

    const zone = this.add.zone(x, y, w, h).setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => { drawBtn(Phaser.Display.Color.IntegerToColor(color).brighten(15).color, 2); txt.y = y - 2; });
    zone.on('pointerout',  () => { drawBtn(color, 0); txt.y = y; });
    zone.on('pointerdown', cb);
  }
}
