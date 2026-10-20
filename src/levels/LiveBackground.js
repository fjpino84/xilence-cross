// Fondo vivo: anima partes de las propias ilustraciones (telas, cadenas, cables, el generador, carteles y focos) y añade capas de
// profundidad (niebla a dos velocidades y neblina junto al suelo). Todo se mide en fracciones de la imagen, como los charcos.
//
// Cómo se mueve el dibujo sin dejar "fantasmas": cada zona se redibuja en celdas pequeñas, desplazadas según un campo suave que vale
// cero en los bordes de la zona (ventana), así la zona encaja con el dibujo que la rodea y no queda una copia quieta debajo.
//   cloth: tela colgada (ondula más abajo que arriba)   sway: péndulo (cables y cadenas)   shake: vibración (generador)
//   screen: cartel con parpadeo y fallos digitales      light: foco que pulsa y titila
const LIVE_COMMON_CABLES = [
  { type: 'sway', x: 0.13, y: 0.0, w: 0.17, h: 0.36, pivot: [0.5, 0.0], amp: 0.0045, speed: 0.9 },
  { type: 'sway', x: 0.82, y: 0.0, w: 0.16, h: 0.30, pivot: [0.5, 0.0], amp: 0.0040, speed: 0.75 },
];
const LIVE_CLOTH_TOWER = { type: 'cloth', x: 0.55, y: 0.26, w: 0.14, h: 0.20, anchor: 0.12, amp: 3.2, speed: 1.6 };
const LIVE_CHAIN = { type: 'sway', x: 0.36, y: 0.0, w: 0.15, h: 0.31, pivot: [0.2, 0.0], amp: 0.0065, speed: 0.7 };

// Grúas de los fondos (pluma y gancho). pivot de la pluma = su base; pivot del gancho = su punto de cuelgue.
const LIVE_CRANES = [
  { type: 'crane', x: 0.255, y: 0.04, w: 0.12, h: 0.25, pivot: [0.125, 0.88], amp: 0.016, speed: 0.38 },
  { type: 'sway', x: 0.335, y: 0.14, w: 0.045, h: 0.15, pivot: [0.5, 0.0], amp: 0.020, speed: 1.05 },
  { type: 'crane', x: 0.555, y: 0.09, w: 0.14, h: 0.20, pivot: [0.75, 0.90], amp: 0.014, speed: 0.31 },
  { type: 'sway', x: 0.548, y: 0.11, w: 0.04, h: 0.17, pivot: [0.5, 0.0], amp: 0.022, speed: 0.95 },
  { type: 'crane', x: 0.53, y: 0.40, w: 0.06, h: 0.11, pivot: [0.85, 0.90], amp: 0.02, speed: 0.45 },
];
const LIVE_CRANE_RIGHT = [
  { type: 'crane', x: 0.855, y: 0.22, w: 0.12, h: 0.18, pivot: [0.8, 0.85], amp: 0.015, speed: 0.36 },
  { type: 'sway', x: 0.945, y: 0.30, w: 0.03, h: 0.10, pivot: [0.5, 0.0], amp: 0.02, speed: 1.0 },
];

