// Núcleo del juego: bucle de paso fijo con requestAnimationFrame y servicios compartidos.
class Game {
  constructor(canvas, modalRoot) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.input = new InputManager();
    this.audio = new AudioManager();
    this.modal = new Modal(modalRoot);
    this.scenes = new SceneManager();
    this.touch = new TouchControls(this.input, document.body);
    this.slowTime = 0;
    this.lastTimestamp = 0;
    this.accumulator = 0;

    this.canvas.width = CONFIG.WIDTH;
    this.canvas.height = CONFIG.HEIGHT;

    // El navegador solo permite sonido tras un gesto del usuario
    const unlock = () => this.audio.unlock();
    window.addEventListener('keydown', unlock);
    window.addEventListener('pointerdown', unlock);
    // Safari en iPhone solo permite sonido tras soltar el dedo (touchend) o un clic
    window.addEventListener('touchend', unlock, { passive: true });
    window.addEventListener('click', unlock);
    if (FX.low) this.enableLowFx();
  }

  // Efectos reducidos: sin resplandores (shadowBlur es lo más caro en el canvas), menos partículas y menos lluvia
  enableLowFx() {
    FX.low = true;
    Object.defineProperty(this.ctx, 'shadowBlur', { get: () => 0, set: () => {}, configurable: true });
    console.info('Efectos reducidos activados');
  }

  // Si el dispositivo no mantiene ~40 fps durante unos segundos, pasa solo al modo de efectos reducidos
  watchPerformance(frameSeconds) {
    if (FX.low || document.hidden || !(this.scenes.current instanceof GameScene)) return;
    // Se mide en segundos (no en fotogramas) para que un dispositivo muy lento también lo detecte pronto
    if (frameSeconds > 0.026) this.slowTime += Math.min(frameSeconds, 0.25);
    else this.slowTime = Math.max(0, this.slowTime - frameSeconds * 2);
    if (this.slowTime > 2.5) this.enableLowFx();
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
    this.watchPerformance((timestamp - this.lastTimestamp) / 1000);
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
    const scene = this.scenes.current;
    this.touch.setVisible(!!(scene && scene.usesTouchControls && scene.usesTouchControls()) && !this.modal.isOpen);
    requestAnimationFrame((next) => this.loop(next));
  }
}
