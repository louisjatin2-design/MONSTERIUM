// ── Gruppe 5 — Bindung / Relationship-Tasks (Path-to-Nowhere-Stil) ──────────
// Jedes Monster hat eine Bindungsstufe, die über kleine Interaktionen/Aufgaben
// ("Befragung", "Gemeinsames Training", "Pflege") steigt. Höhere Bindung gibt
// dem Monster permanente Statwert-Boni und schaltet Flavor-Inhalte frei.
// TODO: monsterspezifische Story-Aufgaben/Dialoge pro defId.

export interface BondTier {
  level: number;
  xpNeeded: number;     // kumulative Bindungs-XP für diese Stufe
  title: string;
  statBonus: number;    // multiplikativer Bonus auf alle Werte (z. B. 0.04 = +4%)
}

export const BOND_TIERS: BondTier[] = [
  { level: 0, xpNeeded: 0,   title: 'Misstrauisch', statBonus: 0 },
  { level: 1, xpNeeded: 50,  title: 'Vorsichtig',   statBonus: 0.03 },
  { level: 2, xpNeeded: 150, title: 'Vertraut',     statBonus: 0.06 },
  { level: 3, xpNeeded: 300, title: 'Loyal',        statBonus: 0.10 },
  { level: 4, xpNeeded: 550, title: 'Verbündet',    statBonus: 0.15 },
  { level: 5, xpNeeded: 900, title: 'Seelenbund',   statBonus: 0.22 },
];

export const MAX_BOND_LEVEL = BOND_TIERS[BOND_TIERS.length - 1].level;

export interface BondTask {
  id: string;
  icon: string;
  label: string;
  description: string;
  xp: number;
  cost: { gold?: number; food?: number };
}

// Tägliche Bindungs-Aufgaben pro Monster (gemeinsamer Cooldown via lastBondMs).
export const BOND_TASKS: BondTask[] = [
  { id: 'interrogate', icon: '🗣️', label: 'Befragung',         description: 'Sprich mit dem Monster und gewinne sein Vertrauen.', xp: 25, cost: { gold: 100 } },
  { id: 'train',       icon: '🤝', label: 'Gemeinsames Training', description: 'Trainiert zusammen — stärkt die Bindung.',          xp: 40, cost: { food: 30 } },
  { id: 'care',        icon: '🧴', label: 'Pflege',             description: 'Umsorge das Monster ausgiebig.',                     xp: 20, cost: { gold: 50, food: 10 } },
];

export const BOND_COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6h zwischen Interaktionen

export function getBondTier(bondXp: number): BondTier {
  let tier = BOND_TIERS[0];
  for (const t of BOND_TIERS) if (bondXp >= t.xpNeeded) tier = t;
  return tier;
}

/** Bonus-Multiplikator (1 + statBonus) für die Werte eines Monsters. */
export function getBondStatMultiplier(bondXp: number): number {
  return 1 + getBondTier(bondXp).statBonus;
}

/** Nächste Stufe (oder null bei Max) — für Fortschrittsanzeige. */
export function getNextBondTier(bondXp: number): BondTier | null {
  return BOND_TIERS.find(t => t.xpNeeded > bondXp) ?? null;
}
