// ── Gruppe 5 — Element-Futter für Level 100+ ────────────────────────────────
// Ab Level 100 reicht normales Futter nicht mehr: jedes Monster braucht
// element-spezifisches Futter, das in den (bereits element-gebundenen) Tempeln
// als „spezielle Farmen" über Zeit produziert wird. Für jedes Element des
// Monsters wird pro Fütterung etwas Element-Futter verbraucht.
// TODO: ab Legendär+ zusätzlich seltenheitsspezifische Varianten.

import type { ElementType } from '@gtypes/game';

export const ELEMENT_FOOD_LEVEL = 100;     // ab hier wird Element-Futter fällig
export const ELEMENT_FOOD_PER_FEED = 1;    // pro Element & Fütterung

/** Element-Futter-Kosten einer Fütterung (leer unter Level 100). */
export function elementFoodCost(level: number, elements: ElementType[]): Record<string, number> {
  if (level < ELEMENT_FOOD_LEVEL) return {};
  const cost: Record<string, number> = {};
  for (const el of elements) cost[el] = (cost[el] ?? 0) + ELEMENT_FOOD_PER_FEED;
  return cost;
}

/** Reicht der Vorrat für die geforderten Element-Futter-Kosten? */
export function canAffordElementFood(stock: Record<string, number>, cost: Record<string, number>): boolean {
  return Object.entries(cost).every(([el, qty]) => (stock[el] ?? 0) >= qty);
}

/** Produktion eines Tempels pro Stunde (Element-Futter), abhängig vom Level. */
export function templeElementFoodPerHour(templeLevel: number): number {
  return 2 + templeLevel * 2;
}

export const ELEMENT_FOOD_EMOJI = '🍖';
