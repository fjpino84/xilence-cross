// Prepara las poses del Adversario 3 (Operador del dron) y el dron desde las 8 imágenes de src/levels/Advresario 3:
//   op_point.png: el operador apuntando (cuadro 1 sin el dron ni el cable); op_prep.png: preparando el lanzamiento (cuadro 4);
//   dron.png: el dron (cuadro 8). El operador sale siempre a la MISMA altura (los cuadros vienen a escalas distintas) y con el cuerpo
//   alineado; la tabla de anclas queda en assets/sprites/adversario3/_anclas.json.  Uso: node tools/make_adv3.js
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn, execSync } = require('child_process');
const root = path.resolve(__dirname, '..');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const SRC = 'src/levels/Advresario 3/';
const PORT = 8793;
const HEIGHT = 300; // altura fija del operador en los PNG

const page = `<html><body><script>
const SRC = ${JSON.stringify(SRC)}, HEIGHT = ${HEIGHT};
const load = (f) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('no cargó ' + f)); i.src = '/' + SRC.split('/').map(encodeURIComponent).join('/') + encodeURIComponent(f); });
function whiteMask(d, w, h) { const m = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) { const r = d[i*4], g = d[i*4+1], b = d[i*4+2]; if (d[i*4+3] > 0 && Math.min(r,g,b) >= 226 && Math.max(r,g,b) - Math.min(r,g,b) <= 28) m[i] = 1; } return m; }
function comps(mask, w, h) { const label = new Int32Array(w*h), infos = [], st = new Int32Array(w*h);
  for (let s = 0; s < w*h; s++) { if (!mask[s] || label[s]) continue; const id = infos.length + 1; let top = 0, area = 0, edge = false; st[top++] = s; label[s] = id;
    while (top) { const p = st[--top], x = p % w, y = (p / w) | 0; area++; if (x === 0 || y === 0 || x === w-1 || y === h-1) edge = true;
      if (x > 0 && mask[p-1] && !label[p-1]) { label[p-1] = id; st[top++] = p-1; } if (x < w-1 && mask[p+1] && !label[p+1]) { label[p+1] = id; st[top++] = p+1; }
      if (y > 0 && mask[p-w] && !label[p-w]) { label[p-w] = id; st[top++] = p-w; } if (y < h-1 && mask[p+w] && !label[p+w]) { label[p+w] = id; st[top++] = p+w; } }
    infos.push({ id, area, edge }); } return { label, infos }; }
function key(data, w, h) { const d = data.data; const { label, infos } = comps(whiteMask(d, w, h), w, h);
  const drop = new Set(infos.filter((i) => i.edge || i.area >= 60).map((i) => i.id)); const gone = new Uint8Array(w*h);
  for (let i = 0; i < w*h; i++) if (label[i] && drop.has(label[i])) gone[i] = 1;
  const dist = new Uint8Array(w*h).fill(9); let fr = []; for (let i = 0; i < w*h; i++) if (gone[i] || d[i*4+3] === 0) { dist[i] = 0; fr.push(i); }
  for (let s = 1; s <= 3; s++) { const nx = []; for (const p of fr) { const x = p % w, y = (p / w) | 0; for (const q of [x>0?p-1:-1, x<w-1?p+1:-1, y>0?p-w:-1, y<h-1?p+w:-1]) if (q >= 0 && dist[q] > s) { dist[q] = s; nx.push(q); } } fr = nx; }
  const out = new Uint8ClampedArray(d);
  for (let i = 0; i < w*h; i++) { if (gone[i]) { out[i*4+3] = 0; continue; } if (dist[i] > 3 || d[i*4+3] === 0) continue;
    const r = d[i*4], g = d[i*4+1], b = d[i*4+2], low = Math.min(r,g,b); const a = Math.max(0, Math.min(1, (255 - low) / 150)); if (a >= 0.98) continue; const aa = Math.max(a, 0.001);
    out[i*4] = Math.max(0, Math.min(255, (r - (1-aa)*255) / aa)); out[i*4+1] = Math.max(0, Math.min(255, (g - (1-aa)*255) / aa)); out[i*4+2] = Math.max(0, Math.min(255, (b - (1-aa)*255) / aa)); out[i*4+3] = Math.round(255 * Math.min(1, a * 1.15)); }
  return new ImageData(out, w, h); }
function keepMain(img, radius) { const { width: w, height: h, data } = img; const ink = new Uint8Array(w*h); for (let i = 0; i < w*h; i++) ink[i] = data[i*4+3] > 40 ? 1 : 0;
  const tmp = new Uint8Array(w*h), dil = new Uint8Array(w*h);
  for (let y = 0; y < h; y++) { let l = -1e9; for (let x = 0; x < w; x++) { if (ink[y*w+x]) l = x; if (x - l <= radius) tmp[y*w+x] = 1; } l = 1e9; for (let x = w-1; x >= 0; x--) { if (ink[y*w+x]) l = x; if (l - x <= radius) tmp[y*w+x] = 1; } }
  for (let x = 0; x < w; x++) { let l = -1e9; for (let y = 0; y < h; y++) { if (tmp[y*w+x]) l = y; if (y - l <= radius) dil[y*w+x] = 1; } l = 1e9; for (let y = h-1; y >= 0; y--) { if (tmp[y*w+x]) l = y; if (l - y <= radius) dil[y*w+x] = 1; } }
  const { label, infos } = comps(dil, w, h); const main = infos.reduce((b, i) => (i.area > b.area ? i : b)).id;
  for (let i = 0; i < w*h; i++) if (label[i] !== main) data[i*4+3] = 0; return img; }
const bbox = (img) => { const { width: w, height: h, data } = img; let x0 = w, y0 = h, x1 = -1, y1 = -1; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (data[(y*w+x)*4+3] > 60) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } return { x0, y0, x1, y1 }; };
const save = async (name, canvas) => { const blob = await new Promise((r) => canvas.toBlob(r, 'image/png')); await fetch('/save?name=' + name, { method: 'POST', body: blob }); };
const cut = (img, x0, y0, x1, y1) => { const c = document.createElement('canvas'); c.width = x1 - x0 + 1; c.height = y1 - y0 + 1; c.getContext('2d').putImageData(img, -x0, -y0); return c; };

(async () => {
  const info = {};
  const prep = async (file, region) => { const im = await load(file); const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; const x = c.getContext('2d'); x.drawImage(im, 0, 0);
    let data = x.getImageData(0, 0, c.width, c.height); data = key(data, c.width, c.height);
    if (region) { const [rx0, rx1] = region; for (let y = 0; y < c.height; y++) for (let xx = 0; xx < c.width; xx++) if (xx < rx0 * c.width || xx > rx1 * c.width) data.data[(y*c.width+xx)*4+3] = 0; }
    return keepMain(data, 6); };
  const person = async (name, file, region) => {
    const img = await prep(file, region); const b = bbox(img); const h = b.y1 - b.y0 + 1; const scale = HEIGHT / h;
    let sx = 0, n = 0; for (let y = Math.floor(b.y1 - h * 0.3); y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) if (img.data[(y*img.width+x)*4+3] > 120) { sx += x; n++; }
    const legX = sx / n; const c = cut(img, b.x0, b.y0, b.x1, b.y1);
    const o = document.createElement('canvas'); o.width = Math.round(c.width * scale); o.height = HEIGHT; const ox = o.getContext('2d'); ox.imageSmoothingQuality = 'high'; ox.drawImage(c, 0, 0, o.width, o.height);
    await save(name + '.png', o); info[name] = { w: o.width, h: o.height, anchor: +(((legX - b.x0) * scale) / o.width).toFixed(3) }; };
  await person('op_point', '1.jpg', [0, 0.475]);
  await person('op_prep', '4.JPG', null);
  const d8 = await prep('8.jpg', [0.56, 1]); const b = bbox(d8); const c = cut(d8, b.x0, b.y0, b.x1, b.y1);
  const s = Math.min(1, 380 / c.width); const o = document.createElement('canvas'); o.width = Math.round(c.width * s); o.height = Math.round(c.height * s); const ox = o.getContext('2d'); ox.imageSmoothingQuality = 'high'; ox.drawImage(c, 0, 0, o.width, o.height);
  await save('dron.png', o); info.dron = { w: o.width, h: o.height };
  await fetch('/info', { method: 'POST', body: JSON.stringify(info, null, 1) });
  await fetch('/done', { method: 'POST', body: 'ok' });
})().catch((e) => fetch('/done', { method: 'POST', body: 'ERR ' + e.message }));
</script></body></html>`;

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/_a3.html') { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(page); return; }
  if (req.method === 'GET') {
    fs.readFile(path.join(root, decodeURIComponent(req.url.split('?')[0])), (error, data) => {
      if (error) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': 'image/jpeg' });
      res.end(data);
    });
    return;
  }
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const body = Buffer.concat(chunks);
    const url = new URL(req.url, 'http://x');
    const dir = path.join(root, 'assets/sprites/adversario3');
    fs.mkdirSync(dir, { recursive: true });
    if (url.pathname === '/save') fs.writeFileSync(path.join(dir, url.searchParams.get('name')), body);
    if (url.pathname === '/info') fs.writeFileSync(path.join(dir, '_anclas.json'), body);
    res.end('ok');
    if (url.pathname === '/done') {
      const message = body.toString();
      console.log(message.startsWith('ERR') ? 'Falló: ' + message : 'Listo');
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
  browser = spawn(EDGE, ['--headless=new', '--disable-gpu', '--user-data-dir=' + path.join(require('os').tmpdir(), 'edge_make_a3'), `http://localhost:${PORT}/_a3.html`], { stdio: 'ignore' });
  setTimeout(() => { console.log('Tiempo agotado'); finish(1); }, 120000);
});
