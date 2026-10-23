// Prepara los cuadros del poder del suelo de Rex Vane desde un video (segundos 3 a 8):
//   node tools/video_frames.js "<video>" <carpeta> 5 12 3   y luego   node tools/make_rexsuelo.js <carpeta>
// Se usa un cuadro de cada dos (30), se reducen a 576×324, el fondo blanco y el humo gris pasan a transparencia real (desmezcla contra blanco)
// y los bordes se difuminan. Salida: assets/sprites/rexvane/suelo_1..30.webp
const fs = require('fs'); const path = require('path'); const http = require('http'); const { spawn, execSync } = require('child_process');
const root = path.resolve(__dirname, '..'); const folder = path.resolve(process.argv[2] || '');
if (!process.argv[2] || !fs.existsSync(folder)) { console.log('Uso: node tools/make_rexsuelo.js <carpeta con f_0001.png…>'); process.exit(1); }
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'; const PORT = 8797;
const page = `<html><body><script>
const load = (f) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('no cargó ' + f)); i.src = '/f/' + f; });
(async () => {
  const W = 576, H = 324;
  for (let n = 1; n <= 30; n++) {
    const im = await load('f_' + String(n * 2 - 1).padStart(4, '0') + '.png');
    const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(im, 0, 0, W, H);
    const img = x.getImageData(0, 0, W, H), d = img.data;
    for (let i = 0; i < W * H; i++) {
      const r = d[i*4], g = d[i*4+1], b = d[i*4+2]; const low = Math.min(r, g, b);
      let a = (255 - low) / 255; a = a < 0.07 ? 0 : Math.min(1, a * 1.12);
      if (a > 0) { const aa = Math.max(a, 0.02); d[i*4] = Math.max(0, Math.min(255, (r - (1 - aa) * 255) / aa)); d[i*4+1] = Math.max(0, Math.min(255, (g - (1 - aa) * 255) / aa)); d[i*4+2] = Math.max(0, Math.min(255, (b - (1 - aa) * 255) / aa)); }
      const px = i % W, py = (i / W) | 0; const e = Math.min(px, W - 1 - px, py, (H - 1 - py) * 3); const F = 36;
      d[i*4+3] = Math.round(255 * a * (e < F ? (e / F) * (e / F) * (3 - 2 * e / F) : 1));
    }
    x.putImageData(img, 0, 0);
    const blob = await new Promise((r) => c.toBlob(r, 'image/webp', 0.88)); await fetch('/save?name=suelo_' + n + '.webp', { method: 'POST', body: blob });
  }
  await fetch('/done', { method: 'POST', body: 'ok' });
})().catch((e) => fetch('/done', { method: 'POST', body: 'ERR ' + e.message }));
</script></body></html>`;
const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/_s.html') { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(page); return; }
  if (req.method === 'GET' && req.url.startsWith('/f/')) { fs.readFile(path.join(folder, decodeURIComponent(req.url.slice(3))), (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': 'image/png' }); res.end(d); }); return; }
  const ch = []; req.on('data', (c) => ch.push(c)); req.on('end', () => { const body = Buffer.concat(ch); const url = new URL(req.url, 'http://x');
    if (url.pathname === '/save') fs.writeFileSync(path.join(root, 'assets/sprites/rexvane', url.searchParams.get('name')), body); res.end('ok');
    if (url.pathname === '/done') { const m = body.toString(); console.log(m.startsWith('ERR') ? 'Falló: ' + m : 'Listo'); finish(m.startsWith('ERR') ? 1 : 0); } });
});
let b = null; function finish(c) { try { if (b) execSync('taskkill /F /T /PID ' + b.pid, { stdio: 'ignore' }); } catch (e) { /* ya cerrado */ } server.close(); process.exit(c); }
server.listen(PORT, () => { b = spawn(EDGE, ['--headless=new', '--disable-gpu', '--user-data-dir=' + path.join(require('os').tmpdir(), 'edge_rexs'), `http://localhost:${PORT}/_s.html`], { stdio: 'ignore' }); setTimeout(() => { console.log('Tiempo agotado'); finish(1); }, 180000); });
