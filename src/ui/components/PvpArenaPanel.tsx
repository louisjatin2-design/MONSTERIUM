import React, { useEffect, useState } from 'react';
import {
  getOnlineService, type PvpState, type PvpOpponent,
} from '../../net/onlineService';
import { toTeamMonster, PVP_TEAM_SIZE } from '../../net/pvp';
import { useGameStore } from '@store/gameStore';
import { MONSTER_DEFS } from '@data/monsters';
import { RARITY_COLORS } from '@data/rarities';
import { EventBus, GameEvents } from '@game/EventBus';
import type { BattlePayload } from './TeamSelectPanel';
import { HelpButton } from './HelpButton';
import '../styles/global.css';

interface Props { onClose: () => void; }

// ── Gruppe 10 — PvP-Arena (asynchrones Spieler-gegen-Spieler) ────────────────
// Hinterlege ein Verteidigungs-Team, suche einen ratingnahen Gegner und kämpfe
// gegen sein Team. Sieg/Niederlage passen das Elo-artige PvP-Rating an (Backend:
// Supabase, lokal simuliert). Der eigentliche Kampf läuft über den normalen
// Battle-Flow (TeamSelect → START_BATTLE) mit gesetztem pvp-Kontext.
export function PvpArenaPanel({ onClose }: Props) {
  const svc = getOnlineService();
  const monsters = useGameStore(s => s.monsters);

  const [state, setState] = useState<PvpState | null>(null);
  const [opponent, setOpponent] = useState<PvpOpponent | null>(null);
  const [searching, setSearching] = useState(false);
  const [editing, setEditing] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const loadState = () => svc.getPvpState().then(s => {
    setState(s);
    // Auswahl mit dem aktuell hinterlegten Team vorbelegen (per Spezies-Match).
    setPicked(prefillFromTeam(s, monsters));
  });

  useEffect(() => { loadState(); /* eslint-disable-next-line */ }, []);

  const ownList = Object.values(monsters).sort((a, b) => b.level - a.level);

  const toggle = (id: string) => {
    setPicked(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= PVP_TEAM_SIZE) return prev;
      return [...prev, id];
    });
  };

  const saveTeam = async () => {
    const team = picked
      .map(id => monsters[id])
      .filter(Boolean)
      .map(m => toTeamMonster(m.defId, m.level, m.rankStars ?? 0, m.name));
    if (team.length === 0) { setMsg('Wähle mindestens 1 Monster.'); return; }
    const ok = await svc.setDefenseTeam(team);
    setMsg(ok ? '✅ Verteidigungs-Team gespeichert!' : '⚠️ Speichern fehlgeschlagen.');
    if (ok) { setEditing(false); loadState(); }
  };

  const search = async () => {
    setSearching(true);
    setMsg(null);
    const opp = await svc.findPvpOpponent();
    setSearching(false);
    if (!opp) { setMsg('Kein Gegner gefunden — versuche es später erneut.'); return; }
    setOpponent(opp);
  };

  const attack = () => {
    if (!opponent) return;
    if (ownList.length === 0) { setMsg('Du brauchst zuerst eigene Monster.'); return; }
    const payload: BattlePayload = {
      enemyTeam: opponent.team.map(m => m.defId).slice(0, 3),
      enemyLevels: opponent.team.map(m => m.level).slice(0, 3),
      rewardGold: 350,
      rewardXp: 250,
      pvp: { opponentId: opponent.id, opponentName: opponent.name, opponentRating: opponent.rating },
    };
    // Öffnet die Team-Auswahl; danach startet der normale Kampf mit pvp-Kontext.
    EventBus.emit(GameEvents.OPEN_TEAM_SELECT, payload);
  };

  return (
    <div className="panel panel-modal panel-w-lg" style={{ padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <button className="close-btn" onClick={onClose} style={{ zIndex: 5 }}>✕</button>
      <HelpButton
        title="PvP-Arena"
        tips={[
          'Hinterlege ein Verteidigungs-Team — andere Spieler kämpfen gegen diesen Snapshot.',
          'Suche einen Gegner mit ähnlichem Rating und greife sein Team an.',
          'Siege erhöhen dein Elo-Rating und bringen Trophäen; Niederlagen kosten Rating.',
          'Gegner werden aus echten Spieler-Teams gewählt; gibt es keine, tritt ein simulierter Rivale an.',
        ]}
      />

      <div style={{ padding: '14px 18px', background: 'linear-gradient(135deg, #3a1c4a, #1a0a26)', borderBottom: '2px solid #a05ad0' }}>
        <div className="panel-title" style={{ marginBottom: 8, borderBottom: 'none', paddingBottom: 0 }}>
          ⚔️ PvP-Arena
          <span style={{ fontSize: 10, color: '#c79fe0', fontWeight: 400, marginLeft: 8 }}>
            {svc.kind === 'local' ? 'simuliert (lokal)' : 'online'}
          </span>
        </div>
        {state && (
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', fontSize: 13 }}>
            <span style={{ fontWeight: 900, color: '#ffd700', fontSize: 18 }}>
              {state.rating} <span style={{ fontSize: 11, color: '#c79fe0', fontWeight: 600 }}>Rating</span>
            </span>
            <span style={{ color: '#7fe07f' }}>🏆 {state.wins} S</span>
            <span style={{ color: '#ff8888' }}>💀 {state.losses} N</span>
          </div>
        )}
      </div>

      <div style={{ overflowY: 'auto', padding: 14, flex: 1, minHeight: 0 }}>
        {msg && <div style={{ fontSize: 12, color: '#ffd700', textAlign: 'center', marginBottom: 10 }}>{msg}</div>}

        {/* ── Verteidigungs-Team ─────────────────────────────────────────── */}
        <div className="monster-card" style={{ marginBottom: 14, padding: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 900, color: '#c79fe0' }}>🛡️ Dein Verteidigungs-Team</span>
            <button className="btn btn-info" style={{ padding: '4px 10px', fontSize: 12 }}
              onClick={() => { setEditing(e => !e); setMsg(null); }}>
              {editing ? 'Abbrechen' : 'Bearbeiten'}
            </button>
          </div>

          {!editing && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {(state?.defenseTeam ?? []).length === 0 && (
                <span style={{ fontSize: 12, color: '#889' }}>Noch kein Team hinterlegt.</span>
              )}
              {(state?.defenseTeam ?? []).map((m, i) => (
                <MonsterChip key={i} defId={m.defId} name={m.name} level={m.level} rarity={m.rarity} rankStars={m.rankStars} />
              ))}
            </div>
          )}

          {editing && (
            <>
              <div style={{ fontSize: 11, color: '#9aa', marginBottom: 6 }}>
                {picked.length}/{PVP_TEAM_SIZE} ausgewählt — tippe zum Hinzufügen/Entfernen
              </div>
              <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {ownList.length === 0 && <div style={{ fontSize: 12, color: '#778' }}>Keine eigenen Monster.</div>}
                {ownList.map(m => {
                  const def = MONSTER_DEFS[m.defId];
                  if (!def) return null;
                  const isSel = picked.includes(m.instanceId);
                  const full = picked.length >= PVP_TEAM_SIZE && !isSel;
                  return (
                    <div key={m.instanceId} className="monster-card"
                      onClick={() => !full && toggle(m.instanceId)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px',
                        cursor: full ? 'not-allowed' : 'pointer', opacity: full ? 0.4 : 1,
                        border: isSel ? '2px solid #a05ad0' : '1px solid rgba(160,90,208,0.3)',
                        background: isSel ? 'rgba(160,90,208,0.15)' : undefined,
                      }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontWeight: 800, fontSize: 13 }}>{m.name ?? def.name}</span>
                        <span style={{ fontSize: 11, color: '#9aa', marginLeft: 8 }}>Lv {m.level}</span>
                      </div>
                      <span className="rarity-badge" style={{ background: RARITY_COLORS[def.rarity], color: '#000' }}>{def.rarity}</span>
                      <div style={{
                        width: 22, height: 22, borderRadius: '50%',
                        background: isSel ? '#a05ad0' : 'rgba(255,255,255,0.08)',
                        border: `2px solid ${isSel ? '#a05ad0' : 'rgba(255,255,255,0.2)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#fff',
                      }}>{isSel ? picked.indexOf(m.instanceId) + 1 : ''}</div>
                    </div>
                  );
                })}
              </div>
              <button className="btn btn-gold" onClick={saveTeam} style={{ width: '100%', marginTop: 8, fontSize: 13 }}>
                Team speichern
              </button>
            </>
          )}
        </div>

        {/* ── Gegnersuche ────────────────────────────────────────────────── */}
        <div style={{ fontSize: 13, fontWeight: 900, color: '#c79fe0', marginBottom: 6 }}>🔍 Gegner</div>
        {!opponent && (
          <button className="btn btn-primary" onClick={search} disabled={searching}
            style={{ width: '100%', fontSize: 14, padding: '10px 0' }}>
            {searching ? 'Suche Gegner …' : 'Gegner suchen'}
          </button>
        )}

        {opponent && (
          <div className="monster-card" style={{ padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontWeight: 900, fontSize: 15, color: '#fff' }}>
                {opponent.name}
                {opponent.isBot && <span style={{ fontSize: 10, color: '#889', marginLeft: 6 }}>(Bot)</span>}
              </span>
              <span style={{ fontWeight: 900, color: '#ffd700' }}>{opponent.rating} Rating</span>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
              {opponent.team.map((m, i) => (
                <MonsterChip key={i} defId={m.defId} name={m.name} level={m.level} rarity={m.rarity} rankStars={m.rankStars} />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" onClick={search} disabled={searching} style={{ flex: 1, fontSize: 13 }}>
                🔄 Anderer Gegner
              </button>
              <button className="btn btn-primary" onClick={attack} style={{ flex: 2, fontSize: 14, fontWeight: 900 }}>
                ⚔️ Angreifen!
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MonsterChip({ defId, name, level, rarity, rankStars }: {
  defId: string; name: string; level: number; rarity: string; rankStars: number;
}) {
  const col = RARITY_COLORS[rarity as keyof typeof RARITY_COLORS] ?? '#666';
  return (
    <span style={{
      fontSize: 11, padding: '3px 9px', borderRadius: 6,
      background: 'rgba(255,255,255,0.05)', border: `1px solid ${col}`, color: '#ddd',
    }}>
      {MONSTER_DEFS[defId]?.name ?? name} · Lv {level}{rankStars > 0 ? ` ${'★'.repeat(rankStars)}` : ''}
    </span>
  );
}

// Belegt die Bearbeiten-Auswahl mit den Instanzen vor, deren Spezies bereits im
// hinterlegten Verteidigungs-Team stehen (Teams speichern nur Snapshots, keine
// Instanz-IDs).
function prefillFromTeam(state: PvpState, monsters: Record<string, { instanceId: string; defId: string }>): string[] {
  const picked: string[] = [];
  const used = new Set<string>();
  for (const tm of state.defenseTeam) {
    const match = Object.values(monsters).find(m => m.defId === tm.defId && !used.has(m.instanceId));
    if (match) { picked.push(match.instanceId); used.add(match.instanceId); }
    if (picked.length >= PVP_TEAM_SIZE) break;
  }
  return picked;
}
