import React, { useMemo } from 'react';
import { useGameStore } from '@store/gameStore';
import { MONSTER_DEFS } from '@data/monsters';
import { MONSTER_EMOJI } from '@data/monsterEmoji';
import { ATTACKS } from '@data/attacks';
import { RARITY_COLORS, RARITY_STARS, rarityGlow } from '@data/rarities';
import { ELEMENT_CSS_COLORS } from '@data/elements';
import { TRAITS } from '@data/traits';
import { getMonsterRoles, ROLE_COLORS, ROLE_ICONS } from '@data/monsterRoles';
import { getBestiaryEntries, getBestiaryProgress } from '@data/bestiary';
import { HelpButton } from './HelpButton';
import '../styles/global.css';

interface MonsterDetailProps {
  defId: string;
  isUnlocked: boolean;
  onClose: () => void;
}

export function MonsterDetail({ defId, isUnlocked, onClose }: MonsterDetailProps) {
  const def = MONSTER_DEFS[defId];
  // Gruppe 4 — Bestiarium-Fortschritt (Kämpfe gegen diese Spezies + Besitz).
  const battles = useGameStore(s => s.bestiary[defId] ?? 0);
  const owned = useGameStore(s => Object.values(s.monsters).some(m => m.defId === defId));
  const bestiary = useMemo(
    () => def ? getBestiaryEntries(def, getBestiaryProgress(battles, owned)) : [],
    [def, battles, owned],
  );
  if (!def) return null;

  return (
    <div className="panel panel-modal panel-w-md" style={{ padding: 20, overflowY: 'auto' }}>
      <button className="close-btn" onClick={onClose}>✕</button>
      <HelpButton
        title="Monster-Info"
        tips={[
          'Hier siehst du Element(e), Seltenheit, Basiswerte und Lore eines Monsters.',
          'Die aufgelisteten Angriffe lernt das Monster im Laufe seiner Level.',
          'Das Talent (Trait) gibt dem Monster im Kampf eine besondere Fähigkeit.',
        ]}
      />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: isUnlocked
            ? `radial-gradient(circle at 38% 32%, #ffffff55, ${ELEMENT_CSS_COLORS[def.elements[0]]})`
            : '#222',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 32, boxShadow: isUnlocked ? rarityGlow(def.rarity) : 'none',
        }}>
          {isUnlocked ? (MONSTER_EMOJI[defId] ?? '👾') : '❓'}
        </div>
        <div>
          <div style={{ fontSize: 22, fontWeight: 'bold' }}>
            {isUnlocked ? def.name : '???'}
            <span className="rarity-badge" style={{ background: RARITY_COLORS[def.rarity], color: '#000', marginLeft: 8 }}>
              {def.rarity}
            </span>
          </div>
          <div style={{ fontSize: 13, color: RARITY_COLORS[def.rarity], letterSpacing: '-1px', marginTop: 2 }}>
            {'★'.repeat(RARITY_STARS[def.rarity])}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
            {def.elements.map(el => (
              <span key={el} style={{
                padding: '2px 8px', borderRadius: 4, fontSize: 12,
                background: ELEMENT_CSS_COLORS[el] + '33',
                border: `1px solid ${ELEMENT_CSS_COLORS[el]}`,
                color: ELEMENT_CSS_COLORS[el],
              }}>{el}</span>
            ))}
          </div>
          {/* Role badges */}
          <div style={{ display: 'flex', gap: 5, marginTop: 6, flexWrap: 'wrap' }}>
            {getMonsterRoles(defId).map(role => (
              <span key={role} style={{
                padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 'bold',
                background: ROLE_COLORS[role] + '22',
                border: `1px solid ${ROLE_COLORS[role]}`,
                color: ROLE_COLORS[role],
              }}>{ROLE_ICONS[role]} {role}</span>
            ))}
          </div>
        </div>
      </div>

      {isUnlocked ? (
        <>
          {/* Gruppe 4 — Bestiarium: Lore-Einträge schalten sich mit Kämpfen/Besitz frei. */}
          <div className="panel-title" style={{ fontSize: 15 }}>
            📖 Bestiarium
            <span style={{ fontSize: 11, color: '#888', fontWeight: 400, marginLeft: 8 }}>
              {bestiary.filter(e => e.unlocked).length}/{bestiary.length} freigeschaltet · {battles} Kämpfe
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
            {bestiary.map(e => (
              <div key={e.title} style={{
                background: 'rgba(255,255,255,0.05)', borderRadius: 6, padding: '8px 10px',
                border: '1px solid rgba(255,255,255,0.08)',
                opacity: e.unlocked ? 1 : 0.6,
              }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: e.unlocked ? '#ffd700' : '#777', marginBottom: 3 }}>
                  {e.unlocked ? '' : '🔒 '}{e.title}
                </div>
                <div style={{ fontSize: 12.5, color: '#bbb', fontStyle: 'italic', lineHeight: 1.5 }}>
                  {e.unlocked
                    ? e.text
                    : `Noch ${Math.max(0, e.threshold - getBestiaryProgress(battles, owned))} Fortschritt — kämpfe oder besitze dieses Monster.`}
                </div>
              </div>
            ))}
          </div>

          {/* Stats */}
          <div className="panel-title" style={{ fontSize: 15 }}>Base Stats</div>
          {Object.entries(def.baseStats).map(([stat, val]) => (
            <StatBar key={stat} name={stat.toUpperCase()} value={val} max={700} />
          ))}

          {/* Trait */}
          <div style={{ marginTop: 12, marginBottom: 12 }}>
            <span style={{ fontWeight: 'bold', color: '#ffd700' }}>Trait: </span>
            <span style={{ color: '#fff' }}>{def.trait}</span>
            {def.trait !== 'None' && (
              <span style={{ color: '#aaa', fontSize: 12, marginLeft: 8 }}>
                — {TRAITS[def.trait]?.description}
              </span>
            )}
          </div>

          {/* Evolution stages — 4 stages at Lv 0 / 25 / 50 / 75 */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 'bold', color: '#ffd700', marginBottom: 4 }}>Entwicklungsstufen:</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {[...def.evolutionStages, def.evolutionStages[2] + ' Elder'].map((s, i) => (
                <div key={i} style={{
                  flex: 1, textAlign: 'center', padding: '6px 4px',
                  background: 'rgba(255,255,255,0.07)', borderRadius: 6, fontSize: 11,
                }}>
                  <div style={{ color: '#aaa' }}>{['Baby', 'Juvenile', 'Adult', 'Elder'][i]}</div>
                  <div style={{ color: '#ffd700', fontWeight: 'bold', marginTop: 2, fontSize: 10 }}>{s}</div>
                  <div style={{ color: '#888', fontSize: 10 }}>{['Lv 1', 'Lv 25', 'Lv 50', 'Lv 75'][i]}</div>
                  <div style={{ color: '#66aaff', fontSize: 9, marginTop: 2 }}>{[2, 3, 4, 5][i]} Slots</div>
                </div>
              ))}
            </div>
          </div>

          {/* Moves */}
          <div className="panel-title" style={{ fontSize: 15 }}>Move Pool</div>
          {def.availableMoveIds.map((moveId, i) => {
            const move = ATTACKS[moveId];
            if (!move) return null;
            return (
              <div key={moveId} style={{
                padding: '6px 10px', marginBottom: 4,
                background: 'rgba(255,255,255,0.05)', borderRadius: 6,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div>
                  <span style={{ fontWeight: 'bold', fontSize: 13 }}>{move.name}</span>
                  <span style={{ color: '#888', fontSize: 11, marginLeft: 6 }}>Unlocked at Lv {i * 5}</span>
                </div>
                <div style={{ fontSize: 11, color: '#aaa', textAlign: 'right' }}>
                  <div>{move.element} · {move.power}x power</div>
                  <div>{move.minigameType}</div>
                </div>
              </div>
            );
          })}

          {/* Breed compatibility */}
          {def.breedCompatibility.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontWeight: 'bold', color: '#ffd700', marginBottom: 4 }}>Breed Partners:</div>
              <div style={{ fontSize: 12, color: '#aaa' }}>
                {def.breedCompatibility.map(id => MONSTER_DEFS[id]?.name ?? id).join(', ')}
              </div>
            </div>
          )}
        </>
      ) : (
        <div style={{ textAlign: 'center', padding: 20, color: '#666' }}>
          Discover this monster to see its details!
        </div>
      )}
    </div>
  );
}

function StatBar({ name, value, max }: { name: string; value: number; max: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
      <div style={{ width: 60, fontSize: 11, color: '#888' }}>{name}</div>
      <div style={{ flex: 1, height: 8, background: '#333', borderRadius: 4 }}>
        <div style={{
          width: `${(value / max) * 100}%`, height: '100%',
          background: '#4488ff', borderRadius: 4,
        }} />
      </div>
      <div style={{ width: 36, fontSize: 11, color: '#fff', textAlign: 'right' }}>{value}</div>
    </div>
  );
}
