// Diálogo de escena: franjas de cine, retrato del que habla y texto que se escribe letra a letra.
// Cada línea: { who: 'eco' | 'rex', name, text, whisper?, scan? }. Avanza con ENTER, ESPACIO o el botón de ataque.
class Dialogue {
  static TYPE_SPEED = 52; // caracteres por segundo
  static WHISPER_SPEED = 24;
  static STYLES = {
    eco: { color: '#00f5ff', dark: '#06323a', side: 'left', portrait: 'portraitEco' },
    rex: { color: '#ff2a55', dark: '#3a0614', side: 'right', portrait: 'portraitRex' },
    batuk: { color: '#ffc02a', dark: '#3a2606', side: 'right', portrait: 'portraitBatuk' },
  };

  constructor(lines, onDone) {
    this.lines = lines;
    this.onDone = onDone;
    this.index = 0;
    this.shown = 0;
    this.age = 0;
    this.lineAge = 0;
    this.bars = 0; // apertura de las franjas de cine (0-1)
    this.closing = false;
    this.done = false;
    this.wrapCache = new Map();
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
      if (Math.floor(this.shown) !== before && Math.floor(this.shown) % 2 === 0) audio.play('dialogBlip', { who: this.line.who });
      if (advance && this.lineAge > 0.25) this.shown = this.line.text.length; // completa la línea
      return;
    }
    if (advance && this.lineAge > 0.25) {
      if (this.index + 1 < this.lines.length) {
        this.index += 1;
        this.shown = 0;
        this.lineAge = 0;
      } else {
        this.closing = true;
      }
    }
  }

  // Divide el texto en líneas que caben en el ancho dado
  wrap(ctx, text, maxWidth, size) {
    const key = `${text}|${maxWidth}|${size}`;
    if (this.wrapCache.has(key)) return this.wrapCache.get(key);
    ctx.font = `${size}px ${CONFIG.FONT}`;
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

  render(ctx) {
    const { WIDTH, HEIGHT } = CONFIG;
    const style = Dialogue.STYLES[this.line.who];
    const open = this.bars;

    // Franjas de cine
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, WIDTH, 52 * open);
    ctx.fillRect(0, HEIGHT - 52 * open, WIDTH, 52 * open);

    // Caja de diálogo: sube desde abajo al abrirse
    const panelH = 150;
    const panelX = 56;
    const panelW = WIDTH - 112;
    const panelY = 52 + 14 - (1 - open) * 220; // arriba, para no tapar a los personajes
    ctx.save();
    ctx.globalAlpha = Math.min(1, open * 1.4);
    ctx.fillStyle = 'rgba(4, 4, 18, 0.93)';
    ctx.fillRect(panelX, panelY, panelW, panelH);
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#000';
    ctx.strokeRect(panelX, panelY, panelW, panelH);
    ctx.lineWidth = 2;
    ctx.strokeStyle = style.color;
    ctx.shadowColor = style.color;
    ctx.shadowBlur = 12;
    ctx.strokeRect(panelX + 5, panelY + 5, panelW - 10, panelH - 10);
    ctx.shadowBlur = 0;

    // Retrato del que habla, en su lado
    const box = 126;
    const left = style.side === 'left';
    const boxX = left ? panelX + 16 : panelX + panelW - 16 - box;
    const boxY = panelY + 12;
    ctx.fillStyle = style.dark;
    ctx.fillRect(boxX, boxY, box, box);
    const image = Assets.image(style.portrait);
    if (image) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(boxX, boxY, box, box);
      ctx.clip();
      const scale = Math.max(box / image.width, box / image.height);
      ctx.drawImage(image, boxX + (box - image.width * scale) / 2, boxY + (box - image.height * scale) / 2 + 6, image.width * scale, image.height * scale);
      ctx.restore();
    }
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#000';
    ctx.strokeRect(boxX, boxY, box, box);
    ctx.lineWidth = 2;
    ctx.strokeStyle = style.color;
    ctx.strokeRect(boxX + 3, boxY + 3, box - 6, box - 6);

    // Nombre
    const textX = left ? boxX + box + 22 : panelX + 26;
    const textW = panelW - box - 16 - 48;
    Draw.rock(ctx, this.line.name, textX, panelY + 38, {
      size: 26, colors: ['#ffffff', style.color, '#10202a'], glow: style.color, glowBlur: 12, tracking: 2, outlineWidth: 5,
    });
    if (this.line.whisper) {
      Draw.text(ctx, '(voz baja)', textX + 4 + (this.line.name.length * 15), panelY + 36, { size: 15, color: '#b88a98', strokeWidth: 3 });
    }

    // Texto escrito hasta donde llega
    const size = this.line.whisper ? 20 : 22;
    const lines = this.wrap(ctx, this.line.text, textW, size);
    let remaining = Math.floor(this.shown);
    lines.forEach((text, i) => {
      const part = text.slice(0, Math.max(0, remaining));
      remaining -= text.length + 1;
      if (!part) return;
      Draw.text(ctx, part, textX, panelY + 70 + i * (size + 7), {
        size, color: this.line.whisper ? '#ffc2d2' : '#ffffff', strokeWidth: 4,
      });
    });

    // Indicador de continuar
    if (this.finishedTyping && Math.floor(this.age * 2.5) % 2 === 0) {
      Draw.text(ctx, 'ENTER ▶', textX + textW, panelY + panelH - 18, { size: 17, color: style.color, align: 'right', strokeWidth: 4 });
    }
    ctx.restore();
  }
}
