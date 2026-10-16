// Mejores marcas del jugador, guardadas en el navegador (localStorage). Si el almacenamiento no está disponible
// (ventana privada, datos bloqueados) el juego funciona igual, solo que sin récord guardado.
const Records = {
  KEY: 'xilence-cross-records',

  load() {
    try {
      const raw = window.localStorage.getItem(Records.KEY);
      const data = raw ? JSON.parse(raw) : null;
      if (data && typeof data.score === 'number') return data;
    } catch (error) {
      // sin almacenamiento: se ignora
    }
    return { score: 0, combo: 0, seconds: 0 };
  },

  // Compara la partida con las mejores marcas y guarda las que se superan.
  // Devuelve { best, newScore, newCombo } para poder anunciarlo en pantalla.
  submit({ score, combo, seconds, victory }) {
    const best = Records.load();
    const newScore = score > best.score;
    const newCombo = combo > best.combo;
    const updated = {
      score: Math.max(best.score, score),
      combo: Math.max(best.combo, combo),
      seconds: victory && (!best.seconds || seconds < best.seconds) ? Math.round(seconds) : best.seconds,
    };
    try {
      window.localStorage.setItem(Records.KEY, JSON.stringify(updated));
    } catch (error) {
      // sin almacenamiento: se ignora
    }
    return { best: updated, newScore, newCombo };
  },

  // 3725 → "1:02:05" o "2:05"
  formatTime(seconds) {
    if (!seconds) return '--';
    const minutes = Math.floor(seconds / 60);
    const rest = String(seconds % 60).padStart(2, '0');
    return `${minutes}:${rest}`;
  },
};
