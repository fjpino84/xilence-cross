// Recorta los sonidos grabados de src/levels/ECO en una sola hoja (assets/audio/sfx.wav, mono 32 kHz) y escribe la tabla de
// recortes en src/engine/SfxData.js. Usa Edge sin interfaz para decodificar los MP3 (no hace falta ffmpeg).
// Uso: node tools/make_sfx.js   (Edge debe estar en la ruta de siempre)
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn, execSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const SOURCE_DIR = 'src/levels/ECO/';
const PORT = 8781;

// nombre: [archivo, inicio (s), duración (s), fundido final (s)]. Los inicios salen de buscar los golpes de cada grabación.
const F = {
  paso: 'Eco Caminando.mp3',
  agua: 'Eco caminando en el agua.mp3',
  pegando: 'Eco Pegando.mp3',
  adv1: 'Adversario Caminando.mp3',
  adv2: 'Caminando adversario 2.mp3',
  golpeado: 'recibiendo golpes adversario.mp3',
  voces: 'Voces adversarios.mp3',
  carga: 'Carga rayo.mp3',
  disparo: 'disparo rayo.mp3',
  superIni: 'sonido inicial super poder.mp3',
  superFin: 'sonido super poder.mp3',
};
const CLIPS = {
  // pasos de ECO (alternando pie) y paso en charco
  ecoStep1: [F.paso, 1.82, 0.34, 0.08], ecoStep2: [F.paso, 2.44, 0.34, 0.08], ecoStep3: [F.paso, 5.53, 0.34, 0.08], ecoStep4: [F.paso, 6.21, 0.34, 0.08],
  ecoWater: [F.agua, 0, 0.5, 0.15],
  // golpes de ECO: uno por cada paso del combo
  ecoHit1: [F.pegando, 0.2, 0.6, 0.12], ecoHit2: [F.pegando, 8.45, 0.6, 0.12], ecoHit3: [F.pegando, 14.7, 0.6, 0.12],
  ecoHit4: [F.pegando, 22.4, 0.65, 0.12], ecoHit5: [F.pegando, 30.2, 0.65, 0.12],
  // pasos de los adversarios (normales y pesados)
  advStep1: [F.adv1, 3.2, 0.4, 0.1], advStep2: [F.adv1, 4.76, 0.4, 0.1], advStep3: [F.adv1, 5.83, 0.4, 0.1], advStep4: [F.adv1, 12.93, 0.4, 0.1],
  advHeavy1: [F.adv2, 1.14, 0.45, 0.12], advHeavy2: [F.adv2, 8.14, 0.45, 0.12], advHeavy3: [F.adv2, 16.89, 0.45, 0.12],
  // golpes recibidos por los adversarios
  foeHit1: [F.golpeado, 0.05, 0.4, 0.1], foeHit2: [F.golpeado, 1.3, 0.45, 0.1],
  // voces: quejidos cortos, avisos de ataque y gritos de muerte
  foeHurt1: [F.voces, 0.25, 0.8, 0.12], foeHurt2: [F.voces, 10.6, 0.9, 0.12], foeHurt3: [F.voces, 40.85, 1.2, 0.15], foeHurt4: [F.voces, 74.25, 1.05, 0.15],
  foeWarn1: [F.voces, 4.95, 1.0, 0.15], foeWarn2: [F.voces, 14.6, 1.35, 0.2], foeWarn3: [F.voces, 30.85, 1.6, 0.2], foeWarn4: [F.voces, 35.75, 1.6, 0.2], foeWarn5: [F.voces, 63.7, 1.35, 0.2],
  foeDie1: [F.voces, 19.45, 2.0, 0.5], foeDie2: [F.voces, 24.8, 2.1, 0.5], foeDie3: [F.voces, 45.45, 2.1, 0.5], foeDie4: [F.voces, 52.3, 2.0, 0.5],
  // poderes de ECO
  rayCharge: [F.carga, 0, 2.4, 0.4], rayFire: [F.disparo, 0, 2.6, 0.8], rayMini: [F.disparo, 0, 0.9, 0.4],
  superStart: [F.superIni, 0, 1.0, 0.1], superBlast: [F.superFin, 0, 6.5, 1.5],
};
const GAP = 0.06;
const RATE = 32000;

