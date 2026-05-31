import React, { useEffect, useRef, useState } from 'react';
import { PhaserGame } from '@ui/PhaserGame';
import { HUD } from '@ui/components/HUD';
import { BottomBar } from '@ui/components/BottomBar';
import { BuildMenu } from '@ui/components/BuildMenu';
import { HabitatPanel } from '@ui/components/HabitatPanel';
import { BreedingPanel } from '@ui/components/BreedingPanel';
import { HatcheryPanel } from '@ui/components/HatcheryPanel';
import { Pokedex } from '@ui/components/Pokedex';
import { StoryMap } from '@ui/components/StoryMap';
import { ShopPanel } from '@ui/components/ShopPanel';
import { BattleHUD } from '@ui/components/BattleHUD';
import { FarmPanel } from '@ui/components/FarmPanel';
import { IslandsPanel } from '@ui/components/IslandsPanel';
import { HatchConfirmPanel } from '@ui/components/HatchConfirmPanel';
import { TeamSelectPanel, type BattlePayload } from '@ui/components/TeamSelectPanel';
import { EventBus, GameEvents } from '@game/EventBus';
import { useGameStore } from '@store/gameStore';
import type Phaser from 'phaser';

export type ActivePanel =
  | null
  | { type: 'habitat'; instanceId: string }
  | { type: 'farm'; instanceId: string }
  | { type: 'build'; tileX: number; tileY: number }
  | { type: 'breeding' }
  | { type: 'hatchery' }
  | { type: 'hatchConfirm'; eggId: string }
  | { type: 'pokedex' }
  | { type: 'story' }
  | { type: 'shop' }
  | { type: 'islands' }
  | { type: 'teamSelect'; battlePayload: BattlePayload }
  | { type: 'battle' };

