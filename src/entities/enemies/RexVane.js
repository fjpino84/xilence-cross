// Rex Vane, Auditor Sonoro: sub jefe del nivel 1. Llega flotando desde arriba y barre la escena de lado a lado hasta que decide atacar.
//  · Ataque 1 (rayos): se coloca en medio de la escena y deja caer cuatro rayos verticales. Se esquivan en los huecos entre rayos.
//  · Ataque 2 (descarga): baja a tierra, se agacha y lanza un rayo horizontal a ras de suelo. Se esquiva saltando.
// No se aturde ni sale despedido: recibe el daño y sigue. Por debajo de la mitad de su vida ataca más rápido.
class RexVane extends Enemy {
  static HOVER = 54; // altura de vuelo: ECO lo alcanza con los golpes del suelo
  static ARRIVE_TIME = 1.8;
  static FLY_FPS = 9;
  static DEATH_TIME = 2.4;
  static BOLT_HALF_WIDTH = 40; // mitad del ancho de cada rayo vertical
  static BOLT_SPACING = 220;
  static RAY_LENGTH = 1100;

  // g = px de juego por px del lienzo; scales corrige cuadros que en la hoja se dibujaron más pequeños (relativo al lienzo común)
  static FRAMES = {
    fly: { key: 'rexFly', count: 6, canvas: 393, g: 0.6, feet: 0.984, anchor: 0.4734, scales: [1, 1, 1, 1.2, 1.2, 1.2] },
    charge: { key: 'rexCharge', count: 6, canvas: 474, g: 0.55, feet: 0.9947, anchor: 0.4299, scales: [1, 1, 1, 1.15, 1.15, 1] },
    land: { key: 'rexLand', count: 6, canvas: 419, g: 0.64, feet: 0.9857, anchor: 0.4896, scales: [1, 1, 1, 1, 1, 1] },
  };

  constructor(x, y) {
    const stats = Object.freeze({
      hp: 320, speed: 170, patrolSpeed: 0, patrolRange: 0, aggroRange: 99999, attackRange: 0,
      damage: 18, windup: 1, strike: 0.4, recovery: 0.5, cooldown: 1, scoreValue: 3000,
    });
    super({ x, y, w: 70, h: 150, stats, aggressive: true });
    this.boss = true;
    this.name = 'REX VANE';
    this.title = 'AUDITOR SONORO';
    this.state = 'arrive';
    this.z = RexVane.HOVER + 520;
    this.alpha = 0;
    this.talked = false; // ya se mostró el diálogo
    this.enraged = false;
    this.sub = '';
    this.subTime = 0;
    this.sweepDir = Math.random() < 0.5 ? -1 : 1;
    this.sweepSpeed = 0;
    this.attackTimer = 2;
    this.lastAttack = '';
    this.boltXs = [];
    this.boltFlash = 0; // tiempo desde que cayeron los rayos
    this.rayY = y;
    this.rayFacing = 1;
    this.hit = false; // el ataque en curso ya alcanzó a ECO
    this.ghosts = [];
    this.ghostTimer = 0;
    this.fxTimer = 0;
    this.deathBurst = false;
  }

  get removable() { return !this.isAlive && this.deadTime >= RexVane.DEATH_TIME; }

  // Cabeza del jefe en el mundo (para el escáner del diálogo)
  get headPoint() { return { x: this.x + this.facing * 6, y: this.y - this.z - 128 }; }

  // Tras el diálogo empieza el combate
  engage() {
    if (this.state !== 'talk') return;
    this.setState('float');
    this.attackTimer = 1.6;
  }

  // Se puede dañar salvo mientras aparece y habla
  get vulnerable() { return this.isAlive && this.state !== 'arrive' && this.state !== 'talk'; }

  takeDamage(amount, knockback) {
    if (!this.isAlive || !this.vulnerable) return { killed: false };
    this.hp -= amount;
    this.hitFlash = 0.1;
    this.hitSquash = 0.12;
    this.kx = knockback * 0.12;
    if (this.hp <= 0) {
      this.hp = 0;
      this.setState('dead');
      this.deadTime = 0;
      this.sub = '';
      if (this.world) this.world.callout('REX VANE CAE', 2.4, { y: 96, colors: ['#ffffff', '#ff5a8a', '#6a0030'], glow: '#ff2a55', rim: '#1a0010' });
      return { killed: true };
    }
    if (!this.enraged && this.hp <= this.maxHp * 0.5) {
      this.enraged = true;
      if (this.world) {
        this.world.callout('¡SE ENFURECE!', 1.6, { y: 96, colors: ['#ffffff', '#ff5a8a', '#6a0030'], glow: '#ff2a55', rim: '#1a0010' });
        this.world.flash(0.25, CONFIG.COLORS.RED);
        this.world.shake(8, 0.3);
      }
    }
    return { killed: false };
  }

