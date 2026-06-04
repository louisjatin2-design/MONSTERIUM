import React, { useState } from 'react';
import { useGameStore } from '@store/gameStore';
import { BUILDING_DEFS, BUILDABLE_BUILDING_IDS } from '@data/buildings';
import { EventBus, GameEvents } from '@game/EventBus';
import { HelpButton } from './HelpButton';
import '../styles/global.css';

interface BuildMenuProps {
  // Optional: set when the menu is opened by tapping a specific land tile.
  // When opened from the BAUEN tab there is no pre-selected tile — the player
  // picks the spot in the 2D placement overlay instead.
  tileX?: number;
  tileY?: number;
  onClose: () => void;
  // Closes the menu WITHOUT emitting PANEL_CLOSED, so entering placement mode
  // isn't immediately cancelled by the panel-closed handler.
  onStartPlacement: () => void;
}

const CATEGORY_ICONS: Record<string, string> = {
  Habitat: '🏠',
  Temple: '⛩️',
  Farm: '🌾',
  BreedingStation: '🧬',
  Hatchery: '🥚',
};

export function BuildMenu({ tileX, tileY, onClose, onStartPlacement }: BuildMenuProps) {
  const gold = useGameStore(s => s.gold);
  const playerLevel = useGameStore(s => s.playerLevel);
  const [filter, setFilter] = useState<string>('All');

  const categories = ['All', 'Habitat', 'Temple', 'Farm'];
  const filtered = BUILDABLE_BUILDING_IDS.filter(id => {
    const def = BUILDING_DEFS[id];
    return filter === 'All' || def.category === filter;
  });

  const handleBuild = (defId: string) => {
    const def = BUILDING_DEFS[defId];
    if (gold < def.goldCost) return;
    if (def.unlockLevel && playerLevel < def.unlockLevel) return;
    EventBus.emit(GameEvents.ENTER_PLACEMENT_MODE, { defId });
    onStartPlacement();
  };

  return (
    <div className="panel panel-side panel-side-narrow" style={{ padding: 16 }}>
      <button className="close-btn" onClick={onClose}>✕</button>
      <HelpButton
        title="Baumenü"
        tips={[
          'Wähle ein Gebäude — die Ansicht wechselt in die Vogelperspektive und die Insel-Drehung wird pausiert.',
          'Tippe bzw. ziehe auf ein freies Feld, um das Gebäude zu positionieren, und bestätige unten mit „Platzierung bestätigen".',
          'Lebensräume beherbergen Monster und werfen Gold ab, Farmen produzieren Futter, Tempel heben das Levellimit.',
          'Ausgegraute Einträge kannst du dir noch nicht leisten oder sie sind erst ab einem höheren Spieler-Level 🔒 verfügbar.',
          'Größere Lebensräume (Elite, Mythic, Transcendental) sind riesig, fassen aber nur ein einziges Monster.',
        ]}
      />
      <div className="panel-title">🏗️ Build Menu</div>
      <div style={{ fontSize: 12, color: '#aaa', marginBottom: 12 }}>
        {tileX != null && tileY != null && <>Tile ({tileX}, {tileY}) — </>}
        Gold: <span className="gold-text">{gold}</span>
      </div>

      {/* Category filter */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {categories.map(c => (
          <button key={c} className="btn btn-info"
            onClick={() => setFilter(c)}
            style={{ opacity: filter === c ? 1 : 0.5, padding: '4px 10px', fontSize: 12 }}>
            {c}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map(id => {
          const def = BUILDING_DEFS[id];
          const locked = !!def.unlockLevel && playerLevel < def.unlockLevel;
          const canAfford = gold >= def.goldCost;
          const buildable = canAfford && !locked;
          return (
            <div key={id} className="monster-card"
              onClick={() => buildable && handleBuild(id)}
              style={{ opacity: buildable ? 1 : 0.5, cursor: buildable ? 'pointer' : 'not-allowed' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 'bold' }}>
                  {locked && '🔒 '}{CATEGORY_ICONS[def.category]} {def.name}
                </span>
                <span className="gold-text">🪙 {def.goldCost}</span>
              </div>
              <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>{def.description}</div>
              <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
                Size: {def.tilesW}×{def.tilesH} tiles
                {def.buildTimeSec > 0 && ` · Build: ${def.buildTimeSec}s`}
                {def.linkedElement && ` · Element: ${def.linkedElement}`}
              </div>
              {locked && (
                <div style={{ fontSize: 11, color: '#ff9955', marginTop: 4, fontWeight: 700 }}>
                  🔒 Erst ab Spieler-Level {def.unlockLevel} (du bist Level {playerLevel})
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
