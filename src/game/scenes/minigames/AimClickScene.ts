import Phaser from 'phaser';
import { EventBus, GameEvents } from '@game/EventBus';
import { setupFixedViewport, DESIGN_W, DESIGN_H } from '@game/scenes/viewport';
import { addDim, addMinigameHeader, addReadyPrompt, addResultBanner } from '@game/scenes/minigames/minigameUi';
import type { MoveDef } from '@gtypes/game';

interface AimData {
  moveDef: MoveDef;
  rarityRank: number;
}

export class AimClickScene extends Phaser.Scene {
  private targetCircle!: Phaser.GameObjects.Arc;
  private timeLimit = 2000;
  private startTime = 0;
  private initialRadius = 80;
  private currentRadius = 80;
  private targetX = 0;
  private targetY = 0;
  private completed = false;
  private armed = false;
  private moveDef!: MoveDef;
  private rarityRank = 0;

  constructor() { super('AimClickScene'); }

  init(data: AimData) {
    this.rarityRank = data.rarityRank ?? 0;
    this.moveDef = data.moveDef;
    this.completed = false;
    this.armed = false;
  }

  create() {
    const width = DESIGN_W, height = DESIGN_H;

    this.timeLimit = Math.max(600, 2000 - this.rarityRank * 200);
    // Larger base target with a higher minimum floor so it stays comfortably
    // tappable with a fingertip even on a small phone held in landscape.
    this.initialRadius = Math.max(60, 130 - this.rarityRank * 8);
    this.currentRadius = this.initialRadius;

    // Fit to the live viewport (re-fits on orientation flip). Oversized overlay
    // so the dim covers any letterbox margin around the design space.
    setupFixedViewport(this);
    addDim(this);

    addMinigameHeader(this, this.moveDef.name, 'Tippe das Ziel bevor es verschwindet!');

    // Random target position. Keep clear of the header band and the screen
    // edges so the whole (large) circle stays comfortably in reach.
    const margin = 180;
    this.targetX = Phaser.Math.Between(margin, width - margin);
    this.targetY = Phaser.Math.Between(230, height - 160);

    // Outer glow ring
    this.add.arc(this.targetX, this.targetY, this.initialRadius + 16, 0, 360, false, 0xff5555, 0.25);

    // Target
    this.targetCircle = this.add.arc(this.targetX, this.targetY, this.currentRadius, 0, 360, false, 0xff2a2a);
    this.targetCircle.setStrokeStyle(6, 0xffd0d0);

    // Crosshair — larger and brighter so the centre is easy to read.
    this.add.line(0, 0, this.targetX - 34, this.targetY, this.targetX + 34, this.targetY, 0xffffff, 0.85).setLineWidth(3);
    this.add.line(0, 0, this.targetX, this.targetY - 34, this.targetX, this.targetY + 34, 0xffffff, 0.85).setLineWidth(3);
    this.add.circle(this.targetX, this.targetY, 6, 0xffffff, 0.9);

    this.startTime = this.time.now;

    // Brief "get ready" delay so the same tap that launched this minigame
    // doesn't instantly register as a click (which made it impossible).
    const ready = addReadyPrompt(this, width / 2, 168, 'Gleich geht\'s los…');
    this.time.delayedCall(400, () => {
      this.armed = true;
      this.startTime = this.time.now; // start the shrink clock only now
      ready.destroy();
    });

    // Click anywhere to try
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!this.armed || this.completed) return;
      // The camera is zoomed/letterboxed to fit, so convert the screen-space
      // pointer into design-space world coordinates before hit-testing.
      const wp = this.cameras.main.getWorldPoint(p.x, p.y);
      const dist = Phaser.Math.Distance.Between(wp.x, wp.y, this.targetX, this.targetY);
      if (dist <= this.currentRadius) {
        this.onHit(dist);
      } else {
        this.onMiss();
      }
    });
  }

  update() {
    if (this.completed || !this.armed) return;
    const elapsed = this.time.now - this.startTime;
    const ratio = 1 - elapsed / this.timeLimit;
    // Keep a generous minimum radius so the target never shrinks below a
    // finger-sized tap target before time runs out.
    this.currentRadius = Math.max(34, this.initialRadius * ratio);
    this.targetCircle.setRadius(this.currentRadius);

    if (elapsed >= this.timeLimit) {
      this.onMiss();
    }
  }

  private onHit(dist: number) {
    if (this.completed) return;
    this.completed = true;
    const width = DESIGN_W, height = DESIGN_H;
    const ratio = this.currentRadius / this.initialRadius;
    const score = Math.floor(40 + ratio * 60); // 40–100

    const label = score >= 90 ? 'PERFECT!' : score >= 70 ? 'GREAT!' : 'HIT!';
    const scoreColor = score >= 80 ? '#5dff5d' : '#ffc23d';
    addResultBanner(this, width / 2, height / 2, `${label} (${score}%)`, scoreColor);

    this.time.delayedCall(700, () => {
      EventBus.emit(GameEvents.MINIGAME_COMPLETE, { score });
      this.scene.stop();
    });
  }

  private onMiss() {
    if (this.completed) return;
    this.completed = true;
    const width = DESIGN_W, height = DESIGN_H;
    addResultBanner(this, width / 2, height / 2, 'MISS! (0%)', '#ff5a5a');
    this.time.delayedCall(700, () => {
      EventBus.emit(GameEvents.MINIGAME_COMPLETE, { score: 0 });
      this.scene.stop();
    });
  }
}
