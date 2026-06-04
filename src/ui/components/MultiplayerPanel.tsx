import React, { useEffect, useState } from 'react';
import {
  getOnlineService, type LeaderboardKind, type LeaderboardEntry,
  type PlayerProfile, type Clan, type Auction, type Currency,
} from '../../net/onlineService';
import { useGameStore } from '@store/gameStore';
import { RARITY_COLORS } from '@data/rarities';
import { MONSTER_DEFS } from '@data/monsters';
import { HelpButton } from './HelpButton';
import '../styles/global.css';

interface Props { onClose: () => void; }

type Tab = 'leaderboard' | 'friends' | 'clans' | 'auction';

const LB_LABELS: Record<LeaderboardKind, string> = {
  trophies: '🏆 Trophäen', battlesWon: '⚔️ Siege', rarest: '💎 Seltenste', level: '⭐ Level',
};

// ── Gruppe 10 — Multiplayer (lokaler Mock; Firebase-ready) ──────────────────
export function MultiplayerPanel({ onClose }: Props) {
  const svc = getOnlineService();
  const [tab, setTab] = useState<Tab>('leaderboard');
  const [lbKind, setLbKind] = useState<LeaderboardKind>('trophies');
  const [lb, setLb] = useState<LeaderboardEntry[]>([]);
  const [friends, setFriends] = useState<PlayerProfile[]>([]);
  const [clans, setClans] = useState<Clan[]>([]);
  const [joined, setJoined] = useState<string | null>(svc.getJoinedClanId());

  useEffect(() => { svc.getLeaderboard(lbKind).then(setLb); }, [svc, lbKind]);
  useEffect(() => { svc.getFriends().then(setFriends); }, [svc]);
  useEffect(() => { svc.listClans().then(setClans); }, [svc, joined]);

  const join = async (id: string) => { if (await svc.joinClan(id)) setJoined(id); };

  return (
    <div className="panel panel-modal panel-w-lg" style={{ padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <button className="close-btn" onClick={onClose} style={{ zIndex: 5 }}>✕</button>
      <HelpButton
        title="Multiplayer"
        tips={[
          'Bestenlisten ranken Spieler nach Trophäen, Siegen, seltensten Monstern oder Level.',
          'In der Freundesliste siehst du die stärksten Monster und Stats anderer Spieler.',
          'Tritt einem Clan bei, um an Clan-Kriegen teilzunehmen.',
          'Hinweis: Online-Daten sind aktuell simuliert (lokaler Modus). Echtes PvP/Trading folgt mit dem Server-Backend.',
        ]}
      />

      <div style={{ padding: '14px 18px 0', background: 'linear-gradient(135deg, #122a48, #0a1626)', borderBottom: '2px solid #3f7fd0' }}>
        <div className="panel-title" style={{ marginBottom: 8, borderBottom: 'none', paddingBottom: 0 }}>
          🌐 Multiplayer
          <span style={{ fontSize: 10, color: '#7fa0c0', fontWeight: 400, marginLeft: 8 }}>
            {svc.kind === 'local' ? 'simuliert (lokal)' : 'online'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <TabBtn label="Bestenliste" active={tab === 'leaderboard'} onClick={() => setTab('leaderboard')} />
          <TabBtn label="Freunde" active={tab === 'friends'} onClick={() => setTab('friends')} />
          <TabBtn label="Clans" active={tab === 'clans'} onClick={() => setTab('clans')} />
          <TabBtn label="Auktion" active={tab === 'auction'} onClick={() => setTab('auction')} />
        </div>
      </div>

      <div style={{ overflowY: 'auto', padding: 14, flex: 1, minHeight: 0 }}>
        {tab === 'leaderboard' && (
          <>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
              {(Object.keys(LB_LABELS) as LeaderboardKind[]).map(k => (
                <button key={k} className="btn btn-info"
                  onClick={() => setLbKind(k)}
                  style={{ opacity: lbKind === k ? 1 : 0.5, padding: '4px 10px', fontSize: 12 }}>
                  {LB_LABELS[k]}
                </button>
              ))}
            </div>
            {lb.map(e => (
              <div key={e.profile.id} className="monster-card" style={{
                display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6,
                border: e.profile.isSelf ? '1px solid #ffd700' : undefined,
                background: e.profile.isSelf ? 'rgba(255,215,0,0.08)' : undefined,
              }}>
                <div style={{ width: 28, textAlign: 'center', fontWeight: 900, color: e.rank <= 3 ? '#ffd700' : '#889' }}>
                  {e.rank}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 14, color: e.profile.isSelf ? '#ffd700' : '#fff' }}>
                    {e.profile.name}
                  </div>
                  <div style={{ fontSize: 11, color: '#9aa' }}>Level {e.profile.playerLevel}</div>
                </div>
                <div style={{ fontWeight: 900, color: '#8fc0ff' }}>
                  {lbKind === 'rarest' ? `Rang ${e.value}` : e.value.toLocaleString()}
                </div>
              </div>
            ))}
          </>
        )}

        {tab === 'friends' && (
          <>
            {friends.map(f => <ProfileCard key={f.id} p={f} />)}
            <div style={{ fontSize: 11, color: '#778', textAlign: 'center', marginTop: 8 }}>
              Echtes Hinzufügen von Freunden & PvP folgt mit dem Server-Backend.
            </div>
          </>
        )}

        {tab === 'clans' && (
          <ClansTab
            clans={clans} joined={joined}
            onJoin={join}
            onChanged={() => svc.listClans().then(setClans)}
            onJoined={setJoined}
          />
        )}

        {tab === 'auction' && <AuctionTab />}
      </div>
    </div>
  );
}

// ── Clans (Gruppe 10): Liste, Beitreten, Erstellen für 100 💎 ───────────────
const CLAN_COST = 100;
function ClansTab({ clans, joined, onJoin, onChanged, onJoined }: {
  clans: Clan[]; joined: string | null;
  onJoin: (id: string) => void; onChanged: () => void; onJoined: (id: string) => void;
}) {
  const svc = getOnlineService();
  const diamonds = useGameStore(s => s.diamonds);
  const spendDiamonds = useGameStore(s => s.spendDiamonds);
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [desc, setDesc] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const create = async () => {
    if (busy) return;
    if (diamonds < CLAN_COST) { setMsg('Zu wenig Diamanten — 100 💎 nötig.'); return; }
    if (name.trim().length < 3 || tag.trim().length < 2) { setMsg('Name ≥ 3 und Kürzel ≥ 2 Zeichen.'); return; }
    setBusy(true);
    const clan = await svc.createClan({ name: name.trim(), tag: tag.trim().toUpperCase().slice(0, 4), description: desc.trim() });
    setBusy(false);
    if (clan) {
      spendDiamonds(CLAN_COST);
      onJoined(clan.id);
      setName(''); setTag(''); setDesc(''); setMsg('✅ Clan erstellt!');
      onChanged();
    } else setMsg('⚠️ Erstellen fehlgeschlagen (offline?).');
  };

  return (
    <>
      {/* Clan erstellen */}
      <div className="monster-card" style={{ marginBottom: 12, padding: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 900, color: '#8fc0ff', marginBottom: 6 }}>
          Eigenen Clan erstellen <span style={{ color: '#9be8bd' }}>(💎 {CLAN_COST})</span>
        </div>
        {msg && <div style={{ fontSize: 11, color: '#ffd700', marginBottom: 6 }}>{msg}</div>}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Clan-Name" maxLength={24}
            style={inputStyle('1 1 150px')} />
          <input value={tag} onChange={e => setTag(e.target.value)} placeholder="Kürzel" maxLength={4}
            style={inputStyle('0 0 80px')} />
        </div>
        <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Beschreibung (optional)" maxLength={80}
          style={{ ...inputStyle('1 1 100%'), marginTop: 6 }} />
        <button className="btn btn-gold" disabled={busy || diamonds < CLAN_COST} onClick={create}
          style={{ width: '100%', marginTop: 8, fontSize: 13 }}>
          💎 {CLAN_COST} — Clan gründen
        </button>
      </div>

      {clans.map(c => (
        <div key={c.id} className="monster-card" style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 900, fontSize: 14, color: '#8fc0ff' }}>[{c.tag}] {c.name}</div>
              {c.description && <div style={{ fontSize: 11, color: '#9aa', marginTop: 2 }}>{c.description}</div>}
              <div style={{ fontSize: 11, color: '#778', marginTop: 2 }}>
                🏆 {c.trophies.toLocaleString()} · 👥 {c.memberCount}/{c.maxMembers}
              </div>
            </div>
            <button className="btn btn-primary" style={{ minWidth: 90 }}
              disabled={joined === c.id} onClick={() => onJoin(c.id)}>
              {joined === c.id ? '✓ Beigetreten' : 'Beitreten'}
            </button>
          </div>
        </div>
      ))}
      <div style={{ fontSize: 11, color: '#778', textAlign: 'center', marginTop: 8 }}>
        Clan-Kriege (wöchentlich, mit Ranglisten) folgen mit dem Server-Backend.
      </div>
    </>
  );
}

