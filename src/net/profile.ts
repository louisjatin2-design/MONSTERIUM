// ── Gruppe 10 — Eigenes Spielerprofil aus dem lokalen Spielzustand ──────────
// Gemeinsam genutzt von Mock- und Supabase-Service: baut das Profil des aktuellen
// Spielers (stärkste Monster, Stats) und liefert eine stabile Spieler-ID/Name
// aus dem Account.
import { useGameStore } from '@store/gameStore';
import { useAuthStore, getAuthUserId } from '@store/authStore';
import { MONSTER_DEFS } from '@data/monsters';
import { RARITY_RANK } from '@data/rarities';
import type { PlayerProfile, ProfileMonster } from './types';

/** Stabile Spieler-ID für Supabase-Zeilen: bevorzugt die echte Auth-User-ID
 *  (Supabase), sonst account-/lokal-gebunden. */
export function getSelfId(): string {
  const uid = getAuthUserId();
  if (uid) return uid;
  const u = useAuthStore.getState().currentUser;
  return u ? `u_${u.toLowerCase()}` : 'guest';
}

export function getSelfName(): string {
  return useAuthStore.getState().currentUser ?? 'Hüter';
}

/** Profil des aktuellen Spielers aus dem Spielstand. */
export function buildSelfProfile(): PlayerProfile {
  const s = useGameStore.getState();
  const owned = Object.values(s.monsters);
  let rarest = 0;
  for (const m of owned) {
    const d = MONSTER_DEFS[m.defId];
    if (d) rarest = Math.max(rarest, RARITY_RANK[d.rarity]);
  }
  const top: ProfileMonster[] = [...owned]
    .sort((a, b) => b.level - a.level)
    .slice(0, 3)
    .map(m => {
      const d = MONSTER_DEFS[m.defId];
      return {
        defId: m.defId, name: m.name ?? d?.name ?? m.defId, level: m.level,
        rarity: d?.rarity ?? 'Common', rarityRank: d ? RARITY_RANK[d.rarity] : 0,
      };
    });
  return {
    id: getSelfId(), name: getSelfName(), playerLevel: s.playerLevel, trophies: s.trophies,
    battlesWon: s.stats.battlesWon, monstersOwned: owned.length, rarestRank: rarest,
    topMonsters: top, isSelf: true,
  };
}
