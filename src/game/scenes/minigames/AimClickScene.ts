import Phaser from 'phaser';
import { EventBus, GameEvents } from '@game/EventBus';
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
    const { width, height } = this.scale;

    this.timeLimit = Math.max(600, 2000 - this.rarityRank * 200);
    this.initialRadius = Math.max(25, 80 - this.rarityRank * 5);
    this.currentRadius = this.initialRadius;

    // Overlay
    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.75);

    // Title
    this.add.text(width / 2, 80, this.moveDef.name, {
      fontSize: '28px', color: '#ffd700', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.add.text(width / 2, 120, 'Click the target before it disappears!', {
      fontSize: '14px', color: '#aaaaaa',
    }).setOrigin(0.5);

    // Random target position
    const margin = 120;
    this.targetX = Phaser.Math.Between(margin, width - margin);
    this.targetY = Phaser.Math.Between(200, height - 200);

    // Outer glow ring
    this.add.arc(this.targetX, this.targetY, this.initialRadius + 10, 0, 360, false, 0xff4444, 0.3);

    // Target
    this.targetCircle = this.add.arc(this.targetX, this.targetY, this.currentRadius, 0, 360, false, 0xff2222);
    this.targetCircle.setStrokeStyle(3, 0xff8888);

    // Crosshair
    this.add.line(0, 0, this.targetX - 20, this.targetY, this.targetX + 20, this.targetY, 0xffffff, 0.5);
    this.add.line(0, 0, this.targetX, this.targetY - 20, this.targetX, this.targetY + 20, 0xffffff, 0.5);

    this.startTime = this.time.now;

    // Brief "get ready" delay so the same tap that launched this minigame
    // doesn't instantly register as a click (which made it impossible).
    const ready = this.add.text(width / 2, 160, 'Gleich geht\'s los…', {
      fontSize: '16px', color: '#ffdd55',
    }).setOrigin(0.5);
    this.time.delayedCall(400, () => {
      this.armed = true;
      this.startTime = this.time.now; // start the shrink clock only now
      ready.destroy();
    });

    // Click anywhere to try
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!this.armed || this.completed) return;
      const dist = Phaser.Math.Distance.Between(p.x, p.y, this.targetX, this.targetY);
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
    this.currentRadius = Math.max(5, this.initialRadius * ratio);
    this.targetCircle.setRadius(this.currentRadius);

    if (elapsed >= this.timeLimit) {
      this.onMiss();
    }
  }

  private onHit(dist: number) {
    if (this.completed) return;
    this.completed = true;
    const { width, height } = this.scale;
    const ratio = this.currentRadius / this.initialRadius;
    const score = Math.floor(40 + ratio * 60); // 40–100

    const label = score >= 90 ? 'PERFECT!' : score >= 70 ? 'GREAT!' : 'HIT!';
    const scoreColor = score >= 80 ? '#44ff44' : '#ffaa00';
    this.add.text(width / 2, height / 2, `${label} (${score}%)`, {
      fontSize: '32px', color: scoreColor, fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5);

    this.time.delayedCall(700, () => {
      EventBus.emit(GameEvents.MINIGAME_COMPLETE, { score });
      this.scene.stop();
    });
  }

  private onMiss() {
    if (this.completed) return;
    this.completed = true;
    const { width, height } = this.scale;
    this.add.text(width / 2, height / 2, 'MISS! (0%)', {
      fontSize: '32px', color: '#ff2222', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.time.delayedCall(700, () => {
      EventBus.emit(GameEvents.MINIGAME_COMPLETE, { score: 0 });
      this.scene.stop();
    });
  }
}
