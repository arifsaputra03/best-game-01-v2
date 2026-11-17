// All drawing: the sky, parallax hills, tiles, entities, the HUD and
// every screen. Nothing here loads a file — every picture is code.
import { VIEW_W, VIEW_H, TILE, SPIRES, UNLOCK_LABELS } from './config.js';
import { TILE_KIND, COLS, ROWS } from './levels.js';
import { mulberry32 } from './random.js';

function star4(ctx, x, y, r, rot) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = rot + (i * Math.PI) / 4;
    const rr = i % 2 === 0 ? r : r * 0.38;
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

function heartShape(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.9);
  ctx.bezierCurveTo(x - s * 1.2, y, x - s * 0.5, y - s * 0.9, x, y - s * 0.25);
  ctx.bezierCurveTo(x + s * 0.5, y - s * 0.9, x + s * 1.2, y, x, y + s * 0.9);
  ctx.closePath();
  ctx.fill();
}

export class Renderer {
  constructor(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    const rng = mulberry32(1234);
    this.skyStars = Array.from({ length: 90 }, () => ({ x: rng() * VIEW_W, y: rng() * 380, r: 0.6 + rng() * 1.6, p: rng() * 6 }));
    this.clouds = Array.from({ length: 7 }, (_, i) => ({ x: rng() * 2000, y: 50 + rng() * 220, s: 0.7 + rng() * 1.1, v: 6 + rng() * 10 }));
  }

