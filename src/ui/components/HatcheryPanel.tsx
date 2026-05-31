import React, { useEffect, useState } from 'react';
import { useGameStore } from '@store/gameStore';
import { MONSTER_DEFS } from '@data/monsters';
import { BUILDING_DEFS } from '@data/buildings';
import { RARITY_COLORS } from '@data/rarities';
import { EventBus, GameEvents } from '@game/EventBus';
import '../styles/global.css';

interface HatcheryPanelProps { onClose: () => void; }

export function HatcheryPanel({ onClose }: HatcheryPanelProps) {
  const eggs = useGameStore(s => s.eggs);
  const speedUpEgg = useGameStore(s => s.speedUpEgg);
  const eggCap = useGameStore(s => s.eggCapacity);
  const gold = useGameStore(s => s.gold);
  const buildings = useGameStore(s => s.buildings);
  const upgradeBuilding = useGameStore(s => s.upgradeBuilding);
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const id = setInterval(() => forceUpdate(n => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const now = Date.now();
  const capacity = eggCap();
  const hatchery = Object.values(buildings).find(b => BUILDING_DEFS[b.defId]?.category === 'Hatchery');
  const hatcheryDef = hatchery ? BUILDING_DEFS[hatchery.defId] : null;
  const nextLevel = hatchery && hatcheryDef ? hatcheryDef.levels[hatchery.level] : undefined;

  return (
    <div className="panel panel-modal panel-w-sm" style={{ padding: 20 }}>
      <button className="close-btn" onClick={onClose}>✕</button>
      <div className="panel-title">🥚 Hatchery</div>

      {/* Capacity + upgrade */}
      {hatchery && (
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 12, padding: '6px 10px', background: 'rgba(255,255,255,0.05)', borderRadius: 8,
        }}>
          <div style={{ fontSize: 12, color: '#ccc' }}>
            Level {hatchery.level} · {eggs.length}/{capacity} Eier-Slots
          </div>
          {hatchery.upgradeEndMs ? (
            <span style={{ color: '#ffaa00', fontSize: 12 }}>⏳ Ausbau läuft…</span>
          ) : nextLevel ? (
            <button className="btn btn-gold" style={{ padding: '4px 10px', fontSize: 12 }}
              disabled={gold < nextLevel.upgradeCost}
              onClick={() => upgradeBuilding(hatchery.instanceId)}>
              ⬆️ Slots +2 (🪙 {nextLevel.upgradeCost})
            </button>
          ) : (
            <span style={{ color: '#66ff88', fontSize: 12 }}>Max-Level</span>
          )}
        </div>
      )}

      {eggs.length === 0 && (
        <div style={{ color: '#666', fontSize: 14, textAlign: 'center', padding: 20 }}>
          No eggs yet! Go to the Breeding Station to create some.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {eggs.map(egg => {
          const def = MONSTER_DEFS[egg.monsterDefId];
          if (!def) return null;
          const remaining = Math.max(0, egg.hatchEndMs - now);
          const isReady = remaining === 0;
          const secondsLeft = Math.ceil(remaining / 1000);
          const diamondCost = Math.ceil(secondsLeft / 60);

          return (
            <div key={egg.id} className="monster-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontWeight: 'bold' }}>
                    {egg.isUnique ? '✨ ' : ''}
                    {def.name} Egg
                  </span>
                  <span className="rarity-badge" style={{ background: RARITY_COLORS[def.rarity], color: '#000' }}>
                    {def.rarity}
                  </span>
                </div>
                {!isReady ? (
                  <button className="btn btn-info" style={{ fontSize: 11 }}
                    onClick={() => speedUpEgg(egg.id)}>
                    💎 {diamondCost} Speed Up
                  </button>
                ) : (
                  <button className="btn btn-primary"
                    onClick={() => { EventBus.emit(GameEvents.OPEN_ASSIGN_HABITAT, { eggId: egg.id }); }}>
                    🐣 Hatch!
                  </button>
                )}
              </div>
              {!isReady && (
                <div style={{ marginTop: 6 }}>
                  <div style={{ fontSize: 12, color: '#aaa', marginBottom: 4 }}>
                    Ready in: {formatTime(secondsLeft)}
                  </div>
                  <div style={{ height: 6, background: '#333', borderRadius: 3 }}>
                    <div style={{
                      height: '100%', background: '#4488ff', borderRadius: 3,
                      width: `${Math.min(100, Math.max(0,
                        (1 - remaining / (egg.hatchEndMs - egg.hatchStartMs)) * 100
                      ))}%`,
                      transition: 'width 1s',
                    }} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds/60)}m ${seconds%60}s`;
  return `${Math.floor(seconds/3600)}h ${Math.floor((seconds%3600)/60)}m`;
}
