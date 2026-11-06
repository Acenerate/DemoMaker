// Opens a page in headless Chrome (or Edge) and drives it over the DevTools protocol.
// Used by tools/check-walkthrough.js and tools/snapshot-walkthrough.js.
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const wait = ms => new Promise(r => setTimeout(r, ms));

function findBrowser() {
  const pf = [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean);
  const candidates = [process.env.CHROME_PATH,
    ...pf.map(p => path.join(p, 'Google', 'Chrome', 'Application', 'chrome.exe')),
    ...pf.map(p => path.join(p, 'Microsoft', 'Edge', 'Application', 'msedge.exe')),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'];
  return candidates.find(p => p && fs.existsSync(p)) || null;
}

// Starts the browser at about:blank. onEvent(method, params) receives every protocol event.
// Returns { send, ev, navigate, close }.
async function launch({ width = 1280, height = 900, onEvent = () => {}, init } = {}) {
  const browser = findBrowser();
  if (!browser) throw Object.assign(new Error('no Chrome or Edge found (set CHROME_PATH)'), { code: 'NOBROWSER' });
  const port = 9400 + Math.floor(Math.random() * 500);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'wt-browser-'));
  const proc = spawn(browser, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check',
    '--mute-audio', '--autoplay-policy=no-user-gesture-required', '--allow-file-access-from-files', 'about:blank'], { stdio: 'ignore' });
  let targets;
  for (let i = 0; i < 100; i++) {
    try { targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); if (targets.some(t => t.type === 'page')) break; } catch (e) { /* starting */ }
    await wait(200);
  }
  if (!targets) { proc.kill(); throw new Error('the browser did not start'); }
  const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const pending = {};
  ws.onmessage = m => {
    const d = JSON.parse(m.data);
    if (pending[d.id]) { pending[d.id](d); delete pending[d.id]; }
    if (d.method) onEvent(d.method, d.params);
  };
  const send = (method, params = {}) => new Promise(r => { pending[++id] = r; ws.send(JSON.stringify({ id, method, params })); });
  const ev = async e => (await send('Runtime.evaluate', { expression: e, returnByValue: true })).result.result?.value;
  await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  if (init) await send('Page.addScriptToEvaluateOnNewDocument', { source: init });
  return {
    send, ev,
    navigate: url => send('Page.navigate', { url }),
    async close() {
      try { ws.close(); } catch (e) { /* closed */ }
      proc.kill();
      await wait(500);
      try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) { /* Chrome may still hold it */ }
    }
  };
}

module.exports = { launch, findBrowser, wait };