// ---------------------------------------------------------------- página que corta y codifica
const page = `<html><body><script>
(async () => {
  const clips = ${JSON.stringify(CLIPS)}, gap = ${GAP}, rate = ${RATE};
  const ctx = new AudioContext();
  const cache = {};
  const decode = async (file) => cache[file] || (cache[file] = await ctx.decodeAudioData(await (await fetch('/${SOURCE_DIR}' + encodeURIComponent(file))).arrayBuffer()));
  const parts = [], table = {};
  let cursor = 0;
  for (const [name, [file, start, dur, fade]] of Object.entries(clips)) {
    const source = await decode(file);
    const length = Math.ceil(dur * rate);
    const off = new OfflineAudioContext(1, length, rate);
    const node = off.createBufferSource();
    node.buffer = source;
    node.connect(off.destination);
    node.start(0, start, dur);
    const data = (await off.startRendering()).getChannelData(0).slice();
    // fundido de entrada breve y de salida; normalizado al pico
    const fin = Math.floor(0.004 * rate), fout = Math.floor(fade * rate);
    let peak = 0;
    for (let i = 0; i < length; i++) {
      let g = 1;
      if (i < fin) g = i / fin;
      if (i > length - fout) g = Math.min(g, (length - i) / fout);
      data[i] *= g;
      peak = Math.max(peak, Math.abs(data[i]));
    }
    const norm = peak > 0 ? 0.9 / peak : 1;
    for (let i = 0; i < length; i++) data[i] *= norm;
    table[name] = [Number(cursor.toFixed(3)), Number(dur.toFixed(3))];
    parts.push(data, new Float32Array(Math.ceil(gap * rate)));
    cursor += dur + gap;
  }
  const total = parts.reduce((s, p) => s + p.length, 0);
  const wav = new DataView(new ArrayBuffer(44 + total * 2));
  const text = (o, s) => { for (let i = 0; i < s.length; i++) wav.setUint8(o + i, s.charCodeAt(i)); };
  text(0, 'RIFF'); wav.setUint32(4, 36 + total * 2, true); text(8, 'WAVEfmt ');
  wav.setUint32(16, 16, true); wav.setUint16(20, 1, true); wav.setUint16(22, 1, true);
  wav.setUint32(24, rate, true); wav.setUint32(28, rate * 2, true); wav.setUint16(32, 2, true); wav.setUint16(34, 16, true);
  text(36, 'data'); wav.setUint32(40, total * 2, true);
  let o = 44;
  for (const p of parts) for (let i = 0; i < p.length; i++) { wav.setInt16(o, Math.max(-1, Math.min(1, p[i])) * 32767, true); o += 2; }
  await fetch('/table', { method: 'POST', body: JSON.stringify(table) });
  await fetch('/wav', { method: 'POST', body: wav.buffer });
  await fetch('/done', { method: 'POST', body: 'ok' });
})().catch((e) => fetch('/done', { method: 'POST', body: 'ERR ' + e.message }));
</script></body></html>`;

// ---------------------------------------------------------------- servidor mínimo
let table = null;
const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/_sfx.html') { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(page); return; }
  if (req.method === 'GET') {
    const file = path.join(root, decodeURIComponent(req.url.split('?')[0]));
    fs.readFile(file, (error, data) => {
      if (error) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': 'audio/mpeg' });
      res.end(data);
    });
    return;
  }
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const body = Buffer.concat(chunks);
    if (req.url === '/table') table = JSON.parse(body.toString());
    if (req.url === '/wav') fs.writeFileSync(path.join(root, 'assets/audio/sfx.wav'), body);
    if (req.url === '/done') {
      const message = body.toString();
      res.end('ok');
      if (message !== 'ok') { console.log('Falló:', message); finish(1); return; }
      const lines = Object.entries(table).map(([k, v]) => `  ${k}: [${v[0]}, ${v[1]}],`);
      fs.writeFileSync(path.join(root, 'src/engine/SfxData.js'),
        '// Generado por tools/make_sfx.js: [inicio, duración] en segundos de cada recorte dentro de assets/audio/sfx.wav\nconst SFX_CLIPS = {\n' + lines.join('\n') + '\n};\n');
      console.log('Listo:', Object.keys(table).length, 'recortes');
      finish(0);
      return;
    }
    res.end('ok');
  });
});

let browser = null;
function finish(code) {
  try { if (browser) execSync('taskkill /F /T /PID ' + browser.pid, { stdio: 'ignore' }); } catch (error) { /* ya cerrado */ }
  server.close();
  process.exit(code);
}

server.listen(PORT, () => {
  browser = spawn(EDGE, ['--headless=new', '--disable-gpu', '--user-data-dir=' + path.join(require('os').tmpdir(), 'edge_make_sfx'), '--autoplay-policy=no-user-gesture-required', `http://localhost:${PORT}/_sfx.html`], { stdio: 'ignore' });
  setTimeout(() => { console.log('Tiempo agotado'); finish(1); }, 120000);
});