  // ---------------------------------------------------------------- IA

  update(dt, world) {
    this.world = world;
    this.tickTimers(dt);
    this.hitSquash = Math.max(0, this.hitSquash - dt);
    this.shock = Math.max(0, this.shock - dt);
    this.subTime += dt;
    this.boltFlash += dt;
    const player = world.player;
    const camera = world.camera;
    this.bounds = { left: camera.left + 110, right: camera.right - 110, center: camera.x + CONFIG.WIDTH / 2 };

    switch (this.state) {
      case 'arrive': this.updateArrive(dt, world); break;
      case 'talk': this.hover(); this.faceTo(player); break;
      case 'float': this.updateFloat(dt, world, player); break;
      case 'bolts': this.updateBolts(dt, world, player); break;
      case 'slam': this.updateSlam(dt, world, player); break;
      case 'dead': this.updateDead(dt, world); break;
    }

    this.x += this.kx * dt;
    this.kx *= Math.max(0, 1 - dt * 6);
    if (this.state !== 'arrive' && this.state !== 'dead') {
      this.x = Math.max(camera.left + 60, Math.min(camera.right - 60, this.x));
    }
    this.y = Math.max(CONFIG.GROUND_TOP, Math.min(CONFIG.GROUND_BOTTOM, this.y));
    this.trailGhosts(dt);
  }

  faceTo(player) {
    this.facing = Math.sign(player.x - this.x) || this.facing;
  }

  hover() {
    this.z = RexVane.HOVER + Math.sin(this.age * 3.2) * 6;
  }

  // Cae desde lo alto del cielo, entre humo rojo, y se materializa
  updateArrive(dt, world) {
    this.arriveTime = (this.arriveTime || 0) + dt;
    const t = Math.min(1, this.arriveTime / RexVane.ARRIVE_TIME);
    const eased = 1 - Math.pow(1 - t, 3);
    this.z = RexVane.HOVER + (1 - eased) * 520;
    this.alpha = Math.min(1, t * 1.6);
    this.facing = -1;
    this.fxTimer -= dt;
    if (this.fxTimer <= 0 && t < 1) {
      this.fxTimer = 0.03;
      world.particles.add({
        type: 'puff', x: this.x + (Math.random() - 0.5) * 60, y: this.y - this.z - 60, vx: (Math.random() - 0.5) * 40, vy: -30,
        life: 0.9, size: 26, sizeEnd: 70, color: Math.random() < 0.5 ? '#5a0b1c' : '#1a0a14', additive: false, alpha: 0.5,
      });
      world.particles.add({ type: 'spark', x: this.x + (Math.random() - 0.5) * 50, y: this.y - this.z - 40, vx: (Math.random() - 0.5) * 120, vy: -80, life: 0.3, size: 2.4, color: '#ff4466' });
    }
    if (t >= 1) {
      this.alpha = 1;
      this.setState('talk');
      world.shake(10, 0.4);
      world.flash(0.18, CONFIG.COLORS.RED);
      world.particles.add({ type: 'ring', x: this.x, y: this.y, size: 10, sizeEnd: 190, life: 0.6, color: '#ff2a55', width: 8, flat: 0.28 });
      world.landDust(this.x, this.y, 12);
      world.audio.play('rexLand');
    }
  }

  // Barre la escena de lado a lado con aceleración suave; cada cierto tiempo decide atacar
  updateFloat(dt, world, player) {
    const speed = this.enraged ? 240 : 175;
    const target = this.sweepDir > 0 ? this.bounds.right : this.bounds.left;
    const distance = target - this.x;
    this.sweepSpeed += (Math.sign(distance) * speed - this.sweepSpeed) * Math.min(1, dt * 3);
    this.x += this.sweepSpeed * dt;
    this.facing = Math.sign(this.sweepSpeed) || this.facing;
    if (Math.abs(distance) < 30) this.sweepDir *= -1;
    this.hover();
    // Se mantiene cerca del carril de ECO para que pueda alcanzarlo
    this.y += Math.max(-1, Math.min(1, (player.y - this.y) / 20)) * 70 * dt;

    this.attackTimer -= dt;
    if (this.attackTimer <= 0 && player.isAlive) this.chooseAttack(player);
  }

