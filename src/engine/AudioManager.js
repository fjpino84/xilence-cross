// Música de fondo (archivo MP3) y efectos de sonido sintetizados con Web Audio.
// Cadena de los efectos: voces → bus (volumen) → compresor/limitador → salida, con una reverberación por envío.
// El navegador exige un gesto del usuario antes de sonar: unlock() se llama en la primera pulsación.
class AudioManager {
  static MASTER_VOLUME = 0.8;
  static MUSIC_VOLUME = 0.3;
  static MUSIC_DUCKED = 0.1; // volumen bajo mientras el juego está en pausa
  static SFX_FILE = 'assets/audio/sfx.wav';
  static SFX_SCRIPT = 'src/engine/SfxBank.js';
  static MIN_GAP = 0.03; // evita apilar el mismo sonido varias veces en un instante

  constructor() {
    this.context = null;
    this.master = null;
    this.compressor = null;
    this.reverbSend = null;
    this.noiseBuffer = null;
    this.curves = {};
    this.muted = false;
    this.lastPlayed = new Map();
    this.music = null;
    // idle (sin gesto aún) → loading → playing; blocked (el navegador la bloqueó) o error (no se pudo cargar)
    this.musicState = 'idle';
    this.musicDetail = '';
    this.musicPlayingSince = 0;
    this.triedBlobFallback = false;
    this.sfxFilter = null;
    this.sfxLevel = 1;
    this.sfx = null; // hoja de sonidos grabados ya decodificada
    this.lastPick = {};
    this.chargeVoice = null;
    this.talkVoice = null;
    this.heliVoice = null;
    this.musicHeld = false;
    this.boss = null;
    this.bossError = false;
  }

  // ---------------------------------------------------------------- música de fondo

  // Música de fondo en bucle: un elemento <audio> normal (funciona también abriendo index.html desde el disco)
  startMusic() {
    if (this.musicHeld) return;
    if (typeof Audio === 'undefined') {
      this.musicState = 'error';
      this.musicDetail = 'este navegador no soporta audio';
      return;
    }
    if (!this.music) {
      this.music = new Audio(CONFIG.MUSIC);
      this.music.loop = true;
      this.music.preload = 'auto';
      this.music.volume = AudioManager.MUSIC_VOLUME;
      this.music.muted = this.muted;
      this.musicState = 'loading';
      this.music.addEventListener('playing', () => {
        this.musicState = 'playing';
        this.musicPlayingSince = performance.now();
      });
      this.music.addEventListener('waiting', () => { if (this.musicState === 'playing') this.musicState = 'loading'; });
      this.music.addEventListener('error', () => {
        const error = this.music.error;
        console.warn('No se pudo cargar la música', CONFIG.MUSIC, error);
        this.recoverMusic(error ? `código ${error.code}` : 'error de carga');
      });
    }
    // Cada gesto del usuario reintenta: si el navegador la bloqueó antes, ahora sí puede sonar
    if (this.music.paused && this.musicState !== 'error') {
      this.music.play().catch((error) => {
        console.warn('La música no pudo empezar:', error);
        if (error && error.name === 'NotAllowedError') this.musicState = 'blocked';
        else if (error && error.name === 'AbortError') this.musicState = 'loading'; // se interrumpió por un cambio de fuente
        else this.recoverMusic(error ? error.name : 'error');
      });
    }
  }

  // Plan B: algunos servidores entregan el MP3 con un tipo incorrecto y el navegador lo rechaza.
  // Se descarga el archivo y se reproduce desde un Blob con el tipo audio/mpeg.
  async recoverMusic(reason) {
    const mp3Support = (document.createElement('audio').canPlayType('audio/mpeg') || 'no');
    if (this.triedBlobFallback) {
      this.musicState = 'error';
      this.musicDetail = `${reason}; mp3: ${mp3Support}; ${this.musicDetail}`.replace(/; $/, '');
      return;
    }
    this.triedBlobFallback = true;
    this.musicState = 'loading';
    this.musicDetail = '';
    try {
      const response = await fetch(CONFIG.MUSIC);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = new Blob([await response.blob()], { type: 'audio/mpeg' });
      this.music.src = URL.createObjectURL(blob);
      this.music.load();
      await this.music.play();
    } catch (error) {
      if (error && error.name === 'NotAllowedError') {
        this.musicState = 'blocked'; // la descarga fue bien: solo falta un gesto del usuario
        return;
      }
      this.musicState = 'error';
      this.musicDetail = `${reason}; mp3: ${mp3Support}; ${error && error.message ? error.message : error}`;
    }
  }

  // Texto de estado para mostrar en pantalla, o null si todo va bien y no hace falta decir nada
  musicStatusText() {
    if (this.muted) return '♪ Sonido silenciado (M)';
    switch (this.musicState) {
      case 'idle': return '♪ Pulsa una tecla para activar la música';
      case 'loading': return '♪ Cargando música…';
      case 'blocked': return '♪ El navegador bloqueó la música: pulsa una tecla';
      case 'error': return `♪ No se pudo cargar la música (${this.musicDetail || 'error'})`;
      default:
        // Al empezar a sonar se anuncia unos segundos
        return performance.now() - this.musicPlayingSince < 5000 ? '♪ Zero — PlayerZero · M silencia' : null;
    }
  }

  // Rampa de volumen suave de un elemento de audio (una sola a la vez por elemento); al terminar ejecuta done
  static ramp(element, target, seconds, done = null) {
    if (!element) return;
    if (element.rampTimer) clearInterval(element.rampTimer);
    const from = element.volume;
    const started = performance.now();
    const finish = () => {
      if (element.rampTimer) clearInterval(element.rampTimer);
      element.rampTimer = null;
      element.volume = Math.max(0, Math.min(1, target));
      if (done) done();
    };
    if (seconds <= 0 || typeof setInterval === 'undefined') { finish(); return; }
    element.rampTimer = setInterval(() => {
      const t = Math.min(1, (performance.now() - started) / (seconds * 1000));
      const eased = t * t * (3 - 2 * t); // arranque y llegada suaves
      element.volume = Math.max(0, Math.min(1, from + (target - from) * eased));
      if (t >= 1) finish();
    }, 40);
  }

  // Detiene la música de fondo (duelo musical) o la reanuda; con fade (s) calla o vuelve de forma gradual
  // Mientras está retenida (jefe con su propia canción), ningún gesto del usuario puede reanudarla
  pauseMusic(on, fade = 0) {
    this.musicHeld = on;
    if (!this.music) return;
    if (on) {
      if (fade > 0 && !this.music.paused) AudioManager.ramp(this.music, 0, fade, () => { if (this.musicHeld) this.music.pause(); });
      else { AudioManager.ramp(this.music, 0, 0); this.music.pause(); }
      return;
    }
    if (this.musicState === 'error') return;
    const target = AudioManager.MUSIC_VOLUME;
    if (fade > 0) this.music.volume = 0; else AudioManager.ramp(this.music, target, 0);
    this.music.play().catch(() => {});
    if (fade > 0) AudioManager.ramp(this.music, target, fade);
  }

  // --- Música del jefe (archivo grabado) ---
  static BOSS_MUSIC = 'assets/audio/batuk-battle.mp3';
  static BOSS_VOLUME = 1.0;
  static BOSS_BOOST = 2.4; // ganancia extra de la canción del jefe (ver boostBoss)

  // Empieza la canción del jefe desde el principio; la música de fondo normal se apaga con un fundido cruzado
  startBoss() {
    this.pauseMusic(true, 1.4);
    if (typeof Audio === 'undefined') return;
    if (!this.boss) {
      this.boss = new Audio(AudioManager.BOSS_MUSIC);
      this.boss.preload = 'auto';
      this.boss.loop = false;
      this.bossError = false;
      this.boss.addEventListener('error', () => { this.bossError = true; });
    }
    this.boostBoss();
    this.boss.volume = 0;
    this.boss.muted = this.muted;
    try { this.boss.currentTime = 0; } catch (error) { /* aún sin metadatos: empezará desde el principio */ }
    this.boss.play().catch(() => {});
    AudioManager.ramp(this.boss, AudioManager.BOSS_VOLUME, 2.0); // entra poco a poco mientras sale la música de la etapa
    this.bossStamp = performance.now();
  }

