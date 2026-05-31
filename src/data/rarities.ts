import type { RarityType } from '@gtypes/game';

export const RARITY_RANK: Record<RarityType, number> = {
  Common:       0,
  Rare:         1,
  SuperRare:    2,
  Epic:         3,
  Legendary:    4,
  Elite:        5,
  Mythic:       6,
  Transcendent: 7,
};

export const RARITY_COLORS: Record<RarityType, string> = {
  Common:       '#888888',
  Rare:         '#4488FF',
  SuperRare:    '#AA44FF',
  Epic:         '#FF8800',
  Legendary:    '#FFDD00',
  Elite:        '#00FFCC',
  Mythic:       '#FF44AA',
  Transcendent: '#FFFFFF',
};

export const RARITY_HATCH_TIME_SEC: Record<RarityType, number> = {
  Common:       30,
  Rare:         120,
  SuperRare:    600,
  Epic:         1800,
  Legendary:    7200,
  Elite:        21600,
  Mythic:       86400,
  Transcendent: 259200,
};

// How long a pair takes to produce an egg in the Breeding Station (before the
// egg even moves to the Hatchery). Roughly half the hatch time — rarer combos
// take longer, just like Monster Legends.
export const RARITY_BREED_TIME_SEC: Record<RarityType, number> = {
  Common:       15,
  Rare:         60,
  SuperRare:    300,
  Epic:         900,
  Legendary:    3600,
  Elite:        10800,
  Mythic:       43200,
  Transcendent: 129600,
};

export const RARITY_FEED_MULTIPLIER: Record<RarityType, number> = {
  Common:       1.0,
  Rare:         1.5,
  SuperRare:    2.0,
  Epic:         3.0,
  Legendary:    5.0,
  Elite:        8.0,
  Mythic:       12.0,
  Transcendent: 20.0,
};

// Minigame difficulty modifier (additive to base difficulty)
export const RARITY_MINIGAME_DIFFICULTY: Record<RarityType, number> = {
  Common:       0,
  Rare:         1,
  SuperRare:    2,
  Epic:         3,
  Legendary:    4,
  Elite:        5,
  Mythic:       6,
  Transcendent: 7,
};

export const RARITY_GOLD_RATE: Record<RarityType, number> = {
  Common:        50,
  Rare:         100,
  SuperRare:    200,
  Epic:         400,
  Legendary:    800,
  Elite:       1500,
  Mythic:      2500,
  Transcendent: 5000,
};

// Distinctive sigil for each rarity — shown on cards, in the Pokédex and
// anywhere a monster's rarity needs a quick visual read.
export const RARITY_SYMBOLS: Record<RarityType, string> = {
  Common:       '●',
  Rare:         '◆',
  SuperRare:    '✦',
  Epic:         '✪',
  Legendary:    '★',
  Elite:        '❂',
  Mythic:       '✸',
  Transcendent: '✺',
};

// Short uppercase tier tags (handy for tight UI).
export const RARITY_SHORT: Record<RarityType, string> = {
  Common:       'C',
  Rare:         'R',
  SuperRare:    'SR',
  Epic:         'EP',
  Legendary:    'LG',
  Elite:        'EL',
  Mythic:       'MY',
  Transcendent: 'TR',
};

// Number of star pips to render for a rarity (Monster-Legends style).
export const RARITY_STARS: Record<RarityType, number> = {
  Common:       1,
  Rare:         2,
  SuperRare:    3,
  Epic:         4,
  Legendary:    5,
  Elite:        6,
  Mythic:       7,
  Transcendent: 8,
};

// CSS box-shadow glow keyed by rarity — used for portrait auras.
export function rarityGlow(rarity: RarityType): string {
  const c = RARITY_COLORS[rarity];
  const rank = RARITY_RANK[rarity];
  const spread = 6 + rank * 2;
  return `0 0 ${spread}px ${c}, 0 0 ${spread * 2}px ${c}88`;
}
