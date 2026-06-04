// ── Gruppe 10 — Supabase-Backend (echtes Online via PostgREST) ──────────────
// Erfüllt dieselbe OnlineService-Schnittstelle wie der lokale Mock, spricht aber
// die Supabase-REST-API an (kein SDK nötig → keine zusätzliche Abhängigkeit).
// Aktiv, sobald VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY gesetzt sind
// (siehe getOnlineService()). Tabellen/RLS: supabase/migrations/.
//
// Hinweise/TODO:
//  • Schreibzugriff ist derzeit anon-offen (kein Supabase-Auth angebunden).
//    Sobald Supabase-Auth genutzt wird: RLS auf auth.uid() = id verschärfen.
//  • PvP-Echtzeit, Trading & Clan-Kriege brauchen Realtime-Channels (Follow-up).
import type {
  OnlineService, PlayerProfile, LeaderboardKind, LeaderboardEntry, Clan, Auction, NewAuction, NewClan,
} from './types';
import { buildSelfProfile, getSelfId, getSelfName } from './profile';
import { getAccessToken } from '@store/authStore';

interface ProfileRow {
  id: string; name: string; player_level: number; trophies: number;
  battles_won: number; monsters_owned: number; rarest_rank: number;
  top_monsters: PlayerProfile['topMonsters'] | null;
}

const LB_COLUMN: Record<LeaderboardKind, string> = {
  trophies: 'trophies', battlesWon: 'battles_won', rarest: 'rarest_rank', level: 'player_level',
};

export class SupabaseOnlineService implements OnlineService {
  readonly kind = 'supabase' as const;
  private joinedClanId: string | null = null;

  constructor(private url: string, private key: string) {
    this.url = url.replace(/\/+$/, '');
  }

