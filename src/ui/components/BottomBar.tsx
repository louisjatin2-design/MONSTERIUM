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
}> = [
  { icon: '⚔️',  label: 'ATTACK',  key: 'onAttack',  from: '#e84545', to: '#b82828', border: '#ff7070' },
  { icon: '📖',  label: 'POKÉDEX', key: 'onPokedex', from: '#4578e8', to: '#2850b8', border: '#70a0ff' },
  { icon: '🗺️',  label: 'STORY',   key: 'onStory',   from: '#9b45e8', to: '#6a28b8', border: '#c070ff' },
  { icon: '💞',  label: 'BREED',   key: 'onBreed',   from: '#e845a8', to: '#b82878', border: '#ff70d0' },
  { icon: '🥚',  label: 'HATCH',   key: 'onHatch',   from: '#45c8e8', to: '#289ab8', border: '#70e0ff' },
  { icon: '🛒',  label: 'SHOP',    key: 'onShop',    from: '#e8a845', to: '#b87c28', border: '#ffd070' },
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
      height: 84,
      background: 'linear-gradient(180deg, #1a0e35 0%, #0e0820 100%)',
      borderTop: '2px solid #6644aa',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-around',
      padding: '0 8px',
      pointerEvents: 'auto',
      zIndex: 200,
      boxShadow: '0 -4px 20px rgba(0,0,0,0.7)',
    }}>
      {BUTTONS.map(btn => (
        <BarButton
          key={btn.key}
          icon={btn.icon}
          label={btn.label}
          from={btn.from}
          to={btn.to}
          border={btn.border}
          onClick={handlers[btn.key]}
        />
      ))}
    </div>
  );
}

function BarButton({
  icon, label, from, to, border, onClick,
}: {
  icon: string; label: string; from: string; to: string; border: string; onClick: () => void;
}) {
  const [pressed, setPressed] = React.useState(false);

  return (
    <button
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => { setPressed(false); onClick(); }}
      onPointerLeave={() => setPressed(false)}
      style={{
        width: 66,
        height: 68,
        border: `2px solid ${border}`,
        borderRadius: 14,
        background: pressed
          ? `linear-gradient(160deg, ${to}, #000)`
          : `linear-gradient(160deg, ${from}, ${to})`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        cursor: 'pointer',
        boxShadow: pressed
          ? `0 1px 4px rgba(0,0,0,0.6)`
          : `0 4px 10px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.2)`,
        transform: pressed ? 'translateY(2px)' : 'translateY(0)',
        transition: 'transform 0.08s, box-shadow 0.08s',
        padding: 0,
        userSelect: 'none',
        touchAction: 'manipulation',
      }}
    >
      <span style={{ fontSize: 24, lineHeight: 1 }}>{icon}</span>
      <span style={{
        fontSize: 9,
        fontWeight: 900,
        color: '#fff',
        letterSpacing: '0.04em',
        textShadow: '0 1px 2px rgba(0,0,0,0.8)',
      }}>
        {label}
      </span>
    </button>
  );
}
