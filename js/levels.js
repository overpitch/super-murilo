'use strict';
// =====================================================================
//  Levels
//  Tiles:  # ground    B brick    ? coin block    U used block    S stone
//          G grow/fire block   K grow/cape block   P/Q pipe (left/right half)
//          C coin   E enemy start   ^ spring   > speed boost   ! checkpoint   L lava
// =====================================================================

function makeLevel(name, width, theme, build) {
  const g = Array.from({ length: H }, () => Array(width).fill(' '));
  const L = { name, width, theme, g, flag: width - 8, start: { x: 3 }, boss: null };
  const api = {
    ground(a, b, top = 13) { for (let x = a; x <= b; x++) for (let y = top; y < H; y++) g[y][x] = '#'; },
    hole(a, b) { for (let x = a; x <= b; x++) for (let y = 13; y < H; y++) g[y][x] = ' '; },
    lava(a, b) { for (let x = a; x <= b; x++) { g[13][x] = ' '; g[14][x] = 'L'; } },
    put(x, y, s) { for (let i = 0; i < s.length; i++) if (s[i] !== ' ') g[y][x + i] = s[i]; },
    pipe(x, h) { for (let y = 13 - h; y < 13; y++) { g[y][x] = 'P'; g[y][x + 1] = 'Q'; } },
    stairs(x, n, dir = 1) {
      for (let i = 0; i < n; i++) {
        const hh = dir > 0 ? i + 1 : n - i;
        for (let y = 13 - hh; y < 13; y++) g[y][x + i] = 'S';
      }
    },
    flag(x) { L.flag = x; g[12][x] = 'S'; },
    boss(arenaX, x) { L.boss = { arenaX, x }; L.flag = -1; },
  };
  build(api);
  L.enemyStarts = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < width; x++) {
    if (g[y][x] === 'E') { L.enemyStarts.push({ x, y }); g[y][x] = ' '; }
  }
  return L;
}

