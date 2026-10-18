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

  // style: 'rock' (banda base) o 'tribal' (banda base + percusión del templo de Batuk: taiko, congas, sonajas, gong y toms)
  constructor(style = 'rock') {
    this.style = style;
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
      if (this.style === 'tribal') for (let beat = 0; beat < 4; beat += 2) this.at(barStart + beat * DuelMusic.BEAT, (d) => this.taiko(d, 0.5));
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
        if (this.style === 'tribal') { this.gong(d); this.taiko(d, 0.7); }
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

    if (this.style === 'tribal') this.tribalBar({ barStart, slotTime, energy, inSection, fill });

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

  // Percusión del templo de Batuk: se suma a la banda según la energía de cada sección
  tribalBar({ barStart, slotTime, energy, inSection, fill }) {
    const beat = DuelMusic.BEAT;
    // Taiko: golpes graves en los tiempos 1 y 3, y respuesta al final del compás en las secciones fuertes
    const taikos = [[0], [0, 4], [0, 4, 7], [0, 3, 4, 7]][energy];
    for (const slot of taikos) this.at(slotTime(slot), (d) => this.taiko(d, slot === 0 ? 0.5 : 0.36));
    // Congas: contrapunto sincopado que se llena con la energía
    const congas = [[3], [1, 3, 5, 7], [1, 2, 3, 5, 6, 7], [1, 2, 3, 4, 5, 6, 7]][energy];
    congas.forEach((slot, i) => this.at(slotTime(slot), (d) => this.conga(d, i % 2 ? 330 : 255, 0.17)));
    // Sonajas continuas desde el estribillo
    if (energy >= 1) for (let slot = 0; slot < 8; slot++) this.at(slotTime(slot), (d) => this.shaker(d, slot % 2 ? 0.05 : 0.08));
    // Gong al empezar cada sección
    if (inSection === 0) this.at(barStart, (d) => this.gong(d));
    // Relleno de toms que baja de tono antes de cambiar de sección
    if (fill) [0, 0.5, 1, 1.5, 2, 2.5].forEach((offset, i) => this.at(barStart + 2 * beat + offset * (beat / 2) + (i > 3 ? 0 : 0), (d) => this.conga(d, 360 - i * 38, 0.2)));
  }

  // Taiko: tambor enorme, grave y con cuerpo; el golpe tiene un chasquido de parche y una cola larga
  taiko(delay, volume = 0.5) {
    this.audio.tone({ type: 'sine', from: 98, to: 38, duration: 0.5, volume, delay, attack: 0.002, wet: 0.2 });
    this.audio.tone({ type: 'triangle', from: 190, to: 80, duration: 0.22, volume: volume * 0.45, delay, attack: 0.001, wet: 0.25 });
    this.audio.noise({ type: 'bandpass', from: 700, to: 220, q: 1, duration: 0.12, volume: volume * 0.5, delay, attack: 0.001 });
  }

  // Conga: parche seco y agudo que cae de tono
  conga(delay, pitch = 280, volume = 0.18) {
    this.audio.tone({ type: 'sine', from: pitch * 1.25, to: pitch * 0.78, duration: 0.17, volume, delay, attack: 0.001, wet: 0.12 });
    this.audio.noise({ type: 'bandpass', from: 2200, to: 1300, q: 2, duration: 0.045, volume: volume * 0.45, delay, attack: 0.001 });
  }

  // Sonaja: ráfaga corta de ruido muy agudo
  shaker(delay, volume = 0.06) {
    this.audio.noise({ type: 'highpass', from: 9000, to: 9000, duration: 0.04, volume, delay, attack: 0.002 });
  }

  // Gong: parciales inarmónicos que se apagan lentamente, con reverberación grande
  gong(delay) {
    this.audio.clang({ base: 150, duration: 2.6, volume: 0.22, delay, wet: 0.5 });
    this.audio.tone({ type: 'sine', from: 68, to: 60, duration: 2.2, volume: 0.22, delay, attack: 0.01, wet: 0.4 });
    this.audio.noise({ type: 'bandpass', from: 1800, to: 900, q: 0.8, duration: 1.2, volume: 0.1, delay, attack: 0.02, wet: 0.5 });
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
  // Nota de la guitarra de ECO: dos cuerdas ligeramente desafinadas, octava grave, brillo y un eco corto; cada carril suena en un lado
  playLead(lane) {
    if (!this.context) return;
    const pitch = DuelMusic.LEAD[lane];
    const pan = (lane - 1.5) * 0.3;
    this.audio.tone({ type: 'sawtooth', from: pitch, to: pitch, duration: 0.46, volume: 0.15, lowpass: 4600, shape: 'soft', attack: 0.005, wet: 0.3, detune: 7, pan });
    this.audio.tone({ type: 'sawtooth', from: pitch, to: pitch, duration: 0.4, volume: 0.09, lowpass: 3800, shape: 'soft', attack: 0.005, wet: 0.25, detune: -9, pan: -pan });
    this.audio.tone({ type: 'sawtooth', from: pitch / 2, to: pitch / 2, duration: 0.3, volume: 0.08, lowpass: 1400, attack: 0.006, pan });
    this.audio.tone({ type: 'square', from: pitch * 2, to: pitch * 2, duration: 0.18, volume: 0.035, lowpass: 3200, attack: 0.004, wet: 0.2 });
    // Eco: la misma nota, más suave, a corchea con puntillo
    this.audio.tone({ type: 'sawtooth', from: pitch, to: pitch, duration: 0.3, volume: 0.05, lowpass: 2600, shape: 'soft', delay: DuelMusic.BEAT * 0.75, attack: 0.006, wet: 0.45, pan: -pan });
  }

  // Destello agudo al acertar de forma perfecta
  playSparkle(lane) {
    if (!this.context) return;
    this.audio.tone({ type: 'sine', from: DuelMusic.LEAD[lane] * 4, to: DuelMusic.LEAD[lane] * 4, duration: 0.16, volume: 0.035, attack: 0.002, wet: 0.35, pan: (lane - 1.5) * 0.4 });
  }

  // Sube la racha de ×1 a ×2/×3/×4: acorde ascendente con platillo; cada nivel suena más grande
  playTierUp(level) {
    if (!this.context) return;
    const root = [0, 0, 165, 196, 220][Math.min(4, level)];
    this.audio.chord({ root, duration: 0.9 + 0.2 * level, volume: 0.16, cutoff: 3600 + 700 * level, wet: 0.35 });
    this.audio.tone({ type: 'sawtooth', from: root, to: root * 2, duration: 0.5, volume: 0.1, shape: 'soft', lowpass: 3000, attack: 0.02, wet: 0.3 });
    this.audio.noise({ type: 'highpass', from: 4200, to: 9000, duration: 0.9, volume: 0.1 + 0.03 * level, attack: 0.25, wet: 0.3 });
    this.audio.tone({ from: 120, to: 40, duration: 0.4, volume: 0.35, attack: 0.002 });
    if (level >= 3) this.audio.noise({ type: 'lowpass', from: 3000, to: 180, duration: 0.8, volume: 0.25, attack: 0.002, wet: 0.4 });
  }

  // Nota fallada: un trasteo apagado y seco
  playMiss(loud = true) {
    if (!this.context) return;
    this.audio.noise({ type: 'bandpass', from: 260, to: 120, q: 1.2, duration: 0.12, volume: loud ? 0.3 : 0.12, attack: 0.002 });
    this.audio.tone({ type: 'square', from: 78, to: 52, duration: 0.1, volume: loud ? 0.1 : 0.04, lowpass: 400, attack: 0.002 });
  }
}
