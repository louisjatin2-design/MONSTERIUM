import React from 'react';
import { useGameStore } from '@store/gameStore';
import { BUILDING_DEFS } from '@data/buildings';
import '../styles/global.css';

interface FarmPanelProps {
  instanceId: string;
  onClose: () => void;
}

export function FarmPanel({ instanceId, onClose }: FarmPanelProps) {
  const building    = useGameStore(s => s.buildings[instanceId]);
  const collectGold = useGameStore(s => s.collectGold);

  if (!building) return null;
  const def = BUILDING_DEFS[building.defId];
  const levelData = def.levels[building.level - 1];
  const accumulated = Math.floor(building.goldAccumulated);

  return (
    <div className="panel" style={{ right: 20, top: 70, width: 300, padding: 16 }}>
      <button className="close-btn" onClick={onClose}>✕</button>
      <div className="panel-title">🌾 {def.name}</div>
      <div style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>
        Level {building.level} · {levelData?.foodPerHour ?? 0} 🌾/hour
      </div>

      {building.constructionEndMs ? (
        <div style={{ color: '#ffaa00', fontSize: 13 }}>⏳ Under construction...</div>
      ) : accumulated > 0 ? (
        <button className="btn btn-primary" style={{ width: '100%' }}
          onClick={() => collectGold(instanceId)}>
          Collect 🌾 {accumulated}
        </button>
      ) : (
        <div style={{ color: '#666', fontSize: 13, textAlign: 'center', padding: 8 }}>
          Producing food... check back soon!
        </div>
      )}
    </div>
  );
}
