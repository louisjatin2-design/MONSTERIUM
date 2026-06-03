// ── Gruppe 10 — Multiplayer: Online-Service-Abstraktion ─────────────────────
// Das Spiel ist aktuell rein lokal (localStorage). Diese Schicht definiert eine
// austauschbare Schnittstelle für Online-Funktionen (Bestenlisten, Freunde,
// Clans, später PvP/Trading) und liefert eine LOKALE Mock-Implementierung, die
// offline funktioniert (simulierte Gegner + die echten Spielerdaten).
//
// Designentscheidung des Nutzers: Backend = Firebase/Supabase. Die echte
// Anbindung gehört in eine zweite Implementierung (firebaseService), die diese
// Schnittstelle erfüllt und über getOnlineService() gewählt wird, sobald
// Konfiguration/Keys vorliegen. So bleibt die UI unverändert.
//
// TODO(backend): FirebaseOnlineService implementieren:
//   - Auth (anonym/Account) → playerId
//   - Firestore-Sammlungen: profiles, leaderboards, clans, friendRequests
//   - Realtime-Listener für PvP-Matches & Clan-Kriege
//   Konfiguration via Umgebungsvariablen (z. B. VITE_FIREBASE_*), niemals
//   Keys committen.
import { useGameStore } from '@store/gameStore';
import { MONSTER_DEFS } from '@data/monsters';
import { RARITY_RANK } from '@data/rarities';

export interface ProfileMonster {
  defId: string;
  name: string;
  level: number;
  rarity: string;
  rarityRank: number;
}

export interface PlayerProfile {
  id: string;
  name: string;
  playerLevel: number;
  trophies: number;
  battlesWon: number;
  monstersOwned: number;
  rarestRank: number;
  topMonsters: ProfileMonster[];
  isSelf?: boolean;
}

export type LeaderboardKind = 'trophies' | 'battlesWon' | 'rarest' | 'level';

export interface LeaderboardEntry {
  rank: number;
  profile: PlayerProfile;
  value: number;
}

export interface Clan {
  id: string;
  name: string;
  tag: string;
  description: string;
  trophies: number;
  memberCount: number;
  maxMembers: number;
}

export interface OnlineService {
  readonly kind: 'local' | 'firebase';
  getSelfProfile(): Promise<PlayerProfile>;
  getLeaderboard(kind: LeaderboardKind): Promise<LeaderboardEntry[]>;
  getFriends(): Promise<PlayerProfile[]>;
  listClans(): Promise<Clan[]>;
  joinClan(clanId: string): Promise<boolean>;
  getJoinedClanId(): string | null;
}

// ── Hilfsfunktionen für die lokale Mock-Welt ────────────────────────────────
function buildSelfProfile(): PlayerProfile {
  const s = useGameStore.getState();
  const owned = Object.values(s.monsters);
  let rarest = 0;
  for (const m of owned) {
    const d = MONSTER_DEFS[m.defId];
    if (d) rarest = Math.max(rarest, RARITY_RANK[d.rarity]);
  }
  const top = [...owned]
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
    id: 'self', name: 'Du', playerLevel: s.playerLevel, trophies: s.trophies,
    battlesWon: s.stats.battlesWon, monstersOwned: owned.length, rarestRank: rarest,
    topMonsters: top, isSelf: true,
  };
}

// Deterministische Bot-Profile, damit die Listen stabil wirken.
const BOT_NAMES = [
  'Aurelia', 'Kraxx', 'Nyx', 'Volt', 'Seraphine', 'Grimm', 'Lyra', 'Onyx',
  'Vesper', 'Cinder', 'Mira', 'Draxen', 'Selka', 'Thorne', 'Yuki', 'Rook',
];
const ALL_DEF_IDS = Object.keys(MONSTER_DEFS);

