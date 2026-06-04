import React, { useEffect, useRef, useState } from 'react';
import { PhaserGame } from '@ui/PhaserGame';
import { HUD } from '@ui/components/HUD';
import { ActionRail } from '@ui/components/ActionRail';
import { SideRail } from '@ui/components/SideRail';
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
import { AssignHabitatPanel } from '@ui/components/AssignHabitatPanel';
import { MonsterInstanceDetail } from '@ui/components/MonsterInstanceDetail';
import { TutorialOverlay } from '@ui/components/TutorialOverlay';
import { LevelRewardPanel } from '@ui/components/LevelRewardPanel';
import { QuestPanel } from '@ui/components/QuestPanel';
import { EventsPanel } from '@ui/components/EventsPanel';
import { StoragePanel } from '@ui/components/StoragePanel';
import { CompendiumPanel } from '@ui/components/CompendiumPanel';
import { LabPanel } from '@ui/components/LabPanel';
import { AchievementsPanel } from '@ui/components/AchievementsPanel';
import { SeasonPassPanel } from '@ui/components/SeasonPassPanel';
import { MultiplayerPanel } from '@ui/components/MultiplayerPanel';
import { PvpArenaPanel } from '@ui/components/PvpArenaPanel';
import { BattleSelectScreen } from '@ui/components/BattleSelectScreen';
import { TeamSelectPanel, type BattlePayload } from '@ui/components/TeamSelectPanel';
import { LoginScreen } from '@ui/components/LoginScreen';
import { UsernamePrompt } from '@ui/components/UsernamePrompt';
import { World3D } from '@game/world3d/World3D';
import { EventBus, GameEvents } from '@game/EventBus';
import { useGameStore } from '@store/gameStore';
import { useAuthStore, isSupabaseConfigured } from '@store/authStore';
import type Phaser from 'phaser';

export type ActivePanel =
  | null
  | { type: 'habitat'; instanceId: string }
  | { type: 'farm'; instanceId: string }
  | { type: 'build'; tileX?: number; tileY?: number }
  | { type: 'breeding' }
  | { type: 'hatchery' }
  | { type: 'hatchConfirm'; eggId: string }
  | { type: 'assignHabitat'; eggId: string }
  | { type: 'monsterDetail'; instanceId: string }
  | { type: 'pokedex' }
  | { type: 'story' }
  | { type: 'battleSelect' }
  | { type: 'shop' }
  | { type: 'islands' }
  | { type: 'levelRewards' }
  | { type: 'quests' }
  | { type: 'events' }
  | { type: 'storage' }
  | { type: 'compendium' }
  | { type: 'lab' }
  | { type: 'achievements' }
  | { type: 'seasonPass' }
  | { type: 'multiplayer' }
  | { type: 'pvp' }
  | { type: 'teamSelect'; battlePayload: BattlePayload }
  | { type: 'battle' };

// Gate the whole game behind the account login. Kept as a thin wrapper so the
// Game component below always mounts with a stable set of hooks (the login/game
// switch happens by swapping which component renders, not by early-returning
// inside Game).
export default function App() {
  const currentUser = useAuthStore(s => s.currentUser);
  const session = useAuthStore(s => s.session);
  const displayName = useAuthStore(s => s.displayName);
  const restoreSession = useAuthStore(s => s.restoreSession);
  // Beim Start eine evtl. abgelaufene Supabase-Session erneuern (oder ausloggen).
  useEffect(() => { void restoreSession(); }, [restoreSession]);
  // Mit konfiguriertem Backend ist ein echtes Konto (Supabase-Session) Pflicht.
  const authed = !!currentUser && (!isSupabaseConfigured() || !!session);
  if (!authed) return <LoginScreen />;
  // Online-Konto ohne sauberen Username (z. B. Alt-Konto mit E-Mail) → abfragen.
  const shownName = displayName ?? currentUser ?? '';
  if (isSupabaseConfigured() && !!session && (shownName.includes('@') || shownName.trim() === '')) {
    return <UsernamePrompt />;
  }
  return <Game />;
}

