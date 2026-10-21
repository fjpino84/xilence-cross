// Video de inicio: se reproduce al pulsar ENTER en el título y, cuando termina (o se salta), empieza la partida.
// El video es un elemento <video> sobre el lienzo (assets/video/intro.mp4). Si no se puede reproducir (formato no soportado,
// archivo ausente o el navegador lo bloquea), se pasa directamente al juego sin quedarse atascado.
class IntroScene {
  static SRC = 'assets/video/intro.mp4';
  static SKIP_DELAY = 0.6; // evita saltarlo con la misma pulsación que lo abrió
  static START_TIMEOUT = 6; // segundos esperando a que empiece antes de rendirse
  static FADE_OUT = 0.6;

  constructor(game) {
    this.game = game;
    this.video = null;
    this.time = 0;
    this.started = false;
    this.leaving = false;
    this.onClick = (event) => {
      event.preventDefault();
      this.skip();
    };
  }

  enter() {
    this.time = 0;
    this.started = false;
    this.leaving = false;
    this.fade = 0;
    // La música del menú calla mientras suena el video
    this.game.audio.pauseMusic(true);

    const shell = typeof document.querySelector === 'function' ? document.querySelector('.game-shell') : null;
    if (!shell) {
      this.finish();
      return;
    }
    const video = document.createElement('video');
    video.className = 'intro-video';
    video.src = IntroScene.SRC;
    video.setAttribute('playsinline', '');
    video.setAttribute('aria-label', 'Introducción de The Sound of Xilence');
    video.preload = 'auto';
    video.volume = 1;
    this.video = video;
    video.addEventListener('ended', () => this.finish());
    video.addEventListener('error', () => this.finish());
    video.addEventListener('playing', () => { this.started = true; });
    shell.appendChild(video);
    // Ayuda para saltar, en una esquina y sin tapar el video
    const hint = document.createElement('div');
    hint.className = 'intro-skip';
    hint.textContent = (typeof TouchControls !== 'undefined' && TouchControls.enabled) ? 'Toca para saltar ▶' : 'ENTER para saltar ▶';
    shell.appendChild(hint);
    this.hint = hint;
    this.attachSkip();

    // Con sonido (hubo un gesto del usuario); si el navegador lo impide, se reintenta en silencio
    const attempt = video.play();
    if (attempt && attempt.catch) {
      attempt.catch(() => {
        video.muted = true;
        const retry = video.play();
        if (retry && retry.catch) retry.catch(() => this.finish());
      });
    }
  }

  // Saltar con ENTER, ESPACIO, clic o toque
  attachSkip() {
    if (this.video && this.video.addEventListener) this.video.addEventListener('click', this.onClick);
    if (this.game.canvas && this.game.canvas.addEventListener) this.game.canvas.addEventListener('click', this.onClick);
  }

  skip() {
    if (this.time > IntroScene.SKIP_DELAY) this.finish();
  }

  // Termina el video: fundido corto del sonido y a jugar
  finish() {
    if (this.leaving) return;
    this.leaving = true;
    this.leaveTime = 0;
    // El sonido del video baja en un fundido mientras empieza a entrar la música de la partida
    if (this.video && !this.video.ended && !this.video.muted) {
      AudioManager.ramp(this.video, 0, IntroScene.FADE_OUT, () => this.game.scenes.change('game'));
      this.game.audio.pauseMusic(false, 2.5);
      this.musicStarted = true;
      return;
    }
    this.game.scenes.change('game');
  }

  update(dt) {
    this.time += dt;
    const input = this.game.input;
    if (this.time > IntroScene.SKIP_DELAY && (input.justPressed('confirm') || input.justPressed('attack') || input.justPressed('pause'))) {
      this.finish();
      return;
    }
    // Los últimos instantes del video se apagan solos, para que no corte en seco al entrar en la partida
    const video = this.video;
    if (video && !this.leaving && video.duration > 0 && !video.muted) {
      const left = video.duration - video.currentTime;
      if (left < IntroScene.FADE_OUT) video.volume = Math.max(0, Math.min(1, left / IntroScene.FADE_OUT));
    }
    // Si el video nunca arranca, no se deja al jugador esperando
    if (!this.started && this.time > IntroScene.START_TIMEOUT) this.finish();
  }

  exit() {
    if (this.game.canvas && this.game.canvas.removeEventListener) this.game.canvas.removeEventListener('click', this.onClick);
    if (this.video) {
      try { this.video.pause(); } catch (error) { /* ya detenido */ }
      if (this.video.remove) this.video.remove();
      this.video = null;
    }
    if (this.hint) {
      if (this.hint.remove) this.hint.remove();
      this.hint = null;
    }
    if (!this.musicStarted) this.game.audio.pauseMusic(false, 2.5); // vuelve la música (la partida empieza con la suya), entrando poco a poco
    this.musicStarted = false;
  }

  // El video está en el DOM, encima del lienzo: aquí solo se pinta el fondo negro y la ayuda para saltar
  render(ctx) {
    const { WIDTH, HEIGHT } = CONFIG;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }
}
