// The five spires: hand-designed layouts built from explicit segments.
// Grid: 48 cols x 20 rows, TILE 36 -> world 1728 x 720 (camera scrolls
// horizontally). Tile codes: 0 empty, 1 solid, 2 one-way, 3 crumbling,
// 4 spikes, 5 moving platform (becomes an entity). Entities are placed by
// (col, row) and converted to pixels at parse time.
import { TILE } from './config.js';

export const COLS = 48;
export const ROWS = 20;

const EMPTY = 0, SOLID = 1, ONEWAY = 2, CRUMBLE = 3, SPIKE = 4, MOVER = 5;

function blankGrid() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(EMPTY));
}

// def: { ground: [[x0,x1,yTop],...], plats: [[x,y,len,type],...],
//        spikes: [[x,y],...], shards: [[x,y],...], hearts: [[x,y],...],
//        checkpoints: [[x,y],...], walkers: [[x,y],...], flyers: [[x,y],...],
//        spitters: [[x,y],...], movers: [[x,y],...], player: [x,y],
//        exit: [x,y], boss: [x,y] | null }
function buildLevel(def) {
  const grid = blankGrid();
  for (const [x0, x1, yTop] of def.ground) {
    for (let x = x0; x <= x1; x++) {
      for (let y = yTop; y < ROWS; y++) grid[y][x] = SOLID;
    }
  }
  for (const [x, y, len, type] of def.plats) {
    for (let i = 0; i < len; i++) grid[y][x + i] = type;
  }
  for (const [x, y] of def.spikes || []) grid[y][x] = SPIKE;
  for (const [x, y] of def.movers || []) grid[y][x] = MOVER;

  const px = (c, r) => ({ x: c * TILE, y: r * TILE });
  const entities = [];
  for (const [c, r] of def.shards) entities.push({ kind: 'shard', ...px(c, r), taken: false });
  for (const [c, r] of def.hearts || []) entities.push({ kind: 'heart', ...px(c, r), taken: false });
  for (const [c, r] of def.checkpoints || []) entities.push({ kind: 'shrine', ...px(c, r), lit: false });
  for (const [c, r] of def.walkers || []) entities.push({ kind: 'walker', ...px(c, r), vx: -60 });
  for (const [c, r] of def.flyers || []) entities.push({ kind: 'flyer', ...px(c, r), baseY: r * TILE, phase: c * 0.7 });
  for (const [c, r] of def.spitters || []) entities.push({ kind: 'spitter', ...px(c, r), timer: 1.2 + (c % 3) * 0.4 });
  for (const [c, r] of def.movers || []) entities.push({ kind: 'mover', anchorX: c * TILE, anchorY: r * TILE, phase: c * 1.1, dx: 0, dy: 0, prevX: c * TILE });

  const player = px(def.player[0], def.player[1]);
  const exit = px(def.exit[0], def.exit[1]);
  const boss = def.boss ? { kind: 'boss', ...px(def.boss[0], def.boss[1]), hp: 6, maxHp: 6 } : null;
  const shardTotal = def.shards.length;
  return { grid, entities, player, exit, boss, shardTotal };
}