function Game() {
  const phaserRef = useRef<Phaser.Game | null>(null);
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  // True while the flat 2D build overlay is up — hide the floating HUD/rails so
  // the build "tab" is clean (the overlay has its own title + hint bar).
  const [placementActive, setPlacementActive] = useState(false);
  // True once the ghost building sits on a placeable tile — enables Confirm.
  const [placementReady, setPlacementReady] = useState(false);
  const tickTimers = useGameStore((s) => s.tickTimers);
  const tutorialStep = useGameStore((s) => s.tutorialStep);
  const [tutorialDismissed, setTutorialDismissed] = useState(false);
  // Show the onboarding flow until the player finishes or skips it (step 99).
  const showTutorial = tutorialStep < 5 && !tutorialDismissed;

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
    // Forced habitat assignment when the player chooses to hatch an egg.
    const onAssignHabitat = (d: { eggId: string }) => setActivePanel({ type: 'assignHabitat', eggId: d.eggId });
    const onMonsterDetail = (d: { instanceId: string }) => setActivePanel({ type: 'monsterDetail', instanceId: d.instanceId });
    const onOpenPokedex  = () => setActivePanel({ type: 'pokedex' });
    const onOpenShop     = () => setActivePanel({ type: 'shop' });
    const onOpenIslands    = () => setActivePanel({ type: 'islands' });
    const onOpenLevelRewards = () => setActivePanel({ type: 'levelRewards' });
    const onOpenQuests       = () => setActivePanel({ type: 'quests' });
    const onOpenEvents       = () => setActivePanel({ type: 'events' });
    const onOpenStorage      = () => setActivePanel({ type: 'storage' });
    const onOpenCompendium   = () => setActivePanel({ type: 'compendium' });
    const onOpenLab          = () => setActivePanel({ type: 'lab' });
    const onOpenAchievements = () => setActivePanel({ type: 'achievements' });
    const onOpenSeasonPass   = () => setActivePanel({ type: 'seasonPass' });
    const onOpenMultiplayer  = () => setActivePanel({ type: 'multiplayer' });
    const onOpenPvpArena     = () => setActivePanel({ type: 'pvp' });
    const onOpenTeamSelect = (d: BattlePayload) => setActivePanel({ type: 'teamSelect', battlePayload: d });
    const onBattleStart    = () => setActivePanel({ type: 'battle' });
    const onBattleEnd    = () => setActivePanel(null);
    // Build-overlay (2D placement) lifecycle → toggle the chrome on/off.
    // Both the browse-mode overlay (BAUEN tab) and per-building placement hide
    // the floating HUD/rails; PANEL_CLOSED restores them.
    const onEnterPlacement = () => { setPlacementActive(true); setPlacementReady(false); };
    const onPlacementDone  = () => { setPlacementActive(false); setPlacementReady(false); };
    const onPlacementValidity = (d: { ready: boolean }) => setPlacementReady(!!d.ready);

    EventBus.on(GameEvents.OPEN_BUILD_OVERLAY,   onEnterPlacement);
    EventBus.on(GameEvents.ENTER_PLACEMENT_MODE, onEnterPlacement);
    EventBus.on(GameEvents.ENTER_MOVE_MODE,      onEnterPlacement);
    EventBus.on(GameEvents.PLACEMENT_VALIDITY,   onPlacementValidity);
    EventBus.on(GameEvents.PANEL_CLOSED,         onPlacementDone);
    EventBus.on(GameEvents.OPEN_HABITAT_PANEL, onOpenHabitat);
    EventBus.on(GameEvents.OPEN_FARM_PANEL,    onOpenFarm);
    EventBus.on(GameEvents.OPEN_BUILD_MENU, onOpenBuild);
    EventBus.on(GameEvents.OPEN_BREEDING_PANEL, onOpenBreeding);
    EventBus.on(GameEvents.OPEN_HATCHERY_PANEL, onOpenHatchery);
    EventBus.on(GameEvents.OPEN_HATCH_CONFIRM, onHatchConfirm);
    EventBus.on(GameEvents.OPEN_ASSIGN_HABITAT, onAssignHabitat);
    EventBus.on(GameEvents.OPEN_MONSTER_DETAIL, onMonsterDetail);
    EventBus.on(GameEvents.OPEN_POKEDEX, onOpenPokedex);
    EventBus.on(GameEvents.OPEN_SHOP, onOpenShop);
    EventBus.on(GameEvents.OPEN_ISLANDS_PANEL, onOpenIslands);
    EventBus.on(GameEvents.OPEN_LEVEL_REWARDS, onOpenLevelRewards);
    EventBus.on(GameEvents.OPEN_QUESTS,        onOpenQuests);
    EventBus.on(GameEvents.OPEN_EVENTS,        onOpenEvents);
    EventBus.on(GameEvents.OPEN_STORAGE,       onOpenStorage);
    EventBus.on(GameEvents.OPEN_COMPENDIUM,    onOpenCompendium);
    EventBus.on(GameEvents.OPEN_LAB,           onOpenLab);
    EventBus.on(GameEvents.OPEN_ACHIEVEMENTS,  onOpenAchievements);
    EventBus.on(GameEvents.OPEN_SEASON_PASS,   onOpenSeasonPass);
    EventBus.on(GameEvents.OPEN_MULTIPLAYER,   onOpenMultiplayer);
    EventBus.on(GameEvents.OPEN_PVP_ARENA,     onOpenPvpArena);
    EventBus.on(GameEvents.OPEN_TEAM_SELECT,   onOpenTeamSelect);
    EventBus.on(GameEvents.BATTLE_STARTED,     onBattleStart);
    EventBus.on(GameEvents.BATTLE_ENDED,       onBattleEnd);

    return () => {
      EventBus.off(GameEvents.OPEN_BUILD_OVERLAY,   onEnterPlacement);
      EventBus.off(GameEvents.ENTER_PLACEMENT_MODE, onEnterPlacement);
      EventBus.off(GameEvents.ENTER_MOVE_MODE,      onEnterPlacement);
      EventBus.off(GameEvents.PLACEMENT_VALIDITY,   onPlacementValidity);
      EventBus.off(GameEvents.PANEL_CLOSED,         onPlacementDone);
      EventBus.off(GameEvents.OPEN_HABITAT_PANEL, onOpenHabitat);
      EventBus.off(GameEvents.OPEN_FARM_PANEL,    onOpenFarm);
      EventBus.off(GameEvents.OPEN_BUILD_MENU, onOpenBuild);
      EventBus.off(GameEvents.OPEN_BREEDING_PANEL, onOpenBreeding);
      EventBus.off(GameEvents.OPEN_HATCHERY_PANEL, onOpenHatchery);
      EventBus.off(GameEvents.OPEN_HATCH_CONFIRM, onHatchConfirm);
      EventBus.off(GameEvents.OPEN_ASSIGN_HABITAT, onAssignHabitat);
      EventBus.off(GameEvents.OPEN_MONSTER_DETAIL, onMonsterDetail);
      EventBus.off(GameEvents.OPEN_POKEDEX, onOpenPokedex);
      EventBus.off(GameEvents.OPEN_SHOP, onOpenShop);
      EventBus.off(GameEvents.OPEN_ISLANDS_PANEL, onOpenIslands);
      EventBus.off(GameEvents.OPEN_LEVEL_REWARDS, onOpenLevelRewards);
      EventBus.off(GameEvents.OPEN_QUESTS,        onOpenQuests);
      EventBus.off(GameEvents.OPEN_EVENTS,        onOpenEvents);
      EventBus.off(GameEvents.OPEN_STORAGE,       onOpenStorage);
      EventBus.off(GameEvents.OPEN_COMPENDIUM,    onOpenCompendium);
      EventBus.off(GameEvents.OPEN_LAB,           onOpenLab);
      EventBus.off(GameEvents.OPEN_ACHIEVEMENTS,  onOpenAchievements);
      EventBus.off(GameEvents.OPEN_SEASON_PASS,   onOpenSeasonPass);
      EventBus.off(GameEvents.OPEN_MULTIPLAYER,   onOpenMultiplayer);
      EventBus.off(GameEvents.OPEN_PVP_ARENA,     onOpenPvpArena);
      EventBus.off(GameEvents.OPEN_TEAM_SELECT,   onOpenTeamSelect);
      EventBus.off(GameEvents.BATTLE_STARTED,     onBattleStart);
      EventBus.off(GameEvents.BATTLE_ENDED,       onBattleEnd);
    };
  }, []);

  const closePanel = () => {
    setActivePanel(null);
    EventBus.emit(GameEvents.PANEL_CLOSED, {});
  };

  // Real 3D overworld (Three.js) is the default. It renders above the Phaser
  // canvas and routes clicks through the same EventBus events; Phaser is kept
  // underneath for battles. Set ?world3d=0 to fall back to the 2D Phaser island.
  const world3dEnabled = typeof location === 'undefined' || new URLSearchParams(location.search).get('world3d') !== '0';

  const isBattleActive = activePanel?.type === 'battle';
  const hasPanelOpen   = activePanel !== null && !isBattleActive;
  // Hide the floating chrome during battle AND during 2D build placement.
  const hideChrome     = isBattleActive || placementActive;

  return (
    <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, left: 0, overflow: 'hidden' }}>
      <PhaserGame ref={phaserRef} />

      {/* Real 3D overworld (opt-in via ?world3d=1). Sits above Phaser and hides
          while a battle is active so the Phaser battle screen shows through. */}
      {world3dEnabled && <World3D hidden={isBattleActive} />}

      {/* Backdrop: dims Phaser (and the floating rails) when a panel is open,
          and closes the panel when the empty area is tapped. */}
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

      {/* Build-mode exit button — the 2D placement overlay lives entirely in
          Phaser and was previously only cancelable via the ESC key, which phones
          don't have. This floating touch button emits PANEL_CLOSED, which the
          Island scene listens for to leave placement mode (and which restores the
          chrome here). Shown only while the build overlay is up. */}
      {placementActive && !isBattleActive && (
        <button
          onClick={() => EventBus.emit(GameEvents.PANEL_CLOSED, {})}
          title="Baumodus verlassen"
          style={{
            position: 'absolute', zIndex: 5000,
            top: 'calc(10px + env(safe-area-inset-top, 0px))',
            right: 'calc(10px + env(safe-area-inset-right, 0px))',
            minWidth: 44, height: 44, padding: '0 14px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            background: 'linear-gradient(160deg, #ff6b5a, #c41f1f)',
            border: '2px solid #ffb070', borderRadius: 14,
            color: '#fff', fontWeight: 900, fontSize: 15, cursor: 'pointer',
            touchAction: 'manipulation', pointerEvents: 'auto',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.3)',
          }}
        >✕ Fertig</button>
      )}

      {/* Confirm Placement — commits the building at the ghost's current tile.
          Position the building by tapping/dragging on the (now top-down) island,
          then tap here to build. Disabled until the ghost sits on a free spot. */}
      {placementActive && !isBattleActive && (
        <button
          onClick={() => placementReady && EventBus.emit(GameEvents.CONFIRM_PLACEMENT, {})}
          disabled={!placementReady}
          title={placementReady ? 'Platzierung bestätigen' : 'Wähle erst ein freies Feld'}
          style={{
            position: 'absolute', zIndex: 5000,
            bottom: 'calc(18px + env(safe-area-inset-bottom, 0px))',
            left: '50%', transform: 'translateX(-50%)',
            minWidth: 220, height: 52, padding: '0 22px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            background: placementReady
              ? 'linear-gradient(160deg, #7ad04a, #3f8a1f)'
              : 'linear-gradient(160deg, #6a6a6a, #3a3a3a)',
            border: `2px solid ${placementReady ? '#bfff90' : '#888'}`,
            borderRadius: 16,
            color: '#fff', fontWeight: 900, fontSize: 16,
            cursor: placementReady ? 'pointer' : 'not-allowed',
            opacity: placementReady ? 1 : 0.7,
            touchAction: 'manipulation', pointerEvents: 'auto',
            boxShadow: '0 4px 14px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.3)',
          }}
        >✅ Platzierung bestätigen</button>
      )}

      {/* Floating top HUD + side action rails — hidden during battle (so only
          the fight screen shows) and during 2D build placement (clean build tab). */}
      {!hideChrome && (
        <>
          <HUD />
          <SideRail />
          <ActionRail
            onAttack={() => setActivePanel({ type: 'battleSelect' })}
            onPokedex={() => setActivePanel({ type: 'pokedex' })}
            onShop={() => setActivePanel({ type: 'shop' })}
            onBreed={() => setActivePanel({ type: 'breeding' })}
            onHatch={() => setActivePanel({ type: 'hatchery' })}
          />
        </>
      )}

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
        {activePanel?.type === 'assignHabitat' && (
          <AssignHabitatPanel eggId={activePanel.eggId} onClose={closePanel} />
        )}
        {activePanel?.type === 'monsterDetail' && (
          <MonsterInstanceDetail instanceId={activePanel.instanceId} onClose={closePanel} />
        )}
        {activePanel?.type === 'pokedex' && (
          <Pokedex onClose={closePanel} />
        )}
        {activePanel?.type === 'battleSelect' && (
          <BattleSelectScreen
            onClose={closePanel}
            onStory={() => setActivePanel({ type: 'story' })}
          />
        )}
        {activePanel?.type === 'story' && (
          <StoryMap onClose={closePanel} />
        )}
        {activePanel?.type === 'shop' && (
          <ShopPanel onClose={closePanel} onStartPlacement={() => setActivePanel(null)} />
        )}
        {activePanel?.type === 'islands' && (
          <IslandsPanel onClose={closePanel} />
        )}
        {activePanel?.type === 'levelRewards' && (
          <LevelRewardPanel onClose={closePanel} />
        )}
        {activePanel?.type === 'quests' && (
          <QuestPanel onClose={closePanel} />
        )}
        {activePanel?.type === 'events' && (
          <EventsPanel onClose={closePanel} />
        )}
        {activePanel?.type === 'storage' && (
          <StoragePanel onClose={closePanel} />
        )}
        {activePanel?.type === 'compendium' && (
          <CompendiumPanel onClose={closePanel} />
        )}
        {activePanel?.type === 'lab' && (
          <LabPanel onClose={closePanel} />
        )}
        {activePanel?.type === 'achievements' && (
          <AchievementsPanel onClose={closePanel} />
        )}
        {activePanel?.type === 'seasonPass' && (
          <SeasonPassPanel onClose={closePanel} />
        )}
        {activePanel?.type === 'multiplayer' && (
          <MultiplayerPanel onClose={closePanel} />
        )}
        {activePanel?.type === 'pvp' && (
          <PvpArenaPanel onClose={closePanel} />
        )}
        {activePanel?.type === 'teamSelect' && (
          <TeamSelectPanel battlePayload={activePanel.battlePayload} onClose={closePanel} />
        )}
        {isBattleActive && <BattleHUD />}
      </div>

      {/* First-run onboarding flow */}
      {showTutorial && <TutorialOverlay onClose={() => setTutorialDismissed(true)} />}
    </div>
  );
}