function inputStyle(flex: string): React.CSSProperties {
  return {
    flex, minWidth: 0, boxSizing: 'border-box',
    background: 'rgba(0,0,0,0.4)', color: '#fff', border: '1px solid #3f5a8a',
    borderRadius: 6, padding: '6px 8px', fontSize: 12, width: flex.includes('100%') ? '100%' : undefined,
  };
}

// ── Auktionshaus (Gruppe 8/10) ──────────────────────────────────────────────
function AuctionTab() {
  const svc = getOnlineService();
  const monsters = useGameStore(s => s.monsters);
  const gold = useGameStore(s => s.gold);
  const diamonds = useGameStore(s => s.diamonds);
  const spendGold = useGameStore(s => s.spendGold);
  const spendDiamonds = useGameStore(s => s.spendDiamonds);
  const removeMonster = useGameStore(s => s.removeMonster);
  const grantMonster = useGameStore(s => s.grantMonster);

  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [sellId, setSellId] = useState<string>('');
  const [price, setPrice] = useState<number>(1000);
  const [currency, setCurrency] = useState<Currency>('gold');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = () => svc.listAuctions().then(setAuctions);
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, []);

  const ownList = Object.values(monsters);

  const sell = async () => {
    const m = monsters[sellId];
    if (!m || price <= 0 || busy) return;
    const def = MONSTER_DEFS[m.defId];
    setBusy(true);
    const created = await svc.createAuction({
      defId: m.defId, monsterName: m.name ?? def?.name ?? m.defId,
      level: m.level, rankStars: m.rankStars ?? 0, rarity: def?.rarity ?? 'Common',
      price, currency,
    });
    setBusy(false);
    if (created) { removeMonster(sellId); setSellId(''); setMsg('✅ Eingestellt!'); refresh(); }
    else setMsg('⚠️ Einstellen fehlgeschlagen (offline?).');
  };

  const buy = async (a: Auction) => {
    if (busy) return;
    if (a.currency === 'gold' && gold < a.price) { setMsg('Zu wenig Gold.'); return; }
    if (a.currency === 'diamonds' && diamonds < a.price) { setMsg('Zu wenig Diamanten.'); return; }
    setBusy(true);
    const ok = await svc.buyAuction(a.id);
    setBusy(false);
    if (!ok) { setMsg('⚠️ Schon verkauft.'); refresh(); return; }
    if (a.currency === 'gold') spendGold(a.price); else spendDiamonds(a.price);
    grantMonster(a.defId, a.level, a.rankStars, a.monsterName);
    setMsg(`✅ ${a.monsterName} (Lv ${a.level}) gekauft!`);
    refresh();
  };

  return (
    <>
      <div style={{ fontSize: 11, color: '#aaa', marginBottom: 10 }}>
        Verkaufe Monster an andere Spieler oder kaufe ihre — Preise in 🪙 Gold oder 💎 Diamanten.
      </div>
      {msg && <div style={{ fontSize: 12, color: '#ffd700', textAlign: 'center', marginBottom: 8 }}>{msg}</div>}

      {/* Einstellen */}
      <div className="monster-card" style={{ marginBottom: 12, padding: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 900, color: '#8fc0ff', marginBottom: 6 }}>Monster einstellen</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={sellId} onChange={e => setSellId(e.target.value)}
            style={{ flex: '1 1 140px', background: 'rgba(0,0,0,0.4)', color: '#fff', border: '1px solid #5a3a8a', borderRadius: 6, padding: '6px 8px', fontSize: 12 }}>
            <option value="">— Monster wählen —</option>
            {ownList.map(m => (
              <option key={m.instanceId} value={m.instanceId}>
                {(m.name ?? MONSTER_DEFS[m.defId]?.name ?? m.defId)} · Lv {m.level}
              </option>
            ))}
          </select>
          <input type="number" min={1} value={price} onChange={e => setPrice(Math.max(1, Number(e.target.value)))}
            style={{ width: 90, background: 'rgba(0,0,0,0.4)', color: '#fff', border: '1px solid #5a3a8a', borderRadius: 6, padding: '6px 8px', fontSize: 12 }} />
          <button className="btn" onClick={() => setCurrency(c => c === 'gold' ? 'diamonds' : 'gold')}
            style={{ padding: '6px 10px', fontSize: 12 }}>
            {currency === 'gold' ? '🪙' : '💎'}
          </button>
          <button className="btn btn-gold" disabled={!sellId || busy} onClick={sell} style={{ padding: '6px 12px', fontSize: 12 }}>
            Einstellen
          </button>
        </div>
      </div>

      {/* Angebote */}
      <div style={{ fontSize: 12, fontWeight: 900, color: '#8fc0ff', marginBottom: 6 }}>Aktuelle Angebote</div>
      {auctions.length === 0 && <div style={{ color: '#778', fontSize: 12 }}>Keine aktiven Auktionen.</div>}
      {auctions.map(a => {
        const col = RARITY_COLORS[a.rarity as keyof typeof RARITY_COLORS] ?? '#888';
        const affordable = a.currency === 'gold' ? gold >= a.price : diamonds >= a.price;
        return (
          <div key={a.id} className="monster-card" style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 13 }}>
                {a.monsterName} <span style={{ color: col, fontSize: 11 }}>· {a.rarity}</span>
              </div>
              <div style={{ fontSize: 11, color: '#9aa' }}>
                Lv {a.level}{a.rankStars > 0 ? ` · ${'★'.repeat(a.rankStars)}` : ''} · Verkäufer: {a.sellerName}
              </div>
            </div>
            <button className="btn btn-primary" disabled={busy || !affordable} onClick={() => buy(a)} style={{ minWidth: 96, fontSize: 12 }}>
              {a.currency === 'gold' ? `🪙 ${a.price.toLocaleString()}` : `💎 ${a.price}`}
            </button>
          </div>
        );
      })}
    </>
  );
}

