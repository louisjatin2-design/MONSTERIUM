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
// Scales with rarity (the dominant factor) and a small per-level bonus.
export function calculateSellValue(rarityRank: number, level: number): number {
  const base = 80 + rarityRank * 220;
  return Math.floor(base * (1 + (level - 1) * 0.12));
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
