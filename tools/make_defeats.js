// Corta las hojas de derrota (4 viñetas cada una) de Adversario 1, Adversario 2, Rex Vane y Adversario 3 en cuadros sueltos con fondo
// transparente: assets/sprites/derrotas/<id>_<n>.png y la tabla _derrotas.json (tamaño y ancla de cada cuadro).
// Todos los cuadros de una hoja salen a la misma escala (la viñeta 1 mide 300 px de alto) para que el personaje no cambie de tamaño.
// Las coordenadas de las viñetas están en fracciones de la hoja (x0, y0, x1, y1). Uso: node tools/make_defeats.js
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn, execSync } = require('child_process');
const root = path.resolve(__dirname, '..');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 8794;
const W = 1611, H = 2000; // coordenadas medidas sobre la hoja vista a 1611×2000
const rect = (a, b, c, d) => [a / W, b / H, c / W, d / H];
const SHEETS = {
  adv1: {
    file: 'Adversario 1/Derrota.jpg', ref: 862, radius: 50,
    panels: [rect(50, 42, 803, 983), rect(825, 42, 1560, 983), rect(50, 988, 803, 1955), rect(825, 988, 1560, 1955)],
  },
  adv2: {
    file: 'Adversario 2/Derrota.jpg', ref: 926, radius: 50,
    panels: [rect(50, 42, 808, 975), rect(832, 42, 1560, 975), rect(48, 998, 1560, 1465), rect(48, 1485, 1560, 1955)],
  },
  rex: {
    file: 'Subjefe level 2/Derrota.jpg', ref: 851, radius: 45,
    panels: [rect(37, 35, 795, 957), rect(815, 35, 1572, 957), rect(37, 980, 1572, 1520), rect(37, 1540, 1572, 1995)],
  },
  op: {
    file: 'Advresario 3/Derrota.jpg', ref: 972, radius: 12,
    panels: [rect(95, 47, 800, 988), rect(820, 47, 1527, 988), rect(95, 1012, 1527, 1473), rect(92, 1498, 1523, 1958)],
    // el dron de cada viñeta se borra (el dron es otra entidad del juego); fracciones dentro de la viñeta
    erase: [[[0.70, 0.08, 0.92, 0.28]], [[0.62, 0.0, 1, 0.32]], [[0.78, 0.3, 1, 1]], [[0.86, 0, 1, 1]]],
  },
};

