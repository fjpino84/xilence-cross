// Adversario 3: el Operador y su dron. El Operador se queda a lo lejos (no se le puede golpear) y lanza el dron; el dron vuela hasta ECO,
// carga con luces cian y suelta un rayo vertical sobre una marca del suelo, y vuelve con su dueño para repetirlo. El dron flota a media
// altura: se le alcanza saltando y golpeando, o con los poderes (Thunder Riff, Power Chord, Trino). Al caer el dron, una descarga recorre
// el cable hasta el Operador y lo mata.

// El dron: enemigo con vida propia que cuelga del cable del Operador
class Dron extends Entity {
  static HOVER = 108; // altura de vuelo (px): el golpe en el suelo no llega; un salto sí
  static OUT_TIME = 1.35;
  static CHARGE_TIME = 0.9;
  static STRIKE_TIME = 0.55;
  static BACK_TIME = 1.1;
  static HELD_TIME = 1.0; // en la mano del Operador antes de volver a salir
  static HP = 40; // unos 3 golpes
  static BOLT_DAMAGE = 14;
  static DEATH_TIME = 0.9;

  constructor(owner) {
    super({ x: owner.x, y: owner.y, w: 66, h: 56, maxHp: Dron.HP });
    this.owner = owner;
    this.scoreValue = 250;
    this.elite = false;
    this.mechanical = true; // sin gruñidos al recibir golpes
    this.state = 'held';
    this.z = Dron.HOVER;
    this.depth = 0; // 0 junto al Operador (lejos, pequeño) y 1 delante de ECO (cerca, grande)
    this.fromX = owner.x;
    this.targetX = owner.x;
    this.boltX = owner.x;
    this.struck = false;
    this.deadTime = 0;
    this.spin = 0;
    this.stats = { attackRange: 80, damage: Dron.BOLT_DAMAGE };
  }

  get removable() { return !this.isAlive && this.deadTime >= Dron.DEATH_TIME; }
  get visible() { return this.state !== 'held'; }
  get scale() { return 0.34 + 0.66 * this.depth; }
  get isTelegraphing() { return this.state === 'charge'; }

  launch(world) {
    this.state = 'out';
    this.stateTime = 0;
    this.fromX = this.owner.handX;
    this.x = this.fromX;
    this.y = this.owner.y;
    this.struck = false;
    // Se queda delante de ECO, entre él y el Operador
    const player = world.player;
    const side = this.owner.x > player.x ? 1 : -1;
    this.targetX = player.x + side * (90 + Math.random() * 70);
    world.audio.play('dropWhoosh');
  }

  takeDamage(amount, knockback) {
    if (!this.isAlive || this.state === 'held') return { killed: false };
    this.hp -= amount;
    this.hitFlash = 0.14;
    this.kx = knockback * 0.5;
    this.vz = 80;
    this.flinch = 0.25;
    if (this.hp <= 0) {
      this.hp = 0;
      this.state = 'dead';
      this.stateTime = 0;
      this.vz = 120;
      this.kx = knockback * 0.9;
      return { killed: true };
    }
    return { killed: false };
  }

