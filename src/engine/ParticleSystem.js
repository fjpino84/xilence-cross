// Partículas 2D baratas. Tipos: spark (chispa alargada), dot, ring (onda), note (nota musical),
// streak (lluvia) y smoke (polvo). La mezcla aditiva da el brillo neón.
class ParticleSystem {
  static MAX = 800;

  constructor() {
    this.items = [];
  }

  add(particle) {
    if (this.items.length >= ParticleSystem.MAX) this.items.shift();
    this.items.push({
      vx: 0, vy: 0, gravity: 0, drag: 0,
      age: 0, life: 0.5,
      size: 4, sizeEnd: 0, width: 6, flat: 1,
      color: '#ffffff', type: 'dot', additive: true,
      rotation: 0, spin: 0, text: '♪',
      ...particle,
    });
  }

  // Ráfaga: los rangos [min, max] se sortean por partícula
  burst({
    x, y, count, speed = [100, 300], angle = [0, Math.PI * 2], life = [0.3, 0.6],
    size = [3, 6], color = '#ffffff', colors = null, spin = [0, 0], ...rest
  }) {
    const between = ([min, max]) => min + Math.random() * (max - min);
    for (let i = 0; i < count; i++) {
      const direction = between(angle);
      const velocity = between(speed);
      this.add({
        x, y,
        vx: Math.cos(direction) * velocity,
        vy: Math.sin(direction) * velocity,
        life: between(life),
        size: between(size),
        color: colors ? colors[Math.floor(Math.random() * colors.length)] : color,
        spin: between(spin),
        rotation: Math.random() * Math.PI * 2,
        ...rest,
      });
    }
  }

  update(dt) {
    let write = 0;
    for (const particle of this.items) {
      particle.age += dt;
      if (particle.age >= particle.life) continue;
      particle.vx *= Math.max(0, 1 - particle.drag * dt);
      particle.vy = particle.vy * Math.max(0, 1 - particle.drag * dt) + particle.gravity * dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.rotation += particle.spin * dt;
      this.items[write++] = particle;
    }
    this.items.length = write;
  }

  render(ctx) {
    ctx.save();
    ctx.lineCap = 'round';
    for (const p of this.items) {
      const t = p.age / p.life;
      ctx.globalCompositeOperation = p.additive ? 'lighter' : 'source-over';
      ctx.globalAlpha = Math.max(0, p.type === 'smoke' ? 0.4 * (1 - t) : 1 - t);
      const size = p.size + (p.sizeEnd - p.size) * t;

      switch (p.type) {
        case 'spark':
          ctx.strokeStyle = p.color;
          ctx.lineWidth = Math.max(0.5, p.size * (1 - t));
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04);
          ctx.stroke();
          break;
        case 'streak':
          ctx.strokeStyle = p.color;
          ctx.lineWidth = p.size;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + p.vx * 0.02, p.y + p.vy * 0.02);
          ctx.stroke();
          break;
        case 'ring':
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 1 + (1 - t) * p.width;
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, Math.max(0.1, size), Math.max(0.1, size * p.flat), 0, 0, Math.PI * 2);
          ctx.stroke();
          break;
        case 'shard': {
          // Esquirla de energía: rombo alargado que gira
          const half = Math.max(1, size);
          ctx.fillStyle = p.color;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.beginPath();
          ctx.moveTo(0, -half * 1.7);
          ctx.lineTo(half * 0.5, 0);
          ctx.lineTo(0, half * 1.7);
          ctx.lineTo(-half * 0.5, 0);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
          break;
        }
        default: // dot, smoke
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(0.1, size), 0, Math.PI * 2);
          ctx.fill();
      }
    }
    ctx.restore();
  }
}
