import Phaser from 'phaser';
import { EventBus, GameEvents } from '@game/EventBus';
import type { MoveDef } from '@gtypes/game';

interface SequenceData {
  moveDef: MoveDef;
  rarityRank: number;
}

const KEYS = ['W', 'A', 'S', 'D'];
const KEY_COLORS: Record<string, number> = { W: 0x4488ff, A: 0xff8844, S: 0x44cc44, D: 0xcc44cc };

export class ButtonSequenceScene extends Phaser.Scene {
  private sequence: string[] = [];
  private playerInput: string[] = [];
  private currentIndex = 0;
  private sequenceLength = 3;
  private completed = false;
  private showPhase = true;
  private keyDisplays: Phaser.GameObjects.Container[] = [];
  private inputIndicators: Phaser.GameObjects.Rectangle[] = [];
  private moveDef!: MoveDef;
  private rarityRank = 0;

  constructor() { super('ButtonSequenceScene'); }

  init(data: SequenceData) {
    this.rarityRank = data.rarityRank ?? 0;
    this.moveDef = data.moveDef;
    this.completed = false;
    this.playerInput = [];
    this.currentIndex = 0;
    this.keyDisplays = [];
    this.inputIndicators = [];
  }

  create() {
    const { width, height } = this.scale;
    this.sequenceLength = Math.min(8, 3 + this.rarityRank);

    // Generate random sequence
    this.sequence = Array.from({ length: this.sequenceLength }, () =>
      KEYS[Math.floor(Math.random() * KEYS.length)]
    );

    // Overlay
    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.8);

    // Title
    this.add.text(width / 2, 80, this.moveDef.name, {
      fontSize: '28px', color: '#ffd700', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.add.text(width / 2, 120, 'Memorize and repeat the sequence!', {
      fontSize: '14px', color: '#aaaaaa',
    }).setOrigin(0.5);

    // Draw sequence
    this.drawSequence();

    // Show phase: display for 2s, then hide and let player input
    const showDuration = Math.max(1000, 2500 - this.rarityRank * 200);
    this.time.delayedCall(showDuration, () => {
      this.showPhase = false;
      this.hideSequence();
      this.showInputPhase();
    });
  }

  private drawSequence() {
    const { width, height } = this.scale;
    const keySize = 56;
    const spacing = 10;
    const totalW = this.sequenceLength * (keySize + spacing) - spacing;
    const startX = width / 2 - totalW / 2 + keySize / 2;
    const y = height / 2 - 20;

    this.sequence.forEach((key, i) => {
      const x = startX + i * (keySize + spacing);
      const bg = this.add.rectangle(x, y, keySize, keySize, KEY_COLORS[key] ?? 0x888888)
        .setStrokeStyle(2, 0xffffff);
      const txt = this.add.text(x, y, key, {
        fontSize: '28px', color: '#ffffff', fontStyle: 'bold',
      }).setOrigin(0.5);
      const container = this.add.container(0, 0, [bg, txt]);
      this.keyDisplays.push(container);
    });
  }

  private hideSequence() {
    for (const c of this.keyDisplays) c.setAlpha(0.1);
  }

  private showInputPhase() {
    const { width, height } = this.scale;

    this.add.text(width / 2, height / 2 + 80, 'Now press the sequence!', {
      fontSize: '18px', color: '#ffffff',
    }).setOrigin(0.5);

    // Show current position indicator
    const keySize = 56;
    const spacing = 10;
    const totalW = this.sequenceLength * (keySize + spacing) - spacing;
    const startX = width / 2 - totalW / 2 + keySize / 2;
    const y = height / 2 + 130;

    this.sequence.forEach((_, i) => {
      const x = startX + i * (keySize + spacing);
      const ind = this.add.rectangle(x, y, keySize, 12, 0x333333)
        .setStrokeStyle(1, 0x666666);
      this.inputIndicators.push(ind);
    });

    // Keyboard listeners
    for (const key of KEYS) {
      this.input.keyboard?.on(`keydown-${key}`, () => this.onKeyPress(key));
    }
  }

  private onKeyPress(key: string) {
    if (this.completed || this.showPhase) return;
    if (this.currentIndex >= this.sequenceLength) return;

    const expected = this.sequence[this.currentIndex];
    const isCorrect = key === expected;

    // Light up indicator
    const indicator = this.inputIndicators[this.currentIndex];
    if (indicator) {
      indicator.setFillStyle(isCorrect ? 0x44ff44 : 0xff2222);
    }

    // Show key reveal
    const display = this.keyDisplays[this.currentIndex];
    if (display) display.setAlpha(isCorrect ? 1.0 : 0.5);

    this.currentIndex++;

    if (this.currentIndex >= this.sequenceLength) {
      this.finishSequence();
    }
  }

  private finishSequence() {
    if (this.completed) return;
    this.completed = true;

    const correct = this.inputIndicators.filter(ind => ind.fillColor === 0x44ff44).length;
    const score = Math.floor((correct / this.sequenceLength) * 100);

    const { width, height } = this.scale;
    const label = score >= 90 ? 'PERFECT!' : score >= 70 ? 'GREAT!' : score >= 40 ? 'OK' : 'MISS!';
    const color = score >= 80 ? '#44ff44' : score >= 50 ? '#ffaa00' : '#ff4444';

    this.add.text(width / 2, height / 2 + 180, `${label} (${score}%)`, {
      fontSize: '28px', color, fontStyle: 'bold',
    }).setOrigin(0.5);

    for (const key of KEYS) {
      this.input.keyboard?.removeAllListeners(`keydown-${key}`);
    }

    this.time.delayedCall(800, () => {
      EventBus.emit(GameEvents.MINIGAME_COMPLETE, { score });
      this.scene.stop();
    });
  }
}
