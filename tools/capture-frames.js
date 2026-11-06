// Plays the walkthrough in headless Chrome and saves a screenshot every N ms.
// Usage: node tools/capture-frames.js <chrome.exe> <url> <outDir> <profileDir> [intervalMs] [totalMs] [startChapter]
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const [chrome, url, outDir, profile, intervalArg, totalArg, chapterArg] = process.argv.slice(2);
const interval = +(intervalArg || 3000), total = +(totalArg || 160000);
const PORT = 9334;
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const proc = spawn(chrome, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--window-size=1280,1000', '--autoplay-policy=no-user-gesture-required', 'about:blank'], { stdio: 'ignore' });
  let targets;
  for (let i = 0; i < 150; i++) {
    try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); if (targets.some(t => t.type === 'page')) break; } catch (e) {}
    await wait(200);
  }
  const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  let id = 0; const pending = {};
  ws.onmessage = m => {
    const d = JSON.parse(m.data);
    if (pending[d.id]) { pending[d.id](d); delete pending[d.id]; }
    if (d.method === 'Runtime.exceptionThrown') console.log('EXCEPTION', d.params.exceptionDetails.exception?.description);
    if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') console.log('CONSOLE', JSON.stringify(d.params.args.map(a => a.value || a.description)));
  };
  const send = (method, params = {}) => new Promise(r => { pending[++id] = r; ws.send(JSON.stringify({ id, method, params })); });
  await send('Runtime.enable');
  const W = +(process.env.WIDTH || 1280), H = W < 700 ? 800 : 860;
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: W < 700 });
  await send('Page.navigate', { url });
  await wait(2500);
  const ev = async e => (await send('Runtime.evaluate', { expression: e, returnByValue: true })).result.result?.value;
  if (chapterArg) await ev(`document.querySelectorAll('.w-seg')[${+chapterArg}].click()`);
  else await ev(`document.querySelector('.w-bigplay').click()`);
  const t0 = Date.now();
  let n = 0;
  while (Date.now() - t0 < total) {
    const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 70, clip: { x: 0, y: 0, width: W, height: H, scale: +(process.env.SCALE || 0.6) } });
    const cap = await ev(`document.querySelector('.w-caption').textContent.slice(0,60) + ' | ' + document.querySelector('.w-now').textContent`);
    const name = `f${String(n++).padStart(3, '0')}_${Math.round((Date.now() - t0) / 1000)}s.jpg`;
    fs.writeFileSync(path.join(outDir, name), Buffer.from(shot.result.data, 'base64'));
    console.log(name, cap);
    if (await ev(`!document.querySelector('.w-start').classList.contains('hide')`) && Date.now() - t0 > 5000) { console.log('finished'); break; }
    await wait(interval);
  }
  ws.close(); proc.kill();
})().catch(e => { console.error(e); process.exit(1); });
