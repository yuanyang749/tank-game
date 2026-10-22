/* ==========================================================================
   Squishy Buddies 2006 - Level Design Audit & Scripted Playthroughs
   1. Topology audit: every gate must really seal the fountain chamber (no way around it), every dew
      must be collectable BEFORE the gate opens, and the fountain must be reachable once it opens.
   2. Autopilot playthroughs: a scripted player clears every room with the REAL game physics
      (jumps, bubbles, crawlways, boss gate) - proof that each room is completable.
   Usage: node tests/test_squishy_levels.js
   ========================================================================== */

const { createEnv, loadAll } = require('./helpers/squishy_env');

let passed = 0;
let failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log(`  ✓ [PASS] ${msg}`); }
  else { failed++; console.error(`  ✗ [FAIL] ${msg}`); }
}
function suite(name, fn) {
  console.log(`\n==================================================\n🧪 SUITE: ${name}\n==================================================`);
  try { fn(); } catch (err) { failed++; console.error(`  [SUITE ERROR] ${name}:`, err.stack || err.message); }
}

// deterministic randomness (blink timers, boss AI, particles) so the scripted runs are reproducible
let seed = 20061;
Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };

const T = 20;

/* ---------------------------------------------------------------------- */
/* 1. Topology audit                                                       */
/* ---------------------------------------------------------------------- */
function floodFrom(env, grid, sr, sc, gatesOpen) {
  const R = env.GRID_ROWS, C = env.GRID_COLS;
  const blocked = t => t === env.T_SOLID || (!gatesOpen && (t === env.T_GATE || t === env.T_CRACKED));
  const seen = new Set([sr + ',' + sc]);
  const stack = [[sr, sc]];
  while (stack.length) {
    const [r, c] = stack.pop();
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= R || nc < 0 || nc >= C || seen.has(nr + ',' + nc) || blocked(grid[nr][nc])) continue;
      seen.add(nr + ',' + nc); stack.push([nr, nc]);
    }
  }
  return seen;
}

suite('1. Gates seal the fountain & dews stay outside', () => {
  const env = createEnv();
  loadAll(env);
  env.LEVELS.forEach((L, i) => {
    const room = `Room ${i + 1}`;
    const sr = Math.floor(L.playerStart.y / T), sc = Math.floor(L.playerStart.x / T);
    let goal = null; const gates = [];
    L.grid.forEach((row, r) => row.forEach((t, c) => {
      if (t === env.T_GOAL) goal = [r, c];
      if (t === env.T_GATE) gates.push([r, c]);
    }));
    assert(L.grid[sr][sc] !== env.T_SOLID, `${room}: start tile is free`);
    assert(goal && gates.length >= 1, `${room}: has a fountain and at least one gate tile`);
    const closed = floodFrom(env, L.grid, sr, sc, false);
    const open = floodFrom(env, L.grid, sr, sc, true);
    const key = ([r, c]) => r + ',' + c;
    assert(!closed.has(key(goal)), `${room}: fountain is NOT reachable while the gate is closed (gate really blocks the road)`);
    assert(open.has(key(goal)), `${room}: fountain IS reachable once the gate opens`);
    assert(gates.some(([r, c]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dr, dc]) => closed.has((r + dr) + ',' + (c + dc)))), `${room}: the gate touches the area the player can actually reach`);
    assert(L.dews.length === 3, `${room}: 3 dews`);
    L.dews.forEach((d, k) => {
      const r = Math.floor(d.y / T), c = Math.floor(d.x / T);
      assert(L.grid[r][c] === env.T_AIR, `${room}: dew ${k + 1} floats in open air (not inside stone)`);
      assert(closed.has(key([r, c])), `${room}: dew ${k + 1} is collectable before the gate opens`);
    });
  });
});

