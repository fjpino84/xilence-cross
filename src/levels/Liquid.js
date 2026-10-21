// Líquido verde del suelo: lo detecta en las ilustraciones por su color (la parte verde y cian muy brillante de la mitad baja) y le da vida:
//  · brillo que late y destellos de luz que recorren la superficie (dos capas que se mueven en distinto sentido);
//  · reflejo ondulado de los personajes que están sobre él y un resplandor verde bajo sus pies;
//  · ondas que se abren al caminar o pelear sobre el líquido, burbujas que suben y revientan y un poco de vapor;
//  · lo reconoce también para las salpicaduras (Level.puddleAt), con la forma real del líquido y no solo con elipses.
// Todo se apaga con ?fx=low.
class Liquid {
  static SCREEN_W = CONFIG.WIDTH;
  static SCREEN_H = CONFIG.HEIGHT;

  constructor(level) {
    this.level = level;
    this.time = 0;
    this.masks = [];
    this.ripples = [];
    this.bubbles = [];
    this.steam = [];
    this.bubbleBudget = 0;
    this.steamBudget = 0;
    this.maskFrame = -1;
    this.frame = 0;
    level.liquid = this;
    if (typeof document === 'undefined') return;
    if (FX.low) return; // sin lienzos de pantalla en modo ligero
    const make = () => { const c = document.createElement('canvas'); c.width = Liquid.SCREEN_W; c.height = Liquid.SCREEN_H; return c; };
    this.screenMask = make();
    this.shimmerCanvas = make();
    this.reflectCanvas = make();
    this.caustic = this.buildCaustic();
  }

