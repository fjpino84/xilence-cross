// EL TRINO: compañero mecánico alado. Orbita alrededor de ECO y, cada cierto tiempo, carga y dispara
// un proyectil sónico que atraviesa a los enemigos en su carril.
class Trino {
  static HEIGHT = 58;
  static FRAME_HEIGHT = 40; // alto del lienzo de los cuadros de vuelo (el cuerpo mide ~1/3)
  // El ojo es el punto fijo de los cuadros: ahí se centra la posición y el giro
  static EYE_X = 0.611;
  static EYE_Y = 0.649;
  // Órbita elíptica alrededor del torso de ECO
  static ORBIT_RX = 105;
  static ORBIT_RY = 36;
  static ORBIT_SPEED = 2.3; // rad/s
  static ORBIT_CENTER_Y = 100; // altura del centro de la órbita sobre los pies de ECO
  static FOLLOW_RATE = 10;
  static FLAP_FPS = 14;
  static FLAP_FPS_CHARGING = 24;
  static FIRST_COOLDOWN = 2.2;
  static COOLDOWN = 4.8;
  static CHARGE_TIME = 0.85;
  static RECOIL_TIME = 0.4;
  static HOVER_HEIGHT = 175;
  static TARGET_RANGE = 650;

  constructor(player) {
    this.player = player;
    this.x = player.x - 40;
    this.y = player.y - 120;
    this.facing = 1;
    this.angle = Math.PI; // posición en la órbita
    this.vx = 0;
    this.vy = 0;
    this.trailTimer = 0;
    this.age = 0;
    this.pulse = 0; // brillo extra cuando ECO ataca
    this.state = 'follow'; // follow → charge → recoil
    this.stateTime = 0;
    this.cooldown = Trino.FIRST_COOLDOWN;
    this.cooldownTotal = Trino.FIRST_COOLDOWN;
    this.aimDirection = 1;
    this.target = null;
    this.noteTimer = 0;
    this.recoilKick = 0;
  }

  // 0 = recién disparado, 1 = listo para atacar
  get readiness() {
    if (this.state === 'charge') return 1;
    return 1 - Math.max(0, this.cooldown) / this.cooldownTotal;
  }

  update(dt, world) {
    this.age += dt;
    this.stateTime += dt;
    const player = this.player;
    const reacting = ['attack', 'specialAttack', 'superAttack'].includes(player.state);
    this.pulse = reacting ? 1 : Math.max(0, this.pulse - dt * 3);

    this.angle += Trino.ORBIT_SPEED * dt; // la órbita nunca se detiene: al volver del disparo retoma su fase
    const [previousX, previousY] = [this.x, this.y];

    switch (this.state) {
      case 'charge':
        this.updateCharge(dt, world);
        break;
      case 'recoil':
        this.updateRecoil(dt);
        break;
      default:
        this.updateFollow(dt, world);
    }

    // Velocidad real (suavizada): orienta el vuelo y deja una estela del propulsor
    if (dt > 0) {
      const blend = Math.min(1, dt * 12);
      this.vx += ((this.x - previousX) / dt - this.vx) * blend;
      this.vy += ((this.y - previousY) / dt - this.vy) * blend;
    }
    this.trailTimer -= dt;
    if (this.trailTimer <= 0 && Math.hypot(this.vx, this.vy) > 40) {
      this.trailTimer = 0.035;
      world.particles.add({
        type: 'dot', x: this.x - this.facing * 22, y: this.y + 20, vx: -this.facing * 25, vy: 18,
        life: 0.32, size: 3.2, sizeEnd: 0, color: Math.random() < 0.3 ? CONFIG.COLORS.YELLOW : CONFIG.COLORS.CYAN,
      });
    }
  }

  // Profundidad para ordenar con ECO: pasa por delante al bajar en la órbita y por detrás al subir
  get sortY() {
    return this.player.y + Math.sin(this.angle) * 10;
  }

  updateFollow(dt, world) {
    const player = this.player;
    const targetX = player.x + Math.cos(this.angle) * Trino.ORBIT_RX;
    const targetY = player.y - player.z - Trino.ORBIT_CENTER_Y + Math.sin(this.angle) * Trino.ORBIT_RY + Math.sin(this.age * 5) * 4;
    const follow = 1 - Math.exp(-dt * Trino.FOLLOW_RATE);
    this.x += (targetX - this.x) * follow;
    this.y += (targetY - this.y) * follow;
    // Mira hacia donde vuela (con umbral para no parpadear en los extremos de la órbita)
    if (Math.abs(this.vx) > 45) this.facing = Math.sign(this.vx);

    this.cooldown -= dt;
    if (this.cooldown <= 0 && player.isAlive) {
      const target = this.findTarget(world);
      if (target) this.beginCharge(target, world);
    }
  }

  // Enemigo vivo más cercano, dentro de la pantalla y del alcance
  findTarget(world) {
    let best = null;
    let bestDistance = Trino.TARGET_RANGE;
    for (const enemy of world.enemies) {
      if (!enemy.isAlive) continue;
      const onScreen = enemy.x > world.camera.left + 20 && enemy.x < world.camera.right - 20;
      const distance = Math.abs(enemy.x - this.player.x);
      if (onScreen && distance < bestDistance) {
        best = enemy;
        bestDistance = distance;
      }
    }
    return best;
  }

  beginCharge(target, world) {
    this.state = 'charge';
    this.stateTime = 0;
    this.target = target;
    this.aimDirection = Math.sign(target.x - this.player.x) || this.player.facing;
    this.noteTimer = 0;
    world.audio.play('trinoCharge');
  }

