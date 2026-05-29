import React from 'react';
import { useGameStore } from '@store/gameStore';
import { RARITY_COLORS } from '@data/rarities';
import '../styles/global.css';

interface HUDProps {
  onPokedex: () => void;
  onStory:   () => void;
  onShop:    () => void;
}

export function HUD({ onPokedex, onStory, onShop }: HUDProps) {
  const gold        = useGameStore(s => s.gold);
  const diamonds    = useGameStore(s => s.diamonds);
  const food        = useGameStore(s => s.food);
  const playerLevel = useGameStore(s => s.playerLevel);
  const playerXp    = useGameStore(s => s.playerXp);

  const xpToNext = Math.floor(100 * Math.pow(playerLevel, 1.5));
  const xpPercent = Math.min(100, (playerXp / xpToNext) * 100);

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0,
      height: 56,
      background: 'rgba(5,5,20,0.9)',
      borderBottom: '1px solid rgba(255,255,255,0.15)',
      display: 'flex', alignItems: 'center', gap: 16,
      padding: '0 16px',
      pointerEvents: 'auto',
      zIndex: 200,
      backdropFilter: 'blur(4px)',
    }}>
      {/* Currency */}
      <CurrencyDisplay icon="🪙" value={gold}     color="#ffd700" />
      <CurrencyDisplay icon="💎" value={diamonds}  color="#44ddff" />
      <CurrencyDisplay icon="🌾" value={food}      color="#88ff44" />

      {/* Player level */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ fontSize: 13, color: '#aaa' }}>Lv {playerLevel}</div>
        <div style={{ width: 80, height: 8, background: '#333', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ width: `${xpPercent}%`, height: '100%', background: '#4488ff', borderRadius: 4 }} />
        </div>
      </div>

      {/* Nav buttons */}
      <NavBtn label="📖 Pokédex" onClick={onPokedex} />
      <NavBtn label="⚔️ Story"   onClick={onStory} />
      <NavBtn label="🛒 Shop"    onClick={onShop} />
    </div>
  );
}

function CurrencyDisplay({ icon, value, color }: { icon: string; value: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span>{icon}</span>
      <span style={{ color, fontWeight: 'bold', fontSize: 15 }}>
        {value >= 1000 ? (value / 1000).toFixed(1) + 'k' : value}
      </span>
    </div>
  );
}

function NavBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'rgba(255,255,255,0.1)',
        border: '1px solid rgba(255,255,255,0.2)',
        borderRadius: 6,
        color: '#fff',
        padding: '4px 10px',
        cursor: 'pointer',
        fontSize: 13,
      }}
    >
      {label}
    </button>
  );
}
