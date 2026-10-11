'use strict';
// =====================================================================
//  SUPER MURILO & MAHER — core: screen, sound, controls, drawing helpers
// =====================================================================

const cv = document.getElementById('c');
const ctx = cv.getContext('2d');
const T = 32;          // one tile, in pixels
const H = 15;          // level height, in tiles
const VH = H * T;      // screen height
let VW = 768;          // screen width (follows the window's shape)
const FONT = '"Press Start 2P", monospace';
const IS_XBOX = /xbox/i.test(navigator.userAgent);
let frameCount = 0;

try { navigator.gamepadInputEmulation = 'gamepad'; } catch (e) {}

function resize() {
  const ar = innerWidth / innerHeight;
  VW = Math.max(512, Math.min(1024, Math.round(VH * ar / 2) * 2));
  cv.width = VW; cv.height = VH;
  const s = Math.min(innerWidth / VW, innerHeight / VH);
  cv.style.width = VW * s + 'px';
  cv.style.height = VH * s + 'px';
  ctx.imageSmoothingEnabled = false;
}
addEventListener('resize', resize);
resize();

// ---------------------------------------------------------------- sound
let actx = null;
function initAudio() {
  try {
    if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
  } catch (e) {}
}
function beep(freq, dur, type = 'square', slide = 0, vol = 0.07, delay = 0) {
  if (!actx) return;
  const t0 = actx.currentTime + delay;
  const o = actx.createOscillator(), g = actx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g).connect(actx.destination);
  o.start(t0); o.stop(t0 + dur);
}
const tune = (notes, gap, dur = 0.12, type = 'square', vol = 0.06) =>
  notes.forEach((f, i) => beep(f, dur, type, 0, vol, i * gap));
const sfx = {
  jump:    () => beep(280, 0.18, 'square', 620),
  coin:    () => { beep(988, 0.07); beep(1319, 0.25, 'square', 0, 0.07, 0.07); },
  stomp:   () => beep(220, 0.12, 'square', 70),
  bump:    () => beep(110, 0.08, 'triangle'),
  brk:     () => beep(160, 0.2, 'sawtooth', 40, 0.06),
  sprout:  () => beep(300, 0.4, 'triangle', 900, 0.08),
  power:   () => tune([523, 659, 784, 1047, 1319], 0.06, 0.09),
  shrink:  () => tune([784, 659, 523, 392], 0.07, 0.09),
  fire:    () => beep(900, 0.08, 'square', 300, 0.05),
  flap:    () => beep(200, 0.06, 'triangle', 350, 0.05),
  spring:  () => beep(200, 0.3, 'square', 900, 0.06),
  boost:   () => beep(300, 0.35, 'sawtooth', 1200, 0.05),
  check:   () => tune([784, 988, 1175], 0.08, 0.1),
  spill:   () => tune([1319, 1175, 988, 880, 784, 659], 0.04, 0.08, 'square', 0.05),
  hurt:    () => beep(300, 0.2, 'square', 100, 0.07),
  die:     () => tune([660, 520, 440, 330, 220], 0.15, 0.18, 'square', 0.07),
  clear:   () => tune([523, 659, 784, 1047, 784, 1047], 0.13, 0.2, 'square', 0.07),
  oneup:   () => tune([660, 784, 1319, 1047, 1175, 1568], 0.08, 0.1),
  bossHit: () => beep(140, 0.35, 'sawtooth', 40, 0.09),
  thud:    () => beep(70, 0.25, 'triangle', 40, 0.14),
  spit:    () => beep(500, 0.15, 'square', 200, 0.05),
  count:   () => beep(440, 0.15, 'square', 0, 0.08),
  go:      () => beep(880, 0.45, 'square', 0, 0.08),
  select:  () => beep(660, 0.06, 'square', 0, 0.05),
  pause:   () => beep(880, 0.1, 'square'),
  win:     () => tune([523, 523, 523, 659, 784, 659, 784, 1047], 0.14, 0.18, 'square', 0.07),
};

