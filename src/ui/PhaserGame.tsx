import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import Phaser from 'phaser';
import { GameConfig } from '@game/GameConfig';

export const PhaserGame = forwardRef<Phaser.Game | null>((_, ref) => {
  const gameRef = useRef<Phaser.Game | null>(null);

  useImperativeHandle(ref, () => gameRef.current!);

  useEffect(() => {
    if (gameRef.current) return;

    const game = new Phaser.Game({
      ...GameConfig,
      parent: 'game-container',
    });
    gameRef.current = game;

    return () => {
      game.destroy(true);
      gameRef.current = null;
    };
  }, []);

  return (
    <div
      id="game-container"
      style={{
        position: 'absolute',
        top: 0, right: 0, bottom: 0, left: 0,
        zIndex: 0,
        pointerEvents: 'auto',
      }}
    />
  );
});

PhaserGame.displayName = 'PhaserGame';
