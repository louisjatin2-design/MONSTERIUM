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

export interface OnlineService {
  readonly kind: 'local' | 'supabase';
  getSelfProfile(): Promise<PlayerProfile>;
  getLeaderboard(kind: LeaderboardKind): Promise<LeaderboardEntry[]>;
  getFriends(): Promise<PlayerProfile[]>;
  listClans(): Promise<Clan[]>;
  joinClan(clanId: string): Promise<boolean>;
  getJoinedClanId(): string | null;
  // Auktionshaus
  listAuctions(): Promise<Auction[]>;
  createAuction(input: NewAuction): Promise<Auction | null>;
  buyAuction(id: string): Promise<boolean>;
}
