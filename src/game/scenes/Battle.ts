import Phaser from 'phaser';
import { EventBus, GameEvents } from '@game/EventBus';
import { useGameStore } from '@store/gameStore';
import { MONSTER_DEFS } from '@data/monsters';
import { ATTACKS } from '@data/attacks';
import { RARITY_RANK, RARITY_HATCH_TIME_SEC } from '@data/rarities';
import { ELEMENT_CSS_COLORS, ELEMENT_COLORS, getElementBonus } from '@data/elements';
import { MONSTER_EMOJI } from '@data/monsterEmoji';
import { TRAITS } from '@data/traits';
import { STATUS_EFFECTS } from '@data/statusEffects';
import {
  buildTurnQueue, calculateDamage, generateAiAttack,
  processStatusTick, buildCombatant, gainUltCharge, ultChargeCostFor,
  getMoveCooldown, tickMoveCooldowns, addStatusEffect,
  earlyCampaignDamageBonus, campaignRewardMultiplier,
} from '@systems/BattleSystem';
import { setupFixedViewport, DESIGN_W, DESIGN_H } from '@game/scenes/viewport';
import type { BattleCombatant, MoveDef, MinigameType } from '@gtypes/game';

// Which Phaser scene drives each minigame type.
const MINIGAME_SCENE_KEYS: Record<MinigameType, string> = {
  TimingBar: 'TimingBarScene',
  AimClick: 'AimClickScene',
  ButtonSequence: 'ButtonSequenceScene',
  MashButton: 'MashButtonScene',
  SwipePath: 'SwipePathScene',
};

type BattleState = 'INTRO' | 'PLAYER_TURN' | 'MINIGAME_ACTIVE' | 'ULT_MINIGAME_1' | 'ULT_MINIGAME_2' | 'AI_TURN' | 'VICTORY' | 'DEFEAT';

