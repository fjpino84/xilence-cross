// Prepara los cuadros del vuelo y del poder aéreo de Rex Vane desde el video "Volando de lado a lado y con poder en altura.mp4":
//   node tools/video_frames.js "<video>" <carpeta> 10 6 0   y luego   node tools/make_rexvuelo.js <carpeta>
// Grupos: vuelo hacia la derecha (cuadros 3-10), flotando de frente (25-41, uno de cada dos) y poder en altura (38-60). Cada cuadro se recorta en
// una ventana de 768 px centrada en Rex (en el vuelo, sobre el propio Rex: así el movimiento lo pone el juego; en el resto, fija por grupo),
// se reduce a 384×384, el fondo blanco y el humo claro pasan a transparencia real y los bordes se difuminan. Salida: assets/sprites/rexvane/vuelo_*.webp
const fs = require('fs'); const path = require('path'); const http = require('http'); const { spawn, execSync } = require('child_process');
const root = path.resolve(__dirname, '..'); const folder = path.resolve(process.argv[2] || '');
if (!process.argv[2] || !fs.existsSync(folder)) { console.log('Uso: node tools/make_rexvuelo.js <carpeta>'); process.exit(1); }
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'; const PORT = 8798;
const GROUPS = { fly: { src: [3, 4, 5, 6, 7, 8, 9, 10], follow: true }, hov: { src: [25, 27, 29, 31, 33, 35, 37, 39, 41], follow: false },
  bol: { src: [38, 40, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 56, 58, 60], follow: false } };
const page = `<html><body><script>
const GROUPS = ${JSON.stringify(GROUPS)};
const load = (n) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('no cargó ' + n)); i.src = '/f/f_' + String(n).padStart(4, '0') + '.png'; });
function centroid(im) { const c = document.createElement('canvas'); c.width = 320; c.height = 180; const x = c.getContext('2d'); x.drawImage(im, 0, 0, 320, 180); const d = x.getImageData(0, 0, 320, 180).data; let sx = 0, sy = 0, n = 0;
  for (let i = 0; i < 320 * 180; i++) { if (Math.max(d[i*4], d[i*4+1], d[i*4+2]) < 55) { sx += i % 320; sy += (i / 320) | 0; n++; } } return n ? [sx / n * 4, sy / n * 4] : [640, 360]; }
const median = (a) => a.slice().sort((p, q) => p - q)[a.length >> 1];
(async () => {
  const OUT = 384, WIN = 768;
  for (const [name, g] of Object.entries(GROUPS)) {
    const images = await Promise.all(g.src.map(load)); const cs = images.map(centroid);
    const fixed = [median(cs.map((c) => c[0])), median(cs.map((c) => c[1]))];
    for (let k = 0; k < images.length; k++) {
      const [cx, cy] = g.follow ? cs[k] : fixed;
      const c = document.createElement('canvas'); c.width = OUT; c.height = OUT; const x = c.getContext('2d'); x.imageSmoothingQuality = 'high';
      x.fillStyle = '#fff'; x.fillRect(0, 0, OUT, OUT); x.drawImage(images[k], cx - WIN / 2, cy - WIN / 2, WIN, WIN, 0, 0, OUT, OUT);
      const img = x.getImageData(0, 0, OUT, OUT), d = img.data;
      for (let i = 0; i < OUT * OUT; i++) {
        const r = d[i*4], gg = d[i*4+1], b = d[i*4+2]; const low = Math.min(r, gg, b); let a = (255 - low) / 255; a = a < 0.07 ? 0 : Math.min(1, a * 1.12);
        if (a > 0) { const aa = Math.max(a, 0.02); d[i*4] = Math.max(0, Math.min(255, (r - (1 - aa) * 255) / aa)); d[i*4+1] = Math.max(0, Math.min(255, (gg - (1 - aa) * 255) / aa)); d[i*4+2] = Math.max(0, Math.min(255, (b - (1 - aa) * 255) / aa)); }
        const px = i % OUT, py = (i / OUT) | 0; const e = Math.min(px, OUT - 1 - px, py, OUT - 1 - py), F = 30; d[i*4+3] = Math.round(255 * a * (e < F ? (e / F) * (e / F) * (3 - 2 * e / F) : 1));
      }
      x.putImageData(img, 0, 0);
      const blob = await new Promise((r) => c.toBlob(r, 'image/webp', 0.88)); await fetch('/save?name=vuelo_' + name + '_' + (k + 1) + '.webp', { method: 'POST', body: blob });
    }
  }
  await fetch('/done', { method: 'POST', body: 'ok' });
})().catch((e) => fetch('/done', { method: 'POST', body: 'ERR ' + e.message }));
</script></body></html>`;
const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/_v.html') { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(page); return; }
  if (req.method === 'GET' && req.url.startsWith('/f/')) { fs.readFile(path.join(folder, decodeURIComponent(req.url.slice(3))), (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': 'image/png' }); res.end(d); }); return; }
  const ch = []; req.on('data', (c) => ch.push(c)); req.on('end', () => { const body = Buffer.concat(ch); const url = new URL(req.url, 'http://x');
    if (url.pathname === '/save') fs.writeFileSync(path.join(root, 'assets/sprites/rexvane', url.searchParams.get('name')), body); res.end('ok');
    if (url.pathname === '/done') { const m = body.toString(); console.log(m.startsWith('ERR') ? 'Falló: ' + m : 'Listo'); finish(m.startsWith('ERR') ? 1 : 0); } });
});
let b = null; function finish(c) { try { if (b) execSync('taskkill /F /T /PID ' + b.pid, { stdio: 'ignore' }); } catch (e) { /* ya cerrado */ } server.close(); process.exit(c); }
server.listen(PORT, () => { b = spawn(EDGE, ['--headless=new', '--disable-gpu', '--user-data-dir=' + path.join(require('os').tmpdir(), 'edge_rexv'), `http://localhost:${PORT}/_v.html`], { stdio: 'ignore' }); setTimeout(() => { console.log('Tiempo agotado'); finish(1); }, 240000); });
