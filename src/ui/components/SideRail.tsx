import React from 'react';
import { useGameStore } from '@store/gameStore';
import { EventBus, GameEvents } from '@game/EventBus';
import { QUESTS, isQuestComplete, type QuestProgressSnapshot } from '@data/quests';

// Vertical action rail on the right edge — mirrors the reference UI's
// stacked event/season/daily buttons. Each entry is a framed icon-button
// with an optional notification badge.
export function SideRail() {
  const claimableQuests = useGameStore(s => {
    const snap: QuestProgressSnapshot = {
      playerLevel: s.playerLevel,
      storyProgress: s.storyProgress,
      pokedexSeen: s.pokedexSeen.length,
      monstersOwned: Object.keys(s.monsters).length,
      buildingsBuilt: s.stats.buildingsBuilt,
      feeds: s.stats.feeds,
      breeds: s.stats.breeds,
      hatches: s.stats.hatches,
      collects: s.stats.collects,
      battlesWon: s.stats.battlesWon,
      highestRarityOwned: 0,
    };
    return QUESTS.filter(q => !s.claimedQuests.includes(q.id) && isQuestComplete(q, snap)).length;
  });

  return (
    <div className="floating-rail floating-rail--right">
      <RailButton
        icon="🎪" label="Events"
        from="#7a3fd0" to="#4a1f96"
        onClick={() => EventBus.emit(GameEvents.OPEN_EVENTS, {})}
      />
      <RailButton
        icon="📋" label="Aufträge"
        from="#3f8fd0" to="#1f4f96"
        badge={claimableQuests > 0 ? claimableQuests : undefined}
        badgeColor="#44dd66"
        onClick={() => EventBus.emit(GameEvents.OPEN_QUESTS, {})}
      />
      <RailButton
        icon="🏝️" label="Inseln"
        from="#3fb87a" to="#1f7a4a"
        onClick={() => EventBus.emit(GameEvents.OPEN_ISLANDS_PANEL, {})}
      />
      <RailButton
        icon="📦" label="Lager"
        from="#d09a3f" to="#9a6a1f"
        onClick={() => EventBus.emit(GameEvents.OPEN_STORAGE, {})}
      />
      <RailButton
        icon="📚" label="Kompendium"
        from="#3f6fd0" to="#1f3a96"
        onClick={() => EventBus.emit(GameEvents.OPEN_COMPENDIUM, {})}
      />
      <RailButton
        icon="🧪" label="Labor"
        from="#a23fd0" to="#5f1f96"
        onClick={() => EventBus.emit(GameEvents.OPEN_LAB, {})}
      />
    </div>
  );
}

function RailButton({
  icon, label, from, to, badge, badgeColor = '#ff3355', onClick,
}: {
  icon: string;
  label: string;
  from: string;
  to: string;
  badge?: number;
  badgeColor?: string;
  onClick: () => void;
}) {
  const [pressed, setPressed] = React.useState(false);

  return (
    <button
      // Activate on native click (touch-reliable); pointer events are visual only.
      onClick={onClick}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerCancel={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      title={label}
      style={{
        position: 'relative',
        width: 56,
        background: `linear-gradient(160deg, ${from}, ${to})`,
        border: '2px solid #e8b84a',
        borderRadius: 14,
        padding: '7px 0 5px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
        cursor: 'pointer',
        userSelect: 'none', touchAction: 'manipulation',
        pointerEvents: 'auto',
        boxShadow: pressed
          ? '0 1px 4px rgba(0,0,0,0.6)'
          : '0 4px 10px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.22)',
        transform: pressed ? 'translateY(2px)' : 'translateY(0)',
        transition: 'transform 0.08s, box-shadow 0.08s',
      }}>
      <span style={{ fontSize: 24, lineHeight: 1, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))' }}>{icon}</span>
      <span style={{
        fontSize: 8.5, fontWeight: 900, color: '#fff',
        letterSpacing: '0.02em', textShadow: '0 1px 2px rgba(0,0,0,0.8)',
      }}>{label}</span>

      {badge != null && (
        <span style={{
          position: 'absolute', top: -6, right: -6,
          background: badgeColor, color: badgeColor === '#44dd66' ? '#04210f' : '#fff',
          borderRadius: '50%', minWidth: 20, height: 20, padding: '0 4px',
          fontSize: 11, fontWeight: 900,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '2px solid #fff',
          boxShadow: `0 0 8px ${badgeColor}`,
        }}>{badge}</span>
      )}
    </button>
  );
}
