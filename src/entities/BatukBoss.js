// BATUK, el monje percusionista (jefe del nivel 1). Entra caminando desde la derecha, aterriza con un pisotón y combate
// con un duelo musical. Mientras tanto, un anillo de instrumentos de percusión gira a su alrededor; con la música
// llegan instrumentos nuevos volando desde distintos lugares (arriba, los lados, el fondo, el suelo) y los más
// antiguos salen despedidos. Si ECO gana, cae derrotado y sus instrumentos se esparcen.
class BatukBoss {
  static HEIGHT = 255; // los enemigos miden ~165 y ECO ~140; su cabeza queda justo bajo el cuadro de diálogo
  static ANCHOR_X = 0.5198;
  static ORBIT_MAX = 8;
  static ORBIT_RX = 170;
  static ORBIT_RY = 66;
  static KINDS = ['i1', 'i2', 'i3', 'i4', 'i5', 'i6', 'i2', 'i3']; // las seis ilustraciones: bombo, platillo, djembé, címbalos, tambor con pie y gong
  static WALK_SPEED = 230;
  static IN_TIME = 1.15; // vuelo de un instrumento hasta la órbita

  constructor(x, y) {
    this.musicStyle = 'track'; // el duelo se juega sobre su canción grabada
    this.x = x;
    this.y = y;
    this.z = 0;
    this.name = 'BATUK';
    this.title = 'MAESTRO PERCUSIONISTA';
    this.targetX = x;
    this.state = 'walk'; // walk → idle (combate) → down (derrotado)
    this.age = 0;
    this.landedTime = -1;
    this.squash = 0;
    this.pulse = 0; // 1 en cada tiempo y cae rápido
    this.hurt = 0;
    this.lunge = 0;
    this.stepTimer = 0;
    this.sortY = y + 6;
    this.orbit = 0;
    this.orbitSpeed = 1.1;
    this.instruments = [];
    this.initialSpawned = 0;
    this.spawnCount = 0;
    this.emberTimer = 0;
    this.defeatTime = 0;
    this.drumming = false; // ya está tocando al ritmo (usa las poses de tocar)
    this.frame = 0;
    this.powerPose = 0;
    this.forward = 0;
    this.forwardTarget = 0;
  }

  get landed() { return this.landedTime >= 0; }
  get defeated() { return this.state === 'down'; }

  // Un paso lento hacia ECO (se usa en el diálogo previo)
  stepForward() {
    this.forwardTarget = -42; // se queda un paso más cerca de ECO
  }

  // Tras ser derrotado se incorpora despacio, sin instrumentos ni aura
  standUp() {
    if (this.state !== 'down') return;
    this.state = 'rise';
    this.riseTime = 0;
  }

  // Devuelve true en el instante en que termina de entrar y planta los pies
  update(dt, world) {
    this.age += dt;
    this.pulse = Math.max(0, this.pulse - dt * 4);
    this.squash = Math.max(0, this.squash - dt);
    this.hurt = Math.max(0, this.hurt - dt * 4);
    this.lunge = Math.max(0, this.lunge - dt * 3);
    this.powerPose = Math.max(0, this.powerPose - dt);
    this.forward += (this.forwardTarget - this.forward) * Math.min(1, dt * 1.6);
    let justLanded = false;

    if (this.state === 'walk') {
      const distance = this.targetX - this.x;
      this.x += Math.sign(distance) * Math.min(Math.abs(distance), BatukBoss.WALK_SPEED * dt);
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) {
        this.stepTimer = 0.42;
        world.shake(3, 0.12);
        world.landDust(this.x, this.y, 3);
        world.audio.play('drumStomp');
      }
      if (Math.abs(distance) < 1.5) {
        this.state = 'idle';
        this.landedTime = 0;
        this.squash = 0.3;
        justLanded = true;
      }
    } else if (this.state === 'idle') {
      this.landedTime += dt;
      this.orbit += dt * this.orbitSpeed;
      this.auraEffects(dt, world);
      // Los primeros instrumentos llegan escalonados, de lugares distintos
      while (this.initialSpawned < 6 && this.landedTime > 0.3 + this.initialSpawned * 0.28) {
        this.initialSpawned++;
        this.spawnInstrument(world);
      }
    } else if (this.state === 'rise') {
      this.riseTime += dt;
      if (this.riseTime >= 2) this.state = 'calm';
    } else if (this.state === 'down') {
      this.defeatTime += dt;
    }