function ProfileCard({ p }: { p: PlayerProfile }) {
  return (
    <div className="monster-card" style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 800, fontSize: 14 }}>{p.name}</span>
        <span style={{ fontSize: 11, color: '#9aa' }}>Lv {p.playerLevel} · 🏆 {p.trophies.toLocaleString()} · ⚔️ {p.battlesWon}</span>
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
        {p.topMonsters.map((m, i) => (
          <span key={i} style={{
            fontSize: 11, padding: '2px 8px', borderRadius: 6,
            background: 'rgba(255,255,255,0.05)',
            border: `1px solid ${RARITY_COLORS[m.rarity as keyof typeof RARITY_COLORS] ?? '#666'}`,
            color: '#ddd',
          }}>
            {MONSTER_DEFS[m.defId] ? (m.name) : m.defId} · Lv {m.level}
          </span>
        ))}
      </div>
    </div>
  );
}

function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: '8px 0', fontSize: 13, fontWeight: 900, cursor: 'pointer',
      border: 'none', borderRadius: '8px 8px 0 0',
      background: active ? 'rgba(63,127,208,0.25)' : 'transparent',
      color: active ? '#8fc0ff' : '#667',
      borderBottom: active ? '2px solid #3f7fd0' : '2px solid transparent',
    }}>
      {label}
    </button>
  );
}
