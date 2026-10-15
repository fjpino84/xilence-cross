// Pantalla de título: ECO a la derecha y el título a la izquierda, sin taparlo.
class TitleScene {
  static INPUT_DELAY = 0.3; // evita saltar la pantalla con la tecla que nos trajo aquí
  static ART_SHIFT = 170; // cuánto se desplaza la ilustración hacia la derecha para dejar sitio al título
  static TEXT_X = 40;

  // Electrocardiograma: ancho de cada latido (px) y velocidad con que avanza (px/s)
  static ECG_WIDTH = 400;
  static ECG_BEAT = 170;
  static ECG_SPEED = 120;
  static ECG_AMPLITUDE = 54;

  constructor(game) {
    this.game = game;
    this.time = 0;
    this.embers = [];
    this.heartbeat = 0; // 0-1: vale 1 cuando el pico R del electrocardiograma llega a la punta de la línea
    this.onCanvasClick = (event) => {
      event.preventDefault();
      if (this.time > TitleScene.INPUT_DELAY) this.start();
    };
  }

  enter() {
    this.time = 0;
    this.embers = Array.from({ length: 28 }, () => this.newEmber(true));
    this.game.canvas.addEventListener('click', this.onCanvasClick);
  }

  exit() {
    this.game.canvas.removeEventListener('click', this.onCanvasClick);
  }

  start() {
    this.game.scenes.change('game');
  }

  // Chispas que suben por el lado del título
  newEmber(anywhere = false) {
    return {
      x: Math.random() * 440,
      y: anywhere ? Math.random() * CONFIG.HEIGHT : CONFIG.HEIGHT + 10,
      speed: 20 + Math.random() * 50,
      drift: (Math.random() - 0.5) * 24,
      size: 1 + Math.random() * 2.2,
      cyan: Math.random() < 0.55,
    };
  }

  // Forma de un latido (P - QRS - T) para una fase 0-1: 0 = línea base, 1 = pico R
  static ecg(f) {
    if (f < 0.10) return 0;
    if (f < 0.20) return 0.13 * Math.sin(((f - 0.10) / 0.10) * Math.PI); // onda P
    if (f < 0.29) return 0;
    if (f < 0.32) return -0.16 * ((f - 0.29) / 0.03); // Q
    if (f < 0.36) return -0.16 + 1.16 * ((f - 0.32) / 0.04); // sube al pico R
    if (f < 0.41) return 1.0 - 1.28 * ((f - 0.36) / 0.05); // baja a S
    if (f < 0.45) return -0.28 + 0.28 * ((f - 0.41) / 0.04);
    if (f < 0.55) return 0;
    if (f < 0.72) return 0.26 * Math.sin(((f - 0.55) / 0.17) * Math.PI); // onda T
    return 0;
  }

  // Valor del electrocardiograma en la posición px de la línea (el dibujo avanza hacia la izquierda)
  ecgAt(px) {
    const phase = (px + this.time * TitleScene.ECG_SPEED) / TitleScene.ECG_BEAT;
    return TitleScene.ecg(((phase % 1) + 1) % 1);
  }

  update(dt) {
    this.time += dt;
    for (let i = 0; i < this.embers.length; i++) {
      const ember = this.embers[i];
      ember.y -= ember.speed * dt;
      ember.x += ember.drift * dt;
      if (ember.y < -10) this.embers[i] = this.newEmber();
    }
    this.heartbeat = Math.max(0, this.ecgAt(TitleScene.ECG_WIDTH));
    if (this.time > TitleScene.INPUT_DELAY && this.game.input.justPressed('confirm')) this.start();
  }

  render(ctx) {
    const { WIDTH, HEIGHT, COLORS } = CONFIG;
    ctx.fillStyle = COLORS.NAVY;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    this.renderArt(ctx);
    this.renderEmbers(ctx);
    this.renderTitle(ctx);
    this.renderPulse(ctx);
    this.renderTagline(ctx);
    this.renderMenu(ctx);
  }

