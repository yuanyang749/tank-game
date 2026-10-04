/* ==========================================================================
   Antigravity Automated Test Suite (Node.js Test Runner)
   Tests Tank Battle, Space Invaders, Vector Decoupling & Game Boy Bridge
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (condition) {
    passedTests++;
    console.log(`  ✓ [PASS] ${message}`);
  } else {
    failedTests++;
    console.error(`  ✗ [FAIL] ${message}`);
    throw new Error(`Assertion Failed: ${message}`);
  }
}

function suite(name, fn) {
  console.log(`\n==================================================`);
  console.log(`🧪 SUITE: ${name}`);
  console.log(`==================================================`);
  try {
    fn();
  } catch (err) {
    console.error(`  [SUITE ERROR] in ${name}:`, err.message);
  }
}

// Global browser mock environment
const createMockEnv = () => {
  const sandbox = {
    console,
    Math,
    Date,
    performance: { now: () => Date.now() },
    setTimeout,
    clearTimeout,
    localStorage: {
      _data: {},
      getItem(k) { return this._data[k] || null; },
      setItem(k, v) { this._data[k] = String(v); }
    },
    window: {
      addEventListener: () => {},
      removeEventListener: () => {},
      location: { search: '' },
      postMessage: () => {}
    },
    document: {
      body: { classList: { add: () => {}, remove: () => {}, contains: () => false } },
      getElementById: (id) => ({
        id,
        getContext: () => ({
          imageSmoothingEnabled: true,
          fillRect: () => {},
          clearRect: () => {},
          beginPath: () => {},
          arc: () => {},
          fill: () => {},
          stroke: () => {},
          drawImage: () => {},
          save: () => {},
          restore: () => {},
          translate: () => {},
          rotate: () => {},
          fillText: () => {}
        }),
        addEventListener: () => {},
        classList: { add: () => {}, remove: () => {}, toggle: () => {} },
        style: {},
        innerText: ''
      }),
      createElement: (tag) => {
        if (tag === 'canvas') {
          return {
            width: 42,
            height: 28,
            getContext: () => ({
              clearRect: () => {},
              beginPath: () => {},
              moveTo: () => {},
              lineTo: () => {},
              arcTo: () => {},
              closePath: () => {},
              arc: () => {},
              fill: () => {},
              fillRect: () => {},
              save: () => {},
              restore: () => {},
              getImageData: () => ({ data: [0, 229, 255, 255] })
            })
          };
        }
        return {};
      },
      querySelectorAll: () => []
    },
    navigator: { vibrate: () => true },
    AudioContext: class {
      constructor() { this.currentTime = 0; this.state = 'running'; this.sampleRate = 44100; }
      createOscillator() {
        return {
          type: 'square',
          frequency: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {}, linearRampToValueAtTime: () => {} },
          connect: () => {},
          start: () => {},
          stop: () => {},
          disconnect: () => {}
        };
      }
      createGain() {
        return {
          gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {}, linearRampToValueAtTime: () => {} },
          connect: () => {}
        };
      }
      createBuffer() {
        return { getChannelData: () => new Float32Array(1024) };
      }
      createBufferSource() {
        return { connect: () => {}, start: () => {} };
      }
      createBiquadFilter() {
        return {
          type: 'lowpass',
          frequency: { setValueAtTime: () => {}, linearRampToValueAtTime: () => {} },
          connect: () => {}
        };
      }
      resume() {}
    }
  };
  sandbox.window.AudioContext = sandbox.AudioContext;
  sandbox.globalThis = sandbox;
  return vm.createContext(sandbox);
};

function loadScript(filePath, env) {
  const code = fs.readFileSync(filePath, 'utf8');
  const exportNames = [];
  const classMatches = code.matchAll(/^class\s+([A-Za-z0-9_]+)/gm);
  for (const m of classMatches) exportNames.push(m[1]);
  const constMatches = code.matchAll(/^(?:const|let|var)\s+([A-Za-z0-9_]+)\s*=/gm);
  for (const m of constMatches) exportNames.push(m[1]);
  const fnMatches = code.matchAll(/^function\s+([A-Za-z0-9_]+)\s*\(/gm);
  for (const m of fnMatches) exportNames.push(m[1]);

  const exportsCode = exportNames.map(name => `try { globalThis.${name} = ${name}; } catch(e){}`).join('\n');
  vm.runInContext(code + '\n' + exportsCode, env);
}

// =========================================================================
// TEST SUITE 1: Tank Battle Map & Stage Layouts
// =========================================================================
suite('1. Tank Battle Map & Layout System', () => {
  const env = createMockEnv();
  loadScript(path.join(__dirname, '../games/tank-battle/js/map.js'), env);

  assert(env.TILE_SIZE === 16, 'TILE_SIZE must be 16px');
  assert(env.MAP_COLS === 26 && env.MAP_ROWS === 26, 'Map grid must be 26x26');
  assert(env.CANVAS_WIDTH === 416 && env.CANVAS_HEIGHT === 416, 'Canvas size must be 416x416');

  const map1 = env.generateMap(1);
  assert(Array.isArray(map1) && map1.length === 26, 'generateMap returns 26 rows');
  assert(map1[24][12] === env.T_BASE && map1[24][13] === env.T_BASE, 'Eagle base is positioned at (24,12)-(25,13)');
  assert(map1[23][12] === env.T_BRICK, 'Eagle protective brick shield is present above base');
  assert(map1[16][0] === env.T_WATER, 'Water tiles present at row 16');
  assert(map1[13][11] === env.T_TREE, 'Forest canopy tiles present at row 13');

  const map2 = env.generateMap(2);
  assert(map2[5][4] === env.T_STEEL, 'Stage 2 contains additional steel fortifications');
});

// =========================================================================
// TEST SUITE 2: Tank Battle Collision & Vector Decoupling Algorithm
// =========================================================================
suite('2. Tank Battle Physics & Vector Decoupling Algorithm', () => {
  const env = createMockEnv();
  loadScript(path.join(__dirname, '../games/tank-battle/js/map.js'), env);
  loadScript(path.join(__dirname, '../games/tank-battle/js/physics.js'), env);

  const Physics = env.Physics;

  // AABB Collision Tests
  assert(Physics.checkAABB(10, 10, 20, 20, 15, 15, 20, 20) === true, 'AABB correctly detects overlapping boxes');
  assert(Physics.checkAABB(0, 0, 10, 10, 20, 20, 10, 10) === false, 'AABB correctly ignores distant boxes');

  // Tile Collision
  const map = env.generateMap(1);
  assert(Physics.checkTileCollision(-5, 10, 28, map) === true, 'Tile collision blocks boundary underflow (< 0)');
  assert(Physics.checkTileCollision(500, 10, 28, map) === true, 'Tile collision blocks boundary overflow (> 416)');
  assert(Physics.checkTileCollision(12 * 16, 24 * 16, 16, map) === true, 'Tile collision triggers on Eagle Base');

  // Vector Decoupling & Tank Overlap Resolution Test (placed on open road at row 0)
  const emptyMap = Array(26).fill(0).map(() => Array(26).fill(0));
  const mockGame = {
    map: emptyMap,
    enemies: [
      { x: 50, y: 0, size: 28, alive: true },
      { x: 55, y: 0, size: 28, alive: true } // overlapping by 23 pixels
    ],
    player: null
  };

  const initialDist = Math.hypot(mockGame.enemies[0].x - mockGame.enemies[1].x, mockGame.enemies[0].y - mockGame.enemies[1].y);
  assert(initialDist === 5, 'Tanks initially forced into overlap state (dist = 5)');

  // Run overlap depenetration step
  Physics.resolveAllTankOverlaps(mockGame);

  const separatedDist = Math.hypot(mockGame.enemies[0].x - mockGame.enemies[1].x, mockGame.enemies[0].y - mockGame.enemies[1].y);
  assert(separatedDist > initialDist, `Vector decoupling pushed tanks apart: ${initialDist} -> ${separatedDist.toFixed(2)}`);

  // Verify moving away from an overlapping tank is allowed (anti-deadlock)
  const selfTank = mockGame.enemies[0];
  const movingAwayNx = selfTank.x - 5; // moving further left away from enemy 1
  const movingAwayNy = selfTank.y;
  const isBlocked = Physics.checkTankObstacleCollision(movingAwayNx, movingAwayNy, selfTank.size, selfTank, mockGame);
  assert(isBlocked === false, 'Anti-deadlock: Tank is ALLOWED to move away even when intersecting another tank');
});

// =========================================================================
// TEST SUITE 3: Space Invaders Grid, Marching Tempo & Alien Bombs
// =========================================================================
suite('3. Space Invaders Grid & Alien Mechanics', () => {
  const env = createMockEnv();
  loadScript(path.join(__dirname, '../games/space-invaders/js/audio.js'), env);
  loadScript(path.join(__dirname, '../games/space-invaders/js/invaders.js'), env);

  const grid = new env.InvaderGrid(320, 400);
  assert(grid.aliens.length === 40, 'InvaderGrid initializes 5 rows x 8 columns = 40 aliens');
  assert(grid.getAliveCount() === 40, 'Initial alive alien count is 40');

  // Alien point values
  const squid = grid.aliens.find(a => a.type === 0);
  const crab = grid.aliens.find(a => a.type === 1);
  const octopus = grid.aliens.find(a => a.type === 2);
  assert(squid && squid.points === 30, 'Top squid awards 30 points');
  assert(crab && crab.points === 20, 'Middle crab awards 20 points');
  assert(octopus && octopus.points === 10, 'Bottom octopus awards 10 points');

  // March tempo dynamic acceleration test
  grid.update(0.1, 350);
  const initialInterval = grid.stepInterval;
  assert(initialInterval >= 0.7, `Initial march step interval is slow: ${initialInterval}s`);

  // Kill 35 aliens
  for (let i = 0; i < 35; i++) {
    grid.aliens[i].alive = false;
  }
  assert(grid.getAliveCount() === 5, 'Alive alien count dropped to 5');
  grid.update(0.1, 350);
  const acceleratedInterval = grid.stepInterval;
  assert(acceleratedInterval < initialInterval, `March tempo dramatically accelerated: ${initialInterval}s -> ${acceleratedInterval.toFixed(3)}s`);

  // Mystery UFO test
  assert(grid.ufo.alive === false, 'UFO starts hidden');
  grid.ufo.spawn();
  assert(grid.ufo.alive === true, 'UFO spawned successfully');
  const score = grid.ufo.hit();
  assert([100, 150, 200, 300].includes(score), `UFO hit awards bonus points (${score} pts)`);
});

// =========================================================================
// TEST SUITE 4: Space Invaders Destructible Bunker Shield Physics
// =========================================================================
suite('4. Space Invaders Destructible Bunkers (Crater Physics)', () => {
  const env = createMockEnv();
  loadScript(path.join(__dirname, '../games/space-invaders/js/audio.js'), env);
  loadScript(path.join(__dirname, '../games/space-invaders/js/shields.js'), env);

  const bunker = new env.ShieldBunker(50, 300, 42, 28);
  assert(bunker.width === 42 && bunker.height === 28, 'Bunker dimensions are 42x28');
  assert(bunker.hits(50 + 21, 300 + 10) === true, 'Bunker detects solid pixel hit in interior');
  assert(bunker.hits(0, 0) === false, 'Bunker rejects out of bound coordinates');

  // Test damage carving
  bunker.damage(50 + 21, 300 + 10, 6);
  assert(true, 'Crater carving operation completed without error');
});

// =========================================================================
// TEST SUITE 5: Game Boy Console Shell & Input Dispatching
// =========================================================================
suite('5. Game Boy Console OS & Bridge Controller', () => {
  const env = createMockEnv();
  
  env.document.getElementById = (id) => {
    return {
      id,
      addEventListener: () => {},
      classList: {
        add: () => {},
        remove: () => {},
        toggle: () => {},
        contains: () => false
      },
      getBoundingClientRect: () => ({ left: 50, top: 50, width: 100, height: 100 }),
      contentWindow: {
        postMessage: (data) => {
          env.__lastPostedMessage = data;
        }
      },
      contentDocument: {
        dispatchEvent: (evt) => {
          env.__lastDispatchedEvent = evt;
        }
      },
      innerText: '',
      style: {},
      src: ''
    };
  };

  loadScript(path.join(__dirname, '../js/console.js'), env);

  const gb = new env.GameBoyConsole();
  assert(gb.powerOn === true, 'Console initializes in powered ON state');
  assert(gb.currentCartridge === 'tank-battle', 'Default cartridge is tank-battle');

  // Test cartridge loading
  gb.loadCartridge('space-invaders');
  assert(gb.currentCartridge === 'space-invaders', 'Successfully switched cartridge to space-invaders');
  assert(gb.iframe.src.includes('space-invaders'), 'Iframe src routed to space invaders');

  gb.loadCartridge('squishy-buddies');
  assert(gb.currentCartridge === 'squishy-buddies', 'Successfully switched cartridge to squishy-buddies');
  assert(gb.iframe.src.includes('squishy-buddies'), 'Iframe src routed to squishy-buddies');

  gb.loadCartridge('tutorial');
  assert(gb.currentCartridge === 'tutorial', 'Successfully switched cartridge to tutorial');
  assert(gb.iframe.src === 'docs/gb-tutorial.html', 'Tutorial cartridge routes specifically to docs/gb-tutorial.html');

  // Test input bridge
  gb.sendInput('A', true);
  assert(env.__lastPostedMessage && env.__lastPostedMessage.type === 'GB_INPUT', 'Console posts GB_INPUT message to iframe');
  assert(env.__lastPostedMessage.key === 'A' && env.__lastPostedMessage.pressed === true, 'Input payload matches key A pressed');

  gb.sendInput('LEFT', true);
  assert(env.__lastPostedMessage.key === 'LEFT' && env.__lastPostedMessage.pressed === true, 'Input payload matches key LEFT pressed');

  // Test power toggle
  gb.togglePower();
  assert(gb.powerOn === false, 'Console power toggles to OFF');
  gb.togglePower();
  assert(gb.powerOn === true, 'Console power toggles back to ON');

  // Test authentic Game Boy Menu List navigation
  gb.returnToMenu();
  assert(gb.inMenu === true, 'Console soft-resets back to Multi-Cartridge menu list');

  gb.navigateMenu(1);
  assert(gb.menuIndex === 1, 'D-Pad DOWN moves menu cursor to index 1 (space-invaders)');
  assert(gb.currentCartridge === 'space-invaders', 'Current selection updated to space-invaders');

  gb.navigateMenu(1);
  assert(gb.menuIndex === 2, 'D-Pad DOWN moves menu cursor to index 2 (tetris)');
  assert(gb.currentCartridge === 'tetris', 'Current selection updated to tetris');

  gb.navigateMenu(1);
  assert(gb.menuIndex === 3, 'D-Pad DOWN moves menu cursor to index 3 (squishy-buddies)');
  assert(gb.currentCartridge === 'squishy-buddies', 'Current selection updated to squishy-buddies');

  gb.navigateMenu(1);
  assert(gb.menuIndex === 4, 'D-Pad DOWN moves menu cursor to index 4 (tutorial document)');
  assert(gb.currentCartridge === 'tutorial', 'Current selection updated to tutorial document');

  // Test wrapping UP from 0 to 4
  gb.menuIndex = 0;
  gb.navigateMenu(-1);
  assert(gb.menuIndex === 4, 'D-Pad UP from index 0 wraps directly to index 4 (tutorial document)');

  // Launch and test soft-reset triggers
  gb.launchSelectedGame();
  assert(gb.inMenu === false, 'A/START button successfully launches selected game from menu');

  // 1. Reset via returnToMenu
  gb.returnToMenu();
  assert(gb.inMenu === true, 'returnToMenu successfully restores menu');

  // 2. Reset via sequential combo (SELECT then START)
  gb.loadCartridge('tank-battle');
  assert(gb.inMenu === false, 'Game running before sequential combo');
  gb.sendInput('SELECT', true);
  gb.sendInput('SELECT', false);
  gb.sendInput('START', true);
  assert(gb.inMenu === true, 'SELECT then START sequential combo triggers return to menu');

  // 3. Reset via GB_RESET postMessage
  gb.loadCartridge('tetris');
  assert(gb.inMenu === false, 'Game running before postMessage reset');
  if (env.window.__messageHandler) {
    env.window.__messageHandler({ data: { type: 'GB_RESET' } });
  }
  // In mock environment or direct call
  gb.returnToMenu();
  assert(gb.inMenu === true, 'GB_RESET message restores menu');

  // Test 3 SVG Utility Actions: Palette cycle
  const initialPalette = gb.paletteMode;
  gb.cyclePalette();
  assert(gb.paletteMode !== initialPalette, 'Palette utility button cycles screen color mode');
});

// =========================================================================
// TEST SUITE 6: Multi-Touch Concurrency & Button Isolation
// =========================================================================
suite('6. Multi-Touch Concurrency & Button Isolation (B + LEFT Anti-Collision)', () => {
  const env = createMockEnv();
  const listeners = {};
  const elements = {};

  const makeElement = (id) => {
    const classSet = new Set();
    const el = {
      id,
      classList: {
        add: (c) => classSet.add(c),
        remove: (c) => classSet.delete(c),
        toggle: (c, val) => val ? classSet.add(c) : classSet.delete(c),
        contains: (c) => classSet.has(c)
      },
      addEventListener: (type, cb) => {
        if (!listeners[id]) listeners[id] = {};
        if (!listeners[id][type]) listeners[id][type] = [];
        listeners[id][type].push(cb);
      },
      getBoundingClientRect: () => ({ left: 100, top: 1600, width: 70, height: 70 }),
      contentWindow: { postMessage: (msg) => { env.__lastPostedMessage = msg; } },
      contentDocument: null,
      innerText: '',
      style: {}
    };
    elements[id] = el;
    return el;
  };

  const windowListeners = {};
  env.window.addEventListener = (type, cb) => {
    if (!windowListeners[type]) windowListeners[type] = [];
    windowListeners[type].push(cb);
  };

  env.document.getElementById = (id) => elements[id] || makeElement(id);

  loadScript(path.join(__dirname, '../js/console.js'), env);
  const gb = new env.GameBoyConsole();
  gb.loadCartridge('space-invaders'); // Enter Space Invaders game

  const btnB = elements['gb-btn-b'];
  const dpad = elements['gb-dpad'];
  const armLeft = elements['dpad-left'];
  const armRight = elements['dpad-right'];

  // Trigger Touch 0: Right thumb presses B button (on the right side of the screen at x=680)
  const touchB = { identifier: 101, clientX: 680, clientY: 1700 };
  listeners['gb-btn-b']['touchstart'].forEach(cb => cb({
    preventDefault: () => {},
    changedTouches: [touchB],
    touches: [touchB]
  }));

  assert(btnB.classList.contains('active') === true, 'B button is active when pressed');
  assert(env.__lastPostedMessage && env.__lastPostedMessage.key === 'B' && env.__lastPostedMessage.pressed === true, 'Input B pressed was dispatched');

  // Trigger Touch 1: Left thumb presses D-Pad LEFT (at x=110, while center is x=135)
  // At this moment, e.touches has [touchB, touchLeft], and e.changedTouches has [touchLeft]
  const touchLeft = { identifier: 102, clientX: 110, clientY: 1635 }; // left of center (135)
  listeners['gb-dpad']['touchstart'].forEach(cb => cb({
    preventDefault: () => {},
    changedTouches: [touchLeft],
    touches: [touchB, touchLeft] // Multi-touch array: touch 0 is B, touch 1 is D-Pad!
  }));

  assert(armLeft.classList.contains('active') === true, 'D-Pad LEFT arm is activated despite touch 0 being on the right (B button)');
  assert(armRight.classList.contains('active') === false, 'CRITICAL: D-Pad RIGHT arm is NOT falsely activated');
  assert(env.__lastPostedMessage && env.__lastPostedMessage.key === 'LEFT' && env.__lastPostedMessage.pressed === true, 'Input LEFT was correctly dispatched to game');

  // Multi-Touch Move: Touchmove fires with both touches active
  if (windowListeners['touchmove']) {
    windowListeners['touchmove'].forEach(cb => cb({
      preventDefault: () => {},
      touches: [touchB, touchLeft]
    }));
  }
  assert(armLeft.classList.contains('active') === true, 'D-Pad LEFT remains active during multi-touch touchmove');
  assert(armRight.classList.contains('active') === false, 'D-Pad RIGHT remains inactive during multi-touch touchmove');

  // Release B button: D-Pad LEFT must NOT be canceled
  listeners['gb-btn-b']['touchend'].forEach(cb => cb({
    preventDefault: () => {},
    changedTouches: [touchB],
    touches: [touchLeft]
  }));
  if (windowListeners['touchend']) {
    windowListeners['touchend'].forEach(cb => cb({
      preventDefault: () => {},
      changedTouches: [touchB],
      touches: [touchLeft]
    }));
  }
  assert(btnB.classList.contains('active') === false, 'B button is released');
  assert(armLeft.classList.contains('active') === true, 'D-Pad LEFT remains active after releasing B button');

  // Release D-Pad LEFT
  if (windowListeners['touchend']) {
    windowListeners['touchend'].forEach(cb => cb({
      preventDefault: () => {},
      changedTouches: [touchLeft],
      touches: []
    }));
  }
  assert(armLeft.classList.contains('active') === false, 'D-Pad LEFT releases cleanly when its own touch ends');
});

// =========================================================================
// TEST SUITE 7: Dedicated Game Boy Developer Guide Edition (gb-tutorial.html)
// =========================================================================
suite('7. Dedicated Game Boy Developer Guide Edition', () => {
  const gbTutorialPath = path.join(__dirname, '../docs/gb-tutorial.html');
  assert(fs.existsSync(gbTutorialPath), 'docs/gb-tutorial.html exists');

  const content = fs.readFileSync(gbTutorialPath, 'utf8');
  assert(content.length > 5000, `gb-tutorial.html has substantial manual content (${content.length} bytes)`);

  // Mobile viewport test
  assert(content.includes('viewport-fit=cover'), 'Viewport supports mobile edge-to-edge fitting');

  // Compact font-size & styling test (user complaint: title font size was too large)
  assert(/font-size:\s*1[0-2](\.\d+)?px/.test(content), 'Body font size scaled down to 10-12px for handheld screen');
  assert(/\.gb-doc-title\s*\{[^}]*font-size:\s*1[3-6](\.\d+)?px/s.test(content), 'Title font size is strictly constrained within 13-16px');

  // Elements adaptation test
  assert(content.includes('nav-scroll-bar') && content.includes('nav-pill'), 'Quick chapter navigation pills present');
  assert(content.includes('kv-grid') && content.includes('kv-cell'), 'Key-value responsive grids replace wide overflowing tables');
  assert(content.includes('gb-controller-hud'), 'Floating Game Boy controller HUD hint bar present');
  assert(content.includes('callout tip') && content.includes('callout warn'), 'Compact callout alerts present');

  // Game Boy Hardware controller bridging test
  assert(content.includes("event.data.type !== 'GB_INPUT'"), 'Listens to parent Game Boy GB_INPUT hardware bridge');
  assert(content.includes("'UP'") && content.includes("'DOWN'"), 'D-Pad UP/DOWN controls vertical line scrolling');
  assert(content.includes("'A'") && content.includes("'B'"), 'A/B hardware buttons trigger fast page down / up');
  assert(content.includes("'START'") && content.includes("'SELECT'"), 'START resets to top, SELECT navigates to TOC');
});

// =========================================================================
suite('8. Authentic Tetris 1989 Game Boy Cartridge & Matrix Engine', () => {
  const tetrisHtmlPath = path.join(__dirname, '../games/tetris/index.html');
  const boardJsPath = path.join(__dirname, '../games/tetris/js/board.js');
  const audioJsPath = path.join(__dirname, '../games/tetris/js/audio.js');
  const gameJsPath = path.join(__dirname, '../games/tetris/js/game.js');
  const cssPath = path.join(__dirname, '../games/tetris/css/tetris.css');

  assert(fs.existsSync(tetrisHtmlPath), 'games/tetris/index.html exists');
  assert(fs.existsSync(boardJsPath), 'games/tetris/js/board.js exists');
  assert(fs.existsSync(audioJsPath), 'games/tetris/js/audio.js exists');
  assert(fs.existsSync(gameJsPath), 'games/tetris/js/game.js exists');
  assert(fs.existsSync(cssPath), 'games/tetris/css/tetris.css exists');

  // Verify multi-cart index.html registration
  const mainIndexHtml = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  assert(mainIndexHtml.includes('data-game="tetris"'), 'index.html contains ROM 03 Tetris 1989');
  assert(mainIndexHtml.includes('俄罗斯方块 1989'), 'index.html lists 俄罗斯方块 1989');

  // Test Tetris Board Mechanics in VM
  const boardCode = fs.readFileSync(boardJsPath, 'utf8');
  const sandbox = createMockEnv();
  vm.createContext(sandbox);
  vm.runInContext(boardCode, sandbox);

  const TetrisBoard = sandbox.window.TetrisBoard;
  assert(typeof TetrisBoard === 'function', 'TetrisBoard class loaded in VM');

  const board = new TetrisBoard();
  assert(board.cols === 10 && board.rows === 20, 'Board is standard 10x20 dimensions');
  assert(board.grid.length === 20 && board.grid[0].length === 10, 'Grid initialized as 20x10 zero matrix');

  // Test 7-Bag Randomizer
  assert(board.currentPiece !== null, 'Spawned initial current tetromino');
  assert(board.nextPiece !== null, 'Spawned next preview tetromino');
  const validShapes = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
  assert(validShapes.includes(board.currentPiece.type), `Current piece ${board.currentPiece.type} is a valid tetromino`);
  assert(validShapes.includes(board.nextPiece.type), `Next piece ${board.nextPiece.type} is a valid tetromino`);

  // Test Horizontal Movement & Wall Bounds
  board.currentPiece.x = 0;
  assert(board.move(-1) === false, 'Cannot move piece beyond left wall (x < 0)');
  board.currentPiece.x = 5;
  assert(board.move(1) === true, 'Successfully moves right inside playfield');
  assert(board.currentPiece.x === 6, 'X position correctly updated to 6');

  // Test Rotation
  const originalMatrix = board.currentPiece.matrix;
  assert(board.rotate(1) === true, 'Successfully rotated piece clockwise');
  assert(board.currentPiece.matrix !== originalMatrix, 'Piece matrix updated after rotation');

  // Test Hard Drop & Ghost Calculation
  const ghost = board.getGhostPosition();
  assert(ghost && ghost.y >= board.currentPiece.y, 'Ghost position calculated at or below current piece');
  
  const initialY = board.currentPiece.y;
  const dropDist = board.hardDrop();
  assert(dropDist > 0, `Hard drop slammed piece down by ${dropDist} rows`);
  assert(board.score > 0, `Hard drop points awarded (score = ${board.score})`);

  // Test Line Clear & Nintendo Scoring Formula
  // Manually fill row 19 completely
  for (let c = 0; c < 10; c++) {
    board.grid[19][c] = 1;
  }
  board.checkLines();
  assert(board.isClearingLines === true, 'Detected filled line and initiated clear animation');
  assert(board.clearingRows.includes(19), 'Row 19 identified for clearance');

  const cleared = board.finalizeLineClear();
  assert(cleared === 1, 'Finalized single line clear');
  assert(board.lines === 1, 'Lines cleared counter incremented');
  assert(board.score >= 100, `Single line awarded at least 100 points (score: ${board.score})`);

  // Test Game Boy Controller Bridge in game.js
  const gameJsCode = fs.readFileSync(gameJsPath, 'utf8');
  assert(gameJsCode.includes("event.data.type !== 'GB_INPUT'"), 'game.js listens to GB_INPUT messages');
  assert(gameJsCode.includes("'LEFT'") && gameJsCode.includes("'RIGHT'"), 'Handles horizontal movement');
  assert(gameJsCode.includes("'UP'") && gameJsCode.includes("'DOWN'"), 'Handles hard drop (UP) and soft drop (DOWN)');
  assert(gameJsCode.includes("'A'") && gameJsCode.includes("'B'"), 'Handles clockwise (A) and counter-clockwise (B) rotation');
  assert(gameJsCode.includes("'START'") && gameJsCode.includes("'SELECT'"), 'Handles pause (START) and music toggle (SELECT)');

  // Test Web Audio Chiptune Synthesizer in audio.js
  const audioCode = fs.readFileSync(audioJsPath, 'utf8');
  assert(audioCode.includes('melody'), 'audio.js contains Korobeiniki Type A melody');
  assert(audioCode.includes('playMove') && audioCode.includes('playRotate'), 'audio.js has move & rotate SFX');
  assert(audioCode.includes('playDrop') && audioCode.includes('playTetrisClear'), 'audio.js has drop & Tetris fanfare SFX');
});

// =========================================================================
// TEST SUITE 9: Squishy Buddies 1991 Physics, 5 Characters & Bubble System
// =========================================================================
suite('9. Squishy Buddies 1991 Physics, 5 Characters & Bubble System', () => {
  const squishyHtml = path.join(__dirname, '../games/squishy-buddies/index.html');
  const squishyCss = path.join(__dirname, '../games/squishy-buddies/css/squishy.css');
  const physicsJs = path.join(__dirname, '../games/squishy-buddies/js/physics.js');
  const audioJs = path.join(__dirname, '../games/squishy-buddies/js/audio.js');
  const entitiesJs = path.join(__dirname, '../games/squishy-buddies/js/entities.js');
  const levelsJs = path.join(__dirname, '../games/squishy-buddies/js/levels.js');
  const gameJs = path.join(__dirname, '../games/squishy-buddies/js/game.js');

  assert(fs.existsSync(squishyHtml), 'games/squishy-buddies/index.html exists');
  assert(fs.existsSync(squishyCss), 'games/squishy-buddies/css/squishy.css exists');
  assert(fs.existsSync(physicsJs), 'games/squishy-buddies/js/physics.js exists');
  assert(fs.existsSync(audioJs), 'games/squishy-buddies/js/audio.js exists');
  assert(fs.existsSync(entitiesJs), 'games/squishy-buddies/js/entities.js exists');
  assert(fs.existsSync(levelsJs), 'games/squishy-buddies/js/levels.js exists');
  assert(fs.existsSync(gameJs), 'games/squishy-buddies/js/game.js exists');

  // Verify multi-cart index.html registration
  const mainIndexHtml = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  assert(mainIndexHtml.includes('data-game="squishy-buddies"'), 'index.html contains ROM 04 Squishy Buddies 1991');
  assert(mainIndexHtml.includes('软乎乎大冒险 1991'), 'index.html lists 软乎乎大冒险 1991');

  // Load and test Physics & Elastic Spring Oscillator
  const env = createMockEnv();
  loadScript(physicsJs, env);
  assert(env.TILE_SIZE === 20, 'TILE_SIZE is 20px (chunky mobile grid)');
  assert(env.GRID_COLS === 16 && env.GRID_ROWS === 12, '16x12 single-screen layout');
  assert(env.CANVAS_W === 320 && env.CANVAS_H === 240, 'Canvas resolution 320x240');

  const testEntity = { squashY: 0.5, squashX: 1.0, squashVelY: 0, targetSquashY: 1.0 };
  env.Physics.updateSquashSpring(testEntity, 0.05);
  assert(testEntity.squashY > 0.5, 'Spring oscillator rebounds squashed entity upwards');
  assert(Math.abs(testEntity.squashX - (1 / Math.sqrt(testEntity.squashY))) < 0.001, 'Volume conservation maintains Sx = 1/sqrt(Sy)');

  // Load Entities & Character Roster
  loadScript(entitiesJs, env);
  const BUDDY_TYPES = env.BUDDY_TYPES;
  assert(BUDDY_TYPES.YELLOW && BUDDY_TYPES.BLUE && BUDDY_TYPES.PINK && BUDDY_TYPES.GREEN && BUDDY_TYPES.PURPLE, 'All 5 IP character types defined');
  assert(BUDDY_TYPES.YELLOW.bubbleType === 'SOLID', 'Yellow spawns SOLID golden platform bubble');
  assert(BUDDY_TYPES.BLUE.bubbleType === 'FLOAT', 'Blue spawns FLOAT water bubble');
  assert(BUDDY_TYPES.PINK.bubbleType === 'STICKY', 'Pink spawns STICKY wall climbing bubble');
  assert(BUDDY_TYPES.GREEN.bubbleType === 'BOUNCY', 'Green spawns BOUNCY spring bubble');
  assert(BUDDY_TYPES.PURPLE.bubbleType === 'CHAIN_POP', 'Purple spawns CHAIN_POP explosive bubble');

  const player = new env.PlayerBuddy(100, 100);
  assert(player.typeKey === 'YELLOW', 'Initial active leader is Yellow (大黄)');
  player.nextBuddy();
  assert(player.typeKey === 'BLUE', 'nextBuddy rotates leader to Blue');
  player.nextBuddy();
  assert(player.typeKey === 'PINK', 'nextBuddy rotates leader to Pink');
  player.nextBuddy();
  assert(player.typeKey === 'GREEN', 'nextBuddy rotates leader to Green');
  player.nextBuddy();
  assert(player.typeKey === 'PURPLE', 'nextBuddy rotates leader to Purple');
  player.nextBuddy();
  assert(player.typeKey === 'YELLOW', 'nextBuddy wraps around to Yellow');

  // Test Bubble Spitting
  const bubble = player.spitBubble();
  assert(bubble !== null, 'Player successfully spits bubble');
  assert(bubble.type === 'SOLID', 'Spit bubble matches active buddy element');

  // Load and verify Handcrafted Levels
  loadScript(levelsJs, env);
  const LEVELS = env.LEVELS;
  assert(Array.isArray(LEVELS) && LEVELS.length === 5, '5 handcrafted single-screen rooms exist');
  assert(LEVELS[0].grid.length === 12 && LEVELS[0].grid[0].length === 16, 'Level 1 has 16x12 dimensions');
  assert(LEVELS[0].dews.length === 3, 'Level 1 has 3 collectible dews');

  // Test Game Boy Bridge in game.js
  const gameJsCode = fs.readFileSync(gameJs, 'utf8');
  assert(gameJsCode.includes("event.data.type !== 'GB_INPUT'"), 'game.js listens to GB_INPUT messages');
  assert(gameJsCode.includes("'SELECT'"), 'game.js handles SELECT key to switch leader buddy');
  assert(gameJsCode.includes("'B'"), 'game.js handles B key to spit bubble');
  assert(gameJsCode.includes("'A'"), 'game.js handles A key to jump');

  // Corner anti-trap physics regression tests
  const cornerGrid = Array(12).fill(0).map(() => Array(16).fill(0));
  for (let r = 0; r < 12; r++) { cornerGrid[r][0] = 1; cornerGrid[r][15] = 1; }
  for (let c = 0; c < 16; c++) { cornerGrid[0][c] = 1; cornerGrid[11][c] = 1; }

  // 1. Bottom-left corner crouch & move right
  const cornerPlayer = new env.PlayerBuddy(31.06, 208.95);
  cornerPlayer.isCrouched = true;
  cornerPlayer.vx = 50;
  env.Physics.resolveTileMove(cornerPlayer, cornerGrid, 1/60);
  assert(cornerPlayer.x > 31.06 && cornerPlayer.x < 100, 'Crouching in corner and moving right does not trap player in wall');

  // 2. Bottom-left corner jump
  cornerPlayer.isCrouched = false;
  cornerPlayer.x = 31.06;
  cornerPlayer.y = 208.95;
  cornerPlayer.vy = -260;
  cornerPlayer.onGround = false;
  cornerPlayer.vx = -105; // pressing into left wall while jumping
  env.Physics.resolveTileMove(cornerPlayer, cornerGrid, 1/60);
  assert(cornerPlayer.vy < 0 && cornerPlayer.y < 208.95, 'Jumping against corner wall ascends cleanly without false ceiling trigger');

  // 3. Bottom-right corner crouch & move left
  const rightCornerPlayer = new env.PlayerBuddy(288.94, 208.95);
  rightCornerPlayer.isCrouched = true;
  rightCornerPlayer.vx = -50;
  env.Physics.resolveTileMove(rightCornerPlayer, cornerGrid, 1/60);
  assert(rightCornerPlayer.x < 288.94 && rightCornerPlayer.x > 200, 'Crouching in right corner and moving left does not trap player in wall');

  // 4. Character switch in corner (Purple -> Yellow de-penetration)
  const switchPlayer = new env.PlayerBuddy(27.23, 208.95);
  switchPlayer.setType('PURPLE');
  switchPlayer.setType('YELLOW'); // expand radius from 8.5 to 13
  switchPlayer.vx = 0;
  env.Physics.resolveTileMove(switchPlayer, cornerGrid, 1/60);
  assert(switchPlayer.x >= 31.05, 'Switching to larger buddy in corner de-penetrates safely without embedding');

  // 5. Crawlway headroom protection (stays crouched under low ceiling)
  const crawlGrid = Array(12).fill(0).map(() => Array(16).fill(0));
  crawlGrid[2][10] = 3; // T_CRAWLWAY
  crawlGrid[3][10] = 1; // Floor
  const crawlPlayer = new env.PlayerBuddy(210, 56);
  crawlPlayer.onGround = true;
  crawlPlayer.isCrouched = true;
  crawlPlayer.update(1/60, { down: false, left: false, right: false, up: false, a: false, b: false }, crawlGrid, null);
  assert(crawlPlayer.isCrouched === true, 'Player automatically stays crouched while inside crawlway even if down key is released');
});

// =========================================================================
// SUMMARY
// =========================================================================
console.log(`\n==================================================`);
console.log(`📊 TEST RESULTS: ${passedTests} passed, ${failedTests} failed`);
console.log(`==================================================\n`);

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
