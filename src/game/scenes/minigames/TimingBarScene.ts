import Phaser from 'phaser';
import { EventBus, GameEvents } from '@game/EventBus';
import type { MoveDef } from '@gtypes/game';

interface TimingData {
  moveDef: MoveDef;
  rarityRank: number;
}

export class TimingBarScene extends Phaser.Scene {
  private indicator!: Phaser.GameObjects.Rectangle;
  private greenZone!: Phaser.GameObjects.Rectangle;
  private barWidth = 400;
  private barX = 0;
  private barY = 0;
  private speed = 0;
  private direction = 1;
  private indicatorPos = 0;
  private rarityRank = 0;
  private completed = false;
  private moveDef!: MoveDef;

  constructor() { super('TimingBarScene'); }

  init(data: TimingData) {
    this.rarityRank = data.rarityRank ?? 0;
    this.moveDef = data.moveDef;
    this.completed = false;
  }

  create() {
    const { width, height } = this.scale;
    this.barX = width / 2 - this.barWidth / 2;
    this.barY = height / 2;

    // Semi-transparent overlay
    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.75);

    // Title
    this.add.text(width / 2, height / 2 - 120, this.moveDef.name, {
      fontSize: '28px', color: '#ffd700', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.add.text(width / 2, height / 2 - 80, 'Press SPACE or click when the bar is in the green zone!', {
      fontSize: '14px', color: '#aaaaaa',
    }).setOrigin(0.5);

    // Bar background
    this.add.rectangle(width / 2, this.barY, this.barWidth + 8, 36, 0x333333)
      .setStrokeStyle(2, 0x888888);

    // Red zone (whole bar)
    this.add.rectangle(width / 2, this.barY, this.barWidth, 28, 0xcc2222);

    // Green zone (shrinks with rarity)
    const greenW = Math.max(30, 80 - this.rarityRank * 8);
    this.greenZone = this.add.rectangle(width / 2, this.barY, greenW, 28, 0x22cc22);

    // Indicator
    this.indicator = this.add.rectangle(this.barX, this.barY, 8, 36, 0xffffff)
      .setOrigin(0, 0.5);
    this.indicatorPos = 0;
    this.speed = 200 + this.rarityRank * 40; // pixels per second

    // Instruction text
    const spaceText = this.add.text(width / 2, this.barY + 60, 'SPACE / Click', {
      fontSize: '18px', color: '#ffffff',
    }).setOrigin(0.5);

    // Input handlers
    this.input.keyboard?.once('keydown-SPACE', () => this.submitResult());
    this.input.once('pointerdown', () => this.submitResult());
  }

  update(_: number, delta: number) {
    if (this.completed) return;
    this.indicatorPos += this.speed * this.direction * (delta / 1000);
    if (this.indicatorPos >= this.barWidth) { this.indicatorPos = this.barWidth; this.direction = -1; }
    if (this.indicatorPos <= 0) { this.indicatorPos = 0; this.direction = 1; }
    this.indicator.x = this.barX + this.indicatorPos;
  }

  private submitResult() {
    if (this.completed) return;
    this.completed = true;

    const { width, height } = this.scale;
    const greenW = Math.max(30, 80 - this.rarityRank * 8);
    const greenLeft = width / 2 - greenW / 2 - this.barX;
    const greenRight = width / 2 + greenW / 2 - this.barX;

    let score = 0;
    if (this.indicatorPos >= greenLeft && this.indicatorPos <= greenRight) {
      const center = (greenLeft + greenRight) / 2;
      const distFromCenter = Math.abs(this.indicatorPos - center);
      score = 100 - (distFromCenter / (greenW / 2)) * 30; // 70–100% in green
    } else {
      const distFromBar = Math.min(
        Math.abs(this.indicatorPos - greenLeft),
        Math.abs(this.indicatorPos - greenRight)
      );
      score = Math.max(0, 60 - (distFromBar / (this.barWidth / 2)) * 60);
    }

    const scoreColor = score >= 80 ? '#44ff44' : score >= 50 ? '#ffaa00' : '#ff4444';
    const label = score >= 90 ? 'PERFECT!' : score >= 70 ? 'GREAT!' : score >= 40 ? 'OK' : 'MISS!';
    this.add.text(width / 2, height / 2 + 100, `${label} (${Math.floor(score)}%)`, {
      fontSize: '24px', color: scoreColor, fontStyle: 'bold',
    }).setOrigin(0.5);

    this.time.delayedCall(700, () => {
      EventBus.emit(GameEvents.MINIGAME_COMPLETE, { score: Math.floor(score) });
      this.scene.stop();
    });
  }
}
