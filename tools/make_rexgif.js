// Prepara los 8 cuadros del GIF de Rex Vane (src/levels/Subjefe level 2/GIF Subjefe.gif): primero node tools/gif_frames.js <gif> <carpeta>,
// luego node tools/make_rexgif.js <carpeta>. Quita el fondo blanco, conserva el lienzo de 512×512 y guarda assets/sprites/rexvane/gif_N.png
const fs = require('fs'); const path = require('path'); const http = require('http'); const { spawn, execSync } = require('child_process');
const root = path.resolve(__dirname, '..'); const folder = path.resolve(process.argv[2] || '');
if (!process.argv[2] || !fs.existsSync(folder)) { console.log('Uso: node tools/make_rexgif.js <carpeta con g_001.png…>'); process.exit(1); }
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'; const PORT = 8796;
const page = `<html><body><script>
const load = (f) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('no cargó ' + f)); i.src = '/f/' + f; });
function wm(d, w, h, lim, sat) { const m = new Uint8Array(w*h); for (let i = 0; i < w*h; i++) { const r = d[i*4], g = d[i*4+1], b = d[i*4+2]; if (Math.min(r,g,b) >= lim && Math.max(r,g,b) - Math.min(r,g,b) <= sat) m[i] = 1; } return m; }
function comps(mask, w, h) { const label = new Int32Array(w*h), infos = [], st = new Int32Array(w*h);
  for (let s = 0; s < w*h; s++) { if (!mask[s] || label[s]) continue; const id = infos.length + 1; let top = 0, area = 0, edge = false; st[top++] = s; label[s] = id;
    while (top) { const p = st[--top], x = p % w, y = (p / w) | 0; area++; if (x === 0 || y === 0 || x === w-1 || y === h-1) edge = true;
      if (x > 0 && mask[p-1] && !label[p-1]) { label[p-1] = id; st[top++] = p-1; } if (x < w-1 && mask[p+1] && !label[p+1]) { label[p+1] = id; st[top++] = p+1; }
      if (y > 0 && mask[p-w] && !label[p-w]) { label[p-w] = id; st[top++] = p-w; } if (y < h-1 && mask[p+w] && !label[p+w]) { label[p+w] = id; st[top++] = p+w; } }
    infos.push({ id, area, edge }); } return { label, infos }; }
function key(img) { const w = img.width, h = img.height, d = img.data; const { label, infos } = comps(wm(d, w, h, 232, 26), w, h);
  const drop = new Set(infos.filter((i) => i.edge || i.area >= 30).map((i) => i.id)); const gone = new Uint8Array(w*h);
  for (let i = 0; i < w*h; i++) if (label[i] && drop.has(label[i])) gone[i] = 1;
  const dist = new Uint8Array(w*h).fill(9); let fr = []; for (let i = 0; i < w*h; i++) if (gone[i]) { dist[i] = 0; fr.push(i); }
  for (let s = 1; s <= 3; s++) { const nx = []; for (const p of fr) { const x = p % w, y = (p / w) | 0; for (const q of [x>0?p-1:-1, x<w-1?p+1:-1, y>0?p-w:-1, y<h-1?p+w:-1]) if (q >= 0 && dist[q] > s) { dist[q] = s; nx.push(q); } } fr = nx; }
  const out = new Uint8ClampedArray(d);
  for (let i = 0; i < w*h; i++) { if (gone[i]) { out[i*4+3] = 0; continue; } if (dist[i] > 3) continue;
    const r = d[i*4], g = d[i*4+1], b = d[i*4+2], low = Math.min(r,g,b); const a = Math.max(0, Math.min(1, (255 - low) / 150)); if (a >= 0.98) continue; const aa = Math.max(a, 0.001);
    out[i*4] = Math.max(0, Math.min(255, (r - (1-aa)*255) / aa)); out[i*4+1] = Math.max(0, Math.min(255, (g - (1-aa)*255) / aa)); out[i*4+2] = Math.max(0, Math.min(255, (b - (1-aa)*255) / aa)); out[i*4+3] = Math.round(255 * Math.min(1, a * 1.15)); }
  return new ImageData(out, w, h); }
(async () => {
  for (let n = 1; n <= 8; n++) {
    const im = await load('g_' + String(n).padStart(3, '0') + '.png'); const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
    const x = c.getContext('2d'); x.drawImage(im, 0, 0); const kd = key(x.getImageData(0, 0, c.width, c.height));
    // el humo y los rayos que tocan el borde del lienzo se difuminan (sin cortes rectos)
    const F = 56; for (let py = 0; py < c.height; py++) for (let px = 0; px < c.width; px++) { const e = Math.min(px, py, c.width - 1 - px, c.height - 1 - py); if (e < F) { const t = e / F; kd.data[(py*c.width+px)*4+3] *= t * t * (3 - 2 * t); } }
    x.putImageData(kd, 0, 0);
    const blob = await new Promise((r) => c.toBlob(r, 'image/png')); await fetch('/save?name=gif_' + n + '.png', { method: 'POST', body: blob });
  }
  await fetch('/done', { method: 'POST', body: 'ok' });
})().catch((e) => fetch('/done', { method: 'POST', body: 'ERR ' + e.message }));
</script></body></html>`;
const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/_r.html') { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(page); return; }
  if (req.method === 'GET' && req.url.startsWith('/f/')) { fs.readFile(path.join(folder, decodeURIComponent(req.url.slice(3))), (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': 'image/png' }); res.end(d); }); return; }
  const ch = []; req.on('data', (c) => ch.push(c)); req.on('end', () => { const body = Buffer.concat(ch); const url = new URL(req.url, 'http://x');
    if (url.pathname === '/save') fs.writeFileSync(path.join(root, 'assets/sprites/rexvane', url.searchParams.get('name')), body); res.end('ok');
    if (url.pathname === '/done') { const m = body.toString(); console.log(m.startsWith('ERR') ? 'Falló: ' + m : 'Listo'); finish(m.startsWith('ERR') ? 1 : 0); } });
});
let b = null; function finish(c) { try { if (b) execSync('taskkill /F /T /PID ' + b.pid, { stdio: 'ignore' }); } catch (e) { /* ya cerrado */ } server.close(); process.exit(c); }
server.listen(PORT, () => { b = spawn(EDGE, ['--headless=new', '--disable-gpu', '--user-data-dir=' + path.join(require('os').tmpdir(), 'edge_rexgif'), `http://localhost:${PORT}/_r.html`], { stdio: 'ignore' }); setTimeout(() => { console.log('Tiempo agotado'); finish(1); }, 120000); });