  // Alterna los dos ataques; el primero siempre son los rayos
  chooseAttack(player) {
    const bolts = this.lastAttack === '' || (this.lastAttack === 'slam' ? Math.random() < 0.7 : Math.random() < 0.3);
    this.lastAttack = bolts ? 'bolts' : 'slam';
    this.setState(bolts ? 'bolts' : 'slam');
    this.sub = bolts ? 'move' : 'dive';
    this.subTime = 0;
    this.hit = false;
    this.sweepSpeed = 0;
    if (!bolts) {
      // Punto de aterrizaje: junto a ECO, del lado que le deja más sitio
      const side = player.x < this.bounds.center ? 1 : -1;
      this.slamFromX = this.x;
      this.slamFromZ = this.z;
      this.diveToX = Math.max(this.bounds.left, Math.min(this.bounds.right, player.x + side * 230));
    }
  }

  endAttack() {
    this.setState('float');
    this.sub = '';
    this.attackTimer = (this.enraged ? 1.1 : 1.7) + Math.random() * 1.1;
    this.sweepDir = Math.random() < 0.5 ? -1 : 1;
    this.sweepSpeed = 0;
  }

  // --- Ataque 1: cuatro rayos verticales ---
  updateBolts(dt, world, player) {
    const chargeTime = this.enraged ? 0.9 : 1.2;
    switch (this.sub) {
      case 'move': {
        // Va al centro de la escena
        const distance = this.bounds.center - this.x;
        this.x += Math.sign(distance) * Math.min(Math.abs(distance), 560 * dt);
        this.facing = Math.sign(distance) || this.facing;
        this.z += (RexVane.HOVER + 16 - this.z) * Math.min(1, dt * 6);
        if (Math.abs(distance) < 6) this.startBoltCharge(world);
        break;
      }
      case 'charge': {
        this.z += (RexVane.HOVER + 16 + Math.sin(this.age * 14) * 3 - this.z) * Math.min(1, dt * 8);
        this.faceTo(player);
        this.chargeFx(dt, world, this.subTime / chargeTime);
        if (this.subTime >= chargeTime) this.dropBolts(world, player);
        break;
      }
      case 'strike':
        if (this.subTime >= 0.5) { this.sub = 'recover'; this.subTime = 0; }
        break;
      case 'recover':
        if (this.subTime >= 0.55) this.endAttack();
        break;
    }
  }

  // Elige dónde caerán los rayos: cuatro columnas repartidas por la escena con huecos entre ellas
  startBoltCharge(world) {
    this.sub = 'charge';
    this.subTime = 0;
    const shift = (Math.random() - 0.5) * 100;
    const spacing = RexVane.BOLT_SPACING;
    this.boltXs = [-1.5, -0.5, 0.5, 1.5].map((k) => this.bounds.center + k * spacing + shift);
    world.audio.play('rexCharge');
  }

  chargeFx(dt, world, progress) {
    this.fxTimer -= dt;
    if (this.fxTimer > 0) return;
    this.fxTimer = 0.05;
    const head = this.headPoint;
    const angle = Math.random() * Math.PI * 2;
    const radius = 70 + Math.random() * 50;
    world.particles.add({
      type: 'spark', x: head.x + Math.cos(angle) * radius, y: head.y + 40 + Math.sin(angle) * radius * 0.8,
      vx: -Math.cos(angle) * radius * 4, vy: -Math.sin(angle) * radius * 3.2, life: 0.22, size: 2.6 + progress * 2,
      color: Math.random() < 0.5 ? '#ff2a55' : '#ffffff',
    });
  }

