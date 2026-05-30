import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type Phaser from 'phaser';

export const PhaserGame = forwardRef<Phaser.Game | null>((_, ref) => {
  const gameRef = useRef<Phaser.Game | null>(null);

  useImperativeHandle(ref, () => gameRef.current as Phaser.Game);

  useEffect(() => {
    if (gameRef.current) return;

    // Dynamic import keeps Phaser out of React's static bundle.
    // React now initialises before Phaser loads, preventing the iOS Safari
    // cross-chunk dependency that caused error #185.
    import('@game/PhaserInit').then(({ startPhaser }) => {
      if (!gameRef.current) {
        gameRef.current = startPhaser('game-container');
      }
    });

    return () => {
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  return (
    <div
      id="game-container"
      tabIndex={-1}
      style={{
        position: 'absolute',
        top: 0, right: 0, bottom: 0, left: 0,
        zIndex: 0,
        pointerEvents: 'auto',
        outline: 'none',
      }}
    />
  );
});

PhaserGame.displayName = 'PhaserGame';
