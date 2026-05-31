import React, { useState, useMemo, useEffect } from 'react';
import { useGameStore } from '@store/gameStore';
import { MONSTER_DEFS } from '@data/monsters';
import { BUILDING_DEFS } from '@data/buildings';
import { RARITY_COLORS } from '@data/rarities';
import { calculateBreedOutcomes, getRelationScore } from '@systems/BreedingSystem';
import { ELEMENT_CSS_COLORS } from '@data/elements';
import type { ActiveBreeding } from '@gtypes/game';
import '../styles/global.css';

interface BreedingPanelProps { onClose: () => void; }

export function BreedingPanel({ onClose }: BreedingPanelProps) {
  const monstersRecord  = useGameStore(s => s.monsters);
  const monsters        = Object.values(monstersRecord);
  const eggs            = useGameStore(s => s.eggs);
  const activeBreedings = useGameStore(s => s.activeBreedings);
  const buildings       = useGameStore(s => s.buildings);
  const gold            = useGameStore(s => s.gold);
  const startBreeding   = useGameStore(s => s.startBreeding);
  const collectEgg      = useGameStore(s => s.collectBreedingEgg);
  const speedUp         = useGameStore(s => s.speedUpBreeding);
  const breedingCap     = useGameStore(s => s.breedingCapacity);
  const eggCap          = useGameStore(s => s.eggCapacity);
  const upgradeBuilding = useGameStore(s => s.upgradeBuilding);
  const lastBreedPair   = useGameStore(s => s.lastBreedPair);

  const [parent1Id, setParent1Id] = useState('');
  const [parent2Id, setParent2Id] = useState('');

  // Re-render every second so the breeding countdowns stay live.
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force(n => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const station = Object.values(buildings).find(b => BUILDING_DEFS[b.defId]?.category === 'BreedingStation');
  const stationDef = station ? BUILDING_DEFS[station.defId] : null;
  const nextLevel = station && stationDef ? stationDef.levels[station.level] : undefined;
  const capacity = breedingCap();
  const slotsFree = capacity - activeBreedings.length;

  const parent1 = monsters.find(m => m.instanceId === parent1Id);
  const parent2 = monsters.find(m => m.instanceId === parent2Id);

  const preview = useMemo(() => {
    if (!parent1 || !parent2) return [];
    const rel = getRelationScore(parent1, parent2);
    return calculateBreedOutcomes(parent1, parent2, rel);
  }, [parent1Id, parent2Id]);

  const handleBreed = () => {
    if (!parent1 || !parent2 || parent1Id === parent2Id) return;
    if (eggs.length >= eggCap()) { alert('Die Brutstation (Eier) ist voll! Lass zuerst Eier schlüpfen.'); return; }
    if (slotsFree <= 0) { alert('Alle Brut-Slots sind belegt! Werte die Brutstation auf.'); return; }
    const ok = startBreeding(parent1Id, parent2Id);
    if (ok) { setParent1Id(''); setParent2Id(''); }
  };

  return (
    <div className="panel" style={{ left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: 500, maxHeight: '88vh', padding: 20, overflowY: 'auto' }}>
      <button className="close-btn" onClick={onClose}>✕</button>
      <div className="panel-title">🧬 Brutstation</div>

      {/* Station level + upgrade */}
      {station && stationDef && (
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 12, padding: '6px 10px', background: 'rgba(255,255,255,0.05)', borderRadius: 8,
        }}>
          <div style={{ fontSize: 12, color: '#ccc' }}>
            Level {station.level} · {activeBreedings.length}/{capacity} Slots belegt
          </div>
          {station.upgradeEndMs ? (
            <span style={{ color: '#ffaa00', fontSize: 12 }}>⏳ Ausbau läuft…</span>
          ) : nextLevel ? (
            <button className="btn btn-gold" style={{ padding: '4px 10px', fontSize: 12 }}
              disabled={gold < nextLevel.upgradeCost}
              onClick={() => upgradeBuilding(station.instanceId)}>
              ⬆️ Slot +1 (🪙 {nextLevel.upgradeCost})
            </button>
          ) : (
            <span style={{ color: '#66ff88', fontSize: 12 }}>Max-Level</span>
          )}
        </div>
      )}

      {/* Active breedings */}
      {activeBreedings.map(ab => (
        <BreedingSlot key={ab.id} breeding={ab} onCollect={() => collectEgg(ab.id)} onSpeedUp={() => speedUp(ab.id)} />
      ))}

      {/* New breeding form */}
      {slotsFree > 0 ? (
        <div style={{ marginTop: 8, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 'bold', color: '#ffd700' }}>
              Neue Paarung ({slotsFree} Slot frei)
            </div>
            {/* Repeat last pair button */}
            {lastBreedPair && (() => {
              const m1 = monstersRecord[lastBreedPair.parent1Id];
              const m2 = monstersRecord[lastBreedPair.parent2Id];
              const available = !!(m1 && m2);
              return (
                <button
                  className="btn btn-purple"
                  style={{ padding: '4px 10px', fontSize: 11 }}
                  disabled={!available}
                  title={available
                    ? `${m1.name ?? '?'} × ${m2.name ?? '?'} wiederholen`
                    : 'Eines der Monster ist nicht mehr verfügbar'}
                  onClick={() => {
                    if (available) {
                      setParent1Id(lastBreedPair.parent1Id);
                      setParent2Id(lastBreedPair.parent2Id);
                    }
                  }}
                >
                  🔁 {available
                    ? `${m1.name ?? '?'} × ${m2.name ?? '?'}`
                    : 'Nicht verfügbar'}
                </button>
              );
            })()}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <MonsterSelector label="Elternteil 1" value={parent1Id} onChange={setParent1Id} monsters={monsters} exclude={parent2Id} />
            <MonsterSelector label="Elternteil 2" value={parent2Id} onChange={setParent2Id} monsters={monsters} exclude={parent1Id} />
          </div>

          {preview.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 'bold', marginBottom: 6, color: '#ffd700' }}>
                Mögliche Nachkommen:
              </div>
              <div style={{ maxHeight: 180, overflowY: 'auto' }}>
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
        </div>
      ) : (
        <div style={{ marginTop: 10, fontSize: 12, color: '#888', textAlign: 'center' }}>
          Alle Slots belegt — sammle ein Ei ein oder werte die Station auf.
        </div>
      )}
    </div>
  );
}

