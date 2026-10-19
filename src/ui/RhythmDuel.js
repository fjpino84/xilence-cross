// Duelo musical: ECO contra el jefe tocando al ritmo, al estilo Guitar Hero. Caen notas por cuatro carriles y hay que pulsar la
// tecla justo cuando llegan a la línea. Cada acierto empuja la onda de ECO contra el jefe; cada fallo la hace retroceder.
// Si el medidor llega a cero gana el silencio y hay que reintentarlo; si la canción termina con ECO en pie, gana la música.
class RhythmDuel {
  // Segundos que tarda una nota en recorrer la pista. La velocidad es siempre la misma durante todo el duelo
  // (movimiento lineal, sin aceleraciones); cada jefe puede usar otra para ser más fácil o más difícil.
  static TRAVEL = 1.05;
  static PERFECT = 0.055;
  static GOOD = 0.115;
  static LATE = 0.14; // pasado este margen la nota se da por fallada
  static LANE_COLORS = ['#00f5ff', '#ffe600', '#ff003c', '#9b6bff'];
  static LANE_KEYS = ['Z', 'X', 'C', 'V'];
  static CX = 480;
  static TOP = 76;
  static HIT = 452;
  static INTRO_TIME = 1.0;
  static STRAY_PENALTY = 0.015;
  static MISS_PENALTY = 0.07;
  static GAIN = { perfect: 0.035, good: 0.022 };
  static STREAK_EVERY = 10; // cada tantos aciertos seguidos, ECO dispara un rayo al jefe

  // scene: GameScene; boss: el jefe en pantalla (VoidharFinale); onWin: se llama al cerrar la pantalla de resultados
  constructor(scene, boss, onWin, { travel = RhythmDuel.TRAVEL } = {}) {
    this.travel = travel;
    this.scene = scene;
    this.game = scene.game;
    this.player = scene.player;
    this.boss = boss;
    this.onWin = onWin;
    // Con la canción grabada (jefe con musicStyle 'track') se usa su partitura; si no, el tema de rock sintetizado
    this.song = boss.musicStyle === 'track' ? TrackMusic : DuelMusic;
    this.chart = this.song.buildChart();
    this.music = this.song === TrackMusic ? new TrackMusic() : new DuelMusic(boss.musicStyle || 'rock');
    this.tier = 1; // multiplicador alcanzado (1-4); sube con la racha y se reinicia al fallar
    this.sparks = []; // chispas de las rachas (coordenadas de pantalla)
    this.sparkTimer = 0;
    this.age = 0;
    this.state = 'intro'; // intro → play → won | lost
    this.stateTime = 0;
    this.done = false;
    this.held = [false, false, false, false];
    this.padFlash = [0, 0, 0, 0];
    this.pops = [];
    this.fromX = { player: this.player.x, boss: boss.x };
    this.lastBeat = -1;
    this.reset();
    this.game.audio.pauseMusic(true); // la música del juego calla: ahora suena la del duelo
    this.game.audio.setSfxFilter(null);
    // La canción es lo principal: los efectos (notas, fallos, rachas, tambores de Batuk) suenan a la mitad
    this.game.audio.setSfxLevel(this.song === TrackMusic ? 0.5 : 1);
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
    this.tier = 1;
    this.sparks = [];
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
    if (this.song === TrackMusic) { this.game.audio.pauseBoss(paused); return; }
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
    this.game.audio.setSfxFilter(null);
    this.game.audio.setSfxLevel(1);
    // Con la canción del jefe la música de la etapa NO vuelve al terminar el duelo (se libera al volver al menú)
    if (this.song !== TrackMusic) this.game.audio.pauseMusic(false);
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
    this.tierFlash = Math.max(0, (this.tierFlash || 0) - dt * 2.4);
    this.updateSparks(dt);
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
    this.boss.x = this.fromX.boss + (camera.x + 765 - this.fromX.boss) * eased;
    this.player.facing = 1;
    if (t >= 1) this.begin();
  }

  begin() {
    this.reset();
    this.lastBeat = -1;
    this.music.start(this.game.audio);
    this.setState('play');
  }

