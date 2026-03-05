// ── Sound manager using Web Audio API ─────────────────────────────────────
let audioCtx: AudioContext | null = null;
let _muted = localStorage.getItem('wordle_muted') === 'true';

function ctx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

export function isMuted(): boolean { return _muted; }
export function setMuted(m: boolean) {
  _muted = m;
  localStorage.setItem('wordle_muted', String(m));
}
export function toggleMuted(): boolean {
  setMuted(!_muted);
  return _muted;
}

function tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.12) {
  if (_muted) return;
  try {
    const c = ctx();
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    o.connect(g).connect(c.destination);
    o.start();
    o.stop(c.currentTime + dur);
  } catch { /* ignore audio errors */ }
}

export function playKeyClick() { tone(800, 0.04, 'square', 0.04); }
export function playBackspace() { tone(500, 0.04, 'square', 0.03); }
export function playInvalidWord() { tone(200, 0.15, 'sawtooth', 0.04); }

export function playTileRow(length: number) {
  for (let i = 0; i < length; i++) {
    setTimeout(() => tone(300 + i * 40, 0.1, 'sine', 0.06), i * 80);
  }
}

export function playWin() {
  if (_muted) return;
  [523.25, 659.25, 783.99, 1046.50].forEach((f, i) =>
    setTimeout(() => tone(f, 0.35, 'sine', 0.1), i * 120),
  );
}

export function playLose() {
  if (_muted) return;
  [392, 349.23, 329.63, 261.63].forEach((f, i) =>
    setTimeout(() => tone(f, 0.4, 'triangle', 0.08), i * 180),
  );
}

export function playOtherWin() {
  if (_muted) return;
  [440, 392, 349.23].forEach((f, i) =>
    setTimeout(() => tone(f, 0.3, 'sine', 0.06), i * 150),
  );
}

export function playChatNotif() { tone(1200, 0.06, 'sine', 0.06); }
