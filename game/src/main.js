// SPIREBOUND — the game itself: state machine, save data, the loop,
// and the two headless modes (deterministic screenshots, self-test).
import { VIEW_W, VIEW_H } from './config.js';
import { World } from './world.js';
import { Renderer } from './render.js';
import { Input } from './input.js';
import { SoundBank } from './audio.js';
import { setupShot } from './shots.js';
import { runSelfTest } from './selftest.js';

const SAVE_KEY = 'spirebound-save-v1';
const STEP = 1 / 60;

export class Game {
  constructor(canvas) {
    this.cv = canvas;
    this.state = 'title'; // title | select | intro | play | pause | clear | over | victory
    this.time = 0;
    this.levelIndex = 0;
    this.selected = 0;
    this.world = null;
    this.stars = [0, 0, 0, 0, 0];
    this.unlocked = [true, false, false, false, false];
    this.totalStars = 0;
    this.lastStars = 0;
    this.input = new Input();
    this.sfx = new SoundBank();
    this.renderer = new Renderer(canvas);
    this.loadProgress();
    window.addEventListener('keydown', () => this.sfx.ensure(), { once: true });
    window.addEventListener('mousedown', () => this.sfx.ensure(), { once: true });
    canvas.addEventListener('mousedown', (e) => this.onClick(e));
  }

  loadProgress() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (Array.isArray(d.stars)) this.stars = d.stars.slice(0, 5).map((s) => s | 0);
      for (let i = 1; i < 5; i++) this.unlocked[i] = this.stars[i - 1] > 0;
      this.totalStars = this.stars.reduce((a, b) => a + b, 0);
    } catch (err) { /* fresh save */ }
  }

  saveProgress() {
    this.totalStars = this.stars.reduce((a, b) => a + b, 0);
    try { localStorage.setItem(SAVE_KEY, JSON.stringify({ stars: this.stars })); } catch (err) { /* no storage */ }
  }

  startLevel(i, fresh) {
    this.levelIndex = i;
    this.world = new World(i, this.sfx);
    if (fresh) this.world.fresh();
    this.state = 'intro';
  }

  step(dt) {
    this.time += dt;
    this.update(dt);
    this.input.endFrame();
  }

  update(dt) {
    const inp = this.input;
    if (inp.mutePressed()) this.sfx.toggleMute();
    switch (this.state) {
      case 'title':
        if (inp.confirmPressed()) { this.sfx.ensure(); this.sfx.click(); this.state = 'select'; }
        break;
      case 'select': {
        if (inp.justPressed('ArrowLeft', 'a')) { this.selected = (this.selected + 4) % 5; this.sfx.click(); }
        if (inp.justPressed('ArrowRight', 'd')) { this.selected = (this.selected + 1) % 5; this.sfx.click(); }
        if (inp.justPressed('Escape')) { this.state = 'title'; break; }
        if (inp.confirmPressed() && this.unlocked[this.selected]) {
          this.sfx.ensure(); this.sfx.click();
          this.startLevel(this.selected, true);
        }
        break;
      }
      case 'intro':
        if (inp.confirmPressed()) { this.sfx.click(); this.state = 'play'; }
        break;
      case 'play': {
        const ev = this.world.update(dt, inp);
        if (inp.pausePressed()) { this.state = 'pause'; break; }
        if (inp.restartPressed()) { this.world.retry(); break; }
        if (ev === 'clear') {
          const stars = this.world.stars();
          this.lastStars = stars;
          this.stars[this.levelIndex] = Math.max(this.stars[this.levelIndex], stars);
          if (this.levelIndex < 4) this.unlocked[this.levelIndex + 1] = true;
          this.saveProgress();
          this.sfx.levelClear();
          this.state = 'clear';
        } else if (ev === 'over' || this.world.over) {
          this.sfx.gameOver();
          this.state = 'over';
        }
        break;
      }
      case 'pause':
        if (inp.justPressed('Escape')) { this.state = 'select'; break; }
        if (inp.pausePressed() || inp.confirmPressed()) { this.state = 'play'; break; }
        if (inp.restartPressed()) { this.world.retry(); this.state = 'play'; break; }
        break;
      case 'clear':
        if (inp.confirmPressed()) {
          if (this.levelIndex === 4) this.state = 'victory';
          else this.startLevel(this.levelIndex + 1, true);
          break;
        }
        if (inp.restartPressed()) { this.startLevel(this.levelIndex, true); break; }
        if (inp.justPressed('Escape')) { this.state = 'select'; break; }
        break;
      case 'over':
        if (inp.restartPressed()) { this.world.retry(); this.state = 'play'; break; }
        if (inp.justPressed('Escape')) { this.state = 'select'; break; }
        break;
      case 'victory':
        if (inp.confirmPressed()) { this.state = 'select'; break; }
        break;
    }
  }

  // Mouse: clicking a spire card starts it; clicking elsewhere confirms.
  onClick(e) {
    const r = this.cv.getBoundingClientRect();
    const mx = ((e.clientX - r.left) / r.width) * VIEW_W;
    const my = ((e.clientY - r.top) / r.height) * VIEW_H;
    this.sfx.ensure();
    if (this.state === 'title') { this.state = 'select'; return; }
    if (this.state === 'select') {
      const cw = 210, ch = 300, gap = 24;
      const x0 = (VIEW_W - (cw * 5 + gap * 4)) / 2;
      for (let i = 0; i < 5; i++) {
        const x = x0 + i * (cw + gap);
        if (mx >= x && mx <= x + cw && my >= 210 && my <= 510 && this.unlocked[i]) {
          this.startLevel(i, true);
          return;
        }
      }
      return;
    }
    if (this.state === 'intro' || this.state === 'clear' || this.state === 'victory') {
      this.input.press('Enter');
      this.step(STEP);
      this.input.release('Enter');
    }
  }

  render() {
    this.renderer.draw(this);
  }
}

const canvas = document.getElementById('game');
const game = new Game(canvas);
const params = new URLSearchParams(location.search);

if (params.has('selftest')) {
  const res = runSelfTest(game);
  const text = res.lines.join('\n');
  console.log(text);
  document.title = 'SELFTEST ' + res.passed + '/' + (res.passed + res.failed);
  const div = document.getElementById('selftest');
  if (div) {
    div.style.display = 'block';
    div.textContent = text;
  }
  window.__selftestDone = true;
} else if (params.has('shot')) {
  setupShot(game, params.get('shot') || 'start', parseInt(params.get('seed') || '7', 10));
  game.render();
  window.__shotReady = true;
} else {
  let last = performance.now();
  let acc = 0;
  const loop = (now) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    acc += dt;
    let n = 0;
    while (acc >= STEP && n < 5) {
      game.step(STEP);
      acc -= STEP;
      n++;
    }
    game.render();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
