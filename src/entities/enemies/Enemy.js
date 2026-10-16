// Base de enemigos con IA: patrol → chase → attack, con stagger al recibir daño.
// Un golpe fuerte los lanza por el aire (launched) y caen al suelo (down) antes de levantarse.
// Las subclases definen `stats` y el método render().
class Enemy extends Entity {
  static LANE_SPEED = 70;
  static STAGGER_TIME = 0.35;
  static DEATH_FADE_TIME = 1.0;
  static STAGGER_IMMUNITY_TIME = 1.0; // desde el inicio del aturdimiento
  static HEAVY_KNOCKBACK = 250; // golpe final, onda sónica y super rompen la resistencia
  static LAUNCH_VELOCITY = 380;
  static DOWN_TIME = 0.6;
  static SPIN_SPEED = 12;

  constructor({ x, y, w, h, stats, aggressive = false }) {
    super({ x, y, w, h, maxHp: stats.hp });
    this.stats = stats;
    this.scoreValue = stats.scoreValue;
    this.state = aggressive ? 'chase' : 'patrol';
    this.phase = 'windup'; // fase interna del ataque: windup → strike → recovery
    this.struck = false;
    this.attackCooldown = Math.random() * 0.8;
    this.patrolOrigin = x;
    this.patrolDirection = Math.random() < 0.5 ? -1 : 1;
    this.patrolPause = 0;
    this.deadTime = 0;
    this.staggerImmunity = 0;
    this.hitSquash = 0;
    this.spinAngle = 0;
    this.groundedAfterDeath = false;
    this.attackKind = 'slam'; // 'slam' (golpe al frente) o 'spin' (giro que alcanza a ambos lados)
    this.windupScale = 1; // el segundo golpe de un combo carga más rápido
    this.rushing = false; // entra corriendo y ataca en cuanto llega
    this.rushTime = 0;
    this.elite = false;
    this.chained = false;
    this.shock = 0; // segundos que le quedan de electrocución por un rayo
    this.world = null;
  }

  // Entra corriendo desde fuera de la pantalla y ataca nada más llegar junto a ECO
  startRush() {
    this.rushing = true;
    this.rushTime = 0;
    this.attackCooldown = 0;
    this.state = 'chase';
  }

  get removable() { return !this.isAlive && this.deadTime >= Enemy.DEATH_FADE_TIME; }
  get isTelegraphing() { return this.state === 'attack' && this.phase === 'windup'; }
  get windupTime() { return this.stats.windup * this.windupScale; }

