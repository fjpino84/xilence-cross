// Uso: node tests/intro_browser.js <carpeta-temporal> [end|skip]  (requiere Microsoft Edge; abre el juego de verdad)
// Prueba real del video de inicio en Edge headless: ENTER en el título → video → juego (por fin del video y por salto con ENTER).
const { spawn } = require('child_process');
const sp = process.argv[2];
const mode = process.argv[3] || 'end'; // end | skip
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const port = mode === 'end' ? 9471 : 9473;
const proc = spawn(edge, ['--headless=new', '--disable-gpu', '--allow-file-access-from-files', '--autoplay-policy=no-user-gesture-required', '--remote-debugging-port=' + port,
  '--user-data-dir=' + sp + '/profile-intro' + mode, 'file:///C:/Users/USER/Proyectos/14%20-%20Game%20Eco/index.html'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  let targets;
  for (let i = 0; i < 40; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (targets.length) break; } catch (e) {} await sleep(500); }
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0; const pending = new Map();
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } };
  const send = (method, params) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result.result.value;
  const press = () => ev(`window.dispatchEvent(new KeyboardEvent('keydown',{code:'Enter'})); setTimeout(()=>window.dispatchEvent(new KeyboardEvent('keyup',{code:'Enter'})),40); 1`);
  const state = () => ev(`(()=>{const v=document.querySelector('.intro-video'); return JSON.stringify({scene:game.scenes.current.constructor.name, video: !!v, t: v? +v.currentTime.toFixed(2):null, dur: v? +(v.duration||0).toFixed(2):null, paused: v? v.paused:null, muted: v? v.muted:null, err: v&&v.error? v.error.code:null, w: v? v.videoWidth:null, h: v? v.videoHeight:null, music: game.audio.music? !game.audio.music.paused : false, hint: !!document.querySelector('.intro-skip')});})()`);
  await sleep(3500);
  console.log('título:', await state());
  await press();
  await sleep(2500);
  console.log('tras ENTER (2,5 s):', await state());
  if (mode === 'skip') {
    await sleep(800); await press(); await sleep(1500);
    console.log('tras ENTER para saltar:', await state());
  } else {
    for (let i = 0; i < 20; i++) { await sleep(1000); const s = JSON.parse(await state()); if (s.scene !== 'IntroScene') { console.log(`terminó a los ~${i + 3} s ->`, JSON.stringify(s)); break; } }
    console.log('final:', await state());
  }
  ws.close(); proc.kill(); process.exit(0);
})();
