import Phaser from 'phaser';
import { EventBus, GameEvents } from '@game/EventBus';
import { useGameStore } from '@store/gameStore';
import { MONSTER_DEFS } from '@data/monsters';
import { ATTACKS } from '@data/attacks';
import { RARITY_RANK, RARITY_HATCH_TIME_SEC } from '@data/rarities';
import { ELEMENT_CSS_COLORS } from '@data/elements';
import {
  resolveTurnOrder, calculateDamage, generateAiAttack,
  processStatusTick, buildCombatant,
} from '@systems/BattleSystem';
import type { BattleCombatant, MoveDef } from '@gtypes/game';

type BattleState = 'INTRO' | 'PLAYER_TURN' | 'MINIGAME_ACTIVE' | 'AI_TURN' | 'VICTORY' | 'DEFEAT';

interface BattleData {
  playerTeam: string[];   // instance IDs
  enemyTeam: string[];    // instance IDs or def IDs for story
  enemyLevels?: number[];
  isTutorial?: boolean;
  rewardGold?: number;
  rewardXp?: number;
  rewardMonsterDefId?: string;
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
  private nameLabels: Map<string, Phaser.GameObjects.Text> = new Map();
  private attackButtons: Phaser.GameObjects.Container[] = [];
  private statusText!: Phaser.GameObjects.Text;
  private logText!: Phaser.GameObjects.Text;

  constructor() { super('Battle'); }

  init(data: BattleData) {
    this.data_ = data;
  }

