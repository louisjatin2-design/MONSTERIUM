import React from 'react';
import { useGameStore } from '@store/gameStore';
import { MONSTER_DEFS } from '@data/monsters';
import { BUILDING_DEFS } from '@data/buildings';
import { RARITY_COLORS } from '@data/rarities';
import { ELEMENT_CSS_COLORS } from '@data/elements';
import { MONSTER_EMOJI } from '@data/monsterEmoji';
import { HelpButton } from './HelpButton';
import '../styles/global.css';

interface Props {
  instanceId: string;
  /** true, wenn das Monster gerade im Auktionshaus gekauft wurde (andere Headline). */
  purchased?: boolean;
  onClose: () => void;
}

// Platzierungs-Screen für ein bereits im Bestand befindliches Monster:
// Der Spieler wählt einen passenden Lebensraum ODER lagert das Monster ein.
// Wird nach dem Kauf im Auktionshaus geöffnet und aus dem Lager heraus benutzt.
export function MonsterPlacementPanel({ instanceId, purchased, onClose }: Props) {
  const monster = useGameStore(s => s.monsters[instanceId]);
  const buildings = useGameStore(s => s.buildings);
  const eligibleHabitats = useGameStore(s => s.eligibleHabitats);
  const assignToHabitat = useGameStore(s => s.assignToHabitat);

  if (!monster) return null;
  const def = MONSTER_DEFS[monster.defId];
  if (!def) return null;

  const eligible = eligibleHabitats(monster.defId);
  const accent = ELEMENT_CSS_COLORS[def.elements[0]];

  const place = (habitatId: string) => {
    assignToHabitat(instanceId, habitatId);
    onClose();
  };

  return (
    <div className="panel panel-modal panel-w-sm" style={{ padding: 20 }}>
      <button className="close-btn" onClick={onClose}>✕</button>
      <HelpButton
        title="Monster platzieren"
        tips={[
          'Wähle einen passenden Lebensraum, damit dein Monster Gold erwirtschaftet.',
          'Es werden nur Lebensräume mit passendem Element und freiem Platz angezeigt.',
          'Alternativ kannst du das Monster einlagern — eingelagerte Monster findest du im Lager und kannst sie später platzieren oder verkaufen.',
        ]}
      />
      <div className="panel-title">
        {purchased ? '🛒 Gekauft!' : '🏠 Monster platzieren'}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%', flexShrink: 0,
          background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28, boxShadow: `0 0 16px ${accent}aa`,
        }}>{MONSTER_EMOJI[monster.defId] ?? '👾'}</div>
        <div style={{ fontSize: 13, color: '#ccc' }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: '#fff', marginBottom: 2 }}>
            {monster.name ?? def.name}
          </div>
          Lv {monster.level}{(monster.rankStars ?? 0) > 0 ? ` · ${'★'.repeat(monster.rankStars ?? 0)}` : ''}
          <span className="rarity-badge" style={{ background: RARITY_COLORS[def.rarity], color: '#000', marginLeft: 6 }}>
            {def.rarity}
          </span>
        </div>
      </div>

      <div style={{ fontSize: 12, color: '#9ab', marginBottom: 8 }}>
        Wohin soll {monster.name ?? def.name} ziehen?
      </div>

      {eligible.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {eligible.map(id => {
            const b = buildings[id];
            const bd = BUILDING_DEFS[b.defId];
            const cap = bd.levels[b.level - 1]?.monsterCapacity ?? 3;
            return (
              <div key={id} className="monster-card" onClick={() => place(id)}
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
          padding: 12, borderRadius: 10, background: 'rgba(255,180,80,0.1)',
          border: '1px solid rgba(255,180,80,0.3)', fontSize: 12, color: '#ffd9a0', lineHeight: 1.5,
        }}>
          Kein passender Lebensraum frei. Du kannst das Monster einlagern und
          später platzieren oder verkaufen.
        </div>
      )}

      {/* Einlagern: Monster bleibt ohne Lebensraum (habitatId === null) → Lager. */}
      <button className="btn btn-info" onClick={onClose}
        style={{ width: '100%', marginTop: 12, fontSize: 13 }}>
        📦 Einlagern (ins Lager legen)
      </button>
    </div>
  );
}