// ---------------------------------------------------------------- 1 player adventure
const ADVENTURE = [
  makeLevel('1-1  SUNNY HILLS', 170, 'day', a => {
    a.ground(0, 68); a.ground(71, 86); a.ground(90, 169);
    a.put(16, 9, 'G');
    a.put(20, 9, 'B?B?B'); a.put(22, 5, '?');
    a.put(23, 12, 'E');
    a.pipe(28, 2); a.pipe(38, 3);
    a.put(42, 12, 'E');
    a.pipe(46, 4);
    a.put(51, 12, 'E E');
    a.pipe(57, 4);
    a.put(62, 10, 'CCC');
    a.put(66, 9, 'B?B');
    a.put(73, 9, 'BBBBBBBB'); a.put(74, 5, 'CCCCCC'); a.put(78, 8, 'E');
    a.put(82, 12, 'E E');
    a.put(94, 9, 'BBBG'); a.put(97, 5, '?');
    a.put(100, 9, 'BB');
    a.put(104, 12, 'E E');
    a.put(106, 9, '?  ?  ?'); a.put(109, 5, '?');
    a.put(115, 12, 'E E');
    a.put(118, 9, 'B'); a.put(121, 5, 'BBB');
    a.put(124, 12, 'E E');
    a.put(128, 5, 'B??B'); a.put(129, 9, 'BB');
    a.stairs(134, 4, 1); a.stairs(140, 4, -1);
    a.stairs(148, 8, 1);
    a.flag(163);
  }),

  makeLevel('1-2  CRYSTAL CAVE', 150, 'cave', a => {
    a.ground(0, 149);
    a.put(0, 0, 'S'.repeat(150));
    a.hole(30, 32); a.hole(60, 63); a.hole(95, 98); a.hole(120, 122);
    a.put(12, 9, 'GB?B?');
    a.put(15, 12, 'E'); a.put(19, 12, 'E E');
    a.stairs(22, 3, 1);
    a.put(31, 9, 'CCC');
    a.stairs(36, 4, -1);
    a.put(44, 9, 'BBBBBB'); a.put(45, 5, 'CCCC'); a.put(47, 8, 'E');
    a.put(52, 7, 'BBKBB');
    a.put(54, 12, 'E E');
    a.put(60, 9, 'CCCC');
    a.pipe(68, 3); a.put(72, 12, 'E');
    a.pipe(76, 2); a.put(80, 12, 'E E');
    a.pipe(84, 4);
    a.put(88, 9, '??'); a.put(89, 12, 'E');
    a.put(100, 10, 'BBB'); a.put(100, 8, 'CCC');
    a.put(105, 8, 'BBB'); a.put(105, 6, 'CCC');
    a.put(110, 6, 'B?BB'); a.put(108, 12, 'E E E');
    a.put(116, 12, 'E');
    a.put(121, 9, 'CCC');
    a.stairs(128, 6, 1);
    a.flag(142);
  }),

  makeLevel('1-3  SKY BRIDGES', 160, 'sky', a => {
    a.ground(0, 14); a.ground(19, 30); a.ground(35, 38); a.ground(43, 46);
    a.put(8, 9, 'K');
    a.put(15, 10, 'CCCC');
    a.put(24, 12, 'E'); a.put(27, 12, 'E');
    a.put(22, 9, 'BGB');
    a.put(31, 10, 'CCCC');
    a.put(39, 10, 'CCCC');
    a.put(20, 3, 'CCCCCCCCCCCCCCCCCCCC');      // a sky road for flyers
    a.put(48, 10, 'SSSS'); a.put(54, 8, 'SSSS'); a.put(55, 7, 'E'); a.put(60, 10, 'SSSS');
    a.put(54, 4, 'CCCC');
    a.ground(66, 80); a.pipe(72, 3);
    a.put(69, 12, 'E'); a.put(76, 12, 'E E');
    a.put(68, 9, '?'); a.put(77, 8, '?BK');
    a.ground(85, 88); a.ground(93, 96); a.ground(101, 104);
    a.put(81, 10, 'CCCC'); a.put(89, 10, 'CCCC'); a.put(97, 10, 'CCCC');
    a.put(84, 3, 'CCCCCCCCCCCCCCCC');
    a.put(108, 10, 'SSSSS');
    a.ground(116, 159);
    a.put(120, 12, 'E'); a.put(124, 12, 'E E'); a.put(127, 12, 'E');
    a.put(119, 9, 'B??B');
    a.stairs(134, 6, 1);
    a.flag(150);
  }),

  makeLevel('1-4  GOOBER CASTLE', 112, 'castle', a => {
    a.ground(0, 111);
    a.put(0, 0, 'S'.repeat(112));
    a.put(10, 9, 'G');
    a.lava(16, 18);
    a.put(22, 12, 'E'); a.put(26, 12, 'E');
    a.lava(31, 35); a.put(32, 10, 'SSS');
    a.put(32, 8, 'CCC');
    a.put(39, 9, 'B?BKB');
    a.put(44, 12, 'E E');
    a.stairs(48, 3, 1); a.stairs(51, 3, -1);
    a.lava(55, 59); a.put(56, 10, 'SSS');
    a.put(56, 8, 'CCC');
    a.put(64, 12, 'E'); a.put(68, 12, 'E E');
    a.put(66, 9, '?B?B?');
    a.lava(73, 77); a.put(74, 10, 'SSS');
    a.put(80, 12, 'E');
    a.put(84, 9, 'G');
    // the Goober King's throne room
    a.boss(92, 104);
  }),
];

// World map: where each level's dot is (relative to the screen center).
const MAP_NODES = [
  { dx: -210, y: 340 },
  { dx: -85, y: 255 },
  { dx: 45, y: 320 },
  { dx: 185, y: 185, castle: true },
];

