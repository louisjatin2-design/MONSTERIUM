export function calculateXpToLevel(level: number): number {
  return Math.floor(100 * Math.pow(level, 1.5));
}

// Feeding cost — Monster-Legends-style gentle growth.
// The old exponential curve (50 * 1.5^level) made high-level feeding absurdly
// expensive (level 20 cost >160k food). This linear-ish curve keeps food a
// meaningful sink without becoming a hard wall.
export function calculateFeedCost(level: number): number {
  return Math.floor(10 + level * 8);
}

// Gold earned when selling a monster from a habitat.
// Scales with rarity (the dominant factor) and a clear per-level bonus — a
// higher-level monster is worth noticeably more, so leveling before selling pays
// off (+25% of the base value per level above 1).
export function calculateSellValue(rarityRank: number, level: number): number {
  const base = 80 + rarityRank * 220;
  return Math.floor(base * (1 + (level - 1) * 0.25));
}

// Gold earned when selling a stored (un-hatched) egg. Deliberately kept BELOW
// the value of the level-1 baby that would hatch from it, so hatching first and
// selling the baby is always the more rewarding choice.
export function calculateEggSellValue(rarityRank: number): number {
  return Math.floor(calculateSellValue(rarityRank, 1) * 0.6);
}

export function calculateAccumulatedGold(
  goldPerHour: number,
  lastCollectedMs: number,
  nowMs: number
): number {
  const hoursSince = (nowMs - lastCollectedMs) / 3_600_000;
  const maxAccum = goldPerHour * 12;
  return Math.min(Math.floor(goldPerHour * hoursSince), maxAccum);
}

export function calculateBuildUpgradeCost(baseGold: number, level: number): number {
  return Math.floor(baseGold * Math.pow(2.5, level - 1));
}
