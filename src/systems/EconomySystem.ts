export function calculateXpToLevel(level: number): number {
  return Math.floor(100 * Math.pow(level, 1.5));
}

export function calculateFeedCost(level: number): number {
  return Math.floor(50 * Math.pow(1.5, level));
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
