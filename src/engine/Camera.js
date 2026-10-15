// Cámara de scroll horizontal. Nunca retrocede y puede bloquearse durante las oleadas.
// Además aporta temblor y zoom de impacto ("game feel").
class Camera {
  constructor(viewWidth, levelWidth) {
    this.x = 0;
    this.viewWidth = viewWidth;
    this.levelWidth = levelWidth;
    this.lockX = Infinity; // límite derecho mientras hay una oleada activa
    this.shakeTime = 0;
    this.shakePower = 0;
    this.offsetX = 0;
    this.offsetY = 0;
    this.zoom = 1;
    this.zoomTarget = 1;
    this.zoomOriginX = viewWidth / 2;
    this.zoomOriginY = CONFIG.HEIGHT * 0.65;
  }

  follow(targetX, dt) {
    const desired = targetX - this.viewWidth * 0.4;
    const maxX = Math.min(this.levelWidth - this.viewWidth, this.lockX);
    const target = Math.max(this.x, Math.min(desired, maxX));
    this.x += (target - this.x) * Math.min(1, dt * 8);
  }

  // Temblor y zoom: usan tiempo real para seguir vivos durante el hit-stop
  update(dt) {
    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      const falloff = Math.min(1, this.shakeTime / 0.2);
      this.offsetX = (Math.random() - 0.5) * this.shakePower * falloff;
      this.offsetY = (Math.random() - 0.5) * this.shakePower * falloff;
    } else {
      this.offsetX = 0;
      this.offsetY = 0;
    }
    const speed = this.zoomTarget > 1 ? 7 : 10;
    this.zoom += (this.zoomTarget - this.zoom) * Math.min(1, dt * speed);
    if (Math.abs(this.zoom - 1) < 0.001 && this.zoomTarget === 1) this.zoom = 1;
  }

  // Conserva el temblor más fuerte si llegan varios a la vez
  shake(power, duration) {
    if (this.shakeTime > 0 && power < this.shakePower * Math.min(1, this.shakeTime / 0.2)) return;
    this.shakePower = power;
    this.shakeTime = Math.max(duration, this.shakeTime);
  }

  // Golpe de zoom que se relaja solo
  punch(amount) {
    this.zoom = Math.max(this.zoom, 1 + amount);
  }

  get left() { return this.x; }
  get right() { return this.x + this.viewWidth; }

  // Zoom alrededor de un punto de pantalla (llamar dentro de save/restore)
  applyZoom(ctx) {
    if (this.zoom === 1) return;
    ctx.translate(this.zoomOriginX, this.zoomOriginY);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.zoomOriginX, -this.zoomOriginY);
  }

  // Aplica el desplazamiento de cámara al mundo (llamar dentro de save/restore)
  apply(ctx) {
    ctx.translate(Math.round(-this.x + this.offsetX), Math.round(this.offsetY));
  }
}
