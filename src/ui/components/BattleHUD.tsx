import React from 'react';

export function BattleHUD() {
  // The battle HUD is mostly rendered inside Phaser.
  // This React component handles any additional overlay info.
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0, height: 40,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      pointerEvents: 'none',
      color: '#aaa', fontSize: 12,
    }}>
      Press ESC to flee the battle
    </div>
  );
}
