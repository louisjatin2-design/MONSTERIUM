import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useGameStore } from '@store/gameStore';
import { MONSTER_DEFS } from '@data/monsters';
import { ATTACKS } from '@data/attacks';
import { RARITY_COLORS, RARITY_RANK } from '@data/rarities';
import { ELEMENT_CSS_COLORS } from '@data/elements';
import { getMonsterFaction, type Faction } from '@data/factions';
import { getActivePassives } from '@data/passives';
import { BOND_TASKS, BOND_COOLDOWN_MS, getBondTier, getNextBondTier } from '@data/bonds';
import { TRAITS } from '@data/traits';
import { STATUS_EFFECTS } from '@data/statusEffects';
import { instanceStats } from '@systems/StatSystem';
import { calculateFeedCost, calculateSellValue } from '@systems/EconomySystem';
import {
  isEvolutionReady, getNextEvolutionStage, getEvolutionStageName,
  EVOLUTION_LEVELS, getTrainableAttacks, getAttackTrainCost,
  getEffectiveMaxLevel, getMonsterTempleLevel, getTempleCappedLevel, MAX_RANK_STARS,
} from '@systems/ProgressionSystem';
import type { MoveDef } from '@gtypes/game';
import { ARMOR_DEFS, MATERIALS, getArmorBonus } from '@data/armor';
import { HelpButton } from './HelpButton';
import '../styles/global.css';

interface Props {
  instanceId: string;
  onClose: () => void;
}

type Tab = 'info' | 'skills' | 'armor';

