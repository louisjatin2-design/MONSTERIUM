import React from 'react';
import { uiIcon } from '../uiIcons';

// Shared floating action button used by the corner clusters (bottom-left
// "fight" group and bottom-right "shop" group). One component, three sizes, so
// the primary KÄMPFEN button can be big while the secondary actions stay small.
//
// Two render modes:
//   • EMOJI mode (no custom icon)  → the classic gold/blue gradient framed pill.
//   • EMBLEM mode (custom icon set) → the image *is* the button: the round neon
//     emblem PNG is circle-cropped (its black square corners are clipped away),
//     gets a raised glow, and the label sits in a clean pill underneath. This is
//     what stops the icons from looking like "a black square stuffed inside a
//     button" — the artwork now forms the whole control.
export type RailButtonSize = 'lg' | 'md' | 'sm';

const SIZE_SPEC: Record<RailButtonSize, {
  w: number; icon: number; label: number; pad: string; radius: number; dia: number;
}> = {
  lg: { w: 74, icon: 30, label: 11,  pad: '9px 0 7px', radius: 17, dia: 84 },
  md: { w: 54, icon: 23, label: 9,   pad: '6px 0 4px', radius: 14, dia: 62 },
  sm: { w: 48, icon: 20, label: 8.5, pad: '5px 0 4px', radius: 12, dia: 56 },
};

export function RailButton({
  icon, iconName, label, from, to, border = '#e8b84a', size = 'md', primary, badge,
  badgeColor = '#ff3355', onClick,
}: {
  icon: string;
  // Optional named image slot — drop src/assets/ui/icons/<iconName>.png to use a
  // custom icon image instead of the emoji (see src/ui/uiIcons.ts).
  iconName?: string;
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
  const img = uiIcon(iconName);

  const pointerProps = {
    onClick,
    onPointerDown: () => setPressed(true),
    onPointerUp: () => setPressed(false),
    onPointerCancel: () => setPressed(false),
    onPointerLeave: () => setPressed(false),
    title: label,
  };

  const badgeEl = badge != null && (
    <span style={{
      position: 'absolute', top: -4, right: -4,
      background: badgeColor, color: badgeColor === '#44dd66' ? '#04210f' : '#fff',
      borderRadius: '50%', minWidth: 20, height: 20, padding: '0 4px',
      fontSize: 11, fontWeight: 900,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      border: '2px solid #fff',
      boxShadow: `0 0 8px ${badgeColor}`,
      zIndex: 2,
    }}>{badge}</span>
  );

  // ── EMBLEM MODE: the round artwork forms the button itself ──────────────────
  if (img) {
    return (
      <button
        {...pointerProps}
        className={`emblem-btn${primary ? ' emblem-btn--primary' : ''}`}
        style={{
          position: 'relative',
          background: 'transparent', border: 'none', padding: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
          cursor: 'pointer', userSelect: 'none', touchAction: 'manipulation',
          pointerEvents: 'auto',
          // @ts-expect-error custom prop consumed by the emblemPulse keyframe
          '--glow': border,
        }}>
        {/* Circle-cropped emblem. The PNG is square with black corners; the round
            mask (+ slight zoom) clips those corners so the neon disc reads as the
            button. */}
        <span
          className="emblem-disc"
          style={{
            position: 'relative',
            width: s.dia, height: s.dia,
            borderRadius: '50%',
            overflow: 'hidden',
            transform: pressed ? 'translateY(2px) scale(0.95)' : 'translateY(0) scale(1)',
            transition: 'transform 0.09s ease',
            boxShadow: pressed
              ? '0 1px 5px rgba(0,0,0,0.6), inset 0 0 0 1.5px rgba(255,255,255,0.10)'
              : `0 5px 16px rgba(0,0,0,0.6), 0 0 14px -2px ${border}, inset 0 0 0 1.5px rgba(255,255,255,0.14)`,
          }}>
          <img
            src={img} alt={label} draggable={false}
            style={{
              position: 'absolute', inset: '-5%',
              width: '110%', height: '110%',
              objectFit: 'cover', pointerEvents: 'none',
            }} />
          {/* Soft top sheen so the disc reads as a raised, glossy button. */}
          <span style={{
            position: 'absolute', inset: 0, borderRadius: '50%', pointerEvents: 'none',
            background: 'radial-gradient(120% 70% at 50% -10%, rgba(255,255,255,0.30), transparent 55%)',
          }} />
        </span>

        <span style={{
          fontSize: s.label, fontWeight: 900, color: '#fff',
          letterSpacing: '0.04em', whiteSpace: 'nowrap', lineHeight: 1.2,
          textShadow: '0 1px 3px rgba(0,0,0,0.9)',
          background: 'linear-gradient(180deg, rgba(10,12,20,0.82), rgba(10,12,20,0.6))',
          border: '1px solid rgba(255,255,255,0.16)',
          borderRadius: 999, padding: '1.5px 8px',
        }}>{label}</span>

        {badgeEl}
      </button>
    );
  }

  // ── EMOJI MODE: classic gold/blue gradient framed pill (unchanged look) ─────
  return (
    <button
      {...pointerProps}
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

      {badgeEl}
    </button>
  );
}
