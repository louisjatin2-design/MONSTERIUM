import Phaser from 'phaser';
import { EventBus, GameEvents } from '@game/EventBus';
import { setupFixedViewport, DESIGN_W, DESIGN_H } from '@game/scenes/viewport';
import { addDim, addMinigameHeader, addResultBanner, MG_HINT_SIZE } from '@game/scenes/minigames/minigameUi';
import type { MoveDef } from '@gtypes/game';

// ── Gruppe 3 — Rhythm-Minigame ──────────────────────────────────────────────
// Noten fallen in mehreren Spuren von oben; der Spieler tippt die Spur (oder
// A/S/D/F), wenn die Note die Trefferlinie erreicht. Gutes Timing gibt mehr
// Punkte → mehr Schaden (und bei Sound-Attacken zusätzlich Energie-Reload, das
// regelt die Battle-Szene). Erfolgsquote/Genauigkeit ergeben den Score 0–100.
interface RhythmData { moveDef: MoveDef; rarityRank: number; }
interface Note { lane: number; y: number; sprite: Phaser.GameObjects.Rectangle; resolved: boolean; }

const LANES = 4;
const LANE_KEYS = ['A', 'S', 'D', 'F'];

export class RhythmScene extends Phaser.Scene {
  private moveDef!: MoveDef;
  private rarityRank = 0;
  private notes: Note[] = [];
  private laneX: number[] = [];
  private hitY = 0;
  private speed = 0;
  private spawnQueue: { lane: number; t: number }[] = [];
  private elapsed = 0;
  private totalNotes = 0;
  private scores: number[] = [];
  private finished = false;

  constructor() { super('RhythmScene'); }

  init(data: RhythmData) {
    this.moveDef = data.moveDef;
    this.rarityRank = data.rarityRank ?? 0;
    this.notes = [];
    this.spawnQueue = [];
    this.scores = [];
    this.elapsed = 0;
    this.finished = false;
  }

  create() {
    const width = DESIGN_W, height = DESIGN_H;
    setupFixedViewport(this);
    addDim(this);
    addMinigameHeader(this, this.moveDef.name, 'Tippe die Spur (oder A/S/D/F), wenn die Note die Linie trifft!');

    this.hitY = height - 130;
    this.speed = 300 + this.rarityRank * 30;
    const laneW = 150;
    const startX = width / 2 - ((LANES - 1) * laneW) / 2;
    this.laneX = Array.from({ length: LANES }, (_, i) => startX + i * laneW);

    // Spuren + Trefferpads.
    for (let i = 0; i < LANES; i++) {
      this.add.rectangle(this.laneX[i], height / 2, laneW - 12, height, 0x10131f, 0.5).setStrokeStyle(1, 0x2a3346);
      const pad = this.add.rectangle(this.laneX[i], this.hitY, laneW - 16, 26, 0x33304a)
        .setStrokeStyle(3, 0xb98cff).setInteractive({ useHandCursor: true });
      this.add.text(this.laneX[i], this.hitY + 34, LANE_KEYS[i], {
        fontSize: `${MG_HINT_SIZE}px`, color: '#9fb0c2', fontStyle: 'bold',
      }).setOrigin(0.5);
      pad.on('pointerdown', () => this.tapLane(i));
    }
    // Trefferlinie.
    this.add.rectangle(width / 2, this.hitY, LANES * laneW, 4, 0xffd700, 0.85);

    // Noten-Zeitplan: mehr Noten bei höherer Seltenheit.
    this.totalNotes = 8 + this.rarityRank * 2;
    let t = 600;
    for (let i = 0; i < this.totalNotes; i++) {
      this.spawnQueue.push({ lane: Math.floor(Math.random() * LANES), t });
      t += 520 - this.rarityRank * 18; // engere Abstände bei mehr Seltenheit
    }

    LANE_KEYS.forEach((k, i) => {
      this.input.keyboard?.on(`keydown-${k}`, () => this.tapLane(i));
    });
  }

  update(_: number, delta: number) {
    if (this.finished) return;
    this.elapsed += delta;

    // Fällige Noten spawnen.
    while (this.spawnQueue.length && this.elapsed >= this.spawnQueue[0].t) {
      const { lane } = this.spawnQueue.shift()!;
      const sprite = this.add.rectangle(this.laneX[lane], -20, 110, 26, 0x6bd1ff).setStrokeStyle(2, 0xeaffff);
      this.notes.push({ lane, y: -20, sprite, resolved: false });
    }

    // Noten fallen lassen; verpasste (unter der Linie) zählen als Miss.
    for (const n of this.notes) {
      if (n.resolved) continue;
      n.y += this.speed * (delta / 1000);
      n.sprite.y = n.y;
      if (n.y > this.hitY + 60) {
        n.resolved = true;
        n.sprite.setFillStyle(0x553344);
        this.scores.push(0);
        this.tweens.add({ targets: n.sprite, alpha: 0, duration: 200, onComplete: () => n.sprite.destroy() });
      }
    }

    if (this.scores.length >= this.totalNotes) this.finish();
  }

  private tapLane(lane: number) {
    if (this.finished) return;
    // Nächste unaufgelöste Note dieser Spur nahe der Trefferlinie.
    let best: Note | null = null;
    let bestDist = Infinity;
    for (const n of this.notes) {
      if (n.resolved || n.lane !== lane) continue;
      const d = Math.abs(n.y - this.hitY);
      if (d < bestDist) { bestDist = d; best = n; }
    }
    if (!best || bestDist > 70) return; // kein Treffer im Fenster
    best.resolved = true;
    const score = Math.max(0, 100 - (bestDist / 70) * 60); // 40–100 im Fenster
    this.scores.push(score);
    best.sprite.setFillStyle(score >= 80 ? 0x5dff5d : 0xffc23d);
    this.tweens.add({ targets: best.sprite, scaleX: 1.4, scaleY: 1.4, alpha: 0, duration: 200, onComplete: () => best!.sprite.destroy() });
    if (this.scores.length >= this.totalNotes) this.finish();
  }

  private finish() {
    if (this.finished) return;
    this.finished = true;
    const avg = this.scores.length ? this.scores.reduce((a, b) => a + b, 0) / this.scores.length : 0;
    const score = Math.floor(avg);
    const color = score >= 80 ? '#5dff5d' : score >= 50 ? '#ffc23d' : '#ff5a5a';
    const label = score >= 90 ? 'PERFEKT!' : score >= 70 ? 'GROSSARTIG!' : score >= 40 ? 'OK' : 'DANEBEN!';
    addResultBanner(this, DESIGN_W / 2, DESIGN_H / 2 + 150, `${label} (${score}%)`, color);
    this.time.delayedCall(700, () => {
      EventBus.emit(GameEvents.MINIGAME_COMPLETE, { score });
      this.scene.stop();
    });
  }
}
