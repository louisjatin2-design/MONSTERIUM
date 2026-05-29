import type { TraitType, StatusEffect } from '@gtypes/game';

export interface TraitDef {
  id: TraitType;
  name: string;
  description: string;
  // Which status effects this trait makes the holder immune to
  immuneTo?: StatusEffect[];
}

export const TRAITS: Record<TraitType, TraitDef> = {
  None: {
    id: 'None',
    name: 'None',
    description: 'No special trait.',
  },
  Tough: {
    id: 'Tough',
    name: 'Tough',
    description: 'Takes 20% less physical damage.',
  },
  Swift: {
    id: 'Swift',
    name: 'Swift',
    description: 'Speed is boosted by 20%.',
  },
  Berserk: {
    id: 'Berserk',
    name: 'Berserk',
    description: 'Attack doubles when HP drops below 30%.',
  },
  Guardian: {
    id: 'Guardian',
    name: 'Guardian',
    description: 'Redirects 30% of damage dealt to allies to itself.',
  },
  Mania: {
    id: 'Mania',
    name: 'Mania',
    description: 'When receiving a negative status effect, gains 3× ATK/DEF for 2 rounds.',
  },
  Echo: {
    id: 'Echo',
    name: 'Echo',
    description: 'Attacks hit twice, each dealing 60% of normal damage.',
  },
  Undead: {
    id: 'Undead',
    name: 'Undead',
    description: 'Revives once with 30% HP after being defeated.',
  },
  Fireproof: {
    id: 'Fireproof',
    name: 'Fireproof',
    description: 'Immune to Burn and Fire-type status effects.',
    immuneTo: ['Burn'],
  },
  Lucky: {
    id: 'Lucky',
    name: 'Lucky',
    description: 'Minigame difficulty is reduced by 1 tier.',
  },
};
