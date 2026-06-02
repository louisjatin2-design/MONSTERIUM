import React from 'react';
import { useGameStore } from '@store/gameStore';
import { MONSTER_DEFS } from '@data/monsters';
import { MONSTER_EMOJI } from '@data/monsterEmoji';
import { RARITY_COLORS, RARITY_RANK, RARITY_HATCH_TIME_SEC } from '@data/rarities';
import { ELEMENT_CSS_COLORS } from '@data/elements';
import { HelpButton } from './HelpButton';
import '../styles/global.css';

interface StoragePanelProps { onClose: () => void; }

export function StoragePanel({ onClose }: StoragePanelProps) {
  const storedEggs = useGameStore(s => s.storedEggs);
  const incubating = useGameStore(s => s.eggs.length);
  const eggCapacity = useGameStore(s => s.eggCapacity());
  const moveEggToHatchery = useGameStore(s => s.moveEggToHatchery);
  const sellEgg = useGameStore(s => s.sellEgg);

  const hatcheryFull = incubating >= eggCapacity;

  // Sort by rarity (best first) so prized eggs are easy to find.
  const sorted = [...storedEggs].sort((a, b) => {
    const ra = MONSTER_DEFS[a.monsterDefId] ? RARITY_RANK[MONSTER_DEFS[a.monsterDefId]!.rarity] : 0;
    const rb = MONSTER_DEFS[b.monsterDefId] ? RARITY_RANK[MONSTER_DEFS[b.monsterDefId]!.rarity] : 0;
    return rb - ra;
  });

  return (
    <div className="panel panel-modal panel-w-md" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <button className="close-btn" onClick={onClose} style={{ zIndex: 5 }}>✕</button>
      <HelpButton
        title="Lager"
        tips={[
          'Im Lager warten Eier, die noch nicht ausgebrütet werden — sie verbrauchen keinen Brutplatz-Slot.',
          'Tippe „Zum Brutplatz", um ein Ei ins Ausbrüten zu schicken (sofern ein Slot frei ist).',
          'Eier kannst du auch verkaufen — ein ausgebrütetes Baby bringt beim Verkauf aber mehr Gold als das Ei.',
        ]}
      />

      {/* Banner */}
      <div style={{
        padding: '14px 18px 10px',
        background: 'linear-gradient(135deg, #2a1e08, #160f04)',
        borderBottom: '2px solid #cc9944',
      }}>
        <div style={{ fontSize: 19, fontWeight: 900, color: '#ffcc66', textShadow: '0 2px 6px rgba(0,0,0,0.6)' }}>
          📦 Ei-Lager
        </div>
        <div style={{ fontSize: 12, color: '#ccb380', marginTop: 2 }}>
          {storedEggs.length} Ei{storedEggs.length === 1 ? '' : 'er'} gelagert ·
          Brutkasten {incubating}/{eggCapacity} {hatcheryFull && '(voll)'}
        </div>
      </div>

      <div style={{ overflowY: 'auto', padding: 14, flex: 1, minHeight: 0 }}>
        {sorted.length === 0 && (
          <div style={{ textAlign: 'center', color: '#888', padding: 28 }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>📭</div>
            Dein Lager ist leer.<br />
            Züchte Monster oder gewinne Eier aus Events &amp; Belohnungen!
          </div>
        )}

        {sorted.map(egg => {
          const def = MONSTER_DEFS[egg.monsterDefId];
          if (!def) return null;
          const rank = RARITY_RANK[def.rarity];
          const sellValue = Math.floor(120 * Math.pow(2.1, rank)) * (egg.isUnique ? 2 : 1);
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
      </div>
    </div>
  );
}