/* ---------------------------------------------------------------------- */
/* 2. Autopilot                                                            */
/* ---------------------------------------------------------------------- */
function pilot(levelIndex, buddySwitches = 0) {
  const env = createEnv();
  loadAll(env);
  const g = new env.SquishyGame();
  g.audio.init = () => {};
  g.loadLevel(levelIndex);
  g.state = 'PLAYING';
  for (let i = 0; i < buddySwitches; i++) g.player.nextBuddy();
  const DT = 1 / 60;
  const P = {
    env, g,
    get p() { return g.player; },
    frames: 0,
    // remembers the state of the room being played, because clearing it immediately loads the next one
    tick(n = 1) {
      for (let i = 0; i < n; i++) {
        g.update(DT); P.frames++;
        if (g.levelIndex === levelIndex) {
          P.lastDews = g.dews.filter(d => d.collected).length;
          P.lastGateOpen = !g.grid.some(row => row.includes(env.T_GATE));
        }
      }
    },
    keys(k) { g.input.left = k.includes('L'); g.input.right = k.includes('R'); g.input.down = k.includes('D'); },
    hold(k, n) { P.keys(k); P.tick(n); },
    press() { g.input.a = true; g.player.jump(g.input); g.input.a = false; },
    jump(k, n) { P.keys(k); P.press(); P.tick(n); },
    spit() { const b = g.player.spitBubble(); if (b) g.pushBubble(b); return b; },
    walkTo(x, tol = 1.5, max = 400) { for (let i = 0; i < max; i++) { const dx = x - g.player.x; if (Math.abs(dx) < tol) break; P.keys(dx > 0 ? 'R' : 'L'); P.tick(); } P.keys(''); },
    waitGround(max = 240) { for (let i = 0; i < max && !g.player.onGround; i++) P.tick(); },
    lastDews: 0, lastGateOpen: false,
    dewsCollected() { return P.lastDews; }
  };
  P.tick(2);
  return P;
}

const roomCleared = (P, room) => P.g.levelIndex > room || P.g.state === 'VICTORY';

// ---- Room 1: staircase of floating blocks + 60px wall -> SOLID bubble step -> ledge -> gate ----
function playRoom1({ skipDew3 = false } = {}) {
  const P = pilot(0);
  const { g } = P;
  if (!skipDew3) {
    P.walkTo(75); P.waitGround();
    P.walkTo(248); P.jump('', 40); P.waitGround();           // dew 3 lives on the floor, right of the shelf
    P.walkTo(72, 1.5, 300);
    P.jump('L', 22); P.hold('L', 10); P.waitGround();         // back up onto the start shelf
  }
  P.walkTo(50);
  P.jump('R', 30); P.waitGround();                            // block 1 (+40)  - dew 1
  P.walkTo(108); P.jump('', 15); P.hold('R', 30); P.waitGround(); // block 2 (+40)
  P.jump('', 40); P.waitGround();                             // dew 2
  P.walkTo(142); P.keys('R'); P.tick(1); P.keys('');          // face the 60px wall
  P.jump('', 10); P.spit();                                   // spit a SOLID bubble while rising
  for (let i = 0; i < 80; i++) { P.hold(i < 12 ? '' : 'R', 2); if (g.player.onGround) break; }
  P.keys('R'); P.press();                                     // hop onto the bubble...
  let jumped = false;
  for (let i = 0; i < 400 && !roomCleared(P, 0); i++) {
    P.tick();
    if (!jumped && g.player.onGround && g.player.y < 85) { P.press(); jumped = true; } // ...then up onto the ledge
  }
  return P;
}

// ---- Room 2: switch to Blue, ride a FLOAT bubble over the spikes, hop onto the ledge ----
function playRoom2() {
  const P = pilot(1, 1);
  const { g } = P;
  P.walkTo(70, 1); P.keys('R'); P.tick(1); P.keys('');
  P.spit(); P.hold('', 20);
  P.jump('R', 24);
  for (let i = 0; i < 90; i++) { P.hold('', 1); if (g.player.onGround) break; }   // land on the rising bubble
  P.keys('R'); P.press();                                                          // hop to the ledge
  for (let i = 0; i < 120; i++) { P.tick(); if (i > 20 && g.player.onGround) break; }
  P.jump('', 30); P.waitGround();
  P.walkTo(300, 1, 300);                                                           // through the open gate
  return P;
}

// ---- Room 3: switch to Pink, stick a STICKY peg on the cliff, jump to the cliff top, cross, gate, goal ----
function playRoom3() {
  const P = pilot(2, 2);
  const { g } = P;
  P.walkTo(190, 1, 800); P.waitGround();
  P.walkTo(176.5, 0.6, 200); P.tick(20); P.waitGround();
  // jump straight up, press into the wall above the overhang, spit a peg while rising, land on it
  P.press();
  let spat = false;
  for (let i = 0; i < 240; i++) {
    if (g.player.y < 170) P.keys('L');
    P.tick();
    if (!spat && g.player.y <= 150 && g.player.vy <= -100) { P.spit(); spat = true; }
    if (spat && g.player.onGround && g.player.vy === 0 && i > 8) break;
  }
  // second jump from the peg clears the cliff top (y=60); let go of the wall once above it
  P.keys('L'); P.press();
  for (let i = 0; i < 120; i++) { if (g.player.x <= 152) P.keys(''); P.tick(); if (i > 10 && g.player.onGround) break; }
  P.walkTo(146, 1.5, 100);
  P.keys('L'); P.press();                                        // leap the 2-tile gap onto the ledge
  for (let i = 0; i < 120; i++) { P.tick(); if (i > 10 && g.player.onGround) break; }
  P.keys('');
  P.walkTo(25, 2, 300);                                          // through the open gate to the fountain
  return P;
}

