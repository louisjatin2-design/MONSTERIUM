import React, { useState } from 'react';
import '../styles/global.css';

interface HelpButtonProps {
  // Heading shown at the top of the help popover.
  title: string;
  // One bullet per tip. Plain strings — kept short and friendly.
  tips: string[];
  // Optional override for the button's right offset (px). Defaults to sitting
  // just left of the panel's ✕ close button.
  rightOffset?: number;
}

// A small floating "?" button that drops a help popover explaining the screen
// it lives on. Reused across every panel/screen so help is always one tap away.
export function HelpButton({ title, tips, rightOffset = 54 }: HelpButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className="help-btn"
        title="Hilfe"
        aria-label="Hilfe"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        style={{ right: rightOffset }}
      >
        ?
      </button>

      {open && (
        <div className="help-overlay" onClick={(e) => { e.stopPropagation(); setOpen(false); }}>
          <div className="help-card" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setOpen(false)}>✕</button>
            <div className="help-card-title">❔ {title}</div>
            <ul className="help-list">
              {tips.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
            <button className="btn btn-info" style={{ width: '100%', marginTop: 6 }} onClick={() => setOpen(false)}>
              Verstanden
            </button>
          </div>
        </div>
      )}
    </>
  );
}