  update(dt, world) {
    this.tickTimers(dt);
    this.flinch = Math.max(0, (this.flinch || 0) - dt);
    const player = world.player;
    const owner = this.owner;
    const ease = (t) => t * t * (3 - 2 * t);

    switch (this.state) {
      case 'held':
        // En la mano del Operador; sale cuando está listo
        this.x = owner.handX;
        this.y = owner.y;
        this.depth = 0;
        if (owner.isAlive && owner.ready && this.stateTime >= Dron.HELD_TIME) this.launch(world);
        break;
      case 'out': {
        const t = Math.min(1, this.stateTime / Dron.OUT_TIME);
        const e = ease(t);
        this.x = this.fromX + (this.targetX - this.fromX) * e + this.kx * 0.02;
        this.y += (player.y - this.y) * Math.min(1, dt * 3);
        this.depth = e;
        this.z = Dron.HOVER + Math.sin(Math.PI * t) * 36;
        this.spawnTrail(world);
        if (t >= 1) { this.state = 'charge'; this.stateTime = 0; world.audio.play('rexCharge', { kind: 'bolt', enraged: true }); }
        break;
      }
      case 'charge': {
        // Sigue a ECO un momento y fija la marca antes de disparar
        const t = this.stateTime / Dron.CHARGE_TIME;
        if (t < 0.55) {
          this.x += Math.max(-1, Math.min(1, (player.x - this.x) / 60)) * 130 * dt;
          this.y += Math.max(-1, Math.min(1, (player.y - this.y) / 12)) * 120 * dt;
        }
        this.depth = 1;
        this.z = Dron.HOVER + Math.sin(this.age * 7) * 3;
        this.chargeFx(world, t);
        if (this.stateTime >= Dron.CHARGE_TIME) this.fire(world, player);
        break;
      }
      case 'strike':
        this.depth = 1;
        if (this.stateTime >= Dron.STRIKE_TIME) { this.state = 'back'; this.stateTime = 0; this.fromX = this.x; this.fromDepth = 1; }
        break;
      case 'back': {
        const t = Math.min(1, this.stateTime / Dron.BACK_TIME);
        const e = ease(t);
        this.x = this.fromX + (owner.handX - this.fromX) * e;
        this.y += (owner.y - this.y) * Math.min(1, dt * 2.5);
        this.depth = 1 - e;
        this.z = Dron.HOVER + Math.sin(Math.PI * t) * 24;
        this.spawnTrail(world);
        if (t >= 1) { this.state = 'held'; this.stateTime = 0; }
        break;
      }
      case 'dead':
        this.deadTime += dt;
        this.spin += dt * 9;
        this.vx = 0;
        if (!this.reported) { this.reported = true; owner.onDroneDown(world, this); }
        if (this.z <= 0 && !this.exploded) {
          this.exploded = true;
          world.particles.burst({ x: this.x, y: this.y - 10, count: 40, speed: [150, 700], life: [0.3, 0.9], size: [2.5, 5], colors: ['#35e8ff', '#ffffff', '#ffe600'], type: 'spark', drag: 1.6, gravity: 400 });
          world.particles.add({ type: 'ring', x: this.x, y: this.y, size: 10, sizeEnd: 170, life: 0.5, color: '#35e8ff', width: 9, flat: 0.3 });
          world.shake(8, 0.3);
          world.audio.play('zap');
        }
        break;
      default:
        break;
    }
    if (this.state !== 'dead') this.x += this.kx * dt;
    else this.integrate(dt);
    this.kx *= Math.max(0, 1 - dt * 6);
    if (this.state === 'dead' && this.z < 0) this.z = 0;
    if (this.state !== 'dead') this.vz = 0;
  }

  spawnTrail(world) {
    if (Math.random() < 0.5) world.particles.add({ type: 'dot', x: this.x, y: this.y - this.z, vx: (Math.random() - 0.5) * 30, vy: 10, life: 0.35, size: 3 * this.scale + 1, sizeEnd: 0, color: '#35e8ff' });
  }

