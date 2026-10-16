// Duelo musical: ECO contra el jefe tocando al ritmo, al estilo Guitar Hero. Caen notas por cuatro carriles y hay que pulsar la
// tecla justo cuando llegan a la línea. Cada acierto empuja la onda de ECO contra el jefe; cada fallo la hace retroceder.
// Si el medidor llega a cero gana el silencio y hay que reintentarlo; si la canción termina con ECO en pie, gana la música.
class RhythmDuel {
  static TRAVEL = 1.55; // segundos que tarda una nota en caer hasta la línea
  static PERFECT = 0.055;
  static GOOD = 0.115;
  static LATE = 0.14; // pasado este margen la nota se da por fallada
  static LANE_COLORS = ['#00f5ff', '#ffe600', '#ff003c', '#9b6bff'];
  static LANE_KEYS = ['D', 'F', 'J', 'K'];
  static CX = 480;
  static TOP = 76;
  static HIT = 452;
  static INTRO_TIME = 1.0;
  static STRAY_PENALTY = 0.015;
  static MISS_PENALTY = 0.07;
  static GAIN = { perfect: 0.035, good: 0.022 };
  static STREAK_EVERY = 10; // cada tantos aciertos seguidos, ECO dispara un rayo al jefe

  // scene: GameScene; boss: el jefe en pantalla (VoidharFinale); onWin: se llama al cerrar la pantalla de resultados
  constructor(scene, boss, onWin) {
    this.scene = scene;
    this.game = scene.game;
    this.player = scene.player;
    this.boss = boss;
    this.onWin = onWin;
    this.chart = DuelMusic.buildChart();
    this.music = new DuelMusic();
    this.age = 0;
    this.state = 'intro'; // intro → play → won | lost
    this.stateTime = 0;
    this.done = false;
    this.held = [false, false, false, false];
    this.padFlash = [0, 0, 0, 0];
    this.pops = [];
    this.fromX = { player: this.player.x, boss: boss.x };
    this.reset();
    this.game.audio.pauseMusic(true); // la música del juego calla: ahora suena la del duelo
  }

  get active() { return !this.done; }

  reset() {
    this.notes = this.chart.map((note) => ({ ...note, hit: false, missed: false }));
    this.meter = 0.5;
    this.combo = 0;
    this.maxCombo = 0;
    this.score = 0;
    this.counts = { perfect: 0, good: 0, miss: 0, stray: 0 };
    this.shownMeter = 0.5;
    this.pops.length = 0;
    this.failFlash = 0;
  }

  setState(state) {
    this.state = state;
    this.stateTime = 0;
  }

  get multiplier() { return Math.min(4, 1 + Math.floor(this.combo / 8)); }
  get songTime() { return this.music.time; }
  get accuracy() {
    const total = this.counts.perfect + this.counts.good + this.counts.miss;
    return total ? (this.counts.perfect + 0.6 * this.counts.good) / total : 0;
  }
  get rank() {
    const accuracy = this.accuracy;
    return accuracy >= 0.95 ? 'S' : accuracy >= 0.85 ? 'A' : accuracy >= 0.7 ? 'B' : 'C';
  }

  // Pausa: el reloj del audio se detiene y la canción espera
  setPaused(paused) {
    const context = this.game.audio.context;
    if (!context) return;
    try {
      if (paused) context.suspend();
      else context.resume();
    } catch (error) {
      // el navegador no permite suspender: se ignora
    }
  }

  // Al abandonar la escena: devuelve el audio a su estado normal
  dispose() {
    this.music.stop();
    this.done = true;
    this.setPaused(false);
    this.game.audio.pauseMusic(false);
  }

  // ---------------------------------------------------------------- lógica

  update(dt, input) {
    this.age += dt;
    this.stateTime += dt;
    for (let i = 0; i < 4; i++) {
      this.held[i] = input.isDown(`lane${i}`);
      this.padFlash[i] = Math.max(0, this.padFlash[i] - dt * 5);
    }
    this.failFlash = Math.max(0, this.failFlash - dt * 3);
    this.shownMeter += (this.meter - this.shownMeter) * Math.min(1, dt * 10);
    for (const pop of this.pops) pop.age += dt;
    this.pops = this.pops.filter((pop) => pop.age < 0.7);

    switch (this.state) {
      case 'intro': this.updateIntro(dt); break;
      case 'play': this.updatePlay(dt, input); break;
      case 'won': this.updateWon(input); break;
      default: break; // lost: espera la elección en el cuadro de diálogo
    }
  }

