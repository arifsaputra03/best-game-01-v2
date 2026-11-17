// World: one level's live state — the grid, the entities, the camera,
// the climber's hearts and shards, checkpoints, stars and the boss seal.
// The game loop calls update() every frame while playing.
import { TILE, PHYS, HEARTS, VIEW_W, SPIRES } from './config.js';
import { LEVELS, TILE_KIND, COLS, ROWS } from './levels.js';
import { Player } from './physics.js';
import { updateWalker, updateFlyer, updateSpitter, updateBoss, updateProjectiles, overlap, Particles } from './entities.js';
import { clamp } from './random.js';

// Unlocks are cumulative: entering spire i grants every unlock of spires 0..i.
export function unlocksFor(levelIndex) {
  const u = { doubleJump: false, dash: false, shield: false };
  for (let i = 0; i <= levelIndex; i++) {
    const un = SPIRES[i].unlock;
    if (un) u[un] = true;
  }
  return u;
}

export class World {
  constructor(levelIndex, sfx) {
    this.levelIndex = levelIndex;
    this.spire = SPIRES[levelIndex];
    this.unlocks = unlocksFor(levelIndex);
    this.sfx = sfx;
    this.time = 0;
    this.load();
  }

  load() {
    const def = LEVELS[this.levelIndex];
    // Deep-copy the grid so crumbling tiles can mutate without touching the definition.
    this.grid = def.grid.map((row) => row.slice());
    this.entities = def.entities.map((e) => ({ ...e }));
    this.player = new Player(def.player.x, def.player.y);
    this.player.shield = this.unlocks.shield;
    this.exit = { x: def.exit.x, y: def.exit.y - TILE, w: TILE, h: 2 * TILE };
    this.boss = def.boss ? { ...def.boss, y: def.boss.y - 100, state: 'hover', timer: 1.5, baseY: def.boss.y - 100, vx: 0, anim: 0, flash: 0, hurtCd: 0 } : null;
    this.bossDead = false;
    this.projectiles = [];
    this.particles = new Particles();
    this.hearts = HEARTS;
    this.shards = 0;
    this.shardTotal = def.shardTotal;
    // deaths persists across retries of the same level: the no-death star
    // is lost for the whole level run, not just one attempt.
    this.deaths = this.deaths || 0;
    this.respawn = { x: def.player.x, y: def.player.y };
    this.camX = 0;
    this.crumble = new Map(); // "cx,cy" -> { t, gone, respawnT }
    this.moverT = 0;
    this.cleared = false;
    this.over = false;
    this.exitSealed = this.boss !== null;
  }

  get sealed() { return this.exitSealed; }

  // Reload after a game over, keeping the death count for the star rule.
  retry() {
    const d = this.deaths;
    this.load();
    this.deaths = d;
  }

  // Fresh entry from the level select: a new run, deaths reset.
  fresh() {
    this.deaths = 0;
    this.load();
  }

