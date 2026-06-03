import React, { useEffect } from 'react';
import { useGameStore } from '@store/gameStore';
import {
  SEASON_TIERS, SEASON_DAILY_TASKS, SEASON_LENGTH_DAYS, MS_PER_DAY,
  seasonIdOf, rewardLabel,
} from '@data/seasonPass';
import { HelpButton } from './HelpButton';
import '../styles/global.css';

interface Props { onClose: () => void; }

// ── Gruppe 5 — Season Pass (zeitlich begrenzter Battle Pass) ────────────────
export function SeasonPassPanel({ onClose }: Props) {
  const seasonPass = useGameStore(s => s.seasonPass);
  const stats = useGameStore(s => s.stats);
  const ensureSeason = useGameStore(s => s.ensureSeason);
  const claimDaily = useGameStore(s => s.claimSeasonDaily);
  const claimTier = useGameStore(s => s.claimSeasonTier);

  // Saison/Tagesaufgaben beim Öffnen rollen (Ablauf + Tageswechsel).
  useEffect(() => { ensureSeason(); }, [ensureSeason]);

  const daysLeft = Math.max(
    0,
    Math.ceil((seasonPass.startMs + SEASON_LENGTH_DAYS * MS_PER_DAY - Date.now()) / MS_PER_DAY),
  );
  const maxXp = SEASON_TIERS[SEASON_TIERS.length - 1].xpNeeded;
  const pct = Math.min(100, Math.round((seasonPass.xp / maxXp) * 100));

  const taskProgress = (stat: string, goal: number) => {
    const p = (stats as any)[stat] - (seasonPass.dayBaseline[stat] ?? 0);
    return Math.max(0, Math.min(goal, p));
  };

  return (
    <div className="panel panel-modal panel-w-lg" style={{ padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <button className="close-btn" onClick={onClose} style={{ zIndex: 5 }}>✕</button>
      <HelpButton
        title="Season Pass"
        tips={[
          'Erfülle tägliche Aufgaben, um Saison-XP zu sammeln.',
          'Mit steigender XP schaltest du gestaffelte Belohnungs-Stufen frei.',
          'Eine Saison ist zeitlich begrenzt — nicht abgeholte Belohnungen verfallen beim Saisonende!',
        ]}
      />

      {/* Header */}
      <div style={{ padding: '14px 18px 10px', background: 'linear-gradient(135deg, #2a1148, #160828)', borderBottom: '2px solid #7744cc' }}>
        <div className="panel-title" style={{ marginBottom: 8, borderBottom: 'none', paddingBottom: 0 }}>
          🎟️ Season Pass — {seasonIdOf(seasonPass.startMs)}
          <span style={{ fontSize: 11, color: '#caa', fontWeight: 400, marginLeft: 8 }}>
            noch {daysLeft} Tage
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, height: 8, background: 'rgba(0,0,0,0.4)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #aa55ff, #ffd700)', borderRadius: 4 }} />
          </div>
          <div style={{ fontSize: 12, color: '#ffd700', fontWeight: 900, whiteSpace: 'nowrap' }}>
            {seasonPass.xp} XP
          </div>
        </div>
      </div>

      <div style={{ overflowY: 'auto', padding: 14, flex: 1, minHeight: 0 }}>
        {/* Tägliche Aufgaben */}
        <div style={{ fontSize: 13, fontWeight: 900, color: '#ffd700', letterSpacing: '0.06em', marginBottom: 8 }}>
          TÄGLICHE AUFGABEN
        </div>
        {SEASON_DAILY_TASKS.map(t => {
          const prog = taskProgress(t.stat, t.goal);
          const done = prog >= t.goal;
          const claimed = seasonPass.claimedDailies.includes(t.id);
          return (
            <div key={t.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6,
              background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: '8px 10px',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: '#fff', fontWeight: 700 }}>{t.label}</div>
                <div style={{ fontSize: 11, color: '#9aa' }}>{prog}/{t.goal} · +{t.xp} XP</div>
              </div>
              <button
                className={`btn ${claimed ? '' : done ? 'btn-primary' : ''}`}
                disabled={!done || claimed}
                onClick={() => claimDaily(t.id)}
                style={{ fontSize: 11, padding: '5px 10px' }}>
                {claimed ? '✓ Erledigt' : done ? 'Einlösen' : 'Offen'}
              </button>
            </div>
          );
        })}

        {/* Belohnungs-Stufen */}
        <div style={{ fontSize: 13, fontWeight: 900, color: '#ffd700', letterSpacing: '0.06em', margin: '14px 0 8px' }}>
          BELOHNUNGEN
        </div>
        {SEASON_TIERS.map(t => {
          const reached = seasonPass.xp >= t.xpNeeded;
          const claimed = seasonPass.claimedTiers.includes(t.tier);
          return (
            <div key={t.tier} style={{
              display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6,
              background: claimed ? 'rgba(80,200,120,0.08)' : 'rgba(255,255,255,0.04)',
              borderRadius: 8, padding: '8px 10px',
              border: reached && !claimed ? '1px solid #ffd70066' : '1px solid rgba(255,255,255,0.06)',
              opacity: reached ? 1 : 0.6,
            }}>
              <div style={{
                width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: reached ? 'linear-gradient(160deg,#ffd700,#cc8800)' : '#333',
                color: '#1a1000', fontWeight: 900, fontSize: 13,
              }}>{t.tier}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, color: '#fff' }}>{rewardLabel(t.reward)}</div>
                <div style={{ fontSize: 10, color: '#9aa' }}>{t.xpNeeded} XP</div>
              </div>
              <button
                className={`btn ${claimed ? '' : reached ? 'btn-gold' : ''}`}
                disabled={!reached || claimed}
                onClick={() => claimTier(t.tier)}
                style={{ fontSize: 11, padding: '5px 10px' }}>
                {claimed ? '✓' : reached ? 'Abholen' : '🔒'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
