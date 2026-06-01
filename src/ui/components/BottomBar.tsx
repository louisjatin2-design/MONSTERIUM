import React from 'react';

interface BottomBarProps {
  /** Type of the currently open panel, so the matching tab is highlighted. */
  active?:   string | null;
  onAttack:  () => void;
  onPokedex: () => void;
  onStory:   () => void;
  onShop:    () => void;
  onBreed:   () => void;
  onHatch:   () => void;
}

type HandlerKey = 'onAttack' | 'onPokedex' | 'onStory' | 'onShop' | 'onBreed' | 'onHatch';

const BUTTONS: Array<{
  icon: string;
  label: string;
  key: HandlerKey;
  /** activePanel.type this tab maps to, used for the active highlight. */
  panel: string;
  from: string;
  to: string;
  border: string;
}> = [
  { icon: '⚔️',  label: 'ATTACK',  key: 'onAttack',  panel: 'story',    from: '#e84545', to: '#b82828', border: '#ff7070' },
  { icon: '📖',  label: 'POKÉDEX', key: 'onPokedex', panel: 'pokedex',  from: '#4578e8', to: '#2850b8', border: '#70a0ff' },
  { icon: '🗺️',  label: 'STORY',   key: 'onStory',   panel: 'story',    from: '#9b45e8', to: '#6a28b8', border: '#c070ff' },
  { icon: '💞',  label: 'BREED',   key: 'onBreed',   panel: 'breeding', from: '#e845a8', to: '#b82878', border: '#ff70d0' },
  { icon: '🥚',  label: 'HATCH',   key: 'onHatch',   panel: 'hatchery', from: '#45c8e8', to: '#289ab8', border: '#70e0ff' },
  { icon: '🛒',  label: 'SHOP',    key: 'onShop',    panel: 'shop',     from: '#e8a845', to: '#b87c28', border: '#ffd070' },
];

export function BottomBar({ active = null, onAttack, onPokedex, onStory, onShop, onBreed, onHatch }: BottomBarProps) {
  const handlers: Record<HandlerKey, () => void> = {
    onAttack, onPokedex, onStory, onShop, onBreed, onHatch,
  };

  return (
    <div style={{
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: 84,
      background: 'linear-gradient(180deg, #281642 0%, #160c28 60%, #0c0618 100%)',
      borderTop: '2px solid #8a5cd8',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-around',
      padding: '0 8px',
      pointerEvents: 'auto',
      zIndex: 200,
      boxShadow: '0 -6px 24px rgba(0,0,0,0.75), inset 0 2px 0 rgba(255,255,255,0.1), inset 0 -3px 12px rgba(0,0,0,0.5)',
    }}>
      {BUTTONS.map(btn => (
        <BarButton
          key={btn.key}
          icon={btn.icon}
          label={btn.label}
          from={btn.from}
          to={btn.to}
          border={btn.border}
          active={active === btn.panel}
          onClick={handlers[btn.key]}
        />
      ))}
    </div>
  );
}

function BarButton({
  icon, label, from, to, border, active, onClick,
}: {
  icon: string; label: string; from: string; to: string; border: string; active: boolean; onClick: () => void;
}) {
  const [pressed, setPressed] = React.useState(false);

  return (
    <button
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => { setPressed(false); onClick(); }}
      onPointerLeave={() => setPressed(false)}
      style={{
        width: 'clamp(46px, calc((100vw - 16px) / 6), 66px)',
        height: 'clamp(48px, calc((100vw - 16px) / 6 + 2px), 68px)',
        border: active ? '2px solid #ffffff' : `2px solid ${border}`,
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
        boxShadow: active
          ? `0 0 0 2px ${border}, 0 0 14px ${border}, inset 0 1px 0 rgba(255,255,255,0.3)`
          : pressed
            ? `0 1px 4px rgba(0,0,0,0.6)`
            : `0 4px 10px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.2)`,
        transform: pressed ? 'translateY(2px)' : active ? 'translateY(-2px)' : 'translateY(0)',
        transition: 'transform 0.08s, box-shadow 0.08s',
        padding: 0,
        userSelect: 'none',
        touchAction: 'manipulation',
        flexShrink: 0,
      }}
    >
      <span style={{ fontSize: 'clamp(16px, calc((100vw - 16px) / 6 * 0.38), 24px)', lineHeight: 1 }}>{icon}</span>
      <span style={{
        fontSize: 'clamp(7px, 1.8vw, 9px)',
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
