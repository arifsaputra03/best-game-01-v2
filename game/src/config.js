// SPIREBOUND — shared constants and the five spires' metadata.
// One spire = one hand-built level with its own palette, hazards and unlock.
export const VIEW_W = 1280;
export const VIEW_H = 720;
export const TILE = 36;

// Player physics (pixels, seconds).
export const PHYS = {
  gravity: 2400,
  runSpeed: 350,
  runAccel: 3200,
  airAccel: 2200,
  friction: 2800,
  jumpVel: -880,
  doubleJumpVel: -800,
  jumpCut: 0.45, // releasing jump early multiplies upward speed by this
  coyote: 0.10,
  jumpBuffer: 0.12,
  dashSpeed: 900,
  dashTime: 0.16,
  dashCooldown: 0.55,
  maxFall: 1100,
  playerW: 26,
  playerH: 38,
};

export const HEARTS = 3;
export const STORAGE_KEY = 'spirebound-best-v1';

// Spire metadata, in campaign order. `unlock` is the ability the climber
// gains when the spire is entered (announced on the level intro card).
export const SPIRES = [
  {
    name: 'Spire of Dawn',
    sub: 'First light over the broken stair',
    sky: ['#2b1d4e', '#c96f3b', '#f7c873'],
    hill: '#7a4a8a',
    ground: '#8a5a3b',
    groundTop: '#e8b25c',
    accent: '#ffd76a',
    shard: '#ffe9a3',
    unlock: null,
    unlockText: '',
    par: 75,
  },
  {
    name: 'Spire of Verdance',
    sub: 'Vines, beetles and the long way up',
    sky: ['#0e2f26', '#1f6b4a', '#9fd67a'],
    hill: '#14532d',
    ground: '#3d6b35',
    groundTop: '#7dc383',
    accent: '#b8f29a',
    shard: '#d8ffb0',
    unlock: 'doubleJump',
    unlockText: 'DOUBLE JUMP unlocked — press jump again in mid-air!',
    par: 90,
  },
  {
    name: 'Spire of Frost',
    sub: 'Thin ice, cold winds and thorn-spitters',
    sky: ['#0b1e33', '#2a5a8a', '#a8d8f0'],
    hill: '#274b73',
    ground: '#3f6d8f',
    groundTop: '#bfe3f5',
    accent: '#cfeeff',
    shard: '#e8f7ff',
    unlock: 'dash',
    unlockText: 'DASH unlocked — press SHIFT to burst forward (briefly untouchable)!',
    par: 105,
  },
  {
    name: 'Spire of Ember',
    sub: 'Crumbling stone over a burning deep',
    sky: ['#2b0f14', '#7a2418', '#f08a3c'],
    hill: '#5a1f16',
    ground: '#6b3a24',
    groundTop: '#e8a04c',
    accent: '#ffb35c',
    shard: '#ffe1a8',
    unlock: 'shield',
    unlockText: 'AEGIS unlocked — a shield that blocks one hit, restored at shrines!',
    par: 115,
  },
  {
    name: 'Spire of Storm',
    sub: 'The Warden waits where the lightning nests',
    sky: ['#120a2e', '#3d2a6b', '#8a6fd8'],
    hill: '#2a1d55',
    ground: '#4a3a78',
    groundTop: '#b39df0',
    accent: '#d8c8ff',
    shard: '#f0e8ff',
    unlock: null,
    unlockText: '',
    par: 150,
  },
];

export const UNLOCK_LABELS = {
  doubleJump: 'Double Jump',
  dash: 'Dash',
  shield: 'Aegis Shield',
};
