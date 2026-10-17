// Canción del duelo musical: un tema de rock sintetizado (batería, bajo y guitarras) y su partitura de notas.
// La canción se programa por compases un poco antes de que suenen, usando el reloj del audio, así la música y las notas
// que caen en pantalla quedan sincronizadas. Las notas de la melodía suenan cuando ECO las toca; si falla, se silencian.
class DuelMusic {
  static BPM = 152;
  static BEAT = 60 / 152;
  static COUNT_IN_BARS = 1;
  static LOOKAHEAD = 1.2; // segundos de música que se programan por adelantado
  static LEAD = [440, 523.25, 587.33, 659.25]; // La, Do, Re, Mi: pentatónica menor de La, una nota por carril
  static ROOTS = [110, 87.31, 130.81, 98]; // Am - F - C - G, un acorde por compás

  // Partitura: cada compás son 8 corcheas. '.' silencio, '0'-'3' una nota en ese carril,
  // y dobles: a = 0+2, b = 1+3, c = 0+3, d = 1+2, e = 2+3.
  static SECTIONS = [
    { name: 'estrofa', energy: 0, bars: ['0...0.1.', '1...1.2.', '2...2.1.', '3...1.0.', '0.0.1.2.', '3...3...'] },
    { name: 'estribillo', energy: 1, bars: ['0.1.2.3.', '3.2.1.0.', '1.2.3.2.', 'a.1.b.3.', 'c.2.1.0.', '3.c...c.'] },
    { name: 'solo', energy: 2, bars: ['01230123', '32103210', '01232123', '0.1.2.3.', 'e.d.a.b.', '3.2.1.0.'] },
    { name: 'final', energy: 3, bars: ['a.b.a.b.', 'c.d.e.c.', '0123.3.3', 'a1b2c3d.', 'e.d.c.b.', 'c.c.c.cc'] },
  ];
  static DOUBLES = { a: [0, 2], b: [1, 3], c: [0, 3], d: [1, 2], e: [2, 3] };

  // Lista de notas { t (segundos desde el inicio), lane, pitch, bar }
  static buildChart() {
    const notes = [];
    let first = DuelMusic.COUNT_IN_BARS;
    DuelMusic.SECTIONS.forEach((section) => {
      section.bars.forEach((pattern, i) => {
        const bar = first + i;
        for (let slot = 0; slot < 8; slot++) {
          const symbol = pattern[slot];
          if (symbol === '.') continue;
          const lanes = DuelMusic.DOUBLES[symbol] || [Number(symbol)];
          for (const lane of lanes) notes.push({ t: (bar * 4 + slot * 0.5) * DuelMusic.BEAT, lane, pitch: DuelMusic.LEAD[lane], bar });
        }
      });
      first += section.bars.length;
    });
    return notes;
  }

  // Sección y posición dentro de ella para un compás de la canción (sin contar la cuenta atrás)
  static locate(index) {
    let rest = index;
    for (const section of DuelMusic.SECTIONS) {
      if (rest < section.bars.length) return { section, inSection: rest };
      rest -= section.bars.length;
    }
    return null;
  }

  static get totalBars() { return DuelMusic.COUNT_IN_BARS + DuelMusic.SECTIONS.reduce((sum, section) => sum + section.bars.length, 0); }
  static get endTime() { return DuelMusic.totalBars * 4 * DuelMusic.BEAT; } // el acorde final suena aquí

  constructor() {
    this.audio = null;
    this.context = null;
    this.startAt = 0;
    this.clock = 0; // reloj propio si no hay audio (pruebas)
    this.nextBar = 0;
    this.running = false;
  }

  // Empieza la canción; el tiempo 0 es el inicio del primer compás. Con audio se usa su reloj, que se detiene al pausar.
  start(audio) {
    this.audio = audio;
    this.context = audio && audio.context ? audio.context : null;
    this.nextBar = 0;
    this.running = true;
    if (this.context) this.startAt = this.context.currentTime + 0.3;
    else this.clock = -0.3;
  }

  stop() {
    this.running = false;
  }

  get time() {
    return this.context ? this.context.currentTime - this.startAt : this.clock;
  }

  advance(dt) {
    if (!this.running) return;
    if (!this.context) this.clock += dt;
    this.schedule();
  }

  // Programa los compases que van a sonar dentro del margen de adelanto
  schedule() {
    if (!this.context) return;
    const horizon = this.time + DuelMusic.LOOKAHEAD;
    while (this.nextBar <= DuelMusic.totalBars) {
      const barStart = this.nextBar * 4 * DuelMusic.BEAT;
      if (barStart > horizon) break;
      this.scheduleBar(this.nextBar, barStart);
      this.nextBar++;
    }
  }

  // Ejecuta fn(retraso) para un instante de la canción, si aún no pasó
  at(songTime, fn) {
    const delay = this.startAt + songTime - this.context.currentTime;
    if (delay < -0.05) return;
    fn(Math.max(0, delay));
  }

