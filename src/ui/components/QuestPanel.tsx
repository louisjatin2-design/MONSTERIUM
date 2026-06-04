import React, { useMemo, useState } from 'react';
import { useGameStore } from '@store/gameStore';
import {
  QUESTS, QUEST_CATEGORIES, questProgress, isQuestComplete,
  type QuestProgressSnapshot, type QuestDef,
} from '@data/quests';
import { MONSTER_DEFS } from '@data/monsters';
import { MONSTER_EMOJI } from '@data/monsterEmoji';
import { RARITY_RANK } from '@data/rarities';
import { HelpButton } from './HelpButton';
import { AchievementsContent } from './AchievementsPanel';
import '../styles/global.css';

interface QuestPanelProps { onClose: () => void; }

// Merged Aufträge + Trophäen panel — the two were folded together so the bottom
// rail only needs one "Quests" button (Trophäen is reached via the tab here).
export function QuestPanel({ onClose }: QuestPanelProps) {
  const [tab, setTab] = useState<'quests' | 'trophies'>('quests');
  // Select primitives individually so Zustand never sees a fresh object.
  const playerLevel    = useGameStore(s => s.playerLevel);
  const storyProgress  = useGameStore(s => s.storyProgress);
  const pokedexSeen    = useGameStore(s => s.pokedexSeen.length);
  const monstersOwned  = useGameStore(s => Object.keys(s.monsters).length);
  const monsters       = useGameStore(s => s.monsters);
  const stats          = useGameStore(s => s.stats);
  const claimed        = useGameStore(s => s.claimedQuests);
  const claimQuest     = useGameStore(s => s.claimQuest);
  const [filter, setFilter] = useState<QuestDef['category'] | 'All'>('All');

  const snap: QuestProgressSnapshot = useMemo(() => ({
    playerLevel, storyProgress, pokedexSeen, monstersOwned,
    buildingsBuilt: stats.buildingsBuilt,
    feeds: stats.feeds, breeds: stats.breeds, hatches: stats.hatches,
    collects: stats.collects, battlesWon: stats.battlesWon,
    highestRarityOwned: Object.values(monsters).reduce((max, m) => {
      const def = MONSTER_DEFS[m.defId];
      return def ? Math.max(max, RARITY_RANK[def.rarity]) : max;
    }, 0),
  }), [playerLevel, storyProgress, pokedexSeen, monstersOwned, stats, monsters]);

  const claimableCount = useMemo(
    () => QUESTS.filter(q => !claimed.includes(q.id) && isQuestComplete(q, snap)).length,
    [claimed, snap],
  );

  // Sort: claimable first, then in-progress, then claimed.
  const ordered = useMemo(() => {
    const rank = (q: QuestDef) => {
      if (claimed.includes(q.id)) return 2;
      if (isQuestComplete(q, snap)) return 0;
      return 1;
    };
    return [...QUESTS]
      .filter(q => filter === 'All' || q.category === filter)
      .sort((a, b) => rank(a) - rank(b));
  }, [filter, claimed, snap]);

  return (
    <div className="panel panel-modal panel-w-lg" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <button className="close-btn" onClick={onClose} style={{ zIndex: 5 }}>✕</button>
      <HelpButton
        title="Quests"
        tips={[
          'Quests geben dir Ziele wie Züchten, Kämpfen oder Bauen — der Balken zeigt deinen Fortschritt.',
          'Ist eine Quest erfüllt, tippe „Abholen", um die Belohnung zu kassieren.',
          'Quests sind nach Kategorien sortiert; erledige sie für Gold, XP und Diamanten.',
        ]}
      />

      {/* Banner */}
      <div style={{
        padding: '14px 18px 10px',
        background: 'linear-gradient(135deg, #102a18, #06160d)',
        borderBottom: '2px solid #44bb66',
      }}>
        {/* Tabs: Aufträge | Trophäen */}
        <div style={{ display: 'flex', gap: 8 }}>
          <TabChip label="📋 Aufträge" active={tab === 'quests'} onClick={() => setTab('quests')} />
          <TabChip label="🏆 Trophäen" active={tab === 'trophies'} onClick={() => setTab('trophies')} />
        </div>

        {tab === 'quests' && (
          <>
            <div style={{ fontSize: 12, color: '#9cc', marginTop: 8 }}>
              {claimableCount > 0
                ? `${claimableCount} Belohnung${claimableCount > 1 ? 'en' : ''} bereit zum Abholen!`
                : 'Erfülle Ziele für Belohnungen.'}
            </div>

            {/* Category filter */}
            <div style={{ display: 'flex', gap: 4, marginTop: 10, flexWrap: 'wrap' }}>
              <CatChip label="Alle" active={filter === 'All'} onClick={() => setFilter('All')} />
              {QUEST_CATEGORIES.map(c => (
                <CatChip key={c} label={c} active={filter === c} onClick={() => setFilter(c)} />
              ))}
            </div>
          </>
        )}
      </div>

      {tab === 'trophies' ? (
        <div style={{ overflowY: 'auto', padding: 14, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <AchievementsContent />
        </div>
      ) : (
      /* Quest list */
      <div style={{ overflowY: 'auto', padding: 14, flex: 1, minHeight: 0 }}>
        {ordered.map(q => {
          const cur = questProgress(q, snap);
          const done = isQuestComplete(q, snap);
          const isClaimed = claimed.includes(q.id);
          const pct = Math.round((cur / q.goal) * 100);
          const eggDef = q.reward.eggDefId ? MONSTER_DEFS[q.reward.eggDefId] : null;

          return (
            <div key={q.id} className="monster-card" style={{
              marginBottom: 8, padding: 12,
              opacity: isClaimed ? 0.5 : 1,
              border: done && !isClaimed ? '1px solid #44dd66' : undefined,
              boxShadow: done && !isClaimed ? '0 0 10px #44dd6655' : undefined,
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={{ fontSize: 24, lineHeight: 1 }}>{q.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 900, fontSize: 14 }}>
                    {q.title}
                    {isClaimed && <span style={{ color: '#44dd66', marginLeft: 6, fontSize: 12 }}>✓ Erledigt</span>}
                  </div>
                  <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>{q.description}</div>

                  {/* Progress bar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                    <div style={{ flex: 1, height: 7, background: 'rgba(0,0,0,0.4)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{
                        width: `${pct}%`, height: '100%', borderRadius: 4,
                        background: done ? '#44dd66' : 'linear-gradient(90deg, #44aaff, #aa44ff)',
                      }} />
                    </div>
                    <span style={{ fontSize: 10, color: '#aaa', whiteSpace: 'nowrap' }}>
                      {cur}/{q.goal}
                    </span>
                  </div>

                  {/* Reward line */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6, fontSize: 11, color: '#ccc' }}>
                    {q.reward.gold ? <span style={{ color: '#ffd700' }}>🪙 {q.reward.gold.toLocaleString()}</span> : null}
                    {q.reward.food ? <span style={{ color: '#ff9966' }}>🌾 {q.reward.food.toLocaleString()}</span> : null}
                    {q.reward.diamonds ? <span style={{ color: '#44ddff' }}>💎 {q.reward.diamonds}</span> : null}
                    {eggDef ? <span style={{ color: '#88ffaa' }}>🥚 {MONSTER_EMOJI[q.reward.eggDefId!]} {eggDef.name}</span> : null}
                  </div>
                </div>

                {/* Claim button */}
                {!isClaimed && (
                  <button className="btn btn-primary" disabled={!done}
                    style={{ padding: '6px 12px', fontSize: 12, alignSelf: 'center', opacity: done ? 1 : 0.4 }}
                    onClick={() => claimQuest(q.id)}>
                    {done ? 'Abholen' : '…'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}

function TabChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: '8px 0', fontSize: 13, fontWeight: 900, cursor: 'pointer',
      border: 'none', borderRadius: '8px 8px 0 0',
      background: active ? 'rgba(68,221,102,0.22)' : 'rgba(0,0,0,0.25)',
      color: active ? '#66ff99' : '#7a8a80',
      borderBottom: active ? '2px solid #66ff99' : '2px solid transparent',
    }}>
      {label}
    </button>
  );
}

function CatChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: '3px 10px', fontSize: 11, fontWeight: 900, borderRadius: 7, cursor: 'pointer',
      border: `1px solid ${active ? '#44dd66' : 'rgba(255,255,255,0.15)'}`,
      background: active ? 'rgba(68,221,102,0.2)' : 'rgba(0,0,0,0.3)',
      color: active ? '#66ff99' : '#999',
    }}>
      {label}
    </button>
  );
}
