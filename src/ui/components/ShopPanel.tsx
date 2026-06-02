import React, { useState } from 'react';
import { useGameStore } from '@store/gameStore';
import { MONSTER_DEFS, ALL_MONSTER_IDS } from '@data/monsters';
import { MONSTER_EMOJI } from '@data/monsterEmoji';
import { RARITY_COLORS, RARITY_RANK } from '@data/rarities';
import { BUILDING_DEFS, BUILDABLE_BUILDING_IDS } from '@data/buildings';
import { EventBus, GameEvents } from '@game/EventBus';
import { HelpButton } from './HelpButton';
import '../styles/global.css';

interface ShopPanelProps {
  onClose: () => void;
  // Closes the shop WITHOUT emitting PANEL_CLOSED, so entering placement mode
  // isn't immediately cancelled by the panel-closed handler.
  onStartPlacement: () => void;
}

interface ShopItem {
  id: string;
  name: string;
  description: string;
  diamondCost?: number;
  goldCost?: number;
  action: (store: ReturnType<typeof useGameStore.getState>) => void;
}

const CATEGORY_ICONS: Record<string, string> = {
  Habitat: '🏠', Temple: '⛩️', Farm: '🌾', BreedingStation: '🧬', Hatchery: '🥚',
};

type Tab = 'items' | 'build';

export function ShopPanel({ onClose, onStartPlacement }: ShopPanelProps) {
  const diamonds = useGameStore(s => s.diamonds);
  const gold = useGameStore(s => s.gold);
  const [tab, setTab] = useState<Tab>('items');

  const SHOP_ITEMS: ShopItem[] = [
    { id: 'gold_small', name: '💰 1.000 Gold', description: 'Ein kleiner Beutel Goldmünzen.', diamondCost: 10,
      action: (s) => { if (s.spendDiamonds(10)) s.addGold(1000); } },
    { id: 'gold_large', name: '💰 10.000 Gold', description: 'Eine große Truhe voll Gold.', diamondCost: 80,
      action: (s) => { if (s.spendDiamonds(80)) s.addGold(10000); } },
    { id: 'food_small', name: '🌾 500 Futter', description: 'Genug zum Füttern für eine Weile.', diamondCost: 5,
      action: (s) => { if (s.spendDiamonds(5)) s.addFood(500); } },
    { id: 'food_large', name: '🌾 5.000 Futter', description: 'Ein riesiger Futtervorrat.', diamondCost: 40,
      action: (s) => { if (s.spendDiamonds(40)) s.addFood(5000); } },
    // Common eggs — buyable with GOLD. Priced by roster order: the later a
    // common appears, the pricier its egg.
    ...ALL_MONSTER_IDS
      .filter(id => MONSTER_DEFS[id]?.rarity === 'Common')
      .map((id, i) => {
        const def = MONSTER_DEFS[id]!;
        const cost = 500 + i * 350;
        return {
          id: 'egg_common_' + id,
          name: `🥚 ${def.name} Ei`,
          description: `Ein Common ${def.elements.join('/')} Monster-Ei. Landet im Lager.`,
          goldCost: cost,
          action: (s: ReturnType<typeof useGameStore.getState>) => {
            if (s.spendGold(cost)) s.addEgg(id, 30);
          },
        } as ShopItem;
      }),
    // Premium eggs (Rare and up) — bought with diamonds.
    ...(['shadowfox', 'luminos', 'venomscale', 'ironhide'] as const).map(id => {
      const def = MONSTER_DEFS[id]!;
      const cost = 20 + RARITY_RANK[def.rarity] * 15;
      return {
        id: 'monster_' + id,
        name: `🥚 ${def.name} Ei`,
        description: `Ein ${def.rarity} ${def.elements.join('/')} Monster-Ei. Landet im Lager.`,
        diamondCost: cost,
        action: (s: ReturnType<typeof useGameStore.getState>) => { if (s.spendDiamonds(cost)) s.addEgg(id, 30); },
      } as ShopItem;
    }),
  ];

  return (
    <div className="panel panel-modal panel-w-sm" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <button className="close-btn" onClick={onClose} style={{ zIndex: 5 }}>✕</button>
      <HelpButton
        title="Shop"
        tips={[
          'Im Reiter „Artikel" kaufst du Gold, Futter und Monster-Eier — manche mit 🪙 Gold, andere mit 💎 Diamanten.',
          'Gekaufte Eier landen im Lager und müssen erst zum Brutplatz gebracht werden, um auszubrüten.',
          'Im Reiter „Bauen" wählst du Gebäude und platzierst sie danach auf der Insel.',
          'Mit 🔒 markierte Gebäude werden erst ab einem höheren Spieler-Level freigeschaltet.',
        ]}
      />

      {/* Header + tabs */}
      <div style={{ padding: '14px 18px 0', background: 'linear-gradient(135deg, #2a1e08, #160f04)', borderBottom: '2px solid #cc9944' }}>
        <div style={{ fontSize: 19, fontWeight: 900, color: '#ffcc66', textShadow: '0 2px 6px rgba(0,0,0,0.6)' }}>
          🛒 Shop
        </div>
        <div style={{ fontSize: 12, color: '#ccb380', marginTop: 2 }}>
          💎 {diamonds} · 🪙 {gold.toLocaleString()}
        </div>
        <div style={{ display: 'flex', gap: 4, marginTop: 10 }}>
          <TabBtn label="🛍️ Artikel" active={tab === 'items'} onClick={() => setTab('items')} />
          <TabBtn label="🏗️ Bauen" active={tab === 'build'} onClick={() => setTab('build')} />
        </div>
      </div>

      <div style={{ overflowY: 'auto', padding: 14, flex: 1, minHeight: 0 }}>
        {tab === 'items' ? (
          SHOP_ITEMS.map(item => {
            // Items are priced in either diamonds or gold. Read whichever this
            // item uses so gold eggs don't fall through to a 💎 0 (free) label.
            const isGold = item.goldCost != null;
            const cost = isGold ? item.goldCost! : (item.diamondCost ?? 0);
            const canAfford = isGold ? gold >= cost : diamonds >= cost;
            return (
              <div key={item.id} className="monster-card" style={{
                marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                opacity: canAfford ? 1 : 0.5,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 'bold', fontSize: 14 }}>{item.name}</div>
                  <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{item.description}</div>
                </div>
                <button className="btn btn-info" style={{ minWidth: 72, fontSize: 13 }}
                  disabled={!canAfford}
                  onClick={() => item.action(useGameStore.getState())}>
                  {isGold ? `🪙 ${cost.toLocaleString()}` : `💎 ${cost}`}
                </button>
              </div>
            );
          })
        ) : (
          <BuildTab gold={gold} onStartPlacement={onStartPlacement} />
        )}
      </div>
    </div>
  );
}

