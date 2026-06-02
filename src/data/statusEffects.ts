import type { StatusEffect } from '@gtypes/game';

// How a status effect behaves at a glance — used for grouping and colouring.
export type StatusCategory = 'dot' | 'control' | 'debuff' | 'buff';

export interface StatusEffectDef {
  id: StatusEffect;
  /** German display name shown to the player. */
  name: string;
  icon: string;
  /** Hex colour string, used for both CSS and Phaser badges. */
  color: string;
  category: StatusCategory;
  /** Short German explanation of what the effect does. */
  description: string;
}

// Single source of truth for how every status effect is presented and
// described. Both the Phaser battle scene and the React UI read from here so
// icons, colours and wording never drift apart.
export const STATUS_EFFECTS: Record<StatusEffect, StatusEffectDef> = {
  Burn: {
    id: 'Burn',
    name: 'Verbrennung',
    icon: '🔥',
    color: '#ff6b35',
    category: 'dot',
    description: 'Verliert 5% der maximalen HP pro Runde.',
  },
  Poison: {
    id: 'Poison',
    name: 'Vergiftung',
    icon: '☠️',
    color: '#9b59b6',
    category: 'dot',
    description: 'Verliert 7% der maximalen HP pro Runde.',
  },
  Freeze: {
    id: 'Freeze',
    name: 'Einfrieren',
    icon: '🧊',
    color: '#5dade2',
    category: 'control',
    description: 'Kann in der nächsten Runde nicht handeln.',
  },
  Stun: {
    id: 'Stun',
    name: 'Betäubung',
    icon: '💫',
    color: '#f1c40f',
    category: 'control',
    description: 'Kann in der nächsten Runde nicht handeln.',
  },
  Paralyze: {
    id: 'Paralyze',
    name: 'Lähmung',
    icon: '⚡',
    color: '#f39c12',
    category: 'debuff',
    description: 'Geschwindigkeit ist um 50% reduziert.',
  },
  Blind: {
    id: 'Blind',
    name: 'Blindheit',
    icon: '🌫️',
    color: '#95a5a6',
    category: 'debuff',
    description: '30% Chance, Angriffe zu verfehlen.',
  },
  DefDown: {
    id: 'DefDown',
    name: 'Verteidigung ↓',
    icon: '🛡️',
    color: '#e74c3c',
    category: 'debuff',
    description: 'Verteidigung ist um 25% gesenkt.',
  },
  AtkDown: {
    id: 'AtkDown',
    name: 'Angriff ↓',
    icon: '⚔️',
    color: '#c0392b',
    category: 'debuff',
    description: 'Angriff ist um 25% gesenkt.',
  },
  AtkUp: {
    id: 'AtkUp',
    name: 'Angriff ↑',
    icon: '🔺',
    color: '#27ae60',
    category: 'buff',
    description: 'Angriff ist um 35% erhöht.',
  },
  DefUp: {
    id: 'DefUp',
    name: 'Verteidigung ↑',
    icon: '🛡️',
    color: '#2980b9',
    category: 'buff',
    description: 'Verteidigung ist um 40% erhöht.',
  },
  Bleed: {
    id: 'Bleed',
    name: 'Blutung',
    icon: '🩸',
    color: '#b03a2e',
    category: 'dot',
    description: 'Verliert 10% der maximalen HP pro Runde und richtet 20% weniger Schaden an.',
  },
  Vulnerable: {
    id: 'Vulnerable',
    name: 'Verwundbar',
    icon: '🎯',
    color: '#e67e22',
    category: 'debuff',
    description: 'Erleidet 50% mehr Schaden durch Angriffe.',
  },
  Shield: {
    id: 'Shield',
    name: 'Schild',
    icon: '🛡',
    color: '#48c9b0',
    category: 'buff',
    description: 'Absorbiert eingehenden Schaden, bis der Schild aufgebraucht ist.',
  },
  Taunt: {
    id: 'Taunt',
    name: 'Spott',
    icon: '🚩',
    color: '#af7ac5',
    category: 'buff',
    description: 'Zieht alle Einzelziel-Angriffe der Gegner auf sich.',
  },
  Regen: {
    id: 'Regen',
    name: 'Regeneration',
    icon: '💚',
    color: '#27ae60',
    category: 'buff',
    description: 'Heilt 10% der maximalen HP pro Runde.',
  },
  Decay: {
    id: 'Decay',
    name: 'Zerfall',
    icon: '🥀',
    color: '#6c3483',
    category: 'dot',
    description: 'Verliert 50% der maximalen HP pro Runde und stirbt so innerhalb von 2 Runden.',
  },
};

// Default number of rounds a freshly applied status effect lasts.
export const STATUS_DEFAULT_ROUNDS = 3;

export function getStatusDef(effect: StatusEffect): StatusEffectDef {
  return STATUS_EFFECTS[effect];
}
