// Diálogo de escena: franjas de cine, retrato del que habla y texto que se escribe letra a letra.
// Cada línea: { who: 'eco' | 'rex', name, text, whisper?, scan? }. Avanza con ENTER, ESPACIO o el botón de ataque.
class Dialogue {
  static TYPE_SPEED = 52; // caracteres por segundo
  static WHISPER_SPEED = 24;
  static STYLES = {
    eco: { color: '#00f5ff', dark: '#06323a', side: 'left', portrait: 'portraitEco' },
    rex: { color: '#ff2a55', dark: '#3a0614', side: 'right', portrait: 'portraitRex' },
    batuk: { color: '#ffc02a', dark: '#3a2606', side: 'right', portrait: 'portraitBatuk' },
    // Acotación de escena: sin retrato ni nombre, en gris
    stage: { color: '#8da2bd', dark: '#10192a', side: 'left', portrait: null },
  };

  // onLine(índice, línea) se llama al empezar cada línea (para eventos de escena: un paso, levantarse...)
  constructor(lines, onDone, onLine = null) {
    this.lines = lines;
    this.onDone = onDone;
    this.onLine = onLine;
    this.index = 0;
    this.shown = 0;
    this.age = 0;
    this.lineAge = 0;
    this.bars = 0; // apertura de las franjas de cine (0-1)
    this.closing = false;
    this.done = false;
    this.wrapCache = new Map();
    const notify = this.onLine;
    if (notify) notify(0, this.lines[0]);
  }

  get line() { return this.lines[this.index]; }
  get finishedTyping() { return this.shown >= this.line.text.length; }

  update(dt, input, audio) {
    this.age += dt;
    if (this.closing) {
      this.bars = Math.max(0, this.bars - dt * 3.2);
      if (this.bars <= 0 && !this.done) {
        this.done = true;
        const callback = this.onDone;
        if (callback) callback();
      }
      return;
    }
    this.bars = Math.min(1, this.bars + dt * 3.2);
    this.lineAge += dt;
    const advance = input.justPressed('confirm') || input.justPressed('attack') || input.justPressed('special');

    if (!this.finishedTyping) {
      const before = Math.floor(this.shown);
      this.shown = Math.min(this.line.text.length, this.shown + (this.line.whisper ? Dialogue.WHISPER_SPEED : Dialogue.TYPE_SPEED) * dt);
      if (Math.floor(this.shown) !== before && Math.floor(this.shown) % 2 === 0 && this.line.who !== 'stage') audio.play('dialogBlip', { who: this.line.who });
      if (advance && this.lineAge > 0.25) this.shown = this.line.text.length; // completa la línea
      return;
    }
    if (advance && this.lineAge > 0.25) {
      if (this.index + 1 < this.lines.length) {
        this.index += 1;
        this.shown = 0;
        this.lineAge = 0;
        const notify = this.onLine;
        if (notify) notify(this.index, this.line);
      } else {
        this.closing = true;
      }
    }
  }