  // Textura repetible de destellos: manchas suaves y arcos finos, como la luz que se refracta en el agua
  buildCaustic() {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const c = canvas.getContext('2d');
    const random = Draw.seededRandom(4242);
    c.lineCap = 'round';
    const wrapped = (draw) => { for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) { c.save(); c.translate(ox, oy); draw(); c.restore(); } };
    for (let i = 0; i < 70; i++) {
      const x = random() * size;
      const y = random() * size;
      const r = 6 + random() * 20;
      wrapped(() => {
        const g = c.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, 'rgba(230, 255, 245, 0.55)');
        g.addColorStop(1, 'rgba(230, 255, 245, 0)');
        c.fillStyle = g;
        c.beginPath();
        c.arc(x, y, r, 0, Math.PI * 2);
        c.fill();
      });
    }
    for (let i = 0; i < 46; i++) {
      const x = random() * size;
      const y = random() * size;
      const len = 14 + random() * 36;
      const bend = (random() - 0.5) * 24;
      wrapped(() => {
        c.strokeStyle = 'rgba(255, 255, 240, 0.7)';
        c.lineWidth = 1 + random() * 1.6;
        c.beginPath();
        c.moveTo(x, y);
        c.quadraticCurveTo(x + len / 2, y + bend, x + len, y + bend * 0.3);
        c.stroke();
      });
    }
    return canvas;
  }

  // Máscara del líquido de una ilustración (alfa por píxel) a partir de su color; solo la mitad baja, para no confundirlo con luces y pantallas
  maskFor(index) {
    if (FX.low) return null; // en móviles no se reconoce el líquido: cada máscara ocupa varios MB y se acumulaban al avanzar por el nivel
    if (this.masks[index] !== undefined) return this.masks[index];
    const tile = this.level.tileCanvas(index);
    if (!tile || typeof document === 'undefined') return null;
    const { width: w, height: h } = tile;
    let image = null;
    try { image = tile.getContext('2d').getImageData(0, 0, w, h); } catch (error) { /* lienzo no legible */ }
    if (!image || !image.data) { this.masks[index] = null; return null; }
    const data = image.data;
    const alpha = new Uint8Array(w * h);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const context = canvas.getContext('2d');
    const out = context.createImageData(w, h);
    const top = Math.floor(h * 0.5);
    for (let y = top; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const lead = Math.max(data[i + 1], data[i + 2]);
        const glow = Math.max(0, Math.min(1, (lead - data[i] - 55) / 90)) * Math.max(0, Math.min(1, (lead - 115) / 70)) * (data[i + 3] / 255);
        if (glow <= 0.02) continue;
        const value = Math.round(glow * 255);
        alpha[y * w + x] = value;
        out.data[i] = 150; out.data[i + 1] = 255; out.data[i + 2] = 215; out.data[i + 3] = value;
      }
    }
    context.putImageData(out, 0, 0);
    this.masks[index] = { canvas, alpha, w, h };
    return this.masks[index];
  }

  // Cuánto líquido hay en un punto del mundo (0 a 1)
  at(x, y) {
    const index = Math.max(0, Math.min(this.level.config.backgroundSequence.length - 1, Math.floor(x / Level.TILE_STRIDE)));
    const mask = this.maskFor(index);
    if (!mask) return 0;
    const lx = Math.round(x - index * Level.TILE_STRIDE);
    const ly = Math.round(y);
    if (lx < 0 || ly < 0 || lx >= mask.w || ly >= mask.h) return 0;
    return mask.alpha[ly * mask.w + lx] / 255;
  }

  // Compone en pantalla la máscara de las ilustraciones visibles (una vez por fotograma)
  composeScreenMask(camera) {
    if (this.maskFrame === this.frame) return;
    this.maskFrame = this.frame;
    const c = this.screenMask.getContext('2d');
    c.clearRect(0, 0, Liquid.SCREEN_W, Liquid.SCREEN_H);
    const first = Math.max(0, Math.floor(camera.x / Level.TILE_STRIDE) - 1);
    for (let index = first; index <= first + 2; index++) {
      if (index >= this.level.config.backgroundSequence.length) break;
      const mask = this.maskFor(index);
      if (mask) c.drawImage(mask.canvas, Math.round(index * Level.TILE_STRIDE - camera.x), 0);
    }
  }

  // Los personajes sobre el líquido sueltan ondas al moverse; también salen burbujas y vapor de las zonas visibles
  update(dt, walkers, camera) {
    this.time += dt;
    this.frame++;
    if (FX.low || typeof document === 'undefined') return;
    for (const walker of walkers) {
      if (!walker || walker.isAlive === false || (walker.z || 0) > 4) continue;
      walker.rippleTimer = (walker.rippleTimer || 0) - dt;
      const moving = Math.abs(walker.vx || 0) > 15 || walker.state === 'attack';
      if (moving && walker.rippleTimer <= 0 && this.at(walker.x, walker.y) > 0.3) {
        walker.rippleTimer = 0.26;
        this.ripples.push({ x: walker.x, y: walker.y, age: 0, duration: 0.9, size: 34 + Math.random() * 20 });
      }
    }
    this.ripples = this.ripples.filter((ripple) => (ripple.age += dt) < ripple.duration);

    // Burbujas: puntos al azar de la pantalla que caen sobre líquido
    this.bubbleBudget += dt * 5;
    while (this.bubbleBudget >= 1) {
      this.bubbleBudget -= 1;
      const x = camera.x + Math.random() * CONFIG.WIDTH;
      const y = CONFIG.HEIGHT * (0.55 + Math.random() * 0.4);
      if (this.at(x, y) > 0.45 && this.bubbles.length < 26) this.bubbles.push({ x, y, age: 0, life: 1.1 + Math.random() * 1.2, r: 2 + Math.random() * 3.5, drift: (Math.random() - 0.5) * 10 });
    }
    this.bubbles = this.bubbles.filter((bubble) => {
      bubble.age += dt;
      bubble.y -= 12 * dt;
      bubble.x += bubble.drift * dt;
      if (bubble.age >= bubble.life) {
        this.ripples.push({ x: bubble.x, y: bubble.y + 4, age: 0, duration: 0.5, size: 12 + bubble.r * 3 });
        return false;
      }
      return true;
    });

    // Vapor verdoso que sube despacio de las zonas grandes de líquido
    this.steamBudget += dt * 1.6;
    while (this.steamBudget >= 1) {
      this.steamBudget -= 1;
      const x = camera.x + Math.random() * CONFIG.WIDTH;
      const y = CONFIG.HEIGHT * (0.5 + Math.random() * 0.35);
      if (this.at(x, y) > 0.6 && this.steam.length < 14) this.steam.push({ x, y, age: 0, life: 2.6 + Math.random() * 1.6, size: 26 + Math.random() * 22 });
    }
    this.steam = this.steam.filter((puff) => { puff.age += dt; puff.y -= 14 * dt; return puff.age < puff.life; });
  }

  // Brillo que late y destellos que recorren la superficie, sobre la ilustración y bajo los personajes
  renderShimmer(ctx, camera) {
    if (FX.low || !this.shimmerCanvas) return;
    this.composeScreenMask(camera);
    const t = this.time;
    const s = this.shimmerCanvas.getContext('2d');
    s.clearRect(0, 0, Liquid.SCREEN_W, Liquid.SCREEN_H);
    s.globalCompositeOperation = 'source-over';
    // dos capas de destellos que se mueven en sentidos distintos y a escalas distintas; se desplazan también con la cámara (parallax de suelo)
    const layer = (scale, vx, vy, alpha) => {
      s.save();
      const ox = -(((t * vx + camera.x * 0.6) % 256) + 256) % 256 * scale;
      const oy = (((t * vy) % 256) + 256) % 256 * scale;
      s.translate(ox, oy);
      s.scale(scale, scale);
      s.globalAlpha = alpha;
      s.fillStyle = this.causticPattern || (this.causticPattern = s.createPattern(this.caustic, 'repeat'));
      s.fillRect(-ox / scale - 8, -oy / scale - 8, Liquid.SCREEN_W / scale + 270, Liquid.SCREEN_H / scale + 270);
      s.restore();
    };
    layer(1, 22, 5, 0.85);
    layer(1.7, -14, 9, 0.6);
    s.globalCompositeOperation = 'destination-in';
    s.drawImage(this.screenMask, 0, 0);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.5 + 0.12 * Math.sin(t * 1.3);
    ctx.drawImage(this.shimmerCanvas, 0, 0);
    // el propio líquido late con una luz verde
    ctx.globalAlpha = 0.1 + 0.07 * Math.sin(t * 2.1);
    ctx.drawImage(this.screenMask, 0, 0);
    ctx.restore();
  }

  // Ondas, burbujas, vapor, reflejos y resplandor bajo los personajes. Se dibuja ya con la cámara aplicada, antes que los personajes.
  renderWorld(ctx, camera, walkers) {
    if (FX.low || !this.reflectCanvas) return;
    this.composeScreenMask(camera);
    const t = this.time;

    // Ondas
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const ripple of this.ripples) {
      const p = ripple.age / ripple.duration;
      ctx.globalAlpha = 0.55 * (1 - p);
      ctx.strokeStyle = '#d8fff0';
      ctx.lineWidth = 2 * (1 - p) + 0.6;
      ctx.beginPath();
      ctx.ellipse(ripple.x, ripple.y, 4 + ripple.size * p, (4 + ripple.size * p) * 0.3, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    // Resplandor verde bajo los pies de quien está sobre el líquido
    const onLiquid = walkers.filter((walker) => walker && walker.isAlive !== false && (walker.z || 0) < 40 && this.at(walker.x, walker.y) > 0.25);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const walker of onLiquid) {
      const pulse = 0.55 + 0.25 * Math.sin(t * 3 + walker.x * 0.02);
      const g = ctx.createRadialGradient(walker.x, walker.y, 4, walker.x, walker.y, 90);
      g.addColorStop(0, 'rgba(150, 255, 215, 0.5)');
      g.addColorStop(0.5, 'rgba(60, 230, 170, 0.22)');
      g.addColorStop(1, 'rgba(0, 200, 150, 0)');
      ctx.globalAlpha = pulse;
      ctx.fillStyle = g;
      ctx.save();
      ctx.translate(walker.x, walker.y);
      ctx.scale(1, 0.32);
      ctx.translate(-walker.x, -walker.y);
      ctx.fillRect(walker.x - 90, walker.y - 90, 180, 180);
      ctx.restore();
    }
    ctx.restore();

    // Reflejos: se dibujan en un lienzo aparte, invertidos y con una ondulación, y se recortan con la máscara del líquido
    if (onLiquid.length) {
      const r = this.reflectCanvas.getContext('2d');
      r.setTransform(1, 0, 0, 1, 0, 0);
      r.globalCompositeOperation = 'source-over';
      r.clearRect(0, 0, Liquid.SCREEN_W, Liquid.SCREEN_H);
      for (const walker of onLiquid) {
        r.save();
        r.translate(-camera.x, 0);
        const wave = 0.05 * Math.sin(t * 2.3 + walker.x * 0.013);
        r.translate(0, walker.y);
        r.transform(1, 0, wave, -0.7, 0, 0);
        r.translate(0, -walker.y);
        walker.render(r);
        r.restore();
      }
      r.globalCompositeOperation = 'destination-in';
      r.drawImage(this.screenMask, 0, 0);
      r.globalCompositeOperation = 'source-atop';
      r.fillStyle = 'rgba(40, 255, 190, 0.22)';
      r.fillRect(0, 0, Liquid.SCREEN_W, Liquid.SCREEN_H);
      ctx.save();
      ctx.globalAlpha = 0.45;
      ctx.drawImage(this.reflectCanvas, Math.round(camera.x), 0);
      ctx.restore();
    }

    // Vapor y burbujas
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const puff of this.steam) {
      const p = puff.age / puff.life;
      const size = puff.size * (1 + p * 1.2);
      const g = ctx.createRadialGradient(puff.x, puff.y, 0, puff.x, puff.y, size);
      g.addColorStop(0, 'rgba(120, 255, 210, 0.16)');
      g.addColorStop(1, 'rgba(120, 255, 210, 0)');
      ctx.globalAlpha = Math.sin(Math.min(1, p) * Math.PI);
      ctx.fillStyle = g;
      ctx.fillRect(puff.x - size, puff.y - size, size * 2, size * 2);
    }
    for (const bubble of this.bubbles) {
      const p = bubble.age / bubble.life;
      ctx.globalAlpha = 0.85 * Math.min(1, (1 - p) * 3);
      ctx.strokeStyle = '#c8fff0';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(bubble.x, bubble.y, bubble.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(bubble.x - bubble.r * 0.4, bubble.y - bubble.r * 0.5, 1.6, 1.6);
    }
    ctx.restore();
  }
}
