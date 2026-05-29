import React, { useState, useMemo } from 'react';
import { useGameStore } from '@store/gameStore';
import { MONSTER_DEFS } from '@data/monsters';
import { RARITY_COLORS, RARITY_HATCH_TIME_SEC } from '@data/rarities';
import { calculateBreedOutcomes, rollBreedOutcome, getRelationScore } from '@systems/BreedingSystem';
import '../styles/global.css';

interface BreedingPanelProps { onClose: () => void; }

export function BreedingPanel({ onClose }: BreedingPanelProps) {
  const monsters = useGameStore(s => Object.values(s.monsters));
  const addEgg = useGameStore(s => s.addEgg);
  const eggs = useGameStore(s => s.eggs);

  const [parent1Id, setParent1Id] = useState('');
  const [parent2Id, setParent2Id] = useState('');
  const [breeding, setBreeding] = useState(false);

  const parent1 = monsters.find(m => m.instanceId === parent1Id);
  const parent2 = monsters.find(m => m.instanceId === parent2Id);

  const outcomes = useMemo(() => {
    if (!parent1 || !parent2) return [];
    const rel = getRelationScore(parent1, parent2);
    return calculateBreedOutcomes(parent1, parent2, rel);
  }, [parent1Id, parent2Id]);

  const handleBreed = () => {
    if (!parent1 || !parent2 || parent1Id === parent2Id) return;
    if (eggs.length >= 5) { alert('Hatchery is full! Hatch some eggs first.'); return; }
    const offspringId = rollBreedOutcome(outcomes);
    const isHybrid = outcomes.find(o => o.monsterDefId === offspringId)?.isHybrid ?? false;
    const def = MONSTER_DEFS[offspringId];
    if (!def) return;
    addEgg(offspringId, undefined, isHybrid, [parent1Id, parent2Id]);
    setBreeding(true);
    setTimeout(() => { setBreeding(false); setParent1Id(''); setParent2Id(''); }, 1000);
  };

  return (
    <div className="panel" style={{ left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: 480, maxHeight: '85vh', padding: 20 }}>
      <button className="close-btn" onClick={onClose}>✕</button>
      <div className="panel-title">🧬 Breeding Station</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <MonsterSelector label="Parent 1" value={parent1Id} onChange={setParent1Id} monsters={monsters} exclude={parent2Id} />
        <MonsterSelector label="Parent 2" value={parent2Id} onChange={setParent2Id} monsters={monsters} exclude={parent1Id} />
      </div>

      {/* Probability table */}
      {outcomes.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 'bold', marginBottom: 6, color: '#ffd700' }}>
            Possible Offspring:
          </div>
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {outcomes.slice(0, 8).map(o => {
              const def = MONSTER_DEFS[o.monsterDefId];
              if (!def) return null;
              return (
                <div key={o.monsterDefId} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '4px 8px', marginBottom: 4,
                  background: o.isHybrid ? 'rgba(255,200,0,0.1)' : 'rgba(255,255,255,0.05)',
                  borderRadius: 6, border: o.isHybrid ? '1px solid rgba(255,200,0,0.3)' : 'none',
                }}>
                  <span style={{ fontSize: 13 }}>
                    {o.isHybrid && '✨ '}{def.name}
                    <span className="rarity-badge" style={{ background: RARITY_COLORS[def.rarity], color: '#000', marginLeft: 4 }}>
                      {def.rarity}
                    </span>
                  </span>
                  <span style={{ fontSize: 12, color: '#aaa' }}>{(o.probability * 100).toFixed(1)}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <button className="btn btn-primary" style={{ width: '100%' }}
        disabled={!parent1Id || !parent2Id || parent1Id === parent2Id || breeding}
        onClick={handleBreed}>
        {breeding ? '✅ Egg created!' : '🥚 Start Breeding'}
      </button>

      {eggs.length > 0 && (
        <div style={{ marginTop: 12, fontSize: 12, color: '#888' }}>
          {eggs.length} egg(s) waiting in hatchery
        </div>
      )}
    </div>
  );
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
        <option value="">-- Select --</option>
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
