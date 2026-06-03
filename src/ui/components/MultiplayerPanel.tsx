import React, { useEffect, useState } from 'react';
import {
  getOnlineService, type LeaderboardKind, type LeaderboardEntry,
  type PlayerProfile, type Clan,
} from '../../net/onlineService';
import { RARITY_COLORS } from '@data/rarities';
import { MONSTER_DEFS } from '@data/monsters';
import { HelpButton } from './HelpButton';
import '../styles/global.css';

interface Props { onClose: () => void; }

type Tab = 'leaderboard' | 'friends' | 'clans';

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
          <>
            {clans.map(c => (
              <div key={c.id} className="monster-card" style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 900, fontSize: 14, color: '#8fc0ff' }}>
                      [{c.tag}] {c.name}
                    </div>
                    <div style={{ fontSize: 11, color: '#9aa', marginTop: 2 }}>{c.description}</div>
                    <div style={{ fontSize: 11, color: '#778', marginTop: 2 }}>
                      🏆 {c.trophies.toLocaleString()} · 👥 {c.memberCount}/{c.maxMembers}
                    </div>
                  </div>
                  <button className="btn btn-primary" style={{ minWidth: 90 }}
                    disabled={joined === c.id}
                    onClick={() => join(c.id)}>
                    {joined === c.id ? '✓ Beigetreten' : 'Beitreten'}
                  </button>
                </div>
              </div>
            ))}
            <div style={{ fontSize: 11, color: '#778', textAlign: 'center', marginTop: 8 }}>
              Clan-Kriege (wöchentlich, mit Ranglisten) folgen mit dem Server-Backend.
            </div>
          </>
        )}
      </div>
    </div>
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
