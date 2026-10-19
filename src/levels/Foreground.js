// Primer plano con parallax: siluetas oscuras de chatarra, neumáticos, tuberías y cables que pasan por delante de los personajes a más
// velocidad que el fondo. Se pinta una sola vez en dos tiras (inferior y superior) y después solo se copian, desplazadas.
// Son escasos y están en los bordes para no tapar el combate.
class Foreground {
  static STRIP_WIDTH = 2400;
  static SPEED_BOTTOM = 1.4; // veces lo que se mueve el escenario
  static SPEED_TOP = 1.18;
  static BOTTOM_HEIGHT = 150;
  static TOP_HEIGHT = 130;

  constructor() {
    this.bottom = null;
    this.top = null;
  }

  // Dibuja cada elemento tres veces (x, x - ancho, x + ancho) para que la tira enlace sin costuras al repetirse
  static wrapped(c, x, draw) {
    for (const offset of [-Foreground.STRIP_WIDTH, 0, Foreground.STRIP_WIDTH]) {
      c.save();
      c.translate(x + offset, 0);
      draw();
      c.restore();
    }
  }

  // Relleno oscuro azulado y filo de luz violeta en el borde superior
  static dark(c, height) {
    const gradient = c.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#171230');
    gradient.addColorStop(1, '#04030a');
    return gradient;
  }

  buildBottom() {
    const { STRIP_WIDTH: W, BOTTOM_HEIGHT: H } = Foreground;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const c = canvas.getContext('2d');
    const random = Draw.seededRandom(90210);
    c.lineJoin = 'round';
    c.lineCap = 'round';
    const body = Foreground.dark(c, H);

    const items = [];
    let x = 120;
    while (x < W - 100) {
      const kind = ['tire', 'pile', 'pipe', 'tire', 'cable'][Math.floor(random() * 5)];
      items.push({ x, kind, size: 0.8 + random() * 0.6, seed: random() });
      x += 260 + random() * 360; // muy separados: dejan ver el combate
    }

    for (const item of items) {
      Foreground.wrapped(c, item.x, () => {
        const s = item.size;
        c.fillStyle = body;
        c.strokeStyle = 'rgba(150, 110, 255, 0.45)';
        c.lineWidth = 2;
        if (item.kind === 'tire') {
          // Neumático asomando por el borde inferior
          const rx = 78 * s;
          const ry = 34 * s;
          c.beginPath();
          c.ellipse(0, H - 6, rx, ry * 1.7, 0, Math.PI, Math.PI * 2);
          c.fill();
          c.beginPath();
          c.ellipse(0, H - 6, rx, ry * 1.7, 0, Math.PI * 1.05, Math.PI * 1.95);
          c.stroke();
          c.fillStyle = '#020106';
          c.beginPath();
          c.ellipse(0, H - 6, rx * 0.5, ry * 0.8, 0, Math.PI, Math.PI * 2);
          c.fill();
        } else if (item.kind === 'pile') {
          // Montón de chatarra irregular
          c.beginPath();
          c.moveTo(-110 * s, H);
          let px = -110 * s;
          for (let i = 0; i < 9; i++) {
            px += (28 + 12 * ((i * 7 + item.seed * 10) % 3)) * s;
            c.lineTo(px, H - (20 + 46 * ((Math.sin(i * 1.7 + item.seed * 9) + 1) / 2)) * s);
          }
          c.lineTo(px + 18 * s, H);
          c.closePath();
          c.fill();
          c.stroke();
        } else if (item.kind === 'pipe') {
          // Tubería inclinada
          c.save();
          c.rotate(-0.14 + item.seed * 0.28);
          c.fillStyle = body;
          c.beginPath();
          c.roundRect ? c.roundRect(-150 * s, H - 46 * s, 300 * s, 36 * s, 16) : c.rect(-150 * s, H - 46 * s, 300 * s, 36 * s);
          c.fill();
          c.stroke();
          c.fillStyle = '#020106';
          c.beginPath();
          c.ellipse(-150 * s, H - 28 * s, 9 * s, 18 * s, 0, 0, Math.PI * 2);
          c.fill();
          c.restore();
        } else {
          // Cable grueso que sube desde abajo y cae
          c.strokeStyle = '#05030c';
          c.lineWidth = 12 * s;
          c.beginPath();
          c.moveTo(-90 * s, H + 6);
          c.bezierCurveTo(-60 * s, H - 90 * s, 50 * s, H - 100 * s, 90 * s, H + 6);
          c.stroke();
          c.strokeStyle = 'rgba(150, 110, 255, 0.35)';
          c.lineWidth = 2;
          c.beginPath();
          c.moveTo(-88 * s, H - 2);
          c.bezierCurveTo(-58 * s, H - 92 * s, 50 * s, H - 102 * s, 88 * s, H - 2);
          c.stroke();
        }
      });
    }
    this.bottom = canvas;
  }

  buildTop() {
    const { STRIP_WIDTH: W, TOP_HEIGHT: H } = Foreground;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const c = canvas.getContext('2d');
    const random = Draw.seededRandom(1337);
    c.lineCap = 'round';
    let x = 200;
    while (x < W - 120) {
      const sag = 40 + random() * 70;
      const span = 220 + random() * 260;
      const thick = 5 + random() * 7;
      Foreground.wrapped(c, x, () => {
        // Cable que cuelga de arriba, con una curva suave, y una luz de aviso al final
        c.strokeStyle = '#05030c';
        c.lineWidth = thick;
        c.beginPath();
        c.moveTo(0, -6);
        c.quadraticCurveTo(span / 2, sag * 1.6, span, -6);
        c.stroke();
        c.strokeStyle = 'rgba(150, 110, 255, 0.3)';
        c.lineWidth = 1.5;
        c.beginPath();
        c.moveTo(0, -3);
        c.quadraticCurveTo(span / 2, sag * 1.6 - 3, span, -3);
        c.stroke();
      });
      x += 380 + random() * 520;
    }
    this.top = canvas;
  }

  // scrollX: posición de la cámara en el mundo
  render(ctx, scrollX) {
    if (typeof document === 'undefined') return;
    if (!this.bottom) { this.buildBottom(); this.buildTop(); }
    const { STRIP_WIDTH: W } = Foreground;
    const draw = (strip, speed, y, alpha) => {
      const offset = -((scrollX * speed) % W);
      ctx.globalAlpha = alpha;
      for (let x = offset; x < CONFIG.WIDTH; x += W) ctx.drawImage(strip, Math.round(x), y);
    };
    ctx.save();
    draw(this.top, Foreground.SPEED_TOP, 0, 0.9);
    draw(this.bottom, Foreground.SPEED_BOTTOM, CONFIG.HEIGHT - Foreground.BOTTOM_HEIGHT + 12, 0.96);
    ctx.restore();
  }
}
