import React, { useEffect, useState } from 'react';
import { useGameStore } from '@store/gameStore';
import { MONSTER_DEFS } from '@data/monsters';
import { RARITY_COLORS } from '@data/rarities';
import '../styles/global.css';

interface HatcheryPanelProps { onClose: () => void; }

export function HatcheryPanel({ onClose }: HatcheryPanelProps) {
  const eggs = useGameStore(s => s.eggs);
  const hatchEgg = useGameStore(s => s.hatchEgg);
  const speedUpEgg = useGameStore(s => s.speedUpEgg);
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const id = setInterval(() => forceUpdate(n => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const now = Date.now();

  return (
    <div className="panel" style={{ left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: 420, padding: 20 }}>
      <button className="close-btn" onClick={onClose}>✕</button>
      <div className="panel-title">🥚 Hatchery</div>

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
                    onClick={() => { hatchEgg(egg.id); }}>
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
