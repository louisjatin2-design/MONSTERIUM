import React from 'react';
import { EventBus, GameEvents } from '@game/EventBus';
import { RailButton } from './RailButton';

// ── Bottom-RIGHT action cluster ──────────────────────────────────────────────
// New corner layout (mirrors the bottom-left fight cluster):
//
//             [ EVENTS ]
//   [ SEASON ] [ LADEN ]      ← Laden (shop) is the anchor; Season pass sits left
//
// Inseln were folded into the shop (a tab inside LADEN), Kompendium into Monster,
// Trophäen into Quests, and Labor became a buildable late-game building — so the
// old long right rail collapses to just these three corner buttons.
export function SideRail() {
  return (
    <div className="corner-cluster corner-cluster--br">
      <RailButton
        icon="🎪" label="EVENTS" size="sm"
        from="#7a3fd0" to="#4a1f96" border="#c79aff"
        onClick={() => EventBus.emit(GameEvents.OPEN_EVENTS, {})}
      />
      <div className="cluster-row">
        <RailButton
          icon="🎟️" label="PASS" size="sm"
          from="#d03f9a" to="#7a1f5f" border="#ffa0d8"
          onClick={() => EventBus.emit(GameEvents.OPEN_SEASON_PASS, {})}
        />
        <RailButton
          icon="🛒" label="LADEN" size="md"
          from="#e8b04a" to="#b87c1f" border="#ffe090"
          onClick={() => EventBus.emit(GameEvents.OPEN_SHOP, {})}
        />
      </div>
    </div>
  );
}
