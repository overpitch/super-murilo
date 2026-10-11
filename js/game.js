'use strict';
// =====================================================================
//  Game flow: title → (adventure: map ⇄ levels) or (race: pick track → split-screen race → results)
// =====================================================================

let scene = 'title', sceneT = 0, paused = false, menuSel = 0;
let titleStage = null;
let best = 0;
try { best = +localStorage.getItem('superMuriloBest') || 0; } catch (e) {}
function saveBest(score) {
  if (score > best) { best = score; try { localStorage.setItem('superMuriloBest', String(best)); } catch (e) {} }
}

const adv = {
  wallet: { score: 0, coins: 0, lives: 5 },
  power: 0, cleared: 0, node: 0, levelIdx: 0, stage: null,
  started: false,       // an adventure is in progress (the title screen goes back to it)
  walk: null,            // { from, to, t } while Murilo walks on the map
};
const race = { track: 0, stages: [], wallets: [], order: [], endT: 0, goT: 0, results: null };

function go(next, t = 0) { scene = next; sceneT = t; paused = false; }

// ---------------------------------------------------------------- update
function update() {
  frameCount++;
  const twoP = scene === 'countdown' || scene === 'race';
  const I = pollInput(twoP);
  const g = I.any;
  if (g.confirmP) initAudio();   // on Xbox a controller press may be the only way to unlock sound
  if (sceneT > 0) sceneT--;

  switch (scene) {
    case 'title': {
      if (g.upP || g.downP) { menuSel = 1 - menuSel; sfx.select(); }
      if (g.confirmP) {
        initAudio(); sfx.select();
        if (menuSel === 0) { if (adv.started) go('map'); else newAdventure(); } else go('raceSelect');
      }
      break;
    }

    // ---------------- adventure
    case 'map': updateMap(g); break;
    case 'intro':
      if (sceneT <= 0) {
        adv.stage = new Stage(ADVENTURE[adv.levelIdx], { hero: HEROES.murilo, wallet: adv.wallet, power: adv.power });
        go('level');
      }
      break;
    case 'level': {
      if (g.pauseP) { paused = !paused; sfx.pause(); }
      if (paused) { if (g.quitP) { adv.power = adv.stage.p.power; go('map'); } break; }
      const s = adv.stage;
      s.vw = VW;
      s.update(I.p[0]);
      if (s.state === 'dead') {
        adv.wallet.lives--; adv.power = 0;
        if (adv.wallet.lives <= 0) { saveBest(adv.wallet.score); go('gameover', 90); }
        else go('map');
      } else if (s.state === 'won') {
        adv.power = s.p.power;
        const first = adv.levelIdx >= adv.cleared;
        adv.cleared = Math.max(adv.cleared, adv.levelIdx + 1);
        if (adv.levelIdx === ADVENTURE.length - 1) { saveBest(adv.wallet.score); adv.started = false; go('ending', 120); }
        else {
          go('map');
          if (first) adv.walk = { from: adv.node, to: adv.node + 1, t: 0 };   // walk on to the next dot
        }
      }
      break;
    }
    case 'gameover':
      if (sceneT <= 0 && g.confirmP) { adv.wallet.lives = 5; adv.wallet.coins = 0; go('map'); }
      break;
    case 'ending':
      if (sceneT <= 0 && g.confirmP) go('title');
      break;

    // ---------------- race
    case 'raceSelect':
      if (g.upP || g.downP || g.leftP || g.rightP) { race.track = 1 - race.track; sfx.select(); }
      if (g.confirmP) startRace();
      if (g.backP) go('title');
      break;
    case 'countdown':
      if (sceneT % 60 === 0 && sceneT > 0) sfx.count();
      if (sceneT <= 0) { sfx.go(); race.goT = 60; go('race'); }
      break;
    case 'race': {
      if (g.pauseP) { paused = !paused; sfx.pause(); }
      if (paused) { if (g.quitP) go('raceSelect'); break; }
      if (race.goT > 0) race.goT--;
      const half = halfW();
      race.stages.forEach((s, i) => {
        s.vw = half;
        s.update(I.p[i]);
        if (s.finishTime !== null && !race.order.includes(i)) {
          race.order.push(i);
          rumble(i, 400, race.order.length === 1 ? 1 : 0.5);
        }
      });
      if (race.stages.every(s => s.state === 'won')) {
        if (!race.endT) race.endT = 60;
        else if (--race.endT <= 0) { race.results = raceResults(); sfx.win(); go('results', 60); }
      }
      break;
    }
    case 'results':
      if (sceneT <= 0 && g.confirmP) startRace();
      if (sceneT <= 0 && g.backP) go('raceSelect');
      break;
  }
}