const LIVE_DATA = {
  bgLevel01a: [...LIVE_COMMON_CABLES, ...LIVE_CRANES],
  bgLevel01b: [...LIVE_COMMON_CABLES, ...LIVE_CRANES],
  bgLevel01c: [...LIVE_COMMON_CABLES, LIVE_CRANES[4], ...LIVE_CRANE_RIGHT],
  bgLevel01d: [...LIVE_COMMON_CABLES, ...LIVE_CRANE_RIGHT],
  bgLevel01e: [
    ...LIVE_COMMON_CABLES, LIVE_CLOTH_TOWER, LIVE_CHAIN, ...LIVE_CRANE_RIGHT,
  ],
  bgLevel01s: [
    ...LIVE_COMMON_CABLES, LIVE_CLOTH_TOWER, LIVE_CHAIN, ...LIVE_CRANE_RIGHT,
    { type: 'screen', x: 0.135, y: 0.23, w: 0.075, h: 0.19, rate: 7, seed: 1 }, // cartel de la izquierda (la parte fuera del fundido)
    { type: 'screen', x: 0.70, y: 0.27, w: 0.08, h: 0.20, rate: 5, seed: 2 }, // cartel de la derecha
    { type: 'light', x: 0.12, y: 0.03, w: 0.12, h: 0.14, rate: 3, seed: 3 }, // foco izquierdo
    { type: 'light', x: 0.80, y: 0.03, w: 0.12, h: 0.14, rate: 4, seed: 4 }, // foco derecho
  ],
  bgLevel01j: [
    { type: 'crane', x: 0.065, y: 0.20, w: 0.12, h: 0.18, pivot: [0.15, 0.9], amp: 0.016, speed: 0.34 }, // grúa del horizonte
    { type: 'sway', x: 0.13, y: 0.0, w: 0.14, h: 0.30, pivot: [0.2, 0.0], amp: 0.0040, speed: 0.8 },
    { type: 'sway', x: 0.88, y: 0.0, w: 0.11, h: 0.22, pivot: [0.5, 0.0], amp: 0.0035, speed: 0.7 },
    { type: 'cloth', x: 0.595, y: 0.06, w: 0.12, h: 0.22, anchor: 0.12, amp: 3.6, speed: 1.4 }, // trapo roto colgado del techo
    { type: 'shake', x: 0.30, y: 0.60, w: 0.11, h: 0.15, amp: 0.9 }, // generador
    { type: 'screen', x: 0.905, y: 0.17, w: 0.075, h: 0.25, rate: 6, seed: 5 }, // cartel
    { type: 'screen', x: 0.715, y: 0.16, w: 0.075, h: 0.045, rate: 9, seed: 6, soft: true }, // letrero de neón
    { type: 'light', x: 0.51, y: 0.09, w: 0.12, h: 0.08, rate: 2, seed: 7 }, // foco amarillo del techo
    { type: 'light', x: 0.77, y: 0.06, w: 0.10, h: 0.13, rate: 3, seed: 8 }, // reflector de la derecha
  ],
};


// Nivel 1 (Nuevo Level 2): zonas que se mueven (grúas, cables), letreros que parpadean y focos que laten
const LIVE_N_CRANE = (x, y, w, h, base = 0.45) => ({ type: 'crane', x, y, w, h, pivot: [base, 0.88], amp: 0.016, speed: 0.36 + (x % 0.1) });
Object.assign(LIVE_DATA, {
  bgN1: [],
  bgN2: [LIVE_N_CRANE(0.70, 0.30, 0.08, 0.14, 0.5), { type: 'sway', x: 0.2, y: 0.34, w: 0.2, h: 0.1, pivot: [0.5, 0.0], amp: 0.004, speed: 0.8 }],
  bgN3: [{ type: 'sway', x: 0.05, y: 0.2, w: 0.14, h: 0.2, pivot: [0.5, 0.0], amp: 0.004, speed: 0.7 }],
  bgN4: [LIVE_N_CRANE(0.36, 0.20, 0.12, 0.26, 0.45), { type: 'sway', x: 0.435, y: 0.22, w: 0.04, h: 0.16, pivot: [0.5, 0.0], amp: 0.02, speed: 1.0 },
    { type: 'sway', x: 0.62, y: 0.28, w: 0.2, h: 0.12, pivot: [0.5, 0.0], amp: 0.004, speed: 0.8 }],
  bgN5: [{ type: 'sway', x: 0.5, y: 0.0, w: 0.2, h: 0.28, pivot: [0.5, 0.0], amp: 0.005, speed: 0.8 }, { type: 'sway', x: 0.78, y: 0.0, w: 0.16, h: 0.26, pivot: [0.5, 0.0], amp: 0.004, speed: 0.7 },
    { type: 'screen', x: 0.63, y: 0.43, w: 0.05, h: 0.07, rate: 6, seed: 11 }, { type: 'screen', x: 0.865, y: 0.5, w: 0.045, h: 0.06, rate: 8, seed: 12 }],
  bgN6: [LIVE_N_CRANE(0.37, 0.28, 0.1, 0.2, 0.45), { type: 'sway', x: 0.52, y: 0.0, w: 0.18, h: 0.3, pivot: [0.5, 0.0], amp: 0.004, speed: 0.8 },
    { type: 'screen', x: 0.2, y: 0.47, w: 0.1, h: 0.14, rate: 6, seed: 13 }],
  bgN7: [LIVE_N_CRANE(0.36, 0.17, 0.1, 0.3, 0.45), { type: 'screen', x: 0.5, y: 0.36, w: 0.1, h: 0.09, rate: 7, seed: 14, soft: true },
    { type: 'sway', x: 0.6, y: 0.0, w: 0.2, h: 0.25, pivot: [0.5, 0.0], amp: 0.004, speed: 0.7 }],
  bgN8: [{ type: 'sway', x: 0.55, y: 0.18, w: 0.3, h: 0.14, pivot: [0.5, 0.0], amp: 0.004, speed: 0.8 }, { type: 'sway', x: 0.35, y: 0.0, w: 0.18, h: 0.2, pivot: [0.5, 0.0], amp: 0.004, speed: 0.7 }],
  bgN9: [{ type: 'screen', x: 0.45, y: 0.31, w: 0.12, h: 0.05, rate: 8, seed: 15, soft: true }, { type: 'light', x: 0.43, y: 0.34, w: 0.14, h: 0.3, rate: 3, seed: 16 },
    { type: 'sway', x: 0.62, y: 0.0, w: 0.3, h: 0.25, pivot: [0.5, 0.0], amp: 0.004, speed: 0.7 }],
  bgN10: [{ type: 'sway', x: 0.46, y: 0.0, w: 0.2, h: 0.2, pivot: [0.5, 0.0], amp: 0.004, speed: 0.8 }, { type: 'shake', x: 0.12, y: 0.62, w: 0.1, h: 0.12, amp: 0.9 }],
  bgN11: [{ type: 'screen', x: 0.1, y: 0.05, w: 0.09, h: 0.07, rate: 7, seed: 17 }, { type: 'sway', x: 0.3, y: 0.0, w: 0.2, h: 0.2, pivot: [0.5, 0.0], amp: 0.004, speed: 0.8 }],
  bgN12: [{ type: 'screen', x: 0.8, y: 0.2, w: 0.13, h: 0.1, rate: 9, seed: 18, soft: true }, { type: 'light', x: 0.62, y: 0.15, w: 0.12, h: 0.4, rate: 3, seed: 19 },
    { type: 'light', x: 0.72, y: 0.15, w: 0.12, h: 0.3, rate: 4, seed: 20 }, { type: 'sway', x: 0.2, y: 0.02, w: 0.06, h: 0.2, pivot: [0.5, 0.0], amp: 0.012, speed: 0.9 }],
});

