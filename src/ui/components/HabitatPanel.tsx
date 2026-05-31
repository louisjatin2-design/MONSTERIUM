import React, { useState } from 'react';
import { useGameStore } from '@store/gameStore';
import { BUILDING_DEFS } from '@data/buildings';
import { MONSTER_DEFS } from '@data/monsters';
import { ATTACKS } from '@data/attacks';
import { RARITY_COLORS } from '@data/rarities';
import { ELEMENT_CSS_COLORS } from '@data/elements';
import { RARITY_RANK } from '@data/rarities';
import { calculateFeedCost, calculateSellValue } from '@systems/EconomySystem';
import {
  isEvolutionReady, getNextEvolutionStage, getEvolutionStageName,
  EVOLUTION_LEVELS, getTrainableAttacks, getAttackTrainCost,
} from '@systems/ProgressionSystem';
import type { MonsterInstance } from '@gtypes/game';
import { EventBus, GameEvents } from '@game/EventBus';
import '../styles/global.css';

interface HabitatPanelProps {
  instanceId: string;
  onClose: () => void;
}

type SubPanel = { type: 'none' } | { type: 'attacks'; monsterId: string };

export function HabitatPanel({ instanceId, onClose }: HabitatPanelProps) {
  const building        = useGameStore(s => s.buildings[instanceId]);
  const allMonsters     = useGameStore(s => s.monsters);
  const food            = useGameStore(s => s.food);
  const gold            = useGameStore(s => s.gold);
  const diamonds        = useGameStore(s => s.diamonds);
  const collectGold     = useGameStore(s => s.collectGold);
  const collectAll      = useGameStore(s => s.collectAll);
  const buildings       = useGameStore(s => s.buildings);
  const feedMonster     = useGameStore(s => s.feedMonster);
  const sellMonster     = useGameStore(s => s.sellMonster);
  const assignToHabitat = useGameStore(s => s.assignToHabitat);
  const removeFromHabitat = useGameStore(s => s.removeFromHabitat);
  const upgradeBuilding = useGameStore(s => s.upgradeBuilding);
  const evolveMonster   = useGameStore(s => s.evolveMonster);
  const equipAttack     = useGameStore(s => s.equipAttack);
  const unequipAttack   = useGameStore(s => s.unequipAttack);
  const trainAttack     = useGameStore(s => s.trainAttack);

  const [subPanel, setSubPanel] = useState<SubPanel>({ type: 'none' });

  const monsters = building?.monsterIds.map(id => allMonsters[id]).filter(Boolean) as MonsterInstance[] ?? [];

  if (!building) return null;
  const def = BUILDING_DEFS[building.defId];
  const levelData = def.levels[building.level - 1];
  const nextLevel = def.levels[building.level];

  const unassigned = Object.values(allMonsters).filter(m => {
    if (m.habitatId) return false;
    const mDef = MONSTER_DEFS[m.defId];
    if (!mDef) return false;
    if (def.linkedElement) return mDef.elements.includes(def.linkedElement);
    return true;
  });

  return (
    <div className="panel panel-side">
      <button className="close-btn" onClick={onClose}>✕</button>
      <div className="panel-title">🏠 {def.name}</div>
      <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>
        Level {building.level} · {monsters.length}/{levelData?.monsterCapacity ?? 3} Monster
      </div>

      {building.goldAccumulated > 0 && (
        <button className="btn btn-gold" style={{ width: '100%', marginBottom: 6 }}
          onClick={() => collectGold(instanceId)}>
          Sammeln 🪙 {Math.floor(building.goldAccumulated)}
        </button>
      )}

      {/* Collect-all across every habitat */}
      {(() => {
        const totalHabitatGold = Math.floor(
          Object.values(buildings)
            .filter(b => BUILDING_DEFS[b.defId]?.category === 'Habitat')
            .reduce((sum, b) => sum + b.goldAccumulated, 0),
        );
        if (totalHabitatGold <= 0) return null;
        return (
          <button className="btn btn-info" style={{ width: '100%', marginBottom: 10, fontSize: 12 }}
            onClick={() => collectAll('Habitat')}>
            🪙 Alle Habitate einsammeln (+{totalHabitatGold})
          </button>
        );
      })()}

      {!building.constructionEndMs && (
        <div style={{ marginBottom: 10 }}>
          {building.upgradeEndMs ? (
            <div style={{ color: '#ffaa00', fontSize: 13 }}>⏳ Ausbau läuft…</div>
          ) : nextLevel ? (
            <button className="btn btn-gold" style={{ width: '100%', fontSize: 12 }}
              disabled={gold < nextLevel.upgradeCost}
              onClick={() => upgradeBuilding(instanceId)}>
              ⬆️ Auf Level {building.level + 1} (🪙 {nextLevel.upgradeCost})
            </button>
          ) : (
            <div style={{ color: '#66ff88', fontSize: 12, textAlign: 'center' }}>Max-Level erreicht</div>
          )}
        </div>
      )}

      {/* ── Resident monsters ── */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 6 }}>Monster:</div>
        {monsters.length === 0 && <div style={{ color: '#666', fontSize: 12 }}>Noch keine Monster</div>}
        {monsters.map(m => {
          const mDef = MONSTER_DEFS[m.defId];
          if (!mDef) return null;
          const feedCost  = calculateFeedCost(m.level);
          const canFeed   = food >= feedCost;
          const sellValue = calculateSellValue(RARITY_RANK[mDef.rarity], m.level);
          const evoReady  = isEvolutionReady(m);
          const nextStage = getNextEvolutionStage(m.stage);
          const stageName = getEvolutionStageName(m.defId, m.stage);
          const isShowingAttacks = subPanel.type === 'attacks' && subPanel.monsterId === m.instanceId;

          return (
            <div key={m.instanceId} className="monster-card" style={{ marginBottom: 8, border: evoReady ? '1px solid #ffd700' : undefined }}>
              {/* Header row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span style={{ fontWeight: 'bold' }}>
                    {m.name}
                    <span className="rarity-badge" style={{ background: RARITY_COLORS[mDef.rarity], color: '#000', marginLeft: 4 }}>
                      {mDef.rarity}
                    </span>
                  </span>
                  <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                    Lv {m.level} · <span style={{ color: '#bb99ff' }}>{stageName}</span> · {mDef.elements.join('/')}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <button className="btn btn-info" style={{ padding: '2px 6px', fontSize: 10 }}
                    title="Detailansicht"
                    onClick={() => EventBus.emit(GameEvents.OPEN_MONSTER_DETAIL, { instanceId: m.instanceId })}>
                    ℹ️
                  </button>
                  <button className="btn btn-gold" style={{ padding: '2px 6px', fontSize: 10 }}
                    title={`Verkaufen für ${sellValue} Gold`}
                    onClick={() => { if (confirm(`${m.name} für 🪙 ${sellValue} verkaufen?`)) sellMonster(m.instanceId); }}>
                    🪙{sellValue}
                  </button>
                  <button className="btn btn-danger" style={{ padding: '2px 6px', fontSize: 10 }}
                    onClick={() => removeFromHabitat(m.instanceId)}>
                    Entfernen
                  </button>
                </div>
              </div>

              {/* Evolution badge */}
              {evoReady && nextStage && (
                <div style={{ marginTop: 6, padding: '4px 8px', background: 'rgba(255,215,0,0.12)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: '#ffd700' }}>
                    ✨ Kann sich zu <b>{getEvolutionStageName(m.defId, nextStage)}</b> entwickeln!
                  </span>
                  <button
                    style={{ padding: '3px 10px', fontSize: 12, background: '#664400', color: '#ffd700', border: '1px solid #ffd700', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold' }}
                    onClick={() => evolveMonster(m.instanceId)}>
                    ENTWICKELN ✨
                  </button>
                </div>
              )}
              {!evoReady && nextStage && (
                <div style={{ fontSize: 10, color: '#555', marginTop: 4 }}>
                  Nächste Entwicklung bei Lv {EVOLUTION_LEVELS[nextStage]}
                </div>
              )}

              {/* Feed bar */}
              {(() => {
                const need = Math.floor(100 * Math.pow(m.level, 1.5));
                const perFeed = Math.ceil(need / 4);
                const feedsDone = Math.min(4, Math.round(m.xp / perFeed));
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                    <div style={{ flex: 1, display: 'flex', gap: 3 }}>
                      {[0, 1, 2, 3].map(i => (
                        <div key={i} style={{ flex: 1, height: 7, borderRadius: 3, background: i < feedsDone ? '#4488ff' : '#333' }} />
                      ))}
                    </div>
                    <span style={{ fontSize: 10, color: '#888' }}>{feedsDone}/4</span>
                    <button className="btn btn-primary" style={{ padding: '2px 8px', fontSize: 11 }}
                      disabled={!canFeed || m.level >= 100}
                      onClick={() => feedMonster(m.instanceId, feedCost)}>
                      Füttern 🌾{feedCost}
                    </button>
                  </div>
                );
              })()}

              {/* Attack management toggle */}
              <button
                style={{ marginTop: 6, width: '100%', padding: '3px 0', fontSize: 11, background: '#1a2a3a', color: '#88aaff', border: '1px solid #335', borderRadius: 4, cursor: 'pointer' }}
                onClick={() => setSubPanel(isShowingAttacks ? { type: 'none' } : { type: 'attacks', monsterId: m.instanceId })}>
                ⚔️ Attacken verwalten ({m.equippedMoveIds.length}/{m.maxAttackSlots ?? 2} Slots) {isShowingAttacks ? '▲' : '▼'}
              </button>

              {/* Inline attack panel */}
              {isShowingAttacks && (
                <AttackSubPanel
                  monster={m}
                  gold={gold}
                  diamonds={diamonds}
                  onEquip={(moveId, replaceId) => equipAttack(m.instanceId, moveId, replaceId)}
                  onUnequip={(moveId) => unequipAttack(m.instanceId, moveId)}
                  onTrain={(moveId) => trainAttack(m.instanceId, moveId)}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Add unassigned monster */}
      {unassigned.length > 0 && monsters.length < (levelData?.monsterCapacity ?? 3) && (
        <div>
          <div style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 6 }}>Monster hinzufügen:</div>
          <div style={{ maxHeight: 160, overflowY: 'auto' }}>
            {unassigned.map(m => {
              const mDef = MONSTER_DEFS[m.defId];
              return (
                <div key={m.instanceId} className="monster-card" style={{ marginBottom: 4, cursor: 'pointer' }}
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

// ── Inline attack management sub-panel ────────────────────────────────────────

interface AttackSubPanelProps {
  monster: MonsterInstance;
  gold: number;
  diamonds: number;
  onEquip: (moveId: string, replaceId?: string) => void;
  onUnequip: (moveId: string) => void;
  onTrain: (moveId: string) => boolean;
}

function AttackSubPanel({ monster, gold, diamonds, onEquip, onUnequip, onTrain }: AttackSubPanelProps) {
  const [replaceMode, setReplaceMode] = useState<string | null>(null); // moveId waiting to be swapped in
  const known    = monster.knownMoveIds ?? [...monster.equippedMoveIds];
  const equipped = new Set(monster.equippedMoveIds);
  const slots    = monster.maxAttackSlots ?? 2;
  const trainable = getTrainableAttacks(monster);

  const rowStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '4px 6px', marginBottom: 3, borderRadius: 5,
    fontSize: 11,
  };

  return (
    <div style={{ marginTop: 6, padding: 8, background: '#0d1929', borderRadius: 6, border: '1px solid #223' }}>

      {/* Equipped attacks */}
      <div style={{ fontWeight: 'bold', color: '#88aaff', marginBottom: 4, fontSize: 12 }}>
        ✅ Ausgerüstet ({monster.equippedMoveIds.length}/{slots})
      </div>
      {monster.equippedMoveIds.map(id => {
        const mv = ATTACKS[id];
        if (!mv) return null;
        return (
          <div key={id} style={{ ...rowStyle, background: '#162030' }}>
            <span>
              <b>{mv.name}</b>
              <span style={{ color: ELEMENT_CSS_COLORS[mv.element] ?? '#aaa', marginLeft: 5 }}>{mv.element}</span>
              <span style={{ color: '#888', marginLeft: 5 }}>{mv.power}×</span>
            </span>
            {replaceMode ? (
              <button style={{ fontSize: 10, padding: '1px 6px', background: '#334', color: '#aaa', border: '1px solid #556', borderRadius: 3, cursor: 'pointer' }}
                onClick={() => { onEquip(replaceMode, id); setReplaceMode(null); }}>
                Ersetzen
              </button>
            ) : (
              <button style={{ fontSize: 10, padding: '1px 6px', background: '#330000', color: '#ff6666', border: '1px solid #550000', borderRadius: 3, cursor: 'pointer' }}
                onClick={() => onUnequip(id)}>
                Ablegen
              </button>
            )}
          </div>
        );
      })}
      {replaceMode && (
        <div style={{ fontSize: 10, color: '#ffd700', padding: '3px 0' }}>
          Welche Attacke soll ersetzt werden? (oben wählen)
          <button style={{ marginLeft: 8, fontSize: 10, background: 'none', color: '#888', border: 'none', cursor: 'pointer' }}
            onClick={() => setReplaceMode(null)}>Abbrechen</button>
        </div>
      )}

      {/* Known but unequipped */}
      {known.filter(id => !equipped.has(id)).length > 0 && (
        <>
          <div style={{ fontWeight: 'bold', color: '#888', marginTop: 8, marginBottom: 4, fontSize: 12 }}>
            📦 Bekannt, nicht ausgerüstet
          </div>
          {known.filter(id => !equipped.has(id)).map(id => {
            const mv = ATTACKS[id];
            if (!mv) return null;
            const canEquipDirect = monster.equippedMoveIds.length < slots;
            return (
              <div key={id} style={{ ...rowStyle, background: '#131b10' }}>
                <span>
                  <b>{mv.name}</b>
                  <span style={{ color: ELEMENT_CSS_COLORS[mv.element] ?? '#aaa', marginLeft: 5 }}>{mv.element}</span>
                  <span style={{ color: '#888', marginLeft: 5 }}>{mv.power}×</span>
                </span>
                {canEquipDirect ? (
                  <button style={{ fontSize: 10, padding: '1px 6px', background: '#003300', color: '#66ff66', border: '1px solid #005500', borderRadius: 3, cursor: 'pointer' }}
                    onClick={() => onEquip(id)}>
                    Ausrüsten
                  </button>
                ) : (
                  <button style={{ fontSize: 10, padding: '1px 6px', background: '#443300', color: '#ffaa33', border: '1px solid #665500', borderRadius: 3, cursor: 'pointer' }}
                    onClick={() => setReplaceMode(id)}>
                    Tauschen
                  </button>
                )}
              </div>
            );
          })}
        </>
      )}

      {/* Trainable attacks */}
      {trainable.length > 0 && (
        <>
          <div style={{ fontWeight: 'bold', color: '#ccaa44', marginTop: 8, marginBottom: 4, fontSize: 12 }}>
            📚 Erlernbar (Training)
          </div>
          {trainable.slice(0, 6).map(id => {
            const mv = ATTACKS[id];
            if (!mv) return null;
            const cost = getAttackTrainCost(id);
            const affordable = cost.diamonds > 0 ? diamonds >= cost.diamonds : gold >= cost.gold;
            const costLabel = cost.diamonds > 0 ? `💎${cost.diamonds}` : `🪙${cost.gold}`;
            return (
              <div key={id} style={{ ...rowStyle, background: '#1a1500' }}>
                <span>
                  <b>{mv.name}</b>
                  <span style={{ color: ELEMENT_CSS_COLORS[mv.element] ?? '#aaa', marginLeft: 5 }}>{mv.element}</span>
                  <span style={{ color: '#888', marginLeft: 5 }}>{mv.power}×</span>
                </span>
                <button
                  disabled={!affordable}
                  style={{ fontSize: 10, padding: '1px 6px', background: affordable ? '#332200' : '#1a1a1a', color: affordable ? '#ffd700' : '#555', border: `1px solid ${affordable ? '#664400' : '#333'}`, borderRadius: 3, cursor: affordable ? 'pointer' : 'default' }}
                  onClick={() => onTrain(id)}>
                  {costLabel}
                </button>
              </div>
            );
          })}
          {trainable.length > 6 && (
            <div style={{ fontSize: 10, color: '#666', padding: '2px 6px' }}>…und {trainable.length - 6} weitere</div>
          )}
        </>
      )}
    </div>
  );
}
