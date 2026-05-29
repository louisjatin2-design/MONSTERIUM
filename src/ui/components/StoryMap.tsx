import React from 'react';
import { useGameStore } from '@store/gameStore';
import { STORY_BATTLES } from '@data/storyBattles';
import { MONSTER_DEFS, ALL_MONSTER_IDS } from '@data/monsters';
import { RARITY_RANK } from '@data/rarities';
import { EventBus, GameEvents } from '@game/EventBus';
import '../styles/global.css';

interface StoryMapProps { onClose: () => void; }

export function StoryMap({ onClose }: StoryMapProps) {
  const { storyProgress, monsters, trophies } = useGameStore(s => ({
    storyProgress: s.storyProgress,
    monsters: s.monsters,
    trophies: s.trophies,
  }));
  const advanceStory = useGameStore(s => s.advanceStory);
  const addGold = useGameStore(s => s.addGold);
  const addPlayerXp = useGameStore(s => s.addPlayerXp);
  const addEgg = useGameStore(s => s.addEgg);

  const playerMonsters = Object.values(monsters);

  const handleStartBattle = (battle: typeof STORY_BATTLES[0], index: number) => {
    if (index > storyProgress) return;
    if (playerMonsters.length === 0) {
      alert('You need at least one monster to battle! Get one from the Shop or breed one.');
      return;
    }
    const playerTeam = playerMonsters.slice(0, 3).map(m => m.instanceId);
    EventBus.emit(GameEvents.START_BATTLE, {
      playerTeam,
      enemyTeam: battle.enemyMonsterDefs,
      enemyLevels: battle.enemyLevels,
      rewardGold: battle.rewards.gold,
      rewardXp: battle.rewards.xp,
      rewardMonsterDefId: battle.rewards.monsterDefId,
    });
    onClose();
  };

  return (
    <div className="panel" style={{
      left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
      width: 560, maxHeight: '85vh', padding: 20,
    }}>
      <button className="close-btn" onClick={onClose}>✕</button>
      <div className="panel-title">⚔️ Story Mode ({storyProgress}/{STORY_BATTLES.length} cleared)</div>

      <div style={{ overflowY: 'auto', maxHeight: 'calc(85vh - 100px)' }}>
        {STORY_BATTLES.map((battle, i) => {
          const cleared = i < storyProgress;
          const available = i === storyProgress;
          const locked = i > storyProgress;

          return (
            <div key={battle.id} className="monster-card" style={{
              marginBottom: 8,
              opacity: locked ? 0.4 : 1,
              cursor: available ? 'pointer' : 'default',
              borderColor: cleared ? 'rgba(68,255,68,0.3)' : available ? 'rgba(255,215,0,0.3)' : undefined,
            }}
              onClick={() => !locked && handleStartBattle(battle, i)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: 16, marginRight: 8 }}>
                    {cleared ? '✅' : available ? '⚔️' : '🔒'}
                  </span>
                  <span style={{ fontWeight: 'bold' }}>{battle.name}</span>
                </div>
                <div style={{ fontSize: 12, color: '#aaa' }}>
                  {battle.rewards.monsterDefId && (
                    <span style={{ color: '#ffd700', marginRight: 8 }}>
                      🥚 {MONSTER_DEFS[battle.rewards.monsterDefId]?.name}
                    </span>
                  )}
                  🪙 {battle.rewards.gold} · ⭐ {battle.rewards.xp} XP
                </div>
              </div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{battle.description}</div>
              <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
                Enemies: {battle.enemyMonsterDefs.map((id, j) =>
                  `${MONSTER_DEFS[id]?.name ?? id} (Lv ${battle.enemyLevels[j]})`
                ).join(', ')}
              </div>
            </div>
          );
        })}
      </div>

      {/* PvP section */}
      <div style={{ marginTop: 16, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 12 }}>
        <div style={{ fontWeight: 'bold', color: '#ffd700', marginBottom: 8 }}>🏆 PvP Mode</div>
        <div style={{ fontSize: 13, color: '#888', marginBottom: 8 }}>
          Trophies: {trophies} · League: {getLeague(trophies)}
        </div>
        <button className="btn btn-info" style={{ width: '100%' }}
          onClick={() => {
            if (playerMonsters.length === 0) { alert('Need monsters!'); return; }
            const enemyTeam = getAiTeam(trophies);
            EventBus.emit(GameEvents.START_BATTLE, {
              playerTeam: playerMonsters.slice(0, 3).map(m => m.instanceId),
              enemyTeam,
              enemyLevels: [getAiLevel(trophies), getAiLevel(trophies), getAiLevel(trophies)],
              rewardGold: 100 + trophies,
              rewardXp: 200 + trophies,
            });
            onClose();
          }}>
          ⚔️ Find Opponent
        </button>
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
  return Math.max(1, Math.min(20, Math.floor(trophies / 60)));
}

function getAiTeam(trophies: number): string[] {
  const maxRank = Math.min(7, Math.floor(trophies / 150));
  const eligible = ALL_MONSTER_IDS.filter((id: string) => {
    const def = MONSTER_DEFS[id];
    return def && RARITY_RANK[def.rarity] <= maxRank;
  });
  const shuffled = [...eligible].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3);
}
