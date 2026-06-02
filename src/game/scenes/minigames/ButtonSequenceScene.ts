import Phaser from 'phaser';
import { EventBus, GameEvents } from '@game/EventBus';
import { setupFixedViewport, DESIGN_W, DESIGN_H } from '@game/scenes/viewport';
import { addDim, addMinigameHeader, addResultBanner } from '@game/scenes/minigames/minigameUi';
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
    const width = DESIGN_W, height = DESIGN_H;
    this.sequenceLength = Math.min(8, 3 + this.rarityRank);

    // Generate random sequence
    this.sequence = Array.from({ length: this.sequenceLength }, () =>
      KEYS[Math.floor(Math.random() * KEYS.length)]
    );

    // Fit to the live viewport (re-fits on orientation flip). Oversized overlay
    // so the dim covers any letterbox margin around the design space.
    setupFixedViewport(this);
    addDim(this);

    addMinigameHeader(this, this.moveDef.name, 'Merke dir die Reihenfolge und tippe sie nach!');

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
    const width = DESIGN_W, height = DESIGN_H;
    // Large tiles with rounded corners so the sequence is easy to read at a
    // glance and from across a hand-held screen.
    const keySize = 92;
    const spacing = 18;
    const totalW = this.sequenceLength * (keySize + spacing) - spacing;
    const startX = width / 2 - totalW / 2 + keySize / 2;
    const y = height / 2 - 20;

    this.sequence.forEach((key, i) => {
      const x = startX + i * (keySize + spacing);
      const bg = this.add.rectangle(x, y, keySize, keySize, KEY_COLORS[key] ?? 0x888888)
        .setStrokeStyle(4, 0xffffff);
      const txt = this.add.text(x, y, key, {
        fontSize: '46px', color: '#ffffff', fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 4,
      }).setOrigin(0.5);
      const container = this.add.container(0, 0, [bg, txt]);
      this.keyDisplays.push(container);
    });
  }

  private hideSequence() {
    // Fully hide the sequence — no faint letters lingering in the background
    // while the player is typing it back.
    for (const c of this.keyDisplays) c.setAlpha(0);
  }

  private showInputPhase() {
    const width = DESIGN_W, height = DESIGN_H;

    this.add.text(width / 2, height / 2 + 84, 'Tippe jetzt die Reihenfolge!', {
      fontSize: '26px', color: '#ffffff', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5);

    // Show current position indicator
    const keySize = 92;
    const spacing = 18;
    const totalW = this.sequenceLength * (keySize + spacing) - spacing;
    const startX = width / 2 - totalW / 2 + keySize / 2;
    const y = height / 2 + 134;

    this.sequence.forEach((_, i) => {
      const x = startX + i * (keySize + spacing);
      const ind = this.add.rectangle(x, y, keySize, 18, 0x333333)
        .setStrokeStyle(2, 0x666666);
      this.inputIndicators.push(ind);
    });

    // Keyboard listeners
    for (const key of KEYS) {
      this.input.keyboard?.on(`keydown-${key}`, () => this.onKeyPress(key));
    }

    // On-screen touch buttons (always shown — works on both touch and desktop).
    // Big, well-spaced finger targets along the bottom of the landscape screen.
    const btnSize = 116;
    const btnSpacing = 28;
    const btnY = height - 96;
    const totalBtnW = KEYS.length * (btnSize + btnSpacing) - btnSpacing;
    const btnStartX = width / 2 - totalBtnW / 2 + btnSize / 2;

    KEYS.forEach((key, i) => {
      const bx = btnStartX + i * (btnSize + btnSpacing);
      const bg = this.add.rectangle(bx, btnY, btnSize, btnSize, KEY_COLORS[key] ?? 0x888888)
        .setStrokeStyle(4, 0xffffff)
        .setInteractive({ useHandCursor: true });
      this.add.text(bx, btnY, key, {
        fontSize: '48px', color: '#ffffff', fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 4,
      }).setOrigin(0.5).setDepth(1);

      bg.on('pointerdown', () => {
        this.onKeyPress(key);
        // Quick press feedback so taps feel responsive.
        bg.setScale(0.92);
        this.tweens.add({ targets: bg, scale: 1, duration: 90 });
      });
      bg.on('pointerover', () => bg.setFillStyle(0xffffff, 0.3));
      bg.on('pointerout', () => bg.setFillStyle(KEY_COLORS[key] ?? 0x888888));
    });
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

    const width = DESIGN_W, height = DESIGN_H;
    const label = score >= 90 ? 'PERFECT!' : score >= 70 ? 'GREAT!' : score >= 40 ? 'OK' : 'MISS!';
    const color = score >= 80 ? '#5dff5d' : score >= 50 ? '#ffc23d' : '#ff5a5a';

    addResultBanner(this, width / 2, height / 2 - 130, `${label} (${score}%)`, color);

    for (const key of KEYS) {
      this.input.keyboard?.removeAllListeners(`keydown-${key}`);
    }

    this.time.delayedCall(800, () => {
      EventBus.emit(GameEvents.MINIGAME_COMPLETE, { score });
      this.scene.stop();
    });
  }
}
