// ECO, el guerrero ciego. Estados: idle → walk → jump → attack → specialAttack → superAttack → hurt → dead
// (más 'block' para la guardia, con retardo de activación).
class Player extends Entity {
  static SPEED = 220;
  static DEPTH_SPEED = 150; // movimiento vertical por el suelo (profundidad)
  static JUMP_VELOCITY = 640;
  static BLOCK_DELAY = 0.08; // casi inmediato: el escudo protege en cuanto se pulsa
  static BLOCK_REDUCTION = 0.15; // fracción del daño que pasa al bloquear
  static BLOCK_GRACE = 0.3; // margen de invulnerabilidad tras parar un golpe (evita que varios golpes seguidos lo traspasen)
  static INVULNERABLE_TIME = 1.3; // tras un golpe, más margen para reaccionar
  static MAX_ENERGY = 100;
  static COMBO_RESET_TIME = 1.5;
  static CHAIN_WINDOW = 0.45; // más tiempo para encadenar el siguiente golpe del combo
  static SPECIAL_COOLDOWN = 1.0;
  static BASE_DAMAGE = 13;
  static SPRITE_HEIGHT = 140; // altura del personaje en pantalla: todas las poses se calibran a este tamaño
  static GHOST_INTERVAL = 0.035;
  static GHOST_LIFE = 0.28;

  // Poses ilustradas. height = altura en pantalla (px), anchorX = posición del torso en la imagen (0-1).
  // Las alturas salen de normalizar el tamaño de la cabeza entre poses (cada una se dibujó a distinta escala).
  // Cuadros de animación (mismo tamaño de lienzo, alineados por el torso)
  // Ciclo de caminar de 4 cuadros: zancada → paso (el cuerpo sube) → estirado (stretch) → zancada. (Se quitó el cuadro agachado.) Se dibuja con su propia escala porque esta hoja trae los personajes más pequeños.
  static WALK_FPS = 10;
  static WALK_FRAMES = 4;
  static WALK_HEIGHT = 147;
  static WALK_ANCHOR = 0.387;
  static FRAME_HEIGHT = 141;
  static FRAME_ANCHOR = { walk: 0.389, hit: 0.398 };
  // Secuencias con efectos: altura = alto del lienzo (px de imagen) × escala. La escala iguala el tamaño del personaje.
  static RAYO_SCALE = 0.406;
  static RAYO_ANCHOR = 0.444;
  static SUPER_SCALE = 0.37;
  static SUPER_ANCHOR = 0.5;
  // Reparto de cuadros en el tiempo (segundos desde el inicio del estado)
  static RAYO_TIMES = [0.10, 0.20, 0.34, 0.48]; // el cuadro 5 dura hasta el final
  // Secuencia mejorada del combo: por cada golpe, [segundo desde el que se muestra, cuadro]
  static COMBO_ANCHOR = 0.349;
  static COMBO_SCALE = 0.435; // el lienzo de los combos mide 337 px de alto y el personaje ~321
  static COMBO_ANIM = [
    [[0, 2], [0.08, 3], [0.22, 4]], // 1: puñetazo (guardia → golpe → recuperación)
    [[0, 5], [0.09, 6]],            // 2: patada baja (rodilla → patada)
    [[0, 4], [0.08, 3], [0.24, 4]], // 3: puño directo
    [[0, 7], [0.12, 8]],            // 4: patada alta con estela
    [[0, 9], [0.09, 10]],           // 5: carga agachado antes del rayo
  ];
  // Rayo mejorado (K): 9 cuadros → carga, esfera de energía, disparo, rayo completo, avance y recuperación
  static RAYO2_TIMES = [0.07, 0.15, 0.29, 0.36, 0.43, 0.60, 0.70, 0.78];
  static RAYO2_SCALE = 0.60;
  static RAYO2_ANCHOR = 0.198;
  // Rayo cargable (K): mantener carga, soltar dispara. Cuanto más carga, más largo, grueso y dañino (con máximo).
  static CHARGE_MAX = 1.3; // segundos de carga hasta el máximo
  static CHARGE_FRAMES = [0.07, 0.15]; // cuadros 1 y 2 de la carga; luego se mantiene el 3
  static FIRE_TIMES = [0.07, 0.14, 0.31, 0.41, 0.49]; // desde soltar: cuadros 5 a 9 (el 4 va primero)
  static FIRE_DELAY = 0.07; // desde soltar hasta que sale el rayo
  static SPECIAL_END = 0.61; // desde soltar hasta recuperar el control
  static BEAM_MIN = 170;
  static BEAM_MAX = 560;
  static SUPER_TIMES = [0.25, 0.38, 0.62, 0.85];

  static SPRITES = {
    idle: { key: 'spriteEco', height: 140, anchorX: 0.5 },
    caminar: { key: 'ecoCaminar', height: 166, anchorX: 0.457 },
    golpe: { key: 'ecoGolpe', height: 140, anchorX: 0.55 },
    rayo: { key: 'ecoRayo', height: 144, anchorX: 0.33 },
    poder: { key: 'ecoPoder', height: 140, anchorX: 0.49 },
  };

  // Combo de 5 golpes: el multiplicador de daño crece con cada eslabón.
  // power: intensidad del efecto (1 ligero, 2 fuerte, 3 final). launch: lanza al enemigo por el aire.
  static ATTACKS = [
    { duration: 0.30, hitStart: 0.08, hitEnd: 0.18, multiplier: 1.0, range: 100, knock: 120, power: 1 },
    { duration: 0.32, hitStart: 0.09, hitEnd: 0.20, multiplier: 1.0, range: 100, knock: 120, power: 1 },
    { duration: 0.34, hitStart: 0.10, hitEnd: 0.20, multiplier: 1.25, range: 106, knock: 150, power: 2 },
    { duration: 0.40, hitStart: 0.12, hitEnd: 0.24, multiplier: 1.5, range: 110, knock: 180, power: 2 },
    { duration: 0.52, hitStart: 0.18, hitEnd: 0.30, multiplier: 2.5, range: 300, knock: 380, power: 3, launch: true },
  ];

