// Atmósfera de los escenarios: focos que pulsan y se cortocircuitan, tormenta eléctrica (relámpagos y truenos) y humo.
// Todo se coloca sobre las ilustraciones con coordenadas en fracciones de cada imagen (x, y), igual que los charcos.
const ATMOSPHERE_DATA = {
  bgLevel01a: {
    lamps: [
      { x: 0.26, y: 0.21, kind: 'red' }, { x: 0.56, y: 0.11, kind: 'red' }, { x: 0.11, y: 0.41, kind: 'red' },
      { x: 0.34, y: 0.50, kind: 'red' }, { x: 0.57, y: 0.49, kind: 'red' }, { x: 0.92, y: 0.43, kind: 'red' },
    ],
    smoke: [{ x: 0.45, y: 0.60, w: 0.22, rate: 3 }, { x: 0.82, y: 0.62, w: 0.12, rate: 2 }],
  },
  bgLevel01b: {
    searchlight: { x: 0.5, sweep: 0.3, speed: 0.5 },
    lamps: [
      { x: 0.26, y: 0.21, kind: 'red' }, { x: 0.57, y: 0.11, kind: 'red' }, { x: 0.11, y: 0.42, kind: 'red' },
      { x: 0.33, y: 0.50, kind: 'red' }, { x: 0.57, y: 0.49, kind: 'red' }, { x: 0.92, y: 0.43, kind: 'red' },
    ],
    smoke: [{ x: 0.30, y: 0.62, w: 0.2, rate: 3 }, { x: 0.62, y: 0.58, w: 0.16, rate: 2 }],
  },
  bgLevel01c: {
    searchlight: { x: 0.45, sweep: 0.32, speed: 0.42 },
    lamps: [
      { x: 0.11, y: 0.42, kind: 'red' }, { x: 0.33, y: 0.50, kind: 'red' }, { x: 0.58, y: 0.39, kind: 'red' },
      { x: 0.93, y: 0.43, kind: 'red' }, { x: 0.90, y: 0.24, kind: 'red' },
    ],
    smoke: [{ x: 0.68, y: 0.50, w: 0.2, rate: 4 }, { x: 0.22, y: 0.62, w: 0.14, rate: 2 }],
  },
  bgLevel01d: {
    searchlight: { x: 0.55, sweep: 0.3, speed: 0.46 },
    lamps: [
      { x: 0.68, y: 0.10, kind: 'red' }, { x: 0.90, y: 0.23, kind: 'red' }, { x: 0.33, y: 0.50, kind: 'red' },
      { x: 0.30, y: 0.11, kind: 'red' }, { x: 0.575, y: 0.40, kind: 'red' },
    ],
    smoke: [{ x: 0.20, y: 0.58, w: 0.18, rate: 3 }, { x: 0.75, y: 0.52, w: 0.14, rate: 3 }],
  },
  bgLevel01e: {
    lamps: [
      { x: 0.18, y: 0.06, kind: 'spot', beam: 1 }, { x: 0.87, y: 0.09, kind: 'spot', beam: -1 },
      { x: 0.30, y: 0.10, kind: 'red' }, { x: 0.69, y: 0.10, kind: 'red' }, { x: 0.33, y: 0.50, kind: 'red' },
      { x: 0.58, y: 0.39, kind: 'red' }, { x: 0.92, y: 0.24, kind: 'red' },
      { x: 0.05, y: 0.85, kind: 'arc' }, { x: 0.97, y: 0.82, kind: 'arc' },
    ],
    smoke: [
      { x: 0.08, y: 0.45, w: 0.12, rate: 5, dark: true }, { x: 0.35, y: 0.53, w: 0.16, rate: 4, dark: true },
      { x: 0.60, y: 0.57, w: 0.2, rate: 4, dark: true }, { x: 0.90, y: 0.58, w: 0.1, rate: 3, dark: true },
    ],
  },
  bgLevel01s: {
    lamps: [
      { x: 0.17, y: 0.06, kind: 'spot' }, { x: 0.88, y: 0.09, kind: 'spot' },
      { x: 0.30, y: 0.10, kind: 'red' }, { x: 0.68, y: 0.10, kind: 'red' }, { x: 0.33, y: 0.50, kind: 'red' },
      { x: 0.46, y: 0.24, kind: 'arc' }, { x: 0.32, y: 0.38, kind: 'arc' }, { x: 0.47, y: 0.50, kind: 'arc' },
      { x: 0.05, y: 0.85, kind: 'arc' }, { x: 0.97, y: 0.82, kind: 'arc' },
    ],
    smoke: [
      { x: 0.08, y: 0.45, w: 0.12, rate: 5, dark: true }, { x: 0.40, y: 0.55, w: 0.16, rate: 4, dark: true },
      { x: 0.60, y: 0.57, w: 0.2, rate: 4, dark: true },
    ],
  },
  bgLevel01j: {
    lamps: [
      { x: 0.52, y: 0.19, kind: 'warm' }, { x: 0.81, y: 0.18, kind: 'warm' }, { x: 0.43, y: 0.31, kind: 'pink' },
      { x: 0.10, y: 0.23, kind: 'red' }, { x: 0.26, y: 0.24, kind: 'red' }, { x: 0.41, y: 0.42, kind: 'red' }, { x: 0.32, y: 0.53, kind: 'red' },
      { x: 0.04, y: 0.84, kind: 'arc' }, { x: 0.97, y: 0.82, kind: 'arc' }, { x: 0.33, y: 0.62, kind: 'arc' },
    ],
    smoke: [{ x: 0.12, y: 0.68, w: 0.14, rate: 3 }, { x: 0.86, y: 0.72, w: 0.1, rate: 3 }],
  },
};

