import { MONSTER_DEFS } from './monsters';
import { ATTACKS } from './attacks';

export type MonsterRole = 'Tank' | 'Angreifer' | 'Supporter' | 'Kontroller' | 'Curser' | 'Speedster';

export const ROLE_COLORS: Record<MonsterRole, string> = {
  Tank:       '#4488ff',
  Angreifer:  '#ff4444',
  Supporter:  '#44dd88',
  Kontroller: '#cc44ff',
  Curser:     '#ff8800',
  Speedster:  '#ffdd00',
};

export const ROLE_ICONS: Record<MonsterRole, string> = {
  Tank:       '🛡️',
  Angreifer:  '⚔️',
  Supporter:  '💚',
  Kontroller: '🔒',
  Curser:     '☠️',
  Speedster:  '⚡',
};

const CONTROL_EFFECTS = new Set(['Stun', 'Freeze', 'Paralyze', 'Blind']);
const CURSE_EFFECTS   = new Set(['Poison', 'Burn']);

export function getMonsterRoles(defId: string): MonsterRole[] {
  const def = MONSTER_DEFS[defId];
  if (!def) return [];

  const { hp, attack, defense, speed } = def.baseStats;
  const moves = def.availableMoveIds.map(id => ATTACKS[id]).filter(Boolean);

  const roles = new Set<MonsterRole>();

  // Supporter: any support move (heal / cleanse / buff)
  if (moves.some(m => m.support)) roles.add('Supporter');

  // Kontroller: 2+ moves that apply control status effects
  const controlCount = moves.filter(m => m.statusEffect && CONTROL_EFFECTS.has(m.statusEffect.effect)).length;
  if (controlCount >= 2) roles.add('Kontroller');

  // Curser: 2+ moves that apply DoT / debuff effects
  const curseCount = moves.filter(m => m.statusEffect && CURSE_EFFECTS.has(m.statusEffect.effect)).length;
  if (curseCount >= 2) roles.add('Curser');

  // Tank: notably high combined defense + HP pool
  if (defense >= 140 && hp >= 350) roles.add('Tank');

  // Speedster: very high speed
  if (speed >= 135) roles.add('Speedster');

  // Angreifer: high attack and not primarily a tank / supporter
  if (attack >= 150 && !roles.has('Tank') && !roles.has('Supporter')) roles.add('Angreifer');

  // Fallback – ensure every monster has at least one role
  if (roles.size === 0) {
    if (attack >= defense && attack >= speed) roles.add('Angreifer');
    else if (speed > attack) roles.add('Speedster');
    else roles.add('Tank');
  }

  return Array.from(roles);
}