  // Ilustración desplazada a la derecha; el hueco de la izquierda se rellena con la misma imagen reflejada (sin costura)
  renderArt(ctx) {
    const { WIDTH, HEIGHT } = CONFIG;
    const art = Assets.image('bgTitle');
    if (!art) return;
    const shift = TitleScene.ART_SHIFT;
    ctx.save();
    ctx.translate(shift, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(art, 0, 0, WIDTH, HEIGHT);
    ctx.restore();
    ctx.drawImage(art, shift, 0, WIDTH, HEIGHT);

    // Oscurece el lado del texto para que se lea, y un poco todo el cuadro
    const side = ctx.createLinearGradient(0, 0, 560, 0);
    side.addColorStop(0, 'rgba(3, 3, 10, 0.94)');
    side.addColorStop(0.55, 'rgba(3, 3, 10, 0.62)');
    side.addColorStop(1, 'rgba(3, 3, 10, 0)');
    ctx.fillStyle = side;
    ctx.fillRect(0, 0, 560, HEIGHT);
    ctx.fillStyle = 'rgba(3, 3, 10, 0.18)';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  renderEmbers(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const ember of this.embers) {
      ctx.fillStyle = ember.cyan ? 'rgba(0, 245, 255, 0.8)' : 'rgba(255, 190, 60, 0.8)';
      ctx.beginPath();
      ctx.arc(ember.x, ember.y, ember.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Palabra con la inicial mucho más grande ("X" + "ILENCE"), alineadas por la base
  dropCapWord(ctx, word, x, baseline, capSize, size, options) {
    ctx.save();
    ctx.font = `${capSize}px ${CONFIG.FONT}`;
    const capWidth = ctx.measureText(word[0]).width;
    ctx.restore();
    const tracking = options.tracking || 0;
    Draw.rock(ctx, word[0], x, baseline, { ...options, size: capSize, tracking: 0 });
    Draw.rock(ctx, word.slice(1), x + capWidth + tracking * 0.6 + 6, baseline, { ...options, size });
  }

  // "XILENCE" en cian y "CROSS" en dorado, apilados a la izquierda con la X y la C enormes; entran de golpe y laten con el pulso
  renderTitle(ctx) {
    const { COLORS } = CONFIG;
    const x = TitleScene.TEXT_X;
    const slam = Math.min(1, this.time / 0.4);
    const beat = 1 + 0.035 * this.heartbeat + (1 - slam) * (1 - slam) * 1.1;

    ctx.save();
    ctx.globalAlpha = Math.min(1, slam * 1.6);
    ctx.translate(x, 0);
    ctx.scale(beat, beat);
    this.dropCapWord(ctx, 'XILENCE', 0, 178, 142, 88, {
      colors: ['#ffffff', COLORS.CYAN, '#005a85'], glow: COLORS.CYAN, glowBlur: 30, rim: '#00323f', tracking: 6,
    });
    this.dropCapWord(ctx, 'CROSS', 0, 292, 142, 88, {
      colors: ['#ffffff', COLORS.YELLOW, '#c04a00'], glow: '#ff9a00', glowBlur: 30, rim: '#4a2000', tracking: 18,
    });
    ctx.restore();
  }

  // Línea de electrocardiograma: latidos que avanzan hacia la izquierda, se desvanecen al fondo y un punto brillante en la punta
  renderPulse(ctx) {
    const { COLORS } = CONFIG;
    const x = TitleScene.TEXT_X;
    const y = 338;
    const width = TitleScene.ECG_WIDTH;
    const amplitude = TitleScene.ECG_AMPLITUDE;

    ctx.save();
    const fade = ctx.createLinearGradient(x, 0, x + width, 0);
    fade.addColorStop(0, 'rgba(0, 245, 255, 0)');
    fade.addColorStop(0.35, 'rgba(0, 245, 255, 0.55)');
    fade.addColorStop(1, 'rgba(160, 255, 255, 1)');
    ctx.strokeStyle = fade;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.shadowColor = COLORS.CYAN;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    for (let px = 0; px <= width; px += 2) {
      const py = y - this.ecgAt(px) * amplitude;
      if (px === 0) ctx.moveTo(x + px, py);
      else ctx.lineTo(x + px, py);
    }
    ctx.stroke();

    // Punto de la punta, con halo que crece con cada latido
    const tipY = y - this.ecgAt(width) * amplitude;
    const halo = 7 + 14 * this.heartbeat;
    const glow = ctx.createRadialGradient(x + width, tipY, 1, x + width, tipY, halo);
    glow.addColorStop(0, 'rgba(255, 255, 255, 1)');
    glow.addColorStop(0.4, 'rgba(120, 255, 250, 0.7)');
    glow.addColorStop(1, 'rgba(0, 245, 255, 0)');
    ctx.shadowBlur = 0;
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x + width, tipY, halo, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Frase en lila bajo la línea
  renderTagline(ctx) {
    Draw.rock(ctx, 'Music, the great communicator', TitleScene.TEXT_X, 392, {
      size: 25, colors: ['#f6ecff', '#c9a6ff', '#7c3aff'], glow: '#9d6bff', glowBlur: 10, rim: '#2a0f5a', outlineWidth: 5, skew: 0.14, tracking: 1,
    });
  }

  renderMenu(ctx) {
    const { COLORS } = CONFIG;
    const x = TitleScene.TEXT_X;
    if (Math.floor(this.time * 2) % 2 === 0) {
      Draw.rock(ctx, "LET'S ROCK!!", x, 468, {
        size: 62, colors: ['#ffffff', COLORS.YELLOW, '#d06000'], glow: '#ffb000', glowBlur: 20, rim: '#4a2400', tracking: 3,
      });
    }
    const hint = TouchControls.enabled
      ? 'Toca la pantalla para empezar · joystick a la izquierda · botones a la derecha (mantén RAYO para cargar)'
      : 'ENTER empezar · WASD/flechas mover · Espacio saltar · J golpe · K rayo (mantén) · L súper · Shift bloquear';
    Draw.text(ctx, hint, x, 520, {
      size: 13, color: '#b79bff', strokeWidth: 3,
    });
  }
}
