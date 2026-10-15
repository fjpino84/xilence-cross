// HUD de rock: retrato en púa de guitarra, barra de vida de metal con "daño fantasma", medidor de amplificador
// por LEDs, marcador con cifras que ruedan, combo por niveles (¡RIFF!, ¡SOLO!…) y banner de nivel.
class HUD {
  static CONTROLS_HINT_TIME = 9;
  static BANNER_TIME = 3;
  static GHOST_DELAY = 0.5;
  static GHOST_DECAY = 0.7; // fracción de la vida por segundo

  // Niveles de combo: golpes mínimos, palabra y colores [reflejo, color, horizonte]
  static COMBO_TIERS = [
    { hits: 2, word: 'COMBO', colors: ['#ffffff', '#ffe600', '#c46a00'], glow: '#ffb000' },
    { hits: 4, word: '¡RIFF!', colors: ['#ffffff', '#00f5ff', '#0070a0'], glow: '#00f5ff' },
    { hits: 7, word: '¡SOLO!', colors: ['#ffffff', '#ffe600', '#d05a00'], glow: '#ff9a00' },
    { hits: 11, word: '¡ROCKEANDO!', colors: ['#ffffff', '#ff7a1a', '#b01800'], glow: '#ff4000' },
    { hits: 16, word: '¡LEYENDA!', colors: ['#ffffff', '#ff2a5a', '#7a0030'], glow: '#ff003c' },
  ];

  constructor(levelName) {
    const [number, place] = levelName.split(' — ');
    this.levelNumber = number.toUpperCase();
    this.levelPlace = (place || '').toUpperCase();
    this.time = 0;
    this.lastFrameTime = 0;
    this.lastCombo = 0;
    this.comboPop = 0; // anima el contador cada vez que sube
    this.ghostHp = 1;
    this.ghostDelay = 0;
    this.lastHpRatio = 1;
    this.shownScore = 0;
    this.scorePop = 0;
    this.lastScore = 0;
    this.portrait = null;
  }

  update(dt) {
    this.time += dt;
    this.comboPop = Math.max(0, this.comboPop - dt);
    this.scorePop = Math.max(0, this.scorePop - dt);
    this.ghostDelay = Math.max(0, this.ghostDelay - dt);
  }