  // La grabación de la canción es floja (la mitad de fuerte que la música de las etapas): se pasa por Web Audio con ganancia y un limitador
  // para que mande sobre todo lo demás. Solo funciona desde un servidor (http/https); abriendo el archivo desde el disco el navegador lo
  // impide y suena a su volumen normal.
  boostBoss() {
    if (this.bossBoosted || !this.boss || !this.context || typeof location === 'undefined' || !/^https?:$/.test(location.protocol)) return;
    try {
      const source = this.context.createMediaElementSource(this.boss);
      const gain = this.context.createGain();
      gain.gain.value = AudioManager.BOSS_BOOST;
      const limiter = this.context.createDynamicsCompressor();
      limiter.threshold.value = -3;
      limiter.knee.value = 0;
      limiter.ratio.value = 20;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.1;
      source.connect(gain);
      gain.connect(limiter);
      limiter.connect(this.context.destination);
      this.bossBoosted = true;
    } catch (error) { /* sin ganancia extra */ }
  }

  // Salta a un instante de la canción y la deja sonando. Devuelve true si hay audio real al que sincronizarse.
  seekBoss(seconds) {
    if (!this.boss || this.bossError) return false;
    try { this.boss.currentTime = seconds; } catch (error) { return false; }
    this.bossLastReported = null;
    this.boss.play().catch(() => {});
    // El salto de la canción se disimula con un golpe de volumen que baja un instante y vuelve
    this.boss.volume = AudioManager.BOSS_VOLUME * 0.15;
    AudioManager.ramp(this.boss, AudioManager.BOSS_VOLUME, 0.7);
    return true;
  }

  // Tiempo de la canción (s), suavizado: currentTime avanza a saltos, así que se interpola con el reloj del navegador
  bossTime() {
    if (!this.boss || this.bossError || this.boss.paused) return this.boss && !this.bossError ? this.boss.currentTime : null;
    const now = performance.now();
    const reported = this.boss.currentTime;
    if (reported !== this.bossLastReported) {
      this.bossLastReported = reported;
      this.bossLastStamp = now;
    }
    return reported + (now - this.bossLastStamp) / 1000;
  }

  pauseBoss(on) {
    if (!this.boss) return;
    if (on) this.boss.pause();
    else this.boss.play().catch(() => {});
  }

  // Tras ganar el duelo la canción sigue sonando (en bucle) durante el epílogo y la pantalla final
  keepBoss() {
    if (this.boss) { this.boss.loop = true; this.boss.volume = AudioManager.BOSS_VOLUME; }
  }

  // Fin del cierre con el jefe (menú o nueva partida): la canción se apaga y vuelve la música normal de la etapa
  releaseBoss(fade = 0.8) {
    if (!this.musicHeld && (!this.boss || this.boss.paused)) return;
    if (this.boss) this.boss.loop = false;
    if (this.boss && !this.boss.paused) {
      this.stopBoss(fade);
      setTimeout(() => { if (this.musicHeld) this.pauseMusic(false); }, fade * 1000);
    } else {
      this.pauseMusic(false);
    }
  }

  // Apaga la canción del jefe con un fundido corto
  stopBoss(fade = 1.2) {
    const boss = this.boss;
    if (!boss) return;
    const startVolume = boss.volume;
    const started = performance.now();
    const tick = () => {
      const t = Math.min(1, (performance.now() - started) / (fade * 1000));
      boss.volume = Math.max(0, startVolume * (1 - t));
      if (t < 1) setTimeout(tick, 50);
      else boss.pause();
    };
    tick();
  }

  // Solo suenan los efectos de la lista (null = todos). Se usa en el duelo con canción grabada.
  setSfxFilter(names) {
    this.sfxFilter = names ? new Set(names) : null;
  }

  // Baja el volumen de la música (pausa) o lo restaura
  duckMusic(on) {
    if (this.music) this.music.volume = on ? AudioManager.MUSIC_DUCKED : AudioManager.MUSIC_VOLUME;
  }

  // ---------------------------------------------------------------- motor de efectos

  get ready() { return this.context !== null && !this.muted; }

