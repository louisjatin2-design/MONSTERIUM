import React, { useState } from 'react';
import { useGameStore } from '@store/gameStore';
import { MONSTER_DEFS, ALL_MONSTER_IDS } from '@data/monsters';
import { RARITY_COLORS } from '@data/rarities';
import { ELEMENT_CSS_COLORS } from '@data/elements';
import { MonsterDetail } from './MonsterDetail';
import '../styles/global.css';

interface PokedexProps { onClose: () => void; }

export function Pokedex({ onClose }: PokedexProps) {
  const pokedexSeen = useGameStore(s => s.pokedexSeen);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const filtered = ALL_MONSTER_IDS.filter(id => {
    if (!search) return true;
    const def = MONSTER_DEFS[id];
    return def?.name.toLowerCase().includes(search.toLowerCase()) ||
           def?.elements.some(e => e.toLowerCase().includes(search.toLowerCase())) ||
           def?.rarity.toLowerCase().includes(search.toLowerCase());
  });

  if (selectedId) {
    return <MonsterDetail defId={selectedId} isUnlocked={pokedexSeen.includes(selectedId)} onClose={() => setSelectedId(null)} />;
  }

  return (
    <div className="panel panel-modal panel-w-xl" style={{ padding: 20 }}>
      <button className="close-btn" onClick={onClose}>✕</button>
      <div className="panel-title">📖 Pokédex ({pokedexSeen.length}/{ALL_MONSTER_IDS.length} discovered)</div>

      <input
        value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Search by name, element, rarity..."
        style={{
          width: '100%', background: '#1a1a3a', color: '#fff',
          border: '1px solid #444', borderRadius: 6, padding: '8px 12px',
          marginBottom: 12, fontSize: 13,
        }}
      />

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))',
        gap: 8, overflowY: 'auto', maxHeight: 'calc(min(88vh, 100vh - 150px) - 160px)',
      }}>
        {filtered.map(id => {
          const def = MONSTER_DEFS[id];
          if (!def) return null;
          const unlocked = pokedexSeen.includes(id);
          return (
            <div key={id} className="monster-card"
              onClick={() => setSelectedId(id)}
              style={{
                textAlign: 'center', padding: 8,
                filter: unlocked ? 'none' : 'grayscale(100%) brightness(0.3)',
              }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%', margin: '0 auto 6px',
                background: unlocked ? ELEMENT_CSS_COLORS[def.elements[0]] : '#333',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22,
              }}>
                {unlocked ? '👾' : '❓'}
              </div>
              <div style={{ fontSize: 11, fontWeight: 'bold', marginBottom: 2 }}>
                {unlocked ? def.name : '???'}
              </div>
              <div style={{
                fontSize: 10, padding: '1px 4px', borderRadius: 3,
                background: RARITY_COLORS[def.rarity] + '44',
                color: RARITY_COLORS[def.rarity], display: 'inline-block',
              }}>
                {def.rarity}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
