import React, { useState } from 'react';
import { useGameStore } from '@store/gameStore';
import { BUILDING_DEFS, BUILDABLE_BUILDING_IDS } from '@data/buildings';
import { EventBus, GameEvents } from '@game/EventBus';
import '../styles/global.css';

interface BuildMenuProps {
  tileX: number;
  tileY: number;
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
  const [filter, setFilter] = useState<string>('All');

  const categories = ['All', 'Habitat', 'Temple', 'Farm'];
  const filtered = BUILDABLE_BUILDING_IDS.filter(id => {
    const def = BUILDING_DEFS[id];
    return filter === 'All' || def.category === filter;
  });

  const handleBuild = (defId: string) => {
    const def = BUILDING_DEFS[defId];
    if (gold < def.goldCost) return;
    EventBus.emit(GameEvents.ENTER_PLACEMENT_MODE, { defId });
    onStartPlacement();
  };

  return (
    <div className="panel" style={{
      right: 20, top: 68, width: 360, maxHeight: 'calc(100vh - 162px)',
      padding: 16,
    }}>
      <button className="close-btn" onClick={onClose}>✕</button>
      <div className="panel-title">🏗️ Build Menu</div>
      <div style={{ fontSize: 12, color: '#aaa', marginBottom: 12 }}>
        Tile ({tileX}, {tileY}) — Gold: <span className="gold-text">{gold}</span>
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
          const canAfford = gold >= def.goldCost;
          return (
            <div key={id} className="monster-card"
              onClick={() => canAfford && handleBuild(id)}
              style={{ opacity: canAfford ? 1 : 0.5 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 'bold' }}>
                  {CATEGORY_ICONS[def.category]} {def.name}
                </span>
                <span className="gold-text">🪙 {def.goldCost}</span>
              </div>
              <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>{def.description}</div>
              <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
                Size: {def.tilesW}×{def.tilesH} tiles
                {def.buildTimeSec > 0 && ` · Build: ${def.buildTimeSec}s`}
                {def.linkedElement && ` · Element: ${def.linkedElement}`}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
