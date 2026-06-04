import React, { useState } from 'react';
import { useGameStore } from '@store/gameStore';
import { MONSTER_DEFS } from '@data/monsters';
import { MONSTER_EMOJI } from '@data/monsterEmoji';
import { RARITY_COLORS, RARITY_RANK, RARITY_HATCH_TIME_SEC } from '@data/rarities';
import { ELEMENT_CSS_COLORS } from '@data/elements';
import { calculateEggSellValue, calculateSellValue } from '@systems/EconomySystem';
import { EventBus, GameEvents } from '@game/EventBus';
import { HelpButton } from './HelpButton';
import '../styles/global.css';

interface StoragePanelProps { onClose: () => void; }

type Tab = 'monsters' | 'eggs';

export function StoragePanel({ onClose }: StoragePanelProps) {
  const storedEggs = useGameStore(s => s.storedEggs);
  const monsters = useGameStore(s => s.monsters);
  const incubating = useGameStore(s => s.eggs.length);
  const eggCapacity = useGameStore(s => s.eggCapacity());
  const moveEggToHatchery = useGameStore(s => s.moveEggToHatchery);
  const sellEgg = useGameStore(s => s.sellEgg);
  const sellMonster = useGameStore(s => s.sellMonster);

  const [tab, setTab] = useState<Tab>('monsters');

  const hatcheryFull = incubating >= eggCapacity;

  // Eingelagerte Monster = Monster ohne zugewiesenen Lebensraum (habitatId null).
  const storedMonsters = Object.values(monsters)
    .filter(m => !m.habitatId)
    .sort((a, b) => {
      const ra = MONSTER_DEFS[a.defId] ? RARITY_RANK[MONSTER_DEFS[a.defId]!.rarity] : 0;
      const rb = MONSTER_DEFS[b.defId] ? RARITY_RANK[MONSTER_DEFS[b.defId]!.rarity] : 0;
      return rb - ra;
    });

  // Sort eggs by rarity (best first) so prized eggs are easy to find.
  const sortedEggs = [...storedEggs].sort((a, b) => {
    const ra = MONSTER_DEFS[a.monsterDefId] ? RARITY_RANK[MONSTER_DEFS[a.monsterDefId]!.rarity] : 0;
    const rb = MONSTER_DEFS[b.monsterDefId] ? RARITY_RANK[MONSTER_DEFS[b.monsterDefId]!.rarity] : 0;
    return rb - ra;
  });

  const place = (instanceId: string) => {
    // Platzierungs-Screen öffnen (Lebensraum wählen oder eingelagert lassen).
    EventBus.emit(GameEvents.OPEN_PLACE_MONSTER, { instanceId });
  };

  return (
    <div className="panel panel-modal panel-w-md" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <button className="close-btn" onClick={onClose} style={{ zIndex: 5 }}>✕</button>
      <HelpButton
        title="Lager"
        tips={[
          'Im Monster-Lager warten Monster ohne Lebensraum — platziere sie in ein Habitat oder verkaufe sie.',
          'Eingelagerte Monster erwirtschaften kein Gold, bis sie in einem Lebensraum wohnen.',
          'Im Ei-Lager warten Eier, die noch nicht ausgebrütet werden — sie verbrauchen keinen Brutplatz-Slot.',
          'Ein ausgebrütetes Baby bringt beim Verkauf mehr Gold als das Ei.',
        ]}
      />

      {/* Banner */}
      <div style={{
        padding: '14px 18px 10px',
        background: 'linear-gradient(135deg, #2a1e08, #160f04)',
        borderBottom: '2px solid #cc9944',
      }}>
        <div style={{ fontSize: 19, fontWeight: 900, color: '#ffcc66', textShadow: '0 2px 6px rgba(0,0,0,0.6)' }}>
          📦 Lager
        </div>
        <div style={{ fontSize: 12, color: '#ccb380', marginTop: 2 }}>
          {storedMonsters.length} Monster · {storedEggs.length} Ei{storedEggs.length === 1 ? '' : 'er'} ·
          Brutkasten {incubating}/{eggCapacity} {hatcheryFull && '(voll)'}
        </div>
        <div style={{ display: 'flex', gap: 4, marginTop: 10 }}>
          <StorageTab label={`🐾 Monster (${storedMonsters.length})`} active={tab === 'monsters'} onClick={() => setTab('monsters')} />
          <StorageTab label={`🥚 Eier (${storedEggs.length})`} active={tab === 'eggs'} onClick={() => setTab('eggs')} />
        </div>
      </div>

      <div style={{ overflowY: 'auto', padding: 14, flex: 1, minHeight: 0 }}>
        {tab === 'monsters' && (
          <>
            {storedMonsters.length === 0 && (
              <div style={{ textAlign: 'center', color: '#888', padding: 28 }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>📭</div>
                Keine eingelagerten Monster.<br />
                Gekaufte Monster, die du nicht platzierst, landen hier!
              </div>
            )}

            {storedMonsters.map(m => {
              const def = MONSTER_DEFS[m.defId];
              if (!def) return null;
              const rank = RARITY_RANK[def.rarity];
              const sellValue = calculateSellValue(rank, m.level, m.isUnique);
              return (
                <div key={m.instanceId} className="monster-card" style={{
                  marginBottom: 8, padding: 10, display: 'flex', alignItems: 'center', gap: 10,
                  border: `1px solid ${RARITY_COLORS[def.rarity]}55`,
                }}>
                  <div style={{
                    width: 46, height: 46, flexShrink: 0, borderRadius: '50%',
                    background: ELEMENT_CSS_COLORS[def.elements[0]],
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
                    boxShadow: `0 0 12px ${ELEMENT_CSS_COLORS[def.elements[0]]}99`,
                  }}>{MONSTER_EMOJI[m.defId] ?? '👾'}</div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 'bold', fontSize: 13 }}>
                      {m.isUnique ? '✨ ' : ''}{m.name ?? def.name}
                      <span className="rarity-badge" style={{ background: RARITY_COLORS[def.rarity], color: '#000', marginLeft: 6 }}>
                        {def.rarity}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                      Lv {m.level}{(m.rankStars ?? 0) > 0 ? ` · ${'★'.repeat(m.rankStars ?? 0)}` : ''} · {def.elements.join('/')}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <button className="btn btn-primary" style={{ fontSize: 11, padding: '4px 8px', whiteSpace: 'nowrap' }}
                      onClick={() => place(m.instanceId)}>
                      🏠 Platzieren
                    </button>
                    <button className="btn btn-gold" style={{ fontSize: 11, padding: '4px 8px', whiteSpace: 'nowrap' }}
                      onClick={() => { if (confirm(`${m.name ?? def.name} (Lv ${m.level}) für 🪙 ${sellValue.toLocaleString()} verkaufen?`)) sellMonster(m.instanceId); }}>
                      🪙 {sellValue.toLocaleString()}
                    </button>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {tab === 'eggs' && (
          <>
            {sortedEggs.length === 0 && (
              <div style={{ textAlign: 'center', color: '#888', padding: 28 }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>📭</div>
                Dein Ei-Lager ist leer.<br />
                Züchte Monster oder gewinne Eier aus Events &amp; Belohnungen!
              </div>
            )}

            {sortedEggs.map(egg => {
              const def = MONSTER_DEFS[egg.monsterDefId];
              if (!def) return null;
              const rank = RARITY_RANK[def.rarity];
              const sellValue = calculateEggSellValue(rank, egg.isUnique);
              const hatchMin = Math.round(RARITY_HATCH_TIME_SEC[def.rarity] / 60);
              return (
                <div key={egg.id} className="monster-card" style={{
                  marginBottom: 8, padding: 10, display: 'flex', alignItems: 'center', gap: 10,
                  border: `1px solid ${RARITY_COLORS[def.rarity]}55`,
                }}>
                  {/* Egg portrait */}
                  <div style={{
                    width: 46, height: 54, flexShrink: 0,
                    borderRadius: '50% 50% 48% 48% / 60% 60% 40% 40%',
                    background: `radial-gradient(circle at 38% 32%, #ffffffcc, ${ELEMENT_CSS_COLORS[def.elements[0]]} 70%)`,
                    border: '2px solid rgba(0,0,0,0.35)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
                  }}>{MONSTER_EMOJI[egg.monsterDefId] ?? '🥚'}</div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 'bold', fontSize: 13 }}>
                      {egg.isUnique ? '✨ ' : ''}{def.name}
                      <span className="rarity-badge" style={{ background: RARITY_COLORS[def.rarity], color: '#000', marginLeft: 6 }}>
                        {def.rarity}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                      {def.elements.join('/')} · Brutzeit ~{hatchMin} min
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <button className="btn btn-primary" style={{ fontSize: 11, padding: '4px 8px', whiteSpace: 'nowrap' }}
                      disabled={hatcheryFull}
                      title={hatcheryFull ? 'Brutkasten ist voll' : 'In den Brutkasten legen'}
                      onClick={() => moveEggToHatchery(egg.id)}>
                      🪺 Ausbrüten
                    </button>
                    <button className="btn btn-gold" style={{ fontSize: 11, padding: '4px 8px', whiteSpace: 'nowrap' }}
                      onClick={() => { if (confirm(`${def.name}-Ei für 🪙 ${sellValue} verkaufen?`)) sellEgg(egg.id); }}>
                      🪙 {sellValue}
                    </button>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

function StorageTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: '7px 0', fontSize: 12, fontWeight: 900, cursor: 'pointer',
      border: 'none', borderRadius: '8px 8px 0 0',
      background: active ? 'rgba(204,153,68,0.25)' : 'transparent',
      color: active ? '#ffcc66' : '#a08a55',
      borderBottom: active ? '2px solid #cc9944' : '2px solid transparent',
    }}>
      {label}
    </button>
  );
}
