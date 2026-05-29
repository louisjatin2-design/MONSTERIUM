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

    let progress = 0;
    const tick = this.time.addEvent({
      delay: 30,
      repeat: 30,
      callback: () => {
        progress += 1 / 31;
        bar.width = 296 * Math.min(progress, 1);
        if (progress >= 1) {
          this.time.delayedCall(200, () => this.scene.start('MainMenu'));
        }
      },
    });
  }
}
