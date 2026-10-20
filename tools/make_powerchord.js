// Prepara los cuadros de la animación del Power Chord (video "Power Chord.mp4" de src/levels/ECO) para el juego.
// 1) Saca los cuadros del video a 12 por segundo desde el segundo 1,4:
//      node tools/video_frames.js "src/levels/ECO/Power Chord.mp4" <carpeta> 8.4 12 1.4
// 2) Los pasa a transparente (fondo blanco fuera, bordes limpios), los reduce a 640×360, difumina los bordes de los efectos de
//    color (los rayos y los anillos salían cortados por el encuadre del video) y los guarda como assets/sprites/eco/pc_N.webp:
//      node tools/make_powerchord.js <carpeta>
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn, execSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 8792;
const folder = path.resolve(process.argv[2] || '');
if (!process.argv[2] || !fs.existsSync(folder)) { console.log('Uso: node tools/make_powerchord.js <carpeta con los cuadros>'); process.exit(1); }

// Cuadros elegidos (numerados como en la carpeta, a 12 por segundo): subida de la guitarra, primer golpe al suelo, segunda subida y golpe,
// rayos, anillos de choque y recuperación. Los que se saltan casi no cambian.
const PICK = [
  3, 5, 7, 9, 13, 17,
  19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29,
  31, 33, 35, 37, 38, 39, 40, 41,
  42, 43, 44, 45, 47, 49, 51, 53, 55,
  57, 59, 61, 63, 65, 67, 69, 71, 73, 75, 77, 79, 81, 83, 85, 87,
  89, 91, 93, 95, 97, 99,
];

