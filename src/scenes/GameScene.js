// Escena de juego: orquesta jugador, enemigos, nivel, cámara, efectos y HUD.
// También reparte los "servicios de impacto" (partículas, sonido, hit-stop, cámara lenta…) vía `world`.
class GameScene {
  static DEPTH_SCALE = [0.92, 1.08]; // tamaño al fondo del suelo y junto a la cámara
  static MAX_SIMULTANEOUS_ATTACKERS = 2; // los demás rodean y esperan su turno
  static VICTORY_DELAY = 1.2;
  static DEATH_DELAY = 1.4;
  // Orden de niveles jugables (los 3, 5 y 6 se añadirán cuando tengan arte)
  static LEVELS = [Level01]; // por ahora la demo es un solo nivel (Level02, 04 y 07 siguen en el código)
  // Variantes de enemigo que aparecen (1 Garra, 2 Martillo, 3 Disco). De momento solo el Martillo, que ya tiene todas sus animaciones.
  static ENEMY_VARIANTS = [2];
  static ELITE_VARIANT = 1;
  // Diálogo de la llegada de Rex Vane (sub jefe)
  static REX_DIALOGUE = [
    { who: 'rex', name: 'REX VANE', scan: true, text: 'Frecuencia identificada. Archivo: ECO. Clasificación: perturbador de silencio. Nivel de amenaza... negligible.' },
    { who: 'rex', name: 'REX VANE', scan: true, text: 'Llevas semanas cruzando jurisdicciones de The Quietarchy. Sembrando ruido. Creyendo que eso es resistencia.' },
    { who: 'eco', name: 'ECO', text: '¿Y tú eres lo que mandan a silenciarme? ¿Una sombra con formulario?' },
    { who: 'rex', name: 'REX VANE', text: 'No vengo a silenciarte. Vengo a documentar tu extinción.' },
    { who: 'rex', name: 'REX VANE', text: 'Esa guitarra que empuñas... cada nota que tocas es una violación del Decreto de Frecuencia Cero. Y cada violación tiene consecuencias catalogadas. Yo soy la consecuencia.' },
    { who: 'eco', name: 'ECO', text: 'Entonces ya sabes lo que sigue.' },
    { who: 'rex', name: 'REX VANE', whisper: true, text: 'Sí. Página cuarenta y dos. Párrafo siete: «Ante resistencia armada con instrumento de frecuencia prohibida: supresión total. Sin advertencia adicional. Sin compasión registrada.»' },
    { who: 'rex', name: 'REX VANE', whisper: true, text: 'Olvida tu música, ECO. Donde vas después del silencio... no hay frecuencia que alcance.' },
  ];
  static AMBIENT_RATES = { rain: 110, embers: 28, fireflies: 7, motes: 10 };

  constructor(game) {
    this.game = game;
  }

  // data: { levelIndex, score } — la puntuación se arrastra entre niveles
  enter({ levelIndex = 0, score = 0 } = {}) {
    this.game.audio.releaseBoss(0.4); // una partida nueva empieza con la música normal
    this.levelIndex = levelIndex;
    this.startScore = score;
    this.player = new Player(120);
    this.player.score = score;
    this.trino = new Trino(this.player);
    this.level = new GameScene.LEVELS[levelIndex]();
    this.camera = new Camera(CONFIG.WIDTH, this.level.width);
    this.hud = new HUD(this.level.name);
    this.hud.portrait = Assets.image('portraitEco');
    this.enemies = [];
    this.effects = [];
    this.projectiles = [];
    this.beams = [];
    this.pickups = [];
    this.edgeWarnings = [];
    this.dialogue = null;
    this.duel = null;
    this.finale = null;
    this.callout = null;
    this.particles = new ParticleSystem();
    this.ambient = new ParticleSystem();
    this.atmosphere = new Atmosphere(this.level);
    this.foreground = new Foreground();
    this.live = new LiveBackground(this.level);
    this.props = new Props(this.level);
    this.ambientBack = new ParticleSystem(); // lluvia lejana: por detrás de los personajes
    this.atmosphereHooks = {
      thunder: () => this.game.audio.play('thunder'),
      zap: () => this.game.audio.play('zap'),
      shake: (power, duration) => this.camera.shake(power, duration),
    };
    this.ambientBudget = 0;
    this.time = 0;
    this.maxCombo = 0;
    this.heartbeatTimer = 0;
    this.flashTime = 0;
    this.flashColor = CONFIG.COLORS.CYAN;
    this.hitStopTime = 0;
    this.slowTime = 0;
    this.slowFactor = 1;
    this.darkness = 0;
    this.cinematicOn = false;
    this.paused = false;
    this.finished = false;
    this.victoryTimer = 0;
    this.world = this.buildWorld();

    this.level.spawnPatrols((x, y, aggressive) => this.spawnEnemy(x, y, aggressive));

    // Atajos para probar el duelo sin jugar los 10 escenarios (se añaden a la dirección):
    //   ?duel=1     Batuk entra, hay diálogo y empieza el duelo
    //   ?duel=skip  salta el diálogo: directo al momento previo a la batalla (música desde el 0:43)
    const shortcut = /[?&]duel=(\w+)/.exec(window.location.search || '');
    this.skipBatukDialogue = !!shortcut && (shortcut[1] === 'skip' || shortcut[1] === '2');
    if (shortcut) {
      this.enemies.length = 0;
      this.startFinale();
      this.finale.time = GameScene.FINALE_FALL_AT;
    }
  }

  // Los controles táctiles solo se muestran mientras se juega
  usesTouchControls() {
    if (this.duel) return false;
    if (this.dialogue || (this.finale && this.finale.phase === 'defeat')) return true; // el botón de golpe avanza
    return !this.finale && !this.finished;
  }

  // Durante el duelo musical se ven los cuatro pads táctiles
  usesDuelPads() {
    return !!this.duel && this.duel.active;
  }

  exit() {
    if (this.duel) this.duel.dispose();
    this.game.modal.hide();
    this.game.audio.duckMusic(false); // por si se sale desde la pausa
  }

  // Servicios que Player, Enemy y Trino usan sin conocer la escena
  buildWorld() {
    return {
      player: this.player,
      enemies: this.enemies,
      camera: this.camera,
      particles: this.particles,
      projectiles: this.projectiles,
      audio: this.game.audio,
      addEffect: (effect) => this.effects.push(effect),
      addText: (x, y, z, text, options) => this.effects.push({ type: 'text', x, y, z, text, age: 0, duration: 0.7, ...options }),
      flash: (duration, color = CONFIG.COLORS.CYAN) => { this.flashTime = duration; this.flashColor = color; },
      hitStop: (duration) => { this.hitStopTime = Math.max(this.hitStopTime, duration); },
      slowMo: (factor, duration) => { this.slowFactor = factor; this.slowTime = duration; },
      shake: (power, duration) => this.camera.shake(power, duration),
      cinematic: (on) => this.setCinematic(on),
      requestAttackSlot: (enemy) => this.requestAttackSlot(enemy),
      impact: (options) => this.impact(options),
      killFx: (enemy) => this.killFx(enemy),
      thud: (enemy) => this.thud(enemy),
      landDust: (x, y, count) => this.landDust(x, y, count),
      shards: (x, y, count, colors, fountain) => this.shards(x, y, count, colors, fountain),
      zap: (x, y, radius) => this.zap(x, y, radius),
      enemyStrike: (enemy) => this.enemyStrike(enemy),
      enemyStep: (enemy) => this.enemyStep(enemy),
      beam: (config) => this.addBeam(config),
      callout: (text, duration, style) => this.showCallout(text, duration, style),
      starburst: (x, y, z, size) => this.starburst(x, y, z, size),
    };
  }

  spawnEnemy(x, y, aggressive, opts = {}) {
    if (opts.boss) return this.spawnBoss();
    // Los élites son la Garra (variante 1); la tropa normal, el Martillo
    const variant = opts.elite ? GameScene.ELITE_VARIANT : GameScene.ENEMY_VARIANTS[Math.floor(Math.random() * GameScene.ENEMY_VARIANTS.length)];
    if (opts.drop) {
      // Cae cerca de ECO, dentro de la pantalla
      x = Math.max(this.camera.left + 70, Math.min(this.camera.right - 70, this.player.x + (Math.random() - 0.5) * 460));
    }
    const enemy = new Silenciador(x, y, aggressive, variant, opts);
    if (opts.drop) {
      enemy.startDrop();
      this.game.audio.play('dropWhoosh');
    }
    if (opts.rush) {
      enemy.startRush();
      // Aviso rojo en el borde por donde entra y gruñido
      this.edgeWarnings.push({ side: x > this.camera.x + CONFIG.WIDTH / 2 ? 'right' : 'left', age: 0 });
      this.game.audio.play(opts.elite ? 'voidRoar' : 'enemyWarn');
    }
    this.enemies.push(enemy);
    return enemy;
  }

  // Limita cuántos enemigos atacan a la vez para que el combate sea legible
  requestAttackSlot(requester) {
    const attacking = this.enemies.filter((enemy) => enemy !== requester && enemy.state === 'attack').length;
    return attacking < GameScene.MAX_SIMULTANEOUS_ATTACKERS;
  }

  // ---------------------------------------------------------------- efectos de impacto

