/* ==========================================================================
   Shared Node.js sandbox for the Squishy Buddies tests: runs the REAL game scripts inside a vm
   context with a recording Canvas2D mock (no browser needed).
   ========================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const JS = path.join(__dirname, '../../games/squishy-buddies/js');

/* ---------- recording Canvas2D mock ---------- */
function makeCtx(stats) {
  const state = {};
  return new Proxy(state, {
    get(t, prop) {
      if (prop in t) return t[prop];
      if (prop === 'measureText') return () => ({ width: 10 });
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient' || prop === 'createPattern') return () => ({ addColorStop() {} });
      return (...args) => {
        stats.calls++;
        stats.byName[prop] = (stats.byName[prop] || 0) + 1;
        if (args.some(a => typeof a === 'number' && !Number.isFinite(a))) stats.nonFinite++;
      };
    },
    set(t, prop, v) { t[prop] = v; return true; }
  });
}

function createEnv({ dpr = 1, rect = null } = {}) {
  const stats = { calls: 0, byName: {}, nonFinite: 0, layersBuilt: 0 };
  const mainCanvas = {
    id: 'gameCanvas', width: 320, height: 240,
    getContext: () => makeCtx(stats),
    addEventListener() {},
    classList: { add() {}, remove() {}, toggle() {} }, style: {}
  };
  if (rect) mainCanvas.getBoundingClientRect = () => rect;
  const sandbox = {
    console, Math, Date, Number, Object, Array, JSON, Float32Array, Uint8Array,
    performance: { now: () => Date.now() },
    setTimeout, clearTimeout,
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => {},
    navigator: { vibrate: () => true },
    localStorage: { _d: {}, getItem(k) { return this._d[k] || null; }, setItem(k, v) { this._d[k] = String(v); } },
    window: { addEventListener() {}, removeEventListener() {}, location: { search: '' }, postMessage() {}, devicePixelRatio: dpr },
    document: {
      body: { classList: { add() {}, remove() {}, contains: () => false } },
      getElementById: (id) => id === 'gameCanvas' ? mainCanvas : {
        id, addEventListener() {}, classList: { add() {}, remove() {}, toggle() {} }, style: {}, innerText: '', textContent: ''
      },
      createElement: (tag) => {
        if (tag === 'canvas') { stats.layersBuilt++; return { width: 0, height: 0, getContext: () => makeCtx(stats) }; }
        return {};
      },
      querySelectorAll: () => []
    },
    AudioContext: class {
      constructor() { this.currentTime = 0; this.state = 'running'; this.sampleRate = 44100; this.destination = {}; }
      createOscillator() { return { type: 'square', frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} }, connect() {}, start() {}, stop() {}, disconnect() {} }; }
      createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {}, value: 1 }, connect() {} }; }
      createBuffer() { return { getChannelData: () => new Float32Array(1024) }; }
      createBufferSource() { return { connect() {}, start() {} }; }
      createBiquadFilter() { return { type: 'lowpass', frequency: { setValueAtTime() {}, linearRampToValueAtTime() {} }, connect() {} }; }
      resume() {}
    }
  };
  sandbox.window.AudioContext = sandbox.AudioContext;
  sandbox.globalThis = sandbox;
  const env = vm.createContext(sandbox);
  env.__stats = stats;
  env.__canvas = mainCanvas;
  return env;
}

function loadScript(file, env) {
  const code = fs.readFileSync(path.join(JS, file), 'utf8');
  const names = [];
  for (const m of code.matchAll(/^class\s+([A-Za-z0-9_]+)/gm)) names.push(m[1]);
  for (const m of code.matchAll(/^(?:const|let|var)\s+([A-Za-z0-9_]+)\s*=/gm)) names.push(m[1]);
  for (const m of code.matchAll(/^function\s+([A-Za-z0-9_]+)\s*\(/gm)) names.push(m[1]);
  const exp = names.map(n => `try { globalThis.${n} = ${n}; } catch (e) {}`).join('\n');
  vm.runInContext(code + '\n' + exp, env);
}

function loadAll(env) {
  for (const f of ['audio.js', 'physics.js', 'entities.js', 'levels.js', 'fx.js', 'game.js']) loadScript(f, env);
}


module.exports = { JS, makeCtx, createEnv, loadScript, loadAll };
