'use strict';
// =====================================================================
//  Stage: one hero playing one level. The adventure uses one stage;
//  the race uses two (one for each half of the screen) that never touch.
// =====================================================================

const SOLID = new Set(['#', 'B', '?', 'U', 'S', 'P', 'Q', 'G', 'K', '^', '>']);
const BIG_H = 50;

function makeEnemy(tx, ty, speed = 1.1) {
  return { x: tx * T + 2, y: (ty + 1) * T - 26, w: 28, h: 26, vx: -speed, vy: 0,
           active: false, squish: 0, flip: false, dead: false };
}
const enemyAlive = e => e.active && !e.dead && !e.flip && !e.squish;

class Stage {
  /** opts: { race, hero, wallet: {score, coins, lives}, power, slot } */
  constructor(def, opts) {
    this.def = def;
    this.race = !!opts.race;
    this.slot = opts.slot || 0;
    this.hero = opts.hero;
    this.wallet = opts.wallet;
    this.theme = THEMES[def.theme];
    this.diff = diff();                        // the difficulty when this level started
    this.espeed = 1.1 * this.diff.enemySpeed;  // how fast Goobers walk
    this.width = def.width;
    this.grid = def.g.map(r => r.slice());
    this.enemies = def.enemyStarts.map(s => makeEnemy(s.x, s.y, this.espeed));
    this.items = []; this.fireballs = []; this.particles = []; this.bumps = []; this.spills = [];
    this.cam = 0; this.vw = VW; this.flagY = 2.5 * T; this.shake = 0;
    this.state = 'play';   // play → dying → dead   |   play → clear/bossdown → won
    this.timer = 0;
    this.clock = 0; this.finishTime = null;
    this.checkX = def.start.x; this.checksOn = new Set();
    this.boss = null; this.arenaLocked = false;
    this.p = { x: def.start.x * T, y: 0, w: 22, h: this.hero.h, vx: 0, vy: 0, face: 1, onGround: true,
               coyote: 0, buffer: 0, anim: 0, inv: 0, stun: 0, power: 0, pmeter: 0, flying: 0, boost: 0,
               hidden: false, prevBottom: 0, combo: 0, jumpHeld: false };
    this.setPower(opts.power || 0, true);
    this.p.y = 13 * T - this.p.h;
  }

  // ------------------------------------------------------------ level helpers
  tileAt(tx, ty) {
    if (ty < 0 || ty >= H || tx < 0 || tx >= this.width) return ' ';
    return this.grid[ty][tx];
  }
  solidAt(tx, ty) {
    if (tx < 0 || tx >= this.width) return true;       // invisible walls at the level's ends
    if (ty < 0 || ty >= H) return false;
    return SOLID.has(this.grid[ty][tx]);
  }

  /** Moves something through the level, stopping it at walls and floors. Returns true if it hit a wall. */
  moveEntity(e, onHeadHit) {
    let hitWall = false;
    e.x += e.vx;
    const top = Math.floor(e.y / T), bot = Math.floor((e.y + e.h - 0.01) / T);
    if (e.vx > 0) {
      const tx = Math.floor((e.x + e.w - 0.01) / T);
      for (let ty = top; ty <= bot; ty++) if (this.solidAt(tx, ty)) { e.x = tx * T - e.w; e.vx = 0; hitWall = true; break; }
    } else if (e.vx < 0) {
      const tx = Math.floor(e.x / T);
      for (let ty = top; ty <= bot; ty++) if (this.solidAt(tx, ty)) { e.x = (tx + 1) * T; e.vx = 0; hitWall = true; break; }
    }
    e.y += e.vy;
    e.onGround = false;
    const l = Math.floor(e.x / T), r = Math.floor((e.x + e.w - 0.01) / T);
    if (e.vy > 0) {
      const ty = Math.floor((e.y + e.h) / T);
      for (let tx = l; tx <= r; tx++) if (this.solidAt(tx, ty)) { e.y = ty * T - e.h; e.vy = 0; e.onGround = true; break; }
    } else if (e.vy < 0) {
      const ty = Math.floor(e.y / T);
      const hits = [];
      for (let tx = l; tx <= r; tx++) if (this.solidAt(tx, ty)) hits.push(tx);
      if (hits.length) {
        e.y = (ty + 1) * T; e.vy = 0;
        if (onHeadHit) {
          const cx = Math.floor((e.x + e.w / 2) / T);
          onHeadHit(hits.includes(cx) ? cx : hits[0], ty);
        }
      }
    }
    return hitWall;
  }

  setPower(n, init = false) {
    const p = this.p;
    const oldH = p.h, oldW = p.w;
    p.power = n;
    p.h = n > 0 ? BIG_H : this.hero.h;
    p.w = n > 0 ? 26 : 22;
    if (!init) { p.y += oldH - p.h; p.x -= (p.w - oldW) / 2; }
  }

