import React from 'react';

export function BattleHUD() {
  // The battle HUD is mostly rendered inside Phaser.
  // This React component handles any additional overlay info.
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      // Pad past the iOS home-bar so the hint isn't hidden under it.
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      minHeight: 40,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      pointerEvents: 'none',
      color: '#aaa', fontSize: 12, textAlign: 'center', padding: '0 12px',
    }}>
      🏳️ Tippe auf FLIEHEN (oben links) oder drücke ESC, um zu fliehen
    </div>
  );
}
