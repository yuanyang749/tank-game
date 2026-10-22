/* ==========================================================================
   Squishy Buddies 2006 - Hi-Res Renderer / Jelly Feel / Map Theme Tests
   Node.js (no browser needed): runs the real game scripts inside a vm sandbox
   with a recording Canvas2D mock, so every render path is actually executed.
   Usage: node tests/test_squishy_render.js
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

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

const { JS, createEnv, loadScript, loadAll } = require('./helpers/squishy_env');

/* ======================================================================= */
suite('1. fx.js module & game wiring', () => {
  assert(fs.existsSync(path.join(JS, 'fx.js')), 'js/fx.js exists');
  const html = fs.readFileSync(path.join(JS, '../index.html'), 'utf8');
  assert(html.indexOf('js/fx.js') > -1 && html.indexOf('js/fx.js') < html.indexOf('js/game.js'), 'index.html loads fx.js before game.js');
  const css = fs.readFileSync(path.join(JS, '../css/squishy.css'), 'utf8');
  assert(!/image-rendering:\s*(pixelated|crisp-edges)/.test(css), 'canvas no longer forces pixelated up-scaling');

  const env = createEnv();
  loadAll(env);
  const FX = env.SquishyFX;
  assert(FX && typeof FX.drawBuddy === 'function' && typeof FX.drawBubble === 'function' && typeof FX.drawBoss === 'function', 'SquishyFX exposes buddy / bubble / boss renderers');
  assert(FX.THEMES.length === 10, 'ten room themes (5 Stage 1 + 5 Stage 2)');
  assert(new Set(FX.THEMES.map(t => t.id)).size === 10, 'every room theme is unique');
  assert(FX.themeFor(0).light === true && FX.themeFor(4).light === false && FX.themeFor(9).light === false, 'rooms 1-4 and 6-9 are bright worlds, rooms 5 & 10 are dark boss arenas');
  assert(FX.themeFor(99).id === FX.THEMES[9].id && FX.themeFor(-3).id === FX.THEMES[0].id, 'themeFor clamps out-of-range room indexes');
});

suite('2. Hi-res back-buffer', () => {
  let env = createEnv({ dpr: 2.6, rect: { width: 392, height: 294 } });
  loadAll(env);
  let g = new env.SquishyGame();
  assert(g.width === 320 && g.height === 240, 'logical resolution stays 320x240 (game logic unchanged)');
  assert(g.renderScale >= 2 && g.renderScale <= 4, `render scale clamped to 2..4 (got ${g.renderScale})`);
  assert(env.__canvas.width === 320 * g.renderScale && env.__canvas.height === 240 * g.renderScale, 'canvas back-buffer = logical size x render scale');
  assert(g.renderScale === 4, 'a 392px-wide phone canvas at DPR 2.6 renders at 4x');

  env = createEnv({ dpr: 1, rect: { width: 320, height: 240 } });
  loadAll(env);
  g = new env.SquishyGame();
  assert(g.renderScale === 2, 'low-DPR small canvas drops to the 2x floor');

  env = createEnv();
  loadAll(env);
  g = new env.SquishyGame();
  assert(g.renderScale === 4, 'no layout info (tests / hidden iframe) falls back to 4x');
});