// ---------------------------------------------------------------- adventure
function newAdventure() {
  adv.wallet = { score: 0, coins: 0, lives: 5 };
  adv.power = 0; adv.cleared = 0; adv.node = 0; adv.walk = null;
  adv.started = true;
  go('map');
}

function nodePos(i) { return { x: VW / 2 + MAP_NODES[i].dx, y: MAP_NODES[i].y }; }

function updateMap(g) {
  if (adv.walk) {
    adv.walk.t += 0.025;
    if (adv.walk.t >= 1) { adv.node = adv.walk.to; adv.walk = null; }
    return;
  }
  const maxNode = Math.min(adv.cleared, MAP_NODES.length - 1);
  if ((g.rightP || g.upP) && adv.node < maxNode) { adv.walk = { from: adv.node, to: adv.node + 1, t: 0 }; sfx.select(); }
  else if ((g.leftP || g.downP) && adv.node > 0) { adv.walk = { from: adv.node, to: adv.node - 1, t: 0 }; sfx.select(); }
  else if (g.confirmP) { adv.levelIdx = adv.node; sfx.select(); go('intro', 100); }
  else if (g.backP) go('title');
}

// ---------------------------------------------------------------- race
function halfW() { return Math.floor(VW / 2) - 2; }

function startRace() {
  const def = RACE_TRACKS[race.track];
  race.wallets = [{ score: 0, coins: 0, lives: 0 }, { score: 0, coins: 0, lives: 0 }];
  race.stages = [
    new Stage(def, { race: true, hero: HEROES.murilo, wallet: race.wallets[0], slot: 0 }),
    new Stage(def, { race: true, hero: HEROES.maher, wallet: race.wallets[1], slot: 1 }),
  ];
  race.stages.forEach(s => { s.vw = halfW(); s.updateCamera(); });
  race.order = []; race.endT = 0; race.results = null;
  sfx.count();
  go('countdown', 180);
}

/** Points: a big bonus for finishing first, a bonus for a fast time, and 100 per coin. */
function raceResults() {
  const rows = race.stages.map((s, i) => {
    const firstB = race.order[0] === i ? 5000 : 0;
    const secs = s.finishTime / 60;
    const timeB = Math.max(0, Math.round((150 - secs) * 50));
    const coins = race.wallets[i].coins;
    const coinB = coins * 100;
    return { name: s.hero.name, color: s.hero.cap, time: s.finishTime, firstB, timeB, coins, coinB, total: firstB + timeB + coinB };
  });
  const winner = rows[0].total > rows[1].total ? 0 : rows[1].total > rows[0].total ? 1 : -1;
  return { rows, winner };
}

// ---------------------------------------------------------------- drawing
function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  switch (scene) {
    case 'title': drawTitle(); break;
    case 'map': drawMap(); break;
    case 'intro': drawIntro(); break;
    case 'level': adv.stage.draw(VW); drawAdvHUD(); if (paused) drawPause('START: KEEP PLAYING', 'VIEW / BACKSPACE: LEAVE LEVEL'); break;
    case 'gameover': drawGameOver(); break;
    case 'ending': drawEnding(); break;
    case 'raceSelect': drawRaceSelect(); break;
    case 'countdown': case 'race': drawRace(); if (paused) drawPause('START: KEEP RACING', 'VIEW / BACKSPACE: QUIT RACE'); break;
    case 'results': drawRace(false); drawResults(); break;
  }
}

function blink() { return (frameCount >> 5) % 2 === 0; }

function drawPause(a, b) {
  R('rgba(0,0,0,0.55)', 0, 0, VW, VH);
  text('PAUSED', VW / 2, VH / 2 - 50, 24, '#fff');
  text(a, VW / 2, VH / 2 + 4, 10, '#ffd700');
  text(b, VW / 2, VH / 2 + 26, 10, '#ccc');
}