const page = `<html><body><script>
const SHEETS = ${JSON.stringify(SHEETS)};
const load = (f) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('no cargó ' + f)); i.src = '/src/levels/' + f.split('/').map(encodeURIComponent).join('/'); });
function whiteMask(d, w, h) { const m = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) { const r = d[i*4], g = d[i*4+1], b = d[i*4+2]; if (d[i*4+3] > 0 && Math.min(r,g,b) >= 224 && Math.max(r,g,b) - Math.min(r,g,b) <= 30) m[i] = 1; } return m; }
function comps(mask, w, h) { const label = new Int32Array(w*h), infos = [], st = new Int32Array(w*h);
  for (let s = 0; s < w*h; s++) { if (!mask[s] || label[s]) continue; const id = infos.length + 1; let top = 0, area = 0, edge = false; st[top++] = s; label[s] = id;
    while (top) { const p = st[--top], x = p % w, y = (p / w) | 0; area++; if (x === 0 || y === 0 || x === w-1 || y === h-1) edge = true;
      if (x > 0 && mask[p-1] && !label[p-1]) { label[p-1] = id; st[top++] = p-1; } if (x < w-1 && mask[p+1] && !label[p+1]) { label[p+1] = id; st[top++] = p+1; }
      if (y > 0 && mask[p-w] && !label[p-w]) { label[p-w] = id; st[top++] = p-w; } if (y < h-1 && mask[p+w] && !label[p+w]) { label[p+w] = id; st[top++] = p+w; } }
    infos.push({ id, area, edge }); } return { label, infos }; }
function key(img) { const w = img.width, h = img.height, d = img.data; const { label, infos } = comps(whiteMask(d, w, h), w, h);
  const drop = new Set(infos.filter((i) => i.edge || i.area >= 40).map((i) => i.id)); const gone = new Uint8Array(w*h);
  for (let i = 0; i < w*h; i++) if (label[i] && drop.has(label[i])) gone[i] = 1;
  const dist = new Uint8Array(w*h).fill(9); let fr = []; for (let i = 0; i < w*h; i++) if (gone[i] || d[i*4+3] === 0) { dist[i] = 0; fr.push(i); }
  for (let s = 1; s <= 3; s++) { const nx = []; for (const p of fr) { const x = p % w, y = (p / w) | 0; for (const q of [x>0?p-1:-1, x<w-1?p+1:-1, y>0?p-w:-1, y<h-1?p+w:-1]) if (q >= 0 && dist[q] > s) { dist[q] = s; nx.push(q); } } fr = nx; }
  const out = new Uint8ClampedArray(d);
  for (let i = 0; i < w*h; i++) { if (gone[i]) { out[i*4+3] = 0; continue; } if (dist[i] > 3 || d[i*4+3] === 0) continue;
    const r = d[i*4], g = d[i*4+1], b = d[i*4+2], low = Math.min(r,g,b); const a = Math.max(0, Math.min(1, (255 - low) / 150)); if (a >= 0.98) continue; const aa = Math.max(a, 0.001);
    out[i*4] = Math.max(0, Math.min(255, (r - (1-aa)*255) / aa)); out[i*4+1] = Math.max(0, Math.min(255, (g - (1-aa)*255) / aa)); out[i*4+2] = Math.max(0, Math.min(255, (b - (1-aa)*255) / aa)); out[i*4+3] = Math.round(255 * Math.min(1, a * 1.15)); }
  return new ImageData(out, w, h); }
function keepMain(img, radius) { const w = img.width, h = img.height, data = img.data; const ink = new Uint8Array(w*h); for (let i = 0; i < w*h; i++) ink[i] = data[i*4+3] > 40 ? 1 : 0;
  const tmp = new Uint8Array(w*h), dil = new Uint8Array(w*h);
  for (let y = 0; y < h; y++) { let l = -1e9; for (let x = 0; x < w; x++) { if (ink[y*w+x]) l = x; if (x - l <= radius) tmp[y*w+x] = 1; } l = 1e9; for (let x = w-1; x >= 0; x--) { if (ink[y*w+x]) l = x; if (l - x <= radius) tmp[y*w+x] = 1; } }
  for (let x = 0; x < w; x++) { let l = -1e9; for (let y = 0; y < h; y++) { if (tmp[y*w+x]) l = y; if (y - l <= radius) dil[y*w+x] = 1; } l = 1e9; for (let y = h-1; y >= 0; y--) { if (tmp[y*w+x]) l = y; if (l - y <= radius) dil[y*w+x] = 1; } }
  const { label, infos } = comps(dil, w, h); const main = infos.reduce((b, i) => (i.area > b.area ? i : b)).id;
  for (let i = 0; i < w*h; i++) if (label[i] !== main) data[i*4+3] = 0; return img; }
const bbox = (img) => { let x0 = img.width, y0 = img.height, x1 = -1, y1 = -1; for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) if (img.data[(y*img.width+x)*4+3] > 60) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } return { x0, y0, x1, y1 }; };
const save = async (name, canvas) => { const blob = await new Promise((r) => canvas.toBlob(r, 'image/png')); await fetch('/save?name=' + name, { method: 'POST', body: blob }); };

(async () => {
  const meta = {};
  for (const [id, sheet] of Object.entries(SHEETS)) {
    const image = await load(sheet.file);
    const sw = image.naturalWidth, sh = image.naturalHeight;
    const scale = 300 / sheet.ref;
    meta[id] = [];
    for (let n = 0; n < sheet.panels.length; n++) {
      const [fx0, fy0, fx1, fy1] = sheet.panels[n];
      const inset = id === 'rex' ? 22 : 10;
      const x0 = Math.round(fx0 * sw) + inset, y0 = Math.round(fy0 * sh) + inset, x1 = Math.round(fx1 * sw) - inset, y1 = Math.round(fy1 * sh) - inset;
      const pw = x1 - x0, ph = y1 - y0;
      const c = document.createElement('canvas'); c.width = pw; c.height = ph; const cx = c.getContext('2d'); cx.drawImage(image, x0, y0, pw, ph, 0, 0, pw, ph);
      let data = key(cx.getImageData(0, 0, pw, ph));
      for (const [ex0, ey0, ex1, ey1] of (sheet.erase && sheet.erase[n]) || []) for (let y = Math.floor(ey0 * ph); y < Math.ceil(ey1 * ph); y++) for (let x = Math.floor(ex0 * pw); x < Math.ceil(ex1 * pw); x++) data.data[(y*pw+x)*4+3] = 0;
      data = keepMain(data, sheet.radius);
      const b = bbox(data);
      const bw = b.x1 - b.x0 + 1, bh = b.y1 - b.y0 + 1;
      let sx = 0, cnt = 0; for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) if (data.data[(y*pw+x)*4+3] > 120) { sx += x; cnt++; }
      const cut = document.createElement('canvas'); cut.width = bw; cut.height = bh; cut.getContext('2d').putImageData(data, -b.x0, -b.y0);
      const ow = Math.max(2, Math.round(bw * scale)), oh = Math.max(2, Math.round(bh * scale));
      const o = document.createElement('canvas'); o.width = ow; o.height = oh; const ox = o.getContext('2d'); ox.imageSmoothingQuality = 'high'; ox.drawImage(cut, 0, 0, ow, oh);
      await save(id + '_' + (n + 1) + '.png', o);
      meta[id].push({ w: ow, h: oh, anchor: +(((sx / cnt) - b.x0) / bw).toFixed(3) });
    }
  }
  await fetch('/meta', { method: 'POST', body: JSON.stringify(meta, null, 1) });
  await fetch('/done', { method: 'POST', body: 'ok' });
})().catch((e) => fetch('/done', { method: 'POST', body: 'ERR ' + e.message }));
</script></body></html>`;

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/_df.html') { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(page); return; }
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
    const dir = path.join(root, 'assets/sprites/derrotas');
    fs.mkdirSync(dir, { recursive: true });
    if (url.pathname === '/save') fs.writeFileSync(path.join(dir, url.searchParams.get('name')), body);
    if (url.pathname === '/meta') fs.writeFileSync(path.join(dir, '_derrotas.json'), body);
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
  browser = spawn(EDGE, ['--headless=new', '--disable-gpu', '--user-data-dir=' + path.join(require('os').tmpdir(), 'edge_make_df'), `http://localhost:${PORT}/_df.html`], { stdio: 'ignore' });
  setTimeout(() => { console.log('Tiempo agotado'); finish(1); }, 240000);
});