  // Impacto de un golpe: chispas, destello, onda, notas, sonido, hit-stop y temblor
  impact({ x, y, z, power = 1, direction = 1, color = 'cyan' }) {
    const { CYAN, RED, YELLOW } = CONFIG.COLORS;
    const screenY = y - z;
    const palette = color === 'red' ? [RED, '#ff9aae', '#ffffff'] : [CYAN, '#ffffff', YELLOW];
    const fan = direction > 0 ? [-1.1, 1.1] : [Math.PI - 1.1, Math.PI + 1.1];

    this.particles.burst({
      x, y: screenY, count: 6 + power * 5, speed: [200 + power * 80, 420 + power * 160], angle: fan,
      life: [0.15, 0.35], size: [2.5, 4.5], colors: palette, type: 'spark', drag: 2,
    });
    this.particles.add({ type: 'dot', x, y: screenY, size: 10 + power * 7, sizeEnd: 0, life: 0.1, color: '#ffffff' });
    this.particles.add({ type: 'ring', x, y: screenY, size: 6, sizeEnd: 28 + power * 22, life: 0.22, color: palette[0], width: 5 });
    if (power >= 2) this.shards(x, screenY, 3 + power * 2, palette);

    this.game.audio.play(power >= 3 ? 'heavyHit' : 'hit', { power });
    if (color !== 'red') this.game.audio.play('enemyHurt', { power }); // gruñido del enemigo golpeado
    this.hitStopTime = Math.max(this.hitStopTime, 0.03 + 0.025 * power);
    this.camera.shake(2 + power * 3, 0.12 + power * 0.04);
    if (power >= 3) this.camera.punch(0.04);
  }

  // Muerte de un enemigo: estallido de energía y esquirlas
  killFx(enemy) {
    const { RED, PURPLE, CYAN } = CONFIG.COLORS;
    const screenY = enemy.y - enemy.z - enemy.h * 0.5;
    this.particles.burst({ x: enemy.x, y: screenY, count: 24, speed: [150, 600], life: [0.3, 0.7], size: [2.5, 5], colors: [RED, PURPLE, '#ffffff'], type: 'spark', drag: 1.8 });
    this.particles.add({ type: 'ring', x: enemy.x, y: enemy.y, size: 10, sizeEnd: 130, life: 0.45, color: PURPLE, width: 8, flat: 0.3 });
    this.shards(enemy.x, screenY, 12, [PURPLE, CYAN, '#ffffff']);
    this.maybeDropPickup(enemy);
    this.game.audio.play('enemyDie');
    this.hitStopTime = Math.max(this.hitStopTime, 0.08);
    this.camera.shake(8, 0.2);
    this.camera.punch(0.03);
  }

  // Aterrizaje de un enemigo lanzado
  thud(enemy) {
    this.landDust(enemy.x, enemy.y, 10);
    this.particles.add({ type: 'ring', x: enemy.x, y: enemy.y, size: 8, sizeEnd: 80, life: 0.3, color: '#cfd2ff', width: 5, flat: 0.3 });
    this.game.audio.play('thud');
    this.camera.shake(4, 0.12);
  }

  // Salpicadura: gotas que saltan y vuelven a caer, anillos de onda sobre el agua y un destello del color del charco
  splash(x, y, puddle, power = 1) {
    const water = [puddle.color, '#cffcff', '#ffffff'];
    this.particles.burst({
      x, y: y - 3, count: Math.round(12 + power * 22), speed: [160 + power * 70, 360 + power * 190], angle: [-2.4, -0.74],
      life: [0.45, 0.95], size: [2.4, 4.8], sizeEnd: 0.8, colors: water, type: 'dot', gravity: 950, drag: 0.4,
    });
    // Chorros alargados que dibujan la "corona" de la salpicadura
    this.particles.burst({
      x, y: y - 3, count: Math.round(5 + power * 9), speed: [220 + power * 80, 420 + power * 200], angle: [-2.2, -0.94],
      life: [0.18, 0.4], size: [2, 3.5], colors: ['#ffffff', '#cffcff'], type: 'spark', gravity: 700, drag: 1.2,
    });
    this.particles.add({ type: 'ring', x, y, size: 4, sizeEnd: 30 + power * 40, life: 0.6, color: puddle.color, width: 5, flat: 0.32 });
    this.particles.add({ type: 'ring', x, y, size: 2, sizeEnd: 16 + power * 26, life: 0.4, color: '#ffffff', width: 2.5, flat: 0.32 });
    this.particles.add({ type: 'dot', x, y: y - 6, size: 12 + power * 12, sizeEnd: 0, life: 0.16, color: puddle.color });
    this.game.audio.play('splash', { power });
  }

  // Gotas de lluvia que golpean los charcos visibles
  rainRipples(dt) {
    const visible = this.level.puddles.filter((puddle) => puddle.x > this.camera.left - 80 && puddle.x < this.camera.right + 80);
    if (!visible.length) return;
    this.rippleBudget = (this.rippleBudget || 0) + 9 * dt;
    while (this.rippleBudget >= 1) {
      this.rippleBudget -= 1;
      const puddle = visible[Math.floor(Math.random() * visible.length)];
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.sqrt(Math.random());
      this.particles.add({
        type: 'ring', x: puddle.x + Math.cos(angle) * radius * puddle.rx * 0.9, y: puddle.y + Math.sin(angle) * radius * puddle.ry * 0.7,
        size: 1, sizeEnd: 7 + Math.random() * 7, life: 0.5, color: puddle.color, width: 2, flat: 0.38,
      });
    }
  }

  // Enemigos que caminan por un charco, y entrada al charco de cualquiera (ECO ya salpica con sus pasos y saltos)
  updateSplashes(dt) {
    for (const enemy of this.enemies) {
      if (!enemy.isAlive || enemy.z > 0) { enemy.inPuddle = false; continue; }
      const puddle = this.level.puddleAt(enemy.x, enemy.y);
      if (puddle && !enemy.inPuddle) this.splash(enemy.x, enemy.y, puddle, 0.6);
      enemy.inPuddle = !!puddle;
      enemy.splashTimer = (enemy.splashTimer || 0) - dt;
      if (puddle && Math.abs(enemy.vx) > 20 && enemy.splashTimer <= 0) {
        enemy.splashTimer = 0.24;
        this.splash(enemy.x, enemy.y, puddle, 0.35);
      }
    }
    const player = this.player;
    const puddle = this.level.puddleAt(player.x, player.y);
    if (puddle && !player.inPuddle && player.z === 0 && player.isAlive) this.splash(player.x, player.y, puddle, 0.55);
    player.inPuddle = !!puddle && player.z === 0;
  }

  landDust(x, y, count) {
    // Sobre un charco el golpe contra el suelo levanta agua en vez de polvo
    const puddle = this.level.puddleAt(x, y);
    if (puddle) {
      this.splash(x, y, puddle, Math.min(1.6, count / 7));
      return;
    }
    this.particles.burst({
      x, y: y - 4, count, speed: [20, 120], angle: [-Math.PI * 0.95, -Math.PI * 0.05], life: [0.3, 0.6],
      size: [5, 9], sizeEnd: 20, color: '#a8a4c8', type: 'smoke', additive: false, gravity: -20, drag: 3,
    });
  }

  // Esquirlas de energía: fragmentos angulosos que saltan, giran y se apagan (en fuente con el súper)
  shards(x, y, count, colors, fountain = false) {
    for (let i = 0; i < count; i++) {
      this.particles.add({
        type: 'shard', x: x + (Math.random() - 0.5) * 20, y: y + (Math.random() - 0.5) * 16,
        vx: (Math.random() - 0.5) * (fountain ? 640 : 340),
        vy: fountain ? -(280 + Math.random() * 420) : -(60 + Math.random() * 260),
        gravity: fountain ? 700 : 380, drag: 0.6,
        life: fountain ? 0.9 + Math.random() * 0.5 : 0.45 + Math.random() * 0.35,
        size: fountain ? 4 + Math.random() * 4 : 3 + Math.random() * 3.5, sizeEnd: 0.8,
        color: colors[Math.floor(Math.random() * colors.length)],
        spin: (Math.random() - 0.5) * 18, rotation: Math.random() * Math.PI * 2,
      });
    }
  }

  // Arco eléctrico corto: un relámpago que salta alrededor del punto (y es la altura de pantalla)
  zap(x, y, radius = 60) {
    this.effects.push({ type: 'zap', x, y, radius, seed: Math.floor(Math.random() * 99999), age: 0, duration: 0.16 });
  }

