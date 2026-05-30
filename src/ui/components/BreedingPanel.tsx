import React, { useState, useMemo, useEffect } from 'react';
import { useGameStore } from '@store/gameStore';
import { MONSTER_DEFS } from '@data/monsters';
import { RARITY_COLORS } from '@data/rarities';
import { calculateBreedOutcomes, getRelationScore } from '@systems/BreedingSystem';
import { ELEMENT_CSS_COLORS } from '@data/elements';
import '../styles/global.css';

interface BreedingPanelProps { onClose: () => void; }

export function BreedingPanel({ onClose }: BreedingPanelProps) {
  const monstersRecord  = useGameStore(s => s.monsters);
  const monsters        = Object.values(monstersRecord);
  const eggs            = useGameStore(s => s.eggs);
  const activeBreeding  = useGameStore(s => s.activeBreeding);
  const startBreeding   = useGameStore(s => s.startBreeding);
  const collectEgg      = useGameStore(s => s.collectBreedingEgg);
  const speedUp         = useGameStore(s => s.speedUpBreeding);

  const [parent1Id, setParent1Id] = useState('');
  const [parent2Id, setParent2Id] = useState('');

  // Re-render every second so the breeding countdown stays live.
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force(n => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const parent1 = monsters.find(m => m.instanceId === parent1Id);
  const parent2 = monsters.find(m => m.instanceId === parent2Id);

  // Preview probabilities only while no breeding is running (so the table is a
  // planning tool, not a spoiler of the in-progress result).
  const preview = useMemo(() => {
    if (activeBreeding) return [];
    if (!parent1 || !parent2) return [];
    const rel = getRelationScore(parent1, parent2);
    return calculateBreedOutcomes(parent1, parent2, rel);
  }, [parent1Id, parent2Id, activeBreeding]);

  const handleBreed = () => {
    if (!parent1 || !parent2 || parent1Id === parent2Id) return;
    if (eggs.length >= 5) { alert('Die Brutstation ist voll! Lass zuerst Eier schlüpfen.'); return; }
    const ok = startBreeding(parent1Id, parent2Id);
    if (ok) { setParent1Id(''); setParent2Id(''); }
  };

  return (
    <div className="panel" style={{ left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: 480, maxHeight: '85vh', padding: 20, overflowY: 'auto' }}>
      <button className="close-btn" onClick={onClose}>✕</button>
      <div className="panel-title">🧬 Brutstation</div>

      {activeBreeding ? (
        <BreedingInProgress
          activeBreeding={activeBreeding}
          onCollect={collectEgg}
          onSpeedUp={speedUp}
        />
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <MonsterSelector label="Elternteil 1" value={parent1Id} onChange={setParent1Id} monsters={monsters} exclude={parent2Id} />
            <MonsterSelector label="Elternteil 2" value={parent2Id} onChange={setParent2Id} monsters={monsters} exclude={parent1Id} />
          </div>

          {/* Probability preview */}
          {preview.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 'bold', marginBottom: 6, color: '#ffd700' }}>
                Mögliche Nachkommen:
              </div>
              <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                {preview.slice(0, 8).map(o => (
                  <OutcomeRow key={o.monsterDefId} defId={o.monsterDefId} probability={o.probability} isHybrid={o.isHybrid} />
                ))}
              </div>
            </div>
          )}

          <button className="btn btn-primary" style={{ width: '100%' }}
            disabled={!parent1Id || !parent2Id || parent1Id === parent2Id}
            onClick={handleBreed}>
            🧬 Brüten starten
          </button>

          <div style={{ marginTop: 10, fontSize: 11, color: '#888' }}>
            Das Brüten braucht Zeit. Sobald es fertig ist, kannst du das Ei in die Brutstation legen.
            {eggs.length > 0 && ` · ${eggs.length} Ei(er) warten in der Brutstation.`}
          </div>
        </>
      )}
    </div>
  );
}

