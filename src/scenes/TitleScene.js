// Pantalla de título: ECO a la derecha y el título ("THE ORDER OF XILENCE", en letra decorada con un aro de runas) a la izquierda, sin taparlo.
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
    this.game.audio.releaseBoss(0.8); // al volver al menú se apaga la canción del jefe y vuelve la música normal
    this.time = 0;
    this.embers = Array.from({ length: 34 }, () => this.newEmber(true));
    this.titleArt = null; // se compone al entrar (necesita la fuente ya cargada)
    this.tagArt = null;
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
      violet: Math.random() < 0.5,
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
    this.renderRunes(ctx);
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
      ctx.fillStyle = ember.violet ? 'rgba(190, 140, 255, 0.8)' : 'rgba(255, 205, 90, 0.85)';
      ctx.beginPath();
      ctx.arc(ember.x, ember.y, ember.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Dibuja un texto carácter a carácter con separación extra (el lienzo no siempre admite letterSpacing)
  static drawSpaced(ctx, text, x, y, spacing, mode = 'fillText') {
    // Con letterSpacing nativo el navegador compone la frase entera (kerning y anchos correctos)
    if ('letterSpacing' in ctx) {
      ctx.letterSpacing = spacing + 'px';
      ctx[mode](text, x, y);
      ctx.letterSpacing = '0px';
      return;
    }
    let cx = x;
    for (const ch of text) {
      ctx[mode](ch, cx, y);
      cx += ctx.measureText(ch).width + spacing;
    }
  }

  static spacedWidth(ctx, text, spacing) {
    if ('letterSpacing' in ctx) {
      ctx.letterSpacing = spacing + 'px';
      const w = ctx.measureText(text).width - spacing;
      ctx.letterSpacing = '0px';
      return w;
    }
    let width = 0;
    for (const ch of text) width += ctx.measureText(ch).width + spacing;
    return width - spacing;
  }

  // Compone una sola vez el título: "THE ORDER OF" en letra clásica y "XILENCE" en letra decorada dorada, con un adorno debajo
  buildTitleArt() {
    const width = 470;
    const height = 226;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const c = canvas.getContext('2d');
    c.textBaseline = 'alphabetic';
    c.lineJoin = 'round';

    // Línea superior: pequeña, espaciada, en lila claro
    c.font = `700 25px ${CONFIG.PLAIN_FONT}`;
    const upper = c.createLinearGradient(0, 18, 0, 44);
    upper.addColorStop(0, '#fff3d0');
    upper.addColorStop(1, '#bfa0ff');
    c.shadowColor = '#7c3aff';
    c.shadowBlur = 12;
    c.fillStyle = upper;
    TitleScene.drawSpaced(c, 'THE ORDER OF', 6, 44, 9);
    c.shadowBlur = 0;

    // Palabra principal en la versión más pesada de Cinzel (la I decorada de Cinzel Decorative se confunde con un 1): se ajusta el tamaño para que quepa
    let size = 96;
    const spacing = 5;
    c.font = `900 ${size}px ${CONFIG.PLAIN_FONT}`;
    const natural = TitleScene.spacedWidth(c, 'XILENCE', spacing);
    size = Math.floor(size * Math.min(1, (width - 14) / natural));
    c.font = `900 ${size}px ${CONFIG.PLAIN_FONT}`;
    const baseline = 52 + size * 0.88;
    const gold = c.createLinearGradient(0, baseline - size * 0.8, 0, baseline + 4);
    gold.addColorStop(0, '#fffbea');
    gold.addColorStop(0.3, '#ffe38a');
    gold.addColorStop(0.62, '#d89a22');
    gold.addColorStop(1, '#6d3b08');
    // Contorno oscuro con resplandor violeta, relleno dorado y un filo de luz
    c.shadowColor = '#9a5cff';
    c.shadowBlur = 26;
    c.lineWidth = 9;
    c.strokeStyle = '#150633';
    TitleScene.drawSpaced(c, "XILENCE", 4, baseline, spacing, 'strokeText');
    c.shadowBlur = 0;
    c.fillStyle = gold;
    TitleScene.drawSpaced(c, "XILENCE", 4, baseline, spacing, 'fillText');
    c.lineWidth = 1.4;
    c.strokeStyle = 'rgba(255, 246, 214, 0.65)';
    TitleScene.drawSpaced(c, "XILENCE", 4, baseline, spacing, 'strokeText');

    // Adorno bajo la palabra: línea que se desvanece con un rombo en el centro
    const y = baseline + 22;
    const line = c.createLinearGradient(6, 0, width - 6, 0);
    line.addColorStop(0, 'rgba(255, 220, 130, 0)');
    line.addColorStop(0.2, 'rgba(255, 220, 130, 0.9)');
    line.addColorStop(0.5, 'rgba(255, 245, 210, 1)');
    line.addColorStop(0.8, 'rgba(190, 150, 255, 0.9)');
    line.addColorStop(1, 'rgba(190, 150, 255, 0)');
    c.strokeStyle = line;
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(6, y);
    c.lineTo(width - 6, y);
    c.stroke();
    const cx = width / 2;
    c.fillStyle = '#ffe9a8';
    c.shadowColor = '#ffb000';
    c.shadowBlur = 10;
    for (const [dx, r] of [[0, 8], [-26, 4], [26, 4]]) {
      c.beginPath();
      c.moveTo(cx + dx, y - r);
      c.lineTo(cx + dx + r, y);
      c.lineTo(cx + dx, y + r);
      c.lineTo(cx + dx - r, y);
      c.closePath();
      c.fill();
    }
    this.titleArt = canvas;
    this.titleBaseline = baseline;
    this.shimmer = document.createElement('canvas');
    this.shimmer.width = width;
    this.shimmer.height = height;
  }

  // Aro de runas que gira muy despacio detrás del título: dos anillos, marcas y glifos angulosos
  renderRunes(ctx) {
    this.runes = this.runes || (() => {
      const random = Draw.seededRandom(20241017);
      return Array.from({ length: 28 }, () => {
        const strokes = [];
        const count = 2 + Math.floor(random() * 3);
        for (let i = 0; i < count; i++) strokes.push([random() * 2 - 1, random() * 2 - 1, random() * 2 - 1, random() * 2 - 1]);
        return strokes;
      });
    })();
    const cx = TitleScene.TEXT_X + 262;
    const cy = 168;
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 1.4);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.globalCompositeOperation = 'lighter';
    const glow = ctx.createRadialGradient(0, 0, 20, 0, 0, 250);
    glow.addColorStop(0, `rgba(150, 90, 255, ${0.2 + 0.08 * pulse})`);
    glow.addColorStop(1, 'rgba(150, 90, 255, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(-260, -260, 520, 520);
    ctx.lineCap = 'round';
    for (const [radius, width, alpha, speed] of [[218, 2, 0.35, 0.05], [186, 1.2, 0.3, -0.07], [154, 1, 0.22, 0.04]]) {
      ctx.save();
      ctx.rotate(this.time * speed);
      ctx.strokeStyle = `rgba(214, 180, 255, ${alpha})`;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    // Marcas y glifos entre los dos anillos exteriores
    ctx.save();
    ctx.rotate(this.time * -0.07);
    ctx.strokeStyle = 'rgba(255, 220, 140, 0.4)';
    ctx.lineWidth = 1.4;
    this.runes.forEach((strokes, i) => {
      ctx.save();
      ctx.rotate((i / this.runes.length) * Math.PI * 2);
      ctx.translate(0, -202);
      ctx.beginPath();
      for (const [x1, y1, x2, y2] of strokes) {
        ctx.moveTo(x1 * 6, y1 * 8);
        ctx.lineTo(x2 * 6, y2 * 8);
      }
      ctx.stroke();
      ctx.restore();
    });
    ctx.restore();
    ctx.restore();
  }

  // Título: entra con un golpe de escala, late con el pulso y un destello dorado lo recorre de vez en cuando
  renderTitle(ctx) {
    if (!this.titleArt) this.buildTitleArt();
    const x = TitleScene.TEXT_X - 10;
    const y = 56;
    const slam = Math.min(1, this.time / 0.5);
    const beat = 1 + 0.018 * this.heartbeat + (1 - slam) * (1 - slam) * 0.5;
    const art = this.titleArt;

    // Capa de destello: el título con una banda de luz que se desplaza (solo sobre las letras)
    const t = this.shimmer.getContext('2d');
    t.clearRect(0, 0, art.width, art.height);
    t.globalCompositeOperation = 'source-over';
    t.drawImage(art, 0, 0);
    const sweep = ((this.time * 0.32) % 2.4) - 0.7;
    const bandX = sweep * art.width;
    const band = t.createLinearGradient(bandX - 70, 0, bandX + 70, 0);
    band.addColorStop(0, 'rgba(255, 255, 255, 0)');
    band.addColorStop(0.5, 'rgba(255, 255, 255, 0.75)');
    band.addColorStop(1, 'rgba(255, 255, 255, 0)');
    t.globalCompositeOperation = 'source-atop';
    t.fillStyle = band;
    t.fillRect(0, 0, art.width, art.height);

    ctx.save();
    ctx.globalAlpha = Math.min(1, slam * 1.6);
    ctx.translate(x + art.width / 2, y + 110);
    ctx.scale(beat, beat);
    ctx.drawImage(this.shimmer, -art.width / 2, -110);
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
  // Subtítulo: se compone una sola vez, cuando la tipografía ya está cargada, y después solo se copia
  renderTagline(ctx) {
    const font = `600 19px ${CONFIG.PLAIN_FONT}`;
    const ready = !document.fonts || document.fonts.check(font, 'AND THE QUEST');
    if (!this.tagArt && ready) {
      const canvas = document.createElement('canvas');
      canvas.width = 520;
      canvas.height = 40;
      const c = canvas.getContext('2d');
      c.font = font;
      c.textBaseline = 'alphabetic';
      const gradient = c.createLinearGradient(0, 8, 0, 30);
      gradient.addColorStop(0, '#fff3d0');
      gradient.addColorStop(1, '#c9a6ff');
      c.shadowColor = '#7c3aff';
      c.shadowBlur = 10;
      c.fillStyle = gradient;
      TitleScene.drawSpaced(c, 'AND THE QUEST FOR THE FINAL MELODY', 4, 28, 1.2, 'fillText');
      this.tagArt = canvas;
    }
    if (this.tagArt) ctx.drawImage(this.tagArt, TitleScene.TEXT_X - 4, 364);
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
