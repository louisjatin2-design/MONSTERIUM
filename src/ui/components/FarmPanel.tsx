import React from 'react';
import { useGameStore } from '@store/gameStore';
import { BUILDING_DEFS } from '@data/buildings';
import { EventBus, GameEvents } from '@game/EventBus';
import { HelpButton } from './HelpButton';
import '../styles/global.css';

interface FarmPanelProps {
  instanceId: string;
  onClose: () => void;
}

const CONVERT_OPTIONS = [50, 250, 1000];

export function FarmPanel({ instanceId, onClose }: FarmPanelProps) {
  const building    = useGameStore(s => s.buildings[instanceId]);
  const buildings   = useGameStore(s => s.buildings);
  const gold        = useGameStore(s => s.gold);
  const diamonds    = useGameStore(s => s.diamonds);
  const collectGold = useGameStore(s => s.collectGold);
  const collectAll  = useGameStore(s => s.collectAll);
  const upgradeBuilding   = useGameStore(s => s.upgradeBuilding);
  const skipConstruction  = useGameStore(s => s.skipConstruction);
  const skipUpgrade       = useGameStore(s => s.skipUpgrade);
  const demolishBuilding  = useGameStore(s => s.demolishBuilding);
  const convertGoldToFood = useGameStore(s => s.convertGoldToFood);

  if (!building) return null;
  const def = BUILDING_DEFS[building.defId];
  const levelData = def.levels[building.level - 1];
  const nextLevel = def.levels[building.level];
  const accumulated = Math.floor(building.goldAccumulated);
  const refund = Math.floor(def.goldCost * 0.5);
  const gemSkipCost = (endMs: number) => Math.max(1, Math.ceil((endMs - Date.now()) / 3600000));

  const handleMove = () => {
    onClose();
    EventBus.emit(GameEvents.ENTER_MOVE_MODE, { instanceId });
  };
  const handleDemolish = () => {
    if (confirm(`${def.name} abbauen? Du erhältst 🪙 ${refund} zurück.`)) {
      demolishBuilding(instanceId);
      onClose();
    }
  };

  // Total food waiting across every farm (for the collect-all button).
  const totalFarmFood = Math.floor(
    Object.values(buildings)
      .filter(b => BUILDING_DEFS[b.defId]?.category === 'Farm')
      .reduce((sum, b) => sum + b.goldAccumulated, 0),
  );

  return (
    <div className="panel panel-side panel-side-xs" style={{ padding: 16 }}>
      <button className="close-btn" onClick={onClose}>✕</button>
      <HelpButton
        title="Farm"
        tips={[
          'Farmen produzieren mit der Zeit Futter — tippe „Ernten", um das gesammelte Futter abzuholen.',
          'Mit den Umwandeln-Knöpfen tauschst du Gold direkt gegen Futter, wenn es mal knapp wird.',
          'Höhere Farm-Level steigern die Futterproduktion deutlich.',
          'Futter brauchst du, um Monster zu füttern und so hochzuleveln.',
        ]}
      />
      <div className="panel-title">🌾 {def.name}</div>
      <div style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>
        Level {building.level} · {levelData?.foodPerHour ?? 0} 🌾/Std.
      </div>

      {/* Collect */}
      {building.constructionEndMs ? (
        <div style={{ marginBottom: 10 }}>
          <div style={{ color: '#ffaa00', fontSize: 13, marginBottom: 6 }}>⏳ Im Bau…</div>
          <button className="btn btn-info" style={{ width: '100%', fontSize: 12 }}
            disabled={diamonds < gemSkipCost(building.constructionEndMs)}
            onClick={() => skipConstruction(instanceId)}>
            💎 {gemSkipCost(building.constructionEndMs)} · Bau überspringen
          </button>
        </div>
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

      {/* Collect-all across every farm */}
      {totalFarmFood > 0 && (
        <button className="btn btn-info" style={{ width: '100%', marginBottom: 10, fontSize: 12 }}
          onClick={() => collectAll('Farm')}>
          🌾 Alle Farmen einsammeln (+{totalFarmFood})
        </button>
      )}

      {/* Upgrade */}
      <div style={{ marginBottom: 12 }}>
        {building.upgradeEndMs ? (
          <div>
            <div style={{ color: '#ffaa00', fontSize: 13, marginBottom: 6 }}>⏳ Ausbau läuft…</div>
            <button className="btn btn-info" style={{ width: '100%', fontSize: 12 }}
              disabled={diamonds < gemSkipCost(building.upgradeEndMs)}
              onClick={() => skipUpgrade(instanceId)}>
              💎 {gemSkipCost(building.upgradeEndMs)} · Ausbau überspringen
            </button>
          </div>
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

      {/* Move / demolish */}
      <div style={{ display: 'flex', gap: 6, marginTop: 12, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 10 }}>
        <button className="btn btn-info" style={{ flex: 1, fontSize: 12 }} onClick={handleMove}>
          ↔️ Verschieben
        </button>
        <button className="btn btn-danger" style={{ flex: 1, fontSize: 12 }} onClick={handleDemolish}>
          🧨 Abbauen (+🪙{refund})
        </button>
      </div>
    </div>
  );
}
