// Utilidades de dibujo compartidas (estilo cel-shading: contornos negros gruesos).
const Draw = {
  // Texto con contorno negro
  text(ctx, str, x, y, options = {}) {
    const { size = 24, color = '#fff', align = 'left', stroke = '#000', strokeWidth = 5 } = options;
    ctx.font = `${size}px ${CONFIG.FONT}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    if (strokeWidth > 0) {
      ctx.lineWidth = strokeWidth;
      ctx.strokeStyle = stroke;
      ctx.strokeText(str, x, y);
    }
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  },

  // Rectángulo relleno con contorno negro
  outlinedRect(ctx, x, y, w, h, fill, lineWidth = 4) {
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w, h);
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = CONFIG.COLORS.OUTLINE;
    ctx.strokeRect(x, y, w, h);
  },

  // Barra de progreso (vida, energía) con fondo y contorno
  bar(ctx, x, y, w, h, ratio, fill, back = CONFIG.COLORS.NAVY) {
    const clamped = Math.max(0, Math.min(1, ratio));
    ctx.fillStyle = back;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w * clamped, h);
    ctx.lineWidth = 4;
    ctx.strokeStyle = CONFIG.COLORS.OUTLINE;
    ctx.strokeRect(x, y, w, h);
  },

  // Caché de textos de rock: dibujar contorno triple + degradado + resplandor cada fotograma era lo más caro de toda la escena.
  // Cada texto se pinta una vez en un lienzo pequeño y después solo se copia (~50 veces más barato).
  rockCache: new Map(),
  ROCK_CACHE_MAX: 220,

  // Texto de rock: cromado inclinado, con contorno grueso, sombra y brillo.
  // colors = [reflejo superior, color, color oscuro del horizonte]; rim = filete de color entre contorno y relleno.
  rock(ctx, str, x, y, options = {}) {
    // Con zoom (banner que entra de golpe, título que late) el mapa de bits saldría borroso: se dibuja directo
    const matrix = ctx.getTransform();
    if (typeof document === 'undefined' || Math.abs(matrix.a - 1) > 0.12 || Math.abs(matrix.d - 1) > 0.12 || matrix.b || matrix.c) {
      this.rockDirect(ctx, str, x, y, options);
      return;
    }
    const {
      size = 28, align = 'left', colors = ['#ffffff', '#ffe600', '#c46a00'], skew = 0.2,
      glow = null, glowBlur = 14, tracking = 0, rim = null, alpha = 1, outlineWidth = size * 0.2,
    } = options;
    const qSize = Math.round(size / 2) * 2; // tamaños cercanos comparten imagen
    const qGlow = glow ? Math.round(glowBlur / 6) * 6 : 0;
    const key = [str, qSize, align, colors.join(), skew, glow, qGlow, tracking, rim, Math.round(outlineWidth)].join('|');
    let entry = this.rockCache.get(key);
    if (!entry) {
      entry = this.buildRock(str, { ...options, size: qSize, glowBlur: qGlow || glowBlur, outlineWidth: outlineWidth * qSize / size });
      this.rockCache.set(key, entry);
      if (this.rockCache.size > this.ROCK_CACHE_MAX) this.rockCache.delete(this.rockCache.keys().next().value); // descarta el más antiguo
    } else {
      this.rockCache.delete(key); // lo reinserta al final: los más usados sobreviven
      this.rockCache.set(key, entry);
    }
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.drawImage(entry.canvas, x - entry.originX, y - entry.originY);
    ctx.restore();
  },

  // Pinta un texto de rock en su propio lienzo, con margen para el contorno, la inclinación y el resplandor
  buildRock(str, options) {
    const { size, align = 'left', tracking = 0, skew = 0.2, glow = null, glowBlur = 14, outlineWidth = size * 0.2 } = options;
    const probe = document.createElement('canvas').getContext('2d');
    probe.font = size + 'px ' + CONFIG.FONT;
    if ('letterSpacing' in probe) probe.letterSpacing = tracking + 'px';
    const width = Math.ceil(probe.measureText(str).width);
    const pad = Math.ceil(outlineWidth * 0.8 + size * 0.15 + (glow ? glowBlur * 1.6 : 0) + 4);
    const slant = Math.ceil(skew * size);
    const canvas = document.createElement('canvas');
    canvas.width = width + pad * 2 + slant;
    canvas.height = Math.ceil(size * 1.3) + pad * 2;
    const originX = pad + (align === 'center' ? width / 2 : align === 'right' ? width : 0);
    const originY = pad + Math.ceil(size * 0.95);
    this.rockDirect(canvas.getContext('2d'), str, originX, originY, { ...options, alpha: 1 });
    return { canvas, originX, originY };
  },

  rockDirect(ctx, str, x, y, options = {}) {
    const {
      size = 28, align = 'left', colors = ['#ffffff', '#ffe600', '#c46a00'], skew = 0.2,
      glow = null, glowBlur = 14, tracking = 0, rim = null, alpha = 1, outlineWidth = size * 0.2,
    } = options;
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.font = `${size}px ${CONFIG.FONT}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${tracking}px`;
    ctx.translate(x, y);
    ctx.transform(1, 0, -skew, 1, 0, 0);

    // Sombra proyectada
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.lineWidth = outlineWidth;
    ctx.strokeText(str, size * 0.07, size * 0.1);
    // Contorno negro grueso y filete de color
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = outlineWidth;
    ctx.strokeText(str, 0, 0);
    if (rim) {
      ctx.strokeStyle = rim;
      ctx.lineWidth = outlineWidth * 0.42;
      ctx.strokeText(str, 0, 0);
    }
    // Relleno cromado: reflejo arriba, horizonte oscuro en el centro, rebote de luz abajo
    const gradient = ctx.createLinearGradient(0, -size * 0.78, 0, size * 0.04);
    gradient.addColorStop(0, colors[0]);
    gradient.addColorStop(0.46, colors[1]);
    gradient.addColorStop(0.5, colors[2]);
    gradient.addColorStop(1, colors[1]);
    if (glow) {
      ctx.shadowColor = glow;
      ctx.shadowBlur = glowBlur;
    }
    ctx.fillStyle = gradient;
    ctx.fillText(str, 0, 0);
    ctx.restore();
  },

  // Trazo de un paralelogramo (el borde superior desplazado "slant" hacia la derecha)
  parallelogram(ctx, x, y, w, h, slant) {
    ctx.beginPath();
    ctx.moveTo(x + slant, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w - slant, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
  },

  // Degradado vertical de metal cepillado (marcos del HUD)
  metal(ctx, y, h, tone = 'steel') {
    const palette = tone === 'gold'
      ? ['#fff4b0', '#d9a21b', '#6b4a05', '#e9b93a']
      : ['#f4f8ff', '#9aa4b8', '#3b4256', '#8793aa'];
    const gradient = ctx.createLinearGradient(0, y, 0, y + h);
    gradient.addColorStop(0, palette[0]);
    gradient.addColorStop(0.45, palette[1]);
    gradient.addColorStop(0.55, palette[2]);
    gradient.addColorStop(1, palette[3]);
    return gradient;
  },

  // Generador pseudoaleatorio determinista (para fondos reproducibles)
  seededRandom(seed) {
    let value = seed;
    return () => {
      value = (value * 1664525 + 1013904223) % 4294967296;
      return value / 4294967296;
    };
  },
};
