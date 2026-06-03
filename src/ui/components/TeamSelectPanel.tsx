import React, { useState } from 'react';
import { useGameStore } from '@store/gameStore';
import { MONSTER_DEFS } from '@data/monsters';
import { RARITY_COLORS } from '@data/rarities';
import { ELEMENT_CSS_COLORS } from '@data/elements';
import { getMonsterFaction, mixedTeamPenalty, pureTeamBonus, FACTION_ICONS, type Faction } from '@data/factions';
import { EventBus, GameEvents } from '@game/EventBus';
import { HelpButton } from './HelpButton';
import '../styles/global.css';

export interface BattlePayload {
  enemyTeam: string[];
  enemyLevels: number[];
  rewardGold?: number;
  rewardXp?: number;
  rewardDiamonds?: number;
  rewardMonsterDefId?: string;
  storyIndex?: number;
  isBoss?: boolean;
  waves?: Array<{ enemyTeam: string[]; enemyLevels: number[] }>;
}

interface Props {
  battlePayload: BattlePayload;
  onClose: () => void;
}

const MAX_TEAM = 3;

export function TeamSelectPanel({ battlePayload, onClose }: Props) {
  const monsters = useGameStore(s => s.monsters);
  const [selected, setSelected] = useState<string[]>([]);

  // Highest-level monsters first so the strongest options are at the top.
  const allMonsters = Object.values(monsters).sort((a, b) => b.level - a.level);

  // Gruppe 3 — Gut/Böse-Synergie: dieselbe Rechnung wie im Kampf, damit der
  // Spieler den Mali/Bonus seines Teams schon bei der Auswahl sieht.
  const selectedFactions: Faction[] = selected
    .map(id => monsters[id])
    .filter(Boolean)
    .map(m => { const d = MONSTER_DEFS[m.defId]; return d ? getMonsterFaction(d) : 'Neutral'; });
  const synergyMult = mixedTeamPenalty(selectedFactions) * pureTeamBonus(selectedFactions);
  const synergy = (() => {
    if (selected.length < 2) return null;
    if (synergyMult < 1) return { txt: `Gemischtes Team (${FACTION_ICONS.Good}+${FACTION_ICONS.Evil}) — Schaden ${Math.round((1 - synergyMult) * 100)}% reduziert`, col: '#ff6b6b' };
    if (synergyMult > 1) return { txt: `Reines Team — Schaden +${Math.round((synergyMult - 1) * 100)}%`, col: '#7fe07f' };
    return { txt: 'Neutrales Team — keine Synergie', col: '#9aa4b2' };
  })();

  const toggle = (id: string) => {
    setSelected(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= MAX_TEAM) return prev; // already full
      return [...prev, id];
    });
  };

  const startBattle = () => {
    if (selected.length === 0) return;
    // START_BATTLE runs synchronously and makes Island emit BATTLE_STARTED,
    // which replaces this panel with the 'battle' screen (and hides the HUD /
    // rails). Do NOT call onClose() here — it would set activePanel back to
    // null in the same React tick and win, leaving the normal UI visible
    // during the fight.
    EventBus.emit(GameEvents.START_BATTLE, {
      playerTeam: selected,
      ...battlePayload,
    });
  };

  return (
    <div className="panel panel-modal panel-w-lg" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <button className="close-btn" onClick={onClose}>✕</button>
      <HelpButton
        title="Team auswählen"
        tips={[
          'Stelle dein Kampfteam aus deinen Monstern zusammen, bevor es losgeht.',
          'Achte auf die Elemente: passende Typen haben im Kampf gegen den Gegner Vorteile.',
          'Höher gelevelte Monster mit guten Werten machen den entscheidenden Unterschied.',
        ]}
      />
      <div className="panel-title">⚔️ Team auswählen</div>

      {/* Selected-team slots */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
        {Array.from({ length: MAX_TEAM }).map((_, i) => {
          const mId = selected[i];
          const m   = mId ? monsters[mId] : null;
          const def = m ? MONSTER_DEFS[m.defId] : null;
          const col = def ? ELEMENT_CSS_COLORS[def.elements[0]] : '#444';
          return (
            <div key={i} onClick={() => mId && toggle(mId)} style={{
              flex: 1, height: 70, borderRadius: 12,
              border: `2px solid ${mId ? col : 'rgba(255,255,255,0.15)'}`,
              background: mId ? `${col}22` : 'rgba(255,255,255,0.04)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              cursor: mId ? 'pointer' : 'default',
              transition: 'all 0.15s',
              position: 'relative',
            }}>
              {mId && def && m ? (
                <>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: col, display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, boxShadow: `0 0 8px ${col}88`,
                    marginBottom: 2,
                  }}>
                    {elementEmoji(def.elements[0])}
                  </div>
                  <div style={{ fontSize: 9, color: '#ddd', fontWeight: 700, textAlign: 'center', lineHeight: 1.2 }}>
                    {def.name}
                  </div>
                  <div style={{ fontSize: 8, color: '#aaa' }}>Lv {m.level}</div>
                  {/* remove button */}
                  <div style={{
                    position: 'absolute', top: 3, right: 5,
                    fontSize: 10, color: '#ff8888', cursor: 'pointer', lineHeight: 1,
                  }}>✕</div>
                </>
              ) : (
                <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 22, lineHeight: 1 }}>+</div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: 11, color: '#888', textAlign: 'center' }}>
        {selected.length}/{MAX_TEAM} ausgewählt — tippe auf ein Monster um es hinzuzufügen
      </div>

      {/* Gruppe 3 — Fraktions-Synergie-Hinweis (live) */}
      {synergy && (
        <div style={{
          fontSize: 11, fontWeight: 700, textAlign: 'center',
          color: synergy.col,
          background: 'rgba(0,0,0,0.35)', border: `1px solid ${synergy.col}55`,
          borderRadius: 6, padding: '5px 8px',
        }}>
          {synergy.txt}
        </div>
      )}

      {/* Monster list */}
      <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {allMonsters.length === 0 && (
          <div style={{ color: '#666', textAlign: 'center', padding: 20 }}>
            Noch keine Monster! Kaufe welche im Shop oder züchte sie.
          </div>
        )}
        {allMonsters.map(m => {
          const def = MONSTER_DEFS[m.defId];
          if (!def) return null;
          const isSelected = selected.includes(m.instanceId);
          const isFull     = selected.length >= MAX_TEAM && !isSelected;
          const col        = ELEMENT_CSS_COLORS[def.elements[0]];

          return (
            <div
              key={m.instanceId}
              className="monster-card"
              onClick={() => !isFull && toggle(m.instanceId)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                opacity: isFull ? 0.4 : 1,
                cursor: isFull ? 'not-allowed' : 'pointer',
                border: isSelected
                  ? `2px solid ${col}`
                  : '1px solid rgba(119,68,204,0.4)',
                background: isSelected
                  ? `linear-gradient(135deg, ${col}22, rgba(119,68,204,0.15))`
                  : undefined,
                padding: '8px 10px',
              }}
            >
              {/* Avatar */}
              <div style={{
                width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                background: `radial-gradient(circle, ${col}, ${col}88)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, boxShadow: isSelected ? `0 0 12px ${col}99` : undefined,
                border: isSelected ? `2px solid ${col}` : '2px solid rgba(255,255,255,0.1)',
              }}>
                {elementEmoji(def.elements[0])}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span style={{ fontWeight: 800, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {m.name ?? def.name}
                  </span>
                  <span className="rarity-badge" style={{ background: RARITY_COLORS[def.rarity], color: '#000', flexShrink: 0 }}>
                    {def.rarity}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: '#aaa', display: 'flex', gap: 10 }}>
                  <span>Lv {m.level}</span>
                  <span>❤️ {m.currentHp}/{m.maxHp}</span>
                  <span>⚔️ {def.baseStats.attack}</span>
                  <span>🛡️ {def.baseStats.defense}</span>
                </div>
                {/* HP bar */}
                <div style={{ height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, marginTop: 4 }}>
                  <div style={{
                    height: '100%', borderRadius: 2,
                    width: `${Math.max(0, Math.min(100, (m.currentHp / m.maxHp) * 100))}%`,
                    background: m.currentHp > m.maxHp * 0.5 ? '#44cc44' : m.currentHp > m.maxHp * 0.25 ? '#ffaa00' : '#cc4444',
                  }} />
                </div>
              </div>

              {/* Selection indicator */}
              <div style={{
                width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                background: isSelected ? col : 'rgba(255,255,255,0.08)',
                border: `2px solid ${isSelected ? col : 'rgba(255,255,255,0.2)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, color: '#fff',
                boxShadow: isSelected ? `0 0 8px ${col}` : undefined,
              }}>
                {isSelected ? (selected.indexOf(m.instanceId) + 1) : ''}
              </div>
            </div>
          );
        })}
      </div>

      {/* Start button */}
      <button
        className={`btn ${selected.length > 0 ? 'btn-primary' : ''}`}
        disabled={selected.length === 0}
        onClick={startBattle}
        style={{ width: '100%', fontSize: 15, padding: '11px 0' }}
      >
        ⚔️ Kampf starten!
      </button>
    </div>
  );
}

function elementEmoji(el: string): string {
  const map: Record<string, string> = {
    Fire: '🔥', Water: '💧', Electric: '⚡', Earth: '🪨', Air: '💨',
    Ice: '❄️', Darkness: '🌑', Light: '✨', Metal: '⚙️', Poison: '☠️',
    Combat: '👊', Magic: '🔮', Angel: '😇', Demon: '😈', Plant: '🌿',
    Glitch: '👾', Time: '⏳', Crystal: '💎', Sand: '🏜️', Sound: '🎵',
    Void: '🕳️', Cosmos: '🌌', Psycho: '🧠',
  };
  return map[el] ?? '❓';
}
