import type { ElementType, MonsterDef } from '@gtypes/game';
import { RARITY_RANK } from '@data/rarities';

// ── Gut vs. Böse Fraktionen ────────────────────────────────────────────────
// Jedes Monster gehört in der Lore einer von zwei Seiten an (oder bleibt
// neutral). Die Zugehörigkeit leitet sich aus den Elementen ab und wird durch
// die Seltenheit (= "Stärke") verstärkt: extrem starke gute Monster sind
// legendäre Beschützer, extrem starke böse Monster zerstörerische Dämonen.
export type Faction = 'Good' | 'Evil' | 'Neutral';

// Wie stark ein Element die Ausrichtung in Richtung Gut (+) oder Böse (−) zieht.
const ELEMENT_ALIGNMENT: Partial<Record<ElementType, number>> = {
  Light: 2, Angel: 3, Crystal: 1, Plant: 1, Cosmos: 2, Time: 1, Sound: 1,
  Darkness: -2, Demon: -3, Poison: -2, Void: -2, Glitch: -1, Sand: -1,
  // Alle übrigen Elemente sind neutral (0).
};

/**
 * Roher Ausrichtungswert eines Monsters: Summe der Element-Tendenzen, durch die
 * Seltenheit verstärkt (höhere Seltenheit = ausgeprägtere Lore-Zugehörigkeit).
 */
export function getAlignmentScore(def: MonsterDef): number {
  const elementScore = def.elements.reduce(
    (sum, el) => sum + (ELEMENT_ALIGNMENT[el] ?? 0), 0,
  );
  // Seltenheit skaliert die Tendenz: Common ×1.0 … Transcendent ×1.7.
  const rarityFactor = 1 + RARITY_RANK[def.rarity] * 0.1;
  return elementScore * rarityFactor;
}

export function getMonsterFaction(def: MonsterDef): Faction {
  const score = getAlignmentScore(def);
  if (score > 0.5) return 'Good';
  if (score < -0.5) return 'Evil';
  return 'Neutral';
}

export const FACTION_LABELS: Record<Faction, string> = {
  Good: 'Gut',
  Evil: 'Böse',
  Neutral: 'Neutral',
};

export const FACTION_COLORS: Record<Faction, string> = {
  Good: '#ffe066',
  Evil: '#ff5577',
  Neutral: '#9aa4b2',
};

export const FACTION_ICONS: Record<Faction, string> = {
  Good: '😇',
  Evil: '😈',
  Neutral: '⚖️',
};

/**
 * Lore-Titel für ein Monster, abhängig von Fraktion und Stärke (Seltenheit).
 * Extreme Werte erhalten markantere Bezeichnungen.
 */
export function getFactionLoreTitle(def: MonsterDef): string {
  const faction = getMonsterFaction(def);
  const rank = RARITY_RANK[def.rarity];
  if (faction === 'Good') {
    if (rank >= 4) return 'Legendärer Beschützer';
    if (rank >= 2) return 'Wächter des Lichts';
    return 'Gutmütiger Gefährte';
  }
  if (faction === 'Evil') {
    if (rank >= 4) return 'Zerstörerischer Dämon';
    if (rank >= 2) return 'Diener der Finsternis';
    return 'Unruhestifter';
  }
  return 'Neutrale Kreatur';
}

/**
 * Gemischte Teams (gut + böse) erleiden im Kampf einen Mali-Faktor (< 1) auf
 * verursachten Schaden. Reine Teams (oder rein neutrale) erhalten keinen Mali.
 * Siehe Gruppe 3 „Gut & Böse Synergien" — Story-Events können Ausnahmen
 * gewähren (TODO: relationship-/story-basierte Buffs).
 */
export function mixedTeamPenalty(factions: Faction[]): number {
  const hasGood = factions.includes('Good');
  const hasEvil = factions.includes('Evil');
  return hasGood && hasEvil ? 0.85 : 1;
}

/** Bonus-Synergie für ein rein gutes oder rein böses Team (ohne die jeweils
 *  andere Seite). Reine Teams kämpfen harmonischer. */
export function pureTeamBonus(factions: Faction[]): number {
  const hasGood = factions.includes('Good');
  const hasEvil = factions.includes('Evil');
  if (hasGood && !hasEvil) return 1.08;
  if (hasEvil && !hasGood) return 1.08;
  return 1;
}
