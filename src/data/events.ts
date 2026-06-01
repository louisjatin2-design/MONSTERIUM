import { ALL_MONSTER_IDS, MONSTER_DEFS } from '@data/monsters';
import type { RarityType } from '@gtypes/game';

// ── Limited-time Briefing Events ───────────────────────────────────────────────
// Rotating events that let the player spend gold/diamonds for a shot at special
// monsters or guaranteed rarities. Which events are "live" is derived purely from
// the current date + a deterministic rotation, so no server is needed and the
// set is stable within a day.

export interface EventOffer {
  id: string;
  label: string;
  description: string;
  costGold?: number;
  costDiamonds?: number;
  // Either a specific monster, or a random monster of this rarity.
  grantDefId?: string;
  grantRarity?: RarityType;
  /** Hatch time override in seconds for the granted egg (default = rarity time). */
  hatchSec?: number;
}

export interface BriefingEvent {
  id: string;
  title: string;
  emoji: string;
  briefing: string;        // flavour "mission briefing" text
  accent: string;          // theme color
  offers: EventOffer[];
}

// The full pool of events. A rotating subset is shown as "active" each day.
export const ALL_EVENTS: BriefingEvent[] = [
  {
    id: 'ev_inferno', title: 'Inferno-Invasion', emoji: '🌋', accent: '#ff5522',
    briefing:
      'BRIEFING: Ein Riss über dem Vulkangipfel speit feurige Bestien. Fange sie, ' +
      'bevor sie die Insel verbrennen — ihre Glut ist begehrt.',
    offers: [
      { id: 'ev_inferno_o1', label: 'Feuer-Ei', description: 'Zufälliges Feuer-Monster (Rare).',
        costGold: 4000, grantRarity: 'Rare' },
      { id: 'ev_inferno_o2', label: 'Glutbestie', description: 'Garantiert Blazecroc (SuperRare).',
        costDiamonds: 30, grantDefId: 'blazecroc' },
      { id: 'ev_inferno_o3', label: 'Engelsfeuer', description: 'Garantiert Angelfire (Epic).',
        costDiamonds: 80, grantDefId: 'angelfire' },
    ],
  },
  {
    id: 'ev_tides', title: 'Gezeiten-Festival', emoji: '🌊', accent: '#3399ff',
    briefing:
      'BRIEFING: Die Tiefsee öffnet ihre Tore. Seltene Wasserkreaturen steigen auf — ' +
      'nur heute kannst du sie an Land locken.',
    offers: [
      { id: 'ev_tides_o1', label: 'Wasser-Ei', description: 'Zufälliges Wasser-Monster (Rare).',
        costGold: 4000, grantRarity: 'Rare' },
      { id: 'ev_tides_o2', label: 'Gletscherqueen', description: 'Garantiert Glaciara (SuperRare).',
        costDiamonds: 30, grantDefId: 'glaciara' },
      { id: 'ev_tides_o3', label: 'Sturmschnabel', description: 'Garantiert Stormbeak (SuperRare).',
        costDiamonds: 35, grantDefId: 'stormbeak' },
    ],
  },
  {
    id: 'ev_void', title: 'Void-Anomalie', emoji: '🌌', accent: '#9944ff',
    briefing:
      'BRIEFING: Die Realität flackert. Wesen aus dem Nichts gleiten durch den Riss. ' +
      'Sie existieren nur, solange du an sie glaubst — handle schnell.',
    offers: [
      { id: 'ev_void_o1', label: 'Void-Ei', description: 'Zufälliges Monster (Epic).',
        costDiamonds: 60, grantRarity: 'Epic' },
      { id: 'ev_void_o2', label: 'Voidgeist', description: 'Garantiert Voidspecter (SuperRare).',
        costDiamonds: 40, grantDefId: 'voidspecter' },
      { id: 'ev_void_o3', label: 'Zeitwurm', description: 'Garantiert Timewyrm (Legendary).',
        costDiamonds: 150, grantDefId: 'timewyrm' },
    ],
  },
  {
    id: 'ev_cosmos', title: 'Kosmische Konjunktion', emoji: '✨', accent: '#ffcc44',
    briefing:
      'BRIEFING: Einmal in einer Ära richten sich die Sterne. Die mächtigsten Wesen ' +
      'des Universums sind erreichbar — für einen Preis.',
    offers: [
      { id: 'ev_cosmos_o1', label: 'Legendäres Ei', description: 'Zufälliges Monster (Legendary).',
        costDiamonds: 120, grantRarity: 'Legendary' },
      { id: 'ev_cosmos_o2', label: 'Glitchfiend', description: 'Garantiert Glitchfiend (Elite).',
        costDiamonds: 220, grantDefId: 'glitchfiend' },
      { id: 'ev_cosmos_o3', label: 'Cosmolord', description: 'Garantiert Cosmolord (Mythic)!',
        costDiamonds: 400, grantDefId: 'cosmolord' },
    ],
  },
  {
    id: 'ev_gold', title: 'Goldrausch', emoji: '🪙', accent: '#ffaa00',
    briefing:
      'BRIEFING: Eine Karawane voller Schätze ist gestrandet. Tausche Gold gegen ' +
      'seltene Eier, solange der Vorrat reicht.',
    offers: [
      { id: 'ev_gold_o1', label: 'Common-Ei', description: 'Zufälliges Monster (Common).',
        costGold: 1500, grantRarity: 'Common' },
      { id: 'ev_gold_o2', label: 'Rare-Ei', description: 'Zufälliges Monster (Rare).',
        costGold: 6000, grantRarity: 'Rare' },
      { id: 'ev_gold_o3', label: 'SuperRare-Ei', description: 'Zufälliges Monster (SuperRare).',
        costGold: 20000, grantRarity: 'SuperRare' },
    ],
  },
  {
    id: 'ev_shadow', title: 'Schattenjagd', emoji: '🌑', accent: '#6633aa',
    briefing:
      'BRIEFING: Wenn die Sonne sinkt, erwachen die Schattenwesen. Stelle ihnen eine ' +
      'Falle und füge sie deiner Sammlung hinzu.',
    offers: [
      { id: 'ev_shadow_o1', label: 'Schatten-Ei', description: 'Zufälliges Monster (Rare).',
        costGold: 4500, grantRarity: 'Rare' },
      { id: 'ev_shadow_o2', label: 'Schattenfuchs', description: 'Garantiert Shadowfox (Rare).',
        costDiamonds: 20, grantDefId: 'shadowfox' },
      { id: 'ev_shadow_o3', label: 'Psychoschleier', description: 'Garantiert Psychoveil (Rare).',
        costDiamonds: 22, grantDefId: 'psychoveil' },
    ],
  },
];

