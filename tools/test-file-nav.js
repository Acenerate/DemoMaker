// Checks in-place navigation when the site is opened from disk (file://) in headless Chrome.
// Usage: node tools/test-file-nav.js <chrome.exe> <site dir> <profile dir>
const { spawn } = require('child_process');
const path = require('path');
const { pathToFileURL } = require('url');

const [chrome, siteDir, profile] = process.argv.slice(2);
const PORT = 9333;
const start = pathToFileURL(path.resolve(siteDir, 'en/getting-started/introduction/index.html')).href;
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const running = await fetch(`http://127.0.0.1:${PORT}/json/version`).then(() => true, () => false);
  const proc = running ? null : spawn(chrome, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--window-size=1280,900', start], { stdio: 'ignore' });
  let targets;
  for (let i = 0; i < 150; i++) {
    try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); if (targets.some(t => t.type === 'page')) break; } catch (e) {}
    await wait(200);
  }
  const page = targets.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  let id = 0; const pending = {};
  ws.onmessage = m => { const d = JSON.parse(m.data); if (pending[d.id]) { pending[d.id](d); delete pending[d.id]; } };
  const send = (method, params = {}) => new Promise(r => { pending[++id] = r; ws.send(JSON.stringify({ id, method, params })); });
  const ev = async expr => {
    const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || 'eval error');
    return r.result.result.value;
  };
  const state = `({reloaded: window.__marker !== 1, address: location.search + location.hash, file: location.pathname.split('/site/')[1],
    h1: document.querySelector('#sd_content h1')?.textContent,
    images: [...document.querySelectorAll('#sd_content img')].filter(i => i.complete && i.naturalWidth > 0).length + '/' + document.querySelectorAll('#sd_content img').length, hidden: document.documentElement.classList.contains('sd-routing'),
    active: [...document.querySelectorAll('#sd_menu a.active')].map(a => a.textContent.trim())})`;
  const click = text => ev(`[...document.querySelectorAll('#sd_menu a')].find(a => a.textContent.toLowerCase().includes(${JSON.stringify(text)})).click()`);

  await send('Page.navigate', { url: start });
  await wait(2000);
  await ev('window.__marker = 1');
  const log = (label, s) => console.log(label.padEnd(26), JSON.stringify(s));

  log('start', await ev(state));
  await click('landing pages'); await wait(600); log('menu: Landing Pages', await ev(state));
  await click('confirmation'); await wait(600); log('menu: Confirmation', await ev(state));
  await ev(`[...document.querySelectorAll('#sd_content a[target=_self]')].concat([...document.querySelectorAll('#sd_menu a')]).find(a => a.textContent.toLowerCase().includes('triggers')).click()`);
  await wait(600); log('menu: Triggers', await ev(state));
  await ev('history.back()'); await wait(600); log('back', await ev(state));
  await ev('history.back()'); await wait(600); log('back', await ev(state));
  await ev('history.forward()'); await wait(600); log('forward', await ev(state));
  await ev(`(() => { const i = document.querySelector('#sd_search_button'); i.click(); })()`); await wait(400);
  await ev(`(() => { const s = document.getElementById('sd_search'); s.value = 'csat'; s.dispatchEvent(new Event('input')); })()`); await wait(600);
  await ev(`document.querySelector('.sd-search-results a').click()`); await wait(600); log('search result', await ev(state));

  // Reload: the ?p= address must reopen the same page.
  await send('Page.reload'); await wait(2000);
  log('after reload', await ev(state));
  await ev('window.__marker = 1');
  await click('billing'); await wait(600); log('menu after reload', await ev(state));

  ws.close(); if (proc) proc.kill();
})().catch(e => { console.error(e); process.exit(1); });
