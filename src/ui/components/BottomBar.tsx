import React from 'react';

interface BottomBarProps {
  onAttack:  () => void;
  onPokedex: () => void;
  onStory:   () => void;
  onShop:    () => void;
  onBreed:   () => void;
  onHatch:   () => void;
}

const BUTTONS: Array<{
  icon: string;
  label: string;
  key: keyof BottomBarProps;
  from: string;
  to: string;
  border: string;
  primary?: boolean;
}> = [
  { icon: '⚔️', label: 'KÄMPFEN',   key: 'onAttack',  from: '#ff5a4a', to: '#c41f1f', border: '#ffb070', primary: true },
  { icon: '🗺️', label: 'ABENTEUER', key: 'onStory',   from: '#a85ae8', to: '#6a28b8', border: '#d0a0ff' },
  { icon: '💞', label: 'ZÜCHTEN',   key: 'onBreed',   from: '#ff5ab0', to: '#c4287a', border: '#ffb0e0' },
  { icon: '🥚', label: 'BRUTKAMMER', key: 'onHatch',   from: '#4accd8', to: '#1f8ab8', border: '#90e0ff' },
  { icon: '📖', label: 'MONSTER',   key: 'onPokedex', from: '#5a8ae8', to: '#2850b8', border: '#90b8ff' },
  { icon: '🛒', label: 'LADEN',     key: 'onShop',    from: '#e8b04a', to: '#b87c1f', border: '#ffe090' },
];

export function BottomBar({ onAttack, onPokedex, onStory, onShop, onBreed, onHatch }: BottomBarProps) {
  const handlers: Record<keyof BottomBarProps, () => void> = {
    onAttack, onPokedex, onStory, onShop, onBreed, onHatch,
  };

  return (
    <div style={{
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: 90,
      // Warm carved wood/gold frame, matching the reference's bottom bar.
      background: 'linear-gradient(180deg, #4a2e1a 0%, #33200f 45%, #1d1108 100%)',
      borderTop: '3px solid #c79a3a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-evenly',
      padding: '0 8px',
      gap: 4,
      pointerEvents: 'auto',
      zIndex: 200,
      boxShadow: '0 -6px 24px rgba(0,0,0,0.75), inset 0 2px 0 rgba(255,215,120,0.3), inset 0 -3px 12px rgba(0,0,0,0.6)',
    }}>
      {BUTTONS.map(btn => (
        <BarButton
          key={btn.key}
          icon={btn.icon}
          label={btn.label}
          from={btn.from}
          to={btn.to}
          border={btn.border}
          primary={btn.primary}
          onClick={handlers[btn.key]}
        />
      ))}
    </div>
  );
}

function BarButton({
  icon, label, from, to, border, primary, onClick,
}: {
  icon: string; label: string; from: string; to: string; border: string;
  primary?: boolean; onClick: () => void;
}) {
  const [pressed, setPressed] = React.useState(false);

  // Primary action gets a slightly larger footprint + a gentle pulsing glow.
  const baseW = primary ? 76 : 60;
  const maxW  = primary ? 90 : 72;

  return (
    <button
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => { setPressed(false); onClick(); }}
      onPointerLeave={() => setPressed(false)}
      style={{
        width: `clamp(${primary ? 54 : 44}px, calc((100vw - 16px) / 6.3), ${maxW}px)`,
        height: primary ? 'clamp(60px, calc((100vw - 16px) / 6 + 12px), 80px)' : 'clamp(52px, calc((100vw - 16px) / 6 + 2px), 70px)',
        minWidth: 0,
        border: `2.5px solid ${border}`,
        borderRadius: 16,
        background: pressed
          ? `linear-gradient(160deg, ${to}, #1a0a0a)`
          : `linear-gradient(160deg, ${from}, ${to})`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        cursor: 'pointer',
        boxShadow: pressed
          ? '0 1px 4px rgba(0,0,0,0.6)'
          : primary
            ? `0 5px 14px rgba(255,90,60,0.5), inset 0 1px 0 rgba(255,255,255,0.3)`
            : `0 4px 10px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.22)`,
        transform: pressed ? 'translateY(2px)' : 'translateY(0)',
        transition: 'transform 0.08s, box-shadow 0.08s',
        padding: 0,
        userSelect: 'none',
        touchAction: 'manipulation',
        flexShrink: 1,
        flexGrow: primary ? 1.2 : 1,
        maxWidth: maxW,
        animation: primary && !pressed ? 'primaryPulse 1.8s ease-in-out infinite' : 'none',
      }}
    >
      <span style={{
        fontSize: primary
          ? 'clamp(20px, calc((100vw - 16px) / 6 * 0.46), 30px)'
          : 'clamp(17px, calc((100vw - 16px) / 6 * 0.4), 26px)',
        lineHeight: 1,
        filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))',
      }}>{icon}</span>
      <span style={{
        fontSize: primary ? 'clamp(8px, 2vw, 11px)' : 'clamp(7px, 1.7vw, 9px)',
        fontWeight: 900,
        color: '#fff',
        letterSpacing: '0.02em',
        textShadow: '0 1px 2px rgba(0,0,0,0.85)',
        whiteSpace: 'nowrap',
      }}>
        {label}
      </span>
    </button>
  );
}
