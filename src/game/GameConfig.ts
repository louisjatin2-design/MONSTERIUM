import Phaser from 'phaser';
import { Boot } from '@game/scenes/Boot';
import { Preload } from '@game/scenes/Preload';
import { MainMenu } from '@game/scenes/MainMenu';
import { Island } from '@game/scenes/Island';
import { Battle } from '@game/scenes/Battle';
import { TimingBarScene } from '@game/scenes/minigames/TimingBarScene';
import { AimClickScene } from '@game/scenes/minigames/AimClickScene';
import { ButtonSequenceScene } from '@game/scenes/minigames/ButtonSequenceScene';

export const GameConfig: Phaser.Types.Core.GameConfig = {
  // Force Canvas renderer — WebGL on iOS Safari is unreliable
  type: Phaser.CANVAS,
  width: 1280,
  height: 720,
  backgroundColor: '#0a0a1a',
  parent: 'game-container',
  scene: [Boot, Preload, MainMenu, Island, Battle, TimingBarScene, AimClickScene, ButtonSequenceScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1280,
    height: 720,
  },
  input: {
    keyboard: true,
    mouse: true,
    touch: true,
  },
  render: {
    antialias: false,
    pixelArt: false,
  },
};