class Atmosphere {
  static LAMP_COLORS = { red: '#ff2a4a', spot: '#dff3ff', warm: '#ffd890', pink: '#ff4fd8', arc: '#8ff6ff' };
  static LAMP_RADIUS = { red: 30, spot: 70, warm: 62, pink: 24, arc: 46 };
  static BOLT_LIFE = 0.2;

  constructor(level) {
    this.time = 0;
    this.storm = level.config.ambient === 'rain';
    this.stormTimer = 3 + Math.random() * 3; // primer relámpago pronto
    this.flash = 0; // brillo del cielo (0-1)
    this.bolt = null; // { points, branches, age }
    this.pending = []; // truenos que llegan con retraso: { delay, fn }
    this.restrikes = 0;
    this.restrikeTimer = 0;
    this.smoke = new ParticleSystem(); // humo en coordenadas del mundo (se dibuja bajo los personajes)
    this.lamps = [];
    this.sources = [];
    this.searchlights = [];
    (level.config.backgroundSequence || []).forEach((tile, index) => {
      const data = ATMOSPHERE_DATA[tile.key];
      if (!data) return;
      const originX = index * Level.TILE_STRIDE;
      const worldX = (fraction) => originX + (tile.flip ? 1 - fraction : fraction) * Level.TILE_WIDTH;
      if (data.searchlight) {
        // Reflector que barre el suelo desde lo alto, como el de un helicóptero
        this.searchlights.push({
          cx: worldX(data.searchlight.x), sweep: data.searchlight.sweep * Level.TILE_WIDTH, speed: data.searchlight.speed,
          phase: Math.random() * 6.28, spot: 0, reach: 150,
        });
      }
      for (const lamp of data.lamps) {
        this.lamps.push({
          x: worldX(lamp.x), y: lamp.y * CONFIG.HEIGHT, kind: lamp.kind,
          beam: lamp.beam ? lamp.beam * (tile.flip ? -1 : 1) : 0,
          phase: Math.random() * 6.28, timer: 1 + Math.random() * 8, event: 0, arcTimer: 0, arcs: [],
        });
      }
      for (const source of data.smoke) {
        this.sources.push({ x: worldX(source.x), y: source.y * CONFIG.HEIGHT, w: source.w * Level.TILE_WIDTH, rate: source.rate, dark: !!source.dark, budget: 0 });
      }
    });
  }

