import Phaser from 'phaser';

export class Preload extends Phaser.Scene {
  constructor() { super('Preload'); }

  create() {
    const { width, height } = this.scale;
    // Left-anchored fill that we keep centred by hand: growing the width while
    // re-centring x each step makes the bar expand outward symmetrically from
    // the middle. (Mutating a 0-width Rectangle's `.width` with the default
    // centre origin leaves its cached pivot at the left edge, which made the old
    // bar grow lopsidedly to one side.)
    const bar = this.add.rectangle(width / 2, height / 2, 0, 20, 0x44ff88).setOrigin(0, 0.5);
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
        bar.x = width / 2 - bar.width / 2; // keep the growing bar centred
        if (step >= STEPS) {
          this.time.delayedCall(200, () => this.scene.start('Island'));
        }
      },
    });
  }
}