  constructor(x) {
    super({ x, y: CONFIG.PLAYER_LANE, w: 50, h: Player.SPRITE_HEIGHT, maxHp: 130 });
    this.energy = 0;
    this.score = 0;
    this.invulnerable = 0;
    this.blockTime = 0;
    this.shieldLevel = 0; // 0 = sin escudo, 1 = completo
    this.shieldFlash = 0; // destello al recibir un golpe
    this.shieldHitSide = 1;
    this.shieldWasActive = false;
    this.attackStep = 0; // eslabón actual (1-5), 0 = ninguno
    this.chainStep = 1; // siguiente eslabón si se pulsa a tiempo
    this.chainTimer = 0;
    this.attackQueued = false;
    this.alreadyHit = new Set();
    this.specialCooldown = 0;
    this.specialFired = false;
    this.chargeTime = 0;
    this.chargeLevel = 0;
    this.releaseTime = -1; // < 0: todavía cargando; >= 0: segundos desde que se soltó K
    this.chargeFullPlayed = false;
    this.chargeTick = 0;
    this.superFired = false;
    this.comboHits = 0;
    this.comboTimer = 0;
    this.stepTimer = 0;
    this.walkTime = 0;
    this.ghostTimer = 0;
    this.ghosts = [];
    this.landSquash = 0;
    this.auraTimer = 0;
    this.world = null;
  }

  get isBlocking() {
    return this.state === 'block' && this.blockTime >= Player.BLOCK_DELAY;
  }

  get energyFull() { return this.energy >= Player.MAX_ENERGY; }

  update(dt, input, world) {
    this.world = world;
    this.tickTimers(dt);
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.chainTimer = Math.max(0, this.chainTimer - dt);
    this.specialCooldown = Math.max(0, this.specialCooldown - dt);
    this.landSquash = Math.max(0, this.landSquash - dt);
    this.updateShield(dt, world);
    this.walkTime = this.state === 'walk' ? this.walkTime + dt : 0;
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.comboHits = 0;
    }

    switch (this.state) {
      case 'dead':
        this.vx = 0;
        break;
      case 'hurt':
        this.vx = 0;
        if (this.stateTime >= 0.3) this.setState('idle');
        break;
      case 'attack':
        this.updateAttack(input, world);
        break;
      case 'specialAttack':
        this.updateSpecial(dt, input, world);
        break;
      case 'superAttack':
        this.updateSuper(world);
        break;
      default:
        this.updateFree(dt, input, world);
    }

