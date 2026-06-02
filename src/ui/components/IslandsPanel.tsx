import React from 'react';
import { useGameStore } from '@store/gameStore';
import { ISLAND_DEFS } from '@data/islands';
import { EventBus, GameEvents } from '@game/EventBus';
import { HelpButton } from './HelpButton';
import '../styles/global.css';

interface IslandsPanelProps { onClose: () => void; }

export function IslandsPanel({ onClose }: IslandsPanelProps) {
  const unlocked      = useGameStore(s => s.unlockedIslands);
  const currentId     = useGameStore(s => s.currentIslandId);
  const gold          = useGameStore(s => s.gold);
  const purchaseIsland = useGameStore(s => s.purchaseIsland);
  const setCurrentIsland = useGameStore(s => s.setCurrentIsland);

  const islands = Object.values(ISLAND_DEFS);

  const handleSwitch = (id: string) => {
    if (id === currentId) return;
    setCurrentIsland(id);
    EventBus.emit(GameEvents.ISLAND_CHANGED, { islandId: id });
    onClose();
  };

  const handleBuy = (id: string, cost: number) => {
    if (gold < cost) return;
    if (confirm(`Insel für 🪙 ${cost} Gold freischalten?`)) {
      if (purchaseIsland(id)) handleSwitch(id);
    }
  };

  return (
    <div className="panel panel-modal panel-w-md" style={{ padding: 20, display: 'flex', flexDirection: 'column' }}>
      <button className="close-btn" onClick={onClose}>✕</button>
      <HelpButton
        title="Inseln"
        tips={[
          'Alle freigeschalteten Inseln liegen jetzt zusammen auf einer großen Karte — du musst nicht mehr wechseln, sondern scrollst einfach hin und her.',
          '„Besuchen" schwenkt die Kamera zu einer Insel; bauen kannst du direkt auf jeder Insel, indem du dort ein freies Feld antippst.',
          'Neue Inseln schaltest du mit Gold frei und gewinnst so mehr Baufläche.',
        ]}
      />
      <div className="panel-title">🏝️ Inseln</div>
      <div style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>
        Gold: <span className="gold-text">🪙 {gold}</span>
      </div>

      <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
        {islands.map(island => {
          const isUnlocked = unlocked.includes(island.id);
          const isCurrent = island.id === currentId;
          const cost = island.goldCost ?? 0;
          return (
            <div key={island.id} className="monster-card" style={{
              marginBottom: 10,
              borderColor: isCurrent ? 'rgba(255,215,0,0.5)' : undefined,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontWeight: 'bold', fontSize: 15 }}>
                    {isUnlocked ? '🏝️' : '🔒'} {island.name}
                  </span>
                  {island.buffElement && (
                    <span style={{ fontSize: 11, color: '#ffd700', marginLeft: 8 }}>
                      +{island.buffElement}-Bonus
                    </span>
                  )}
                </div>
                {isCurrent ? (
                  <span style={{ color: '#66ff88', fontWeight: 'bold', fontSize: 12 }}>● Aktiv</span>
                ) : isUnlocked ? (
                  <button className="btn btn-primary" style={{ padding: '4px 12px', fontSize: 12 }}
                    onClick={() => handleSwitch(island.id)}>
                    Besuchen
                  </button>
                ) : (
                  <button className="btn btn-gold" style={{ padding: '4px 12px', fontSize: 12 }}
                    disabled={gold < cost}
                    onClick={() => handleBuy(island.id, cost)}>
                    🪙 {cost} freischalten
                  </button>
                )}
              </div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 6 }}>{island.theme}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