    this.updateInstruments(dt, world);
    return justLanded;
  }

  // ---------------------------------------------------------------- instrumentos

  // Posición de una órbita: elipse inclinada alrededor del pecho; depth > 0 = delante del cuerpo
  orbitPoint(phase, index = 0) {
    const a = this.orbit + phase;
    const bob = Math.sin(this.age * 2.2 + index * 1.7) * 8;
    return {
      x: this.x + Math.cos(a) * BatukBoss.ORBIT_RX,
      y: this.y - 150 + Math.sin(a) * BatukBoss.ORBIT_RY + bob,
      depth: Math.sin(a),
    };
  }

  // Un instrumento nuevo cruza la pantalla desde un lugar distinto cada vez y entra en la órbita
  spawnInstrument(world) {
    const camera = world.camera;
    const origin = this.spawnCount % 5;
    const left = camera.left;
    const right = camera.right;
    const from = [
      { x: left + Math.random() * (right - left), y: -70 }, // cae desde arriba
      { x: left - 90, y: 100 + Math.random() * 260 }, // entra por la izquierda
      { x: right + 90, y: 100 + Math.random() * 260 }, // entra por la derecha
      { x: left + Math.random() * (right - left), y: 640 }, // sube desde abajo
      { x: this.x + (Math.random() - 0.5) * 260, y: 150 }, // viene del fondo, pequeño
    ][origin];
    const kind = BatukBoss.KINDS[this.spawnCount % BatukBoss.KINDS.length];
    this.spawnCount++;

    // Fase libre de la órbita: el hueco más grande entre los instrumentos que ya giran
    const phases = this.instruments.filter((item) => item.state === 'orbit' || item.state === 'in').map((item) => item.phase).sort((a, b) => a - b);
    let phase = Math.random() * Math.PI * 2;
    if (phases.length) {
      let best = -1;
      phases.forEach((value, i) => {
        const next = i + 1 < phases.length ? phases[i + 1] : phases[0] + Math.PI * 2;
        if (next - value > best) { best = next - value; phase = value + best / 2; }
      });
    }
    this.instruments.push({
      kind, state: 'in', t: 0, from, phase: phase % (Math.PI * 2), size: 27 + Math.random() * 6,
      rot: Math.random() * 6.28, spin: (Math.random() < 0.5 ? -1 : 1) * (4 + Math.random() * 4),
      arc: (Math.random() < 0.5 ? -1 : 1) * (70 + Math.random() * 60), far: origin === 4, x: from.x, y: from.y, depth: 0, alpha: 1,
      vx: 0, vy: 0, index: this.spawnCount,
    });
    if (world.audio) world.audio.play('instrumentIn');
  }

  // Manda fuera de la órbita a un instrumento (el más antiguo, o el más cercano a ECO)
  ejectInstrument(world, towardEco = false) {
    const orbiting = this.instruments.filter((item) => item.state === 'orbit');
    if (!orbiting.length) return;
    const item = towardEco
      ? orbiting.reduce((best, current) => (current.x < best.x ? current : best))
      : orbiting[0];
    item.state = 'out';
    item.alpha = 1;
    const angle = towardEco ? Math.PI + (Math.random() - 0.5) * 0.4 : Math.random() * Math.PI * 2;
    const speed = towardEco ? 760 : 380 + Math.random() * 260;
    item.vx = Math.cos(angle) * speed;
    item.vy = Math.sin(angle) * speed - 120;
    item.spin = (Math.random() < 0.5 ? -1 : 1) * (7 + Math.random() * 5);
    item.life = 0;
    world.particles.burst({ x: item.x, y: item.y, count: 8, speed: [120, 360], life: [0.2, 0.45], size: [2, 4], colors: ['#ffd23a', '#ffffff', '#ff9a1a'], type: 'spark', drag: 2 });
  }

  updateInstruments(dt, world) {
    let orbiters = 0;
    this.instruments.forEach((item, index) => {
      item.rot += item.spin * dt;
      if (item.state === 'orbit') {
        const point = this.orbitPoint(item.phase, item.index);
        item.x = point.x; item.y = point.y; item.depth = point.depth;
        orbiters++;
      } else if (item.state === 'in') {
        item.t += dt / BatukBoss.IN_TIME;
        const p = Math.min(1, item.t);
        const eased = p * p * (3 - 2 * p);
        const target = this.orbitPoint(item.phase, item.index);
        const dx = target.x - item.from.x;
        const dy = target.y - item.from.y;
        const length = Math.hypot(dx, dy) || 1;
        // Trayectoria curva: se desvía hacia un lado a mitad del vuelo
        const arc = Math.sin(Math.PI * p) * item.arc;
        item.x = item.from.x + dx * eased + (-dy / length) * arc;
        item.y = item.from.y + dy * eased + (dx / length) * arc;
        item.depth = target.depth;
        item.scaleIn = item.far ? 0.35 + 0.65 * eased : 0.7 + 0.3 * eased;
        if (p >= 1) {
          item.state = 'orbit';
          item.scaleIn = 1;
          this.pulse = Math.max(this.pulse, 0.6);
          world.particles.burst({ x: item.x, y: item.y, count: 10, speed: [100, 340], life: [0.2, 0.5], size: [2, 4.4], colors: ['#ffd23a', '#ffffff', '#ff9a1a'], type: 'spark', drag: 2 });
          world.particles.add({ type: 'ring', x: item.x, y: item.y, size: 6, sizeEnd: 54, life: 0.3, color: '#ffd23a', width: 4 });
          world.audio.play('instrumentHit');
        }
      } else {
        // Despedido: vuela, cae y se desvanece (al caer derrotado también se esparcen)
        item.life += dt;
        item.vy += 1400 * dt;
        item.x += item.vx * dt;
        item.y += item.vy * dt;
        const floor = this.y + 10;
        if (item.y > floor && item.vy > 0) { item.y = floor; item.vy *= -0.35; item.vx *= 0.6; item.spin *= 0.5; }
        item.alpha = Math.max(0, 1 - Math.max(0, item.life - (this.defeated ? 2.2 : 0.5)) / 0.6);
      }
    });
    this.instruments = this.instruments.filter((item) => item.state !== 'out' || item.alpha > 0);
    this.orbiters = orbiters;
  }

  // ---------------------------------------------------------------- reacciones a la música

  // Llamado por el duelo en cada tiempo de la canción
  onBeat(beat, combo, world) {
    if (this.state !== 'idle') return;
    this.pulse = 1;
    this.drumming = true;
    this.frame = beat; // una pose por tiempo: levanta las baquetas, golpea y vuelve
    this.squash = Math.max(this.squash, beat % 5 === 2 ? 0.16 : 0.08);
    this.orbitSpeed = 1.1 + Math.min(1.3, combo / 35);
    if (beat % 2 === 0) {
      if ((this.orbiters || 0) >= BatukBoss.ORBIT_MAX) this.ejectInstrument(world);
      this.spawnInstrument(world);
    }
    if (beat % 4 === 0) {
      world.particles.add({ type: 'ring', x: this.x, y: this.y, size: 14, sizeEnd: 240, life: 0.7, color: '#ffd23a', width: 8, flat: 0.28 });
      world.particles.add({ type: 'ring', x: this.x, y: this.y, size: 8, sizeEnd: 150, life: 0.5, color: '#ff7a00', width: 4, flat: 0.28 });
    }
  }

  react(kind, world) {
    if (this.state !== 'idle') return;
    if (kind === 'miss') {
      // Contraataque: embiste hacia ECO y lanza un instrumento contra él
      this.lunge = 1;
      this.powerPose = 0.55; // pose de poder con tambores flotando
      this.ejectInstrument(world, true);
    } else if (kind === 'tier') {
      // La racha lo hace temblar: sus instrumentos giran más rápido un instante y adopta la pose de poder
      this.powerPose = 0.45;
      this.hurt = 1;
      this.pulse = 1;
      this.orbit += 0.5;
      world.particles.burst({ x: this.x, y: this.y - 140, count: 26, speed: [200, 620], life: [0.3, 0.8], size: [2.4, 5], colors: ['#ffd23a', '#ffffff', '#ff9a1a'], type: 'spark', drag: 1.8 });
    } else if (kind === 'streak') {
      this.hurt = 1;
      this.squash = 0.25;
      this.powerPose = 0.5;
    }
  }

  // ECO gana: Batuk cae hacia atrás y sus instrumentos se esparcen
  defeat(world) {
    this.state = 'down';
    this.defeatTime = 0;
    this.hurt = 1;
    for (const item of this.instruments) {
      if (item.state === 'out') continue;
      item.state = 'out';
      item.life = 0;
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
      const speed = 300 + Math.random() * 420;
      item.vx = Math.cos(angle) * speed;
      item.vy = Math.sin(angle) * speed - 200;
      item.spin = (Math.random() < 0.5 ? -1 : 1) * (5 + Math.random() * 6);
    }
    world.audio.play('drumBoom');
    world.shake(16, 0.6);
    world.flash(0.4, '#ffd23a');
  }

  auraEffects(dt, world) {
    this.emberTimer -= dt;
    if (this.emberTimer > 0) return;
    this.emberTimer = 0.05;
    world.particles.add({
      type: 'dot', x: this.x + (Math.random() - 0.5) * 150, y: this.y - Math.random() * 40,
      vx: (Math.random() - 0.5) * 50, vy: -(60 + Math.random() * 170), life: 1 + Math.random() * 0.8,
      size: 1.8 + Math.random() * 3, sizeEnd: 0, color: Math.random() < 0.6 ? '#ffd23a' : '#ff8a1a',
    });
  }

  // ---------------------------------------------------------------- dibujo

  // Cada pose es una imagen distinta; g = px de juego por px de la imagen (calibrado para que el cuerpo mida lo mismo)
  static SETS = {
    stand: { key: 'spriteBatuk', canvas: 805, g: 0.3168, anchor: 0.5198, feet: 0.995 },
    drum: { key: 'batukTocar', count: 5, canvas: 432, g: 0.6, anchor: 0.4872, feet: 0.9815 },
    kneel: { key: 'batukKneel', canvas: 789, g: 0.27, anchor: 0.5198, feet: 0.9937 },
    power: { key: 'batukPoder', canvas: 1182, g: 0.285, anchor: 0.501, feet: 0.9983 },
  };
  static FACING = -1; // mira hacia ECO (a su izquierda)

  // Capas de pose que se dibujan ahora: [{ set, number, alpha }]
  poseLayers() {
    const S = BatukBoss.SETS;
    if (this.state === 'down') return [{ set: S.kneel, alpha: 1 }];
    if (this.state === 'rise') {
      const p = Math.min(1, this.riseTime / 1.8);
      const eased = p * p * (3 - 2 * p);
      return [{ set: S.kneel, alpha: 1 - eased }, { set: S.stand, alpha: eased }];
    }
    if (this.powerPose > 0) return [{ set: S.power, alpha: 1 }];
    if (this.state === 'idle' && this.drumming) return [{ set: S.drum, number: 1 + (this.frame % 5), alpha: 1 }];
    return [{ set: S.stand, alpha: 1 }];
  }

  // Dibuja una capa de pose con las medidas de su imagen
  drawLayer(ctx, layer, x, y, extra = {}) {
    const { set } = layer;
    const image = Assets.image(set.key + (layer.number || ''));
    if (!image) return;
    const height = set.canvas * set.g * (extra.scale || 1);
    Sprite.draw(ctx, image, {
      x, y, height, anchorX: set.anchor, facing: BatukBoss.FACING, offsetY: (1 - set.feet) * height,
      ...extra, alpha: (extra.alpha ?? 1) * layer.alpha,
    });
  }

  render(ctx) {
    const height = BatukBoss.HEIGHT;
    const down = this.state === 'down';
    const rising = this.state === 'rise';
    const fighting = this.state === 'idle' || this.state === 'walk';
    const pulse = this.pulse;
    const walking = this.state === 'walk';

    // Sombra
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.ellipse(this.x, this.y, down || rising ? 100 : 78, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Aura dorada que late con la música (solo mientras combate)
    if (fighting) {
      const cy = this.y - height * 0.5;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const radius = height * (0.68 + 0.08 * pulse);
      const halo = ctx.createRadialGradient(this.x, cy, height * 0.1, this.x, cy, radius);
      halo.addColorStop(0, `rgba(255, 190, 40, ${0.34 + 0.2 * pulse})`);
      halo.addColorStop(0.6, `rgba(255, 120, 10, ${0.16 + 0.1 * pulse})`);
      halo.addColorStop(1, 'rgba(255, 90, 0, 0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(this.x, cy, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    this.renderInstruments(ctx, -1); // los que pasan por detrás del cuerpo

    const hop = walking ? Math.abs(Math.sin(this.age * 7.5)) * 7 : 0;
    const sway = this.state === 'idle' ? Math.sin(this.age * 1.7) * 14 - this.lunge * 46 + this.forward : (this.state === 'calm' ? 0 : -this.lunge * 46);
    const squash = this.squash / 0.3;
    const bounce = 1 + 0.045 * pulse;
    const knock = down ? Math.max(0, 0.3 - this.defeatTime) * 90 : 0; // el golpe lo hunde un instante al caer de rodillas
    const common = {
      scaleX: 1 + 0.12 * squash - 0.02 * pulse, scaleY: (1 - 0.1 * squash) * bounce, flash: this.hurt > 0.4,
    };
    const tint = down ? { color: '#2a1a08', alpha: 0.18 } : (this.lunge > 0.2 ? { color: '#ff2a55', alpha: 0.25 * this.lunge } : (fighting ? { color: '#ffb020', alpha: 0.04 + 0.1 * pulse } : null));
    for (const layer of this.poseLayers()) {
      const x = this.x + sway;
      const y = this.y - hop + knock;
      if (fighting) {
        // Contorno dorado: silueta más grande y translúcida detrás del cuerpo
        this.drawLayer(ctx, layer, x, y, { ...common, scale: 1.05, silhouetteColor: '#ffd23a', additive: true, alpha: 0.28 + 0.22 * pulse });
      }
      this.drawLayer(ctx, layer, x, y, { ...common, tint });
    }

    this.renderInstruments(ctx, 1); // los que pasan por delante
  }

  renderInstruments(ctx, side) {
    const list = this.instruments.filter((item) => (side > 0 ? item.depth >= 0 || item.state === 'out' : item.depth < 0 && item.state !== 'out'));
    list.sort((a, b) => a.depth - b.depth);
    for (const item of list) {
      const depthScale = 0.82 + 0.26 * ((item.depth + 1) / 2);
      const size = item.size * depthScale * (item.scaleIn || 1) * (1 + 0.18 * this.pulse);
      ctx.save();
      ctx.globalAlpha *= item.alpha;
      // Halo dorado
      ctx.globalCompositeOperation = 'lighter';
      const glow = size * 2.6;
      ctx.globalAlpha *= 0.55;
      ctx.drawImage(Atmosphere.glowSprite('#ffb000'), item.x - glow / 2, item.y - glow / 2, glow, glow);
      ctx.restore();
      ctx.save();
      ctx.globalAlpha *= item.alpha;
      if (item.depth < 0 && item.state !== 'out') ctx.globalAlpha *= 0.85;
      BatukBoss.drawInstrument(ctx, item.kind, item.x, item.y, size, item.rot);
      ctx.restore();
    }
  }

  // Instrumento de percusión dibujado con formas (cel-shading: contorno negro grueso). size = radio aproximado.
  static drawInstrument(ctx, kind, x, y, size, rot = 0) {
    // Ilustraciones reales (i1..i6); si no cargaron se dibuja un tambor sencillo
    const picture = /^i[1-6]$/.test(kind) ? Assets.image('batukInst' + kind.slice(1)) : null;
    if (picture) {
      const scale = (size * 2.3) / Math.max(picture.width, picture.height);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.drawImage(picture, (-picture.width * scale) / 2, (-picture.height * scale) / 2, picture.width * scale, picture.height * scale);
      ctx.restore();
      return;
    }
    if (/^i[1-6]$/.test(kind)) kind = 'tom';
    const gold = '#e0a21c';
    const dark = '#8a4a14';
    const cream = '#f4e6b8';
    const red = '#b8321f';
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(2, size * 0.1);
    ctx.strokeStyle = '#000';
    const s = size;

    if (kind === 'tom') {
      // Tambor: cuerpo cilíndrico con aros de metal y parche claro
      ctx.fillStyle = dark;
      ctx.beginPath(); ctx.rect(-s, -s * 0.2, s * 2, s * 0.9); ctx.fill(); ctx.stroke();
      ctx.fillStyle = gold;
      ctx.fillRect(-s, s * 0.32, s * 2, s * 0.16);
      ctx.fillRect(-s, -s * 0.2, s * 2, s * 0.14);
      ctx.beginPath(); ctx.ellipse(0, s * 0.7, s, s * 0.32, 0, 0, Math.PI); ctx.fillStyle = dark; ctx.fill(); ctx.stroke();
      ctx.fillStyle = cream;
      ctx.beginPath(); ctx.ellipse(0, -s * 0.2, s, s * 0.34, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = red; ctx.lineWidth = s * 0.07;
      ctx.beginPath(); ctx.moveTo(-s * 0.5, -s * 0.2); ctx.lineTo(s * 0.5, -s * 0.2); ctx.stroke();
    } else if (kind === 'conga') {
      // Conga: barril alto que se estrecha hacia abajo
      ctx.fillStyle = dark;
      ctx.beginPath();
      ctx.moveTo(-s * 0.8, -s * 0.8); ctx.quadraticCurveTo(-s * 1.0, 0, -s * 0.5, s * 1.1);
      ctx.lineTo(s * 0.5, s * 1.1); ctx.quadraticCurveTo(s * 1.0, 0, s * 0.8, -s * 0.8);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = gold;
      ctx.fillRect(-s * 0.84, -s * 0.32, s * 1.68, s * 0.14);
      ctx.fillRect(-s * 0.62, s * 0.42, s * 1.24, s * 0.12);
      ctx.fillStyle = cream;
      ctx.beginPath(); ctx.ellipse(0, -s * 0.8, s * 0.8, s * 0.26, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else if (kind === 'cymbal') {
      // Platillo: disco dorado con campana central
      ctx.fillStyle = gold;
      ctx.beginPath(); ctx.ellipse(0, 0, s * 1.15, s * 0.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(255, 245, 200, 0.75)'; ctx.lineWidth = s * 0.05;
      for (const k of [0.8, 0.55]) { ctx.beginPath(); ctx.ellipse(0, 0, s * k, s * k * 0.43, 0, 0, Math.PI * 2); ctx.stroke(); }
      ctx.strokeStyle = '#000'; ctx.lineWidth = Math.max(2, s * 0.1);
      ctx.fillStyle = '#ffe48a';
      ctx.beginPath(); ctx.ellipse(0, -s * 0.05, s * 0.3, s * 0.2, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else if (kind === 'tambourine') {
      // Pandereta: aro de madera con sonajas
      ctx.fillStyle = cream;
      ctx.beginPath(); ctx.arc(0, 0, s * 0.95, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.lineWidth = s * 0.26; ctx.strokeStyle = dark;
      ctx.beginPath(); ctx.arc(0, 0, s * 0.82, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = Math.max(2, s * 0.08); ctx.strokeStyle = '#000';
      ctx.beginPath(); ctx.arc(0, 0, s * 0.95, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = gold;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ctx.beginPath(); ctx.arc(Math.cos(a) * s * 0.82, Math.sin(a) * s * 0.82, s * 0.17, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
    } else {
      // Baquetas cruzadas
      for (const dir of [-1, 1]) {
        ctx.save();
        ctx.rotate(dir * 0.55);
        ctx.fillStyle = cream;
        ctx.beginPath(); ctx.rect(-s * 0.1, -s * 1.1, s * 0.2, s * 2.2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = gold;
        ctx.beginPath(); ctx.arc(0, -s * 1.1, s * 0.26, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.restore();
      }
    }
    ctx.restore();
  }
}