    this.integrate(dt);
    this.updateGhosts(dt);
    this.updateAura(dt, world);
  }

  // Movimiento, salto, guardia y disparo de ataques
  updateFree(dt, input, world) {
    const direction = (input.isDown('right') ? 1 : 0) - (input.isDown('left') ? 1 : 0);
    const depth = (input.isDown('down') ? 1 : 0) - (input.isDown('up') ? 1 : 0);

    if (input.isDown('block') && this.onGround) {
      if (this.state !== 'block') this.blockTime = 0;
      this.blockTime += dt;
      this.vx = 0;
      this.setState('block');
      return;
    }

    this.vx = direction * Player.SPEED;
    if (direction !== 0) this.facing = direction;
    // Se puede recorrer todo el suelo disponible, también en el aire
    this.y = Math.max(CONFIG.GROUND_TOP, Math.min(CONFIG.GROUND_BOTTOM, this.y + depth * Player.DEPTH_SPEED * dt));

    if (this.onGround) {
      if (input.justPressed('jump')) {
        this.vz = Player.JUMP_VELOCITY;
        world.landDust(this.x, this.y, 7);
        world.audio.play('jump');
      }
      this.setState(direction !== 0 || depth !== 0 ? 'walk' : 'idle');
    }
    if (!this.onGround) this.setState('jump');

    // Polvo al caminar
    if (this.state === 'walk') {
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) {
        this.stepTimer = 0.17;
        world.landDust(this.x - this.facing * 14, this.y, 2);
        world.audio.play('step');
      }
    }

    if (input.justPressed('attack')) {
      this.startAttack(this.chainTimer > 0 ? this.chainStep : 1);
    } else if (input.justPressed('special') && this.specialCooldown <= 0 && this.onGround) {
      this.startSpecial(world);
    } else if (input.justPressed('super') && this.energyFull && this.onGround) {
      this.startSuper(world);
    }
  }

  onLand() {
    this.landSquash = 0.16;
    if (this.world && this.state !== 'dead') {
      this.world.landDust(this.x, this.y, 9);
      this.world.audio.play('land');
    }
  }

  // --- Ataque básico (combo) ---
  startAttack(step) {
    this.attackStep = step;
    this.attackQueued = false;
    this.alreadyHit = new Set();
    this.finisherBeam = false;
    this.setState('attack');
    this.stateTime = 0; // al encadenar golpes el estado no cambia: se reinicia el reloj a mano
    if (this.onGround) this.vx = 0;
    this.world.audio.play('swing', { step });
  }

  updateAttack(input, world) {
    const attack = Player.ATTACKS[this.attackStep - 1];
    if (this.onGround) this.vx = 0;

    if (input.justPressed('attack') && this.stateTime > attack.duration * 0.35 && this.attackStep < Player.ATTACKS.length) {
      this.attackQueued = true;
    }
    if (this.stateTime >= attack.hitStart && this.stateTime <= attack.hitEnd) {
      this.strike(attack, world);
    }
    // Golpe final: el rayo sale de la guitarra con efectos de haz
    if (this.attackStep >= Player.ATTACKS.length && !this.finisherBeam && this.stateTime >= attack.hitStart) {
      this.finisherBeam = true;
      world.beam({ facing: this.facing, owner: this, dx: 90, dy: -98, length: 300, duration: 0.42, power: 1 });
      world.audio.play('rayMini');
    }
    if (this.stateTime >= attack.duration) {
      if (this.attackQueued) {
        this.startAttack(this.attackStep + 1);
      } else {
        const isFinisher = this.attackStep >= Player.ATTACKS.length;
        this.chainStep = isFinisher ? 1 : this.attackStep + 1;
        this.chainTimer = isFinisher ? 0 : Player.CHAIN_WINDOW;
        this.attackStep = 0;
        this.setState(this.onGround ? 'idle' : 'jump');
      }
    }
  }

  strike(attack, world) {
    const box = Collision.frontBox(this, attack.range);
    const damage = Math.round(Player.BASE_DAMAGE * attack.multiplier);
    for (const enemy of world.enemies) {
      if (!enemy.isAlive || this.alreadyHit.has(enemy)) continue;
      if (!Collision.hitTest(box, enemy)) continue;
      this.alreadyHit.add(enemy);
      this.landHit(enemy, damage, attack.knock, 12, world, { power: attack.power, launch: attack.launch });
    }
  }

  // --- Ataque especial: rayo cargable ---
  startSpecial(world) {
    this.setState('specialAttack');
    this.specialFired = false;
    this.chargeTime = 0;
    this.chargeLevel = 0;
    this.releaseTime = -1;
    this.chargeFullPlayed = false;
    this.chargeTick = 0;
    this.vx = 0;
    world.audio.play('rayCharge');
  }

  // Mientras se mantiene K: carga (0 → 1). Al soltar: dispara un rayo proporcional a la carga.
  updateSpecial(dt, input, world) {
    this.vx = 0;
    if (this.releaseTime < 0) {
      this.chargeTime += dt;
      this.chargeLevel = Math.min(1, this.chargeTime / Player.CHARGE_MAX);
      this.emitCharge(dt, world);
      if (!input.isDown('special')) {
        this.releaseTime = 0;
        world.audio.play('rayRelease', { level: this.chargeLevel });
      }
      return;
    }

    this.releaseTime += dt;
    if (!this.specialFired && this.releaseTime >= Player.FIRE_DELAY) this.fireBeam(world);
    if (this.releaseTime >= Player.SPECIAL_END) {
      this.specialCooldown = Player.SPECIAL_COOLDOWN;
      this.setState('idle');
    }
  }

  // Chispas, aura y sonido de la carga; todo crece con el nivel y al llegar al máximo avisa con un destello
  emitCharge(dt, world) {
    const level = this.chargeLevel;
    const mouthX = this.x + this.facing * 52;
    const mouthY = this.y - this.z - 94;
    const colors = level >= 1 ? ['#ffffff', CONFIG.COLORS.YELLOW, CONFIG.COLORS.CYAN] : [CONFIG.COLORS.CYAN, '#ffffff'];

    // Chispas que convergen en la boca de la guitarra: más y desde más lejos cuanto más carga
    const sparks = 1 + Math.floor(level * 4);
    for (let i = 0; i < sparks; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 60 + level * 90 + Math.random() * 40;
      world.particles.add({
        type: 'spark', x: mouthX + Math.cos(angle) * radius, y: mouthY + Math.sin(angle) * radius * 0.8,
        vx: -Math.cos(angle) * radius * 4.5, vy: -Math.sin(angle) * radius * 3.6,
        life: 0.22, size: 2.4 + level * 2, color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
    // Anillos que se contraen hacia la boca, más seguidos con la carga
    this.chargeTick -= dt;
    if (this.chargeTick <= 0) {
      this.chargeTick = 0.34 - 0.2 * level;
      world.particles.add({ type: 'ring', x: mouthX, y: mouthY, size: 70 + level * 60, sizeEnd: 6, life: 0.3, color: level >= 1 ? CONFIG.COLORS.YELLOW : CONFIG.COLORS.CYAN, width: 3 + level * 3 });
      world.audio.play('chargeTick', { level });
    }
    if (level >= 0.5) world.camera.shake(level * 2.4, 0.06); // vibra cuando ya hay mucha energía

    // Al llegar al máximo: destello, anillo y sonido de "cargado"
    if (level >= 1 && !this.chargeFullPlayed) {
      this.chargeFullPlayed = true;
      world.audio.play('chargeFull');
      world.flash(0.12, '#ffffff');
      world.particles.add({ type: 'ring', x: mouthX, y: mouthY, size: 10, sizeEnd: 150, life: 0.35, color: '#ffffff', width: 8 });
      world.shards(mouthX, mouthY, 12, [CONFIG.COLORS.YELLOW, '#ffffff', CONFIG.COLORS.CYAN]);
    }
  }

  // Dispara el rayo: largo, grosor, daño y efectos dependen de la carga
  fireBeam(world) {
    this.specialFired = true;
    const level = this.chargeLevel;
    const full = level >= 0.97;
    const length = Player.BEAM_MIN + (Player.BEAM_MAX - Player.BEAM_MIN) * level;
    const thickness = 0.4 + 0.95 * level;
    const damage = Math.round(8 + 34 * level);

    world.audio.play(level < 0.4 ? 'rayMini' : 'rayFire');
    world.beam({
      facing: this.facing, owner: this, dx: 46, dy: -94, length, duration: 0.3 + 0.25 * level,
      power: level >= 0.5 ? 2 : 1, thickness, dim: level >= 0.5,
    });
    if (full) {
      world.callout('¡ONDA SÓNICA!', 0.95, { colors: ['#ffffff', CONFIG.COLORS.CYAN, '#005e8a'], glow: CONFIG.COLORS.CYAN, rim: '#00323f' });
      world.slowMo(0.55, 0.2);
    }
    if (level > 0.6) world.flash(0.14, '#ffffff');
    world.shake(3 + 10 * level, 0.15 + 0.2 * level);
    world.camera.punch(0.01 + 0.045 * level);
    world.hitStop(0.02 + 0.04 * level);

    const mouthX = this.x + this.facing * 70;
    world.particles.burst({
      x: mouthX, y: this.y - this.z - 85, count: Math.round(8 + 20 * level), speed: [200, 500 + 300 * level],
      angle: this.facing > 0 ? [-0.5, 0.5] : [Math.PI - 0.5, Math.PI + 0.5], life: [0.2, 0.5], size: [2, 4.5],
      colors: [CONFIG.COLORS.CYAN, CONFIG.COLORS.YELLOW, '#ffffff'], type: 'spark', drag: 2,
    });
    world.particles.add({ type: 'ring', x: mouthX, y: this.y - this.z - 85, size: 8, sizeEnd: 30 + 50 * level, life: 0.3, color: '#ffffff', width: 4 + 4 * level });
    if (level > 0.3) world.shards(this.x + this.facing * 50, this.y - 90, Math.round(4 + 10 * level), [CONFIG.COLORS.CYAN, CONFIG.COLORS.YELLOW, '#ffffff']);

    // El rayo atraviesa a todos los enemigos de su carril; con poca carga solo los empuja
    const box = Collision.frontBox(this, length, length);
    for (const enemy of world.enemies) {
      if (!enemy.isAlive || !Collision.hitTest(box, enemy, 45, 110)) continue;
      this.landHit(enemy, damage, 160 + 170 * level, 2 + Math.round(4 * level), world, {
        power: level < 0.3 ? 2 : 3, launch: level >= 0.3, burst: 0.8 + level,
      });
      enemy.shock = 0.4 + 0.6 * level;
    }
  }

  // --- Super ataque: carga, estallido y onda que limpia la pantalla ---
  startSuper(world) {
    this.setState('superAttack');
    this.superFired = false;
    this.energy = 0;
    this.invulnerable = 1.4;
    this.vx = 0;
    world.cinematic(true);
    world.slowMo(0.35, 0.4);
    world.audio.play('superCharge');
    world.callout('¡FRECUENCIA CERO!', 1.15, { colors: ['#ffffff', CONFIG.COLORS.YELLOW, '#c04a00'], glow: '#ff9a00', rim: '#4a2000' });
  }

  updateSuper(world) {
    this.vx = 0;
    if (!this.superFired) this.emitChargeSparks(world);

    if (!this.superFired && this.stateTime >= 0.25) {
      this.superFired = true;
      world.cinematic(false);
      world.flash(0.45);
      world.shake(22, 0.7);
      world.camera.punch(0.12);
      world.hitStop(0.1);
      world.slowMo(0.35, 0.7);
      world.audio.play('super');

      // Tres ondas de choque planas recorren el suelo
      [CONFIG.COLORS.CYAN, '#ffffff', CONFIG.COLORS.YELLOW].forEach((color, index) => {
        world.particles.add({ type: 'ring', x: this.x, y: this.y, size: 10, sizeEnd: 1100, life: 0.7 + index * 0.12, color, width: 16, flat: 0.28 });
      });
      world.particles.burst({ x: this.x, y: this.y - 70, count: 36, speed: [250, 750], life: [0.4, 0.9], size: [3, 6], colors: [CONFIG.COLORS.CYAN, '#ffffff', CONFIG.COLORS.YELLOW], type: 'spark', drag: 1.5 });
      world.shards(this.x, this.y - 90, 44, [CONFIG.COLORS.CYAN, CONFIG.COLORS.YELLOW, CONFIG.COLORS.PURPLE, '#ffffff'], true);

      for (const enemy of world.enemies) {
        const onScreen = enemy.x > world.camera.left - 40 && enemy.x < world.camera.right + 40;
        if (enemy.isAlive && onScreen) {
          this.landHit(enemy, 70, 520, 0, world, { power: 3, launch: true, direction: Math.sign(enemy.x - this.x) || this.facing });
        }
      }
    }
    if (this.stateTime >= 1.0) this.setState('idle');
  }

  // Chispas que convergen en ECO mientras carga
  emitChargeSparks(world) {
    for (let i = 0; i < 3; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 110 + Math.random() * 60;
      const cx = this.x;
      const cy = this.y - 75;
      world.particles.add({
        type: 'spark', x: cx + Math.cos(angle) * distance, y: cy + Math.sin(angle) * distance * 0.7,
        vx: -Math.cos(angle) * distance * 4, vy: -Math.sin(angle) * distance * 2.8,
        life: 0.25, size: 3, color: Math.random() < 0.5 ? CONFIG.COLORS.CYAN : '#ffffff',
      });
    }
  }

  // Aplica daño, otorga energía/puntos, registra el combo y dispara los efectos del impacto
  landHit(enemy, damage, knock, energyGain, world, options = {}) {
    const { power = 1, launch = false } = options;
    const direction = options.direction ?? this.facing;
    const result = enemy.takeDamage(damage, direction * knock, { launch });

    this.comboHits += 1;
    this.comboTimer = Player.COMBO_RESET_TIME;
    this.energy = Math.min(Player.MAX_ENERGY, this.energy + energyGain);
    this.score += 10 * this.comboHits;

    world.impact({ x: enemy.x, y: enemy.y, z: enemy.z + enemy.h * 0.55, power, direction });
    if (power >= 3) world.starburst(enemy.x, enemy.y, enemy.z + enemy.h * 0.55, options.burst ?? 1);
    world.addText(enemy.x, enemy.y, enemy.z + enemy.h * 0.85, String(damage), {
      color: power >= 3 ? CONFIG.COLORS.YELLOW : '#ffffff', size: 18 + Math.min(18, damage * 0.4),
    });
    if (result.killed) {
      this.score += enemy.scoreValue;
      world.killFx(enemy);
    }
  }

  // Recibe daño de un enemigo situado en fromX
  takeDamage(amount, fromX, world) {
    if (!this.isAlive || this.invulnerable > 0) return;

    const awayFromAttacker = Math.sign(this.x - fromX) || -this.facing;
    const towardAttacker = Math.sign(fromX - this.x) === this.facing;
    if (this.isBlocking) {
      // El escudo es una burbuja: protege de frente y por la espalda
      this.hp -= Math.max(1, Math.round(amount * Player.BLOCK_REDUCTION));
      this.energy = Math.min(Player.MAX_ENERGY, this.energy + 5);
      this.kx = awayFromAttacker * 90;
      this.invulnerable = Math.max(this.invulnerable, Player.BLOCK_GRACE);
      this.shieldFlash = 1;
      this.shieldHitSide = -awayFromAttacker; // el golpe llegó desde el lado contrario al empuje
      const impactX = this.x + this.shieldHitSide * Player.SHIELD.rx;
      world.particles.burst({ x: impactX, y: this.y - this.z - 74, count: 14, speed: [150, 440], angle: this.shieldHitSide > 0 ? [-1.0, 1.0] : [Math.PI - 1.0, Math.PI + 1.0], life: [0.14, 0.34], size: [2, 4.2], colors: [CONFIG.COLORS.CYAN, '#ffffff', '#aef9ff'], type: 'spark', drag: 3 });
      world.particles.add({ type: 'ring', x: impactX, y: this.y - this.z - 74, size: 6, sizeEnd: 52, life: 0.28, color: '#ffffff', width: 6, flat: 0.9 });
      world.addText(this.x + this.shieldHitSide * 30, this.y, this.z + this.h + 6, '¡BLOQUEO!', { color: CONFIG.COLORS.CYAN, size: 20 });
      world.audio.play('block');
      world.shake(3, 0.1);
    } else {
      const heavy = amount >= 14; // martillazos: más empuje y más sacudida
      this.hp -= amount;
      this.hitFlash = 0.15;
      this.invulnerable = Player.INVULNERABLE_TIME;
      this.kx = awayFromAttacker * (heavy ? 420 : 260);
      this.attackStep = 0;
      this.chainTimer = 0;
      this.comboHits = 0;
      this.setState('hurt');
      world.impact({ x: this.x, y: this.y, z: 80, power: 2, direction: awayFromAttacker, color: 'red' });
      world.flash(heavy ? 0.3 : 0.22, CONFIG.COLORS.RED);
      world.shake(heavy ? 15 : 9, heavy ? 0.4 : 0.25);
      if (heavy) {
        world.hitStop(0.08);
        world.camera.punch(0.04);
      }
      world.audio.play('hurt');
    }

    if (this.hp <= 0) {
      this.hp = 0;
      this.setState('dead');
      world.hitStop(0.15);
      world.slowMo(0.3, 0.8);
    }
  }

  // --- Imágenes residuales y aura ---
  updateGhosts(dt) {
    for (const ghost of this.ghosts) ghost.age += dt;
    this.ghosts = this.ghosts.filter((ghost) => ghost.age < Player.GHOST_LIFE);

    const attack = this.state === 'attack' ? Player.ATTACKS[this.attackStep - 1] : null;
    const emitting = (attack && this.stateTime >= attack.hitStart - 0.02 && this.stateTime <= attack.hitEnd + 0.08)
      || this.state === 'specialAttack' || this.state === 'superAttack';
    this.ghostTimer -= dt;
    const sprite = this.currentSprite();
    if (emitting && this.ghostTimer <= 0 && sprite && !sprite.effect) {
      this.ghostTimer = Player.GHOST_INTERVAL;
      this.ghosts.push({
        x: this.x, y: this.y - this.z, facing: this.facing, age: 0, sprite,
        pose: this.computePose(), color: this.state === 'attack' && attack.power >= 3 ? CONFIG.COLORS.YELLOW : CONFIG.COLORS.CYAN,
      });
    }
  }

  // Con la energía llena, ECO emite notas que ascienden
  updateAura(dt, world) {
    if (!this.energyFull || !this.isAlive) return;
    this.auraTimer -= dt;
    if (this.auraTimer <= 0) {
      this.auraTimer = 0.22;
      // Con la energía llena, ECO chisporrotea: esquirlas que suben y arcos eléctricos que saltan por el cuerpo
      world.shards(this.x + (Math.random() - 0.5) * 50, this.y - 60 - Math.random() * 40, 2, [CONFIG.COLORS.CYAN, CONFIG.COLORS.YELLOW, '#ffffff']);
      if (Math.random() < 0.55) world.zap(this.x, this.y - 85, 62);
    }
  }

  // Rayo (K) y super poder: cuadro según el tiempo transcurrido. Devuelve null si no aplica o no cargó.
  effectFrame() {
    if (this.state === 'specialAttack' && Assets.image('ecoRayoB1')) {
      let number;
      if (this.releaseTime < 0) {
        // Carga: cuadros 1 y 2 al empezar y luego se mantiene el 3 (con la esfera de energía)
        number = this.chargeTime < Player.CHARGE_FRAMES[0] ? 1 : (this.chargeTime < Player.CHARGE_FRAMES[1] ? 2 : 3);
      } else {
        // Disparo: cuadro 4 al soltar, luego 5 a 9
        number = 4;
        for (const limit of Player.FIRE_TIMES) if (this.releaseTime >= limit) number += 1;
      }
      const image = Assets.image('ecoRayoB' + number);
      return image ? { image, height: image.height * Player.RAYO2_SCALE, anchorX: Player.RAYO2_ANCHOR, effect: true } : null;
    }

    let prefix = null;
    let times = null;
    let scale = 0;
    let anchorX = 0.5;
    if (this.state === 'specialAttack') {
      [prefix, times, scale, anchorX] = ['ecoRayo', Player.RAYO_TIMES, Player.RAYO_SCALE, Player.RAYO_ANCHOR];
    } else if (this.state === 'superAttack') {
      [prefix, times, scale, anchorX] = ['ecoSuper', Player.SUPER_TIMES, Player.SUPER_SCALE, Player.SUPER_ANCHOR];
    } else {
      return null;
    }
    let index = times.findIndex((limit) => this.stateTime < limit);
    if (index < 0) index = times.length; // último cuadro
    const image = Assets.image(prefix + (index + 1));
    return image ? { image, height: image.height * scale, anchorX, effect: true } : null;
  }

  // Cuadro de la secuencia mejorada del combo según el golpe y el tiempo transcurrido
  comboFrame() {
    const track = Player.COMBO_ANIM[this.attackStep - 1];
    let number = track[0][1];
    for (const [from, frame] of track) if (this.stateTime >= from) number = frame;
    const image = Assets.image('ecoCombo' + number);
    return image ? { image, height: image.height * Player.COMBO_SCALE, anchorX: Player.COMBO_ANCHOR } : null;
  }

  // Cuadro de la secuencia ilustrada que toca ahora, o null para usar las poses sueltas
  currentFrame() {
    // Secuencias con efectos: el rayo del golpe final y el super poder
    const effect = this.effectFrame();
    if (effect) return effect;

    let key = null;
    let anchorX = Player.FRAME_ANCHOR.walk;
    if (this.state === 'walk') {
      key = `ecoCaminar${1 + (Math.floor(this.walkTime * Player.WALK_FPS) % Player.WALK_FRAMES)}`;
      const walkImage = Assets.image(key);
      if (walkImage) return { image: walkImage, height: Player.WALK_HEIGHT, anchorX: Player.WALK_ANCHOR };
    } else if (this.state === 'attack') {
      const attack = Player.ATTACKS[this.attackStep - 1];
      const finisher = this.attackStep >= Player.ATTACKS.length;
      // El golpe final se carga agachado y luego dispara el rayo con la pose suelta
      if (finisher && this.stateTime >= attack.hitStart - 0.02) return null;
      const combo = this.comboFrame();
      if (combo) return combo;
      key = `ecoGolpes${finisher ? 5 : this.attackStep}`;
      anchorX = Player.FRAME_ANCHOR.hit;
    }
    const image = key && Assets.image(key);
    return image ? { image, height: Player.FRAME_HEIGHT, anchorX } : null;
  }

  // Qué ilustración corresponde al estado actual: caminar, puñetazo, rayo de guitarra, poder…
  // Devuelve { image, height, anchorX } o null si ninguna imagen cargó.
  currentSprite() {
    // Animación por cuadros: caminar en bucle y un cuadro por golpe (si las imágenes cargaron)
    const frame = this.currentFrame();
    if (frame) return frame;

    let name = 'idle';
    if (this.state === 'walk') name = 'caminar';
    else if (this.state === 'attack') {
      if (this.attackStep >= Player.ATTACKS.length) name = 'rayo';
      else if (this.attackStep % 2 === 1) name = 'golpe'; // 1 y 3: puñetazo; 2 y 4: guitarrazo
    } else if (this.state === 'specialAttack' || this.state === 'superAttack') name = 'poder';

    const sprite = Player.SPRITES[name];
    const image = Assets.image(sprite.key) || Assets.image(Player.SPRITES.idle.key);
    if (!image) return null;
    const scale = 1;
    return { image, height: (Assets.image(sprite.key) ? sprite.height : Player.SPRITES.idle.height) * scale, anchorX: Assets.image(sprite.key) ? sprite.anchorX : 0.5 };
  }

  // --- Pose procedural sobre el sprite ---
  computePose() {
    const t = this.age;
    const pose = { scaleX: 1, scaleY: 1, rotation: 0, offsetX: 0, offsetY: 0, glow: 0, alpha: 1 };

    switch (this.state) {
      case 'idle':
        pose.scaleY = 1 + Math.sin(t * 3) * 0.012;
        break;
      case 'walk':
        // Una sola ilustración de zancada: rebote, balanceo y compresión simulan el ciclo
        if (!Assets.image('ecoCaminar1')) {
          pose.offsetY = -Math.abs(Math.sin(t * 12)) * 5;
          pose.rotation = 0.03 + Math.sin(t * 6) * 0.03;
          pose.scaleX = 1 + Math.sin(t * 12) * 0.03;
        }
        break;
      case 'jump':
        pose.scaleX = 0.97;
        pose.scaleY = 1.05;
        pose.rotation = 0.06;
        break;
      case 'block':
        pose.scaleY = 0.93;
        pose.rotation = -0.06;
        break;
      case 'hurt':
        pose.rotation = -0.22;
        pose.scaleX = 0.94;
        pose.scaleY = 1.05;
        break;
      case 'attack':
        this.poseAttack(pose);
        if (Assets.image('ecoCombo1') || Assets.image('ecoGolpes1')) { // los cuadros ya traen la pose: solo un toque de impulso
          pose.rotation *= 0.3;
          pose.offsetX *= 0.5;
          pose.scaleX = 1 + (pose.scaleX - 1) * 0.5;
        }
        break;
      case 'specialAttack': {
        // La cúpula de energía del dibujo estalla hacia fuera y se desvanece
        const progress = Math.min(1, this.stateTime / 0.45);
        const grow = 0.82 + 0.18 * Math.min(1, this.stateTime / 0.12);
        pose.scaleX = grow;
        pose.scaleY = grow;
        pose.alpha = 1 - Math.max(0, (progress - 0.65) / 0.35);
        pose.glow = 1.2;
        break;
      }
      case 'superAttack': {
        const charge = Math.min(1, this.stateTime / 0.25);
        const afterBurst = this.superFired ? Math.sin(Math.min(1, (this.stateTime - 0.25) / 0.75) * Math.PI) : 0;
        pose.scaleY = 1 + 0.06 * charge + 0.04 * afterBurst;
        pose.scaleX = 1 - 0.04 * charge + 0.06 * afterBurst;
        pose.rotation = -0.08 * charge;
        pose.offsetY = -6 * charge;
        pose.glow = 2 + charge;
        break;
      }
      case 'dead':
        pose.rotation = -(Math.PI / 2) * Math.min(1, this.stateTime * 4);
        break;
    }

    // Aplastamiento al aterrizar y brillo con la energía llena
    if (this.landSquash > 0) {
      const s = this.landSquash / 0.16;
      pose.scaleX *= 1 + 0.14 * s;
      pose.scaleY *= 1 - 0.12 * s;
    }
    if (this.energyFull && this.state !== 'superAttack') pose.glow = Math.max(pose.glow, 0.6 + Math.sin(t * 8) * 0.3);
    return pose;
  }

  // Retroceso antes del golpe, embestida durante el impacto y recuperación
  poseAttack(pose) {
    const attack = Player.ATTACKS[this.attackStep - 1];
    const time = this.stateTime;
    if (time < attack.hitStart) {
      pose.rotation = -0.14 * (time / attack.hitStart);
    } else if (time <= attack.hitEnd) {
      const progress = (time - attack.hitStart) / (attack.hitEnd - attack.hitStart);
      pose.rotation = -0.14 + 0.38 * progress;
      pose.offsetX = 16 * progress;
      pose.scaleX = 1.04;
    } else {
      const progress = Math.min(1, (time - attack.hitEnd) / (attack.duration - attack.hitEnd));
      pose.rotation = 0.24 - 0.19 * progress;
      pose.offsetX = 16 * (1 - progress);
    }
    pose.glow = attack.power >= 3 ? 1.5 : 0.4;
  }

  // --- Dibujo: sprite ilustrado; si no cargó, formas geométricas de respaldo ---
  render(ctx) {
    this.drawShadow(ctx);
    const sprite = this.currentSprite();
    if (sprite) this.renderGhosts(ctx);

    const flicker = this.invulnerable > 0 && this.state !== 'superAttack' && Math.floor(this.age * 20) % 2 === 0;
    if (flicker && this.isAlive) return;

    if (sprite) {
      this.renderSprite(ctx, sprite);
      return;
    }
    this.renderGeometric(ctx);
  }

  renderGhosts(ctx) {
    for (const ghost of this.ghosts) {
      const fade = 1 - ghost.age / Player.GHOST_LIFE;
      Sprite.draw(ctx, ghost.sprite.image, {
        x: ghost.x, y: ghost.y, height: ghost.sprite.height, anchorX: ghost.sprite.anchorX, facing: ghost.facing,
        ...ghost.pose, offsetX: ghost.pose.offsetX * ghost.facing, glow: 0,
        silhouetteColor: ghost.color, additive: true, alpha: 0.45 * fade * ghost.pose.alpha,
      });
    }
  }

  renderSprite(ctx, sprite) {
    // Las secuencias de efectos ya traen toda la pose dibujada: sin deformaciones procedurales
    const pose = sprite.effect ? { scaleX: 1, scaleY: 1, rotation: 0, offsetX: 0, offsetY: 0, glow: 0, alpha: 1 } : this.computePose();
    Sprite.draw(ctx, sprite.image, {
      x: this.x,
      y: this.y - this.z,
      height: sprite.height,
      anchorX: sprite.anchorX,
      facing: this.facing,
      flash: this.hitFlash > 0,
      ...pose,
      offsetX: pose.offsetX * this.facing,
    });

    if (this.state === 'attack') {
      const finisher = this.attackStep >= Player.ATTACKS.length;
      if (finisher) { if (!sprite.effect) this.renderLightning(ctx); }
      else if (this.attackStep % 2 === 0 && !Assets.image('ecoCombo1')) this.renderSwing(ctx); // las patadas ya traen su estela
    }
    this.renderShield(ctx);
    if (this.state === 'specialAttack' && this.releaseTime < 0) this.renderChargeAura(ctx);
  }

  // Aura de energía alrededor de ECO y medidor de carga sobre su cabeza
  renderChargeAura(ctx) {
    const level = this.chargeLevel;
    const cx = this.x + this.facing * 52;
    const cy = this.y - this.z - 94;
    const radius = 24 + level * 70 + Math.sin(this.age * 30) * 3 * level;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const gradient = ctx.createRadialGradient(cx, cy, 2, cx, cy, radius);
    gradient.addColorStop(0, level >= 1 ? 'rgba(255, 255, 220, 0.85)' : 'rgba(210, 255, 255, 0.75)');
    gradient.addColorStop(0.4, level >= 1 ? 'rgba(255, 220, 90, 0.4)' : 'rgba(0, 235, 255, 0.35)');
    gradient.addColorStop(1, 'rgba(0, 245, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Medidor: barra inclinada que se llena y parpadea en dorado al llegar al máximo
    const barW = 78;
    const barX = this.x - barW / 2;
    const barY = this.screenTop - 22;
    const full = level >= 1;
    ctx.save();
    Draw.parallelogram(ctx, barX - 3, barY - 3, barW + 6, 12, 4);
    ctx.fillStyle = '#000';
    ctx.fill();
    Draw.parallelogram(ctx, barX, barY, barW, 6, 3);
    ctx.fillStyle = '#10141f';
    ctx.fill();
    ctx.clip();
    const fillColor = full ? (Math.floor(this.age * 14) % 2 ? '#ffffff' : CONFIG.COLORS.YELLOW) : (level > 0.6 ? CONFIG.COLORS.YELLOW : CONFIG.COLORS.CYAN);
    ctx.fillStyle = fillColor;
    ctx.shadowColor = fillColor;
    ctx.shadowBlur = 8;
    ctx.fillRect(barX, barY, barW * level, 6);
    ctx.restore();
    if (full) Draw.rock(ctx, '¡MAX!', this.x, barY - 6, { size: 15, align: 'center', colors: ['#ffffff', CONFIG.COLORS.YELLOW, '#d06000'], outlineWidth: 4 });
  }

  // Relámpago procedural que continúa el rayo de la guitarra en el golpe final
  renderLightning(ctx) {
    const attack = Player.ATTACKS[this.attackStep - 1];
    const time = this.stateTime;
    if (time < attack.hitStart - 0.03 || time > attack.hitEnd + 0.12) return;

    const fade = Math.min(1, (attack.hitEnd + 0.12 - time) / 0.12);
    const originX = this.x + this.facing * 90;
    const originY = this.y - this.z - 98;
    const seed = Math.floor(this.age * 30); // titila ~30 veces por segundo
    const random = Draw.seededRandom(seed * 7919 + 13);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = fade;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const bolt = (length, width, color, jitter) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(originX, originY);
      let x = originX;
      let y = originY;
      for (let travelled = 0; travelled < length; travelled += 26) {
        x += this.facing * 26;
        y += (random() - 0.5) * jitter - 2.2; // sube ligeramente, como en el dibujo
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    };
    bolt(190, 11, 'rgba(0, 245, 255, 0.45)', 34);
    bolt(190, 4, '#ffffff', 34);
    bolt(150, 5, CONFIG.COLORS.YELLOW, 46);
    bolt(120, 3, CONFIG.COLORS.CYAN, 52);
    ctx.restore();
  }

  // Media luna que acompaña al golpe de guitarra (amarilla y mayor en el golpe final)
  renderSwing(ctx) {
    const attack = Player.ATTACKS[this.attackStep - 1];
    if (this.stateTime < attack.hitStart || this.stateTime > attack.hitEnd + 0.08) return;

    const progress = (this.stateTime - attack.hitStart) / (attack.hitEnd + 0.08 - attack.hitStart);
    const finisher = this.attackStep >= Player.ATTACKS.length;
    ctx.save();
    ctx.globalAlpha = 1 - progress;
    ctx.translate(this.x + this.facing * 40, this.y - this.z - Player.SPRITE_HEIGHT * 0.5);
    ctx.scale(this.facing, 1);
    ctx.lineCap = 'round';
    const radius = (finisher ? 74 : 54) + progress * 26;
    ctx.strokeStyle = CONFIG.COLORS.OUTLINE;
    ctx.lineWidth = finisher ? 18 : 12;
    ctx.beginPath();
    ctx.arc(0, 0, radius, -1.25, 1.25);
    ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = finisher ? CONFIG.COLORS.YELLOW : CONFIG.COLORS.CYAN;
    ctx.lineWidth = finisher ? 10 : 6;
    ctx.beginPath();
    ctx.arc(0, 0, radius, -1.25, 1.25);
    ctx.stroke();
    ctx.restore();
  }

  renderGeometric(ctx) {
    const left = this.x - this.w / 2;
    const top = this.screenTop;
    const bodyColor = this.hitFlash > 0 ? '#ffffff' : CONFIG.COLORS.CYAN;

    ctx.save();
    if (this.state === 'dead') {
      const fall = Math.min(1, this.stateTime * 4);
      ctx.translate(this.x, this.y);
      ctx.rotate(-this.facing * (Math.PI / 2) * fall);
      ctx.translate(-this.x, -this.y);
    }
    Draw.outlinedRect(ctx, left, top + 26, this.w, this.h - 26, bodyColor);
    Draw.outlinedRect(ctx, left + 6, top, this.w - 12, 30, '#16163a');
    ctx.fillStyle = CONFIG.COLORS.CYAN;
    ctx.fillRect(left + 4, top + 11, this.w - 8, 7);
    this.renderShield(ctx);
    ctx.restore();
  }

  // Anima el escudo: crece al bloquear, se desvanece al soltar, y avisa cuando empieza a proteger
  updateShield(dt, world) {
    const target = this.state === 'block' ? 1 : 0;
    this.shieldLevel += (target - this.shieldLevel) * Math.min(1, dt * (target ? 16 : 10));
    if (target === 0 && this.shieldLevel < 0.02) this.shieldLevel = 0;
    this.shieldFlash = Math.max(0, this.shieldFlash - dt * 3.2);
    const active = this.isBlocking;
    if (active && !this.shieldWasActive && world) {
      world.audio.play('shieldOn');
      this.shieldFlash = Math.max(this.shieldFlash, 0.5);
      world.particles.add({ type: 'ring', x: this.x, y: this.y - this.z - Player.SHIELD.cy, size: 20, sizeEnd: 90, life: 0.3, color: CONFIG.COLORS.CYAN, width: 5 });
    }
    this.shieldWasActive = active;
  }

  // --- Escudo de energía: burbuja translúcida con malla hexagonal y borde brillante ---
  static SHIELD = { rx: 64, ry: 92, cy: 74 }; // semiejes de la burbuja y altura de su centro sobre los pies

  // Textura del escudo, pintada una sola vez (dibujarla con recortes cada fotograma saldría caro)
  static shieldTexture() {
    if (Player.shieldCanvas) return Player.shieldCanvas;
    const { rx, ry } = Player.SHIELD;
    const pad = 16;
    const canvas = document.createElement('canvas');
    canvas.width = (rx + pad) * 2;
    canvas.height = (ry + pad) * 2;
    const c = canvas.getContext('2d');
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    // Cuerpo: casi transparente en el centro y más intenso hacia el borde (efecto "fresnel" de una esfera de cristal)
    c.save();
    c.translate(cx, cy);
    c.scale(rx, ry);
    const body = c.createRadialGradient(0, 0, 0.05, 0, 0, 1);
    body.addColorStop(0, 'rgba(0, 245, 255, 0.03)');
    body.addColorStop(0.6, 'rgba(0, 220, 255, 0.10)');
    body.addColorStop(0.9, 'rgba(110, 255, 255, 0.34)');
    body.addColorStop(1, 'rgba(210, 255, 255, 0.55)');
    c.fillStyle = body;
    c.beginPath();
    c.arc(0, 0, 1, 0, Math.PI * 2);
    c.fill();
    c.restore();

    // Malla hexagonal dentro de la burbuja
    c.save();
    c.beginPath();
    c.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    c.clip();
    c.strokeStyle = 'rgba(170, 255, 255, 0.30)';
    c.lineWidth = 1.2;
    const r = 15;
    const dx = r * Math.sqrt(3);
    for (let row = -8; row <= 8; row++) {
      for (let col = -6; col <= 6; col++) {
        const hx = cx + col * dx + (row % 2 ? dx / 2 : 0);
        const hy = cy + row * r * 1.5;
        c.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = Math.PI / 6 + (k * Math.PI) / 3;
          const px = hx + r * 0.94 * Math.cos(a);
          const py = hy + r * 0.94 * Math.sin(a);
          if (k === 0) c.moveTo(px, py); else c.lineTo(px, py);
        }
        c.closePath();
        c.stroke();
      }
    }
    // Reflejo de luz en la parte superior izquierda
    const shine = c.createLinearGradient(cx - rx, cy - ry, cx + rx * 0.2, cy + ry * 0.2);
    shine.addColorStop(0, 'rgba(255, 255, 255, 0.34)');
    shine.addColorStop(0.35, 'rgba(255, 255, 255, 0.08)');
    shine.addColorStop(1, 'rgba(255, 255, 255, 0)');
    c.fillStyle = shine;
    c.fillRect(0, 0, canvas.width, canvas.height);
    c.restore();

    // Borde brillante con resplandor
    c.shadowColor = '#00f5ff';
    c.shadowBlur = 12;
    c.strokeStyle = 'rgba(200, 255, 255, 0.95)';
    c.lineWidth = 3;
    c.beginPath();
    c.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    c.stroke();
    Player.shieldCanvas = canvas;
    return canvas;
  }

  // El escudo aparece al mantener el botón de bloqueo y reacciona a cada golpe parado
  renderShield(ctx) {
    const level = this.shieldLevel;
    if (level < 0.02) return;
    const { cy } = Player.SHIELD;
    const texture = Player.shieldTexture();
    const centerX = this.x;
    const centerY = this.y - this.z - cy;
    const active = this.isBlocking;
    const flash = this.shieldFlash;
    const scale = (0.55 + 0.45 * level) * (1 + 0.018 * Math.sin(this.age * 13) + flash * 0.07);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // Brillo en el suelo bajo el escudo
    ctx.globalAlpha = level * (0.25 + flash * 0.3);
    ctx.fillStyle = CONFIG.COLORS.CYAN;
    ctx.beginPath();
    ctx.ellipse(this.x, this.y, 56 * level, 13 * level, 0, 0, Math.PI * 2);
    ctx.fill();

    // La burbuja: tenue mientras se está formando, más firme cuando ya protege, y más viva al recibir un golpe
    ctx.globalAlpha = Math.min(1, level * (active ? 0.82 : 0.4) + flash * 0.55);
    ctx.translate(centerX, centerY);
    ctx.scale(scale, scale);
    ctx.drawImage(texture, -texture.width / 2, -texture.height / 2);
    if (flash > 0.05) {
      // Destello blanco de la superficie y onda en el punto del impacto
      ctx.globalAlpha = flash * 0.55;
      ctx.drawImage(texture, -texture.width / 2, -texture.height / 2);
      const { rx, ry } = Player.SHIELD;
      const angle = this.shieldHitSide > 0 ? 0 : Math.PI;
      ctx.globalAlpha = Math.min(1, flash * 1.4);
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 6 * flash + 1;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, angle - 0.7, angle + 0.7);
      ctx.stroke();
      ctx.strokeStyle = CONFIG.COLORS.CYAN;
      ctx.lineWidth = 12 * flash + 2;
      ctx.globalAlpha = flash * 0.5;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, angle - 0.9, angle + 0.9);
      ctx.stroke();
    }
    ctx.restore();
  }

}