  // ECO y el jefe se colocan a los lados mientras aparece la pista
  updateIntro(dt) {
    const t = Math.min(1, this.stateTime / RhythmDuel.INTRO_TIME);
    const eased = 1 - Math.pow(1 - t, 3);
    const camera = this.scene.camera;
    this.player.x = this.fromX.player + (camera.x + 150 - this.fromX.player) * eased;
    this.boss.x = this.fromX.boss + (camera.x + 810 - this.fromX.boss) * eased;
    this.player.facing = 1;
    if (t >= 1) this.begin();
  }

  begin() {
    this.reset();
    this.music.start(this.game.audio);
    this.setState('play');
  }

  updatePlay(dt, input) {
    this.music.advance(dt);
    const time = this.songTime;

    for (let lane = 0; lane < 4; lane++) if (input.justPressed(`lane${lane}`)) this.press(lane, time);

    // Notas que se pasaron sin tocarse
    for (const note of this.notes) {
      if (!note.hit && !note.missed && time > note.t + RhythmDuel.LATE) this.miss(note);
    }

    if (this.meter <= 0) {
      this.lose();
    } else if (time >= DuelMusic.endTime) {
      this.win();
    }
  }

  // Pulsación: acierta la nota más cercana del carril dentro de la ventana; si no hay ninguna, es un toque en falso
  press(lane, time) {
    let target = null;
    for (const note of this.notes) {
      if (note.lane !== lane || note.hit || note.missed) continue;
      const gap = Math.abs(note.t - time);
      if (gap <= RhythmDuel.GOOD + 0.02 && (!target || gap < Math.abs(target.t - time))) target = note;
    }
    this.padFlash[lane] = 1;
    if (!target) {
      if (time > this.chart[0].t - 0.6) {
        this.meter = Math.max(0, this.meter - RhythmDuel.STRAY_PENALTY);
        this.counts.stray++;
      }
      this.music.playMiss(false);
      return;
    }
    const perfect = Math.abs(target.t - time) <= RhythmDuel.PERFECT;
    target.hit = true;
    this.counts[perfect ? 'perfect' : 'good']++;
    this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.score += (perfect ? 100 : 50) * this.multiplier;
    this.meter = Math.min(1, this.meter + RhythmDuel.GAIN[perfect ? 'perfect' : 'good']);
    this.music.playLead(lane);
    this.hitEffects(lane, perfect);
    this.addPop(perfect ? 'PERFECTO' : 'BIEN', perfect ? '#ffffff' : RhythmDuel.LANE_COLORS[1], lane);
    if (this.combo % RhythmDuel.STREAK_EVERY === 0) this.streakBeam();
  }

  miss(note) {
    note.missed = true;
    this.counts.miss++;
    this.combo = 0;
    this.meter = Math.max(0, this.meter - RhythmDuel.MISS_PENALTY);
    this.music.playMiss(true);
    this.addPop('FALLO', '#ff3355', note.lane);
    // El jefe responde con una onda de silencio que sacude la escena
    this.failFlash = 1;
    const world = this.scene.world;
    world.shake(5, 0.2);
    world.flash(0.1, '#ff2a55');
    this.scene.particles.add({ type: 'ring', x: this.boss.x - 40, y: this.boss.y - 100, size: 16, sizeEnd: 150, life: 0.35, color: '#a066ff', width: 6 });
  }

  addPop(text, color, lane) {
    this.pops.push({ text, color, age: 0, lane });
  }

