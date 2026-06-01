import React from 'react';
import { useGameStore } from '@store/gameStore';
import { EventBus, GameEvents } from '@game/EventBus';
import '../styles/global.css';

interface HUDProps {
  onPokedex?: () => void;
  onStory?:   () => void;
  onShop?:    () => void;
}

// Top resource bar — reworked into the warm, ornate Monster-Legends look:
// a big framed player portrait on the left, glossy resource "pills" with
// red "+" buttons in the middle, and a settings gear on the right.
export function HUD(_props: HUDProps) {
  const gold        = useGameStore(s => s.gold);
  const diamonds    = useGameStore(s => s.diamonds);
  const food        = useGameStore(s => s.food);
  const trophies    = useGameStore(s => s.trophies);
  const playerLevel = useGameStore(s => s.playerLevel);
  const playerXp    = useGameStore(s => s.playerXp);
  const pendingRewards = useGameStore(s => s.pendingLevelRewards.length);

  const redeemCheatCode = useGameStore(s => s.redeemCheatCode);

  const xpToNext  = Math.floor(100 * Math.pow(playerLevel, 1.5));
  const xpPercent = Math.min(100, (playerXp / xpToNext) * 100);

  const openCheatPrompt = () => {
    const code = window.prompt('Cheat-Code eingeben:');
    if (code == null) return;
    const ok = redeemCheatCode(code);
    window.alert(ok
      ? '✨ Cheat aktiviert! Unendlich Gold, Diamanten & Futter + alles freigeschaltet!'
      : '❌ Ungültiger Code.');
  };

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0,
      height: 64,
      background: 'linear-gradient(180deg, rgba(38,20,72,0.96) 0%, rgba(24,12,46,0.92) 60%, rgba(14,6,30,0.85) 100%)',
      borderBottom: '2px solid #c79a3a',
      display: 'flex',
      alignItems: 'center',
      padding: '0 10px',
      gap: 8,
      pointerEvents: 'auto',
      zIndex: 200,
      boxShadow: '0 4px 18px rgba(0,0,0,0.7), inset 0 -2px 0 rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,215,120,0.25)',
    }}>
      {/* ── Player portrait: ornate gold ring + level badge ── */}
      <button
        onClick={() => EventBus.emit(GameEvents.OPEN_LEVEL_REWARDS, {})}
        title="Account-Belohnungen"
        style={{
          position: 'relative', flexShrink: 0,
          background: 'none', border: 'none', padding: 0, cursor: 'pointer',
          marginRight: 2,
        }}>
        <div style={{
          width: 50, height: 50,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 30%, #9a64e6, #4a2493)',
          border: pendingRewards > 0 ? '3px solid #ffd700' : '3px solid #e8b84a',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 24,
          boxShadow: pendingRewards > 0
            ? '0 0 14px #ffd700, inset 0 2px 6px rgba(0,0,0,0.4)'
            : '0 2px 8px rgba(0,0,0,0.6), inset 0 2px 6px rgba(0,0,0,0.35), 0 0 0 1px rgba(0,0,0,0.4)',
        }}>👾</div>

        {/* Level badge — sits at top-left of the portrait like the reference */}
        <div style={{
          position: 'absolute', top: -6, left: -8,
          minWidth: 22, height: 22, padding: '0 4px',
          background: 'radial-gradient(circle at 40% 30%, #5a3aa8, #2c1860)',
          border: '2px solid #e8b84a',
          borderRadius: '50%',
          fontSize: 12, fontWeight: 900, color: '#ffe9a8',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          textShadow: '0 1px 2px rgba(0,0,0,0.8)',
          boxShadow: '0 1px 4px rgba(0,0,0,0.6)',
        }}>{playerLevel}</div>

        {/* Pending-reward gift badge */}
        {pendingRewards > 0 && (
          <div style={{
            position: 'absolute', bottom: -3, right: -5,
            background: '#ff3355', color: '#fff',
            borderRadius: '50%', width: 18, height: 18,
            fontSize: 11, fontWeight: 900,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1px solid #fff',
            boxShadow: '0 0 6px #ff3355',
          }}>🎁</div>
        )}
      </button>

      {/* ── XP + trophy column next to portrait ── */}
      <div className="hud-avatar-xp" style={{
        display: 'flex', flexDirection: 'column', gap: 3,
        width: 60, flexShrink: 0,
      }}>
        <div className="hud-trophy" style={{
          display: 'flex', alignItems: 'center', gap: 3,
          background: 'rgba(0,0,0,0.35)',
          borderRadius: 8, padding: '1px 6px',
          alignSelf: 'flex-start',
        }}>
          <span style={{ fontSize: 12 }}>🏆</span>
          <span style={{ color: '#ffd86b', fontWeight: 900, fontSize: 11 }}>{trophies}</span>
        </div>
        <div className="hud-xp" style={{ width: '100%' }}>
          <div style={{
            width: '100%', height: 6,
            background: 'rgba(0,0,0,0.45)',
            border: '1px solid rgba(255,215,120,0.25)',
            borderRadius: 4, overflow: 'hidden',
          }}>
            <div style={{
              width: `${xpPercent}%`, height: '100%',
              background: 'linear-gradient(90deg, #5ad6ff, #b06bff)',
              borderRadius: 4,
              boxShadow: '0 0 6px rgba(120,180,255,0.6)',
            }} />
          </div>
        </div>
      </div>

      {/* ── Resource pills ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        marginLeft: 'auto', marginRight: 2,
      }}>
        <ResourcePill icon="🍎" value={food}     color="#ff8a66" />
        <ResourcePill icon="🪙" value={gold}     color="#ffd54a" />
        <ResourcePill icon="💎" value={diamonds} color="#5ad6ff" onClick={() => EventBus.emit(GameEvents.OPEN_SHOP, {})} />
      </div>

      {/* ── Settings / cheat code ── */}
      <button
        onClick={openCheatPrompt}
        title="Einstellungen / Cheat-Code"
        style={{
          background: 'radial-gradient(circle at 35% 30%, #3a2466, #1c1038)',
          border: '2px solid #c79a3a',
          borderRadius: '50%', color: '#ffe9a8', width: 38, height: 38,
          cursor: 'pointer', fontSize: 19, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          boxShadow: '0 2px 6px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,215,120,0.25)',
        }}>⚙️</button>
    </div>
  );
}