  // Caen los rayos: daño a quien esté dentro de una columna, a cualquier altura
  dropBolts(world, player) {
    this.sub = 'strike';
    this.subTime = 0;
    this.boltFlash = 0;
    world.audio.play('rexBolt');
    world.shake(11, 0.35);
    world.flash(0.14, '#ff2a55');
    const groundY = (CONFIG.GROUND_TOP + CONFIG.GROUND_BOTTOM) / 2;
    for (const bx of this.boltXs) {
      world.particles.add({ type: 'ring', x: bx, y: groundY, size: 8, sizeEnd: 120, life: 0.45, color: '#ff4466', width: 8, flat: 0.28 });
      world.particles.add({ type: 'ring', x: bx, y: groundY, size: 4, sizeEnd: 70, life: 0.3, color: '#ffffff', width: 4, flat: 0.28 });
      world.particles.burst({ x: bx, y: groundY - 6, count: 14, speed: [160, 520], angle: [-2.8, -0.35], life: [0.25, 0.6], size: [2.4, 4.4], colors: ['#ff4466', '#ffffff', '#ffb0c0'], type: 'spark', drag: 2, gravity: 500 });
      world.landDust(bx, groundY, 5);
      if (player.isAlive && Math.abs(player.x - bx) <= RexVane.BOLT_HALF_WIDTH + 6) {
        player.takeDamage(this.stats.damage, bx, world);
        this.hit = true;
      }
    }
  }

  // --- Ataque 2: baja a tierra y lanza un rayo horizontal ---
  updateSlam(dt, world, player) {
    const windupTime = this.enraged ? 0.75 : 1.0;
    switch (this.sub) {
      case 'dive': {
        // Se lanza en picado hasta un punto junto a ECO, en su carril
        const total = 0.6;
        const t = Math.min(1, this.subTime / total);
        const eased = t * t;
        this.x = this.slamFromX + (this.diveToX - this.slamFromX) * (1 - Math.pow(1 - t, 2));
        this.z = this.slamFromZ * (1 - eased);
        this.y += Math.max(-1, Math.min(1, (player.y - this.y) / 10)) * 260 * dt;
        this.facing = Math.sign(player.x - this.x) || this.facing;
        if (t >= 1) this.touchDown(world);
        break;
      }
      case 'touch':
        if (this.subTime >= 0.16) { this.sub = 'windup'; this.subTime = 0; this.rayFacing = this.facing; world.audio.play('rexCharge'); }
        break;
      case 'windup': {
        // Sigue el carril de ECO al principio y lo fija antes de disparar
        if (this.subTime < windupTime * 0.55) {
          this.y += Math.max(-1, Math.min(1, (player.y - this.y) / 10)) * 200 * dt;
          this.facing = Math.sign(player.x - this.x) || this.facing;
        }
        this.rayFacing = this.facing;
        this.rayY = this.y;
        this.chargeFx(dt, world, this.subTime / windupTime);
        if (this.subTime >= windupTime) this.fireRay(world);
        break;
      }
      case 'strike': {
        this.checkRay(world, player);
        if (this.subTime >= 0.45) { this.sub = 'recover'; this.subTime = 0; }
        break;
      }
      case 'recover':
        if (this.subTime >= 0.4) { this.sub = 'rise'; this.subTime = 0; }
        break;
      case 'rise': {
        const t = Math.min(1, this.subTime / 0.55);
        this.z = (RexVane.HOVER) * t * t;
        if (t >= 1) this.endAttack();
        break;
      }
    }
  }

  touchDown(world) {
    this.sub = 'touch';
    this.subTime = 0;
    this.z = 0;
    world.shake(7, 0.2);
    world.landDust(this.x - 30, this.y, 7);
    world.landDust(this.x + 30, this.y, 7);
    world.particles.add({ type: 'ring', x: this.x, y: this.y, size: 8, sizeEnd: 140, life: 0.4, color: '#ff4466', width: 7, flat: 0.28 });
    world.audio.play('thud');
  }

  // Posición del extremo del bastón y recorrido del rayo
  get rayStartX() { return this.x + this.rayFacing * 96; }

  fireRay(world) {
    this.sub = 'strike';
    this.subTime = 0;
    this.hit = false;
    this.boltFlash = 0;
    world.audio.play('rexRay');
    world.shake(9, 0.4);
    world.flash(0.14, '#ff2a55');
    const y = this.rayY;
    for (let i = 0; i < 3; i++) {
      world.particles.add({ type: 'ring', x: this.rayStartX, y: y - 28, size: 8, sizeEnd: 70 + i * 30, life: 0.3 + i * 0.08, color: i ? '#ff4466' : '#ffffff', width: 6 - i * 2, flat: 0.8 });
    }
  }

