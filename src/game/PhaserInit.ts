import Phaser from 'phaser';
import { GameConfig } from './GameConfig';

// Cap the device-pixel-ratio we render at. 3× already looks pixel-perfect on
// phones; rendering a full-screen WebGL scene any sharper mostly just burns GPU
// and battery on the handful of 3.5–4× panels out there.
const MAX_DPR = 3;

export function startPhaser(parentId: string): Phaser.Game {
  const game = new Phaser.Game({ ...GameConfig, parent: parentId });

  const getParent = (): HTMLElement | null =>
    (game.canvas?.parentElement as HTMLElement | null) ?? document.getElementById(parentId);

  // Size the canvas so the WebGL backing buffer is the full device resolution
  // (crisp) while the CSS box still fills the screen. We feed Phaser a game size
  // of cssSize × DPR and a zoom of 1/DPR: the buffer ends up at device pixels and
  // the displayed canvas back at css pixels. Scenes read this.scale.width/height,
  // so the battle / menu / minigame cameras simply fit-zoom into the larger space
  // and every control stays on-screen and reachable in portrait AND landscape.
  const fitToDevice = () => {
    const el = getParent();
    if (!el || !game.scale) return;

    const cssW = Math.max(1, el.clientWidth);
    const cssH = Math.max(1, el.clientHeight);
    const dpr = Math.min(Math.max(window.devicePixelRatio || 1, 1), MAX_DPR);

    const bufferW = Math.round(cssW * dpr);
    const bufferH = Math.round(cssH * dpr);

    game.scale.setZoom(1 / dpr);
    game.scale.resize(bufferW, bufferH);

    // Force the CSS box to fill the parent regardless of Phaser's computed inline
    // style — the high-res buffer is then displayed 1 device-pixel to 1 screen
    // pixel. (Pointer input maps via getBoundingClientRect, so this stays exact.)
    const canvas = game.canvas;
    if (canvas) {
      canvas.style.width = '100%';
      canvas.style.height = '100%';
    }
  };

  // Coalesce rapid resize bursts (address-bar show/hide, keyboard) into one fit.
  let rafId = 0;
  const scheduleFit = () => {
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(fitToDevice);
  };

  // First real fit once the game has booted (canvas exists), then on every
  // viewport change. orientationchange needs a delay for the new size to settle.
  game.events.once('ready', fitToDevice);
  window.addEventListener('resize', scheduleFit);
  window.addEventListener('orientationchange', () => setTimeout(fitToDevice, 250));
  if (window.visualViewport) window.visualViewport.addEventListener('resize', scheduleFit);

  game.events.once('destroy', () => {
    cancelAnimationFrame(rafId);
    window.removeEventListener('resize', scheduleFit);
    window.removeEventListener('orientationchange', fitToDevice);
    if (window.visualViewport) window.visualViewport.removeEventListener('resize', scheduleFit);
  });

  return game;
}
