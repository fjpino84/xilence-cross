// Nivel base: fondo con parallax, suelo y oleadas que bloquean la cámara hasta ser derrotadas.
class Level {
  // config: { name, width, skyTop, skyBottom, hullColor, glowColor, waves, patrols }
  constructor(config) {
    // Colores de respaldo por si la imagen de fondo no carga
    this.config = { skyTop: CONFIG.COLORS.NAVY, skyBottom: '#0d0d3a', glowColor: 'rgba(124, 58, 255, 0.45)', ...config };
    this.name = config.name;
    this.width = config.width;
    this.puddles = this.buildPuddles();
    this.tileCanvases = [];
    this.waves = config.waves.map((wave) => ({ ...wave, started: false, cleared: false, enemies: [], pending: [], clock: 0 }));
    this.patrols = config.patrols;
    this.farLayer = this.buildHulls(11, 14, 0.25, 170);
    this.nearLayer = this.buildHulls(23, 12, 0.55, 230);
    this.stars = this.buildStars();
  }

  // --- Fondo en secuencia: varias ilustraciones seguidas con un fundido en cada unión ---
  static TILE_WIDTH = 968; // una ilustración de 1376×768 escalada a 540 px de alto
  static TILE_OVERLAP = 120;
  static TILE_STRIDE = 848;

  // Charcos en coordenadas del mundo (x, y de pantalla del suelo), para detectar pisadas
  buildPuddles() {
    const list = [];
    (this.config.backgroundSequence || []).forEach((tile, index) => {
      const data = (typeof PUDDLE_DATA !== 'undefined' && PUDDLE_DATA[tile.key]) || [];
      const originX = index * Level.TILE_STRIDE;
      for (const puddle of data) {
        const fx = tile.flip ? 1 - puddle.x : puddle.x;
        list.push({
          x: originX + fx * Level.TILE_WIDTH,
          y: puddle.y * CONFIG.HEIGHT,
          rx: puddle.rx * Level.TILE_WIDTH,
          ry: Math.max(10, puddle.ry * CONFIG.HEIGHT * 1.4), // un poco generoso: basta con pisar cerca
          color: puddle.color,
        });
      }
    });
    return list;
  }

  // Charco bajo los pies en (x, y), o null
  puddleAt(x, y) {
    for (const puddle of this.puddles) {
      const dx = (x - puddle.x) / puddle.rx;
      const dy = (y - puddle.y) / puddle.ry;
      if (dx * dx + dy * dy <= 1) return puddle;
    }
    return null;
  }

  // Ilustración de la secuencia ya escalada, reflejada si toca y con el borde izquierdo difuminado (salvo la primera)
  tileCanvas(index) {
    if (this.tileCanvases[index]) return this.tileCanvases[index];
    const tile = this.config.backgroundSequence[index];
    const image = Assets.image(tile.key);
    if (!image) return null;

    const { TILE_WIDTH: width, TILE_OVERLAP: overlap } = Level;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = CONFIG.HEIGHT;
    const context = canvas.getContext('2d');
    context.save();
    if (tile.flip) {
      context.translate(width, 0);
      context.scale(-1, 1);
    }
    context.drawImage(image, 0, 0, width, CONFIG.HEIGHT);
    context.restore();
    if (index > 0) {
      const fade = context.createLinearGradient(0, 0, width, 0);
      fade.addColorStop(0, 'rgba(0, 0, 0, 0)');
      fade.addColorStop(overlap / width, 'rgba(0, 0, 0, 1)');
      fade.addColorStop(1, 'rgba(0, 0, 0, 1)');
      context.globalCompositeOperation = 'destination-in';
      context.fillStyle = fade;
      context.fillRect(0, 0, width, CONFIG.HEIGHT);
    }
    this.tileCanvases[index] = canvas;
    return canvas;
  }