  // hooks = { thunder(), zap(), shake(power, duration) }
  update(dt, camera, hooks) {
    this.time += dt;
    this.updateStorm(dt, camera, hooks);
    const left = camera.x - 160;
    const right = camera.x + CONFIG.WIDTH + 160;

    for (const lamp of this.lamps) {
      if (lamp.x < left || lamp.x > right) continue;
      lamp.arcs = lamp.arcs.filter((arc) => (arc.age += dt) < 0.12);
      lamp.timer -= dt;
      if (lamp.timer <= 0) {
        // Cortocircuito: parpadea y suelta descargas eléctricas
        const arc = lamp.kind === 'arc';
        lamp.event = arc ? 0.2 : 0.45;
        lamp.timer = arc ? 1.4 + Math.random() * 3.2 : 5 + Math.random() * 8;
        lamp.arcTimer = 0;
        if (hooks.zap && lamp.x > camera.x && lamp.x < camera.x + CONFIG.WIDTH) hooks.zap();
      }
      if (lamp.event > 0) {
        lamp.event -= dt;
        lamp.arcTimer -= dt;
        if (lamp.arcTimer <= 0 && !FX.low) {
          lamp.arcTimer = 0.05;
          lamp.arcs.push(this.makeArc(lamp.kind === 'arc' ? 2 : 1));
          this.smoke.burst({ x: lamp.x, y: lamp.y, count: 2, speed: [60, 220], life: [0.15, 0.35], size: [1.5, 2.6], colors: ['#ffffff', '#8ff6ff'], type: 'spark', drag: 3, gravity: 200 });
        }
      }
    }

    // Humo que sube despacio y se ensancha; las hogueras sueltan además brasas
    for (const source of this.sources) {
      if (source.x < left - source.w || source.x > right + source.w) continue;
      source.budget += source.rate * dt * (FX.low ? 0.4 : 1);
      while (source.budget >= 1) {
        source.budget -= 1;
        this.smoke.add({
          type: 'puff', x: source.x + (Math.random() - 0.5) * source.w, y: source.y,
          vx: 8 + Math.random() * 16, vy: -(12 + Math.random() * 16), life: 3.6 + Math.random() * 2,
          size: 14 + Math.random() * 10, sizeEnd: 60 + Math.random() * 40, color: source.dark ? '#352e48' : '#7a76a0', additive: false,
          alpha: source.dark ? 0.42 : 0.3,
        });
        if (source.dark && Math.random() < 0.3) {
          this.smoke.add({ type: 'dot', x: source.x + (Math.random() - 0.5) * source.w, y: source.y, vx: (Math.random() - 0.3) * 30, vy: -(40 + Math.random() * 60), life: 1.6, size: 1.8, sizeEnd: 0, color: '#ff8a2a' });
        }
      }
    }
    this.smoke.update(dt);
  }

  // Tormenta: relámpago con réplicas, y el trueno llega un instante después
  updateStorm(dt, camera, hooks) {
    this.flash = Math.max(0, this.flash - dt * 3.2);
    if (this.bolt && (this.bolt.age += dt) > Atmosphere.BOLT_LIFE) this.bolt = null;
    this.pending = this.pending.filter((item) => {
      item.delay -= dt;
      if (item.delay > 0) return true;
      item.fn();
      return false;
    });
    if (!this.storm) return;
    if (this.restrikes > 0) {
      this.restrikeTimer -= dt;
      if (this.restrikeTimer <= 0) {
        this.restrikes -= 1;
        this.restrikeTimer = 0.07 + Math.random() * 0.08;
        this.flash = 0.75;
        if (Math.random() < 0.6) this.bolt = this.makeBolt();
      }
    }
    this.stormTimer -= dt;
    if (this.stormTimer > 0) return;
    this.stormTimer = 6 + Math.random() * 8;
    this.flash = 1;
    this.bolt = this.makeBolt();
    this.restrikes = 1 + Math.floor(Math.random() * 2);
    this.restrikeTimer = 0.09;
    this.pending.push({
      delay: 0.3 + Math.random() * 0.9,
      fn: () => { if (hooks.thunder) hooks.thunder(); if (hooks.shake) hooks.shake(3, 0.4); },
    });
  }