export default function App() {
  const phaserRef = useRef<Phaser.Game | null>(null);
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const tickTimers = useGameStore((s) => s.tickTimers);

  useEffect(() => {
    const id = setInterval(() => tickTimers(), 1000);
    return () => clearInterval(id);
  }, [tickTimers]);

  useEffect(() => {
    const onOpenHabitat  = (d: { instanceId: string }) => setActivePanel({ type: 'habitat', instanceId: d.instanceId });
    const onOpenFarm     = (d: { instanceId: string }) => setActivePanel({ type: 'farm', instanceId: d.instanceId });
    const onOpenBuild    = (d: { tileX: number; tileY: number }) => setActivePanel({ type: 'build', tileX: d.tileX, tileY: d.tileY });
    const onOpenBreeding = () => setActivePanel({ type: 'breeding' });
    const onOpenHatchery = () => setActivePanel({ type: 'hatchery' });
    const onHatchConfirm = (d: { eggId: string }) => setActivePanel({ type: 'hatchConfirm', eggId: d.eggId });
    const onOpenPokedex  = () => setActivePanel({ type: 'pokedex' });
    const onOpenShop     = () => setActivePanel({ type: 'shop' });
    const onOpenIslands    = () => setActivePanel({ type: 'islands' });
    const onOpenTeamSelect = (d: BattlePayload) => setActivePanel({ type: 'teamSelect', battlePayload: d });
    const onBattleStart    = () => setActivePanel({ type: 'battle' });
    const onBattleEnd    = () => setActivePanel(null);

    EventBus.on(GameEvents.OPEN_HABITAT_PANEL, onOpenHabitat);
    EventBus.on(GameEvents.OPEN_FARM_PANEL,    onOpenFarm);
    EventBus.on(GameEvents.OPEN_BUILD_MENU, onOpenBuild);
    EventBus.on(GameEvents.OPEN_BREEDING_PANEL, onOpenBreeding);
    EventBus.on(GameEvents.OPEN_HATCHERY_PANEL, onOpenHatchery);
    EventBus.on(GameEvents.OPEN_HATCH_CONFIRM, onHatchConfirm);
    EventBus.on(GameEvents.OPEN_POKEDEX, onOpenPokedex);
    EventBus.on(GameEvents.OPEN_SHOP, onOpenShop);
    EventBus.on(GameEvents.OPEN_ISLANDS_PANEL, onOpenIslands);
    EventBus.on(GameEvents.OPEN_TEAM_SELECT,   onOpenTeamSelect);
    EventBus.on(GameEvents.BATTLE_STARTED,     onBattleStart);
    EventBus.on(GameEvents.BATTLE_ENDED,       onBattleEnd);

    return () => {
      EventBus.off(GameEvents.OPEN_HABITAT_PANEL, onOpenHabitat);
      EventBus.off(GameEvents.OPEN_FARM_PANEL,    onOpenFarm);
      EventBus.off(GameEvents.OPEN_BUILD_MENU, onOpenBuild);
      EventBus.off(GameEvents.OPEN_BREEDING_PANEL, onOpenBreeding);
      EventBus.off(GameEvents.OPEN_HATCHERY_PANEL, onOpenHatchery);
      EventBus.off(GameEvents.OPEN_HATCH_CONFIRM, onHatchConfirm);
      EventBus.off(GameEvents.OPEN_POKEDEX, onOpenPokedex);
      EventBus.off(GameEvents.OPEN_SHOP, onOpenShop);
      EventBus.off(GameEvents.OPEN_ISLANDS_PANEL, onOpenIslands);
      EventBus.off(GameEvents.OPEN_TEAM_SELECT,   onOpenTeamSelect);
      EventBus.off(GameEvents.BATTLE_STARTED,     onBattleStart);
      EventBus.off(GameEvents.BATTLE_ENDED,       onBattleEnd);
    };
  }, []);

  const closePanel = () => {
    setActivePanel(null);
    EventBus.emit(GameEvents.PANEL_CLOSED, {});
  };

  const isBattleActive = activePanel?.type === 'battle';
  const hasPanelOpen   = activePanel !== null && !isBattleActive;

  return (
    <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, left: 0, overflow: 'hidden' }}>
      <PhaserGame ref={phaserRef} />

      {/* Backdrop: dims Phaser when a panel is open */}
      {hasPanelOpen && (
        <div
          style={{
            position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
            zIndex: 150,
            background: 'rgba(0,0,0,0.55)',
            pointerEvents: 'auto',
          }}
          onClick={closePanel}
          onKeyDown={e => e.stopPropagation()}
        />
      )}

      {/* Top HUD — always visible, above backdrop */}
      <HUD />

      {/* Bottom action bar — always visible, above backdrop */}
      <BottomBar
        onAttack={() => setActivePanel({ type: 'story' })}
        onPokedex={() => setActivePanel({ type: 'pokedex' })}
        onStory={() => setActivePanel({ type: 'story' })}
        onShop={() => setActivePanel({ type: 'shop' })}
        onBreed={() => setActivePanel({ type: 'breeding' })}
        onHatch={() => setActivePanel({ type: 'hatchery' })}
      />

      {/* Panel overlay — pointer-events:none so empty areas pass through to Phaser */}
      <div style={{
        position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
        pointerEvents: 'none',
        zIndex: 300,
      }}>
        {activePanel?.type === 'build' && (
          <BuildMenu
            tileX={activePanel.tileX}
            tileY={activePanel.tileY}
            onClose={closePanel}
            onStartPlacement={() => setActivePanel(null)}
          />
        )}
        {activePanel?.type === 'habitat' && (
          <HabitatPanel instanceId={activePanel.instanceId} onClose={closePanel} />
        )}
        {activePanel?.type === 'farm' && (
          <FarmPanel instanceId={activePanel.instanceId} onClose={closePanel} />
        )}
        {activePanel?.type === 'breeding' && (
          <BreedingPanel onClose={closePanel} />
        )}
        {activePanel?.type === 'hatchery' && (
          <HatcheryPanel onClose={closePanel} />
        )}
        {activePanel?.type === 'hatchConfirm' && (
          <HatchConfirmPanel eggId={activePanel.eggId} onClose={closePanel} />
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
        {activePanel?.type === 'islands' && (
          <IslandsPanel onClose={closePanel} />
        )}
        {activePanel?.type === 'teamSelect' && (
          <TeamSelectPanel battlePayload={activePanel.battlePayload} onClose={closePanel} />
        )}
        {isBattleActive && <BattleHUD />}
      </div>
    </div>
  );
}
