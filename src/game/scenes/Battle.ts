import Phaser from 'phaser';
import { EventBus, GameEvents } from '@game/EventBus';
import { useGameStore } from '@store/gameStore';
import { MONSTER_DEFS } from '@data/monsters';
import { ATTACKS } from '@data/attacks';
import { RARITY_RANK, RARITY_HATCH_TIME_SEC } from '@data/rarities';
import { ELEMENT_CSS_COLORS, ELEMENT_COLORS } from '@data/elements';
import { TRAITS } from '@data/traits';
import {
  buildTurnQueue, calculateDamage, generateAiAttack,
  processStatusTick, buildCombatant, gainUltCharge,
} from '@systems/BattleSystem';
import type { BattleCombatant, MoveDef } from '@gtypes/game';

type BattleState = 'INTRO' | 'PLAYER_TURN' | 'MINIGAME_ACTIVE' | 'ULT_MINIGAME_1' | 'ULT_MINIGAME_2' | 'AI_TURN' | 'VICTORY' | 'DEFEAT';

interface BattleData {
  playerTeam: string[];   // instance IDs
  enemyTeam: string[];    // instance IDs or def IDs for story
  enemyLevels?: number[];
  isTutorial?: boolean;
  rewardGold?: number;
  rewardXp?: number;
  rewardDiamonds?: number;
  rewardMonsterDefId?: string;
  storyIndex?: number;    // index into STORY_BATTLES, if this is a story fight
}

export class Battle extends Phaser.Scene {
  private playerCombatants: BattleCombatant[] = [];
  private enemyCombatants: BattleCombatant[] = [];
  private state: BattleState = 'INTRO';
  private turnOrder: BattleCombatant[] = [];
  private turnIndex = 0;
  private selectedMoveId = '';
  private currentAttacker: BattleCombatant | null = null;
  private data_!: BattleData;

  // UI elements
  private hpBars: Map<string, { bar: Phaser.GameObjects.Rectangle; bg: Phaser.GameObjects.Rectangle }> = new Map();
  private ultBars: Map<string, { bar: Phaser.GameObjects.Rectangle; bg: Phaser.GameObjects.Rectangle }> = new Map();
  private ultReadyIcons: Map<string, Phaser.GameObjects.Text> = new Map();
  private nameLabels: Map<string, Phaser.GameObjects.Text> = new Map();
  private hpLabels: Map<string, Phaser.GameObjects.Text> = new Map();
  private statusLabels: Map<string, Phaser.GameObjects.Text> = new Map();
  private cardCenters: Map<string, { x: number; y: number }> = new Map();
  private attackButtons: Phaser.GameObjects.Container[] = [];
  private detailOverlay: Phaser.GameObjects.Container | null = null;
  private statusText!: Phaser.GameObjects.Text;
  private logText!: Phaser.GameObjects.Text;
  private ultScore1 = 0;

  // Target selection & attacker highlight
  private cardBgs: Map<string, Phaser.GameObjects.Rectangle> = new Map();
  private selectedTarget: BattleCombatant | null = null;
  private targetOverlayObjects: Phaser.GameObjects.GameObject[] = [];
  private attackerArrow: Phaser.GameObjects.Text | null = null;
  private attackerPulseTween: Phaser.Tweens.Tween | null = null;

  constructor() { super('Battle'); }

  init(data: BattleData) {
    this.data_ = data;
  }

