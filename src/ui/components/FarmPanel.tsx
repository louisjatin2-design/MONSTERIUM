import React from 'react';
import { useGameStore } from '@store/gameStore';
import { BUILDING_DEFS } from '@data/buildings';
import '../styles/global.css';

interface FarmPanelProps {
  instanceId: string;
  onClose: () => void;
}

const CONVERT_OPTIONS = [50, 250, 1000];

export function FarmPanel({ instanceId, onClose }: FarmPanelProps) {
  const building    = useGameStore(s => s.buildings[instanceId]);
  const gold        = useGameStore(s => s.gold);
  const collectGold = useGameStore(s => s.collectGold);
  const upgradeBuilding   = useGameStore(s => s.upgradeBuilding);
  const convertGoldToFood = useGameStore(s => s.convertGoldToFood);

  if (!building) return null;
  const def = BUILDING_DEFS[building.defId];
  const levelData = def.levels[building.level - 1];
  const nextLevel = def.levels[building.level];
  const accumulated = Math.floor(building.goldAccumulated);

  return (
    <div className="panel panel-side panel-side-xs" style={{ padding: 16 }}>
      <button className="close-btn" onClick={onClose}>✕</button>
      <div className="panel-title">🌾 {def.name}</div>
      <div style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>
        Level {building.level} · {levelData?.foodPerHour ?? 0} 🌾/Std.
      </div>

      {/* Collect */}
      {building.constructionEndMs ? (
        <div style={{ color: '#ffaa00', fontSize: 13, marginBottom: 10 }}>⏳ Im Bau…</div>
      ) : accumulated > 0 ? (
        <button className="btn btn-primary" style={{ width: '100%', marginBottom: 10 }}
          onClick={() => collectGold(instanceId)}>
          Einsammeln 🌾 {accumulated}
        </button>
      ) : (
        <div style={{ color: '#666', fontSize: 13, textAlign: 'center', padding: 8, marginBottom: 10 }}>
          Produziert Futter… schau später vorbei!
        </div>
      )}

      {/* Upgrade */}
      <div style={{ marginBottom: 12 }}>
        {building.upgradeEndMs ? (
          <div style={{ color: '#ffaa00', fontSize: 13 }}>⏳ Ausbau läuft…</div>
        ) : nextLevel ? (
          <button className="btn btn-gold" style={{ width: '100%' }}
            disabled={gold < nextLevel.upgradeCost}
            onClick={() => upgradeBuilding(instanceId)}>
            ⬆️ Auf Level {building.level + 1} ausbauen (🪙 {nextLevel.upgradeCost})
            {' · '}{nextLevel.foodPerHour ?? 0} 🌾/Std.
          </button>
        ) : (
          <div style={{ color: '#66ff88', fontSize: 12, textAlign: 'center' }}>Max-Level erreicht</div>
        )}
      </div>

      {/* Gold → Food conversion (20 : 1) */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 'bold', color: '#ffd700', marginBottom: 6 }}>
          Gold in Futter tauschen
        </div>
        <div style={{ fontSize: 11, color: '#888', marginBottom: 8 }}>Kurs: 20 🪙 = 1 🌾</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {CONVERT_OPTIONS.map(amount => {
            const cost = amount * 20;
            return (
              <button key={amount} className="btn btn-info" style={{ flex: 1, fontSize: 12, padding: '6px 4px' }}
                disabled={gold < cost}
                onClick={() => convertGoldToFood(amount)}>
                +{amount} 🌾<br /><span style={{ fontSize: 10, opacity: 0.85 }}>🪙 {cost}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
