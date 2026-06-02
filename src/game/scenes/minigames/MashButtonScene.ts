import Phaser from 'phaser';
import { EventBus, GameEvents } from '@game/EventBus';
import { setupFixedViewport, DESIGN_W, DESIGN_H } from '@game/scenes/viewport';
import { addDim, addMinigameHeader, addReadyPrompt, addResultBanner } from '@game/scenes/minigames/minigameUi';
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
  private fillBarMaxW = 720;
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
    const width = DESIGN_W, height = DESIGN_H;
    this.target = 16 + this.rarityRank * 4;
    this.timeLimitMs = 4000;

    // Fit to the live viewport (re-fits on orientation flip). Oversized overlay
    // so the dim covers any letterbox margin around the design space.
    setupFixedViewport(this);
    addDim(this);

    addMinigameHeader(this, this.moveDef.name, 'MASH! Tippe / drücke so schnell du kannst!');

    // Progress bar — wide and tall so the fill is unmistakable as you mash.
    this.add.rectangle(width / 2, height / 2 - 30, this.fillBarMaxW + 12, 60, 0x222531).setStrokeStyle(4, 0x8893aa);
    this.fillBar = this.add.rectangle(width / 2 - this.fillBarMaxW / 2, height / 2 - 30, 0, 50, 0xffcc22)
      .setOrigin(0, 0.5);

    this.tapText = this.add.text(width / 2, height / 2 + 38, `0 / ${this.target}`, {
      fontSize: '34px', color: '#ffffff', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 5,
    }).setOrigin(0.5);

    // Big mash button — a large finger target low on the landscape screen.
    const btnY = height - 150;
    const btn = this.add.circle(width / 2, btnY, 96, 0xe8a845)
      .setStrokeStyle(6, 0xffd070).setInteractive({ useHandCursor: true });
    this.add.text(width / 2, btnY, 'MASH', {
      fontSize: '40px', color: '#3a1a00', fontStyle: 'bold',
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
    const ready = addReadyPrompt(this, width / 2, height / 2 - 110, 'Bereit…');
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
    const width = DESIGN_W, height = DESIGN_H;
    const label = score >= 90 ? 'PERFECT!' : score >= 60 ? 'GREAT!' : score >= 30 ? 'OK' : 'WEAK!';
    const color = score >= 80 ? '#5dff5d' : score >= 40 ? '#ffc23d' : '#ff5a5a';
    addResultBanner(this, width / 2, height / 2 - 110, `${label} (${score}%)`, color);
    this.input.keyboard?.removeAllListeners('keydown-SPACE');
    this.time.delayedCall(700, () => {
      EventBus.emit(GameEvents.MINIGAME_COMPLETE, { score });
      this.scene.stop();
    });
  }
}