const DAY_MS = 24 * 60 * 60 * 1000;
const ROTATION_DAYS = 3; // each active set lasts 3 days

// Days since an arbitrary epoch — used to rotate which events are live.
function dayIndex(now: number): number {
  return Math.floor(now / DAY_MS);
}

// Returns the events that are currently "live", plus when the rotation ends.
export function getActiveEvents(now: number = Date.now()): {
  events: BriefingEvent[];
  endsAtMs: number;
} {
  const period = Math.floor(dayIndex(now) / ROTATION_DAYS);
  // Show 2 events per rotation, picked deterministically from the pool.
  const a = period % ALL_EVENTS.length;
  const b = (period * 2 + 1) % ALL_EVENTS.length;
  const picked = b === a
    ? [ALL_EVENTS[a]]
    : [ALL_EVENTS[a], ALL_EVENTS[b]];
  const endsAtMs = (period + 1) * ROTATION_DAYS * DAY_MS;
  return { events: picked, endsAtMs };
}

// Resolve an offer to a concrete monster def id (rolls rarity offers).
export function resolveOfferMonster(offer: EventOffer): string | null {
  if (offer.grantDefId) return offer.grantDefId;
  if (offer.grantRarity) {
    const pool = ALL_MONSTER_IDS.filter(id => MONSTER_DEFS[id]?.rarity === offer.grantRarity);
    if (pool.length === 0) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }
  return null;
}
