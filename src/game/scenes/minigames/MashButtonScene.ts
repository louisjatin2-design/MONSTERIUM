import Phaser from 'phaser';
import { EventBus, GameEvents } from '@game/EventBus';
import type { MoveDef } from '@gtypes/game';

interface MashData {
  moveDef: MoveDef;
  rarityRank: number;
}

// Mash a button as fast as possible within a time window. Score scales with
// taps reached vs. a rarity-scaled target.
export class MashButtonScene extends Phaser.Scene {
  private moveDef!: MoveDef;
  private rarityRank = 0;
  private taps = 0;
  private target = 20;
  private timeLimitMs = 4000;
  private endTime = 0;
  private completed = false;
  private armed = false;
  private fillBar!: Phaser.GameObjects.Rectangle;
  private fillBarMaxW = 360;
  private tapText!: Phaser.GameObjects.Text;

  constructor() { super('MashButtonScene'); }

  init(data: MashData) {
    this.moveDef = data.moveDef;
    this.rarityRank = data.rarityRank ?? 0;
    this.taps = 0;
    this.completed = false;
    this.armed = false;
  }

  create() {
    const { width, height } = this.scale;
    this.target = 16 + this.rarityRank * 4;
    this.timeLimitMs = 4000;

    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.8);
    this.add.text(width / 2, 70, this.moveDef.name, {
      fontSize: '28px', color: '#ffd700', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.add.text(width / 2, 110, 'MASH! Tippe / drücke so schnell du kannst!', {
      fontSize: '14px', color: '#aaaaaa',
    }).setOrigin(0.5);

    // Progress bar
    this.add.rectangle(width / 2, height / 2, this.fillBarMaxW + 8, 40, 0x333333).setStrokeStyle(2, 0x888888);
    this.fillBar = this.add.rectangle(width / 2 - this.fillBarMaxW / 2, height / 2, 0, 34, 0xffcc22)
      .setOrigin(0, 0.5);

    this.tapText = this.add.text(width / 2, height / 2 + 50, `0 / ${this.target}`, {
      fontSize: '20px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);

    // Big mash button
    const btn = this.add.circle(width / 2, height - 130, 56, 0xe8a845)
      .setStrokeStyle(4, 0xffd070).setInteractive({ useHandCursor: true });
    this.add.text(width / 2, height - 130, 'MASH', {
      fontSize: '20px', color: '#3a1a00', fontStyle: 'bold',
    }).setOrigin(0.5);

    const onTap = () => {
      if (!this.armed || this.completed) return;
      this.taps++;
      btn.setScale(0.9);
      this.tweens.add({ targets: btn, scale: 1, duration: 80 });
      this.refresh();
    };
    btn.on('pointerdown', onTap);
    this.input.keyboard?.on('keydown-SPACE', onTap);

    // Arm after a short delay so the launching tap doesn't count.
    const ready = this.add.text(width / 2, height / 2 - 60, 'Bereit…', {
      fontSize: '16px', color: '#ffdd55',
    }).setOrigin(0.5);
    this.time.delayedCall(400, () => {
      this.armed = true;
      this.endTime = this.time.now + this.timeLimitMs;
      ready.destroy();
    });
  }

  private refresh() {
    const ratio = Math.min(1, this.taps / this.target);
    this.fillBar.width = this.fillBarMaxW * ratio;
    this.tapText.setText(`${this.taps} / ${this.target}`);
  }

  update() {
    if (!this.armed || this.completed) return;
    if (this.time.now >= this.endTime) this.finish();
  }

  private finish() {
    if (this.completed) return;
    this.completed = true;
    const ratio = Math.min(1, this.taps / this.target);
    const score = Math.floor(ratio * 100);
    const { width, height } = this.scale;
    const label = score >= 90 ? 'PERFECT!' : score >= 60 ? 'GREAT!' : score >= 30 ? 'OK' : 'WEAK!';
    const color = score >= 80 ? '#44ff44' : score >= 40 ? '#ffaa00' : '#ff4444';
    this.add.text(width / 2, height / 2 - 60, `${label} (${score}%)`, {
      fontSize: '26px', color, fontStyle: 'bold',
    }).setOrigin(0.5);
    this.input.keyboard?.removeAllListeners('keydown-SPACE');
    this.time.delayedCall(700, () => {
      EventBus.emit(GameEvents.MINIGAME_COMPLETE, { score });
      this.scene.stop();
    });
  }
}
