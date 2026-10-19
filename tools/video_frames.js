// Saca los cuadros de un video con Microsoft Edge (sin ffmpeg): abre el video en un navegador sin ventana, va a cada instante y
// guarda el cuadro como PNG. Uso:
//   node tools/video_frames.js <video.mp4> <carpeta de salida> [segundos=5] [cuadros por segundo=24] [inicio=0]
// Los cuadros salen como f_0001.png, f_0002.png... a la resolución original del video.
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const [, , videoArg, outArg, secondsArg = '5', fpsArg = '24', startArg = '0'] = process.argv;
if (!videoArg || !outArg) { console.log('Uso: node tools/video_frames.js <video> <salida> [segundos] [fps] [inicio]'); process.exit(1); }
const video = path.resolve(videoArg);
const out = path.resolve(outArg);
const seconds = Number(secondsArg);
const fps = Number(fpsArg);
const start = Number(startArg);
fs.mkdirSync(out, { recursive: true });

const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const port = 9481 + Math.floor(Math.random() * 50);
const profile = path.join(out, '..', 'profile-video-' + port);
const page = 'file:///' + path.resolve(__dirname, '..', 'index.html').replace(/\\/g, '/').split('/').map(encodeURIComponent).join('/').replace('%3A', ':') + '?skipintro=1';
const proc = spawn(edge, ['--headless=new', '--disable-gpu', '--allow-file-access-from-files', '--autoplay-policy=no-user-gesture-required',
  '--remote-debugging-port=' + port, '--user-data-dir=' + profile, page], { stdio: 'ignore' });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
  let targets;
  for (let i = 0; i < 40; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (targets.length) break; } catch (error) { /* aún arrancando */ } await sleep(500); }
  const target = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve) => (ws.onopen = resolve));
  let id = 0;
  const pending = new Map();
  ws.onmessage = (message) => { const data = JSON.parse(message.data); if (data.id && pending.has(data.id)) { pending.get(data.id)(data); pending.delete(data.id); } };
  const send = (method, params) => new Promise((resolve) => { const n = ++id; pending.set(n, resolve); ws.send(JSON.stringify({ id: n, method, params })); });
  const evaluate = async (expression) => {
    const reply = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (reply.result.exceptionDetails) throw new Error(JSON.stringify(reply.result.exceptionDetails).slice(0, 400));
    return reply.result.result.value;
  };
  await sleep(2500);

  const url = 'file:///' + video.replace(/\\/g, '/').split('/').map(encodeURIComponent).join('/').replace('%3A', ':');
  const info = await evaluate(`(async () => {
    window.__v = document.createElement('video');
    const v = window.__v;
    v.muted = true; v.preload = 'auto'; v.src = ${JSON.stringify(url)};
    await new Promise((resolve, reject) => { v.onloadeddata = resolve; v.onerror = () => reject(new Error('no se pudo cargar el video')); });
    window.__c = document.createElement('canvas'); window.__c.width = v.videoWidth; window.__c.height = v.videoHeight;
    window.__x = window.__c.getContext('2d');
    return JSON.stringify({ w: v.videoWidth, h: v.videoHeight, d: v.duration });
  })()`);
  const meta = JSON.parse(info);
  console.log(`video ${meta.w}x${meta.h}, ${meta.d.toFixed(2)} s; se sacan ${Math.round(seconds * fps)} cuadros (${start}-${start + seconds} s a ${fps} fps)`);

  const count = Math.min(Math.round(seconds * fps), Math.floor((meta.d - start) * fps));
  for (let i = 0; i < count; i++) {
    const time = start + i / fps;
    const data = await evaluate(`(async () => {
      const v = window.__v;
      await new Promise((resolve) => { v.onseeked = resolve; v.currentTime = ${time.toFixed(4)}; });
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      window.__x.drawImage(v, 0, 0);
      return window.__c.toDataURL('image/png').split(',')[1];
    })()`);
    fs.writeFileSync(path.join(out, `f_${String(i + 1).padStart(4, '0')}.png`), Buffer.from(data, 'base64'));
    if ((i + 1) % 24 === 0) console.log(`  ${i + 1}/${count}`);
  }
  console.log('listo');
  ws.close();
  proc.kill();
  process.exit(0);
})().catch((error) => { console.error('ERROR:', error.message); proc.kill(); process.exit(1); });
