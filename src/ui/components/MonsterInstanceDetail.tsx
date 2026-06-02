import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useGameStore } from '@store/gameStore';
import { MONSTER_DEFS } from '@data/monsters';
import { ATTACKS } from '@data/attacks';
import { RARITY_COLORS, RARITY_RANK } from '@data/rarities';
import { ELEMENT_CSS_COLORS } from '@data/elements';
import { TRAITS } from '@data/traits';
import { STATUS_EFFECTS } from '@data/statusEffects';
import { instanceStats } from '@systems/StatSystem';
import { calculateFeedCost, calculateSellValue } from '@systems/EconomySystem';
import {
  isEvolutionReady, getNextEvolutionStage, getEvolutionStageName,
  EVOLUTION_LEVELS, getTrainableAttacks, getAttackTrainCost,
} from '@systems/ProgressionSystem';
import type { MoveDef } from '@gtypes/game';
import { HelpButton } from './HelpButton';
import '../styles/global.css';

interface Props {
  instanceId: string;
  onClose: () => void;
}

type Tab = 'info' | 'skills';

// Monster-Legends-style detail screen for a single owned monster.
export function MonsterInstanceDetail({ instanceId, onClose }: Props) {
  const monster   = useGameStore(s => s.monsters[instanceId]);
  const food      = useGameStore(s => s.food);
  const gold      = useGameStore(s => s.gold);
  const diamonds  = useGameStore(s => s.diamonds);
  const sellMonster = useGameStore(s => s.sellMonster);
  const evolveMonster = useGameStore(s => s.evolveMonster);
  const removeFromHabitat = useGameStore(s => s.removeFromHabitat);
  const equipAttack = useGameStore(s => s.equipAttack);
  const unequipAttack = useGameStore(s => s.unequipAttack);
  const trainAttack = useGameStore(s => s.trainAttack);
  const [tab, setTab] = useState<Tab>('info');
  const [openMove, setOpenMove] = useState<string | null>(null);

  // Hold-to-feed: keep the button pressed to feed repeatedly, getting
  // exponentially faster the longer it's held. Each tick reads the latest
  // store state directly so it always uses the current level/cost/food and
  // stops the moment food runs out or max level is reached.
  const FEED_START_DELAY = 360; // ms before the first auto-repeat
  const FEED_MIN_DELAY   = 40;  // fastest possible repeat
  const FEED_ACCEL       = 0.82; // each repeat 18% faster (exponential ramp)
  const holdTimer = useRef<number | null>(null);
  const holdDelay = useRef(FEED_START_DELAY);

  const stopFeeding = useCallback(() => {
    if (holdTimer.current !== null) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  }, []);

  // Perform one feed if affordable; returns false when it can't feed anymore.
  const feedOnce = useCallback(() => {
    const st = useGameStore.getState();
    const m = st.monsters[instanceId];
    if (!m || m.level >= 100) return false;
    const cost = calculateFeedCost(m.level);
    if (st.food < cost) return false;
    st.feedMonster(instanceId, cost);
    return true;
  }, [instanceId]);

  const feedTick = useCallback(() => {
    if (!feedOnce()) { stopFeeding(); return; }
    holdDelay.current = Math.max(FEED_MIN_DELAY, holdDelay.current * FEED_ACCEL);
    holdTimer.current = window.setTimeout(feedTick, holdDelay.current);
  }, [feedOnce, stopFeeding]);

  const startFeeding = useCallback(() => {
    stopFeeding();
    if (!feedOnce()) return; // single tap feeds once
    holdDelay.current = FEED_START_DELAY;
    holdTimer.current = window.setTimeout(feedTick, holdDelay.current);
  }, [feedOnce, feedTick, stopFeeding]);

  // Always clean up a running hold timer on unmount.
  useEffect(() => stopFeeding, [stopFeeding]);

  if (!monster) return null;
  const def = MONSTER_DEFS[monster.defId];
  if (!def) return null;

  const stats = instanceStats(monster);
  const feedCost = calculateFeedCost(monster.level);
  const canFeed = food >= feedCost && monster.level < 100;
  const sellValue = calculateSellValue(RARITY_RANK[def.rarity], monster.level);
  const accent = ELEMENT_CSS_COLORS[def.elements[0]];

  // 4 feed-cycle steps to the next level.
  const need = Math.floor(100 * Math.pow(monster.level, 1.5));
  const perFeed = Math.max(1, Math.ceil(need / 4));
  const feedsDone = Math.min(4, Math.round(monster.xp / perFeed));

  const equipped = monster.equippedMoveIds.map(id => ATTACKS[id]).filter(Boolean) as MoveDef[];
  // Known but not currently equipped.
  const benched = monster.knownMoveIds
    .filter(id => !monster.equippedMoveIds.includes(id))
    .map(id => ATTACKS[id]).filter(Boolean) as MoveDef[];
  const slotsFree = monster.equippedMoveIds.length < monster.maxAttackSlots;
  // Attacks this monster could still learn (element-matched, not yet known).
  const trainable = getTrainableAttacks(monster)
    .map(id => ATTACKS[id]).filter(Boolean) as MoveDef[];

  // Evolution state.
  const evoReady = isEvolutionReady(monster);
  const nextStage = getNextEvolutionStage(monster.stage);

  return (
    <div className="mdetail">
      {/* Back to the habitat — this is its own screen, not a popup. */}
      <button className="mdetail-back" onClick={onClose} title="Zurück">←</button>
      <HelpButton
        title="Monster-Details"
        tips={[
          'Füttere dein Monster mit Futter, um XP zu sammeln und es aufzuleveln — vier Fütterungen pro Level.',
          'Bei bestimmten Leveln kann das Monster sich entwickeln und neue Angriffs-Slots freischalten.',
          'Über „Angriffe" trainierst und rüstest du die Attacken für den Kampf aus.',
          'Beim Verkauf bekommst du für höhere Monster-Level deutlich mehr Gold.',
        ]}
        rightOffset={14}
      />

      {/* ── LEFT: the monster itself ───────────────────────────────── */}
      <div className="mdetail-left">
        {/* Big portrait with elemental glow + a soft pedestal. */}
        <div style={{
          width: 'min(220px, 40vw)', height: 'min(220px, 40vw)', borderRadius: '50%',
          background: `radial-gradient(circle at 38% 30%, ${accent}, ${accent}66)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 'min(120px, 22vw)',
          boxShadow: `0 0 50px ${accent}aa, inset 0 6px 20px rgba(0,0,0,0.4)`,
          border: `4px solid ${accent}`,
        }}>👾</div>

        <div style={{ fontSize: 26, fontWeight: 900, color: '#fff', textAlign: 'center' }}>
          {monster.name}
          <span className="rarity-badge" style={{ background: RARITY_COLORS[def.rarity], color: '#000', marginLeft: 8 }}>
            {def.rarity}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          {def.elements.map(el => (
            <span key={el} style={{
              padding: '3px 10px', borderRadius: 6, fontSize: 12,
              background: ELEMENT_CSS_COLORS[el] + '33',
              border: `1px solid ${ELEMENT_CSS_COLORS[el]}`, color: ELEMENT_CSS_COLORS[el],
            }}>{el}</span>
          ))}
        </div>

        <div style={{ textAlign: 'center' }}>
          <span style={{ fontSize: 34, fontWeight: 900, color: '#ffd700' }}>
            Lv {monster.level}
          </span>
          <span style={{ fontSize: 15, color: '#888' }}> / 100</span>
          <div style={{ fontSize: 13, color: '#bbb' }}>{monster.stage}</div>
        </div>

        {/* Level-up: feed progress (4 cycles per level) + Füttern button. */}
        <div style={{
          width: '100%', maxWidth: 320,
          background: 'rgba(0,0,0,0.3)', borderRadius: 12, padding: 12,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: '#ccc' }}>
              {monster.level >= 100 ? 'MAX LEVEL' : `Fortschritt zu Lv ${monster.level + 1}`}
            </span>
            <span style={{ fontSize: 11, color: '#888' }}>{feedsDone}/4</span>
          </div>
          <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
            {[0, 1, 2, 3].map(i => (
              <div key={i} style={{
                flex: 1, height: 10, borderRadius: 4,
                background: i < feedsDone ? '#4488ff' : '#333',
              }} />
            ))}
          </div>
          <button className="btn btn-primary" style={{ width: '100%', touchAction: 'none', userSelect: 'none' }}
            disabled={!canFeed}
            onPointerDown={startFeeding}
            onPointerUp={stopFeeding}
            onPointerLeave={stopFeeding}
            onPointerCancel={stopFeeding}>
            {monster.level >= 100 ? 'Max-Level erreicht' : `🌾 Füttern halten (${feedCost})`}
          </button>
          {nextStage && (
            evoReady ? (
              <button className="btn btn-purple" style={{ width: '100%', marginTop: 8 }}
                onClick={() => evolveMonster(instanceId)}>
                ✨ Entwickeln zu {getEvolutionStageName(monster.defId, nextStage)}
              </button>
            ) : (
              <div style={{ fontSize: 11, color: '#888', textAlign: 'center', marginTop: 8 }}>
                Entwicklung ({getEvolutionStageName(monster.defId, nextStage)}) bei Lv {EVOLUTION_LEVELS[nextStage]}
              </div>
            )
          )}
        </div>
      </div>

      {/* ── RIGHT: info / skills card with tabs ────────────────────── */}
      <div className="mdetail-right">
        <div className="mdetail-card">
          <div className="mdetail-tabs">
            {(['info', 'skills'] as Tab[]).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`mdetail-tab ${tab === t ? 'mdetail-tab--on' : ''}`}>
                {t === 'info' ? 'INFO' : 'SKILLS'}
              </button>
            ))}
          </div>

          <div className="mdetail-body">
        {tab === 'info' ? (
          <>
            {/* Stats at this level */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
              <StatPill icon="💪" label="STÄRKE"  value={stats.attack}  color="#ff8855" />
              <StatPill icon="❤️" label="LEBEN"   value={stats.hp}      color="#ff5577" />
              <StatPill icon="👟" label="TEMPO"   value={stats.speed}   color="#55ccff" />
              <StatPill icon="🛡️" label="ABWEHR"  value={stats.defense} color="#88aaff" />
            </div>

            {/* Trait + Habitat */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: 10 }}>
                <div style={{ fontSize: 11, color: '#ffd700', fontWeight: 900, marginBottom: 4 }}>TRAIT</div>
                <div style={{ fontSize: 13, color: '#fff' }}>{TRAITS[def.trait]?.name ?? def.trait}</div>
                {def.trait !== 'None' && (
                  <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>{TRAITS[def.trait]?.description}</div>
                )}
              </div>
              <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: 10 }}>
                <div style={{ fontSize: 11, color: '#ffd700', fontWeight: 900, marginBottom: 4 }}>EVOLUTION</div>
                <div style={{ fontSize: 12, color: '#fff' }}>{def.evolutionStages.join(' → ')}</div>
              </div>
            </div>

            {/* Lore */}
            <div style={{ fontSize: 13, color: '#bbb', fontStyle: 'italic', lineHeight: 1.5, marginBottom: 14 }}>
              "{def.lore}"
            </div>

            {/* Sell + Remove */}
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              {monster.habitatId && (
                <button className="btn btn-danger" style={{ flex: 1 }}
                  onClick={() => { removeFromHabitat(instanceId); }}>
                  Aus Lebensraum
                </button>
              )}
              <button className="btn btn-gold" style={{ flex: 1 }}
                onClick={() => {
                  if (confirm(`${monster.name} (Lv ${monster.level}) für 🪙 ${sellValue} verkaufen?`)) {
                    sellMonster(instanceId);
                    onClose();
                  }
                }}>
                Verkaufen 🪙 {sellValue}
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Equipped attacks — with unequip */}
            <div style={{ fontSize: 12, color: '#ffd700', fontWeight: 900, marginBottom: 8 }}>
              AUSGERÜSTET ({monster.equippedMoveIds.length}/{monster.maxAttackSlots})
            </div>
            {equipped.length === 0 && <div style={{ color: '#777', fontSize: 13 }}>Noch keine Attacken ausgerüstet.</div>}
            {equipped.map(move => (
              <MoveRow key={move.id} move={move} open={openMove === move.id}
                onToggle={() => setOpenMove(openMove === move.id ? null : move.id)}
                action={equipped.length > 1 ? {
                  label: 'Ablegen', cls: 'btn-danger',
                  onClick: () => unequipAttack(instanceId, move.id),
                } : undefined} />
            ))}

            {/* Known but benched — with equip (if a slot is free) */}
            {benched.length > 0 && (
              <>
                <div style={{ fontSize: 12, color: '#ffd700', fontWeight: 900, margin: '14px 0 8px' }}>
                  GELERNT (auf der Bank)
                </div>
                {benched.map(move => (
                  <MoveRow key={move.id} move={move} open={openMove === 'b_' + move.id}
                    onToggle={() => setOpenMove(openMove === 'b_' + move.id ? null : 'b_' + move.id)}
                    action={slotsFree ? {
                      label: 'Ausrüsten', cls: 'btn-primary',
                      onClick: () => equipAttack(instanceId, move.id),
                    } : undefined} />
                ))}
              </>
            )}

            {/* Learn new attacks (element-matched), each priced individually */}
            {trainable.length > 0 && (
              <>
                <div style={{ fontSize: 12, color: '#ffd700', fontWeight: 900, margin: '14px 0 8px' }}>
                  LERNBARE ATTACKEN
                </div>
                {trainable.map(move => {
                  const cost = getAttackTrainCost(move.id);
                  const afford = gold >= cost.gold && diamonds >= cost.diamonds;
                  const costLabel = cost.diamonds > 0 ? `💎 ${cost.diamonds}` : `🪙 ${cost.gold}`;
                  return (
                    <MoveRow key={move.id} move={move} open={openMove === 't_' + move.id}
                      onToggle={() => setOpenMove(openMove === 't_' + move.id ? null : 't_' + move.id)}
                      action={{
                        label: `Lernen ${costLabel}`, cls: afford ? 'btn-info' : 'btn-info',
                        disabled: !afford,
                        onClick: () => trainAttack(instanceId, move.id),
                      }} />
                  );
                })}
              </>
            )}
            {!slotsFree && (
              <div style={{ fontSize: 11, color: '#888', textAlign: 'center', marginTop: 8 }}>
                Alle Slots belegt — entwickle das Monster für mehr Attacken-Slots.
              </div>
            )}
          </>
        )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatPill({ icon, label, value, color }: { icon: string; label: string; value: number; color: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      background: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: '8px 12px',
    }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 10, color: '#999', fontWeight: 700 }}>{label}</div>
        <div style={{ fontSize: 18, fontWeight: 900, color }}>{value}</div>
      </div>
    </div>
  );
}

function MoveRow({ move, open, onToggle, lockedLabel, action }: {
  move: MoveDef; open: boolean; onToggle: () => void; lockedLabel?: string;
  action?: { label: string; cls: string; onClick: () => void; disabled?: boolean };
}) {
  const color = ELEMENT_CSS_COLORS[move.element];
  const isAoe = move.targeting === 'aoe';
  return (
    <div style={{
      marginBottom: 6, borderRadius: 8, overflow: 'hidden',
      background: 'rgba(255,255,255,0.05)', border: `1px solid ${color}55`,
    }}>
      <div onClick={onToggle} style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '8px 10px', cursor: 'pointer',
      }}>
        <div>
          <span style={{ fontWeight: 'bold', fontSize: 13 }}>{move.name}</span>
          <span style={{
            fontSize: 10, marginLeft: 6, padding: '1px 6px', borderRadius: 4,
            background: isAoe ? 'rgba(255,80,80,0.25)' : 'rgba(120,180,255,0.25)',
            color: isAoe ? '#ff9999' : '#aaccff',
          }}>{isAoe ? 'ALLE' : 'EINZEL'}</span>
          {lockedLabel && <span style={{ fontSize: 10, color: '#888', marginLeft: 6 }}>🔒 {lockedLabel}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color }}>{move.element} · {move.power}×</span>
          {action && (
            <button className={`btn ${action.cls}`} style={{ padding: '2px 8px', fontSize: 10 }}
              disabled={action.disabled}
              onClick={e => { e.stopPropagation(); action.onClick(); }}>
              {action.label}
            </button>
          )}
        </div>
      </div>
      {open && (
        <div style={{ padding: '0 10px 10px', fontSize: 12, color: '#bbb', lineHeight: 1.5 }}>
          <div>{move.description}</div>
          <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 11 }}>
            <span>🎯 Ziel: <b style={{ color: '#fff' }}>{isAoe ? 'Alle Gegner' : 'Ein Gegner'}</b></span>
            <span>⚡ Stärke: <b style={{ color: '#fff' }}>{move.power}×</b></span>
            <span>🎮 Minispiel: <b style={{ color: '#fff' }}>{MINIGAME_LABELS[move.minigameType]}</b></span>
            {move.statusEffect && (() => {
              const sdef = STATUS_EFFECTS[move.statusEffect.effect];
              return (
                <span title={sdef?.description}>
                  ✦ Effekt:{' '}
                  <b style={{ color: sdef?.color ?? '#ffcc66' }}>
                    {sdef ? `${sdef.icon} ${sdef.name}` : move.statusEffect.effect}
                  </b>{' '}
                  (ab {move.statusEffect.threshold}%)
                </span>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

const MINIGAME_LABELS: Record<string, string> = {
  TimingBar: 'Timing-Leiste',
  AimClick: 'Ziel-Klick',
  ButtonSequence: 'Tasten-Folge',
  MashButton: 'Mash',
  SwipePath: 'Pfad ziehen',
};
