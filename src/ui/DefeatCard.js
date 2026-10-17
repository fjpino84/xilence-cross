// Imagen de jefe derrotado, a pantalla completa. Si existe la ilustración (assets/sprites/batuk/derrotado.jpg) se muestra con un
// zoom lento; si no, se compone una escena provisional con el sprite del jefe caído, sus instrumentos rotos y rayos dorados.
const DefeatCard = {
  render(ctx, age, { title = 'BATUK DERROTADO', subtitle = 'Su ritmo se quebró... y una melodía vuelve a sonar.', art = 'batukDefeated' } = {}) {
    const { WIDTH, HEIGHT } = CONFIG;
    const fade = Math.min(1, age / 0.9);
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.fillStyle = '#080503';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    const image = Assets.image(art);
    if (image) {
      // Ilustración propia, cubriendo la pantalla con un zoom lento
      const zoom = 1 + 0.05 * Math.min(1, age / 12);
      const scale = Math.max(WIDTH / image.width, HEIGHT / image.height) * zoom;
      ctx.drawImage(image, (WIDTH - image.width * scale) / 2, (HEIGHT - image.height * scale) / 2, image.width * scale, image.height * scale);
    } else {
      this.renderProvisional(ctx, age);
    }

    // Viñeta y degradado inferior para que el texto se lea
    const vignette = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, HEIGHT * 0.4, WIDTH / 2, HEIGHT / 2, WIDTH * 0.7);
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(1, 'rgba(0, 0, 0, 0.65)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    Draw.rock(ctx, title, WIDTH / 2, 92, { size: 56, align: 'center', colors: ['#ffffff', '#ffd23a', '#9a5a00'], glow: '#ffb000', glowBlur: 18, outlineWidth: 10, tracking: 3 });
    Draw.text(ctx, subtitle, WIDTH / 2, 138, { size: 24, align: 'center', color: '#ffe9b0', strokeWidth: 5 });
    if (age > 1.8 && Math.floor(age * 2.5) % 2 === 0) {
      Draw.text(ctx, 'ENTER ▶', WIDTH / 2, 186, { size: 24, align: 'center', color: '#ffd23a', strokeWidth: 5 });
    }
    ctx.restore();
  },

  // Escena provisional: sol de rayos dorados, suelo, Batuk tendido y sus instrumentos esparcidos
  renderProvisional(ctx, age) {
    const { WIDTH, HEIGHT } = CONFIG;
    const cx = WIDTH * 0.5;
    const glow = ctx.createRadialGradient(cx, HEIGHT * 0.62, 20, cx, HEIGHT * 0.62, WIDTH * 0.6);
    glow.addColorStop(0, 'rgba(255, 170, 30, 0.55)');
    glow.addColorStop(0.5, 'rgba(120, 50, 0, 0.35)');
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Rayos que giran despacio
    ctx.save();
    ctx.translate(cx, HEIGHT * 0.62);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + age * 0.08;
      ctx.fillStyle = 'rgba(255, 190, 60, 0.07)';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a - 0.07) * 900, Math.sin(a - 0.07) * 900);
      ctx.lineTo(Math.cos(a + 0.07) * 900, Math.sin(a + 0.07) * 900);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Suelo
    const floorY = HEIGHT * 0.78;
    const floor = ctx.createLinearGradient(0, floorY - 40, 0, HEIGHT);
    floor.addColorStop(0, 'rgba(30, 18, 8, 0)');
    floor.addColorStop(0.3, 'rgba(30, 18, 8, 0.95)');
    floor.addColorStop(1, '#0c0703');
    ctx.fillStyle = floor;
    ctx.fillRect(0, floorY - 40, WIDTH, HEIGHT);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.ellipse(cx, floorY + 20, 330, 34, 0, 0, Math.PI * 2);
    ctx.fill();

    // Batuk tendido: el sprite girado casi 90°, con la cabeza hacia la derecha
    const image = Assets.image('spriteBatuk');
    if (image) {
      Sprite.draw(ctx, image, {
        x: cx - 200, y: floorY - 14, height: 340, anchorX: BatukBoss.ANCHOR_X, facing: 1, rotation: 1.52,
        tint: { color: '#1a0f04', alpha: 0.28 },
      });
    }

    // Instrumentos esparcidos y rotos
    const items = [
      ['tom', cx - 330, floorY + 38, 52, 0.4], ['cymbal', cx + 40, floorY + 52, 54, 0.15], ['conga', cx + 290, floorY + 20, 46, 1.2],
      ['tambourine', cx - 100, floorY + 66, 36, 0.8], ['sticks', cx + 160, floorY + 70, 40, 0.6], ['tom', cx + 400, floorY + 62, 40, -0.5],
    ];
    for (const [kind, x, y, size, rot] of items) BatukBoss.drawInstrument(ctx, kind, x, y, size, rot);

    // Motas de polvo dorado que suben
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 40; i++) {
      const seed = i * 97.13;
      const x = (Math.sin(seed) * 0.5 + 0.5) * WIDTH;
      const y = HEIGHT - ((age * (22 + (i % 7) * 8) + seed * 13) % (HEIGHT + 40));
      ctx.fillStyle = `rgba(255, 200, 80, ${0.25 + 0.25 * Math.sin(age * 2 + i)})`;
      ctx.beginPath();
      ctx.arc(x, y, 1.5 + (i % 3), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  },
};
