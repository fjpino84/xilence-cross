// VÓIDHAR, el Armonizador Supremo: aparece solo en el cierre del nivel. Cae del cielo, aterriza y
// permanece rodeado de un aura maligna (humo negro, brasas púrpuras y rojas, anillos del vacío).
class VoidharFinale {
  static HEIGHT = 285; // los enemigos miden ~165 y ECO ~140
  static FALL_START_Z = 620;
  static GRAVITY = 3200;
  static HEAD_Y = 0.935; // altura relativa de la cabeza (el óvalo blanco) sobre los pies
  static ANCHOR_X = 0.5;

  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.z = VoidharFinale.FALL_START_Z;
    this.vz = -320;
    this.age = 0;
    this.landedTime = -1; // < 0 mientras cae
    this.squash = 0;
    this.auraTimer = 0;
    this.pulseTimer = 0;
    this.sortY = y - 8; // se dibuja un poco detrás de ECO si comparten carril
  }

  get landed() { return this.landedTime >= 0; }

  // Devuelve true en el instante exacto del aterrizaje
  update(dt, world) {
    this.age += dt;
    let justLanded = false;

    if (!this.landed) {
      this.vz -= VoidharFinale.GRAVITY * dt;
      this.z += this.vz * dt;
      this.fallEffects(dt, world);
      if (this.z <= 0) {
        this.z = 0;
        this.landedTime = 0;
        this.squash = 0.3;
        justLanded = true;
      }
    } else {
      this.landedTime += dt;
      this.squash = Math.max(0, this.squash - dt);
      this.auraEffects(dt, world);
    }
    return justLanded;
  }

  // Durante la caída: estelas oscuras verticales y destellos rojos
  fallEffects(dt, world) {
    const top = this.y - this.z - VoidharFinale.HEIGHT;
    for (let i = 0; i < 3; i++) {
      world.particles.add({
        type: 'streak', x: this.x + (Math.random() - 0.5) * 120, y: top - Math.random() * 120,
        vx: 0, vy: -1300 - Math.random() * 700, life: 0.32, size: 2.5 + Math.random() * 3,
        color: Math.random() < 0.5 ? 'rgba(120, 50, 220, 0.9)' : 'rgba(255, 30, 70, 0.8)',
      });
    }
    world.particles.add({
      type: 'smoke', x: this.x + (Math.random() - 0.5) * 70, y: top + Math.random() * 120, vx: (Math.random() - 0.5) * 60, vy: -60,
      life: 0.7, size: 12, sizeEnd: 34, color: '#0b0614', additive: false,
    });
  }

  // Aura ya en el suelo: humo negro que sube, brasas, anillos del vacío que laten desde sus pies
  auraEffects(dt, world) {
    this.auraTimer -= dt;
    if (this.auraTimer <= 0) {
      this.auraTimer = 0.03;
      const height = VoidharFinale.HEIGHT;
      // Humo negro alrededor del cuerpo
      world.particles.add({
        type: 'smoke', x: this.x + (Math.random() - 0.5) * 150, y: this.y - Math.random() * height * 0.9,
        vx: (Math.random() - 0.5) * 50, vy: -40 - Math.random() * 90, life: 0.9 + Math.random() * 0.6,
        size: 12 + Math.random() * 10, sizeEnd: 40 + Math.random() * 20, color: '#0a0512', additive: false,
      });
      // Brasas púrpuras y rojas que suben
      if (Math.random() < 0.8) {
        world.particles.add({
          type: 'dot', x: this.x + (Math.random() - 0.5) * 170, y: this.y - Math.random() * 40,
          vx: (Math.random() - 0.5) * 50, vy: -(60 + Math.random() * 200), life: 1.1 + Math.random() * 0.9,
          size: 1.8 + Math.random() * 3, sizeEnd: 0, color: Math.random() < 0.6 ? '#b46bff' : '#ff2a55',
        });
      }
      // Fragmentos del vacío: esquirlas oscuras que ascienden en espiral
      if (Math.random() < 0.25) {
        world.particles.add({
          type: 'shard', x: this.x + (Math.random() - 0.5) * 120, y: this.y - 20 - Math.random() * 60,
          vx: (Math.random() - 0.5) * 120, vy: -(120 + Math.random() * 200), life: 1.0, size: 5 + Math.random() * 4, sizeEnd: 1,
          color: '#2a1050', spin: (Math.random() - 0.5) * 8, rotation: Math.random() * 6, additive: false,
        });
      }
    }
    // Anillo de vacío que se expande desde los pies, a ritmo de latido
    this.pulseTimer -= dt;
    if (this.pulseTimer <= 0) {
      this.pulseTimer = 0.75;
      world.particles.add({ type: 'ring', x: this.x, y: this.y, size: 20, sizeEnd: 230, life: 0.9, color: '#7c3aff', width: 8, flat: 0.28 });
      world.particles.add({ type: 'ring', x: this.x, y: this.y, size: 10, sizeEnd: 150, life: 0.7, color: '#ff2a55', width: 4, flat: 0.28 });
    }
  }

  render(ctx) {
    const image = Assets.image('spriteVoidhar');
    const height = VoidharFinale.HEIGHT;
    const pulse = 0.5 + 0.5 * Math.sin(this.age * 5);
    const lift = this.z; // altura sobre el suelo
    const baseY = this.y - lift;

    // Sombra en el suelo: crece y se oscurece al acercarse
    const closeness = 1 - Math.min(1, this.z / VoidharFinale.FALL_START_Z);
    ctx.save();
    ctx.fillStyle = `rgba(0, 0, 0, ${0.25 + 0.5 * closeness})`;
    ctx.beginPath();
    ctx.ellipse(this.x, this.y, 40 + closeness * 90, 10 + closeness * 20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Aura detrás del cuerpo: halo púrpura-rojo con borde ondulante
    const cy = baseY - height * 0.5;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const radius = height * (0.75 + 0.06 * pulse);
    const halo = ctx.createRadialGradient(this.x, cy, height * 0.12, this.x, cy, radius);
    halo.addColorStop(0, `rgba(120, 40, 220, ${0.38 + 0.12 * pulse})`);
    halo.addColorStop(0.55, `rgba(70, 10, 120, ${0.25 + 0.1 * pulse})`);
    halo.addColorStop(1, 'rgba(255, 20, 70, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(this.x, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    // Anillos del vacío girando a ras de suelo
    if (this.landed) {
      ctx.lineCap = 'round';
      for (let k = 0; k < 3; k++) {
        const spin = this.age * (1.8 - k * 0.4) + k * 2.1;
        ctx.strokeStyle = k === 1 ? 'rgba(255, 40, 80, 0.55)' : 'rgba(160, 90, 255, 0.55)';
        ctx.lineWidth = 4 - k;
        ctx.beginPath();
        ctx.ellipse(this.x, this.y - 4, 120 + k * 34, 26 + k * 7, 0, spin, spin + Math.PI * 1.2);
        ctx.stroke();
      }
    }
    ctx.restore();

    if (image) {
      const bob = this.landed ? Math.sin(this.age * 2.4) * 3 : 0; // flota ligeramente
      const squash = this.squash / 0.3;
      // Contorno de aura: dos siluetas más grandes y translúcidas detrás del cuerpo (roja la exterior, púrpura la interior)
      for (const [scale, color, alpha] of [[1.13, '#ff1a4a', 0.2 + 0.12 * pulse], [1.06, '#9a5cff', 0.34 + 0.16 * pulse]]) {
        Sprite.draw(ctx, image, {
          x: this.x, y: baseY + bob, height: height * scale, anchorX: VoidharFinale.ANCHOR_X, facing: -1,
          silhouetteColor: color, additive: true, alpha,
        });
      }
      Sprite.draw(ctx, image, {
        x: this.x, y: baseY + bob, height, anchorX: VoidharFinale.ANCHOR_X, facing: -1, // mira hacia ECO (a su izquierda)
        scaleX: 1 + 0.16 * squash, scaleY: 1 - 0.12 * squash,
        tint: { color: '#ff1a4a', alpha: 0.05 + 0.1 * pulse },
      });
    }

    // Resplandor en la cabeza: el óvalo blanco late con un reborde rojo
    const headY = baseY - height * VoidharFinale.HEAD_Y;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const glow = ctx.createRadialGradient(this.x, headY, 2, this.x, headY, 58 + 12 * pulse);
    glow.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
    glow.addColorStop(0.25, 'rgba(255, 90, 140, 0.45)');
    glow.addColorStop(1, 'rgba(255, 20, 70, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(this.x, headY, 70, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