  // Chispas y onda en el pad que se acaba de tocar
  hitEffects(lane, perfect) {
    const color = RhythmDuel.LANE_COLORS[lane];
    const camera = this.scene.camera;
    const x = camera.x + RhythmDuel.CX + (lane - 1.5) * 98;
    const y = RhythmDuel.HIT;
    this.scene.particles.burst({ x, y, count: perfect ? 14 : 8, speed: [140, 460], angle: [-Math.PI * 0.95, -Math.PI * 0.05], life: [0.15, 0.4], size: [2, 4.2], colors: [color, '#ffffff'], type: 'spark', drag: 2 });
    this.scene.particles.add({ type: 'ring', x, y, size: 8, sizeEnd: perfect ? 70 : 46, life: 0.3, color, width: 4 });
  }

  // Racha de aciertos: ECO dispara su rayo al jefe
  streakBeam() {
    const world = this.scene.world;
    const length = Math.max(200, this.boss.x - this.player.x - 70);
    world.beam({ facing: 1, owner: this.player, dx: 46, dy: -94, length, duration: 0.4, power: 2, thickness: 0.9 });
    world.audio.play('rayFire');
    world.shake(7, 0.25);
    this.boss.squash = 0.22;
    this.scene.particles.burst({ x: this.boss.x - 30, y: this.boss.y - 130, count: 18, speed: [160, 520], life: [0.2, 0.5], size: [2.4, 5], colors: ['#ffffff', '#00f5ff', '#a066ff'], type: 'spark', drag: 2 });
    this.addPop(`¡RACHA ${this.combo}!`, '#00f5ff', 1.5);
  }

  lose() {
    this.music.stop();
    this.setState('lost');
    this.game.audio.play('duelFail');
    this.scene.world.shake(12, 0.5);
    this.scene.world.flash(0.35, '#ff2a55');
    this.game.modal.show({
      title: 'EL SILENCIO GANA',
      message: `La frecuencia se apagó.\nAciertos: ${this.counts.perfect + this.counts.good}  ·  Combo máximo: ${this.maxCombo}`,
      buttons: [
        { label: 'Reintentar duelo', onClick: () => { this.game.modal.hide(); this.setState('intro'); this.fromX = { player: this.player.x, boss: this.boss.x }; this.stateTime = RhythmDuel.INTRO_TIME; } },
        { label: 'Menú principal', onClick: () => { this.game.modal.hide(); this.game.scenes.change('title'); } },
      ],
    });
  }

  win() {
    this.music.stop();
    this.setState('won');
    this.player.score += this.score;
    const world = this.scene.world;
    world.shake(18, 0.8);
    world.flash(0.5, '#ffffff');
    world.callout('¡LA NOTA FINAL!', 2.4, { y: 96, colors: ['#ffffff', '#00f5ff', '#005e8a'], glow: '#00f5ff', rim: '#00323f' });
    world.beam({ facing: 1, owner: this.player, dx: 46, dy: -94, length: Math.max(260, this.boss.x - this.player.x - 60), duration: 0.9, power: 3, thickness: 1.5, dim: true });
    world.audio.play('rayFire');
    this.boss.squash = 0.5;
    this.scene.particles.burst({ x: this.boss.x, y: this.boss.y - 140, count: 60, speed: [200, 900], life: [0.4, 1.1], size: [2.5, 6], colors: ['#ffffff', '#00f5ff', '#a066ff', '#ff2a55'], type: 'spark', drag: 1.6 });
    this.scene.particles.add({ type: 'ring', x: this.boss.x, y: this.boss.y - 120, size: 20, sizeEnd: 520, life: 0.8, color: '#00f5ff', width: 12, flat: 0.9 });
  }

  updateWon(input) {
    if (this.stateTime > 1.6 && (input.justPressed('confirm') || input.justPressed('attack')) || this.stateTime > 12) this.finish();
  }

  finish() {
    if (this.done) return;
    this.dispose();
    const callback = this.onWin;
    if (callback) callback();
  }

  // ---------------------------------------------------------------- dibujo

  // Posición en pantalla de un carril a cierta profundidad (0 = arriba, 1 = línea de aciertos)
  lanePoint(lane, depth) {
    const { TOP, HIT, CX } = RhythmDuel;
    const y = TOP + (HIT - TOP) * Math.pow(Math.max(0, depth), 1.5);
    const progress = (y - TOP) / (HIT - TOP);
    const width = 46 + 52 * progress;
    return { x: CX + (lane - 1.5) * width, y, scale: width / 98, width };
  }