function drawTitle() {
  if (!titleStage) titleStage = new Stage(ADVENTURE[0], { hero: HEROES.murilo, wallet: { score: 0, coins: 0, lives: 0 } });
  titleStage.cam = (frameCount * 0.6) % (100 * T);
  titleStage.p.hidden = true;
  titleStage.draw(VW);
  R('rgba(0,0,0,0.35)', 0, 0, VW, VH);
  text('SUPER', VW / 2, 50, 20, '#fff');
  textFit('MURILO', VW / 2 - 4, 80, 40, '#ff4d4d', VW * 0.6);
  text('&', VW / 2, 128, 16, '#fff');
  textFit('MAHER', VW / 2 - 4, 150, 40, '#4ade80', VW * 0.6);
  const bob = Math.sin(frameCount * 0.1) * 3;
  drawHero(HEROES.murilo, VW / 2 - 70, 208 + bob, 22, 28, 1, 'stand', 0);
  drawHero(HEROES.maher, VW / 2 + 48, 204 - bob, 22, 32, -1, 'stand', 0);

  const opts = [adv.started ? 'CONTINUE ADVENTURE' : '1 PLAYER ADVENTURE', '2 PLAYER RACE'];
  opts.forEach((o, i) => {
    const y = 270 + i * 34, sel = i === menuSel;
    if (sel) R('rgba(0,0,0,0.45)', VW / 2 - 190, y - 8, 380, 30);
    text((sel ? '> ' : '  ') + o, VW / 2, y, 14, sel ? '#ffd700' : '#fff');
  });
  if (blink()) text('PRESS A OR ENTER', VW / 2, 352, 10, '#fff');
  if (IS_XBOX) text('XBOX: HOLD THE MENU BUTTON TO USE THE CONTROLLER', VW / 2, 380, 8, '#aef');
  else text('F = FULL SCREEN', VW / 2, 380, 8, '#ccc');
  if (best) text('BEST ADVENTURE SCORE ' + best, VW / 2, 404, 8, '#aaf');
  text('A GAME BY MURILO', VW / 2, VH - 28, 10, '#fff');
}