  update(dt, input) {
    if (this.cleared || this.over) return null;
    this.time += dt;
    this.moverT += dt;

    // Moving platforms: sine motion, remember the delta to carry the player.
    for (const m of this.entities) {
      if (m.kind !== 'mover') continue;
      const nx = m.anchorX - TILE + Math.sin(this.moverT * 0.9 + m.phase) * 72;
      m.dx = nx - (m.x ?? m.anchorX - TILE);
      m.x = nx;
      m.y = m.anchorY;
      m.w = TILE * 3; m.h = 18;
    }

    const ev = this.player.update(dt, input, this.grid, this.unlocks, this.entities);
    if (ev.jumped) this.sfx.jump();
    if (ev.doubleJumped) { this.sfx.doubleJump(); this.particles.burst(this.player.x + 13, this.player.y + 38, '#ffffff', 6, 120); }
    if (ev.dashed) { this.sfx.dash(); this.particles.burst(this.player.x + 13, this.player.y + 19, '#9fd8ff', 8, 180); }

    // Crumbling tiles under the feet start their timer.
    const st = this.player.standingOn;
    if (st && st.kind === TILE_KIND.CRUMBLE) {
      const key = st.cx + ',' + st.cy;
      if (!this.crumble.has(key)) this.crumble.set(key, { t: 0.6, gone: false, respawnT: 0 });
    }
    for (const [key, c] of this.crumble) {
      const [cx, cy] = key.split(',').map(Number);
      if (!c.gone) {
        c.t -= dt;
        if (c.t <= 0) {
          this.grid[cy][cx] = TILE_KIND.EMPTY;
          c.gone = true;
          c.respawnT = 2.5;
          this.particles.burst(cx * TILE + 18, cy * TILE + 18, '#8a6a4a', 8, 140);
        }
      } else {
        c.respawnT -= dt;
        if (c.respawnT <= 0) {
          this.grid[cy][cx] = TILE_KIND.CRUMBLE;
          this.crumble.delete(key);
        }
      }
    }

    // Ride a mover the player stands on.
    this.player.groundMover = null;
    if (this.player.vy >= 0) {
      for (const m of this.entities) {
        if (m.kind !== 'mover') continue;
        const feet = this.player.y + this.player.h;
        if (this.player.x + this.player.w > m.x + 4 && this.player.x < m.x + m.w - 4 &&
            feet >= m.y - 2 && feet <= m.y + 16) {
          this.player.y = m.y - this.player.h;
          this.player.vy = 0;
          this.player.onGround = true;
          this.player.groundMover = m;
          break;
        }
      }
    }

    // Enemies.
    for (const e of this.entities) {
      if (e.kind === 'walker') updateWalker(e, dt, this.grid);
      else if (e.kind === 'flyer') updateFlyer(e, dt);
      else if (e.kind === 'spitter') { if (updateSpitter(e, dt, this.player, this.projectiles)) this.sfx.spit(); }
    }
    if (this.boss && !this.bossDead) {
      if (this.boss.hurtCd > 0) this.boss.hurtCd -= dt;
      updateBoss(this.boss, dt, this.player, this.projectiles, this.grid);
    }
    this.projectiles = updateProjectiles(this.projectiles, dt, this.grid);
    this.particles.update(dt);

    // Pickups and shrines.
    for (const e of this.entities) {
      if (e.taken) continue;
      if (e.kind === 'shard' || e.kind === 'heart') {
        const r = { x: e.x - 6, y: e.y - 6, w: 30, h: 30 };
        if (overlap(this.player, r)) {
          e.taken = true;
          if (e.kind === 'shard') { this.shards++; this.sfx.shard(); this.particles.burst(e.x + 9, e.y + 9, '#ffe9a3', 8, 140); }
          else { this.hearts = Math.min(HEARTS, this.hearts + 1); this.sfx.heart(); this.particles.burst(e.x + 9, e.y + 9, '#ff8fa3', 10, 160); }
        }
      } else if (e.kind === 'shrine' && !e.lit) {
        const r = { x: e.x - 8, y: e.y - 20, w: 52, h: 56 };
        if (overlap(this.player, r)) {
          e.lit = true;
          this.respawn = { x: e.x, y: e.y - TILE };
          this.player.shield = this.unlocks.shield; // shrines restore the aegis
          this.sfx.checkpoint();
          this.particles.burst(e.x + 18, e.y, '#b8f29a', 14, 180);
        }
      }
    }

    // Enemy contact: stomp from above defeats, side contact hurts.
    for (const e of this.entities) {
      if (e.kind !== 'walker' && e.kind !== 'flyer' && e.kind !== 'spitter') continue;
      if (e.dead) continue;
      if (overlap(this.player, e)) {
        const stomping = this.player.vy > 60 && (this.player.y + this.player.h) - e.y < 20;
        if (stomping) {
          e.dead = true;
          this.player.vy = -560;
          this.sfx.stomp();
          this.particles.burst(e.x + 15, e.y + 12, '#ffffff', 12, 200);
        } else {
          this.hurt();
        }
      }
    }
    // Boss contact and stomps.
    if (this.boss && !this.bossDead && overlap(this.player, this.boss)) {
      const stomping = this.player.vy > 60 && (this.player.y + this.player.h) - this.boss.y < 26;
      if (stomping && this.boss.hurtCd <= 0) {
        this.boss.hp -= 1;
        this.boss.hurtCd = 0.9;
        this.player.vy = -640;
        this.sfx.bossHit();
        this.particles.burst(this.player.x + 13, this.boss.y + 10, '#d8c8ff', 16, 240);
        if (this.boss.hp <= 0) {
          this.bossDead = true;
          this.exitSealed = false;
          this.sfx.levelClear();
          this.particles.burst(this.boss.x + 32, this.boss.y + 36, '#ffe9a3', 30, 320);
        }
      } else if (!stomping) {
        this.hurt();
      }
    }
    // Hostile projectiles.
    for (const p of this.projectiles) {
      if (!p.hostile) continue;
      const r = { x: p.x - p.r, y: p.y - p.r, w: p.r * 2, h: p.r * 2 };
      if (overlap(this.player, r)) {
        p.life = 0;
        this.hurt();
      }
    }
    this.projectiles = this.projectiles.filter((p) => p.life > 0);

    // Spikes: the top half of a spike tile hurts.
    const x0 = Math.floor(this.player.x / TILE);
    const x1 = Math.floor((this.player.x + this.player.w - 0.01) / TILE);
    const y0 = Math.floor(this.player.y / TILE);
    const y1 = Math.floor((this.player.y + this.player.h - 0.01) / TILE);
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        if (this.grid[cy] && this.grid[cy][cx] === TILE_KIND.SPIKE) {
          const spike = { x: cx * TILE + 4, y: cy * TILE + 16, w: TILE - 8, h: TILE - 16 };
          if (overlap(this.player, spike)) this.hurt();
        }
      }
    }

    // Fell out of the world: lose a heart, return to the shrine.
    if (this.player.y > ROWS * TILE + 80) {
      this.hearts -= 1;
      this.sfx.hurt();
      if (this.hearts <= 0) { this.deaths += 1; this.over = true; return 'over'; }
      this.player.reset(this.respawn.x, this.respawn.y);
      this.player.shield = this.unlocks.shield;
    }

    if (this.over) return 'over';

    // Exit portal.
    if (overlap(this.player, this.exit)) {
      if (!this.exitSealed) {
        this.cleared = true;
        return 'clear';
      }
    }

    // Camera follows the climber.
    const target = clamp(this.player.x + this.player.w / 2 - VIEW_W / 2, 0, COLS * TILE - VIEW_W);
    this.camX += (target - this.camX) * Math.min(1, dt * 6);
    return null;
  }

  hurt() {
    const p = this.player;
    if (p.invuln > 0 || p.dashTime > 0) return;
    if (p.shield) {
      p.shield = false;
      p.invuln = 1.0;
      this.sfx.shieldBreak();
      this.particles.burst(p.x + 13, p.y + 19, '#cfeeff', 12, 200);
      return;
    }
    this.hearts -= 1;
    p.invuln = 1.2;
    p.vy = -320;
    p.vx = -p.facing * 260;
    this.sfx.hurt();
    this.particles.burst(p.x + 13, p.y + 19, '#ff6b6b', 12, 200);
    if (this.hearts <= 0) { this.deaths += 1; this.over = true; }
  }

  // Stars: 1 for finishing, 1 for every shard, 1 for finishing deathless.
  stars() {
    let s = 1;
    if (this.shards >= this.shardTotal) s++;
    if (this.deaths === 0) s++;
    return s;
  }

  score() {
    return this.shards * 100 + this.stars() * 250 + 500;
  }
}
