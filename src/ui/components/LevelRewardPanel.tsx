import React, { useState } from 'react';
import { useGameStore } from '@store/gameStore';
import { getLevelReward, nextEggMilestone } from '@data/levelRewards';
import { MONSTER_DEFS } from '@data/monsters';
import { MONSTER_EMOJI } from '@data/monsterEmoji';
import { RARITY_COLORS } from '@data/rarities';
import '../styles/global.css';

interface LevelRewardPanelProps { onClose: () => void; }

export function LevelRewardPanel({ onClose }: LevelRewardPanelProps) {
  const pending      = useGameStore(s => s.pendingLevelRewards);
  const playerLevel  = useGameStore(s => s.playerLevel);
  const claimReward  = useGameStore(s => s.claimLevelReward);
  const [justClaimed, setJustClaimed] = useState<number | null>(null);

  const sorted = [...pending].sort((a, b) => a - b);
  const nextMilestone = nextEggMilestone(playerLevel);

  const claimAll = () => {
    for (const lvl of sorted) claimReward(lvl);
    onClose();
  };

  return (
    <div className="panel panel-modal panel-w-sm" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <button className="close-btn" onClick={onClose} style={{ zIndex: 5 }}>✕</button>

      {/* Banner */}
      <div style={{
        padding: '16px 18px 12px',
        background: 'linear-gradient(135deg, #3a2a00, #1a1400)',
        borderBottom: '2px solid #ffd700',
      }}>
        <div style={{ fontSize: 20, fontWeight: 900, color: '#ffd700', textShadow: '0 2px 6px rgba(0,0,0,0.6)' }}>
          🎉 Account-Belohnungen
        </div>
        <div style={{ fontSize: 12, color: '#ddc', marginTop: 2 }}>
          Spielerlevel {playerLevel}
          {sorted.length > 0 && ` · ${sorted.length} Belohnung${sorted.length > 1 ? 'en' : ''} bereit`}
        </div>
      </div>

      <div style={{ overflowY: 'auto', padding: 14, maxHeight: 'calc(min(88vh, 100vh - 150px) - 200px)' }}>
        {sorted.length === 0 && (
          <div style={{ textAlign: 'center', color: '#888', padding: 24 }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>⭐</div>
            Keine offenen Belohnungen.<br />
            Sammle XP aus Kämpfen, um aufzusteigen!
            {nextMilestone && (
              <div style={{ marginTop: 12, fontSize: 12, color: '#ffd700' }}>
                Nächstes Ei-Geschenk bei Level {nextMilestone} 🥚
              </div>
            )}
          </div>
        )}

        {sorted.map(level => {
          const reward = getLevelReward(level);
          const eggDef = reward.eggDefId ? MONSTER_DEFS[reward.eggDefId] : null;
          return (
            <div key={level} className="monster-card" style={{
              marginBottom: 8, padding: 12,
              border: reward.eggDefId ? '1px solid #ffd70066' : undefined,
              opacity: justClaimed === level ? 0.4 : 1,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontWeight: 900, color: '#ffd700' }}>
                  Level {level}
                  {reward.headline && (
                    <span style={{ fontSize: 11, color: '#ffaa44', marginLeft: 6 }}>{reward.headline}</span>
                  )}
                </div>
                <button className="btn btn-gold" style={{ padding: '4px 12px', fontSize: 12 }}
                  onClick={() => { setJustClaimed(level); claimReward(level); }}>
                  Abholen
                </button>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8, fontSize: 13 }}>
                <span style={{ color: '#ffd700' }}>🪙 {reward.gold.toLocaleString()}</span>
                <span style={{ color: '#ff9966' }}>🌾 {reward.food.toLocaleString()}</span>
                {reward.diamonds > 0 && <span style={{ color: '#44ddff' }}>💎 {reward.diamonds}</span>}
                {eggDef && (
                  <span style={{ color: RARITY_COLORS[eggDef.rarity], display: 'flex', alignItems: 'center', gap: 3 }}>
                    🥚 {MONSTER_EMOJI[reward.eggDefId!]} {eggDef.name}
                    <span style={{ fontSize: 10, opacity: 0.8 }}>({eggDef.rarity})</span>
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {sorted.length > 1 && (
        <div style={{ padding: 12, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={claimAll}>
            ✨ Alle {sorted.length} abholen
          </button>
        </div>
      )}
    </div>
  );
}
