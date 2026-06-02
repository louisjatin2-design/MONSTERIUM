import Phaser from 'phaser';
import { DESIGN_W, DESIGN_H } from '@game/scenes/viewport';

// ─────────────────────────────────────────────────────────────────────────────
// Shared look-and-feel for the attack minigames.
//
// All five minigames lay their content out inside the fixed 1280×720 design
// space, which is then fitted onto the live viewport. On a desktop monitor that
// space fills a big screen, so small 14–28px text reads fine — but on a phone
// or iPad held in LANDSCAPE the whole 1280-wide design is squeezed onto a
// physically small panel, which made the old text and targets tiny and the
// attack action hard to read at a glance.
//
// These helpers give every minigame the same big, high-contrast, touch-sized
// styling so the attack is clear and legible on a hand-held device in
// landscape. Sizes are deliberately generous and every label gets a heavy black
// outline so it stays readable over the busy battle backdrop.
// ─────────────────────────────────────────────────────────────────────────────

export const MG_TITLE_SIZE = 50;
export const MG_INSTR_SIZE = 26;
export const MG_RESULT_SIZE = 58;
export const MG_HINT_SIZE = 24;

export const MG_GOLD = '#ffe45a';
export const MG_INSTR_COLOR = '#dceeff';
export const MG_READY_COLOR = '#ffe070';

/**
 * Full-screen dim that always covers the letterbox margin around the design
 * space, regardless of orientation. Slightly darker than before so the bright
 * play elements pop.
 */
export function addDim(scene: Phaser.Scene, alpha = 0.82) {
  return scene.add
    .rectangle(DESIGN_W / 2, DESIGN_H / 2, DESIGN_W * 3, DESIGN_H * 3, 0x05060f, alpha)
    .setDepth(-10);
}

/**
 * Standard top banner: a large gold move name plus a wrapped instruction line,
 * anchored near the top of the design space so the centre stays free for the
 * actual minigame. Returns the created text objects in case a caller wants to
 * tween or reposition them.
 */
export function addMinigameHeader(scene: Phaser.Scene, title: string, instruction: string) {
  const w = DESIGN_W;

  // Soft dark banner strip behind the header so the gold title keeps its
  // contrast even over light backdrops.
  scene.add.rectangle(w / 2, 78, w, 150, 0x000000, 0.45).setDepth(-5);

  const titleText = scene.add
    .text(w / 2, 52, title, {
      fontSize: `${MG_TITLE_SIZE}px`,
      color: MG_GOLD,
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 7,
      align: 'center',
    })
    .setOrigin(0.5)
    .setShadow(0, 4, '#000000', 8, true, true);

  const instrText = scene.add
    .text(w / 2, 112, instruction, {
      fontSize: `${MG_INSTR_SIZE}px`,
      color: MG_INSTR_COLOR,
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4,
      align: 'center',
      wordWrap: { width: w - 160 },
    })
    .setOrigin(0.5);

  return { titleText, instrText };
}

/**
 * Big "Bereit…" / "Gleich geht's los…" prompt used while a minigame arms its
 * input. Pulses gently so the player knows to wait a beat.
 */
export function addReadyPrompt(scene: Phaser.Scene, x: number, y: number, label = 'Bereit…') {
  const t = scene.add
    .text(x, y, label, {
      fontSize: '30px',
      color: MG_READY_COLOR,
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 5,
    })
    .setOrigin(0.5);
  scene.tweens.add({ targets: t, alpha: { from: 1, to: 0.5 }, duration: 320, yoyo: true, repeat: -1 });
  return t;
}

/**
 * Large, animated result banner ("PERFECT! (98%)" etc.). Pops in with a quick
 * scale bounce so the outcome of the attack is unmistakable.
 */
export function addResultBanner(scene: Phaser.Scene, x: number, y: number, text: string, color: string) {
  const t = scene.add
    .text(x, y, text, {
      fontSize: `${MG_RESULT_SIZE}px`,
      color,
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 8,
      align: 'center',
    })
    .setOrigin(0.5)
    .setShadow(0, 4, '#000000', 10, true, true);
  t.setScale(0.5);
  scene.tweens.add({ targets: t, scale: 1, duration: 260, ease: 'Back.easeOut' });
  return t;
}

/** Picks the colour/label for a 0–100 score, shared by every minigame. */
export function scoreVerdict(score: number, weakLabel = 'MISS!') {
  const label = score >= 90 ? 'PERFECT!' : score >= 70 ? 'GREAT!' : score >= 40 ? 'OK' : weakLabel;
  const color = score >= 80 ? '#5dff5d' : score >= 50 ? '#ffc23d' : '#ff5a5a';
  return { label, color };
}