  scheduleBar(bar, barStart) {
    const half = DuelMusic.BEAT / 2;
    const slotTime = (slot) => barStart + slot * half;

    // Cuenta atrás: un golpe de hi-hat por tiempo
    if (bar < DuelMusic.COUNT_IN_BARS) {
      for (let beat = 0; beat < 4; beat++) this.at(barStart + beat * DuelMusic.BEAT, (d) => this.hat(d, beat === 0 ? 0.2 : 0.12, false));
      if (bar === DuelMusic.COUNT_IN_BARS - 1) this.at(slotTime(6), (d) => this.snare(d, 0.3));
      return;
    }
    // Acorde final
    if (bar === DuelMusic.totalBars) {
      this.at(barStart, (d) => {
        this.crash(d);
        this.kick(d);
        this.audio.chord({ root: 220, duration: 3.4, volume: 0.2, delay: d, cutoff: 4200, wet: 0.4 });
        this.audio.chord({ root: 110, duration: 3.4, volume: 0.16, delay: d, cutoff: 2600, wet: 0.3 });
        this.audio.tone({ type: 'sawtooth', from: 55, to: 55, duration: 3, volume: 0.3, delay: d, lowpass: 400, shape: 'soft' });
      });
      return;
    }

    const index = bar - DuelMusic.COUNT_IN_BARS;
    const { section, inSection } = DuelMusic.locate(index);
    const energy = section.energy;
    const root = DuelMusic.ROOTS[inSection % 4];
    const fill = inSection === section.bars.length - 1;

    // Batería
    const kicks = [[0, 4], [0, 3, 4, 7], [0, 3, 4, 6], [0, 2, 3, 4, 6, 7]][energy];
    for (const slot of kicks) this.at(slotTime(slot), (d) => this.kick(d));
    const snares = fill ? [2] : [2, 6];
    for (const slot of snares) this.at(slotTime(slot), (d) => this.snare(d, 0.34));
    if (fill) for (let k = 0; k < 8; k++) this.at(barStart + 2 * DuelMusic.BEAT + k * (DuelMusic.BEAT / 4), (d) => this.snare(d, 0.18 + k * 0.025));
    for (let slot = 0; slot < 8; slot++) this.at(slotTime(slot), (d) => this.hat(d, slot % 2 === 0 ? 0.13 : 0.09, slot === 7 && energy >= 1));
    if (inSection === 0 && energy >= 1) this.at(barStart, (d) => this.crash(d));
    if (inSection === 0 && energy === 0) this.at(barStart, (d) => this.crash(d));

    // Bajo: corcheas sobre la fundamental, con salto de octava en las secciones fuertes
    for (let slot = 0; slot < 8; slot++) {
      const octave = energy >= 1 && (slot === 3 || slot === 7) ? 2 : 1;
      this.at(slotTime(slot), (d) => this.audio.tone({ type: 'sawtooth', from: root * octave, to: root * octave, duration: 0.22, volume: 0.19, delay: d, lowpass: 650, shape: 'soft', attack: 0.006 }));
    }

    // Guitarra rítmica: acordes apagados en la estrofa, sostenidos en el estribillo y el solo, y ambos en el final
    const chugs = [[0, 2, 3, 4, 6, 7], [0, 2, 3, 4, 6], [], [0, 1, 2, 3, 4, 5, 6, 7]][energy];
    for (const slot of chugs) this.at(slotTime(slot), (d) => this.audio.chord({ root: root * 2, duration: 0.17, volume: 0.1, delay: d, cutoff: 1500, wet: 0.08 }));
    const sustained = [[], [0, 4], [0, 4], [0]][energy];
    for (const slot of sustained) this.at(slotTime(slot), (d) => this.audio.chord({ root: root * 2, duration: 1.0, volume: energy === 2 ? 0.1 : 0.14, delay: d, cutoff: 3600, wet: 0.25 }));
  }

  kick(delay) {
    this.audio.tone({ type: 'sine', from: 150, to: 46, duration: 0.2, volume: 0.48, delay, attack: 0.002 });
    this.audio.noise({ type: 'lowpass', from: 900, to: 200, duration: 0.04, volume: 0.15, delay, attack: 0.001 });
  }

  snare(delay, volume) {
    this.audio.noise({ type: 'bandpass', from: 2200, to: 1000, q: 0.7, duration: 0.17, volume, delay, attack: 0.001 });
    this.audio.tone({ type: 'triangle', from: 200, to: 120, duration: 0.1, volume: volume * 0.8, delay, attack: 0.001 });
  }

  hat(delay, volume, open) {
    this.audio.noise({ type: 'highpass', from: 7000, to: 7000, duration: open ? 0.2 : 0.04, volume, delay, attack: 0.001 });
  }

  crash(delay) {
    this.audio.noise({ type: 'highpass', from: 5200, to: 3200, duration: 1.4, volume: 0.22, delay, attack: 0.002, wet: 0.3 });
  }

  // Nota de la melodía tocada por ECO: guitarra eléctrica con un poco de distorsión y reverberación
  playLead(lane) {
    if (!this.context) return;
    const pitch = DuelMusic.LEAD[lane];
    this.audio.tone({ type: 'sawtooth', from: pitch, to: pitch, duration: 0.42, volume: 0.17, lowpass: 4200, shape: 'soft', attack: 0.006, wet: 0.28, detune: 6 });
    this.audio.tone({ type: 'square', from: pitch * 2, to: pitch * 2, duration: 0.2, volume: 0.04, lowpass: 3000, attack: 0.004, wet: 0.2 });
  }

  // Nota fallada: un trasteo apagado y seco
  playMiss(loud = true) {
    if (!this.context) return;
    this.audio.noise({ type: 'bandpass', from: 260, to: 120, q: 1.2, duration: 0.12, volume: loud ? 0.3 : 0.12, attack: 0.002 });
    this.audio.tone({ type: 'square', from: 78, to: 52, duration: 0.1, volume: loud ? 0.1 : 0.04, lowpass: 400, attack: 0.002 });
  }
}