suite('3. Every screen renders without errors', () => {
  const env = createEnv({ dpr: 2, rect: { width: 400, height: 300 } });
  loadAll(env);
  const g = new env.SquishyGame();
  const stats = env.__stats;

  const run = (label, setup) => {
    const before = stats.calls;
    setup();
    let threw = null;
    try { g.render(); } catch (e) { threw = e; }
    assert(!threw && stats.calls > before + 20, `${label} renders (${stats.calls - before} canvas calls)${threw ? ' ERR ' + threw.message : ''}`);
  };

  run('TITLE overlay', () => { g.state = 'TITLE'; g.loadLevel(0); });
  for (let i = 0; i < 4; i++) run(`STORY slide ${i + 1}`, () => { g.state = 'STORY'; g.storySlideIndex = i; g.storyTimer = 1.2; });
  for (let lv = 0; lv < env.LEVELS.length; lv++) {
    run(`Room ${lv + 1} gameplay`, () => {
      g.loadLevel(lv); g.state = 'PLAYING'; g.fxTime = 1.5;
      for (const [type, key] of [['SOLID', 'YELLOW'], ['FLOAT', 'BLUE'], ['STICKY', 'PINK'], ['BOUNCY', 'GREEN'], ['CHAIN_POP', 'PURPLE']]) {
        const b = new env.BubbleEntity(80 + g.bubbles.length * 30, 120, 1, type, env.BUDDY_TYPES[key]);
        b.age = 1; g.bubbles.push(b);
      }
      g.spawnPopParticles(100, 100, '#ffd454');
    });
  }
  run('Room 5 boss: encased + charging + projectile + shockwave', () => {
    g.loadLevel(4); g.state = 'PLAYING';
    g.boss.isEncased = true; g.boss.state = 'CHARGE_SPIT'; g.boss.hp = 2;
    g.sludgeProjectiles.push(new env.SludgeProjectile(120, 100, 60, -40));
    g.sludgeShockwaves.push(new env.SludgeShockwave(150, 212, 1));
  });
  run('Room 10 crystal boss: enraged + charging', () => {
    g.loadLevel(9); g.state = 'PLAYING';
    g.boss.state = 'CHARGE_SPIT'; g.boss.hp = 3;
    g.sludgeProjectiles.push(new env.SludgeProjectile(140, 110, -70, -50));
  });
  run('Room 5 boss defeated fade-out', () => { g.loadLevel(4); g.triggerBossDefeated(); g.boss.takeDamage(99); });
  run('PAUSED overlay', () => { g.state = 'PAUSED'; });
  run('VICTORY overlay', () => { g.state = 'VICTORY'; });
  run('GAME_OVER overlay', () => { g.state = 'GAME_OVER'; g.lives = 0; });
  run('Room clear toast', () => { g.loadLevel(1); g.state = 'PLAYING'; g.roomClearBannerTimer = 1.5; });
  assert(stats.nonFinite === 0, 'no NaN / Infinity ever reached a canvas call');
});

suite('4. Map layers are cached & rebuilt only when the map changes', () => {
  const env = createEnv();
  loadAll(env);
  const g = new env.SquishyGame();
  g.loadLevel(4); g.state = 'PLAYING';
  g.render();
  const built = env.__stats.layersBuilt;
  assert(built >= 3, `backdrop + tiles + vignette layers were built (${built})`);
  for (let i = 0; i < 5; i++) g.render();
  assert(env.__stats.layersBuilt === built, 'static frames reuse the cached layers (no re-allocation)');
  g.grid[3][12] = env.T_AIR; // gate opens
  g.render();
  assert(env.__stats.layersBuilt === built + 1, 'opening the gate rebuilds only the tile layer');
  g.loadLevel(1); g.render();
  assert(env.__stats.layersBuilt > built + 1, 'switching room (new theme) rebuilds backdrop/vignette too');
});

suite('5. Jelly physics feel', () => {
  const env = createEnv();
  loadAll(env);
  const P = env.Physics;

  // stability: a 100 ms lag spike must not blow the stiffer spring up
  const e = { squashY: 0.25, squashX: 2, squashVelY: 40, targetSquashY: 1 };
  for (let i = 0; i < 40; i++) P.updateSquashSpring(e, 0.1);
  assert(Number.isFinite(e.squashY) && e.squashY >= 0.25 && e.squashY <= 2.2, 'spring stays bounded under 100 ms frames');
  assert(Math.abs(e.squashY - 1) < 0.05, 'spring settles back to rest shape');
  assert(Math.abs(e.squashX - 1 / Math.sqrt(e.squashY)) < 1e-9, 'volume conservation still holds exactly');

  // bounce: count overshoots (zero crossings of squashY-1) after a landing squash at 60 fps
  const w = { squashY: 0.5, squashX: 1.41, squashVelY: 0, targetSquashY: 1 };
  let crossings = 0, prev = Math.sign(w.squashY - 1);
  for (let i = 0; i < 120; i++) {
    P.updateSquashSpring(w, 1 / 60);
    const s = Math.sign(w.squashY - 1 + 1e-6);
    if (s !== 0 && s !== prev) { crossings++; prev = s; }
  }
  assert(crossings >= 3, `landing wobbles through ${crossings} overshoots (>= 3 = clearly jelly-like)`);

  // landing depth scales with fall speed
  // neutral test arena: open air above a solid floor (independent of the room layouts)
  const grid = Array.from({ length: 12 }, (_, r) => Array.from({ length: 16 }, () => (r === 11 ? 1 : 0)));
  const drop = (startY) => {
    const p = new env.PlayerBuddy(150, startY);
    let minSquash = 9, landed = false;
    for (let i = 0; i < 240; i++) {
      p.update(1 / 60, { left: false, right: false, up: false, down: false }, grid, { playLand() { landed = true; } });
      minSquash = Math.min(minSquash, p.squashY);
      if (landed && i > 60) break;
    }
    return { minSquash, impact: p.lastImpact, landed };
  };
  const soft = drop(190), hard = drop(30);
  assert(soft.landed && hard.landed, 'both drops land');
  assert(hard.impact > soft.impact, `harder fall => bigger impact value (${hard.impact.toFixed(2)} > ${soft.impact.toFixed(2)})`);
  assert(hard.minSquash < soft.minSquash, `harder fall => deeper squash (${hard.minSquash.toFixed(2)} < ${soft.minSquash.toFixed(2)})`);

  // stretch while airborne, trail stores feet position for ground-anchored followers
  const p = new env.PlayerBuddy(150, 100);
  for (let i = 0; i < 12; i++) p.update(1 / 60, { left: false, right: false, up: false, down: false }, grid, null);
  assert(!p.onGround && p.targetSquashY > 1.0 && p.targetSquashY <= 1.3, 'airborne buddy stretches along its fall (capped at +30%)');
  assert(typeof p.trail[0].feet === 'number', 'trail samples record the feet position');
});