export const LEVELS = [
  // 1 — Spire of Dawn. Gentle: small pits, two walkers, easy hops.
  buildLevel({
    ground: [[0, 11, 17], [14, 25, 17], [28, 47, 17]],
    plats: [[6, 14, 4, ONEWAY], [16, 13, 4, ONEWAY], [20, 11, 3, ONEWAY], [30, 13, 4, ONEWAY], [36, 11, 3, ONEWAY], [42, 13, 4, ONEWAY]],
    shards: [[7, 13], [8, 13], [17, 12], [21, 10], [31, 12], [37, 10], [43, 12], [10, 15]],
    hearts: [[40, 15]],
    checkpoints: [[24, 16]],
    walkers: [[10, 16], [33, 16]],
    player: [2, 16],
    exit: [45, 16],
    boss: null,
  }),
  // 2 — Spire of Verdance. A long pit crossed by moving platforms; flyers.
  buildLevel({
    ground: [[0, 9, 17], [22, 33, 17], [40, 47, 17]],
    plats: [[5, 13, 4, ONEWAY], [24, 13, 4, ONEWAY], [27, 11, 3, ONEWAY], [36, 13, 4, ONEWAY], [42, 11, 3, ONEWAY]],
    movers: [[12, 14], [16, 12], [20, 14]],
    shards: [[6, 12], [13, 13], [17, 11], [21, 13], [25, 12], [28, 10], [37, 12], [43, 10], [8, 15], [31, 15]],
    hearts: [[29, 16]],
    checkpoints: [[23, 16]],
    walkers: [[26, 16], [43, 16]],
    flyers: [[18, 10], [30, 9]],
    player: [2, 16],
    exit: [45, 16],
    boss: null,
  }),
  // 3 — Spire of Frost. Crumbling stone over pits, a thorn-spitter, spikes.
  buildLevel({
    ground: [[0, 8, 17], [12, 20, 17], [24, 32, 17], [36, 47, 17]],
    plats: [[4, 13, 4, ONEWAY], [14, 12, 3, ONEWAY], [17, 10, 3, ONEWAY], [26, 12, 4, ONEWAY], [38, 13, 4, ONEWAY], [42, 11, 3, ONEWAY], [9, 15, 3, CRUMBLE], [21, 14, 3, CRUMBLE], [33, 15, 3, CRUMBLE]],
    spikes: [[26, 16], [40, 16]],
    shards: [[5, 12], [10, 14], [15, 11], [18, 9], [25, 15], [27, 11], [34, 14], [39, 12], [43, 10], [7, 15]],
    hearts: [[37, 16]],
    checkpoints: [[13, 16]],
    walkers: [[6, 16], [44, 16]],
    flyers: [[15, 9], [28, 10]],
    spitters: [[19, 16]],
    player: [2, 16],
    exit: [45, 16],
    boss: null,
  }),
  // 4 — Spire of Ember. Dense spikes, crumbling runs, two spitters.
  buildLevel({
    ground: [[0, 7, 17], [11, 18, 17], [22, 30, 17], [34, 47, 17]],
    plats: [[3, 13, 3, ONEWAY], [13, 12, 3, ONEWAY], [16, 10, 3, ONEWAY], [24, 12, 3, ONEWAY], [27, 10, 3, ONEWAY], [36, 13, 3, ONEWAY], [40, 11, 3, ONEWAY], [44, 13, 3, ONEWAY], [8, 14, 3, CRUMBLE], [19, 13, 3, CRUMBLE], [31, 14, 3, CRUMBLE]],
    spikes: [[14, 16], [15, 16], [25, 16], [37, 16]],
    shards: [[4, 12], [9, 13], [14, 11], [17, 9], [20, 12], [25, 11], [28, 9], [32, 13], [37, 12], [41, 10], [45, 12], [7, 15]],
    hearts: [[35, 16]],
    checkpoints: [[12, 16]],
    walkers: [[5, 16], [42, 16]],
    flyers: [[14, 9], [25, 9], [38, 10]],
    spitters: [[17, 16], [29, 16]],
    player: [2, 16],
    exit: [45, 16],
    boss: null,
  }),
  // 5 — Spire of Storm. Everything at once, then the Warden's arena.
  buildLevel({
    ground: [[0, 15, 17], [19, 47, 17]],
    plats: [[4, 13, 4, ONEWAY], [8, 11, 3, ONEWAY], [16, 14, 3, ONEWAY], [17, 13, 2, ONEWAY], [24, 13, 3, ONEWAY], [27, 11, 3, ONEWAY], [33, 13, 4, ONEWAY], [38, 11, 3, ONEWAY]],
    spikes: [[20, 16], [21, 16], [25, 16]],
    shards: [[5, 12], [9, 10], [16, 13], [18, 12], [25, 12], [28, 10], [34, 12], [39, 10], [44, 12], [10, 15], [31, 15], [41, 15]],
    hearts: [[26, 16], [36, 16]],
    checkpoints: [[14, 16], [32, 16]],
    walkers: [[6, 16], [40, 16]],
    flyers: [[12, 9], [22, 10], [30, 9]],
    spitters: [[28, 16]],
    player: [2, 16],
    exit: [46, 16],
    boss: [42, 16],
  }),
];

export const TILE_KIND = { EMPTY, SOLID, ONEWAY, CRUMBLE, SPIKE, MOVER };
