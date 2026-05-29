import type { ElementType } from '@gtypes/game';

export const ELEMENT_COLORS: Record<ElementType, number> = {
  Fire:      0xFF4500,
  Water:     0x1E90FF,
  Electric:  0xFFD700,
  Earth:     0x8B4513,
  Air:       0x87CEEB,
  Ice:       0xADD8E6,
  Darkness:  0x2D0060,
  Light:     0xFFFF99,
  Metal:     0xC0C0C0,
  Poison:    0x8B008B,
  Combat:    0xFF6347,
  Magic:     0xDA70D6,
  Angel:     0xFFFACD,
  Demon:     0x8B0000,
  Plant:     0x228B22,
  Glitch:    0x00FF41,
  Time:      0x708090,
  Crystal:   0xE0FFFF,
  Sand:      0xF4A460,
  Sound:     0xFF69B4,
  Void:      0x000033,
  Cosmos:    0x191970,
  Psycho:    0xEE82EE,
};

export const ELEMENT_CSS_COLORS: Record<ElementType, string> = {
  Fire:      '#FF4500',
  Water:     '#1E90FF',
  Electric:  '#FFD700',
  Earth:     '#8B4513',
  Air:       '#87CEEB',
  Ice:       '#ADD8E6',
  Darkness:  '#7B00FF',
  Light:     '#FFEE44',
  Metal:     '#C0C0C0',
  Poison:    '#8B008B',
  Combat:    '#FF6347',
  Magic:     '#DA70D6',
  Angel:     '#FFF8DC',
  Demon:     '#CC0000',
  Plant:     '#228B22',
  Glitch:    '#00FF41',
  Time:      '#708090',
  Crystal:   '#88EEFF',
  Sand:      '#F4A460',
  Sound:     '#FF69B4',
  Void:      '#110033',
  Cosmos:    '#3355AA',
  Psycho:    '#EE82EE',
};

// Element effectiveness: attacker element → defender element → multiplier
export const ELEMENT_EFFECTIVENESS: Partial<Record<ElementType, Partial<Record<ElementType, number>>>> = {
  Fire:      { Ice: 2.0, Plant: 2.0, Metal: 0.5, Water: 0.5 },
  Water:     { Fire: 2.0, Earth: 2.0, Electric: 0.5, Ice: 0.5 },
  Electric:  { Water: 2.0, Air: 2.0, Earth: 0.5, Metal: 0.5 },
  Earth:     { Electric: 2.0, Metal: 2.0, Air: 0.5, Plant: 0.5 },
  Ice:       { Air: 2.0, Plant: 2.0, Fire: 0.5, Metal: 0.5 },
  Darkness:  { Light: 2.0, Angel: 2.0, Demon: 0.5 },
  Light:     { Darkness: 2.0, Demon: 2.0, Angel: 0.5 },
  Poison:    { Plant: 2.0, Combat: 2.0, Metal: 0.5 },
  Void:      { Cosmos: 2.0, Psycho: 2.0, Light: 0.5 },
  Cosmos:    { Void: 2.0, Time: 2.0 },
  Psycho:    { Combat: 2.0, Magic: 2.0, Darkness: 0.5 },
  Metal:     { Earth: 0.5, Fire: 0.5, Crystal: 2.0 },
  Crystal:   { Metal: 2.0, Sound: 2.0, Earth: 0.5 },
  Sound:     { Crystal: 0.5, Psycho: 2.0 },
  Time:      { Glitch: 2.0 },
  Glitch:    { Time: 0.5, Void: 2.0 },
};

export function getElementBonus(attackerElement: ElementType, defenderElements: ElementType[]): number {
  const effectMap = ELEMENT_EFFECTIVENESS[attackerElement];
  if (!effectMap) return 0;
  let bonus = 0;
  for (const defEl of defenderElements) {
    const mult = effectMap[defEl];
    if (mult !== undefined) {
      bonus = Math.max(bonus, mult - 1); // take strongest interaction
    }
  }
  return bonus;
}