  addScore(n, x, y) {
    this.wallet.score += n;
    if (x !== undefined) this.particles.push({ type: 'text', text: String(n), x, y, vy: -1.2, life: 45 });
  }
  getCoin() {
    this.wallet.coins++;
    sfx.coin();
    if (!this.race && this.wallet.coins >= 100) {
      this.wallet.coins -= 100; this.wallet.lives++; sfx.oneup();
      this.particles.push({ type: 'text', text: '1UP', x: this.p.x, y: this.p.y - 10, vy: -1, life: 60 });
    }
  }

  // ------------------------------------------------------------ update
  update(inp) {
    if (this.shake > 0) this.shake--;
    if (this.state === 'play') {
      if (this.race) this.clock++;
      this.updatePlayer(inp || NO_INPUT);
    } else if (this.state === 'dying') {
      const p = this.p;
      p.vy = Math.min(p.vy + 0.5, 12); p.y += p.vy;
      if (--this.timer <= 0) this.state = 'dead';
    } else if (this.state === 'clear') {
      this.updateClear();
    } else if (this.state === 'bossdown') {
      if (--this.timer <= 0) this.state = 'won';
    }
    if (this.state !== 'dying' && this.state !== 'dead') { this.updateEnemies(); this.updateBoss(); }
    this.updateItems(); this.updateFireballs(); this.updateSpills(); this.updateParticles();
    this.updateCamera();
  }

  updatePlayer(inp) {
    const p = this.p, hero = this.hero;
    if (p.inv > 0) p.inv--;
    if (p.stun > 0) { p.stun--; inp = NO_INPUT; }
    if (p.boost > 0) p.boost--;

    // running
    const max = p.boost > 0 ? 10 : inp.run ? 6.5 : 4.5;
    const acc = p.onGround ? 0.35 : 0.25;
    const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    if (dir) {
      p.face = dir;
      const sp = p.vx * dir;
      if (sp < max) p.vx = Math.min(max, sp + (sp < 0 ? acc * 2 : acc)) * dir;
      else p.vx = Math.max(max, sp - 0.15) * dir;
    } else if (p.boost <= 0) {
      const f = p.onGround ? 0.3 * hero.grip : 0.08;
      p.vx = Math.abs(p.vx) <= f ? 0 : p.vx - Math.sign(p.vx) * f;
    }
    if (p.onGround) p.pmeter = Math.abs(p.vx) >= 6.2 ? Math.min(60, p.pmeter + 1) : Math.max(0, p.pmeter - 2);

    // jumping (with a little forgiveness so it feels good)
    p.coyote = p.onGround ? 6 : Math.max(0, p.coyote - 1);
    p.buffer = inp.jumpP ? 6 : Math.max(0, p.buffer - 1);
    if (p.buffer > 0 && p.coyote > 0) {
      p.vy = -(hero.jump + Math.abs(p.vx) * 0.25);
      p.buffer = 0; p.coyote = 0;
      if (p.power === 3 && p.pmeter >= 60) p.flying = 110;   // running start + cape = take off!
      sfx.jump();
    }
    const cape = p.power === 3;
    if (cape && p.flying > 0 && inp.jump && !p.onGround) {
      p.vy = Math.max(p.vy - 1.1, -6.5);
      p.flying--;
      if (Math.abs(p.vx) < 5.5) p.vx = p.face * 5.5;
      if (frameCount % 10 === 0) sfx.flap();
    } else if (!inp.jump && p.vy < -5) {
      p.vy = -5;                                              // let go early = smaller jump
    }
    p.vy = Math.min(p.vy + 0.6, 14);
    if (cape && !p.onGround && inp.jump && p.vy > 1.6) {      // glide
      p.vy = 1.6;
      if (frameCount % 14 === 0) sfx.flap();
    }
    p.jumpHeld = inp.jump;

    // fireballs
    if (p.power === 2 && inp.runP && this.fireballs.length < 2) {
      this.fireballs.push({ x: p.x + (p.face > 0 ? p.w : -10), y: p.y + 16, w: 10, h: 10, vx: p.face * 7, vy: 2, life: 150 });
      sfx.fire();
    }

    p.prevBottom = p.y + p.h;
    this.moveEntity(p, (tx, ty) => this.hitBlock(tx, ty));
    if (p.y < -8) { p.y = -8; if (p.vy < 0) p.vy = 0; }       // invisible ceiling: stay on screen
    if (p.onGround) { p.combo = 0; p.flying = 0; }
    p.anim += Math.abs(p.vx) > 0.3 ? Math.abs(p.vx) * 0.025 : 0;

    // springs and speed boosts under your feet
    if (p.onGround) {
      const tx = Math.floor((p.x + p.w / 2) / T), ty = Math.floor((p.y + p.h + 1) / T);
      const under = this.tileAt(tx, ty);
      if (under === '^') {
        p.vy = -19; p.onGround = false; p.coyote = 0;   // no normal jump on top of the spring's launch
        this.bumps.push({ tx, ty, t: 10 });
        sfx.spring(); rumble(this.slot, 80, 0.3);
      } else if (under === '>') {
        if (p.boost < 50) sfx.boost();
        p.boost = 70; p.face = 1; p.vx = 10;
      }
    }

    // coins, checkpoints and lava you're touching
    const l = Math.floor(p.x / T), r = Math.floor((p.x + p.w - 0.01) / T);
    const t = Math.floor(p.y / T), b = Math.floor((p.y + p.h - 0.01) / T);
    for (let ty = t; ty <= b; ty++) for (let tx = l; tx <= r; tx++) {
      const c = this.tileAt(tx, ty);
      if (c === 'C') { this.grid[ty][tx] = ' '; this.getCoin(); this.wallet.score += 100; }
      else if (c === '!' && !this.checksOn.has(tx)) {
        this.checksOn.add(tx); this.checkX = tx; sfx.check();
        this.particles.push({ type: 'text', text: 'CHECKPOINT', x: tx * T - 30, y: 10 * T, vy: -0.8, life: 70 });
      } else if (c === 'L') { this.fatal(); return; }
    }

    if (p.y > VH + 40) { this.fatal(); return; }

    // the flag
    if (this.def.flag > 0 && p.x + p.w >= this.def.flag * T - 2) { this.startClear(); return; }

    // the boss's throne room: the door slams shut behind you
    const bd = this.def.boss;
    if (bd && !this.arenaLocked && p.x > (bd.arenaX + 1) * T) {
      this.arenaLocked = true;
      for (let y = 1; y < 13; y++) this.grid[y][bd.arenaX] = 'S';
      this.boss = { x: bd.x * T, y: 13 * T - 68, w: 76, h: 68, vx: -1.5, vy: 0, hp: this.diff.bossHp, maxHp: this.diff.bossHp, inv: 0,
                    jumpT: 90, spitT: 160, dead: false, onGround: true, face: -1 };
      this.shake = 20; sfx.thud(); rumble(this.slot, 300, 0.7);
    }
  }

