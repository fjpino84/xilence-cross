// Núcleo del juego: bucle de paso fijo con requestAnimationFrame y servicios compartidos.
class Game {
  constructor(canvas, modalRoot) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    // Los sprites se reducen mucho (de 300 px a 140 px): con calidad alta los bordes quedan limpios en vez de dentados
    if (this.ctx) { this.ctx.imageSmoothingEnabled = true; this.ctx.imageSmoothingQuality = 'high'; }
    this.input = new InputManager();
    this.audio = new AudioManager();
    this.audio.prepare();
    this.modal = new Modal(modalRoot);
    this.scenes = new SceneManager();
    this.touch = new TouchControls(this.input, document.body);
    this.slowTime = 0;
    this.lastTimestamp = 0;
    this.accumulator = 0;

    // En móviles el lienzo se dibuja a menor resolución (el navegador lo estira): menos píxeles que pintar y más aire para el audio.
    // El juego sigue usando coordenadas de 960×540; ?res=1 fuerza la resolución completa
    this.renderScale = (typeof IS_TOUCH_DEVICE !== 'undefined' && IS_TOUCH_DEVICE && !/[?&]res=1/.test(window.location.search || '')) ? 0.667 : 1;
    this.canvas.width = Math.round(CONFIG.WIDTH * this.renderScale);
    this.canvas.height = Math.round(CONFIG.HEIGHT * this.renderScale);

    // El navegador solo permite sonido tras un gesto del usuario
    const unlock = () => this.audio.unlock();
    window.addEventListener('keydown', unlock);
    window.addEventListener('pointerdown', unlock);
    // Safari en iPhone solo permite sonido tras soltar el dedo (touchend) o un clic
    window.addEventListener('touchend', unlock, { passive: true });
    window.addEventListener('click', unlock);
    if (FX.low) this.enableLowFx();
    this.debug = /[?&]debug=1/.test(window.location.search || '');
    if (this.debug) window.addEventListener('error', (event) => { window.lastError = event.message; });
  }

  // Efectos reducidos: sin resplandores (shadowBlur es lo más caro en el canvas), menos partículas y menos lluvia
  enableLowFx() {
    FX.low = true;
    Object.defineProperty(this.ctx, 'shadowBlur', { get: () => 0, set: () => {}, configurable: true });
    console.info('Efectos reducidos activados');
  }

  // Si el dispositivo no mantiene ~40 fps durante unos segundos, pasa solo al modo de efectos reducidos
  watchPerformance(frameSeconds) {
    if (document.hidden || !(this.scenes.current instanceof GameScene)) return;
    // Ya en efectos reducidos y aun así lento (móviles): se baja una vez más la resolución del lienzo para dejar aire al audio
    if (FX.low) {
      if (this.renderScale <= 0.5 || this.renderScale >= 1 || this.lowRes) return;
      this.lowSlow = frameSeconds > 0.03 ? (this.lowSlow || 0) + Math.min(frameSeconds, 0.25) : Math.max(0, (this.lowSlow || 0) - frameSeconds * 2);
      if (this.lowSlow > 3) this.setRenderScale(0.5);
      return;
    }
    // Se mide en segundos (no en fotogramas) para que un dispositivo muy lento también lo detecte pronto
    if (frameSeconds > 0.026) this.slowTime += Math.min(frameSeconds, 0.25);
    else this.slowTime = Math.max(0, this.slowTime - frameSeconds * 2);
    if (this.slowTime > 2.5) this.enableLowFx();
  }

  // Cambia la resolución interna del lienzo (las coordenadas del juego siguen siendo 960×540)
  setRenderScale(scale) {
    this.renderScale = scale;
    this.lowRes = true;
    this.canvas.width = Math.round(CONFIG.WIDTH * scale);
    this.canvas.height = Math.round(CONFIG.HEIGHT * scale);
    console.info('Resolución reducida a ' + scale);
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

  // Panel de diagnóstico (se activa con ?debug=1): fotogramas, estado del audio, voces, memoria y el último error, para poder fotografiarlo en el móvil
  renderDebug(frameSeconds) {
    this.debugFps = (this.debugFps || 60) * 0.95 + (1 / Math.max(0.001, frameSeconds)) * 0.05;
    this.debugWorst = Math.max((this.debugWorst || 0) * 0.995, frameSeconds * 1000);
    const audio = this.audio;
    const scene = this.scenes.current;
    const lines = [
      'fps ' + this.debugFps.toFixed(0) + '  peor ' + this.debugWorst.toFixed(0) + ' ms  escala ' + this.renderScale + '  fx ' + (FX.low ? 'bajo' : 'alto'),
      'audio ' + (audio.context ? audio.context.state : 'sin contexto') + '  voces ' + audio.voiceEnds.length + '  sfx ' + (audio.sfx ? 'ok' : 'NO') + '  descartados ' + (audio.dropped || 0) + '  nivel ' + audio.sfxLevel,
      'escena ' + (scene && scene.camera ? Math.floor(scene.camera.x / Level.TILE_STRIDE) + 1 : '-') + '  enemigos ' + (scene && scene.enemies ? scene.enemies.length : '-'),
    ];
    if (performance.memory) lines.push('memoria ' + (performance.memory.usedJSHeapSize / 1048576).toFixed(0) + ' MB');
    if (window.lastError) lines.push('ERROR ' + window.lastError);
    lines.forEach((line, i) => Draw.text(this.ctx, line, 8, 18 + i * 17, { size: 14, align: 'left', color: '#7dff9a', strokeWidth: 4 }));
  }

  loop(timestamp) {
    // Limita dt para no acumular pasos tras cambiar de pestaña
    this.watchPerformance((timestamp - this.lastTimestamp) / 1000);
    const frameTime = Math.min((timestamp - this.lastTimestamp) / 1000, 0.1);
    this.lastTimestamp = timestamp;
    this.accumulator += frameTime;

    // En móviles, si el dispositivo no da abasto no se recuperan muchos pasos de golpe (eso lo atascaba más): el juego va un poco lento en vez de cortarse
    if (this.renderScale < 1) this.accumulator = Math.min(this.accumulator, CONFIG.STEP * 3);
    while (this.accumulator >= CONFIG.STEP) {
      if (this.input.justPressed('mute')) this.audio.toggleMute();
      this.scenes.update(CONFIG.STEP);
      this.input.endStep();
      this.accumulator -= CONFIG.STEP;
    }

    this.ctx.setTransform(this.renderScale, 0, 0, this.renderScale, 0, 0);
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = this.renderScale < 1 ? 'low' : 'high';
    this.scenes.render(this.ctx);
    this.renderAudioStatus();
    if (this.debug) this.renderDebug((timestamp - this.lastDebugStamp) / 1000 || 0.016);
    this.lastDebugStamp = timestamp;
    const scene = this.scenes.current;
    this.touch.setVisible(!!(scene && scene.usesTouchControls && scene.usesTouchControls()) && !this.modal.isOpen);
    this.touch.setDuel(!!(scene && scene.usesDuelPads && scene.usesDuelPads()) && !this.modal.isOpen);
    requestAnimationFrame((next) => this.loop(next));
  }
}
