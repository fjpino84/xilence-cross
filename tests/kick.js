// Prueba de las patadas: el golpe 4 del combo (patada alta) y la patada voladora (golpe en el aire) usan sus cuadros y hacen daño.
const { loadGame, createChecker } = require('./harness');
(async () => {
  const api = await loadGame();
  const { game, press, step } = api;
  const checker = createChecker();
  const ok = checker.check;

  const setup = () => {
    game.scenes.change('game', { levelIndex: 0 });
    const scene = game.scenes.current;
    for (let i = 0; i < 100; i++) step();
    scene.enemies.length = 0;
    scene.trino.cooldown = 999;
    const p = scene.player;
    p.invulnerable = 0; p.hp = p.maxHp; p.facing = 1;
    return { scene, p };
  };
  const tap = (code) => { press(code, true); step(); press(code, false); };

  // --- Patada voladora
  {
    const { scene, p } = setup();
    const enemy = scene.spawnEnemy(p.x + 90, p.y, false);
    enemy.state = 'patrol'; enemy.stats = { ...enemy.stats, aggroRange: 0 };
    const hp = enemy.hp;
    tap('Space');
    for (let i = 0; i < 6; i++) step();
    ok(!p.onGround, 'ECO está en el aire');
    tap('KeyJ');
    ok(p.state === 'attack' && p.airKick === true, 'golpear en el aire inicia la patada voladora');
    const frames = new Set();
    for (let i = 0; i < 40 && p.state === 'attack'; i++) { step(); const f = p.currentFrame(); if (f && f.image) frames.add(p.stateTime.toFixed(2)); }
    ok(enemy.hp < hp || enemy.state !== 'patrol', 'la patada voladora golpea al enemigo');
    for (let i = 0; i < 90; i++) step();
    ok(p.state !== 'attack' && !p.airKick, 'la patada voladora termina y ECO vuelve al control');
  }

  // --- Combo hasta la patada alta (golpe 4)
  {
    const { scene, p } = setup();
    const enemy = scene.spawnEnemy(p.x + 80, p.y, false);
    enemy.state = 'patrol'; enemy.stats = { ...enemy.stats, aggroRange: 0, hp: 9999 }; enemy.hp = enemy.maxHp = 9999;
    let reached = false; let usedKick = false;
    for (let i = 0; i < 400 && !reached; i++) {
      if (i % 12 === 0) tap('KeyJ'); else step();
      if (p.state === 'attack' && p.attackStep === 4) {
        reached = true;
        if (p.kickFrame()) usedKick = true;
        for (let k = 0; k < 30; k++) { step(); const f = p.kickFrame(); if (f) usedKick = true; }
      }
    }
    ok(reached, 'el combo llega al golpe 4');
    ok(usedKick, 'el golpe 4 usa los cuadros de la patada alta');
  }
  // --- Puños (golpes 1 y 3)
  {
    const { scene, p } = setup();
    const enemy = scene.spawnEnemy(p.x + 85, p.y, false);
    enemy.state = 'patrol'; enemy.stats = { ...enemy.stats, aggroRange: 0 }; enemy.hp = enemy.maxHp = 9999;
    let punchFrames = 0; const hp = enemy.hp;
    tap('KeyJ');
    for (let i = 0; i < 30; i++) { step(); if (p.state === 'attack' && p.attackStep === 1 && p.punchFrame()) punchFrames++; }
    ok(punchFrames > 5, `el golpe 1 usa los cuadros del puño (${punchFrames} cuadros)`);
    ok(enemy.hp < hp, 'el puño golpea al enemigo');
  }
  console.log(checker.failures ? `\n${checker.failures} comprobaciones fallaron` : '\nTodo correcto');
  process.exit(checker.failures ? 1 : 0);
})();
