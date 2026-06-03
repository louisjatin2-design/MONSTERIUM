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

// Unique ("✨") monsters are special and sell for more than their regular
// counterparts. The same multiplier applies to eggs and monsters alike so the
// egg-vs-monster relationship below always holds.
export const UNIQUE_SELL_MULTIPLIER = 2;

// Gold earned when selling a monster from a habitat.
// Scales EXPONENTIALLY with rarity (the dominant factor) so rare monsters/eggs
// are dramatically more valuable than common ones (Gruppe 8), plus a clear
// per-level bonus (+25% of base per level above 1) so leveling before selling
// pays off.
//   Common(0)=120, Rare(1)=~260, SR(2)=~575, Epic(3)=~1265,
//   Legendary(4)=~2780, Elite(5)=~6120, Mythic(6)=~13460, Transcendent(7)=~29620
export function calculateSellValue(rarityRank: number, level: number, isUnique = false): number {
  const base = 120 * Math.pow(2.2, rarityRank);
  const value = base * (1 + (level - 1) * 0.25);
  return Math.floor(value * (isUnique ? UNIQUE_SELL_MULTIPLIER : 1));
}

// Gold earned when selling a stored (un-hatched) egg. Deliberately kept BELOW
// the value of the level-1 baby that would hatch from it (60%), so hatching
// first and selling the baby is ALWAYS the more rewarding choice — even for
// unique eggs, since the unique bonus is applied to both sides identically.
export function calculateEggSellValue(rarityRank: number, isUnique = false): number {
  return Math.floor(calculateSellValue(rarityRank, 1, isUnique) * 0.6);
}

// ── Habitat-Einkommen (Gruppe 2) ───────────────────────────────────────────
// Das Gold eines Habitats hängt jetzt von den BEWOHNENDEN Monstern ab, nicht
// mehr nur vom Gebäude-Level: Kein Monster ⇒ Einkommen 0. Höheres Level und
// höhere Seltenheit ⇒ mehr Gold. Das Gebäude-Level wirkt als sanfter
// Multiplikator (bessere Lebensräume pflegen ihre Bewohner effizienter).
//
// Pro-Monster-Rate = rarityGoldRate × (1 + (level-1) × 0.04).
// Ein Lv1-Common bringt also seine Basisrate, ein Lv100 fast das ~5-fache.
export function monsterGoldPerHour(rarityGoldRate: number, monsterLevel: number): number {
  return rarityGoldRate * (1 + (monsterLevel - 1) * 0.04);
}

/**
 * Stündliche Goldrate eines Habitats: Summe der Bewohner-Raten, skaliert mit
 * dem Gebäude-Level. Gibt 0 zurück, wenn kein Monster einzieht.
 */
export function habitatGoldPerHour(
  buildingLevel: number,
  residents: Array<{ rarityGoldRate: number; level: number }>,
): number {
  if (residents.length === 0) return 0;
  const buildingFactor = 1 + (buildingLevel - 1) * 0.15;
  const sum = residents.reduce(
    (acc, r) => acc + monsterGoldPerHour(r.rarityGoldRate, r.level), 0,
  );
  return Math.floor(sum * buildingFactor);
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
