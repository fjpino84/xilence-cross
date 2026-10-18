// Genera la partitura del duelo a partir del análisis de la música (onsets por bandas, tempo y fase de la rejilla).
// Uso: node tools/make_chart.js analisis.json src/levels/BatukChart.js [inicio=43] [fin=150]
// Las notas se pegan a la rejilla de semicorcheas de la canción y se eligen por la fuerza de lo que suena en ese instante;
// el carril depende de la banda dominante (bombo/graves → carriles izquierdos, agudos → derecho).
const fs = require('fs');

const [, , inputPath, outputPath, startArg = '43', endArg = '150'] = process.argv;
const analysis = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const start = Number(startArg);
const end = Number(endArg);
const grid = analysis.period / 4; // una semicorchea
const phase = analysis.phase;

// Normaliza cada banda por su percentil 90 para que ninguna domine
const bandScale = [0, 1, 2, 3].map((band) => {
  const values = analysis.onsets.filter((o) => o.band === band && o.t >= start && o.t <= end).map((o) => o.s).sort((a, b) => a - b);
  return values[Math.floor(values.length * 0.9)] || 1;
});

// Puntuación de cada posición de la rejilla
const slots = [];
for (let t = phase + Math.ceil((start + 1.1 - phase) / grid) * grid; t < end - 0.3; t += grid) {
  const near = analysis.onsets.filter((o) => Math.abs(o.t - t) <= 0.065);
  const perBand = [0, 0, 0, 0];
  for (const o of near) perBand[o.band] = Math.max(perBand[o.band], o.s / bandScale[o.band]);
  const score = perBand.reduce((a, b) => a + b, 0);
  slots.push({ t, perBand, score, index: slots.length, on: near.length > 0 });
}

// Selección: primero las mejores con separación mínima de dos posiciones (≈ 0,41 s); luego se añaden semicorcheas fuertes
const chosen = new Set();
const free = (i, gap) => { for (let d = -gap; d <= gap; d++) if (chosen.has(i + d)) return false; return true; };
const threshold = 0.9;
for (const slot of [...slots].sort((a, b) => b.score - a.score)) {
  if (slot.score < threshold) break;
  if (free(slot.index, 1)) chosen.add(slot.index);
}
const high = 2.3;
for (const slot of slots) {
  if (slot.score >= high && !chosen.has(slot.index) && free(slot.index, 0)) {
    // permite una semicorchea pegada a otra solo si no forma una racha de tres seguidas
    if (!(chosen.has(slot.index - 1) && chosen.has(slot.index - 2)) && !(chosen.has(slot.index + 1) && chosen.has(slot.index + 2))) chosen.add(slot.index);
  }
}

// Carriles
const notes = [];
let last = [-1, -1];
const lanesByBand = [[0, 1], [1, 0], [2, 1], [3, 2]];
for (const slot of slots.filter((s) => chosen.has(s.index))) {
  const ranked = slot.perBand.map((v, band) => ({ v, band })).sort((a, b) => b.v - a.v);
  let lane = lanesByBand[ranked[0].band][slot.index % 2];
  if (lane === last[0] && lane === last[1]) lane = (lane + (slot.index % 2 ? 1 : 3)) % 4; // no más de dos seguidas en el mismo carril
  notes.push([+(slot.t - start).toFixed(3), lane]);
  // Nota doble en los golpes más fuertes cuando suenan dos bandas distintas a la vez
  if (slot.score >= 3.2 && ranked[1].v > 0.8) {
    const second = lanesByBand[ranked[1].band][0];
    if (second !== lane) notes.push([+(slot.t - start).toFixed(3), second]);
  }
  last = [last[1], lane];
}
notes.sort((a, b) => a[0] - b[0] || a[1] - b[1]);

// Comprobación: cuántas notas caen sobre un onset real
const hits = notes.filter(([t]) => analysis.onsets.some((o) => Math.abs(o.t - (t + start)) <= 0.05)).length;
console.log(`notas: ${notes.length} (${(notes.length / (end - start)).toFixed(2)}/s) | dobles: ${notes.length - new Set(notes.map((n) => n[0])).size} | sobre un onset real: ${Math.round((100 * hits) / notes.length)}%`);
console.log(`tempo: ${analysis.bpm} BPM (rejilla ${grid.toFixed(4)} s) | por carril: ${[0, 1, 2, 3].map((l) => notes.filter((n) => n[1] === l).length).join(' / ')}`);

const body = `// Partitura del duelo con Batuk, generada con tools/make_chart.js a partir de assets/audio/batuk-battle.mp3.
// start/end: tramo de la canción que se juega (segundos). Cada nota: [segundos desde start, carril 0-3].
// Para ajustar el sincronismo, cambia LATENCY (segundos; positivo = las notas llegan más tarde).
const BATUK_CHART = {
  start: ${start},
  end: ${end},
  bpm: ${analysis.bpm},
  phase: ${analysis.phase},
  latency: 0,
  notes: ${JSON.stringify(notes)},
};
`;
fs.writeFileSync(outputPath, body);