class LiveBackground {
  static CELL_BUDGET = 90; // celdas máximas por zona y fotograma

  constructor(level) {
    this.level = level;
    this.time = 0;
    this.patches = [];
    this.fog = null;
    const sequence = level.config.backgroundSequence || [];
    sequence.forEach((tile, index) => {
      const data = LIVE_DATA[tile.key] || [];
      const origin = index * Level.TILE_STRIDE;
      // Zonas que caen en el fundido entre dos ilustraciones no se animan (se vería un parche a medio mezclar)
      const minX = index > 0 ? Level.TILE_OVERLAP + 4 : 0;
      const maxX = index < sequence.length - 1 ? Level.TILE_WIDTH - Level.TILE_OVERLAP - 4 : Level.TILE_WIDTH;
      for (const item of data) {
        const x0 = Math.max(minX, item.x * Level.TILE_WIDTH);
        const x1 = Math.min(maxX, (item.x + item.w) * Level.TILE_WIDTH);
        if (x1 - x0 < 36) continue;
        this.patches.push({
          ...item, index, origin, lx: x0, ly: item.y * CONFIG.HEIGHT, lw: x1 - x0, lh: item.h * CONFIG.HEIGHT,
          glitch: 0, nextGlitch: 1 + Math.random() * 3, phase: Math.random() * 6.28,
        });
      }
    });
  }

  update(dt) {
    this.time += dt;
    for (const patch of this.patches) {
      if (patch.type !== 'screen') continue;
      patch.glitch = Math.max(0, patch.glitch - dt);
      patch.nextGlitch -= dt;
      if (patch.nextGlitch <= 0) {
        patch.glitch = 0.1 + Math.random() * 0.1;
        patch.nextGlitch = (1.2 + Math.random() * 3.5) * (8 / (patch.rate || 6));
        patch.glitchSeed = Math.floor(Math.random() * 9999);
      }
    }
  }

  // Zona suave: 0 en el borde, 1 en el interior
  static smooth(a) {
    return a <= 0 ? 0 : a >= 1 ? 1 : a * a * (3 - 2 * a);
  }