  draw(game) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    const spire = SPIRES[game.levelIndex ?? 0];
    this.drawSky(ctx, spire, game.time);
    if (game.state === 'title') { this.drawTitle(ctx, game); return; }
    if (game.state === 'select') { this.drawSelect(ctx, game); return; }
    // Victory needs no world (its panel only reads stars), so it must be
    // handled before the world guard below.
    if (game.state === 'victory') { this.drawVictory(ctx, game); return; }
    if (!game.world) return;
    this.drawWorld(ctx, game);
    if (game.state === 'intro') this.drawIntro(ctx, game);
    else if (game.state === 'pause') this.drawPause(ctx, game);
    else if (game.state === 'clear') this.drawClear(ctx, game);
    else if (game.state === 'over') this.drawOver(ctx, game);
    else if (game.state === 'victory') this.drawVictory(ctx, game);
  }

  drawSky(ctx, spire, t) {
    const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    g.addColorStop(0, spire.sky[0]);
    g.addColorStop(0.55, spire.sky[1]);
    g.addColorStop(1, spire.sky[2]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    // Stars fade in and out slowly.
    ctx.fillStyle = '#ffffff';
    for (const s of this.skyStars) {
      ctx.globalAlpha = 0.25 + 0.55 * Math.abs(Math.sin(t * 0.7 + s.p));
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Clouds drift.
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    for (const c of this.clouds) {
      const x = ((c.x + t * c.v) % 2200) - 400;
      ctx.beginPath();
      ctx.ellipse(x, c.y, 90 * c.s, 22 * c.s, 0, 0, Math.PI * 2);
      ctx.ellipse(x + 50 * c.s, c.y + 8, 60 * c.s, 16 * c.s, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawHills(ctx, spire, camX) {
    for (const [par, color, base, amp, alpha] of [[0.25, spire.hill, 560, 90, 0.55], [0.5, spire.hill, 620, 60, 0.8]]) {
      ctx.fillStyle = color;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.moveTo(0, VIEW_H);
      for (let x = 0; x <= VIEW_W; x += 16) {
        const wx = x + camX * par;
        const y = base + Math.sin(wx * 0.004) * amp + Math.sin(wx * 0.011) * amp * 0.4;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(VIEW_W, VIEW_H);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  drawWorld(ctx, game) {
    const w = game.world;
    const spire = w.spire;
    this.drawHills(ctx, spire, w.camX);
    ctx.save();
    ctx.translate(-Math.round(w.camX), 0);
    this.drawTiles(ctx, w);
    this.drawEntities(ctx, w, game.time);
    this.drawPlayer(ctx, w, game.time);
    ctx.restore();
    this.drawParticles(ctx, w);
    this.drawHUD(ctx, game);
  }

  drawTiles(ctx, w) {
    const spire = w.spire;
    const x0 = Math.max(0, Math.floor(w.camX / TILE) - 1);
    const x1 = Math.min(COLS - 1, Math.floor((w.camX + VIEW_W) / TILE) + 1);
    for (let cy = 0; cy < ROWS; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const k = w.grid[cy][cx];
        if (!k) continue;
        const x = cx * TILE, y = cy * TILE;
        if (k === TILE_KIND.SOLID) {
          ctx.fillStyle = spire.ground;
          ctx.fillRect(x, y, TILE, TILE);
          const above = cy === 0 ? 0 : w.grid[cy - 1][cx];
          if (above !== TILE_KIND.SOLID) {
            ctx.fillStyle = spire.groundTop;
            ctx.fillRect(x, y, TILE, 9);
            ctx.fillStyle = 'rgba(255,255,255,0.25)';
            ctx.fillRect(x + 5, y + 12, 6, 3);
            ctx.fillRect(x + 20, y + 20, 8, 3);
          }
        } else if (k === TILE_KIND.ONEWAY) {
          ctx.fillStyle = '#6b4a2a';
          ctx.fillRect(x, y, TILE, 10);
          ctx.fillStyle = spire.groundTop;
          ctx.fillRect(x, y, TILE, 4);
        } else if (k === TILE_KIND.CRUMBLE) {
          const c = w.crumble.get(cx + ',' + cy);
          const sh = c && !c.gone ? Math.sin(w.time * 40) * 1.5 : 0;
          ctx.fillStyle = '#7a5c44';
          ctx.fillRect(x + sh, y, TILE, TILE);
          ctx.strokeStyle = '#4a3423';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x + sh + 8, y + 6); ctx.lineTo(x + sh + 18, y + 18); ctx.lineTo(x + sh + 12, y + 30);
          ctx.stroke();
        } else if (k === TILE_KIND.SPIKE) {
          ctx.fillStyle = '#c8ccd4';
          for (let i = 0; i < 3; i++) {
            const sx = x + i * 12;
            ctx.beginPath();
            ctx.moveTo(sx, y + TILE);
            ctx.lineTo(sx + 6, y + 8);
            ctx.lineTo(sx + 12, y + TILE);
            ctx.closePath();
            ctx.fill();
          }
        }
      }
    }
    // Exit portal: a swirling gate; chained shut while the boss lives.
    const e = w.exit;
    const cxp = e.x + e.w / 2, cyp = e.y + e.h / 2;
    const sealed = w.exitSealed;
    ctx.save();
    ctx.translate(cxp, cyp);
    ctx.rotate(Math.sin(w.time * 0.8) * 0.05);
    const pg = ctx.createRadialGradient(0, 0, 4, 0, 0, 44);
    pg.addColorStop(0, sealed ? '#555566' : '#ffffff');
    pg.addColorStop(0.6, sealed ? '#333344' : w.spire.accent);
    pg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.ellipse(0, 0, 16, 40, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = sealed ? '#888899' : '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, 0, 16, 40, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    if (sealed) {
      ctx.strokeStyle = '#222233';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(e.x - 4, e.y + 6); ctx.lineTo(e.x + e.w + 4, e.y + e.h - 6);
      ctx.moveTo(e.x + e.w + 4, e.y + 6); ctx.lineTo(e.x - 4, e.y + e.h - 6);
      ctx.stroke();
    }
  }

  drawEntities(ctx, w, t) {
    const spire = w.spire;
    for (const e of w.entities) {
      if (e.dead || e.taken) continue;
      if (e.kind === 'shard') {
        ctx.fillStyle = spire.shard;
        const pulse = 1 + Math.sin(t * 4 + e.x * 0.05) * 0.15;
        star4(ctx, e.x + 9, e.y + 9, 11 * pulse, t * 0.8);
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        star4(ctx, e.x + 9, e.y + 9, 4.5 * pulse, t * 0.8);
      } else if (e.kind === 'heart') {
        ctx.fillStyle = '#ff5b7a';
        heartShape(ctx, e.x + 9, e.y + 10, 11 + Math.sin(t * 5) * 1.5);
      } else if (e.kind === 'shrine') {
        ctx.fillStyle = '#5a4a6a';
        ctx.fillRect(e.x - 4, e.y - 6, 8, 42);
        ctx.fillRect(e.x + 32, e.y - 6, 8, 42);
        ctx.fillRect(e.x - 8, e.y - 14, 52, 10);
        ctx.fillStyle = e.lit ? '#ffb35c' : '#3a3048';
        ctx.beginPath();
        ctx.arc(e.x + 18, e.y - 16, e.lit ? 9 + Math.sin(t * 6) * 2 : 6, 0, Math.PI * 2);
        ctx.fill();
        if (e.lit) {
          ctx.fillStyle = 'rgba(255,179,92,0.25)';
          ctx.beginPath();
          ctx.arc(e.x + 18, e.y - 16, 22, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (e.kind === 'mover') {
        ctx.fillStyle = '#8a6a4a';
        ctx.fillRect(e.x, e.y, e.w || 108, 18);
        ctx.fillStyle = spire.groundTop;
        ctx.fillRect(e.x, e.y, e.w || 108, 5);
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.beginPath();
        ctx.arc(e.x + (e.w || 108) / 2, e.y + 22, 4 + Math.sin(t * 3) * 1.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (e.kind === 'walker') {
        const bob = Math.sin((e.anim || 0) * 10) * 2;
        ctx.fillStyle = '#2d1a2e';
        ctx.beginPath();
        ctx.ellipse(e.x + 15, e.y + 18 + bob, 15, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e84c6a';
        ctx.beginPath();
        ctx.arc(e.x + (e.vx > 0 ? 24 : 6), e.y + 14 + bob, 3, 0, Math.PI * 2);
        ctx.arc(e.x + (e.vx > 0 ? 24 : 6), e.y + 20 + bob, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#2d1a2e';
        ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.moveTo(e.x + 6 + i * 9, e.y + 26);
          ctx.lineTo(e.x + 4 + i * 9, e.y + 30 + Math.sin((e.anim || 0) * 10 + i) * 2);
          ctx.stroke();
        }
      } else if (e.kind === 'flyer') {
        const flap = Math.sin((e.anim || 0) * 12) * 0.7;
        ctx.fillStyle = '#3a2a55';
        ctx.beginPath();
        ctx.ellipse(e.x + 15, e.y + 12, 10, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#5a4486';
        ctx.beginPath();
        ctx.moveTo(e.x + 8, e.y + 10);
        ctx.quadraticCurveTo(e.x - 8, e.y - 6 + flap * 10, e.x - 2, e.y + 14);
        ctx.moveTo(e.x + 22, e.y + 10);
        ctx.quadraticCurveTo(e.x + 38, e.y - 6 + flap * 10, e.x + 32, e.y + 14);
        ctx.fill();
        ctx.fillStyle = '#ffd76a';
        ctx.beginPath();
        ctx.arc(e.x + 12, e.y + 10, 2.2, 0, Math.PI * 2);
        ctx.arc(e.x + 18, e.y + 10, 2.2, 0, Math.PI * 2);
        ctx.fill();
      } else if (e.kind === 'spitter') {
        ctx.strokeStyle = '#2d5a2d';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(e.x + 15, e.y + 40);
        ctx.quadraticCurveTo(e.x + 15, e.y + 20, e.x + 15, e.y + 14);
        ctx.stroke();
        ctx.fillStyle = '#7a3a8a';
        ctx.beginPath();
        ctx.arc(e.x + 15, e.y + 12, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffb35c';
        ctx.beginPath();
        ctx.arc(e.x + 15, e.y + 12, 5 + Math.max(0, 1 - e.timer) * 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Boss.
    if (w.boss && !w.bossDead) {
      const b = w.boss;
      const flash = b.flash ? 0.5 + 0.5 * b.flash : 0;
      ctx.save();
      if (b.hurtCd > 0 && Math.floor(t * 14) % 2 === 0) ctx.globalAlpha = 0.45;
      ctx.fillStyle = flash > 0.4 ? '#ffffff' : '#241a3a';
      ctx.beginPath();
      ctx.moveTo(b.x + 32, b.y - 6);
      ctx.quadraticCurveTo(b.x + 66, b.y + 10, b.x + 60, b.y + 72);
      ctx.lineTo(b.x + 4, b.y + 72);
      ctx.quadraticCurveTo(b.x - 2, b.y + 10, b.x + 32, b.y - 6);
      ctx.fill();
      ctx.fillStyle = '#8a6fd8';
      ctx.beginPath();
      ctx.moveTo(b.x + 32, b.y - 18);
      ctx.lineTo(b.x + 22, b.y - 2);
      ctx.lineTo(b.x + 42, b.y - 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffe9a3';
      ctx.beginPath();
      ctx.arc(b.x + 24, b.y + 26, 4, 0, Math.PI * 2);
      ctx.arc(b.x + 40, b.y + 26, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    // Projectiles.
    for (const p of w.projectiles) {
      ctx.fillStyle = '#b45ae0';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e8c8ff';
      ctx.beginPath();
      ctx.arc(p.x - 2, p.y - 2, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawPlayer(ctx, w, t) {
    const p = w.player;
    if (p.invuln > 0 && Math.floor(t * 14) % 2 === 0) return; // blink while hurt
    ctx.save();
    ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
    // Dash streak.
    if (p.dashTime > 0) {
      ctx.fillStyle = 'rgba(159,216,255,0.4)';
      ctx.fillRect(-p.facing * 30, -8, 30, 16);
    }
    // Scarf flowing behind.
    ctx.strokeStyle = '#ff8fa3';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-p.facing * 8, -6);
    ctx.quadraticCurveTo(-p.facing * 22, -2 + Math.sin(t * 8) * 4, -p.facing * 30, 4 + Math.sin(t * 8 + 1) * 4);
    ctx.stroke();
    // Cloak body.
    ctx.fillStyle = '#f7f3e8';
    ctx.beginPath();
    ctx.moveTo(0, -19);
    ctx.quadraticCurveTo(13, -12, 11, 12);
    ctx.quadraticCurveTo(6, 19, 0, 19);
    ctx.quadraticCurveTo(-6, 19, -11, 12);
    ctx.quadraticCurveTo(-13, -12, 0, -19);
    ctx.fill();
    // Hood + face.
    ctx.fillStyle = '#e8b25c';
    ctx.beginPath();
    ctx.arc(0, -10, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2d1a2e';
    ctx.beginPath();
    ctx.arc(p.facing * 3, -11, 1.8, 0, Math.PI * 2);
    ctx.arc(p.facing * 3 + 5, -11, 1.8, 0, Math.PI * 2);
    ctx.fill();
    // Shield bubble.
    if (p.shield) {
      ctx.strokeStyle = 'rgba(207,238,255,0.9)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, 26 + Math.sin(t * 3) * 1.5, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawParticles(ctx, w) {
    for (const p of w.particles.list) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - w.camX - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  drawHUD(ctx, game) {
    const w = game.world;
    ctx.save();
    // Top bar.
    ctx.fillStyle = 'rgba(10,8,24,0.45)';
    ctx.fillRect(0, 0, VIEW_W, 52);
    // Hearts.
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = i < w.hearts ? '#ff5b7a' : 'rgba(255,255,255,0.25)';
      heartShape(ctx, 34 + i * 34, 26, 11);
    }
    // Shield pip.
    if (w.unlocks.shield) {
      ctx.strokeStyle = w.player.shield ? '#cfeeff' : 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(34 + 3 * 34 + 8, 26, 9, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Shards.
    ctx.fillStyle = '#ffe9a3';
    star4(ctx, 168, 26, 11, 0.4);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(w.shards + ' / ' + w.shardTotal, 186, 27);
    // Level name centre.
    ctx.textAlign = 'center';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText('SPIRE ' + (w.levelIndex + 1) + ' / 5 — ' + w.spire.name.toUpperCase(), VIEW_W / 2, 20);
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    const mins = Math.floor(w.time / 60);
    const secs = Math.floor(w.time % 60);
    ctx.fillText(String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0') + '   ·   P pause   ·   M mute', VIEW_W / 2, 41);
    // Dash / double-jump pips right.
    ctx.textAlign = 'right';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    const ups = [];
    if (w.unlocks.doubleJump) ups.push('2× JUMP');
    if (w.unlocks.dash) ups.push(w.player.dashCd > 0 ? 'DASH …' : 'DASH ✓');
    if (w.unlocks.shield) ups.push('AEGIS');
    ctx.fillText(ups.join('   '), VIEW_W - 24, 27);
    // Boss bar.
    if (w.boss && !w.bossDead) {
      const bw = 420;
      ctx.fillStyle = 'rgba(10,8,24,0.6)';
      ctx.fillRect(VIEW_W / 2 - bw / 2 - 6, 62, bw + 12, 26);
      ctx.fillStyle = '#3a2a55';
      ctx.fillRect(VIEW_W / 2 - bw / 2, 68, bw, 14);
      ctx.fillStyle = '#b45ae0';
      ctx.fillRect(VIEW_W / 2 - bw / 2, 68, bw * (w.boss.hp / w.boss.maxHp), 14);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('THE STORM WARDEN', VIEW_W / 2, 76);
    }
    ctx.restore();
  }

  panel(ctx, x, y, w, h) {
    ctx.fillStyle = 'rgba(12,10,28,0.82)';
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 16);
    ctx.fill();
    ctx.stroke();
  }

  drawTitle(ctx, game) {
    this.drawHills(ctx, SPIRES[0], game.time * 20);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 92px system-ui, sans-serif';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 18;
    ctx.fillText('SPIREBOUND', VIEW_W / 2, 250);
    ctx.shadowBlur = 0;
    ctx.font = '28px system-ui, sans-serif';
    ctx.fillStyle = '#ffe9a3';
    ctx.fillText('Climb the five spires. Light every shrine. Face the Warden.', VIEW_W / 2, 300);
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText('Five hand-built spires  ·  double jump, dash and aegis to unlock  ·  stars on every spire', VIEW_W / 2, 350);
    const blink = 0.6 + 0.4 * Math.sin(game.time * 3);
    ctx.globalAlpha = blink;
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('PRESS ENTER TO CLIMB', VIEW_W / 2, 430);
    ctx.globalAlpha = 1;
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    const total = game.totalStars || 0;
    ctx.fillText(total > 0 ? 'Best climb: ' + total + ' / 15 stars' : 'Arrows / WASD move  ·  SPACE jump  ·  SHIFT dash  ·  P pause  ·  M mute', VIEW_W / 2, 480);
    ctx.fillText('Arrows / WASD move  ·  SPACE jump  ·  SHIFT dash  ·  P pause  ·  M mute', VIEW_W / 2, 514);
  }

  drawSelect(ctx, game) {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 44px system-ui, sans-serif';
    ctx.fillText('CHOOSE YOUR SPIRE', VIEW_W / 2, 110);
    ctx.font = '19px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText('Arrows to choose, ENTER to climb. Total stars: ' + (game.totalStars || 0) + ' / 15', VIEW_W / 2, 148);
    const cw = 210, ch = 300, gap = 24;
    const x0 = (VIEW_W - (cw * 5 + gap * 4)) / 2;
    for (let i = 0; i < 5; i++) {
      const x = x0 + i * (cw + gap);
      const y = 210;
      const sp = SPIRES[i];
      const unlocked = game.unlocked[i];
      const sel = game.selected === i;
      const stars = game.stars[i] || 0;
      ctx.save();
      if (sel) {
        ctx.shadowColor = sp.accent;
        ctx.shadowBlur = 24;
      }
      this.panel(ctx, x, y, cw, ch);
      ctx.restore();
      // Mini sky strip.
      const g = ctx.createLinearGradient(x, y, x, y + 120);
      g.addColorStop(0, sp.sky[0]);
      g.addColorStop(1, sp.sky[1]);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.roundRect(x + 10, y + 10, cw - 20, 110, 10);
      ctx.fill();
      // Spire silhouette.
      ctx.fillStyle = sp.groundTop;
      ctx.beginPath();
      ctx.moveTo(x + cw / 2 - 40, y + 120);
      ctx.lineTo(x + cw / 2, y + 34);
      ctx.lineTo(x + cw / 2 + 40, y + 120);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.fillText(sp.name.toUpperCase(), x + cw / 2, y + 160);
      ctx.font = '15px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillText(sp.sub, x + cw / 2, y + 186, cw - 24);
      if (sp.unlock) {
        ctx.fillStyle = sp.accent;
        ctx.font = 'bold 14px system-ui, sans-serif';
        ctx.fillText('UNLOCKS: ' + UNLOCK_LABELS[sp.unlock].toUpperCase(), x + cw / 2, y + 214);
      }
      // Stars.
      for (let s = 0; s < 3; s++) {
        ctx.fillStyle = s < stars ? '#ffe9a3' : 'rgba(255,255,255,0.22)';
        star4(ctx, x + cw / 2 - 34 + s * 34, y + 252, 13, 0.4);
      }
      if (!unlocked) {
        ctx.fillStyle = 'rgba(8,6,18,0.72)';
        ctx.beginPath();
        ctx.roundRect(x, y, cw, ch, 16);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 22px system-ui, sans-serif';
        ctx.fillText('🔒 LOCKED', x + cw / 2, y + 160);
        ctx.font = '15px system-ui, sans-serif';
        ctx.fillText('Clear spire ' + i + ' first', x + cw / 2, y + 190);
      }
      if (sel && unlocked) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(x - 4, y - 4, cw + 8, ch + 8, 18);
        ctx.stroke();
      }
    }
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '17px system-ui, sans-serif';
    ctx.fillText('ESC — back to title', VIEW_W / 2, 570);
  }

  drawIntro(ctx, game) {
    const w = game.world;
    this.panel(ctx, VIEW_W / 2 - 330, 210, 660, 220);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 40px system-ui, sans-serif';
    ctx.fillText('SPIRE ' + (w.levelIndex + 1) + ' — ' + w.spire.name.toUpperCase(), VIEW_W / 2, 270);
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillStyle = w.spire.accent;
    ctx.fillText(w.spire.sub, VIEW_W / 2, 306);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillText('Collect every starshard · light the shrines · reach the portal', VIEW_W / 2, 344);
    if (w.spire.unlockText) {
      ctx.fillStyle = '#ffe9a3';
      ctx.font = 'bold 19px system-ui, sans-serif';
      ctx.fillText(w.spire.unlockText, VIEW_W / 2, 376);
    }
    const blink = 0.6 + 0.4 * Math.sin(game.time * 3);
    ctx.globalAlpha = blink;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText('PRESS ENTER TO BEGIN', VIEW_W / 2, 410);
    ctx.globalAlpha = 1;
  }

  drawPause(ctx, game) {
    ctx.fillStyle = 'rgba(8,6,18,0.55)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    this.panel(ctx, VIEW_W / 2 - 260, 240, 520, 220);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 40px system-ui, sans-serif';
    ctx.fillText('PAUSED', VIEW_W / 2, 300);
    ctx.font = '19px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText('P — resume    ·    R — restart spire    ·    ESC — level select', VIEW_W / 2, 350);
    ctx.fillText('M — mute', VIEW_W / 2, 382);
  }

  drawClear(ctx, game) {
    const w = game.world;
    const stars = game.lastStars || 0;
    this.panel(ctx, VIEW_W / 2 - 330, 170, 660, 340);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffe9a3';
    ctx.font = 'bold 44px system-ui, sans-serif';
    ctx.fillText('SPIRE CLEARED!', VIEW_W / 2, 240);
    for (let s = 0; s < 3; s++) {
      ctx.fillStyle = s < stars ? '#ffe9a3' : 'rgba(255,255,255,0.22)';
      star4(ctx, VIEW_W / 2 - 60 + s * 60, 300, 26, 0.4);
    }
    ctx.fillStyle = '#ffffff';
    ctx.font = '22px system-ui, sans-serif';
    ctx.fillText('Shards ' + w.shards + ' / ' + w.shardTotal + '    ·    Time ' + Math.floor(w.time / 60) + ':' + String(Math.floor(w.time % 60)).padStart(2, '0') + '    ·    Score ' + w.score(), VIEW_W / 2, 360);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '19px system-ui, sans-serif';
    const last = w.levelIndex === 4;
    ctx.fillText(last ? 'ENTER — see your triumph' : 'ENTER — climb the next spire     ·     R — replay this spire', VIEW_W / 2, 410);
    ctx.fillText('ESC — level select', VIEW_W / 2, 444);
  }

  drawOver(ctx, game) {
    const w = game.world;
    ctx.fillStyle = 'rgba(20,4,8,0.6)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    this.panel(ctx, VIEW_W / 2 - 300, 220, 600, 240);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff8fa3';
    ctx.font = 'bold 44px system-ui, sans-serif';
    ctx.fillText('THE CLIMB ENDS', VIEW_W / 2, 290);
    ctx.fillStyle = '#ffffff';
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillText(w.spire.name + ' keeps its secrets — this time.', VIEW_W / 2, 332);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '19px system-ui, sans-serif';
    ctx.fillText('R — try again from the last shrine     ·     ESC — level select', VIEW_W / 2, 384);
  }

  drawVictory(ctx, game) {
    this.panel(ctx, VIEW_W / 2 - 360, 150, 720, 380);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffe9a3';
    ctx.font = 'bold 48px system-ui, sans-serif';
    ctx.fillText('THE FIVE SPIRES', VIEW_W / 2, 230);
    ctx.fillText('STAND LIT', VIEW_W / 2, 286);
    ctx.fillStyle = '#ffffff';
    ctx.font = '22px system-ui, sans-serif';
    ctx.fillText('Every shrine lit. The Warden is beaten. The climb is yours.', VIEW_W / 2, 336);
    for (let s = 0; s < 5; s++) {
      const stars = game.stars[s] || 0;
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 17px system-ui, sans-serif';
      ctx.fillText('SPIRE ' + (s + 1), VIEW_W / 2 - 240 + s * 120, 392);
      for (let k = 0; k < 3; k++) {
        ctx.fillStyle = k < stars ? '#ffe9a3' : 'rgba(255,255,255,0.22)';
        star4(ctx, VIEW_W / 2 - 240 + s * 120 - 22 + k * 22, 420, 9, 0.4);
      }
    }
    ctx.fillStyle = '#ffe9a3';
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.fillText('TOTAL: ' + (game.totalStars || 0) + ' / 15 STARS', VIEW_W / 2, 478);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '19px system-ui, sans-serif';
    ctx.fillText('ENTER — climb again', VIEW_W / 2, 512);
  }
}