// ---------------- world map
function drawMap() {
  // sea
  R('#1e6fd9', 0, 0, VW, VH);
  for (let i = 0; i < 40; i++) {
    const x = (i * 137 + frameCount * 0.3) % (VW + 40) - 20, y = 20 + (i * 53) % (VH - 40);
    R('rgba(255,255,255,0.25)', x, y + Math.sin(frameCount * 0.05 + i) * 2, 14, 2);
  }
  // island
  const cx = VW / 2;
  ctx.fillStyle = '#f3d98b';
  ctx.beginPath(); ctx.ellipse(cx, 270, 300, 190, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#4cc23a';
  ctx.beginPath(); ctx.ellipse(cx, 268, 282, 172, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#3fa832';
  ctx.beginPath(); ctx.ellipse(cx - 120, 200, 80, 40, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx + 60, 380, 90, 35, 0, 0, Math.PI * 2); ctx.fill();
  // hills and trees
  for (const [dx, y, r] of [[-40, 180, 34], [110, 300, 28], [-230, 250, 24], [230, 300, 22]]) {
    ctx.fillStyle = '#2e8b3a'; ctx.beginPath(); ctx.arc(cx + dx, y, r, Math.PI, 0); ctx.fill();
  }
  for (const [dx, y] of [[-150, 330], [-120, 345], [120, 250], [150, 262], [-20, 380], [0, 390], [250, 220], [-260, 300]]) {
    R('#6b3e1f', cx + dx - 2, y, 4, 10);
    ctx.fillStyle = '#1f7a2a'; ctx.beginPath(); ctx.arc(cx + dx, y - 4, 10, 0, Math.PI * 2); ctx.fill();
  }
  // paths
  for (let i = 0; i < MAP_NODES.length - 1; i++) {
    if (adv.cleared <= i) continue;
    const a = nodePos(i), b = nodePos(i + 1);
    for (let t = 0; t <= 1; t += 0.06) R('#f5e6b0', a.x + (b.x - a.x) * t - 3, a.y + (b.y - a.y) * t - 3, 6, 6);
  }
  // level dots
  MAP_NODES.forEach((n, i) => {
    const p = nodePos(i);
    const open = i <= adv.cleared, done = i < adv.cleared;
    if (n.castle) {
      const col = open ? '#8a8a99' : '#555';
      R(col, p.x - 22, p.y - 40, 44, 40);
      for (let k = 0; k < 3; k++) R(col, p.x - 22 + k * 17, p.y - 48, 10, 8);
      R('#2a1208', p.x - 7, p.y - 18, 14, 18);
      ctx.fillStyle = done ? '#22c55e' : '#e11d48';
      ctx.beginPath(); ctx.moveTo(p.x, p.y - 64); ctx.lineTo(p.x + 16, p.y - 58); ctx.lineTo(p.x, p.y - 52); ctx.fill();
      R('#333', p.x - 1, p.y - 64, 2, 16);
    } else {
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(p.x, p.y + 2, 16, 10, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = !open ? '#777' : done ? '#3b82f6' : '#facc15';
      ctx.beginPath(); ctx.ellipse(p.x, p.y, 14, 8, 0, 0, Math.PI * 2); ctx.fill();
    }
  });
  // Murilo
  let pos = nodePos(adv.node), walking = false, face = 1;
  if (adv.walk) {
    const a = nodePos(adv.walk.from), b = nodePos(adv.walk.to);
    pos = { x: a.x + (b.x - a.x) * adv.walk.t, y: a.y + (b.y - a.y) * adv.walk.t };
    walking = true; face = b.x >= a.x ? 1 : -1;
  }
  const hop = walking ? Math.abs(Math.sin(frameCount * 0.3)) * 4 : Math.abs(Math.sin(frameCount * 0.08)) * 2;
  drawHero(HEROES.murilo, pos.x - 11, pos.y - 30 - hop, 22, 28, face, walking ? 'run' : 'stand', (frameCount >> 3) % 2, adv.power);

  // banner
  R('rgba(0,0,0,0.6)', 0, 0, VW, 54);
  text('WORLD 1  GOOBER ISLAND', VW / 2, 10, 12, '#fff');
  text(`LIVES x${adv.wallet.lives}   COINS x${adv.wallet.coins}   SCORE ${adv.wallet.score}`, VW / 2, 32, 8, '#ffd700');
  R('rgba(0,0,0,0.6)', 0, VH - 50, VW, 50);
  if (!adv.walk) {
    text(ADVENTURE[adv.node].name, VW / 2, VH - 42, 12, '#fff');
    text('A: PLAY    STICK: MOVE    B: TITLE', VW / 2, VH - 20, 8, '#ccc');
  }
}

function drawIntro() {
  R('#000', 0, 0, VW, VH);
  text(ADVENTURE[adv.levelIdx].name, VW / 2, VH / 2 - 70, 16, '#fff');
  drawHero(HEROES.murilo, VW / 2 - 50, VH / 2 - 10, 22, 28, 1, 'stand', 0);
  text('x ' + adv.wallet.lives, VW / 2 - 10, VH / 2, 16, '#fff', 'left');
  if (adv.levelIdx === ADVENTURE.length - 1) text('THE GOOBER KING AWAITS...', VW / 2, VH / 2 + 60, 10, '#ff6b6b');
}

function drawAdvHUD() {
  const s = adv.stage, w = adv.wallet;
  const pad = 20, col = (VW - pad * 2) / 4;
  text('MURILO', pad, 12, 11, '#ff6b6b', 'left');
  text(String(w.score).padStart(6, '0'), pad, 30, 11, '#fff', 'left');
  text('COINS', pad + col, 12, 11, '#fff', 'left');
  text('x' + String(w.coins).padStart(2, '0'), pad + col, 30, 11, '#ffd700', 'left');
  text('WORLD', pad + col * 2, 12, 11, '#fff', 'left');
  text(s.def.name.split(' ')[0], pad + col * 2, 30, 11, '#fff', 'left');
  text('LIVES', pad + col * 3, 12, 11, '#fff', 'left');
  text('x' + w.lives, pad + col * 3, 30, 11, '#ff6b6b', 'left');
  const p = s.p;
  const hint = p.power === 2 ? 'X: THROW FIREBALL' : p.power === 3 ? (p.pmeter >= 60 ? 'FLY! JUMP AND HOLD A' : 'RUN FAST, THEN JUMP TO FLY') : '';
  if (hint && (p.power !== 3 || p.pmeter < 60 || blink())) text(hint, VW / 2, 52, 8, p.pmeter >= 60 ? '#facc15' : '#ddd');
  const B = s.boss;
  if (B && !B.dead) {
    text('GOOBER KING', VW / 2, 70, 10, '#fff');
    const bw = 200;
    R('#000', VW / 2 - bw / 2 - 2, 86, bw + 4, 12);
    R('#e11d48', VW / 2 - bw / 2, 88, bw * Math.max(0, B.hp) / 12, 8);
  }
}

function drawGameOver() {
  R('#000', 0, 0, VW, VH);
  text('GAME OVER', VW / 2, VH / 2 - 50, 26, '#ff4d4d');
  text('SCORE ' + adv.wallet.score, VW / 2, VH / 2, 14, '#fff');
  if (sceneT <= 0 && blink()) text('PRESS A: TRY AGAIN WITH 5 LIVES', VW / 2, VH / 2 + 50, 10, '#ffd700');
}

function drawEnding() {
  adv.stage.draw(VW);
  R('rgba(0,0,0,0.55)', 0, 0, VW, VH);
  text('YOU BEAT THE', VW / 2, 90, 16, '#fff');
  text('GOOBER KING!', VW / 2, 120, 28, '#ffd700');
  drawHero(HEROES.murilo, VW / 2 - 11, 180 - Math.abs(Math.sin(frameCount * 0.12)) * 20, 22, 28, 1, 'air', 0);
  text('GOOBER ISLAND IS SAVED', VW / 2, 240, 12, '#fff');
  text('SCORE ' + adv.wallet.score, VW / 2, 280, 14, '#fff');
  text('BEST  ' + best, VW / 2, 306, 10, '#aaf');
  text('MORE WORLDS COMING SOON...', VW / 2, 350, 10, '#4ade80');
  if (sceneT <= 0 && blink()) text('PRESS A', VW / 2, 390, 12, '#ffd700');
}

// ---------------- race screens
function drawRaceSelect() {
  if (!titleStage) titleStage = new Stage(ADVENTURE[0], { hero: HEROES.murilo, wallet: { score: 0, coins: 0, lives: 0 } });
  titleStage.cam = (frameCount * 2) % (100 * T);
  titleStage.p.hidden = true;
  titleStage.draw(VW);
  R('rgba(0,0,0,0.72)', 0, 0, VW, VH);
  text('2 PLAYER RACE', VW / 2, 40, 22, '#fff');
  text('CHOOSE A TRACK', VW / 2, 80, 10, '#ccc');
  const tracks = [['GREEN DASH', 'NORMAL', '#4ade80'], ['SUNSET RUSH', 'HARD', '#fb7185']];
  tracks.forEach(([name, diff, col], i) => {
    const y = 120 + i * 50, sel = i === race.track;
    R(sel ? 'rgba(255,215,0,0.25)' : 'rgba(255,255,255,0.08)', VW / 2 - 200, y - 10, 400, 40);
    text((sel ? '> ' : '') + name, VW / 2 - 180, y, 14, sel ? '#ffd700' : '#fff', 'left');
    text(diff, VW / 2 + 180, y + 4, 10, col, 'right');
  });
  const cx1 = VW / 4, cx2 = VW * 3 / 4;
  drawHero(HEROES.murilo, cx1 - 11, 250, 22, 28, 1, 'stand', 0);
  drawHero(HEROES.maher, cx2 - 11, 246, 22, 32, -1, 'stand', 0);
  text('P1 MURILO', cx1, 290, 10, '#ff6b6b');
  text('CONTROLLER 1', cx1, 308, 8, '#fff');
  text('OR ARROWS, UP=JUMP', cx1, 322, 8, '#aaa');
  text('P2 MAHER', cx2, 290, 10, '#4ade80');
  text('CONTROLLER 2', cx2, 308, 8, '#fff');
  text('OR A/D, W=JUMP', cx2, 322, 8, '#aaa');
  const n = padList().length;
  text(n >= 2 ? '2 CONTROLLERS READY!' : `${n} CONTROLLER${n === 1 ? '' : 'S'} CONNECTED`, VW / 2, 352, 10, n >= 2 ? '#4ade80' : '#facc15');
  text('MOST POINTS WINS: FINISH FIRST + FAST TIME + COINS', VW / 2, 380, 8, '#fff');
  if (blink()) text('PRESS A TO RACE    B: BACK', VW / 2, 410, 10, '#ffd700');
}

function drawRace(banners = true) {
  const half = halfW();
  race.stages.forEach((s, i) => {
    const x0 = i === 0 ? 0 : VW - half;
    ctx.save();
    ctx.beginPath(); ctx.rect(x0, 0, half, VH); ctx.clip();
    ctx.translate(x0, 0);
    s.draw(half);
    drawRaceHUD(s, i, half, banners);
    ctx.restore();
  });
  R('#111', half, 0, VW - half * 2, VH);
  R('#fff', VW / 2 - 1, 0, 2, VH);

  const size = 48;
  if (scene === 'countdown') {
    const n = Math.ceil(sceneT / 60);
    for (const cx of [half / 2, VW - half / 2]) text(String(n), cx, VH / 2 - 60, size, '#ffd700');
  } else if (race.goT > 0) {
    for (const cx of [half / 2, VW - half / 2]) text('GO!', cx, VH / 2 - 60, size, '#4ade80');
  }
}

function drawRaceHUD(s, i, w, banners) {
  text(s.hero.name, 12, 10, 10, i === 0 ? '#ff6b6b' : '#4ade80', 'left');
  text('COINS x' + race.wallets[i].coins, 12, 28, 9, '#ffd700', 'left');
  // each player's own clock: it stops when you finish
  const t = s.finishTime !== null ? s.finishTime : s.clock;
  R('rgba(0,0,0,0.45)', w - 124, 6, 118, 26);
  text(fmtTime(t), w - 12, 12, 12, s.finishTime !== null ? '#4ade80' : '#fff', 'right');
  if (s.finishTime !== null && banners) {
    const place = race.order.indexOf(i) + 1;
    R('rgba(0,0,0,0.5)', 0, 120, w, 110);
    text('FINISH!', w / 2, 132, 22, '#ffd700');
    text(place === 1 ? '1ST PLACE!' : '2ND PLACE', w / 2, 168, 14, place === 1 ? '#4ade80' : '#fff');
    text(fmtTime(s.finishTime), w / 2, 196, 14, '#fff');
    if (race.order.length < 2 && blink()) text('WAITING FOR THE OTHER RACER...', w / 2, 240, 7, '#fff');
  }
}

function drawResults() {
  const r = race.results;
  R('rgba(0,0,0,0.85)', 0, 0, VW, VH);
  const title = r.winner === -1 ? "IT'S A TIE!" : r.rows[r.winner].name + ' WINS!';
  text(title, VW / 2, 34, 22, r.winner === -1 ? '#fff' : r.rows[r.winner].color === '#e52521' ? '#ff6b6b' : '#4ade80');
  const cols = [VW / 4, VW * 3 / 4];
  r.rows.forEach((row, i) => {
    const cx = cols[i], col = i === 0 ? '#ff6b6b' : '#4ade80';
    text(row.name, cx, 90, 14, col);
    text('TIME ' + fmtTime(row.time), cx, 122, 9, '#fff');
    text('FINISHED FIRST  ' + row.firstB, cx, 150, 8, row.firstB ? '#ffd700' : '#888');
    text('FAST TIME       ' + row.timeB, cx, 172, 8, '#fff');
    text(`COINS (${row.coins})     ` + row.coinB, cx, 194, 8, '#fff');
    R('#fff', cx - 100, 214, 200, 2);
    text('TOTAL ' + row.total, cx, 226, 14, i === r.winner ? '#ffd700' : '#fff');
    if (i === r.winner) {
      const hop = Math.abs(Math.sin(frameCount * 0.12)) * 16;
      drawHero(race.stages[i].hero, cx - 11, 290 - hop, 22, race.stages[i].hero.h, 1, 'air', 0);
      text('WINNER!', cx, 330, 10, '#ffd700');
    } else {
      drawHero(race.stages[i].hero, cx - 11, 294 - race.stages[i].hero.h + 28, 22, race.stages[i].hero.h, 1, 'stand', 0);
    }
  });
  if (sceneT <= 0 && blink()) text('A: RACE AGAIN     B: CHOOSE TRACK', VW / 2, 400, 10, '#ffd700');
}

// ---------------------------------------------------------------- main loop
let last = performance.now(), acc = 0;
const STEP = 1000 / 60;
function frame(now) {
  acc += Math.min(100, now - last);
  last = now;
  while (acc >= STEP) { update(); acc -= STEP; }
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