  // Chispas que se concentran en el dron mientras carga
  chargeFx(world, t) {
    if (Math.random() < 0.6) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 50 + Math.random() * 40;
      const cx = this.x;
      const cy = this.y - this.z;
      world.particles.add({ type: 'spark', x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius * 0.7, vx: -Math.cos(angle) * radius * 4, vy: -Math.sin(angle) * radius * 3, life: 0.2, size: 2 + t * 2, color: Math.random() < 0.5 ? '#35e8ff' : '#ffffff' });
    }
  }

  // Cae el rayo vertical: daña a ECO si está bajo el dron, en su carril
  fire(world, player) {
    this.state = 'strike';
    this.stateTime = 0;
    this.boltX = this.x;
    world.superBolt(this.x, this.y, true);
    world.shake(9, 0.3);
    world.flash(0.12, '#bff8ff', 0.4);
    world.audio.play('rexBolt');
    if (player.isAlive && Math.abs(player.x - this.x) <= 46 && Math.abs(player.y - this.y) <= 58) player.takeDamage(Dron.BOLT_DAMAGE, this.x, world);
  }

  renderCable(ctx) {
    const owner = this.owner;
    const sx = owner.handX;
    const sy = owner.cableY;
    const ex = this.x - (this.x > sx ? 1 : -1) * 18 * this.scale;
    const ey = this.y - this.z + 4 * this.scale;
    const slack = this.state === 'charge' || this.state === 'strike' ? 0.05 : 0.28 + (this.state === 'back' ? 0.25 : 0);
    const mx = (sx + ex) / 2;
    const dist = Math.hypot(ex - sx, ey - sy);
    const sag = dist * slack;
    const wave = Math.sin(this.age * 9) * 14 * (this.state === 'out' || this.state === 'back' ? 1 : 0.2);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#05060c';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(mx, (sy + ey) / 2 + sag + wave, ex, ey);
    ctx.stroke();
    // Durante la carga la corriente recorre el cable
    ctx.strokeStyle = this.state === 'charge' || this.state === 'strike' ? 'rgba(120, 245, 255, 0.9)' : 'rgba(70, 200, 230, 0.35)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(mx, (sy + ey) / 2 + sag + wave, ex, ey);
    ctx.stroke();
    ctx.restore();
  }

  render(ctx) {
    if (!this.visible) return;
    const image = Assets.image('a3Dron');
    const alive = this.state !== 'dead';
    // Marca del rayo en el suelo (aviso)
    if (this.state === 'charge') {
      const t = this.stateTime / Dron.CHARGE_TIME;
      ctx.save();
      ctx.globalAlpha = 0.25 + 0.6 * t;
      ctx.strokeStyle = t > 0.55 ? '#ffffff' : '#35e8ff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(this.x, this.y, 46, 14, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(53, 232, 255, 0.25)';
      ctx.fill();
      if (t > 0.55) {
        // Línea de luz vertical previa al rayo
        ctx.globalAlpha = (t - 0.55) * 1.6;
        ctx.fillStyle = 'rgba(200, 255, 255, 0.8)';
        ctx.fillRect(this.x - 1.5, this.y - this.z, 3, this.z);
      }
      ctx.restore();
    }
    if (alive) this.renderCable(ctx);
    // Sombra
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(this.x, this.y, 30 * this.scale * Math.max(0.5, 1 - this.z / 260), 7 * this.scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (!image) return;
    const height = 66 * this.scale;
    const bob = alive ? Math.sin(this.age * 5) * 3 * this.scale : 0;
    const cy = this.y - this.z - 20 + bob;
    ctx.save();
    ctx.translate(this.x, cy);
    if (!alive) ctx.rotate(this.spin);
    ctx.translate(-this.x, -cy);
    // Brillo de carga alrededor del dron
    if (this.state === 'charge' || this.state === 'strike') {
      const t = this.state === 'charge' ? this.stateTime / Dron.CHARGE_TIME : 1;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const r = 40 + 60 * t;
      const g = ctx.createRadialGradient(this.x, cy, 4, this.x, cy, r);
      g.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
      g.addColorStop(0.35, 'rgba(53, 232, 255, 0.5)');
      g.addColorStop(1, 'rgba(0, 160, 255, 0)');
      ctx.globalAlpha = 0.4 + 0.6 * t;
      ctx.fillStyle = g;
      ctx.fillRect(this.x - r, cy - r, r * 2, r * 2);
      ctx.restore();
    }
    Sprite.draw(ctx, image, {
      x: this.x, y: cy + height / 2, height, anchorX: 0.5, facing: this.owner.x > this.x ? -1 : 1, flash: this.hitFlash > 0,
      glow: this.state === 'charge' ? 1.5 : 0,
    });
    // Hélices: borrón giratorio sobre los rotores
    if (alive) {
      const w = (image.width / image.height) * height;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = '#bfe9ff';
      for (const [fx, fy] of [[0.18, 0.1], [0.84, 0.22]]) {
        const px = this.x + (fx - 0.5) * w * (this.owner.x > this.x ? -1 : 1);
        const py = cy - height / 2 + fy * height;
        ctx.beginPath();
        ctx.ellipse(px, py, w * 0.2, height * 0.05 + Math.abs(Math.sin(this.age * 40)) * 2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
    // Barra de vida
    if (alive && this.hp < this.maxHp) Draw.bar(ctx, this.x - 24, cy - height / 2 - 14, 48, 7, this.hp / this.maxHp, CONFIG.COLORS.CYAN);
  }
}

// El Operador: no se le puede golpear; muere cuando cae su dron
class Operador extends Entity {
  static HEIGHT = 156; // altura de dibujo (px): la misma en todas sus poses
  static WALK_SPEED = 150;
  static SHOCK_TIME = 1.5;
  static FALL_TIME = 0.8;
  static FADE_TIME = 1.2;

  constructor(x, y) {
    super({ x, y, w: 50, h: Operador.HEIGHT, maxHp: 1 });
    this.untargetable = true; // los golpes y poderes lo ignoran: hay que derrotar al dron
    this.elite = false;
    this.scoreValue = 0;
    this.stats = { attackRange: 0, damage: 0 };
    this.state = 'enter';
    this.facing = -1;
    this.drone = new Dron(this);
    this.deadTime = 0;
    this.ready = false;
    this.shockFx = 0;
    this.slot = x;
  }

  get removable() { return !this.isAlive && this.deadTime >= Operador.SHOCK_TIME + Operador.FALL_TIME + Operador.FADE_TIME; }
  get handX() { return this.x + this.facing * Operador.HEIGHT * 0.5 * 0.9; }
  get cableY() { return this.y - Operador.HEIGHT * 0.64; }

  takeDamage() { return { killed: false }; }

  // El dron cayó: la descarga llega al Operador por el cable
  onDroneDown(world) {
    if (!this.isAlive) return;
    this.hp = 0;
    this.state = 'shock';
    this.deadTime = 0;
    world.flash(0.25, '#bff8ff', 0.6);
    world.shake(10, 0.5);
    world.audio.play('zap');
    world.addText(this.x, this.y, this.h + 14, '¡DESCARGA!', { color: '#bff8ff', size: 26 });
  }

  update(dt, world) {
    this.tickTimers(dt);
    const camera = world.camera;
    const player = world.player;
    if (this.state === 'enter') {
      const target = camera.right - 130;
      this.slot = target;
      this.x += Math.sign(target - this.x) * Math.min(Math.abs(target - this.x), Operador.WALK_SPEED * dt);
      if (Math.abs(target - this.x) < 2) { this.state = 'idle'; this.stateTime = 0; }
    } else if (this.state === 'idle') {
      // Se mantiene a lo lejos, mirando a ECO
      this.slot = Math.max(camera.x + CONFIG.WIDTH * 0.62, Math.min(camera.right - 110, this.slot));
      this.x += (this.slot - this.x) * Math.min(1, dt * 2);
      this.ready = true;
    } else if (this.state === 'shock') {
      this.deadTime += dt;
      this.shockFx -= dt;
      if (this.shockFx <= 0) {
        this.shockFx = 0.06;
        const cx = this.x + (Math.random() - 0.5) * 70;
        const cy = this.y - Math.random() * Operador.HEIGHT;
        world.particles.burst({ x: cx, y: cy, count: 3, speed: [100, 420], life: [0.15, 0.4], size: [2, 4], colors: ['#35e8ff', '#ffffff', '#ffe600'], type: 'spark', drag: 2 });
      }
      if (this.deadTime >= Operador.SHOCK_TIME) { this.state = 'dead'; world.audio.play('thud'); world.landDust(this.x, this.y, 5); }
    } else if (this.state === 'dead') {
      this.deadTime += dt;
    }
    if (this.state !== 'shock' && this.state !== 'dead') this.facing = Math.sign(player.x - this.x) || this.facing;
    this.facing = this.state === 'dead' || this.state === 'shock' ? this.facing : (player.x < this.x ? -1 : 1);
    this.y += (Math.max(CONFIG.GROUND_TOP + 20, Math.min(CONFIG.GROUND_BOTTOM - 10, player.y)) - this.y) * Math.min(1, dt * 0.6);
  }

  // Pose: preparando el lanzamiento con el dron en la mano; si no, apuntando con el cable tendido
  get pose() { return this.drone.state === 'held' || this.state === 'enter' ? 'a3Prep' : 'a3Point'; }

  render(ctx) {
    this.drawShadow(ctx);
    const prep = this.pose === 'a3Prep';
    const image = Assets.image(this.pose);
    if (image) {
      const anchors = { a3Prep: 0.367, a3Point: 0.422 };
      const dead = this.state === 'dead';
      const shocking = this.state === 'shock';
      const fall = dead ? Math.min(1, this.deadTime - Operador.SHOCK_TIME) / Operador.FALL_TIME : 0;
      const fade = dead ? Math.max(0, 1 - Math.max(0, this.deadTime - Operador.SHOCK_TIME - Operador.FALL_TIME) / Operador.FADE_TIME) : 1;
      const jitter = shocking ? (Math.random() - 0.5) * 8 : 0;
      Sprite.draw(ctx, image, {
        x: this.x + jitter, y: this.y, height: Operador.HEIGHT, anchorX: anchors[this.pose], facing: -this.facing,
        rotation: dead ? -Math.min(1.45, Math.max(0, fall) * 1.45) : 0,
        flash: this.hitFlash > 0 || (shocking && Math.floor(this.age * 24) % 2 === 0),
        alpha: fade, tint: shocking ? { color: '#bff8ff', alpha: 0.25 + 0.25 * Math.sin(this.age * 50) } : null, glow: shocking ? 2 : 0,
      });
      if (shocking) this.renderArcs(ctx);
    }
    if (!prep && this.drone.isAlive === false) { /* el cable ya no se dibuja */ }
  }

  // Descargas eléctricas que recorren el cuerpo
  renderArcs(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (let k = 0; k < 3; k++) {
      let x = this.x + (Math.random() - 0.5) * 50;
      let y = this.y - Operador.HEIGHT;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let i = 0; i < 7; i++) { x += (Math.random() - 0.5) * 36; y += Operador.HEIGHT / 7; ctx.lineTo(x, y); }
      ctx.strokeStyle = 'rgba(120, 245, 255, 0.9)';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
    ctx.restore();
  }
}
