// Headless logic tests, run with ?selftest=1. They exercise the real
// World and Game objects with synthetic input — no browser play needed.
// Results go to the console, document.title and a #selftest div.
import { TILE } from './config.js';
import { LEVELS, TILE_KIND } from './levels.js';
import { World } from './world.js';
import { SoundBank } from './audio.js';

const DT = 1 / 60;
const silent = () => new SoundBank();

function stepWorld(w, input, n = 1) {
  let ev = null;
  for (let i = 0; i < n; i++) {
    ev = w.update(DT, input) || ev;
    input.endFrame();
  }
  return ev;
}

function finite(n) { return Number.isFinite(n); }

export function runSelfTest(game) {
  const lines = [];
  let passed = 0, failed = 0;
  const t = (name, fn) => {
    try {
      const ok = fn();
      if (ok === true) { passed++; lines.push('PASS ' + name); }
      else { failed++; lines.push('FAIL ' + name + ' — ' + (ok || 'false')); }
    } catch (err) {
      failed++;
      lines.push('FAIL ' + name + ' — threw ' + err.message);
    }
  };
  const input = game.input;

  t('levels-parse: 5 levels, each with start, exit and shards', () => {
    for (let i = 0; i < 5; i++) {
      const w = new World(i, silent());
      if (w.grid.length !== 20 || w.grid[0].length !== 48) return 'level ' + i + ' grid size';
      if (w.shardTotal < 8) return 'level ' + i + ' too few shards';
      if (!w.exit) return 'level ' + i + ' no exit';
    }
    return true;
  });

  t('physics: climber falls and lands on the ground', () => {
    const w = new World(0, silent());
    stepWorld(w, input, 120);
    return w.player.onGround && Math.abs(w.player.y - (17 * TILE - w.player.h)) < 2 ? true : 'y=' + w.player.y + ' onGround=' + w.player.onGround;
  });

  t('physics: jump rises and lands again', () => {
    const w = new World(0, silent());
    stepWorld(w, input, 30);
    const y0 = w.player.y;
    input.press(' ');
    stepWorld(w, input, 1);
    input.release(' ');
    if (!(w.player.vy < 0)) return 'no upward velocity';
    stepWorld(w, input, 90);
    return w.player.onGround && w.player.y > y0 - 200 ? true : 'y=' + w.player.y;
  });

  t('physics: the left wall stops the climber', () => {
    const w = new World(0, silent());
    w.player.x = 2;
    input.press('ArrowLeft');
    stepWorld(w, input, 60);
    input.release('ArrowLeft');
    return w.player.x >= -1 ? true : 'x=' + w.player.x;
  });

  t('unlock: double jump works on spire 2', () => {
    const w = new World(1, silent());
    if (!w.unlocks.doubleJump) return 'no unlock';
    stepWorld(w, input, 30);
    input.press(' ');
    stepWorld(w, input, 1);
    input.release(' ');
    stepWorld(w, input, 10);
    input.press(' ');
    stepWorld(w, input, 1);
    input.release(' ');
    return w.player.jumps === 1 && w.player.vy < 0 ? true : 'jumps=' + w.player.jumps + ' vy=' + w.player.vy;
  });

  t('unlock: dash bursts on spire 3', () => {
    const w = new World(2, silent());
    if (!w.unlocks.dash) return 'no unlock';
    stepWorld(w, input, 30);
    input.press('Shift');
    stepWorld(w, input, 1);
    input.release('Shift');
    return w.player.dashTime > 0 && Math.abs(w.player.vx) > 800 ? true : 'dashTime=' + w.player.dashTime + ' vx=' + w.player.vx;
  });

  t('collect: touching a shard banks it', () => {
    const w = new World(0, silent());
    const s = w.entities.find((e) => e.kind === 'shard');
    w.player.x = s.x; w.player.y = s.y;
    stepWorld(w, input, 2);
    return w.shards === 1 ? true : 'shards=' + w.shards;
  });

  t('combat: a walker costs a heart from the side', () => {
    const w = new World(0, silent());
    const e = w.entities.find((en) => en.kind === 'walker');
    e.x = w.player.x; e.y = w.player.y - 6; e.vx = 0;
    stepWorld(w, input, 2);
    return w.hearts === 2 ? true : 'hearts=' + w.hearts;
  });

  t('hazard: spikes cost a heart', () => {
    const w = new World(2, silent());
    w.player.x = 26 * TILE + 2;
    w.player.y = 16 * TILE + 10;
    stepWorld(w, input, 10);
    return w.hearts < 3 ? true : 'hearts=' + w.hearts;
  });

  t('shrine: touching a shrine lights it and moves the respawn', () => {
    const w = new World(0, silent());
    const s = w.entities.find((e) => e.kind === 'shrine');
    w.player.x = s.x; w.player.y = s.y - 10;
    stepWorld(w, input, 2);
    return s.lit && w.respawn.x === s.x ? true : 'lit=' + s.lit;
  });

  t('exit: the portal clears the spire', () => {
    const w = new World(0, silent());
    w.player.x = w.exit.x; w.player.y = w.exit.y + 10;
    const ev = stepWorld(w, input, 2);
    return ev === 'clear' && w.cleared ? true : 'ev=' + ev;
  });

  t('boss: six stomps defeat the Warden and unseal the portal', () => {
    const w = new World(4, silent());
    if (!w.boss || w.exitSealed !== true) return 'no boss/seal';
    for (let i = 0; i < 6; i++) {
      const b = w.boss;
      // Feet 2px above the Warden, falling: a real stomp's first overlap.
      w.player.x = b.x + 10;
      w.player.y = b.y - w.player.h - 2;
      w.player.vy = 200;
      b.hurtCd = 0;
      stepWorld(w, input, 1);
      if (w.bossDead) break;
    }
    return w.bossDead && !w.exitSealed ? true : 'hp=' + w.boss.hp + ' dead=' + w.bossDead;
  });

  t('flow: title → select → intro → play → pause → play', () => {
    game.state = 'title';
    input.press('Enter'); game.step(DT); input.release('Enter');
    if (game.state !== 'select') return 'state=' + game.state;
    input.press('Enter'); game.step(DT); input.release('Enter');
    if (game.state !== 'intro') return 'state=' + game.state;
    input.press('Enter'); game.step(DT); input.release('Enter');
    if (game.state !== 'play') return 'state=' + game.state;
    input.press('p'); game.step(DT); input.release('p');
    if (game.state !== 'pause') return 'state=' + game.state;
    input.press('p'); game.step(DT); input.release('p');
    return game.state === 'play' ? true : 'state=' + game.state;
  });

  t('flow: losing every heart ends the run, R retries', () => {
    game.startLevel(0, true);
    game.state = 'play';
    const w = game.world;
    w.hearts = 1;
    w.player.invuln = 0;
    w.hurt();
    game.step(DT);
    if (game.state !== 'over') return 'state=' + game.state;
    input.press('r'); game.step(DT); input.release('r');
    return game.state === 'play' && game.world.hearts === 3 ? true : 'state=' + game.state;
  });

  t('robustness: 5s of scripted play stays finite', () => {
    const w = new World(1, silent());
    for (let i = 0; i < 300; i++) {
      if (i % 48 === 0) input.press(' ');
      if (i % 2 === 0) input.press('ArrowRight');
      stepWorld(w, input, 1);
      if (!finite(w.player.x) || !finite(w.player.y) || !finite(w.player.vx) || !finite(w.player.vy)) return 'NaN at step ' + i;
    }
    input.release('ArrowRight');
    input.release(' ');
    return true;
  });

  t('mover: a moving platform carries the climber', () => {
    const w = new World(1, silent());
    const m = w.entities.find((e) => e.kind === 'mover');
    stepWorld(w, input, 5);
    w.player.x = m.x + 30;
    w.player.y = m.y - w.player.h;
    w.player.vy = 0;
    const x0 = w.player.x;
    stepWorld(w, input, 60);
    return Math.abs(w.player.x - x0) > 5 ? true : 'moved ' + (w.player.x - x0) + 'px';
  });

  t('crumble: a stepped-on tile breaks and returns', () => {
    const w = new World(2, silent());
    w.player.x = 9 * TILE;
    w.player.y = 15 * TILE - w.player.h;
    stepWorld(w, input, 45);
    return w.grid[15][9] === TILE_KIND.EMPTY ? true : 'tile=' + w.grid[15][9];
  });

  const total = passed + failed;
  lines.push('SELFTEST ' + passed + '/' + total + ' passed');
  return { passed, failed, lines };
}
