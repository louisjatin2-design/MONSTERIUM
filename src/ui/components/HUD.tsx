import React from 'react';
import { useGameStore } from '@store/gameStore';
import '../styles/global.css';

interface HUDProps {
  onPokedex?: () => void;
  onStory?:   () => void;
  onShop?:    () => void;
}

// Compact top resource bar in Monster Legends style.
export function HUD(_props: HUDProps) {
  const gold        = useGameStore(s => s.gold);
  const diamonds    = useGameStore(s => s.diamonds);
  const food        = useGameStore(s => s.food);
  const trophies    = useGameStore(s => s.trophies);
  const playerLevel = useGameStore(s => s.playerLevel);
  const playerXp    = useGameStore(s => s.playerXp);

  const xpToNext  = Math.floor(100 * Math.pow(playerLevel, 1.5));
  const xpPercent = Math.min(100, (playerXp / xpToNext) * 100);

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0,
      height: 60,
      background: 'linear-gradient(180deg, #1e0a3c 0%, #120521 100%)',
      borderBottom: '2px solid #7744cc',
      display: 'flex',
      alignItems: 'center',
      padding: '0 10px',
      gap: 6,
      pointerEvents: 'auto',
      zIndex: 200,
      boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
    }}>
      {/* Player avatar + level badge */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <div style={{
          width: 44, height: 44,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #7744cc, #4422aa)',
          border: '2px solid #bb88ff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22,
          boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
        }}>⭐</div>
        {/* Level badge */}
        <div style={{
          position: 'absolute', bottom: -4, left: '50%', transform: 'translateX(-50%)',
          background: 'linear-gradient(135deg, #ffd700, #ff9900)',
          borderRadius: 6, padding: '1px 5px',
          fontSize: 10, fontWeight: 900, color: '#3a1a00',
          border: '1px solid #ffee44',
          whiteSpace: 'nowrap',
          boxShadow: '0 1px 4px rgba(0,0,0,0.5)',
        }}>{playerLevel}</div>
      </div>

      {/* XP bar */}
      <div style={{ width: 48, flexShrink: 0 }}>
        <div style={{
          width: '100%', height: 5,
          background: 'rgba(255,255,255,0.15)',
          borderRadius: 3, overflow: 'hidden',
        }}>
          <div style={{
            width: `${xpPercent}%`, height: '100%',
            background: 'linear-gradient(90deg, #44aaff, #aa44ff)',
            borderRadius: 3,
          }} />
        </div>
        <div style={{ fontSize: 8, color: '#aaa', marginTop: 2 }}>
          {playerXp}/{xpToNext} XP
        </div>
      </div>

      {/* Resources */}
      <ResourcePill icon="🍎" value={food}     color="#ff7755" />
      <ResourcePill icon="🪙" value={gold}     color="#ffd700" />
      <ResourcePill icon="💎" value={diamonds} color="#44ddff" />

      {/* Trophy */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 3 }}>
        <span style={{ fontSize: 16 }}>🏆</span>
        <span style={{ color: '#ffd700', fontWeight: 900, fontSize: 13 }}>{trophies}</span>
      </div>

      {/* Settings */}
      <button style={{
        background: 'rgba(255,255,255,0.1)',
        border: '1px solid rgba(255,255,255,0.2)',
        borderRadius: 8, color: '#fff', width: 34, height: 34,
        cursor: 'pointer', fontSize: 18, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>⚙️</button>
    </div>
  );
}

function ResourcePill({ icon, value, color }: { icon: string; value: number; color: string }) {
  const display = value >= 1_000_000
    ? (value / 1_000_000).toFixed(1) + 'M'
    : value >= 1000
      ? (value / 1000).toFixed(1) + 'k'
      : String(value);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 3,
      background: 'rgba(0,0,0,0.4)',
      border: '1px solid rgba(255,255,255,0.15)',
      borderRadius: 12,
      padding: '2px 7px 2px 4px',
      height: 26,
      flexShrink: 0,
    }}>
      <span style={{ fontSize: 14, lineHeight: 1 }}>{icon}</span>
      <span style={{ color, fontWeight: 900, fontSize: 12 }}>{display}</span>
      <span style={{
        background: 'rgba(255,255,255,0.2)',
        borderRadius: '50%',
        width: 14, height: 14,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10, color: '#fff', cursor: 'pointer',
        marginLeft: 1,
      }}>+</span>
    </div>
  );
}
