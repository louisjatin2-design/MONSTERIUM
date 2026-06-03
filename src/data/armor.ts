import type { RarityType } from '@gtypes/game';

// ── Rüstungs-System (Gruppe 7) ──────────────────────────────────────────────
// Rüstungen werden aus Materialien gecraftet, die im Kampf gedroppt werden, und
// buffen Leben, Geschwindigkeit, Ausdauer (Energie) und Angriff. Eine Rüstung
// pro Monster (ein Slot) — siehe equippedArmorId an der MonsterInstance.

export interface ArmorStatBonus {
  hp?: number;       // Leben
  attack?: number;   // Angriff
  speed?: number;    // Geschwindigkeit
  energy?: number;   // Ausdauer
}

export interface ArmorDef {
  id: string;
  name: string;
  icon: string;
  rarity: RarityType;
  bonus: ArmorStatBonus;
  // Craft-Kosten: Gold + Materialmengen (materialId → Anzahl).
  craft: { gold: number; materials: Record<string, number> };
  description: string;
}

export interface MaterialDef {
  id: string;
  name: string;
  icon: string;
  // Relatives Drop-Gewicht im Kampf (höher = häufiger).
  dropWeight: number;
}

// Materialien, die nach gewonnenen Kämpfen droppen (siehe gameStore.recordBattleWon).
// TODO(assets): echte Item-Icons statt Emoji.
export const MATERIALS: Record<string, MaterialDef> = {
  scrap:        { id: 'scrap',        name: 'Schrott',        icon: '🔩', dropWeight: 50 },
  hide:         { id: 'hide',         name: 'Zähes Leder',    icon: '🟫', dropWeight: 35 },
  ironplate:    { id: 'ironplate',    name: 'Eisenplatte',    icon: '⬜', dropWeight: 20 },
  crystalshard: { id: 'crystalshard', name: 'Kristallsplitter',icon: '💎', dropWeight: 8 },
  voidcore:     { id: 'voidcore',     name: 'Leerenkern',     icon: '🟣', dropWeight: 2 },
};

export const ARMOR_DEFS: Record<string, ArmorDef> = {
  leather_vest: {
    id: 'leather_vest', name: 'Lederweste', icon: '🦺', rarity: 'Common',
    bonus: { hp: 120, speed: 8 },
    craft: { gold: 800, materials: { scrap: 5, hide: 3 } },
    description: 'Leichte Rüstung — etwas mehr Leben und Tempo.',
  },
  iron_armor: {
    id: 'iron_armor', name: 'Eisenpanzer', icon: '🛡️', rarity: 'Rare',
    bonus: { hp: 300, attack: 25 },
    craft: { gold: 2500, materials: { scrap: 8, hide: 5, ironplate: 4 } },
    description: 'Solider Panzer — viel Leben und etwas Angriff.',
  },
  swift_cloak: {
    id: 'swift_cloak', name: 'Windumhang', icon: '🧥', rarity: 'Rare',
    bonus: { speed: 40, energy: 20 },
    craft: { gold: 2500, materials: { hide: 8, scrap: 4 } },
    description: 'Erhöht Geschwindigkeit und Ausdauer deutlich.',
  },
  crystal_plate: {
    id: 'crystal_plate', name: 'Kristallrüstung', icon: '🔷', rarity: 'Epic',
    bonus: { hp: 500, attack: 60, speed: 20 },
    craft: { gold: 8000, materials: { ironplate: 6, crystalshard: 4 } },
    description: 'Mächtige Rüstung — starke Boni auf Leben, Angriff und Tempo.',
  },
  warlord_aegis: {
    id: 'warlord_aegis', name: 'Kriegsfürst-Aegis', icon: '⚜️', rarity: 'Legendary',
    bonus: { hp: 900, attack: 120, speed: 35, energy: 40 },
    craft: { gold: 25000, materials: { ironplate: 8, crystalshard: 8, voidcore: 2 } },
    description: 'Legendäre Rüstung mit Boni auf alle vier Werte.',
  },
};

export function getArmorBonus(armorId: string | null | undefined): ArmorStatBonus {
  if (!armorId) return {};
  return ARMOR_DEFS[armorId]?.bonus ?? {};
}

/** Zufälliges Material-Drop-Paket für einen gewonnenen Kampf, gewichtet nach
 *  dropWeight. `tier` (z. B. Gegner-/Story-Stufe) erhöht Menge und Seltenheit. */
export function rollMaterialDrops(tier = 1): Record<string, number> {
  const drops: Record<string, number> = {};
  const rolls = 1 + Math.floor(Math.random() * 2) + Math.floor(tier / 3);
  const entries = Object.values(MATERIALS);
  const totalWeight = entries.reduce((s, m) => s + m.dropWeight, 0);
  for (let i = 0; i < rolls; i++) {
    let r = Math.random() * totalWeight;
    for (const m of entries) {
      r -= m.dropWeight;
      if (r <= 0) { drops[m.id] = (drops[m.id] ?? 0) + 1; break; }
    }
  }
  return drops;
}