  create() {
    const { width, height } = this.scale;

    // Themed battle arena background.
    this.drawBackground();

    // Title
    this.add.text(width / 2, 20, '⚔️ KAMPF', {
      fontSize: '24px', color: '#ffd700', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5, 0);

    // Build combatants
    const store = useGameStore.getState();

    this.playerCombatants = this.data_.playerTeam.slice(0, 3).map((id, i) => {
      const inst = store.monsters[id];
      if (!inst) return null;
      return buildCombatant(inst.instanceId, inst.defId, inst.level, inst.equippedMoveIds, true, inst.name);
    }).filter(Boolean) as BattleCombatant[];

    this.enemyCombatants = this.data_.enemyTeam.slice(0, 3).map((defId, i) => {
      const level = this.data_.enemyLevels?.[i] ?? 5;
      const def = MONSTER_DEFS[defId];
      if (!def) return null;
      return buildCombatant('enemy_' + i, defId, level, def.availableMoveIds.slice(0, 4), false, def.name);
    }).filter(Boolean) as BattleCombatant[];

    // Draw monster cards
    this.drawMonsterCards();

    // Status + log text
    this.statusText = this.add.text(width / 2, height - 120, '', {
      fontSize: '16px', color: '#ffffff',
    }).setOrigin(0.5);

    this.logText = this.add.text(10, height - 50, '', {
      fontSize: '12px', color: '#aaaaaa',
    });

    // ESC to flee
    this.input.keyboard?.on('keydown-ESC', () => this.endBattle(false));

    // Listen for minigame result
    EventBus.on(GameEvents.MINIGAME_COMPLETE, this.onMinigameResult, this);

    // Start after intro delay
    this.time.delayedCall(800, () => this.startRound());
  }

  private drawBackground() {
    const { width, height } = this.scale;
    const g = this.add.graphics();

    // Sky gradient (deep purple → dusky magenta).
    g.fillGradientStyle(0x1a0a3c, 0x1a0a3c, 0x3a1030, 0x3a1030, 1);
    g.fillRect(0, 0, width, height);

    // Arena floor band at the bottom.
    const floorY = height * 0.62;
    g.fillGradientStyle(0x2a1840, 0x2a1840, 0x140820, 0x140820, 1);
    g.fillRect(0, floorY, width, height - floorY);

    // Horizon glow line.
    g.lineStyle(3, 0x7744cc, 0.5);
    g.lineBetween(0, floorY, width, floorY);

    // A faint central divider between the two sides.
    g.lineStyle(2, 0xffffff, 0.06);
    g.lineBetween(width / 2, 70, width / 2, height - 90);

    // Scatter a few stars in the sky for atmosphere.
    g.fillStyle(0xffffff, 0.5);
    for (let i = 0; i < 40; i++) {
      const sx = Phaser.Math.Between(0, width);
      const sy = Phaser.Math.Between(0, floorY - 10);
      g.fillCircle(sx, sy, Phaser.Math.Between(1, 2));
    }
    g.setDepth(-10);
  }

  private drawMonsterCards() {
    const { width, height } = this.scale;
    const cardW = 156, cardH = 84;
    const margin = 16;
    const leftX = margin + cardW / 2;
    const rightX = width - margin - cardW / 2;
    const startY = 90;
    const gapY = cardH + 22;

    // Column headers
    this.add.text(leftX, startY - 26, '◀ DEINE MONSTER', {
      fontSize: '13px', color: '#66ff88', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.add.text(rightX, startY - 26, 'GEGNER ▶', {
      fontSize: '13px', color: '#ff7777', fontStyle: 'bold',
    }).setOrigin(0.5);

    // Player column (left)
    this.playerCombatants.forEach((c, i) => {
      this.drawCard(c, leftX, startY + i * gapY, cardW, cardH, true);
    });

    // Enemy column (right)
    this.enemyCombatants.forEach((c, i) => {
      this.drawCard(c, rightX, startY + i * gapY, cardW, cardH, false);
    });
  }

  private drawCard(c: BattleCombatant, x: number, y: number, w: number, h: number, isPlayer: boolean) {
    const def = MONSTER_DEFS[c.defId];
    if (!def) return;

    this.cardCenters.set(c.instanceId, { x, y });

    const bg = this.add.rectangle(x, y, w, h, isPlayer ? 0x1c3a1c : 0x3a1c1c)
      .setStrokeStyle(2, isPlayer ? 0x44ff44 : 0xff4444)
      .setInteractive({ useHandCursor: true });
    this.cardBgs.set(c.instanceId, bg);
    // Tapping a card opens its detail view (level, stats, attacks).
    bg.on('pointerdown', () => this.showCombatantDetail(c));
    bg.on('pointerover', () => bg.setStrokeStyle(3, 0xffffff));
    bg.on('pointerout', () => bg.setStrokeStyle(2, isPlayer ? 0x44ff44 : 0xff4444));

    // Monster avatar — a coloured disc (element colour) with a creature glyph.
    const avX = x - w / 2 + 24;
    const avY = y - 6;
    const elColor = ELEMENT_COLORS[def.elements[0]] ?? 0x888888;
    this.add.circle(avX, avY, 20, elColor).setStrokeStyle(2, 0xffffff);
    this.add.text(avX, avY, '👾', { fontSize: '22px' }).setOrigin(0.5);

    const textLeft = x - w / 2 + 48;

    // Name + level
    const nameLabel = this.add.text(textLeft, y - h / 2 + 6, c.name, {
      fontSize: '12px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0, 0);
    this.nameLabels.set(c.instanceId, nameLabel);

    this.add.text(x + w / 2 - 6, y - h / 2 + 6, `Lv ${c.level}`, {
      fontSize: '11px', color: '#ffd700', fontStyle: 'bold',
    }).setOrigin(1, 0);

    // Trait
    const traitName = c.trait !== 'None' ? (TRAITS[c.trait]?.name ?? c.trait) : '';
    this.add.text(textLeft, y - h / 2 + 22, traitName ? `✦ ${traitName}` : '', {
      fontSize: '10px', color: '#bb99ff',
    }).setOrigin(0, 0);

    // Status effect icons (updated each turn).
    const statusLabel = this.add.text(textLeft, y + 2, '', {
      fontSize: '13px',
    }).setOrigin(0, 0.5);
    this.statusLabels.set(c.instanceId, statusLabel);

    // Info hint
    this.add.text(x + w / 2 - 6, y - 2, 'ℹ️', { fontSize: '11px' }).setOrigin(1, 0.5);

    // HP bar background
    const hpBarBg = this.add.rectangle(x, y + h / 2 - 20, w - 10, 12, 0x330000).setOrigin(0.5);
    // HP bar
    const hpBar = this.add.rectangle(x - (w - 10) / 2, y + h / 2 - 20, w - 10, 12, 0x44ff44).setOrigin(0, 0.5);
    this.hpBars.set(c.instanceId, { bar: hpBar, bg: hpBarBg });

    // HP text
    const hpLabel = this.add.text(x, y + h / 2 - 20, `${c.currentHp}/${c.maxHp}`, {
      fontSize: '10px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.hpLabels.set(c.instanceId, hpLabel);

    // Ult charge bar
    const ultBg = this.add.rectangle(x, y + h / 2 - 6, w - 10, 7, 0x332200).setOrigin(0.5);
    const ultBar = this.add.rectangle(x - (w - 10) / 2, y + h / 2 - 6, 0, 7, 0xffd700).setOrigin(0, 0.5);
    this.ultBars.set(c.instanceId, { bar: ultBar, bg: ultBg });
    // "⚡" ready icon (hidden until ult is full)
    const ultIcon = this.add.text(x, y + h / 2 - 6, '', {
      fontSize: '10px',
    }).setOrigin(0.5).setDepth(5);
    this.ultReadyIcons.set(c.instanceId, ultIcon);

    this.updateStatusDisplay(c);
  }

  // Map status effects to icons and refresh the on-card indicator.
  private updateStatusDisplay(c: BattleCombatant) {
    const label = this.statusLabels.get(c.instanceId);
    if (!label) return;
    const ICONS: Record<string, string> = {
      Burn: '🔥', Freeze: '🧊', Paralyze: '⚡', Poison: '☠️',
      Stun: '💫', Blind: '🌫️', DefDown: '🛡️', AtkDown: '⚔️',
    };
    const icons = c.statusEffects.map(e => ICONS[e.effect] ?? '•').join(' ');
    label.setText(icons);
  }

  private showCombatantDetail(c: BattleCombatant) {
    // Close any open detail first.
    this.detailOverlay?.destroy();
    this.detailOverlay = null;

    const { width, height } = this.scale;
    const def = MONSTER_DEFS[c.defId];
    if (!def) return;

    const panelW = 320, panelH = 360;
    const cx = width / 2, cy = height / 2;

    // Backdrop (tap to close)
    const backdrop = this.add.rectangle(cx, cy, width, height, 0x000000, 0.6)
      .setInteractive();
    backdrop.on('pointerdown', () => { this.detailOverlay?.destroy(); this.detailOverlay = null; });

    const panel = this.add.rectangle(cx, cy, panelW, panelH, 0x1e0a3c)
      .setStrokeStyle(2, 0x7744cc);

    const items: Phaser.GameObjects.GameObject[] = [backdrop, panel];
    let yy = cy - panelH / 2 + 16;

    items.push(this.add.text(cx, yy, `${c.name}`, {
      fontSize: '20px', color: '#ffd700', fontStyle: 'bold',
    }).setOrigin(0.5, 0));
    yy += 28;
    items.push(this.add.text(cx, yy, `Level ${c.level}  ·  ${def.elements.join(' / ')}  ·  ${def.rarity}`, {
      fontSize: '12px', color: '#bbbbbb',
    }).setOrigin(0.5, 0));
    yy += 26;

    // Stats at this level
    const statLines: Array<[string, number]> = [
      ['HP', c.maxHp], ['ATK', c.attackStat],
      ['DEF', c.defenseStat], ['SPD', c.speedStat],
    ];
    items.push(this.add.text(cx - panelW / 2 + 18, yy, 'Werte (auf diesem Level):', {
      fontSize: '12px', color: '#ffd700', fontStyle: 'bold',
    }).setOrigin(0, 0));
    yy += 20;
    for (const [label, val] of statLines) {
      items.push(this.add.text(cx - panelW / 2 + 24, yy, `${label}`, {
        fontSize: '12px', color: '#aaaaaa',
      }).setOrigin(0, 0));
      items.push(this.add.text(cx + panelW / 2 - 24, yy, `${val}`, {
        fontSize: '12px', color: '#ffffff', fontStyle: 'bold',
      }).setOrigin(1, 0));
      yy += 18;
    }
    yy += 8;

    // Attacks
    items.push(this.add.text(cx - panelW / 2 + 18, yy, 'Attacken:', {
      fontSize: '12px', color: '#ffd700', fontStyle: 'bold',
    }).setOrigin(0, 0));
    yy += 20;
    for (const moveId of c.equippedMoveIds) {
      const move = ATTACKS[moveId];
      if (!move) continue;
      items.push(this.add.text(cx - panelW / 2 + 24, yy, move.name, {
        fontSize: '12px', color: '#ffffff',
      }).setOrigin(0, 0));
      items.push(this.add.text(cx + panelW / 2 - 24, yy, `${move.element} · ${move.power}x`, {
        fontSize: '11px', color: '#aaccff',
      }).setOrigin(1, 0));
      yy += 18;
    }

    yy += 6;
    items.push(this.add.text(cx, cy + panelH / 2 - 18, 'Tippe irgendwo zum Schließen', {
      fontSize: '11px', color: '#888888',
    }).setOrigin(0.5));

    this.detailOverlay = this.add.container(0, 0, items).setDepth(1000);
  }

  private updateHpBar(c: BattleCombatant) {
    const bars = this.hpBars.get(c.instanceId);
    if (!bars) return;
    const ratio = Math.max(0, c.currentHp / c.maxHp);
    const barBg = bars.bg;
    bars.bar.width = (barBg.width) * ratio;
    const color = ratio > 0.5 ? 0x44ff44 : ratio > 0.25 ? 0xffaa00 : 0xff2200;
    bars.bar.setFillStyle(color);
    const hpLabel = this.hpLabels.get(c.instanceId);
    if (hpLabel) hpLabel.setText(`${Math.max(0, c.currentHp)}/${c.maxHp}`);
  }

  private updateUltBar(c: BattleCombatant) {
    const ub = this.ultBars.get(c.instanceId);
    if (!ub) return;
    const ratio = Math.min(1, c.ultCharge / 100);
    ub.bar.width = ub.bg.width * ratio;
    const ready = ratio >= 1;
    ub.bar.setFillStyle(ready ? 0xffffff : 0xffd700);
    const icon = this.ultReadyIcons.get(c.instanceId);
    if (icon) icon.setText(ready ? '⚡ ULTIMA BEREIT ⚡' : '');
  }

  private startRound() {
    const allCombatants = [...this.playerCombatants, ...this.enemyCombatants];
    this.turnOrder = buildTurnQueue(allCombatants);
    this.turnIndex = 0;
    this.logTurnOrder();
    this.nextTurn();
  }

  private logTurnOrder() {
    const names = this.turnOrder.map(c => c.name).join(' → ');
    this.log(`Reihenfolge: ${names}`);
  }

  private nextTurn() {
    // Apply status DOT before turn
    const checkVictory = () => {
      if (this.enemyCombatants.every(c => c.currentHp <= 0)) {
        this.time.delayedCall(600, () => this.endBattle(true));
        return true;
      }
      if (this.playerCombatants.every(c => c.currentHp <= 0)) {
        this.time.delayedCall(600, () => this.endBattle(false));
        return true;
      }
      return false;
    };

    if (checkVictory()) return;

    // Remove dead monsters from the remaining queue without rebuilding it
    // (full rebuild happens at meta-round boundary)
    const alive = [...this.playerCombatants, ...this.enemyCombatants].filter(c => c.currentHp > 0);
    this.turnOrder = this.turnOrder.filter(c => c.currentHp > 0);

    if (this.turnIndex >= this.turnOrder.length) {
      // New meta-round: tick DOT, rebuild speed-based queue
      this.turnIndex = 0;
      for (const c of alive) {
        const dot = processStatusTick(c);
        if (dot > 0) {
          c.currentHp = Math.max(0, c.currentHp - dot);
          this.updateHpBar(c);
          this.showDamageText(c.instanceId, dot, 0xff8800);
        }
        this.updateStatusDisplay(c);
      }
      if (checkVictory()) return;
      this.turnOrder = buildTurnQueue(alive);
      this.logTurnOrder();
    }

    this.currentAttacker = this.turnOrder[this.turnIndex];
    if (!this.currentAttacker || this.currentAttacker.currentHp <= 0) {
      this.turnIndex++;
      this.nextTurn();
      return;
    }

    this.highlightAttacker(this.currentAttacker);

    // Check if stunned/frozen
    const hasStun = this.currentAttacker.statusEffects.some(
      e => e.effect === 'Stun' || e.effect === 'Freeze'
    );
    if (hasStun) {
      this.log(`${this.currentAttacker.name} is unable to move!`);
      // Remove stun
      this.currentAttacker.statusEffects = this.currentAttacker.statusEffects.filter(
        e => e.effect !== 'Stun' && e.effect !== 'Freeze'
      );
      this.turnIndex++;
      this.time.delayedCall(600, () => this.nextTurn());
      return;
    }

    if (this.currentAttacker.isPlayer) {
      this.showAttackButtons(this.currentAttacker);
    } else {
      this.time.delayedCall(600, () => this.doAiTurn(this.currentAttacker!));
    }
  }

  private showAttackButtons(attacker: BattleCombatant) {
    this.clearAttackButtons();
    const { width, height } = this.scale;
    const def = MONSTER_DEFS[attacker.defId];
    const moves = attacker.equippedMoveIds;

    this.statusText.setText(`${attacker.name}'s turn — choose an attack:`);

    // ── ULTIMA button (only when fully charged) ──────────────────────────────
    if (attacker.ultCharge >= 100) {
      const ux = width / 2, uy = height - 116;
      const ubtn = this.add.rectangle(ux, uy, 280, 36, 0x664400)
        .setStrokeStyle(3, 0xffd700)
        .setInteractive({ useHandCursor: true });
      const utxt = this.add.text(ux, uy, '⚡  ULTIMA  ⚡  (2 Minigames!)', {
        fontSize: '14px', color: '#ffd700', fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5);
      const pulse = this.tweens.add({ targets: ubtn, alpha: { from: 1, to: 0.65 }, duration: 480, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      const uContainer = this.add.container(0, 0, [ubtn, utxt]);
      this.attackButtons.push(uContainer);
      ubtn.on('pointerdown', () => { pulse.stop(); ubtn.setAlpha(1); this.onUltSelected(attacker); });
      ubtn.on('pointerover', () => ubtn.setFillStyle(0x996600));
      ubtn.on('pointerout', () => ubtn.setFillStyle(0x664400));
    }

    moves.forEach((moveId, i) => {
      const moveDef = ATTACKS[moveId];
      if (!moveDef) return;
      const x = width / 2 - 180 + i * 120;
      const y = height - 70;

      const btn = this.add.rectangle(x, y, 100, 44, 0x334477)
        .setStrokeStyle(2, 0xaabbff)
        .setInteractive({ useHandCursor: true });

      const txt = this.add.text(x, y - 8, moveDef.name, {
        fontSize: '11px', color: '#ffffff', fontStyle: 'bold',
      }).setOrigin(0.5);
      const powerTxt = this.add.text(x, y + 8, `⚡${moveDef.power}x`, {
        fontSize: '10px', color: '#aaccff',
      }).setOrigin(0.5);

      const container = this.add.container(0, 0, [btn, txt, powerTxt]);
      this.attackButtons.push(container);

      btn.on('pointerdown', () => this.onMoveSelected(moveId, attacker));
      btn.on('pointerover', () => btn.setFillStyle(0x4455aa));
      btn.on('pointerout', () => btn.setFillStyle(0x334477));
    });
  }

  private clearAttackButtons() {
    for (const btn of this.attackButtons) btn.destroy();
    this.attackButtons = [];
    this.clearTargetOverlays();
  }

  private onUltSelected(attacker: BattleCombatant) {
    this.clearAttackButtons();
    this.showTargetSelection((target) => {
      this.selectedTarget = target;
      this.launchUltStep1(attacker);
    });
  }

  private launchUltStep1(attacker: BattleCombatant) {
    const def = MONSTER_DEFS[attacker.defId];
    const rarityRank = RARITY_RANK[def.rarity];
    const ultRank = Math.min(7, rarityRank + 1);
    const ultMoveDef = { id: 'ult_aim', name: '⚡ ULTIMA — ZIELERFASSUNG', element: def.elements[0], power: 2.5, minigameType: 'AimClick' as const, description: '' };

    this.state = 'ULT_MINIGAME_1';
    this.statusText.setText('⚡ ULTIMA — Schritt 1: Ziel erfassen!');
    this.scene.launch('AimClickScene', { moveDef: ultMoveDef, rarityRank: ultRank });
    this.scene.bringToTop('AimClickScene');
    this.scene.pause();
  }

  private onMoveSelected(moveId: string, attacker: BattleCombatant) {
    this.clearAttackButtons();
    this.selectedMoveId = moveId;
    const moveDef = ATTACKS[moveId];
    if (!moveDef) { this.turnIndex++; this.nextTurn(); return; }

    this.showTargetSelection((target) => {
      this.selectedTarget = target;
      this.launchAttackMinigame(attacker);
    });
  }

  private launchAttackMinigame(attacker: BattleCombatant) {
    const moveDef = ATTACKS[this.selectedMoveId];
    if (!moveDef) { this.turnIndex++; this.nextTurn(); return; }

    const def = MONSTER_DEFS[attacker.defId];
    const rarityRank = RARITY_RANK[def.rarity];

    this.state = 'MINIGAME_ACTIVE';
    this.statusText.setText(`Executing ${moveDef.name}...`);

    const sceneName = moveDef.minigameType === 'TimingBar' ? 'TimingBarScene' :
      moveDef.minigameType === 'AimClick' ? 'AimClickScene' : 'ButtonSequenceScene';
    this.scene.launch(sceneName, { moveDef, rarityRank });
    this.scene.bringToTop(sceneName);
    this.scene.pause();
  }

  private onMinigameResult = (data: { score: number }) => {
    this.scene.resume();

    if (!this.currentAttacker) { this.state = 'PLAYER_TURN'; this.turnIndex++; this.nextTurn(); return; }

    // ── Ult step 1 complete → launch step 2 ─────────────────────────────────
    if (this.state === 'ULT_MINIGAME_1') {
      this.ultScore1 = data.score;
      const def = MONSTER_DEFS[this.currentAttacker.defId];
      const rarityRank = RARITY_RANK[def.rarity];
      const ultRank = Math.min(7, rarityRank + 1);
      const ultMoveDef2 = { id: 'ult_seq', name: '⚡ ULTIMA — ENTFESSELN', element: def.elements[0], power: 2.5, minigameType: 'ButtonSequence' as const, description: '' };
      this.state = 'ULT_MINIGAME_2';
      this.statusText.setText('⚡ ULTIMA — Schritt 2: Kraft entfesseln!');
      this.scene.launch('ButtonSequenceScene', { moveDef: ultMoveDef2, rarityRank: ultRank });
      this.scene.bringToTop('ButtonSequenceScene');
      this.scene.pause();
      return;
    }

    // ── Ult step 2 complete → apply mega damage ──────────────────────────────
    if (this.state === 'ULT_MINIGAME_2') {
      this.state = 'PLAYER_TURN';
      this.applyUlt(this.currentAttacker, this.ultScore1, data.score);
      this.turnIndex++;
      this.time.delayedCall(1200, () => this.nextTurn());
      return;
    }

    // ── Normal attack ────────────────────────────────────────────────────────
    this.state = 'PLAYER_TURN';
    const moveDef = ATTACKS[this.selectedMoveId];
    if (!moveDef) { this.turnIndex++; this.nextTurn(); return; }

    // Use the player's chosen target (fall back to first alive enemy if needed)
    let target = (this.selectedTarget && this.selectedTarget.currentHp > 0)
      ? this.selectedTarget
      : this.enemyCombatants.find(c => c.currentHp > 0) ?? null;
    if (!target) { this.endBattle(true); return; }

    this.applyAttack(this.currentAttacker, target, moveDef, data.score);
    this.turnIndex++;
    this.time.delayedCall(800, () => this.nextTurn());
  };

  private doAiTurn(attacker: BattleCombatant) {
    // AI uses ult when charged (70% chance so it's not always predictable)
    if (attacker.ultCharge >= 100 && Math.random() < 0.7) {
      const aiScore1 = 50 + Math.random() * 40;
      const aiScore2 = 50 + Math.random() * 40;
      this.applyUlt(attacker, aiScore1, aiScore2);
      this.turnIndex++;
      this.time.delayedCall(900, () => this.nextTurn());
      return;
    }

    const { moveId, accuracy } = generateAiAttack(attacker.equippedMoveIds);
    const moveDef = ATTACKS[moveId];
    if (!moveDef) { this.turnIndex++; this.nextTurn(); return; }

    const players = this.playerCombatants.filter(c => c.currentHp > 0);
    if (players.length === 0) { this.endBattle(false); return; }
    const target = players[Math.floor(Math.random() * players.length)];

    this.applyAttack(attacker, target, moveDef, accuracy);
    this.turnIndex++;
    this.time.delayedCall(800, () => this.nextTurn());
  }

  private applyAttack(attacker: BattleCombatant, target: BattleCombatant, move: MoveDef, score: number) {
    // Check blind
    if (attacker.statusEffects.some(e => e.effect === 'Blind') && Math.random() < 0.3) {
      this.log(`${attacker.name} missed!`);
      return;
    }

    const attackerDef = MONSTER_DEFS[attacker.defId];
    const targetDef = MONSTER_DEFS[target.defId];

    let targetDef_ = target.defenseStat;
    if (target.statusEffects.some(e => e.effect === 'DefDown')) targetDef_ = Math.floor(targetDef_ * 0.75);

    const dmg = calculateDamage({
      attackerATK: attacker.attackStat,
      movePower: move.power,
      minigameScore: score,
      attackerElement: move.element,
      defenderElements: targetDef.elements as string[],
      defenderDEF: targetDef_,
      attackerTrait: attacker.trait,
      attackerStatuses: attacker.statusEffects,
      attackerCurrentHp: attacker.currentHp,
      attackerMaxHp: attacker.maxHp,
    });

    // Echo trait: hit twice at 60%
    let totalDmg = dmg;
    if (attacker.trait === 'Echo') {
      totalDmg = Math.floor(dmg * 0.6) * 2;
    }

    target.currentHp = Math.max(0, target.currentHp - totalDmg);
    this.updateHpBar(target);
    this.showDamageText(target.instanceId, totalDmg, attacker.isPlayer ? 0xffffff : 0xff4444);

    // Apply status effect
    if (move.statusEffect && score > move.statusEffect.threshold) {
      const applyEffect = !(target.trait === 'Fireproof' && move.statusEffect.effect === 'Burn');
      if (applyEffect) {
        // Mania: if target has Mania, buff instead of debuffing
        if (target.trait === 'Mania') {
          target.attackStat = Math.floor(target.attackStat * 3);
          target.defenseStat = Math.floor(target.defenseStat * 3);
          this.log(`${target.name} goes MANIC!`);
        } else {
          target.statusEffects.push({ effect: move.statusEffect.effect, remainingRounds: 3 });
          this.log(`${target.name} is affected by ${move.statusEffect.effect}!`);
        }
      }
    }

    this.updateStatusDisplay(target);
    this.log(`${attacker.name} → ${target.name}: ${move.name} for ${totalDmg} dmg (${Math.floor(score)}% acc)`);

    // Fill ult charge from damage dealt
    gainUltCharge(attacker, totalDmg);
    this.updateUltBar(attacker);

    // Reward XP to player monsters for dealing damage
    if (attacker.isPlayer) {
      const store = useGameStore.getState();
      const monsterInstance = store.monsters[attacker.instanceId];
      if (monsterInstance) {
        store.addXpToMonster(attacker.instanceId, Math.floor(totalDmg / 10));
      }
    }
  }

  private applyUlt(attacker: BattleCombatant, score1: number, score2: number) {
    let target: BattleCombatant | null = null;
    if (attacker.isPlayer) {
      // Use the player-chosen target if still alive, else first living enemy
      target = (this.selectedTarget && this.selectedTarget.currentHp > 0)
        ? this.selectedTarget
        : (this.enemyCombatants.find(c => c.currentHp > 0) ?? null);
    } else {
      const players = this.playerCombatants.filter(c => c.currentHp > 0);
      target = players[Math.floor(Math.random() * players.length)] ?? null;
    }
    if (!target) { attacker.isPlayer ? this.endBattle(true) : this.endBattle(false); return; }

    const def = MONSTER_DEFS[attacker.defId];
    const targetDef = MONSTER_DEFS[target.defId];
    let effectiveDef = target.defenseStat;
    if (target.statusEffects.some(e => e.effect === 'DefDown')) effectiveDef = Math.floor(effectiveDef * 0.75);

    const avgScore = (score1 + score2) / 2;
    const dmg = calculateDamage({
      attackerATK: attacker.attackStat,
      movePower: 2.5,
      minigameScore: avgScore,
      attackerElement: def.elements[0],
      defenderElements: targetDef.elements as string[],
      defenderDEF: effectiveDef,
      attackerTrait: attacker.trait,
      attackerStatuses: attacker.statusEffects,
      attackerCurrentHp: attacker.currentHp,
      attackerMaxHp: attacker.maxHp,
    });

    // Screen flash
    const { width, height } = this.scale;
    const flash = this.add.rectangle(width / 2, height / 2, width, height, 0xffd700, 0.55).setDepth(500);
    this.tweens.add({ targets: flash, alpha: 0, duration: 500, onComplete: () => flash.destroy() });

    // Big ULTIMA announcement over the attacker's card
    const src = this.cardCenters.get(attacker.instanceId);
    if (src) {
      const ultTxt = this.add.text(src.x, src.y - 20, '⚡ ULTIMA ⚡', {
        fontSize: '20px', color: '#ffd700', fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 5,
      }).setOrigin(0.5).setDepth(901);
      this.tweens.add({ targets: ultTxt, y: src.y - 60, alpha: 0, duration: 1400, ease: 'Quad.in', onComplete: () => ultTxt.destroy() });
    }

    target.currentHp = Math.max(0, target.currentHp - dmg);
    this.updateHpBar(target);
    // Gold damage number (larger than normal)
    const ctr = this.cardCenters.get(target.instanceId);
    if (ctr) {
      const txt = this.add.text(ctr.x, ctr.y - 8, `-${dmg}`, {
        fontSize: '38px', color: '#ffd700', fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 6,
      }).setOrigin(0.5).setDepth(900);
      txt.setScale(0.4);
      this.tweens.add({ targets: txt, scale: 1.4, duration: 180, yoyo: true, ease: 'Quad.out' });
      this.tweens.add({ targets: txt, y: ctr.y - 65, alpha: 0, duration: 1200, ease: 'Quad.in', onComplete: () => txt.destroy() });
    }

    // Reset charge
    attacker.ultCharge = 0;
    this.updateUltBar(attacker);

    this.log(`⚡ ${attacker.name} ULTIMA → ${target.name}: ${dmg} dmg! (${Math.floor(score1)}%+${Math.floor(score2)}%)`);

    if (attacker.isPlayer) {
      const store = useGameStore.getState();
      const inst = store.monsters[attacker.instanceId];
      if (inst) store.addXpToMonster(attacker.instanceId, Math.floor(dmg / 10));
    }
  }

  private highlightAttacker(c: BattleCombatant) {
    // Reset all card outlines to their default colour
    for (const [id, bg] of this.cardBgs) {
      const cmb = [...this.playerCombatants, ...this.enemyCombatants].find(x => x.instanceId === id);
      if (!cmb) continue;
      const alive = cmb.currentHp > 0;
      bg.setStrokeStyle(alive ? 2 : 1, alive ? (cmb.isPlayer ? 0x44ff44 : 0xff4444) : 0x444444);
    }
    // Remove previous indicator
    this.attackerPulseTween?.stop();
    this.attackerArrow?.destroy();
    this.attackerArrow = null;

    // Gold border on the active card
    this.cardBgs.get(c.instanceId)?.setStrokeStyle(4, 0xffd700);

    // Bouncing "AM ZUG" label just above the card
    const center = this.cardCenters.get(c.instanceId);
    if (!center) return;
    const arrowY = center.y - 56;
    this.attackerArrow = this.add.text(center.x, arrowY, '▼ AM ZUG ▼', {
      fontSize: '11px', color: '#ffd700', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(60);
    this.attackerPulseTween = this.tweens.add({
      targets: this.attackerArrow,
      y: arrowY + 4,
      duration: 350,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private showTargetSelection(callback: (target: BattleCombatant) => void) {
    this.clearTargetOverlays();
    const targets = this.enemyCombatants.filter(c => c.currentHp > 0);
    if (targets.length === 0) return;
    this.statusText.setText('🎯 Wähle ein Ziel!');

    for (const target of targets) {
      const center = this.cardCenters.get(target.instanceId);
      if (!center) continue;
      const cardW = 156, cardH = 84;
      const overlay = this.add.rectangle(center.x, center.y, cardW, cardH, 0xff2200, 0.3)
        .setStrokeStyle(3, 0xff6600)
        .setInteractive({ useHandCursor: true })
        .setDepth(100);
      const label = this.add.text(center.x, center.y, '🎯 ANGRIFF', {
        fontSize: '14px', color: '#ff8800', fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5).setDepth(101);

      overlay.on('pointerover', () => overlay.setFillStyle(0xff4400, 0.5));
      overlay.on('pointerout', () => overlay.setFillStyle(0xff2200, 0.3));
      overlay.on('pointerdown', () => {
        this.clearTargetOverlays();
        callback(target);
      });
      this.targetOverlayObjects.push(overlay, label);
    }
  }

  private clearTargetOverlays() {
    for (const obj of this.targetOverlayObjects) {
      (obj as { destroy(): void }).destroy();
    }
    this.targetOverlayObjects = [];
  }

  private showDamageText(instanceId: string, dmg: number, color: number) {
    const center = this.cardCenters.get(instanceId);
    if (!center) return;
    const x = center.x;
    const y = center.y - 8;
    const txt = this.add.text(x, y, `-${dmg}`, {
      fontSize: '32px',
      color: '#' + color.toString(16).padStart(6, '0'),
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 5,
    }).setOrigin(0.5).setDepth(900);
    // Pop-and-rise so the damage number is impossible to miss.
    txt.setScale(0.4);
    this.tweens.add({
      targets: txt,
      scale: 1.2,
      duration: 160,
      yoyo: true,
      ease: 'Quad.out',
    });
    this.tweens.add({
      targets: txt,
      y: y - 55,
      alpha: 0,
      duration: 1000,
      ease: 'Quad.in',
      onComplete: () => txt.destroy(),
    });
  }

  private log(msg: string) {
    const lines = this.logText.text.split('\n');
    lines.push(msg);
    if (lines.length > 3) lines.shift();
    this.logText.setText(lines.join('\n'));
  }

  private endBattle(victory: boolean) {
    this.clearAttackButtons();
    this.detailOverlay?.destroy();
    this.detailOverlay = null;
    EventBus.off(GameEvents.MINIGAME_COMPLETE, this.onMinigameResult, this);

    const { width, height } = this.scale;
    const resultColor = victory ? 0x226622 : 0x662222;
    const resultText = victory ? 'VICTORY!' : 'DEFEAT';

    this.add.rectangle(width / 2, height / 2, 400, 200, resultColor, 0.9)
      .setStrokeStyle(3, 0xffffff);
    this.add.text(width / 2, height / 2 - 40, resultText, {
      fontSize: '40px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);

    if (victory) {
      const store = useGameStore.getState();
      const rewardGold = this.data_.rewardGold ?? 200;
      const rewardXp = this.data_.rewardXp ?? 300;
      const rewardDiamonds = this.data_.rewardDiamonds ?? 0;
      store.addGold(rewardGold);
      store.addPlayerXp(rewardXp);
      store.addTrophies(20);
      if (rewardDiamonds > 0) store.addDiamonds(rewardDiamonds);

      // Advance the story if this was the next uncleared story battle.
      if (this.data_.storyIndex !== undefined && this.data_.storyIndex === store.storyProgress) {
        store.advanceStory();
      }

      const rewardMonsterDefId = this.data_.rewardMonsterDefId;
      if (rewardMonsterDefId && MONSTER_DEFS[rewardMonsterDefId]) {
        store.addEgg(rewardMonsterDefId, 30);
      }

      const rewardLine = `+${rewardGold} 🪙  +${rewardXp} XP`
        + (rewardDiamonds > 0 ? `  +${rewardDiamonds} 💎` : '');
      this.add.text(width / 2, height / 2 + 10, rewardLine, {
        fontSize: '20px', color: '#ffd700',
      }).setOrigin(0.5);
    }

    this.add.text(width / 2, height / 2 + 60, 'Click to continue', {
      fontSize: '16px', color: '#aaaaaa',
    }).setOrigin(0.5);

    this.input.once('pointerdown', () => {
      EventBus.emit(GameEvents.BATTLE_ENDED, { victory });
      this.scene.stop();
      this.scene.resume('Island');
    });
  }

  shutdown() {
    EventBus.off(GameEvents.MINIGAME_COMPLETE, this.onMinigameResult, this);
  }
}
