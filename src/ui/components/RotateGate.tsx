import React, { useEffect, useState } from 'react';

// Landscape-only nudge. The game is built for landscape, so in portrait we show
// a "please rotate" overlay — but it is DISMISSIBLE, so a player on a device that
// can't rotate (or a portrait preview frame) is never permanently locked out of
// the game. Replaces the old CSS-only @media gate that could hide everything.
export function RotateGate() {
  const getPortrait = () =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(orientation: portrait)').matches
      : false;

  const [portrait, setPortrait] = useState(getPortrait);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia('(orientation: portrait)');
    const onChange = () => {
      setPortrait(mq.matches);
      // Back in landscape → reset, so the hint shows again next time.
      if (!mq.matches) setDismissed(false);
    };
    mq.addEventListener?.('change', onChange);
    window.addEventListener('resize', onChange);
    return () => {
      mq.removeEventListener?.('change', onChange);
      window.removeEventListener('resize', onChange);
    };
  }, []);

  if (!portrait || dismissed) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 16, padding: 32, textAlign: 'center',
      background: 'radial-gradient(120% 90% at 50% 20%, #1a1430, #07060d 80%)',
      color: '#e7ecf4',
    }}>
      <div style={{ fontSize: 64, animation: 'rotateHint 2.4s ease-in-out infinite' }}>📱</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: '#ffd86b', letterSpacing: '0.04em' }}>Bitte drehen</div>
      <div style={{ fontSize: 14, color: '#b6bcc8', maxWidth: 320, lineHeight: 1.5 }}>
        MONSTERIUM wird im Querformat gespielt. Drehe dein Gerät quer für die beste Ansicht.
      </div>
      <button
        onClick={() => setDismissed(true)}
        style={{
          marginTop: 8, padding: '10px 20px', borderRadius: 12, cursor: 'pointer',
          background: 'linear-gradient(160deg, #ffb43a, #e07a1f)',
          border: '2px solid #ffe090', color: '#3a1a00',
          fontWeight: 900, fontSize: 14, touchAction: 'manipulation',
        }}>
        Trotzdem weiterspielen
      </button>
    </div>
  );
}
