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
import { getMonsterFaction, mixedTeamPenalty, pureTeamBonus, type Faction } from '@data/factions';
import {
  buildTurnQueue, calculateDamage, generateAiAttack,
  processStatusTick, buildCombatant, gainUltCharge, ultChargeCostFor,
  getMoveCooldown, tickMoveCooldowns, addStatusEffect,
  earlyCampaignDamageBonus, campaignRewardMultiplier,
  effectiveDefense, getMoveEnergyCost, canAffordMove, spendEnergy, regenEnergy,
  rechargeEnergy, incomingDamageMultiplier, applyShield, findTaunter,
} from '@systems/BattleSystem';
import { setupFixedViewport, DESIGN_W, DESIGN_H } from '@game/scenes/viewport';
import type { BattleCombatant, MoveDef, MinigameType, StatusEffect } from '@gtypes/game';

// Every harmful status effect — used by the support "cleanse" move to decide
// which effects to strip (leaving positive buffs like AtkUp/DefUp in place).
const NEGATIVE_STATUS: StatusEffect[] = [
  'Burn', 'Poison', 'Freeze', 'Stun', 'Paralyze', 'Blind', 'DefDown', 'AtkDown',
  'Bleed', 'Vulnerable',
];

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
  isBoss?: boolean;       // boss fight — the lead enemy is drawn oversized
  // Multi-wave fight: each entry is one enemy line-up faced back-to-back. When
  // present it supersedes enemyTeam/enemyLevels (which describe a single wave).
  waves?: Array<{ enemyTeam: string[]; enemyLevels: number[] }>;
}

// Reduces every diamond payout from a victory. Diamonds are meant to stay a
// scarce premium currency, so battle rewards only hand out a fraction.
const DIAMOND_REWARD_SCALE = 0.4;

export class Battle extends Phaser.Scene {
  private playerCombatants: BattleCombatant[] = [];
  private enemyCombatants: BattleCombatant[] = [];
  private state: BattleState = 'INTRO';
  private turnOrder: BattleCombatant[] = [];
  private turnIndex = 0;

  // Multi-wave fights: each wave is one enemy line-up faced in sequence. waveIndex
  // tracks which one is currently on the field.
  private waves: Array<{ enemyTeam: string[]; enemyLevels: number[] }> = [];
  private waveIndex = 0;
  // Every Phaser object that makes up a combatant's card, so a defeated wave's
  // enemy cards can be torn down cleanly before the next wave is drawn.
  private cardObjects: Map<string, Phaser.GameObjects.GameObject[]> = new Map();
  private selectedMoveId = '';
  private currentAttacker: BattleCombatant | null = null;
  private data_!: BattleData;