function BreedingInProgress({ activeBreeding, onCollect, onSpeedUp }: {
  activeBreeding: NonNullable<ReturnType<typeof useGameStore.getState>['activeBreeding']>;
  onCollect: () => void;
  onSpeedUp: () => void;
}) {
  const monsters = useGameStore(s => s.monsters);
  const p1 = monsters[activeBreeding.parent1Id];
  const p2 = monsters[activeBreeding.parent2Id];

  const now = Date.now();
  const remaining = Math.max(0, activeBreeding.endMs - now);
  const isReady = remaining === 0;
  const total = Math.max(1, activeBreeding.endMs - activeBreeding.startMs);
  const progress = Math.min(100, ((total - remaining) / total) * 100);
  const secondsLeft = Math.ceil(remaining / 1000);
  const diamondCost = Math.ceil(secondsLeft / 60);

  // The single unique hybrid combo for this pair (shown once, here).
  const uniqueOutcome = activeBreeding.outcomes.find(o => o.isHybrid);

  return (
    <div>
      {/* Parents */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 14 }}>
        <ParentChip defId={p1?.defId} name={p1?.name} />
        <span style={{ fontSize: 22 }}>💞</span>
        <ParentChip defId={p2?.defId} name={p2?.name} />
      </div>

      {/* Countdown / progress */}
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        {isReady ? (
          <div style={{ color: '#66ff88', fontWeight: 'bold', fontSize: 16 }}>✨ Ein Ei ist bereit!</div>
        ) : (
          <div style={{ color: '#aaa', fontSize: 14 }}>Brütet… noch {formatTime(secondsLeft)}</div>
        )}
      </div>
      <div style={{ height: 10, background: '#333', borderRadius: 5, marginBottom: 16, overflow: 'hidden' }}>
        <div style={{ width: `${progress}%`, height: '100%', background: 'linear-gradient(90deg,#e845a8,#ffd700)', borderRadius: 5, transition: 'width 1s' }} />
      </div>

      {isReady ? (
        <button className="btn btn-primary" style={{ width: '100%' }} onClick={onCollect}>
          🥚 Ei in die Brutstation legen
        </button>
      ) : (
        <button className="btn btn-info" style={{ width: '100%' }} onClick={onSpeedUp}>
          💎 {diamondCost} — Sofort fertigstellen
        </button>
      )}

      {/* Frozen probability table — shown exactly once for this breeding */}
      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 'bold', marginBottom: 6, color: '#ffd700' }}>
          Wahrscheinlichkeiten dieser Paarung:
        </div>
        <div style={{ maxHeight: 180, overflowY: 'auto' }}>
          {activeBreeding.outcomes.slice(0, 8).map(o => (
            <OutcomeRow key={o.monsterDefId} defId={o.monsterDefId} probability={o.probability} isHybrid={o.isHybrid} />
          ))}
        </div>
      </div>

      {/* The one unique combination creature, called out separately */}
      {uniqueOutcome && (
        <div style={{
          marginTop: 12, padding: 10, borderRadius: 10,
          background: 'rgba(255,200,0,0.1)', border: '1px solid rgba(255,200,0,0.4)',
        }}>
          <div style={{ fontSize: 12, color: '#ffd700', fontWeight: 'bold', marginBottom: 4 }}>
            ✨ Einzigartiges Kombitier
          </div>
          <div style={{ fontSize: 13 }}>
            {MONSTER_DEFS[uniqueOutcome.monsterDefId]?.name}
            <span style={{ color: '#aaa', marginLeft: 8 }}>
              {(uniqueOutcome.probability * 100).toFixed(1)}% Chance
            </span>
          </div>
          <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
            Nur diese Eltern können dieses Wesen hervorbringen.
          </div>
        </div>
      )}
    </div>
  );
}

function OutcomeRow({ defId, probability, isHybrid }: { defId: string; probability: number; isHybrid: boolean }) {
  const def = MONSTER_DEFS[defId];
  if (!def) return null;
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '4px 8px', marginBottom: 4,
      background: isHybrid ? 'rgba(255,200,0,0.1)' : 'rgba(255,255,255,0.05)',
      borderRadius: 6, border: isHybrid ? '1px solid rgba(255,200,0,0.3)' : 'none',
    }}>
      <span style={{ fontSize: 13 }}>
        {isHybrid && '✨ '}{def.name}
        <span className="rarity-badge" style={{ background: RARITY_COLORS[def.rarity], color: '#000', marginLeft: 4 }}>
          {def.rarity}
        </span>
      </span>
      <span style={{ fontSize: 12, color: '#aaa' }}>{(probability * 100).toFixed(1)}%</span>
    </div>
  );
}

function ParentChip({ defId, name }: { defId?: string; name?: string }) {
  const def = defId ? MONSTER_DEFS[defId] : undefined;
  const color = def ? ELEMENT_CSS_COLORS[def.elements[0]] : '#666';
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{
        width: 48, height: 48, borderRadius: '50%', margin: '0 auto',
        background: color, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22, boxShadow: `0 0 12px ${color}88`,
      }}>👾</div>
      <div style={{ fontSize: 11, color: '#ccc', marginTop: 4, maxWidth: 80 }}>{name ?? '???'}</div>
    </div>
  );
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

type MonsterInstance = ReturnType<typeof useGameStore.getState>['monsters'][string];

function MonsterSelector({ label, value, onChange, monsters, exclude }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  monsters: MonsterInstance[];
  exclude: string;
}) {
  return (
    <div>
      <div style={{ fontSize: 12, color: '#aaa', marginBottom: 4 }}>{label}</div>
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{ width: '100%', background: '#1a1a3a', color: '#fff', border: '1px solid #444', borderRadius: 6, padding: '6px 8px' }}>
        <option value="">-- Wählen --</option>
        {monsters.filter(m => m.instanceId !== exclude).map(m => {
          const def = MONSTER_DEFS[m.defId];
          return (
            <option key={m.instanceId} value={m.instanceId}>
              {m.name} (Lv {m.level} {def?.rarity})
            </option>
          );
        })}
      </select>
    </div>
  );
}