  // Rayo del cielo: línea quebrada de arriba hacia el horizonte, con alguna ramificación
  makeBolt() {
    const startX = CONFIG.WIDTH * (0.12 + Math.random() * 0.76);
    const jag = (x0, y0, y1, spread) => {
      const points = [{ x: x0, y: y0 }];
      let x = x0;
      const steps = 6 + Math.floor(Math.random() * 3);
      for (let i = 1; i <= steps; i++) {
        x += (Math.random() - 0.5) * spread;
        points.push({ x, y: y0 + ((y1 - y0) * i) / steps });
      }
      return points;
    };
    const points = jag(startX, -6, CONFIG.HEIGHT * (0.38 + Math.random() * 0.12), 90);
    const branches = [];
    for (let i = 0; i < 2; i++) {
      const from = points[2 + Math.floor(Math.random() * (points.length - 4))];
      const branch = jag(from.x, from.y, from.y + 60 + Math.random() * 70, 70);
      branches.push(branch);
    }
    return { points, branches, age: 0 };
  }

  // Descarga eléctrica corta que sale de un foco: línea quebrada en una dirección al azar
  makeArc(count) {
    const arcs = [];
    for (let k = 0; k < count; k++) {
      const angle = Math.random() * Math.PI * 2;
      const length = 36 + Math.random() * 70;
      const steps = 4 + Math.floor(Math.random() * 3);
      const points = [{ x: 0, y: 0 }];
      for (let i = 1; i <= steps; i++) {
        const along = (length * i) / steps;
        const side = (Math.random() - 0.5) * 20;
        points.push({ x: Math.cos(angle) * along - Math.sin(angle) * side, y: Math.sin(angle) * along + Math.cos(angle) * side });
      }
      arcs.push(points);
    }
    return { arcs, age: 0 };
  }

  // Resplandor de un color, pintado una sola vez y reutilizado (mucho más barato que un degradado por foco y fotograma)
  static glowSprite(color) {
    Atmosphere.glows = Atmosphere.glows || {};
    if (Atmosphere.glows[color]) return Atmosphere.glows[color];
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const c = canvas.getContext('2d');
    const gradient = c.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(0.18, color);
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    c.fillStyle = gradient;
    c.fillRect(0, 0, size, size);
    Atmosphere.glows[color] = canvas;
    return canvas;
  }

  // Capa sobre el fondo y bajo los personajes (en pantalla): destello del cielo, rayo, focos, haces y descargas
  renderBack(ctx, camera) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (this.flash > 0.02) {
      const sky = ctx.createLinearGradient(0, 0, 0, CONFIG.HEIGHT * 0.8);
      sky.addColorStop(0, `rgba(190, 215, 255, ${0.5 * this.flash})`);
      sky.addColorStop(1, 'rgba(190, 215, 255, 0)');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
      ctx.fillStyle = `rgba(170, 195, 255, ${0.08 * this.flash})`;
      ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
    }
    if (this.bolt) this.renderBolt(ctx);
    for (const light of this.searchlights) this.renderSearchlight(ctx, light, camera);