  hitBlock(tx, ty) {
    const c = this.grid[ty][tx], p = this.p;
    if (c === '?') {
      this.grid[ty][tx] = 'U';
      this.bumps.push({ tx, ty, t: 10 });
      this.particles.push({ type: 'coin', x: tx * T + T / 2, y: ty * T - 8, vy: -8, life: 30 });
      this.getCoin(); this.addScore(200, tx * T + 4, ty * T - 20);
      this.knockEnemiesAbove(tx, ty);
    } else if (c === 'G' || c === 'K') {
      this.grid[ty][tx] = 'U';
      this.bumps.push({ tx, ty, t: 10 });
      const type = p.power === 0 ? 'mango' : c === 'G' ? 'pepper' : 'cape';
      this.items.push({ type, x: tx * T + 2, y: ty * T, w: 28, h: 28, vx: 0, vy: 0, emerge: 32, t: 0 });
      sfx.sprout();
      this.knockEnemiesAbove(tx, ty);
    } else if (c === 'B') {
      if (p.power > 0 && !this.race) {
        this.grid[ty][tx] = ' ';
        sfx.brk(); this.addScore(50);
        for (let i = 0; i < 4; i++) {
          this.particles.push({ type: 'debris', x: tx * T + (i % 2) * 16 + 8, y: ty * T + (i < 2 ? 8 : 24),
                                vx: (i % 2 ? 1 : -1) * (2 + Math.random()), vy: -7 - (i < 2 ? 3 : 0), life: 70 });
        }
      } else {
        this.bumps.push({ tx, ty, t: 10 });
        sfx.bump();
      }
      this.knockEnemiesAbove(tx, ty);
    } else {
      sfx.bump();
    }
  }

  knockEnemiesAbove(tx, ty) {
    for (const e of this.enemies) {
      if (!enemyAlive(e)) continue;
      const onTop = Math.abs(e.y + e.h - ty * T) < 4 && e.x + e.w > tx * T && e.x < (tx + 1) * T;
      if (onTop) { e.flip = true; e.vy = -6; e.vx = 1.5; sfx.stomp(); this.addScore(100, e.x, e.y); }
    }
  }

  /** Touched an enemy. */
  hurt() {
    const p = this.p;
    if (p.inv > 0 || this.state !== 'play') return;
    rumble(this.slot, 250, 0.8);
    if (this.race) {
      // Like Sonic's rings: your coins fly out and you can grab some back.
      const lose = Math.ceil(this.wallet.coins * this.diff.spillShare);   // Easy: only half your coins fly out
      const n = Math.min(lose, 20);
      if (n > 0) {
        for (let i = 0; i < n; i++) {
          const a = Math.PI * (0.12 + 0.76 * i / Math.max(1, n - 1));
          this.spills.push({ x: p.x + p.w / 2, y: p.y + 8, vx: Math.cos(a) * (2.5 + (i % 3)), vy: -Math.sin(a) * (6 + (i % 2) * 2),
                             life: 240, delay: 30 });
        }
        this.wallet.coins -= lose;
        sfx.spill();
      } else sfx.hurt();
      p.vx = -p.face * 4; p.vy = -6; p.inv = Math.round(this.diff.hurtInv * 0.85); p.stun = 20; p.boost = 0;
    } else if (p.power > 0) {
      this.setPower(0); p.inv = this.diff.hurtInv; sfx.shrink();
    } else {
      this.die();
    }
  }
  die() {
    if (this.state !== 'play') return;
    const p = this.p;
    this.state = 'dying'; this.timer = 150;
    p.vy = p.y > VH ? 0 : -12; p.vx = 0;
    sfx.die(); rumble(this.slot, 400, 1);
  }
  /** Fell in a hole or touched lava. */
  fatal() {
    if (!this.race) return this.die();
    const p = this.p;
    p.x = this.checkX * T; p.y = 13 * T - p.h;
    p.vx = 0; p.vy = 0; p.inv = 90; p.stun = 0; p.boost = 0;
    sfx.hurt(); rumble(this.slot, 200, 0.6);
  }

