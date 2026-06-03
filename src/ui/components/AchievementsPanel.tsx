import React, { useMemo } from 'react';
import { useGameStore } from '@store/gameStore';
import { MONSTER_DEFS } from '@data/monsters';
import { RARITY_RANK } from '@data/rarities';
import {
  ACHIEVEMENTS, achievementProgress, isAchievementComplete,
  type AchievementSnapshot,
} from '@data/achievements';
import { HelpButton } from './HelpButton';
import '../styles/global.css';

interface Props { onClose: () => void; }

// ── Achievements / Trophäen (Gruppe 5) ──────────────────────────────────────
export function AchievementsPanel({ onClose }: Props) {
  const stats = useGameStore(s => s.stats);
  const monsters = useGameStore(s => s.monsters);
  const claimed = useGameStore(s => s.claimedAchievements);
  const claimAchievement = useGameStore(s => s.claimAchievement);

  const snap: AchievementSnapshot = useMemo(() => {
    const owned = Object.values(monsters);
    let highestRarity = 0;
    for (const m of owned) {
      const def = MONSTER_DEFS[m.defId];
      if (def) highestRarity = Math.max(highestRarity, RARITY_RANK[def.rarity]);
    }
    return {
      evolutions: stats.evolutions, rankUps: stats.rankUps, bossRaidWins: stats.bossRaidWins,
      battlesWon: stats.battlesWon, breeds: stats.breeds, hatches: stats.hatches,
      buildingsBuilt: stats.buildingsBuilt, feeds: stats.feeds,
      monstersOwned: owned.length, highestRarityOwned: highestRarity,
    };
  }, [stats, monsters]);

  const claimedSet = useMemo(() => new Set(claimed), [claimed]);
  const total = ACHIEVEMENTS.length;
  const done = ACHIEVEMENTS.filter(a => isAchievementComplete(a, snap)).length;

  return (
    <div className="panel panel-modal panel-w-lg" style={{ display: 'flex', flexDirection: 'column' }}>
      <button className="close-btn" onClick={onClose}>✕</button>
      <HelpButton
        title="Trophäen"
        tips={[
          'Erfülle Meilensteine, um Trophäen und einmalige Belohnungen zu erhalten.',
          'Abholbare Trophäen zeigen einen „Belohnung holen"-Button.',
        ]}
      />
      <div className="panel-title">🏆 Trophäen ({done}/{total})</div>

      <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, paddingRight: 4 }}>
        {ACHIEVEMENTS.map(a => {
          const prog = Math.min(achievementProgress(a, snap), a.threshold);
          const complete = isAchievementComplete(a, snap);
          const isClaimed = claimedSet.has(a.id);
          const pct = Math.round((prog / a.threshold) * 100);
          const reward = [
            a.reward.gold ? `🪙 ${a.reward.gold}` : null,
            a.reward.diamonds ? `💎 ${a.reward.diamonds}` : null,
            a.reward.food ? `🌾 ${a.reward.food}` : null,
          ].filter(Boolean).join('  ');
          return (
            <div key={a.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: 10, borderRadius: 10,
              background: isClaimed ? 'rgba(80,200,120,0.08)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${complete && !isClaimed ? '#ffd70088' : 'rgba(255,255,255,0.08)'}`,
              opacity: isClaimed ? 0.7 : 1,
            }}>
              <div style={{ fontSize: 28 }}>{a.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: '#fff' }}>{a.name}</div>
                <div style={{ fontSize: 11, color: '#aaa' }}>{a.description}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <div style={{ flex: 1, height: 6, background: 'rgba(0,0,0,0.4)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: complete ? '#44dd88' : '#ffaa44' }} />
                  </div>
                  <span style={{ fontSize: 10, color: '#888' }}>{prog}/{a.threshold}</span>
                </div>
                {reward && <div style={{ fontSize: 10, color: '#ffd700', marginTop: 3 }}>Belohnung: {reward}</div>}
              </div>
              {isClaimed ? (
                <span style={{ fontSize: 12, color: '#44dd88', fontWeight: 900 }}>✓</span>
              ) : complete ? (
                <button className="btn btn-gold" style={{ fontSize: 11, padding: '4px 10px' }}
                  onClick={() => claimAchievement(a.id)}>Holen</button>
              ) : (
                <span style={{ fontSize: 11, color: '#666' }}>🔒</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