  // Crea el contexto de audio (suspendido) y empieza a cargar los sonidos grabados ya al abrir la página, para que estén listos
  // cuando llegue el primer gesto del jugador (el botón del título suena al pulsarlo)
  prepare() {
    if (this.context) return;
    const AudioContextClass = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AudioContextClass) return;
    try { this.setup(new AudioContextClass()); } catch (error) { /* se creará con el primer gesto */ }
  }

  unlock() {
    this.startMusic();
    if (!this.context) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      this.setup(new AudioContextClass());
    }
    if (this.context.state === 'suspended') this.context.resume();
  }

  // Construye la cadena de efectos sobre un contexto (en vivo, o uno "offline" para pruebas)
  setup(context) {
    this.context = context;
    this.loadSamples();
    this.master = context.createGain();
    this.master.gain.value = this.muted ? 0 : AudioManager.MASTER_VOLUME * this.sfxLevel;

    // Compresor/limitador: deja apilar capas fuertes sin que sature
    this.compressor = context.createDynamicsCompressor();
    this.compressor.threshold.value = -12;
    this.compressor.knee.value = 10;
    this.compressor.ratio.value = 10;
    this.compressor.attack.value = 0.002;
    this.compressor.release.value = 0.16;
    // Tras el compresor: ganancia de compensación y limitador suave (tanh) para que nada pase de 1.0
    const makeup = context.createGain();
    makeup.gain.value = 1.35;
    const limiter = context.createWaveShaper();
    limiter.curve = this.buildCurve(1);
    this.master.connect(this.compressor);
    this.compressor.connect(makeup);
    makeup.connect(limiter);
    limiter.connect(context.destination);

    // Reverberación por envío: da cuerpo y "sala" a explosiones, acordes y platillos
    this.reverbSend = context.createGain();
    const reverb = context.createConvolver();
    reverb.buffer = this.buildImpulse(1.7, 2.6);
    const reverbReturn = context.createGain();
    reverbReturn.gain.value = 0.6;
    this.reverbSend.connect(reverb);
    reverb.connect(reverbReturn);
    reverbReturn.connect(this.master);

    this.noiseBuffer = this.buildNoise();
    this.curves = { soft: this.buildCurve(2.2), hard: this.buildCurve(9) };
  }

  buildNoise() {
    const length = this.context.sampleRate;
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  // Respuesta al impulso sintética: ruido estéreo que decae (seconds = duración, decay = rapidez de caída)
  buildImpulse(seconds, decay) {
    const rate = this.context.sampleRate;
    const length = Math.floor(rate * seconds);
    const buffer = this.context.createBuffer(2, length, rate);
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      let smooth = 0;
      for (let i = 0; i < length; i++) {
        smooth += (Math.random() * 2 - 1 - smooth) * 0.55; // suaviza los agudos
        data[i] = smooth * Math.pow(1 - i / length, decay);
      }
    }
    return buffer;
  }

  // Curva de distorsión de guitarra (tanh normalizada)
  buildCurve(drive) {
    const size = 2048;
    const curve = new Float32Array(size);
    const norm = Math.tanh(drive);
    for (let i = 0; i < size; i++) curve[i] = Math.tanh(((i / (size - 1)) * 2 - 1) * drive) / norm;
    return curve;
  }

  // ---------------------------------------------------------------- sonidos grabados (assets/audio/sfx.wav)
  // Una sola hoja con todos los recortes (tabla en SfxData.js, generada por tools/make_sfx.js). Si no carga, suenan los sintetizados.
  async loadSamples() {
    this.sfx = null;
    if (typeof SFX_CLIPS === 'undefined') return;
    try {
      let data = null;
      try {
        const response = await fetch(AudioManager.SFX_FILE);
        if (!response.ok) throw new Error('HTTP ' + response.status);
        data = await response.arrayBuffer();
      } catch (error) {
        data = await this.loadSamplesFromScript(); // abierto desde el disco: fetch está bloqueado, se usa la copia en base64
      }
      this.sfx = await this.context.decodeAudioData(data);
    } catch (error) {
      console.warn('No se pudieron cargar los sonidos grabados; se usan los sintetizados', error);
    }
  }

  // Plan B: la hoja en base64 dentro de SfxBank.js, cargada como un script solo cuando hace falta
  loadSamplesFromScript() {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = AudioManager.SFX_SCRIPT;
      script.onload = () => {
        const binary = atob(SFX_BASE64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        resolve(bytes.buffer);
      };
      script.onerror = () => reject(new Error('SfxBank.js no cargó'));
      document.head.appendChild(script);
    });
  }

  // Reproduce un recorte (o uno al azar de una serie: 'ecoStep' + 1..count) y devuelve su voz para poder apagarla
  sample(name, options = {}) {
    const { count = 0, volume = 1, rate = 1, jitter = 0.05, pan = 0, wet = 0, loop = false } = options;
    if (!this.sfx || !this.ready) return null;
    let key = options.name || name;
    if (count > 0) {
      let pick = 1 + Math.floor(Math.random() * count);
      if (count > 1 && pick === this.lastPick[name]) pick = (pick % count) + 1; // nunca el mismo dos veces seguidas
      this.lastPick[name] = pick;
      key = name + pick;
    }
    const clip = SFX_CLIPS[key];
    if (!clip) return null;
    const source = this.context.createBufferSource();
    source.buffer = this.sfx;
    source.playbackRate.value = rate * (1 + (Math.random() - 0.5) * 2 * jitter);
    const gain = this.context.createGain();
    gain.gain.value = volume;
    source.connect(gain);
    this.out(gain, { pan, wet });
    if (loop) {
      source.loop = true;
      source.loopStart = clip[0];
      source.loopEnd = clip[0] + clip[1];
      source.start(this.context.currentTime, clip[0]);
    } else {
      source.start(this.context.currentTime, clip[0], clip[1]);
    }
    return { source, gain };
  }

  // Helicóptero del reflector: suena en bucle mientras la luz está cerca de la pantalla (level 0-1) y se apaga solo si se aleja
  setHelicopter(level, dt = 1 / 60) {
    if (!this.sfx || !this.ready) return;
    const target = Math.max(0, Math.min(1, level)) * 0.16;
    if (target > 0.004 && !this.heliVoice) this.heliVoice = this.sample('heli', { loop: true, volume: 0, jitter: 0 });
    const voice = this.heliVoice;
    if (!voice) return;
    voice.gain.gain.setTargetAtTime(target, this.context.currentTime, 0.6); // sube y baja con suavidad
    this.heliQuiet = target > 0.004 ? 0 : (this.heliQuiet || 0) + dt;
    if (this.heliQuiet > 4) {
      try { voice.source.stop(this.context.currentTime + 0.05); } catch (error) { /* ya parado */ }
      this.heliVoice = null;
      this.heliQuiet = 0;
    }
  }

  // Apaga una voz con un fundido corto
  fadeVoice(voice, seconds = 0.12) {
    if (!voice) return;
    const now = this.context.currentTime;
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
    voice.gain.gain.linearRampToValueAtTime(0, now + seconds);
    try { voice.source.stop(now + seconds + 0.02); } catch (error) { /* ya terminó */ }
  }

  // Nivel de los efectos (1 = normal). En el duelo bajan para que la canción sea lo principal
  setSfxLevel(level) {
    this.sfxLevel = level;
    if (this.master) this.master.gain.value = this.muted ? 0 : AudioManager.MASTER_VOLUME * level;
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : AudioManager.MASTER_VOLUME * this.sfxLevel;
    if (this.music) this.music.muted = this.muted;
    return this.muted;
  }

  // Conecta una voz al bus (con panorama y envío a la reverberación)
  out(node, { pan = 0, wet = 0 } = {}) {
    let last = node;
    if (pan) {
      const panner = this.context.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      last.connect(panner);
      last = panner;
    }
    last.connect(this.master);
    if (wet > 0) {
      const send = this.context.createGain();
      send.gain.value = wet;
      last.connect(send);
      send.connect(this.reverbSend);
    }
  }

  // Tono con barrido de frecuencia, envolvente, distorsión (shape: 'soft'|'hard') y filtro opcional
  tone({ type = 'sine', from, to = from, duration = 0.15, volume = 0.2, delay = 0, attack = 0.004, shape = null, lowpass = null, detune = 0, pan = 0, wet = 0, sweep = 'exp' }) {
    const context = this.context;
    const start = context.currentTime + delay;
    const oscillator = context.createOscillator();
    oscillator.type = type;
    oscillator.detune.value = detune;
    oscillator.frequency.setValueAtTime(from, start);
    if (sweep === 'lin') oscillator.frequency.linearRampToValueAtTime(to, start + duration);
    else oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + duration);

    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    let node = oscillator;
    if (shape) {
      const shaper = context.createWaveShaper();
      shaper.curve = this.curves[shape];
      shaper.oversample = '2x';
      node.connect(shaper);
      node = shaper;
    }
    if (lowpass) {
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpass;
      node.connect(filter);
      node = filter;
    }
    node.connect(gain);
    this.out(gain, { pan, wet });
    oscillator.start(start);
    oscillator.stop(start + duration + 0.05);
  }

  // Ráfaga de ruido filtrado (golpes, soplidos, explosiones, platillos)
  noise({ type = 'lowpass', from = 2000, to = from, q = 1, duration = 0.1, volume = 0.2, delay = 0, attack = 0.002, pan = 0, wet = 0, shape = null }) {
    const context = this.context;
    const start = context.currentTime + delay;
    const source = context.createBufferSource();
    source.buffer = this.noiseBuffer;
    source.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = type;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(from, start);
    filter.frequency.exponentialRampToValueAtTime(Math.max(20, to), start + duration);
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter);
    let node = filter;
    if (shape) {
      const shaper = context.createWaveShaper();
      shaper.curve = this.curves[shape];
      shaper.oversample = '2x';
      node.connect(shaper);
      node = shaper;
    }
    node.connect(gain);
    this.out(gain, { pan, wet });
    source.start(start, Math.random());
    source.stop(start + duration + 0.05);
  }

  // Chisporroteo eléctrico: muchos chasquidos cortos y agudos repartidos al azar por el estéreo
  crackle({ duration = 0.5, rate = 50, volume = 0.1, delay = 0, low = 1800, high = 9000 }) {
    const count = Math.max(1, Math.round(duration * rate));
    for (let i = 0; i < count; i++) {
      const frequency = low + Math.random() * (high - low);
      this.noise({
        type: 'bandpass', from: frequency, to: frequency * 0.8, q: 4, duration: 0.012 + Math.random() * 0.022,
        volume: volume * (0.35 + Math.random() * 0.65), delay: delay + Math.random() * duration, attack: 0.001, pan: (Math.random() - 0.5) * 1.2,
      });
    }
  }

  // Acorde de potencia distorsionado (fundamental + quinta + octava, cada nota con dos dientes de sierra desafinados)
  chord({ root, duration = 0.8, volume = 0.2, delay = 0, cutoff = 3200, wet = 0.25, spread = 9, shape = 'hard' }) {
    const context = this.context;
    const start = context.currentTime + delay;
    const bus = context.createGain();
    bus.gain.value = 1;
    const shaper = context.createWaveShaper();
    shaper.curve = this.curves[shape];
    shaper.oversample = '2x';
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 1.4;
    filter.frequency.setValueAtTime(cutoff, start);
    filter.frequency.exponentialRampToValueAtTime(Math.max(200, cutoff * 0.3), start + duration);
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(volume, start + 0.004);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    for (const ratio of [1, 1.4983, 2]) {
      for (const cents of [-spread, spread]) {
        const oscillator = context.createOscillator();
        oscillator.type = 'sawtooth';
        oscillator.frequency.value = root * ratio;
        oscillator.detune.value = cents;
        const level = context.createGain();
        level.gain.value = 0.2;
        oscillator.connect(level);
        level.connect(bus);
        oscillator.start(start);
        oscillator.stop(start + duration + 0.05);
      }
    }
    bus.connect(shaper);
    shaper.connect(filter);
    filter.connect(envelope);
    this.out(envelope, { wet });
  }

  // Impacto metálico: parciales inarmónicos que decaen a ritmos distintos (campana, martillo contra armadura)
  clang({ base = 520, duration = 0.5, volume = 0.2, delay = 0, wet = 0.2 }) {
    [1, 2.4, 4.1, 6.3].forEach((ratio, index) => {
      this.tone({ type: 'sine', from: base * ratio, to: base * ratio * 0.985, duration: duration / (1 + index * 0.55), volume: volume / (1 + index * 0.7), delay, attack: 0.001, wet });
    });
  }

  // Rugido de bestia: diente de sierra grave con vibrato y un subgrave cuadrado, muy distorsionado, filtrado por dos
  // formantes de "garganta" (500-1500 Hz) y con trémolo para darle rugosidad. Cuanto más grave el rango, más enorme suena.
  growl({ from = 110, to = 60, duration = 0.6, volume = 0.3, delay = 0, wet = 0.2, rate = 22, formants = [620, 1250, 2500], pan = 0, pitch = 1.9 }) {
    // pitch eleva la fundamental: por debajo de ~150 Hz los altavoces de portátil/monitor no reproducen casi nada
    from *= pitch;
    to *= pitch;
    const context = this.context;
    const start = context.currentTime + delay;
    const end = start + duration;

    const voice = context.createOscillator();
    voice.type = 'sawtooth';
    voice.frequency.setValueAtTime(from, start);
    voice.frequency.exponentialRampToValueAtTime(Math.max(20, to), end);
    const vibrato = context.createOscillator();
    vibrato.frequency.value = rate;
    const vibratoDepth = context.createGain();
    vibratoDepth.gain.value = from * 0.07;
    vibrato.connect(vibratoDepth);
    vibratoDepth.connect(voice.frequency);

    const sub = context.createOscillator();
    sub.type = 'square';
    sub.frequency.setValueAtTime(from / 2, start);
    sub.frequency.exponentialRampToValueAtTime(Math.max(15, to / 2), end);
    const subLevel = context.createGain();
    subLevel.gain.value = 0.22;

    const mix = context.createGain();
    voice.connect(mix);
    sub.connect(subLevel);
    subLevel.connect(mix);
    const shaper = context.createWaveShaper();
    shaper.curve = this.curves.hard;
    shaper.oversample = '2x';
    mix.connect(shaper);

    // Formantes + el grave sin filtrar: dan la "vocal" gutural al rugido
    const throat = context.createGain();
    for (const frequency of formants) {
      const band = context.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.value = frequency;
      band.Q.value = 3;
      const level = context.createGain();
      level.gain.value = 2.6;
      shaper.connect(band);
      band.connect(level);
      level.connect(throat);
    }
    const low = context.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 320;
    const lowLevel = context.createGain();
    lowLevel.gain.value = 0.3;
    shaper.connect(low);
    low.connect(lowLevel);
    lowLevel.connect(throat);

    // Trémolo: la amplitud tiembla más rápido que el vibrato
    const tremolo = context.createGain();
    tremolo.gain.value = 0.7;
    const tremoloLfo = context.createOscillator();
    tremoloLfo.frequency.value = rate * 1.3;
    const tremoloDepth = context.createGain();
    tremoloDepth.gain.value = 0.3;
    tremoloLfo.connect(tremoloDepth);
    tremoloDepth.connect(tremolo.gain);
    throat.connect(tremolo);

    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(volume * 0.5, start + Math.min(0.08, duration * 0.3));
    envelope.gain.exponentialRampToValueAtTime(0.0001, end);
    tremolo.connect(envelope);
    this.out(envelope, { pan, wet });

    for (const node of [voice, vibrato, sub, tremoloLfo]) {
      node.start(start);
      node.stop(end + 0.05);
    }
  }

  play(name, options = {}) {
    if (!this.ready) return;
    if (this.sfxFilter && !this.sfxFilter.has(name)) return;
    const now = this.context.currentTime;
    if (now - (this.lastPlayed.get(name) ?? -1) < AudioManager.MIN_GAP) return;
    this.lastPlayed.set(name, now);
    // Con los sonidos grabados cargados, estos reemplazan a los sintetizados (si la función devuelve true, se mezclan ambos)
    const recorded = this.sfx && AudioManager.RECORDED[name];
    if (recorded && !recorded(this, options)) return;
    const sound = AudioManager.SOUNDS[name];
    if (sound) sound(this, options);
  }
}

