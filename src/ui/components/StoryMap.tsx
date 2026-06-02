import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useGameStore } from '@store/gameStore';
import { STORY_BATTLES, STORY_INTRO, STORY_WORLDS, type StoryWorld } from '@data/storyBattles';
import { MONSTER_DEFS, ALL_MONSTER_IDS } from '@data/monsters';
import { MONSTER_EMOJI } from '@data/monsterEmoji';
import { RARITY_RANK, RARITY_COLORS } from '@data/rarities';
import { EventBus, GameEvents } from '@game/EventBus';
import { HelpButton } from './HelpButton';
import '../styles/global.css';

interface StoryMapProps { onClose: () => void; }

const NODES_PER_ROW = 4;
const ROW_H = 96;          // vertical spacing between serpentine rows
const NODE = 56;           // node diameter

export function StoryMap({ onClose }: StoryMapProps) {
  const storyProgress = useGameStore(s => s.storyProgress);
  const monsters      = useGameStore(s => s.monsters);
  const trophies      = useGameStore(s => s.trophies);

  const playerMonsters = Object.values(monsters);

  // Which world is being viewed — default to the one containing the current front line.
  const initialWorld = useMemo(() => {
    const idx = STORY_WORLDS.findIndex(w => storyProgress < w.first + w.count);
    return idx < 0 ? STORY_WORLDS.length - 1 : idx;
  }, [storyProgress]);
  const [worldIdx, setWorldIdx] = useState(initialWorld);
  const [selected, setSelected] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const world = STORY_WORLDS[worldIdx];

  // Auto-scroll to the active node when the world opens.
  useEffect(() => { setSelected(null); }, [worldIdx]);

  const handleStartBattle = (index: number) => {
    const battle = STORY_BATTLES[index];
    if (index > storyProgress) return;
    if (playerMonsters.length === 0) {
      alert('Du brauchst mindestens ein Monster! Kaufe eines im Shop oder züchte es.');
      return;
    }
    EventBus.emit(GameEvents.OPEN_TEAM_SELECT, {
      enemyTeam: battle.enemyMonsterDefs,
      enemyLevels: battle.enemyLevels,
      rewardGold: battle.rewards.gold,
      rewardXp: battle.rewards.xp,
      rewardDiamonds: battle.rewards.diamonds,
      rewardMonsterDefId: battle.rewards.monsterDefId,
      storyIndex: index,
    });
  };

  // ── Compute serpentine node positions for the current world ──────────────
  const worldBattles = Array.from({ length: world.count }, (_, k) => world.first + k);
  const rows = Math.ceil(world.count / NODES_PER_ROW);
  const mapH = rows * ROW_H + 30;

  const nodePos = (localIdx: number) => {
    const row = Math.floor(localIdx / NODES_PER_ROW);
    let col = localIdx % NODES_PER_ROW;
    if (row % 2 === 1) col = NODES_PER_ROW - 1 - col;       // serpentine flip
    const xPct = (col + 0.5) / NODES_PER_ROW * 100;
    const y = row * ROW_H + 36;
    return { xPct, y };
  };

  // SVG path connecting consecutive nodes.
  const pathPoints = worldBattles.map((_, k) => nodePos(k));

  const worldCleared = worldBattles.filter(i => i < storyProgress).length;

  return (
    <div className="panel panel-modal panel-w-xl" style={{
      padding: 0, overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
    }}>
      <button className="close-btn" onClick={onClose} style={{ zIndex: 5 }}>✕</button>
      <HelpButton
        title="Story & Kämpfe"
        tips={[
          'Hier kämpfst du dich durch die Story-Karte — jeder Sieg schaltet den nächsten Kampf frei.',
          'Vor dem Kampf stellst du dein Team aus deinen Monstern zusammen.',
          'Im Kampf bestimmst du den Schaden über Minispiele — je besser dein Treffer, desto stärker der Angriff.',
          'Siege bringen XP, Gold und manchmal neue Monster.',
        ]}
      />

      {/* ── World banner ─────────────────────────────────────────────── */}
      <div style={{
        padding: '14px 18px 10px',
        background: `linear-gradient(135deg, ${world.bgFrom}, ${world.bgTo})`,
        borderBottom: `2px solid ${world.pathColor}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 30 }}>{world.emoji}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#fff', textShadow: '0 2px 6px rgba(0,0,0,0.6)' }}>
              {world.name}
            </div>
            <div style={{ fontSize: 11, color: world.accent }}>
              Welt {worldIdx + 1}/{STORY_WORLDS.length} · {worldCleared}/{world.count} erobert
            </div>
          </div>
          <div style={{ fontSize: 11, color: '#ddd', textAlign: 'right' }}>
            Gesamt<br /><b style={{ color: '#ffd700', fontSize: 14 }}>{storyProgress}/{STORY_BATTLES.length}</b>
          </div>
        </div>

        {/* World switcher */}
        <div style={{ display: 'flex', gap: 4, marginTop: 10, overflowX: 'auto', paddingBottom: 2 }}>
          {STORY_WORLDS.map((w, i) => {
            const wUnlocked = storyProgress >= w.first;
            const isCurrent = i === worldIdx;
            return (
              <button key={i}
                onClick={() => wUnlocked && setWorldIdx(i)}
                disabled={!wUnlocked}
                title={w.name}
                style={{
                  flexShrink: 0,
                  width: 34, height: 34, borderRadius: 9,
                  border: isCurrent ? `2px solid ${w.accent}` : '1px solid rgba(255,255,255,0.2)',
                  background: isCurrent ? w.pathColor : 'rgba(0,0,0,0.35)',
                  cursor: wUnlocked ? 'pointer' : 'not-allowed',
                  opacity: wUnlocked ? 1 : 0.35,
                  fontSize: 16, lineHeight: 1,
                  boxShadow: isCurrent ? `0 0 10px ${w.accent}` : undefined,
                }}>
                {wUnlocked ? w.emoji : '🔒'}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Scrollable map area ──────────────────────────────────────── */}
      <div ref={scrollRef} style={{
        flex: 1, minHeight: 0, overflowY: 'auto', position: 'relative',
        background: `radial-gradient(circle at 50% 0%, ${world.bgTo}55, ${world.bgFrom}) , #0a0512`,
      }}>
        <div style={{ position: 'relative', height: mapH, margin: '0 4px' }}>
          {/* Connector path */}
          <svg width="100%" height={mapH} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            {pathPoints.slice(0, -1).map((p, k) => {
              const n = pathPoints[k + 1];
              const cleared = worldBattles[k + 1] <= storyProgress;
              return (
                <line key={k}
                  x1={`${p.xPct}%`} y1={p.y}
                  x2={`${n.xPct}%`} y2={n.y}
                  stroke={cleared ? world.accent : 'rgba(255,255,255,0.15)'}
                  strokeWidth={cleared ? 4 : 3}
                  strokeDasharray={cleared ? undefined : '6 6'}
                  strokeLinecap="round"
                />
              );
            })}
          </svg>

          {/* Nodes */}
          {worldBattles.map((globalIdx, k) => {
            const { xPct, y } = nodePos(k);
            const cleared   = globalIdx < storyProgress;
            const available = globalIdx === storyProgress;
            const locked    = globalIdx > storyProgress;
            const battle    = STORY_BATTLES[globalIdx];
            const isBoss    = (k + 1) === world.count;
            const reward    = battle.rewards.monsterDefId;

            return (
              <button key={battle.id}
                onClick={() => !locked && setSelected(globalIdx)}
                disabled={locked}
                style={{
                  position: 'absolute',
                  left: `${xPct}%`, top: y,
                  transform: 'translate(-50%, -50%)',
                  width: isBoss ? NODE + 12 : NODE,
                  height: isBoss ? NODE + 12 : NODE,
                  borderRadius: '50%',
                  border: available ? `3px solid ${world.accent}` :
                          cleared ? '3px solid #44dd66' : '2px solid rgba(255,255,255,0.25)',
                  background: locked
                    ? 'radial-gradient(circle at 40% 30%, #333, #111)'
                    : `radial-gradient(circle at 40% 30%, ${world.pathColor}, ${world.bgTo})`,
                  color: '#fff',
                  cursor: locked ? 'not-allowed' : 'pointer',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  boxShadow: available ? `0 0 16px ${world.accent}` : cleared ? '0 0 8px #44dd66aa' : 'none',
                  animation: available ? 'storyPulse 1.4s ease-in-out infinite' : undefined,
                  padding: 0,
                }}>
                <span style={{ fontSize: isBoss ? 22 : 18, lineHeight: 1 }}>
                  {locked ? '🔒' : isBoss ? '👑' : cleared ? '✅' : '⚔️'}
                </span>
                <span style={{ fontSize: 9, fontWeight: 900, marginTop: 1 }}>
                  {globalIdx + 1}
                </span>
                {/* Reward egg badge */}
                {reward && !locked && (
                  <span style={{
                    position: 'absolute', top: -6, right: -6,
                    fontSize: 14, filter: 'drop-shadow(0 1px 2px #000)',
                  }}>🥚</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── PvP strip ────────────────────────────────────────────────── */}
      <div style={{
        padding: '8px 14px',
        borderTop: '1px solid rgba(255,255,255,0.12)',
        background: 'rgba(0,0,0,0.3)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{ fontSize: 11, color: '#aaa', flex: 1 }}>
          🏆 {trophies} · {getLeague(trophies)}
        </div>
        <button className="btn btn-info" style={{ padding: '6px 12px', fontSize: 12 }}
          onClick={() => {
            if (playerMonsters.length === 0) { alert('Du brauchst Monster!'); return; }
            EventBus.emit(GameEvents.OPEN_TEAM_SELECT, {
              enemyTeam: getAiTeam(trophies),
              enemyLevels: [getAiLevel(trophies), getAiLevel(trophies), getAiLevel(trophies)],
              rewardGold: 100 + trophies,
              rewardXp: 200 + trophies,
            });
          }}>
          ⚔️ PvP-Gegner suchen
        </button>
      </div>

      {/* ── Battle detail popup ──────────────────────────────────────── */}
      {selected !== null && (
        <BattleDetail
          index={selected}
          world={world}
          onClose={() => setSelected(null)}
          onStart={() => handleStartBattle(selected)}
        />
      )}
    </div>
  );
}

// ── Battle detail overlay ──────────────────────────────────────────────────
function BattleDetail({ index, world, onClose, onStart }: {
  index: number; world: StoryWorld; onClose: () => void; onStart: () => void;
}) {
  const battle = STORY_BATTLES[index];
  return (
    <div onClick={onClose} style={{
      position: 'absolute', inset: 0, zIndex: 10,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 360,
        background: `linear-gradient(160deg, ${world.bgFrom}, ${world.bgTo})`,
        border: `2px solid ${world.accent}`, borderRadius: 16,
        padding: 16, boxShadow: `0 0 30px ${world.pathColor}`,
      }}>
        <div style={{ fontSize: 16, fontWeight: 900, color: '#fff', marginBottom: 6 }}>
          {battle.name}
        </div>
        <div style={{ fontSize: 12, color: '#cbb6e8', fontStyle: 'italic', lineHeight: 1.5, marginBottom: 12 }}>
          {battle.description}
        </div>

        {/* Enemy line-up */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {battle.enemyMonsterDefs.map((id, j) => {
            const def = MONSTER_DEFS[id];
            return (
              <div key={j} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{
                  width: 52, height: 52, margin: '0 auto', borderRadius: '50%',
                  background: 'rgba(0,0,0,0.4)',
                  border: `2px solid ${def ? RARITY_COLORS[def.rarity] : '#555'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
                }}>
                  {MONSTER_EMOJI[id] ?? '👾'}
                </div>
                <div style={{ fontSize: 10, color: '#ddd', marginTop: 3 }}>{def?.name ?? id}</div>
                <div style={{ fontSize: 10, color: '#888' }}>Lv {battle.enemyLevels[j]}</div>
              </div>
            );
          })}
        </div>

        {/* Rewards */}
        <div style={{
          display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center',
          fontSize: 12, color: '#ffd700', marginBottom: 14,
          padding: '8px', background: 'rgba(0,0,0,0.3)', borderRadius: 8,
        }}>
          <span>🪙 {battle.rewards.gold.toLocaleString()}</span>
          <span>⭐ {battle.rewards.xp.toLocaleString()}</span>
          {battle.rewards.diamonds ? <span>💎 {battle.rewards.diamonds}</span> : null}
          {battle.rewards.monsterDefId && (
            <span style={{ color: '#88ffaa' }}>
              🥚 {MONSTER_EMOJI[battle.rewards.monsterDefId]} {MONSTER_DEFS[battle.rewards.monsterDefId]?.name}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" style={{ flex: 1, background: 'rgba(255,255,255,0.12)', color: '#ddd' }}
            onClick={onClose}>Zurück</button>
          <button className="btn btn-primary" style={{ flex: 2 }} onClick={onStart}>
            ⚔️ Kämpfen
          </button>
        </div>
      </div>
    </div>
  );
}

function getLeague(trophies: number): string {
  if (trophies >= 1000) return '🏆 Champion';
  if (trophies >= 600)  return '🥇 Gold';
  if (trophies >= 300)  return '🥈 Silver';
  if (trophies >= 100)  return '🥉 Bronze';
  return '🪨 Stone';
}

function getAiLevel(trophies: number): number {
  return Math.max(1, Math.min(100, Math.floor(trophies / 30)));
}

function getAiTeam(trophies: number): string[] {
  const maxRank = Math.min(7, Math.floor(trophies / 150));
  const eligible = ALL_MONSTER_IDS.filter((id: string) => {
    const def = MONSTER_DEFS[id];
    return def && RARITY_RANK[def.rarity] <= maxRank;
  });
  const pool = eligible.length >= 3 ? eligible : ALL_MONSTER_IDS;
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3);
}