  // Se eleva, apunta y acumula energía con notas que convergen
  updateCharge(dt, world) {
    const player = this.player;
    const progress = Math.min(1, this.stateTime / Trino.CHARGE_TIME);
    const targetX = player.x + this.aimDirection * 50;
    const targetY = player.y - player.z - Trino.ORBIT_CENTER_Y - 45 - 25 * progress + Math.sin(this.age * 25) * 2 * progress;
    const follow = 1 - Math.exp(-dt * 7);
    this.x += (targetX - this.x) * follow;
    this.y += (targetY - this.y) * follow;
    this.facing = this.aimDirection;

    this.noteTimer -= dt;
    if (this.noteTimer <= 0) {
      this.noteTimer = 0.07;
      const angle = Math.random() * Math.PI * 2;
      const radius = 70 + Math.random() * 40;
      world.particles.add({
        type: 'spark',
        x: this.x + Math.cos(angle) * radius, y: this.y + Math.sin(angle) * radius,
        vx: -Math.cos(angle) * radius * 4, vy: -Math.sin(angle) * radius * 4,
        life: 0.25, size: 2.5, color: Math.random() < 0.5 ? CONFIG.COLORS.CYAN : '#9dfff0',
      });
    }

    if (this.stateTime >= Trino.CHARGE_TIME) this.fire(world);
  }

  fire(world) {
    const direction = this.aimDirection;
    // El proyectil viaja por el carril del objetivo (o el de ECO si ya cayó)
    const lane = this.target && this.target.isAlive ? this.target.y : this.player.y;
    // El rayo sale del ojo: x,y del ojo en pantalla; "height" es su altura sobre el carril donde golpea
    const eyeX = this.x + direction * 6;
    world.projectiles.push({
      x: eyeX, y: lane, height: lane - this.y, direction, speed: 820, travelled: 0, range: 1000,
      damage: 18, hit: new Set(), age: 0,
    });

    world.particles.burst({ x: eyeX + direction * 4, y: this.y, count: 14, speed: [150, 500], angle: direction > 0 ? [-0.6, 0.6] : [Math.PI - 0.6, Math.PI + 0.6], life: [0.15, 0.35], size: [2, 4], colors: [CONFIG.COLORS.CYAN, '#ffffff'], type: 'spark', drag: 2 });
    world.particles.add({ type: 'ring', x: eyeX + direction * 4, y: this.y, size: 8, sizeEnd: 46, life: 0.3, color: '#ffffff', width: 6 });
    world.audio.play('trinoFire');
    world.shake(4, 0.15);

    this.state = 'recoil';
    this.stateTime = 0;
    this.recoilKick = -direction;
    this.cooldownTotal = Trino.COOLDOWN;
    this.cooldown = Trino.COOLDOWN;
  }

  // Retroceso del disparo y regreso al hombro
  updateRecoil(dt) {
    this.x += this.recoilKick * (1 - this.stateTime / Trino.RECOIL_TIME) * 160 * dt;
    if (this.stateTime >= Trino.RECOIL_TIME) {
      this.state = 'follow';
      this.stateTime = 0;
    }
  }

  // Aleteo: ciclo de 5 cuadros, más rápido al cargar el disparo
  currentFrame() {
    const fps = this.state === 'charge' ? Trino.FLAP_FPS_CHARGING : Trino.FLAP_FPS;
    const image = Assets.image(`trinoVuelo${1 + (Math.floor(this.age * fps) % 5)}`);
    return image ? { image } : null;
  }

  render(ctx) {
    const frames = this.currentFrame();
    const image = frames ? frames.image : Assets.image('spriteTrino');
    if (!image) return;

    const charging = this.state === 'charge' ? Math.min(1, this.stateTime / Trino.CHARGE_TIME) : 0;
    const recoil = this.state === 'recoil' ? 1 - this.stateTime / Trino.RECOIL_TIME : 0;
    const base = frames ? Trino.FRAME_HEIGHT : Trino.HEIGHT;
    // Más grande al pasar por delante de ECO y más pequeño por detrás: refuerza la órbita
    const depth = this.state === 'follow' ? Math.sin(this.angle) : 0;
    const height = base * (1 + this.pulse * 0.12 + charging * 0.35 + depth * 0.1);

    // Aura cian que crece al cargar
    if (charging > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const radius = 30 + charging * 46;
      const gradient = ctx.createRadialGradient(this.x, this.y, 4, this.x, this.y, radius);
      gradient.addColorStop(0, `rgba(180, 255, 245, ${0.35 + 0.4 * charging})`);
      gradient.addColorStop(1, 'rgba(0, 245, 255, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(this.x, this.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    const eyeFromBottom = frames ? height * (1 - Trino.EYE_Y) : -height * 0.5;
    Sprite.draw(ctx, image, {
      x: this.x, y: this.y + eyeFromBottom, height, facing: this.facing, anchorX: frames ? Trino.EYE_X : 0.5,
      pivot: frames ? eyeFromBottom : 0,
      // Se inclina según su velocidad vertical (morro arriba al subir)
      rotation: Math.max(-0.3, Math.min(0.3, this.vy * 0.001)) - 0.25 * recoil + Math.sin(this.age * 30) * 0.05 * charging,
      scaleX: 1 + 0.15 * recoil,
      glow: this.pulse + charging * 2,
    });
  }
}