// ---- Room 4: switch to Green, jump to block and ledge, crawl through the tunnel ----
function playRoom4() {
  const P = pilot(3, 3);
  const { g } = P;
  P.walkTo(235, 3, 700); P.waitGround(); P.jump('', 40); P.waitGround();              // dew 3 (lower right)
  P.walkTo(100, 3, 600);
  P.keys('L'); P.press(); for (let i = 0; i < 60; i++) { P.tick(); if (i > 8 && g.player.onGround) break; } P.keys('');  // up onto the shelf
  P.walkTo(66, 2, 100);
  P.jump('', 12); P.hold('R', 25); P.waitGround();                                    // block (+80) - dew 1
  P.walkTo(130, 2, 100);
  P.keys('R'); P.press();                                                             // leap to the ledge (+60) - dew 2
  for (let i = 0; i < 150; i++) { P.tick(); if (i > 10 && g.player.onGround) break; }
  P.keys('RD');                                                                       // crawl through tunnel, gate, fountain
  for (let i = 0; i < 400 && !roomCleared(P, 3); i++) P.tick();
  return P;
}

// ---- Room 5: climb the stairs, stand by the sealed gate, defeat the Titan, walk into the chamber ----
function playRoom5({ defeatBoss = true } = {}) {
  const P = pilot(4);
  const { g } = P;
  g.boss.isEncased = true; g.boss.encasedTimer = 9999;        // keep the Titan harmlessly stunned during the walk
  const leap = (x, pre = 18, run = 22) => { P.walkTo(x, 1.5, 120); P.tick(8); P.jump('', pre); P.hold('R', run); P.waitGround(); };
  leap(44); leap(86); leap(146, 12, 20);                        // A, B, walkway
  const gateClosedAt = { cracked: g.grid[4][10], gate: g.grid[4][12] };
  P.walkTo(186, 2, 100); P.jump('R', 18); P.hold('R', 15); P.waitGround();   // hop onto the cracked rocks
  P.walkTo(228, 2, 80);
  const nextToGate = { x: g.player.x, gate: g.grid[4][12] };
  if (defeatBoss) {
    P.walkTo(190, 2, 120); P.waitGround();
    g.triggerBossDefeated(); P.tick(30);
    P.keys('R');
    for (let i = 0; i < 300 && !roomCleared(P, 4); i++) P.tick();
  } else {
    P.keys('R'); P.tick(60);
  }
  return Object.assign(P, { gateClosedAt, nextToGate });
}

// ---- Room 6 (Stage 2-1): Yellow SOLID step + Blue encase creep + Purple CHAIN_POP blast cracked rock ----
function playRoom6() {
  const P = pilot(5);
  const { g } = P;
  // Encase the lower-floor patrol creep or neutralize it while collecting dew 3
  g.sludges.forEach(s => { s.isEncased = true; s.encasedTimer = 99; });
  P.walkTo(75); P.waitGround();
  P.walkTo(248); P.jump('', 40); P.waitGround();           // dew 3
  P.walkTo(72, 1.5, 300);
  P.jump('L', 22); P.hold('L', 10); P.waitGround();         // back onto start shelf
  P.walkTo(50);
  P.jump('R', 30); P.waitGround();                          // block 1 - dew 1
  P.walkTo(108); P.jump('', 15); P.hold('R', 30); P.waitGround(); // block 2
  P.jump('', 40); P.waitGround();                           // dew 2
  P.walkTo(142); P.keys('R'); P.tick(1); P.keys('');        // face 60px wall
  P.jump('', 10); P.spit();                                 // Yellow SOLID bubble step
  for (let i = 0; i < 80; i++) { P.hold(i < 12 ? '' : 'R', 2); if (g.player.onGround) break; }
  P.keys('R'); P.press();
  let jumped = false;
  for (let i = 0; i < 120; i++) {
    P.tick();
    if (!jumped && g.player.onGround && g.player.y < 85) { P.press(); jumped = true; }
    if (jumped && g.player.onGround && g.player.y < 60) break;
  }
  // Walk to the opened gate where cracked rock (2,12) blocks the way, switch to Purple, and blast it!
  P.walkTo(222, 1.5, 160);
  g.player.setType('PURPLE');
  P.keys('R'); P.tick(2); P.keys('');
  P.spit();
  for (let i = 0; i < 200 && !roomCleared(P, 5); i++) {
    P.keys('R'); P.tick();
  }
  return P;
}

