// Dibujo de sprites de una sola pose con animación procedural (inclinación, estiramiento, destello, tinte).
const Sprite = {
  variantCache: new Map(),

  // Copia de la imagen rellena con un color sólido (destello blanco, tinte rojo, rastro cian…)
  silhouette(image, color) {
    let byColor = this.variantCache.get(image);
    if (!byColor) {
      byColor = new Map();
      this.variantCache.set(image, byColor);
    }
    if (!byColor.has(color)) {
      // Tope de copias de color en memoria (cada una es un lienzo del tamaño de la imagen): al pasarlo se descartan las más antiguas
      this.variantCount = (this.variantCount || 0) + 1;
      if (this.variantCount > 260) {
        this.variantCache.clear();
        this.variantCount = 0;
        byColor = new Map();
        this.variantCache.set(image, byColor);
      }
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0);
      context.globalCompositeOperation = 'source-atop';
      context.fillStyle = color;
      context.fillRect(0, 0, canvas.width, canvas.height);
      byColor.set(color, canvas);
    }
    return byColor.get(color);
  },

  // x,y = punto de los pies en pantalla. La rotación pivota sobre los pies; positivo = inclinarse hacia delante.
  // tint: { color, alpha } superpone un tinte; additive dibuja con mezcla aditiva (rastros luminosos).
  draw(ctx, image, options) {
    const {
      x, y, height, facing = 1, anchorX = 0.5,
      scaleX = 1, scaleY = 1, rotation = 0,
      offsetX = 0, offsetY = 0, pivot = 0,
      flash = false, alpha = 1, glow = 0, tint = null, additive = false, silhouetteColor = null,
    } = options;
    const width = (image.width / image.height) * height;

    ctx.save();
    ctx.globalAlpha *= alpha;
    if (additive) ctx.globalCompositeOperation = 'lighter';
    // pivot: píxeles sobre los pies donde se centra la rotación (0 = los pies)
    ctx.translate(x + offsetX, y + offsetY - pivot);
    ctx.rotate(rotation * facing);
    ctx.scale(facing * scaleX, scaleY);
    if (glow > 0) {
      ctx.shadowColor = CONFIG.COLORS.CYAN;
      ctx.shadowBlur = 8 + glow * 14;
    }

    // El destello superpone blanco sobre el sprite (conserva los contornos) en vez de sustituirlo
    ctx.drawImage(silhouetteColor ? this.silhouette(image, silhouetteColor) : image, -width * anchorX, pivot - height, width, height);
    if (flash) {
      ctx.shadowBlur = 0;
      ctx.globalAlpha *= 0.45;
      ctx.drawImage(this.silhouette(image, '#ffffff'), -width * anchorX, pivot - height, width, height);
    }

    if (tint && tint.alpha > 0) {
      ctx.shadowBlur = 0;
      ctx.globalAlpha *= tint.alpha;
      ctx.drawImage(this.silhouette(image, tint.color), -width * anchorX, pivot - height, width, height);
    }
    ctx.restore();
  },
};