// ---------------------------------------------------------------- controls
const keys = {};
const tapped = {};   // keys pressed since the last frame, so quick taps aren't missed
addEventListener('keydown', e => {
  keys[e.code] = true;
  tapped[e.code] = true;
  initAudio();
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Backspace'].includes(e.code)) e.preventDefault();
  if (e.code === 'KeyF') toggleFullscreen();
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('pointerdown', () => initAudio());
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

function toggleFullscreen() {
  try {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
    else document.exitFullscreen();
  } catch (e) {}
}

// Keyboard layouts: one player gets everything; two players split the keyboard.
const KEYSETS = {
  all: { left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'],
         jump: ['Space', 'ArrowUp', 'KeyW', 'KeyZ'], run: ['ShiftLeft', 'ShiftRight', 'KeyX'] },
  p1:  { left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'],
         jump: ['ArrowUp', 'Slash'], run: ['ShiftRight', 'Period'] },
  p2:  { left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'],
         jump: ['KeyW', 'Space'], run: ['ShiftLeft', 'KeyG'] },
};
const NO_INPUT = { left: false, right: false, up: false, down: false, jump: false, run: false, jumpP: false, runP: false };

/** Connected controllers, in order. Odd devices (headsets, remotes) are skipped when a real controller is there. */
function padList() {
  const ps = (navigator.getGamepads ? [...navigator.getGamepads()] : []).filter(p => p && p.connected);
  const real = ps.filter(p => p.mapping === 'standard');
  return real.length ? real : ps;
}
// A stick or button only counts after it has been seen centered/released once,
// so one that's stuck from the start can't drive the game (same fix as Evil One).
const settled = new Map();
function readPad(p) {
  let s = settled.get(p.index);
  if (!s) { s = { axes: [], buttons: [] }; settled.set(p.index, s); }
  const b = n => {
    const btn = p.buttons[n];
    const down = !!(btn && (btn.pressed || btn.value > 0.5));
    if (!down) s.buttons[n] = true;
    return down && !!s.buttons[n];
  };
  const axis = i => {
    const v = p.axes[i] || 0;
    if (Math.abs(v) < 0.3) s.axes[i] = true;
    return s.axes[i] ? v : 0;
  };
  const ax = axis(0), ay = axis(1);
  return {
    left: ax < -0.4 || b(14), right: ax > 0.4 || b(15),
    up: ay < -0.5 || b(12), down: ay > 0.5 || b(13),
    jump: b(0),                          // A
    run: b(2) || b(6) || b(7),           // X or the triggers
    start: b(9),                         // Menu button
    back: b(1) || b(8),                  // B or View button
    view: b(8),
  };
}

let prevIn = { p: [{}, {}], any: {} };
function addEdges(cur, prev) {
  for (const f of Object.keys(cur)) if (typeof cur[f] === 'boolean') cur[f + 'P'] = cur[f] && !prev[f];
  return cur;
}
function merge(...xs) {
  const o = { left: false, right: false, up: false, down: false, jump: false, run: false };
  for (const x of xs) if (x) for (const f in o) o[f] = o[f] || !!x[f];
  return o;
}
/** Reads every keyboard key and controller. `twoPlayer` splits them between Player 1 and 2. */
function pollInput(twoPlayer) {
  const k = c => !!(keys[c] || tapped[c]);
  const ks = set => { const o = {}; for (const f in set) o[f] = set[f].some(k); return o; };
  const pads = padList().map(readPad);
  const p = twoPlayer
    ? [merge(ks(KEYSETS.p1), pads[0]), merge(ks(KEYSETS.p2), pads[1])]
    : [merge(ks(KEYSETS.all), ...pads), merge()];
  const any = merge(ks(KEYSETS.all), ...pads);
  any.confirm = k('Enter') || k('Space') || k('KeyZ') || pads.some(q => q.jump);
  any.pause = k('Escape') || k('KeyP') || pads.some(q => q.start);
  any.back = k('Escape') || k('Backspace') || pads.some(q => q.back);
  any.quit = k('Backspace') || k('KeyQ') || pads.some(q => q.view);
  p.forEach((x, i) => addEdges(x, prevIn.p[i]));
  addEdges(any, prevIn.any);
  prevIn = { p, any };
  for (const c in tapped) delete tapped[c];
  return { p, any, pads: pads.length };
}

/** Makes a controller buzz. `slot` 0 or 1 is that player's controller; null buzzes all. */
function rumble(slot, ms = 150, strength = 0.6) {
  const ps = padList();
  const list = slot === null ? ps : [ps[slot]];
  for (const g of list) {
    if (!g || !g.vibrationActuator) continue;
    try { g.vibrationActuator.playEffect('dual-rumble', { duration: ms, strongMagnitude: strength, weakMagnitude: strength * 0.6 }); } catch (e) {}
  }
}

// ---------------------------------------------------------------- drawing helpers
function R(c, x, y, w, h) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }
function rnd(i) { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
function overlap(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }

function text(s, x, y, size, color, align = 'center', shadow = true) {
  ctx.font = size + 'px ' + FONT;
  ctx.textAlign = align; ctx.textBaseline = 'top';
  if (shadow) { ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillText(s, x + 2, y + 2); }
  ctx.fillStyle = color; ctx.fillText(s, x, y);
}
/** Shrinks the font until `s` fits in `maxW` pixels. */
function textFit(s, x, y, size, color, maxW, align = 'center') {
  ctx.font = size + 'px ' + FONT;
  while (size > 6 && ctx.measureText(s).width > maxW) { size--; ctx.font = size + 'px ' + FONT; }
  text(s, x, y, size, color, align);
}
function fmtTime(frames) {
  const t = frames / 60, m = Math.floor(t / 60), s = Math.floor(t % 60), d = Math.floor((t * 10) % 10);
  return `${m}:${String(s).padStart(2, '0')}.${d}`;
}

// ---------------------------------------------------------------- themes & backgrounds
const THEMES = {
  day:    { sky1: '#4aa8ff', sky2: '#bfe6ff', ground: '#c46a2e', groundDark: '#8f4a1d', grass: '#4cc23a',
            brick: '#c0582a', brickLine: '#6b2a10', stair: '#a0643a', deco: 'hills' },
  cave:   { sky1: '#07061a', sky2: '#221a4d', ground: '#3d4fa8', groundDark: '#262f6e', grass: null,
            brick: '#3a7bd5', brickLine: '#16306b', stair: '#5466b8', deco: 'crystals' },
  sky:    { sky1: '#ff7eb3', sky2: '#ffd08a', ground: '#9b6bd6', groundDark: '#6a3fa8', grass: '#ffffff',
            brick: '#c05a9a', brickLine: '#6b1f52', stair: '#8a5cc0', deco: 'clouds' },
  castle: { sky1: '#140b1c', sky2: '#3a1424', ground: '#6b6b78', groundDark: '#45454f', grass: null,
            brick: '#7a7a88', brickLine: '#3a3a44', stair: '#5c5c6a', deco: 'castle' },
};

function drawClouds(cam, w, par, baseY, color, size) {
  ctx.fillStyle = color;
  for (let i = 0; i < 90; i++) {
    const wx = i * 300 + rnd(i + 20) * 150 - cam * par;
    if (wx < -150 * size || wx > w + 150) continue;
    const y = baseY + rnd(i + 40) * 70;
    const s = size * (0.8 + rnd(i + 60) * 0.5);
    ctx.beginPath();
    ctx.arc(wx, y, 22 * s, 0, Math.PI * 2);
    ctx.arc(wx + 26 * s, y - 12 * s, 28 * s, 0, Math.PI * 2);
    ctx.arc(wx + 56 * s, y, 22 * s, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBackground(th, cam, w) {
  const grd = ctx.createLinearGradient(0, 0, 0, VH);
  grd.addColorStop(0, th.sky1); grd.addColorStop(1, th.sky2);
  ctx.fillStyle = grd; ctx.fillRect(0, 0, w, VH);

  if (th.deco === 'hills') {
    drawClouds(cam, w, 0.2, 60, 'rgba(255,255,255,0.9)', 1);
    for (let i = -1; i < 60; i++) {
      const wx = i * 420 - cam * 0.5;
      if (wx < -400 || wx > w + 400) continue;
      const hgt = 90 + rnd(i) * 80;
      ctx.fillStyle = '#3f9e44';
      ctx.beginPath(); ctx.ellipse(wx + 200, 13 * T, 190, hgt, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#58b85c';
      ctx.beginPath(); ctx.ellipse(wx + 200, 13 * T, 150, hgt - 25, 0, Math.PI, 0); ctx.fill();
    }
    for (let i = 0; i < 120; i++) {
      const wx = i * 230 + rnd(i + 9) * 100 - cam * 0.8;
      if (wx < -80 || wx > w + 80) continue;
      ctx.fillStyle = '#2e8b3a';
      ctx.beginPath(); ctx.ellipse(wx, 13 * T, 50, 26, 0, Math.PI, 0); ctx.fill();
    }
  } else if (th.deco === 'crystals') {
    for (let i = 0; i < 90; i++) {
      const wx = i * 140 + rnd(i) * 80 - cam * 0.4;
      if (wx < -60 || wx > w + 60) continue;
      const h = 40 + rnd(i + 3) * 90;
      ctx.fillStyle = i % 3 ? 'rgba(120,90,255,0.35)' : 'rgba(80,220,255,0.35)';
      ctx.beginPath(); ctx.moveTo(wx - 18, 13 * T); ctx.lineTo(wx, 13 * T - h); ctx.lineTo(wx + 18, 13 * T); ctx.fill();
      ctx.beginPath(); ctx.moveTo(wx + 30, T); ctx.lineTo(wx + 42, T + h * 0.6); ctx.lineTo(wx + 54, T); ctx.fill();
    }
    for (let i = 0; i < 60; i++) {
      const wx = ((i * 97 + rnd(i) * 500 - cam * 0.2) % (w + 40) + w + 40) % (w + 40);
      const y = 40 + rnd(i + 50) * 340;
      const tw = (Math.sin(frameCount * 0.05 + i) + 1) / 2;
      ctx.fillStyle = `rgba(200,230,255,${0.2 + tw * 0.6})`;
      ctx.fillRect(wx, y, 3, 3);
    }
  } else if (th.deco === 'castle') {
    for (let i = 0; i < 60; i++) {
      const wx = i * 180 - cam * 0.5;
      if (wx < -120 || wx > w + 120) continue;
      R('#24142c', wx, 60, 70, VH);
      R('#2e1a38', wx + 6, 60, 58, VH);
      const flick = 0.6 + Math.sin(frameCount * 0.2 + i * 2) * 0.2;
      R(`rgba(255,160,40,${flick})`, wx + 26, 150, 18, 30);
      ctx.fillStyle = `rgba(255,140,30,${flick * 0.25})`;
      ctx.beginPath(); ctx.arc(wx + 35, 165, 40, 0, Math.PI * 2); ctx.fill();
    }
    const lava = ctx.createLinearGradient(0, VH - 120, 0, VH);
    lava.addColorStop(0, 'rgba(255,80,0,0)'); lava.addColorStop(1, 'rgba(255,80,0,0.35)');
    ctx.fillStyle = lava; ctx.fillRect(0, VH - 120, w, 120);
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.arc(w * 0.75, 120, 60, 0, Math.PI * 2); ctx.fill();
    drawClouds(cam, w, 0.15, 300, 'rgba(255,230,240,0.6)', 1.6);
    drawClouds(cam, w, 0.35, 80, 'rgba(255,255,255,0.9)', 1);
  }
}

// ---------------------------------------------------------------- characters
const HEROES = {
  murilo: { name: 'MURILO', cap: '#e52521', shirt: '#e52521', pants: '#2b59c3', hair: '#4a2a10', h: 28, jump: 13.5, grip: 1 },
  maher:  { name: 'MAHER',  cap: '#16a34a', shirt: '#16a34a', pants: '#1e3a8a', hair: '#2a1a0a', h: 32, jump: 14.5, grip: 0.55 },
};
const FIRE_LOOK = { shirt: '#f5f5f5', pants: '#e52521' };

/**
 * Draws a hero. (x, y) is the top-left of their box on screen.
 * pose: 'stand' | 'run' | 'air' | 'dead'.  power: 0 small, 1 big, 2 fire, 3 cape.
 */
function drawHero(hero, x, y, w, h, face, pose, step, power = 0, capeLift = 0) {
  const SKIN = '#ffcc99', SHOE = '#5a3a1a';
  const shirt = power === 2 ? FIRE_LOOK.shirt : hero.shirt;
  const pants = power === 2 ? FIRE_LOOK.pants : hero.pants;
  ctx.save();
  ctx.translate(Math.round(x + w / 2), Math.round(y));
  ctx.scale(face * (h > 40 ? 1.2 : 1), h / 28);

  if (pose === 'dead') {
    R(pants, -8, 20, 16, 4); R(SHOE, -10, 24, 8, 4); R(SHOE, 2, 24, 8, 4);
    R(shirt, -8, 13, 16, 8); R(SKIN, -12, 8, 4, 6); R(SKIN, 8, 8, 4, 6);
    R(SKIN, -7, 4, 14, 10); R('#000', -4, 7, 2, 3); R('#000', 2, 7, 2, 3); R('#000', -2, 11, 4, 2);
    R(hero.cap, -8, 0, 16, 5);
    ctx.restore(); return;
  }
  if (power === 3) {                                   // cape flowing behind
    const lift = Math.max(-6, Math.min(8, capeLift));
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.moveTo(-5, 12); ctx.lineTo(-14 - Math.abs(lift) * 0.6, 24 - lift * 1.6); ctx.lineTo(-4, 26 - lift); ctx.closePath();
    ctx.fill();
    R('#b45309', -6, 12, 3, 3);
  }
  if (pose === 'air') {
    R(pants, -8, 20, 7, 4); R(pants, 2, 18, 7, 5);
    R(SHOE, -10, 23, 8, 4); R(SHOE, 4, 21, 8, 4);
  } else if (step) {
    R(pants, -9, 20, 7, 5); R(pants, 3, 20, 7, 5);
    R(SHOE, -12, 24, 8, 4); R(SHOE, 5, 24, 8, 4);
  } else {
    R(pants, -7, 20, 6, 5); R(pants, 1, 20, 6, 5);
    R(SHOE, -8, 24, 8, 4); R(SHOE, 1, 24, 8, 4);
  }
  R(shirt, -8, 13, 16, 8);
  R(pants, -6, 13, 3, 8); R(pants, 3, 13, 3, 8);         // overall straps
  R('#facc15', -5, 15, 2, 2); R('#facc15', 3, 15, 2, 2);
  if (pose === 'air') R(SKIN, 7, 6, 4, 6); else R(SKIN, 6 + (step ? 1 : 0), 15, 4, 5);
  R(SKIN, -7, 4, 14, 10);
  R(hero.hair, -7, 4, 4, 8);
  R('#000', 2, 7, 3, 4);
  R('#e9a17a', 6, 10, 3, 2);
  R('#3a1f0a', 2, 12, 6, 1);                           // mustache-free smile line
  R(hero.cap, -8, 0, 15, 5); R(hero.cap, 2, 3, 10, 3);
  R('#fff', -3, 1, 5, 3); R(hero.cap, -2, 2, 3, 1);    // the "M" badge
  ctx.restore();
}

/** A Goober: the purple blob enemies. Drawn in a 28x26 box, scaled to (w, h). */
function drawGoober(x, y, w, h, look, flip, crown = false, hurt = false) {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  if (flip) { ctx.translate(0, h); ctx.scale(1, -1); }
  ctx.scale(w / 28, h / 26);
  const step = Math.floor(frameCount / 10) % 2;
  R('#3b1450', 2 + (step ? 3 : 0), 20, 10, 6);
  R('#3b1450', 16 - (step ? 3 : 0), 20, 10, 6);
  ctx.fillStyle = hurt ? '#ffffff' : '#9b59b6';
  ctx.beginPath(); ctx.arc(14, 14, 14, Math.PI, 0); ctx.lineTo(28, 21); ctx.lineTo(0, 21); ctx.fill();
  R('#c39bd3', 6, 6, 4, 4);
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(8, 13, 4.5, 0, Math.PI * 2); ctx.arc(20, 13, 4.5, 0, Math.PI * 2); ctx.fill();
  R('#000', 7 + look * 1.5, 12, 3, 4); R('#000', 19 + look * 1.5, 12, 3, 4);
  ctx.strokeStyle = '#2a0b38'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(3, 6); ctx.lineTo(11, 9); ctx.moveTo(25, 6); ctx.lineTo(17, 9); ctx.stroke();
  if (crown) {
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.moveTo(6, 2); ctx.lineTo(8, -7); ctx.lineTo(11, -1); ctx.lineTo(14, -9); ctx.lineTo(17, -1);
    ctx.lineTo(20, -7); ctx.lineTo(22, 2); ctx.closePath(); ctx.fill();
    R('#e11d48', 13, -3, 2, 2);
  }
  ctx.restore();
}

// ---------------------------------------------------------------- Xbox
// Console browsers scroll the page with the right stick; there's nothing to scroll here.
addEventListener('wheel', e => e.preventDefault(), { passive: false });
if (IS_XBOX) {
  // Edge on Xbox maps the controller's B button to browser Back. Keep an extra
  // history entry on top so Back stays on the game (same trick as Evil One).
  // Browsers ignore entries added without a click or key press, so it's re-armed on real input.
  let guarded = false;
  const guard = () => {
    if (guarded) return;
    try { history.pushState({ superMurilo: true }, ''); guarded = true; } catch (e) {}
  };
  for (const type of ['pointerdown', 'keydown']) addEventListener(type, guard);
  addEventListener('popstate', () => { guarded = false; guard(); });
}

// ---------------------------------------------------------------- difficulty
const DIFFICULTIES = [
  { name: 'EASY',   color: '#4ade80', lives: 9, enemySpeed: 0.7, bossHp: 8,  bossSpeed: 0.8, hurtInv: 180, spillShare: 0.5 },
  { name: 'NORMAL', color: '#facc15', lives: 5, enemySpeed: 1,   bossHp: 12, bossSpeed: 1,   hurtInv: 120, spillShare: 1 },
  { name: 'HARD',   color: '#f87171', lives: 3, enemySpeed: 1.4, bossHp: 16, bossSpeed: 1.25, hurtInv: 90, spillShare: 1 },
];
let difficulty = 1;
try { const d = +localStorage.getItem('superMuriloDifficulty'); if (d >= 0 && d <= 2 && localStorage.getItem('superMuriloDifficulty') !== null) difficulty = d; } catch (e) {}
function setDifficulty(d) {
  difficulty = (d + DIFFICULTIES.length) % DIFFICULTIES.length;
  try { localStorage.setItem('superMuriloDifficulty', String(difficulty)); } catch (e) {}
}
function diff() { return DIFFICULTIES[difficulty]; }
