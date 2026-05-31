import type { MoveDef } from '@gtypes/game';

export const ATTACKS: Record<string, MoveDef> = {
  ember: {
    id: 'ember',
    name: 'Ember',
    element: 'Fire',
    power: 1.0,
    minigameType: 'TimingBar',
    statusEffect: { effect: 'Burn', threshold: 70 },
    description: 'A small burst of fire. May cause Burn.',
  },
  inferno: {
    id: 'inferno',
    name: 'Inferno',
    element: 'Fire',
    power: 1.8,
    minigameType: 'AimClick',
    statusEffect: { effect: 'Burn', threshold: 85 },
    description: 'A massive fire eruption. High Burn chance on good aim.',
  },
  aquajet: {
    id: 'aquajet',
    name: 'Aqua Jet',
    element: 'Water',
    power: 1.0,
    minigameType: 'TimingBar',
    description: 'A swift water jet that always strikes first.',
  },
  tidal_wave: {
    id: 'tidal_wave',
    name: 'Tidal Wave',
    element: 'Water',
    power: 2.0,
    minigameType: 'ButtonSequence',
    statusEffect: { effect: 'Stun', threshold: 75 },
    description: 'A devastating wave. Stuns if the full sequence is executed.',
    targeting: 'aoe',
  },
  spark: {
    id: 'spark',
    name: 'Spark',
    element: 'Electric',
    power: 0.9,
    minigameType: 'TimingBar',
    statusEffect: { effect: 'Paralyze', threshold: 75 },
    description: 'A quick electric jolt. May Paralyze.',
  },
  thunderbolt: {
    id: 'thunderbolt',
    name: 'Thunderbolt',
    element: 'Electric',
    power: 1.7,
    minigameType: 'AimClick',
    statusEffect: { effect: 'Paralyze', threshold: 80 },
    description: 'A powerful electric strike. High Paralyze chance.',
  },
  quake: {
    id: 'quake',
    name: 'Quake',
    element: 'Earth',
    power: 1.2,
    minigameType: 'AimClick',
    statusEffect: { effect: 'DefDown', threshold: 65 },
    description: 'Shakes the ground, often lowering the foe\'s defense.',
  },
  rock_slam: {
    id: 'rock_slam',
    name: 'Rock Slam',
    element: 'Earth',
    power: 1.5,
    minigameType: 'ButtonSequence',
    description: 'Hurls massive boulders in rapid succession.',
  },
  gust: {
    id: 'gust',
    name: 'Gust',
    element: 'Air',
    power: 0.8,
    minigameType: 'TimingBar',
    description: 'A quick wind attack. Easy to execute, reliable damage.',
  },
  tornado: {
    id: 'tornado',
    name: 'Tornado',
    element: 'Air',
    power: 2.2,
    minigameType: 'ButtonSequence',
    statusEffect: { effect: 'Blind', threshold: 70 },
    description: 'A spinning vortex that batters every foe. May Blind.',
    targeting: 'aoe',
  },
  frost_bite: {
    id: 'frost_bite',
    name: 'Frost Bite',
    element: 'Ice',
    power: 1.1,
    minigameType: 'TimingBar',
    statusEffect: { effect: 'Freeze', threshold: 80 },
    description: 'A biting cold attack that may Freeze.',
  },
  blizzard: {
    id: 'blizzard',
    name: 'Blizzard',
    element: 'Ice',
    power: 1.6,
    minigameType: 'SwipePath',
    statusEffect: { effect: 'Freeze', threshold: 75 },
    description: 'An icy storm that blankets the whole field. May Freeze all foes.',
    targeting: 'aoe',
  },
  shadow_strike: {
    id: 'shadow_strike',
    name: 'Shadow Strike',
    element: 'Darkness',
    power: 1.3,
    minigameType: 'AimClick',
    description: 'Attacks from the shadows for reliable dark damage.',
  },
  soul_drain: {
    id: 'soul_drain',
    name: 'Soul Drain',
    element: 'Darkness',
    power: 1.6,
    minigameType: 'ButtonSequence',
    statusEffect: { effect: 'AtkDown', threshold: 70 },
    description: 'Drains the opponent\'s fighting spirit.',
  },
  holy_ray: {
    id: 'holy_ray',
    name: 'Holy Ray',
    element: 'Light',
    power: 1.4,
    minigameType: 'TimingBar',
    description: 'A beam of pure light energy.',
  },
  venom_fang: {
    id: 'venom_fang',
    name: 'Venom Fang',
    element: 'Poison',
    power: 1.2,
    minigameType: 'AimClick',
    statusEffect: { effect: 'Poison', threshold: 80 },
    description: 'A toxic bite that often Poisons the target.',
  },
  metal_crush: {
    id: 'metal_crush',
    name: 'Metal Crush',
    element: 'Metal',
    power: 1.5,
    minigameType: 'ButtonSequence',
    statusEffect: { effect: 'DefDown', threshold: 75 },
    description: 'A crushing metal blow that lowers defense.',
  },
  psy_blast: {
    id: 'psy_blast',
    name: 'Psy Blast',
    element: 'Psycho',
    power: 1.6,
    minigameType: 'AimClick',
    statusEffect: { effect: 'Stun', threshold: 85 },
    description: 'A focused psychic burst. Stuns on near-perfect aim.',
  },
  void_tear: {
    id: 'void_tear',
    name: 'Void Tear',
    element: 'Void',
    power: 1.9,
    minigameType: 'ButtonSequence',
    description: 'Tears a rift in reality for massive void damage.',
  },
  time_stop: {
    id: 'time_stop',
    name: 'Time Stop',
    element: 'Time',
    power: 1.0,
    minigameType: 'TimingBar',
    statusEffect: { effect: 'Stun', threshold: 50 },
    description: 'Briefly halts time. Easy to land a Stun.',
  },
  crystal_spear: {
    id: 'crystal_spear',
    name: 'Crystal Spear',
    element: 'Crystal',
    power: 1.4,
    minigameType: 'AimClick',
    description: 'A razor-sharp crystal lance.',
  },
  glitch_burst: {
    id: 'glitch_burst',
    name: 'Glitch Burst',
    element: 'Glitch',
    power: 2.5,
    minigameType: 'MashButton',
    statusEffect: { effect: 'Paralyze', threshold: 60 },
    description: 'An unstable digital explosion. Mash to overload it — immense power.',
  },
  rift_rend: {
    id: 'rift_rend',
    name: 'Rift Rend',
    element: 'Void',
    power: 2.1,
    minigameType: 'SwipePath',
    description: 'Trace the tear in reality to rip every enemy at once.',
    targeting: 'aoe',
  },
  static_overload: {
    id: 'static_overload',
    name: 'Static Overload',
    element: 'Electric',
    power: 1.9,
    minigameType: 'MashButton',
    statusEffect: { effect: 'Paralyze', threshold: 70 },
    description: 'Mash to build a static charge, then unleash it on one foe.',
  },

  // ── New element attacks ──────────────────────────────────────────────────
  thorn_whip: {
    id: 'thorn_whip', name: 'Thorn Whip', element: 'Plant', power: 1.2,
    minigameType: 'AimClick', statusEffect: { effect: 'Poison', threshold: 70 },
    description: 'A lashing vine that may Poison on impact.',
  },
  briar_storm: {
    id: 'briar_storm', name: 'Briar Storm', element: 'Plant', power: 2.0,
    minigameType: 'ButtonSequence', statusEffect: { effect: 'DefDown', threshold: 68 },
    description: 'A torrent of razor thorns that shreds armor.',
  },
  sand_blast: {
    id: 'sand_blast', name: 'Sand Blast', element: 'Sand', power: 1.3,
    minigameType: 'TimingBar', statusEffect: { effect: 'Blind', threshold: 70 },
    description: 'A concentrated jet of sand. May Blind.',
  },
  dune_crush: {
    id: 'dune_crush', name: 'Dune Crush', element: 'Sand', power: 1.9,
    minigameType: 'ButtonSequence', statusEffect: { effect: 'DefDown', threshold: 72 },
    description: 'Buries the target under tons of shifting sand.',
  },
  sonic_boom: {
    id: 'sonic_boom', name: 'Sonic Boom', element: 'Sound', power: 1.6,
    minigameType: 'AimClick', statusEffect: { effect: 'Stun', threshold: 80 },
    description: 'A concussive sound wave. May Stun.',
  },
  resonance: {
    id: 'resonance', name: 'Resonance', element: 'Sound', power: 2.1,
    minigameType: 'ButtonSequence', statusEffect: { effect: 'AtkDown', threshold: 70 },
    description: 'Vibrations that shatter the foe\'s focus.',
  },
  demon_slash: {
    id: 'demon_slash', name: 'Demon Slash', element: 'Demon', power: 1.4,
    minigameType: 'AimClick',
    description: 'A slash imbued with hellfire that ignores defenses.',
  },
  hellfire: {
    id: 'hellfire', name: 'Hellfire', element: 'Demon', power: 2.2,
    minigameType: 'ButtonSequence', statusEffect: { effect: 'Burn', threshold: 65 },
    description: 'Infernal flames that always burn.',
  },
  arcane_blast: {
    id: 'arcane_blast', name: 'Arcane Blast', element: 'Magic', power: 1.5,
    minigameType: 'AimClick', statusEffect: { effect: 'AtkDown', threshold: 70 },
    description: 'A magical explosion that may weaken the foe.',
  },
  spell_surge: {
    id: 'spell_surge', name: 'Spell Surge', element: 'Magic', power: 2.0,
    minigameType: 'ButtonSequence', statusEffect: { effect: 'Stun', threshold: 78 },
    description: 'An overwhelming torrent of arcane energy.',
  },
  divine_light: {
    id: 'divine_light', name: 'Divine Light', element: 'Angel', power: 1.6,
    minigameType: 'TimingBar',
    description: 'A beam of divine energy that pierces darkness.',
  },
  holy_judgment: {
    id: 'holy_judgment', name: 'Holy Judgment', element: 'Angel', power: 2.2,
    minigameType: 'ButtonSequence', statusEffect: { effect: 'DefDown', threshold: 72 },
    description: 'The wrath of the heavens made manifest.',
  },
  cosmic_ray: {
    id: 'cosmic_ray', name: 'Cosmic Ray', element: 'Cosmos', power: 1.8,
    minigameType: 'ButtonSequence',
    description: 'A ray of condensed cosmic energy.',
  },
  star_collapse: {
    id: 'star_collapse', name: 'Star Collapse', element: 'Cosmos', power: 2.3,
    minigameType: 'ButtonSequence', statusEffect: { effect: 'DefDown', threshold: 68 },
    description: 'Collapses a star onto the target.',
  },
  combat_rush: {
    id: 'combat_rush', name: 'Combat Rush', element: 'Combat', power: 1.3,
    minigameType: 'TimingBar', statusEffect: { effect: 'DefDown', threshold: 65 },
    description: 'A rapid combo strike that may lower defense.',
  },
  finishing_blow: {
    id: 'finishing_blow', name: 'Finishing Blow', element: 'Combat', power: 2.1,
    minigameType: 'AimClick', statusEffect: { effect: 'Stun', threshold: 80 },
    description: 'A perfectly aimed strike that may Stun.',
  },

  // ── Fire additions ──
  flame_burst: {
    id: 'flame_burst', name: 'Flame Burst', element: 'Fire', power: 0.8,
    minigameType: 'TimingBar', statusEffect: { effect: 'Burn', threshold: 60 },
    description: 'A quick pop of flame. Easy to land, often Burns.',
  },
  scorch: {
    id: 'scorch', name: 'Scorch', element: 'Fire', power: 1.3,
    minigameType: 'AimClick', statusEffect: { effect: 'Burn', threshold: 75 },
    description: 'A concentrated heat beam that sears on impact.',
  },
  lava_surge: {
    id: 'lava_surge', name: 'Lava Surge', element: 'Fire', power: 1.6,
    minigameType: 'AimClick', statusEffect: { effect: 'Burn', threshold: 80 },
    description: 'A surge of molten rock. Burns on good aim.',
  },
  pyroclasm: {
    id: 'pyroclasm', name: 'Pyroclasm', element: 'Fire', power: 2.2,
    minigameType: 'ButtonSequence', statusEffect: { effect: 'Burn', threshold: 65 },
    description: 'A volcanic eruption of pure fire fury.',
  },
  sun_flare: {
    id: 'sun_flare', name: 'Sun Flare', element: 'Fire', power: 2.5,
    minigameType: 'ButtonSequence', statusEffect: { effect: 'Blind', threshold: 70 },
    description: 'Channels solar energy into a blinding burst.',
  },
  cinder_rain: {
    id: 'cinder_rain', name: 'Cinder Rain', element: 'Fire', power: 1.1,
    minigameType: 'TimingBar', statusEffect: { effect: 'Burn', threshold: 55 },
    description: 'Embers rain from above, frequently Burning.',
  },
  magma_pillar: {
    id: 'magma_pillar', name: 'Magma Pillar', element: 'Fire', power: 2.8,
    minigameType: 'ButtonSequence',
    description: 'A colossal pillar of magma erupts beneath the foe.',
  },

  // ── Water additions ──
  water_pulse: {
    id: 'water_pulse', name: 'Water Pulse', element: 'Water', power: 0.9,
    minigameType: 'TimingBar', statusEffect: { effect: 'Stun', threshold: 80 },
    description: 'A pulsing water ring that may Stun.',
  },
  hydro_blast: {
    id: 'hydro_blast', name: 'Hydro Blast', element: 'Water', power: 1.5,
    minigameType: 'AimClick',
    description: 'A high-pressure water cannon aimed with precision.',
  },
  whirlpool: {
    id: 'whirlpool', name: 'Whirlpool', element: 'Water', power: 1.7,
    minigameType: 'AimClick', statusEffect: { effect: 'DefDown', threshold: 70 },
    description: 'Traps the foe in a spinning vortex of water.',
  },
  ocean_crush: {
    id: 'ocean_crush', name: 'Ocean Crush', element: 'Water', power: 2.4,
    minigameType: 'ButtonSequence', statusEffect: { effect: 'Stun', threshold: 72 },
    description: 'Brings the full weight of the ocean down.',
  },
  mist_veil: {
    id: 'mist_veil', name: 'Mist Veil', element: 'Water', power: 0.8,
    minigameType: 'TimingBar', statusEffect: { effect: 'Blind', threshold: 65 },
    description: 'Shrouds the foe in blinding mist.',
  },
  torrent: {
    id: 'torrent', name: 'Torrent', element: 'Water', power: 2.0,
    minigameType: 'ButtonSequence', statusEffect: { effect: 'DefDown', threshold: 75 },
    description: 'A relentless water assault that erodes defenses.',
  },
  bubble_beam: {
    id: 'bubble_beam', name: 'Bubble Beam', element: 'Water', power: 1.2,
    minigameType: 'TimingBar', statusEffect: { effect: 'DefDown', threshold: 68 },
    description: 'High-pressure bubbles that chip away at armor.',
  },

  // ── Electric additions ──
  volt_strike: {
    id: 'volt_strike', name: 'Volt Strike', element: 'Electric', power: 1.4,
    minigameType: 'AimClick', statusEffect: { effect: 'Paralyze', threshold: 72 },
    description: 'A targeted electric strike. Paralyzes on good aim.',
  },
  static_field: {
    id: 'static_field', name: 'Static Field', element: 'Electric', power: 0.8,
    minigameType: 'TimingBar', statusEffect: { effect: 'Paralyze', threshold: 60 },
    description: 'Generates a static field, frequently Paralyzing.',
  },
  chain_lightning: {
    id: 'chain_lightning', name: 'Chain Lightning', element: 'Electric', power: 1.9,
    minigameType: 'ButtonSequence', statusEffect: { effect: 'Paralyze', threshold: 78 },
    description: 'Lightning that chains to every weak point.',
  },
  overcharge: {
    id: 'overcharge', name: 'Overcharge', element: 'Electric', power: 2.3,
    minigameType: 'ButtonSequence', statusEffect: { effect: 'Stun', threshold: 68 },
    description: 'An overloaded burst that Stuns with excess voltage.',
  },
  plasma_beam: {
    id: 'plasma_beam', name: 'Plasma Beam', element: 'Electric', power: 2.7,
    minigameType: 'ButtonSequence',
    description: 'A condensed beam of superheated plasma.',
  },
  zap_dash: {
    id: 'zap_dash', name: 'Zap Dash', element: 'Electric', power: 1.0,
    minigameType: 'TimingBar', statusEffect: { effect: 'Paralyze', threshold: 75 },
    description: 'Dashes through the foe at lightning speed.',
  },
  thunder_clap: {
    id: 'thunder_clap', name: 'Thunder Clap', element: 'Electric', power: 1.6,
    minigameType: 'AimClick', statusEffect: { effect: 'AtkDown', threshold: 70 },
    description: 'Clapping thunder weakens the foe\'s resolve.',
  },

  // ── Earth additions ──
  mudslide: {
    id: 'mudslide', name: 'Mudslide', element: 'Earth', power: 1.0,
    minigameType: 'TimingBar', statusEffect: { effect: 'DefDown', threshold: 65 },
    description: 'Buries the foe in earth, lowering defense.',
  },
  stone_edge: {
    id: 'stone_edge', name: 'Stone Edge', element: 'Earth', power: 1.7,
    minigameType: 'AimClick',
    description: 'Razor-sharp stone shards launched with precision.',
  },
  ground_zero: {
    id: 'ground_zero', name: 'Ground Zero', element: 'Earth', power: 2.5,
    minigameType: 'ButtonSequence', statusEffect: { effect: 'DefDown', threshold: 60 },
    description: 'A seismic shockwave that levels everything.',
  },
  pebble_shot: {
    id: 'pebble_shot', name: 'Pebble Shot', element: 'Earth', power: 0.7,
    minigameType: 'TimingBar',
    description: 'A rapid spray of pebbles. Weak but reliable.',
  },
  landslide: {
    id: 'landslide', name: 'Landslide', element: 'Earth', power: 2.0,
    minigameType: 'ButtonSequence', statusEffect: { effect: 'Stun', threshold: 72 },
    description: 'An avalanche of boulders that buries and Stuns.',
  },
  tremor: {
    id: 'tremor', name: 'Tremor', element: 'Earth', power: 1.3,
    minigameType: 'AimClick', statusEffect: { effect: 'DefDown', threshold: 70 },
    description: 'Minor earthquake that weakens the foe\'s footing.',
  },
  granite_fist: {
    id: 'granite_fist', name: 'Granite Fist', element: 'Earth', power: 1.8,
    minigameType: 'AimClick', statusEffect: { effect: 'Stun', threshold: 82 },
    description: 'A stone-encased punch delivered with pinpoint force.',
  },

  // ── Air additions ──
  razor_wind: {
    id: 'razor_wind', name: 'Razor Wind', element: 'Air', power: 1.0,
    minigameType: 'TimingBar', statusEffect: { effect: 'DefDown', threshold: 68 },
    description: 'Slashing blades of wind that shred armor.',
  },
  whirlwind: {
    id: 'whirlwind', name: 'Whirlwind', element: 'Air', power: 1.5,
    minigameType: 'AimClick', statusEffect: { effect: 'Blind', threshold: 72 },
    description: 'A localized twister that blinds the target.',
  },
  cyclone: {
    id: 'cyclone', name: 'Cyclone', element: 'Air', power: 2.3,
    minigameType: 'ButtonSequence', statusEffect: { effect: 'Blind', threshold: 65 },
    description: 'A devastating cyclone with near-certain Blind.',
  },
  jet_stream: {
    id: 'jet_stream', name: 'Jet Stream', element: 'Air', power: 1.8,
    minigameType: 'ButtonSequence', statusEffect: { effect: 'AtkDown', threshold: 75 },
    description: 'A supersonic air current that strips combat focus.',
  },
  air_cutter: {
    id: 'air_cutter', name: 'Air Cutter', element: 'Air', power: 1.2,
    minigameType: 'AimClick',
    description: 'A precise air blade launched at high velocity.',
  },
  hurricane_force: {
    id: 'hurricane_force', name: 'Hurricane Force', element: 'Air', power: 2.8,
    minigameType: 'ButtonSequence',
    description: 'The raw power of a hurricane channeled into one strike.',
  },
  breeze_slash: {
    id: 'breeze_slash', name: 'Breeze Slash', element: 'Air', power: 0.9,
    minigameType: 'TimingBar',
    description: 'A light slash of moving air. Quick and consistent.',
  },

  // ── Ice additions ──
  ice_shard: {
    id: 'ice_shard', name: 'Ice Shard', element: 'Ice', power: 0.8,
    minigameType: 'TimingBar', statusEffect: { effect: 'Freeze', threshold: 65 },
    description: 'Shards of ice hurled rapidly. Often Freezes.',
  },
  glacial_lance: {
    id: 'glacial_lance', name: 'Glacial Lance', element: 'Ice', power: 1.6,
    minigameType: 'AimClick', statusEffect: { effect: 'Freeze', threshold: 78 },
    description: 'A lance of solid ice aimed at a vital point.',
  },
  ice_age: {
    id: 'ice_age', name: 'Ice Age', element: 'Ice', power: 2.7,
    minigameType: 'ButtonSequence', statusEffect: { effect: 'Freeze', threshold: 62 },
    description: 'Recreates the ice age, blanketing foes in permafrost.',
  },
  snowstorm: {
    id: 'snowstorm', name: 'Snowstorm', element: 'Ice', power: 1.4,
    minigameType: 'AimClick', statusEffect: { effect: 'Blind', threshold: 70 },
    description: 'A blinding snowstorm that obscures all vision.',
  },
  absolute_zero: {
    id: 'absolute_zero', name: 'Absolute Zero', element: 'Ice', power: 3.0,
    minigameType: 'ButtonSequence', statusEffect: { effect: 'Freeze', threshold: 50 },
    description: 'The ultimate ice attack. Almost always Freezes on full sequence.',
  },
  cryo_pulse: {
    id: 'cryo_pulse', name: 'Cryo Pulse', element: 'Ice', power: 1.1,
    minigameType: 'TimingBar', statusEffect: { effect: 'Freeze', threshold: 72 },
    description: 'A cold pulse that seeps into the target\'s bones.',
  },
  frostwave: {
    id: 'frostwave', name: 'Frostwave', element: 'Ice', power: 2.1,
    minigameType: 'ButtonSequence', statusEffect: { effect: 'DefDown', threshold: 70 },
    description: 'A sweeping wave of frost that cracks armor.',
  },

  // ── Darkness additions ──
  dark_pulse: {
    id: 'dark_pulse', name: 'Dark Pulse', element: 'Darkness', power: 0.9,
    minigameType: 'TimingBar', statusEffect: { effect: 'AtkDown', threshold: 62 },
    description: 'A shockwave of dark energy that saps strength.',
  },
  nightmare: {
    id: 'nightmare', name: 'Nightmare', element: 'Darkness', power: 1.5,
    minigameType: 'AimClick', statusEffect: { effect: 'AtkDown', threshold: 72 },
    description: 'Injects a nightmare directly into the foe\'s mind.',
  },
  void_shroud: {
    id: 'void_shroud', name: 'Void Shroud', element: 'Darkness', power: 1.2,
    minigameType: 'TimingBar', statusEffect: { effect: 'Blind', threshold: 67 },
    description: 'A cloak of darkness that blinds the enemy.',
  },
  abyss_strike: {
    id: 'abyss_strike', name: 'Abyss Strike', element: 'Darkness', power: 2.2,
    minigameType: 'ButtonSequence', statusEffect: { effect: 'DefDown', threshold: 68 },
    description: 'A blow empowered by the deepest abyss.',
  },
  dark_torrent: {
    id: 'dark_torrent', name: 'Dark Torrent', element: 'Darkness', power: 2.6,
    minigameType: 'ButtonSequence',
    description: 'An overwhelming torrent of pure shadow energy.',
  },
  eclipse: {
    id: 'eclipse', name: 'Eclipse', element: 'Darkness', power: 1.8,
    minigameType: 'AimClick', statusEffect: { effect: 'Blind', threshold: 75 },
    description: 'Blots out all light, Blinding the target completely.',
  },
  shadow_claw: {
    id: 'shadow_claw', name: 'Shadow Claw', element: 'Darkness', power: 1.0,
    minigameType: 'TimingBar',
    description: 'A talon formed from shadow. Reliable dark damage.',
  },

  // ── Light additions ──
  light_lance: {
    id: 'light_lance', name: 'Light Lance', element: 'Light', power: 1.0,
    minigameType: 'TimingBar',
    description: 'A focused lance of pure light energy.',
  },
  radiant_burst: {
    id: 'radiant_burst', name: 'Radiant Burst', element: 'Light', power: 1.7,
    minigameType: 'AimClick', statusEffect: { effect: 'Blind', threshold: 72 },
    description: 'A brilliant flash aimed to Blind on impact.',
  },
  solar_beam: {
    id: 'solar_beam', name: 'Solar Beam', element: 'Light', power: 2.4,
    minigameType: 'ButtonSequence',
    description: 'Channels raw sunlight into a searing beam.',
  },
  photon_strike: {
    id: 'photon_strike', name: 'Photon Strike', element: 'Light', power: 2.0,
    minigameType: 'ButtonSequence', statusEffect: { effect: 'AtkDown', threshold: 70 },
    description: 'Photons accelerated to weapon-grade intensity.',
  },
  shimmer_slash: {
    id: 'shimmer_slash', name: 'Shimmer Slash', element: 'Light', power: 0.9,
    minigameType: 'TimingBar', statusEffect: { effect: 'Blind', threshold: 58 },
    description: 'A glancing light strike that often Blinds.',
  },
  aurora_wave: {
    id: 'aurora_wave', name: 'Aurora Wave', element: 'Light', power: 1.5,
    minigameType: 'AimClick', statusEffect: { effect: 'DefDown', threshold: 75 },
    description: 'A wave of aurora energy that weakens defenses.',
  },
  sacred_arrow: {
    id: 'sacred_arrow', name: 'Sacred Arrow', element: 'Light', power: 2.8,
    minigameType: 'ButtonSequence', statusEffect: { effect: 'Stun', threshold: 72 },
    description: 'A divine arrow of concentrated holiness.',
  },

  // ── Metal additions ──
  iron_slam: {
    id: 'iron_slam', name: 'Iron Slam', element: 'Metal', power: 1.0,
    minigameType: 'TimingBar', statusEffect: { effect: 'DefDown', threshold: 68 },
    description: 'A heavy iron blow that dents armor.',
  },
  steel_storm: {
    id: 'steel_storm', name: 'Steel Storm', element: 'Metal', power: 1.8,
    minigameType: 'AimClick', statusEffect: { effect: 'DefDown', threshold: 78 },
    description: 'A storm of steel shards aimed at weak points.',
  },
  titanfall: {
    id: 'titanfall', name: 'Titanfall', element: 'Metal', power: 2.6,
    minigameType: 'ButtonSequence', statusEffect: { effect: 'Stun', threshold: 68 },
    description: 'A titan-weight metal drop that Stuns on full sequence.',
  },
  rivet_shot: {
    id: 'rivet_shot', name: 'Rivet Shot', element: 'Metal', power: 0.8,
    minigameType: 'TimingBar',
    description: 'A burst of metal rivets at high speed. Fast and simple.',
  },
  anvil_drop: {
    id: 'anvil_drop', name: 'Anvil Drop', element: 'Metal', power: 2.1,
    minigameType: 'ButtonSequence', statusEffect: { effect: 'DefDown', threshold: 70 },
    description: 'Drops an anvil of pure condensed metal.',
  },
  blade_rain: {
    id: 'blade_rain', name: 'Blade Rain', element: 'Metal', power: 1.4,
    minigameType: 'AimClick', statusEffect: { effect: 'Burn', threshold: 80 },
    description: 'Superheated blades rain down, may Burn.',
  },
  chrome_crush: {
    id: 'chrome_crush', name: 'Chrome Crush', element: 'Metal', power: 1.2,
    minigameType: 'TimingBar', statusEffect: { effect: 'DefDown', threshold: 72 },
    description: 'A chrome-plated body slam that cracks defense.',
  },

  // ── Poison additions ──
  acid_spray: {
    id: 'acid_spray', name: 'Acid Spray', element: 'Poison', power: 0.9,
    minigameType: 'TimingBar', statusEffect: { effect: 'Poison', threshold: 62 },
    description: 'A spray of acid that frequently Poisons.',
  },
  toxic_barrage: {
    id: 'toxic_barrage', name: 'Toxic Barrage', element: 'Poison', power: 1.7,
    minigameType: 'AimClick', statusEffect: { effect: 'Poison', threshold: 78 },
    description: 'A barrage of toxic darts aimed for maximum Poison.',
  },
  plague_cloud: {
    id: 'plague_cloud', name: 'Plague Cloud', element: 'Poison', power: 2.2,
    minigameType: 'ButtonSequence', statusEffect: { effect: 'Poison', threshold: 65 },
    description: 'A toxic cloud that fills the field with plague.',
  },
  neurotoxin: {
    id: 'neurotoxin', name: 'Neurotoxin', element: 'Poison', power: 1.4,
    minigameType: 'AimClick', statusEffect: { effect: 'AtkDown', threshold: 70 },
    description: 'A refined nerve toxin that weakens the foe\'s strikes.',
  },
  sludge_bomb: {
    id: 'sludge_bomb', name: 'Sludge Bomb', element: 'Poison', power: 1.2,
    minigameType: 'TimingBar', statusEffect: { effect: 'Poison', threshold: 68 },
    description: 'A thrown sludge bomb that bursts with toxic goo.',
  },
  venom_storm: {
    id: 'venom_storm', name: 'Venom Storm', element: 'Poison', power: 2.7,
    minigameType: 'ButtonSequence', statusEffect: { effect: 'Poison', threshold: 55 },
    description: 'A lethal venom storm that almost always Poisons.',
  },
  corrosive_bite: {
    id: 'corrosive_bite', name: 'Corrosive Bite', element: 'Poison', power: 1.6,
    minigameType: 'AimClick', statusEffect: { effect: 'DefDown', threshold: 72 },
    description: 'A bite that dissolves armor on contact.',
  },

  // ── Combat additions ──
  power_punch: {
    id: 'power_punch', name: 'Power Punch', element: 'Combat', power: 1.5,
    minigameType: 'AimClick', statusEffect: { effect: 'Stun', threshold: 78 },
    description: 'A charged haymaker that may Stun on precise aim.',
  },
  rapid_strikes: {
    id: 'rapid_strikes', name: 'Rapid Strikes', element: 'Combat', power: 0.9,
    minigameType: 'TimingBar', statusEffect: { effect: 'AtkDown', threshold: 62 },
    description: 'Multiple swift hits that chip away at strength.',
  },
  combo_breaker: {
    id: 'combo_breaker', name: 'Combo Breaker', element: 'Combat', power: 1.8,
    minigameType: 'ButtonSequence', statusEffect: { effect: 'Stun', threshold: 75 },
    description: 'A complex combo ending in a stunning blow.',
  },
  ground_smash: {
    id: 'ground_smash', name: 'Ground Smash', element: 'Combat', power: 2.4,
    minigameType: 'ButtonSequence', statusEffect: { effect: 'DefDown', threshold: 68 },
    description: 'Slams the foe into the ground with full force.',
  },
  war_cry: {
    id: 'war_cry', name: 'War Cry', element: 'Combat', power: 0.8,
    minigameType: 'TimingBar', statusEffect: { effect: 'AtkDown', threshold: 58 },
    description: 'A battle cry that unnerves and weakens the foe.',
  },
  ultimate_punch: {
    id: 'ultimate_punch', name: 'Ultimate Punch', element: 'Combat', power: 2.9,
    minigameType: 'ButtonSequence',
    description: 'The culmination of every fighting technique learned.',
  },
  sweep_kick: {
    id: 'sweep_kick', name: 'Sweep Kick', element: 'Combat', power: 1.2,
    minigameType: 'AimClick', statusEffect: { effect: 'DefDown', threshold: 72 },
    description: 'A leg sweep that topples and weakens defenses.',
  },

  // ── Magic additions ──
  mana_bolt: {
    id: 'mana_bolt', name: 'Mana Bolt', element: 'Magic', power: 0.9,
    minigameType: 'TimingBar', statusEffect: { effect: 'AtkDown', threshold: 65 },
    description: 'A raw mana bolt that drains the target\'s power.',
  },
  spell_bind: {
    id: 'spell_bind', name: 'Spell Bind', element: 'Magic', power: 1.3,
    minigameType: 'AimClick', statusEffect: { effect: 'Stun', threshold: 80 },
    description: 'A binding spell that may lock the foe in place.',
  },
  arcane_storm: {
    id: 'arcane_storm', name: 'Arcane Storm', element: 'Magic', power: 2.4,
    minigameType: 'ButtonSequence', statusEffect: { effect: 'AtkDown', threshold: 65 },
    description: 'A storm of chaotic magic that weakens the foe.',
  },
  hex: {
    id: 'hex', name: 'Hex', element: 'Magic', power: 1.6,
    minigameType: 'AimClick', statusEffect: { effect: 'Poison', threshold: 75 },
    description: 'A cursed hex that poisons the mind and body.',
  },
  grand_sorcery: {
    id: 'grand_sorcery', name: 'Grand Sorcery', element: 'Magic', power: 2.9,
    minigameType: 'ButtonSequence',
    description: 'The most powerful known sorcery, unleashed fully.',
  },
  charm_wave: {
    id: 'charm_wave', name: 'Charm Wave', element: 'Magic', power: 0.8,
    minigameType: 'TimingBar', statusEffect: { effect: 'AtkDown', threshold: 60 },
    description: 'A charming wave that lowers the foe\'s will to fight.',
  },
  runic_blast: {
    id: 'runic_blast', name: 'Runic Blast', element: 'Magic', power: 1.8,
    minigameType: 'ButtonSequence', statusEffect: { effect: 'Stun', threshold: 78 },
    description: 'Ancient runes ignite in a powerful explosion.',
  },

  // ── Angel additions ──
  seraph_strike: {
    id: 'seraph_strike', name: 'Seraph Strike', element: 'Angel', power: 1.0,
    minigameType: 'TimingBar',
    description: 'A strike blessed by a seraph. Pure and powerful.',
  },
  wing_slash: {
    id: 'wing_slash', name: 'Wing Slash', element: 'Angel', power: 1.3,
    minigameType: 'AimClick', statusEffect: { effect: 'DefDown', threshold: 72 },
    description: 'A feathered wing slash that cuts through defense.',
  },
  divine_storm: {
    id: 'divine_storm', name: 'Divine Storm', element: 'Angel', power: 2.3,
    minigameType: 'ButtonSequence', statusEffect: { effect: 'Stun', threshold: 68 },
    description: 'Heaven\'s fury unleashed in a righteous storm.',
  },
  holy_smite: {
    id: 'holy_smite', name: 'Holy Smite', element: 'Angel', power: 1.8,
    minigameType: 'AimClick', statusEffect: { effect: 'Blind', threshold: 75 },
    description: 'A smiting blow of holy light that Blinds.',
  },
  celestial_arrow: {
    id: 'celestial_arrow', name: 'Celestial Arrow', element: 'Angel', power: 2.7,
    minigameType: 'ButtonSequence',
    description: 'An arrow forged in the heart of a celestial realm.',
  },
  blessing_strike: {
    id: 'blessing_strike', name: 'Blessing Strike', element: 'Angel', power: 0.8,
    minigameType: 'TimingBar', statusEffect: { effect: 'AtkDown', threshold: 62 },
    description: 'A blessed strike that saps the foe\'s aggression.',
  },
  halo_crash: {
    id: 'halo_crash', name: 'Halo Crash', element: 'Angel', power: 2.0,
    minigameType: 'ButtonSequence', statusEffect: { effect: 'DefDown', threshold: 70 },
    description: 'Smashes a divine halo down onto the enemy.',
  },

  // ── Demon additions ──
  brimstone: {
    id: 'brimstone', name: 'Brimstone', element: 'Demon', power: 1.0,
    minigameType: 'TimingBar', statusEffect: { effect: 'Burn', threshold: 65 },
    description: 'Calls down brimstone from the infernal sky.',
  },
  claw_rend: {
    id: 'claw_rend', name: 'Claw Rend', element: 'Demon', power: 1.5,
    minigameType: 'AimClick', statusEffect: { effect: 'DefDown', threshold: 72 },
    description: 'Demonic claws tear through armor plating.',
  },
  infernal_burst: {
    id: 'infernal_burst', name: 'Infernal Burst', element: 'Demon', power: 2.3,
    minigameType: 'ButtonSequence', statusEffect: { effect: 'Burn', threshold: 65 },
    description: 'An explosion of pure infernal power.',
  },
  dark_pact: {
    id: 'dark_pact', name: 'Dark Pact', element: 'Demon', power: 1.8,
    minigameType: 'AimClick', statusEffect: { effect: 'AtkDown', threshold: 75 },
    description: 'A pact with darkness that drains the foe\'s power.',
  },
  abyssal_roar: {
    id: 'abyssal_roar', name: 'Abyssal Roar', element: 'Demon', power: 0.8,
    minigameType: 'TimingBar', statusEffect: { effect: 'AtkDown', threshold: 60 },
    description: 'A roar from the abyss that terrifies and weakens.',
  },
  demon_surge: {
    id: 'demon_surge', name: 'Demon Surge', element: 'Demon', power: 2.6,
    minigameType: 'ButtonSequence',
    description: 'A full surge of demonic power released at once.',
  },
  sin_slash: {
    id: 'sin_slash', name: 'Sin Slash', element: 'Demon', power: 1.2,
    minigameType: 'AimClick', statusEffect: { effect: 'Poison', threshold: 75 },
    description: 'A sinful slash infused with infernal venom.',
  },

  // ── Plant additions ──
  petal_burst: {
    id: 'petal_burst', name: 'Petal Burst', element: 'Plant', power: 0.8,
    minigameType: 'TimingBar', statusEffect: { effect: 'Poison', threshold: 62 },
    description: 'Toxic petals burst onto the target.',
  },
  vine_lash: {
    id: 'vine_lash', name: 'Vine Lash', element: 'Plant', power: 1.4,
    minigameType: 'AimClick', statusEffect: { effect: 'DefDown', threshold: 72 },
    description: 'A whipping vine that strips away armor.',
  },
  overgrowth: {
    id: 'overgrowth', name: 'Overgrowth', element: 'Plant', power: 2.2,
    minigameType: 'ButtonSequence', statusEffect: { effect: 'Stun', threshold: 70 },
    description: 'Roots explode from the ground and immobilize.',
  },
  spore_cloud: {
    id: 'spore_cloud', name: 'Spore Cloud', element: 'Plant', power: 1.0,
    minigameType: 'TimingBar', statusEffect: { effect: 'Blind', threshold: 65 },
    description: 'A cloud of blinding spores erupts from the foe.',
  },
  natures_wrath: {
    id: 'natures_wrath', name: 'Nature\'s Wrath', element: 'Plant', power: 2.6,
    minigameType: 'ButtonSequence', statusEffect: { effect: 'Poison', threshold: 58 },
    description: 'Nature itself attacks — and it is angry.',
  },
  root_bind: {
    id: 'root_bind', name: 'Root Bind', element: 'Plant', power: 1.7,
    minigameType: 'AimClick', statusEffect: { effect: 'Stun', threshold: 80 },
    description: 'Roots lunge from the earth to bind the enemy.',
  },
  leaf_storm: {
    id: 'leaf_storm', name: 'Leaf Storm', element: 'Plant', power: 1.2,
    minigameType: 'TimingBar', statusEffect: { effect: 'DefDown', threshold: 68 },
    description: 'A storm of razor-sharp leaves that cuts defense.',
  },

  // ── Glitch additions ──
  data_breach: {
    id: 'data_breach', name: 'Data Breach', element: 'Glitch', power: 1.2,
    minigameType: 'AimClick', statusEffect: { effect: 'AtkDown', threshold: 72 },
    description: 'Accesses the foe\'s data and corrupts their attack.',
  },
  error_wave: {
    id: 'error_wave', name: 'Error Wave', element: 'Glitch', power: 0.9,
    minigameType: 'TimingBar', statusEffect: { effect: 'Paralyze', threshold: 65 },
    description: 'A wave of corrupted data that Paralyzes circuits.',
  },
  corrupt_strike: {
    id: 'corrupt_strike', name: 'Corrupt Strike', element: 'Glitch', power: 1.7,
    minigameType: 'AimClick', statusEffect: { effect: 'Stun', threshold: 78 },
    description: 'A corrupted attack that scrambles the target.',
  },
  system_crash: {
    id: 'system_crash', name: 'System Crash', element: 'Glitch', power: 2.8,
    minigameType: 'ButtonSequence', statusEffect: { effect: 'Stun', threshold: 55 },
    description: 'Crashes every system in the foe\'s body at once.',
  },
  null_pointer: {
    id: 'null_pointer', name: 'Null Pointer', element: 'Glitch', power: 1.5,
    minigameType: 'AimClick', statusEffect: { effect: 'AtkDown', threshold: 75 },
    description: 'Points a null reference at the foe\'s attack logic.',
  },
  code_break: {
    id: 'code_break', name: 'Code Break', element: 'Glitch', power: 2.2,
    minigameType: 'ButtonSequence', statusEffect: { effect: 'DefDown', threshold: 65 },
    description: 'Breaks the foe\'s defensive code entirely.',
  },
  overflow: {
    id: 'overflow', name: 'Overflow', element: 'Glitch', power: 3.0,
    minigameType: 'ButtonSequence',
    description: 'An integer overflow that destroys everything it touches.',
  },

  // ── Time additions ──
  rewind: {
    id: 'rewind', name: 'Rewind', element: 'Time', power: 0.8,
    minigameType: 'TimingBar', statusEffect: { effect: 'AtkDown', threshold: 62 },
    description: 'Rewinds the foe\'s power, reducing their attack.',
  },
  temporal_strike: {
    id: 'temporal_strike', name: 'Temporal Strike', element: 'Time', power: 1.4,
    minigameType: 'AimClick', statusEffect: { effect: 'Stun', threshold: 78 },
    description: 'A strike that occurs across multiple moments at once.',
  },
  time_warp: {
    id: 'time_warp', name: 'Time Warp', element: 'Time', power: 1.8,
    minigameType: 'ButtonSequence', statusEffect: { effect: 'Stun', threshold: 72 },
    description: 'Warps time around the foe, Stunning them.',
  },
  chrono_blast: {
    id: 'chrono_blast', name: 'Chrono Blast', element: 'Time', power: 2.4,
    minigameType: 'ButtonSequence', statusEffect: { effect: 'DefDown', threshold: 65 },
    description: 'Condenses a billion years of erosion into one instant.',
  },
  age_drain: {
    id: 'age_drain', name: 'Age Drain', element: 'Time', power: 1.2,
    minigameType: 'AimClick', statusEffect: { effect: 'AtkDown', threshold: 75 },
    description: 'Ages the foe rapidly, draining their combat power.',
  },
  time_shatter: {
    id: 'time_shatter', name: 'Time Shatter', element: 'Time', power: 2.8,
    minigameType: 'ButtonSequence',
    description: 'Shatters the timeline at the foe\'s location.',
  },
  past_echo: {
    id: 'past_echo', name: 'Past Echo', element: 'Time', power: 1.6,
    minigameType: 'AimClick', statusEffect: { effect: 'AtkDown', threshold: 68 },
    description: 'Echoes a past hit to deal damage again.',
  },

  // ── Crystal additions ──
  gem_shower: {
    id: 'gem_shower', name: 'Gem Shower', element: 'Crystal', power: 0.9,
    minigameType: 'TimingBar', statusEffect: { effect: 'DefDown', threshold: 65 },
    description: 'A shower of gem shards that chip at armor.',
  },
  prism_beam: {
    id: 'prism_beam', name: 'Prism Beam', element: 'Crystal', power: 1.6,
    minigameType: 'AimClick', statusEffect: { effect: 'Blind', threshold: 72 },
    description: 'A prismatic beam that refracts into Blind.',
  },
  diamond_drill: {
    id: 'diamond_drill', name: 'Diamond Drill', element: 'Crystal', power: 2.0,
    minigameType: 'ButtonSequence', statusEffect: { effect: 'DefDown', threshold: 68 },
    description: 'A rotating diamond drill that bores through defense.',
  },
  crystal_storm: {
    id: 'crystal_storm', name: 'Crystal Storm', element: 'Crystal', power: 2.5,
    minigameType: 'ButtonSequence', statusEffect: { effect: 'Freeze', threshold: 70 },
    description: 'A storm of freezing crystal shards.',
  },
  shard_blast: {
    id: 'shard_blast', name: 'Shard Blast', element: 'Crystal', power: 1.2,
    minigameType: 'AimClick',
    description: 'A directional blast of crystal shards.',
  },
  geode_crush: {
    id: 'geode_crush', name: 'Geode Crush', element: 'Crystal', power: 1.8,
    minigameType: 'ButtonSequence', statusEffect: { effect: 'DefDown', threshold: 75 },
    description: 'A massive geode brought down on the enemy.',
  },
  refraction: {
    id: 'refraction', name: 'Refraction', element: 'Crystal', power: 1.0,
    minigameType: 'TimingBar', statusEffect: { effect: 'Blind', threshold: 68 },
    description: 'Bends light through crystal to Blind the foe.',
  },

  // ── Sand additions ──
  quicksand: {
    id: 'quicksand', name: 'Quicksand', element: 'Sand', power: 1.0,
    minigameType: 'TimingBar', statusEffect: { effect: 'DefDown', threshold: 65 },
    description: 'Bogs the foe down in quicksand, lowering defense.',
  },
  sandstorm: {
    id: 'sandstorm', name: 'Sandstorm', element: 'Sand', power: 1.5,
    minigameType: 'AimClick', statusEffect: { effect: 'Blind', threshold: 70 },
    description: 'A targeted sandstorm that Blinds the target.',
  },
  desert_fang: {
    id: 'desert_fang', name: 'Desert Fang', element: 'Sand', power: 1.2,
    minigameType: 'AimClick',
    description: 'Hardened sand fangs that pierce with force.',
  },
  buried_alive: {
    id: 'buried_alive', name: 'Buried Alive', element: 'Sand', power: 2.3,
    minigameType: 'ButtonSequence', statusEffect: { effect: 'Stun', threshold: 68 },
    description: 'Buries the foe under tons of sand, Stunning them.',
  },
  mirage: {
    id: 'mirage', name: 'Mirage', element: 'Sand', power: 0.8,
    minigameType: 'TimingBar', statusEffect: { effect: 'AtkDown', threshold: 62 },
    description: 'A desert mirage that disorients and weakens focus.',
  },
  dust_devil: {
    id: 'dust_devil', name: 'Dust Devil', element: 'Sand', power: 1.8,
    minigameType: 'ButtonSequence', statusEffect: { effect: 'Blind', threshold: 72 },
    description: 'A spinning sand column that Blinds and batters.',
  },
  scorching_sands: {
    id: 'scorching_sands', name: 'Scorching Sands', element: 'Sand', power: 2.6,
    minigameType: 'ButtonSequence', statusEffect: { effect: 'Burn', threshold: 65 },
    description: 'Desert heat focused into a scorching wave.',
  },

  // ── Sound additions ──
  shatter_note: {
    id: 'shatter_note', name: 'Shatter Note', element: 'Sound', power: 0.9,
    minigameType: 'TimingBar', statusEffect: { effect: 'DefDown', threshold: 65 },
    description: 'A note tuned to shatter the foe\'s defenses.',
  },
  bass_drop: {
    id: 'bass_drop', name: 'Bass Drop', element: 'Sound', power: 1.3,
    minigameType: 'AimClick', statusEffect: { effect: 'Stun', threshold: 78 },
    description: 'A seismic bass frequency that may Stun.',
  },
  screech: {
    id: 'screech', name: 'Screech', element: 'Sound', power: 0.8,
    minigameType: 'TimingBar', statusEffect: { effect: 'AtkDown', threshold: 58 },
    description: 'A painful screech that lowers the foe\'s attack.',
  },
  sonic_wave: {
    id: 'sonic_wave', name: 'Sonic Wave', element: 'Sound', power: 1.8,
    minigameType: 'ButtonSequence', statusEffect: { effect: 'DefDown', threshold: 72 },
    description: 'A destructive sonic wave that erodes armor.',
  },
  harmonic_blast: {
    id: 'harmonic_blast', name: 'Harmonic Blast', element: 'Sound', power: 2.4,
    minigameType: 'ButtonSequence', statusEffect: { effect: 'Stun', threshold: 65 },
    description: 'Harmonics tuned to maximum destructive resonance.',
  },
  thunder_song: {
    id: 'thunder_song', name: 'Thunder Song', element: 'Sound', power: 1.5,
    minigameType: 'AimClick', statusEffect: { effect: 'Blind', threshold: 73 },
    description: 'A song so powerful it temporarily blinds the target.',
  },
  silence: {
    id: 'silence', name: 'Silence', element: 'Sound', power: 2.8,
    minigameType: 'ButtonSequence',
    description: 'Removes all sound from the target, causing catastrophic damage.',
  },

  // ── Void additions ──
  null_wave: {
    id: 'null_wave', name: 'Null Wave', element: 'Void', power: 1.0,
    minigameType: 'TimingBar', statusEffect: { effect: 'DefDown', threshold: 68 },
    description: 'A wave of nothingness that dissolves defenses.',
  },
  obliterate: {
    id: 'obliterate', name: 'Obliterate', element: 'Void', power: 2.6,
    minigameType: 'ButtonSequence', statusEffect: { effect: 'DefDown', threshold: 60 },
    description: 'Attempts to remove the foe from existence.',
  },
  void_pulse: {
    id: 'void_pulse', name: 'Void Pulse', element: 'Void', power: 1.4,
    minigameType: 'AimClick', statusEffect: { effect: 'AtkDown', threshold: 72 },
    description: 'A pulse of void energy that saps the foe\'s power.',
  },
  nullify: {
    id: 'nullify', name: 'Nullify', element: 'Void', power: 0.8,
    minigameType: 'TimingBar', statusEffect: { effect: 'AtkDown', threshold: 60 },
    description: 'Nullifies a portion of the foe\'s strength.',
  },
  singularity: {
    id: 'singularity', name: 'Singularity', element: 'Void', power: 2.9,
    minigameType: 'ButtonSequence',
    description: 'Creates a point of infinite density, pulling everything in.',
  },
  void_lance: {
    id: 'void_lance', name: 'Void Lance', element: 'Void', power: 1.7,
    minigameType: 'AimClick', statusEffect: { effect: 'DefDown', threshold: 75 },
    description: 'A lance forged from condensed void energy.',
  },
  entropy: {
    id: 'entropy', name: 'Entropy', element: 'Void', power: 2.2,
    minigameType: 'ButtonSequence', statusEffect: { effect: 'DefDown', threshold: 68 },
    description: 'Accelerates entropy, decaying the foe\'s defenses.',
  },

  // ── Cosmos additions ──
  stardust: {
    id: 'stardust', name: 'Stardust', element: 'Cosmos', power: 0.9,
    minigameType: 'TimingBar', statusEffect: { effect: 'DefDown', threshold: 65 },
    description: 'Cosmic dust flung at incredible velocity.',
  },
  nebula_burst: {
    id: 'nebula_burst', name: 'Nebula Burst', element: 'Cosmos', power: 1.5,
    minigameType: 'AimClick', statusEffect: { effect: 'Blind', threshold: 72 },
    description: 'A burst of nebula gas that obscures and damages.',
  },
  meteor_shower: {
    id: 'meteor_shower', name: 'Meteor Shower', element: 'Cosmos', power: 2.1,
    minigameType: 'ButtonSequence', statusEffect: { effect: 'Stun', threshold: 70 },
    description: 'A barrage of meteors called down from orbit.',
  },
  supernova: {
    id: 'supernova', name: 'Supernova', element: 'Cosmos', power: 2.9,
    minigameType: 'ButtonSequence', statusEffect: { effect: 'Burn', threshold: 60 },
    description: 'Detonates a star. Absolutely devastating.',
  },
  galaxy_wave: {
    id: 'galaxy_wave', name: 'Galaxy Wave', element: 'Cosmos', power: 1.7,
    minigameType: 'AimClick', statusEffect: { effect: 'AtkDown', threshold: 73 },
    description: 'A wave of galactic energy that strips away power.',
  },
  comet_crash: {
    id: 'comet_crash', name: 'Comet Crash', element: 'Cosmos', power: 2.4,
    minigameType: 'ButtonSequence',
    description: 'Accelerates a comet into the foe at full speed.',
  },
  astral_pulse: {
    id: 'astral_pulse', name: 'Astral Pulse', element: 'Cosmos', power: 1.2,
    minigameType: 'TimingBar', statusEffect: { effect: 'AtkDown', threshold: 68 },
    description: 'An astral energy pulse that weakens the foe.',
  },

  // ── Psycho additions ──
  mind_crush: {
    id: 'mind_crush', name: 'Mind Crush', element: 'Psycho', power: 1.2,
    minigameType: 'AimClick', statusEffect: { effect: 'AtkDown', threshold: 72 },
    description: 'Crushes the foe\'s mental barriers.',
  },
  psychic_wave: {
    id: 'psychic_wave', name: 'Psychic Wave', element: 'Psycho', power: 0.9,
    minigameType: 'TimingBar', statusEffect: { effect: 'AtkDown', threshold: 62 },
    description: 'A gentle psychic wave that lowers attack.',
  },
  brain_storm: {
    id: 'brain_storm', name: 'Brain Storm', element: 'Psycho', power: 2.0,
    minigameType: 'ButtonSequence', statusEffect: { effect: 'Stun', threshold: 72 },
    description: 'A storm of psychic energy that overloads the brain.',
  },
  reality_rend: {
    id: 'reality_rend', name: 'Reality Rend', element: 'Psycho', power: 2.5,
    minigameType: 'ButtonSequence', statusEffect: { effect: 'AtkDown', threshold: 62 },
    description: 'Rends the foe\'s perception of reality.',
  },
  terror_spike: {
    id: 'terror_spike', name: 'Terror Spike', element: 'Psycho', power: 1.5,
    minigameType: 'AimClick', statusEffect: { effect: 'AtkDown', threshold: 78 },
    description: 'Spikes the foe\'s terror response to weaken them.',
  },
  mind_break: {
    id: 'mind_break', name: 'Mind Break', element: 'Psycho', power: 2.8,
    minigameType: 'ButtonSequence',
    description: 'Breaks the foe\'s mind completely. Maximum psychic power.',
  },
  telekinetic_slam: {
    id: 'telekinetic_slam', name: 'Telekinetic Slam', element: 'Psycho', power: 1.7,
    minigameType: 'AimClick', statusEffect: { effect: 'Stun', threshold: 80 },
    description: 'Telekinetically slams the foe into a wall.',
  },
};