  create() {
    const { width, height } = this.scale;

    // Background
    this.add.rectangle(width / 2, height / 2, width, height, 0x0a0a2a);

    // Title
    this.add.text(width / 2, 20, 'BATTLE', {
      fontSize: '24px', color: '#ffd700', fontStyle: 'bold',
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

  private drawMonsterCards() {
    const { width, height } = this.scale;
    const cardW = 120, cardH = 80;
    const padding = 20;

    // Enemy row (top)
    this.enemyCombatants.forEach((c, i) => {
      const x = padding + cardW / 2 + i * (cardW + padding);
      const y = 70 + cardH / 2;
      this.drawCard(c, x, y, cardW, cardH, false);
    });

    // Player row (bottom)
    this.playerCombatants.forEach((c, i) => {
      const x = padding + cardW / 2 + i * (cardW + padding);
      const y = height - 200 - cardH / 2;
      this.drawCard(c, x, y, cardW, cardH, true);
    });
  }

  private drawCard(c: BattleCombatant, x: number, y: number, w: number, h: number, isPlayer: boolean) {
    const def = MONSTER_DEFS[c.defId];
    if (!def) return;

    const bg = this.add.rectangle(x, y, w, h, isPlayer ? 0x224422 : 0x442222)
      .setStrokeStyle(2, isPlayer ? 0x44ff44 : 0xff4444);

    // Name
    const nameLabel = this.add.text(x, y - h / 2 + 8, c.name, {
      fontSize: '11px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5, 0);
    this.nameLabels.set(c.instanceId, nameLabel);

    // HP bar background
    const hpBarBg = this.add.rectangle(x, y + h / 2 - 12, w - 8, 10, 0x330000).setOrigin(0.5);
    // HP bar
    const hpBar = this.add.rectangle(x - (w - 8) / 2, y + h / 2 - 12, w - 8, 10, 0x44ff44).setOrigin(0, 0.5);
    this.hpBars.set(c.instanceId, { bar: hpBar, bg: hpBarBg });

    // HP text
    this.add.text(x, y + h / 2 - 12, `${c.currentHp}/${c.maxHp}`, {
      fontSize: '9px', color: '#ffffff',
    }).setOrigin(0.5);

    // Element indicator
    this.add.text(x, y, def.elements[0], {
      fontSize: '10px',
      color: '#ffffff',
      backgroundColor: '#00000066',
      padding: { x: 2, y: 1 },
    }).setOrigin(0.5);
  }

  private updateHpBar(c: BattleCombatant) {
    const bars = this.hpBars.get(c.instanceId);
    if (!bars) return;
    const ratio = Math.max(0, c.currentHp / c.maxHp);
    const barBg = bars.bg;
    bars.bar.width = (barBg.width) * ratio;
    const color = ratio > 0.5 ? 0x44ff44 : ratio > 0.25 ? 0xffaa00 : 0xff2200;
    bars.bar.setFillStyle(color);
  }

  private startRound() {
    const allCombatants = [...this.playerCombatants, ...this.enemyCombatants];
    this.turnOrder = resolveTurnOrder(allCombatants);
    this.turnIndex = 0;
    this.nextTurn();
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

    // Refresh turn order (dead monsters fall out)
    const alive = [...this.playerCombatants, ...this.enemyCombatants].filter(c => c.currentHp > 0);
    this.turnOrder = resolveTurnOrder(alive);

    if (this.turnIndex >= this.turnOrder.length) {
      // New round
      this.turnIndex = 0;
      // Process DOT for all alive
      for (const c of alive) {
        const dot = processStatusTick(c);
        if (dot > 0) {
          c.currentHp = Math.max(0, c.currentHp - dot);
          this.updateHpBar(c);
          this.showDamageText(c.instanceId, dot, 0xff8800);
        }
      }
      if (checkVictory()) return;
    }

    this.currentAttacker = this.turnOrder[this.turnIndex];
    if (!this.currentAttacker || this.currentAttacker.currentHp <= 0) {
      this.turnIndex++;
      this.nextTurn();
      return;
    }

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
  }

  private onMoveSelected(moveId: string, attacker: BattleCombatant) {
    this.clearAttackButtons();
    this.selectedMoveId = moveId;
    const moveDef = ATTACKS[moveId];
    if (!moveDef) { this.turnIndex++; this.nextTurn(); return; }

    const def = MONSTER_DEFS[attacker.defId];
    const rarityRank = RARITY_RANK[def.rarity];

    this.state = 'MINIGAME_ACTIVE';
    this.statusText.setText(`Executing ${moveDef.name}...`);

    this.scene.launch(
      moveDef.minigameType === 'TimingBar' ? 'TimingBarScene' :
      moveDef.minigameType === 'AimClick' ? 'AimClickScene' :
      'ButtonSequenceScene',
      { moveDef, rarityRank }
    );
    this.scene.bringToTop(
      moveDef.minigameType === 'TimingBar' ? 'TimingBarScene' :
      moveDef.minigameType === 'AimClick' ? 'AimClickScene' :
      'ButtonSequenceScene'
    );
    this.scene.pause();
  }

  private onMinigameResult = (data: { score: number }) => {
    this.scene.resume();
    this.state = 'PLAYER_TURN';

    if (!this.currentAttacker) { this.turnIndex++; this.nextTurn(); return; }

    const moveDef = ATTACKS[this.selectedMoveId];
    if (!moveDef) { this.turnIndex++; this.nextTurn(); return; }

    // Pick random enemy target
    const enemies = this.enemyCombatants.filter(c => c.currentHp > 0);
    if (enemies.length === 0) { this.endBattle(true); return; }
    const target = enemies[Math.floor(Math.random() * enemies.length)];

    this.applyAttack(this.currentAttacker, target, moveDef, data.score);
    this.turnIndex++;
    this.time.delayedCall(800, () => this.nextTurn());
  };

  private doAiTurn(attacker: BattleCombatant) {
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

    this.log(`${attacker.name} → ${target.name}: ${move.name} for ${totalDmg} dmg (${Math.floor(score)}% acc)`);

    // Reward XP to player monsters for dealing damage
    if (attacker.isPlayer) {
      const store = useGameStore.getState();
      const monsterInstance = store.monsters[attacker.instanceId];
      if (monsterInstance) {
        store.addXpToMonster(attacker.instanceId, Math.floor(totalDmg / 10));
      }
    }
  }

  private showDamageText(instanceId: string, dmg: number, color: number) {
    const bars = this.hpBars.get(instanceId);
    if (!bars) return;
    const x = bars.bar.x + bars.bar.width;
    const y = bars.bar.y - 20;
    const txt = this.add.text(x, y, `-${dmg}`, {
      fontSize: '20px',
      color: '#' + color.toString(16).padStart(6, '0'),
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);
    this.tweens.add({
      targets: txt,
      y: y - 40,
      alpha: 0,
      duration: 800,
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
      const rewardGold = this.data_.rewardGold ?? 200;
      const rewardXp = this.data_.rewardXp ?? 300;
      useGameStore.getState().addGold(rewardGold);
      useGameStore.getState().addPlayerXp(rewardXp);
      useGameStore.getState().addTrophies(20);

      if (this.data_.rewardMonsterDefId) {
        const def = MONSTER_DEFS[this.data_.rewardMonsterDefId];
        if (def) {
          useGameStore.getState().addEgg(this.data_.rewardMonsterDefId, 30);
        }
      }

      this.add.text(width / 2, height / 2 + 10, `+${rewardGold} Gold  +${rewardXp} XP`, {
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
