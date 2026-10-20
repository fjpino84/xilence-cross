// Prepara las imágenes de "Nuevo Level 2" para el juego (usa Edge sin interfaz, sin dependencias):
//   node tools/make_scenes.js scenes   → assets/backgrounds/nivel1/escena-1..12.webp (cielo blanco pasado a transparente) y fondo.webp
//   node tools/make_scenes.js sheets   → recorta las hojas de objetos y de primeros planos en piezas sueltas (assets/sprites/nivel1/…)
// Las escenas se reducen a 1376×768 (como las anteriores) y el cielo blanco se vuelve transparente para que se vea el fondo lejano.
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn, execSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const SRC = 'src/levels/level 2/Nuevo Level 2/';
const PORT = 8791;
const mode = process.argv[2] || 'scenes';

const SCENES = [
  'escena 1.jpg', 'Escena 2 (2).jpg', 'escena 3.jpg', 'escena 4.jpg', 'escena 5.jpg', 'escena 6.jpg',
  'escena 7 Rex Vane.jpg', 'Escena 8.jpg', 'Escena 9.jpg', 'Escena 10.jpg', 'Escena 11.jpg', 'Escena 12 batuk.jpg',
];
// Hojas: [archivo, prefijo, grupo]. Las piezas se numeran de izquierda a derecha y de arriba abajo.
const SHEETS = [
  ['Objetos en el escenario 1.jpg', 'obj1', 'obj'], ['Objetos en el escenario 2.jpg', 'obj2', 'obj'],
  ['Objetos en el escenario 3.jpg', 'obj3', 'obj'], ['Objetos en el escenario 4.jpg', 'obj4', 'obj'],
  ['Primer Plano 1 Inferior.jpg', 'fgA', 'fg'], ['Primer Plano 1 Superior.jpg', 'fgT', 'fg'],
  ['Primer Plano 2 Inferior.jpg', 'fgS', 'fg'], ['Primer plano 3 Inferior.jpg', 'fgR', 'fg'],
];

