// ── Gruppe 3 — Passive Fähigkeiten über Rang-Ups ───────────────────────────
// Passive werden durch Rank-Ups (rankStars, siehe Labor/ProgressionSystem)
// freigeschaltet und sind dauerhaft im Kampf aktiv. Sie wirken als permanente
// Statwert-Multiplikatoren, die beim Aufbau eines Kämpfers angewandt werden
// (siehe BattleSystem.buildCombatant). Höhere Sterne stapeln die niedrigeren.
// TODO: später runtime-Passive (z. B. Lebensraub, Konter) ergänzen.

export interface PassiveMult {
  hp?: number;
  attack?: number;
  defense?: number;
  speed?: number;
}

export interface PassiveDef {
  star: number;     // ab wie vielen Rang-Sternen aktiv
  icon: string;
  name: string;
  description: string;
  mult: PassiveMult;
}

export const RANK_PASSIVES: PassiveDef[] = [
  { star: 1, icon: '🛡️', name: 'Gehärtet',  description: '+10% Leben',       mult: { hp: 1.10 } },
  { star: 2, icon: '⚔️', name: 'Geschärft', description: '+10% Stärke',      mult: { attack: 1.10 } },
  { star: 3, icon: '🪨', name: 'Bollwerk',  description: '+12% Abwehr',      mult: { defense: 1.12 } },
  { star: 4, icon: '💨', name: 'Flink',     description: '+10% Tempo',       mult: { speed: 1.10 } },
  { star: 5, icon: '🌟', name: 'Erwacht',   description: '+12% auf alle Werte', mult: { hp: 1.12, attack: 1.12, defense: 1.12, speed: 1.12 } },
];

/** Alle bei `rankStars` aktiven Passive (kumulativ). */
export function getActivePassives(rankStars: number): PassiveDef[] {
  return RANK_PASSIVES.filter(p => p.star <= rankStars);
}

/** Kombinierte Statwert-Multiplikatoren aller aktiven Passive. */
export function getPassiveMultipliers(rankStars: number): Required<PassiveMult> {
  const out = { hp: 1, attack: 1, defense: 1, speed: 1 };
  for (const p of getActivePassives(rankStars)) {
    if (p.mult.hp) out.hp *= p.mult.hp;
    if (p.mult.attack) out.attack *= p.mult.attack;
    if (p.mult.defense) out.defense *= p.mult.defense;
    if (p.mult.speed) out.speed *= p.mult.speed;
  }
  return out;
}
