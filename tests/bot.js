'use strict';
// Test robot: runs a race track with a simple "hold right, jump over trouble" player.
// Load it in the browser console with:
//   const s = document.createElement('script'); s.src = 'tests/bot.js'; document.body.append(s);
// then run:  botRace(0, 'murilo')

function botInput(s, mem) {
  const p = s.p;
  const tx = Math.floor((p.x + p.w / 2) / T), feet = Math.floor((p.y + p.h + 1) / T);
  let jump = false;
  for (const d of [1, 2]) for (let ty = Math.floor(p.y / T); ty <= Math.floor((p.y + p.h - 1) / T); ty++) if (s.solidAt(tx + d, ty)) jump = true;
  if (p.onGround) {
    for (const d of [1, 2]) {
      let ground = false;
      for (let ty = feet; ty < H; ty++) if (s.solidAt(tx + d, ty)) { ground = true; break; }
      if (!ground) jump = true;
    }
  }
  for (const e of s.enemies) {
    if (e.active && !e.dead && !e.flip && !e.squish && e.x > p.x && e.x - p.x < 110 && Math.abs(e.y - p.y) < 60) jump = true;
  }
  // over a pit: ease off so we don't overshoot the next platform
  let pit = true;
  for (let ty = feet; ty < H; ty++) if (s.solidAt(tx, ty)) { pit = false; break; }
  const inp = { left: false, right: true, up: false, down: false, run: !pit, jump: false, jumpP: false, runP: false };
  if (jump && p.onGround && !mem.held) { inp.jump = true; inp.jumpP = true; mem.held = 12; }
  else if (mem.held > 0) { inp.jump = true; mem.held--; }
  else mem.held = 0;
  return inp;
}

function botRace(track, heroKey = 'murilo') {
  const def = RACE_TRACKS[track];
  const st = new Stage(def, { race: true, hero: HEROES[heroKey], wallet: { score: 0, coins: 0, lives: 0 }, slot: 0 });
  st.vw = 425;
  let respawns = 0, hits = 0, f = 0;
  const mem = { held: 0 };
  const fatal = st.fatal.bind(st); st.fatal = () => { respawns++; fatal(); };
  const hurt = st.hurt.bind(st); st.hurt = () => { if (st.p.inv <= 0) hits++; hurt(); };
  const deathsAt = {};
  const fatal2 = st.fatal; st.fatal = () => { const c = Math.floor(st.p.x / T); deathsAt[c] = (deathsAt[c] || 0) + 1; fatal2(); };
  while (st.state !== 'won' && f < 60 * 300) { st.update(botInput(st, mem)); f++; }
  return { track: def.name, hero: heroKey, finished: st.state === 'won', time: fmtTime(st.finishTime ?? f),
           coins: st.wallet.coins, respawns, hits, deathsAt };
}

/** Runs an adventure level (falls send the robot back instead of costing a life). Stops at the boss door. */
function botLevel(i) {
  const def = ADVENTURE[i];
  const st = new Stage(def, { race: true, hero: HEROES.murilo, wallet: { score: 0, coins: 0, lives: 0 }, slot: 0 });
  st.vw = 854;
  let f = 0, hits = 0;
  const mem = { held: 0 }, deathsAt = {};
  const fatal = st.fatal.bind(st); st.fatal = () => { const c = Math.floor(st.p.x / T); deathsAt[c] = (deathsAt[c] || 0) + 1; fatal(); };
  const hurt = st.hurt.bind(st); st.hurt = () => { if (st.p.inv <= 0) hits++; hurt(); };
  while (st.state !== 'won' && f < 60 * 120 && !st.arenaLocked) { st.update(botInput(st, mem)); f++; }
  return { level: def.name, reachedEnd: st.state === 'won' || st.arenaLocked, time: fmtTime(f), hits, deathsAt };
}

/** Button-mashing test: random inputs for a long time on every level and track; reports crashes or broken numbers. */
function fuzzAll(frames = 6000, seed = 1) {
  const r = mulberry32(seed);
  const problems = [];
  const defs = [...ADVENTURE.map(d => [d, false]), ...RACE_TRACKS.map(d => [d, true])];
  for (const [def, isRace] of defs) {
    for (const heroKey of isRace ? ['murilo', 'maher'] : ['murilo']) {
      for (const power of isRace ? [0] : [0, 1, 2, 3]) {
        const st = new Stage(def, { race: isRace, hero: HEROES[heroKey], wallet: { score: 0, coins: 0, lives: 3 }, power, slot: 0 });
        st.vw = 640;
        let held = { left: false, right: true, jump: false, run: false }, prev = {};
        try {
          for (let f = 0; f < frames; f++) {
            if (f % 8 === 0) held = { left: r() < 0.2, right: r() < 0.75, jump: r() < 0.35, run: r() < 0.5 };
            const inp = { ...held, up: false, down: false, jumpP: held.jump && !prev.jump, runP: held.run && !prev.run };
            prev = held;
            st.update(inp);
            const p = st.p;
            if (![p.x, p.y, p.vx, p.vy].every(Number.isFinite)) { problems.push(`${def.name}/${heroKey}/p${power}: bad numbers at frame ${f}`); break; }
            if (st.state === 'play' && (p.x < -1 || p.x > def.width * T)) { problems.push(`${def.name}: left the level at frame ${f} (x=${p.x})`); break; }
            if (st.state === 'play' && st.solidAt(Math.floor((p.x + p.w / 2) / T), Math.floor((p.y + p.h / 2) / T)) && p.y > 0) {
              problems.push(`${def.name}/${heroKey}/p${power}: stuck inside a block at frame ${f} (tile ${Math.floor((p.x + p.w / 2) / T)},${Math.floor((p.y + p.h / 2) / T)})`); break;
            }
            if (st.state === 'dead' || st.state === 'won') break;
          }
        } catch (e) { problems.push(`${def.name}/${heroKey}/p${power}: CRASH ${e.message}`); }
      }
    }
  }
  return problems;
}