  // Devuelve false si faltan imágenes (se usa el fondo de respaldo)
  renderSequenceBackground(ctx, camera) {
    const sequence = this.config.backgroundSequence;
    if (!sequence || !sequence.every((tile) => Assets.image(tile.key))) return false;
    sequence.forEach((tile, index) => {
      const x = Math.round(index * Level.TILE_STRIDE - camera.x);
      if (x > CONFIG.WIDTH || x + Level.TILE_WIDTH < 0) return;
      ctx.drawImage(this.tileCanvas(index), x, 0);
    });
    return true;
  }

  get completed() { return this.waves.every((wave) => wave.cleared); }
  get locked() { return this.waves.some((wave) => wave.started && !wave.cleared); }

  // Enemigos de patrulla: su sitio y su carril varían un poco en cada partida
  spawnPatrols(spawn) {
    for (const patrol of this.patrols) {
      const x = patrol.x + (Math.random() - 0.5) * 260;
      const y = CONFIG.GROUND_TOP + 12 + Math.random() * (CONFIG.GROUND_BOTTOM - CONFIG.GROUND_TOP - 24);
      spawn(x, y, false);
    }
  }

  // Punto de entrada de un enemigo de oleada: lado, distancia fuera de pantalla y carril al azar
  spawnPoint(camera) {
    const fromRight = Math.random() < 0.6;
    const x = fromRight ? camera.right + 40 + Math.random() * 240 : camera.left - 40 - Math.random() * 200;
    const y = CONFIG.GROUND_TOP + 8 + Math.random() * (CONFIG.GROUND_BOTTOM - CONFIG.GROUND_TOP - 12);
    return [x, y];
  }

  // Activa oleadas al llegar a su punto. Cada enemigo entra en su momento, por un lado y a una altura distintos,
  // y la oleada se da por limpia cuando ya salieron todos y cayeron todos.
  update(player, camera, spawn, dt = 0) {
    this.waves.forEach((wave) => {
      if (!wave.started && player.x >= wave.triggerX) {
        wave.started = true;
        camera.lockX = camera.x;
        wave.clock = 0;
        // El número de enemigos varía un poco (la lista de la oleada marca el valor medio)
        const count = Math.max(2, wave.spawns.length + (Math.random() < 0.15 ? 1 : 0) - (Math.random() < 0.15 ? 1 : 0));
        wave.pending = Array.from({ length: count }, (_, index) => ({ delay: index === 0 ? 0 : 0.3 + Math.random() * 3 }))
          .sort((first, second) => first.delay - second.delay);
      }
      if (wave.started && !wave.cleared) {
        wave.clock += dt;
        while (wave.pending.length && wave.pending[0].delay <= wave.clock) {
          wave.pending.shift();
          wave.enemies.push(spawn(...this.spawnPoint(camera), true));
        }
        if (!wave.pending.length && wave.enemies.every((enemy) => !enemy.isAlive)) {
          wave.cleared = true;
          camera.lockX = Infinity;
        }
      }
    });
  }

  buildHulls(seed, count, parallax, baseHeight) {
    const random = Draw.seededRandom(seed);
    const span = this.width * parallax + CONFIG.WIDTH;
    const hulls = [];
    for (let i = 0; i < count; i++) {
      hulls.push({
        x: (i / count) * span + random() * 80,
        w: 120 + random() * 140,
        h: baseHeight * (0.5 + random() * 0.7),
        tilt: (random() - 0.5) * 60,
        windows: 2 + Math.floor(random() * 4),
      });
    }
    return { hulls, parallax };
  }

  buildStars() {
    const random = Draw.seededRandom(5);
    return Array.from({ length: 70 }, () => ({ x: random() * CONFIG.WIDTH, y: random() * 220, size: 1 + random() * 2 }));
  }

