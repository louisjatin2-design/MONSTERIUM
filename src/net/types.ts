// ── Gruppe 10 — Multiplayer: gemeinsame Typen + Service-Schnittstelle ────────
// Von der lokalen Mock-Implementierung (onlineService.ts) UND dem echten
// Supabase-Adapter (supabaseService.ts) genutzt.

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

// Eingabe zum Erstellen eines Clans.
export interface NewClan {
  name: string;
  tag: string;
  description: string;
}

// ── Auktionshaus (Gruppe 8/10) ──────────────────────────────────────────────
export type Currency = 'gold' | 'diamonds';

export interface Auction {
  id: string;
  sellerId: string;
  sellerName: string;
  defId: string;
  monsterName: string;
  level: number;
  rankStars: number;
  rarity: string;
  price: number;
  currency: Currency;
  status: 'active' | 'sold';
  createdAt: string;
}

// Eingabe zum Einstellen eines Monsters ins Auktionshaus.
export interface NewAuction {
  defId: string;
  monsterName: string;
  level: number;
  rankStars: number;
  rarity: string;
  price: number;
  currency: Currency;
}

// ── PvP-Arena (asynchrones Spieler-gegen-Spieler) ───────────────────────────
// Snapshot eines Monsters in einem Verteidigungs-Team bzw. Gegner-Team.
export interface PvpTeamMonster {
  defId: string;
  name: string;
  level: number;
  rankStars: number;
  rarity: string;
  rarityRank: number;
}

// Eigener PvP-Zustand: aktuelles Rating, Bilanz und hinterlegtes Verteidigungs-Team.
export interface PvpState {
  rating: number;
  wins: number;
  losses: number;
  defenseTeam: PvpTeamMonster[];
}

// Ein gefundener Gegner (Snapshot seines Verteidigungs-Teams).
export interface PvpOpponent {
  id: string;
  name: string;
  rating: number;
  team: PvpTeamMonster[];
  /** true, wenn dies ein simulierter Bot-Gegner ist (kein echter Spieler). */
  isBot?: boolean;
}

// Ergebnis eines gewerteten PvP-Kampfes.
export interface PvpResult {
  won: boolean;
  ratingDelta: number;
  newRating: number;
}

export interface OnlineService {
  readonly kind: 'local' | 'supabase';
  getSelfProfile(): Promise<PlayerProfile>;
  getLeaderboard(kind: LeaderboardKind): Promise<LeaderboardEntry[]>;
  getFriends(): Promise<PlayerProfile[]>;
  listClans(): Promise<Clan[]>;
  joinClan(clanId: string): Promise<boolean>;
  createClan(input: NewClan): Promise<Clan | null>;
  getJoinedClanId(): string | null;
  // Auktionshaus
  listAuctions(): Promise<Auction[]>;
  createAuction(input: NewAuction): Promise<Auction | null>;
  buyAuction(id: string): Promise<boolean>;
  // PvP-Arena
  getPvpState(): Promise<PvpState>;
  setDefenseTeam(team: PvpTeamMonster[]): Promise<boolean>;
  findPvpOpponent(): Promise<PvpOpponent | null>;
  reportPvpResult(opponentId: string, won: boolean, opponentRating: number): Promise<PvpResult>;
}
