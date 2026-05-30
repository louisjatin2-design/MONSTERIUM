import Phaser from 'phaser';

export class Preload extends Phaser.Scene {
  constructor() { super('Preload'); }

  create() {
    const { width, height } = this.scale;
    const bar = this.add.rectangle(width / 2, height / 2, 0, 20, 0x44ff88);
    const outline = this.add.rectangle(width / 2, height / 2, 300, 22, 0x000000, 0)
      .setStrokeStyle(2, 0xffffff);
    this.add.text(width / 2, height / 2 - 40, 'MONSTERIUM', {
      fontSize: '36px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const STEPS = 30;
    let step = 0;
    this.time.addEvent({
      delay: 30,
      repeat: STEPS - 1,
      callback: () => {
        step++;
        bar.width = Math.floor(296 * step / STEPS);
        if (step >= STEPS) {
          this.time.delayedCall(200, () => this.scene.start('Island'));
        }
      },
    });
  }
}
