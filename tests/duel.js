// Prueba del duelo musical: la partitura es válida, un bot perfecto gana, uno que no toca nada pierde.
// Uso: node tests/duel.js        (desde la carpeta del proyecto)
const { loadGame, createChecker } = require('./harness');

(async () => {
  const api = await loadGame();
  const { game, DuelMusic, RhythmDuel, press, step, render } = api;
  const checker = createChecker();
  const ok = checker.check;

  // --- Partitura
  const chart = DuelMusic.buildChart();
  ok(DuelMusic.SECTIONS.every((section) => section.bars.length === 8 && section.bars.every((bar) => bar.length === 8)), 'cada compás tiene 8 corcheas');
  ok(chart.length > 150, `la partitura tiene notas suficientes (${chart.length})`);
  ok(chart.every((note, i) => i === 0 || note.t >= chart[i - 1].t), 'las notas están ordenadas en el tiempo');
  ok(chart.every((note) => note.lane >= 0 && note.lane <= 3), 'todos los carriles son válidos');
  ok(chart[0].t >= DuelMusic.COUNT_IN_BARS * 4 * DuelMusic.BEAT - 0.01, 'la primera nota llega tras la cuenta atrás');

  // Arranca el cierre del nivel y avanza hasta que empieza el duelo
  const startDuel = () => {
    game.scenes.change('game', { levelIndex: 0 });
    const scene = game.scenes.current;
    scene.enemies.length = 0;
    scene.startFinale();
    scene.finale.time = scene.constructor.FINALE_FALL_AT;
    let guard = 0;
    while (!(scene.duel && scene.duel.state === 'play') && guard++ < 60 * 30) step();
    return scene;
  };

  // --- Bot perfecto
  let scene = startDuel();
  ok(!!scene.duel, 'tras el rugido de Vóidhar empieza el duelo');
  ok(scene.usesDuelPads(), 'se activan los pads táctiles del duelo');
  let duel = scene.duel;
  let guard = 0;
  while (duel.state === 'play' && guard++ < 60 * 90) {
    const time = duel.songTime;
    for (let lane = 0; lane < 4; lane++) {
      const due = duel.notes.some((note) => note.lane === lane && !note.hit && !note.missed && Math.abs(note.t - time) < 0.012);
      if (due) { press(['KeyD', 'KeyF', 'KeyJ', 'KeyK'][lane], true); }
    }
    step();
    for (const code of ['KeyD', 'KeyF', 'KeyJ', 'KeyK']) press(code, false);
    if (guard % 5 === 0) render();
  }
  ok(duel.state === 'won', `un bot perfecto gana el duelo (estado: ${duel.state})`);
  ok(duel.counts.miss === 0, `sin fallos (${duel.counts.miss})`);
  ok(duel.maxCombo === chart.length, `racha completa (${duel.maxCombo}/${chart.length})`);
  ok(duel.rank === 'S', `rango S (precisión ${Math.round(duel.accuracy * 100)}%)`);
  // Resultados y cierre
  guard = 0;
  while (!duel.done && guard++ < 60 * 20) {
    if (duel.stateTime > 2 && guard % 10 === 0) { press('Enter', true); step(); press('Enter', false); } else step();
    if (guard % 8 === 0) render();
  }
  ok(duel.done && !scene.duel, 'tras los resultados se cierra el duelo');
  ok(scene.finale.duelDone, 'el cierre del nivel continúa');
  guard = 0;
  while (game.scenes.current === scene && guard++ < 60 * 12) step();
  ok(game.scenes.current !== scene, 'pasa a la escena final');

  // --- Bot que no toca nada
  scene = startDuel();
  duel = scene.duel;
  guard = 0;
  while (duel.state === 'play' && guard++ < 60 * 90) step();
  ok(duel.state === 'lost', `sin tocar, gana el silencio (estado: ${duel.state})`);
  ok(!!api.lastModal && /SILENCIO/.test(api.lastModal.title), 'aparece el cuadro de reintentar');
  api.lastModal.buttons[0].onClick(); // Reintentar duelo
  step();
  ok(duel.state === 'play' && duel.combo === 0 && duel.meter === 0.5, 'reintentar reinicia el duelo');

  // --- Bot que toca todo sin parar (no debe poder ganar a base de aporrear teclas)
  scene = startDuel();
  duel = scene.duel;
  guard = 0;
  while (duel.state === 'play' && guard++ < 60 * 90) {
    for (const code of ['KeyD', 'KeyF', 'KeyJ', 'KeyK']) press(code, true);
    step();
    for (const code of ['KeyD', 'KeyF', 'KeyJ', 'KeyK']) press(code, false);
  }
  ok(duel.state === 'lost' || duel.accuracy < 0.95, 'aporrear todas las teclas no da una victoria perfecta');

  console.log(checker.failures ? `\n${checker.failures} comprobaciones fallaron` : '\nTodo correcto');
  process.exit(checker.failures ? 1 : 0);
})();