  // Desplazamiento (dx, dy) en el punto (u, v) de la zona, para el instante t
  field(patch, u, v, t) {
    const { lw: w, lh: h } = patch;
    const margin = Math.max(8, 0.26 * Math.min(w, h));
    const window = LiveBackground.smooth(u / margin) * LiveBackground.smooth((w - u) / margin) * LiveBackground.smooth(v / margin) * LiveBackground.smooth((h - v) / margin);
    if (window <= 0) return null;
    if (patch.type === 'cloth') {
      // La tela cuelga de arriba: casi no se mueve en el anclaje y ondula más hacia abajo, con un vaivén lento y otro más rápido
      const anchor = patch.anchor * h;
      const taper = Math.max(0, Math.min(1, (v - anchor) / (h - anchor)));
      const wave = Math.sin(t * patch.speed + v * 0.07 + u * 0.035 + patch.phase) + 0.4 * Math.sin(t * patch.speed * 2.3 + v * 0.13 + patch.phase * 2);
      const dx = patch.amp * wave * (0.25 + 0.75 * taper) * window;
      const dy = 0.3 * patch.amp * Math.sin(t * patch.speed * 1.4 + u * 0.09 + patch.phase) * taper * window;
      return [dx, dy];
    }
    if (patch.type === 'sway') {
      // Péndulo: rotación pequeña alrededor del punto de anclaje, con una oscilación lenta y otra mínima más rápida
      const pu = patch.pivot[0] * w;
      const pv = patch.pivot[1] * h;
      const angle = patch.amp * (Math.sin(t * patch.speed + patch.phase) + 0.35 * Math.sin(t * patch.speed * 2.7 + patch.phase * 3)) * (0.3 + 0.7 * Math.max(0, (v - pv) / h));
      return [-angle * (v - pv) * window, angle * (u - pu) * window];
    }
    if (patch.type === 'crane') {
      // Giro lento y casi imperceptible de la pluma, con un segundo armónico para que no parezca un reloj
      const pu = patch.pivot[0] * w;
      const pv = patch.pivot[1] * h;
      const angle = patch.amp * (Math.sin(t * patch.speed + patch.phase) + 0.3 * Math.sin(t * patch.speed * 2.1 + patch.phase * 2));
      return [-angle * (v - pv) * window, angle * (u - pu) * window];
    }
    if (patch.type === 'shake') {
      const k = Math.floor(t * 28);
      const j1 = Math.sin(k * 12.9898 + patch.phase) * 43758.5453;
      const j2 = Math.sin(k * 78.233 + patch.phase) * 12345.6789;
      return [((j1 - Math.floor(j1)) - 0.5) * 2 * patch.amp * window, ((j2 - Math.floor(j2)) - 0.5) * 2 * patch.amp * 0.7 * window];
    }
    return null;
  }

  // Redibuja la zona en celdas desplazadas por el campo
  drawDisplaced(ctx, canvas, patch, sx) {
    const area = patch.lw * patch.lh;
    const cell = Math.max(8, Math.ceil(Math.sqrt(area / LiveBackground.CELL_BUDGET)));
    for (let v = 0; v < patch.lh; v += cell) {
      for (let u = 0; u < patch.lw; u += cell) {
        const d = this.field(patch, u + cell / 2, v + cell / 2, this.time);
        if (!d) continue;
        const w = Math.min(cell + 1, patch.lw - u);
        const h = Math.min(cell + 1, patch.lh - v);
        ctx.drawImage(canvas, patch.lx + u, patch.ly + v, w, h, sx + u + d[0], patch.ly + v + d[1], w, h);
      }
    }
  }

  // Parpadeo del foco o del cartel: una copia aditiva de la propia zona con intensidad variable
  drawFlicker(ctx, canvas, patch, sx, intensity) {
    if (intensity < 0.01) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(0.6, intensity);
    ctx.drawImage(canvas, patch.lx, patch.ly, patch.lw, patch.lh, sx, patch.ly, patch.lw, patch.lh);
    ctx.restore();
  }

