// Convierte los PNG de assets/sprites a WebP (con transparencia) usando Edge: node tools/to_webp.js [calidad=0.92]
// Escribe el .webp junto al .png y lo conserva solo si pesa menos; con --borrar elimina los PNG convertidos. Informa del ahorro.
const fs = require('fs'); const path = require('path'); const http = require('http'); const { spawn, execSync } = require('child_process');
const root = path.resolve(__dirname, '..'); const quality = Number(process.argv[2]) || 0.92; const erase = process.argv.includes('--borrar');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'; const PORT = 8799;
const files = []; (function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (p.endsWith('.png')) files.push(path.relative(root, p).split(path.sep).join('/')); } })(path.join(root, 'assets/sprites'));
const page = `<html><body><script>
(async () => { const list = await (await fetch('/list')).json(); let done = 0;
  for (const f of list) { const im = new Image(); await new Promise((r) => { im.onload = r; im.onerror = r; im.src = '/' + f; });
    const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; c.getContext('2d').drawImage(im, 0, 0);
    const blob = await new Promise((r) => c.toBlob(r, 'image/webp', ${quality})); await fetch('/save?name=' + encodeURIComponent(f.slice(0, -4) + '.webp'), { method: 'POST', body: blob }); done++; }
  await fetch('/done', { method: 'POST', body: 'ok ' + done }); })().catch((e) => fetch('/done', { method: 'POST', body: 'ERR ' + e.message }));
</script></body></html>`;
const server = http.createServer((req, res) => {
  if (req.url === '/_w.html') { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(page); return; }
  if (req.url === '/list') { res.end(JSON.stringify(files)); return; }
  if (req.method === 'GET') { fs.readFile(path.join(root, decodeURIComponent(req.url.split('?')[0])), (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': 'image/png' }); res.end(d); }); return; }
  const ch = []; req.on('data', (c) => ch.push(c)); req.on('end', () => { const body = Buffer.concat(ch); const url = new URL(req.url, 'http://x');
    if (url.pathname === '/save') { const target = path.join(root, url.searchParams.get('name')); fs.writeFileSync(target, body); }
    res.end('ok');
    if (url.pathname === '/done') {
      let before = 0, after = 0, kept = 0;
      for (const f of files) { const png = path.join(root, f), webp = png.slice(0, -4) + '.webp'; const a = fs.statSync(png).size, b = fs.existsSync(webp) ? fs.statSync(webp).size : a;
        before += a; if (b < a) { after += b; kept++; if (erase) fs.unlinkSync(png); } else { after += a; if (fs.existsSync(webp)) fs.unlinkSync(webp); } }
      console.log('PNG:', files.length, 'convertidos:', kept, 'antes', (before / 1048576).toFixed(1), 'MB → después', (after / 1048576).toFixed(1), 'MB');
      finish(0); } });
});
let b = null; function finish(c) { try { if (b) execSync('taskkill /F /T /PID ' + b.pid, { stdio: 'ignore' }); } catch (e) { /* ya cerrado */ } server.close(); process.exit(c); }
server.listen(PORT, () => { b = spawn(EDGE, ['--headless=new', '--disable-gpu', '--user-data-dir=' + path.join(require('os').tmpdir(), 'edge_webp'), `http://localhost:${PORT}/_w.html`], { stdio: 'ignore' }); setTimeout(() => { console.log('Tiempo agotado'); finish(1); }, 480000); });