// Monster-Legends-style detail screen for a single owned monster.
export function MonsterInstanceDetail({ instanceId, onClose }: Props) {
  const monster   = useGameStore(s => s.monsters[instanceId]);
  const buildings = useGameStore(s => s.buildings);
  const food      = useGameStore(s => s.food);
  const gold      = useGameStore(s => s.gold);
  const diamonds  = useGameStore(s => s.diamonds);
  const sellMonster = useGameStore(s => s.sellMonster);
  const evolveMonster = useGameStore(s => s.evolveMonster);
  const removeFromHabitat = useGameStore(s => s.removeFromHabitat);
  const equipAttack = useGameStore(s => s.equipAttack);
  const unequipAttack = useGameStore(s => s.unequipAttack);
  const trainAttack = useGameStore(s => s.trainAttack);
  const interactWithMonster = useGameStore(s => s.interactWithMonster);
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
    if (!m || m.level >= getEffectiveMaxLevel(m, st.buildings)) return false;
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
  const maxLevel = getEffectiveMaxLevel(monster, buildings);
  const templeCap = getTempleCappedLevel(monster, buildings);
  const templeLevel = getMonsterTempleLevel(monster, buildings);
  const atMaxLevel = monster.level >= maxLevel;
  // Tempel-begrenzt (noch unter 100), nicht durch Rank/Labor: Hinweis zeigen.
  const templeGated = atMaxLevel && templeCap < 100 && monster.level >= templeCap;
  const feedCost = calculateFeedCost(monster.level);
  const canFeed = food >= feedCost && !atMaxLevel;
  const sellValue = calculateSellValue(RARITY_RANK[def.rarity], monster.level, monster.isUnique);
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

  // ── MBCC-Dossier-Metadaten (Vorbild: Minos-Bureau-Akte) ──────────────────
  const rank = RARITY_RANK[def.rarity];
  const dangerLabels = ['LOW', 'GUARDED', 'ELEVATED', 'HIGH', 'SEVERE', 'CRITICAL', 'OMEGA'];
  const dangerLevel = dangerLabels[Math.min(rank, dangerLabels.length - 1)];
  // Stabile UID aus der defId (Platzhalter-Schema MBCC-S-XXXX).
  const uid = `MBCC-S-${hashCode(monster.defId).toString(16).toUpperCase().padStart(4, '0').slice(0, 4)}`;
  const faction = getMonsterFaction(def);
  const factionStatus = faction === 'Evil' ? 'Containment Advised'
    : faction === 'Good' ? 'Cooperative' : 'Under Review';
  // Beobachtungs-Notiz aus Trait + Seltenheit zusammengesetzt (Platzhalter-Lore).
  const observation = `Die Kreatur (${def.rarity}) zeigt ${TRAITS[def.trait]?.name ?? 'unbekannte'}-Verhalten. `
    + (rank >= 4
      ? 'Potenzial unkalkulierbar — höchste Vorsicht geboten.'
      : 'Reaktionen auf Reize werden weiter dokumentiert.');

  return (
    <div className="mdetail dossier" style={{ ['--accent' as string]: accent }}>
      <div className="dossier-glow" />
      <div className="dossier-vignette" />
      {/* Zurück — eigener Screen, kein Popup. */}
      <button className="dossier-back" onClick={onClose} title="Zurück">←</button>
      <HelpButton
        title="Monster-Akte"
        tips={[
          'Füttere dein Monster mit Futter, um XP zu sammeln und es aufzuleveln — vier Fütterungen pro Level.',
          'Bei bestimmten Leveln kann das Monster sich entwickeln und neue Angriffs-Slots freischalten.',
          'Über „Fähigkeiten" trainierst und rüstest du die Attacken für den Kampf aus.',
          'Beim Verkauf bekommst du für höhere Monster-Level deutlich mehr Gold.',
        ]}
        rightOffset={14}
      />

      {/* ── Kopfzeile: Bureau + Geheim-Tags + Barcode ───────────────── */}
      <div className="dossier-top">
        <div className="dossier-org">
          <div className="dossier-seal">◈</div>
          <div>
            <div className="dossier-org-name">MINOS BUREAU OF CRISIS CONTROL</div>
            <div className="dossier-org-sub">MBCC</div>
          </div>
        </div>
        <div>
          <div className="dossier-tags">
            <span className="dossier-tag-red">CLASSIFIED</span>
            <span className="dossier-tag-mut">  ·  CONFIDENTIAL</span>
          </div>
          <div className="dossier-barcode" />
          <div className="dossier-uid-top" style={{ textAlign: 'right' }}>{uid}</div>
          <div className="dossier-status" style={{ marginTop: 6 }}>
            <div>Status: <b>{factionStatus}</b></div>
            <div>Danger Level: <span className="danger">{dangerLevel}</span></div>
          </div>
        </div>
      </div>

      {/* ── Hauptbereich: Akte links · Artwork rechts ───────────────── */}
      <div className="dossier-main">
        {/* AKTE */}
        <div className="dossier-doc">
          <div className="dossier-name">
            {(monster.name ?? def.name).toUpperCase()}
            <span className="sub">{monster.stage}</span>
          </div>
          <div className="dossier-stars" title={`${monster.rankStars ?? 0}/${MAX_RANK_STARS} Sterne`}>
            {'★'.repeat(monster.rankStars ?? 0)}{'☆'.repeat(MAX_RANK_STARS - (monster.rankStars ?? 0))}
            <span style={{ color: '#7d8694', marginLeft: 10, letterSpacing: 0 }}>
              Lv {monster.level} / {maxLevel} · {def.rarity}
            </span>
          </div>
          <span className="dossier-code">{uid}</span>

          {/* Element- und Stage-Chips */}
          <div className="dossier-chips">
            <div className="dossier-chip">
              <div className="dossier-chip-ico accent">{ELEMENT_EMOJI[def.elements[0]] ?? '✦'}</div>
              <div>
                <div className="dossier-chip-main">{def.elements.join(' / ').toUpperCase()}</div>
                <div className="dossier-chip-sub">Element</div>
              </div>
            </div>
            <div className="dossier-chip">
              <div className="dossier-chip-ico">{FACTION_EMOJI[faction]}</div>
              <div>
                <div className="dossier-chip-main">{monster.stage.toUpperCase()}</div>
                <div className="dossier-chip-sub">Stage</div>
              </div>
            </div>
          </div>

          {/* BACKSTORY */}
          <div className="dossier-sec"><span className="dossier-sec-t">HINTERGRUND</span><span className="dossier-sec-line" /></div>
          <div className="dossier-lore">{def.lore}</div>

          {/* Werte */}
          <div className="dossier-sec"><span className="dossier-sec-t">WERTE</span><span className="dossier-sec-line" /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <StatPill icon="💪" label="STÄRKE"  value={stats.attack}  color="#ff8855" />
            <StatPill icon="❤️" label="LEBEN"   value={stats.hp}      color="#ff5577" />
            <StatPill icon="👟" label="TEMPO"   value={stats.speed}   color="#55ccff" />
            <StatPill icon="🛡️" label="ABWEHR"  value={stats.defense} color="#88aaff" />
          </div>

          {/* Passive Fähigkeiten (über Rang-Ups freigeschaltet, im Kampf aktiv) */}
          <div className="dossier-sec"><span className="dossier-sec-t">PASSIVE</span><span className="dossier-sec-line" /></div>
          {(() => {
            const passives = getActivePassives(monster.rankStars ?? 0);
            if (passives.length === 0) {
              return <div style={{ fontSize: 12, color: '#7d8694' }}>Keine — Rang-Up im Labor schaltet permanente Kampf-Boni frei (★ = 1 Passiv).</div>;
            }
            return (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {passives.map(p => (
                  <div key={p.star} title={p.description} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: 'rgba(255,255,255,0.05)', border: `1px solid ${accent}55`,
                    borderRadius: 6, padding: '6px 10px',
                  }}>
                    <span style={{ fontSize: 18 }}>{p.icon}</span>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: '#eef2f8' }}>{p.name}</div>
                      <div style={{ fontSize: 10, color: '#9fb0c2' }}>{p.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Bindung / Relationship-Tasks (Gruppe 5) */}
          <div className="dossier-sec"><span className="dossier-sec-t">BINDUNG</span><span className="dossier-sec-line" /></div>
          {(() => {
            const bondXp = monster.bondXp ?? 0;
            const tier = getBondTier(bondXp);
            const next = getNextBondTier(bondXp);
            const onCooldown = Date.now() - (monster.lastBondMs ?? 0) < BOND_COOLDOWN_MS;
            const pct = next ? Math.round(((bondXp - tier.xpNeeded) / (next.xpNeeded - tier.xpNeeded)) * 100) : 100;
            return (
              <div style={{ marginBottom: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: accent, fontWeight: 800 }}>★ {tier.title} (Stufe {tier.level})</span>
                  <span style={{ color: '#9fb0c2' }}>+{Math.round(tier.statBonus * 100)}% Werte</span>
                </div>
                <div style={{ height: 8, background: '#222', borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: accent }} />
                </div>
                {onCooldown && (
                  <div style={{ fontSize: 11, color: '#7d8694', marginBottom: 6 }}>
                    ⏳ Bereits interagiert — komm später wieder, um die Bindung weiter zu stärken.
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {BOND_TASKS.map(t => {
                    const afford = (t.cost.gold ?? 0) <= gold && (t.cost.food ?? 0) <= food;
                    const costLabel = [t.cost.gold ? `🪙${t.cost.gold}` : null, t.cost.food ? `🌾${t.cost.food}` : null].filter(Boolean).join(' ');
                    return (
                      <button key={t.id} className="btn" disabled={onCooldown || !afford}
                        title={t.description}
                        onClick={() => interactWithMonster(instanceId, t.id)}
                        style={{ fontSize: 11, padding: '6px 10px', flex: '1 1 auto' }}>
                        {t.icon} {t.label} <span style={{ opacity: 0.8 }}>(+{t.xp} · {costLabel})</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Tab-Karte: Fortschritt / Fähigkeiten / Rüstung */}
          <div className="dossier-sec"><span className="dossier-sec-t">AKTE</span><span className="dossier-sec-line" /></div>
          <div className="dossier-card">
            <div className="dossier-tabs">
              {(['info', 'skills', 'armor'] as Tab[]).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`dossier-tab ${tab === t ? 'dossier-tab--on' : ''}`}>
                  {t === 'info' ? 'FORTSCHRITT' : t === 'skills' ? 'FÄHIGKEITEN' : 'RÜSTUNG'}
                </button>
              ))}
            </div>
            <div className="dossier-tab-body">
        {tab === 'info' ? (
          <>
            {/* Level-up: feed progress (4 cycles per level) + Füttern button. */}
            <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 6, padding: 12, marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: '#ccc' }}>
                  {atMaxLevel ? 'MAX LEVEL' : `Fortschritt zu Lv ${monster.level + 1}`}
                </span>
                <span style={{ fontSize: 11, color: '#888' }}>{feedsDone}/4</span>
              </div>
              <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
                {[0, 1, 2, 3].map(i => (
                  <div key={i} style={{ flex: 1, height: 10, borderRadius: 4, background: i < feedsDone ? accent : '#333' }} />
                ))}
              </div>
              <button className="btn btn-primary" style={{ width: '100%', touchAction: 'none', userSelect: 'none' }}
                disabled={!canFeed}
                onPointerDown={startFeeding}
                onPointerUp={stopFeeding}
                onPointerLeave={stopFeeding}
                onPointerCancel={stopFeeding}>
                {atMaxLevel ? 'Max-Level erreicht' : `🌾 Füttern halten (${feedCost})`}
              </button>
              {templeGated && (
                <div style={{ fontSize: 11, color: '#88ccff', textAlign: 'center', marginTop: 8 }}>
                  ⛩️ Levelgrenze {templeCap} erreicht. Baue/verbessere den{def.elements.length > 1 ? 'jeweiligen Element-Tempel beider Elemente' : ' passenden Element-Tempel'} (aktuell Stufe {templeLevel}), um weiter aufzuleveln.
                </div>
              )}
              {atMaxLevel && !templeGated && (monster.rankStars ?? 0) < MAX_RANK_STARS && (
                <div style={{ fontSize: 11, color: '#c9a3ff', textAlign: 'center', marginTop: 8 }}>
                  🧪 Im Labor mit einem identischen Max-Level-Monster zusammenführen für einen Rank-Up (+10 Level).
                </div>
              )}
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

            {/* Trait + Evolution */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', borderRadius: 6, padding: 10 }}>
                <div style={{ fontSize: 11, color: accent, fontWeight: 900, marginBottom: 4, letterSpacing: '0.1em' }}>TRAIT</div>
                <div style={{ fontSize: 13, color: '#fff' }}>{TRAITS[def.trait]?.name ?? def.trait}</div>
                {def.trait !== 'None' && (
                  <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>{TRAITS[def.trait]?.description}</div>
                )}
              </div>
              <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', borderRadius: 6, padding: 10 }}>
                <div style={{ fontSize: 11, color: accent, fontWeight: 900, marginBottom: 4, letterSpacing: '0.1em' }}>EVOLUTION</div>
                <div style={{ fontSize: 12, color: '#fff' }}>{def.evolutionStages.join(' → ')}</div>
              </div>
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
        ) : tab === 'skills' ? (
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
        ) : (
          <ArmorTab instanceId={instanceId} />
        )}
            </div>{/* dossier-tab-body */}
          </div>{/* dossier-card */}

          {/* OBSERVATION RECORD */}
          <div className="dossier-sec"><span className="dossier-sec-t">BEOBACHTUNG</span><span className="dossier-sec-line" /></div>
          <div className="dossier-obs">
            „{observation}"
            <span className="by">— Chefforscher H.</span>
          </div>
        </div>{/* dossier-doc */}

        {/* ── ARTWORK (rechts) ──────────────────────────────────────── */}
        <div className="dossier-art">
          {/* TODO(assets): echtes Monster-Artwork laden; bis dahin Emoji-Platzhalter. */}
          <div className="dossier-portrait">👾</div>
        </div>
      </div>{/* dossier-main */}

      {/* ── Fußzeile ──────────────────────────────────────────────── */}
      <div className="dossier-foot">
        <span className="arch">▲ CONFIDENTIAL ARCHIVES ▲▲</span>
        <span className="uid">
          UID: <b>{uid}</b>
          <small>INFORMATION NOT TO BE DISCLOSED</small>
        </span>
      </div>
    </div>
  );
}

// Stabiler kleiner Hash für die UID-Platzhalter (deterministisch pro defId).
function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = (Math.imul(31, h) + s.charCodeAt(i)) | 0; }
  return Math.abs(h) % 0x10000;
}

// ── Rüstungs-Tab (Gruppe 7) ─────────────────────────────────────────────────
function ArmorTab({ instanceId }: { instanceId: string }) {
  const monster = useGameStore(s => s.monsters[instanceId]);
  const gold = useGameStore(s => s.gold);
  const materials = useGameStore(s => s.materials);
  const armorInventory = useGameStore(s => s.armorInventory);
  const craftArmor = useGameStore(s => s.craftArmor);
  const equipArmor = useGameStore(s => s.equipArmor);
  const unequipArmor = useGameStore(s => s.unequipArmor);
  if (!monster) return null;

  const equippedId = monster.equippedArmorId ?? null;
  const equipped = equippedId ? ARMOR_DEFS[equippedId] : null;
  const bonusLine = (b: ReturnType<typeof getArmorBonus>) => [
    b.hp ? `❤️ +${b.hp}` : null,
    b.attack ? `💪 +${b.attack}` : null,
    b.speed ? `👟 +${b.speed}` : null,
    b.energy ? `⚡ +${b.energy}` : null,
  ].filter(Boolean).join('  ');

  return (
    <>
      {/* Materialbestand */}
      <div style={{ fontSize: 12, color: '#ffd700', fontWeight: 900, marginBottom: 6 }}>MATERIALIEN</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {Object.values(MATERIALS).map(m => (
          <span key={m.id} style={{ fontSize: 12, color: '#ccc', background: 'rgba(255,255,255,0.05)', padding: '3px 8px', borderRadius: 6 }}>
            {m.icon} {m.name}: <b style={{ color: '#fff' }}>{materials[m.id] ?? 0}</b>
          </span>
        ))}
      </div>

      {/* Aktuell angelegt */}
      <div style={{ fontSize: 12, color: '#ffd700', fontWeight: 900, marginBottom: 6 }}>ANGELEGT</div>
      {equipped ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: 10 }}>
          <span style={{ fontSize: 26 }}>{equipped.icon}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 900, color: '#fff' }}>{equipped.name}</div>
            <div style={{ fontSize: 11, color: '#9fd' }}>{bonusLine(equipped.bonus)}</div>
          </div>
          <button className="btn btn-danger" style={{ fontSize: 11, padding: '4px 8px' }}
            onClick={() => unequipArmor(instanceId)}>Ablegen</button>
        </div>
      ) : (
        <div style={{ color: '#888', fontSize: 12, marginBottom: 12 }}>Keine Rüstung angelegt.</div>
      )}

      {/* Inventar zum Anlegen */}
      {Object.entries(armorInventory).some(([, c]) => c > 0) && (
        <>
          <div style={{ fontSize: 12, color: '#ffd700', fontWeight: 900, margin: '6px 0' }}>VERFÜGBAR (Inventar)</div>
          {Object.entries(armorInventory).filter(([, c]) => c > 0).map(([id, count]) => {
            const a = ARMOR_DEFS[id]; if (!a) return null;
            return (
              <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 8 }}>
                <span style={{ fontSize: 22 }}>{a.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 'bold', color: '#fff' }}>{a.name} ×{count}</div>
                  <div style={{ fontSize: 10, color: '#9fd' }}>{bonusLine(a.bonus)}</div>
                </div>
                <button className="btn btn-primary" style={{ fontSize: 11, padding: '4px 8px' }}
                  onClick={() => equipArmor(instanceId, id)}>Anlegen</button>
              </div>
            );
          })}
        </>
      )}

      {/* Crafting */}
      <div style={{ fontSize: 12, color: '#ffd700', fontWeight: 900, margin: '10px 0 6px' }}>SCHMIEDEN</div>
      {Object.values(ARMOR_DEFS).map(a => {
        const matsOk = Object.entries(a.craft.materials).every(([mid, q]) => (materials[mid] ?? 0) >= q);
        const canCraft = matsOk && gold >= a.craft.gold;
        const matLabel = Object.entries(a.craft.materials)
          .map(([mid, q]) => `${MATERIALS[mid]?.icon ?? mid}${q}`).join(' ');
        return (
          <div key={a.id} style={{ marginBottom: 6, background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 22 }}>{a.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 'bold', color: '#fff' }}>{a.name}</div>
                <div style={{ fontSize: 10, color: '#9fd' }}>{bonusLine(a.bonus)}</div>
              </div>
              <button className="btn btn-gold" style={{ fontSize: 11, padding: '4px 8px' }}
                disabled={!canCraft}
                onClick={() => craftArmor(a.id)}>Craften</button>
            </div>
            <div style={{ fontSize: 10, color: '#bbb', marginTop: 4 }}>
              Kosten: 🪙 {a.craft.gold}  ·  {matLabel}
            </div>
          </div>
        );
      })}
      <div style={{ fontSize: 10, color: '#777', marginTop: 8 }}>
        Materialien droppen nach gewonnenen Kämpfen.
      </div>
    </>
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

// Element-/Fraktions-Emojis für die Dossier-Chips (Platzhalter-Icons).
const ELEMENT_EMOJI: Record<string, string> = {
  Fire: '🔥', Water: '💧', Electric: '⚡', Earth: '🪨', Air: '💨',
  Ice: '❄️', Darkness: '🌑', Light: '✨', Metal: '⚙️', Poison: '☠️',
  Combat: '👊', Magic: '🔮', Angel: '😇', Demon: '😈', Plant: '🌿',
  Glitch: '👾', Time: '⏳', Crystal: '💎', Sand: '🏜️', Sound: '🎵',
  Void: '🕳️', Cosmos: '🌌', Psycho: '🧠',
};
const FACTION_EMOJI: Record<Faction, string> = { Good: '😇', Evil: '😈', Neutral: '⚖️' };

const MINIGAME_LABELS: Record<string, string> = {
  TimingBar: 'Timing-Leiste',
  AimClick: 'Ziel-Klick',
  ButtonSequence: 'Tasten-Folge',
  MashButton: 'Mash',
  SwipePath: 'Pfad ziehen',
};
