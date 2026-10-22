// Saca los cuadros de un GIF con Edge (WebCodecs ImageDecoder) y los guarda como PNG: node tools/gif_frames.js <gif> <carpeta de salida>
const fs = require('fs'); const path = require('path'); const http = require('http'); const { spawn, execSync } = require('child_process');
const gif = path.resolve(process.argv[2] || ''); const out = path.resolve(process.argv[3] || '');
if (!process.argv[3] || !fs.existsSync(gif)) { console.log('Uso: node tools/gif_frames.js <gif> <salida>'); process.exit(1); }
fs.mkdirSync(out, { recursive: true });
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'; const PORT = 8795;
const page = `<html><body><script>
(async () => {
  const data = await (await fetch('/gif')).arrayBuffer();
  const dec = new ImageDecoder({ data, type: 'image/gif' });
  await dec.tracks.ready; const n = dec.tracks.selectedTrack.frameCount; const info = [];
  for (let i = 0; i < n; i++) {
    const { image } = await dec.decode({ frameIndex: i });
    const c = document.createElement('canvas'); c.width = image.displayWidth; c.height = image.displayHeight; c.getContext('2d').drawImage(image, 0, 0);
    info.push({ i: i + 1, w: c.width, h: c.height, ms: Math.round((image.duration || 0) / 1000) });
    const blob = await new Promise((r) => c.toBlob(r, 'image/png')); await fetch('/save?name=g_' + String(i + 1).padStart(3, '0') + '.png', { method: 'POST', body: blob }); image.close();
  }
  await fetch('/done', { method: 'POST', body: JSON.stringify(info) });
})().catch((e) => fetch('/done', { method: 'POST', body: 'ERR ' + e.message }));
</script></body></html>`;
const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/_g.html') { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(page); return; }
  if (req.method === 'GET' && req.url === '/gif') { res.writeHead(200, { 'Content-Type': 'image/gif' }); res.end(fs.readFileSync(gif)); return; }
  const ch = []; req.on('data', (c) => ch.push(c)); req.on('end', () => { const body = Buffer.concat(ch); const url = new URL(req.url, 'http://x');
    if (url.pathname === '/save') fs.writeFileSync(path.join(out, url.searchParams.get('name')), body); res.end('ok');
    if (url.pathname === '/done') { const m = body.toString(); console.log(m.startsWith('ERR') ? 'Falló: ' + m : m.slice(0, 600)); fs.writeFileSync(path.join(out, '_info.json'), m); finish(m.startsWith('ERR') ? 1 : 0); } });
});
let b = null; function finish(c) { try { if (b) execSync('taskkill /F /T /PID ' + b.pid, { stdio: 'ignore' }); } catch (e) { /* ya cerrado */ } server.close(); process.exit(c); }
server.listen(PORT, () => { b = spawn(EDGE, ['--headless=new', '--disable-gpu', '--user-data-dir=' + path.join(require('os').tmpdir(), 'edge_gif'), `http://localhost:${PORT}/_g.html`], { stdio: 'ignore' }); setTimeout(() => { console.log('Tiempo agotado'); finish(1); }, 120000); });
