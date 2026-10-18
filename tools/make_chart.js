// Genera la partitura del duelo a partir del análisis de la música (onsets por bandas, tempo, fase y altura de la guitarra).
// Uso: node tools/make_chart.js analisis.json src/levels/BatukChart.js [inicio=43] [fin=150]
// Las notas se pegan a la rejilla de semicorcheas. Siguen la guitarra: una nota por cada ataque de guitarra (bandas medias) y el
// carril sale de su altura (grave → izquierda, agudo → derecha), medida respecto al registro de los segundos cercanos, así el
// dibujo de la pista sube y baja con la melodía. Los golpes de bombo rellenan los huecos donde la guitarra calla.
const fs = require('fs');

const [, , inputPath, outputPath, startArg = '43', endArg = '150'] = process.argv;
const analysis = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const start = Number(startArg);
const end = Number(endArg);
const grid = analysis.period / 4; // una semicorchea
const phase = analysis.phase;

// Ajustes de densidad
const GUITAR_THRESHOLD = Number(process.env.GT || 0.5); // fuerza mínima (relativa) de un ataque de guitarra para ser nota
const KICK_THRESHOLD = Number(process.env.KT || 1.1);
const MAX_RUN = 5; // semicorcheas seguidas como máximo
const DOUBLE_SCORE = 2.6;

// Normaliza cada banda por su percentil 90
const bandScale = [0, 1, 2, 3].map((band) => {
  const values = analysis.onsets.filter((o) => o.band === band && o.t >= start && o.t <= end).map((o) => o.s).sort((a, b) => a - b);
  return values[Math.floor(values.length * 0.9)] || 1;
});

// Altura (Hz) de la guitarra en torno a un instante: mediana ponderada de los cuadros justo después del ataque
const pitchAt = (t) => {
  const from = Math.round((t + 0.02) * analysis.fps) - analysis.pitchFrom;
  const values = [];
  for (let i = from; i < from + 6; i++) if (i >= 0 && i < analysis.pitch.length && analysis.pitchPower[i] > 2) values.push(analysis.pitch[i]);
  if (!values.length) return 0;
  values.sort((a, b) => a - b);
  return values[Math.floor(values.length / 2)];
};

const PITCH_EVENT = Number(process.env.PE || 0.9); // fuerza que se da a un cambio de altura
const pitchAtRaw = (t) => {
  const i = Math.round(t * analysis.fps) - analysis.pitchFrom;
  return i >= 0 && i < analysis.pitch.length && analysis.pitchPower[i] > 3 ? analysis.pitch[i] : 0;
};

// Posiciones de la rejilla con la fuerza de la guitarra (bandas 1 y 2) y del bombo (banda 0)
const slots = [];
for (let t = phase + Math.ceil((start + 1.1 - phase) / grid) * grid; t < end - 0.3; t += grid) {
  const near = analysis.onsets.filter((o) => Math.abs(o.t - t) <= 0.07);
  const strength = (bands) => near.filter((o) => bands.includes(o.band)).reduce((m, o) => Math.max(m, o.s / bandScale[o.band]), 0);
  let guitar = strength([1, 2]);
  // La guitarra también marca notas ligadas: un cambio de altura (≥ 1 semitono) en un tramo tonal cuenta como ataque
  const before = pitchAtRaw(t - 0.1);
  const now = pitchAtRaw(t + 0.03);
  if (before > 0 && now > 0 && Math.abs(Math.log2(now / before)) >= 1 / 12 && Math.abs(Math.log2(now / before)) < 1) guitar = Math.max(guitar, PITCH_EVENT);
  const kick = strength([0]);
  const high = strength([3]);
  slots.push({ t, index: slots.length, guitar, kick, high, score: guitar + kick * 0.6 + high * 0.3 });
}

// Selección: guitarra primero (admite semicorcheas seguidas, con tope), después bombo en los huecos
const chosen = new Map(); // índice → 'guitar' | 'kick'
const runLength = (i) => { let n = 0; while (chosen.has(i - 1 - n)) n++; let m = 0; while (chosen.has(i + 1 + m)) m++; return n + m + 1; };
for (const slot of [...slots].sort((a, b) => b.guitar - a.guitar)) {
  if (slot.guitar < GUITAR_THRESHOLD) break;
  if (runLength(slot.index) <= MAX_RUN) chosen.set(slot.index, 'guitar');
}
for (const slot of [...slots].sort((a, b) => b.kick - a.kick)) {
  if (slot.kick < KICK_THRESHOLD) break;
  let free = true;
  for (let d = -1; d <= 1; d++) if (chosen.has(slot.index + d)) free = false;
  if (free) chosen.set(slot.index, 'kick');
}

// Carriles: la altura de cada nota de guitarra se compara con las notas de ±6 s (cuartiles locales)
const guitarNotes = slots.filter((s) => chosen.get(s.index) === 'guitar').map((s) => ({ ...s, pitch: pitchAt(s.t) })).filter((s) => s.pitch > 0);
const laneOf = (note) => {
  const neighbours = guitarNotes.filter((g) => Math.abs(g.t - note.t) <= 6).map((g) => Math.log2(g.pitch)).sort((a, b) => a - b);
  if (neighbours.length < 4) return 1;
  const v = Math.log2(note.pitch);
  const rank = neighbours.filter((x) => x < v).length / neighbours.length;
  return Math.min(3, Math.floor(rank * 4));
};
const notes = [];
let kickToggle = 0;
for (const slot of slots) {
  const kind = chosen.get(slot.index);
  if (!kind) continue;
  if (kind === 'kick') {
    notes.push([+(slot.t - start).toFixed(3), kickToggle++ % 2]);
    continue;
  }
  const pitch = pitchAt(slot.t);
  const lane = pitch > 0 ? laneOf({ t: slot.t, pitch }) : (slot.index % 3);
  notes.push([+(slot.t - start).toFixed(3), lane]);
  // Golpe muy fuerte (guitarra y bombo a la vez): segunda nota en un carril contiguo
  if (slot.score >= DOUBLE_SCORE && slot.kick > 0.8) notes.push([+(slot.t - start).toFixed(3), lane >= 2 ? lane - 2 : lane + 2]);
}
notes.sort((a, b) => a[0] - b[0] || a[1] - b[1]);

// Comprobaciones
const hits = notes.filter(([t]) => analysis.onsets.some((o) => Math.abs(o.t - (t + start)) <= 0.05)).length;
const density = [];
for (let s = 0; s < end - start; s += 10) density.push(notes.filter((n) => n[0] >= s && n[0] < s + 10).length);
console.log(`notas: ${notes.length} (${(notes.length / (end - start)).toFixed(2)}/s) | dobles: ${notes.length - new Set(notes.map((n) => n[0])).size} | sobre un onset real: ${Math.round((100 * hits) / notes.length)}%`);
console.log(`guitarra: ${[...chosen.values()].filter((k) => k === 'guitar').length} | bombo: ${[...chosen.values()].filter((k) => k === 'kick').length} | por carril: ${[0, 1, 2, 3].map((l) => notes.filter((n) => n[1] === l).length).join(' / ')}`);
console.log(`notas por tramo de 10 s: ${density.join(' ')}`);

const body = `// Partitura del duelo con Batuk, generada con tools/make_chart.js a partir de assets/audio/batuk-battle.mp3.
// start/end: tramo de la canción que se juega (segundos). Cada nota: [segundos desde start, carril 0-3].
// Los carriles siguen la altura de la guitarra solista. Para ajustar el sincronismo, cambia LATENCY (segundos; positivo = las notas llegan más tarde).
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