  render(ctx, player, level, trino) {
    const frameDt = Math.max(0, Math.min(0.1, this.time - this.lastFrameTime));
    this.lastFrameTime = this.time;
    this.trackChanges(player, frameDt);

    const fading = this.finaleStart !== undefined;
    if (fading) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - (this.time - this.finaleStart) * 1.2);
    }
    this.renderPortrait(ctx, player);
    this.renderHealth(ctx, player);
    this.renderAmp(ctx, player);
    this.renderTrino(ctx, trino);
    this.renderScore(ctx);
    this.renderWaves(ctx, level);
    this.renderCombo(ctx, player);
    this.renderBanner(ctx);
    this.renderAdvance(ctx, level);
    this.renderControlsHint(ctx);
    if (fading) ctx.restore();
  }

  // Detecta golpes recibidos (vida fantasma), combos nuevos y puntos ganados
  trackChanges(player, dt) {
    const hpRatio = player.hp / player.maxHp;
    if (hpRatio < this.lastHpRatio - 0.001) this.ghostDelay = HUD.GHOST_DELAY;
    else if (hpRatio > this.ghostHp) this.ghostHp = hpRatio; // al curarse no hay fantasma
    this.lastHpRatio = hpRatio;
    if (this.ghostDelay <= 0 && this.ghostHp > hpRatio) this.ghostHp = Math.max(hpRatio, this.ghostHp - HUD.GHOST_DECAY * dt);

    if (player.comboHits > this.lastCombo) this.comboPop = 0.2;
    this.lastCombo = player.comboHits;

    if (player.score > this.lastScore) this.scorePop = 0.22;
    this.lastScore = player.score;
    // Las cifras ruedan hacia el valor real
    const gap = player.score - this.shownScore;
    this.shownScore += Math.abs(gap) < 1 ? gap : gap * Math.min(1, dt * 9);
  }

  // --- Retrato dentro de una púa de guitarra con marco de metal y neón ---
  pickPath(ctx, x, y, w, h) {
    ctx.beginPath();
    ctx.moveTo(x + w * 0.5, y + h);
    ctx.bezierCurveTo(x + w * 0.05, y + h * 0.78, x - w * 0.04, y + h * 0.25, x + w * 0.18, y + h * 0.06);
    ctx.quadraticCurveTo(x + w * 0.5, y - h * 0.04, x + w * 0.82, y + h * 0.06);
    ctx.bezierCurveTo(x + w * 1.04, y + h * 0.25, x + w * 0.95, y + h * 0.78, x + w * 0.5, y + h);
    ctx.closePath();
  }

  renderPortrait(ctx, player) {
    const [x, y, w, h] = [14, 8, 92, 104];
    const low = player.hp / player.maxHp < 0.3 && player.isAlive;
    ctx.save();
    // Resplandor: cian normal, rojo palpitante con poca vida
    ctx.shadowColor = low ? CONFIG.COLORS.RED : CONFIG.COLORS.CYAN;
    ctx.shadowBlur = low ? 14 + 10 * Math.abs(Math.sin(this.time * 7)) : 12;
    this.pickPath(ctx, x, y, w, h);
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.shadowBlur = 0;

    // Marco metálico
    this.pickPath(ctx, x + 2, y + 2, w - 4, h - 4);
    ctx.fillStyle = Draw.metal(ctx, y, h);
    ctx.fill();

    // Retrato recortado a la púa
    this.pickPath(ctx, x + 7, y + 7, w - 14, h - 16);
    ctx.save();
    ctx.clip();
    ctx.fillStyle = '#0b0b2a';
    ctx.fillRect(x, y, w, h);
    if (this.portrait) ctx.drawImage(this.portrait, x + 4, y + 4, w - 8, w - 8);
    if (low) {
      ctx.fillStyle = `rgba(255, 0, 60, ${0.12 + 0.14 * Math.abs(Math.sin(this.time * 7))})`;
      ctx.fillRect(x, y, w, h);
    }
    ctx.restore();

    // Filete interior de neón
    this.pickPath(ctx, x + 7, y + 7, w - 14, h - 16);
    ctx.strokeStyle = low ? CONFIG.COLORS.RED : CONFIG.COLORS.CYAN;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  // --- Barra de vida: metal, segmentos, brillo móvil y vida fantasma ---
  // Las piezas estáticas (marco, relleno, muescas) se pintan una vez en lienzos pequeños y luego solo se copian:
  // dibujarlas cada fotograma con recortes de trazado costaba ~40 ms sin aceleración gráfica (un solo trazo de muescas, 35 ms).
  static BAR = { x: 112, y: 34, w: 310, h: 28, slant: 16, pad: 30 };

  static barAssets(maxHp) {
    if (HUD.barCache && HUD.barCache.maxHp === maxHp) return HUD.barCache;
    const { w, h, slant, pad } = HUD.BAR;
    const make = (draw) => {
      const canvas = document.createElement('canvas');
      canvas.width = w + pad * 2;
      canvas.height = h + pad * 2;
      draw(canvas.getContext('2d'));
      return canvas;
    };
    const fill = (colors) => make((c) => {
      const gradient = c.createLinearGradient(0, pad, 0, pad + h);
      colors.forEach((color, i) => gradient.addColorStop(i / 2, color));
      Draw.parallelogram(c, pad, pad, w, h, slant);
      c.fillStyle = gradient;
      c.fill();
      c.globalCompositeOperation = 'source-atop'; // el reflejo superior solo afecta al relleno
      c.fillStyle = 'rgba(255, 255, 255, 0.28)';
      c.fillRect(pad, pad, w, h * 0.32);
    });

    const shine = document.createElement('canvas');
    shine.width = 50;
    shine.height = h;
    const sc = shine.getContext('2d');
    const sg = sc.createLinearGradient(0, 0, 50, 0);
    sg.addColorStop(0, 'rgba(255,255,255,0)');
    sg.addColorStop(0.5, 'rgba(255,255,255,0.35)');
    sg.addColorStop(1, 'rgba(255,255,255,0)');
    sc.fillStyle = sg;
    sc.fillRect(0, 0, 50, h);

    HUD.barCache = {
      maxHp,
      frame: make((c) => {
        Draw.parallelogram(c, pad - 5, pad - 5, w + 10, h + 10, slant);
        c.fillStyle = '#000';
        c.fill();
        Draw.parallelogram(c, pad - 3, pad - 3, w + 6, h + 6, slant);
        c.fillStyle = Draw.metal(c, pad - 3, h + 6);
        c.fill();
        Draw.parallelogram(c, pad, pad, w, h, slant);
        c.fillStyle = '#07070f';
        c.fill();
      }),
      glow: make((c) => {
        c.shadowColor = CONFIG.COLORS.RED;
        c.shadowBlur = 20;
        Draw.parallelogram(c, pad - 5, pad - 5, w + 10, h + 10, slant);
        c.fillStyle = '#000';
        c.fill();
      }),
      ghost: make((c) => {
        Draw.parallelogram(c, pad, pad, w, h, slant);
        c.fillStyle = '#ffe9a8';
        c.fill();
      }),
      fillNormal: fill(['#ffb066', '#ff2a2a', '#6a0010']),
      fillLow: fill(['#ff7a7a', '#ff0030', '#5a0010']),
      notches: make((c) => {
        // Muescas cada 10 puntos de vida, inclinadas como la barra
        c.strokeStyle = 'rgba(0, 0, 0, 0.55)';
        c.lineWidth = 2;
        c.beginPath();
        const segments = maxHp / 10;
        for (let i = 1; i < segments; i++) {
          const sx = pad + (w * i) / segments;
          c.moveTo(sx + slant, pad);
          c.lineTo(sx, pad + h);
        }
        c.stroke();
      }),
      shine,
    };
    return HUD.barCache;
  }

  renderHealth(ctx, player) {
    const { x, y, w, h, pad } = HUD.BAR;
    const assets = HUD.barAssets(player.maxHp);
    const ratio = Math.max(0, player.hp / player.maxHp);
    const low = ratio < 0.3 && player.isAlive;
    const beat = low ? 0.5 + 0.5 * Math.sin(this.time * 9) : 0;
    const left = x - pad;
    const top = y - pad;

    Draw.rock(ctx, 'ECO', x + 4, y - 7, {
      size: 27, colors: ['#ffffff', '#00f5ff', '#00608f'], glow: CONFIG.COLORS.CYAN, glowBlur: 10, rim: '#00323f',
    });

    // Con poca vida el marco late en rojo
    if (low) {
      ctx.save();
      ctx.globalAlpha *= 0.35 + 0.65 * beat;
      ctx.drawImage(assets.glow, left, top);
      ctx.restore();
    }
    ctx.drawImage(assets.frame, left, top);

    // Un trozo de una textura: la barra se "recorta" por el ancho, sin recortes de trazado
    const slice = (canvas, width) => {
      if (width < 1) return;
      const sliceWidth = Math.min(w + 2, width + 1);
      ctx.drawImage(canvas, pad - 1, 0, sliceWidth, canvas.height, x - 1, top, sliceWidth, canvas.height);
    };
    slice(assets.ghost, w * this.ghostHp); // daño fantasma: el trozo recién perdido
    const fillW = w * ratio;
    slice(low ? assets.fillLow : assets.fillNormal, fillW);

    // Brillo diagonal que recorre la barra, limitado a la parte llena
    const sweep = x - 60 + ((this.time * 120) % (w + 160));
    const from = Math.max(sweep, x);
    const to = Math.min(sweep + 50, x + fillW);
    if (to > from) ctx.drawImage(assets.shine, from - sweep, 0, to - from, h, from, y, to - from, h);

    ctx.drawImage(assets.notches, left, top);

    // Cifra de vida sobre la barra
    Draw.rock(ctx, String(Math.ceil(player.hp)), x + w - HUD.BAR.slant - 8, y + h - 5, {
      size: 20, align: 'right', colors: ['#ffffff', '#ffffff', '#c8c8d8'], outlineWidth: 4,
    });
  }

  // --- Medidor de amplificador: LEDs que suben con la energía ---
  renderAmp(ctx, player) {
    const [x, y, segW, segH, gap, slant] = [112, 70, 11, 15, 2, 5];
    const count = 22;
    const ratio = Math.max(0, Math.min(1, player.energy / Player.MAX_ENERGY));
    const lit = Math.ceil(ratio * count - 1e-6);
    const full = player.energyFull;

    // Chasis del amplificador
    const totalW = count * (segW + gap) + 10;
    ctx.save();
    if (full) {
      ctx.shadowColor = CONFIG.COLORS.YELLOW;
      ctx.shadowBlur = 10 + 10 * Math.abs(Math.sin(this.time * 12));
    }
    Draw.parallelogram(ctx, x - 6, y - 5, totalW + 6, segH + 10, slant + 2);
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.shadowBlur = 0;
    Draw.parallelogram(ctx, x - 4, y - 3, totalW + 2, segH + 6, slant + 2);
    ctx.fillStyle = Draw.metal(ctx, y - 3, segH + 6);
    ctx.fill();
    Draw.parallelogram(ctx, x - 2, y - 1, totalW - 2, segH + 2, slant + 1);
    ctx.fillStyle = '#07070f';
    ctx.fill();

    for (let i = 0; i < count; i++) {
      const sx = x + 2 + i * (segW + gap);
      const t = i / (count - 1);
      const on = i < lit;
      let color;
      if (full) color = Math.floor(this.time * 10 + i) % 2 === 0 ? '#ffffff' : CONFIG.COLORS.YELLOW;
      else if (t < 0.6) color = CONFIG.COLORS.CYAN;
      else if (t < 0.85) color = CONFIG.COLORS.YELLOW;
      else color = '#ff5a30';

      Draw.parallelogram(ctx, sx, y + 1, segW, segH, slant);
      if (on) {
        // Rebote tipo ecualizador: los LEDs "respiran" a distinto ritmo
        const bounce = 0.78 + 0.22 * Math.sin(this.time * 9 + i * 0.7);
        ctx.shadowColor = color;
        ctx.shadowBlur = 7;
        ctx.globalAlpha = full ? 1 : bounce;
        ctx.fillStyle = color;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.fillRect(sx + slant * 0.5, y + 2, segW - slant * 0.5, 3);
      } else {
        ctx.fillStyle = '#161a28';
        ctx.fill();
      }
    }
    ctx.restore();

    Draw.rock(ctx, 'AMP', x + totalW + 6, y + 14, {
      size: 17, colors: ['#ffffff', '#00f5ff', '#00608f'], outlineWidth: 4, rim: '#00323f',
    });
    if (full) {
      // Aviso a la derecha del medidor, latiendo
      const pulse = 1 + 0.1 * Math.abs(Math.sin(this.time * 10));
      Draw.rock(ctx, '¡AL MÁXIMO! [L]', x + totalW + 52, y + 15, {
        size: 21 * pulse, colors: ['#ffffff', '#ffe600', '#e05a00'], glow: '#ff9a00', glowBlur: 16, rim: '#5a2a00',
      });
    }
  }

  // --- Recarga del ataque de Trino ---
  renderTrino(ctx, trino) {
    if (!trino) return;
    const [x, y, w, h] = [112, 96, 120, 8];
    const ready = trino.readiness >= 1;
    const flash = ready && Math.floor(this.time * 6) % 2 === 0;
    const fill = w * Math.min(1, trino.readiness);

    ctx.save();
    Draw.parallelogram(ctx, x - 2, y - 2, w + 4, h + 4, 4);
    ctx.fillStyle = '#000';
    ctx.fill();
    Draw.parallelogram(ctx, x, y, w, h, 4);
    ctx.fillStyle = '#10141f';
    ctx.fill();
    ctx.clip();
    ctx.fillStyle = flash ? '#ffffff' : '#2ee6c8';
    ctx.fillRect(x, y, fill, h);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(x, y, fill, 3);
    ctx.restore();

    const label = trino.state === 'charge' ? 'TRINO ¡CARGA!' : (ready ? 'TRINO LISTO' : 'TRINO');
    Draw.rock(ctx, label, x + w + 8, y + 9, {
      size: 13, colors: ['#ffffff', '#2ee6c8', '#0a6a5a'], outlineWidth: 3, tracking: 1,
    });
  }

  // --- Marcador: cifras que ruedan y saltan al sumar ---
  renderScore(ctx) {
    const pop = 1 + this.scorePop * 1.6;
    const [right, top] = [CONFIG.WIDTH - 20, 14];

    ctx.save();
    // Placa de metal inclinada
    Draw.parallelogram(ctx, right - 250, top, 250, 62, 18);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.fill();
    ctx.strokeStyle = Draw.metal(ctx, top, 62, 'gold');
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();

    Draw.rock(ctx, 'PUNTOS', right - 22, top + 18, {
      size: 15, align: 'right', colors: ['#ffffff', '#c9a6ff', '#5a2ab0'], tracking: 2, outlineWidth: 4,
    });
    Draw.rock(ctx, String(Math.round(this.shownScore)).padStart(6, '0'), right - 20, top + 56, {
      size: 40 * pop, align: 'right', colors: ['#ffffff', '#ffe600', '#c46a00'], glow: '#ffb000', glowBlur: 8 + this.scorePop * 60, rim: '#5a3400',
    });
  }

  // --- Progreso del nivel: un rombo por oleada (lleno = superada, parpadeo = en curso) ---
  renderWaves(ctx, level) {
    const waves = level.waves;
    const right = CONFIG.WIDTH - 24;
    const top = 100;
    const spacing = 26;
    Draw.rock(ctx, 'OLEADAS', right - waves.length * spacing - 8, top + 12, {
      size: 14, align: 'right', colors: ['#ffffff', '#c9a6ff', '#5a2ab0'], tracking: 2, outlineWidth: 4,
    });
    ctx.save();
    waves.forEach((wave, index) => {
      const cx = right - (waves.length - 1 - index) * spacing - 8;
      const cy = top + 6;
      const active = wave.started && !wave.cleared;
      const blink = active && Math.floor(this.time * 4) % 2 === 0;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 10);
      ctx.lineTo(cx + 10, cy);
      ctx.lineTo(cx, cy + 10);
      ctx.lineTo(cx - 10, cy);
      ctx.closePath();
      ctx.fillStyle = wave.cleared ? CONFIG.COLORS.YELLOW : (blink ? CONFIG.COLORS.RED : '#10141f');
      ctx.shadowColor = wave.cleared ? '#ffb000' : (active ? CONFIG.COLORS.RED : 'transparent');
      ctx.shadowBlur = wave.cleared || active ? 10 : 0;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#000';
      ctx.stroke();
    });
    ctx.restore();
  }

  // --- Combo por niveles con medidor de tiempo restante ---
  renderCombo(ctx, player) {
    const hits = player.comboHits;
    if (hits < 2) return;
    const tier = [...HUD.COMBO_TIERS].reverse().find((candidate) => hits >= candidate.hits);
    const pop = 1 + this.comboPop * 2.4;
    const shake = this.comboPop > 0 ? (Math.random() - 0.5) * 7 * (this.comboPop / 0.2) : 0;
    const [x, y] = [22 + shake, 186 + shake];

    Draw.rock(ctx, tier.word, x, y - 56, {
      size: 32 * (tier.hits >= 7 ? 1.1 : 1), colors: tier.colors, glow: tier.glow, glowBlur: 12 + tier.hits, rim: '#000', skew: 0.24,
    });
    Draw.rock(ctx, `x${hits}`, x, y + 12, {
      size: Math.min(86, 56 + hits * 1.6) * pop, colors: tier.colors, glow: tier.glow, glowBlur: 12 + this.comboPop * 70, rim: '#190800',
    });

    // Medidor de tiempo: si se agota, el combo se pierde
    const left = Math.max(0, player.comboTimer / Player.COMBO_RESET_TIME);
    ctx.save();
    Draw.parallelogram(ctx, x - 2, y + 24, 164, 9, 5);
    ctx.fillStyle = '#000';
    ctx.fill();
    Draw.parallelogram(ctx, x, y + 26, Math.max(6, 160 * left), 5, 3);
    ctx.fillStyle = left < 0.35 ? CONFIG.COLORS.RED : tier.colors[1];
    ctx.shadowColor = tier.glow;
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.restore();
  }

  // --- Banner de nivel: entra de golpe, se sostiene y se desvanece ---
  renderBanner(ctx) {
    const t = this.time;
    if (t > HUD.BANNER_TIME) return;
    const slam = Math.min(1, t / 0.22);
    const scale = 1 + (1 - slam) * (1 - slam) * 1.8;
    const fade = t > HUD.BANNER_TIME - 0.6 ? (HUD.BANNER_TIME - t) / 0.6 : 1;
    const shake = t < 0.4 ? (Math.random() - 0.5) * 10 * (1 - t / 0.4) : 0;
    const cx = CONFIG.WIDTH / 2;
    const cy = 190;

    ctx.save();
    ctx.globalAlpha = fade * Math.min(1, slam * 1.4);
    // Franja oscura con filetes de neón que se abren desde el centro
    const half = 380 * Math.min(1, t / 0.3);
    ctx.fillStyle = 'rgba(2, 2, 12, 0.72)';
    ctx.fillRect(cx - half, cy - 74, half * 2, 124);
    ctx.fillStyle = CONFIG.COLORS.CYAN;
    ctx.shadowColor = CONFIG.COLORS.CYAN;
    ctx.shadowBlur = 12;
    ctx.fillRect(cx - half, cy - 74, half * 2, 3);
    ctx.fillRect(cx - half, cy + 47, half * 2, 3);
    ctx.shadowBlur = 0;

    ctx.translate(cx + shake, cy + shake);
    ctx.scale(scale, scale);
    Draw.rock(ctx, this.levelNumber, 0, -2, {
      size: 70, align: 'center', colors: ['#ffffff', '#00f5ff', '#005e8a'], glow: CONFIG.COLORS.CYAN, glowBlur: 22, rim: '#00323f', tracking: 4,
    });
    Draw.rock(ctx, this.levelPlace, 0, 32, {
      size: 28, align: 'center', colors: ['#ffffff', '#ffe600', '#c46a00'], glow: '#ffb000', glowBlur: 10, rim: '#3a2000', tracking: 6,
    });
    ctx.restore();
  }

  // --- Flecha de avance con rebote ---
  renderAdvance(ctx, level) {
    if (level.locked || level.completed) return;
    if (Math.floor(this.time * 2.5) % 2 === 0) return;
    const bounce = Math.sin(this.time * 12) * 6;
    Draw.rock(ctx, '¡AVANZA!', CONFIG.WIDTH - 96 + bounce, CONFIG.HEIGHT / 2 - 40, {
      size: 44, align: 'right', colors: ['#ffffff', '#ffe600', '#d06000'], glow: '#ffb000', glowBlur: 16, rim: '#4a2400',
    });
    Draw.rock(ctx, '▶▶', CONFIG.WIDTH - 26 + bounce, CONFIG.HEIGHT / 2 - 40, {
      size: 40, align: 'right', colors: ['#ffffff', '#ffe600', '#d06000'], glow: '#ffb000', glowBlur: 16, rim: '#4a2400', skew: 0,
    });
  }

  renderControlsHint(ctx) {
    if (TouchControls.enabled) return; // en el teléfono los botones ya están a la vista
    if (this.time > HUD.CONTROLS_HINT_TIME) return;
    const fade = Math.min(1, (HUD.CONTROLS_HINT_TIME - this.time) / 1.5);
    ctx.save();
    ctx.globalAlpha = fade;
    Draw.text(ctx, 'WASD/flechas mover · Espacio saltar · J golpe · K rayo (mantén para cargar) · L súper · Shift bloquear · P pausa · M sonido', CONFIG.WIDTH / 2, CONFIG.HEIGHT - 14, {
      size: 16, color: '#ffffff', align: 'center', strokeWidth: 4,
    });
    ctx.restore();
  }
}