const page = `<html><body><script>
const PICK = ${JSON.stringify(PICK)};
const load = (src) => new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = () => reject(new Error('no cargó ' + src)); i.src = src; });

function whiteMask(d, w, h, limit, saturation) {
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2];
    if (d[i * 4 + 3] > 0 && Math.min(r, g, b) >= limit && Math.max(r, g, b) - Math.min(r, g, b) <= saturation) mask[i] = 1;
  }
  return mask;
}
function components(mask, w, h, d) {
  const label = new Int32Array(w * h), infos = [], stack = new Int32Array(w * h);
  for (let start = 0; start < w * h; start++) {
    if (!mask[start] || label[start]) continue;
    const id = infos.length + 1;
    let top = 0, area = 0, sumMin = 0;
    stack[top++] = start; label[start] = id;
    while (top) {
      const p = stack[--top], x = p % w, y = (p / w) | 0;
      area++; sumMin += Math.min(d[p * 4], d[p * 4 + 1], d[p * 4 + 2]);
      if (x > 0 && mask[p - 1] && !label[p - 1]) { label[p - 1] = id; stack[top++] = p - 1; }
      if (x < w - 1 && mask[p + 1] && !label[p + 1]) { label[p + 1] = id; stack[top++] = p + 1; }
      if (y > 0 && mask[p - w] && !label[p - w]) { label[p - w] = id; stack[top++] = p - w; }
      if (y < h - 1 && mask[p + w] && !label[p + w]) { label[p + w] = id; stack[top++] = p + w; }
    }
    infos.push({ id, area, sumMin });
  }
  return { label, infos };
}
// Quita el blanco (componentes que cumplan remove) y deja el borde con transparencia progresiva
function keyWhite(image, remove, limit, saturation) {
  const { width: w, height: h, data: d } = image;
  const { label, infos } = components(whiteMask(d, w, h, limit, saturation), w, h, d);
  const drop = new Set(infos.filter(remove).map((i) => i.id));
  const gone = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) if (label[i] && drop.has(label[i])) gone[i] = 1;
  const dist = new Uint8Array(w * h).fill(9);
  let frontier = [];
  for (let i = 0; i < w * h; i++) if (gone[i] || d[i * 4 + 3] === 0) { dist[i] = 0; frontier.push(i); }
  for (let step = 1; step <= 3; step++) {
    const next = [];
    for (const p of frontier) {
      const x = p % w, y = (p / w) | 0;
      for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]) if (q >= 0 && dist[q] > step) { dist[q] = step; next.push(q); }
    }
    frontier = next;
  }
  const out = new Uint8ClampedArray(d);
  for (let i = 0; i < w * h; i++) {
    if (gone[i]) { out[i * 4 + 3] = 0; continue; }
    if (dist[i] > 3 || d[i * 4 + 3] === 0) continue;
    const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2], lowest = Math.min(r, g, b);
    const alpha = Math.max(0, Math.min(1, (255 - lowest) / 145));
    if (alpha >= 0.98) continue;
    const a = Math.max(alpha, 0.001);
    out[i * 4] = Math.max(0, Math.min(255, (r - (1 - a) * 255) / a));
    out[i * 4 + 1] = Math.max(0, Math.min(255, (g - (1 - a) * 255) / a));
    out[i * 4 + 2] = Math.max(0, Math.min(255, (b - (1 - a) * 255) / a));
    out[i * 4 + 3] = Math.round(255 * Math.min(1, alpha * 1.15));
  }
  return new ImageData(out, w, h);
}
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

(async () => {
  const W = 640, H = 360;
  for (let n = 0; n < PICK.length; n++) {
    const name = 'f_' + String(PICK[n]).padStart(4, '0') + '.png';
    const image = await load('/frames/' + name);
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d');
    x.imageSmoothingQuality = 'high';
    x.drawImage(image, 0, 0, W, H);
    // tres pasadas: blanco puro, blanco casi puro y celdas pequeñas
    let data = keyWhite(x.getImageData(0, 0, W, H), (i) => i.area >= 8, 238, 22);
    data = keyWhite(data, (i) => i.area >= 20 && i.sumMin / i.area >= 216, 204, 30);
    // los efectos de color (rayos, anillos, polvo) se difuminan hacia los bordes del encuadre: ECO, oscuro y poco saturado, no se toca
    const d = data.data;
    for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
      const i = (py * W + px) * 4;
      if (!d[i + 3]) continue;
      const sat = Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]);
      const lum = (d[i] + d[i + 1] + d[i + 2]) / 3;
      let k = smooth(0, 0.1, Math.min(px / W, 1 - px / W)); // bordes laterales
      if (sat > 50 || lum > 150) k *= smooth(0, 0.3, py / H); // arriba: los rayos se pierden hacia el cielo
      d[i + 3] = Math.round(d[i + 3] * k);
    }
    x.putImageData(data, 0, 0);
    const blob = await new Promise((r) => c.toBlob(r, 'image/webp', 0.85));
    await fetch('/save?name=pc_' + (n + 1) + '.webp', { method: 'POST', body: blob });
  }
  await fetch('/done', { method: 'POST', body: 'ok ' + PICK.length });
})().catch((e) => fetch('/done', { method: 'POST', body: 'ERR ' + e.message }));
</script></body></html>`;

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/_pc.html') { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(page); return; }
  if (req.method === 'GET' && req.url.startsWith('/frames/')) {
    fs.readFile(path.join(folder, decodeURIComponent(req.url.slice(8))), (error, data) => {
      if (error) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': 'image/png' }); res.end(data);
    });
    return;
  }
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const body = Buffer.concat(chunks);
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/save') fs.writeFileSync(path.join(root, 'assets/sprites/eco', url.searchParams.get('name')), body);
    res.end('ok');
    if (url.pathname === '/done') {
      const message = body.toString();
      console.log(message.startsWith('ERR') ? 'Falló: ' + message : 'Listo: ' + message + ' cuadros');
      finish(message.startsWith('ERR') ? 1 : 0);
    }
  });
});
let browser = null;
function finish(code) {
  try { if (browser) execSync('taskkill /F /T /PID ' + browser.pid, { stdio: 'ignore' }); } catch (error) { /* ya cerrado */ }
  server.close();
  process.exit(code);
}
server.listen(PORT, () => {
  browser = spawn(EDGE, ['--headless=new', '--disable-gpu', '--user-data-dir=' + path.join(require('os').tmpdir(), 'edge_make_pc'), `http://localhost:${PORT}/_pc.html`], { stdio: 'ignore' });
  setTimeout(() => { console.log('Tiempo agotado'); finish(1); }, 600000);
});