function ResourcePill({
  icon, value, color, onClick,
}: {
  icon: string; value: number; color: string; onClick?: () => void;
}) {
  const display = value >= 1_000_000
    ? (value / 1_000_000).toFixed(1) + 'M'
    : value >= 1000
      ? (value / 1000).toFixed(1) + 'k'
      : String(value);

  return (
    <div style={{
      position: 'relative',
      display: 'flex', alignItems: 'center', gap: 4,
      background: 'linear-gradient(180deg, rgba(8,4,20,0.7), rgba(8,4,20,0.5))',
      border: '1.5px solid rgba(255,215,120,0.35)',
      borderRadius: 13,
      padding: '2px 22px 2px 6px',
      height: 28,
      flexShrink: 1,
      minWidth: 60,
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1)',
    }}>
      <span style={{ fontSize: 16, lineHeight: 1, filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.6))' }}>{icon}</span>
      <span style={{ color, fontWeight: 900, fontSize: 13, textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>{display}</span>
      <button
        onClick={onClick}
        title="Aufstocken"
        className="hud-resource-btn"
        style={{
          position: 'absolute', right: -4, top: '50%', transform: 'translateY(-50%)',
          background: 'radial-gradient(circle at 35% 30%, #ff6b6b, #cc2828)',
          border: '1.5px solid #ffb0a0',
          borderRadius: '50%',
          width: 20, height: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 900, color: '#fff', cursor: 'pointer',
          lineHeight: 1, padding: 0,
          boxShadow: '0 1px 4px rgba(0,0,0,0.5)',
        }}>+</button>
    </div>
  );
}