  // Alcanza a ECO si está en el carril del rayo y en el suelo; saltando se esquiva
  checkRay(world, player) {
    if (this.hit || !player.isAlive) return;
    const ahead = (player.x - this.rayStartX) * this.rayFacing;
    if (ahead < -20 || ahead > RexVane.RAY_LENGTH) return;
    if (Math.abs(player.y - this.rayY) > 30 || player.z > 38) return;
    this.hit = true;
    player.takeDamage(this.stats.damage - 2, this.rayStartX, world);
  }

  // --- Muerte: se deshace en humo rojo y relámpagos ---
  updateDead(dt, world) {
    this.deadTime += dt;
    this.kx = 0;
    this.z += (RexVane.HOVER + 10 - this.z) * Math.min(1, dt * 3);
    this.fxTimer -= dt;
    if (this.fxTimer <= 0) {
      this.fxTimer = 0.04;
      world.particles.add({
        type: 'puff', x: this.x + (Math.random() - 0.5) * 80, y: this.y - this.z - 20 - Math.random() * 120, vx: (Math.random() - 0.5) * 60, vy: -40 - Math.random() * 40,
        life: 1.1, size: 22, sizeEnd: 80, color: Math.random() < 0.5 ? '#5a0b1c' : '#1a0a14', additive: false, alpha: 0.55,
      });
      world.particles.add({
        type: 'spark', x: this.x + (Math.random() - 0.5) * 70, y: this.y - this.z - Math.random() * 140,
        vx: (Math.random() - 0.5) * 360, vy: -Math.random() * 260, gravity: 500, life: 0.35, size: 2.6, color: Math.random() < 0.5 ? '#ff4466' : '#ffffff',
      });
    }
    if (!this.deathBurst && this.deadTime > 1.1) {
      this.deathBurst = true;
      world.shake(14, 0.5);
      world.flash(0.3, '#ffffff');
      world.audio.play('rexBolt');
      world.particles.add({ type: 'ring', x: this.x, y: this.y - this.z - 60, size: 10, sizeEnd: 260, life: 0.7, color: '#ff4466', width: 10, flat: 0.9 });
      world.particles.burst({ x: this.x, y: this.y - this.z - 70, count: 40, speed: [200, 800], life: [0.3, 0.9], size: [2.5, 5], colors: ['#ff4466', '#ffffff', '#ff2a55'], type: 'spark', drag: 1.8 });
    }
    this.alpha = Math.max(0, 1 - Math.max(0, this.deadTime - 0.6) / (RexVane.DEATH_TIME - 0.6));
  }

  // Imágenes residuales rojas mientras barre la escena o se lanza en picado
  trailGhosts(dt) {
    for (const ghost of this.ghosts) ghost.age += dt;
    this.ghosts = this.ghosts.filter((ghost) => ghost.age < 0.28);
    this.ghostTimer -= dt;
    const fast = Math.abs(this.sweepSpeed) > 120 || (this.state === 'slam' && this.sub === 'dive') || (this.state === 'bolts' && this.sub === 'move');
    const frame = this.currentFrame();
    if (fast && frame && this.ghostTimer <= 0) {
      this.ghostTimer = 0.05;
      this.ghosts.push({ x: this.x, y: this.y, z: this.z, facing: this.facing, age: 0, frame });
    }
  }

  // ---------------------------------------------------------------- dibujo

  // Cuadro ilustrado de la acción actual: { image, height, anchorX, drop }
  currentFrame() {
    const F = RexVane.FRAMES;
    let set = F.fly;
    let number = 1 + (Math.floor(this.age * RexVane.FLY_FPS) % 6);
    if (this.state === 'bolts') {
      if (this.sub === 'charge') { set = F.charge; number = 4 + (Math.floor(this.age * 10) % 3); }
      else if (this.sub === 'strike') { set = F.charge; number = 3; }
      else if (this.sub === 'recover') { set = F.charge; number = this.subTime < 0.28 ? 2 : 1; }
    } else if (this.state === 'slam') {
      set = F.land;
      if (this.sub === 'dive') number = this.subTime < 0.3 ? 1 : 2;
      else if (this.sub === 'touch') number = 3;
      else if (this.sub === 'windup') number = 6;
      else if (this.sub === 'strike') number = 5;
      else if (this.sub === 'recover') number = 4;
      else if (this.sub === 'rise') number = this.subTime < 0.25 ? 2 : 1;
    } else if (this.state === 'dead') {
      set = F.land;
      number = 1;
    }
    const image = Assets.image(`${set.key}${number}`);
    if (!image) return null;
    const height = set.canvas * set.g * set.scales[number - 1];
    return { image, height, anchorX: set.anchor, drop: (1 - set.feet) * height };
  }