// Minigame score the Speed-Up auto-pilot uses when it executes an attack on the
// player's behalf. High enough to feel "effective" without being a guaranteed
// perfect hit, so manual play still rewards skill more.
const AUTO_BATTLE_SCORE = 90;

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
  // One container per combatant holding the coloured status-effect badges.
  private statusContainers: Map<string, Phaser.GameObjects.Container> = new Map();
  private cardCenters: Map<string, { x: number; y: number }> = new Map();
  // Per-combatant avatar container (glow + emoji) so we can animate lunges,
  // idle bobbing, hit recoil and faint effects.
  private avatars: Map<string, Phaser.GameObjects.Container> = new Map();
  private avatarHomes: Map<string, { x: number; y: number }> = new Map();
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

  // Tracks enemy moves used during battle for the post-victory learn offer
  private enemyUsedMoveIds: Set<string> = new Set();

  // Speed-Up auto-pilot: when on, the player's turns are resolved automatically
  // by picking the most effective attack/target. awaitingPlayerInput is true
  // while the attack buttons are on screen waiting for a tap.
  private autoBattle = false;
  private awaitingPlayerInput = false;
  private speedBtnBg: Phaser.GameObjects.Rectangle | null = null;
  private speedBtnLabel: Phaser.GameObjects.Text | null = null;

  constructor() { super('Battle'); }

  init(data: BattleData) {
    this.data_ = data;
  }

  create() {
    const width = DESIGN_W, height = DESIGN_H;

    // Lay the whole fight out in the fixed 1280×720 design space and fit it to
    // the screen, re-fitting on every orientation flip so cards / attack
    // buttons never end up stranded off-screen (which made fights impossible).
    // An opaque camera background fills any letterbox margin so the paused
    // Island scene behind us stays hidden.
    this.cameras.main.setBackgroundColor(0x1a0a3c);
    setupFixedViewport(this);

    // Themed battle arena background.
    this.drawBackground();

    // Title
    this.add.text(width / 2, 20, '⚔️ KAMPF', {
      fontSize: '24px', color: '#ffd700', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5, 0);

    // Speed-Up toggle (top-right): auto-pilots the player's turns by choosing
    // the most effective attack and target automatically.
    this.createSpeedButton(width);

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

    // Cinematic intro, then begin the first round.
    this.playIntro();
    this.time.delayedCall(1100, () => this.startRound());
  }

  // A short "VS" splash that slides in from both sides before combat begins.
  private playIntro() {
    const width = DESIGN_W, height = DESIGN_H;
    const cy = height / 2;

    const left = this.add.text(-200, cy, 'DEIN TEAM', {
      fontSize: '30px', color: '#66ff88', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(1200);
    const right = this.add.text(width + 200, cy, 'GEGNER', {
      fontSize: '30px', color: '#ff7777', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(1200);
    const vs = this.add.text(width / 2, cy, 'VS', {
      fontSize: '54px', color: '#ffd700', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 7,
    }).setOrigin(0.5).setDepth(1201).setScale(0);

    this.tweens.add({ targets: left, x: width / 2 - 110, duration: 400, ease: 'Back.out' });
    this.tweens.add({ targets: right, x: width / 2 + 110, duration: 400, ease: 'Back.out' });
    this.tweens.add({ targets: vs, scale: 1, duration: 350, delay: 250, ease: 'Back.out' });

    this.tweens.add({
      targets: [left, right, vs], alpha: 0, duration: 300, delay: 850, ease: 'Quad.in',
      onComplete: () => { left.destroy(); right.destroy(); vs.destroy(); },
    });
  }

  private drawBackground() {
    const width = DESIGN_W, height = DESIGN_H;
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

    // Twin arena spotlights fanning up from the floor for depth.
    g.fillStyle(0x8855ff, 0.06);
    g.fillTriangle(width * 0.25, floorY, width * 0.05, 70, width * 0.45, 70);
    g.fillStyle(0xff5588, 0.06);
    g.fillTriangle(width * 0.75, floorY, width * 0.55, 70, width * 0.95, 70);

    // Reflective sheen on the arena floor.
    g.fillStyle(0xffffff, 0.04);
    g.fillEllipse(width / 2, floorY + (height - floorY) * 0.35, width * 0.85, (height - floorY) * 0.5);

    // Scatter a few stars in the sky for atmosphere.
    g.fillStyle(0xffffff, 0.5);
    for (let i = 0; i < 40; i++) {
      const sx = Phaser.Math.Between(0, width);
      const sy = Phaser.Math.Between(0, floorY - 10);
      g.fillCircle(sx, sy, Phaser.Math.Between(1, 2));
    }
    g.setDepth(-10);

    // Slowly drifting glowing orbs add motion to an otherwise static backdrop.
    for (let i = 0; i < 7; i++) {
      const ox = Phaser.Math.Between(40, width - 40);
      const oy = Phaser.Math.Between(60, floorY - 20);
      const r = Phaser.Math.Between(20, 46);
      const tint = Phaser.Math.RND.pick([0x7744cc, 0xcc4488, 0x4466cc]);
      const orb = this.add.circle(ox, oy, r, tint, 0.12).setDepth(-9);
      this.tweens.add({
        targets: orb,
        y: oy - Phaser.Math.Between(20, 50),
        alpha: { from: 0.12, to: 0.04 },
        duration: Phaser.Math.Between(3000, 6000),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: i * 300,
      });
    }

    // Twinkling on a handful of the brighter stars.
    for (let i = 0; i < 14; i++) {
      const sx = Phaser.Math.Between(0, width);
      const sy = Phaser.Math.Between(0, floorY - 20);
      const star = this.add.circle(sx, sy, Phaser.Math.Between(1, 2), 0xffffff, 0.9).setDepth(-9);
      this.tweens.add({
        targets: star,
        alpha: { from: 0.9, to: 0.15 },
        duration: Phaser.Math.Between(900, 2200),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: Phaser.Math.Between(0, 1500),
      });
    }
  }

  private drawMonsterCards() {
    const width = DESIGN_W, height = DESIGN_H;
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

    // Monster avatar — a glowing element-coloured disc with the creature's emoji,
    // wrapped in a container so it can lunge, recoil and bob during combat.
    const avX = x - w / 2 + 24;
    const avY = y - 6;
    const elColor = ELEMENT_COLORS[def.elements[0]] ?? 0x888888;
    const emoji = MONSTER_EMOJI[c.defId] ?? '👾';

    const glow = this.add.circle(0, 0, 26, elColor, 0.35);
    const disc = this.add.circle(0, 0, 20, elColor).setStrokeStyle(2, 0xffffff);
    const glyph = this.add.text(0, 0, emoji, { fontSize: '24px' }).setOrigin(0.5);
    const avatar = this.add.container(avX, avY, [glow, disc, glyph]).setDepth(50);
    this.avatars.set(c.instanceId, avatar);
    this.avatarHomes.set(c.instanceId, { x: avX, y: avY });

    // Pulsing aura so each fighter feels alive even while idle.
    this.tweens.add({
      targets: glow,
      scale: { from: 0.85, to: 1.18 },
      alpha: { from: 0.4, to: 0.15 },
      duration: 1100,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    // Gentle breathing/bob on the emoji itself.
    this.tweens.add({
      targets: glyph,
      y: -3,
      duration: 900 + Math.random() * 400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

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

    // Status effect badges (icon + remaining rounds, updated each turn).
    const statusContainer = this.add.container(textLeft, y + 4);
    this.statusContainers.set(c.instanceId, statusContainer);

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

  // Rebuild the on-card status badges: one coloured pill per active effect
  // showing its icon and how many rounds it still has left.
  private updateStatusDisplay(c: BattleCombatant) {
    const container = this.statusContainers.get(c.instanceId);
    if (!container) return;
    container.removeAll(true);

    const badgeW = 30, badgeH = 17, gap = 4;
    let bx = 0;
    for (const se of c.statusEffects) {
      const def = STATUS_EFFECTS[se.effect];
      const color = def
        ? Phaser.Display.Color.HexStringToColor(def.color).color
        : 0x888888;

      const bg = this.add.rectangle(bx, 0, badgeW, badgeH, color, 0.9)
        .setOrigin(0, 0.5)
        .setStrokeStyle(1, 0x000000, 0.6);
      const icon = this.add.text(bx + 3, 0, def?.icon ?? '•', {
        fontSize: '11px',
      }).setOrigin(0, 0.5);
      const rounds = this.add.text(bx + badgeW - 4, 0, `${se.remainingRounds}`, {
        fontSize: '10px', color: '#ffffff', fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 2,
      }).setOrigin(1, 0.5);

      container.add([bg, icon, rounds]);
      bx += badgeW + gap;
    }
  }

  private showCombatantDetail(c: BattleCombatant) {
    // Close any open detail first.
    this.detailOverlay?.destroy();
    this.detailOverlay = null;

    const width = DESIGN_W, height = DESIGN_H;
    const def = MONSTER_DEFS[c.defId];
    if (!def) return;

    const panelW = 320, panelH = 360;
    const cx = width / 2, cy = height / 2;

    // Backdrop (tap to close) — oversized so it also covers any letterbox
    // margin around the design space.
    const backdrop = this.add.rectangle(cx, cy, width * 3, height * 3, 0x000000, 0.6)
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

    // Active status effects (only shown when at least one is present).
    if (c.statusEffects.length > 0) {
      yy += 10;
      items.push(this.add.text(cx - panelW / 2 + 18, yy, 'Aktive Statuseffekte:', {
        fontSize: '12px', color: '#ffd700', fontStyle: 'bold',
      }).setOrigin(0, 0));
      yy += 20;
      for (const se of c.statusEffects) {
        const sdef = STATUS_EFFECTS[se.effect];
        items.push(this.add.text(cx - panelW / 2 + 24, yy,
          `${sdef?.icon ?? '•'} ${sdef?.name ?? se.effect}`, {
          fontSize: '12px', color: sdef?.color ?? '#ffffff', fontStyle: 'bold',
        }).setOrigin(0, 0));
        items.push(this.add.text(cx + panelW / 2 - 24, yy, `${se.remainingRounds} Rd.`, {
          fontSize: '11px', color: '#aaaaaa',
        }).setOrigin(1, 0));
        yy += 16;
        items.push(this.add.text(cx - panelW / 2 + 24, yy, sdef?.description ?? '', {
          fontSize: '10px', color: '#bbbbbb',
          wordWrap: { width: panelW - 48 },
        }).setOrigin(0, 0));
        yy += 18;
      }
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
    const targetWidth = barBg.width * ratio;
    const color = ratio > 0.5 ? 0x44ff44 : ratio > 0.25 ? 0xffaa00 : 0xff2200;
    bars.bar.setFillStyle(color);
    // Animate the drain so the player can read how much damage just landed.
    this.tweens.add({
      targets: bars.bar,
      width: targetWidth,
      duration: 350,
      ease: 'Quad.out',
    });
    const hpLabel = this.hpLabels.get(c.instanceId);
    if (hpLabel) hpLabel.setText(`${Math.max(0, c.currentHp)}/${c.maxHp}`);

    // Faint the avatar once a combatant is knocked out.
    if (c.currentHp <= 0) this.playFaint(c.instanceId);
  }

  // ── Combat juice helpers ───────────────────────────────────────────────────

  // Quick lunge of the attacker's avatar toward its target, then snap back.
  private playLunge(attackerId: string, toward: 'right' | 'left') {
    const avatar = this.avatars.get(attackerId);
    const home = this.avatarHomes.get(attackerId);
    if (!avatar || !home) return;
    const dx = toward === 'right' ? 22 : -22;
    this.tweens.add({
      targets: avatar,
      x: home.x + dx,
      duration: 130,
      yoyo: true,
      ease: 'Quad.out',
    });
  }

  // Shake + white flash on a card that just took a hit.
  private playHitReaction(targetId: string) {
    const avatar = this.avatars.get(targetId);
    const home = this.avatarHomes.get(targetId);
    if (avatar && home) {
      this.tweens.add({
        targets: avatar,
        x: { from: home.x - 5, to: home.x + 5 },
        duration: 45,
        yoyo: true,
        repeat: 4,
        ease: 'Sine.easeInOut',
        onComplete: () => { avatar.x = home.x; },
      });
    }
    const bg = this.cardBgs.get(targetId);
    if (bg) {
      const flash = this.add.rectangle(bg.x, bg.y, bg.width, bg.height, 0xffffff, 0.6).setDepth(80);
      this.tweens.add({ targets: flash, alpha: 0, duration: 220, onComplete: () => flash.destroy() });
    }
  }

  // An element-coloured burst of shards at the point of impact.
  private spawnImpactBurst(x: number, y: number, color: number) {
    const ring = this.add.circle(x, y, 6, color, 0.8).setDepth(850);
    this.tweens.add({
      targets: ring,
      scale: 4,
      alpha: 0,
      duration: 380,
      ease: 'Quad.out',
      onComplete: () => ring.destroy(),
    });
    for (let i = 0; i < 8; i++) {
      const ang = (Math.PI * 2 * i) / 8 + Math.random() * 0.4;
      const dist = 26 + Math.random() * 18;
      const shard = this.add.circle(x, y, 3 + Math.random() * 2, color, 1).setDepth(851);
      this.tweens.add({
        targets: shard,
        x: x + Math.cos(ang) * dist,
        y: y + Math.sin(ang) * dist,
        alpha: 0,
        scale: 0.2,
        duration: 320 + Math.random() * 160,
        ease: 'Quad.out',
        onComplete: () => shard.destroy(),
      });
    }
  }

  // A small element-coloured projectile travelling attacker → target.
  private spawnProjectile(from: { x: number; y: number }, to: { x: number; y: number }, color: number, onArrive: () => void) {
    const orb = this.add.circle(from.x, from.y, 8, color, 1).setDepth(840).setStrokeStyle(2, 0xffffff, 0.8);
    const glow = this.add.circle(from.x, from.y, 14, color, 0.35).setDepth(839);
    this.tweens.add({
      targets: [orb, glow],
      x: to.x,
      y: to.y,
      duration: 260,
      ease: 'Quad.in',
      onComplete: () => { orb.destroy(); glow.destroy(); onArrive(); },
    });
  }

  // Fade + spin-out for a defeated combatant's avatar.
  private playFaint(instanceId: string) {
    const avatar = this.avatars.get(instanceId);
    if (!avatar || avatar.getData('fainted')) return;
    avatar.setData('fainted', true);
    this.tweens.add({
      targets: avatar,
      alpha: 0.25,
      scale: 0.7,
      angle: 25,
      duration: 500,
      ease: 'Quad.in',
    });
  }

  private updateUltBar(c: BattleCombatant) {
    const ub = this.ultBars.get(c.instanceId);
    if (!ub) return;
    const cost = ultChargeCostFor(c.attackStat);
    const ratio = Math.min(1, c.ultCharge / cost);
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
        // Recharge strong moves by one round.
        tickMoveCooldowns(c);
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
      if (this.autoBattle) {
        this.time.delayedCall(250, () => this.autoPlayerTurn(this.currentAttacker!));
      } else {
        this.showAttackButtons(this.currentAttacker);
      }
    } else {
      this.time.delayedCall(this.autoBattle ? 300 : 600, () => this.doAiTurn(this.currentAttacker!));
    }
  }

  private showAttackButtons(attacker: BattleCombatant) {
    this.clearAttackButtons();
    this.awaitingPlayerInput = true;
    const width = DESIGN_W, height = DESIGN_H;
    const def = MONSTER_DEFS[attacker.defId];
    const moves = attacker.equippedMoveIds;

    this.statusText.setText(`${attacker.name}'s turn — choose an attack:`);

    // ── ULTIMA button (only when fully charged) ──────────────────────────────
    if (attacker.ultCharge >= ultChargeCostFor(attacker.attackStat)) {
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

      const cdLeft = attacker.moveCooldowns[moveId] ?? 0;
      const onCooldown = cdLeft > 0;
      const maxCd = getMoveCooldown(moveDef);

      const btn = this.add.rectangle(x, y, 100, 44, onCooldown ? 0x2a2a33 : 0x334477)
        .setStrokeStyle(2, onCooldown ? 0x555566 : 0xaabbff);
      if (!onCooldown) btn.setInteractive({ useHandCursor: true });

      const txt = this.add.text(x, y - 8, moveDef.name, {
        fontSize: '11px', color: onCooldown ? '#777788' : '#ffffff', fontStyle: 'bold',
      }).setOrigin(0.5);
      const powerTxt = this.add.text(x, y + 8,
        onCooldown ? `⏳ ${cdLeft} Runde${cdLeft > 1 ? 'n' : ''}` : `⚡${moveDef.power}x${maxCd > 0 ? ` · CD ${maxCd}` : ''}`,
        { fontSize: '10px', color: onCooldown ? '#cc8844' : '#aaccff' }).setOrigin(0.5);

      const container = this.add.container(0, 0, [btn, txt, powerTxt]);
      this.attackButtons.push(container);

      if (!onCooldown) {
        btn.on('pointerdown', () => this.onMoveSelected(moveId, attacker));
        btn.on('pointerover', () => btn.setFillStyle(0x4455aa));
        btn.on('pointerout', () => btn.setFillStyle(0x334477));
      }
    });
  }

  private clearAttackButtons() {
    for (const btn of this.attackButtons) btn.destroy();
    this.attackButtons = [];
    this.clearTargetOverlays();
  }

  private onUltSelected(attacker: BattleCombatant) {
    this.awaitingPlayerInput = false;
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
    this.awaitingPlayerInput = false;
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

    const sceneKey = MINIGAME_SCENE_KEYS[moveDef.minigameType] ?? 'ButtonSequenceScene';
    this.scene.launch(sceneKey, { moveDef, rarityRank });
    this.scene.bringToTop(sceneKey);
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
    // Put strong moves on cooldown so they can't be used every turn.
    const cd = getMoveCooldown(moveDef);
    if (cd > 0) this.currentAttacker.moveCooldowns[this.selectedMoveId] = cd + 1;
    this.turnIndex++;
    this.time.delayedCall(800, () => this.nextTurn());
  };

  private doAiTurn(attacker: BattleCombatant) {
    // AI uses ult when charged (70% chance so it's not always predictable)
    if (attacker.ultCharge >= ultChargeCostFor(attacker.attackStat) && Math.random() < 0.7) {
      const aiScore1 = 50 + Math.random() * 40;
      const aiScore2 = 50 + Math.random() * 40;
      this.applyUlt(attacker, aiScore1, aiScore2);
      this.turnIndex++;
      this.time.delayedCall(900, () => this.nextTurn());
      return;
    }

    // The AI only picks from moves that aren't recharging.
    const readyMoves = attacker.equippedMoveIds.filter(id => (attacker.moveCooldowns[id] ?? 0) === 0);
    const pool = readyMoves.length > 0 ? readyMoves : attacker.equippedMoveIds;
    const { moveId, accuracy } = generateAiAttack(pool);
    const moveDef = ATTACKS[moveId];
    if (!moveDef) { this.turnIndex++; this.nextTurn(); return; }
    this.enemyUsedMoveIds.add(moveId); // track for post-battle learn

    const players = this.playerCombatants.filter(c => c.currentHp > 0);
    if (players.length === 0) { this.endBattle(false); return; }
    const target = players[Math.floor(Math.random() * players.length)];

    this.applyAttack(attacker, target, moveDef, accuracy);
    const cd = getMoveCooldown(moveDef);
    if (cd > 0) attacker.moveCooldowns[moveId] = cd + 1;
    this.turnIndex++;
    this.time.delayedCall(800, () => this.nextTurn());
  }

  // ── Speed-Up auto-pilot ─────────────────────────────────────────────────────

  // Builds the top-right Speed-Up toggle and wires its tap handler.
  private createSpeedButton(width: number) {
    const x = width - 70, y = 30;
    const bg = this.add.rectangle(x, y, 116, 30, 0x223355)
      .setStrokeStyle(2, 0x66aaff)
      .setInteractive({ useHandCursor: true })
      .setDepth(200);
    const label = this.add.text(x, y, '⏩ SPEED-UP', {
      fontSize: '13px', color: '#cce4ff', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(201);
    this.speedBtnBg = bg;
    this.speedBtnLabel = label;
    bg.on('pointerdown', () => this.toggleAutoBattle());
    bg.on('pointerover', () => { if (!this.autoBattle) bg.setFillStyle(0x2d4470); });
    bg.on('pointerout', () => { if (!this.autoBattle) bg.setFillStyle(0x223355); });
  }

  private toggleAutoBattle() {
    this.autoBattle = !this.autoBattle;
    if (this.speedBtnBg && this.speedBtnLabel) {
      this.speedBtnBg.setFillStyle(this.autoBattle ? 0x227744 : 0x223355);
      this.speedBtnBg.setStrokeStyle(2, this.autoBattle ? 0x66ff99 : 0x66aaff);
      this.speedBtnLabel.setText(this.autoBattle ? '⏩ AUTO: AN' : '⏩ SPEED-UP');
      this.speedBtnLabel.setColor(this.autoBattle ? '#ccffdd' : '#cce4ff');
    }
    // If we just switched on while the player is being asked to pick a move,
    // resolve that pending turn immediately.
    if (this.autoBattle && this.awaitingPlayerInput && this.currentAttacker?.isPlayer) {
      this.awaitingPlayerInput = false;
      this.clearAttackButtons();
      this.autoPlayerTurn(this.currentAttacker);
    }
  }

  // Expected damage of a given element/power against a target at the auto score,
  // used to rank moves and pick targets for the auto-pilot.
  private expectedDamage(attacker: BattleCombatant, target: BattleCombatant, element: string, power: number): number {
    const attackerDef = MONSTER_DEFS[attacker.defId];
    const targetDef = MONSTER_DEFS[target.defId];
    if (!attackerDef || !targetDef) return 0;
    let def = target.defenseStat;
    if (target.statusEffects.some(e => e.effect === 'DefDown')) def = Math.floor(def * 0.75);
    return calculateDamage({
      attackerATK: attacker.attackStat,
      movePower: power,
      minigameScore: AUTO_BATTLE_SCORE,
      attackerElement: element,
      defenderElements: targetDef.elements as string[],
      defenderDEF: def,
      attackerTrait: attacker.trait,
      attackerStatuses: attacker.statusEffects,
      attackerCurrentHp: attacker.currentHp,
      attackerMaxHp: attacker.maxHp,
      attackerLevel: attacker.level,
      attackerRarityRank: RARITY_RANK[attackerDef.rarity],
      campaignDamageMultiplier: this.campaignDamageMultiplierFor(attacker),
    });
  }

  // Picks the living enemy that takes the most damage from the given attack;
  // a target that would be knocked out is always preferred, ties break toward
  // the lowest-HP enemy so the auto-pilot finishes monsters off.
  private pickBestTarget(attacker: BattleCombatant, element: string, power: number): BattleCombatant | null {
    const enemies = this.enemyCombatants.filter(c => c.currentHp > 0);
    let best: BattleCombatant | null = null;
    let bestScore = -1;
    for (const target of enemies) {
      const dmg = this.expectedDamage(attacker, target, element, power);
      const lethal = dmg >= target.currentHp ? 1_000_000 : 0;
      const score = dmg + lethal;
      if (score > bestScore || (score === bestScore && best && target.currentHp < best.currentHp)) {
        bestScore = score;
        best = target;
      }
    }
    return best;
  }

  // Chooses the most effective ready move plus its best target.
  private chooseBestMove(attacker: BattleCombatant): { moveId: string; target: BattleCombatant } | null {
    const enemies = this.enemyCombatants.filter(c => c.currentHp > 0);
    if (enemies.length === 0) return null;
    const ready = attacker.equippedMoveIds.filter(id => ATTACKS[id] && (attacker.moveCooldowns[id] ?? 0) === 0);
    const pool = ready.length > 0 ? ready : attacker.equippedMoveIds.filter(id => ATTACKS[id]);
    if (pool.length === 0) return null;

    let bestMove: string | null = null;
    let bestTarget: BattleCombatant | null = null;
    let bestScore = -1;
    for (const moveId of pool) {
      const move = ATTACKS[moveId]!;
      const target = this.pickBestTarget(attacker, move.element, move.power);
      if (!target) continue;
      const dmg = this.expectedDamage(attacker, target, move.element, move.power);
      const lethal = dmg >= target.currentHp ? 1_000_000 : 0;
      const score = dmg + lethal;
      if (score > bestScore) {
        bestScore = score;
        bestMove = moveId;
        bestTarget = target;
      }
    }
    if (!bestMove || !bestTarget) return null;
    return { moveId: bestMove, target: bestTarget };
  }

  // Resolves one player turn automatically: fire the ULTIMA if it's charged,
  // otherwise execute the strongest available attack on the best target.
  private autoPlayerTurn(attacker: BattleCombatant) {
    this.awaitingPlayerInput = false;
    this.clearAttackButtons();
    if (!attacker || attacker.currentHp <= 0) { this.turnIndex++; this.nextTurn(); return; }

    // ULTIMA when fully charged — the single most effective option available.
    if (attacker.ultCharge >= ultChargeCostFor(attacker.attackStat)) {
      const def = MONSTER_DEFS[attacker.defId];
      const target = this.pickBestTarget(attacker, def.elements[0], 2.5)
        ?? this.enemyCombatants.find(c => c.currentHp > 0) ?? null;
      if (!target) { this.endBattle(true); return; }
      this.selectedTarget = target;
      this.state = 'PLAYER_TURN';
      this.statusText.setText(`⏩ ${attacker.name} entfesselt die ULTIMA!`);
      this.applyUlt(attacker, AUTO_BATTLE_SCORE, AUTO_BATTLE_SCORE);
      this.turnIndex++;
      this.time.delayedCall(900, () => this.nextTurn());
      return;
    }

    const choice = this.chooseBestMove(attacker);
    if (!choice) { this.turnIndex++; this.nextTurn(); return; }

    const moveDef = ATTACKS[choice.moveId];
    if (!moveDef) { this.turnIndex++; this.nextTurn(); return; }

    this.selectedMoveId = choice.moveId;
    this.selectedTarget = choice.target;
    this.state = 'PLAYER_TURN';
    this.statusText.setText(`⏩ ${attacker.name} → ${moveDef.name}`);
    this.applyAttack(attacker, choice.target, moveDef, AUTO_BATTLE_SCORE);
    const cd = getMoveCooldown(moveDef);
    if (cd > 0) attacker.moveCooldowns[choice.moveId] = cd + 1;
    this.turnIndex++;
    this.time.delayedCall(650, () => this.nextTurn());
  }

  // Early-campaign damage boost: only the player's monsters benefit, and only
  // during the first 12 story battles (World 1). Arena fights and enemies get 1.
  private campaignDamageMultiplierFor(attacker: BattleCombatant): number {
    if (!attacker.isPlayer) return 1;
    return earlyCampaignDamageBonus(this.data_.storyIndex);
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
      attackerLevel: attacker.level,
      attackerRarityRank: RARITY_RANK[attackerDef.rarity],
      campaignDamageMultiplier: this.campaignDamageMultiplierFor(attacker),
    });

    // Echo trait: hit twice at 60%
    let totalDmg = dmg;
    if (attacker.trait === 'Echo') {
      totalDmg = Math.floor(dmg * 0.6) * 2;
    }

    target.currentHp = Math.max(0, target.currentHp - totalDmg);

    // ── Visual attack sequence ────────────────────────────────────────────────
    const moveColor = ELEMENT_COLORS[move.element as keyof typeof ELEMENT_COLORS] ?? 0xffffff;
    const elementBonus = getElementBonus(
      move.element as Parameters<typeof getElementBonus>[0],
      targetDef.elements as Parameters<typeof getElementBonus>[1],
    );
    const superEffective = elementBonus > 0;
    const fromPos = this.avatarHomes.get(attacker.instanceId) ?? this.cardCenters.get(attacker.instanceId);
    const toPos = this.avatarHomes.get(target.instanceId) ?? this.cardCenters.get(target.instanceId);

    // Attacker lunges toward the target's side of the field.
    this.playLunge(attacker.instanceId, attacker.isPlayer ? 'right' : 'left');

    const onImpact = () => {
      if (toPos) this.spawnImpactBurst(toPos.x, toPos.y, moveColor);
      this.playHitReaction(target.instanceId);
      this.updateHpBar(target);
      this.showDamageText(target.instanceId, totalDmg, attacker.isPlayer ? 0xffffff : 0xff4444);
      // Bigger hits rock the whole arena.
      const shake = Math.min(0.012, 0.004 + totalDmg / 9000);
      if (superEffective || totalDmg >= 40) this.cameras.main.shake(180, shake);
      if (superEffective && toPos) this.showEffectivenessText(toPos.x, toPos.y - 30, 'SUPER EFFEKTIV!', '#ffdd33');
      else if (elementBonus < 0 && toPos) this.showEffectivenessText(toPos.x, toPos.y - 30, 'nicht sehr effektiv…', '#99aabb');
    };

    if (fromPos && toPos) {
      this.spawnProjectile(fromPos, toPos, moveColor, onImpact);
    } else {
      onImpact();
    }

    // Apply status effect
    if (move.statusEffect && score > move.statusEffect.threshold) {
      const effect = move.statusEffect.effect;
      const statusName = STATUS_EFFECTS[effect]?.name ?? effect;
      const immune = (TRAITS[target.trait]?.immuneTo ?? []).includes(effect);
      if (immune) {
        this.log(`${target.name} ist immun gegen ${statusName}!`);
      } else if (target.trait === 'Mania') {
        // Mania: if target has Mania, buff instead of being debuffed.
        target.attackStat = Math.floor(target.attackStat * 3);
        target.defenseStat = Math.floor(target.defenseStat * 3);
        this.log(`${target.name} goes MANIC!`);
      } else {
        // addStatusEffect refreshes an existing effect instead of stacking
        // a duplicate, so each effect only ever appears once.
        addStatusEffect(target, effect);
        this.log(`${target.name} ist von ${statusName} betroffen!`);
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
      attackerLevel: attacker.level,
      attackerRarityRank: RARITY_RANK[def.rarity],
      campaignDamageMultiplier: this.campaignDamageMultiplierFor(attacker),
    });

    // Screen flash + a hefty shake to sell the ultimate.
    const width = DESIGN_W, height = DESIGN_H;
    const flash = this.add.rectangle(width / 2, height / 2, width * 3, height * 3, 0xffd700, 0.55).setDepth(500);
    this.tweens.add({ targets: flash, alpha: 0, duration: 500, onComplete: () => flash.destroy() });
    this.cameras.main.shake(320, 0.014);

    const ultColor = ELEMENT_COLORS[def.elements[0]] ?? 0xffd700;

    // Big ULTIMA announcement over the attacker's card + dramatic lunge.
    const src = this.cardCenters.get(attacker.instanceId);
    if (src) {
      const ultTxt = this.add.text(src.x, src.y - 20, '⚡ ULTIMA ⚡', {
        fontSize: '20px', color: '#ffd700', fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 5,
      }).setOrigin(0.5).setDepth(901);
      this.tweens.add({ targets: ultTxt, y: src.y - 60, alpha: 0, duration: 1400, ease: 'Quad.in', onComplete: () => ultTxt.destroy() });
    }
    this.playLunge(attacker.instanceId, attacker.isPlayer ? 'right' : 'left');

    target.currentHp = Math.max(0, target.currentHp - dmg);
    this.updateHpBar(target);
    this.playHitReaction(target.instanceId);
    // A big multi-ring elemental burst on the victim.
    const ctr0 = this.cardCenters.get(target.instanceId);
    if (ctr0) {
      this.spawnImpactBurst(ctr0.x, ctr0.y, ultColor);
      this.time.delayedCall(90, () => this.spawnImpactBurst(ctr0.x, ctr0.y, 0xffd700));
      this.time.delayedCall(180, () => this.spawnImpactBurst(ctr0.x, ctr0.y, ultColor));
    }
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

  // Floating "SUPER EFFEKTIV!" / "nicht sehr effektiv" banner above a target.
  private showEffectivenessText(x: number, y: number, label: string, color: string) {
    const txt = this.add.text(x, y, label, {
      fontSize: '14px', color, fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(905).setScale(0.5);
    this.tweens.add({ targets: txt, scale: 1, duration: 160, ease: 'Back.out' });
    this.tweens.add({
      targets: txt, y: y - 26, alpha: 0, duration: 1100, delay: 250, ease: 'Quad.in',
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

    const width = DESIGN_W, height = DESIGN_H;

    if (!victory) {
      this.add.rectangle(width / 2, height / 2, 400, 200, 0x662222, 0.9)
        .setStrokeStyle(3, 0xffffff);
      this.add.text(width / 2, height / 2 - 40, 'DEFEAT', {
        fontSize: '40px', color: '#ffffff', fontStyle: 'bold',
      }).setOrigin(0.5);
      this.showContinuePrompt(false);
      return;
    }

    // ── VICTORY ────────────────────────────────────────────────────────────────
    const store = useGameStore.getState();
    store.addTrophies(20);
    store.recordBattleWon();

    // Advance the story if this was the next uncleared story battle.
    if (this.data_.storyIndex !== undefined && this.data_.storyIndex === store.storyProgress) {
      store.advanceStory();
    }
    const rewardMonsterDefId = this.data_.rewardMonsterDefId;
    if (rewardMonsterDefId && MONSTER_DEFS[rewardMonsterDefId]) {
      store.addEgg(rewardMonsterDefId, 30);
    }

    // Better campaign rewards still scale the *base* values; the wheel then
    // decides the final payout around that baseline.
    const rewardMult = campaignRewardMultiplier(this.data_.storyIndex);
    const baseGold = Math.round((this.data_.rewardGold ?? 200) * rewardMult);
    const baseXp = Math.round((this.data_.rewardXp ?? 300) * rewardMult);
    const baseDiamonds = Math.round((this.data_.rewardDiamonds ?? 0) * rewardMult);

    // Victory banner at the top; the wheel takes the centre of the screen.
    this.add.text(width / 2, 70, '🏆 SIEG! 🏆', {
      fontSize: '40px', color: '#ffd700', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 5,
    }).setOrigin(0.5);

    this.showRewardWheel(width, height, baseGold, baseXp, baseDiamonds);
  }

  // ── Reward wheel (Glücksrad) ────────────────────────────────────────────────

  /**
   * Spinning wheel of fortune shown after a victory. Replaces the old fixed
   * reward: the player taps DREHEN, the wheel spins and lands on a segment that
   * decides how the (campaign-scaled) base reward is multiplied / topped up.
   */
  private showRewardWheel(width: number, height: number, baseGold: number, baseXp: number, baseDiamonds: number) {
    // Each segment scales the base gold/xp and may add flat diamonds. Weights
    // make the big wins rarer than the modest ones.
    const segments: Array<{ label: string; color: number; gold: number; xp: number; dia: number; weight: number }> = [
      { label: '🪙 ×1',      color: 0x8a6d3b, gold: 1.0, xp: 1, dia: 0, weight: 18 },
      { label: '⭐ XP ×2',   color: 0x2e6da4, gold: 1.0, xp: 2, dia: 0, weight: 14 },
      { label: '🪙 ×2',      color: 0xd4a017, gold: 2.0, xp: 1, dia: 0, weight: 14 },
      { label: '💎 +5',      color: 0x6f42c1, gold: 1.0, xp: 1, dia: 5, weight: 10 },
      { label: '🎰 JACKPOT', color: 0xc0392b, gold: 3.0, xp: 3, dia: 10, weight: 4 },
      { label: '🪙 ×1.5',    color: 0xb8860b, gold: 1.5, xp: 1, dia: 0, weight: 16 },
      { label: '⭐ XP ×3',   color: 0x1f78b4, gold: 1.0, xp: 3, dia: 2, weight: 8 },
      { label: '💎 +2',      color: 0x8e44ad, gold: 1.0, xp: 1, dia: 2, weight: 16 },
    ];
    const N = segments.length;
    const segAngle = (Math.PI * 2) / N;
    const radius = 132;
    const cx = width / 2, cy = height / 2 + 18;

    // Dim backdrop so the wheel reads as the focus of the screen.
    this.add.rectangle(cx, height / 2, width * 3, height * 3, 0x000000, 0.55).setDepth(400);

    // Build the wheel face (slices + labels) inside one rotatable container.
    const g = this.add.graphics();
    const children: Phaser.GameObjects.GameObject[] = [g];
    for (let i = 0; i < N; i++) {
      const a0 = i * segAngle, a1 = (i + 1) * segAngle;
      g.fillStyle(segments[i].color, 1);
      g.slice(0, 0, radius, a0, a1, false);
      g.fillPath();
      g.lineStyle(3, 0x1a0a3c, 0.8);
      g.beginPath();
      g.slice(0, 0, radius, a0, a1, false);
      g.strokePath();

      const mid = a0 + segAngle / 2;
      const lr = radius * 0.64;
      const lbl = this.add.text(Math.cos(mid) * lr, Math.sin(mid) * lr, segments[i].label, {
        fontSize: '13px', color: '#ffffff', fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 3, align: 'center',
      }).setOrigin(0.5);
      lbl.setRotation(mid + Math.PI / 2);
      children.push(lbl);
    }
    const wheel = this.add.container(cx, cy, children).setDepth(500);

    // Outer rim + hub.
    const rim = this.add.circle(cx, cy, radius + 4, 0x000000, 0).setStrokeStyle(5, 0xffd700).setDepth(501);
    const hub = this.add.circle(cx, cy, 16, 0x1a0a3c).setStrokeStyle(3, 0xffd700).setDepth(503);

    // Pointer at the top, pointing down into the wheel.
    const pointer = this.add.triangle(cx, cy - radius - 2, 0, -16, 14, 12, -14, 12, 0xffd700)
      .setStrokeStyle(2, 0x000000).setDepth(504);

    // Spin button.
    const btnY = cy + radius + 44;
    const spinBg = this.add.rectangle(cx, btnY, 200, 46, 0x227744)
      .setStrokeStyle(3, 0x66ff99).setInteractive({ useHandCursor: true }).setDepth(505);
    const spinTxt = this.add.text(cx, btnY, '🎡  DREHEN', {
      fontSize: '20px', color: '#ffffff', fontStyle: 'bold', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(506);
    spinBg.on('pointerover', () => spinBg.setFillStyle(0x2e9e5b));
    spinBg.on('pointerout', () => spinBg.setFillStyle(0x227744));

    const hint = this.add.text(cx, btnY + 36, 'Drehe das Glücksrad für deine Belohnung!', {
      fontSize: '13px', color: '#cccccc',
    }).setOrigin(0.5).setDepth(506);

    let spun = false;
    spinBg.once('pointerdown', () => {
      if (spun) return;
      spun = true;
      spinBg.disableInteractive();
      spinTxt.setText('…');
      hint.setText('');

      // Weighted random landing segment.
      const totalWeight = segments.reduce((s, seg) => s + seg.weight, 0);
      let roll = Math.random() * totalWeight;
      let landed = 0;
      for (let i = 0; i < N; i++) { roll -= segments[i].weight; if (roll <= 0) { landed = i; break; } }

      // Rotate so the landed segment's centre stops under the top pointer
      // (top = -90° in Phaser's y-down coordinate space), after 5 full turns.
      const segMid = (landed + 0.5) * segAngle;
      const target = (Math.PI * 2) * 5 + (-Math.PI / 2 - segMid);
      this.tweens.add({
        targets: wheel,
        rotation: target,
        duration: 3600,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          const seg = segments[landed];
          const gold = Math.round(baseGold * seg.gold);
          const xp = Math.round(baseXp * seg.xp);
          const dia = baseDiamonds + seg.dia;

          const store = useGameStore.getState();
          if (gold > 0) store.addGold(gold);
          if (xp > 0) store.addPlayerXp(xp);
          if (dia > 0) store.addDiamonds(dia);

          this.cameras.main.flash(220, 255, 215, 0);
          const rewardLine = `+${gold} 🪙   +${xp} XP`
            + (dia > 0 ? `   +${dia} 💎` : '');
          spinTxt.setVisible(false);
          spinBg.setVisible(false);
          const banner = this.add.text(cx, btnY - 4, rewardLine, {
            fontSize: '22px', color: '#ffd700', fontStyle: 'bold', stroke: '#000', strokeThickness: 3,
          }).setOrigin(0.5).setDepth(506);
          banner.setScale(0.5);
          this.tweens.add({ targets: banner, scale: 1, duration: 250, ease: 'Back.out' });

          // Now the player can dismiss the screen + see the learn offer.
          this.offerBattleLearn(width, height);
          this.showContinuePrompt(true);
        },
      });
    });

    // Reference the rim/hub/pointer so linters don't flag them as unused.
    void rim; void hub; void pointer;
  }

  // Shows the "tap to continue" prompt and wires the single tap that closes the
  // battle. Wired only once the reward flow is finished so earlier taps (spin
  // button, learn buttons) don't accidentally end the battle.
  private showContinuePrompt(victory: boolean) {
    const width = DESIGN_W, height = DESIGN_H;
    this.add.text(width / 2, height - 30, 'Tippe zum Fortfahren', {
      fontSize: '16px', color: '#aaaaaa',
    }).setOrigin(0.5).setDepth(1200);

    this.input.once('pointerdown', () => {
      EventBus.emit(GameEvents.BATTLE_ENDED, { victory });
      this.scene.stop();
      this.scene.resume('Island');
    });
  }

  /**
   * After a victory, pick one move the enemy used that a player monster could
   * learn but doesn't yet know.  Show a small offer panel — 20% chance it fires.
   */
  private offerBattleLearn(width: number, height: number) {
    if (Math.random() > 0.35) return; // 35% chance per battle

    const store = useGameStore.getState();
    const playerMonsters = this.playerCombatants
      .map(c => store.monsters[c.instanceId])
      .filter(Boolean);

    // Find an enemy move that at least one player monster can learn but doesn't know
    const offers: Array<{ moveId: string; learnerId: string; learnerName: string }> = [];
    for (const moveId of this.enemyUsedMoveIds) {
      const move = ATTACKS[moveId];
      if (!move) continue;
      for (const m of playerMonsters) {
        const def = MONSTER_DEFS[m.defId];
        if (!def) continue;
        if ((m.knownMoveIds ?? m.equippedMoveIds).includes(moveId)) continue;
        if (def.elements.includes(move.element as Parameters<typeof def.elements.includes>[0])) {
          offers.push({ moveId, learnerId: m.instanceId, learnerName: m.name });
          break;
        }
      }
    }
    if (offers.length === 0) return;

    const pick = offers[Math.floor(Math.random() * offers.length)];
    const move = ATTACKS[pick.moveId]!;

    // Show a small floating panel above the victory box
    const panelY = height / 2 - 130;
    const bg = this.add.rectangle(width / 2, panelY, 350, 72, 0x0d1929, 1)
      .setStrokeStyle(2, 0x4488ff).setDepth(1100);
    const title = this.add.text(width / 2, panelY - 20, `✨ ${pick.learnerName} kann lernen:`, {
      fontSize: '13px', color: '#88aaff', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(1101);
    const moveTxt = this.add.text(width / 2, panelY - 1, `${move.name}  (${move.element} · ${move.power}×)`, {
      fontSize: '14px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(1101);

    const yesBtn = this.add.rectangle(width / 2 - 55, panelY + 22, 90, 26, 0x003300)
      .setStrokeStyle(1, 0x66ff66).setInteractive({ useHandCursor: true }).setDepth(1101);
    const yesTxt = this.add.text(width / 2 - 55, panelY + 22, '✓ Erlernen', {
      fontSize: '12px', color: '#66ff66',
    }).setOrigin(0.5).setDepth(1102);

    const noBtn = this.add.rectangle(width / 2 + 55, panelY + 22, 90, 26, 0x330000)
      .setStrokeStyle(1, 0xff4444).setInteractive({ useHandCursor: true }).setDepth(1101);
    const noTxt = this.add.text(width / 2 + 55, panelY + 22, '✗ Überspringen', {
      fontSize: '12px', color: '#ff4444',
    }).setOrigin(0.5).setDepth(1102);

    const cleanup = () => [bg, title, moveTxt, yesBtn, yesTxt, noBtn, noTxt].forEach(o => o.destroy());

    yesBtn.on('pointerdown', () => {
      store.learnAttack(pick.learnerId, pick.moveId);
      this.add.text(width / 2, panelY, `${pick.learnerName} hat ${move.name} erlernt! ✨`, {
        fontSize: '14px', color: '#ffd700', fontStyle: 'bold', stroke: '#000', strokeThickness: 3,
      }).setOrigin(0.5).setDepth(1103);
      cleanup();
    });
    noBtn.on('pointerdown', cleanup);
  }

  shutdown() {
    EventBus.off(GameEvents.MINIGAME_COMPLETE, this.onMinigameResult, this);
  }
}