  update(dt, world) {
    this.world = world;
    this.tickTimers(dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.staggerImmunity = Math.max(0, this.staggerImmunity - dt);
    this.hitSquash = Math.max(0, this.hitSquash - dt);
    const player = world.player;

    switch (this.state) {
      case 'dead':
        this.deadTime += dt;
        this.vx = 0;
        if (this.z > 0) this.spinAngle += dt * Enemy.SPIN_SPEED;
        break;
      case 'launched':
        this.vx = 0;
        this.spinAngle += dt * Enemy.SPIN_SPEED;
        break;
      case 'down':
        this.vx = 0;
        if (this.stateTime >= Enemy.DOWN_TIME) {
          this.staggerImmunity = 0.7;
          this.setState('chase');
        }
        break;
      case 'stagger':
        this.vx = 0;
        if (this.stateTime >= Enemy.STAGGER_TIME) this.setState('chase');
        break;
      case 'patrol':
        this.updatePatrol(dt, player);
        break;
      case 'chase':
        this.updateChase(dt, player, world);
        break;
      case 'attack':
        this.updateAttack(player, world, dt);
        break;
    }

    this.integrate(dt);
    this.y = Math.max(CONFIG.GROUND_TOP, Math.min(CONFIG.GROUND_BOTTOM, this.y));
    this.shock = Math.max(0, this.shock - dt);
    this.afterUpdate(dt, world);
  }

  // Al tocar el suelo tras ser lanzado: polvo, golpe seco y a levantarse
  onLand() {
    if (!this.world) return;
    if (this.state === 'launched') {
      this.setState('down');
      this.world.thud(this);
    } else if (this.state === 'dead' && !this.groundedAfterDeath) {
      this.groundedAfterDeath = true;
      this.world.thud(this);
    }
  }

  // Camina de un lado a otro cerca de su origen hasta ver a ECO
  updatePatrol(dt, player) {
    if (player.isAlive && Math.abs(player.x - this.x) < this.stats.aggroRange) {
      this.setState('chase');
      return;
    }
    if (this.patrolPause > 0) {
      this.patrolPause -= dt;
      this.vx = 0;
      return;
    }
    this.vx = this.patrolDirection * this.stats.patrolSpeed;
    this.facing = this.patrolDirection;
    if (Math.abs(this.x - this.patrolOrigin) > this.stats.patrolRange) {
      this.patrolDirection = this.x > this.patrolOrigin ? -1 : 1;
      this.patrolPause = 0.8 + Math.random() * 0.8;
    }
  }

  // Persigue a ECO, se alinea en el carril y ataca cuando hay hueco libre
  updateChase(dt, player, world) {
    if (!player.isAlive) {
      this.vx = 0;
      return;
    }
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    this.facing = Math.sign(dx) || this.facing;

    const rush = this.rushing;
    this.y += Math.max(-1, Math.min(1, dy / 6)) * Enemy.LANE_SPEED * (rush ? 2.8 : 1) * dt;
    this.vx = Math.abs(dx) > this.stats.attackRange * 0.9 ? Math.sign(dx) * this.stats.speed * (rush ? 2.5 : 1) : 0;

    if (rush) {
      // Al llegar a distancia de golpe, ataca de inmediato (con un aviso corto) sin esperar turno
      this.rushTime += dt;
      if (Math.abs(dx) <= this.stats.attackRange * 1.4 && Math.abs(dy) <= 28) {
        this.rushing = false;
        this.startAttack(world);
        this.windupScale = 0.7;
        return;
      }
      if (this.rushTime > 4.5) this.rushing = false;
      return;
    }

    const inRange = Math.abs(dx) <= this.stats.attackRange && Math.abs(dy) <= 18;
    if (inRange && this.attackCooldown <= 0 && world.requestAttackSlot(this)) this.startAttack(world);
  }

  // Las subclases pueden elegir otro tipo de ataque antes de empezar
  chooseAttackKind() { return 'slam'; }

  // Ganchos para las subclases: embestida durante el ataque, combos encadenados y efectos por fotograma
  attackDrift(phase, progress) { return 0; }
  nextAttack(player, world) { return false; }
  afterUpdate(dt, world) {}

  startAttack(world) {
    this.attackKind = this.chooseAttackKind();
    this.windupScale = 1;
    this.chained = false;
    this.setState('attack');
    this.phase = 'windup';
    this.struck = false;
    this.vx = 0;
    world.audio.play('enemyWarn');
  }

  // Fase del ataque y su avance (0-1): carga → golpe → recuperación
  attackPhase() {
    const windup = this.windupTime;
    const { strike, recovery } = this.stats;
    if (this.stateTime < windup) return { phase: 'windup', progress: this.stateTime / windup };
    if (this.stateTime < windup + strike) return { phase: 'strike', progress: (this.stateTime - windup) / strike };
    return { phase: 'recovery', progress: Math.min(1, (this.stateTime - windup - strike) / this.stats.recovery) };
  }

  updateAttack(player, world, dt) {
    const windup = this.windupTime;
    const { strike, recovery } = this.stats;
    const { phase, progress } = this.attackPhase();

    // Mientras carga el golpe sigue corrigiendo su carril hacia ECO
    if (phase === 'windup') this.y += Math.max(-1, Math.min(1, (player.y - this.y) / 6)) * Enemy.LANE_SPEED * 0.6 * dt;

    // Embestida: se desplaza durante el ataque, pero sin atravesar a ECO
    let drift = this.attackDrift(phase, progress);
    if (Math.abs(player.x - this.x) < 55 && Math.sign(drift) === Math.sign(player.x - this.x)) drift = 0;
    this.vx = drift;

    if (phase === 'windup') {
      this.phase = 'windup';
    } else if (phase === 'strike') {
      this.phase = 'strike';
      if (!this.struck) {
        this.struck = true;
        world.enemyStrike(this);
        const reach = this.stats.attackRange + (this.attackKind === 'spin' ? 30 : 10);
        const front = Collision.frontBox(this, reach);
        const back = this.attackKind === 'spin' ? Collision.frontBox({ ...this, facing: -this.facing }, reach) : null;
        if (Collision.hitTest(front, player, 30, 60) || (back && Collision.hitTest(back, player, 30, 60))) {
          player.takeDamage(this.stats.damage, this.x, world);
        }
      }
    } else if (this.stateTime < windup + strike + recovery) {
      this.phase = 'recovery';
    } else {
      this.attackCooldown = this.stats.cooldown;
      if (this.nextAttack(player, world)) return; // encadena otro golpe sin pausa
      this.setState('chase');
    }
  }

  // opts.launch lanza al enemigo por el aire. Devuelve { killed } para que ECO sume puntos.
  takeDamage(amount, knockback, opts = {}) {
    if (!this.isAlive) return { killed: false };
    this.hp -= amount;
    this.hitFlash = 0.12;
    this.hitSquash = 0.14;

    if (this.hp <= 0) {
      this.hp = 0;
      this.kx = knockback * 1.1;
      this.vz = Math.max(this.vz, 320);
      this.spinAngle = 0;
      this.setState('dead');
      return { killed: true };
    }

    // Golpeado en el aire: se le mantiene arriba ("juggle")
    if (this.state === 'launched') {
      this.vz = Math.max(this.vz, 0) + 150;
      this.kx = knockback * 0.5;
      return { killed: false };
    }

    if (opts.launch) {
      this.setState('launched');
      this.vz = Enemy.LAUNCH_VELOCITY;
      this.kx = knockback * 1.2;
      this.spinAngle = 0;
      this.staggerImmunity = Enemy.STAGGER_IMMUNITY_TIME;
      return { killed: false };
    }

    // Tras un aturdimiento resiste los golpes ligeros: evita encadenarlos sin fin
    const heavy = Math.abs(knockback) >= Enemy.HEAVY_KNOCKBACK;
    if (this.staggerImmunity > 0 && !heavy) {
      this.kx = knockback * 0.3;
      return { killed: false };
    }
    this.kx = knockback;
    this.staggerImmunity = Enemy.STAGGER_IMMUNITY_TIME;
    this.setState('stagger');
    return { killed: false };
  }

  // Barra de vida sobre la cabeza (solo si está herido)
  renderHealthBar(ctx) {
    if (!this.isAlive || (this.hp >= this.maxHp && !this.elite)) return;
    // Los élites llevan una barra más ancha, siempre visible, con su etiqueta
    const width = this.elite ? 100 : 48;
    Draw.bar(ctx, this.x - width / 2, this.screenTop - 14, width, this.elite ? 11 : 8, this.hp / this.maxHp, CONFIG.COLORS.RED);
    if (this.elite) {
      Draw.rock(ctx, 'ÉLITE', this.x, this.screenTop - 20, { size: 14, align: 'center', colors: ['#ffffff', '#ff5a8a', '#6a0030'], outlineWidth: 4, tracking: 2 });
    }
  }
}
