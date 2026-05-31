import Phaser from 'phaser';
import { MONSTER_DEFS } from '@data/monsters';
import { ELEMENT_COLORS } from '@data/elements';
import { RARITY_COLORS } from '@data/rarities';
import type { Egg } from '@gtypes/game';

// An egg resting on a small pedestal beside the hatchery, with a floating
// countdown label. Pulses gold and wobbles once it is ready to hatch.
export class EggSprite extends Phaser.GameObjects.Container {
  eggId: string;
  hitRadius = 22;
  private timerText: Phaser.GameObjects.Text;
  private egg: Phaser.GameObjects.Container;
  private ready = false;
  private readyTween?: Phaser.Tweens.Tween;
  private bobTween?: Phaser.Tweens.Tween;
  private glow?: Phaser.GameObjects.Ellipse;

  constructor(scene: Phaser.Scene, eggData: Egg, x: number, y: number) {
    super(scene, x, y);
    this.eggId = eggData.id;

    const def = MONSTER_DEFS[eggData.monsterDefId];
    const elColor = (def && (ELEMENT_COLORS as Record<string, number>)[def.elements[0]]) || 0xeeeeee;
    const rarityColor = def ? parseInt(RARITY_COLORS[def.rarity].replace('#', ''), 16) : 0xffffff;

    // Pedestal (small stone column).
    const ped = scene.add.graphics();
    ped.fillStyle(0x000000, 0.2); ped.fillEllipse(0, 16, 30, 10);          // shadow
    ped.fillStyle(0x9a9488, 1);  ped.fillRect(-11, 2, 22, 14);             // column
    ped.fillStyle(0xb8ad97, 1);  ped.fillEllipse(0, 2, 26, 9);             // top
    ped.fillStyle(0x807a6e, 1);  ped.fillEllipse(0, 16, 24, 8);            // base
    ped.lineStyle(1.5, 0x000000, 0.25); ped.strokeRect(-11, 2, 22, 14);

    // Egg body (bobs).
    this.egg = scene.add.container(0, -10);
    const eg = scene.add.graphics();
    // shell
    eg.fillStyle(elColor, 1);
    eg.fillEllipse(0, 0, 22, 28);
    eg.fillStyle(0xffffff, 0.22);
    eg.fillEllipse(-4, -6, 9, 13);                                         // highlight
    // spots in rarity color
    eg.fillStyle(rarityColor, 0.85);
    eg.fillEllipse(4, 3, 5, 4);
    eg.fillEllipse(-3, 8, 4, 3);
    eg.fillEllipse(6, -6, 3.5, 3);
    eg.lineStyle(2, 0x000000, 0.3);
    eg.strokeEllipse(0, 0, 22, 28);
    this.egg.add(eg);

    // Countdown label above the egg.
    this.timerText = scene.add.text(0, -34, '', {
      fontSize: '11px', color: '#ffffff', fontStyle: 'bold',
      stroke: '#1a0a30', strokeThickness: 3,
      backgroundColor: '#00000066', padding: { x: 4, y: 1 },
    }).setOrigin(0.5, 1);

    this.add([ped, this.egg, this.timerText]);
    scene.add.existing(this);

    // Gentle idle bob.
    this.bobTween = scene.tweens.add({
      targets: this.egg, y: -14, duration: 1100, yoyo: true, repeat: -1,
      ease: 'Sine.easeInOut', delay: Math.random() * 500,
    });

    this.once(Phaser.GameObjects.Events.DESTROY, () => {
      this.bobTween?.stop();
      this.readyTween?.stop();
    });
  }

  // Called each frame/second by Island to refresh the countdown.
  updateTimer(remainingMs: number) {
    const ready = remainingMs <= 0;
    if (ready && !this.ready) this.enterReadyState();
    if (!ready) {
      this.timerText.setText('⏳ ' + formatTime(Math.ceil(remainingMs / 1000)));
    } else {
      this.timerText.setText('✨ Bereit!');
    }
  }

  private enterReadyState() {
    this.ready = true;
    this.timerText.setColor('#ffe27a');
    // Rocking wobble to signal "tap me".
    this.readyTween = this.scene.tweens.add({
      targets: this.egg, angle: { from: -8, to: 8 },
      duration: 320, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
    // Add a glowing ground halo (real bloom on WebGL).
    if (this.scene.sys.game.renderer.type === Phaser.WEBGL) {
      this.glow = this.scene.add.ellipse(0, -10, 40, 40, 0xffe27a, 0.4);
      this.addAt(this.glow, 1);
      this.scene.tweens.add({ targets: this.glow, alpha: 0.15, scale: 1.2, duration: 700, yoyo: true, repeat: -1 });
    }
  }

  isReady(): boolean { return this.ready; }

  // Play a quick hatch burst, then destroy this sprite.
  playHatchAnimation(onDone: () => void) {
    this.readyTween?.stop();
    this.bobTween?.stop();
    const scene = this.scene;
    // Shake → pop → puff of light particles.
    scene.tweens.add({
      targets: this.egg, angle: { from: -14, to: 14 }, duration: 90,
      yoyo: true, repeat: 4,
      onComplete: () => {
        // burst
        if (scene.textures.exists('fx-ember')) {
          const p = scene.add.particles(this.x, this.y - 10, 'fx-ember', {
            lifespan: 600, speed: { min: 60, max: 140 }, scale: { start: 0.6, end: 0 },
            alpha: { start: 1, end: 0 }, quantity: 20, emitting: false,
            tint: 0xffe9a8,
            blendMode: scene.sys.game.renderer.type === Phaser.WEBGL ? 'ADD' : 'NORMAL',
          });
          p.explode(20);
          scene.time.delayedCall(700, () => p.destroy());
        }
        scene.tweens.add({
          targets: this, scale: 1.3, alpha: 0, duration: 260, ease: 'Back.easeIn',
          onComplete: () => { onDone(); this.destroy(); },
        });
      },
    });
  }
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}