  updatePlay(dt, input) {
    this.music.advance(dt);
    const time = this.songTime;
    // Cada tiempo de la canción, el jefe late con la música (y puede traer instrumentos)
    const beat = Math.floor((time - this.song.BEAT_OFFSET) / this.song.BEAT);
    if (time >= 0 && beat > this.lastBeat) {
      this.lastBeat = beat;
      if (this.boss.onBeat) this.boss.onBeat(beat, this.combo, this.scene.world);
    }

    for (let lane = 0; lane < 4; lane++) if (input.justPressed(`lane${lane}`)) this.press(lane, time);

    // Notas que se pasaron sin tocarse
    for (const note of this.notes) {
      if (!note.hit && !note.missed && time > note.t + RhythmDuel.LATE) this.miss(note);
    }

    if (this.meter <= 0) {
      this.lose();
    } else if (time >= this.song.endTime) {
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
    if (this.multiplier > this.tier) this.tierUp(this.multiplier);
    this.score += (perfect ? 100 : 50) * this.multiplier;
    this.meter = Math.min(1, this.meter + RhythmDuel.GAIN[perfect ? 'perfect' : 'good']);
    this.music.playLead(lane);
    this.game.audio.play('duelNote', { lane, perfect });
    if (perfect) this.music.playSparkle(lane);
    this.hitEffects(lane, perfect);
    this.addPop(perfect ? 'PERFECTO' : 'BIEN', perfect ? '#ffffff' : RhythmDuel.LANE_COLORS[1], lane);
    if (this.combo % RhythmDuel.STREAK_EVERY === 0) this.streakBeam();
  }

  miss(note) {
    note.missed = true;
    this.counts.miss++;
    this.combo = 0;
    this.tier = 1;
    this.meter = Math.max(0, this.meter - RhythmDuel.MISS_PENALTY);
    this.music.playMiss(true);
    this.addPop('FALLO', '#ff3355', note.lane);
    if (this.boss.react) this.boss.react('miss', this.scene.world);
    // El jefe responde con una onda de silencio que sacude la escena
    this.failFlash = 1;
    const world = this.scene.world;
    world.shake(5, 0.2);
    world.flash(0.1, '#ff2a55');
    this.scene.particles.add({ type: 'ring', x: this.boss.x - 40, y: this.boss.y - 100, size: 16, sizeEnd: 150, life: 0.35, color: '#a066ff', width: 6 });
  }

  addPop(text, color, lane, size = 0) {
    this.pops.push({ text, color, age: 0, lane, size });
  }

  // Colores de la racha según el multiplicador: cian → oro → naranja ardiente → blanco dorado de leyenda
  static TIER = {
    1: { rail: '120, 250, 255', glow: '#00f5ff', text: '#ffffff' },
    2: { rail: '150, 255, 235', glow: '#40ffd0', text: '#9affe4' },
    3: { rail: '255, 190, 80', glow: '#ff9a1a', text: '#ffcf5a' },
    4: { rail: '255, 236, 170', glow: '#ffd23a', text: '#fff2a8' },
  };
  static TIER_NAMES = { 2: '¡EN RACHA!', 3: '¡EN LLAMAS!', 4: '¡LEYENDA!' };

  // Sube de nivel la racha: destello, onda, chispas, cartel, acorde ascendente y reacción del jefe
  tierUp(level) {
    this.tier = level;
    const world = this.scene.world;
    const style = RhythmDuel.TIER[level];
    this.music.playTierUp(level);
    world.flash(0.18 + 0.05 * level, style.glow);
    world.shake(5 + 3 * level, 0.3);
    this.tierFlash = 1;
    this.addPop(`×${level}  ${RhythmDuel.TIER_NAMES[level]}`, style.text, 1.5, 38 + 4 * level);
    if (this.boss.react) this.boss.react('tier', world);
    // Lluvia de chispas desde los pads
    for (let lane = 0; lane < 4; lane++) {
      const point = this.lanePoint(lane, 1);
      for (let i = 0; i < 10 + 6 * level; i++) {
        this.sparks.push({
          x: point.x + (Math.random() - 0.5) * 50, y: point.y, vx: (Math.random() - 0.5) * 240, vy: -(160 + Math.random() * 420),
          age: 0, life: 0.5 + Math.random() * 0.7, size: 1.8 + Math.random() * 2.6, hot: Math.random() < 0.4,
        });
      }
    }
  }

  // Chispas y onda en el pad que se acaba de tocar
  hitEffects(lane, perfect) {
    const color = RhythmDuel.LANE_COLORS[lane];
    const camera = this.scene.camera;
    const x = camera.x + RhythmDuel.CX + (lane - 1.5) * 100;
    const y = RhythmDuel.HIT;
    this.scene.particles.burst({ x, y, count: perfect ? 14 : 8, speed: [140, 460], angle: [-Math.PI * 0.95, -Math.PI * 0.05], life: [0.15, 0.4], size: [2, 4.2], colors: [color, '#ffffff'], type: 'spark', drag: 2 });
    this.scene.particles.add({ type: 'ring', x, y, size: 8, sizeEnd: perfect ? 70 : 46, life: 0.3, color, width: 4 });
  }

  // Racha de aciertos: ECO dispara su rayo al jefe
  streakBeam() {
    const world = this.scene.world;
    const length = Math.max(200, this.boss.x - this.player.x - 70);
    world.beam({ facing: 1, owner: this.player, dx: 46, dy: -94, length, duration: 0.4, power: 2, thickness: 0.9 });
    world.audio.play('duelStreak'); // el sonido de la racha de 10 aciertos
    world.shake(7, 0.25);
    this.boss.squash = 0.22;
    if (this.boss.react) this.boss.react('streak', world);
    this.scene.particles.burst({ x: this.boss.x - 30, y: this.boss.y - 130, count: 18, speed: [160, 520], life: [0.2, 0.5], size: [2.4, 5], colors: ['#ffffff', '#00f5ff', '#a066ff'], type: 'spark', drag: 2 });
    this.addPop(`¡RACHA ${this.combo}!`, '#00f5ff', 1.5);
  }

  lose() {
    this.music.stop();
    this.setState('lost');
    if (this.song === TrackMusic) this.game.audio.pauseBoss(true);
    this.game.audio.play('duelFail');
    setTimeout(() => this.game.audio.setSfxLevel(1), 2500);
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
    setTimeout(() => this.game.audio.setSfxLevel(1), 2500); // los efectos recuperan su nivel pasado el golpe final
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

  // Perspectiva lineal: la posición en pantalla depende del tiempo en línea recta, así que las notas cruzan la pista
  // siempre a la misma velocidad (depth: 0 = arriba, 1 = línea de aciertos)
  lanePoint(lane, depth) {
    const { TOP, HIT, CX } = RhythmDuel;
    const y = TOP + (HIT - TOP) * depth;
    const width = 50 + 50 * depth;
    return { x: CX + (lane - 1.5) * width, y, scale: width / 100, width };
  }

  // Pulso del compás: 1 justo en cada tiempo y cae rápido
  get beatPulse() {
    if (this.state !== 'play') return 0;
    const phase = (((this.songTime - this.song.BEAT_OFFSET) / this.song.BEAT) % 1 + 1) % 1;
    return phase < 0 ? 0 : Math.pow(1 - phase, 3);
  }

  render(ctx) {
    const open = this.state === 'intro' ? Math.min(1, this.stateTime / 0.8) : 1;
    const pulse = this.beatPulse;
    ctx.save();
    // La escena se oscurece para destacar la pista y late con la música
    ctx.fillStyle = `rgba(3, 3, 12, ${(0.2 + 0.04 * pulse) * open})`;
    ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
    if (this.failFlash > 0) {
      ctx.fillStyle = `rgba(255, 30, 70, ${0.16 * this.failFlash})`;
      ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
    }
    ctx.globalAlpha = open;
    this.renderLights(ctx, pulse);
    this.renderHighway(ctx, pulse);
    this.renderLaneBeams(ctx);
    this.renderStreakFx(ctx, pulse);
    this.renderMeter(ctx, pulse);
    if (this.state === 'play' || this.state === 'won') this.renderNotes(ctx);
    this.renderPads(ctx, pulse);
    this.renderSideInfo(ctx);
    this.renderPops(ctx);
    this.renderCountIn(ctx);
    if (this.state === 'won' && this.stateTime > 1.0) this.renderResults(ctx);
    ctx.restore();
  }

  // Focos de escenario a los lados: conos de luz que se balancean y laten con el tiempo
  renderLights(ctx, pulse) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const side of [-1, 1]) {
      const sway = Math.sin(this.age * 0.8 + side * 1.3) * 70;
      const x0 = side < 0 ? 70 : CONFIG.WIDTH - 70;
      const x1 = x0 + sway + side * -60;
      const cone = ctx.createLinearGradient(x0, 56, x1, 470);
      const color = side < 0 ? '0, 200, 255' : '255, 40, 110';
      cone.addColorStop(0, `rgba(${color}, ${0.2 + 0.18 * pulse})`);
      cone.addColorStop(1, `rgba(${color}, 0)`);
      ctx.fillStyle = cone;
      ctx.beginPath();
      ctx.moveTo(x0 - 12, 56);
      ctx.lineTo(x0 + 12, 56);
      ctx.lineTo(x1 + 110, 470);
      ctx.lineTo(x1 - 110, 470);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  renderHighway(ctx, pulse) {
    const { TOP, HIT } = RhythmDuel;
    const bottomDepth = (HIT + 36 - TOP) / (HIT - TOP);
    const topL = this.lanePoint(-0.5, 0);
    const topR = this.lanePoint(3.5, 0);
    const botL = this.lanePoint(-0.5, bottomDepth);
    const botR = this.lanePoint(3.5, bottomDepth);

    // Cristal oscuro y, en cada carril, un tinte de su color que se intensifica hacia la línea de aciertos
    ctx.beginPath();
    ctx.moveTo(topL.x, TOP);
    ctx.lineTo(topR.x, TOP);
    ctx.lineTo(botR.x, HIT + 36);
    ctx.lineTo(botL.x, HIT + 36);
    ctx.closePath();
    const glass = ctx.createLinearGradient(0, TOP, 0, HIT + 36);
    glass.addColorStop(0, 'rgba(8, 6, 30, 0.35)');
    glass.addColorStop(1, 'rgba(8, 6, 30, 0.88)');
    ctx.fillStyle = glass;
    ctx.fill();
    for (let lane = 0; lane < 4; lane++) {
      const a0 = this.lanePoint(lane - 0.5, 0);
      const a1 = this.lanePoint(lane + 0.5, 0);
      const b0 = this.lanePoint(lane - 0.5, bottomDepth);
      const b1 = this.lanePoint(lane + 0.5, bottomDepth);
      const tint = ctx.createLinearGradient(0, TOP, 0, HIT + 36);
      tint.addColorStop(0, 'rgba(255, 255, 255, 0)');
      tint.addColorStop(1, RhythmDuel.hexAlpha(RhythmDuel.LANE_COLORS[lane], 0.16 + 0.08 * pulse));
      ctx.fillStyle = tint;
      ctx.beginPath();
      ctx.moveTo(a0.x, TOP);
      ctx.lineTo(a1.x, TOP);
      ctx.lineTo(b1.x, HIT + 36);
      ctx.lineTo(b0.x, HIT + 36);
      ctx.closePath();
      ctx.fill();
    }

    // Líneas de tiempo que corren a velocidad constante, con los compases más marcados
    const time = this.state === 'play' || this.state === 'won' ? this.songTime : 0;
    const beat = this.song.BEAT;
    const first = Math.floor((time - this.song.BEAT_OFFSET) / beat) - 1;
    for (let k = first; k < first + Math.ceil(this.travel / beat) + 3; k++) {
      const depth = 1 - (k * beat + this.song.BEAT_OFFSET - time) / this.travel;
      if (depth < 0 || depth > bottomDepth) continue;
      const a = this.lanePoint(-0.5, depth);
      const b = this.lanePoint(3.5, depth);
      const bar = k % 4 === 0;
      ctx.strokeStyle = bar ? 'rgba(255, 255, 255, 0.5)' : 'rgba(170, 200, 255, 0.16)';
      ctx.lineWidth = bar ? 3 : 1.2;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      if (!bar) continue;
      // Flechas del color de cada carril al inicio de cada compás
      for (let lane = 0; lane < 4; lane++) {
        const p = this.lanePoint(lane, depth);
        ctx.fillStyle = RhythmDuel.hexAlpha(RhythmDuel.LANE_COLORS[lane], 0.4);
        const w = 16 * p.scale;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - 7 * p.scale);
        ctx.lineTo(p.x + w, p.y + 5 * p.scale);
        ctx.lineTo(p.x, p.y + 1 * p.scale);
        ctx.lineTo(p.x - w, p.y + 5 * p.scale);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Separadores de carril y bordes brillantes (laten con el compás)
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(160, 200, 255, 0.3)';
    for (let i = 1; i < 4; i++) {
      const a = this.lanePoint(i - 0.5, 0);
      const b = this.lanePoint(i - 0.5, bottomDepth);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    const railStyle = RhythmDuel.TIER[this.tier] || RhythmDuel.TIER[1];
    ctx.shadowColor = railStyle.glow;
    ctx.shadowBlur = 10 + 12 * pulse + 8 * (this.tier - 1);
    ctx.lineWidth = 4 + (this.tier - 1) * 0.6;
    ctx.strokeStyle = `rgba(${railStyle.rail}, ${0.75 + 0.25 * pulse})`;
    for (const [p, q] of [[topL, botL], [topR, botR]]) {
      ctx.beginPath();
      ctx.moveTo(p.x, TOP);
      ctx.lineTo(q.x, HIT + 36);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;

    // Línea de aciertos: barra de luz que destella en cada tiempo
    const left = this.lanePoint(-0.5, 1);
    const right = this.lanePoint(3.5, 1);
    const bar = ctx.createLinearGradient(left.x, 0, right.x, 0);
    bar.addColorStop(0, 'rgba(0, 245, 255, 0)');
    bar.addColorStop(0.5, `rgba(255, 255, 255, ${0.55 + 0.4 * pulse})`);
    bar.addColorStop(1, 'rgba(255, 0, 90, 0)');
    ctx.fillStyle = bar;
    ctx.fillRect(left.x, HIT - 2 - 2 * pulse, right.x - left.x, 4 + 4 * pulse);
  }

  // "#rrggbb" + opacidad → color rgba
  static hexAlpha(hex, alpha) {
    const value = parseInt(hex.slice(1), 16);
    return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
  }

  // Haz de luz que sube por el carril mientras se mantiene la tecla (o por el acierto reciente)
  renderLaneBeams(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let lane = 0; lane < 4; lane++) {
      const strength = Math.max(this.held[lane] ? 0.55 : 0, this.padFlash[lane] * 0.9);
      if (strength < 0.02) continue;
      const bottom = this.lanePoint(lane, 1);
      const top = this.lanePoint(lane, 0.15);
      const beam = ctx.createLinearGradient(0, bottom.y, 0, top.y);
      beam.addColorStop(0, RhythmDuel.hexAlpha(RhythmDuel.LANE_COLORS[lane], 0.55 * strength));
      beam.addColorStop(1, RhythmDuel.hexAlpha(RhythmDuel.LANE_COLORS[lane], 0));
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(bottom.x - bottom.width * 0.46, bottom.y);
      ctx.lineTo(bottom.x + bottom.width * 0.46, bottom.y);
      ctx.lineTo(top.x + top.width * 0.4, top.y);
      ctx.lineTo(top.x - top.width * 0.4, top.y);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // Medidor de fuerza: la onda de ECO (cian) contra el silencio (rojo), con un destello en el punto de choque
  renderMeter(ctx, pulse) {
    const x = 250;
    const y = 20;
    const width = 460;
    const height = 20;
    ctx.fillStyle = '#1a0610';
    ctx.fillRect(x, y, width, height);
    const split = width * this.shownMeter;
    const eco = ctx.createLinearGradient(0, y, 0, y + height);
    eco.addColorStop(0, '#7dfbff');
    eco.addColorStop(0.5, '#00c8dc');
    eco.addColorStop(1, '#00798a');
    ctx.fillStyle = eco;
    ctx.fillRect(x, y, split, height);
    const silence = ctx.createLinearGradient(0, y, 0, y + height);
    silence.addColorStop(0, '#ff6a8a');
    silence.addColorStop(0.5, '#e0002f');
    silence.addColorStop(1, '#7a0018');
    ctx.fillStyle = silence;
    ctx.fillRect(x + split, y, width - split, height);
    // Muescas
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    for (let i = 1; i < 20; i++) ctx.fillRect(x + (width / 20) * i - 1, y, 2, height);
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#000';
    ctx.strokeRect(x, y, width, height);
    // Choque de las dos ondas
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const size = 70 + 30 * pulse;
    ctx.drawImage(Atmosphere.glowSprite('#ffffff'), x + split - size / 2, y + height / 2 - size / 2, size, size);
    ctx.restore();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + split - 2, y - 4, 4, height + 8);
    Draw.rock(ctx, 'ECO', x - 12, y + 18, { size: 22, align: 'right', colors: ['#ffffff', '#00f5ff', '#005e8a'], glow: '#00f5ff', glowBlur: 10, outlineWidth: 4 });
    Draw.rock(ctx, this.boss.name || 'VÓIDHAR', x + width + 12, y + 18, { size: 22, align: 'left', colors: ['#ffffff', '#ff5a8a', '#6a0030'], glow: '#ff2a55', glowBlur: 10, outlineWidth: 4 });
    // Avance de la canción
    const progress = this.state === 'play' ? Math.max(0, Math.min(1, this.songTime / this.song.endTime)) : (this.state === 'won' ? 1 : 0);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.fillRect(x, y + height + 7, width, 3);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y + height + 7, width * progress, 3);
  }

  renderNotes(ctx) {
    const time = this.songTime;
    const visible = [];
    for (const note of this.notes) {
      if (note.hit) continue;
      const ahead = note.t - time;
      if (ahead > this.travel + 0.05 || ahead < -0.35) continue;
      visible.push(note);
    }
    visible.sort((a, b) => b.t - a.t); // las más lejanas primero

    // Barra que une las notas dobles (varias a la vez)
    const byTime = new Map();
    for (const note of visible) {
      const key = note.t.toFixed(3);
      if (!byTime.has(key)) byTime.set(key, []);
      byTime.get(key).push(note);
    }
    ctx.save();
    ctx.lineCap = 'round';
    for (const group of byTime.values()) {
      if (group.length < 2) continue;
      const depth = 1 - (group[0].t - time) / this.travel;
      const lanes = group.map((note) => note.lane);
      const a = this.lanePoint(Math.min(...lanes), depth);
      const b = this.lanePoint(Math.max(...lanes), depth);
      ctx.globalAlpha = group[0].missed ? 0.2 : Math.min(0.9, depth * 3);
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 12 * a.scale;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 5 * a.scale;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    ctx.restore();

    for (const note of visible) {
      const depth = 1 - (note.t - time) / this.travel;
      const point = this.lanePoint(note.lane, depth);
      const color = RhythmDuel.LANE_COLORS[note.lane];
      const rx = 32 * point.scale;
      const ry = rx * 0.62;
      ctx.save();
      ctx.globalAlpha *= note.missed ? 0.3 : Math.min(1, depth * 4);

      // Estela detrás de la nota (hacia arriba), para que se note el movimiento
      const trail = ctx.createLinearGradient(0, point.y - 70 * point.scale, 0, point.y);
      trail.addColorStop(0, RhythmDuel.hexAlpha(color, 0));
      trail.addColorStop(1, RhythmDuel.hexAlpha(color, 0.45));
      ctx.fillStyle = trail;
      ctx.fillRect(point.x - rx * 0.55, point.y - 70 * point.scale, rx * 1.1, 70 * point.scale);

      // Halo
      ctx.globalCompositeOperation = 'lighter';
      const halo = rx * 2.6;
      ctx.globalAlpha *= 0.5;
      ctx.drawImage(Atmosphere.glowSprite(color), point.x - halo / 2, point.y - halo * 0.36, halo, halo * 0.72);
      ctx.globalAlpha /= 0.5;
      ctx.globalCompositeOperation = 'source-over';

      // Gema: borde negro, cuerpo con degradado y brillo
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(point.x, point.y + 2 * point.scale, rx + 4 * point.scale, ry + 4 * point.scale, 0, 0, Math.PI * 2);
      ctx.fill();
      const body = ctx.createRadialGradient(point.x - rx * 0.25, point.y - ry * 0.35, 1, point.x, point.y, rx);
      body.addColorStop(0, '#ffffff');
      body.addColorStop(0.35, color);
      body.addColorStop(1, RhythmDuel.hexAlpha(color, 0.55));
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.ellipse(point.x, point.y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = Math.max(1.5, 2.5 * point.scale);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.beginPath();
      ctx.ellipse(point.x, point.y, rx * 0.62, ry * 0.62, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.beginPath();
      ctx.ellipse(point.x - rx * 0.2, point.y - ry * 0.3, rx * 0.28, ry * 0.2, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // Los cuatro pads de la línea de aciertos, con la tecla de cada uno; con racha alta echan llamas
  renderPads(ctx, pulse) {
    for (let lane = 0; lane < 4; lane++) {
      const point = this.lanePoint(lane, 1);
      const color = RhythmDuel.LANE_COLORS[lane];
      const pressed = this.held[lane] || this.padFlash[lane] > 0.4;
      const rx = 36;
      const ry = rx * 0.62;
      ctx.save();

      // Llamas con racha de x3 o más
      if (this.multiplier >= 3 && this.state === 'play') {
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 3; i++) {
          const flick = 0.5 + 0.5 * Math.sin(this.age * (14 + i * 5) + lane * 2.1 + i);
          const h = (34 + 26 * flick + (this.multiplier - 3) * 10) * (1 + 0.2 * pulse);
          const size = 44 + 16 * flick;
          ctx.globalAlpha = 0.5 + 0.25 * flick;
          ctx.drawImage(Atmosphere.glowSprite(i === 0 ? '#ff7a00' : color), point.x - size / 2 + (i - 1) * 12, point.y - h - size * 0.3, size, size);
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }

      // Base del pad
      ctx.shadowColor = color;
      ctx.shadowBlur = pressed ? 28 : 10;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(point.x, point.y + 3, rx + 5, ry + 5, 0, 0, Math.PI * 2);
      ctx.fill();
      const face = ctx.createRadialGradient(point.x - rx * 0.2, point.y - ry * 0.4, 2, point.x, point.y, rx);
      face.addColorStop(0, pressed ? '#ffffff' : RhythmDuel.hexAlpha(color, 0.5));
      face.addColorStop(1, pressed ? color : 'rgba(6, 6, 20, 0.9)');
      ctx.fillStyle = face;
      ctx.beginPath();
      ctx.ellipse(point.x, point.y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.lineWidth = 4;
      ctx.strokeStyle = color;
      ctx.stroke();
      // Onda al tocar
      if (this.padFlash[lane] > 0) {
        const wave = 1 - this.padFlash[lane];
        ctx.globalAlpha = this.padFlash[lane] * 0.8;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(point.x, point.y, rx + wave * 38, ry + wave * 24, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      Draw.text(ctx, RhythmDuel.LANE_KEYS[lane], point.x, point.y + 8, { size: 22, align: 'center', color: pressed ? '#000' : '#ffffff', strokeWidth: pressed ? 0 : 4 });
      ctx.restore();
    }
  }

  renderSideInfo(ctx) {
    // Racha, a la izquierda
    Draw.rock(ctx, 'RACHA', 34, 118, { size: 20, colors: ['#ffffff', '#ffe600', '#c46a00'], outlineWidth: 4, tracking: 2 });
    const style = RhythmDuel.TIER[this.tier] || RhythmDuel.TIER[1];
    ctx.save();
    if (this.tier >= 2) {
      // El número de la racha arde: halo del color del nivel y un temblor leve con el pulso
      ctx.shadowColor = style.glow;
      ctx.shadowBlur = 14 + 8 * this.tier;
    }
    const wobble = this.tier >= 3 ? Math.sin(this.age * 40) * 1.2 : 0;
    Draw.text(ctx, String(this.combo), 34 + wobble, 188, { size: 70 + (this.tier - 1) * 4, color: this.tier > 1 ? style.text : '#ffffff', strokeWidth: 8 });
    ctx.restore();
    Draw.text(ctx, `x${this.multiplier}`, 34, 226, { size: 34, color: this.multiplier > 1 ? style.text : '#8fa0b8', strokeWidth: 6 });
    if (this.tier >= 2) Draw.text(ctx, RhythmDuel.TIER_NAMES[this.tier], 34, 252, { size: 18, color: style.text, strokeWidth: 4 });
    // Puntos y precisión, a la derecha
    Draw.rock(ctx, 'PUNTOS', CONFIG.WIDTH - 34, 118, { size: 20, align: 'right', colors: ['#ffffff', '#ffe600', '#c46a00'], outlineWidth: 4, tracking: 2 });
    Draw.text(ctx, String(this.score).padStart(6, '0'), CONFIG.WIDTH - 34, 168, { size: 40, align: 'right', color: '#ffe600', strokeWidth: 7 });
    if (this.counts.perfect + this.counts.good + this.counts.miss > 0) {
      Draw.text(ctx, `Precisión ${Math.round(this.accuracy * 100)}%`, CONFIG.WIDTH - 34, 204, { size: 20, align: 'right', color: '#cfe', strokeWidth: 4 });
    }
  }

  // Chispas de las rachas: suben desde los bordes de la pista (más cantidad con cada nivel) y desde los pads
  updateSparks(dt) {
    for (const spark of this.sparks) {
      spark.age += dt;
      spark.x += spark.vx * dt;
      spark.y += spark.vy * dt;
      spark.vy += 160 * dt;
      spark.vx *= Math.max(0, 1 - dt * 1.5);
    }
    this.sparks = this.sparks.filter((spark) => spark.age < spark.life);
    if (this.state !== 'play' || this.tier < 2 || this.sparks.length > (FX.low ? 60 : 160)) return;
    this.sparkTimer -= dt;
    if (this.sparkTimer > 0) return;
    this.sparkTimer = [0, 0, 0.07, 0.04, 0.025][this.tier];
    for (const side of [-0.5, 3.5]) {
      const depth = 0.55 + Math.random() * 0.45;
      const point = this.lanePoint(side, depth);
      this.sparks.push({
        x: point.x, y: point.y, vx: (Math.random() - 0.5) * 60 + (side < 0 ? -20 : 20), vy: -(100 + Math.random() * 240),
        age: 0, life: 0.5 + Math.random() * 0.6, size: 1.6 + Math.random() * 2.2, hot: this.tier >= 3 && Math.random() < 0.5,
      });
    }
  }

  // Efectos de racha: resplandor del borde de la pantalla, rayos entre los carriles y chispas
  renderStreakFx(ctx, pulse) {
    const style = RhythmDuel.TIER[this.tier] || RhythmDuel.TIER[1];
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // Destello al subir de nivel
    if (this.tierFlash > 0.02) {
      ctx.fillStyle = `rgba(${style.rail}, ${0.22 * this.tierFlash})`;
      ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
    }

    if (this.tier >= 2) {
      // Resplandor a los lados de la pantalla: sube con el nivel (de un halo suave a llamas de leyenda)
      const strength = [0, 0, 0.12, 0.22, 0.32][this.tier] + 0.1 * pulse;
      for (const side of [-1, 1]) {
        const x0 = side < 0 ? 0 : CONFIG.WIDTH;
        const edge = ctx.createLinearGradient(x0, 0, x0 - side * 230, 0);
        edge.addColorStop(0, `rgba(${style.rail}, ${strength})`);
        edge.addColorStop(1, `rgba(${style.rail}, 0)`);
        ctx.fillStyle = edge;
        ctx.fillRect(side < 0 ? 0 : CONFIG.WIDTH - 230, 0, 230, CONFIG.HEIGHT);
      }
      // Luz bajo la pista
      const floor = ctx.createRadialGradient(CONFIG.WIDTH / 2, RhythmDuel.HIT + 30, 20, CONFIG.WIDTH / 2, RhythmDuel.HIT + 30, 330);
      floor.addColorStop(0, `rgba(${style.rail}, ${0.2 + 0.1 * this.tier + 0.15 * pulse})`);
      floor.addColorStop(1, `rgba(${style.rail}, 0)`);
      ctx.fillStyle = floor;
      ctx.fillRect(0, RhythmDuel.HIT - 300, CONFIG.WIDTH, 420);
    }

    // Rayos que recorren los bordes de la pista (a partir de ×3), más frecuentes en leyenda
    if (this.tier >= 3 && !FX.low) {
      const seed = Math.floor(this.age * (this.tier >= 4 ? 18 : 11));
      const random = Draw.seededRandom(seed * 7919 + 13);
      const bolts = this.tier >= 4 ? 3 : 1;
      for (let b = 0; b < bolts; b++) {
        const side = random() < 0.5 ? -0.5 : 3.5;
        const top = this.lanePoint(side, 0.05 + random() * 0.2);
        const bottom = this.lanePoint(side, 0.8 + random() * 0.2);
        const points = [{ x: top.x, y: top.y }];
        const steps = 7;
        for (let i = 1; i <= steps; i++) {
          const t = i / steps;
          points.push({ x: top.x + (bottom.x - top.x) * t + (i === steps ? 0 : (random() - 0.5) * 46), y: top.y + (bottom.y - top.y) * t });
        }
        ctx.lineJoin = 'round';
        for (const [width, color, alpha] of [[9, style.glow, 0.28], [3, '#ffffff', 0.9]]) {
          ctx.globalAlpha = alpha * (0.5 + 0.5 * pulse);
          ctx.strokeStyle = color;
          ctx.lineWidth = width;
          ctx.beginPath();
          points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
    }

    // Chispas
    for (const spark of this.sparks) {
      const t = spark.age / spark.life;
      ctx.globalAlpha = Math.max(0, 1 - t);
      ctx.fillStyle = spark.hot ? '#ffffff' : `rgb(${style.rail})`;
      ctx.beginPath();
      ctx.arc(spark.x, spark.y, spark.size * (1 - 0.5 * t), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  renderPops(ctx) {
    for (const pop of this.pops) {
      const t = pop.age / 0.7;
      const point = this.lanePoint(Math.min(3, Math.max(0, pop.lane)), 1);
      ctx.save();
      ctx.globalAlpha *= 1 - t * t;
      Draw.text(ctx, pop.text, pop.lane === 1.5 ? RhythmDuel.CX : point.x, (pop.lane === 1.5 ? RhythmDuel.HIT - 170 : RhythmDuel.HIT - 52) - t * 36, {
        size: (pop.size || 24) + (1 - t) * 8, align: 'center', color: pop.color, strokeWidth: 5,
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
    const countIn = this.song.countInTime;
    if (time < countIn - (this.song === DuelMusic ? 0.2 : 0)) {
      Draw.rock(ctx, 'TOCA AL RITMO', CONFIG.WIDTH / 2, 232, { size: 34, align: 'center', colors: ['#ffffff', '#ffe600', '#c46a00'], outlineWidth: 7, tracking: 3 });
      Draw.text(ctx, 'Z  X  C  V   o   ←  ↓  ↑  →', CONFIG.WIDTH / 2, 270, { size: 20, align: 'center', color: '#cfe', strokeWidth: 4 });
      if (time >= 0) {
        if (this.song === DuelMusic) {
          const beat = Math.floor(time / DuelMusic.BEAT) % 4;
          Draw.text(ctx, String(4 - beat), CONFIG.WIDTH / 2, 340, { size: 60, align: 'center', color: '#ffffff', strokeWidth: 8 });
        }
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