// Sonidos grabados por evento del juego. Devuelven true si además debe sonar el sintetizado.
AudioManager.RECORDED = {
  // ECO camina (una pisada por medio ciclo), pisa un charco y golpea: un recorte por paso del combo
  step: (a) => { a.sample('ecoStep', { count: 4, volume: 0.8, jitter: 0.06 }); },
  splash: (a, { power = 1 }) => { a.sample('ecoWater', { volume: 0.5 + 0.25 * power, jitter: 0.12 }); },
  swing: (a, { step = 1 }) => {
    a.sample('ecoHit' + Math.min(5, Math.max(1, step)), { volume: 0.9, jitter: 0.04 });
    return step >= 5; // el remate del combo conserva su carga sintética
  },
  hit: () => true,
  // Adversarios: pisadas (las pesadas del martillo), quejidos al ser golpeados, aviso de ataque y grito de muerte
  enemyStep: (a, { heavy = false }) => {
    if (heavy) a.sample('advHeavy', { count: 3, volume: 0.55, jitter: 0.05 });
    else a.sample('advStep', { count: 4, volume: 0.5, jitter: 0.06 });
  },
  enemyHurt: (a, { power = 1 }) => {
    if (Math.random() < 0.5) a.sample('foeHit', { count: 2, volume: 0.45 + 0.06 * power });
    else a.sample('foeHurt', { count: 4, volume: 0.42 + 0.06 * power, jitter: 0.08 });
  },
  enemyWarn: (a) => { a.sample('foeWarn', { count: 5, volume: 0.5, jitter: 0.06 }); },
  enemySwing: (a) => {
    a.sample('foeWarn', { count: 5, volume: 0.5, jitter: 0.06 });
    // el aire cortado por el martillo sigue siendo sintético
    a.noise({ type: 'bandpass', from: 180, to: 950, q: 0.8, duration: 0.26, volume: 0.28, attack: 0.08 });
    a.tone({ from: 120, to: 55, duration: 0.22, volume: 0.14, attack: 0.06 });
  },
  enemyDie: (a) => {
    a.sample('foeDie', { count: 4, volume: 0.55, jitter: 0.05 });
    // estallido de la armadura (sin el rugido sintético)
    a.noise({ type: 'lowpass', from: 5000, to: 100, duration: 0.6, volume: 0.34, attack: 0.001, wet: 0.2 });
    a.tone({ from: 95, to: 24, duration: 0.6, volume: 0.4, attack: 0.002 });
    a.clang({ base: 260, duration: 0.7, volume: 0.14, wet: 0.3, delay: 0.04 });
    a.crackle({ duration: 0.45, rate: 45, volume: 0.09, low: 700, high: 4000 });
  },
  // Poderes: la carga suena mientras se mantiene K y se apaga al soltar; el disparo, el rayo corto y el súper tienen su grabación
  rayCharge: (a) => { a.fadeVoice(a.chargeVoice, 0.05); a.chargeVoice = a.sample('rayCharge', { volume: 0.55, jitter: 0 }); },
  chargeTick: () => {},
  rayRelease: (a) => { a.fadeVoice(a.chargeVoice, 0.1); a.chargeVoice = null; return true; },
  rayFire: (a) => { a.fadeVoice(a.chargeVoice, 0.05); a.chargeVoice = null; a.sample('rayFire', { volume: 1, jitter: 0.02 }); },
  special: (a) => AudioManager.RECORDED.rayFire(a),
  rayMini: (a) => { a.sample('rayMini', { volume: 0.9, jitter: 0.04 }); },
  superCharge: (a) => { a.sample('superStart', { volume: 0.9, jitter: 0 }); },
  super: (a) => { a.sample('superBlast', { volume: 1, jitter: 0 }); },
  hurt: (a) => { a.fadeVoice(a.chargeVoice, 0.08); a.chargeVoice = null; return true; },
  // Botón "LET'S ROCK!!" del título
  letsRock: (a) => { a.sample('letsRock', { volume: 0.9, jitter: 0 }); },
  // Rex Vane: la llegada, las cargas (el pico del sonido coincide con el final de la espera), su muerte, rugido y quejidos
  rexArrive: (a) => { a.sample('rexArrive', { volume: 0.85, jitter: 0 }); },
  rexCharge: (a, { kind = 'bolt', enraged = false }) => {
    a.sample(kind === 'ray' ? 'rexRay' : 'rexBolt', { count: 0, volume: 0.9, jitter: 0, name: (kind === 'ray' ? 'rexRay' : 'rexBolt') + (enraged ? 2 : 1) });
  },
  // Duelo: nota acertada (el tono sube con el carril), fallo corto y suave, racha de 10 y ataque de Batuk
  duelNote: (a, { lane = 0, perfect = false }) => { a.sample('duelNote', { volume: perfect ? 0.6 : 0.45, rate: [0.9, 1.0, 1.12, 1.26][lane] || 1, jitter: 0.01 }); },
  duelBad: (a) => {
    const now = a.context.currentTime;
    if (now - (a.lastDuelBad ?? -9) < 0.25) return; // los fallos seguidos no se apilan sobre la música
    a.lastDuelBad = now;
    a.sample('duelErr', { count: 4, volume: 0.45, jitter: 0.03 });
  },
  duelStreak: (a) => { a.sample('duelX10', { volume: 0.9, jitter: 0.01 }); },
  // Ambiente: el trueno de los relámpagos del fondo y las corrientes eléctricas (cortocircuitos y rayos del Power Chord)
  thunder: (a) => { a.sample('thunder', { count: 2, volume: 0.5, jitter: 0.07 }); },
  zap: (a) => { a.sample('zap', { count: 3, volume: 0.45, jitter: 0.08 }); },
  batukAttack: (a) => { a.sample('batukHit', { count: 4, volume: 0.9, jitter: 0.03 }); },
  // Trino: el láser grabado (el sonido de carga sigue siendo sintético); Batuk: el retumbar de su llegada
  trinoFire: (a) => { a.sample('trinoLaser', { count: 4, volume: 0.8, jitter: 0.04 }); },
  batukArrive: (a) => { a.sample('batukArrive', { volume: 0.9, jitter: 0 }); },
  rexDie: (a) => { a.sample('rexDie', { volume: 0.95, jitter: 0 }); },
  rexRoar: (a) => { a.sample('rexRoar', { volume: 0.9, jitter: 0.02 }); },
  rexHurt: (a) => {
    const now = a.context.currentTime;
    if (now - (a.lastRexHurt ?? -9) < 1.4) return; // no gruñe con cada golpe
    a.lastRexHurt = now;
    a.sample('rexHurt', { count: 2, volume: 0.8, jitter: 0.05 });
  },
  // Voz de fondo mientras habla con ECO: dura lo que el diálogo
  rexTalk: (a) => { a.fadeVoice(a.talkVoice, 0.1); a.talkVoice = a.sample('rexTalk', { volume: 0.55, jitter: 0 }); },
  rexTalkEnd: (a) => { a.fadeVoice(a.talkVoice, 0.8); a.talkVoice = null; },
};

