// ── Gruppe 8 — Crate Shop (ziehbare Kisten) ─────────────────────────────────
// Kisten enthalten zufällige Inhalte (Ressourcen, Materialien, Rüstungen,
// Monster-Eier), gewichtet nach Kistenstufe. Die Roll-Logik ist rein
// datengetrieben; die Anwendung läuft über vorhandene Store-Aktionen.
import { ALL_MONSTER_IDS, MONSTER_DEFS } from '@data/monsters';
import { RARITY_RANK } from '@data/rarities';
import { ARMOR_DEFS } from '@data/armor';
import { MATERIALS } from '@data/armor';

export interface CrateDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  cost: { gold?: number; diamonds?: number };
  // Gewichtete Belohnungs-Tabelle.
  loot: CrateLootEntry[];
}

export type CrateRewardKind = 'gold' | 'food' | 'diamonds' | 'material' | 'armor' | 'egg';

export interface CrateLootEntry {
  weight: number;
  kind: CrateRewardKind;
  // Optionale Parameter je Art:
  min?: number; max?: number;          // gold/food/diamonds
  rarityMax?: number;                  // egg: höchste erlaubte Seltenheit (RANK)
  rarityMin?: number;                  // egg/armor untergrenze
}

export interface CrateReward {
  kind: CrateRewardKind;
  label: string;
  gold?: number; food?: number; diamonds?: number;
  materialId?: string; materialQty?: number;
  armorId?: string;
  eggDefId?: string;
}

export const CRATES: CrateDef[] = [
  {
    id: 'crate_common', name: 'Bronze-Kiste', icon: '📦',
    description: 'Günstige Kiste — Ressourcen, Materialien und gelegentlich ein Common-Ei.',
    cost: { gold: 1500 },
    loot: [
      { weight: 35, kind: 'gold', min: 500, max: 2500 },
      { weight: 30, kind: 'food', min: 300, max: 1500 },
      { weight: 25, kind: 'material', min: 1, max: 3 },
      { weight: 10, kind: 'egg', rarityMax: 0 },
    ],
  },
  {
    id: 'crate_premium', name: 'Silber-Kiste', icon: '🎁',
    description: 'Premium-Kiste — Diamanten, Rüstungen und seltene Eier (bis Epic).',
    cost: { diamonds: 30 },
    loot: [
      { weight: 25, kind: 'diamonds', min: 8, max: 25 },
      { weight: 20, kind: 'gold', min: 3000, max: 9000 },
      { weight: 20, kind: 'material', min: 2, max: 5 },
      { weight: 20, kind: 'armor' },
      { weight: 15, kind: 'egg', rarityMin: 1, rarityMax: 3 },
    ],
  },
  {
    id: 'crate_legendary', name: 'Gold-Kiste', icon: '🏆',
    description: 'Beste Kiste — garantiert hochwertig: Rüstung oder Legendär+-Ei.',
    cost: { diamonds: 120 },
    loot: [
      { weight: 45, kind: 'egg', rarityMin: 3, rarityMax: 7 },
      { weight: 30, kind: 'armor' },
      { weight: 15, kind: 'diamonds', min: 40, max: 100 },
      { weight: 10, kind: 'gold', min: 15000, max: 40000 },
    ],
  },
];

function rint(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min + 1));
}
function pick<T>(arr: T[]): T | undefined {
  return arr.length ? arr[Math.floor(Math.random() * arr.length)] : undefined;
}

/** Wählt einen gewichteten Loot-Eintrag und konkretisiert die Belohnung. */
export function rollCrate(crate: CrateDef): CrateReward {
  const total = crate.loot.reduce((s, e) => s + e.weight, 0);
  let r = Math.random() * total;
  let entry = crate.loot[0];
  for (const e of crate.loot) { if ((r -= e.weight) <= 0) { entry = e; break; } }

  switch (entry.kind) {
    case 'gold': { const n = rint(entry.min ?? 500, entry.max ?? 2000); return { kind: 'gold', gold: n, label: `🪙 ${n} Gold` }; }
    case 'food': { const n = rint(entry.min ?? 300, entry.max ?? 1000); return { kind: 'food', food: n, label: `🌾 ${n} Futter` }; }
    case 'diamonds': { const n = rint(entry.min ?? 5, entry.max ?? 20); return { kind: 'diamonds', diamonds: n, label: `💎 ${n} Diamanten` }; }
    case 'material': {
      const m = pick(Object.values(MATERIALS));
      const q = rint(entry.min ?? 1, entry.max ?? 3);
      return { kind: 'material', materialId: m?.id, materialQty: q, label: `${m?.icon ?? '🔩'} ${q}× ${m?.name ?? 'Material'}` };
    }
    case 'armor': {
      const a = pick(Object.values(ARMOR_DEFS));
      return { kind: 'armor', armorId: a?.id, label: `${a?.icon ?? '🛡️'} ${a?.name ?? 'Rüstung'}` };
    }
    case 'egg': {
      const lo = entry.rarityMin ?? 0, hi = entry.rarityMax ?? 7;
      const pool = ALL_MONSTER_IDS.filter(id => {
        const rank = RARITY_RANK[MONSTER_DEFS[id]?.rarity ?? 'Common'];
        return rank >= lo && rank <= hi;
      });
      const id = pick(pool) ?? ALL_MONSTER_IDS[0];
      return { kind: 'egg', eggDefId: id, label: `🥚 ${MONSTER_DEFS[id]?.name ?? id} (${MONSTER_DEFS[id]?.rarity})` };
    }
  }
}