const page = `<html><body><script>
const MODE = ${JSON.stringify(mode)}, SRC = ${JSON.stringify(SRC)}, SCENES = ${JSON.stringify(SCENES)}, SHEETS = ${JSON.stringify(SHEETS)};
const load = (file) => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error('no cargó ' + file));
  image.src = '/' + SRC.split('/').map(encodeURIComponent).join('/') + encodeURIComponent(file);
});
const save = async (name, canvas, quality) => {
  const type = name.endsWith('.webp') ? 'image/webp' : 'image/png';
  const blob = await new Promise((r) => canvas.toBlob(r, type, quality));
  await fetch('/save?name=' + encodeURIComponent(name), { method: 'POST', body: blob });
};
const canvasOf = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

// Etiqueta los píxeles "blancos" (fondo de papel) en componentes conexos de 4 vecinos
function whiteMask(d, w, h, limit) {
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2];
    if (Math.min(r, g, b) >= limit && Math.max(r, g, b) - Math.min(r, g, b) <= 22) mask[i] = 1;
  }
  return mask;
}
function components(mask, w, h) {
  const label = new Int32Array(w * h), infos = [];
  const stack = new Int32Array(w * h);
  for (let start = 0; start < w * h; start++) {
    if (!mask[start] || label[start]) continue;
    const id = infos.length + 1;
    let top = 0, area = 0, touchTop = false, touchEdge = false, minX = w, maxX = 0, minY = h, maxY = 0;
    stack[top++] = start; label[start] = id;
    while (top) {
      const p = stack[--top], x = p % w, y = (p / w) | 0;
      area++;
      if (y === 0) touchTop = true;
      if (x === 0 || x === w - 1 || y === h - 1) touchEdge = true;
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
      if (x > 0 && mask[p - 1] && !label[p - 1]) { label[p - 1] = id; stack[top++] = p - 1; }
      if (x < w - 1 && mask[p + 1] && !label[p + 1]) { label[p + 1] = id; stack[top++] = p + 1; }
      if (y > 0 && mask[p - w] && !label[p - w]) { label[p - w] = id; stack[top++] = p - w; }
      if (y < h - 1 && mask[p + w] && !label[p + w]) { label[p + w] = id; stack[top++] = p + w; }
    }
    infos.push({ id, area, touchTop, touchEdge, minX, maxX, minY, maxY });
  }
  return { label, infos };
}

// Dilata una máscara (radio r) con una pasada horizontal y otra vertical
function dilate(ink, w, h, radius) {
  const tmp = new Uint8Array(w * h), dil = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) { let last = -1e9; for (let xx = 0; xx < w; xx++) { if (ink[y * w + xx]) last = xx; if (xx - last <= radius) tmp[y * w + xx] = 1; } last = 1e9; for (let xx = w - 1; xx >= 0; xx--) { if (ink[y * w + xx]) last = xx; if (last - xx <= radius) tmp[y * w + xx] = 1; } }
  for (let xx = 0; xx < w; xx++) { let last = -1e9; for (let y = 0; y < h; y++) { if (tmp[y * w + xx]) last = y; if (y - last <= radius) dil[y * w + xx] = 1; } last = 1e9; for (let y = h - 1; y >= 0; y--) { if (tmp[y * w + xx]) last = y; if (last - y <= radius) dil[y * w + xx] = 1; } }
  return dil;
}
// Deja solo el objeto principal: borra los fragmentos de objetos vecinos que quedaron dentro del recorte (llantas cortadas, cables sueltos…)
function keepMain(image, radius) {
  const { width: w, height: h, data } = image;
  const ink = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) ink[i] = data[i * 4 + 3] > 40 ? 1 : 0;
  const { label, infos } = components(dilate(ink, w, h, radius), w, h);
  if (!infos.length) return image;
  const main = infos.reduce((best, info) => (info.area > best.area ? info : best)).id;
  for (let i = 0; i < w * h; i++) if (label[i] !== main) data[i * 4 + 3] = 0;
  return image;
}

// Quita el fondo blanco de una imagen (ImageData) dejando el borde con transparencia progresiva y sin halo claro.
// keep(info) decide qué componentes blancos se eliminan.
function keyWhite(image, remove) {
  const { width: w, height: h, data: d } = image;
  const mask = whiteMask(d, w, h, 238);
  const { label, infos } = components(mask, w, h);
  const gone = new Uint8Array(w * h);
  const drop = new Set(infos.filter(remove).map((i) => i.id));
  for (let i = 0; i < w * h; i++) if (label[i] && drop.has(label[i])) gone[i] = 1;
  // distancia a la zona eliminada (hasta 3 px) para suavizar el borde
  const dist = new Uint8Array(w * h).fill(9);
  let frontier = [];
  for (let i = 0; i < w * h; i++) if (gone[i]) { dist[i] = 0; frontier.push(i); }
  for (let step = 1; step <= 3; step++) {
    const next = [];
    for (const p of frontier) {
      const x = p % w, y = (p / w) | 0;
      for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]) {
        if (q >= 0 && dist[q] > step) { dist[q] = step; next.push(q); }
      }
    }
    frontier = next;
  }
  const out = new Uint8ClampedArray(d);
  for (let i = 0; i < w * h; i++) {
    if (gone[i]) { out[i * 4 + 3] = 0; continue; }
    if (dist[i] > 3) continue;
    // píxel de borde: mezcla con el blanco eliminado → se recupera el color del primer plano y su opacidad
    const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2];
    const lowest = Math.min(r, g, b);
    // el color del contorno cercano (el píxel más oscuro de los alrededores) fija cuánto blanco hay mezclado
    let fg = lowest;
    const x = i % w, y = (i / w) | 0;
    for (let oy = -3; oy <= 3; oy++) for (let ox = -3; ox <= 3; ox++) {
      const xx = x + ox, yy = y + oy;
      if (xx < 0 || yy < 0 || xx >= w || yy >= h || gone[yy * w + xx]) continue;
      const q = (yy * w + xx) * 4;
      fg = Math.min(fg, Math.min(d[q], d[q + 1], d[q + 2]));
    }
    fg = Math.min(fg, 110);
    const alpha = Math.max(0, Math.min(1, (255 - lowest) / Math.max(40, 255 - fg)));
    if (alpha >= 0.98) continue;
    const a = Math.max(alpha, 0.001);
    out[i * 4] = Math.max(0, Math.min(255, (r - (1 - a) * 255) / a));
    out[i * 4 + 1] = Math.max(0, Math.min(255, (g - (1 - a) * 255) / a));
    out[i * 4 + 2] = Math.max(0, Math.min(255, (b - (1 - a) * 255) / a));
    out[i * 4 + 3] = Math.round(255 * Math.min(1, alpha * 1.15));
  }
  return new ImageData(out, w, h);
}

(async () => {
  const log = [];
  if (MODE === 'scenes') {
    const W = 1376, H = 768;
    for (let i = 0; i < SCENES.length; i++) {
      const image = await load(SCENES[i]);
      const c = canvasOf(W, H), x = c.getContext('2d');
      x.imageSmoothingQuality = 'high';
      x.drawImage(image, 0, 0, W, H);
      const keyed = keyWhite(x.getImageData(0, 0, W, H), (info) => info.touchTop || info.area >= 45);
      x.putImageData(keyed, 0, 0);
      await save('nivel1/escena-' + (i + 1) + '.webp', c, 0.86);
      log.push('escena ' + (i + 1));
    }
    const sky = await load('Fonfo.jpg');
    const c = canvasOf(1376, 768), x = c.getContext('2d');
    x.imageSmoothingQuality = 'high';
    x.drawImage(sky, 0, 0, 1376, 768);
    await save('nivel1/fondo.webp', c, 0.85);
    log.push('fondo');
  } else {
    // Hojas: se separan los dibujos por componentes de píxeles no blancos (con dilatación para unir las partes de cada objeto)
    const manifest = {};
    for (const [file, prefix, group] of SHEETS) {
      const image = await load(file);
      const w = image.naturalWidth, h = image.naturalHeight;
      const c = canvasOf(w, h), x = c.getContext('2d');
      x.drawImage(image, 0, 0);
      const data = x.getImageData(0, 0, w, h);
      const white = whiteMask(data.data, w, h, 236);
      // máscara de tinta dilatada (radio r) con una pasada horizontal y otra vertical
      const radius = group === 'fg' ? 16 : 11;
      const ink = new Uint8Array(w * h);
      for (let i = 0; i < w * h; i++) ink[i] = white[i] ? 0 : 1;
      const tmp = new Uint8Array(w * h), dil = new Uint8Array(w * h);
      for (let y = 0; y < h; y++) { let last = -1e9; for (let xx = 0; xx < w; xx++) { if (ink[y * w + xx]) last = xx; if (xx - last <= radius) tmp[y * w + xx] = 1; } last = 1e9; for (let xx = w - 1; xx >= 0; xx--) { if (ink[y * w + xx]) last = xx; if (last - xx <= radius) tmp[y * w + xx] = 1; } }
      for (let xx = 0; xx < w; xx++) { let last = -1e9; for (let y = 0; y < h; y++) { if (tmp[y * w + xx]) last = y; if (y - last <= radius) dil[y * w + xx] = 1; } last = 1e9; for (let y = h - 1; y >= 0; y--) { if (tmp[y * w + xx]) last = y; if (last - y <= radius) dil[y * w + xx] = 1; } }
      const { infos } = components(dil, w, h);
      const minArea = group === 'fg' ? 60000 : 9000;
      const found = infos.filter((i) => i.area >= minArea && i.maxX - i.minX > 60 && i.maxY - i.minY > 60);
      found.sort((a, b) => (Math.round(a.minY / 260) - Math.round(b.minY / 260)) || (a.minX - b.minX));
      manifest[prefix] = [];
      let n = 0;
      for (const info of found) {
        const pad = 6;
        const sx = Math.max(0, info.minX - pad), sy = Math.max(0, info.minY - pad);
        const sw = Math.min(w, info.maxX + pad) - sx, sh = Math.min(h, info.maxY + pad) - sy;
        const piece = x.getImageData(sx, sy, sw, sh);
        const keyed = keepMain(keyWhite(piece, (i) => i.touchTop || i.touchEdge || i.area >= 150), group === 'fg' ? 22 : 14);
        const scale = Math.min(1, (group === 'fg' ? 900 : 420) / Math.max(sw, sh));
        const tw = Math.max(8, Math.round(sw * scale)), th = Math.max(8, Math.round(sh * scale));
        const full = canvasOf(sw, sh); full.getContext('2d').putImageData(keyed, 0, 0);
        const small = canvasOf(tw, th), sc = small.getContext('2d');
        sc.imageSmoothingQuality = 'high';
        sc.drawImage(full, 0, 0, tw, th);
        n++;
        const name = prefix + '_' + n;
        await save('../sprites/nivel1/' + name + '.png', small);
        manifest[prefix].push({ name, w: tw, h: th, sheetBox: [sx, sy, sw, sh] });
      }
      log.push(prefix + ': ' + n);
    }
    await fetch('/manifest', { method: 'POST', body: JSON.stringify(manifest, null, 1) });
  }
  await fetch('/done', { method: 'POST', body: log.join(', ') });
})().catch((e) => fetch('/done', { method: 'POST', body: 'ERR ' + e.message + ' ' + (e.stack || '') }));
</script></body></html>`;

