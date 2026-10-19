// Objetos de escenario (assets/sprites/props): segundo y tercer plano hechos con sprites reales sobre el fondo ilustrado.
//  · plano trasero ('back'): objetos pequeños y algo apagados a la altura del horizonte, detrás de los personajes y bajo la niebla;
//    se mueven con el escenario (parallax 1) y sus luces laten.
//  · plano delantero ('front'): objetos grandes y oscuros pegados al borde inferior, delante de los personajes, con más parallax.
// La colocación sale de una semilla fija por escenario: es la misma en cada partida y no depende del azar de los fondos.
class Props {
  static FRONT_PARALLAX = 1.28;
  // h: altura en pantalla (px). lights: [fracción x, fracción y, color, radio] de luces que laten. flicker: parpadeo del cartel
  static DEFS = {
    torre: { h: 190, lights: [[0.20, 0.72, '#ff3a3a', 26, 1.1]] },
    balizas: { h: 205, lights: [[0.40, 0.03, '#ff2a2a', 30, 0.9], [0.80, 0.14, '#ff2a2a', 22, 0.7], [0.78, 0.25, '#ff2a2a', 22, 1.3]] },
    valla: { h: 132 },
    cartel: { h: 128, flicker: true },
    foco: { h: 175, lights: [[0.42, 0.14, '#cfe9ff', 64, 0.6]] },
    grua: { h: 190 },
    carrete: { h: 112 },
    pila: { h: 84 },
    tuberia: { h: 90 },
    generador: { h: 108, lights: [[0.22, 0.45, '#8ff6ff', 22, 3.0]] },
  };
  static BACK = ['torre', 'balizas', 'valla', 'cartel', 'foco', 'grua', 'carrete', 'pila', 'generador'];
  static FRONT = ['pila', 'tuberia', 'carrete', 'valla', 'generador'];

  constructor(level) {
    this.time = 0;
    this.back = [];
    this.front = [];
    const sequence = level.config.backgroundSequence || [];
    const special = new Set(['bgLevel01s', 'bgLevel01j']);
    sequence.forEach((tile, index) => {
      const random = Draw.seededRandom(7000 + index * 97 + tile.key.length * 13);
      const origin = index * Level.TILE_STRIDE;
      // Plano trasero: uno o dos objetos por escenario, evitando repetir el mismo
      const count = special.has(tile.key) ? 1 : 2;
      const used = new Set();
      for (let k = 0; k < count; k++) {
        let name;
        do { name = Props.BACK[Math.floor(random() * Props.BACK.length)]; } while (used.has(name));
        used.add(name);
        const x = origin + Level.TILE_OVERLAP + 60 + (k + 0.15 + random() * 0.6) * ((Level.TILE_WIDTH - Level.TILE_OVERLAP * 2 - 120) / count);
        this.back.push({ name, x, y: CONFIG.GROUND_TOP - 4 + random() * 8, scale: 0.72 + random() * 0.18, flip: random() < 0.5, phase: random() * 6.28 });
      }
      // Plano delantero: ni en el sub jefe ni en el jefe (para no tapar el combate), y no siempre
      if (!special.has(tile.key) && random() < 0.8) {
        const name = Props.FRONT[Math.floor(random() * Props.FRONT.length)];
        const x = (origin + 140 + random() * (Level.TILE_STRIDE - 360)) * Props.FRONT_PARALLAX;
        this.front.push({ name, x, scale: 0.8 + random() * 0.45, flip: random() < 0.5, phase: random() * 6.28 });
      }
    });
    this.back.sort((a, b) => a.x - b.x);
  }

  update(dt) {
    this.time += dt;
  }

  // Dibuja un objeto con su base en (x, y); tint = capa de color encima (apagado o siluetado)
  drawProp(ctx, item, sx, sy, tint, alpha, lightsOn) {
    const def = Props.DEFS[item.name];
    const image = Assets.image('prop_' + item.name);
    if (!image) return;
    const height = def.h * item.scale;
    const width = (image.width / image.height) * height;
    Sprite.draw(ctx, image, { x: sx, y: sy, height, anchorX: 0.5, facing: item.flip ? -1 : 1, tint, alpha });
    if (!lightsOn) return;
    const t = this.time;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const [fx, fy, color, radius, rate] of def.lights || []) {
      const lx = sx + ((item.flip ? 1 - fx : fx) - 0.5) * width;
      const ly = sy - height + fy * height;
      const pulse = 0.5 + 0.5 * Math.sin(t * rate * 3 + item.phase);
      const size = radius * item.scale * (1.2 + 0.5 * pulse);
      ctx.globalAlpha = (0.35 + 0.5 * pulse) * alpha;
      ctx.drawImage(Atmosphere.glowSprite(color), lx - size, ly - size, size * 2, size * 2);
    }
    if (def.flicker) {
      // El cartel parpadea con fallos de vez en cuando
      const glitch = Math.sin(t * 23 + item.phase) * Math.sin(t * 7.3 + item.phase) > 0.8 ? 0.5 : 0;
      ctx.globalAlpha = Math.max(0, (0.1 + 0.08 * Math.sin(t * 6 + item.phase) + glitch) * alpha);
      ctx.drawImage(image, sx - width / 2, sy - height, width, height);
    }
    ctx.restore();
  }

  // Plano trasero: antes de los personajes. Se apaga un poco (neblina y color del horizonte).
  renderBack(ctx, camera) {
    for (const item of this.back) {
      const sx = item.x - camera.x;
      if (sx < -220 || sx > CONFIG.WIDTH + 220) continue;
      this.drawProp(ctx, item, sx, item.y, { color: '#1b1a45', alpha: 0.38 }, 0.94, !FX.low);
    }
  }

  // Plano delantero: después de los personajes, oscuro y pegado al borde inferior (parte fuera de pantalla)
  renderFront(ctx, camera) {
    const scroll = camera.x * Props.FRONT_PARALLAX;
    for (const item of this.front) {
      const sx = item.x - scroll;
      if (sx < -320 || sx > CONFIG.WIDTH + 320) continue;
      this.drawProp(ctx, item, sx, CONFIG.HEIGHT + 22, { color: '#05030c', alpha: 0.62 }, 0.97, false);
    }
  }
}
