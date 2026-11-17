// Deterministic shot scenes: each one configures the game into a fixed,
// good-looking moment and renders it once, so the screenshots are real
// renders of the game's own code, identical on every run.
import { TILE } from './config.js';

// Place the climber standing on a one-way platform at (col, row).
function standOn(game, col, row) {
  const p = game.world.player;
  p.x = col * TILE;
  p.y = row * TILE - p.h;
  p.vx = 0; p.vy = 0;
  p.onGround = true;
}

export function setupShot(game, name, seed) {
  game.time = 2.5;
  if (name === 'start') {
    game.state = 'title';
    game.totalStars = 9;
    return;
  }
  if (name === 'play') {
    // Spire of Frost, mid-climb: on a high plank under a flyer, shards in
    // hand, dash unlocked, HUD full of information.
    game.startLevel(2, true);
    game.state = 'play';
    const w = game.world;
    standOn(game, 14, 12);
    w.shards = 6;
    w.time = 42;
    w.camX = Math.max(0, game.world.player.x - 500);
    return;
  }
  if (name === 'boss') {
    // Spire of Storm: the Warden telegraphs a charge while the climber
    // waits on a high plank, two hearts left, boss bar on screen.
    game.startLevel(4, true);
    game.state = 'play';
    const w = game.world;
    standOn(game, 33, 13);
    w.shards = 9;
    w.hearts = 2;
    w.time = 128;
    const b = w.boss;
    b.x = 42 * TILE;
    b.y = 11 * TILE;
    b.baseY = b.y;
    b.state = 'telegraph';
    b.timer = 0.35;
    b.hp = 4;
    w.camX = Math.max(0, game.world.player.x - 500);
    return;
  }
  if (name === 'win') {
    game.state = 'victory';
    game.stars = [3, 3, 2, 3, 3];
    game.totalStars = 14;
    return;
  }
  // Fallback: title.
  game.state = 'title';
}
