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

export const GameConfig: Phaser.Types.Core.GameConfig = {
  // Prefer WebGL (enables lighting, bloom & post-FX) with a Canvas fallback.
  type: Phaser.AUTO,
  width: 1280,
  height: 720,
  // Sky-blue base so any letterbox margin blends with the habitat's sky
  // instead of showing as black bars.
  backgroundColor: '#5ab4e0',
  parent: 'game-container',
  scene: [Boot, Preload, MainMenu, Island, Battle, TimingBarScene, AimClickScene, ButtonSequenceScene, MashButtonScene, SwipePathScene],
  scale: {
    // NONE: we drive the canvas size ourselves (see PhaserInit.fitToDevice) so we
    // can render the backing buffer at the FULL device-pixel resolution — RESIZE
    // mode only ever sizes the canvas to CSS pixels, which on a high-DPR phone
    // (devicePixelRatio 2–3×) the browser then upscales, leaving the battle and
    // every sprite looking blurry / pixelated. We instead make the buffer
    // width = cssWidth × DPR and CSS-scale it back down, so it stays razor-sharp
    // while still filling the whole screen in BOTH portrait and landscape.
    mode: Phaser.Scale.NONE,
    autoCenter: Phaser.Scale.NO_CENTER,
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