  startClear() {
    const p = this.p;
    this.state = 'clear'; this.timer = 0;
    this.finishTime = this.clock;
    p.x = this.def.flag * T + T / 2 - p.w + 2; p.vx = 0; p.vy = 0;
    if (!this.race) this.addScore(Math.min(5000, Math.max(1, Math.round((12 * T - p.y) / T)) * 100), p.x + 20, p.y);
    sfx.clear();
  }
  updateClear() {
    const p = this.p;
    this.timer++;
    const bottom = 12 * T - p.h;
    this.flagY = Math.min(11 * T, this.flagY + 5);
    if (p.y < bottom && this.timer < 120) {
      p.y = Math.min(bottom, p.y + 5);
    } else if (!p.hidden) {
      p.face = 1; p.vx = 2.5; p.vy = Math.min(p.vy + 0.6, 14);
      this.moveEntity(p);
      p.anim += 0.08;
      if (p.x > (this.def.flag + 5) * T) p.hidden = true;
    }
    if (this.timer > 240) this.state = 'won';
  }

  updateEnemies() {
    const p = this.p;
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (!e.active) { if (e.x < this.cam + this.vw + T) e.active = true; else continue; }
      if (e.squish) { if (--e.squish <= 0) e.dead = true; continue; }
      if (e.flip) {
        e.vy += 0.5; e.x += e.vx; e.y += e.vy;
        if (e.y > VH + 50) e.dead = true;
        continue;
      }
      const dir = Math.sign(e.vx) || -1;
      e.vy = Math.min(e.vy + 0.6, 14);
      if (this.moveEntity(e)) e.vx = -dir * this.espeed;
      if (e.y > VH + 50) { e.dead = true; continue; }

      if (this.state === 'play' && overlap(p, e)) {
        if (p.prevBottom <= e.y + 10 && p.vy >= 0) {
          e.squish = 30;
          p.combo++;
          this.addScore(100 * Math.min(p.combo, 8), e.x, e.y - 10);
          p.vy = p.jumpHeld ? -12 : -8;
          sfx.stomp(); rumble(this.slot, 60, 0.3);
        } else {
          this.hurt();
        }
      }
    }
    // enemies bump into each other and turn around
    const live = this.enemies.filter(enemyAlive);
    for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
      const a = live[i], b = live[j];
      if (overlap(a, b)) {
        const left = a.x < b.x ? a : b, right = left === a ? b : a;
        left.vx = -Math.abs(left.vx || this.espeed); right.vx = Math.abs(right.vx || this.espeed);
      }
    }
    if (this.enemies.length > 60) this.enemies = this.enemies.filter(e => !e.dead);
  }

  // ------------------------------------------------------------ the Goober King
  updateBoss() {
    const B = this.boss, p = this.p;
    if (!B) return;
    if (B.dead) { B.vy += 0.4; B.y += B.vy; return; }
    if (B.inv > 0) B.inv--;
    const rage = (B.maxHp - B.hp) / B.maxHp;  // he gets faster as he gets hurt
    const bs = this.diff.bossSpeed;
    const speed = (1.5 + rage * 1.5) * bs;
    const wasAir = !B.onGround;
    const dir = Math.sign(B.vx) || -1;
    B.vy = Math.min(B.vy + 0.6, 14);
    if (this.moveEntity(B)) B.vx = -dir * speed;
    if (B.onGround && wasAir) {
      this.shake = 14; sfx.thud(); rumble(this.slot, 150, 0.5);
      B.vx = (Math.sign(p.x - B.x) || -1) * speed;
    }
    if (B.vx) B.face = B.vx < 0 ? -1 : 1;
    if (B.onGround && --B.jumpT <= 0) {
      B.vy = -13;
      B.vx = (Math.sign(p.x - B.x) || -1) * (2.5 + rage * 1.5) * bs;
      B.jumpT = (120 - rage * 50) / bs;
    }
    if (--B.spitT <= 0) {
      B.spitT = (200 - rage * 80) / bs;
      if (this.enemies.filter(enemyAlive).length < 4) {
        this.enemies.push({ x: B.x + B.w / 2 - 14, y: B.y + 10, w: 28, h: 26, vx: B.face * this.espeed * 1.35, vy: -5,
                            active: true, squish: 0, flip: false, dead: false });
        sfx.spit();
      }
    }
    if (this.state === 'play' && overlap(p, B)) {
      if (p.prevBottom <= B.y + 18 && p.vy >= 0) {
        p.vy = -11;
        if (B.inv <= 0) this.damageBoss(4); else sfx.bump();
      } else {
        this.hurt();
      }
    }
  }
  damageBoss(n) {
    const B = this.boss;
    if (!B || B.dead || B.inv > 0) return;
    B.hp -= n;
    B.inv = n >= 4 ? 80 : 12;
    sfx.bossHit(); this.shake = 8; rumble(this.slot, 200, 0.7);
    this.addScore(n >= 4 ? 1000 : 200, B.x + 20, B.y - 10);
    if (B.hp <= 0) {
      B.dead = true; B.vy = -8; B.vx = 0;
      this.addScore(5000, B.x + 10, B.y - 30);
      for (const e of this.enemies) if (enemyAlive(e)) { e.flip = true; e.vy = -6; }
      this.state = 'bossdown'; this.timer = 240;
      sfx.win();
    }
  }

  // ------------------------------------------------------------ power-ups, fireballs, spilled coins
  updateItems() {
    const p = this.p;
    for (const it of this.items) {
      it.t++;
      if (it.emerge > 0) {
        it.y -= 1;
        if (--it.emerge === 0) { if (it.type === 'mango') it.vx = 1.6; if (it.type === 'cape') it.vy = -6; }
        continue;
      }
      if (it.type === 'mango') {
        const d = Math.sign(it.vx) || 1;
        it.vy = Math.min(it.vy + 0.5, 10);
        if (this.moveEntity(it)) it.vx = -d * 1.6;
      } else if (it.type === 'pepper') {
        it.vy = Math.min(it.vy + 0.5, 10);
        this.moveEntity(it);
      } else {
        it.vy = Math.min(it.vy + 0.15, 1.2);
        it.y += it.vy;
        it.x += Math.sin(it.t * 0.06) * 1.6;
      }
      if (it.y > VH + 40) it.gone = true;
      if (this.state === 'play' && overlap(p, it)) {
        if (it.type === 'mango') { if (p.power === 0) this.setPower(1); }
        else if (it.type === 'pepper') this.setPower(2);
        else this.setPower(3);
        this.addScore(1000, it.x, it.y - 10);
        sfx.power(); rumble(this.slot, 120, 0.4);
        it.gone = true;
      }
    }
    this.items = this.items.filter(it => !it.gone);
  }

  updateFireballs() {
    for (const f of this.fireballs) {
      f.life--;
      f.x += f.vx;
      if (this.solidAt(Math.floor((f.x + f.w / 2) / T), Math.floor((f.y + f.h / 2) / T))) { f.life = 0; continue; }
      f.vy = Math.min(f.vy + 0.5, 8);
      f.y += f.vy;
      if (f.vy > 0) {
        const ty = Math.floor((f.y + f.h) / T);
        if (this.solidAt(Math.floor((f.x + f.w / 2) / T), ty)) { f.y = ty * T - f.h; f.vy = -5; }
      }
      if (f.y > VH || f.x < this.cam - 20 || f.x > this.cam + this.vw + 20) f.life = 0;
      for (const e of this.enemies) {
        if (f.life > 0 && enemyAlive(e) && overlap(f, e)) {
          e.flip = true; e.vy = -5; e.vx = Math.sign(f.vx) * 1.5;
          f.life = 0; this.addScore(200, e.x, e.y); sfx.stomp();
        }
      }
      if (f.life > 0 && this.boss && !this.boss.dead && overlap(f, this.boss)) { this.damageBoss(1); f.life = 0; }
    }
    this.fireballs = this.fireballs.filter(f => f.life > 0);
  }

  updateSpills() {
    const p = this.p;
    for (const s of this.spills) {
      s.life--;
      if (s.delay > 0) s.delay--;
      s.vy = Math.min(s.vy + 0.35, 9);
      s.x += s.vx;
      if (this.solidAt(Math.floor(s.x / T), Math.floor(s.y / T))) { s.vx = -s.vx; s.x += s.vx * 2; }
      s.y += s.vy;
      const ty = Math.floor((s.y + 8) / T);
      if (s.vy > 0 && this.solidAt(Math.floor(s.x / T), ty)) {
        s.y = ty * T - 8; s.vy = -s.vy * 0.6; s.vx *= 0.9;
        if (Math.abs(s.vy) < 1.5) s.vy = 0;
      }
      if (s.delay <= 0 && this.state === 'play' &&
          s.x > p.x - 6 && s.x < p.x + p.w + 6 && s.y > p.y - 6 && s.y < p.y + p.h + 6) {
        s.life = 0; this.getCoin();
      }
      if (s.y > VH + 20) s.life = 0;
    }
    this.spills = this.spills.filter(s => s.life > 0);
  }

  updateParticles() {
    for (const q of this.particles) {
      q.life--;
      if (q.type === 'coin') { q.y += q.vy; q.vy += 0.5; }
      else if (q.type === 'debris') { q.x += q.vx; q.y += q.vy; q.vy += 0.5; }
      else if (q.type === 'text') { q.y += q.vy; }
    }
    this.particles = this.particles.filter(q => q.life > 0);
    for (const b of this.bumps) b.t--;
    this.bumps = this.bumps.filter(b => b.t > 0);
  }

  updateCamera() {
    const p = this.p;
    const target = p.x + p.w / 2 - this.vw * (this.race ? 0.35 : 0.4);
    const min = this.arenaLocked ? this.def.boss.arenaX * T : 0;
    const max = this.width * T - this.vw;
    this.cam = Math.min(max, Math.max(min, target));
  }

  // ------------------------------------------------------------ drawing
  draw(vw) {
    this.vw = vw;
    const cam = this.cam;
    ctx.save();
    if (this.shake) ctx.translate(Math.round(Math.random() * 6 - 3), Math.round(Math.random() * 4 - 2));
    drawBackground(this.theme, cam, vw);

    if (this.def.flag > 0) this.drawFlag(cam, vw);

    for (const it of this.items) this.drawItem(it, cam);

    const x0 = Math.max(0, Math.floor(cam / T)), x1 = Math.min(this.width - 1, x0 + Math.ceil(vw / T) + 1);
    for (let ty = 0; ty < H; ty++) for (let tx = x0; tx <= x1; tx++) {
      const c = this.grid[ty][tx];
      if (c === ' ') continue;
      let y = ty * T;
      const bp = this.bumps.find(b => b.tx === tx && b.ty === ty);
      if (bp) y -= Math.sin((bp.t / 10) * Math.PI) * (c === '^' ? -6 : 8);
      this.drawTile(c, Math.round(tx * T - cam), y, tx, ty);
    }

    for (const e of this.enemies) {
      if (e.dead || !e.active) continue;
      const x = e.x - cam;
      if (x < -40 || x > vw + 40) continue;
      if (e.squish) {
        ctx.fillStyle = '#8e44ad';
        ctx.beginPath(); ctx.ellipse(x + e.w / 2, e.y + e.h - 5, e.w / 2 + 3, 5, 0, 0, Math.PI * 2); ctx.fill();
        R('#fff', x + 6, e.y + e.h - 7, 5, 2); R('#fff', x + 17, e.y + e.h - 7, 5, 2);
      } else drawGoober(x, e.y, e.w, e.h, e.vx < 0 ? -1 : 1, e.flip);
    }

    const B = this.boss;
    if (B && B.y < VH + 100 && !(B.inv > 0 && !B.dead && (frameCount >> 2) % 2)) {
      drawGoober(B.x - cam, B.y, B.w, B.h, B.face, B.dead, true, B.inv > 70);
    }

    this.drawPlayer(cam);

    for (const f of this.fireballs) {
      const x = f.x - cam + f.w / 2, y = f.y + f.h / 2;
      ctx.fillStyle = '#ff6a00'; ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffe14d'; ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
    }
    for (const s of this.spills) {
      if (s.life < 60 && (frameCount >> 2) % 2) continue;
      ctx.fillStyle = '#ffd700';
      ctx.beginPath(); ctx.ellipse(s.x - cam, s.y, 4 + Math.abs(Math.cos(frameCount * 0.2 + s.x)) * 4, 9, 0, 0, Math.PI * 2); ctx.fill();
    }
    for (const q of this.particles) {
      const x = q.x - cam;
      if (q.type === 'coin') {
        ctx.fillStyle = '#ffd700';
        ctx.beginPath(); ctx.ellipse(x, q.y, 5 + Math.abs(Math.cos(q.life * 0.4)) * 4, 11, 0, 0, Math.PI * 2); ctx.fill();
      } else if (q.type === 'debris') {
        R(this.theme.brick, x - 6, q.y - 6, 12, 12);
        R(this.theme.brickLine, x - 6, q.y, 12, 2);
      } else text(q.text, x, q.y, 10, '#fff', 'left');
    }
    ctx.restore();
  }

  drawPlayer(cam) {
    const p = this.p;
    if (p.hidden) return;
    if (p.inv > 0 && this.state === 'play' && (frameCount >> 2) % 2) return;
    const dead = this.state === 'dying' || this.state === 'dead';
    const air = !p.onGround && !dead && this.state !== 'bossdown';
    const running = p.onGround && Math.abs(p.vx) > 0.4;
    const pose = dead ? 'dead' : air ? 'air' : running ? 'run' : 'stand';
    const step = running ? Math.floor(p.anim * 4) % 2 : 0;
    drawHero(this.hero, p.x - cam, p.y, p.w, p.h, p.face, pose, step, p.power, p.onGround ? -2 : p.vy);
    if (p.boost > 0 && (frameCount >> 1) % 2) {               // speed lines
      for (let i = 0; i < 3; i++) R('rgba(255,255,255,0.7)', p.x - cam - 14 - i * 10, p.y + 6 + i * 8, 10, 2);
    }
  }

  drawItem(it, cam) {
    const x = it.x - cam, y = it.y;
    if (it.type === 'mango') {               // Mega Mango: makes you big
      ctx.fillStyle = '#ff9f1c'; ctx.beginPath(); ctx.ellipse(x + 14, y + 16, 12, 11, 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffd166'; ctx.beginPath(); ctx.ellipse(x + 10, y + 12, 4, 3, 0.3, 0, Math.PI * 2); ctx.fill();
      R('#2e7d32', x + 13, y + 2, 3, 5);
      ctx.fillStyle = '#43a047'; ctx.beginPath(); ctx.ellipse(x + 19, y + 4, 6, 3, -0.4, 0, Math.PI * 2); ctx.fill();
      R('#000', x + 16, y + 14, 2, 3); R('#000', x + 21, y + 14, 2, 3);
    } else if (it.type === 'pepper') {       // Fire Pepper: throw fireballs
      const glow = (Math.sin(it.t * 0.2) + 1) / 2;
      ctx.fillStyle = glow > 0.5 ? '#ff3b30' : '#e11d48';
      ctx.beginPath(); ctx.moveTo(x + 8, y + 8); ctx.quadraticCurveTo(x + 4, y + 26, x + 20, y + 28);
      ctx.quadraticCurveTo(x + 14, y + 18, x + 20, y + 8); ctx.closePath(); ctx.fill();
      R('#2e7d32', x + 10, y + 3, 9, 6);
      R('#ffb3a7', x + 10, y + 12, 3, 6);
    } else {                                 // Sky Cape: glide and fly
      const sway = Math.sin(it.t * 0.06);
      ctx.save(); ctx.translate(x + 14, y + 14); ctx.rotate(sway * 0.3);
      ctx.fillStyle = '#facc15';
      ctx.beginPath(); ctx.moveTo(-10, -10); ctx.lineTo(10, -10); ctx.lineTo(13, 12); ctx.lineTo(0, 7); ctx.lineTo(-13, 12); ctx.closePath(); ctx.fill();
      R('#b45309', -10, -12, 20, 4);
      ctx.restore();
    }
  }

  drawFlag(cam, vw) {
    const fx = this.def.flag * T + T / 2 - cam;
    if (fx < -6 * T || fx > vw + 2 * T) return;
    R('#e8e8e8', fx - 2, 2 * T, 4, 10 * T);
    ctx.fillStyle = '#ffd700'; ctx.beginPath(); ctx.arc(fx, 2 * T - 6, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = this.race ? '#ffffff' : '#ff3b3b';
    ctx.beginPath(); ctx.moveTo(fx - 2, this.flagY - 14); ctx.lineTo(fx - 40, this.flagY); ctx.lineTo(fx - 2, this.flagY + 14); ctx.fill();
    if (this.race) {                                // checkered finish flag
      for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) if ((i + j) % 2) R('#111', fx - 34 + i * 7, this.flagY - 8 + j * 6, 7, 6);
    } else text('M', fx - 14, this.flagY - 5, 10, '#fff', 'center', false);
    const cx = (this.def.flag + 3) * T - cam, cy = 13 * T;
    R('#7a3b2e', cx, cy - 4 * T, 4 * T, 4 * T);
    R('#9c4f3e', cx + 4, cy - 4 * T + 4, 4 * T - 8, 4 * T - 4);
    for (let i = 0; i < 4; i++) R('#7a3b2e', cx + i * T + 4, cy - 4.6 * T, T - 8, 0.6 * T);
    R('#2a1208', cx + 1.4 * T, cy - 1.6 * T, 1.2 * T, 1.6 * T);
    ctx.fillStyle = '#2a1208'; ctx.beginPath(); ctx.arc(cx + 2 * T, cy - 1.6 * T, 0.6 * T, Math.PI, 0); ctx.fill();
    R('#2a1208', cx + 0.5 * T, cy - 3.2 * T, 0.5 * T, 0.6 * T); R('#2a1208', cx + 3 * T, cy - 3.2 * T, 0.5 * T, 0.6 * T);
    if (this.race) text('FINISH', fx, 2 * T - 34, 10, '#fff');
  }

  drawTile(c, x, y, tx, ty) {
    const th = this.theme;
    switch (c) {
      case '#':
        R(th.ground, x, y, T, T);
        R(th.groundDark, x, y + T - 3, T, 3); R(th.groundDark, x + T - 3, y, 3, T);
        R(th.groundDark, x + 7, y + 11, 4, 4); R(th.groundDark, x + 19, y + 21, 4, 4);
        if (th.grass && this.tileAt(tx, ty - 1) !== '#') {
          R(th.grass, x, y, T, 7);
          R(th.grass, x + 4, y + 7, 4, 3); R(th.grass, x + 18, y + 7, 4, 4);
        }
        break;
      case 'B':
        R(th.brick, x, y, T, T);
        R(th.brickLine, x, y + 15, T, 2); R(th.brickLine, x, y + T - 2, T, 2);
        R(th.brickLine, x + 15, y, 2, 15); R(th.brickLine, x + 6, y + 17, 2, 13); R(th.brickLine, x + 24, y + 17, 2, 13);
        R('rgba(255,255,255,0.25)', x, y, T, 2);
        break;
      case '?': case 'G': case 'K': {
        const glow = (Math.sin(frameCount * 0.1) + 1) / 2;
        R('#7a4a00', x, y, T, T);
        R(glow > 0.5 ? '#ffd23a' : '#ffbf1f', x + 2, y + 2, T - 4, T - 4);
        R('#7a4a00', x + 4, y + 4, 2, 2); R('#7a4a00', x + T - 6, y + 4, 2, 2);
        R('#7a4a00', x + 4, y + T - 6, 2, 2); R('#7a4a00', x + T - 6, y + T - 6, 2, 2);
        text('?', x + T / 2 + 1, y + 9, 14, '#fff3c4', 'center', false);
        break;
      }
      case 'U':
        R('#5a3510', x, y, T, T); R('#8a5a33', x + 2, y + 2, T - 4, T - 4);
        R('#5a3510', x + 5, y + 5, 3, 3); R('#5a3510', x + T - 8, y + 5, 3, 3);
        R('#5a3510', x + 5, y + T - 8, 3, 3); R('#5a3510', x + T - 8, y + T - 8, 3, 3);
        break;
      case 'S':
        R(th.stair, x, y, T, T);
        R('rgba(255,255,255,0.3)', x, y, T, 3); R('rgba(255,255,255,0.3)', x, y, 3, T);
        R('rgba(0,0,0,0.3)', x, y + T - 3, T, 3); R('rgba(0,0,0,0.3)', x + T - 3, y, 3, T);
        break;
      case 'P': case 'Q': {
        const left = c === 'P';
        const cap = !'PQ'.includes(this.tileAt(tx, ty - 1));
        R('#1d7a2a', left ? x + 3 : x, y, T - 3, T);
        R('#2fae3f', left ? x + 5 : x, y, T - 5, T);
        if (left) R('#8ee89a', x + 10, y, 5, T); else R('#1d7a2a', x + T - 12, y, 6, T);
        if (cap) {
          R('#1d7a2a', x, y, T, 15);
          R('#34c246', left ? x + 2 : x, y + 2, T - 2, 11);
          if (left) R('#8ee89a', x + 8, y + 2, 5, 11); else R('#1d7a2a', x + T - 10, y + 2, 6, 11);
        }
        break;
      }
      case 'C': {
        const w = Math.abs(Math.cos(frameCount * 0.08 + tx * 0.5)) * 9 + 2;
        ctx.fillStyle = '#b8860b';
        ctx.beginPath(); ctx.ellipse(x + T / 2, y + T / 2, w + 2, 13, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffd700';
        ctx.beginPath(); ctx.ellipse(x + T / 2, y + T / 2, w, 11, 0, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case '^':                                    // spring
        R(th.ground, x, y + 20, T, 12);
        R('#9ca3af', x + 6, y + 10, 20, 3); R('#9ca3af', x + 6, y + 15, 20, 3);
        R('#ef4444', x + 2, y + 2, T - 4, 8); R('#fca5a5', x + 4, y + 3, T - 8, 2);
        break;
      case '>': {                                  // speed boost pad
        R(th.ground, x, y, T, T);
        R('#1e293b', x, y, T, 10);
        const on = (frameCount >> 3) % 2;
        ctx.fillStyle = on ? '#22d3ee' : '#0891b2';
        ctx.beginPath(); ctx.moveTo(x + 4, y + 1); ctx.lineTo(x + 14, y + 5); ctx.lineTo(x + 4, y + 9); ctx.fill();
        ctx.fillStyle = on ? '#0891b2' : '#22d3ee';
        ctx.beginPath(); ctx.moveTo(x + 17, y + 1); ctx.lineTo(x + 27, y + 5); ctx.lineTo(x + 17, y + 9); ctx.fill();
        break;
      }
      case '!': {                                  // checkpoint post
        const on = this.checksOn.has(tx);
        R('#555', x + 14, y - T, 4, 2 * T);
        R(on ? '#22c55e' : '#9ca3af', x + 18, y - T, 14, 10);
        ctx.fillStyle = on ? '#facc15' : '#d1d5db';
        ctx.beginPath(); ctx.arc(x + 16, y - T - 2, 4, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'L': {                                  // lava
        const wave = Math.sin(frameCount * 0.1 + tx) * 3;
        R('#ff4d00', x, y + 6 + wave, T, T - 6 - wave);
        R('#ffb000', x, y + 6 + wave, T, 4);
        if ((frameCount + tx * 13) % 50 < 6) R('#ffe066', x + 12, y + wave, 6, 6);
        break;
      }
    }
  }
}
