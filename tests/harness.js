// Entorno simulado para probar el juego sin navegador: carga los scripts de index.html y expone lo necesario.
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const root = path.resolve(__dirname, '..');

async function loadGame() {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const files = [...html.matchAll(/<script src="([^"]+)"/g)].map((match) => match[1].split('?')[0]);

  const listeners = {};
  const storage = new Map();
  const ctx = new Proxy({}, {
    get: (target, key) => {
      if (key === 'measureText') return () => ({ width: 80 });
      if (key === 'getTransform') return () => ({ a: 1, b: 0, c: 0, d: 1 });
      if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => ({ addColorStop() {} });
      return target[key] ?? (() => {});
    },
    set: (target, key, value) => ((target[key] = value), true),
  });
  const fakeElement = () => ({ className: '', style: {}, setAttribute() {}, addEventListener() {}, append() {}, appendChild() {}, remove() {}, querySelector: () => ({ focus() {} }), focus() {} });
  const sandbox = {
    console, Math, Set, Map, Object, Array, String, Number, JSON, Infinity, Promise, setTimeout, performance: { now: () => 0 },
    window: {
      location: { search: '' },
      matchMedia: () => ({ matches: false }),
      localStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
      addEventListener: (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); },
    },
    HTMLButtonElement: class {},
    Image: class { set src(value) { setTimeout(() => { this.width = 100; this.height = 100; if (this.onload) this.onload(); }, 0); } },
    document: {
      createElement: (tag) => (tag === 'canvas' ? { width: 0, height: 0, getContext: () => ctx } : fakeElement()),
      getElementById: (id) => (id === 'game-canvas' ? { getContext: () => ctx, addEventListener() {}, removeEventListener() {} } : fakeElement()),
    },
    requestAnimationFrame() {},
  };
  vm.createContext(sandbox);
  vm.runInContext(`${files.map((file) => fs.readFileSync(path.join(root, file), 'utf8')).join('\n;\n')}\n;globalThis.__t = { game, CONFIG, RexVane, Level01, Records, DuelMusic, RhythmDuel, TrackMusic };`, sandbox);
  await new Promise((resolve) => setTimeout(resolve, 60));

  const api = { ...sandbox.__t, ctx, sandbox };
  api.game.modal.show = (options) => { api.lastModal = options; };
  api.game.modal.hide = () => { api.lastModal = null; };
  api.press = (code, down) => (listeners[down ? 'keydown' : 'keyup'] || []).forEach((fn) => fn({ code, repeat: false, preventDefault() {}, target: {} }));
  api.step = () => { api.game.scenes.update(api.CONFIG.STEP); api.game.input.endStep(); };
  api.render = () => api.game.scenes.render(ctx);
  return api;
}

// Contador de comprobaciones con salida legible
function createChecker() {
  const state = { failures: 0 };
  state.check = (condition, label) => {
    console.log(`${condition ? 'OK   ' : 'FALLA'} ${label}`);
    if (!condition) state.failures += 1;
  };
  return state;
}

module.exports = { loadGame, createChecker };
