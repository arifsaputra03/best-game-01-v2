// All sound is synthesized live with the Web Audio API — no audio files.
// Each effect is a tiny oscillator/noise envelope so the game stays silent
// until the first user gesture (browsers require it).
export class SoundBank {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.master = null;
  }

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.22;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  tone(freq, dur, type = 'sine', vol = 1, slideTo = null, delay = 0) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.9 * vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  noise(dur, vol = 0.5, lowpass = 1200, delay = 0) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(t0);
  }

  jump() { this.tone(280, 0.16, 'square', 0.5, 560); }
  doubleJump() { this.tone(420, 0.14, 'square', 0.45, 840); }
  dash() { this.noise(0.18, 0.6, 2400); this.tone(180, 0.14, 'sawtooth', 0.3, 420); }
  shard() { this.tone(880, 0.1, 'sine', 0.55); this.tone(1320, 0.14, 'sine', 0.5, null, 0.06); }
  heart() { this.tone(523, 0.12, 'sine', 0.6); this.tone(784, 0.2, 'sine', 0.6, null, 0.1); }
  hurt() { this.tone(220, 0.25, 'sawtooth', 0.6, 70); this.noise(0.12, 0.4, 800); }
  stomp() { this.tone(180, 0.12, 'square', 0.6, 60); this.noise(0.08, 0.4, 600); }
  checkpoint() { [523, 659, 784].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.55, null, i * 0.09)); }
  spit() { this.tone(160, 0.18, 'sawtooth', 0.35, 90); }
  bossHit() { this.tone(140, 0.2, 'square', 0.7, 50); this.noise(0.15, 0.5, 500); }
  shieldBreak() { this.tone(900, 0.2, 'triangle', 0.6, 200); }
  levelClear() { [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.28, 'triangle', 0.6, null, i * 0.11)); }
  gameOver() { [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.55, null, i * 0.16)); }
  victory() { [523, 659, 784, 1047, 784, 1047, 1319, 1568].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.6, null, i * 0.12)); }
  click() { this.tone(660, 0.06, 'sine', 0.4); }
}