// ---------------------------------------------------------------- 2 player race tracks
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/** Builds a long speed track out of random pieces. The same seed always makes the same track. */
function makeRaceTrack(name, theme, seed, length, hard) {
  return makeLevel(name, length + 70, theme, a => {
    const r = mulberry32(seed);
    const ri = (lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
    const C = n => 'C'.repeat(n);

    const pieces = {
      flat(x) {
        const n = ri(6, 10);
        a.ground(x, x + n - 1);
        a.put(x + 1, ri(9, 11), C(n - 2));
        return n;
      },
      gap(x) {
        const g = ri(3, hard ? 5 : 4);
        a.ground(x, x + 3);
        a.put(x + 3, 9, C(g + 2));
        a.ground(x + 4 + g, x + 7 + g);
        return 8 + g;
      },
      spring(x) {
        a.ground(x, x + 16);
        a.put(x + 3, 13, '^');
        a.put(x + 8, 5, 'SSSSSSS');
        a.put(x + 8, 4, C(7));
        if (hard) a.put(x + 12, 12, 'E');
        return 17;
      },
      boost(x) {
        a.ground(x, x + 24);
        a.put(x + 1, 13, '>>');
        a.put(x + 4, 11, C(16));
        a.put(x + 24, 8, C(5));
        a.ground(x + 30, x + 33);
        return 34;
      },
      enemies(x) {
        const n = ri(12, 16);
        a.ground(x, x + n - 1);
        a.put(x + 3, 9, 'B?B');
        const count = hard ? 3 : 2;
        for (let i = 0; i < count; i++) a.put(x + 6 + i * 3, 12, 'E');
        return n;
      },
      hill(x) {
        const h = ri(3, 4);
        const top = x + 2 + h;
        a.ground(x, top + 4 + h + 1);
        a.stairs(x + 2, h, 1);
        a.ground(top, top + 3, 13 - h);
        a.put(top, 13 - h - 2, C(4));
        a.stairs(top + 4, h, -1);
        return 2 + h + 4 + h + 2;
      },
      hop(x) {
        a.ground(x, x + 2);
        let px = x + 5;
        for (let i = 0; i < 3; i++) {
          const y = ri(10, 11);
          a.put(px, y, 'SSSSSS');
          a.put(px + 1, y - 1, C(4));
          px += 8;
        }
        a.ground(px - 1, px + 3);
        return px + 4 - x;
      },
      pipes(x) {
        const h1 = ri(2, 3), h2 = ri(2, 4);
        a.ground(x, x + 15);
        a.pipe(x + 3, h1); a.put(x + 3, 13 - h1 - 2, C(2));
        a.pipe(x + 10, h2); a.put(x + 10, 13 - h2 - 2, C(2));
        if (hard) a.put(x + 7, 12, 'E');
        return 16;
      },
      tunnel(x) {
        a.ground(x, x + 13);
        a.put(x + 1, 10, 'S'.repeat(12));
        a.put(x + 2, 12, C(10));
        a.put(x + 2, 9, C(10));
        return 14;
      },
    };
    const names = Object.keys(pieces);

    a.ground(0, 14);
    a.put(7, 10, C(6));
    let x = 15, sinceCheck = 0, last = '';
    while (x < length) {
      if (sinceCheck >= 60) {
        a.ground(x, x + 5); a.put(x + 2, 12, '!');
        x += 6; sinceCheck = 0; continue;
      }
      let name;
      do { name = names[Math.floor(r() * names.length)]; } while (name === last);
      last = name;
      const used = pieces[name](x);
      x += used; sinceCheck += used;
    }
    a.ground(x, length + 69);
    a.put(x + 2, 10, C(6));
    a.flag(x + 12);
  });
}

const RACE_TRACKS = [
  makeRaceTrack('GREEN DASH', 'day', 7, 520, false),
  makeRaceTrack('SUNSET RUSH', 'sky', 42, 480, true),
];
