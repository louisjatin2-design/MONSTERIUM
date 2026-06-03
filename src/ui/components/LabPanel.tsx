import React, { useMemo, useState } from 'react';
import { useGameStore } from '@store/gameStore';
import { MONSTER_DEFS } from '@data/monsters';
import { MONSTER_EMOJI } from '@data/monsterEmoji';
import { RARITY_COLORS } from '@data/rarities';
import { canRankUp, getMonsterMaxLevel, MAX_RANK_STARS } from '@systems/ProgressionSystem';
import type { MonsterInstance } from '@gtypes/game';
import { HelpButton } from './HelpButton';
import '../styles/global.css';

interface LabPanelProps { onClose: () => void; }

// ── Labor (Gruppe 5: Rank-Up-System) ────────────────────────────────────────
// Zwei identische Monster auf ihrem aktuellen Maximallevel können hier zu einem
// Rank-Up zusammengeführt werden: +1 Stern, +10 Level-Limit. Der "Keeper"
// startet danach wieder bei Level 1.
export function LabPanel({ onClose }: LabPanelProps) {
  const monsters = useGameStore(s => s.monsters);
  const rankUpMonster = useGameStore(s => s.rankUpMonster);
  const [keeperId, setKeeperId] = useState<string | null>(null);

  // Eligible = on its current max level and below 5 stars.
  const eligible = useMemo(() => Object.values(monsters).filter(m =>
    (m.rankStars ?? 0) < MAX_RANK_STARS && m.level >= getMonsterMaxLevel(m.rankStars),
  ), [monsters]);

  const keeper = keeperId ? monsters[keeperId] : null;
  const partners = useMemo(() => {
    if (!keeper) return [] as MonsterInstance[];
    return eligible.filter(m => canRankUp(keeper, m));
  }, [keeper, eligible]);

  return (
    <div className="panel panel-modal panel-w-lg" style={{ display: 'flex', flexDirection: 'column' }}>
      <button className="close-btn" onClick={onClose}>✕</button>
      <HelpButton
        title="Labor"
        tips={[
          'Im Labor führst du zwei identische Monster auf ihrem Maximallevel zusammen.',
          'Das Ergebnis erhält einen Rank-Up: +1 Stern und +10 Level-Limit (max. 5 Sterne / Level 150).',
          'Nach dem Rank-Up startet das Monster wieder bei Level 1 und muss erneut hochgelevelt werden.',
        ]}
      />
      <div className="panel-title">🧪 Labor — Rank-Up</div>

      {eligible.length < 2 && (
        <div style={{ color: '#999', fontSize: 13, padding: '12px 0' }}>
          Du brauchst zwei <b>identische</b> Monster auf ihrem Maximallevel. Bring
          zwei gleiche Monster auf Max-Level, um sie hier zusammenzuführen.
        </div>
      )}

      {!keeper ? (
        <>
          <div style={{ fontSize: 13, color: '#ccc', margin: '6px 0' }}>
            Wähle das Monster, das du <b>behalten</b> möchtest:
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px,1fr))', gap: 8, overflowY: 'auto' }}>
            {eligible
              .filter(m => eligible.some(o => canRankUp(m, o)))
              .map(m => <MonsterChip key={m.instanceId} m={m} onClick={() => setKeeperId(m.instanceId)} />)}
          </div>
        </>
      ) : (
        <>
          <div style={{ fontSize: 13, color: '#ccc', margin: '6px 0' }}>
            Keeper: <b style={{ color: '#fff' }}>{keeper.name}</b> (Lv {keeper.level}, {keeper.rankStars ?? 0}★)
            <button className="btn btn-info" style={{ marginLeft: 10, padding: '2px 8px', fontSize: 11 }}
              onClick={() => setKeeperId(null)}>Anderen wählen</button>
          </div>
          <div style={{ fontSize: 13, color: '#ccc', margin: '6px 0' }}>
            Wähle das Monster, das <b>verbraucht</b> wird:
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px,1fr))', gap: 8, overflowY: 'auto' }}>
            {partners.map(m => (
              <MonsterChip key={m.instanceId} m={m} fodder onClick={() => {
                if (confirm(`${m.name} verbrauchen, um ${keeper.name} auf ${(keeper.rankStars ?? 0) + 1}★ zu ranken? ${keeper.name} startet danach bei Level 1.`)) {
                  rankUpMonster(keeper.instanceId, m.instanceId);
                  setKeeperId(null);
                }
              }} />
            ))}
            {partners.length === 0 && (
              <div style={{ color: '#999', fontSize: 12, gridColumn: '1 / -1' }}>
                Kein passendes Partner-Monster (gleicher Typ, gleiche Sternstufe, Max-Level).
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function MonsterChip({ m, fodder, onClick }: { m: MonsterInstance; fodder?: boolean; onClick: () => void }) {
  const def = MONSTER_DEFS[m.defId];
  if (!def) return null;
  const color = RARITY_COLORS[def.rarity];
  return (
    <div className="monster-card" onClick={onClick}
      style={{ cursor: 'pointer', textAlign: 'center', padding: '8px 6px', border: `1px solid ${color}88` }}>
      <div style={{ fontSize: 28 }}>{MONSTER_EMOJI[m.defId] ?? '👾'}</div>
      <div style={{ fontSize: 12, fontWeight: 'bold', color: '#fff' }}>{m.name}</div>
      <div style={{ fontSize: 10, color: '#aaa' }}>Lv {m.level} · {'⭐'.repeat(m.rankStars ?? 0) || '0★'}</div>
      <div style={{ fontSize: 10, color: fodder ? '#ff8888' : '#88ddaa' }}>{fodder ? 'verbrauchen' : 'behalten'}</div>
    </div>
  );
}
