import Phaser from 'phaser';
import { EventBus, GameEvents } from '@game/EventBus';
import type { MoveDef } from '@gtypes/game';

interface SwipeData {
  moveDef: MoveDef;
  rarityRank: number;
}

// Drag the pointer through a sequence of nodes in order before time runs out.
// Score = nodes hit / total. Rarer moves add more nodes and shrink the window.
export class SwipePathScene extends Phaser.Scene {
  private moveDef!: MoveDef;
  private rarityRank = 0;
  private nodes: { x: number; y: number; hit: boolean; gfx: Phaser.GameObjects.Arc }[] = [];
  private nodeCount = 4;
  private nextIndex = 0;
  private completed = false;
  private armed = false;
  private timeLimitMs = 4000;
  private endTime = 0;
  private trail!: Phaser.GameObjects.Graphics;

  constructor() { super('SwipePathScene'); }

  init(data: SwipeData) {
    this.moveDef = data.moveDef;
    this.rarityRank = data.rarityRank ?? 0;
    this.nodes = [];
    this.nextIndex = 0;
    this.completed = false;
    this.armed = false;
  }

  create() {
    const { width, height } = this.scale;
    this.nodeCount = 4 + this.rarityRank;
    this.timeLimitMs = Math.max(2500, 5000 - this.rarityRank * 250);

    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.8);
    this.add.text(width / 2, 60, this.moveDef.name, {
      fontSize: '28px', color: '#ffd700', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.add.text(width / 2, 98, 'Ziehe der Reihe nach durch alle Knoten!', {
      fontSize: '14px', color: '#aaaaaa',
    }).setOrigin(0.5);

    this.trail = this.add.graphics();

    // Lay out nodes along a gentle wave.
    const marginX = 120;
    const usableW = width - marginX * 2;
    for (let i = 0; i < this.nodeCount; i++) {
      const t = this.nodeCount === 1 ? 0.5 : i / (this.nodeCount - 1);
      const x = marginX + usableW * t;
      const y = height / 2 + Math.sin(t * Math.PI * 2) * 80;
      const gfx = this.add.circle(x, y, 26, i === 0 ? 0x44cc44 : 0x445588)
        .setStrokeStyle(3, 0xffffff);
      this.add.text(x, y, String(i + 1), { fontSize: '16px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);
      this.nodes.push({ x, y, hit: false, gfx });
    }

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.armed || this.completed || !p.isDown) return;
      this.checkNode(p.x, p.y);
    });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!this.armed || this.completed) return;
      this.checkNode(p.x, p.y);
    });

    const ready = this.add.text(width / 2, height - 70, 'Bereit…', {
      fontSize: '16px', color: '#ffdd55',
    }).setOrigin(0.5);
    this.time.delayedCall(400, () => {
      this.armed = true;
      this.endTime = this.time.now + this.timeLimitMs;
      ready.destroy();
    });
  }

  private checkNode(px: number, py: number) {
    const node = this.nodes[this.nextIndex];
    if (!node) return;
    if (Phaser.Math.Distance.Between(px, py, node.x, node.y) <= 30) {
      node.hit = true;
      node.gfx.setFillStyle(0x44ff44);
      this.nextIndex++;
      this.redrawTrail();
      if (this.nextIndex < this.nodes.length) {
        this.nodes[this.nextIndex].gfx.setFillStyle(0x66aa66);
      } else {
        this.finish();
      }
    }
  }

  private redrawTrail() {
    this.trail.clear();
    this.trail.lineStyle(4, 0x66ddff, 0.8);
    for (let i = 1; i < this.nextIndex; i++) {
      this.trail.lineBetween(this.nodes[i - 1].x, this.nodes[i - 1].y, this.nodes[i].x, this.nodes[i].y);
    }
  }

  update() {
    if (!this.armed || this.completed) return;
    if (this.time.now >= this.endTime) this.finish();
  }

  private finish() {
    if (this.completed) return;
    this.completed = true;
    const hits = this.nodes.filter(n => n.hit).length;
    const score = Math.floor((hits / this.nodes.length) * 100);
    const { width, height } = this.scale;
    const label = score >= 100 ? 'PERFECT!' : score >= 60 ? 'GREAT!' : score >= 30 ? 'OK' : 'MISS!';
    const color = score >= 80 ? '#44ff44' : score >= 40 ? '#ffaa00' : '#ff4444';
    this.add.text(width / 2, height - 60, `${label} (${score}%)`, {
      fontSize: '26px', color, fontStyle: 'bold',
    }).setOrigin(0.5);
    this.time.delayedCall(700, () => {
      EventBus.emit(GameEvents.MINIGAME_COMPLETE, { score });
      this.scene.stop();
    });
  }
}