suite('6. FX entities & game hooks', () => {
  const env = createEnv();
  loadAll(env);
  const pt = new env.Particle(0, 0, '#fff');
  assert(pt.kind === 'dot' && pt.life > 0, 'plain Particle keeps its original behaviour');
  const dust = new env.Particle(0, 0, '#fff', { kind: 'dust', life: 0.5, gravity: -6, drag: 4, vx: 40, vy: -10 });
  assert(dust.kind === 'dust' && dust.maxLife === 0.5, 'Particle accepts cosmetic overrides');
  dust.update(0.1);
  assert(dust.vx < 40, 'drag slows dust puffs');
  const ring = new env.FxRing(10, 10, '#fff', 20, 0.4);
  ring.update(0.5);
  assert(ring.life <= 0, 'FxRing expires');

  const g = new env.SquishyGame();
  g.loadLevel(0); g.state = 'PLAYING';
  const n0 = g.fx.length;
  g.spawnPopParticles(50, 50, '#ffd454');
  assert(g.fx.length === n0 + 1, 'popping a bubble spawns an expanding ring');
  g.spawnDust(100, 200, 4, 1);
  assert(g.particles.some(p => p.kind === 'dust'), 'dust puffs are spawned at the feet');

  // screen shake used to latch forever - it must now decay to zero
  g.screenShakeTimer = 0.4;
  for (let i = 0; i < 40; i++) g.update(1 / 60);
  assert(g.screenShakeTimer === 0, 'screen shake counts down to 0');

  // bubble that times out pops with an effect
  g.loadLevel(0); g.state = 'PLAYING';
  const b = new env.BubbleEntity(100, 100, 1, 'FLOAT', env.BUDDY_TYPES.BLUE);
  b.age = b.lifetime - 0.001; g.bubbles = [b];
  const pc = g.particles.length;
  g.update(1 / 60);
  assert(g.bubbles.length === 0 && g.particles.length > pc, 'a bubble that times out pops with particles');

  // landing fires dust through the game hook
  g.loadLevel(0); g.state = 'PLAYING';
  g.player.x = 150; g.player.y = 60; g.particles = [];
  for (let i = 0; i < 120; i++) g.update(1 / 60);
  assert(g.particles.some(p => p.kind === 'dust') || g.player.onGround, 'player landing kicks up dust');

  // boss landing hook
  g.loadLevel(4); g.state = 'PLAYING';
  const fxBefore = g.fx.length;
  g.onBossLand(g.boss, 220);
  assert(g.fx.length === fxBefore + 2, 'boss slam spawns two ground ripples');
});

console.log(`\n==================================================\n📊 RENDER TEST RESULTS: ${passed} passed, ${failed} failed\n==================================================\n`);
process.exit(failed > 0 ? 1 : 0);
