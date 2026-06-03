import EventEmitter from 'eventemitter3';

export const EventBus = new EventEmitter();

export const GameEvents = {
  OPEN_HABITAT_PANEL:   'open-habitat-panel',
  OPEN_BUILD_MENU:      'open-build-menu',
  OPEN_BREEDING_PANEL:  'open-breeding-panel',
  OPEN_HATCHERY_PANEL:  'open-hatchery-panel',
  OPEN_FARM_PANEL:      'open-farm-panel',
  OPEN_POKEDEX:         'open-pokedex',
  OPEN_SHOP:            'open-shop',
  OPEN_ISLANDS_PANEL:   'open-islands-panel',
  BATTLE_STARTED:       'battle-started',
  BATTLE_ENDED:         'battle-ended',
  MINIGAME_START:       'minigame-start',
  MINIGAME_COMPLETE:    'minigame-complete',
  PANEL_CLOSED:         'panel-closed',
  OPEN_BUILD_OVERLAY:   'open-build-overlay',   // BAUEN tab → 2D top-down island view (browse)
  ENTER_PLACEMENT_MODE: 'enter-placement-mode',
  ENTER_MOVE_MODE:      'enter-move-mode',       // relocate an existing building to a new tile
  ISLAND_CHANGED:       'island-changed',
  START_BATTLE:         'start-battle',
  OPEN_TEAM_SELECT:     'open-team-select',   // → shows monster picker before battle
  OPEN_HATCH_CONFIRM:   'open-hatch-confirm',  // Phaser → React: egg tapped
  HATCH_EGG_ANIMATE:    'hatch-egg-animate',   // React → Phaser: play hatch anim
  OPEN_MONSTER_DETAIL:  'open-monster-detail', // open a single monster's detail screen
  OPEN_ASSIGN_HABITAT:  'open-assign-habitat', // forced habitat assignment after hatching
  OPEN_LEVEL_REWARDS:   'open-level-rewards',  // account level-up reward panel
  OPEN_QUESTS:          'open-quests',         // quest/objectives panel
  OPEN_EVENTS:          'open-events',         // limited-time briefing events
  OPEN_STORAGE:         'open-storage',        // egg storage (Lager)
  OPEN_COMPENDIUM:      'open-compendium',     // traits & battle-effects glossary
  OPEN_LAB:             'open-lab',            // Labor: rank-up two identical max monsters
} as const;
