// Silenciador: infantería pesada del ejército del silencio. Tres variantes; de momento solo se usa la 2 (el Martillo),
// que tiene animación por cuadros, ataques con embestida, combos encadenados y efectos propios.
class Silenciador extends Enemy {
  static SPRITE_HEIGHT = 165;

  // Animación por cuadros de la variante 2. g = px de juego por px del lienzo: cada hoja se dibujó a otra escala.
  // feet = fracción de altura donde están los pies; anchor = fracción horizontal del centro del cuerpo.
  static FRAMES2 = {
    walk: { key: 'adv2Walk', count: 4, canvas: 303, g: 0.50, feet: 0.9967, anchor: 0.5187 },
    slam: { key: 'adv2Slam', count: 6, canvas: 352, g: 0.58, feet: 0.9710, anchor: 0.5190 },
    spin: { key: 'adv2Spin', count: 8, canvas: 280, g: 0.42, feet: 0.9893, anchor: 0.4590 },
    hurt: { key: 'adv2Hurt', count: 6, canvas: 306, g: 0.50, feet: 0.9908, anchor: 0.4959 },
  };
  static WALK_FPS = 9;
  static SIZE2 = 1.2; // tamaño del Martillo respecto a la calibración de las hojas; ECO mide ~140 px y el Martillo ~165
  static GHOST_LIFE = 0.3;

  // Cuadro de cada ataque según la fase y su avance (0-1): [desde, nº de cuadro].
  // El martillazo cae en el cuadro 5 justo al empezar la fase de golpe.
  static SLAM_TRACK = {
    windup: [[0, 1], [0.30, 2], [0.66, 3], [0.91, 4]],
    strike: [[0, 5]],
    recovery: [[0, 5], [0.30, 6]],
  };
  static SPIN_TRACK = {
    windup: [[0, 1], [0.43, 3]],
    strike: [[0, 4]],
    recovery: [[0, 6], [0.27, 2], [0.52, 5], [0.77, 7], [0.90, 8]],
  };

  static VARIANTS = Object.freeze({
    // 1 — Garra: equilibrado
    1: Object.freeze({
      hp: 45, speed: 85, patrolSpeed: 40, patrolRange: 120, aggroRange: 420,
      attackRange: 90, damage: 10, windup: 0.5, strike: 0.12, recovery: 0.45, cooldown: 1.2, scoreValue: 100,
    }),
    // 2 — Martillo: pesado y agresivo; embiste al golpear y puede encadenar martillazo y giro
    2: Object.freeze({
      hp: 46, speed: 70, patrolSpeed: 34, patrolRange: 100, aggroRange: 460,
      attackRange: 118, damage: 10, windup: 0.68, strike: 0.14, recovery: 0.55, cooldown: 1.9, scoreValue: 180,
    }),
    // 3 — Disco: rápido y frágil
    3: Object.freeze({
      hp: 38, speed: 110, patrolSpeed: 55, patrolRange: 160, aggroRange: 420,
      attackRange: 85, damage: 8, windup: 0.38, strike: 0.1, recovery: 0.35, cooldown: 0.9, scoreValue: 120,
    }),
  });

  constructor(x, y, aggressive = false, variant = 1) {
    const scale = variant === 2 ? Silenciador.SIZE2 : 1;
    super({ x, y, w: 60 * scale, h: Silenciador.SPRITE_HEIGHT * scale, stats: Silenciador.VARIANTS[variant], aggressive });
    this.variant = variant;
    this.sizeScale = scale; // los efectos (aura, torbellino, chispas) se escalan con el personaje
    this.ghosts = [];
    this.ghostTimer = 0;
    this.fxTimer = 0;
    this.swingPlayed = false;
    this.lastStepIndex = -1;
  }

  // La variante 2 alterna martillazo y giro
  chooseAttackKind() {
    this.swingPlayed = false;
    return this.variant === 2 && Assets.image('adv2Spin1') && Math.random() < 0.45 ? 'spin' : 'slam';
  }

  // --- Dinamismo del ataque ---