  // Fondo ilustrado: se repite en espejo para que las uniones no se noten.
  // Parallax 1 = el suelo del fondo se mueve a la par que los personajes.
  renderImageBackground(ctx, camera, image) {
    const tileWidth = Math.round((image.width * CONFIG.HEIGHT) / image.height);
    const offset = camera.x * (this.config.backgroundParallax ?? 1);
    const first = Math.floor(offset / tileWidth);

    for (let index = first; index <= first + 1; index++) {
      const x = Math.round(index * tileWidth - offset);
      ctx.save();
      if (Math.abs(index) % 2 === 1) {
        ctx.translate(x + tileWidth, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(image, 0, 0, tileWidth + 1, CONFIG.HEIGHT);
      } else {
        ctx.drawImage(image, x, 0, tileWidth + 1, CONFIG.HEIGHT);
      }
      ctx.restore();
    }
  }

  // Fondo en espacio de pantalla (no usa la transformación de cámara)
  renderBackground(ctx, camera) {
    if (this.renderSequenceBackground(ctx, camera)) return;
    const image = Assets.image(this.config.backgroundKey);
    if (image) {
      this.renderImageBackground(ctx, camera, image);
      return;
    }

    const { skyTop, skyBottom, glowColor } = this.config;
    const horizon = CONFIG.GROUND_TOP - 10;

    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, skyTop);
    sky.addColorStop(1, skyBottom);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    for (const star of this.stars) ctx.fillRect(star.x, star.y, star.size, star.size);

    // Resplandor lejano de la ciudad
    const glow = ctx.createLinearGradient(0, horizon - 120, 0, horizon);
    glow.addColorStop(0, 'rgba(0, 0, 0, 0)');
    glow.addColorStop(1, glowColor);
    ctx.fillStyle = glow;
    ctx.fillRect(0, horizon - 120, CONFIG.WIDTH, 120);

    this.renderHullLayer(ctx, camera, this.farLayer, horizon, '#0a0a22', 'rgba(124, 58, 255, 0.55)');
    this.renderHullLayer(ctx, camera, this.nearLayer, horizon + 6, '#06061a', 'rgba(0, 245, 255, 0.5)');
    this.renderGround(ctx, camera, horizon);
  }

  // Cascos de naves estrelladas con contorno neón
  renderHullLayer(ctx, camera, layer, baseY, fill, edge) {
    const offset = camera.x * layer.parallax;
    const span = this.width * layer.parallax + CONFIG.WIDTH;
    for (const hull of layer.hulls) {
      const x = ((hull.x - offset) % span + span) % span - 200;
      const top = baseY - hull.h;
      ctx.beginPath();
      ctx.moveTo(x, baseY);
      ctx.lineTo(x + hull.tilt + 20, top + 20);
      ctx.lineTo(x + hull.w * 0.4, top);
      ctx.lineTo(x + hull.w * 0.85, top + 30);
      ctx.lineTo(x + hull.w, baseY);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = edge;
      ctx.stroke();

      ctx.fillStyle = edge;
      for (let w = 0; w < hull.windows; w++) {
        ctx.fillRect(x + 28 + w * 24, top + 52, 8, 6);
      }
    }
  }

  renderGround(ctx, camera, horizon) {
    const groundTop = CONFIG.GROUND_TOP - 20;
    ctx.fillStyle = '#080818';
    ctx.fillRect(0, groundTop, CONFIG.WIDTH, CONFIG.HEIGHT - groundTop);

    ctx.lineWidth = 4;
    ctx.strokeStyle = CONFIG.COLORS.CYAN;
    ctx.beginPath();
    ctx.moveTo(0, groundTop);
    ctx.lineTo(CONFIG.WIDTH, groundTop);
    ctx.stroke();

    // Marcas del suelo que se desplazan con la cámara
    ctx.strokeStyle = 'rgba(124, 58, 255, 0.45)';
    ctx.lineWidth = 2;
    const spacing = 120;
    const shift = camera.x % spacing;
    for (let x = -spacing; x < CONFIG.WIDTH + spacing; x += spacing) {
      ctx.beginPath();
      ctx.moveTo(x - shift + 40, groundTop);
      ctx.lineTo(x - shift - 40, CONFIG.HEIGHT);
      ctx.stroke();
    }
  }
}