  renderZap(ctx, effect) {
    const random = Draw.seededRandom(effect.seed);
    const fade = 1 - effect.age / effect.duration;
    const a = random() * Math.PI * 2;
    const b = a + 1.2 + random() * 2.2;
    const r = effect.radius;
    const points = [[effect.x + Math.cos(a) * r * 0.5, effect.y + Math.sin(a) * r * 0.9]];
    const end = [effect.x + Math.cos(b) * r, effect.y + Math.sin(b) * r * 1.1];
    for (let i = 1; i < 6; i++) {
      const t = i / 6;
      points.push([
        points[0][0] + (end[0] - points[0][0]) * t + (random() - 0.5) * 22,
        points[0][1] + (end[1] - points[0][1]) * t + (random() - 0.5) * 22,
      ]);
    }
    points.push(end);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const [width, color] of [[7, 'rgba(0, 220, 255, ' + 0.35 * fade + ')'], [2, 'rgba(255, 255, 255, ' + 0.95 * fade + ')']]) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      points.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
      ctx.stroke();
    }
    ctx.restore();
  }

  // Golpe de un enemigo: estela, polvo, sonido y, en el Martillo, grietas, escombros y ondas de choque
  enemyStrike(enemy) {
    const { PURPLE, CYAN } = CONFIG.COLORS;
    if (!enemy.framed) {
      this.effects.push({ type: 'arc', x: enemy.x, y: enemy.y, z: 70, facing: enemy.facing, age: 0, duration: 0.25, color: CONFIG.COLORS.RED, reach: 100 });
      this.game.audio.play('enemySwing');
      return;
    }

    if (enemy.attackKind === 'spin') {
      // El giro levanta polvo y una doble onda alrededor del enemigo
      this.landDust(enemy.x - 55 * enemy.sizeScale, enemy.y, 7);
      this.landDust(enemy.x + 55 * enemy.sizeScale, enemy.y, 7);
      this.particles.add({ type: 'ring', x: enemy.x, y: enemy.y, size: 20, sizeEnd: 175, life: 0.45, color: PURPLE, width: 8, flat: 0.28 });
      this.particles.add({ type: 'ring', x: enemy.x, y: enemy.y, size: 10, sizeEnd: 120, life: 0.34, color: CYAN, width: 4, flat: 0.28 });
      this.effects.push({ type: 'whirl', enemy, age: 0, duration: 0.75 });
      this.game.audio.play('hammerSpin');
      this.camera.shake(7, 0.22);
      return;
    }

    // Martillazo
    const frontX = enemy.x + enemy.facing * enemy.stats.attackRange * 0.8;
    this.landDust(frontX, enemy.y, 12);
    this.particles.add({ type: 'ring', x: frontX, y: enemy.y, size: 10, sizeEnd: 200, life: 0.5, color: PURPLE, width: 10, flat: 0.28 });
    this.particles.add({ type: 'ring', x: frontX, y: enemy.y, size: 6, sizeEnd: 125, life: 0.36, color: CYAN, width: 5, flat: 0.28 });
    this.particles.add({ type: 'dot', x: frontX, y: enemy.y - 8, size: 36, sizeEnd: 0, life: 0.18, color: '#d9c4ff' });
    // Grieta luminosa en el suelo que se apaga despacio
    this.effects.push({ type: 'crack', ground: true, x: frontX, y: enemy.y, seed: Math.floor(Math.random() * 9999), age: 0, duration: 1.9 });
    // Escombros que saltan y vuelven a caer
    this.particles.burst({
      x: frontX, y: enemy.y - 6, count: 16, speed: [200, 520], angle: [-2.5, -0.64], life: [0.55, 1.0], size: [3, 6.5], sizeEnd: 2,
      colors: ['#6b6477', '#3d3846', '#8a8294'], type: 'dot', additive: false, gravity: 1200, drag: 0.3,
    });
    // Chispas del impacto y chorros de energía hacia arriba
    this.particles.burst({
      x: frontX, y: enemy.y - 6, count: 28, speed: [220, 640], angle: [-2.4, -0.74], life: [0.25, 0.6], size: [2.5, 5],
      colors: [PURPLE, CYAN, '#ffffff', '#c9a6ff'], type: 'spark', gravity: 500, drag: 1.4,
    });
    this.game.audio.play('hammerSlam');
    this.flashTime = 0.1;
    this.flashColor = '#b78cff';
    this.camera.shake(12, 0.3);
    this.camera.punch(0.03);
    this.hitStopTime = Math.max(this.hitStopTime, 0.045);
  }

  // Pasos pesados de un enemigo: polvo (o salpicadura), temblor leve y golpe sordo si está cerca
  enemyStep(enemy) {
    const onScreen = enemy.x > this.camera.left - 40 && enemy.x < this.camera.right + 40;
    if (!onScreen || Math.abs(enemy.x - this.player.x) > 440) return;
    this.landDust(enemy.x - enemy.facing * 8, enemy.y, 3);
    this.camera.shake(1.8, 0.07);
    this.game.audio.play('enemyStep', { heavy: enemy.variant === 2 });
  }

  // Estrella de cómic en el punto de impacto (los destellos de los juegos de Marvel vs. Capcom)
  starburst(x, y, z, size = 1) {
    this.effects.push({ type: 'starburst', x, y, z, size, age: 0, duration: 0.26, rotation: Math.random() * Math.PI });
  }

  // Rex Vane cae desde el cielo al centro de la escena; la tormenta responde con un relámpago
  spawnBoss() {
    const boss = new RexVane(this.camera.x + CONFIG.WIDTH * 0.5 + 120, 440);
    this.enemies.push(boss);
    this.atmosphere.stormTimer = 0;
    this.game.audio.play('rexArrive');
    this.camera.shake(4, 0.5);
    return boss;
  }

  // Cartel con el nombre del ataque que cruza la pantalla
  showCallout(text, duration, style) {
    this.callout = { text, duration, age: 0, ...style };
  }

  // --- Haces de energía (rayo de ECO) ---
  addBeam(config) {
    const beam = { age: 0, seed: Math.random() * 1000, dx: 46, dy: -94, length: 300, duration: 0.4, power: 1, dim: false, ...config };
    beam.x = beam.owner.x + beam.facing * beam.dx;
    beam.y = beam.owner.y - beam.owner.z + beam.dy;
    this.beams.push(beam);
  }

  // El haz sigue a su dueño, lanza chispas a lo largo, sacude la cámara y electrocuta a quien cruza
  updateBeams(dt) {
    for (const beam of this.beams) {
      beam.age += dt;
      const owner = beam.owner;
      beam.x = owner.x + beam.facing * beam.dx;
      beam.y = owner.y - owner.z + beam.dy;
      const reach = beam.length * Math.min(1, beam.age / 0.09);
      const big = beam.power >= 2;

      for (let i = 0; i < (big ? 3 : 1); i++) {
        this.particles.add({
          type: 'spark', x: beam.x + beam.facing * Math.random() * reach, y: beam.y + (Math.random() - 0.5) * 14,
          vx: (Math.random() - 0.5) * 240, vy: -60 - Math.random() * 340, gravity: 520, life: 0.28, size: 2.6,
          color: ['#ffffff', CONFIG.COLORS.CYAN, CONFIG.COLORS.YELLOW][Math.floor(Math.random() * 3)],
        });
      }
      if (big && beam.age < beam.duration * 0.85) {
        this.particles.burst({
          x: beam.x + beam.facing * reach, y: beam.y, count: 2, speed: [150, 520], life: [0.15, 0.35], size: [2.4, 4],
          colors: ['#ffffff', CONFIG.COLORS.CYAN], type: 'spark', drag: 2,
        });
        this.camera.shake(4.5, 0.08);
      }

      for (const enemy of this.enemies) {
        const ahead = (enemy.x - beam.x) * beam.facing;
        if (enemy.isAlive && ahead > -30 && ahead < reach && Math.abs(enemy.y - owner.y) < 55) enemy.shock = Math.max(enemy.shock || 0, 0.3);
      }
    }
    this.beams = this.beams.filter((beam) => beam.age < beam.duration);
  }

  // Dibujo del haz: capas de resplandor, núcleo blanco, relámpagos que titilan con bifurcaciones y fogonazos en la boca y la punta
  renderBeam(ctx, beam) {
    const { age, duration, facing, power } = beam;
    const grow = 1 - Math.pow(1 - Math.min(1, age / 0.09), 3);
    const fade = age > duration * 0.65 ? Math.max(0, (duration - age) / (duration * 0.35)) : 1;
    if (fade <= 0) return;
    const big = beam.thickness ?? (power >= 2 ? 1 : 0.55);
    const length = beam.length * grow;
    const x0 = beam.x;
    const y0 = beam.y;
    const x1 = x0 + facing * length;
    const flicker = 0.88 + 0.12 * Math.sin(age * 80);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = fade;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const [width, color] of [[64, 'rgba(0, 160, 255, 0.09)'], [38, 'rgba(0, 235, 255, 0.2)'], [18, 'rgba(160, 255, 255, 0.5)'], [7, 'rgba(255, 255, 255, 0.95)']]) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width * big * flicker;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y0);
      ctx.stroke();
    }

    // Relámpagos: se regeneran ~30 veces por segundo
    const random = Draw.seededRandom(Math.floor(age * 30) * 7919 + Math.floor(beam.seed));
    const bolts = power >= 2 ? 5 : 3;
    for (let k = 0; k < bolts; k++) {
      const amplitude = (10 + k * 7) * big;
      ctx.strokeStyle = k === 0 ? '#ffffff' : (k % 2 ? '#ffe600' : '#00f5ff');
      ctx.lineWidth = k === 0 ? 3 : 2;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      const forks = [];
      for (let distance = 24; distance < length; distance += 24) {
        const envelope = Math.sin(Math.min(1, distance / Math.max(1, length)) * Math.PI);
        const px = x0 + facing * distance;
        const py = y0 + (random() - 0.5) * 2 * amplitude * (0.35 + envelope);
        ctx.lineTo(px, py);
        if (random() < 0.12) forks.push([px, py]);
      }
      ctx.lineTo(x1, y0 + (random() - 0.5) * amplitude);
      ctx.stroke();
      for (const [fx, fy] of forks) {
        ctx.beginPath();
        ctx.moveTo(fx, fy);
        ctx.lineTo(fx + facing * (18 + random() * 40), fy + (random() - 0.5) * 100 * big);
        ctx.stroke();
      }
    }

    // Fogonazo en la boca y en la punta, con rayos cortos en estrella
    const flare = (cx, cy, radius) => {
      const gradient = ctx.createRadialGradient(cx, cy, 2, cx, cy, radius);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
      gradient.addColorStop(0.35, 'rgba(120, 255, 250, 0.55)');
      gradient.addColorStop(1, 'rgba(0, 245, 255, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
    };
    flare(x0, y0, 52 * big);
    flare(x1, y0, 74 * big * grow);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 9; i++) {
      const angle = random() * Math.PI * 2;
      const spike = (24 + random() * 60) * big;
      ctx.beginPath();
      ctx.moveTo(x1, y0);
      ctx.lineTo(x1 + Math.cos(angle) * spike, y0 + Math.sin(angle) * spike);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Líneas de velocidad radiales desde la boca del rayo (en pantalla)
  renderBeamOverlay(ctx) {
    for (const beam of this.beams) {
      if (beam.power < 2 || beam.age > beam.duration * 0.85) continue;
      const sx = beam.x - this.camera.x;
      const sy = beam.y;
      const random = Draw.seededRandom(Math.floor(beam.age * 24) * 131 + 7);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      for (let i = 0; i < 44; i++) {
        const angle = random() * Math.PI * 2;
        const inner = 130 + random() * 120;
        const outer = inner + 120 + random() * 380;
        ctx.strokeStyle = random() < 0.5 ? 'rgba(210, 255, 255, 0.4)' : 'rgba(0, 245, 255, 0.35)';
        ctx.lineWidth = 1 + random() * 2.2;
        ctx.beginPath();
        ctx.moveTo(sx + Math.cos(angle) * inner, sy + Math.sin(angle) * inner * 0.8);
        ctx.lineTo(sx + Math.cos(angle) * outer, sy + Math.sin(angle) * outer * 0.8);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  // Cartel del ataque: banda inclinada con líneas de velocidad y el nombre en letras cromadas
  renderCallout(ctx) {
    const callout = this.callout;
    if (!callout) return;
    const t = callout.age / callout.duration;
    const slide = Math.min(1, callout.age / 0.12);
    const ease = 1 - Math.pow(1 - slide, 3);
    const fade = t > 0.78 ? (1 - t) / 0.22 : 1;
    const cy = callout.y ?? 150;
    const bandX = -80 - (1 - ease) * 760;

    ctx.save();
    ctx.globalAlpha = Math.max(0, fade);
    Draw.parallelogram(ctx, bandX, cy - 44, CONFIG.WIDTH + 160, 92, 70);
    const gradient = ctx.createLinearGradient(0, 0, CONFIG.WIDTH, 0);
    gradient.addColorStop(0, 'rgba(2, 2, 16, 0.92)');
    gradient.addColorStop(1, 'rgba(24, 10, 64, 0.85)');
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = callout.glow;
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';

    // Líneas de velocidad que cruzan la banda
    ctx.save();
    Draw.parallelogram(ctx, bandX, cy - 44, CONFIG.WIDTH + 160, 92, 70);
    ctx.clip();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
    for (let i = 0; i < 16; i++) {
      const x = ((callout.age * 1500 + i * 173) % (CONFIG.WIDTH + 320)) - 160;
      ctx.fillRect(x, cy - 40 + ((i * 37) % 82), 90 + (i % 3) * 40, 2);
    }
    ctx.restore();

    const pop = 1 + Math.max(0, 0.3 - callout.age * 2.2);
    Draw.rock(ctx, callout.text, CONFIG.WIDTH / 2 - (1 - ease) * 420, cy + 25, {
      size: 66 * pop, align: 'center', colors: callout.colors, glow: callout.glow, glowBlur: 24, rim: callout.rim, skew: 0.28, tracking: 3,
    });
    ctx.restore();
  }

  // Grieta luminosa en el suelo: líneas ramificadas aplastadas en perspectiva que se apagan con el tiempo
  renderCrack(ctx, effect) {
    const t = effect.age / effect.duration;
    const glow = Math.max(0, 1 - effect.age / 0.9);
    const fade = t > 0.6 ? (1 - t) / 0.4 : 1;
    const random = Draw.seededRandom(effect.seed);
    const paths = [];
    for (let branch = 0; branch < 9; branch++) {
      let angle = (branch / 9) * Math.PI * 2 + random() * 0.5;
      let px = 0;
      let py = 0;
      const points = [[0, 0]];
      const segments = 3 + Math.floor(random() * 3);
      for (let s = 0; s < segments; s++) {
        angle += (random() - 0.5) * 0.8;
        const length = 22 + random() * 48;
        px += Math.cos(angle) * length;
        py += Math.sin(angle) * length;
        points.push([px, py]);
      }
      paths.push(points);
    }
    const stroke = () => {
      for (const points of paths) {
        ctx.beginPath();
        points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
        ctx.stroke();
      }
    };

    ctx.save();
    ctx.translate(effect.x, effect.y);
    ctx.scale(1, 0.34);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = fade * 0.85;
    ctx.strokeStyle = '#05030c';
    ctx.lineWidth = 7;
    stroke();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = fade * (0.25 + 0.75 * glow);
    ctx.strokeStyle = glow > 0.5 ? '#c9a6ff' : CONFIG.COLORS.PURPLE;
    ctx.lineWidth = 3;
    stroke();
    ctx.globalAlpha = fade * glow;
    ctx.strokeStyle = CONFIG.COLORS.CYAN;
    ctx.lineWidth = 1.4;
    stroke();
    ctx.restore();
  }

  // Arcos de energía que giran alrededor del enemigo durante su giro de martillo
  renderWhirl(ctx, effect) {
    const owner = effect.enemy;
    if (!owner) return;
    const t = effect.age / effect.duration;
    const fade = 1 - t * t;
    ctx.save();
    const size = owner.sizeScale || 1;
    ctx.translate(owner.x, owner.y - owner.z);
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (let k = 0; k < 3; k++) {
      const height = (28 + k * 34) * size;
      const rx = (92 - k * 8 + t * 40) * size;
      const ry = (20 + k * 4) * size;
      const spin = effect.age * 15 + k * 1.9;
      ctx.strokeStyle = k === 1 ? `rgba(0, 245, 255, ${0.8 * fade})` : `rgba(170, 110, 255, ${0.8 * fade})`;
      ctx.lineWidth = 6 - k * 1.2;
      ctx.beginPath();
      ctx.ellipse(0, -height, rx, ry, 0, spin, spin + Math.PI * 1.35);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.7 * fade})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, -height, rx, ry, 0, spin + 0.5, spin + Math.PI * 0.9);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Estrella de cómic: polígono puntiagudo blanco con núcleo amarillo y contorno negro, que "salta" al aparecer
  renderStarburst(ctx, effect) {
    const t = effect.age / effect.duration;
    const pop = Math.min(1, effect.age / 0.06);
    const radius = effect.size * 46 * (0.5 + 0.6 * pop + 0.25 * t);
    const alpha = 1 - t * t;
    const random = Draw.seededRandom(Math.floor(effect.rotation * 1000));
    const spikes = 9;
    const points = [];
    for (let i = 0; i < spikes * 2; i++) {
      const outer = i % 2 === 0;
      const angle = effect.rotation + (i / (spikes * 2)) * Math.PI * 2;
      const r = outer ? radius * (0.85 + random() * 0.3) : radius * 0.42;
      points.push([Math.cos(angle) * r, Math.sin(angle) * r]);
    }
    const trace = (scale) => {
      ctx.beginPath();
      points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x * scale, y * scale) : ctx.lineTo(x * scale, y * scale)));
      ctx.closePath();
    };
    ctx.save();
    ctx.translate(effect.x, effect.y - effect.z);
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.lineJoin = 'miter';
    trace(1);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#000000';
    ctx.stroke();
    trace(0.55);
    ctx.fillStyle = CONFIG.COLORS.YELLOW;
    ctx.fill();
    ctx.restore();
  }

  // Super: oscurece el fondo y acerca la cámara a ECO
  setCinematic(on) {
    this.cinematicOn = on;
    this.camera.zoomTarget = on ? 1.2 : 1;
    this.camera.zoomOriginX = this.player.x - this.camera.x;
    this.camera.zoomOriginY = this.player.y - 70;
  }

  // ---------------------------------------------------------------- objetos de vida

  static PICKUP_HEAL = 28;
  static PICKUP_LIFETIME = 14;

  // Los enemigos soltan a veces un orbe de vida; si ECO anda bajo de vida, es más probable
  maybeDropPickup(enemy) {
    const lowHealth = this.player.hp / this.player.maxHp < 0.5;
    const chance = 0.22 + (lowHealth ? 0.25 : 0);
    if (Math.random() > chance) return;
    this.pickups.push({
      x: enemy.x, y: enemy.y, z: 30, vz: 330, vx: (Math.random() - 0.5) * 120,
      age: 0, heal: GameScene.PICKUP_HEAL,
    });
  }

  updatePickups(dt) {
    const player = this.player;
    for (const pickup of this.pickups) {
      pickup.age += dt;
      pickup.vz -= 1500 * dt;
      pickup.z += pickup.vz * dt;
      pickup.x += pickup.vx * dt;
      pickup.vx *= Math.max(0, 1 - dt * 3);
      if (pickup.z <= 0) {
        pickup.z = 0;
        pickup.vz = pickup.vz < -180 ? -pickup.vz * 0.4 : 0; // rebota un poco
      }
      // Se recoge al acercarse (imán suave desde cerca)
      const dx = player.x - pickup.x;
      const dy = player.y - pickup.y;
      if (player.isAlive && Math.hypot(dx, dy * 1.6) < 150) {
        pickup.x += dx * Math.min(1, dt * 4);
        pickup.y += dy * Math.min(1, dt * 4);
      }
      if (player.isAlive && Math.abs(dx) < 34 && Math.abs(dy) < 30 && pickup.z < 50 && pickup.age > 0.3) {
        pickup.taken = true;
        this.healPlayer(pickup.heal);
      }
    }
    this.pickups = this.pickups.filter((pickup) => !pickup.taken && pickup.age < GameScene.PICKUP_LIFETIME);
  }

  // Cura a ECO con texto verde, anillo y sonido
  healPlayer(amount) {
    const player = this.player;
    const healed = Math.min(amount, player.maxHp - player.hp);
    if (healed <= 0) return;
    player.hp += healed;
    this.addTextEffect(player.x, player.y, player.z + player.h + 8, '+' + Math.round(healed), { color: '#7dffb0', size: 28 });
    this.particles.add({ type: 'ring', x: player.x, y: player.y - 70, size: 10, sizeEnd: 80, life: 0.5, color: '#7dffb0', width: 6, flat: 0.5 });
    this.particles.burst({ x: player.x, y: player.y - 80, count: 14, speed: [60, 220], angle: [-2.6, -0.5], life: [0.4, 0.8], size: [2, 4], colors: ['#7dffb0', '#ffffff', '#00f5ff'], type: 'dot', gravity: -60 });
    this.game.audio.play('pickup');
  }

  addTextEffect(x, y, z, text, options) {
    this.effects.push({ type: 'text', x, y, z, text, age: 0, duration: 0.9, ...options });
  }

  renderPickup(ctx, pickup) {
    const pulse = 0.5 + 0.5 * Math.sin(pickup.age * 7);
    const blink = pickup.age > GameScene.PICKUP_LIFETIME - 3 && Math.floor(pickup.age * 8) % 2 === 0;
    if (blink) return;
    const cx = pickup.x;
    const cy = pickup.y - pickup.z - 22 - Math.sin(pickup.age * 3) * 3;

    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(pickup.x, pickup.y, 14, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalCompositeOperation = 'lighter';
    const glow = ctx.createRadialGradient(cx, cy, 2, cx, cy, 40 + 8 * pulse);
    glow.addColorStop(0, 'rgba(160, 255, 200, 0.7)');
    glow.addColorStop(1, 'rgba(0, 255, 160, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, 48, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    // Orbe con cruz de vida
    ctx.fillStyle = '#04200f';
    ctx.beginPath();
    ctx.arc(cx, cy, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#7dffb0';
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx - 3, cy - 9, 6, 18);
    ctx.fillRect(cx - 9, cy - 3, 18, 6);
    ctx.restore();
  }

  // ---------------------------------------------------------------- cierre del nivel: el duelo con Batuk

  // Línea de tiempo (segundos desde el fin del nivel): oscurece → Batuk entra caminando → pisotón → diálogo → duelo
  // musical → Batuk cae derrotado → imagen de derrota → fundido a negro y pantalla final
  static FINALE_FALL_AT = 1.1; // instante en que Batuk empieza a entrar
  static FINALE_FADE = 1.1;
  static DEFEAT_TOPPLE = 2.6; // lo que tarda en caer antes de mostrar la imagen de derrota
  static BATUK_DIALOGUE = [
    { who: 'eco', name: 'ECO', text: 'Estoy buscando algo. Gente que lleva música adentro aunque nunca haya tocado una nota.' },
    { who: 'eco', name: 'ECO', text: 'Monjes, les decían antes — los que podían cambiar el mundo solo con vibrar diferente.' },
    { who: 'stage', text: '(Batuk no se mueve. La lluvia golpea su armadura sin que él lo registre.)' },
    { who: 'batuk', name: 'BATUK', text: 'No sé de qué hablas.' },
    { who: 'eco', name: 'ECO', text: 'Yo tampoco lo entendía al principio. Pero hay una frecuencia que no se puede silenciar — ni con decretos, ni con fuerza. La llevo aquí.' },
    { who: 'stage', text: '(ECO pone la mano sobre La Réquiem.)' },
    { who: 'eco', name: 'ECO', text: 'Y tú también la llevas. Ahí.' },
    { who: 'stage', text: '(Señala el pecho de Batuk.)' },
    { who: 'eco', name: 'ECO', text: 'Te escucho desde que entré al distrito. Algo en ti vibra distinto a todo lo que me han mandado. Eres uno de ellos.' },
    { who: 'stage', text: '(Pausa larga.)' },
    { who: 'batuk', name: 'BATUK', text: '...' },
    { who: 'stage', text: '(Algo cruza su cara — demasiado rápido para leerlo — y luego se cierra como una puerta.)' },
    { who: 'batuk', name: 'BATUK', text: 'Ya nadie es especial.' },
    { who: 'stage', text: '(Voz plana, sin rabia. Peor que la rabia.)' },
    { who: 'batuk', name: 'BATUK', text: 'Eso que escuchas... es lo que queda cuando alguien creyó que sí lo era. Y se equivocó.' },
    { who: 'eco', name: 'ECO', text: '¿Qué te hicieron?' },
    { who: 'batuk', name: 'BATUK', text: 'Nada que no me haya hecho yo solo.' },
    { who: 'stage', text: '(Por primera vez se mueve: un paso adelante, lento, definitivo.)', event: 'step' },
    { who: 'batuk', name: 'BATUK', text: 'Hazte a un lado.' },
    { who: 'eco', name: 'ECO', text: 'No puedo.' },
    { who: 'batuk', name: 'BATUK', text: 'Entonces tampoco tú eres especial. Solo eres el siguiente.' },
  ];
  // Después del combate: Batuk, caído, se levanta y habla de la Orden del Silencio
  static BATUK_EPILOGUE = [
    { who: 'stage', text: '(Batuk yace entre sus instrumentos rotos. No mira a ECO.)' },
    { who: 'batuk', name: 'BATUK', whisper: true, text: 'Me habías dicho que escuchabas algo en mí.' },
    { who: 'stage', text: '(Pausa.)' },
    { who: 'batuk', name: 'BATUK', whisper: true, text: 'Tenías razón. Lo apagué hace años. Pensé que era lo correcto.' },
    { who: 'eco', name: 'ECO', text: '¿Por qué?' },
    { who: 'batuk', name: 'BATUK', text: 'Porque nos lo pidieron. Nos dijeron que si seguíamos vibrando... algo en el universo se desestabilizaría.' },
    { who: 'batuk', name: 'BATUK', text: 'Que éramos demasiado para este tiempo.' },
    { who: 'stage', text: '(Se pone de pie, despacio, con el peso de alguien que carga una decisión vieja.)', event: 'stand' },
    { who: 'batuk', name: 'BATUK', text: 'Somos — éramos — una orden. La Orden del Silencio. No el silencio de ellos, no el de The Quietarchy. El nuestro. Elegido.' },
    { who: 'batuk', name: 'BATUK', text: 'Éramos doce, cada uno con una frecuencia distinta. Decidimos callar para proteger lo que amábamos.' },
    { who: 'eco', name: 'ECO', text: '¿Y funcionó?' },
    { who: 'stage', text: '(Batuk mira el distrito destruido a su alrededor.)' },
    { who: 'batuk', name: 'BATUK', text: 'Mira dónde estamos.' },
    { who: 'stage', text: '(Pausa larga.)' },
    { who: 'batuk', name: 'BATUK', text: 'Ahora que volviste a despertar algo en mí... sé que nos equivocamos. El universo no necesitaba nuestro silencio. Nos necesitaba a nosotros.' },
    { who: 'stage', text: '(Por primera vez, algo parecido a una sonrisa. Apenas.)' },
    { who: 'batuk', name: 'BATUK', text: 'Gracias. Por no dejarme quieto.' },
    { who: 'eco', name: 'ECO', text: '¿Dónde están los otros?' },
    { who: 'stage', text: '(Batuk duda un momento.)' },
    { who: 'batuk', name: 'BATUK', text: 'Dispersos. Algunos cedieron como yo. Otros... no sé. Pero hace poco, antes de que me pusieran aquí de guardia...' },
    { who: 'stage', text: '(Baja la voz, como si The Quietarchy pudiera escucharlo.)' },
    { who: 'batuk', name: 'BATUK', whisper: true, text: 'Vi a alguien. En las estaciones de tren del Sector Meridian — las viejas, las que ya no usa nadie.' },
    { who: 'batuk', name: 'BATUK', whisper: true, text: 'Una figura que se movía entre los andenes vacíos como si estuviera esperando algo. O a alguien.' },
    { who: 'batuk', name: 'BATUK', text: 'No vi su cara. Pero la frecuencia...' },
    { who: 'stage', text: '(Se toca el pecho.)' },
    { who: 'batuk', name: 'BATUK', text: 'Era de los nuestros.' },
    { who: 'eco', name: 'ECO', text: '¿Me estás diciendo que hay más?' },
    { who: 'batuk', name: 'BATUK', text: 'Te estoy diciendo que no estás tan solo como crees.' },
    { who: 'stage', text: '(Se endereza, ya sin la rigidez de antes.)' },
    { who: 'batuk', name: 'BATUK', text: 'Ve a Meridian. Y cuando encuentres a quien sea que espera ahí... dile que Batuk recuerda la nota que le correspondía.' },
    { who: 'stage', text: '(Pausa, casi para sí mismo.)' },
    { who: 'batuk', name: 'BATUK', text: 'A ver si ella también recuerda la suya.' },
  ];

  startFinale() {
    this.finished = true; // evita el fin de partida normal
    const player = this.player;
    this.finale = { time: 0, boss: null, phase: 'enter', fade: 0, done: false, defeatTime: 0, leaving: false };
    this.camera.lockX = this.camera.x; // la cámara se queda quieta
    player.facing = 1;
    player.energy = 0;
    this.game.audio.play('drumRumble');
    this.hud.finaleStart = this.hud.time;
  }

  // Control de ECO anulado durante el cierre
  static NO_INPUT = { isDown: () => false, justPressed: () => false, preserve() {}, endStep() {} };

  updateFinale(dt, input) {
    const finale = this.finale;
    finale.time += dt;
    const world = this.world;

    // Retumbar creciente antes de que entre Batuk
    if (finale.time < GameScene.FINALE_FALL_AT) {
      this.camera.shake(1 + 3 * (finale.time / GameScene.FINALE_FALL_AT), 0.1);
    }

    // Batuk entra caminando por la derecha y se planta frente a ECO, siempre dentro de la pantalla
    if (!finale.boss && finale.time >= GameScene.FINALE_FALL_AT) {
      finale.boss = new BatukBoss(this.camera.right + 200, 462);
      finale.boss.targetX = Math.min(this.player.x + 330, this.camera.right - 150);
      this.game.audio.startBoss(); // su música empieza en cuanto aparece Batuk
      this.game.audio.play('batukArrive'); // retumbar de su llegada: el pico coincide con el pisotón final
    }

    const boss = finale.boss;
    if (boss && boss.update(dt, world)) this.batukArrives(boss);

    if (boss && boss.landed && finale.phase === 'enter') {
      // Tras el pisotón: cartel con su nombre y diálogo; al cerrarlo empieza el duelo musical
      if (!finale.dialogueShown && boss.landedTime > (this.skipBatukDialogue ? 0.4 : 1.4)) {
        finale.dialogueShown = true;
        const startDuel = () => {
          this.showCallout('BATUK', 2.4, { y: 84, colors: ['#ffffff', '#ffd23a', '#9a5a00'], glow: '#ffb000', rim: '#2a1600' }); // el nombre aparece al empezar el duelo
          finale.phase = 'duel';
          this.duel = new RhythmDuel(this, boss, () => this.batukDefeated(boss));
        };
        if (this.skipBatukDialogue) {
          startDuel();
        } else {
          this.dialogue = new Dialogue(GameScene.BATUK_DIALOGUE, startDuel, (index, line) => { if (line.event === 'step') boss.stepForward(); });
        }
      }
    }

    if (finale.phase === 'defeat') {
      finale.defeatTime += dt;
      const cardAge = finale.defeatTime - GameScene.DEFEAT_TOPPLE;
      const confirm = input && (input.justPressed('confirm') || input.justPressed('attack'));
      if (cardAge > 1.8 && confirm) {
        finale.phase = 'epilogue';
        this.dialogue = new Dialogue(GameScene.BATUK_EPILOGUE, () => {
          finale.leaving = true;
          finale.leaveAt = finale.time;
        }, (index, line) => { if (line.event === 'stand') boss.standUp(); });
      }
    }
    if (finale.phase === 'epilogue') {
      if (finale.leaving) {
        finale.fade = Math.min(1, (finale.time - finale.leaveAt) / GameScene.FINALE_FADE);
        if (finale.fade >= 1 && !finale.done) {
          finale.done = true;
          this.game.scenes.change('ending');
        }
      }
    }
  }

  // Pisotón de Batuk al plantarse: onda dorada, grietas, escombros y sacudida
  batukArrives(boss) {
    const x = boss.x;
    const y = boss.y;
    this.game.audio.play('drumBoom');
    this.flashTime = 0.4;
    this.flashColor = '#ffb000';
    this.camera.shake(20, 0.7);
    this.camera.punch(0.05);
    this.hitStopTime = Math.max(this.hitStopTime, 0.1);
    this.landDust(x - 50, y, 12);
    this.landDust(x + 50, y, 12);
    this.particles.add({ type: 'ring', x, y, size: 20, sizeEnd: 560, life: 0.9, color: '#ffd23a', width: 16, flat: 0.28 });
    this.particles.add({ type: 'ring', x, y, size: 10, sizeEnd: 400, life: 0.7, color: '#ff7a00', width: 9, flat: 0.28 });
    this.effects.push({ type: 'crack', ground: true, x, y, seed: 31337, age: 0, duration: 8 });
    this.effects.push({ type: 'crack', ground: true, x: x - 80, y, seed: 777, age: 0, duration: 8 });
    this.particles.burst({
      x, y: y - 8, count: 34, speed: [260, 760], angle: [-2.6, -0.54], life: [0.6, 1.2], size: [3, 7], sizeEnd: 2,
      colors: ['#6b6477', '#3d3846', '#8a8294'], type: 'dot', additive: false, gravity: 1200, drag: 0.3,
    });
    this.particles.burst({
      x, y: y - 10, count: 40, speed: [220, 700], angle: [-2.6, -0.54], life: [0.4, 0.9], size: [2.5, 5],
      colors: ['#ffd23a', '#ff7a00', '#ffffff'], type: 'spark', gravity: 500, drag: 1.4,
    });
    // ECO sale despedido hacia atrás (sin daño) y queda aturdido un instante
    const player = this.player;
    player.invulnerable = 0; // sin parpadeo: no quedan enemigos que lo dañen
    player.kx = -Math.sign(x - player.x || 1) * 520;
    player.setState('hurt');
    player.hitFlash = 0.15;
  }

  // ECO gana el duelo: Batuk cae y, pasado un momento, aparece la imagen de derrota
  batukDefeated(boss) {
    this.duel = null;
    this.game.audio.keepBoss(); // la canción de Batuk sigue sonando tras el duelo (no vuelve la de la etapa)
    this.finale.phase = 'defeat';
    this.finale.defeatTime = 0;
    boss.defeat(this.world);
    this.player.score += 5000;
  }

  // Tinte, imagen de derrota y fundido del cierre (se dibuja sobre todo)
  renderFinaleOverlay(ctx) {
    const finale = this.finale;
    if (!finale) return;
    if (finale.boss && finale.boss.landed && !finale.boss.defeated) {
      // Franja de tinte dorado-marrón que respira
      const pulse = 0.5 + 0.5 * Math.sin(finale.time * 4);
      const gradient = ctx.createRadialGradient(CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2, CONFIG.HEIGHT * 0.35, CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2, CONFIG.WIDTH * 0.62);
      gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
      gradient.addColorStop(1, 'rgba(70, 36, 0, ' + (0.35 + 0.15 * pulse) + ')');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
    }
    if (finale.phase === 'defeat' && finale.defeatTime > GameScene.DEFEAT_TOPPLE) {
      DefeatCard.render(ctx, finale.defeatTime - GameScene.DEFEAT_TOPPLE);
    }
    if (finale.fade > 0) {
      ctx.fillStyle = 'rgba(0, 0, 0, ' + finale.fade + ')';
      ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
    }
  }

  // ---------------------------------------------------------------- bucle

  update(dt) {
    const input = this.game.input;
    if (!this.finished && input.justPressed('pause')) this.togglePause();
    if (this.paused) return;
    if (this.duel) this.duel.update(dt, input);
    if (this.dialogue) {
      this.updateDialogue(dt, input);
      return;
    }

    // Temblor, zoom y destellos usan tiempo real: siguen vivos durante el hit-stop
    this.updateFeedback(dt);
    if (this.hitStopTime > 0) {
      this.hitStopTime -= dt;
      input.preserve(); // las pulsaciones durante el congelado no se pierden
      this.hud.update(dt);
      return;
    }

    const scaled = dt * (this.slowTime > 0 ? this.slowFactor : 1);
    this.time += scaled;

    this.player.update(scaled, this.finale ? GameScene.NO_INPUT : input, this.world);
    const wasLocked = this.level.locked;
    const wasCompleted = this.level.completed;
    this.level.update(this.player, this.camera, (x, y, aggressive, opts) => this.spawnEnemy(x, y, aggressive, opts), scaled);
    for (const warning of this.edgeWarnings) warning.age += scaled;
    this.edgeWarnings = this.edgeWarnings.filter((warning) => warning.age < 0.9);
    if ((wasLocked && !this.level.locked) || (!wasCompleted && this.level.completed)) this.waveClearedFx();

    for (const enemy of this.enemies) enemy.update(scaled, this.world);
    this.checkBossIntro();
    this.separateEnemies();
    this.enemies.splice(0, this.enemies.length, ...this.enemies.filter((enemy) => !enemy.removable));

    this.trino.update(scaled, this.world);
    this.updateBeams(scaled);
    this.updatePickups(scaled);
    this.updateProjectiles(scaled);
    this.camera.follow(this.player.x, scaled);
    // ECO no puede salir de la pantalla ni retroceder más allá de la cámara
    this.player.x = Math.max(this.camera.left + 24, Math.min(this.camera.right - 24, this.player.x));

    this.updateEffects(scaled);
    this.particles.update(scaled);
    this.updateSplashes(scaled);
    if (this.level.config.ambient === 'rain') this.rainRipples(scaled);
    this.updateAmbient(scaled);
    this.live.update(scaled);
    this.props.update(scaled);
    this.atmosphere.update(scaled, this.camera, this.atmosphereHooks);
    this.maxCombo = Math.max(this.maxCombo, this.player.comboHits);
    this.updateHeartbeat(scaled);
    this.hud.update(dt);
    if (this.finale) this.updateFinale(dt, input);
    else this.checkEndConditions(dt);
  }

  updateFeedback(dt) {
    this.flashTime = Math.max(0, this.flashTime - dt);
    if (this.slowTime > 0) this.slowTime -= dt;
    // Fondo oscurecido: en el súper (cinemática) y mientras dura un haz potente
    const beamDim = this.beams.some((beam) => beam.dim && beam.age < beam.duration * 0.9);
    const finaleDark = this.finale ? Math.min(0.62, 0.15 + this.finale.time * 0.35) : 0;
    const darkTarget = Math.max(finaleDark, this.cinematicOn ? 0.6 : (beamDim ? 0.42 : 0));
    this.darkness += (darkTarget - this.darkness) * Math.min(1, dt * 8);
    if (this.callout) {
      this.callout.age += dt;
      if (this.callout.age >= this.callout.duration) this.callout = null;
    }
    this.camera.update(dt);
  }

  // Oleada limpia: instante en cámara lenta
  // Cuando el jefe termina de aparecer se abre el diálogo; al cerrarlo empieza el combate
  checkBossIntro() {
    const boss = this.enemies.find((enemy) => enemy.boss);
    if (!boss || boss.talked || boss.state !== 'talk') return;
    boss.talked = true;
    this.player.facing = Math.sign(boss.x - this.player.x) || this.player.facing;
    this.player.vx = 0;
    this.game.audio.play('rexTalk'); // voz de fondo mientras habla con ECO
    this.dialogue = new Dialogue(GameScene.REX_DIALOGUE, () => {
      this.game.audio.play('rexTalkEnd');
      boss.engage();
      this.showCallout(boss.name, 2.2, { y: 84, colors: ['#ffffff', '#ff5a8a', '#6a0030'], glow: '#ff2a55', rim: '#1a0010' });
      this.game.audio.play('rexBolt');
      this.camera.shake(6, 0.3);
    });
  }

  // Mientras dura el diálogo el combate está en pausa; el escenario sigue vivo (lluvia, humo, relámpagos)
  updateDialogue(dt, input) {
    this.updateFeedback(dt);
    this.dialogue.update(dt, input, this.game.audio);
    for (const enemy of this.enemies) if (enemy.boss) enemy.update(dt, this.world);
    if (this.finale && this.finale.boss) this.finale.boss.update(dt, this.world);
    this.player.vx = 0;
    this.updateEffects(dt);
    this.particles.update(dt);
    this.updateAmbient(dt);
    this.atmosphere.update(dt, this.camera, this.atmosphereHooks);
    this.hud.update(dt);
    if (this.dialogue.done) this.dialogue = null;
  }

  // Escáner rojo de Rex Vane: un haz desde su visor hasta ECO y una banda que recorre su cuerpo de arriba abajo
  renderScan(ctx) {
    const boss = this.enemies.find((enemy) => enemy.boss);
    if (!boss) return;
    const player = this.player;
    const head = boss.headPoint;
    const top = player.y - 150;
    const bottom = player.y;
    const sweep = (this.dialogue.age * 0.9) % 1;
    const bandY = top + (bottom - top) * sweep;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(255, 50, 90, 0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(head.x, head.y);
    ctx.lineTo(player.x, bandY);
    ctx.stroke();
    const band = ctx.createLinearGradient(0, bandY - 16, 0, bandY + 16);
    band.addColorStop(0, 'rgba(255, 40, 80, 0)');
    band.addColorStop(0.5, 'rgba(255, 90, 120, 0.75)');
    band.addColorStop(1, 'rgba(255, 40, 80, 0)');
    ctx.fillStyle = band;
    ctx.fillRect(player.x - 56, bandY - 16, 112, 32);
    // Marcas de objetivo alrededor de ECO
    ctx.strokeStyle = 'rgba(255, 70, 100, 0.8)';
    ctx.lineWidth = 3;
    const corners = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
    for (const [cx, cy] of corners) {
      const px = player.x + cx * 54;
      const py = (top + bottom) / 2 + cy * 80;
      ctx.beginPath();
      ctx.moveTo(px, py - cy * 16);
      ctx.lineTo(px, py);
      ctx.lineTo(px - cx * 16, py);
      ctx.stroke();
    }
    ctx.restore();
  }

  waveClearedFx() {
    this.healPlayer(32); // descanso entre oleadas
    this.slowTime = 0.9;
    this.slowFactor = 0.35;
    this.camera.punch(0.05);
  }

  // Objetos de primer plano que ahora mismo tapan a alguien: visibles en pantalla y con un personaje detrás (pies más arriba que su base).
  // Se devuelven como "dibujables" con su línea de profundidad para ordenarlos junto a los personajes.
  activeOccluders(walkers) {
    const level = this.level;
    if (!level.occluders || !level.occluders.length) return [];
    const left = this.camera.left - 40;
    const right = this.camera.right + 40;
    const active = [];
    for (const occluder of level.occluders) {
      if (occluder.maxX < left || occluder.minX > right) continue;
      const hides = walkers.some((walker) => walker.y < occluder.base - 1 && walker.x > occluder.minX - 70 && walker.x < occluder.maxX + 70);
      if (!hides) continue;
      active.push({ occluder: true, y: occluder.base, sortY: occluder.base, render: (ctx) => level.renderOccluder(ctx, occluder) });
    }
    return active;
  }

  // Escala visual según la profundidad del suelo (0 = al fondo, 1 = junto a la cámara). No afecta a los golpes ni a las colisiones.
  depthScale(y) {
    if (this.finale) return 1;
    const t = Math.max(0, Math.min(1, (y - CONFIG.GROUND_TOP) / (CONFIG.GROUND_BOTTOM - CONFIG.GROUND_TOP)));
    return GameScene.DEPTH_SCALE[0] + (GameScene.DEPTH_SCALE[1] - GameScene.DEPTH_SCALE[0]) * t;
  }

  // Evita que los enemigos se amontonen en el mismo punto
  separateEnemies() {
    const living = this.enemies.filter((enemy) => enemy.isAlive && enemy.z === 0 && !enemy.boss);
    for (let i = 0; i < living.length; i++) {
      for (let j = i + 1; j < living.length; j++) {
        const a = living[i];
        const b = living[j];
        const overlap = a.w - Math.abs(a.x - b.x);
        if (overlap > 0 && Math.abs(a.y - b.y) < 16) {
          const push = overlap / 2 * (a.x <= b.x ? -1 : 1);
          a.x += push;
          b.x -= push;
        }
      }
    }
  }

  // Proyectiles sónicos de Trino: atraviesan a todos los enemigos de su carril
  updateProjectiles(dt) {
    for (const bolt of this.projectiles) {
      const step = bolt.speed * dt;
      bolt.x += bolt.direction * step;
      bolt.travelled += step;
      bolt.age += dt;

      this.particles.add({
        type: 'dot', x: bolt.x - bolt.direction * 14, y: bolt.y - bolt.height + (Math.random() - 0.5) * 8,
        vx: -bolt.direction * 80, vy: (Math.random() - 0.5) * 60, life: 0.28, size: 5, sizeEnd: 0, color: CONFIG.COLORS.CYAN,
      });

      for (const enemy of this.enemies) {
        if (!enemy.isAlive || bolt.hit.has(enemy)) continue;
        if (Math.abs(enemy.y - bolt.y) <= 45 && Math.abs(enemy.x - bolt.x) <= enemy.w / 2 + 26) {
          bolt.hit.add(enemy);
          this.player.landHit(enemy, bolt.damage, 320, 4, this.world, { power: 2, launch: true, direction: bolt.direction });
        }
      }
    }
    const { left, right } = this.camera;
    this.projectiles.splice(0, this.projectiles.length, ...this.projectiles.filter(
      (bolt) => bolt.travelled < bolt.range && bolt.x > left - 120 && bolt.x < right + 120,
    ));
  }

  updateEffects(dt) {
    for (const effect of this.effects) effect.age += dt;
    this.effects = this.effects.filter((effect) => effect.age < effect.duration);
  }

  // Partículas de ambiente según el nivel (lluvia, brasas, luciérnagas…)
  updateAmbient(dt) {
    const type = this.level.config.ambient;
    if (type) {
      this.ambientBudget += GameScene.AMBIENT_RATES[type] * dt * (FX.low ? 0.4 : 1);
      while (this.ambientBudget >= 1) {
        this.ambientBudget -= 1;
        this.spawnAmbient(type);
      }
    }
    this.ambient.update(dt);
    this.ambientBack.update(dt);
  }

  spawnAmbient(type) {
    const { WIDTH, HEIGHT } = CONFIG;
    const x = Math.random() * (WIDTH + 200);
    switch (type) {
      case 'rain': {
        // Tres planos de lluvia: lejana (pequeña, lenta y tenue, por detrás), media y cercana (grande, rápida y clara, por delante)
        const depth = Math.random();
        if (depth < 0.4) {
          this.ambientBack.add({ type: 'streak', x, y: -10, vx: -90, vy: 560 + Math.random() * 140, life: 1.0, size: 0.8, color: 'rgba(170, 205, 255, 0.28)', additive: false });
        } else if (depth < 0.85) {
          this.ambient.add({ type: 'streak', x, y: -10, vx: -140, vy: 900 + Math.random() * 300, life: 0.7, size: 1.2, color: 'rgba(170, 205, 255, 0.55)', additive: false });
        } else {
          this.ambient.add({ type: 'streak', x, y: -10, vx: -250, vy: 1500 + Math.random() * 400, life: 0.45, size: 2.2, color: 'rgba(205, 228, 255, 0.5)', additive: false });
        }
        break;
      }
      case 'embers':
        this.ambient.add({ type: 'dot', x, y: HEIGHT + 10, vx: (Math.random() - 0.5) * 60, vy: -(60 + Math.random() * 120), life: 3, size: 1.5 + Math.random() * 2.5, sizeEnd: 0, color: '#ff8a2a' });
        break;
      case 'fireflies':
        this.ambient.add({ type: 'dot', x: Math.random() * WIDTH, y: 250 + Math.random() * 230, vx: (Math.random() - 0.5) * 30, vy: (Math.random() - 0.5) * 20, life: 4, size: 3, sizeEnd: 0, color: '#7dffd0' });
        break;
      default: // motes
        this.ambient.add({ type: 'dot', x: Math.random() * WIDTH, y: Math.random() * HEIGHT, vx: 10 + Math.random() * 15, vy: -5, life: 4, size: 1.6, sizeEnd: 0, color: '#c9d4ff' });
    }
  }

  // Con poca vida suena un latido que se acelera cuanto menos queda
  updateHeartbeat(dt) {
    const health = this.player.hp / this.player.maxHp;
    if (!this.player.isAlive || health >= 0.3) {
      this.heartbeatTimer = 0;
      return;
    }
    this.heartbeatTimer -= dt;
    if (this.heartbeatTimer <= 0) {
      this.heartbeatTimer = 0.55 + health * 2.2;
      this.game.audio.play('heartbeat');
    }
  }

  // Guarda la partida en las mejores marcas (una sola vez por partida)
  saveRecord(victory) {
    if (this.recordSaved) return this.recordSaved;
    this.recordSaved = Records.submit({ score: this.player.score, combo: this.maxCombo, seconds: this.time, victory });
    this.recordSaved.maxCombo = this.maxCombo;
    this.recordSaved.seconds = Math.round(this.time);
    return this.recordSaved;
  }

  checkEndConditions(dt) {
    if (this.finished) return;

    const result = {
      score: this.player.score,
      startScore: this.startScore,
      levelIndex: this.levelIndex,
      hasNextLevel: this.levelIndex + 1 < GameScene.LEVELS.length,
    };

    if (this.player.state === 'dead' && this.player.stateTime > GameScene.DEATH_DELAY) {
      this.finished = true;
      this.game.scenes.change('gameover', { ...result, victory: false, record: this.saveRecord(false) });
      return;
    }
    if (this.level.completed && this.player.isAlive) {
      this.victoryTimer += dt;
      if (this.victoryTimer >= GameScene.VICTORY_DELAY) {
        if (result.hasNextLevel) {
          this.finished = true;
          this.game.scenes.change('gameover', { ...result, victory: true, record: this.saveRecord(true) });
        } else {
          this.saveRecord(true);
          this.startFinale(); // último nivel: cierre con Vóidhar
        }
      }
    }
  }

  togglePause() {
    this.paused = !this.paused;
    this.game.audio.duckMusic(this.paused);
    if (this.finale && this.finale.boss && !this.duel) this.game.audio.pauseBoss(this.paused);
    if (this.duel) this.duel.setPaused(this.paused);
    if (this.paused) {
      this.game.modal.show({
        title: 'PAUSA',
        message: 'El silencio espera.',
        buttons: [
          { label: 'Continuar', onClick: () => this.togglePause() },
          { label: 'Menú principal', onClick: () => this.game.scenes.change('title') },
        ],
      });
    } else {
      this.game.modal.hide();
    }
  }

  // ---------------------------------------------------------------- dibujo

  render(ctx) {
    ctx.save();
    this.camera.applyZoom(ctx);
    this.level.renderBackground(ctx, this.camera);
    this.live.render(ctx, this.camera); // telas, cadenas, cables, carteles y generador animados
    this.atmosphere.renderBack(ctx, this.camera);
    this.live.renderFog(ctx, this.camera, 'far'); // niebla del fondo y del plano medio, por detrás de los personajes
    this.props.renderBack(ctx, this.camera); // objetos del plano trasero, bajo la niebla media
    this.live.renderFog(ctx, this.camera, 'mid');
    this.ambientBack.render(ctx); // lluvia lejana
    if (this.darkness > 0.01) {
      ctx.fillStyle = `rgba(3, 3, 12, ${this.darkness})`;
      ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
    }

    ctx.save();
    this.camera.apply(ctx);
    // Orden por profundidad: lo más cercano a la cámara se dibuja encima
    this.atmosphere.renderSmoke(ctx); // humo del escenario, bajo los personajes
    for (const enemy of this.enemies) if (enemy.renderHazards) enemy.renderHazards(ctx); // rayos y avisos del jefe
    for (const effect of this.effects) if (effect.ground) this.renderEffect(ctx, effect); // grietas bajo los personajes
    const walkers = [this.player, ...this.enemies, ...(this.finale && this.finale.boss ? [this.finale.boss] : [])];
    const drawables = [this.player, this.trino, ...this.enemies, ...(this.finale && this.finale.boss ? [this.finale.boss] : []), ...this.activeOccluders(walkers)]
      .sort((a, b) => (a.sortY ?? a.y) - (b.sortY ?? b.y));
    // Perspectiva: los personajes crecen un poco al acercarse a la cámara (bajar por el suelo) y se encogen al alejarse
    for (const entity of drawables) {
      const scale = entity.occluder ? 1 : this.depthScale(entity === this.trino ? this.player.y : entity.y);
      if (scale === 1) { entity.render(ctx); continue; }
      ctx.save();
      ctx.translate(entity.x, entity.y);
      ctx.scale(scale, scale);
      ctx.translate(-entity.x, -entity.y);
      entity.render(ctx);
      ctx.restore();
    }
    for (const pickup of this.pickups) this.renderPickup(ctx, pickup);
    for (const bolt of this.projectiles) this.renderProjectile(ctx, bolt);
    for (const effect of this.effects) if (!effect.ground) this.renderEffect(ctx, effect);
    for (const beam of this.beams) this.renderBeam(ctx, beam);
    if (this.dialogue && this.dialogue.line.scan) this.renderScan(ctx);
    this.particles.render(ctx);
    if (globalThis.DEBUG_PUDDLES) this.renderPuddleDebug(ctx);
    ctx.restore();
    this.foreground.render(ctx, this.camera.x); // chatarra y cables por delante, con parallax
    if (!this.finale) this.props.renderFront(ctx, this.camera, this.player); // objetos grandes y oscuros del plano delantero
    this.live.renderFog(ctx, this.camera, 'front'); // neblina baja junto al suelo, por delante
    ctx.restore();

    this.ambient.render(ctx);
    this.renderVignette(ctx);
    this.renderEdgeWarnings(ctx);
    this.renderBeamOverlay(ctx);
    this.renderCallout(ctx);
    this.hud.boss = this.dialogue ? null : (this.enemies.find((enemy) => enemy.boss && enemy.isAlive && enemy.vulnerable) || null);
    if (this.dialogue) this.dialogue.render(ctx); // la escena de diálogo oculta el HUD
    else this.hud.render(ctx, this.player, this.level, this.trino);
    if (this.duel) this.duel.render(ctx);
    this.renderFinaleOverlay(ctx);

    if (this.flashTime > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.28, this.flashTime * 1.2);
      ctx.fillStyle = this.flashColor;
      ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
      ctx.restore();
    }
  }

  // Destello rojo en el borde de la pantalla por donde entra un enemigo atacando
  renderEdgeWarnings(ctx) {
    for (const warning of this.edgeWarnings) {
      const fade = Math.max(0, 1 - warning.age / 0.9);
      const pulse = 0.65 + 0.35 * Math.sin(warning.age * 30);
      const width = 150;
      const x = warning.side === 'right' ? CONFIG.WIDTH - width : 0;
      const gradient = ctx.createLinearGradient(warning.side === 'right' ? CONFIG.WIDTH : 0, 0, warning.side === 'right' ? CONFIG.WIDTH - width : width, 0);
      gradient.addColorStop(0, 'rgba(255, 30, 70, ' + 0.55 * fade * pulse + ')');
      gradient.addColorStop(1, 'rgba(255, 30, 70, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(x, 0, width, CONFIG.HEIGHT);
    }
  }

  // Contorno de las zonas de charco (solo con DEBUG_PUDDLES = true)
  renderPuddleDebug(ctx) {
    ctx.save();
    ctx.strokeStyle = '#ff00ff';
    ctx.lineWidth = 2;
    for (const puddle of this.level.puddles) {
      ctx.beginPath();
      ctx.ellipse(puddle.x, puddle.y, puddle.rx, puddle.ry, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Viñeta oscura permanente y borde rojo pulsante con poca vida
  renderVignette(ctx) {
    GameScene.vignette = GameScene.vignette || GameScene.buildVignette('rgba(0, 0, 12, 0.55)');
    ctx.drawImage(GameScene.vignette, 0, 0);

    const health = this.player.hp / this.player.maxHp;
    if (health < 0.35 && this.player.isAlive) {
      GameScene.dangerVignette = GameScene.dangerVignette || GameScene.buildVignette('rgba(255, 0, 60, 0.75)');
      ctx.save();
      ctx.globalAlpha = 0.35 + 0.3 * Math.sin(this.time * 6);
      ctx.drawImage(GameScene.dangerVignette, 0, 0);
      ctx.restore();
    }
  }

  static buildVignette(edgeColor) {
    const canvas = document.createElement('canvas');
    canvas.width = CONFIG.WIDTH;
    canvas.height = CONFIG.HEIGHT;
    const context = canvas.getContext('2d');
    const gradient = context.createRadialGradient(CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2, CONFIG.HEIGHT * 0.35, CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2, CONFIG.WIDTH * 0.62);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(1, edgeColor);
    context.fillStyle = gradient;
    context.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
    return canvas;
  }

  // Proyectil sónico de Trino: núcleo brillante, ondas en cuña y estela larga
  renderProjectile(ctx, bolt) {
    const screenY = bolt.y - bolt.height;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(bolt.x, screenY);
    ctx.scale(bolt.direction * 0.7, 0.7); // proporcional al tamaño del Trino

    const trail = ctx.createLinearGradient(-190, 0, 0, 0);
    trail.addColorStop(0, 'rgba(0, 245, 255, 0)');
    trail.addColorStop(1, 'rgba(0, 245, 255, 0.55)');
    ctx.fillStyle = trail;
    ctx.fillRect(-190, -9, 190, 18);

    const core = ctx.createRadialGradient(0, 0, 2, 0, 0, 24);
    core.addColorStop(0, '#ffffff');
    core.addColorStop(0.4, 'rgba(120, 255, 245, 0.9)');
    core.addColorStop(1, 'rgba(0, 245, 255, 0)');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(0, 0, 24, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const radius = 22 + i * 15 + Math.sin(bolt.age * 40 + i) * 3;
      ctx.strokeStyle = `rgba(0, 245, 255, ${0.9 - i * 0.25})`;
      ctx.lineWidth = 5 - i;
      ctx.beginPath();
      ctx.arc(-6, 0, radius, -0.95, 0.95);
      ctx.stroke();
    }
    ctx.restore();
  }

  renderEffect(ctx, effect) {
    if (effect.age < 0) return; // arcos con retardo aún no empiezan
    if (effect.type === 'crack') { this.renderCrack(ctx, effect); return; }
    if (effect.type === 'whirl') { this.renderWhirl(ctx, effect); return; }
    if (effect.type === 'starburst') { this.renderStarburst(ctx, effect); return; }
    if (effect.type === 'zap') { this.renderZap(ctx, effect); return; }
    const progress = effect.age / effect.duration;
    const screenY = effect.y - effect.z;
    ctx.save();

    if (effect.type === 'arc') {
      // Onda en arco que se expande frente al lanzador
      ctx.globalAlpha = 1 - progress;
      ctx.translate(effect.x + effect.facing * 20, screenY);
      ctx.scale(effect.facing, 1);
      const radius = effect.reach * (0.25 + 0.75 * progress);
      ctx.lineCap = 'round';
      ctx.strokeStyle = CONFIG.COLORS.OUTLINE;
      ctx.lineWidth = 20 - 9 * progress;
      ctx.beginPath();
      ctx.arc(0, 0, radius, -1.0, 1.0);
      ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = effect.color;
      ctx.lineWidth = 11 - 7 * progress;
      ctx.beginPath();
      ctx.arc(0, 0, radius, -1.0, 1.0);
      ctx.stroke();
    } else if (effect.type === 'text') {
      // Número de daño que sube y se desvanece
      const pop = 1 + Math.max(0, 0.6 - effect.age * 6);
      ctx.globalAlpha = 1 - progress * progress;
      Draw.text(ctx, effect.text, effect.x, screenY - effect.age * 60, {
        size: effect.size * pop, color: effect.color, align: 'center', strokeWidth: 5,
      });
    }
    ctx.restore();
  }
}
