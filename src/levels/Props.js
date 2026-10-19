// Objetos de escenario (assets/sprites/props): segundo y tercer plano hechos con sprites reales sobre el fondo ilustrado.
//  · plano trasero ('back'): objetos pequeños y algo apagados a la altura del horizonte, detrás de los personajes y bajo la niebla;
//    se mueven con el escenario (parallax 1) y sus luces laten.
//  · plano delantero ('front'): objetos grandes y oscuros pegados al borde inferior, delante de los personajes, con más parallax.
// La colocación sale de una semilla fija por escenario: es la misma en cada partida y no depende del azar de los fondos.
class Props {
  static FRONT_PARALLAX = 1.0; // pegados a la unión: se mueven exactamente con el escenario
  // h: altura en pantalla (px). lights: [fracción x, fracción y, color, radio] de luces que laten. flicker: parpadeo del cartel
  static DEFS = {
    torre: { h: 190, lights: [[0.20, 0.72, '#ff3a3a', 26, 1.1]] },
    balizas: { h: 205, lights: [[0.40, 0.03, '#ff2a2a', 30, 0.9], [0.80, 0.14, '#ff2a2a', 22, 0.7], [0.78, 0.25, '#ff2a2a', 22, 1.3]] },
    valla: { h: 285 },
    cartel: { h: 285, flicker: true },
    foco: { h: 175, lights: [[0.42, 0.14, '#cfe9ff', 64, 0.6]] },
    grua: { h: 190 },
    carrete: { h: 270 },
    pila: { h: 250 },
    tuberia: { h: 235 },
    generador: { h: 255, lights: [[0.22, 0.45, '#8ff6ff', 22, 3.0]] },
  };
  // Objetos casuales para tapar las uniones (sin la torre-reactor ni las torres altas). h = altura grande en pantalla.
  static SEAM = ['pila', 'tuberia', 'carrete', 'valla', 'generador', 'cartel'];

  constructor(level) {
    this.time = 0;
    this.back = []; // ya no se usan objetos de fondo
    this.front = [];
    const sequence = level.config.backgroundSequence || [];
    // Un objeto casual y grande sobre cada unión entre escenarios: tapa el cambio de dibujo y ECO pasa por detrás al avanzar.
    let previous = '';
    for (let index = 1; index < sequence.length; index++) {
      const random = Draw.seededRandom(9100 + index * 131);
      let name;
      do { name = Props.SEAM[Math.floor(random() * Props.SEAM.length)]; } while (name === previous);
      previous = name;
      const x = index * Level.TILE_STRIDE + Level.TILE_OVERLAP / 2 + (random() - 0.5) * 40;
      this.front.push({ name, x, scale: 1, flip: random() < 0.5, phase: random() * 6.28 });
    }
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

  // Objetos grandes sobre las uniones, delante de los personajes y pegados al borde inferior (parte fuera de pantalla).
  // Si ECO está justo detrás, el objeto se vuelve translúcido para no taparlo del todo.
  renderFront(ctx, camera, player) {
    for (const item of this.front) {
      const sx = item.x - camera.x;
      if (sx < -360 || sx > CONFIG.WIDTH + 360) continue;
      const def = Props.DEFS[item.name];
      const image = Assets.image('prop_' + item.name);
      const halfWidth = image ? (image.width / image.height) * def.h * 0.5 : 200;
      let alpha = 0.97;
      if (player) {
        const near = Math.abs(player.x - item.x) < halfWidth * 0.8;
        item.fade = (item.fade === undefined ? 1 : item.fade) + ((near ? 0.42 : 1) - (item.fade === undefined ? 1 : item.fade)) * 0.12;
        alpha *= item.fade;
      }
      this.drawProp(ctx, item, sx, CONFIG.HEIGHT + 34, { color: '#05030c', alpha: 0.3 }, alpha, false);
    }
  }
}