function BreedingSlot({ breeding, onCollect, onSpeedUp }: {
  breeding: ActiveBreeding;
  onCollect: () => void;
  onSpeedUp: () => void;
}) {
  const monsters = useGameStore(s => s.monsters);
  const [showProb, setShowProb] = useState(false);
  const p1 = monsters[breeding.parent1Id];
  const p2 = monsters[breeding.parent2Id];

  const now = Date.now();
  const remaining = Math.max(0, breeding.endMs - now);
  const isReady = remaining === 0;
  const total = Math.max(1, breeding.endMs - breeding.startMs);
  const progress = Math.min(100, ((total - remaining) / total) * 100);
  const secondsLeft = Math.ceil(remaining / 1000);
  const diamondCost = Math.ceil(secondsLeft / 60);
  const uniqueOutcome = breeding.outcomes.find(o => o.isHybrid);

  return (
    <div style={{
      marginBottom: 12, padding: 12, borderRadius: 12,
      background: 'rgba(232,69,168,0.08)', border: '1px solid rgba(232,69,168,0.3)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
        <ParentChip defId={p1?.defId} name={p1?.name} />
        <span style={{ fontSize: 18 }}>💞</span>
        <ParentChip defId={p2?.defId} name={p2?.name} />
      </div>

      <div style={{ textAlign: 'center', marginBottom: 6 }}>
        {isReady
          ? <span style={{ color: '#66ff88', fontWeight: 'bold' }}>✨ Ein Ei ist bereit!</span>
          : <span style={{ color: '#aaa', fontSize: 13 }}>Brütet… noch {formatTime(secondsLeft)}</span>}
      </div>
      <div style={{ height: 8, background: '#333', borderRadius: 4, marginBottom: 10, overflow: 'hidden' }}>
        <div style={{ width: `${progress}%`, height: '100%', background: 'linear-gradient(90deg,#e845a8,#ffd700)', borderRadius: 4, transition: 'width 1s' }} />
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

      {uniqueOutcome && (
        <div style={{ marginTop: 8, fontSize: 12, color: '#ffd700' }}>
          ✨ Einzigartiges Kombitier: <b>{MONSTER_DEFS[uniqueOutcome.monsterDefId]?.name}</b>
          {' '}({(uniqueOutcome.probability * 100).toFixed(1)}%)
        </div>
      )}

      <button
        onClick={() => setShowProb(v => !v)}
        style={{ background: 'none', border: 'none', color: '#aaccff', fontSize: 11, cursor: 'pointer', marginTop: 6, padding: 0 }}>
        {showProb ? '▾ Wahrscheinlichkeiten ausblenden' : '▸ Wahrscheinlichkeiten anzeigen'}
      </button>
      {showProb && (
        <div style={{ maxHeight: 150, overflowY: 'auto', marginTop: 6 }}>
          {breeding.outcomes.slice(0, 8).map(o => (
            <OutcomeRow key={o.monsterDefId} defId={o.monsterDefId} probability={o.probability} isHybrid={o.isHybrid} />
          ))}
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
        width: 44, height: 44, borderRadius: '50%', margin: '0 auto',
        background: color, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 20, boxShadow: `0 0 12px ${color}88`,
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
