import React, { useMemo, useState } from 'react';
import { useGameStore } from '@store/gameStore';
import { MONSTER_DEFS, ALL_MONSTER_IDS } from '@data/monsters';
import { MONSTER_EMOJI } from '@data/monsterEmoji';
import { RARITY_COLORS, RARITY_RANK, RARITY_STARS, RARITY_SYMBOLS, rarityGlow } from '@data/rarities';
import { ELEMENT_CSS_COLORS } from '@data/elements';
import type { RarityType } from '@gtypes/game';
import { MonsterDetail } from './MonsterDetail';
import '../styles/global.css';

interface PokedexProps { onClose: () => void; }

const RARITY_ORDER: RarityType[] = [
  'Common', 'Rare', 'SuperRare', 'Epic', 'Legendary', 'Elite', 'Mythic', 'Transcendent',
];

export function Pokedex({ onClose }: PokedexProps) {
  const pokedexSeen = useGameStore(s => s.pokedexSeen);
  const monsters = useGameStore(s => s.monsters);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [rarityFilter, setRarityFilter] = useState<RarityType | 'All'>('All');

  // Derive these from stable store references — never build a new Set/Map
  // directly inside a zustand selector, or useSyncExternalStore sees a fresh
  // snapshot on every render and throws into an infinite re-render loop.
  const ownedDefIds = useMemo(() => new Set(Object.values(monsters).map(m => m.defId)), [monsters]);
  const seenSet = useMemo(() => new Set(pokedexSeen), [pokedexSeen]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return ALL_MONSTER_IDS
      .filter(id => {
        const def = MONSTER_DEFS[id];
        if (!def) return false;
        if (rarityFilter !== 'All' && def.rarity !== rarityFilter) return false;
        if (!q) return true;
        return def.name.toLowerCase().includes(q)
          || def.elements.some(e => e.toLowerCase().includes(q))
          || def.rarity.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        const da = MONSTER_DEFS[a]!, db = MONSTER_DEFS[b]!;
        const r = RARITY_RANK[da.rarity] - RARITY_RANK[db.rarity];
        return r !== 0 ? r : da.name.localeCompare(db.name);
      });
  }, [search, rarityFilter]);

  const discovered = pokedexSeen.length;
  const total = ALL_MONSTER_IDS.length;
  const pct = Math.round((discovered / total) * 100);

  if (selectedId) {
    return <MonsterDetail defId={selectedId} isUnlocked={seenSet.has(selectedId)} onClose={() => setSelectedId(null)} />;
  }

  return (
    <div className="panel panel-modal panel-w-xl" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <button className="close-btn" onClick={onClose} style={{ zIndex: 5 }}>✕</button>

      {/* Header with completion bar */}
      <div style={{
        padding: '14px 18px 10px',
        background: 'linear-gradient(135deg, #2a1148, #160828)',
        borderBottom: '2px solid #7744cc',
      }}>
        <div className="panel-title" style={{ marginBottom: 8, borderBottom: 'none', paddingBottom: 0 }}>
          📖 Monsterpedia
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, height: 8, background: 'rgba(0,0,0,0.4)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #aa55ff, #ffd700)', borderRadius: 4 }} />
          </div>
          <div style={{ fontSize: 12, color: '#ffd700', fontWeight: 900, whiteSpace: 'nowrap' }}>
            {discovered}/{total} · {pct}%
          </div>
        </div>

        {/* Search */}
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Suche nach Name, Element, Seltenheit…"
          style={{
            width: '100%', boxSizing: 'border-box', background: 'rgba(0,0,0,0.35)', color: '#fff',
            border: '1px solid #5a3a8a', borderRadius: 8, padding: '8px 12px',
            margin: '10px 0 8px', fontSize: 13,
          }}
        />

        {/* Rarity filter chips */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <Chip label="Alle" active={rarityFilter === 'All'} color="#bb88ff" onClick={() => setRarityFilter('All')} />
          {RARITY_ORDER.map(r => (
            <Chip key={r} label={`${RARITY_SYMBOLS[r]}`} title={r}
              active={rarityFilter === r} color={RARITY_COLORS[r]}
              onClick={() => setRarityFilter(rarityFilter === r ? 'All' : r)} />
          ))}
        </div>
      </div>

      {/* Grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))',
        gap: 8, overflowY: 'auto', padding: 14,
        flex: 1, minHeight: 0,
      }}>
        {filtered.map(id => {
          const def = MONSTER_DEFS[id]!;
          const unlocked = seenSet.has(id);
          const owned = ownedDefIds.has(id);
          const color = RARITY_COLORS[def.rarity];
          return (
            <div key={id} className="monster-card"
              onClick={() => setSelectedId(id)}
              style={{
                position: 'relative', textAlign: 'center', padding: '10px 6px 8px',
                border: `1px solid ${unlocked ? color + '88' : 'rgba(255,255,255,0.08)'}`,
                background: unlocked
                  ? `linear-gradient(160deg, ${color}22, rgba(0,0,0,0.3))`
                  : 'rgba(255,255,255,0.03)',
              }}>
              {owned && (
                <span style={{ position: 'absolute', top: 4, right: 5, fontSize: 11 }} title="Im Besitz">✓</span>
              )}
              <div style={{
                width: 52, height: 52, borderRadius: '50%', margin: '0 auto 6px',
                background: unlocked
                  ? `radial-gradient(circle at 38% 32%, #ffffff44, ${ELEMENT_CSS_COLORS[def.elements[0]]})`
                  : '#222',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 26,
                boxShadow: unlocked ? rarityGlow(def.rarity) : 'none',
                filter: unlocked ? 'none' : 'grayscale(100%) brightness(0.4)',
              }}>
                {unlocked ? (MONSTER_EMOJI[id] ?? '👾') : '❓'}
              </div>
              <div style={{ fontSize: 11, fontWeight: 'bold', marginBottom: 3, color: unlocked ? '#fff' : '#666' }}>
                {unlocked ? def.name : '???'}
              </div>
              {/* Rarity stars */}
              <div style={{ fontSize: 9, color, letterSpacing: '-1px', lineHeight: 1 }}>
                {'★'.repeat(RARITY_STARS[def.rarity])}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#666', padding: 30 }}>
            Keine Monster gefunden.
          </div>
        )}
      </div>
    </div>
  );
}

function Chip({ label, title, active, color, onClick }: {
  label: string; title?: string; active: boolean; color: string; onClick: () => void;
}) {
  return (
    <button onClick={onClick} title={title}
      style={{
        padding: '3px 9px', fontSize: 12, fontWeight: 900, borderRadius: 7,
        cursor: 'pointer', lineHeight: 1.4,
        border: `1px solid ${active ? color : 'rgba(255,255,255,0.15)'}`,
        background: active ? color + '33' : 'rgba(0,0,0,0.3)',
        color: active ? color : '#999',
      }}>
      {label}
    </button>
  );
}