// ---- Room 7 (Stage 2-2): Blue FLOAT bubble ride over spikes + Crawlway Slide through ice tunnel ----
function playRoom7() {
  const P = pilot(6, 1); // Blue
  const { g } = P;
  P.walkTo(70, 1); P.keys('R'); P.tick(1); P.keys('');
  P.spit(); P.hold('', 20);
  P.jump('R', 24);
  for (let i = 0; i < 90; i++) { P.hold('', 1); if (g.player.onGround) break; }
  P.keys('R'); P.press();
  for (let i = 0; i < 120; i++) { P.tick(); if (i > 20 && g.player.onGround) break; }
  P.walkTo(190, 2, 100); P.waitGround(); // collects dew 3 right in front of the crawlway
  P.keys('RD'); // crouch/slide through the 1-tile ice crawlway into the open gate & fountain
  for (let i = 0; i < 350 && !roomCleared(P, 6); i++) P.tick();
  return P;
}

// ---- Room 8 (Stage 2-3): Pink STICKY climb up central spire + Purple CHAIN_POP shatter crystal seal ----
function playRoom8() {
  const P = pilot(7, 2); // Pink
  const { g } = P;
  P.walkTo(190, 1, 800); P.waitGround();
  P.walkTo(176.5, 0.6, 200); P.tick(20); P.waitGround();
  P.press();
  let spat = false;
  for (let i = 0; i < 240; i++) {
    if (g.player.y < 170) P.keys('L');
    P.tick();
    if (!spat && g.player.y <= 150 && g.player.vy <= -100) { P.spit(); spat = true; }
    if (spat && g.player.onGround && g.player.vy === 0 && i > 8) break;
  }
  P.keys('L'); P.press();
  for (let i = 0; i < 120; i++) { if (g.player.x <= 152) P.keys(''); P.tick(); if (i > 10 && g.player.onGround) break; }
  P.walkTo(146, 1.5, 100);
  P.keys('L'); P.press();
  for (let i = 0; i < 120; i++) { P.tick(); if (i > 10 && g.player.onGround) break; }
  P.keys('');
  // Walk to the cracked crystal at (2,2), switch to Purple, spit CHAIN_POP & detonate!
  P.walkTo(78, 1.5, 150);
  g.player.setType('PURPLE');
  P.keys('L'); P.tick(2); P.keys('');
  P.spit();
  for (let i = 0; i < 200 && !roomCleared(P, 7); i++) {
    P.keys('L'); P.tick();
  }
  return P;
}

// ---- Room 9 (Stage 2-4): Green high jump + crawlway + Purple CHAIN_POP blast ----
function playRoom9() {
  const P = pilot(8, 3); // Green
  const { g } = P;
  P.walkTo(235, 3, 700); P.waitGround(); P.jump('', 40); P.waitGround(); // dew 3
  P.walkTo(100, 3, 600);
  P.keys('L'); P.press(); for (let i = 0; i < 60; i++) { P.tick(); if (i > 8 && g.player.onGround) break; } P.keys('');
  P.walkTo(66, 2, 100);
  P.jump('', 12); P.hold('R', 25); P.waitGround(); // dew 1
  P.walkTo(130, 2, 100);
  P.keys('R'); P.press(); // leap to upper ledge - dew 2
  for (let i = 0; i < 150; i++) { P.tick(); if (i > 10 && g.player.onGround) break; }
  // Crawl through (2,10..11) and open gate (2,12), then switch to Purple to blast (2,13)
  g.player.setType('PURPLE');
  for (let i = 0; i < 220 && g.player.x < 244; i++) { P.keys('RD'); P.tick(); }
  P.keys('R'); P.spit();
  for (let i = 0; i < 200 && !roomCleared(P, 8); i++) { P.keys('RD'); P.tick(); }
  return P;
}

