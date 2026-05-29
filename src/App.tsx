import React, { useEffect, useRef, useState } from 'react';
import { PhaserGame } from '@ui/PhaserGame';
import { HUD } from '@ui/components/HUD';
import { BuildMenu } from '@ui/components/BuildMenu';
import { HabitatPanel } from '@ui/components/HabitatPanel';
import { BreedingPanel } from '@ui/components/BreedingPanel';
import { HatcheryPanel } from '@ui/components/HatcheryPanel';
import { Pokedex } from '@ui/components/Pokedex';
import { StoryMap } from '@ui/components/StoryMap';
import { ShopPanel } from '@ui/components/ShopPanel';
import { BattleHUD } from '@ui/components/BattleHUD';
import { EventBus, GameEvents } from '@game/EventBus';
import { useGameStore } from '@store/gameStore';
import type Phaser from 'phaser';

export type ActivePanel =
  | null
  | { type: 'habitat'; instanceId: string }
  | { type: 'build'; tileX: number; tileY: number }
  | { type: 'breeding' }
  | { type: 'hatchery' }
  | { type: 'pokedex' }
  | { type: 'story' }
  | { type: 'shop' }
  | { type: 'battle' };

export default function App() {
  const phaserRef = useRef<Phaser.Game | null>(null);
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const tickTimers = useGameStore((s) => s.tickTimers);

  // Timer tick every second
  useEffect(() => {
    const id = setInterval(() => tickTimers(), 1000);
    return () => clearInterval(id);
  }, [tickTimers]);

  // Subscribe to EventBus events from Phaser scenes
  useEffect(() => {
    const onOpenHabitat  = (d: { instanceId: string }) => setActivePanel({ type: 'habitat', instanceId: d.instanceId });
    const onOpenBuild    = (d: { tileX: number; tileY: number }) => setActivePanel({ type: 'build', tileX: d.tileX, tileY: d.tileY });
    const onOpenBreeding = () => setActivePanel({ type: 'breeding' });
    const onOpenHatchery = () => setActivePanel({ type: 'hatchery' });
    const onOpenPokedex  = () => setActivePanel({ type: 'pokedex' });
    const onOpenShop     = () => setActivePanel({ type: 'shop' });
    const onBattleStart  = () => setActivePanel({ type: 'battle' });
    const onBattleEnd    = () => setActivePanel(null);

    EventBus.on(GameEvents.OPEN_HABITAT_PANEL, onOpenHabitat);
    EventBus.on(GameEvents.OPEN_BUILD_MENU, onOpenBuild);
    EventBus.on(GameEvents.OPEN_BREEDING_PANEL, onOpenBreeding);
    EventBus.on(GameEvents.OPEN_HATCHERY_PANEL, onOpenHatchery);
    EventBus.on(GameEvents.OPEN_POKEDEX, onOpenPokedex);
    EventBus.on(GameEvents.OPEN_SHOP, onOpenShop);
    EventBus.on(GameEvents.BATTLE_STARTED, onBattleStart);
    EventBus.on(GameEvents.BATTLE_ENDED, onBattleEnd);

    return () => {
      EventBus.off(GameEvents.OPEN_HABITAT_PANEL, onOpenHabitat);
      EventBus.off(GameEvents.OPEN_BUILD_MENU, onOpenBuild);
      EventBus.off(GameEvents.OPEN_BREEDING_PANEL, onOpenBreeding);
      EventBus.off(GameEvents.OPEN_HATCHERY_PANEL, onOpenHatchery);
      EventBus.off(GameEvents.OPEN_POKEDEX, onOpenPokedex);
      EventBus.off(GameEvents.OPEN_SHOP, onOpenShop);
      EventBus.off(GameEvents.BATTLE_STARTED, onBattleStart);
      EventBus.off(GameEvents.BATTLE_ENDED, onBattleEnd);
    };
  }, []);

  const closePanel = () => {
    setActivePanel(null);
    EventBus.emit(GameEvents.PANEL_CLOSED, {});
  };

  const isBattleActive = activePanel?.type === 'battle';

  return (
    <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, left: 0, overflow: 'hidden' }}>
      <PhaserGame ref={phaserRef} />

      {/* React overlay — pointer-events: none except on active children */}
      <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, pointerEvents: 'none', zIndex: 100 }}>
        <HUD
          onPokedex={() => setActivePanel({ type: 'pokedex' })}
          onStory={() => setActivePanel({ type: 'story' })}
          onShop={() => setActivePanel({ type: 'shop' })}
        />

        {activePanel?.type === 'build' && (
          <BuildMenu
            tileX={activePanel.tileX}
            tileY={activePanel.tileY}
            onClose={closePanel}
          />
        )}
        {activePanel?.type === 'habitat' && (
          <HabitatPanel instanceId={activePanel.instanceId} onClose={closePanel} />
        )}
        {activePanel?.type === 'breeding' && (
          <BreedingPanel onClose={closePanel} />
        )}
        {activePanel?.type === 'hatchery' && (
          <HatcheryPanel onClose={closePanel} />
        )}
        {activePanel?.type === 'pokedex' && (
          <Pokedex onClose={closePanel} />
        )}
        {activePanel?.type === 'story' && (
          <StoryMap onClose={closePanel} />
        )}
        {activePanel?.type === 'shop' && (
          <ShopPanel onClose={closePanel} />
        )}
        {isBattleActive && <BattleHUD />}
      </div>
    </div>
  );
}
