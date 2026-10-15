// Núcleo del juego: bucle de paso fijo con requestAnimationFrame y servicios compartidos.
class Game {
  constructor(canvas, modalRoot) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.input = new InputManager();
    this.audio = new AudioManager();
    this.modal = new Modal(modalRoot);
    this.scenes = new SceneManager();
    this.lastTimestamp = 0;
    this.accumulator = 0;

    this.canvas.width = CONFIG.WIDTH;
    this.canvas.height = CONFIG.HEIGHT;

    // El navegador solo permite sonido tras un gesto del usuario
    const unlock = () => this.audio.unlock();
    window.addEventListener('keydown', unlock);
    window.addEventListener('pointerdown', unlock);
  }

  start() {
    requestAnimationFrame((timestamp) => {
      this.lastTimestamp = timestamp;
      this.loop(timestamp);
    });
  }

  // Aviso discreto en la esquina cuando la música no suena o acaba de empezar
  renderAudioStatus() {
    const text = this.audio.musicStatusText();
    if (!text) return;
    const warning = this.audio.musicState === 'error' || this.audio.musicState === 'blocked';
    Draw.text(this.ctx, text, CONFIG.WIDTH - 14, CONFIG.HEIGHT - 12, {
      size: 15, align: 'right', color: warning ? CONFIG.COLORS.YELLOW : '#bfeaff', strokeWidth: 4,
    });
  }

  loop(timestamp) {
    // Limita dt para no acumular pasos tras cambiar de pestaña
    const frameTime = Math.min((timestamp - this.lastTimestamp) / 1000, 0.1);
    this.lastTimestamp = timestamp;
    this.accumulator += frameTime;

    while (this.accumulator >= CONFIG.STEP) {
      if (this.input.justPressed('mute')) this.audio.toggleMute();
      this.scenes.update(CONFIG.STEP);
      this.input.endStep();
      this.accumulator -= CONFIG.STEP;
    }

    this.scenes.render(this.ctx);
    this.renderAudioStatus();
    requestAnimationFrame((next) => this.loop(next));
  }
}
