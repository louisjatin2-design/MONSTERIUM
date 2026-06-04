import React from 'react';
import { useGameStore } from '@store/gameStore';
import { EventBus, GameEvents } from '@game/EventBus';
import { QUESTS, isQuestComplete, type QuestProgressSnapshot } from '@data/quests';
import { RailButton } from './RailButton';

interface ActionRailProps {
  onAttack: () => void;
}

// ── Bottom-LEFT action cluster ───────────────────────────────────────────────
// New corner layout (replaces the old vertically-centred 7-button rail):
//
//        [ LAGER ]
//        [ QUESTS ]
//   [ KÄMPFEN ] [ MP ]      ← Kämpfen is the big primary button
//
// Züchten / Brutkammer / Labor were removed from the rail entirely (Labor is now
// a late-game building you place on the island). Quests now also holds Trophäen,
// reached via a tab inside the panel.
export function ActionRail(props: ActionRailProps) {
  // Claimable quests drive the green badge on the Quests button.
  const claimableQuests = useGameStore(s => {
    const snap: QuestProgressSnapshot = {
      playerLevel: s.playerLevel,
      storyProgress: s.storyProgress,
      pokedexSeen: s.pokedexSeen.length,
      monstersOwned: Object.keys(s.monsters).length,
      buildingsBuilt: s.stats.buildingsBuilt,
      feeds: s.stats.feeds,
      breeds: s.stats.breeds,
      hatches: s.stats.hatches,
      collects: s.stats.collects,
      battlesWon: s.stats.battlesWon,
      highestRarityOwned: 0,
    };
    return QUESTS.filter(q => !s.claimedQuests.includes(q.id) && isQuestComplete(q, snap)).length;
  });

  return (
    <div className="corner-cluster corner-cluster--bl">
      <RailButton
        icon="📦" iconName="lager" label="LAGER" size="sm"
        from="#d09a3f" to="#9a6a1f" border="#ffe0a0"
        onClick={() => EventBus.emit(GameEvents.OPEN_STORAGE, {})}
      />
      <RailButton
        icon="📋" iconName="quests" label="QUESTS" size="sm"
        from="#3f8fd0" to="#1f4f96" border="#90b8ff"
        badge={claimableQuests > 0 ? claimableQuests : undefined}
        badgeColor="#44dd66"
        onClick={() => EventBus.emit(GameEvents.OPEN_QUESTS, {})}
      />
      <div className="cluster-row">
        <RailButton
          icon="⚔️" iconName="kaempfen" label="KÄMPFEN" size="lg" primary
          from="#ff5a4a" to="#c41f1f" border="#ffb070"
          onClick={props.onAttack}
        />
        <RailButton
          icon="🌐" iconName="multiplayer" label="MULTI" size="sm"
          from="#3f7fd0" to="#1f3f7a" border="#90b8ff"
          onClick={() => EventBus.emit(GameEvents.OPEN_MULTIPLAYER, {})}
        />
      </div>
    </div>
  );
}
