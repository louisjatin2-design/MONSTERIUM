import React, { useEffect, useState } from 'react';
import { useGameStore } from '@store/gameStore';
import { getActiveEvents, resolveOfferMonster, type EventOffer } from '@data/events';
import { MONSTER_DEFS } from '@data/monsters';
import { MONSTER_EMOJI } from '@data/monsterEmoji';
import { RARITY_COLORS } from '@data/rarities';
import '../styles/global.css';

interface EventsPanelProps { onClose: () => void; }

export function EventsPanel({ onClose }: EventsPanelProps) {
  const gold     = useGameStore(s => s.gold);
  const diamonds = useGameStore(s => s.diamonds);
  const spendGold = useGameStore(s => s.spendGold);
  const spendDiamonds = useGameStore(s => s.spendDiamonds);
  const addEgg   = useGameStore(s => s.addEgg);
  const [, force] = useState(0);
  const [claimed, setClaimed] = useState<string | null>(null);

  // Re-render each second to keep the countdown live.
  useEffect(() => {
    const id = setInterval(() => force(n => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const { events, endsAtMs } = getActiveEvents();
  const remainingMs = Math.max(0, endsAtMs - Date.now());

  const buy = (offer: EventOffer) => {
    const defId = resolveOfferMonster(offer);
    if (!defId) return;
    if (offer.costDiamonds) {
      if (!spendDiamonds(offer.costDiamonds)) return;
    } else if (offer.costGold) {
      if (!spendGold(offer.costGold)) return;
    } else return;
    addEgg(defId, offer.hatchSec, false);
    setClaimed(`${MONSTER_DEFS[defId]?.name ?? defId}`);
    setTimeout(() => setClaimed(null), 2500);
  };

  return (
    <div className="panel panel-modal panel-w-lg" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <button className="close-btn" onClick={onClose} style={{ zIndex: 5 }}>✕</button>

      {/* Banner */}
      <div style={{
        padding: '14px 18px 10px',
        background: 'linear-gradient(135deg, #2a1040, #140820)',
        borderBottom: '2px solid #cc66ff',
      }}>
        <div style={{ fontSize: 19, fontWeight: 900, color: '#dd99ff', textShadow: '0 2px 6px rgba(0,0,0,0.6)' }}>
          🎪 Briefing-Events
        </div>
        <div style={{ fontSize: 12, color: '#bb99cc', marginTop: 2 }}>
          Wechselt in {formatCountdown(remainingMs)} · 💎 {diamonds} · 🪙 {gold.toLocaleString()}
        </div>
      </div>

      {/* Claimed toast */}
      {claimed && (
        <div style={{
          margin: '10px 14px 0', padding: '8px 12px',
          background: 'rgba(68,221,102,0.18)', border: '1px solid #44dd66',
          borderRadius: 8, fontSize: 13, color: '#88ffaa', textAlign: 'center',
        }}>
          🥚 {claimed}-Ei erhalten! Es liegt im Lager bereit.
        </div>
      )}

      {/* Events list */}
      <div style={{ overflowY: 'auto', padding: 14, flex: 1, minHeight: 0 }}>
        {events.map(ev => (
          <div key={ev.id} style={{
            marginBottom: 14, borderRadius: 14, overflow: 'hidden',
            border: `1px solid ${ev.accent}66`,
            background: `linear-gradient(160deg, ${ev.accent}1a, rgba(0,0,0,0.25))`,
          }}>
            {/* Event header */}
            <div style={{ padding: '10px 12px', borderBottom: `1px solid ${ev.accent}44` }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: ev.accent }}>
                {ev.emoji} {ev.title}
              </div>
              <div style={{ fontSize: 11, color: '#bbb', fontStyle: 'italic', marginTop: 4, lineHeight: 1.45 }}>
                {ev.briefing}
              </div>
            </div>

            {/* Offers */}
            <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {ev.offers.map(offer => {
                const defId = offer.grantDefId;
                const def = defId ? MONSTER_DEFS[defId] : null;
                const affordable = offer.costDiamonds
                  ? diamonds >= offer.costDiamonds
                  : gold >= (offer.costGold ?? 0);
                const costLabel = offer.costDiamonds ? `💎 ${offer.costDiamonds}` : `🪙 ${offer.costGold?.toLocaleString()}`;
                return (
                  <div key={offer.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 10px', borderRadius: 10,
                    background: 'rgba(0,0,0,0.3)',
                    opacity: affordable ? 1 : 0.55,
                  }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                      background: 'rgba(255,255,255,0.06)',
                      border: `2px solid ${def ? RARITY_COLORS[def.rarity] : ev.accent}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
                    }}>
                      {defId ? (MONSTER_EMOJI[defId] ?? '🥚') : '🥚'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 'bold', fontSize: 13 }}>{offer.label}</div>
                      <div style={{ fontSize: 11, color: '#999' }}>{offer.description}</div>
                    </div>
                    <button className="btn btn-gold" disabled={!affordable}
                      style={{ fontSize: 12, padding: '6px 10px', whiteSpace: 'nowrap' }}
                      onClick={() => buy(offer)}>
                      {costLabel}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatCountdown(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (d > 0) return `${d}T ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
