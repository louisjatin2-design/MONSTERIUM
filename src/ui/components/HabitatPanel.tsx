import React, { useState } from 'react';
import { useGameStore } from '@store/gameStore';
import { BUILDING_DEFS } from '@data/buildings';
import { MONSTER_DEFS } from '@data/monsters';
import { RARITY_COLORS } from '@data/rarities';
import { ELEMENT_CSS_COLORS } from '@data/elements';
import { RARITY_RANK } from '@data/rarities';
import { calculateFeedCost, calculateSellValue } from '@systems/EconomySystem';
import '../styles/global.css';

interface HabitatPanelProps {
  instanceId: string;
  onClose: () => void;
}

export function HabitatPanel({ instanceId, onClose }: HabitatPanelProps) {
  const building        = useGameStore(s => s.buildings[instanceId]);
  const allMonsters     = useGameStore(s => s.monsters);
  const food            = useGameStore(s => s.food);
  const collectGold     = useGameStore(s => s.collectGold);
  const feedMonster     = useGameStore(s => s.feedMonster);
  const sellMonster     = useGameStore(s => s.sellMonster);
  const assignToHabitat = useGameStore(s => s.assignToHabitat);
  const removeFromHabitat = useGameStore(s => s.removeFromHabitat);
  const gold            = useGameStore(s => s.gold);
  const upgradeBuilding = useGameStore(s => s.upgradeBuilding);
  const monsters = building?.monsterIds.map(id => allMonsters[id]).filter(Boolean) ?? [];

  if (!building) return null;
  const def = BUILDING_DEFS[building.defId];
  const levelData = def.levels[building.level - 1];
  const nextLevel = def.levels[building.level];

  // Monsters not yet assigned to this habitat that could fit
  const unassigned = Object.values(allMonsters).filter(m => {
    if (m.habitatId) return false;
    const mDef = MONSTER_DEFS[m.defId];
    if (!mDef) return false;
    if (def.linkedElement) return mDef.elements.includes(def.linkedElement);
    return true; // legendary habitat accepts all
  });

  return (
    <div className="panel" style={{ right: 20, top: 68, width: 380, maxHeight: 'calc(100vh - 162px)', padding: 16 }}>
      <button className="close-btn" onClick={onClose}>✕</button>
      <div className="panel-title">🏠 {def.name}</div>
      <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>
        Level {building.level} · {monsters.length}/{levelData?.monsterCapacity ?? 3} monsters
      </div>

      {/* Gold collection */}
      {building.goldAccumulated > 0 && (
        <button className="btn btn-gold" style={{ width: '100%', marginBottom: 10 }}
          onClick={() => collectGold(instanceId)}>
          Collect 🪙 {Math.floor(building.goldAccumulated)}
        </button>
      )}
      {building.constructionEndMs && (
        <div style={{ color: '#ffaa00', marginBottom: 8, fontSize: 13 }}>
          ⏳ Under construction...
        </div>
      )}

      {/* Upgrade */}
      {!building.constructionEndMs && (
        <div style={{ marginBottom: 10 }}>
          {building.upgradeEndMs ? (
            <div style={{ color: '#ffaa00', fontSize: 13 }}>⏳ Ausbau läuft…</div>
          ) : nextLevel ? (
            <button className="btn btn-gold" style={{ width: '100%', fontSize: 12 }}
              disabled={gold < nextLevel.upgradeCost}
              onClick={() => upgradeBuilding(instanceId)}>
              ⬆️ Auf Level {building.level + 1} (🪙 {nextLevel.upgradeCost}) · Platz {nextLevel.monsterCapacity ?? '?'}
            </button>
          ) : (
            <div style={{ color: '#66ff88', fontSize: 12, textAlign: 'center' }}>Max-Level erreicht</div>
          )}
        </div>
      )}

      {/* Resident monsters */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 6 }}>Residents:</div>
        {monsters.length === 0 && <div style={{ color: '#666', fontSize: 12 }}>No monsters yet</div>}
        {monsters.map(m => {
          const mDef = MONSTER_DEFS[m.defId];
          if (!mDef) return null;
          const feedCost = calculateFeedCost(m.level);
          const canFeed = food >= feedCost;
          const sellValue = calculateSellValue(RARITY_RANK[mDef.rarity], m.level);
          return (
            <div key={m.instanceId} className="monster-card" style={{ marginBottom: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 'bold' }}>
                  {m.name}
                  <span className="rarity-badge" style={{ background: RARITY_COLORS[mDef.rarity], color: '#000' }}>
                    {mDef.rarity}
                  </span>
                </span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="btn btn-gold" style={{ padding: '2px 8px', fontSize: 11 }}
                    title={`Verkaufen für ${sellValue} Gold`}
                    onClick={() => {
                      if (confirm(`${m.name} (Lv ${m.level}) für 🪙 ${sellValue} Gold verkaufen?`)) {
                        sellMonster(m.instanceId);
                      }
                    }}>
                    Verkaufen 🪙{sellValue}
                  </button>
                  <button className="btn btn-danger" style={{ padding: '2px 8px', fontSize: 11 }}
                    onClick={() => removeFromHabitat(m.instanceId)}>
                    Entfernen
                  </button>
                </div>
              </div>
              <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                Lv {m.level} · {m.stage} · {mDef.elements.join('/')}
              </div>
              {(() => {
                const need = Math.floor(100 * Math.pow(m.level, 1.5));
                const perFeed = Math.ceil(need / 4);
                const feedsDone = Math.min(4, Math.round(m.xp / perFeed));
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                    <div style={{ flex: 1, display: 'flex', gap: 3 }}>
                      {/* 4 feed-cycle steps to the next level */}
                      {[0, 1, 2, 3].map(i => (
                        <div key={i} style={{
                          flex: 1, height: 8, borderRadius: 3,
                          background: i < feedsDone ? '#4488ff' : '#333',
                        }} />
                      ))}
                    </div>
                    <span style={{ fontSize: 10, color: '#888' }}>{feedsDone}/4</span>
                    <button className="btn btn-primary" style={{ padding: '2px 8px', fontSize: 11 }}
                      disabled={!canFeed || m.level >= 100}
                      onClick={() => feedMonster(m.instanceId, feedCost)}>
                      Füttern (🌾 {feedCost})
                    </button>
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>

      {/* Add monster */}
      {unassigned.length > 0 && monsters.length < (levelData?.monsterCapacity ?? 3) && (
        <div>
          <div style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 6 }}>Add a Monster:</div>
          <div style={{ maxHeight: 160, overflowY: 'auto' }}>
            {unassigned.map(m => {
              const mDef = MONSTER_DEFS[m.defId];
              return (
                <div key={m.instanceId} className="monster-card" style={{ marginBottom: 4 }}
                  onClick={() => assignToHabitat(m.instanceId, instanceId)}>
                  <span style={{ fontWeight: 'bold', fontSize: 13 }}>{m.name}</span>
                  <span style={{ fontSize: 11, color: '#888', marginLeft: 6 }}>
                    Lv {m.level} — {mDef?.elements.join('/')}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
