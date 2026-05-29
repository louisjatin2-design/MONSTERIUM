import Phaser from 'phaser';
import { EventBus, GameEvents } from '@game/EventBus';

export class MainMenu extends Phaser.Scene {
  constructor() { super('MainMenu'); }

  create() {
    const { width, height } = this.scale;

    // Background gradient effect
    const bg = this.add.rectangle(width / 2, height / 2, width, height, 0x0a0a1a);

    // Stars
    for (let i = 0; i < 80; i++) {
      const x = Phaser.Math.Between(0, width);
      const y = Phaser.Math.Between(0, height);
      const star = this.add.circle(x, y, Phaser.Math.Between(1, 3), 0xffffff, 0.7);
      this.tweens.add({
        targets: star,
        alpha: 0.2,
        duration: Phaser.Math.Between(1000, 3000),
        yoyo: true,
        repeat: -1,
        delay: Phaser.Math.Between(0, 2000),
      });
    }

    // Title
    this.add.text(width / 2, height * 0.2, 'MONSTERIUM', {
      fontSize: '56px',
      color: '#ffd700',
      fontStyle: 'bold',
      stroke: '#aa8800',
      strokeThickness: 4,
    }).setOrigin(0.5);

    this.add.text(width / 2, height * 0.32, 'Breed · Battle · Conquer', {
      fontSize: '18px',
      color: '#88ccff',
    }).setOrigin(0.5);

    // Buttons
    this.makeButton(width / 2, height * 0.50, 'Play', 0x226622, () => {
      this.scene.start('Island');
    });
    this.makeButton(width / 2, height * 0.62, 'Pokedex', 0x224466, () => {
      this.scene.start('Island');
      this.time.delayedCall(500, () => EventBus.emit(GameEvents.OPEN_POKEDEX));
    });
    this.makeButton(width / 2, height * 0.74, 'Shop', 0x662244, () => {
      this.scene.start('Island');
      this.time.delayedCall(500, () => EventBus.emit(GameEvents.OPEN_SHOP));
    });
  }

  private makeButton(x: number, y: number, label: string, color: number, cb: () => void) {
    const btn = this.add.rectangle(x, y, 200, 48, color, 0.9)
      .setStrokeStyle(2, 0xffffff, 0.8)
      .setInteractive({ useHandCursor: true });
    const txt = this.add.text(x, y, label, {
      fontSize: '22px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    btn.on('pointerover', () => btn.setFillStyle(color + 0x223300));
    btn.on('pointerout',  () => btn.setFillStyle(color));
    btn.on('pointerdown', cb);
  }
}
