// Enemies, the Storm Warden boss, projectiles and particles.
// Every enemy is stompable (landing on top defeats it and bounces the
// player); touching one from the side costs a heart.
import { TILE, PHYS } from './config.js';
import { TILE_KIND, COLS, ROWS } from './levels.js';

function tileAt(grid, cx, cy) {
  if (cx < 0 || cx >= COLS || cy < 0 || cy >= ROWS) return TILE_KIND.SOLID;
  return grid[cy][cx];
}

function solidAt(grid, px, py) {
  const k = tileAt(grid, Math.floor(px / TILE), Math.floor(py / TILE));
  return k === TILE_KIND.SOLID || k === TILE_KIND.CRUMBLE;
}

export class Particles {
  constructor() { this.list = []; }
  burst(x, y, color, n = 10, speed = 220) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.7);
      this.list.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60, life: 0.5 + Math.random() * 0.4, max: 0.9, color, size: 2 + Math.random() * 4 });
    }
  }
  update(dt) {
    for (const p of this.list) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 500 * dt; p.life -= dt;
    }
    this.list = this.list.filter((p) => p.life > 0);
  }
}

// Walker: patrols the ground, turns at walls and ledges.
export function updateWalker(e, dt, grid) {
  e.w = 30; e.h = 28;
  e.vy = (e.vy || 0) + PHYS.gravity * dt;
  e.x += e.vx * dt;
  // Wall bump: reverse.
  const dir = Math.sign(e.vx) || 1;
  const aheadX = dir > 0 ? e.x + e.w + 2 : e.x - 2;
  const midY = e.y + e.h / 2;
  if (solidAt(grid, aheadX, midY)) e.vx = -e.vx;
  // Ledge: if no ground ahead-below, reverse.
  const belowX = dir > 0 ? e.x + e.w + 4 : e.x - 4;
  if (!solidAt(grid, belowX, e.y + e.h + 6)) e.vx = -e.vx;
  e.y += e.vy * dt;
  // Land on ground.
  const cx0 = Math.floor(e.x / TILE);
  const cx1 = Math.floor((e.x + e.w - 0.01) / TILE);
  const cy = Math.floor((e.y + e.h) / TILE);
  for (let cx = cx0; cx <= cx1; cx++) {
    const k = tileAt(grid, cx, cy);
    if (k === TILE_KIND.SOLID || k === TILE_KIND.CRUMBLE) {
      e.y = cy * TILE - e.h;
      e.vy = 0;
      break;
    }
  }
  e.anim = (e.anim || 0) + dt;
}

// Flyer: sine-wave flight, no gravity.
export function updateFlyer(e, dt) {
  e.w = 30; e.h = 24;
  e.phase += dt * 2.2;
  e.y = e.baseY + Math.sin(e.phase) * 46;
  e.x += Math.sin(e.phase * 0.6) * 30 * dt;
  e.anim = (e.anim || 0) + dt;
}

// Spitter: rooted plant that fires a thorn at the player.
export function updateSpitter(e, dt, player, projectiles) {
  e.w = 30; e.h = 40;
  e.timer -= dt;
  const dx = player.x + player.w / 2 - (e.x + 15);
  const dy = player.y + player.h / 2 - (e.y + 12);
  const dist = Math.hypot(dx, dy);
  if (e.timer <= 0 && dist < 460) {
    e.timer = 2.3;
    const s = 260;
    projectiles.push({
      x: e.x + 15, y: e.y + 12,
      vx: (dx / dist) * s, vy: (dy / dist) * s,
      r: 7, life: 3, hostile: true,
    });
    return true; // spat — play a sound
  }
  return false;
}

// The Storm Warden: hovers, telegraphs, charges, bursts thorns.
// Stomps hurt it; contact hurts the player.
export function updateBoss(b, dt, player, projectiles, grid) {
  b.w = 64; b.h = 72;
  b.timer -= dt;
  b.anim = (b.anim || 0) + dt;
  const cx = player.x + player.w / 2;
  const bx = b.x + b.w / 2;
  const dir = cx > bx ? 1 : -1;

  if (b.state === 'hover') {
    b.y = b.baseY + Math.sin(b.anim * 1.6) * 30;
    b.x += dir * 40 * dt;
    if (b.timer <= 0) {
      b.state = 'telegraph';
      b.timer = 0.7;
    }
  } else if (b.state === 'telegraph') {
    b.flash = 0.5 + 0.5 * Math.sin(b.anim * 30);
    if (b.timer <= 0) {
      b.state = 'charge';
      b.timer = 0.55;
      b.vx = dir * 620;
    }
  } else if (b.state === 'charge') {
    b.x += b.vx * dt;
    if (b.x < 30 * TILE) { b.x = 30 * TILE; b.vx = 0; b.state = 'burst'; b.timer = 0.5; }
    if (b.x > 46 * TILE - b.w) { b.x = 46 * TILE - b.w; b.vx = 0; b.state = 'burst'; b.timer = 0.5; }
    if (b.timer <= 0) { b.state = 'burst'; b.timer = 0.5; }
  } else if (b.state === 'burst') {
    if (b.timer <= 0) {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        projectiles.push({
          x: bx, y: b.y + 30,
          vx: Math.cos(a) * 230, vy: Math.sin(a) * 230,
          r: 7, life: 2.5, hostile: true,
        });
      }
      b.state = 'hover';
      b.timer = 1.6;
      b.baseY = b.y;
    }
  }
  if (b.state !== 'telegraph') b.flash = 0;
  // Keep the boss inside the arena: above the floor, below the sky.
  if (b.y < 5 * TILE) b.y = 5 * TILE;
  if (b.y > 15 * TILE) b.y = 15 * TILE;
}

export function updateProjectiles(list, dt, grid) {
  for (const p of list) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (solidAt(grid, p.x, p.y)) p.life = 0;
  }
  return list.filter((p) => p.life > 0);
}

export function overlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