  // UI elements
  private hpBars: Map<string, { bar: Phaser.GameObjects.Rectangle; bg: Phaser.GameObjects.Rectangle }> = new Map();
  private ultBars: Map<string, { bar: Phaser.GameObjects.Rectangle; bg: Phaser.GameObjects.Rectangle }> = new Map();
  private energyBars: Map<string, { bar: Phaser.GameObjects.Rectangle; bg: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text }> = new Map();
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
  // On-screen flee button (touch devices have no ESC key). Requires a second
  // tap to confirm so a stray touch can't drop the player out of a fight.
  private fleeBtnBg: Phaser.GameObjects.Rectangle | null = null;
  private fleeBtnLabel: Phaser.GameObjects.Text | null = null;
  private fleeArmed = false;
  private fleeResetTimer?: Phaser.Time.TimerEvent;

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
      return buildCombatant(inst.instanceId, inst.defId, inst.level, inst.equippedMoveIds, true, inst.name, inst.rankStars ?? 0);
    }).filter(Boolean) as BattleCombatant[];

    // Resolve the wave line-up: an explicit waves[] (boss gauntlets) wins,
    // otherwise the flat enemyTeam/enemyLevels make a single wave.
    this.waves = (this.data_.waves && this.data_.waves.length > 0)
      ? this.data_.waves
      : [{ enemyTeam: this.data_.enemyTeam, enemyLevels: this.data_.enemyLevels ?? [] }];
    this.waveIndex = 0;
    this.enemyCombatants = this.buildWaveEnemies(this.waveIndex);

    // Draw monster cards
    this.drawMonsterCards();

    // Announce the first wave when there's more than one to come.
    if (this.waves.length > 1) {
      this.time.delayedCall(1150, () => this.showWaveBanner());
    }

    // Status + log text
    this.statusText = this.add.text(width / 2, height - 178, '', {
      fontSize: '22px', color: '#ffffff', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 4, align: 'center',
    }).setOrigin(0.5);

    this.logText = this.add.text(10, height - 50, '', {
      fontSize: '12px', color: '#aaaaaa',
    });

    // ESC to flee (desktop) — plus an on-screen button for touch devices.
    this.input.keyboard?.on('keydown-ESC', () => this.endBattle(false));
    this.createFleeButton();

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

  // Card layout constants, shared by the initial draw and per-wave enemy redraws.
  private static readonly CARD_W = 156;
  private static readonly CARD_H = 84;
  private static readonly CARD_MARGIN = 16;
  private static readonly CARD_START_Y = 90;
  private get cardGapY() { return Battle.CARD_H + 22; }
  private get enemyColumnX() { return DESIGN_W - Battle.CARD_MARGIN - Battle.CARD_W / 2; }

  // Builds the combatants for a given wave. Each wave's enemies get unique
  // instance IDs so their cards never collide with a previous wave's.
  private buildWaveEnemies(waveIdx: number): BattleCombatant[] {
    const wave = this.waves[waveIdx];
    if (!wave) return [];
    return wave.enemyTeam.slice(0, 3).map((defId, i) => {
      const level = wave.enemyLevels?.[i] ?? 5;
      const def = MONSTER_DEFS[defId];
      if (!def) return null;
      return buildCombatant(`enemy_${waveIdx}_${i}`, defId, level, def.availableMoveIds.slice(0, 4), false, def.name);
    }).filter(Boolean) as BattleCombatant[];
  }

  private drawMonsterCards() {
    const cardW = Battle.CARD_W, cardH = Battle.CARD_H;
    const leftX = Battle.CARD_MARGIN + cardW / 2;
    const startY = Battle.CARD_START_Y;
    const gapY = this.cardGapY;

    // Column headers
    this.add.text(leftX, startY - 26, '◀ DEINE MONSTER', {
      fontSize: '13px', color: '#66ff88', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.add.text(this.enemyColumnX, startY - 26, 'GEGNER ▶', {
      fontSize: '13px', color: '#ff7777', fontStyle: 'bold',
    }).setOrigin(0.5);

    // Player column (left)
    this.playerCombatants.forEach((c, i) => {
      this.drawCard(c, leftX, startY + i * gapY, cardW, cardH, true, false);
    });

    // Enemy column (right)
    this.drawEnemyCards();
  }

  // Draws the current wave's enemy cards on the right column. In a boss fight the
  // lead enemy of the final wave is the boss and is drawn oversized.
  private drawEnemyCards() {
    const cardW = Battle.CARD_W, cardH = Battle.CARD_H;
    const startY = Battle.CARD_START_Y;
    const gapY = this.cardGapY;
    const finalWave = this.waveIndex >= this.waves.length - 1;
    this.enemyCombatants.forEach((c, i) => {
      const isBossUnit = !!this.data_.isBoss && finalWave && i === 0;
      this.drawCard(c, this.enemyColumnX, startY + i * gapY, cardW, cardH, false, isBossUnit);
    });
  }

  // Tears down the current wave's enemy cards (objects, tweens and map entries)
  // so the next wave can be drawn cleanly.
  private destroyEnemyCards() {
    for (const c of this.enemyCombatants) {
      const objs = this.cardObjects.get(c.instanceId);
      if (objs) for (const o of objs) { this.tweens.killTweensOf(o); o.destroy(); }
      this.cardObjects.delete(c.instanceId);
      this.hpBars.delete(c.instanceId);
      this.ultBars.delete(c.instanceId);
      this.energyBars.delete(c.instanceId);
      this.ultReadyIcons.delete(c.instanceId);
      this.nameLabels.delete(c.instanceId);
      this.hpLabels.delete(c.instanceId);
      this.statusContainers.delete(c.instanceId);
      this.cardCenters.delete(c.instanceId);
      this.avatars.delete(c.instanceId);
      this.avatarHomes.delete(c.instanceId);
      this.cardBgs.delete(c.instanceId);
    }
  }

  // Advances to the next enemy wave: clears the beaten line-up and spawns the
  // next, keeping the player's monsters (and their current HP/energy) on field.
  private startNextWave() {
    if (this.state === 'VICTORY' || this.state === 'DEFEAT') return;
    this.waveIndex++;
    this.destroyEnemyCards();
    this.enemyCombatants = this.buildWaveEnemies(this.waveIndex);
    this.drawEnemyCards();
    this.showWaveBanner();
    this.currentAttacker = null;
    this.turnIndex = 0;
    this.turnOrder = [];
    this.time.delayedCall(950, () => this.startRound());
  }

  // Either kicks off the next wave or ends the battle in victory, depending on
  // whether enemy waves remain.
  private finishOrNextWave() {
    if (this.waveIndex < this.waves.length - 1) this.startNextWave();
    else this.endBattle(true);
  }

  // Big centred "WELLE x / N" splash announcing the current wave.
  private showWaveBanner() {
    const width = DESIGN_W, height = DESIGN_H;
    const total = this.waves.length;
    const label = this.data_.isBoss && this.waveIndex >= total - 1
      ? '👑  BOSS  👑'
      : `WELLE ${this.waveIndex + 1} / ${total}`;
    const txt = this.add.text(width / 2, height / 2 - 40, label, {
      fontSize: '44px', color: '#ffce54', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 7,
    }).setOrigin(0.5).setDepth(1200).setScale(0.4);
    this.tweens.add({ targets: txt, scale: 1, duration: 320, ease: 'Back.out' });
    this.tweens.add({
      targets: txt, alpha: 0, duration: 350, delay: 900, ease: 'Quad.in',
      onComplete: () => txt.destroy(),
    });
  }

  private drawCard(c: BattleCombatant, x: number, y: number, w: number, h: number, isPlayer: boolean, boss = false) {
    const def = MONSTER_DEFS[c.defId];
    if (!def) return;

    // Every object created here is tracked so a beaten wave's cards can be torn
    // down before the next wave is drawn.
    const objs: Phaser.GameObjects.GameObject[] = [];

    this.cardCenters.set(c.instanceId, { x, y });

    const bg = this.add.rectangle(x, y, w, h, isPlayer ? 0x1c3a1c : 0x3a1c1c)
      .setStrokeStyle(boss ? 3 : 2, boss ? 0xffcc44 : (isPlayer ? 0x44ff44 : 0xff4444))
      .setInteractive({ useHandCursor: true });
    objs.push(bg);
    this.cardBgs.set(c.instanceId, bg);
    // Tapping a card opens its detail view (level, stats, attacks).
    bg.on('pointerdown', () => this.showCombatantDetail(c));
    bg.on('pointerover', () => bg.setStrokeStyle(3, 0xffffff));
    bg.on('pointerout', () => bg.setStrokeStyle(boss ? 3 : 2, boss ? 0xffcc44 : (isPlayer ? 0x44ff44 : 0xff4444)));

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
    // Boss enemies tower over the rest of the field.
    if (boss) avatar.setScale(1.85);
    objs.push(glow, disc, glyph, avatar);
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

    // A crown floats over a boss so it reads instantly as the main threat.
    if (boss) {
      const crown = this.add.text(avX, avY - 34, '👑', { fontSize: '22px' }).setOrigin(0.5).setDepth(52);
      objs.push(crown);
      this.tweens.add({ targets: crown, y: avY - 40, duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    const textLeft = x - w / 2 + 48;

    // Name + level
    const nameLabel = this.add.text(textLeft, y - h / 2 + 6, boss ? `👑 ${c.name}` : c.name, {
      fontSize: '12px', color: boss ? '#ffd766' : '#ffffff', fontStyle: 'bold',
    }).setOrigin(0, 0);
    objs.push(nameLabel);
    this.nameLabels.set(c.instanceId, nameLabel);

    const lvLabel = this.add.text(x + w / 2 - 6, y - h / 2 + 6, `Lv ${c.level}`, {
      fontSize: '11px', color: '#ffd700', fontStyle: 'bold',
    }).setOrigin(1, 0);
    objs.push(lvLabel);

    // Trait
    const traitName = c.trait !== 'None' ? (TRAITS[c.trait]?.name ?? c.trait) : '';
    const traitLabel = this.add.text(textLeft, y - h / 2 + 22, traitName ? `✦ ${traitName}` : '', {
      fontSize: '10px', color: '#bb99ff',
    }).setOrigin(0, 0);
    objs.push(traitLabel);

    // Status effect badges (icon + remaining rounds, updated each turn).
    const statusContainer = this.add.container(textLeft, y + 4);
    objs.push(statusContainer);
    this.statusContainers.set(c.instanceId, statusContainer);

    // Info hint
    const infoHint = this.add.text(x + w / 2 - 6, y - 2, 'ℹ️', { fontSize: '11px' }).setOrigin(1, 0.5);
    objs.push(infoHint);

    // HP bar background
    const hpBarBg = this.add.rectangle(x, y + h / 2 - 20, w - 10, 12, 0x330000).setOrigin(0.5);
    // HP bar
    const hpBar = this.add.rectangle(x - (w - 10) / 2, y + h / 2 - 20, w - 10, 12, 0x44ff44).setOrigin(0, 0.5);
    objs.push(hpBarBg, hpBar);
    this.hpBars.set(c.instanceId, { bar: hpBar, bg: hpBarBg });

    // HP text
    const hpLabel = this.add.text(x, y + h / 2 - 20, `${c.currentHp}/${c.maxHp}`, {
      fontSize: '10px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);
    objs.push(hpLabel);
    this.hpLabels.set(c.instanceId, hpLabel);

    // Ult charge bar — fills left→right along the bottom of the card.
    const ultBg = this.add.rectangle(x, y + h / 2 - 6, w - 10, 7, 0x332200).setOrigin(0.5);
    const ultBar = this.add.rectangle(x - (w - 10) / 2, y + h / 2 - 6, 0, 7, 0xffd700).setOrigin(0, 0.5);
    objs.push(ultBg, ultBar);
    this.ultBars.set(c.instanceId, { bar: ultBar, bg: ultBg });
    // "⚡" ready icon (hidden until ult is full)
    const ultIcon = this.add.text(x, y + h / 2 - 6, '', {
      fontSize: '10px',
    }).setOrigin(0.5).setDepth(5);
    objs.push(ultIcon);
    this.ultReadyIcons.set(c.instanceId, ultIcon);

    // Energy bar — a thin cyan gauge sitting to the RIGHT of the avatar so it no
    // longer overlaps the monster artwork. Fills left→right; the numeric label
    // sits at the card's right edge.
    const enLeft = x - w / 2 + 48;
    const enW = (x + w / 2 - 34) - enLeft;
    const enBg = this.add.rectangle(enLeft + enW / 2, y - 9, enW, 5, 0x0b2733).setOrigin(0.5);
    const enBar = this.add.rectangle(enLeft, y - 9, enW, 5, 0x33ccff).setOrigin(0, 0.5);
    const enLabel = this.add.text(x + w / 2 - 6, y - 9, `⚡${c.energy}`, {
      fontSize: '9px', color: '#aaf0ff', fontStyle: 'bold',
    }).setOrigin(1, 0.5);
    objs.push(enBg, enBar, enLabel);
    this.energyBars.set(c.instanceId, { bar: enBar, bg: enBg, label: enLabel });

    this.cardObjects.set(c.instanceId, objs);
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

  // Fade out a defeated combatant's avatar completely, then raise a skull.
  private playFaint(instanceId: string) {
    const avatar = this.avatars.get(instanceId);
    if (!avatar || avatar.getData('fainted')) return;
    avatar.setData('fainted', true);

    const ax = avatar.x;
    const ay = avatar.y;

    this.tweens.add({
      targets: avatar,
      alpha: 0,
      scale: 0.5,
      angle: 20,
      duration: 600,
      ease: 'Quad.in',
      onComplete: () => {
        const skull = this.add.text(ax, ay, '💀', { fontSize: '40px' })
          .setOrigin(0.5, 0.5).setDepth(900).setAlpha(0);

        // Rise and appear
        this.tweens.add({
          targets: skull,
          y: ay - 70,
          alpha: 1,
          duration: 500,
          ease: 'Back.out',
          onComplete: () => {
            // Drift upward and vanish
            this.tweens.add({
              targets: skull,
              y: ay - 140,
              alpha: 0,
              duration: 900,
              delay: 300,
              ease: 'Quad.in',
              onComplete: () => skull.destroy(),
            });
          },
        });
      },
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

  private updateEnergyBar(c: BattleCombatant) {
    const eb = this.energyBars.get(c.instanceId);
    if (!eb) return;
    const ratio = Math.max(0, Math.min(1, c.energy / c.maxEnergy));
    this.tweens.add({ targets: eb.bar, width: eb.bg.width * ratio, duration: 300, ease: 'Quad.out' });
    eb.label.setText(`⚡${Math.round(c.energy)}`);
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
        // More waves to come? Spawn the next instead of ending the fight.
        const delay = this.waveIndex < this.waves.length - 1 ? 700 : 600;
        this.time.delayedCall(delay, () => this.finishOrNextWave());
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
        const { damage: dot, heal } = processStatusTick(c);
        if (dot > 0) {
          c.currentHp = Math.max(0, c.currentHp - dot);
          this.updateHpBar(c);
          this.showDamageText(c.instanceId, dot, 0xff8800);
        }
        // Regeneration heals at the top of the round (never past max HP).
        if (heal > 0 && c.currentHp > 0) {
          c.currentHp = Math.min(c.maxHp, c.currentHp + heal);
          this.updateHpBar(c);
          this.showHealText(c.instanceId, heal);
        }
        // Recharge strong moves by one round.
        tickMoveCooldowns(c);
        // Refill a chunk of battle energy (full again within ~2–3 rounds).
        regenEnergy(c);
        this.updateEnergyBar(c);
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
      const ux = width / 2, uy = height - 122;
      const ubtn = this.add.rectangle(ux, uy, 400, 52, 0x664400)
        .setStrokeStyle(4, 0xffd700)
        .setInteractive({ useHandCursor: true });
      const utxt = this.add.text(ux, uy, '⚡  ULTIMA  ⚡  (2 Minigames!)', {
        fontSize: '22px', color: '#ffd700', fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 4,
      }).setOrigin(0.5);
      const pulse = this.tweens.add({ targets: ubtn, alpha: { from: 1, to: 0.65 }, duration: 480, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      const uContainer = this.add.container(0, 0, [ubtn, utxt]);
      this.attackButtons.push(uContainer);
      ubtn.on('pointerdown', () => { pulse.stop(); ubtn.setAlpha(1); this.onUltSelected(attacker); });
      ubtn.on('pointerover', () => ubtn.setFillStyle(0x996600));
      ubtn.on('pointerout', () => ubtn.setFillStyle(0x664400));
    }

    // Big, evenly-centred attack buttons. Sizing/spacing scales to the number
    // of moves so the row stays balanced and the targets are finger-friendly on
    // a landscape phone or iPad.
    const btnW = 168, btnH = 76, gap = 16;
    const count = moves.length;
    const rowStartX = width / 2 - ((count - 1) * (btnW + gap)) / 2;
    moves.forEach((moveId, i) => {
      const moveDef = ATTACKS[moveId];
      if (!moveDef) return;
      const x = rowStartX + i * (btnW + gap);
      const y = height - 56;

      const cdLeft = attacker.moveCooldowns[moveId] ?? 0;
      const onCooldown = cdLeft > 0;
      const maxCd = getMoveCooldown(moveDef);
      const energyCost = getMoveEnergyCost(moveDef);
      const affordable = canAffordMove(attacker, moveDef);
      const disabled = onCooldown || !affordable;

      // Support moves get a calm green tint; offensive moves the usual blue.
      const baseColor = moveDef.support ? 0x2d5a3a : 0x334477;
      const hoverColor = moveDef.support ? 0x3d7a4f : 0x4455aa;
      const strokeColor = moveDef.support ? 0x77dd99 : 0xaabbff;

      const btn = this.add.rectangle(x, y, btnW, btnH, disabled ? 0x2a2a33 : baseColor)
        .setStrokeStyle(3, disabled ? 0x555566 : strokeColor);
      if (!disabled) btn.setInteractive({ useHandCursor: true });

      // Tag AoE / support moves on the name line so their role is obvious.
      const tag = moveDef.support ? '✚ ' : (moveDef.targeting === 'aoe' ? '✺ ' : '');
      const txt = this.add.text(x, y - 14, tag + moveDef.name, {
        fontSize: '18px', color: disabled ? '#777788' : '#ffffff', fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 3,
        align: 'center', wordWrap: { width: btnW - 14 },
      }).setOrigin(0.5);

      // Subtitle: cooldown / energy-shortage warning, else the move's stat line
      // (power or support effect) plus its energy cost if any.
      let sub: string;
      let subColor: string;
      if (onCooldown) {
        sub = `⏳ ${cdLeft} Runde${cdLeft > 1 ? 'n' : ''}`;
        subColor = '#cc8844';
      } else if (!affordable) {
        sub = `⚡${energyCost} · zu wenig`;
        subColor = '#ff8866';
      } else {
        const main = moveDef.support ? this.supportShortLabel(moveDef) : `${moveDef.power}x`;
        const extras: string[] = [];
        if (!moveDef.support && maxCd > 0) extras.push(`CD ${maxCd}`);
        if (energyCost > 0) extras.push(`⚡${energyCost}`);
        sub = extras.length ? `${main} · ${extras.join(' · ')}` : main;
        subColor = moveDef.support ? '#aaffcc' : '#aaccff';
      }
      const powerTxt = this.add.text(x, y + 18, sub, {
        fontSize: '15px', color: subColor, fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0.5);

      const container = this.add.container(0, 0, [btn, txt, powerTxt]);
      this.attackButtons.push(container);

      if (!disabled) {
        btn.on('pointerdown', () => this.showAttackDetail(moveId, attacker));
        btn.on('pointerover', () => btn.setFillStyle(hoverColor));
        btn.on('pointerout', () => btn.setFillStyle(baseColor));
      }
    });

    // ── Energie-Button (Gruppe 3) ──────────────────────────────────────────────
    // Dauerhaft sichtbar. Ist die Energie NICHT voll, lädt er auf ("Aufladen").
    // Ist sie voll, wandelt er sich in einen "Zug überspringen"-Button um, der
    // den Zug beendet, ohne eine Attacke auszuführen.
    const rx = width - 92, ry = height - 56;
    const full = attacker.energy >= attacker.maxEnergy;
    const baseFill = full ? 0x3a2d55 : 0x144a55;
    const overFill = full ? 0x4d3a72 : 0x1d6678;
    const stroke   = full ? 0xb98cff : 0x33ccff;
    const rBtn = this.add.rectangle(rx, ry, 152, btnH, baseFill).setStrokeStyle(3, stroke);
    const rTxt = this.add.text(rx, ry - 14, full ? '⏭️ Zug überspr.' : '🔋 Aufladen', {
      fontSize: '17px', color: full ? '#e7d6ff' : '#bff0ff', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3, align: 'center',
    }).setOrigin(0.5);
    const rSub = this.add.text(rx, ry + 18, full ? 'Energie voll' : `⚡${Math.round(attacker.energy)}/${attacker.maxEnergy}`, {
      fontSize: '15px', color: full ? '#c9b3ff' : '#aaccff', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5);
    const rContainer = this.add.container(0, 0, [rBtn, rTxt, rSub]);
    this.attackButtons.push(rContainer);
    rBtn.setInteractive({ useHandCursor: true });
    rBtn.on('pointerdown', () => full ? this.onSkipTurnSelected(attacker) : this.onRechargeSelected(attacker));
    rBtn.on('pointerover', () => rBtn.setFillStyle(overFill));
    rBtn.on('pointerout', () => rBtn.setFillStyle(baseFill));
  }

  // Gruppe 3 — "Zug überspringen": beendet den Zug, ohne anzugreifen (nur wenn
  // die Energie ohnehin voll ist, also kein Aufladen nötig wäre).
  private onSkipTurnSelected(attacker: BattleCombatant) {
    this.awaitingPlayerInput = false;
    this.clearAttackButtons();
    this.statusText.setText(`⏭️ ${attacker.name} überspringt den Zug.`);
    const home = this.avatarHomes.get(attacker.instanceId);
    if (home) {
      const fx = this.add.text(home.x, home.y - 26, '⏭️ Übersprungen', {
        fontSize: '15px', color: '#c9b3ff', fontStyle: 'bold', stroke: '#000', strokeThickness: 3,
      }).setOrigin(0.5).setDepth(900);
      this.tweens.add({ targets: fx, y: home.y - 56, alpha: 0, duration: 800, ease: 'Quad.out', onComplete: () => fx.destroy() });
    }
    this.turnIndex++;
    this.time.delayedCall(500, () => this.nextTurn());
  }

  // Resolves the "Aufladen" action: spends the whole turn to fully refill the
  // attacker's energy bar, then hands the turn on.
  private onRechargeSelected(attacker: BattleCombatant) {
    this.awaitingPlayerInput = false;
    this.clearAttackButtons();
    rechargeEnergy(attacker);
    this.updateEnergyBar(attacker);
    this.statusText.setText(`🔋 ${attacker.name} lädt Energie auf!`);

    // A quick cyan pop over the attacker so the recharge is felt, not just read.
    const home = this.avatarHomes.get(attacker.instanceId);
    if (home) {
      const fx = this.add.text(home.x, home.y - 26, '⚡ Aufgeladen', {
        fontSize: '15px', color: '#7fe8ff', fontStyle: 'bold', stroke: '#000', strokeThickness: 3,
      }).setOrigin(0.5).setDepth(900);
      this.tweens.add({ targets: fx, y: home.y - 56, alpha: 0, duration: 800, ease: 'Quad.out', onComplete: () => fx.destroy() });
    }

    this.turnIndex++;
    this.time.delayedCall(700, () => this.nextTurn());
  }

  // A compact descriptor for a support move shown on its attack button.
  private supportShortLabel(move: MoveDef): string {
    const s = move.support;
    if (!s) return 'Support';
    switch (s.kind) {
      case 'heal':     return `+${Math.round((s.amount ?? 0.3) * 100)}% HP`;
      case 'cleanse':  return 'Reinigung';
      case 'energize': return `+${s.amount ?? 0} ⚡`;
      case 'atkBuff':  return 'ATK ↑';
      case 'defBuff':  return 'DEF ↑';
      case 'shield':   return `🛡 ${Math.round((s.amount ?? 0.3) * 100)}%`;
      case 'taunt':    return '🚩 Spott';
      case 'regen':    return '💚 Regen';
    }
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

  // Gruppe 3 — Attacken-Detail-Screen: zeigt vor dem Ausführen Name/Beschreibung,
  // Energieverbrauch, Cooldown, Statuseffekte und eine Schadens-Vorschau über den
  // Köpfen der Gegner. "Angreifen" bestätigt, "Zurück" kehrt zur Angriffswahl.
  private showAttackDetail(moveId: string, attacker: BattleCombatant) {
    const moveDef = ATTACKS[moveId];
    if (!moveDef) { this.onMoveSelected(moveId, attacker); return; }
    this.clearAttackButtons();
    this.awaitingPlayerInput = true;
    const width = DESIGN_W, height = DESIGN_H;
    const objs: Phaser.GameObjects.GameObject[] = [];

    // Schadens-Vorschau über den lebenden Gegnern.
    if (!moveDef.support) {
      for (const enemy of this.enemyCombatants.filter(c => c.currentHp > 0)) {
        const home = this.avatarHomes.get(enemy.instanceId);
        if (!home) continue;
        const dmg = this.expectedDamage(attacker, enemy, moveDef.element, moveDef.power);
        const tag = this.add.text(home.x, home.y - 70, `-${dmg}`, {
          fontSize: '22px', color: '#ff6b6b', fontStyle: 'bold', stroke: '#000', strokeThickness: 4,
        }).setOrigin(0.5).setDepth(650);
        objs.push(tag);
      }
    }

    // Detail-Panel unten.
    const panelW = 470, panelH = 188;
    const px = width / 2, py = height - 118;
    const bg = this.add.rectangle(px, py, panelW, panelH, 0x0c0f18, 0.97).setStrokeStyle(2, 0xb98cff).setDepth(640);
    const title = this.add.text(px, py - panelH / 2 + 22,
      `${moveDef.targeting === 'aoe' ? '✺ ' : moveDef.support ? '✚ ' : ''}${moveDef.name}`, {
      fontSize: '22px', color: '#e7d6ff', fontStyle: 'bold', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(641);
    const desc = this.add.text(px, py - 18, moveDef.description || '—', {
      fontSize: '14px', color: '#c8d0e0', align: 'center', wordWrap: { width: panelW - 40 },
    }).setOrigin(0.5).setDepth(641);

    const energyCost = getMoveEnergyCost(moveDef);
    const cd = getMoveCooldown(moveDef);
    const statusName = moveDef.statusEffect
      ? (STATUS_EFFECTS[moveDef.statusEffect.effect]?.name ?? moveDef.statusEffect.effect)
      : null;
    const statLine = [
      moveDef.support ? this.supportShortLabel(moveDef) : `Stärke ${moveDef.power}×`,
      `⚡ ${energyCost}`,
      cd > 0 ? `Cooldown ${cd}` : 'kein Cooldown',
      statusName ? `✦ ${statusName} (ab ${moveDef.statusEffect!.threshold}%)` : null,
    ].filter(Boolean).join('   ·   ');
    const stats = this.add.text(px, py + 24, statLine, {
      fontSize: '14px', color: '#aaccff', fontStyle: 'bold', stroke: '#000', strokeThickness: 2,
      align: 'center', wordWrap: { width: panelW - 40 },
    }).setOrigin(0.5).setDepth(641);

    // Buttons.
    const by = py + panelH / 2 - 24;
    const backBtn = this.add.rectangle(px - 110, by, 150, 40, 0x33303f).setStrokeStyle(2, 0x888899).setDepth(641).setInteractive({ useHandCursor: true });
    const backTxt = this.add.text(px - 110, by, '← Zurück', { fontSize: '16px', color: '#ddddee', fontStyle: 'bold' }).setOrigin(0.5).setDepth(642);
    const goBtn = this.add.rectangle(px + 110, by, 170, 40, 0x2d5a3a).setStrokeStyle(2, 0x77dd99).setDepth(641).setInteractive({ useHandCursor: true });
    const goTxt = this.add.text(px + 110, by, '⚔️ Angreifen', { fontSize: '16px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5).setDepth(642);
    backBtn.on('pointerdown', () => { this.clearAttackButtons(); this.showAttackButtons(attacker); });
    goBtn.on('pointerdown', () => this.onMoveSelected(moveId, attacker));
    backBtn.on('pointerover', () => backBtn.setFillStyle(0x444050));
    backBtn.on('pointerout', () => backBtn.setFillStyle(0x33303f));
    goBtn.on('pointerover', () => goBtn.setFillStyle(0x3d7a4f));
    goBtn.on('pointerout', () => goBtn.setFillStyle(0x2d5a3a));

    objs.push(bg, title, desc, stats, backBtn, backTxt, goBtn, goTxt);
    // Alles in einem Container bündeln, damit clearAttackButtons() es aufräumt.
    this.attackButtons.push(this.add.container(0, 0, objs));
  }

  private onMoveSelected(moveId: string, attacker: BattleCombatant) {
    this.awaitingPlayerInput = false;
    this.clearAttackButtons();
    this.selectedMoveId = moveId;
    const moveDef = ATTACKS[moveId];
    if (!moveDef) { this.turnIndex++; this.nextTurn(); return; }

    // Support moves aid the caster's own team and AoE moves hit every enemy, so
    // neither needs the player to pick a single enemy target — go straight to
    // the minigame. Single-target attacks ask for a target first.
    if (moveDef.support || moveDef.targeting === 'aoe') {
      this.selectedTarget = this.enemyCombatants.find(c => c.currentHp > 0) ?? null;
      this.launchAttackMinigame(attacker);
      return;
    }

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

    // ── Normal attack / support ──────────────────────────────────────────────
    this.state = 'PLAYER_TURN';
    const moveDef = ATTACKS[this.selectedMoveId];
    if (!moveDef) { this.turnIndex++; this.nextTurn(); return; }

    if (moveDef.support) {
      this.applySupport(this.currentAttacker, moveDef, data.score);
    } else {
      // Use the player's chosen target (fall back to first alive enemy if needed).
      // applyAttack expands AoE moves to every enemy on its own.
      const target = (this.selectedTarget && this.selectedTarget.currentHp > 0)
        ? this.selectedTarget
        : this.enemyCombatants.find(c => c.currentHp > 0) ?? null;
      if (!target) { this.endBattle(true); return; }
      this.applyAttack(this.currentAttacker, target, moveDef, data.score);
    }

    // Spend the move's energy cost (no-op for free moves).
    spendEnergy(this.currentAttacker, moveDef);
    this.updateEnergyBar(this.currentAttacker);
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

    // The AI only picks from moves that aren't recharging AND it can afford the
    // energy for. If everything costs too much, it falls back to its free moves.
    const usable = attacker.equippedMoveIds.filter(id => {
      const m = ATTACKS[id];
      return m && (attacker.moveCooldowns[id] ?? 0) === 0 && canAffordMove(attacker, m);
    });
    const freeReady = attacker.equippedMoveIds.filter(id => {
      const m = ATTACKS[id];
      return m && (attacker.moveCooldowns[id] ?? 0) === 0 && getMoveEnergyCost(m) === 0;
    });
    const pool = usable.length > 0 ? usable : (freeReady.length > 0 ? freeReady : attacker.equippedMoveIds);
    const { moveId, accuracy } = generateAiAttack(pool);
    const moveDef = ATTACKS[moveId];
    if (!moveDef) { this.turnIndex++; this.nextTurn(); return; }
    this.enemyUsedMoveIds.add(moveId); // track for post-battle learn

    if (moveDef.support) {
      // Support move: aid the enemy's own team rather than striking the player.
      this.applySupport(attacker, moveDef, accuracy);
    } else {
      const players = this.playerCombatants.filter(c => c.currentHp > 0);
      if (players.length === 0) { this.endBattle(false); return; }
      const target = players[Math.floor(Math.random() * players.length)];
      this.applyAttack(attacker, target, moveDef, accuracy);
    }

    spendEnergy(attacker, moveDef);
    this.updateEnergyBar(attacker);
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

  // Top-left flee button, mirroring the Speed-Up button on the right. Phones
  // have no ESC key, so without this a player can only leave a fight by winning
  // or losing. A first tap arms it ("Sicher?"), a second within 3s flees.
  private createFleeButton() {
    const x = 70, y = 30;
    const bg = this.add.rectangle(x, y, 116, 30, 0x55222d)
      .setStrokeStyle(2, 0xff6677)
      .setInteractive({ useHandCursor: true })
      .setDepth(200);
    const label = this.add.text(x, y, '🏳️ FLIEHEN', {
      fontSize: '13px', color: '#ffccd2', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(201);
    this.fleeBtnBg = bg;
    this.fleeBtnLabel = label;
    bg.on('pointerdown', () => this.onFleePressed());
    bg.on('pointerover', () => { if (!this.fleeArmed) bg.setFillStyle(0x702d3a); });
    bg.on('pointerout',  () => { if (!this.fleeArmed) bg.setFillStyle(0x55222d); });
  }

  private onFleePressed() {
    if (this.fleeArmed) { this.endBattle(false); return; }
    // Arm: ask for confirmation, auto-disarm after a few seconds.
    this.fleeArmed = true;
    this.fleeBtnBg?.setFillStyle(0x992233).setStrokeStyle(2, 0xff99aa);
    this.fleeBtnLabel?.setText('🏳️ SICHER?').setColor('#ffffff');
    this.fleeResetTimer?.remove();
    this.fleeResetTimer = this.time.delayedCall(3000, () => this.disarmFlee());
  }

  private disarmFlee() {
    this.fleeArmed = false;
    this.fleeResetTimer?.remove();
    this.fleeResetTimer = undefined;
    this.fleeBtnBg?.setFillStyle(0x55222d).setStrokeStyle(2, 0xff6677);
    this.fleeBtnLabel?.setText('🏳️ FLIEHEN').setColor('#ffccd2');
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
    return calculateDamage({
      attackerATK: attacker.attackStat,
      movePower: power,
      minigameScore: AUTO_BATTLE_SCORE,
      attackerElement: element,
      defenderElements: targetDef.elements as string[],
      defenderDEF: effectiveDefense(target),
      attackerTrait: attacker.trait,
      attackerStatuses: attacker.statusEffects,
      attackerCurrentHp: attacker.currentHp,
      attackerMaxHp: attacker.maxHp,
      attackerLevel: attacker.level,
      attackerRarityRank: RARITY_RANK[attackerDef.rarity],
      campaignDamageMultiplier: this.campaignDamageMultiplierFor(attacker),
      teamSynergyMultiplier: this.teamSynergyFor(attacker),
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
    // Prefer ready, affordable offensive moves; fall back to free attacks, then
    // to any attack. Support moves are skipped here — they deal no damage.
    const usable = attacker.equippedMoveIds.filter(id => {
      const m = ATTACKS[id];
      return m && !m.support && (attacker.moveCooldowns[id] ?? 0) === 0 && canAffordMove(attacker, m);
    });
    const free = attacker.equippedMoveIds.filter(id => {
      const m = ATTACKS[id];
      return m && !m.support && getMoveEnergyCost(m) === 0;
    });
    const any = attacker.equippedMoveIds.filter(id => ATTACKS[id] && !ATTACKS[id]!.support);
    const pool = usable.length > 0 ? usable : (free.length > 0 ? free : any);
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
      if (!target) { this.finishOrNextWave(); return; }
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
    spendEnergy(attacker, moveDef);
    this.updateEnergyBar(attacker);
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

  // Gruppe 3 — Gut/Böse-Synergien: leitet aus den Fraktionen der LEBENDEN
  // Teamkameraden des Angreifers einen Schadensfaktor ab. Gemischte Teams
  // (gut + böse) erhalten einen Mali, reine Teams einen kleinen Bonus.
  // TODO: Story-/Beziehungs-Events können später Ausnahmen (Buff) gewähren —
  //       z. B. "Monster A liebt Monster B" → mixedTeamPenalty aufheben.
  private teamSynergyFor(attacker: BattleCombatant): number {
    const side = attacker.isPlayer ? this.playerCombatants : this.enemyCombatants;
    const factions: Faction[] = side
      .filter(c => c.currentHp > 0)
      .map(c => {
        const d = MONSTER_DEFS[c.defId];
        return d ? getMonsterFaction(d) : 'Neutral';
      });
    return mixedTeamPenalty(factions) * pureTeamBonus(factions);
  }

  private applyAttack(attacker: BattleCombatant, primaryTarget: BattleCombatant, move: MoveDef, score: number) {
    // Blind: a blinded attacker may miss the whole action.
    if (attacker.statusEffects.some(e => e.effect === 'Blind') && Math.random() < 0.3) {
      this.log(`${attacker.name} missed!`);
      return;
    }

    // Resolve the target list: AoE moves strike every living foe; single-target
    // moves hit only the chosen one.
    const opponents = attacker.isPlayer ? this.enemyCombatants : this.playerCombatants;
    // Taunt: a single-target attack is forced onto a taunting foe (Cold Blood /
    // Pierce would bypass this, but those traits aren't wired yet).
    let actualPrimary = primaryTarget;
    if (move.targeting !== 'aoe') {
      const taunter = findTaunter(opponents);
      if (taunter && taunter !== primaryTarget) {
        actualPrimary = taunter;
        this.log(`${taunter.name} fordert den Angriff heraus!`);
      }
    }
    const targets = move.targeting === 'aoe'
      ? opponents.filter(c => c.currentHp > 0)
      : [actualPrimary].filter(c => c.currentHp > 0);
    if (targets.length === 0) return;

    // One lunge toward the enemy side no matter how many foes are struck.
    this.playLunge(attacker.instanceId, attacker.isPlayer ? 'right' : 'left');

    let totalDealt = 0;
    for (const target of targets) {
      totalDealt += this.applyAttackHit(attacker, target, move, score, targets.length > 1);
    }

    if (move.targeting === 'aoe') {
      this.log(`${attacker.name} → ${move.name}: ${totalDealt} Schaden an ${targets.length} Gegnern (${Math.floor(score)}%)`);
    }

    // Ult charge and XP are awarded once, from the combined damage dealt.
    gainUltCharge(attacker, totalDealt);
    this.updateUltBar(attacker);
    if (attacker.isPlayer && totalDealt > 0) {
      const store = useGameStore.getState();
      if (store.monsters[attacker.instanceId]) {
        store.addXpToMonster(attacker.instanceId, Math.floor(totalDealt / 10));
      }
    }
  }

  // Resolves a single damage instance against one target: damage maths, visuals,
  // status application and (for single hits) logging. Returns the damage dealt.
  private applyAttackHit(attacker: BattleCombatant, target: BattleCombatant, move: MoveDef, score: number, isAoe: boolean): number {
    const attackerDef = MONSTER_DEFS[attacker.defId];
    const targetDef = MONSTER_DEFS[target.defId];

    const dmg = calculateDamage({
      attackerATK: attacker.attackStat,
      movePower: move.power,
      minigameScore: score,
      attackerElement: move.element,
      defenderElements: targetDef.elements as string[],
      defenderDEF: effectiveDefense(target),
      attackerTrait: attacker.trait,
      attackerStatuses: attacker.statusEffects,
      attackerCurrentHp: attacker.currentHp,
      attackerMaxHp: attacker.maxHp,
      attackerLevel: attacker.level,
      attackerRarityRank: RARITY_RANK[attackerDef.rarity],
      campaignDamageMultiplier: this.campaignDamageMultiplierFor(attacker),
      teamSynergyMultiplier: this.teamSynergyFor(attacker),
    });

    // Echo trait: hit twice at 60%
    let totalDmg = dmg;
    if (attacker.trait === 'Echo') {
      totalDmg = Math.floor(dmg * 0.6) * 2;
    }

    // Vulnerable raises the damage the target takes by 50%.
    totalDmg = Math.floor(totalDmg * incomingDamageMultiplier(target));

    // A Shield soaks damage up to its remaining strength before HP is touched.
    const { toHp, absorbed } = applyShield(target, totalDmg);
    totalDmg = toHp;
    if (absorbed > 0) this.showSupportText(target.instanceId, `🛡 -${absorbed}`, '#9fe9dc');

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
        // Mania: instead of being debuffed, the holder goes manic — gaining a
        // small ATK/DEF buff for 2 rounds. The price is steep: it starts to
        // decay and rots away within 2 rounds (50% max HP per round).
        addStatusEffect(target, 'AtkUp', 2);
        addStatusEffect(target, 'DefUp', 2);
        addStatusEffect(target, 'Decay', 2);
        this.log(`${target.name} goes MANIC — but begins to decay!`);
      } else {
        // addStatusEffect refreshes an existing effect instead of stacking
        // a duplicate, so each effect only ever appears once.
        addStatusEffect(target, effect);
        this.log(`${target.name} ist von ${statusName} betroffen!`);
      }
    }

    this.updateStatusDisplay(target);
    // AoE hits are summarised by the caller; single hits log their own line.
    if (!isAoe) {
      this.log(`${attacker.name} → ${target.name}: ${move.name} for ${totalDmg} dmg (${Math.floor(score)}% acc)`);
    }
    return totalDmg;
  }

  // Resolves a support move: heals, cleanses, restores energy or buffs the
  // caster's own side. The minigame `score` scales how much HP/energy is given.
  private applySupport(caster: BattleCombatant, move: MoveDef, score: number) {
    const s = move.support;
    if (!s) return;
    const allies = caster.isPlayer ? this.playerCombatants : this.enemyCombatants;
    const living = allies.filter(a => a.currentHp > 0);
    const targets = s.team ? living : [caster];
    // A weak result still does something; a strong one delivers the full effect.
    const scoreFactor = 0.5 + Math.min(1, Math.max(0, score) / 100) * 0.5; // 0.5 – 1.0
    const burstColor = caster.isPlayer ? 0x66ff99 : 0xff9966;

    for (const ally of targets) {
      switch (s.kind) {
        case 'heal': {
          const heal = Math.max(1, Math.floor(ally.maxHp * (s.amount ?? 0.3) * scoreFactor));
          ally.currentHp = Math.min(ally.maxHp, ally.currentHp + heal);
          this.updateHpBar(ally);
          this.showHealText(ally.instanceId, heal);
          break;
        }
        case 'cleanse': {
          const had = ally.statusEffects.some(e => NEGATIVE_STATUS.includes(e.effect));
          ally.statusEffects = ally.statusEffects.filter(e => !NEGATIVE_STATUS.includes(e.effect));
          this.updateStatusDisplay(ally);
          if (had) this.showSupportText(ally.instanceId, '✨ Gereinigt', '#aaffff');
          break;
        }
        case 'energize': {
          const amt = Math.max(1, Math.floor((s.amount ?? 30) * scoreFactor));
          ally.energy = Math.min(ally.maxEnergy, ally.energy + amt);
          this.updateEnergyBar(ally);
          this.showSupportText(ally.instanceId, `+${amt} ⚡`, '#aaf0ff');
          break;
        }
        case 'atkBuff': {
          addStatusEffect(ally, 'AtkUp');
          this.updateStatusDisplay(ally);
          this.showSupportText(ally.instanceId, 'ATK ↑', '#88ffaa');
          break;
        }
        case 'defBuff': {
          addStatusEffect(ally, 'DefUp');
          this.updateStatusDisplay(ally);
          this.showSupportText(ally.instanceId, 'DEF ↑', '#88ccff');
          break;
        }
        case 'shield': {
          // Shield strength = fraction of the ally's max HP, scaled by the score.
          const amount = Math.max(1, Math.floor(ally.maxHp * (s.amount ?? 0.3) * scoreFactor));
          addStatusEffect(ally, 'Shield', 2, amount);
          this.updateStatusDisplay(ally);
          this.showSupportText(ally.instanceId, `🛡 ${amount}`, '#9fe9dc');
          break;
        }
        case 'taunt': {
          addStatusEffect(ally, 'Taunt', 2);
          this.updateStatusDisplay(ally);
          this.showSupportText(ally.instanceId, '🚩 Spott', '#d7aef0');
          break;
        }
        case 'regen': {
          addStatusEffect(ally, 'Regen', 3);
          this.updateStatusDisplay(ally);
          this.showSupportText(ally.instanceId, '💚 Regen', '#8fffae');
          break;
        }
      }
      const ctr = this.cardCenters.get(ally.instanceId);
      if (ctr) this.spawnImpactBurst(ctr.x, ctr.y, burstColor);
    }

    this.log(`${caster.name} setzt ${move.name} ein.`);
  }

  // Floating green "+N" heal number above an ally's card.
  private showHealText(instanceId: string, amount: number) {
    const center = this.cardCenters.get(instanceId);
    if (!center) return;
    const txt = this.add.text(center.x, center.y - 8, `+${amount}`, {
      fontSize: '30px', color: '#66ff99', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(900);
    txt.setScale(0.4);
    this.tweens.add({ targets: txt, scale: 1.15, duration: 160, yoyo: true, ease: 'Quad.out' });
    this.tweens.add({
      targets: txt, y: center.y - 55, alpha: 0, duration: 1000, ease: 'Quad.in',
      onComplete: () => txt.destroy(),
    });
  }

  // Small floating label above an ally's card for non-heal support effects.
  private showSupportText(instanceId: string, label: string, color: string) {
    const center = this.cardCenters.get(instanceId);
    if (center) this.showEffectivenessText(center.x, center.y - 30, label, color);
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
    const effectiveDef = effectiveDefense(target);

    const avgScore = (score1 + score2) / 2;
    const ultBaseDmg = calculateDamage({
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
      teamSynergyMultiplier: this.teamSynergyFor(attacker),
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

    // Vulnerable amplifies the ULT and a Shield soaks part of it, just like a
    // normal hit, so these effects stay consistent across every damage path.
    let dmg = ultBaseDmg;
    dmg = Math.floor(dmg * incomingDamageMultiplier(target));
    const ultShield = applyShield(target, dmg);
    dmg = ultShield.toHp;
    if (ultShield.absorbed > 0) this.showSupportText(target.instanceId, `🛡 -${ultShield.absorbed}`, '#9fe9dc');

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
    // Gruppe 4 — Bestiarium: jede gekämpfte Gegner-Spezies (alle Wellen) zählen,
    // damit mehr Kämpfe gegen ein Monster dessen Lore-Einträge freischalten.
    store.recordBestiaryEncounter(this.waves.flatMap(w => w.enemyTeam));

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
    // Gruppe 8 — Glücksrad-Politur: durchweg großzügigere Preise (höhere
    // Multiplikatoren + mehr Diamanten), Jackpot bleibt selten.
    const segments: Array<{ label: string; color: number; gold: number; xp: number; dia: number; weight: number }> = [
      { label: '🪙 ×1.5',    color: 0x8a6d3b, gold: 1.5, xp: 1, dia: 0, weight: 16 },
      { label: '⭐ XP ×2',   color: 0x2e6da4, gold: 1.2, xp: 2, dia: 1, weight: 14 },
      { label: '🪙 ×2.5',    color: 0xd4a017, gold: 2.5, xp: 1, dia: 0, weight: 13 },
      { label: '💎 +8',      color: 0x6f42c1, gold: 1.0, xp: 1, dia: 8, weight: 10 },
      { label: '🎰 JACKPOT', color: 0xc0392b, gold: 5.0, xp: 3, dia: 25, weight: 4 },
      { label: '🪙 ×2',      color: 0xb8860b, gold: 2.0, xp: 1, dia: 0, weight: 15 },
      { label: '⭐ XP ×3',   color: 0x1f78b4, gold: 1.2, xp: 3, dia: 4, weight: 10 },
      { label: '💎 +4',      color: 0x8e44ad, gold: 1.0, xp: 1, dia: 4, weight: 18 },
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
          // Diamonds are kept scarce: scale the combined payout down.
          const dia = Math.round((baseDiamonds + seg.dia) * DIAMOND_REWARD_SCALE);

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
    this.fleeResetTimer?.remove();
    this.fleeResetTimer = undefined;
  }
}
