// ── Gruppe 10 — Multiplayer: Service-Factory + lokaler Mock ──────────────────
// Liefert die aktive OnlineService-Implementierung:
//   • SupabaseOnlineService, wenn VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
//     gesetzt sind (echtes Backend, via REST/PostgREST),
//   • sonst LocalOnlineService (offline-Mock mit simulierten Gegnern).
// Die UI (MultiplayerPanel) bleibt in beiden Fällen identisch.
import { MONSTER_DEFS } from '@data/monsters';
import { RARITY_RANK } from '@data/rarities';
import type {
  OnlineService, PlayerProfile, ProfileMonster, LeaderboardKind, LeaderboardEntry, Clan,
  Auction, NewAuction, NewClan,
} from './types';
import { buildSelfProfile, getSelfId, getSelfName } from './profile';
import { SupabaseOnlineService } from './supabaseService';

// Bestehende Importe (Panel) weiterhin von hier bedienbar.
export type {
  OnlineService, PlayerProfile, ProfileMonster, LeaderboardKind, LeaderboardEntry, Clan,
  Auction, NewAuction, NewClan, Currency,
} from './types';

// ── Deterministische Mock-Welt ──────────────────────────────────────────────
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
    const topMonsters: ProfileMonster[] = Array.from({ length: 3 }, () => {
      const id = ALL_DEF_IDS[Math.floor(r() * ALL_DEF_IDS.length)] ?? ALL_DEF_IDS[0];
      const d = MONSTER_DEFS[id];
      return { defId: id, name: d?.name ?? id, level: 1 + Math.floor(r() * 120), rarity: d?.rarity ?? 'Common', rarityRank: d ? RARITY_RANK[d.rarity] : 0 };
    });
    return {
      id: `bot_${i}`, name, playerLevel: 5 + Math.floor(r() * 60),
      trophies: Math.floor(r() * 4000), battlesWon: Math.floor(r() * 800),
      monstersOwned: 5 + Math.floor(r() * 80),
      rarestRank: Math.max(...topMonsters.map(m => m.rarityRank), 0), topMonsters,
    };
  });
}

const MOCK_CLANS: Clan[] = [
  { id: 'clan_emberguard', name: 'Emberguard', tag: 'EMB', description: 'Feuer-Veteranen, die den Riss zurückdrängen.', trophies: 18400, memberCount: 22, maxMembers: 30 },
  { id: 'clan_tidecallers', name: 'Tidecallers', tag: 'TIDE', description: 'Wasser-Taktiker mit eiserner Disziplin.', trophies: 15120, memberCount: 18, maxMembers: 30 },
  { id: 'clan_voidborn', name: 'Voidborn', tag: 'VOID', description: 'Sammler seltenster Dämonen.', trophies: 21030, memberCount: 27, maxMembers: 30 },
  { id: 'clan_dawnseekers', name: 'Dawnseekers', tag: 'DAWN', description: 'Beschützer-Gilde, Einsteiger willkommen.', trophies: 9800, memberCount: 11, maxMembers: 30 },
];

// Ein paar simulierte Start-Auktionen (Bot-Verkäufer) für den Offline-Modus.
function seedAuctions(): Auction[] {
  const picks = ALL_DEF_IDS.slice(0, 6);
  return picks.map((defId, i) => {
    const d = MONSTER_DEFS[defId];
    const r = seeded(i * 131 + 7);
    const currency: 'gold' | 'diamonds' = r() < 0.5 ? 'gold' : 'diamonds';
    return {
      id: `seed_${i}`, sellerId: `bot_${i}`, sellerName: BOT_NAMES[i] ?? 'Händler',
      defId, monsterName: d?.name ?? defId, level: 5 + Math.floor(r() * 90),
      rankStars: Math.floor(r() * 4), rarity: d?.rarity ?? 'Common',
      price: currency === 'gold' ? 1000 + Math.floor(r() * 20000) : 10 + Math.floor(r() * 90),
      currency, status: 'active' as const, createdAt: new Date(Date.now() - i * 3600_000).toISOString(),
    };
  });
}

class LocalOnlineService implements OnlineService {
  readonly kind = 'local' as const;
  private joinedClanId: string | null = null;
  private bots = makeBots();
  private auctions: Auction[] = seedAuctions();

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

  async getFriends(): Promise<PlayerProfile[]> { return this.bots.slice(0, 5); }

  async listClans(): Promise<Clan[]> {
    return MOCK_CLANS.map(c => this.joinedClanId === c.id ? { ...c, memberCount: c.memberCount + 1 } : c);
  }

  async joinClan(clanId: string): Promise<boolean> {
    if (!MOCK_CLANS.some(c => c.id === clanId)) return false;
    this.joinedClanId = clanId;
    return true;
  }

  async createClan(input: NewClan): Promise<Clan | null> {
    const clan: Clan = {
      id: `clan_${Date.now()}`, name: input.name, tag: input.tag,
      description: input.description, trophies: 0, memberCount: 1, maxMembers: 30,
    };
    MOCK_CLANS.unshift(clan);
    this.joinedClanId = clan.id;
    return clan;
  }

  getJoinedClanId(): string | null { return this.joinedClanId; }

  async listAuctions(): Promise<Auction[]> {
    return this.auctions.filter(a => a.status === 'active');
  }

  async createAuction(input: NewAuction): Promise<Auction | null> {
    const a: Auction = {
      id: `auc_${Date.now()}_${Math.floor(Math.random() * 1e4)}`,
      sellerId: getSelfId(), sellerName: getSelfName(),
      ...input, status: 'active', createdAt: new Date().toISOString(),
    };
    this.auctions.unshift(a);
    return a;
  }

  async buyAuction(id: string): Promise<boolean> {
    const a = this.auctions.find(x => x.id === id && x.status === 'active');
    if (!a) return false;
    a.status = 'sold';
    return true;
  }
}

let instance: OnlineService | null = null;

export function getOnlineService(): OnlineService {
  if (instance) return instance;
  const env = (import.meta as any).env ?? {};
  const url: string | undefined = env.VITE_SUPABASE_URL;
  const key: string | undefined = env.VITE_SUPABASE_ANON_KEY;
  instance = url && key ? new SupabaseOnlineService(url, key) : new LocalOnlineService();
  return instance;
}
