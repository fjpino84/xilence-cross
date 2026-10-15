// Base de toda entidad. Coordenadas de mundo: x (centro), y (profundidad en el suelo), z (altura sobre el suelo).
class Entity {
  constructor({ x, y, w, h, maxHp }) {
    this.x = x;
    this.y = y;
    this.z = 0;
    this.vx = 0; // velocidad intencional
    this.vz = 0;
    this.kx = 0; // empuje por retroceso (decae solo)
    this.w = w;
    this.h = h;
    this.facing = 1;
    this.maxHp = maxHp;
    this.hp = maxHp;
    this.state = 'idle';
    this.stateTime = 0;
    this.hitFlash = 0;
    this.age = 0;
  }

  get isAlive() { return this.hp > 0; }
  get onGround() { return this.z <= 0 && this.vz <= 0; }

  setState(state) {
    if (this.state === state) return;
    this.state = state;
    this.stateTime = 0;
  }

  // Avanza relojes comunes
  tickTimers(dt) {
    this.age += dt;
    this.stateTime += dt;
    this.hitFlash = Math.max(0, this.hitFlash - dt);
  }

  // Gravedad y desplazamiento
  integrate(dt) {
    if (this.z > 0 || this.vz > 0) {
      this.vz -= CONFIG.GRAVITY * dt;
      this.z += this.vz * dt;
      if (this.z <= 0) {
        this.z = 0;
        this.vz = 0;
        this.onLand();
      }
    }
    this.x += (this.vx + this.kx) * dt;
    // En el aire el empuje se conserva más: los lanzados vuelan lejos
    this.kx *= Math.max(0, 1 - dt * (this.z > 0 ? 1.5 : 8));
  }

  // Gancho para subclases: se llama al tocar el suelo
  onLand() {}

  drawShadow(ctx) {
    const scale = Math.max(0.4, 1 - this.z / 300);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.ellipse(this.x, this.y, this.w * 0.7 * scale, 8 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Coordenada Y de pantalla del borde superior del cuerpo
  get screenTop() { return this.y - this.z - this.h; }
}