  // Embestida: recula un poco al cargar y se lanza sobre ECO al soltar el golpe
  attackDrift(phase, progress) {
    if (this.variant !== 2) return 0;
    const dir = this.facing;
    if (this.attackKind === 'slam') {
      if (phase === 'windup') {
        if (progress < 0.3) return -dir * 25;
        return progress > 0.55 ? dir * 250 * (0.4 + (progress - 0.55) / 0.45) : 0;
      }
      return phase === 'strike' ? dir * 150 : 0;
    }
    if (phase === 'windup') return progress > 0.4 ? -dir * 40 : 0; // el giro se enrolla hacia atrás
    if (phase === 'strike') return dir * 200;
    return phase === 'recovery' && progress < 0.6 ? dir * 140 * (1 - progress / 0.6) : 0;
  }

  // Encadena el otro ataque sin pausa si ECO sigue al alcance (el segundo golpe carga más rápido)
  nextAttack(player, world) {
    if (this.variant !== 2 || this.chained || !player.isAlive) return false;
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    if (Math.abs(dx) > this.stats.attackRange + 90 || Math.abs(dy) > 26) return false;
    if (Math.random() > (this.attackKind === 'slam' ? 0.22 : 0.12)) return false; // el combo de dos golpes es poco frecuente

    this.chained = true;
    this.attackKind = this.attackKind === 'slam' ? 'spin' : 'slam';
    this.windupScale = 0.6;
    this.facing = Math.sign(dx) || this.facing;
    this.stateTime = 0;
    this.phase = 'windup';
    this.struck = false;
    this.swingPlayed = false;
    world.audio.play('enemyWarn');
    return true;
  }

  // --- Efectos por fotograma ---
  afterUpdate(dt, world) {
    if (this.variant !== 2) return;

    // Imágenes residuales mientras embiste
    for (const ghost of this.ghosts) ghost.age += dt;
    this.ghosts = this.ghosts.filter((ghost) => ghost.age < Silenciador.GHOST_LIFE);
    this.ghostTimer -= dt;
    const frame = this.currentFrame();
    if (this.state === 'attack' && Math.abs(this.vx) > 120 && frame && this.ghostTimer <= 0) {
      this.ghostTimer = 0.04;
      this.ghosts.push({ x: this.x, y: this.y, facing: this.facing, age: 0, frame });
    }

    if (this.state === 'attack') {
      const { phase, progress } = this.attackPhase();
      if (phase === 'windup') this.windupFx(dt, world, progress);
      if (this.attackKind === 'slam' && !this.swingPlayed && phase === 'windup' && progress > 0.78) {
        this.swingPlayed = true;
        world.audio.play('enemySwing'); // el martillo cortando el aire antes de caer
      }
      if (this.attackKind === 'spin' && (phase === 'strike' || (phase === 'recovery' && progress < 0.6))) this.spinFx(dt, world);
    }

    // Pasos pesados: polvo, temblor leve y golpe sordo cuando apoya el pie
    if ((this.state === 'chase' || this.state === 'patrol') && Math.abs(this.vx) > 5) {
      const index = Math.floor(this.age * Silenciador.WALK_FPS) % 4;
      if (index !== this.lastStepIndex) {
        this.lastStepIndex = index;
        if (index === 0 || index === 2) world.enemyStep(this);
      }
    }

    // Descarga eléctrica tras recibir un rayo
    if (this.shock > 0 && this.isAlive) {
      for (let i = 0; i < 2; i++) {
        const angle = Math.random() * Math.PI * 2;
        world.particles.add({
          type: 'spark', x: this.x + (Math.random() - 0.5) * 50 * this.sizeScale, y: this.y - this.z - 20 - Math.random() * 100 * this.sizeScale,
          vx: Math.cos(angle) * 220, vy: Math.sin(angle) * 220 - 60, life: 0.16, size: 2.4,
          color: Math.random() < 0.5 ? CONFIG.COLORS.CYAN : '#ffffff',
        });
      }
    }
  }

