import React from 'react';
import { useGameStore } from '@store/gameStore';
import { MONSTER_DEFS } from '@data/monsters';
import { BUILDING_DEFS } from '@data/buildings';
import { RARITY_COLORS } from '@data/rarities';
import { ELEMENT_CSS_COLORS } from '@data/elements';
import { HelpButton } from './HelpButton';
import '../styles/global.css';

interface Props {
  eggId: string;
  onClose: () => void;
}

// Forced-assignment screen: a hatched monster MUST be placed in a matching
// habitat. If none is free, the player is told to build/free one first — they
// can't hatch yet (the egg stays put).
export function AssignHabitatPanel({ eggId, onClose }: Props) {
  const egg = useGameStore(s => s.eggs.find(e => e.id === eggId));
  const buildings = useGameStore(s => s.buildings);
  const eligibleHabitats = useGameStore(s => s.eligibleHabitats);
  const hatchEggToHabitat = useGameStore(s => s.hatchEggToHabitat);

  if (!egg) return null;
  const def = MONSTER_DEFS[egg.monsterDefId];
  if (!def) return null;

  const eligible = eligibleHabitats(egg.monsterDefId);
  const accent = ELEMENT_CSS_COLORS[def.elements[0]];

  const handleAssign = (habitatId: string) => {
    // Commits the hatch and places the monster. The Island scene's store
    // subscription removes the egg sprite automatically.
    const m = hatchEggToHabitat(eggId, habitatId);
    if (m) onClose();
  };

  return (
    <div className="panel panel-modal panel-w-sm" style={{ padding: 20 }}>
      <button className="close-btn" onClick={onClose}>✕</button>
      <HelpButton
        title="Lebensraum zuweisen"
        tips={[
          'Ein geschlüpftes Monster muss sofort in einen passenden Lebensraum einziehen.',
          'Es werden nur Lebensräume angezeigt, die zum Element des Monsters passen und noch Platz haben.',
          'Ist keiner frei, baue zuerst einen passenden Lebensraum oder mache Platz — das Ei bleibt solange erhalten.',
        ]}
      />
      <div className="panel-title">🐣 {def.name} schlüpft!</div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%', flexShrink: 0,
          background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28, boxShadow: `0 0 16px ${accent}aa`,
        }}>👾</div>
        <div style={{ fontSize: 13, color: '#ccc' }}>
          Wähle einen Lebensraum für dein neues Monster.
          <span className="rarity-badge" style={{ background: RARITY_COLORS[def.rarity], color: '#000', marginLeft: 6 }}>
            {def.rarity}
          </span>
        </div>
      </div>

      {eligible.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {eligible.map(id => {
            const b = buildings[id];
            const bd = BUILDING_DEFS[b.defId];
            const cap = bd.levels[b.level - 1]?.monsterCapacity ?? 3;
            return (
              <div key={id} className="monster-card" onClick={() => handleAssign(id)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 'bold' }}>🏠 {bd.name}</span>
                <span style={{ fontSize: 12, color: '#aaa' }}>
                  {b.monsterIds.length}/{cap} belegt
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{
          padding: 14, borderRadius: 10, background: 'rgba(255,80,80,0.1)',
          border: '1px solid rgba(255,80,80,0.3)', fontSize: 13, color: '#ffaaaa', lineHeight: 1.5,
        }}>
          ⚠️ Kein passender Lebensraum frei! Baue einen {def.elements.join('/')}-Lebensraum
          (oder einen Legendären) bzw. mach Platz, dann kann dieses Monster schlüpfen.
          Das Ei bleibt so lange in der Brutstation.
        </div>
      )}
    </div>
  );
}
