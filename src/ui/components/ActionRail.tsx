import React from 'react';

interface ActionRailProps {
  onAttack:  () => void;
  onPokedex: () => void;
  onShop:    () => void;
  onBreed:   () => void;
  onHatch:   () => void;
  onBuild:   () => void;
}

const BUTTONS: Array<{
  icon: string;
  label: string;
  key: keyof ActionRailProps;
  from: string;
  to: string;
  border: string;
  primary?: boolean;
}> = [
  { icon: '⚔️', label: 'KÄMPFEN',    key: 'onAttack',  from: '#ff5a4a', to: '#c41f1f', border: '#ffb070', primary: true },
  { icon: '🏗️', label: 'BAUEN',      key: 'onBuild',   from: '#7ad04a', to: '#3f8a1f', border: '#bfff90' },
  { icon: '💞', label: 'ZÜCHTEN',    key: 'onBreed',   from: '#ff5ab0', to: '#c4287a', border: '#ffb0e0' },
  { icon: '🥚', label: 'BRUTKAMMER', key: 'onHatch',   from: '#4accd8', to: '#1f8ab8', border: '#90e0ff' },
  { icon: '📖', label: 'MONSTER',    key: 'onPokedex', from: '#5a8ae8', to: '#2850b8', border: '#90b8ff' },
  { icon: '🛒', label: 'LADEN',      key: 'onShop',    from: '#e8b04a', to: '#b87c1f', border: '#ffe090' },
];

// Floating vertical action column on the LEFT edge. Replaces the old
// full-width bottom bar so the whole screen stays a clear habitat — only
// the buttons themselves catch input; the gaps pass through to the world.
export function ActionRail(props: ActionRailProps) {
  return (
    <div className="floating-rail floating-rail--left">
      {BUTTONS.map(btn => (
        <RailButton
          key={btn.key}
          icon={btn.icon}
          label={btn.label}
          from={btn.from}
          to={btn.to}
          border={btn.border}
          primary={btn.primary}
          onClick={props[btn.key]}
        />
      ))}
    </div>
  );
}

function RailButton({
  icon, label, from, to, border, primary, onClick,
}: {
  icon: string; label: string; from: string; to: string; border: string;
  primary?: boolean; onClick: () => void;
}) {
  const [pressed, setPressed] = React.useState(false);

  return (
    <button
      // Fire on the native click (reliable for mouse AND touch — a slight
      // finger move during a tap fires pointercancel, which would drop an
      // onPointerUp-based handler). Pointer events drive only the press visual.
      onClick={onClick}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerCancel={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      title={label}
      style={{
        position: 'relative',
        width: 58,
        background: pressed
          ? `linear-gradient(160deg, ${to}, #1a0a0a)`
          : `linear-gradient(160deg, ${from}, ${to})`,
        border: `2.5px solid ${border}`,
        borderRadius: 15,
        padding: '7px 0 5px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
        cursor: 'pointer',
        userSelect: 'none', touchAction: 'manipulation',
        pointerEvents: 'auto',
        boxShadow: pressed
          ? '0 1px 4px rgba(0,0,0,0.6)'
          : primary
            ? '0 4px 14px rgba(255,90,60,0.55), inset 0 1px 0 rgba(255,255,255,0.3)'
            : '0 4px 10px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.22)',
        transform: pressed ? 'translateY(2px)' : 'translateY(0)',
        transition: 'transform 0.08s, box-shadow 0.08s',
        animation: primary && !pressed ? 'primaryPulse 1.8s ease-in-out infinite' : 'none',
      }}>
      <span style={{ fontSize: 25, lineHeight: 1, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))' }}>{icon}</span>
      <span style={{
        fontSize: 8, fontWeight: 900, color: '#fff',
        letterSpacing: '0.01em', textShadow: '0 1px 2px rgba(0,0,0,0.85)',
        whiteSpace: 'nowrap',
      }}>{label}</span>
    </button>
  );
}