  private async rest(path: string, init?: RequestInit): Promise<Response> {
    // Mit eingeloggtem Spieler das User-Access-Token verwenden (auth.uid()
    // verfügbar → ermöglicht spätere RLS-Härtung); sonst den anon-Key.
    const token = getAccessToken() ?? this.key;
    return fetch(`${this.url}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: this.key,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });
  }

  private rowToProfile(row: ProfileRow): PlayerProfile {
    return {
      id: row.id, name: row.name, playerLevel: row.player_level, trophies: row.trophies,
      battlesWon: row.battles_won, monstersOwned: row.monsters_owned, rarestRank: row.rarest_rank,
      topMonsters: row.top_monsters ?? [], isSelf: row.id === getSelfId(),
    };
  }

  // Eigenes Profil hochladen (upsert), damit der Spieler in den Listen auftaucht.
  private async upsertSelf(): Promise<void> {
    try {
      const p = buildSelfProfile();
      await this.rest('profiles', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify({
          id: p.id, name: p.name, player_level: p.playerLevel, trophies: p.trophies,
          battles_won: p.battlesWon, monsters_owned: p.monstersOwned, rarest_rank: p.rarestRank,
          top_monsters: p.topMonsters, updated_at: new Date().toISOString(),
        }),
      });
    } catch { /* offline/Fehler → still */ }
  }

  async getSelfProfile(): Promise<PlayerProfile> {
    void this.upsertSelf();
    return buildSelfProfile();
  }

  async getLeaderboard(kind: LeaderboardKind): Promise<LeaderboardEntry[]> {
    await this.upsertSelf();
    try {
      const res = await this.rest(`profiles?select=*&order=${LB_COLUMN[kind]}.desc&limit=50`);
      if (!res.ok) return [];
      const rows = (await res.json()) as ProfileRow[];
      return rows.map((row, i) => {
        const profile = this.rowToProfile(row);
        const value = kind === 'trophies' ? profile.trophies
          : kind === 'battlesWon' ? profile.battlesWon
          : kind === 'rarest' ? profile.rarestRank
          : profile.playerLevel;
        return { rank: i + 1, profile, value };
      });
    } catch { return []; }
  }

  async getFriends(): Promise<PlayerProfile[]> {
    try {
      const self = getSelfId();
      const res = await this.rest('profiles?select=*&order=trophies.desc&limit=6');
      if (!res.ok) return [];
      const rows = (await res.json()) as ProfileRow[];
      return rows.map(r => this.rowToProfile(r)).filter(p => p.id !== self).slice(0, 5);
    } catch { return []; }
  }

  async listClans(): Promise<Clan[]> {
    try {
      // Mitgliederzahl über Resource-Embedding (clan_members(count)).
      const res = await this.rest('clans?select=*,clan_members(count)&order=trophies.desc');
      if (!res.ok) return [];
      const rows = (await res.json()) as any[];
      // Eigene Clan-Mitgliedschaft cachen.
      void this.refreshJoinedClan();
      return rows.map(r => ({
        id: r.id, name: r.name, tag: r.tag, description: r.description ?? '',
        trophies: r.trophies ?? 0, maxMembers: r.max_members ?? 30,
        memberCount: Array.isArray(r.clan_members) ? (r.clan_members[0]?.count ?? 0) : 0,
      }));
    } catch { return []; }
  }

  private async refreshJoinedClan(): Promise<void> {
    try {
      const res = await this.rest(`clan_members?select=clan_id&profile_id=eq.${encodeURIComponent(getSelfId())}&limit=1`);
      if (!res.ok) return;
      const rows = (await res.json()) as { clan_id: string }[];
      this.joinedClanId = rows[0]?.clan_id ?? null;
    } catch { /* ignore */ }
  }

  async joinClan(clanId: string): Promise<boolean> {
    try {
      await this.upsertSelf(); // FK: profile muss existieren
      const res = await this.rest('clan_members', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify({ clan_id: clanId, profile_id: getSelfId() }),
      });
      if (!res.ok) return false;
      this.joinedClanId = clanId;
      return true;
    } catch { return false; }
  }

  async createClan(input: NewClan): Promise<Clan | null> {
    try {
      const res = await this.rest('clans', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ name: input.name, tag: input.tag, description: input.description, trophies: 0, max_members: 30 }),
      });
      if (!res.ok) return null;
      const rows = (await res.json()) as any[];
      const r = rows[0];
      if (!r) return null;
      // Ersteller direkt beitreten lassen.
      await this.joinClan(r.id);
      return { id: r.id, name: r.name, tag: r.tag, description: r.description ?? '', trophies: r.trophies ?? 0, maxMembers: r.max_members ?? 30, memberCount: 1 };
    } catch { return null; }
  }

  getJoinedClanId(): string | null { return this.joinedClanId; }

  // ── Auktionshaus ──────────────────────────────────────────────────────────
  private rowToAuction(r: any): Auction {
    return {
      id: r.id, sellerId: r.seller_id, sellerName: r.seller_name, defId: r.def_id,
      monsterName: r.monster_name, level: r.level, rankStars: r.rank_stars,
      rarity: r.rarity, price: r.price, currency: r.currency,
      status: r.status, createdAt: r.created_at,
    };
  }

  async listAuctions(): Promise<Auction[]> {
    try {
      const res = await this.rest('auctions?select=*&status=eq.active&order=created_at.desc&limit=50');
      if (!res.ok) return [];
      return ((await res.json()) as any[]).map(r => this.rowToAuction(r));
    } catch { return []; }
  }

  async createAuction(input: NewAuction): Promise<Auction | null> {
    try {
      await this.upsertSelf();
      const res = await this.rest('auctions', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          seller_id: getSelfId(), seller_name: getSelfName(), def_id: input.defId,
          monster_name: input.monsterName, level: input.level, rank_stars: input.rankStars,
          rarity: input.rarity, price: input.price, currency: input.currency, status: 'active',
        }),
      });
      if (!res.ok) return null;
      const rows = (await res.json()) as any[];
      return rows[0] ? this.rowToAuction(rows[0]) : null;
    } catch { return null; }
  }

  async buyAuction(id: string): Promise<boolean> {
    try {
      // Atomar: nur eine noch aktive Auktion kann gekauft werden (status=active).
      const res = await this.rest(`auctions?id=eq.${encodeURIComponent(id)}&status=eq.active`, {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ status: 'sold', buyer_id: getSelfId() }),
      });
      if (!res.ok) return false;
      const rows = (await res.json()) as any[];
      return rows.length > 0; // 0 → schon verkauft
    } catch { return false; }
  }
}