// Biblioteca de sonidos. Cada entrada recibe el AudioManager y opciones (power, step…).
// Los tonos de notas musicales ya no existen: sonaban como una melodía suelta sobre la canción.
AudioManager.SOUNDS = {
  // --- ECO: golpes ---
  // Puñetazo (pasos 1 y 3): aire corto y seco; patada (2 y 4): aire ancho y grave; remate (5): carga ascendente
  swing: (a, { step = 1 }) => {
    const pitch = 1 + (Math.random() - 0.5) * 0.12;
    if (step >= 5) {
      a.noise({ type: 'bandpass', from: 250, to: 2600, q: 1.1, duration: 0.28, volume: 0.34, attack: 0.1 });
      a.tone({ type: 'sawtooth', from: 90, to: 200, duration: 0.28, volume: 0.14, shape: 'soft', lowpass: 900, attack: 0.1 });
    } else if (step % 2 === 0) {
      a.noise({ type: 'bandpass', from: 340 * pitch, to: 1500, q: 0.9, duration: 0.18, volume: 0.42, attack: 0.045, pan: 0.1 });
      a.tone({ from: 140, to: 70, duration: 0.16, volume: 0.16, attack: 0.04 });
    } else {
      a.noise({ type: 'bandpass', from: 800 * pitch, to: 3200, q: 1.2, duration: 0.11, volume: 0.42, attack: 0.03 });
    }
  },
  // Impacto en capas: chasquido agudo + cuerpo grave + crujido distorsionado + golpe seco + sub; más capas con más potencia
  hit: (a, { power = 1 }) => {
    const v = 1 + (Math.random() - 0.5) * 0.14;
    a.noise({ type: 'highpass', from: 2600, to: 6500, duration: 0.035, volume: 0.3 + power * 0.06, attack: 0.0008 });
    a.noise({ type: 'lowpass', from: 3600, to: 240, duration: 0.15 + power * 0.04, volume: 0.28 + power * 0.05, attack: 0.001 });
    a.noise({ type: 'bandpass', from: 1300 * v, to: 280, q: 1.3, duration: 0.1, volume: 0.24 + power * 0.05, shape: 'hard', attack: 0.001 });
    a.tone({ from: 210 * v, to: 52, duration: 0.17, volume: 0.3 + power * 0.05, attack: 0.001 });
    a.noise({ type: 'bandpass', from: 700 * v, to: 400, q: 0.8, duration: 0.09, volume: 0.34 + power * 0.06, shape: 'hard', attack: 0.001 });
    a.tone({ type: 'square', from: 300 * v, to: 85, duration: 0.09, volume: 0.13, shape: 'soft', attack: 0.001 });
    if (power >= 2) {
      a.tone({ from: 125, to: 34, duration: 0.34, volume: 0.36, attack: 0.002 });
      a.noise({ type: 'bandpass', from: 1000, to: 350, q: 0.7, duration: 0.16, volume: 0.4, shape: 'hard', attack: 0.001 });
      // guitarrazo: la caja de la guitarra contra el enemigo
      a.chord({ root: 164.8 * v, duration: 0.14, volume: 0.1, cutoff: 2800, wet: 0.12 });
    }
  },
  heavyHit: (a) => {
    const v = 1 + (Math.random() - 0.5) * 0.1;
    a.noise({ type: 'highpass', from: 2200, to: 7000, duration: 0.04, volume: 0.42, attack: 0.0008 });
    a.noise({ type: 'lowpass', from: 6000, to: 130, duration: 0.38, volume: 0.5, attack: 0.001, wet: 0.2 });
    a.noise({ type: 'bandpass', from: 1500 * v, to: 220, q: 1.2, duration: 0.18, volume: 0.34, shape: 'hard', attack: 0.001 });
    a.tone({ from: 160 * v, to: 28, duration: 0.6, volume: 0.5, attack: 0.001 });
    a.noise({ type: 'bandpass', from: 900, to: 300, q: 0.7, duration: 0.3, volume: 0.5, shape: 'hard', attack: 0.001 });
    a.tone({ type: 'sawtooth', from: 280, to: 60, duration: 0.26, volume: 0.16, shape: 'hard', lowpass: 1800, attack: 0.001 });
    a.noise({ type: 'highpass', from: 5200, to: 2200, duration: 0.5, volume: 0.15, delay: 0.015, wet: 0.35 });
    a.chord({ root: 82.41 * v, duration: 0.42, volume: 0.22, cutoff: 2600, wet: 0.24, delay: 0.005 });
  },

  // --- ECO: rayo (K) ---
  // Carga: subida eléctrica con chisporroteo hasta el disparo
  rayCharge: (a) => {
    a.tone({ type: 'sawtooth', from: 80, to: 720, duration: 0.36, volume: 0.1, shape: 'soft', lowpass: 2600, attack: 0.15 });
    a.tone({ type: 'sine', from: 440, to: 2200, duration: 0.36, volume: 0.06, attack: 0.1, sweep: 'lin' });
    a.noise({ type: 'bandpass', from: 400, to: 5200, q: 3, duration: 0.36, volume: 0.15, attack: 0.18 });
    a.crackle({ duration: 0.36, rate: 45, volume: 0.1 });
  },
  // Disparo: estallido grave, acorde de potencia, chasquido eléctrico y siseo del rayo con cola de reverberación
  rayFire: (a) => {
    a.noise({ type: 'highpass', from: 2400, to: 9000, duration: 0.04, volume: 0.4, attack: 0.0008 });
    a.tone({ from: 90, to: 28, duration: 0.8, volume: 0.6, attack: 0.001, wet: 0.2 });
    a.chord({ root: 110, duration: 1.0, volume: 0.26, cutoff: 3600, wet: 0.32 });
    a.chord({ root: 220, duration: 0.5, volume: 0.1, cutoff: 5000, wet: 0.25, delay: 0.01 });
    a.tone({ type: 'sawtooth', from: 3600, to: 150, duration: 0.38, volume: 0.15, shape: 'hard', lowpass: 4200, attack: 0.001 });
    a.noise({ type: 'bandpass', from: 3000, to: 800, q: 0.8, duration: 0.8, volume: 0.22, attack: 0.01, wet: 0.28 });
    a.crackle({ duration: 0.85, rate: 75, volume: 0.17, delay: 0.02 });
  },
  special: (a) => AudioManager.SOUNDS.rayFire(a),
  // Zumbido de carga: un pulso cuyo tono sube con el nivel de carga (0-1)
  chargeTick: (a, { level = 0 }) => {
    a.tone({ type: 'sawtooth', from: 90 + level * 330, to: 140 + level * 620, duration: 0.18, volume: 0.26 + level * 0.14, shape: 'soft', lowpass: 1800 + level * 2000, attack: 0.02 });
    a.tone({ from: 600 + level * 1500, to: 900 + level * 2400, duration: 0.1, volume: 0.09 + level * 0.07, attack: 0.005 });
    a.crackle({ duration: 0.16, rate: 30 + level * 90, volume: 0.09 + level * 0.1, delay: 0 });
  },
  // Carga completa: campanilla brillante y chasquido
  chargeFull: (a) => {
    a.clang({ base: 1450, duration: 0.55, volume: 0.22, wet: 0.35 });
    a.tone({ type: 'sawtooth', from: 400, to: 1800, duration: 0.18, volume: 0.1, shape: 'soft', lowpass: 5000, attack: 0.01 });
    a.noise({ type: 'highpass', from: 3500, to: 8000, duration: 0.1, volume: 0.2, attack: 0.001 });
  },
  // Al soltar K: el aire se "recoge" antes del disparo (más largo con más carga)
  rayRelease: (a, { level = 0 }) => {
    a.noise({ type: 'bandpass', from: 4200, to: 300, q: 1.2, duration: 0.07 + 0.05 * level, volume: 0.45 + 0.3 * level, attack: 0.004 });
    a.tone({ from: 700 + 600 * level, to: 120, duration: 0.09, volume: 0.25 + 0.2 * level, attack: 0.002 });
  },
  // Rayo corto del golpe final del combo
  rayMini: (a) => {
    a.noise({ type: 'highpass', from: 2400, to: 8000, duration: 0.035, volume: 0.3, attack: 0.0008 });
    a.tone({ from: 100, to: 36, duration: 0.4, volume: 0.4, attack: 0.001 });
    a.chord({ root: 110, duration: 0.45, volume: 0.15, cutoff: 3000, wet: 0.22 });
    a.tone({ type: 'sawtooth', from: 2800, to: 200, duration: 0.25, volume: 0.1, shape: 'hard', lowpass: 3600, attack: 0.001 });
    a.crackle({ duration: 0.45, rate: 55, volume: 0.12, delay: 0.02 });
  },

  // --- ECO: súper (L) ---
  superCharge: (a) => {
    a.tone({ from: 60, to: 50, duration: 0.09, volume: 0.4, attack: 0.002 });
    a.tone({ from: 60, to: 50, duration: 0.09, volume: 0.4, attack: 0.002, delay: 0.14 });
    a.tone({ type: 'sawtooth', from: 55, to: 560, duration: 0.3, volume: 0.15, shape: 'soft', lowpass: 3000, attack: 0.18 });
    a.noise({ type: 'highpass', from: 1800, to: 9000, duration: 0.3, volume: 0.22, attack: 0.24, wet: 0.2 });
    a.crackle({ duration: 0.3, rate: 60, volume: 0.1 });
  },
  super: (a) => {
    a.noise({ type: 'highpass', from: 2000, to: 9000, duration: 0.05, volume: 0.5, attack: 0.0008 });
    a.tone({ from: 62, to: 20, duration: 1.5, volume: 0.75, attack: 0.002, wet: 0.35 });
    a.noise({ type: 'lowpass', from: 9000, to: 110, duration: 1.2, volume: 0.5, attack: 0.002, wet: 0.35 });
    a.noise({ type: 'highpass', from: 5400, to: 2600, duration: 1.7, volume: 0.28, attack: 0.004, delay: 0.02, wet: 0.55 }); // platillo
    a.chord({ root: 82.41, duration: 1.5, volume: 0.32, cutoff: 3800, wet: 0.38 });
    a.chord({ root: 164.81, duration: 1.2, volume: 0.15, cutoff: 5200, wet: 0.35, delay: 0.015 });
    a.chord({ root: 329.63, duration: 0.9, volume: 0.07, cutoff: 6400, wet: 0.45, delay: 0.03 });
    a.crackle({ duration: 1.3, rate: 85, volume: 0.13, delay: 0.03 });
  },

  // --- ECO: movimiento ---
  // Golpe parado por el escudo: chasquido de cristal, resonancia de energía y golpe sordo
  block: (a) => {
    a.noise({ type: 'highpass', from: 3500, to: 8000, duration: 0.06, volume: 0.34, attack: 0.001 });
    a.clang({ base: 1500, duration: 0.55, volume: 0.2, wet: 0.35 });
    a.tone({ type: 'sawtooth', from: 700, to: 260, duration: 0.2, volume: 0.1, shape: 'soft', lowpass: 3000, attack: 0.002 });
    a.tone({ from: 150, to: 60, duration: 0.12, volume: 0.4, attack: 0.001 });
    a.crackle({ duration: 0.22, rate: 60, volume: 0.09 });
  },
  hurt: (a) => {
    a.noise({ type: 'lowpass', from: 3400, to: 160, duration: 0.26, volume: 0.46, attack: 0.001 });
    a.tone({ from: 160, to: 40, duration: 0.24, volume: 0.6, attack: 0.001 });
    a.tone({ type: 'sawtooth', from: 480, to: 100, duration: 0.32, volume: 0.2, shape: 'hard', lowpass: 1700, attack: 0.002 });
  },
  // El escudo se activa: zumbido eléctrico ascendente con un tintineo
  shieldOn: (a) => {
    a.tone({ type: 'sawtooth', from: 180, to: 700, duration: 0.22, volume: 0.26, shape: 'soft', lowpass: 2600, attack: 0.02, wet: 0.2 });
    a.tone({ type: 'sine', from: 900, to: 1800, duration: 0.18, volume: 0.15, attack: 0.01 });
    a.crackle({ duration: 0.2, rate: 55, volume: 0.12 });
  },
  jump: (a) => {
    a.tone({ from: 220, to: 560, duration: 0.14, volume: 0.11, sweep: 'lin' });
    a.noise({ type: 'bandpass', from: 500, to: 1800, q: 1, duration: 0.12, volume: 0.14, attack: 0.03 });
    a.tone({ from: 110, to: 60, duration: 0.09, volume: 0.2, attack: 0.001 });
  },
  land: (a) => {
    a.noise({ type: 'lowpass', from: 1200, to: 120, duration: 0.14, volume: 0.3, attack: 0.001 });
    a.tone({ from: 125, to: 40, duration: 0.15, volume: 0.42, attack: 0.001 });
    a.noise({ type: 'highpass', from: 3000, to: 6000, duration: 0.03, volume: 0.1, attack: 0.001 });
  },
  step: (a) => {
    const v = 1 + (Math.random() - 0.5) * 0.2;
    a.tone({ from: 120 * v, to: 52, duration: 0.1, volume: 0.28, attack: 0.001 });
    a.noise({ type: 'lowpass', from: 1000, to: 160, duration: 0.07, volume: 0.17, attack: 0.001 });
    a.noise({ type: 'bandpass', from: 4200 * v, to: 3000, q: 3, duration: 0.025, volume: 0.05, attack: 0.001 });
  },

  // --- Enemigos: bestiales ---
  // Trueno lejano: estallido seco seguido de un retumbar largo que se apaga
  thunder: (a) => {
    a.noise({ type: 'lowpass', from: 2200, to: 260, duration: 0.5, volume: 0.45, attack: 0.004, wet: 0.3 });
    a.crackle({ duration: 0.4, rate: 70, volume: 0.12, low: 900, high: 5000 });
    a.noise({ type: 'lowpass', from: 700, to: 110, q: 0.8, duration: 2.6, volume: 0.42, attack: 0.3, wet: 0.5, shape: 'soft' });
    a.tone({ from: 70, to: 38, duration: 1.4, volume: 0.35, attack: 0.15 });
  },
  // Rex Vane aparece: caída con estruendo grave, gruñido metálico y crepitar rojo
  rexArrive: (a) => {
    a.noise({ type: 'lowpass', from: 2400, to: 160, duration: 1.4, volume: 0.35, attack: 0.5, wet: 0.5, shape: 'soft' });
    a.tone({ type: 'sawtooth', from: 120, to: 420, duration: 1.2, volume: 0.1, shape: 'soft', lowpass: 1600, attack: 0.6, wet: 0.4 });
    a.crackle({ duration: 1.2, rate: 40, volume: 0.1 });
  },
  rexLand: (a) => {
    a.tone({ from: 95, to: 32, duration: 0.6, volume: 0.6, attack: 0.002 });
    a.noise({ type: 'lowpass', from: 1800, to: 120, duration: 0.5, volume: 0.45, attack: 0.002, wet: 0.35 });
    a.growl({ from: 105, to: 58, duration: 0.8, volume: 0.4, rate: 18, wet: 0.3 });
  },
  // Carga de energía: un silbido que sube y chisporrotea
  rexCharge: (a) => {
    a.tone({ type: 'sawtooth', from: 160, to: 980, duration: 1.1, volume: 0.1, shape: 'soft', lowpass: 2800, attack: 0.2, wet: 0.25 });
    a.tone({ type: 'sine', from: 700, to: 2400, duration: 1.0, volume: 0.05, attack: 0.3 });
    a.crackle({ duration: 1.0, rate: 55, volume: 0.07 });
  },
  // Caen los rayos: chasquido, trueno y retumbar
  rexBolt: (a) => {
    a.noise({ type: 'highpass', from: 3000, to: 8500, duration: 0.09, volume: 0.5, attack: 0.001 });
    a.noise({ type: 'lowpass', from: 3600, to: 200, duration: 0.7, volume: 0.5, attack: 0.002, wet: 0.35 });
    a.tone({ from: 130, to: 38, duration: 0.55, volume: 0.55, attack: 0.002 });
    a.crackle({ duration: 0.5, rate: 70, volume: 0.15 });
  },
  // Rayo horizontal: barrido eléctrico agudo con cola grave
  rexRay: (a) => {
    a.tone({ type: 'sawtooth', from: 2000, to: 260, duration: 0.5, volume: 0.2, shape: 'soft', lowpass: 4000, attack: 0.002, wet: 0.2 });
    a.noise({ type: 'bandpass', from: 700, to: 4200, q: 1.2, duration: 0.55, volume: 0.38, attack: 0.01, wet: 0.2 });
    a.tone({ from: 110, to: 45, duration: 0.5, volume: 0.45, attack: 0.002 });
    a.crackle({ duration: 0.5, rate: 80, volume: 0.14 });
  },
  // Cada letra del diálogo: ECO suena cristalino y Rex Vane, grave y áspero
  dialogBlip: (a, { who }) => {
    if (who === 'rex') {
      a.tone({ type: 'sawtooth', from: 96 + Math.random() * 14, to: 80, duration: 0.05, volume: 0.07, shape: 'soft', lowpass: 700, attack: 0.002 });
    } else {
      a.tone({ type: 'square', from: 520 + Math.random() * 90, to: 470, duration: 0.035, volume: 0.03, attack: 0.002 });
    }
  },
  // Retumbar de tambores graves (entrada del jefe)
  drumRumble: (a) => {
    for (let i = 0; i < 6; i++) a.tone({ from: 62 - i * 3, to: 38, duration: 0.3, volume: 0.32, delay: i * 0.16, attack: 0.004 });
    a.noise({ type: 'lowpass', from: 500, to: 90, q: 1, duration: 1.1, volume: 0.3, attack: 0.3, wet: 0.35, shape: 'soft' });
  },
  // Pisada de Batuk: golpe de tambor grande
  drumStomp: (a) => {
    a.tone({ from: 120, to: 44, duration: 0.28, volume: 0.6, attack: 0.002 });
    a.noise({ type: 'bandpass', from: 700, to: 260, q: 1, duration: 0.14, volume: 0.26, attack: 0.001 });
    a.tone({ type: 'triangle', from: 210, to: 90, duration: 0.14, volume: 0.2, attack: 0.001, wet: 0.2 });
  },
  // Golpe enorme: bombo, platillo y reverberación
  drumBoom: (a) => {
    a.tone({ from: 110, to: 30, duration: 0.8, volume: 0.7, attack: 0.002 });
    a.noise({ type: 'lowpass', from: 2400, to: 140, duration: 0.7, volume: 0.45, attack: 0.002, wet: 0.45 });
    a.noise({ type: 'highpass', from: 5000, to: 3000, duration: 1.2, volume: 0.2, attack: 0.002, wet: 0.35, delay: 0.02 });
    a.clang({ base: 900, duration: 0.8, volume: 0.12, wet: 0.35 });
  },
  // Un instrumento sale volando hacia Batuk: silbido corto
  instrumentIn: (a) => {
    a.noise({ type: 'bandpass', from: 1200, to: 3200, q: 1.4, duration: 0.5, volume: 0.1, attack: 0.1, wet: 0.2 });
  },
  // El instrumento se engancha a la órbita: golpecito de percusión
  instrumentHit: (a) => {
    const f = 280 + Math.random() * 380;
    a.tone({ type: 'triangle', from: f, to: f * 0.6, duration: 0.16, volume: 0.13, attack: 0.002, wet: 0.2 });
    a.noise({ type: 'bandpass', from: 2500, to: 1800, q: 2, duration: 0.05, volume: 0.07, attack: 0.001 });
  },
  // Nota mal tocada: dos "pac pac" secos y desafinados, como una cuerda apagada con la palma
  duelBad: (a) => {
    for (const [delay, pitch] of [[0, 196], [0.1, 174]]) {
      a.tone({ type: 'square', from: pitch, to: pitch * 0.82, duration: 0.07, volume: 0.13, delay, lowpass: 900, attack: 0.001 });
      a.tone({ type: 'sawtooth', from: pitch * 1.06, to: pitch * 0.8, duration: 0.06, volume: 0.07, delay, lowpass: 700, attack: 0.001 });
      a.noise({ type: 'bandpass', from: 1400, to: 500, q: 1.2, duration: 0.05, volume: 0.17, delay, attack: 0.001 });
    }
  },
  // Se pierde el duelo: acorde que se hunde y se apaga
  duelFail: (a) => {
    a.tone({ type: 'sawtooth', from: 330, to: 48, duration: 1.1, volume: 0.22, shape: 'soft', lowpass: 1800, attack: 0.01, wet: 0.3 });
    a.tone({ type: 'sawtooth', from: 247, to: 36, duration: 1.2, volume: 0.18, shape: 'soft', lowpass: 1400, attack: 0.01, detune: 12 });
    a.noise({ type: 'lowpass', from: 2400, to: 120, duration: 0.9, volume: 0.3, attack: 0.002, wet: 0.4 });
  },
  // Latido de poca vida: dos golpes graves seguidos
  heartbeat: (a) => {
    a.tone({ from: 70, to: 40, duration: 0.14, volume: 0.5, attack: 0.004 });
    a.tone({ from: 62, to: 36, duration: 0.16, volume: 0.38, attack: 0.004, delay: 0.17 });
  },
  // Un enemigo cae del cielo: silbido descendente
  dropWhoosh: (a) => {
    a.noise({ type: 'bandpass', from: 2600, to: 400, q: 1.2, duration: 0.55, volume: 0.22, attack: 0.05 });
    a.tone({ type: 'sawtooth', from: 520, to: 110, duration: 0.5, volume: 0.05, shape: 'soft', lowpass: 1500, attack: 0.02 });
  },
  // Chisporroteo de un foco que se cortocircuita
  zap: (a) => {
    a.crackle({ duration: 0.3, rate: 80, volume: 0.07 });
    a.noise({ type: 'bandpass', from: 2500, to: 5200, q: 2, duration: 0.12, volume: 0.1, attack: 0.001 });
  },
  // Gruñido al empezar a cargar el golpe (avisa de que viene algo grande)
  enemyWarn: (a) => {
    a.growl({ from: 125, to: 78, duration: 0.5, volume: 0.34, rate: 20, wet: 0.15 });
    a.tone({ type: 'square', from: 900, to: 1300, duration: 0.06, volume: 0.025, attack: 0.002 });
  },
  // Pisada de armadura pesada: golpe sordo muy grave, traqueteo metálico y gravilla
  enemyStep: (a) => {
    const v = 1 + (Math.random() - 0.5) * 0.15;
    a.tone({ from: 78 * v, to: 28, duration: 0.18, volume: 0.5, attack: 0.001 });
    a.noise({ type: 'bandpass', from: 450 * v, to: 220, q: 1, duration: 0.12, volume: 0.32, shape: 'soft', attack: 0.001 });
    a.noise({ type: 'lowpass', from: 800, to: 120, duration: 0.1, volume: 0.28, attack: 0.001 });
    a.clang({ base: 210 * v, duration: 0.28, volume: 0.08, wet: 0.1 });
    a.noise({ type: 'bandpass', from: 2600, to: 1500, q: 2, duration: 0.05, volume: 0.07, attack: 0.001 });
  },
  // Aire cortado por el martillo + grito al soltar el golpe
  enemySwing: (a) => {
    a.noise({ type: 'bandpass', from: 180, to: 950, q: 0.8, duration: 0.26, volume: 0.4, attack: 0.08 });
    a.tone({ from: 120, to: 55, duration: 0.22, volume: 0.2, attack: 0.06 });
    a.growl({ from: 150, to: 90, duration: 0.34, volume: 0.36, rate: 26, wet: 0.2 });
  },
  // Martillazo: golpe de metal contra el suelo con estruendo y lluvia de escombros
  hammerSlam: (a) => {
    a.noise({ type: 'highpass', from: 2000, to: 8000, duration: 0.04, volume: 0.45, attack: 0.0008 });
    a.tone({ from: 100, to: 24, duration: 0.8, volume: 0.6, attack: 0.001, wet: 0.2 });
    a.noise({ type: 'bandpass', from: 900, to: 300, q: 0.7, duration: 0.5, volume: 0.5, shape: 'hard', attack: 0.001, wet: 0.2 });
    a.noise({ type: 'lowpass', from: 5000, to: 150, duration: 0.45, volume: 0.5, attack: 0.001, wet: 0.2 });
    a.noise({ type: 'bandpass', from: 1200, to: 250, q: 1.2, duration: 0.2, volume: 0.3, shape: 'hard', attack: 0.001 });
    a.clang({ base: 430, duration: 0.75, volume: 0.24, wet: 0.3 });
    a.crackle({ duration: 0.5, rate: 40, volume: 0.12, delay: 0.05, low: 600, high: 3500 });
  },
  // Giro: tres pasadas de aire pesado, una por cada lado, con un rugido sostenido
  hammerSpin: (a) => {
    a.growl({ from: 110, to: 70, duration: 0.8, volume: 0.36, rate: 16, wet: 0.25 });
    for (const [delay, pan] of [[0, -0.5], [0.2, 0.5], [0.4, -0.3]]) {
      a.noise({ type: 'bandpass', from: 260, to: 1700, q: 1, duration: 0.24, volume: 0.36, attack: 0.09, delay, pan });
      a.tone({ type: 'sawtooth', from: 150, to: 240, duration: 0.24, volume: 0.07, shape: 'soft', lowpass: 1400, attack: 0.09, delay, pan });
    }
  },
  // Gruñido de dolor al recibir un golpe (más profundo con los golpes fuertes)
  enemyHurt: (a, { power = 1 }) => {
    const v = 1 + (Math.random() - 0.5) * 0.18;
    a.growl({ from: (175 - power * 15) * v, to: 85, duration: 0.24 + power * 0.05, volume: 0.28 + power * 0.04, rate: 30, formants: [520, 1150] });
    a.tone({ from: 90, to: 40, duration: 0.14, volume: 0.22, attack: 0.001 });
  },
  // Muerte: rugido largo, estallido de armadura y escombros
  enemyDie: (a) => {
    a.growl({ from: 150, to: 38, duration: 0.95, volume: 0.5, rate: 14, wet: 0.3 });
    a.noise({ type: 'lowpass', from: 5000, to: 100, duration: 0.6, volume: 0.5, attack: 0.001, wet: 0.2 });
    a.tone({ from: 95, to: 24, duration: 0.6, volume: 0.6, attack: 0.002 });
    a.clang({ base: 260, duration: 0.7, volume: 0.2, wet: 0.3, delay: 0.04 });
    a.crackle({ duration: 0.45, rate: 45, volume: 0.12, low: 700, high: 4000 });
  },
  thud: (a) => {
    a.tone({ from: 130, to: 32, duration: 0.24, volume: 0.62, attack: 0.001 });
    a.noise({ type: 'lowpass', from: 900, to: 100, duration: 0.16, volume: 0.36, attack: 0.001 });
    a.clang({ base: 200, duration: 0.3, volume: 0.07, wet: 0.1 });
  },
  splash: (a, { power = 1 }) => {
    const v = 1 + (Math.random() - 0.5) * 0.3;
    a.noise({ type: 'bandpass', from: 2400 * v, to: 900, duration: 0.14 + power * 0.06, volume: 0.07 + power * 0.07 });
    a.tone({ from: 1500 * v, to: 600, duration: 0.07, volume: 0.04 + power * 0.03 });
    if (power > 0.7) a.tone({ from: 700 * v, to: 300, duration: 0.12, volume: 0.05, delay: 0.04 });
  },

  // Recoger vida: arpegio brillante ascendente
  pickup: (a) => {
    [660, 880, 1320].forEach((f, i) => a.tone({ type: 'triangle', from: f, to: f * 1.01, duration: 0.3, volume: 0.16, delay: i * 0.07, attack: 0.004, wet: 0.25 }));
    a.noise({ type: 'highpass', from: 5000, to: 9000, duration: 0.12, volume: 0.1, attack: 0.002, delay: 0.14 });
  },

  // --- Cierre: Vóidhar ---
  // Retumbar creciente antes de la caída (todo en frecuencias audibles: crujido distorsionado + rugido lejano)
  voidRumble: (a) => {
    a.noise({ type: 'bandpass', from: 160, to: 800, q: 0.9, duration: 1.2, volume: 0.5, attack: 0.9, shape: 'soft', wet: 0.3 });
    a.growl({ from: 70, to: 60, duration: 1.2, volume: 0.45, rate: 11, wet: 0.4, formants: [380, 760, 1500] });
    a.crackle({ duration: 1.1, rate: 18, volume: 0.08, low: 500, high: 2500 });
  },
  // Silbido de la caída: barrido descendente con aire
  voidFall: (a) => {
    a.tone({ type: 'sawtooth', from: 2600, to: 220, duration: 0.8, volume: 0.14, shape: 'soft', lowpass: 3600, attack: 0.05, wet: 0.2 });
    a.noise({ type: 'bandpass', from: 5000, to: 500, q: 0.9, duration: 0.8, volume: 0.45, attack: 0.1, wet: 0.2 });
  },
  // Impacto enorme: estruendo, metal, acorde grave distorsionado y rugido
  voidImpact: (a) => {
    a.noise({ type: 'highpass', from: 1800, to: 8000, duration: 0.06, volume: 0.6, attack: 0.0008 });
    a.tone({ from: 90, to: 20, duration: 1.4, volume: 0.7, attack: 0.001, wet: 0.35 });
    a.noise({ type: 'bandpass', from: 1000, to: 220, q: 0.7, duration: 0.9, volume: 0.65, shape: 'hard', attack: 0.001, wet: 0.35 });
    a.noise({ type: 'lowpass', from: 7000, to: 120, duration: 1.3, volume: 0.55, attack: 0.001, wet: 0.4 });
    a.clang({ base: 180, duration: 1.4, volume: 0.28, wet: 0.5 });
    a.chord({ root: 55, duration: 2.2, volume: 0.34, cutoff: 3200, wet: 0.5 });
    a.crackle({ duration: 0.9, rate: 55, volume: 0.15, low: 600, high: 4500, delay: 0.05 });
  },
  // Rugido de Vóidhar: dos capas, una más aguda y otra mucho más grave, largo y con cola de reverberación
  voidRoar: (a) => {
    a.growl({ from: 105, to: 52, duration: 2.3, volume: 0.85, rate: 12, wet: 0.5, formants: [430, 900, 1800] });
    a.growl({ from: 140, to: 80, duration: 2.0, volume: 0.45, rate: 17, wet: 0.45, pitch: 1.2, formants: [700, 1400, 2800], delay: 0.05 });
    a.noise({ type: 'bandpass', from: 300, to: 1500, q: 0.8, duration: 2.0, volume: 0.28, attack: 0.3, shape: 'soft', wet: 0.4 });
    a.chord({ root: 55, duration: 2.4, volume: 0.22, cutoff: 2600, wet: 0.5, delay: 0.1 });
  },

  // --- Trino ---
  trinoCharge: (a) => {
    a.tone({ from: 500, to: 2000, duration: 0.85, volume: 0.09, attack: 0.3 });
    a.tone({ type: 'triangle', from: 1000, to: 3000, duration: 0.85, volume: 0.045, delay: 0.1, attack: 0.3 });
    a.crackle({ duration: 0.8, rate: 25, volume: 0.05, low: 3000, high: 10000 });
  },
  trinoFire: (a) => {
    a.noise({ type: 'highpass', from: 3000, to: 9000, duration: 0.03, volume: 0.22, attack: 0.0008 });
    a.tone({ type: 'sawtooth', from: 2800, to: 200, duration: 0.34, volume: 0.15, shape: 'hard', lowpass: 3600, attack: 0.001 });
    a.tone({ type: 'triangle', from: 900, to: 200, duration: 0.5, volume: 0.1 });
    a.crackle({ duration: 0.4, rate: 55, volume: 0.1 });
  },
};
