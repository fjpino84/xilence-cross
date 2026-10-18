// Duelo con una canción grabada (assets/audio/batuk-battle.mp3) y su partitura (BATUK_CHART). Mismo interfaz que DuelMusic,
// pero la música es el archivo: durante el duelo no suena nada sintetizado salvo el "pac pac" de una nota mal tocada.
// El reloj sale del propio elemento de audio, suavizado con el reloj del navegador (currentTime avanza a saltos).
class TrackMusic {
  static COUNT_IN = 1.0; // segundos antes de la primera nota que se enseña la pista
  static CHART = typeof BATUK_CHART !== 'undefined' ? BATUK_CHART : { start: 43, end: 150, bpm: 72.5, latency: 0, notes: [] };
  static BEAT = 60 / (TrackMusic.CHART.bpm * 2); // un "tiempo" visual = 145 BPM (la canción va a 72,5 en medio tiempo)
  static BEAT_OFFSET = (TrackMusic.CHART.phase || TrackMusic.CHART.start) - TrackMusic.CHART.start; // el primer tiempo cae un poco después del inicio del tramo
  static get countInTime() { return 0.9; }

  // Partitura en el formato del duelo: { t (s desde el inicio del tramo), lane }
  static buildChart() {
    return TrackMusic.CHART.notes.map(([t, lane]) => ({ t, lane, pitch: 0, bar: 0 }));
  }

  static get endTime() { return TrackMusic.CHART.end - TrackMusic.CHART.start; }

  constructor() {
    this.audio = null;
    this.running = false;
    this.clock = 0;
    this.lastAudio = 0;
    this.lastStamp = 0;
    this.drift = 0;
  }

  // Salta al inicio del tramo y arranca; el tiempo 0 de la partitura es CHART.start
  start(audio) {
    this.audio = audio;
    this.running = true;
    this.clock = -0.05;
    this.synced = audio.seekBoss(TrackMusic.CHART.start);
    this.lastAudio = TrackMusic.CHART.start;
    this.lastStamp = performance.now();
  }

  stop() {
    this.running = false;
  }

  get time() {
    return this.clock - TrackMusic.CHART.latency;
  }

  // Avanza el reloj con dt y lo corrige hacia el audio real si se separa más de 60 ms
  advance(dt) {
    if (!this.running) return;
    this.clock += dt;
    const audioTime = this.audio ? this.audio.bossTime() : null;
    if (audioTime !== null && this.synced) {
      const real = audioTime - TrackMusic.CHART.start;
      const error = real - this.clock;
      if (Math.abs(error) > 0.25) this.clock = real; // salto grande (cambio de pestaña, carga lenta): se recoloca
      else if (Math.abs(error) > 0.04) this.clock += error * Math.min(1, dt * 6); // corrección suave
    }
  }

  // Compatibilidad con DuelMusic: aquí no hay síntesis
  playLead() {}
  playSparkle() {}
  playTierUp() {}

  // Nota mal tocada: "pac pac" de una cuerda mal pulsada
  playMiss() {
    if (this.audio) this.audio.play('duelBad');
  }
}