  render(ctx) {
    const open = this.state === 'intro' ? Math.min(1, this.stateTime / 0.8) : 1;
    ctx.save();
    // La escena se oscurece para destacar la pista
    ctx.fillStyle = `rgba(3, 3, 12, ${0.18 * open})`;
    ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
    if (this.failFlash > 0) {
      ctx.fillStyle = `rgba(255, 30, 70, ${0.16 * this.failFlash})`;
      ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
    }
    ctx.globalAlpha = open;
    this.renderHighway(ctx);
    this.renderMeter(ctx);
    if (this.state === 'play' || this.state === 'won') this.renderNotes(ctx);
    this.renderPads(ctx);
    this.renderSideInfo(ctx);
    this.renderPops(ctx);
    this.renderCountIn(ctx);
    if (this.state === 'won' && this.stateTime > 1.0) this.renderResults(ctx);
    ctx.restore();
  }

  renderHighway(ctx) {
    const { TOP, HIT } = RhythmDuel;
    const left = this.lanePoint(0, 0);
    const bottomLeft = this.lanePoint(0, 1);
    ctx.beginPath();
    ctx.moveTo(left.x - left.width / 2, TOP);
    ctx.lineTo(CONFIG.WIDTH - (left.x - left.width / 2), TOP);
    ctx.lineTo(CONFIG.WIDTH - (bottomLeft.x - bottomLeft.width / 2), HIT + 36);
    ctx.lineTo(bottomLeft.x - bottomLeft.width / 2, HIT + 36);
    ctx.closePath();
    const fill = ctx.createLinearGradient(0, TOP, 0, HIT);
    fill.addColorStop(0, 'rgba(6, 4, 22, 0.2)');
    fill.addColorStop(1, 'rgba(6, 4, 22, 0.82)');
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0, 245, 255, 0.7)';
    ctx.shadowColor = '#00f5ff';
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Líneas de carril y marcas de cada tiempo, que corren con la música
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(160, 200, 255, 0.28)';
    for (let i = 0; i <= 4; i++) {
      const a = this.lanePoint(i - 0.5, 0);
      const b = this.lanePoint(i - 0.5, 1);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    const time = this.state === 'play' || this.state === 'won' ? this.songTime : 0;
    const beat = DuelMusic.BEAT;
    const first = Math.floor(time / beat);
    for (let k = first; k < first + Math.ceil(RhythmDuel.TRAVEL / beat) + 1; k++) {
      const depth = 1 - (k * beat - time) / RhythmDuel.TRAVEL;
      if (depth < 0 || depth > 1.04) continue;
      const a = this.lanePoint(-0.5, depth);
      const b = this.lanePoint(3.5, depth);
      ctx.strokeStyle = k % 4 === 0 ? 'rgba(255, 255, 255, 0.35)' : 'rgba(160, 200, 255, 0.14)';
      ctx.lineWidth = k % 4 === 0 ? 2.5 : 1;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }

  // Medidor de fuerza: la onda de ECO (cian) contra el silencio (rojo)
  renderMeter(ctx) {
    const x = 250;
    const y = 20;
    const width = 460;
    const height = 18;
    ctx.fillStyle = '#240812';
    ctx.fillRect(x, y, width, height);
    const split = width * this.shownMeter;
    const eco = ctx.createLinearGradient(x, 0, x + width, 0);
    eco.addColorStop(0, '#0097a8');
    eco.addColorStop(1, '#00f5ff');
    ctx.fillStyle = eco;
    ctx.fillRect(x, y, split, height);
    ctx.fillStyle = '#ff003c';
    ctx.fillRect(x + split, y, width - split, height);
    // Punta de la onda
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + split - 2, y - 4, 4, height + 8);
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#000';
    ctx.strokeRect(x, y, width, height);
    Draw.rock(ctx, 'ECO', x - 12, y + 16, { size: 22, align: 'right', colors: ['#ffffff', '#00f5ff', '#005e8a'], glow: '#00f5ff', glowBlur: 10, outlineWidth: 4 });
    Draw.rock(ctx, 'VÓIDHAR', x + width + 12, y + 16, { size: 22, align: 'left', colors: ['#ffffff', '#ff5a8a', '#6a0030'], glow: '#ff2a55', glowBlur: 10, outlineWidth: 4 });
    // Avance de la canción
    const progress = this.state === 'play' ? Math.max(0, Math.min(1, this.songTime / DuelMusic.endTime)) : (this.state === 'won' ? 1 : 0);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.fillRect(x, y + height + 6, width, 3);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y + height + 6, width * progress, 3);
  }

  renderNotes(ctx) {
    const time = this.songTime;
    const visible = [];
    for (const note of this.notes) {
      if (note.hit) continue;
      const ahead = note.t - time;
      if (ahead > RhythmDuel.TRAVEL + 0.05 || ahead < -0.35) continue;
      visible.push(note);
    }
    visible.sort((a, b) => b.t - a.t); // las más lejanas primero
    for (const note of visible) {
      const depth = 1 - (note.t - time) / RhythmDuel.TRAVEL;
      const point = this.lanePoint(note.lane, depth);
      const color = RhythmDuel.LANE_COLORS[note.lane];
      const radius = 30 * point.scale;
      ctx.save();
      ctx.globalAlpha *= note.missed ? 0.35 : Math.min(1, depth * 4);
      ctx.shadowColor = color;
      ctx.shadowBlur = 14 * point.scale;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(point.x, point.y, radius, radius * 0.62, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.lineWidth = Math.max(2, 4 * point.scale);
      ctx.strokeStyle = '#000';
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.beginPath();
      ctx.ellipse(point.x, point.y - radius * 0.05, radius * 0.45, radius * 0.26, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // Los cuatro pads de la línea de aciertos, con la tecla de cada uno
  renderPads(ctx) {
    for (let lane = 0; lane < 4; lane++) {
      const point = this.lanePoint(lane, 1);
      const color = RhythmDuel.LANE_COLORS[lane];
      const pressed = this.held[lane] || this.padFlash[lane] > 0.4;
      const radius = 33;
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = pressed ? 24 : 8;
      ctx.lineWidth = 5;
      ctx.strokeStyle = color;
      ctx.fillStyle = pressed ? color : 'rgba(0, 0, 0, 0.55)';
      ctx.beginPath();
      ctx.ellipse(point.x, point.y, radius, radius * 0.62, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      Draw.text(ctx, RhythmDuel.LANE_KEYS[lane], point.x, point.y + 8, { size: 22, align: 'center', color: pressed ? '#000' : color, strokeWidth: pressed ? 0 : 4 });
      ctx.restore();
    }
  }

  renderSideInfo(ctx) {
    // Racha, a la izquierda
    Draw.rock(ctx, 'RACHA', 34, 118, { size: 20, colors: ['#ffffff', '#ffe600', '#c46a00'], outlineWidth: 4, tracking: 2 });
    Draw.text(ctx, String(this.combo), 34, 188, { size: 70, color: this.combo >= 8 ? '#ffe600' : '#ffffff', strokeWidth: 8 });
    Draw.text(ctx, `x${this.multiplier}`, 34, 226, { size: 34, color: this.multiplier > 1 ? '#00f5ff' : '#8fa0b8', strokeWidth: 6 });
    // Puntos y precisión, a la derecha
    Draw.rock(ctx, 'PUNTOS', CONFIG.WIDTH - 34, 118, { size: 20, align: 'right', colors: ['#ffffff', '#ffe600', '#c46a00'], outlineWidth: 4, tracking: 2 });
    Draw.text(ctx, String(this.score).padStart(6, '0'), CONFIG.WIDTH - 34, 168, { size: 40, align: 'right', color: '#ffe600', strokeWidth: 7 });
    if (this.counts.perfect + this.counts.good + this.counts.miss > 0) {
      Draw.text(ctx, `Precisión ${Math.round(this.accuracy * 100)}%`, CONFIG.WIDTH - 34, 204, { size: 20, align: 'right', color: '#cfe', strokeWidth: 4 });
    }
  }

  renderPops(ctx) {
    for (const pop of this.pops) {
      const t = pop.age / 0.7;
      const point = this.lanePoint(Math.min(3, Math.max(0, pop.lane)), 1);
      ctx.save();
      ctx.globalAlpha *= 1 - t * t;
      Draw.text(ctx, pop.text, pop.lane === 1.5 ? RhythmDuel.CX : point.x, RhythmDuel.HIT - 52 - t * 36, {
        size: 24 + (1 - t) * 8, align: 'center', color: pop.color, strokeWidth: 5,
      });
      ctx.restore();
    }
  }

  // Cuenta atrás y ayuda de teclas antes de la primera nota
  renderCountIn(ctx) {
    if (this.state === 'intro') {
      Draw.rock(ctx, 'DUELO MUSICAL', CONFIG.WIDTH / 2, 250, { size: 40, align: 'center', colors: ['#ffffff', '#00f5ff', '#005e8a'], glow: '#00f5ff', glowBlur: 16, outlineWidth: 8, tracking: 3 });
      return;
    }
    if (this.state !== 'play') return;
    const time = this.songTime;
    const countIn = DuelMusic.COUNT_IN_BARS * 4 * DuelMusic.BEAT;
    if (time < countIn - 0.2) {
      Draw.rock(ctx, 'TOCA AL RITMO', CONFIG.WIDTH / 2, 232, { size: 34, align: 'center', colors: ['#ffffff', '#ffe600', '#c46a00'], outlineWidth: 7, tracking: 3 });
      Draw.text(ctx, 'D  F  J  K   o   ←  ↓  ↑  →', CONFIG.WIDTH / 2, 270, { size: 20, align: 'center', color: '#cfe', strokeWidth: 4 });
      if (time >= 0) {
        const beat = Math.floor(time / DuelMusic.BEAT) % 4;
        Draw.text(ctx, String(4 - beat), CONFIG.WIDTH / 2, 340, { size: 60, align: 'center', color: '#ffffff', strokeWidth: 8 });
      }
    }
  }

  renderResults(ctx) {
    const fade = Math.min(1, (this.stateTime - 1.0) / 0.5);
    ctx.save();
    ctx.globalAlpha *= fade;
    const x = 280;
    const y = 120;
    const width = 400;
    const height = 330;
    ctx.fillStyle = 'rgba(4, 4, 18, 0.92)';
    ctx.fillRect(x, y, width, height);
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#000';
    ctx.strokeRect(x, y, width, height);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#00f5ff';
    ctx.shadowColor = '#00f5ff';
    ctx.shadowBlur = 12;
    ctx.strokeRect(x + 5, y + 5, width - 10, height - 10);
    ctx.shadowBlur = 0;

    Draw.rock(ctx, '¡DUELO GANADO!', CONFIG.WIDTH / 2, y + 52, { size: 32, align: 'center', colors: ['#ffffff', '#00f5ff', '#005e8a'], glow: '#00f5ff', glowBlur: 12, outlineWidth: 6, tracking: 2 });
    const rows = [
      ['Perfectos', this.counts.perfect],
      ['Bien', this.counts.good],
      ['Fallos', this.counts.miss],
      ['Combo máximo', this.maxCombo],
      ['Precisión', `${Math.round(this.accuracy * 100)}%`],
      ['Puntos', this.score],
    ];
    rows.forEach(([label, value], index) => {
      const rowY = y + 96 + index * 32;
      Draw.text(ctx, label, x + 40, rowY, { size: 22, color: '#cfe', strokeWidth: 4 });
      Draw.text(ctx, String(value), x + 250, rowY, { size: 22, align: 'right', color: '#ffffff', strokeWidth: 4 });
    });
    Draw.rock(ctx, this.rank, x + width - 62, y + 190, { size: 96, align: 'center', colors: ['#ffffff', '#ffe600', '#c46a00'], glow: '#ffb000', glowBlur: 16, outlineWidth: 10 });
    if (this.stateTime > 1.6 && Math.floor(this.age * 2.5) % 2 === 0) {
      Draw.text(ctx, 'ENTER ▶', CONFIG.WIDTH / 2, y + height - 22, { size: 20, align: 'center', color: '#00f5ff', strokeWidth: 4 });
    }
    ctx.restore();
  }
}
