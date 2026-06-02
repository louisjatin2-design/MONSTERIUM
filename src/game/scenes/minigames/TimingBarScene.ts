import Phaser from 'phaser';
import { EventBus, GameEvents } from '@game/EventBus';
import { setupFixedViewport, DESIGN_W, DESIGN_H } from '@game/scenes/viewport';
import { addDim, addMinigameHeader, addResultBanner, MG_HINT_SIZE } from '@game/scenes/minigames/minigameUi';
import type { MoveDef } from '@gtypes/game';

interface TimingData {
  moveDef: MoveDef;
  rarityRank: number;
}

export class TimingBarScene extends Phaser.Scene {
  private indicator!: Phaser.GameObjects.Rectangle;
  private greenZone!: Phaser.GameObjects.Rectangle;
  // Wide bar so it fills the horizontal space on a landscape phone/iPad and the
  // moving indicator is easy to track.
  private barWidth = 820;
  private barX = 0;
  private barY = 0;
  private speed = 0;
  private direction = 1;
  private indicatorPos = 0;
  private rarityRank = 0;
  private completed = false;
  private armed = false;
  private moveDef!: MoveDef;

  constructor() { super('TimingBarScene'); }

  init(data: TimingData) {
    this.rarityRank = data.rarityRank ?? 0;
    this.moveDef = data.moveDef;
    this.completed = false;
    this.armed = false;
  }

  create() {
    const width = DESIGN_W, height = DESIGN_H;
    this.barX = width / 2 - this.barWidth / 2;
    this.barY = height / 2;

    // Fit to the live viewport (re-fits on orientation flip). Oversized overlay
    // so the dim covers any letterbox margin around the design space.
    setupFixedViewport(this);
    addDim(this);

    addMinigameHeader(this, this.moveDef.name, 'Tippe (oder SPACE) wenn der Balken in der grünen Zone ist!');

    // Bar background — tall and bordered so the moving indicator reads clearly.
    this.add.rectangle(width / 2, this.barY, this.barWidth + 12, 72, 0x222531)
      .setStrokeStyle(4, 0x8893aa);

    // Red zone (whole bar)
    this.add.rectangle(width / 2, this.barY, this.barWidth, 60, 0xc62b2b);

    // Green zone (shrinks with rarity) — keep a generous minimum so the timing
    // stays achievable on touch. Bright outline makes the goal obvious.
    const greenW = this.greenWidth();
    this.greenZone = this.add.rectangle(width / 2, this.barY, greenW, 60, 0x29cc4a)
      .setStrokeStyle(3, 0xbfffce);

    // Indicator — a thick bright bar that's easy to follow at speed.
    this.indicator = this.add.rectangle(this.barX, this.barY, 14, 84, 0xffffff)
      .setOrigin(0, 0.5)
      .setStrokeStyle(2, 0x223344);
    this.indicatorPos = 0;
    this.speed = 260 + this.rarityRank * 55; // pixels per second (scaled for the wider bar)

    // Instruction text
    const spaceText = this.add.text(width / 2, this.barY + 90, 'SPACE / Tippen', {
      fontSize: `${MG_HINT_SIZE}px`, color: '#ffffff', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5);

    // Brief arming delay so the launching tap isn't counted as the stop input.
    this.time.delayedCall(300, () => { this.armed = true; });

    // Input handlers
    this.input.keyboard?.once('keydown-SPACE', () => { if (this.armed) this.submitResult(); });
    this.input.on('pointerdown', () => { if (this.armed) this.submitResult(); });
  }

  // Green-zone width, scaled to the wider bar with a comfortable floor so the
  // timing window stays fair on touch even for rare moves.
  private greenWidth() {
    return Math.max(70, 150 - this.rarityRank * 14);
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

    const width = DESIGN_W, height = DESIGN_H;
    const greenW = this.greenWidth();
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

    const scoreColor = score >= 80 ? '#5dff5d' : score >= 50 ? '#ffc23d' : '#ff5a5a';
    const label = score >= 90 ? 'PERFECT!' : score >= 70 ? 'GREAT!' : score >= 40 ? 'OK' : 'MISS!';
    addResultBanner(this, width / 2, height / 2 + 150, `${label} (${Math.floor(score)}%)`, scoreColor);

    this.time.delayedCall(700, () => {
      EventBus.emit(GameEvents.MINIGAME_COMPLETE, { score: Math.floor(score) });
      this.scene.stop();
    });
  }
}