  // Fallo digital del cartel: franjas horizontales desplazadas y una copia aditiva desplazada
  drawGlitch(ctx, canvas, patch, sx) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(sx, patch.ly, patch.lw, patch.lh);
    ctx.clip();
    let seed = patch.glitchSeed || 1;
    const random = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
    for (let y = 0; y < patch.lh; y += 5) {
      if (random() < 0.4) continue;
      const shift = (random() - 0.5) * 16;
      ctx.drawImage(canvas, patch.lx, patch.ly + y, patch.lw, 5, sx + shift, patch.ly + y, patch.lw, 5);
    }
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.35;
    ctx.drawImage(canvas, patch.lx, patch.ly, patch.lw, patch.lh, sx + 3, patch.ly, patch.lw, patch.lh);
    ctx.restore();
  }

  // Zonas animadas, encima del fondo y debajo de los personajes
  render(ctx, camera) {
    if (FX.low || typeof document === 'undefined') return;
    const t = this.time;
    for (const patch of this.patches) {
      const sx = patch.origin + patch.lx - camera.x;
      if (sx > CONFIG.WIDTH + 12 || sx + patch.lw < -12) continue;
      const canvas = this.level.tileCanvas(patch.index);
      if (!canvas) continue;
      if (patch.type === 'cloth' || patch.type === 'sway' || patch.type === 'shake' || patch.type === 'crane') {
        this.drawDisplaced(ctx, canvas, patch, sx);
      } else if (patch.type === 'screen') {
        const base = patch.soft ? 0.08 : 0.05;
        this.drawFlicker(ctx, canvas, patch, sx, base + 0.07 * Math.sin(t * 7 + patch.phase) + (patch.glitch > 0 ? 0.2 : 0));
        if (patch.glitch > 0) this.drawGlitch(ctx, canvas, patch, sx);
      } else if (patch.type === 'light') {
        // Pulso lento más titileos bruscos de vez en cuando
        const spike = Math.sin(t * 31 + patch.phase) * Math.sin(t * 17 + patch.phase * 2) > 0.93 ? 0.25 : 0;
        this.drawFlicker(ctx, canvas, patch, sx, 0.06 + 0.07 * Math.sin(t * patch.rate * 0.6 + patch.phase) + spike);
      }
    }
  }

  // ------------------------------------------------------------------ niebla

  static buildFog(seed, width, height, alpha) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const c = canvas.getContext('2d');
    const random = Draw.seededRandom(seed);
    const blobs = 40;
    for (let i = 0; i < blobs; i++) {
      const x = random() * width;
      const y = height * (0.25 + 0.5 * random());
      const rx = 260 + random() * 340;
      const ry = 30 + random() * 40;
      // Cada nube se dibuja también desplazada una vuelta, para que la tira enlace sin costuras
      for (const offset of [-width, 0, width]) {
        c.save();
        c.translate(x + offset, y);
        c.scale(1, ry / rx);
        const gradient = c.createRadialGradient(0, 0, 0, 0, 0, rx);
        const a = alpha * (0.35 + 0.4 * random());
        gradient.addColorStop(0, `rgba(150, 160, 235, ${a})`);
        gradient.addColorStop(0.5, `rgba(120, 130, 220, ${a * 0.5})`);
        gradient.addColorStop(1, 'rgba(100, 110, 210, 0)');
        c.fillStyle = gradient;
        c.beginPath();
        c.arc(0, 0, rx, 0, Math.PI * 2);
        c.fill();
        c.restore();
      }
    }
    return canvas;
  }

  // layer: 'far' | 'mid' (detrás de los personajes) | 'front' (neblina baja por delante)
  renderFog(ctx, camera, layer) {
    if (FX.low || typeof document === 'undefined') return;
    // En dispositivos de potencia media la niebla del fondo se pinta una vez por fotograma y se reutiliza (far+mid juntas)
    if (layer === 'mid' && this.fogCombined) return;
    if (!this.fog) {
      this.fog = {
        far: LiveBackground.buildFog(101, 1800, 170, 0.22),
        mid: LiveBackground.buildFog(202, 1500, 190, 0.18),
        front: LiveBackground.buildFog(303, 1300, 150, 0.11),
      };
    }
    const settings = {
      far: { parallax: 0.35, drift: 7, y: CONFIG.HEIGHT * 0.38, alpha: 0.7 },
      mid: { parallax: 0.7, drift: -11, y: CONFIG.HEIGHT * 0.58, alpha: 0.6 },
      front: { parallax: 1.2, drift: 15, y: CONFIG.HEIGHT * 0.82, alpha: 0.5 },
    }[layer];
    const strip = this.fog[layer];
    const scroll = camera.x * settings.parallax + this.time * settings.drift;
    const offset = -(((scroll % strip.width) + strip.width) % strip.width);
    ctx.save();
    ctx.globalAlpha = settings.alpha;
    for (let x = offset; x < CONFIG.WIDTH; x += strip.width) ctx.drawImage(strip, Math.round(x), Math.round(settings.y));
    ctx.restore();
  }
}