    for (const lamp of this.lamps) {
      const x = lamp.x - camera.x;
      if (x < -120 || x > CONFIG.WIDTH + 120) continue;
      this.renderLamp(ctx, lamp, x);
    }
    ctx.restore();
  }

  // Haz de luz desde arriba del escenario hasta una mancha elíptica en el suelo que se desplaza despacio
  renderSearchlight(ctx, light, camera) {
    const t = this.time * light.speed + light.phase;
    const spotX = light.cx + Math.sin(t) * light.sweep - camera.x;
    const spotY = 440 + Math.sin(t * 1.7) * 20;
    const rx = light.reach;
    if (spotX + rx < -60 || spotX - rx > CONFIG.WIDTH + 60) return;
    const originX = spotX - 90 + Math.sin(t * 0.7 + 1) * 40;
    const flicker = 0.94 + 0.06 * Math.sin(this.time * 38) + this.flash * 0.25; // el zumbido del rotor hace vibrar la luz

    // Cono de luz: se abre desde fuera de la pantalla y se intensifica al llegar al suelo
    const cone = ctx.createLinearGradient(0, -30, 0, spotY);
    cone.addColorStop(0, `rgba(215, 232, 255, ${0.09 * flicker})`);
    cone.addColorStop(1, `rgba(225, 238, 255, ${0.32 * flicker})`);
    ctx.fillStyle = cone;
    ctx.beginPath();
    ctx.moveTo(originX - 16, -30);
    ctx.lineTo(originX + 16, -30);
    ctx.lineTo(spotX + rx, spotY);
    ctx.lineTo(spotX - rx, spotY);
    ctx.closePath();
    ctx.fill();

    // Mancha de luz en el suelo (elipse achatada) con núcleo más brillante
    ctx.globalAlpha = Math.min(1, 0.7 * flicker);
    const sprite = Atmosphere.glowSprite('#bcd8ff');
    ctx.drawImage(sprite, spotX - rx * 1.25, spotY - rx * 0.36, rx * 2.5, rx * 0.72);
    ctx.globalAlpha = Math.min(1, 0.55 * flicker);
    ctx.drawImage(sprite, spotX - rx * 0.6, spotY - rx * 0.17, rx * 1.2, rx * 0.34);
    ctx.globalAlpha = 1;
  }

  renderBolt(ctx) {
    const fade = 1 - this.bolt.age / Atmosphere.BOLT_LIFE;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const trace = (points, width, color, alpha) => {
      ctx.globalAlpha = alpha * fade;
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      points.forEach((point, i) => (i ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y)));
      ctx.stroke();
    };
    trace(this.bolt.points, 14, '#7d9bff', 0.35);
    trace(this.bolt.points, 5, '#cfe0ff', 0.8);
    trace(this.bolt.points, 2, '#ffffff', 1);
    for (const branch of this.bolt.branches) {
      trace(branch, 7, '#7d9bff', 0.3);
      trace(branch, 2, '#ffffff', 0.85);
    }
    ctx.globalAlpha = 1;
  }

  renderLamp(ctx, lamp, x) {
    const color = Atmosphere.LAMP_COLORS[lamp.kind];
    const radius = Atmosphere.LAMP_RADIUS[lamp.kind];
    let level;
    if (lamp.kind === 'arc') level = lamp.event > 0 ? 0.5 + Math.random() * 0.9 : 0;
    else if (lamp.kind === 'red') level = 0.5 + 0.35 * Math.sin(this.time * 3.2 + lamp.phase); // baliza que late
    else level = 0.8 + 0.12 * Math.sin(this.time * 2 + lamp.phase); // luz fija con respiración leve
    if (lamp.event > 0 && lamp.kind !== 'arc') level = Math.random() < 0.5 ? 0.1 : 1.5; // parpadeo del cortocircuito
    level += this.flash * 0.45;

    if (lamp.beam && level > 0.2) {
      // Haz del foco hacia el suelo
      const dir = lamp.beam;
      const beam = ctx.createLinearGradient(x, lamp.y, x + dir * 150, 440);
      beam.addColorStop(0, `rgba(200, 225, 255, ${Math.min(0.3, 0.2 * level)})`);
      beam.addColorStop(1, 'rgba(200, 225, 255, 0)');
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(x - 10, lamp.y);
      ctx.lineTo(x + 10, lamp.y + 8);
      ctx.lineTo(x + dir * 340, 440);
      ctx.lineTo(x + dir * 40, 440);
      ctx.closePath();
      ctx.fill();
    }

    if (level > 0.02) {
      const size = radius * 2 * (0.85 + 0.25 * Math.min(1.5, level));
      ctx.globalAlpha = Math.min(1, 0.7 * level);
      ctx.drawImage(Atmosphere.glowSprite(color), x - size / 2, lamp.y - size / 2, size, size);
      ctx.globalAlpha = 1;
    }

    // Descargas eléctricas del cortocircuito
    for (const group of lamp.arcs) {
      const fade = 1 - group.age / 0.12;
      for (const points of group.arcs) {
        ctx.strokeStyle = '#8ff6ff';
        ctx.globalAlpha = 0.45 * fade;
        ctx.lineWidth = 7;
        this.tracePath(ctx, points, x, lamp.y);
        ctx.strokeStyle = '#ffffff';
        ctx.globalAlpha = fade;
        ctx.lineWidth = 2;
        this.tracePath(ctx, points, x, lamp.y);
      }
    }
    ctx.globalAlpha = 1;
  }

  tracePath(ctx, points, x, y) {
    ctx.beginPath();
    points.forEach((point, i) => (i ? ctx.lineTo(x + point.x, y + point.y) : ctx.moveTo(x + point.x, y + point.y)));
    ctx.stroke();
  }

  // Humo en coordenadas del mundo: se dibuja dentro de la cámara, bajo los personajes
  renderSmoke(ctx) {
    this.smoke.render(ctx);
  }
}
