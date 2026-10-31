// Prueba de la transición al duelo con Batuk: fundido, posiciones de combate durante el diálogo e instrumentos solo al final.
// Uso: node tests/batuk_intro.js
const { loadGame, createChecker } = require('./harness');

(async () => {
  const api = await loadGame();
  const { game, press, step } = api;
  const ok = createChecker().check;
  game.scenes.change('game', { levelIndex: 0 });
  const scene = game.scenes.current;
  scene.enemies.length = 0;
  scene.startFinale();
  // Simula la ruta con video (sin navegador): fundido a negro y luego la escena de diálogo lista
  scene.playBatukVideo = () => false;
  scene.finale.lead = scene.constructor.VIDEO_LEAD;
  for (let i = 0; i < 30; i++) step();
  ok(scene.finale.fade > 0.2 && !scene.finale.boss, 'primero se funde a negro (sin Batuk todavía)');
  for (let i = 0; i < 60 * 2; i++) step();
  const boss = scene.finale.boss;
  ok(!!boss && boss.state === 'idle', 'Batuk ya está plantado, sin caminar');
  ok(Math.abs(boss.x - (scene.camera.x + 765)) < 1 && Math.abs(scene.player.x - (scene.camera.x + 150)) < 1, 'ECO y Batuk están en sus posiciones de combate');
  ok(boss.instruments.length === 0, 'los instrumentos aún no aparecen durante el diálogo');
  let guard = 0;
  while (!scene.dialogue && guard++ < 600) step();
  ok(!!scene.dialogue, 'empieza el diálogo');
  let seenInstruments = 0;
  guard = 0;
  while (scene.dialogue && guard++ < 60 * 120) {
    if (scene.dialogue.index < scene.dialogue.lines.length - 1) seenInstruments = Math.max(seenInstruments, boss.instruments.length);
    if (guard % 15 === 0) { press('Enter', true); step(); press('Enter', false); } else step();
  }
  ok(seenInstruments === 0, 'ningún instrumento antes del último diálogo de Batuk');
  for (let i = 0; i < 60 * 3 && !scene.duel; i++) step();
  for (let i = 0; i < 90; i++) step();
  ok(boss.instruments.length >= 3, `al final del diálogo los instrumentos orbitan (${boss.instruments.length})`);
  console.log('Todo correcto');
})();
