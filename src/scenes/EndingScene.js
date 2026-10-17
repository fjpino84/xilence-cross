// Cierre de la demo: ilustración de la batalla final con una tarjeta "Próximamente... / Volver a empezar".
class EndingScene {
  static FADE_IN = 1.4;
  static CARD_DELAY = 2.2;

  constructor(game) {
    this.game = game;
    this.time = 0;
    this.cardShown = false;
  }

  enter() {
    this.time = 0;
    this.cardShown = false;
    this.game.modal.hide();
  }

  exit() {
    this.game.modal.hide();
  }

  update(dt) {
    this.time += dt;
    if (!this.cardShown && this.time >= EndingScene.CARD_DELAY) {
      this.cardShown = true;
      this.game.modal.show({
        variant: 'card',
        title: 'PRÓXIMAMENTE...',
        message: 'El Sector Meridian te espera.',
        buttons: [{ label: 'Volver a empezar', onClick: () => this.game.scenes.change('title') }],
      });
    }
  }

  render(ctx) {
    const { WIDTH, HEIGHT } = CONFIG;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Ilustración con un zoom lento hacia la izquierda (hacia Vóidhar)
    const art = Assets.image('bgFinal');
    if (art) {
      const zoom = 1 + 0.07 * Math.min(1, this.time / 14);
      ctx.save();
      ctx.translate(WIDTH * 0.35, HEIGHT * 0.5);
      ctx.scale(zoom, zoom);
      ctx.translate(-WIDTH * 0.35, -HEIGHT * 0.5);
      ctx.drawImage(art, 0, 0, WIDTH, HEIGHT);
      ctx.restore();
    }

    // Viñeta y degradado inferior para que la tarjeta se lea
    const vignette = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, HEIGHT * 0.4, WIDTH / 2, HEIGHT / 2, WIDTH * 0.7);
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(1, 'rgba(0, 0, 8, 0.6)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Entrada desde negro
    const fade = 1 - Math.min(1, this.time / EndingScene.FADE_IN);
    if (fade > 0) {
      ctx.fillStyle = `rgba(0, 0, 0, ${fade})`;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }
  }
}