  // Posición aproximada del martillo al cargar el golpe (sobre la cabeza, o recogido al costado en el giro)
  hammerSpot() {
    const slam = this.attackKind === 'slam';
    const k = this.sizeScale;
    return { x: this.x + this.facing * (slam ? 6 : -50) * k, y: this.y - this.z - (slam ? 138 : 55) * k };
  }

  // Chispas que convergen en el martillo y se hacen más densas hasta el golpe
  windupFx(dt, world, progress) {
    this.fxTimer -= dt;
    if (this.fxTimer > 0) return;
    this.fxTimer = 0.045;
    const spot = this.hammerSpot();
    const colors = [CONFIG.COLORS.PURPLE, CONFIG.COLORS.CYAN, '#ffffff', '#c9a6ff'];
    const count = 1 + Math.floor(progress * 3);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 55 + Math.random() * 60;
      world.particles.add({
        type: 'spark', x: spot.x + Math.cos(angle) * radius, y: spot.y + Math.sin(angle) * radius * 0.8,
        vx: -Math.cos(angle) * radius * 4.5, vy: -Math.sin(angle) * radius * 3.6,
        life: 0.22, size: 2.6, color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
  }

  // Torbellino del giro: polvo en círculo a ras de suelo y estelas de colores a la altura del martillo
  spinFx(dt, world) {
    this.fxTimer -= dt;
    if (this.fxTimer > 0) return;
    this.fxTimer = 0.03;
    const angle = this.age * 16;
    const colors = [CONFIG.COLORS.PURPLE, CONFIG.COLORS.CYAN, '#ffffff'];
    world.particles.add({
      type: 'smoke', x: this.x + Math.cos(angle) * 72 * this.sizeScale, y: this.y - 4 + Math.sin(angle) * 17 * this.sizeScale,
      vx: -Math.sin(angle) * 90, vy: -12, life: 0.45, size: 6, sizeEnd: 20, color: '#a8a4c8', additive: false,
    });
    const back = angle + Math.PI;
    world.particles.add({
      type: 'spark', x: this.x + Math.cos(back) * 96 * this.sizeScale, y: this.y - 62 * this.sizeScale + Math.sin(back) * 15,
      vx: -Math.sin(back) * 420, vy: Math.cos(back) * 90, life: 0.2, size: 3, color: colors[Math.floor(Math.random() * colors.length)],
    });
  }

  // Cuadro ilustrado que toca ahora (solo variante 2): { image, height, anchorX, drop, neutral }.
  // neutral = el dibujo ya trae la pose: no se aplican las deformaciones por código.
  currentFrame() {
    if (this.variant !== 2) return null;
    const F = Silenciador.FRAMES2;
    const pick = (set, number, neutral = true) => {
      const image = Assets.image(`${set.key}${number}`);
      const height = set.canvas * set.g * Silenciador.SIZE2;
      return image ? { image, height, anchorX: set.anchor, drop: (1 - set.feet) * height, neutral } : null;
    };

    switch (this.state) {
      case 'patrol':
      case 'chase':
        return pick(F.walk, Math.abs(this.vx) > 5 ? 1 + (Math.floor(this.age * Silenciador.WALK_FPS) % F.walk.count) : 1);
      case 'attack': {
        const spin = this.attackKind === 'spin';
        const table = (spin ? Silenciador.SPIN_TRACK : Silenciador.SLAM_TRACK);
        const { phase, progress } = this.attackPhase();
        let number = table[phase][0][1];
        for (const [from, frame] of table[phase]) if (progress >= from) number = frame;
        return pick(spin ? F.spin : F.slam, number);
      }
      case 'stagger':
        return pick(F.hurt, this.stateTime < 0.12 ? 1 : (this.stateTime < 0.24 ? 2 : 3));
      case 'launched':
        return pick(F.hurt, 1, false);
      case 'down': {
        // Tendido un momento; después se incorpora con los cuadros de recuperación
        if (this.stateTime < 0.26) return pick(F.walk, 1, false);
        const rise = Math.min(1, (this.stateTime - 0.26) / 0.34);
        const frame = pick(F.hurt, 3 + Math.min(3, Math.floor(rise * 4)));
        if (frame && this.stateTime < 0.36) frame.neutral = false; // gira desde el suelo en los primeros instantes
        return frame;
      }
      case 'dead':
        return pick(F.hurt, 1, false);
      default:
        return null;
    }
  }

  render(ctx) {
    const frame = this.currentFrame();
    const image = frame ? frame.image : Assets.image(`spriteAdversario${this.variant}`);
    if (!image) {
      this.renderGeometric(ctx);
      return;
    }

    const alpha = this.state === 'dead' ? Math.max(0, 1 - this.deadTime / Enemy.DEATH_FADE_TIME) : 1;
    this.drawShadow(ctx);
    if (this.isTelegraphing) this.renderDangerZone(ctx);
    this.renderGhosts(ctx);

    const pose = this.computePose();
    if (frame && frame.neutral) {
      // El dibujo ya trae la pose: solo se conserva el golpe de aplastamiento al recibir daño
      Object.assign(pose, { scaleX: 1, scaleY: 1, rotation: 0, offsetX: 0, offsetY: 0, pivot: 0 });
      if (this.hitSquash > 0) {
        const squash = this.hitSquash / 0.14;
        pose.scaleX = 1 + 0.12 * squash;
        pose.scaleY = 1 - 0.1 * squash;
      }
    }

    // Tinte: electrocutado (cian parpadeante) o aviso de golpe (rojo tenue); además tiembla al recibir la descarga
    let tint = null;
    let jitter = 0;
    if (this.shock > 0) {
      tint = { color: CONFIG.COLORS.CYAN, alpha: 0.1 + 0.2 * Math.abs(Math.sin(this.age * 50)) };
      jitter = (Math.random() - 0.5) * 7;
    } else if (this.isTelegraphing) {
      tint = { color: CONFIG.COLORS.RED, alpha: 0.05 + 0.13 * Math.abs(Math.sin(this.age * 18)) };
    }

    Sprite.draw(ctx, image, {
      x: this.x,
      y: this.y - this.z,
      height: frame ? frame.height : Silenciador.SPRITE_HEIGHT,
      anchorX: frame ? frame.anchorX : 0.5,
      facing: this.facing,
      flash: this.hitFlash > 0,
      alpha,
      tint,
      ...pose,
      offsetX: pose.offsetX * this.facing + jitter,
      offsetY: pose.offsetY + (frame ? frame.drop : 0),
    });

    if (this.isTelegraphing) {
      this.renderChargeGlow(ctx);
      const pop = 1 + Math.max(0, 0.5 - this.stateTime * 3);
      Draw.text(ctx, '!', this.x, this.screenTop - 6, { size: 38 * pop, color: CONFIG.COLORS.YELLOW, align: 'center' });
    }
    this.renderHealthBar(ctx);
  }

  // Imágenes residuales moradas durante la embestida
  renderGhosts(ctx) {
    for (const ghost of this.ghosts) {
      const { frame } = ghost;
      Sprite.draw(ctx, frame.image, {
        x: ghost.x, y: ghost.y, height: frame.height, anchorX: frame.anchorX, facing: ghost.facing,
        offsetY: frame.drop, silhouetteColor: '#a066ff', additive: true, alpha: 0.4 * (1 - ghost.age / Silenciador.GHOST_LIFE),
      });
    }
  }

  // Orbe de energía que crece sobre el martillo mientras carga el golpe
  renderChargeGlow(ctx) {
    if (this.variant !== 2) return;
    const { progress } = this.attackPhase();
    const spot = this.hammerSpot();
    const radius = 14 + 40 * progress;
    const gradient = ctx.createRadialGradient(spot.x, spot.y, 2, spot.x, spot.y, radius);
    gradient.addColorStop(0, `rgba(235, 220, 255, ${0.5 + 0.3 * progress})`);
    gradient.addColorStop(0.45, `rgba(150, 90, 255, ${0.3 + 0.2 * progress})`);
    gradient.addColorStop(1, 'rgba(0, 245, 255, 0)');
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(spot.x, spot.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Zona roja en el suelo que se llena: indica dónde caerá el golpe
  renderDangerZone(ctx) {
    const progress = Math.min(1, this.stateTime / this.windupTime);
    const spin = this.attackKind === 'spin';
    const reach = this.stats.attackRange + (spin ? 30 : 0);
    const cx = spin ? this.x : this.x + this.facing * reach * 0.45;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(255, 0, 60, ${0.1 + 0.22 * progress})`;
    ctx.beginPath();
    ctx.ellipse(cx, this.y, reach * (spin ? 1 : 0.75), 20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(255, 60, 90, ${0.35 + 0.5 * progress})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(cx, this.y, reach * (spin ? 1 : 0.75) * progress, 20 * progress, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Pose según estado: paso, retroceso → embestida al atacar, tambaleo, vuelo y caída
  computePose() {
    const pose = { scaleX: 1, scaleY: 1, rotation: 0, offsetX: 0, offsetY: 0, pivot: 0 };
    const windup = this.windupTime;
    const { strike, recovery } = this.stats;

    switch (this.state) {
      case 'patrol':
      case 'chase':
        if (Math.abs(this.vx) > 5) {
          pose.offsetY = -Math.abs(Math.sin(this.age * 8)) * 5;
          pose.rotation = 0.04;
        } else {
          pose.scaleY = 1 + Math.sin(this.age * 2.5) * 0.012;
        }
        break;
      case 'attack':
        if (this.stateTime < windup) {
          const charge = this.stateTime / windup;
          pose.rotation = -0.2 * charge;
          pose.scaleY = 1 + 0.04 * charge;
          pose.offsetY = -3 * Math.sin(charge * Math.PI); // se encoge y se agazapa
        } else if (this.stateTime < windup + strike) {
          pose.rotation = 0.32;
          pose.offsetX = 24;
          pose.scaleX = 1.08;
          pose.scaleY = 0.96;
        } else {
          const progress = Math.min(1, (this.stateTime - windup - strike) / recovery);
          pose.rotation = 0.32 - 0.27 * progress;
          pose.offsetX = 24 * (1 - progress);
        }
        break;
      case 'stagger':
        pose.rotation = -0.18;
        pose.scaleY = 0.96;
        break;
      case 'launched':
        pose.rotation = -this.spinAngle;
        pose.pivot = this.h * 0.4; // gira alrededor del torso, no de los pies
        break;
      case 'down': {
        const lying = -1.45;
        const getUp = Math.max(0, (this.stateTime - (Enemy.DOWN_TIME - 0.25)) / 0.25);
        pose.rotation = lying * (1 - getUp);
        pose.scaleY = 0.9;
        break;
      }
      case 'dead':
        pose.rotation = this.z > 0 ? -this.spinAngle : -1.45;
        if (this.z > 0) pose.pivot = this.h * 0.4;
        break;
    }

    // Aplastamiento y estiramiento al recibir el golpe
    if (this.hitSquash > 0) {
      const s = this.hitSquash / 0.14;
      pose.scaleX *= 1 + 0.18 * s;
      pose.scaleY *= 1 - 0.14 * s;
    }
    return pose;
  }

  // Respaldo geométrico si el sprite no carga
  renderGeometric(ctx) {
    ctx.save();
    if (this.state === 'dead') ctx.globalAlpha = Math.max(0, 1 - this.deadTime / Enemy.DEATH_FADE_TIME);
    this.drawShadow(ctx);

    const left = this.x - this.w / 2;
    const top = this.screenTop;
    const bodyColor = this.hitFlash > 0 ? '#ffffff' : CONFIG.COLORS.RED;
    Draw.outlinedRect(ctx, left, top + 40, this.w, this.h - 40, bodyColor);
    Draw.outlinedRect(ctx, left + 6, top, this.w - 12, 44, '#1a0008');
    ctx.fillStyle = CONFIG.COLORS.RED;
    ctx.fillRect(this.facing > 0 ? left + 26 : left + 8, top + 18, 22, 6);

    if (this.isTelegraphing) {
      Draw.text(ctx, '!', this.x, top - 8, { size: 34, color: CONFIG.COLORS.YELLOW, align: 'center' });
    }
    ctx.restore();
    this.renderHealthBar(ctx);
  }
}