// ---------------------------------------------------------------- servidor mínimo
const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/_scenes.html') { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(page); return; }
  if (req.method === 'GET') {
    const file = path.join(root, decodeURIComponent(req.url.split('?')[0]));
    fs.readFile(file, (error, data) => {
      if (error) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': file.endsWith('.jpg') ? 'image/jpeg' : 'application/octet-stream' });
      res.end(data);
    });
    return;
  }
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const body = Buffer.concat(chunks);
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/save') {
      const name = url.searchParams.get('name');
      const target = name.startsWith('../')
        ? path.join(root, 'assets', name.slice(3))
        : path.join(root, 'assets/backgrounds', name);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, body);
    }
    if (url.pathname === '/manifest') fs.writeFileSync(path.join(root, 'assets/sprites/nivel1/_piezas.json'), body);
    res.end('ok');
    if (url.pathname === '/done') {
      const message = body.toString();
      console.log(message.startsWith('ERR') ? 'Falló: ' + message : 'Listo: ' + message);
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
  browser = spawn(EDGE, ['--headless=new', '--disable-gpu', '--user-data-dir=' + path.join(require('os').tmpdir(), 'edge_make_scenes'), `http://localhost:${PORT}/_scenes.html`], { stdio: 'ignore' });
  setTimeout(() => { console.log('Tiempo agotado'); finish(1); }, 300000);
});