function BuildTab({ gold, onStartPlacement }: { gold: number; onStartPlacement: () => void }) {
  const playerLevel = useGameStore(s => s.playerLevel);
  const [filter, setFilter] = useState<string>('All');
  const categories = ['All', 'Habitat', 'Temple', 'Farm'];
  const filtered = BUILDABLE_BUILDING_IDS.filter(id => {
    const def = BUILDING_DEFS[id];
    return filter === 'All' || def.category === filter;
  });

  const startBuild = (defId: string) => {
    const def = BUILDING_DEFS[defId];
    if (gold < def.goldCost) return;
    if (def.unlockLevel && playerLevel < def.unlockLevel) return;
    // Enter the 2D placement mode on the island, then close the shop WITHOUT
    // emitting PANEL_CLOSED (which would instantly cancel placement).
    EventBus.emit(GameEvents.ENTER_PLACEMENT_MODE, { defId });
    onStartPlacement();
  };

  return (
    <>
      <div style={{ fontSize: 11, color: '#aaa', marginBottom: 10 }}>
        Wähle ein Gebäude — du platzierst es danach in der 2D-Bauansicht.
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {categories.map(c => (
          <button key={c} className="btn btn-info"
            onClick={() => setFilter(c)}
            style={{ opacity: filter === c ? 1 : 0.5, padding: '4px 10px', fontSize: 12 }}>
            {c}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map(id => {
          const def = BUILDING_DEFS[id];
          const locked = !!def.unlockLevel && playerLevel < def.unlockLevel;
          const canAfford = gold >= def.goldCost;
          const buildable = canAfford && !locked;
          return (
            <div key={id} className="monster-card"
              onClick={() => buildable && startBuild(id)}
              style={{ opacity: buildable ? 1 : 0.5, cursor: buildable ? 'pointer' : 'not-allowed' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 'bold' }}>
                  {locked && '🔒 '}{CATEGORY_ICONS[def.category]} {def.name}
                </span>
                <span className="gold-text">🪙 {def.goldCost}</span>
              </div>
              <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>{def.description}</div>
              <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
                Größe: {def.tilesW}×{def.tilesH}
                {def.buildTimeSec > 0 && ` · Bauzeit: ${def.buildTimeSec}s`}
                {def.linkedElement && ` · Element: ${def.linkedElement}`}
              </div>
              {locked && (
                <div style={{ fontSize: 11, color: '#ff9955', marginTop: 4, fontWeight: 700 }}>
                  🔒 Erst ab Spieler-Level {def.unlockLevel} (du bist Level {playerLevel})
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: '8px 0', fontSize: 13, fontWeight: 900, cursor: 'pointer',
      border: 'none', borderRadius: '8px 8px 0 0',
      background: active ? 'rgba(204,153,68,0.25)' : 'transparent',
      color: active ? '#ffcc66' : '#998866',
      borderBottom: active ? '2px solid #ffcc66' : '2px solid transparent',
    }}>
      {label}
    </button>
  );
}
