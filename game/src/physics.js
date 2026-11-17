// Player physics: AABB vs tile grid, resolved axis by axis. One-way
// platforms collide only while falling and the feet were above them;
// crumbling tiles report themselves so the world can start their timer.
import { PHYS, TILE } from './config.js';
import { TILE_KIND, COLS, ROWS } from './levels.js';

export function tileAt(grid, cx, cy) {
  if (cx < 0 || cx >= COLS || cy < 0 || cy >= ROWS) return TILE_KIND.SOLID; // walls at the edges
  return grid[cy][cx];
}

function isSolid(kind) {
  return kind === TILE_KIND.SOLID || kind === TILE_KIND.CRUMBLE;
}

export class Player {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.w = PHYS.playerW; this.h = PHYS.playerH;
    this.vx = 0; this.vy = 0;
    this.facing = 1;
    this.onGround = false;
    this.coyote = 0;
    this.buffer = 0;
    this.cutApplied = false;
    this.jumps = 0; // air jumps used since leaving ground
    this.dashTime = 0;
    this.dashCd = 0;
    this.invuln = 0;
    this.shield = false;
    this.standingOn = null; // {kind, cx, cy} tile under the feet
    this.groundMover = null; // mover entity the player rides
  }

  reset(x, y) {
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.jumps = 0; this.dashTime = 0; this.dashCd = 0; this.invuln = 0;
    this.cutApplied = false;
    this.onGround = false; this.standingOn = null; this.groundMover = null;
  }

  // Returns events the world should react to: { jumped, doubleJumped, dashed, landed }.
  update(dt, input, grid, unlocks, movers) {
    const ev = { jumped: false, doubleJumped: false, dashed: false, landed: false };
    const wasGround = this.onGround;
    if (this.invuln > 0) this.invuln -= dt;
    if (this.dashCd > 0) this.dashCd -= dt;

    // Horizontal input.
    const accel = this.onGround ? PHYS.runAccel : PHYS.airAccel;
    if (input.left()) {
      this.vx = Math.max(this.vx - accel * dt, -PHYS.runSpeed);
      this.facing = -1;
    } else if (input.right()) {
      this.vx = Math.min(this.vx + accel * dt, PHYS.runSpeed);
      this.facing = 1;
    } else if (this.onGround) {
      const s = Math.sign(this.vx);
      this.vx -= s * PHYS.friction * dt;
      if (Math.sign(this.vx) !== s) this.vx = 0;
    }

    // Jump: buffered, coyote time, variable height.
    if (input.jumpPressed()) this.buffer = PHYS.jumpBuffer;
    else this.buffer -= dt;
    if (this.onGround) { this.coyote = PHYS.coyote; this.jumps = 0; this.cutApplied = false; }
    else this.coyote -= dt;

    if (this.buffer > 0 && this.coyote > 0) {
      this.vy = PHYS.jumpVel;
      this.onGround = false;
      this.coyote = 0; this.buffer = 0; this.cutApplied = false;
      ev.jumped = true;
    } else if (this.buffer > 0 && unlocks.doubleJump && this.jumps === 0 && !this.onGround) {
      this.vy = PHYS.doubleJumpVel;
      this.jumps = 1;
      this.buffer = 0; this.cutApplied = false;
      ev.doubleJumped = true;
    }
    // Variable jump height: releasing the button while rising cuts the
    // upward speed once, so short hops and full jumps both feel right.
    if (!input.jumpHeld() && this.vy < 0 && !this.cutApplied) {
      this.vy *= PHYS.jumpCut;
      this.cutApplied = true;
    }

    // Dash.
    if (input.dashPressed() && unlocks.dash && this.dashCd <= 0 && this.dashTime <= 0) {
      this.dashTime = PHYS.dashTime;
      this.dashCd = PHYS.dashCooldown;
      this.vy = 0;
      ev.dashed = true;
    }
    if (this.dashTime > 0) {
      this.dashTime -= dt;
      this.vx = this.facing * PHYS.dashSpeed;
      this.vy = 0;
    } else {
      this.vy = Math.min(this.vy + PHYS.gravity * dt, PHYS.maxFall);
    }

    // Ride a moving platform: carry the player by the platform's delta.
    if (this.groundMover) {
      this.x += this.groundMover.dx;
      this.y += this.groundMover.dy;
    }

    // Move X, resolve.
    this.x += this.vx * dt;
    this._collideAxis(grid, true);
    // Move Y, resolve.
    const prevBottom = this.y + this.h;
    this.y += this.vy * dt;
    this._collideAxis(grid, false, prevBottom);
    if (!wasGround && this.onGround) ev.landed = true;
    return ev;
  }

  _collideAxis(grid, isX, prevBottom) {
    this.standingOn = null;
    this.groundMover = null;
    const x0 = Math.floor(this.x / TILE);
    const x1 = Math.floor((this.x + this.w - 0.01) / TILE);
    const y0 = Math.floor(this.y / TILE);
    const y1 = Math.floor((this.y + this.h - 0.01) / TILE);
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const kind = tileAt(grid, cx, cy);
        if (isX) {
          if (!isSolid(kind)) continue;
          const tx = cx * TILE;
          if (this.vx > 0) this.x = Math.min(this.x, tx - this.w);
          else if (this.vx < 0) this.x = Math.max(this.x, tx + TILE);
          else continue;
          this.vx = 0;
        } else {
          if (kind === TILE_KIND.ONEWAY) {
            // Only land when falling and the feet were above the plank.
            if (this.vy < 0) continue;
            const top = cy * TILE;
            if (prevBottom > top + 1) continue;
            if (this.y + this.h >= top && this.y + this.h <= top + 18) {
              this.y = top - this.h;
              this.vy = 0;
              this.onGround = true;
              this.standingOn = { kind, cx, cy };
            }
            continue;
          }
          if (!isSolid(kind)) continue;
          const ty = cy * TILE;
          if (this.vy > 0) {
            this.y = Math.min(this.y, ty - this.h);
            this.vy = 0;
            this.onGround = true;
            this.standingOn = { kind, cx, cy };
          } else if (this.vy < 0) {
            this.y = Math.max(this.y, ty + TILE);
            this.vy = 0;
          }
        }
      }
    }
    if (!isX && this.vy === 0 && this.onGround) {
      // keep onGround sticky only when actually supported
    } else if (!isX && this.vy !== 0) {
      this.onGround = false;
    }
  }
}
