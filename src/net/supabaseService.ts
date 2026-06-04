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
  OnlineService, PlayerProfile, LeaderboardKind, LeaderboardEntry, Clan, Auction, NewAuction,
  PvpState, PvpTeamMonster, PvpOpponent, PvpResult,
} from './types';
import { buildSelfProfile, getSelfId, getSelfName } from './profile';
import {
  PVP_START_RATING, ratingDelta, applyRatingDelta, buildDefaultDefenseTeam, makeBotOpponent,
  pickClosestOpponent, toTeamMonster,
} from './pvp';
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

  // ── PvP-Arena ───────────────────────────────────────────────────────────────
  private teamFromJson(raw: any): PvpTeamMonster[] {
    if (!Array.isArray(raw)) return [];
    return raw
      .filter(m => m && typeof m.defId === 'string')
      .map(m => toTeamMonster(m.defId, m.level ?? 1, m.rankStars ?? 0, m.name));
  }

  // Eigene pvp_teams-Zeile holen (oder null, falls noch keine existiert).
  private async fetchSelfPvpRow(): Promise<any | null> {
    const res = await this.rest(`pvp_teams?select=*&profile_id=eq.${encodeURIComponent(getSelfId())}&limit=1`);
    if (!res.ok) return null;
    const rows = (await res.json()) as any[];
    return rows[0] ?? null;
  }

  async getPvpState(): Promise<PvpState> {
    try {
      const row = await this.fetchSelfPvpRow();
      if (!row) {
        // Noch keine Zeile → Standard-Team vorschlagen (wird erst beim Speichern
        // bzw. nach dem ersten Kampf persistiert).
        return { rating: PVP_START_RATING, wins: 0, losses: 0, defenseTeam: buildDefaultDefenseTeam() };
      }
      const team = this.teamFromJson(row.team);
      return {
        rating: row.rating ?? PVP_START_RATING,
        wins: row.wins ?? 0,
        losses: row.losses ?? 0,
        defenseTeam: team.length > 0 ? team : buildDefaultDefenseTeam(),
      };
    } catch {
      return { rating: PVP_START_RATING, wins: 0, losses: 0, defenseTeam: buildDefaultDefenseTeam() };
    }
  }

  async setDefenseTeam(team: PvpTeamMonster[]): Promise<boolean> {
    try {
      await this.upsertSelf(); // FK: profile muss existieren
      const existing = await this.fetchSelfPvpRow();
      const res = await this.rest('pvp_teams', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify({
          profile_id: getSelfId(), name: getSelfName(),
          // Rating/Bilanz nur setzen, wenn die Zeile neu ist (sonst beibehalten).
          rating: existing?.rating ?? PVP_START_RATING,
          wins: existing?.wins ?? 0, losses: existing?.losses ?? 0,
          team: team.slice(0, 3), updated_at: new Date().toISOString(),
        }),
      });
      return res.ok;
    } catch { return false; }
  }

  async findPvpOpponent(): Promise<PvpOpponent | null> {
    const selfId = getSelfId();
    let selfRating = PVP_START_RATING;
    try {
      const selfRow = await this.fetchSelfPvpRow();
      if (selfRow) selfRating = selfRow.rating ?? PVP_START_RATING;

      // 1) Echte hinterlegte Verteidigungs-Teams (ohne sich selbst).
      const res = await this.rest('pvp_teams?select=*&order=updated_at.desc&limit=40');
      if (res.ok) {
        const rows = (await res.json()) as any[];
        const candidates: PvpOpponent[] = rows
          .filter(r => r.profile_id !== selfId)
          .map(r => ({
            id: r.profile_id, name: r.name ?? 'Hüter', rating: r.rating ?? PVP_START_RATING,
            team: this.teamFromJson(r.team),
          }))
          .filter(o => o.team.length > 0);
        const picked = pickClosestOpponent(candidates, selfRating);
        if (picked) return picked;
      }

      // 2) Fallback: aus einem zufälligen Profil-Snapshot (top_monsters) ableiten.
      const pr = await this.rest('profiles?select=id,name,top_monsters,trophies&order=trophies.desc&limit=30');
      if (pr.ok) {
        const profs = ((await pr.json()) as any[]).filter(p => p.id !== selfId);
        const withTeam = profs.filter(p => Array.isArray(p.top_monsters) && p.top_monsters.length > 0);
        if (withTeam.length > 0) {
          const p = withTeam[Math.floor(Math.random() * withTeam.length)];
          return {
            id: p.id, name: p.name ?? 'Hüter', rating: PVP_START_RATING,
            team: this.teamFromJson(p.top_monsters),
          };
        }
      }
    } catch { /* fällt unten auf Bot zurück */ }

    // 3) Letzte Rückfallebene: simulierter Gegner (Arena bleibt immer spielbar).
    return makeBotOpponent(selfRating);
  }

  async reportPvpResult(opponentId: string, won: boolean, opponentRating: number): Promise<PvpResult> {
    try {
      await this.upsertSelf(); // FK + Profil aktuell halten
      const row = await this.fetchSelfPvpRow();
      const selfRating = row?.rating ?? PVP_START_RATING;
      const delta = ratingDelta(selfRating, opponentRating, won);
      const newRating = applyRatingDelta(selfRating, delta);
      const wins = (row?.wins ?? 0) + (won ? 1 : 0);
      const losses = (row?.losses ?? 0) + (won ? 0 : 1);
      const team = row ? this.teamFromJson(row.team) : buildDefaultDefenseTeam();

      // Eigene PvP-Zeile aktualisieren (upsert, falls noch keine existierte).
      await this.rest('pvp_teams', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify({
          profile_id: getSelfId(), name: getSelfName(),
          rating: newRating, wins, losses, team, updated_at: new Date().toISOString(),
        }),
      });

      // Match protokollieren (Best-effort).
      void this.rest('pvp_matches', {
        method: 'POST',
        body: JSON.stringify({
          attacker_id: getSelfId(), attacker_name: getSelfName(),
          defender_id: opponentId, defender_name: 'Gegner',
          attacker_won: won, rating_delta: delta,
        }),
      }).catch(() => {});

      return { won, ratingDelta: delta, newRating };
    } catch {
      // Offline/Fehler: Rating lokal trotzdem fair schätzen, damit die UI reagiert.
      const delta = ratingDelta(PVP_START_RATING, opponentRating, won);
      return { won, ratingDelta: delta, newRating: applyRatingDelta(PVP_START_RATING, delta) };
    }
  }
}