function seeded(n: number): () => number {
  let x = n + 0x9e3779b9;
  return () => { x = Math.imul(x ^ (x >>> 15), 1 | x); x ^= x + Math.imul(x ^ (x >>> 7), 61 | x); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
}

function makeBots(): PlayerProfile[] {
  return BOT_NAMES.map((name, i) => {
    const r = seeded(i * 977 + 13);
    const playerLevel = 5 + Math.floor(r() * 60);
    const trophies = Math.floor(r() * 4000);
    const battlesWon = Math.floor(r() * 800);
    const topMonsters: ProfileMonster[] = Array.from({ length: 3 }, () => {
      const id = ALL_DEF_IDS[Math.floor(r() * ALL_DEF_IDS.length)] ?? ALL_DEF_IDS[0];
      const d = MONSTER_DEFS[id];
      return { defId: id, name: d?.name ?? id, level: 1 + Math.floor(r() * 120), rarity: d?.rarity ?? 'Common', rarityRank: d ? RARITY_RANK[d.rarity] : 0 };
    });
    const rarestRank = Math.max(...topMonsters.map(m => m.rarityRank), 0);
    return { id: `bot_${i}`, name, playerLevel, trophies, battlesWon, monstersOwned: 5 + Math.floor(r() * 80), rarestRank, topMonsters };
  });
}

const MOCK_CLANS: Clan[] = [
  { id: 'clan_emberguard', name: 'Emberguard', tag: 'EMB', description: 'Feuer-Veteranen, die den Riss zurückdrängen.', trophies: 18400, memberCount: 22, maxMembers: 30 },
  { id: 'clan_tidecallers', name: 'Tidecallers', tag: 'TIDE', description: 'Wasser-Taktiker mit eiserner Disziplin.', trophies: 15120, memberCount: 18, maxMembers: 30 },
  { id: 'clan_voidborn', name: 'Voidborn', tag: 'VOID', description: 'Sammler seltenster Dämonen.', trophies: 21030, memberCount: 27, maxMembers: 30 },
  { id: 'clan_dawnseekers', name: 'Dawnseekers', tag: 'DAWN', description: 'Beschützer-Gilde für Einsteiger willkommen.', trophies: 9800, memberCount: 11, maxMembers: 30 },
];

class LocalOnlineService implements OnlineService {
  readonly kind = 'local' as const;
  private joinedClanId: string | null = null;
  private bots = makeBots();

  async getSelfProfile(): Promise<PlayerProfile> { return buildSelfProfile(); }

  async getLeaderboard(kind: LeaderboardKind): Promise<LeaderboardEntry[]> {
    const all = [buildSelfProfile(), ...this.bots];
    const valueOf = (p: PlayerProfile) =>
      kind === 'trophies' ? p.trophies
      : kind === 'battlesWon' ? p.battlesWon
      : kind === 'rarest' ? p.rarestRank
      : p.playerLevel;
    return all
      .map(p => ({ p, v: valueOf(p) }))
      .sort((a, b) => b.v - a.v)
      .map((e, i) => ({ rank: i + 1, profile: e.p, value: e.v }));
  }

  async getFriends(): Promise<PlayerProfile[]> {
    // Mock: die ersten paar Bots gelten als „Freunde".
    return this.bots.slice(0, 5);
  }

  async listClans(): Promise<Clan[]> {
    return MOCK_CLANS.map(c => this.joinedClanId === c.id ? { ...c, memberCount: c.memberCount + 1 } : c);
  }

  async joinClan(clanId: string): Promise<boolean> {
    if (!MOCK_CLANS.some(c => c.id === clanId)) return false;
    this.joinedClanId = clanId;
    return true;
  }

  getJoinedClanId(): string | null { return this.joinedClanId; }
}

let instance: OnlineService | null = null;

/**
 * Liefert die aktive Online-Service-Implementierung. Aktuell immer der lokale
 * Mock. Sobald ein Firebase/Supabase-Adapter existiert und konfiguriert ist,
 * hier anhand der Konfiguration umschalten.
 */
export function getOnlineService(): OnlineService {
  if (!instance) instance = new LocalOnlineService();
  return instance;
}
