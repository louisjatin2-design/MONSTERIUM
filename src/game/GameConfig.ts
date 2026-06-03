import Phaser from 'phaser';
import { Boot } from '@game/scenes/Boot';
import { Preload } from '@game/scenes/Preload';
import { MainMenu } from '@game/scenes/MainMenu';
import { Island } from '@game/scenes/Island';
import { Battle } from '@game/scenes/Battle';
import { TimingBarScene } from '@game/scenes/minigames/TimingBarScene';
import { AimClickScene } from '@game/scenes/minigames/AimClickScene';
import { ButtonSequenceScene } from '@game/scenes/minigames/ButtonSequenceScene';
import { MashButtonScene } from '@game/scenes/minigames/MashButtonScene';
import { SwipePathScene } from '@game/scenes/minigames/SwipePathScene';
import { RhythmScene } from '@game/scenes/minigames/RhythmScene';

export const GameConfig: Phaser.Types.Core.GameConfig = {
  // Prefer WebGL (enables lighting, bloom & post-FX) with a Canvas fallback.
  type: Phaser.AUTO,
  width: 1280,
  height: 720,
  // Sky-blue base so any letterbox margin blends with the habitat's sky
  // instead of showing as black bars.
  backgroundColor: '#5ab4e0',
  parent: 'game-container',
  scene: [Boot, Preload, MainMenu, Island, Battle, TimingBarScene, AimClickScene, ButtonSequenceScene, MashButtonScene, SwipePathScene, RhythmScene],
  scale: {
    // RESIZE: the canvas always fills its parent (the full screen) in BOTH
    // portrait and landscape — no letterbox bars. Scenes lay themselves out
    // from this.scale.width/height, and the Island camera picks a fit-zoom so
    // the world frames nicely at any aspect ratio.
    mode: Phaser.Scale.RESIZE,
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
    antialias: true,
    antialiasGL: true,
    pixelArt: false,
    roundPixels: false,
    powerPreference: 'high-performance',
  },
};
