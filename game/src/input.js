// Keyboard input with edge detection: held keys plus "just pressed" events
// so jumps, dashes and menu confirms fire exactly once per press.
export class Input {
  constructor() {
    this.down = new Set();
    this.pressed = new Set();
    this.anyKey = false;
    this._onDown = (e) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.key.length === 1 ? e.key.toLowerCase() : e.key);
      this.down.add(e.key.length === 1 ? e.key.toLowerCase() : e.key);
      this.anyKey = true;
    };
    this._onUp = (e) => {
      this.down.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key);
    };
    window.addEventListener('keydown', this._onDown);
    window.addEventListener('keyup', this._onUp);
  }

  held(...keys) {
    return keys.some((k) => this.down.has(k));
  }

  justPressed(...keys) {
    return keys.some((k) => this.pressed.has(k));
  }

  left() { return this.held('ArrowLeft', 'a'); }
  right() { return this.held('ArrowRight', 'd'); }
  jumpPressed() { return this.justPressed(' ', 'ArrowUp', 'w'); }
  jumpHeld() { return this.held(' ', 'ArrowUp', 'w'); }
  dashPressed() { return this.justPressed('Shift'); }
  confirmPressed() { return this.justPressed('Enter', ' '); }
  pausePressed() { return this.justPressed('p', 'P', 'Escape'); }
  mutePressed() { return this.justPressed('m', 'M'); }
  restartPressed() { return this.justPressed('r', 'R'); }

  // Call once per frame after the game has read the input.
  endFrame() {
    this.pressed.clear();
  }

  // Test helpers: inject synthetic presses without a real keyboard.
  press(key) { this.pressed.add(key); this.down.add(key); }
  release(key) { this.down.delete(key); }
}
