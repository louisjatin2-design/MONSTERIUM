import React from 'react';
import { useGameStore } from '@store/gameStore';
import { MONSTER_DEFS, ALL_MONSTER_IDS } from '@data/monsters';
import { RARITY_COLORS, RARITY_RANK } from '@data/rarities';
import '../styles/global.css';

interface ShopPanelProps { onClose: () => void; }

interface ShopItem {
  id: string;
  name: string;
  description: string;
  diamondCost?: number;
  goldCost?: number;
  action: (store: ReturnType<typeof useGameStore.getState>) => void;
}

export function ShopPanel({ onClose }: ShopPanelProps) {
  const diamonds = useGameStore(s => s.diamonds);
  const gold = useGameStore(s => s.gold);

  const SHOP_ITEMS: ShopItem[] = [
    {
      id: 'gold_small', name: '💰 1,000 Gold', description: 'A small pouch of gold coins.',
      diamondCost: 10,
      action: (s) => { if (s.spendDiamonds(10)) s.addGold(1000); },
    },
    {
      id: 'gold_large', name: '💰 10,000 Gold', description: 'A large chest of gold.',
      diamondCost: 80,
      action: (s) => { if (s.spendDiamonds(80)) s.addGold(10000); },
    },
    {
      id: 'food_small', name: '🌾 500 Food', description: 'Enough food for basic feeding.',
      diamondCost: 5,
      action: (s) => { if (s.spendDiamonds(5)) s.addFood(500); },
    },
    {
      id: 'food_large', name: '🌾 5,000 Food', description: 'A massive food stockpile.',
      diamondCost: 40,
      action: (s) => { if (s.spendDiamonds(40)) s.addFood(5000); },
    },
    ...(['flameling', 'aquapup', 'voltkit', 'shadowfox', 'luminos'] as const).map(id => {
      const def = MONSTER_DEFS[id]!;
      const rarityRank = RARITY_RANK[def.rarity];
      const cost = 20 + rarityRank * 15;
      return {
        id: 'monster_' + id,
        name: `🥚 ${def.name} Egg`,
        description: `A ${def.rarity} ${def.elements.join('/')} monster egg.`,
        diamondCost: cost,
        action: (s: ReturnType<typeof useGameStore.getState>) => {
          if (s.spendDiamonds(cost)) s.addEgg(id, 30);
        },
      } as ShopItem;
    }),
  ];

  return (
    <div className="panel panel-modal panel-w-sm" style={{ padding: 20 }}>
      <button className="close-btn" onClick={onClose}>✕</button>
      <div className="panel-title">🛒 Shop</div>
      <div style={{ fontSize: 13, color: '#888', marginBottom: 12 }}>
        💎 {diamonds} diamonds available
      </div>

      <div style={{ overflowY: 'auto', maxHeight: 'calc(min(88vh, 100vh - 150px) - 130px)' }}>
        {SHOP_ITEMS.map(item => {
          const cost = item.diamondCost ?? 0;
          const canAfford = diamonds >= cost;
          return (
            <div key={item.id} className="monster-card" style={{
              marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              opacity: canAfford ? 1 : 0.5,
            }}>
              <div>
                <div style={{ fontWeight: 'bold', fontSize: 14 }}>{item.name}</div>
                <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{item.description}</div>
              </div>
              <button className="btn btn-info" style={{ minWidth: 80, fontSize: 13 }}
                disabled={!canAfford}
                onClick={() => item.action(useGameStore.getState())}>
                💎 {cost}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
