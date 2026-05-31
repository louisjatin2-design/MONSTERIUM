import React, { useEffect, useState } from 'react';
import { useGameStore } from '@store/gameStore';
import { MONSTER_DEFS } from '@data/monsters';
import { RARITY_COLORS } from '@data/rarities';
import { ELEMENT_CSS_COLORS } from '@data/elements';
import { EventBus, GameEvents } from '@game/EventBus';
import '../styles/global.css';

interface HatchConfirmPanelProps {
  eggId: string;
  onClose: () => void;
}

// Shown when the player taps an egg on its pedestal. Lets them confirm
// hatching; the actual hatch + animation is driven by the Island scene.
export function HatchConfirmPanel({ eggId, onClose }: HatchConfirmPanelProps) {
  const egg = useGameStore(s => s.eggs.find(e => e.id === eggId));
  const speedUpEgg = useGameStore(s => s.speedUpEgg);
  const [, force] = useState(0);

  useEffect(() => {
    const id = setInterval(() => force(n => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  if (!egg) return null;
  const def = MONSTER_DEFS[egg.monsterDefId];
  if (!def) return null;

  const now = Date.now();
  const remaining = Math.max(0, egg.hatchEndMs - now);
  const isReady = remaining === 0;
  const secondsLeft = Math.ceil(remaining / 1000);
  const diamondCost = Math.ceil(secondsLeft / 60);
  const progress = Math.min(100, Math.max(0,
    (1 - remaining / Math.max(1, egg.hatchEndMs - egg.hatchStartMs)) * 100,
  ));

  const handleHatch = () => {
    // A hatched monster must be placed in a habitat first — open the
    // forced-assignment screen, which commits the hatch once a habitat is picked.
    EventBus.emit(GameEvents.OPEN_ASSIGN_HABITAT, { eggId });
  };

  return (
    <div className="panel panel-modal panel-w-xs" style={{ padding: 20, textAlign: 'center' }}>
      <button className="close-btn" onClick={onClose}>✕</button>
      <div className="panel-title">{egg.isUnique ? '✨ ' : ''}{def.name} Ei</div>

      {/* Big egg emblem tinted to the element */}
      <div style={{
        margin: '8px auto 14px', width: 96, height: 116,
        borderRadius: '50% 50% 48% 48% / 60% 60% 40% 40%',
        background: `radial-gradient(circle at 38% 32%, #ffffffcc, ${ELEMENT_CSS_COLORS[def.elements[0]]} 70%)`,
        border: '3px solid rgba(0,0,0,0.35)',
        boxShadow: isReady ? '0 0 26px #ffe27a' : '0 6px 16px rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 34,
        animation: isReady ? 'eggWobble 0.5s ease-in-out infinite' : undefined,
      }}>🥚</div>

      <div style={{ marginBottom: 10 }}>
        <span className="rarity-badge" style={{ background: RARITY_COLORS[def.rarity], color: '#000' }}>
          {def.rarity}
        </span>
        <span style={{ fontSize: 12, color: '#bbb', marginLeft: 6 }}>
          {def.elements.join(' / ')}
        </span>
      </div>

      {isReady ? (
        <>
          <div style={{ fontSize: 13, color: '#ffe27a', marginBottom: 12 }}>
            Dieses Ei ist bereit zu schlüpfen! 🐣
          </div>
          <button className="btn btn-primary" style={{ width: '100%', fontSize: 16, padding: '12px' }}
            onClick={handleHatch}>
            🐣 Schlüpfen lassen!
          </button>
        </>
      ) : (
        <>
          <div style={{ fontSize: 12, color: '#aaa', marginBottom: 4 }}>
            Schlüpft in: {formatTime(secondsLeft)}
          </div>
          <div style={{ height: 8, background: '#333', borderRadius: 4, marginBottom: 12, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 4, width: `${progress}%`,
              background: 'linear-gradient(90deg, #44aaff, #aa44ff)', transition: 'width 1s',
            }} />
          </div>
          <button className="btn btn-info" style={{ width: '100%' }}
            onClick={() => speedUpEgg(eggId)}>
            💎 {diamondCost} — Sofort fertig
          </button>
        </>
      )}
    </div>
  );
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}