  render(ctx) {
    const frame = this.currentFrame();
    if (!frame) return;
    this.drawShadow(ctx);

    // Aura roja que late detrás del cuerpo
    const pulse = 0.55 + 0.25 * Math.sin(this.age * 5);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.3 * pulse * this.alpha;
    const gradient = ctx.createRadialGradient(this.x, this.y - this.z - 80, 6, this.x, this.y - this.z - 80, 120);
    gradient.addColorStop(0, '#ff3355');
    gradient.addColorStop(1, 'rgba(255, 0, 40, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(this.x - 130, this.y - this.z - 210, 260, 260);
    ctx.restore();

    for (const ghost of this.ghosts) {
      Sprite.draw(ctx, ghost.frame.image, {
        x: ghost.x, y: ghost.y - ghost.z, height: ghost.frame.height, anchorX: ghost.frame.anchorX, facing: ghost.facing,
        offsetY: ghost.frame.drop, silhouetteColor: '#ff2a55', additive: true, alpha: 0.35 * (1 - ghost.age / 0.28) * this.alpha,
      });
    }

    const squash = this.hitSquash > 0 ? this.hitSquash / 0.12 : 0;
    const shake = this.state === 'dead' ? (Math.random() - 0.5) * 8 : (this.shock > 0 ? (Math.random() - 0.5) * 6 : 0);
    Sprite.draw(ctx, frame.image, {
      x: this.x, y: this.y - this.z, height: frame.height, anchorX: frame.anchorX, facing: this.facing,
      flash: this.hitFlash > 0, alpha: this.alpha, scaleX: 1 + 0.06 * squash, scaleY: 1 - 0.05 * squash,
      offsetX: shake, offsetY: frame.drop,
      tint: this.shock > 0 ? { color: CONFIG.COLORS.CYAN, alpha: 0.15 + 0.2 * Math.abs(Math.sin(this.age * 50)) } : null,
    });
  }

  // Sin barra sobre la cabeza: el HUD dibuja la barra del jefe arriba
  renderHealthBar() {}

  // Zonas de peligro y rayos: se dibujan bajo los personajes
  renderHazards(ctx) {
    if (this.state === 'bolts') this.renderBolts(ctx);
    if (this.state === 'slam') this.renderRay(ctx);
  }

  renderBolts(ctx) {
    const half = RexVane.BOLT_HALF_WIDTH;
    const bottom = CONFIG.GROUND_BOTTOM + 14;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (this.sub === 'charge') {
      // Aviso: columnas rojas que se intensifican; los huecos entre ellas son la zona segura
      const windup = this.enraged ? 0.9 : 1.2;
      const progress = Math.min(1, this.subTime / windup);
      const blink = 0.7 + 0.3 * Math.sin(this.subTime * (14 + progress * 24));
      for (const bx of this.boltXs) {
        const column = ctx.createLinearGradient(bx - half, 0, bx + half, 0);
        const alpha = (0.2 + 0.5 * progress) * blink;
        column.addColorStop(0, 'rgba(255, 30, 70, 0)');
        column.addColorStop(0.5, `rgba(255, 60, 90, ${alpha})`);
        column.addColorStop(1, 'rgba(255, 30, 70, 0)');
        ctx.fillStyle = column;
        ctx.fillRect(bx - half, 0, half * 2, bottom);
        ctx.strokeStyle = `rgba(255, 140, 165, ${0.6 * blink})`;
        ctx.lineWidth = 3;
        ctx.setLineDash([14, 10]);
        ctx.beginPath();
        ctx.moveTo(bx - half, 0); ctx.lineTo(bx - half, bottom);
        ctx.moveTo(bx + half, 0); ctx.lineTo(bx + half, bottom);
        ctx.stroke();
        ctx.setLineDash([]);
        // Marca en el suelo
        ctx.fillStyle = `rgba(255, 50, 90, ${0.5 * blink * (0.5 + progress)})`;
        ctx.beginPath();
        ctx.ellipse(bx, (CONFIG.GROUND_TOP + CONFIG.GROUND_BOTTOM) / 2, half + 8, 56, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (this.sub === 'strike' && this.boltFlash < 0.38) {
      const fade = 1 - this.boltFlash / 0.38;
      for (const bx of this.boltXs) {
        const glow = ctx.createLinearGradient(bx - half, 0, bx + half, 0);
        glow.addColorStop(0, 'rgba(255, 40, 80, 0)');
        glow.addColorStop(0.5, `rgba(255, 150, 175, ${0.55 * fade})`);
        glow.addColorStop(1, 'rgba(255, 40, 80, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(bx - half, 0, half * 2, bottom);
        this.traceLightning(ctx, bx, -10, bx, (CONFIG.GROUND_TOP + CONFIG.GROUND_BOTTOM) / 2 + 20, 40, 14, fade);
      }
    }
    ctx.restore();
  }

  renderRay(ctx) {
    if (this.sub !== 'windup' && this.sub !== 'strike') return;
    const startX = this.rayStartX;
    const y = this.rayY - 28;
    const endX = startX + this.rayFacing * RexVane.RAY_LENGTH;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (this.sub === 'windup') {
      // Aviso: una línea fina que late sobre el recorrido, y un destello en el extremo del bastón
      const windup = this.enraged ? 0.75 : 1.0;
      const progress = Math.min(1, this.subTime / windup);
      const blink = 0.6 + 0.4 * Math.sin(this.subTime * (16 + progress * 24));
      ctx.strokeStyle = `rgba(255, 70, 100, ${(0.25 + 0.5 * progress) * blink})`;
      ctx.lineWidth = 2 + progress * 6;
      ctx.setLineDash([22, 12]);
      ctx.beginPath();
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
      ctx.stroke();
      ctx.setLineDash([]);
      const glow = Atmosphere.glowSprite('#ff3355');
      const size = 50 + 60 * progress;
      ctx.globalAlpha = 0.5 + 0.4 * progress;
      ctx.drawImage(glow, startX - size / 2, y - size / 2, size, size);
    } else if (this.boltFlash < 0.45) {
      const fade = Math.min(1, (0.45 - this.boltFlash) / 0.2);
      const beam = ctx.createLinearGradient(0, y - 34, 0, y + 34);
      beam.addColorStop(0, 'rgba(255, 40, 80, 0)');
      beam.addColorStop(0.5, `rgba(255, 130, 160, ${0.7 * fade})`);
      beam.addColorStop(1, 'rgba(255, 40, 80, 0)');
      ctx.fillStyle = beam;
      ctx.fillRect(Math.min(startX, endX), y - 34, RexVane.RAY_LENGTH, 68);
      this.traceLightning(ctx, startX, y, endX, y, 12, 40, fade);
      const glow = Atmosphere.glowSprite('#ffffff');
      ctx.globalAlpha = fade;
      ctx.drawImage(glow, startX - 55, y - 55, 110, 110);
    }
    ctx.restore();
  }

  // Línea de relámpago entre dos puntos: núcleo blanco con resplandor rojo y chispas que cambian cada pocos cuadros
  traceLightning(ctx, x0, y0, x1, y1, amplitude, steps, fade) {
    const seed = Math.floor(this.age * 24);
    const random = Draw.seededRandom(seed * 131 + Math.round(x0));
    const length = Math.hypot(x1 - x0, y1 - y0);
    const nx = -(y1 - y0) / length;
    const ny = (x1 - x0) / length;
    const count = Math.max(6, Math.round(length / (length > 700 ? 40 : 34)));
    const points = [];
    for (let i = 0; i <= count; i++) {
      const t = i / count;
      const offset = i === 0 || i === count ? 0 : (random() - 0.5) * 2 * amplitude;
      points.push({ x: x0 + (x1 - x0) * t + nx * offset, y: y0 + (y1 - y0) * t + ny * offset });
    }
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const stroke = (width, color, alpha) => {
      ctx.globalAlpha = alpha * fade;
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      points.forEach((point, i) => (i ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y)));
      ctx.stroke();
    };
    stroke(16, '#ff2a55', 0.35);
    stroke(7, '#ff8aa4', 0.8);
    stroke(2.5, '#ffffff', 1);
    ctx.globalAlpha = 1;
  }
}