  // Divide el texto en líneas que caben en el ancho dado
  wrap(ctx, text, maxWidth, size, fontOverride = null) {
    const key = `${text}|${maxWidth}|${size}|${fontOverride}`;
    if (this.wrapCache.has(key)) return this.wrapCache.get(key);
    ctx.font = fontOverride || `${size}px ${CONFIG.FONT}`;
    const lines = [];
    let current = '';
    for (const word of text.split(' ')) {
      const test = current ? `${current} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
    this.wrapCache.set(key, lines);
    return lines;
  }

  // Camino con las esquinas cortadas (panel y marcos)
  static chamfer(ctx, x, y, w, h, c) {
    ctx.beginPath();
    ctx.moveTo(x + c, y);
    ctx.lineTo(x + w - c, y);
    ctx.lineTo(x + w, y + c);
    ctx.lineTo(x + w, y + h - c);
    ctx.lineTo(x + w - c, y + h);
    ctx.lineTo(x + c, y + h);
    ctx.lineTo(x, y + h - c);
    ctx.lineTo(x, y + c);
    ctx.closePath();
  }

  // Color "#rrggbb" teñido: mezcla con casi negro a cierta intensidad y opacidad
  static tint(hex, amount, alpha) {
    const value = parseInt(hex.slice(1), 16);
    const r = Math.round(((value >> 16) & 255) * amount + 6 * (1 - amount));
    const g = Math.round(((value >> 8) & 255) * amount + 5 * (1 - amount));
    const b = Math.round((value & 255) * amount + 14 * (1 - amount));
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  render(ctx) {
    const { WIDTH, HEIGHT } = CONFIG;
    const style = Dialogue.STYLES[this.line.who];
    const open = this.bars;
    const eased = 1 - Math.pow(1 - open, 3);
    const fade = Math.min(1, open * 1.4);

    // Franjas de cine con un filo del color del que habla
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, WIDTH, 52 * open);
    ctx.fillRect(0, HEIGHT - 52 * open, WIDTH, 52 * open);
    ctx.fillStyle = style.color;
    ctx.globalAlpha = 0.6 * open;
    ctx.fillRect(0, 52 * open - 2, WIDTH, 2);
    ctx.fillRect(0, HEIGHT - 52 * open, WIDTH, 2);
    ctx.globalAlpha = 1;

    const hasPortrait = !!style.portrait;
    const left = style.side === 'left';
    const panelH = 160;
    const panelX = 48;
    const panelW = WIDTH - 96;
    const panelY = 52 + 20 - (1 - eased) * 230; // arriba, para no tapar a los personajes
    const box = hasPortrait ? 148 : 0;
    const boxX = left ? panelX + 18 : panelX + panelW - 18 - box;
    const boxY = panelY + (panelH - box) / 2;

    ctx.save();
    ctx.globalAlpha = fade;

    // Cuerpo del panel: degradado oscuro teñido del color del que habla, con líneas diagonales muy tenues
    Dialogue.chamfer(ctx, panelX, panelY, panelW, panelH, 16);
    const body = ctx.createLinearGradient(panelX, panelY, panelX + panelW, panelY + panelH);
    body.addColorStop(0, 'rgba(8, 6, 22, 0.96)');
    body.addColorStop(0.5, Dialogue.tint(style.color, 0.1, 0.96));
    body.addColorStop(1, 'rgba(6, 4, 16, 0.97)');
    ctx.fillStyle = body;
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = Dialogue.tint(style.color, 0.07, 1);
    ctx.lineWidth = 1;
    for (let k = -panelH; k < panelW; k += 14) {
      ctx.beginPath();
      ctx.moveTo(panelX + k, panelY + panelH);
      ctx.lineTo(panelX + k + panelH, panelY);
      ctx.stroke();
    }
    if (hasPortrait) {
      // Brillo suave del lado del retrato
      const cx = boxX + box / 2;
      const glow = ctx.createRadialGradient(cx, panelY + panelH / 2, 10, cx, panelY + panelH / 2, 200);
      glow.addColorStop(0, Dialogue.tint(style.color, 0.28, 1));
      glow.addColorStop(1, Dialogue.tint(style.color, 0, 1));
      ctx.fillStyle = glow;
      ctx.fillRect(panelX, panelY, panelW, panelH);
    }
    ctx.restore();

    // Borde doble: negro grueso por fuera y filo de color con resplandor por dentro
    Dialogue.chamfer(ctx, panelX, panelY, panelW, panelH, 16);
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#000';
    ctx.stroke();
    Dialogue.chamfer(ctx, panelX + 5, panelY + 5, panelW - 10, panelH - 10, 12);
    ctx.lineWidth = 2;
    ctx.strokeStyle = style.color;
    ctx.shadowColor = style.color;
    ctx.shadowBlur = 14;
    ctx.stroke();
    ctx.shadowBlur = 0;
    // Remates en forma de rombo en las esquinas
    ctx.fillStyle = style.color;
    for (const [cx, cy] of [[panelX + 20, panelY + 5], [panelX + panelW - 20, panelY + 5], [panelX + 20, panelY + panelH - 5], [panelX + panelW - 20, panelY + panelH - 5]]) {
      ctx.beginPath();
      ctx.moveTo(cx, cy - 4);
      ctx.lineTo(cx + 4, cy);
      ctx.lineTo(cx, cy + 4);
      ctx.lineTo(cx - 4, cy);
      ctx.closePath();
      ctx.fill();
    }

    // Retrato en marco de esquinas cortadas, con un latido de luz detrás
    if (hasPortrait) {
      const pulse = 0.5 + 0.5 * Math.sin(this.age * 2.4);
      ctx.save();
      Dialogue.chamfer(ctx, boxX, boxY, box, box, 14);
      const back = ctx.createLinearGradient(boxX, boxY, boxX, boxY + box);
      back.addColorStop(0, Dialogue.tint(style.color, 0.3 + 0.08 * pulse, 1));
      back.addColorStop(1, style.dark);
      ctx.fillStyle = back;
      ctx.fill();
      ctx.clip();
      const image = Assets.image(style.portrait);
      if (image) {
        const scale = Math.max(box / image.width, box / image.height) * 1.04;
        const w = image.width * scale;
        const h = image.height * scale;
        ctx.drawImage(image, boxX + (box - w) / 2, boxY + (box - h) / 2 + 4 - 2 * pulse, w, h);
      }
      // Viñeta interior
      const vignette = ctx.createRadialGradient(boxX + box / 2, boxY + box / 2, box * 0.3, boxX + box / 2, boxY + box / 2, box * 0.78);
      vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
      vignette.addColorStop(1, 'rgba(0, 0, 0, 0.55)');
      ctx.fillStyle = vignette;
      ctx.fillRect(boxX, boxY, box, box);
      ctx.restore();
      Dialogue.chamfer(ctx, boxX, boxY, box, box, 14);
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#000';
      ctx.stroke();
      Dialogue.chamfer(ctx, boxX + 3, boxY + 3, box - 6, box - 6, 11);
      ctx.lineWidth = 2;
      ctx.strokeStyle = style.color;
      ctx.shadowColor = style.color;
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Zona de texto
    const pad = 28;
    const textX = hasPortrait ? (left ? boxX + box + pad : panelX + pad + 6) : panelX + pad + 10;
    const textW = hasPortrait ? panelW - box - 18 - pad * 2 - 6 : panelW - pad * 2 - 20;

    // Placa de nombre: paralelogramo que sobresale por arriba del panel
    if (hasPortrait) {
      ctx.font = `24px ${CONFIG.FONT}`;
      const nameWidth = ctx.measureText(this.line.name).width + 40 + (this.line.name.length - 1) * 2;
      const tagX = textX - 12;
      const tagY = panelY - 14;
      ctx.beginPath();
      ctx.moveTo(tagX + 12, tagY);
      ctx.lineTo(tagX + nameWidth + 12, tagY);
      ctx.lineTo(tagX + nameWidth, tagY + 34);
      ctx.lineTo(tagX, tagY + 34);
      ctx.closePath();
      const tag = ctx.createLinearGradient(0, tagY, 0, tagY + 34);
      tag.addColorStop(0, Dialogue.tint(style.color, 0.9, 1));
      tag.addColorStop(1, Dialogue.tint(style.color, 0.45, 1));
      ctx.fillStyle = tag;
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#000';
      ctx.stroke();
      Draw.rock(ctx, this.line.name, tagX + 22, tagY + 27, {
        size: 24, colors: ['#ffffff', '#ffffff', '#d8d8e8'], tracking: 2, outlineWidth: 5, rim: '#000',
      });
      if (this.line.whisper) {
        Draw.text(ctx, '(voz baja)', tagX + nameWidth + 22, tagY + 25, { size: 15, color: '#ffb8c8', strokeWidth: 3 });
      }
    }

    // Texto: escrito hasta donde llega, con tipografía clásica para que respire
    const size = hasPortrait ? 19 : 18;
    const font = `${hasPortrait ? 700 : 600} ${size}px ${CONFIG.PLAIN_FONT}`;
    const lines = this.wrap(ctx, this.line.text, textW, size, font);
    let remaining = Math.floor(this.shown);
    const lineHeight = size + 9;
    const startY = panelY + (hasPortrait ? 62 : 70) + (lines.length < 3 ? 8 : 0);
    ctx.font = font;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    lines.forEach((text, i) => {
      const part = text.slice(0, Math.max(0, remaining));
      remaining -= text.length + 1;
      if (!part) return;
      ctx.save();
      ctx.font = font;
      ctx.textAlign = 'left'; // otros dibujos pueden haber dejado el lienzo alineado a la derecha o al centro
      ctx.textBaseline = 'alphabetic';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetY = 2;
      ctx.fillStyle = !hasPortrait ? '#aebfd6' : (this.line.whisper ? '#ffc9d6' : '#f4f1ff');
      ctx.fillText(part, textX, startY + i * lineHeight);
      ctx.restore();
    });

    // Marcador de avance (rayitas) e indicador de continuar
    const total = Math.min(this.lines.length, 40);
    const dotsX = panelX + panelW / 2 - (total * 9) / 2;
    ctx.fillStyle = style.color;
    for (let i = 0; i < total; i++) {
      ctx.globalAlpha = (i === this.index ? 1 : (i < this.index ? 0.55 : 0.2)) * fade;
      ctx.fillRect(dotsX + i * 9, panelY + panelH - 12, 5, 3);
    }
    ctx.globalAlpha = fade;
    if (this.finishedTyping) {
      const nudge = Math.floor(this.age * 3) % 2 === 0 ? 0 : 3;
      const ax = textX + textW - 4 + nudge;
      const ay = panelY + panelH - 30;
      ctx.fillStyle = style.color;
      ctx.shadowColor = style.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(ax - 12, ay - 9);
      ctx.lineTo(ax + 2, ay);
      ctx.lineTo(ax - 12, ay + 9);
      ctx.lineTo(ax - 6, ay);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }
}
