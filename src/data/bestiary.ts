// ── Gruppe 4 — Bestiarium: schrittweise Lore-Freischaltung ──────────────────
// Je öfter man gegen eine Spezies kämpft (store.bestiary[defId]) oder je länger
// man sie besitzt, desto mehr Akten-Einträge werden freigeschaltet. Die Texte
// werden aus den vorhandenen Monster-Daten generiert (kein zusätzlicher
// Lore-Datensatz pro Monster nötig). TODO: später handgeschriebene Mehrfach-Lore.
import type { MonsterDef } from '@gtypes/game';
import { TRAITS } from '@data/traits';
import { getMonsterFaction, getFactionLoreTitle, FACTION_LABELS } from '@data/factions';
import { RARITY_RANK } from '@data/rarities';

export interface BestiaryEntry {
  title: string;
  text: string;
  threshold: number;   // benötigter Fortschritt
  unlocked: boolean;
}

// Besitz gibt einen Fortschritts-Bonus (man lernt das Monster durch Halten kennen).
const OWNED_PROGRESS_BONUS = 3;

export function getBestiaryProgress(battles: number, owned: boolean): number {
  return Math.max(0, battles) + (owned ? OWNED_PROGRESS_BONUS : 0);
}

const DANGER = ['gering', 'beobachtet', 'erhöht', 'hoch', 'schwer', 'kritisch', 'omega'];

/**
 * Liefert alle Bestiarium-Einträge einer Spezies mit Freischalt-Status,
 * abhängig vom aktuellen Fortschritt (Kämpfe + Besitz-Bonus).
 */
export function getBestiaryEntries(def: MonsterDef, progress: number): BestiaryEntry[] {
  const faction = getMonsterFaction(def);
  const rank = RARITY_RANK[def.rarity];
  const raw: Omit<BestiaryEntry, 'unlocked'>[] = [
    {
      threshold: 1,
      title: 'Sichtungsbericht',
      text: `Element: ${def.elements.join(' / ')}. Fraktion: ${FACTION_LABELS[faction]} `
        + `(${getFactionLoreTitle(def)}).`,
    },
    {
      threshold: 3,
      title: 'Feldnotiz',
      text: def.lore,
    },
    {
      threshold: 7,
      title: 'Verhaltensanalyse',
      text: def.trait && def.trait !== 'None'
        ? `Talent „${TRAITS[def.trait]?.name ?? def.trait}": ${TRAITS[def.trait]?.description ?? '—'}`
        : 'Kein besonderes Talent dokumentiert.',
    },
    {
      threshold: 15,
      title: 'Gefahreneinschätzung',
      text: `Seltenheit ${def.rarity} · Gefahrenstufe ${DANGER[Math.min(rank, DANGER.length - 1)]}. `
        + (rank >= 4 ? 'Eindämmung dringend empfohlen.' : 'Unter kontrollierter Beobachtung.'),
    },
    {
      threshold: 30,
      title: 'Vollständige Akte',
      text: `Entwicklungslinie: ${def.evolutionStages.join(' → ')}.`
        + (def.breedCompatibility.length ? ` Zuchtpartner bekannt: ${def.breedCompatibility.length}.` : ''),
    },
  ];
  return raw.map(e => ({ ...e, unlocked: progress >= e.threshold }));
}
