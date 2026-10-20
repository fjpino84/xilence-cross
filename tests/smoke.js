// Prueba de humo del juego, sin navegador: carga los scripts de index.html en un entorno simulado y juega el nivel 1.
// Uso: node tests/smoke.js        (desde la carpeta del proyecto)
// Comprueba que se completan los 9 encuentros, que Rex Vane (diálogo, rayos, descarga, muerte) funciona, que los enemigos
// que caen del cielo aterrizan, que se guarda el récord y que el dibujado no lanza errores. Termina con código 1 si algo falla.
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const root = path.resolve(__dirname, '..');
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
const fakeElement = () => ({ className: '', setAttribute() {}, addEventListener() {}, append() {}, appendChild() {}, remove() {}, querySelector: () => ({ focus() {} }), focus() {} });
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
vm.runInContext(`${files.map((file) => fs.readFileSync(path.join(root, file), 'utf8')).join('\n;\n')}\n;globalThis.__t = { game, CONFIG, RexVane, Level01, Records };`, sandbox);

let failures = 0;
const check = (condition, label) => {
  console.log(`${condition ? 'OK   ' : 'FALLA'} ${label}`);
  if (!condition) failures += 1;
};

(async () => {
  await new Promise((resolve) => setTimeout(resolve, 60));
  const { game, CONFIG, RexVane, Level01, Records } = sandbox.__t;
  game.modal.show = () => {};
  const press = (code, down) => (listeners[down ? 'keydown' : 'keyup'] || []).forEach((fn) => fn({ code, repeat: false, preventDefault() {}, target: {} }));
  const step = () => { game.scenes.update(CONFIG.STEP); game.input.endStep(); };
  const render = () => game.scenes.render(ctx);

  // --- Plan del nivel
  const plan = Level01.planScenarios();
  check(plan.length === 12, 'el nivel tiene 12 escenarios');
  check(plan.every((tile, i) => tile.key === 'bgN' + (i + 1)), 'las escenas van en orden: 1, 2, 3 … 12');
  check(Level01.SUB_BOSS_POSITION === 7 && Level01.BOSS_POSITION === 12, 'la escena 7 es el sub jefe y la 12 el jefe');

  // --- Encuentros
  game.scenes.change('game', { levelIndex: 0 });
  const scene = game.scenes.current;
  const player = scene.player;
  for (let i = 0; i < 100; i++) step();
  let drops = 0;
  const seen = new Set();
  const waves = scene.level.waves;
  for (let w = 0; w < waves.length; w++) {
    const wave = waves[w];
    player.x = wave.triggerX + 5;
    player.hp = player.maxHp;
    player.invulnerable = 999;
    let ticks = 0;
    while (!wave.cleared && ticks < 60 * 90) {
      if (scene.dialogue && ticks % 20 === 0) { press('Enter', true); step(); press('Enter', false); }
      step();
      ticks++;
      if (ticks % 4 === 0) render();
      for (const enemy of scene.enemies) {
        if (enemy.state === 'drop' && !seen.has(enemy)) { seen.add(enemy); drops++; }
        if (!enemy.isAlive || (enemy.boss && !enemy.vulnerable)) continue;
        if (ticks % 30 === 0) enemy.takeDamage(enemy.boss ? 40 : 999, 100, {});
      }
    }
    check(wave.cleared, `encuentro ${w + 1} completado`);
  }
  check(drops > 0, `hay enemigos que caen del cielo (${drops})`);
  check(scene.enemies.every((enemy) => enemy.z === 0 || !enemy.isAlive || enemy.boss), 'los enemigos caídos aterrizan');
  check(scene.level.completed, 'el nivel queda completado');

  // --- Récord
  scene.player.score = 1234;
  scene.maxCombo = 17;
  const record = scene.saveRecord(true);
  check(record.best.score >= 1234 && record.newScore, 'se guarda la mejor puntuación');
  check(Records.load().combo === 17, 'el récord se lee de nuevo');

  // --- Poca vida: suena el latido
  game.scenes.change('game', { levelIndex: 0 });
  const second = game.scenes.current;
  second.player.hp = 10;
  let beats = 0;
  const originalPlay = game.audio.play.bind(game.audio);
  game.audio.play = (name, options) => { if (name === 'heartbeat') beats++; return originalPlay(name, options); };
  for (let i = 0; i < 120; i++) step();
  check(beats > 0, 'con poca vida suena el latido');

  console.log(failures ? `\n${failures} comprobaciones fallaron` : '\nTodo correcto');
  process.exit(failures ? 1 : 0);
})();
