import React, { useState } from 'react';
import { useGameStore } from '@store/gameStore';
import { BUILDING_DEFS } from '@data/buildings';
import { MONSTER_DEFS } from '@data/monsters';
import { RARITY_COLORS } from '@data/rarities';
import { ELEMENT_CSS_COLORS } from '@data/elements';
import { calculateFeedCost } from '@systems/EconomySystem';
import '../styles/global.css';

interface HabitatPanelProps {
  instanceId: string;
  onClose: () => void;
}

export function HabitatPanel({ instanceId, onClose }: HabitatPanelProps) {
  const { building, monsters, food, allMonsters } = useGameStore(s => ({
    building: s.buildings[instanceId],
    monsters: s.buildings[instanceId]?.monsterIds.map(id => s.monsters[id]).filter(Boolean) ?? [],
    food: s.food,
    allMonsters: s.monsters,
  }));
  const collectGold = useGameStore(s => s.collectGold);
  const feedMonster = useGameStore(s => s.feedMonster);
  const assignToHabitat = useGameStore(s => s.assignToHabitat);
  const removeFromHabitat = useGameStore(s => s.removeFromHabitat);

  if (!building) return null;
  const def = BUILDING_DEFS[building.defId];
  const levelData = def.levels[building.level - 1];

  // Monsters not yet assigned to this habitat that could fit
  const unassigned = Object.values(allMonsters).filter(m => {
    if (m.habitatId) return false;
    const mDef = MONSTER_DEFS[m.defId];
    if (!mDef) return false;
    if (def.linkedElement) return mDef.elements.includes(def.linkedElement);
    return true; // legendary habitat accepts all
  });

  return (
    <div className="panel" style={{ right: 20, top: 70, width: 380, maxHeight: 'calc(100vh - 100px)', padding: 16 }}>
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

      {/* Resident monsters */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 6 }}>Residents:</div>
        {monsters.length === 0 && <div style={{ color: '#666', fontSize: 12 }}>No monsters yet</div>}
        {monsters.map(m => {
          const mDef = MONSTER_DEFS[m.defId];
          if (!mDef) return null;
          const feedCost = calculateFeedCost(m.level);
          const canFeed = food >= feedCost;
          return (
            <div key={m.instanceId} className="monster-card" style={{ marginBottom: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 'bold' }}>
                  {m.name}
                  <span className="rarity-badge" style={{ background: RARITY_COLORS[mDef.rarity], color: '#000' }}>
                    {mDef.rarity}
                  </span>
                </span>
                <button className="btn btn-danger" style={{ padding: '2px 8px', fontSize: 11 }}
                  onClick={() => removeFromHabitat(m.instanceId)}>
                  Remove
                </button>
              </div>
              <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                Lv {m.level} · {m.stage} · {mDef.elements.join('/')}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                <div style={{ flex: 1, height: 6, background: '#333', borderRadius: 3 }}>
                  <div style={{
                    width: `${(m.xp / Math.floor(100 * Math.pow(m.level, 1.5))) * 100}%`,
                    height: '100%', background: '#4488ff', borderRadius: 3,
                  }} />
                </div>
                <button className="btn btn-primary" style={{ padding: '2px 8px', fontSize: 11 }}
                  disabled={!canFeed}
                  onClick={() => feedMonster(m.instanceId, feedCost)}>
                  Feed (🌾 {feedCost})
                </button>
              </div>
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