// ---- Room 10 (Stage 2-5): Final Crystal Boss (12 HP) ----
function playRoom10() {
  const P = pilot(9);
  const { g } = P;
  g.boss.isEncased = true; g.boss.encasedTimer = 9999;
  const leap = (x, pre = 18, run = 22) => { P.walkTo(x, 1.5, 120); P.tick(8); P.jump('', pre); P.hold('R', run); P.waitGround(); };
  leap(44); leap(86); leap(146, 12, 20);
  P.walkTo(190, 2, 120); P.waitGround();
  g.triggerBossDefeated(); P.tick(30);
  P.keys('R');
  for (let i = 0; i < 300 && !roomCleared(P, 9); i++) P.tick();
  return P;
}

suite('2. Every room is completable with the real physics', () => {
  const r1 = playRoom1();
  assert(r1.dewsCollected() === 3 && r1.lastGateOpen, 'Room 1: all dews collected, gate opened');
  assert(roomCleared(r1, 0), `Room 1 cleared with Yellow (SOLID bubble step) in ${r1.frames} frames`);

  const r2 = playRoom2();
  assert(r2.dewsCollected() === 3, 'Room 2: all 3 dews collected on the float-bubble ride');
  assert(roomCleared(r2, 1), `Room 2 cleared with Blue (FLOAT bubble ride) in ${r2.frames} frames`);

  const r3 = playRoom3();
  assert(r3.dewsCollected() === 3, 'Room 3: all 3 dews collected on the way up the cliff');
  assert(roomCleared(r3, 2), `Room 3 cleared with Pink (STICKY peg) in ${r3.frames} frames`);

  const r4 = playRoom4();
  assert(r4.dewsCollected() === 3, 'Room 4: all 3 dews collected');
  assert(roomCleared(r4, 3), `Room 4 cleared with Green (big jump + crawlway) in ${r4.frames} frames`);

  const r5 = playRoom5();
  assert(r5.gateClosedAt.cracked === r5.env.T_CRACKED && r5.gateClosedAt.gate === r5.env.T_GATE, 'Room 5: cracked rocks + gate are intact while the Titan lives');
  assert(r5.nextToGate.gate === r5.env.T_GATE && r5.nextToGate.x > 220, 'Room 5: the player can walk up to the closed gate (cracked rocks hold)');
  assert(roomCleared(r5, 4), `Room 5 cleared: Titan defeated, gate open, Stage 2 unlocked (${r5.frames} frames)`);

  const r6 = playRoom6();
  assert(r6.dewsCollected() === 3 && roomCleared(r6, 5), `Room 6 cleared with Yellow + Purple (SOLID step + CHAIN_POP rock blast) in ${r6.frames} frames`);

  const r7 = playRoom7();
  assert(r7.dewsCollected() === 3 && roomCleared(r7, 6), `Room 7 cleared with Blue + Crawlway Slide in ${r7.frames} frames`);

  const r8 = playRoom8();
  assert(r8.dewsCollected() === 3 && roomCleared(r8, 7), `Room 8 cleared with Pink + Purple (STICKY spire climb + CHAIN_POP seal break) in ${r8.frames} frames`);

  const r9 = playRoom9();
  assert(r9.dewsCollected() === 3 && roomCleared(r9, 8), `Room 9 cleared with Green + Crawlway + Purple in ${r9.frames} frames`);

  const r10 = playRoom10();
  assert(r10.g.state === 'VICTORY', `Room 10 cleared: Frost-Crystal Boss defeated, final VICTORY reached (${r10.frames} frames)`);
});

suite('3. The gates really block the way', () => {
  const r1 = playRoom1({ skipDew3: true });
  assert(r1.dewsCollected() === 2, 'Room 1 (skipping one dew): only 2 dews collected');
  assert(r1.g.grid[2][11] === r1.env.T_GATE && r1.g.levelIndex === 0, 'Room 1: the gate stays shut and the room is NOT cleared without every dew');
  assert(r1.p.x < 235, 'Room 1: the buddy is stopped in front of the gate');

  const r5 = playRoom5({ defeatBoss: false });
  assert(r5.g.grid[4][12] === r5.env.T_GATE && r5.g.state === 'PLAYING', 'Room 5: while the Titan lives the gate holds and nobody reaches the fountain');
  assert(r5.p.x < 240, 'Room 5: the buddy is stopped in front of the gate');
});

console.log(`\n==================================================\n📊 LEVEL TEST RESULTS: ${passed} passed, ${failed} failed\n==================================================\n`);
process.exit(failed > 0 ? 1 : 0);
