import React from 'react';

// Shared floating action button used by the corner clusters (bottom-left
// "fight" group and bottom-right "shop" group). One component, three sizes, so
// the primary KÄMPFEN button can be big while the secondary actions stay small.
export type RailButtonSize = 'lg' | 'md' | 'sm';

const SIZE_SPEC: Record<RailButtonSize, { w: number; icon: number; label: number; pad: string; radius: number }> = {
  lg: { w: 74, icon: 30, label: 10,  pad: '9px 0 7px', radius: 17 },
  md: { w: 54, icon: 23, label: 8.5, pad: '6px 0 4px', radius: 14 },
  sm: { w: 48, icon: 20, label: 7.5, pad: '5px 0 4px', radius: 12 },
};

export function RailButton({
  icon, label, from, to, border = '#e8b84a', size = 'md', primary, badge,
  badgeColor = '#ff3355', onClick,
}: {
  icon: string;
  label: string;
  from: string;
  to: string;
  border?: string;
  size?: RailButtonSize;
  primary?: boolean;
  badge?: number;
  badgeColor?: string;
  onClick: () => void;
}) {
  const [pressed, setPressed] = React.useState(false);
  const s = SIZE_SPEC[size];

  return (
    <button
      // Fire on the native click (reliable for mouse AND touch — a slight finger
      // move during a tap fires pointercancel, which would drop an
      // onPointerUp-based handler). Pointer events drive only the press visual.
      onClick={onClick}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerCancel={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      title={label}
      style={{
        position: 'relative',
        width: s.w,
        background: pressed
          ? `linear-gradient(160deg, ${to}, #1a0a0a)`
          : `linear-gradient(160deg, ${from}, ${to})`,
        border: `2.5px solid ${border}`,
        borderRadius: s.radius,
        padding: s.pad,
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
      <span style={{ fontSize: s.icon, lineHeight: 1, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))' }}>{icon}</span>
      <span style={{
        fontSize: s.label, fontWeight: 900, color: '#fff',
        letterSpacing: '0.02em', textShadow: '0 1px 2px rgba(0,0,0,0.85)',
        whiteSpace: 'nowrap',
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
