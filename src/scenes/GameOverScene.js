// Fin de nivel: derrota (silencio) o victoria, con opción de continuar o reiniciar.
class GameOverScene {
  constructor(game) {
    this.game = game;
    this.time = 0;
    this.victory = false;
  }

  // data: { victory, score, startScore, levelIndex, hasNextLevel }
  enter({ victory = false, score = 0, startScore = 0, levelIndex = 0, hasNextLevel = false, record = null } = {}) {
    this.time = 0;
    this.victory = victory;

    const scenes = this.game.scenes;
    const buttons = [];
    let title;
    let message;

    if (!victory) {
      title = 'SILENCIO...';
      message = `La frecuencia se apagó. Puntuación: ${score}`;
      buttons.push({ label: 'Reintentar', onClick: () => scenes.change('game', { levelIndex, score: startScore }) });
    } else if (hasNextLevel) {
      title = '¡NIVEL COMPLETADO!';
      message = `Una melodía vuelve a sonar. Puntuación: ${score}`;
      buttons.push({ label: 'Siguiente nivel', onClick: () => scenes.change('game', { levelIndex: levelIndex + 1, score }) });
    } else {
      title = '¡LA FRECUENCIA VUELVE!';
      message = `Has completado todos los niveles disponibles. Puntuación final: ${score}`;
      buttons.push({ label: 'Jugar de nuevo', onClick: () => scenes.change('game') });
    }
    buttons.push({ label: 'Menú principal', onClick: () => scenes.change('title') });

    // Resumen de la partida y mejores marcas
    if (record) {
      const flags = [record.newScore ? 'PUNTUACIÓN' : '', record.newCombo ? 'COMBO' : ''].filter(Boolean);
      const lines = [message, `Combo máximo: ${record.maxCombo}  ·  Tiempo: ${Records.formatTime(record.seconds)}`];
      lines.push(flags.length ? `¡NUEVO RÉCORD DE ${flags.join(' Y ')}!` : `Mejor puntuación: ${record.best.score}  ·  Mejor combo: ${record.best.combo}`);
      message = lines.join('\n');
    }
    this.game.modal.show({ title, message, buttons });
  }

  exit() {
    this.game.modal.hide();
  }

  update(dt) {
    this.time += dt;
  }

  // Fondo: la onda vibra si ganaste; línea plana (frecuencia cero) si perdiste
  render(ctx) {
    const { WIDTH, HEIGHT, COLORS } = CONFIG;
    ctx.fillStyle = COLORS.NAVY;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    const color = this.victory ? COLORS.CYAN : COLORS.RED;
    const amplitude = this.victory ? 70 : 0;
    ctx.lineWidth = 4;
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    for (let x = 0; x <= WIDTH; x += 6) {
      const y = HEIGHT / 2 + Math.sin(x * 0.03 + this.time * 6) * amplitude;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
}
