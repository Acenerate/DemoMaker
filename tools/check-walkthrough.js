// Checks a walkthrough: loads its script, then plays it start to finish in headless Chrome at 2x speed
// and reports every error (exceptions, missing elements, console errors). Exit code 0 = passed.
//
//   node tools/check-walkthrough.js walkthroughs/landing-pages
//
// Uses Chrome (or Edge) from its usual install location; set CHROME_PATH to use another browser.
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { loadWalkthrough, linesOf } = require('./lib/load-walkthrough');
const { launch, wait } = require('./lib/headless');

const dir = process.argv[2];

(async () => {
  if (!dir) { console.log('Usage: node tools/check-walkthrough.js walkthroughs/<name>'); process.exitCode = 2; return; }
  const problems = [], notes = [];

  // 1. The script itself.
  let def;
  try { def = loadWalkthrough(dir); } catch (e) { console.log(`FAIL  walkthrough.js does not load: ${e.message}`); process.exitCode = 1; return; }
  if (!def) { console.log('FAIL  walkthrough.js does not call KZWalkthrough.create()'); process.exitCode = 1; return; }
  const ids = new Set();
  def.chapters.forEach((c, i) => {
    if (!c.id) problems.push(`chapter ${i + 1} has no id`);
    else if (ids.has(c.id)) problems.push(`two chapters share the id '${c.id}'`);
    ids.add(c.id);
    if (!c.lines || !c.lines.length) problems.push(`chapter '${c.id}' has no lines`);
    if (typeof c.run !== 'function') problems.push(`chapter '${c.id}' has no run(h)`);
    const beats = (String(c.run).match(/h\.beat\(\s*(\d+)/g) || []).map(b => +b.match(/\d+/)[0]);
    const missing = (c.lines || []).map((_, j) => j).filter(j => !beats.includes(j));
    if (beats.length && missing.length) problems.push(`chapter '${c.id}': no h.beat() for line${missing.length > 1 ? 's' : ''} ${missing.map(j => j + 1).join(', ')}`);
    const extra = beats.filter(b => b >= (c.lines || []).length);
    if (extra.length) problems.push(`chapter '${c.id}': h.beat(${extra[0]}) but only ${(c.lines || []).length} lines`);
  });
  const lines = linesOf(def), words = lines.reduce((n, l) => n + l.text.split(/\s+/).length, 0);
  console.log(`${def.title}: ${def.chapters.length} chapters, ${lines.length} lines, ${words} words (~${Math.round(words / 2.6 / (def.tempo || 1))}s of narration)`);
  if (!fs.existsSync(path.join(dir, 'index.html'))) problems.push('index.html is missing');
  if (problems.length) { problems.forEach(p => console.log('FAIL  ' + p)); process.exitCode = 1; return; }

  // 2. Play it.
  let page;
  try {
    page = await launch({
      init: "try { localStorage.setItem('w-speed', '2'); } catch (e) {}",
      onEvent(method, d) {
        if (method === 'Runtime.exceptionThrown') problems.push('exception: ' + (d.exceptionDetails.exception?.description || d.exceptionDetails.text).split('\n')[0]);
        if (method === 'Runtime.consoleAPICalled') {
          const text = d.args.map(a => a.value ?? a.description).join(' ').split('\n')[0];
          if (d.type === 'error') problems.push('error: ' + text);
          else if (d.type === 'warning') notes.push(text);
        }
        if (method === 'Log.entryAdded' && d.entry.level === 'error' && !/favicon/.test(d.entry.url || '')) problems.push('load error: ' + d.entry.text + (d.entry.url ? ' ' + d.entry.url : ''));
      }
    });
  } catch (e) {
    if (e.code === 'NOBROWSER') { console.log('SKIP  no Chrome or Edge found for the playback check (set CHROME_PATH)'); return; }
    throw e;
  }
  const { ev } = page;
  try {
    await page.navigate(pathToFileURL(path.resolve(dir, 'index.html')).href);
    for (let i = 0; i < 50 && !(await ev("!!document.querySelector('.w-bigplay')")); i++) await wait(200);
    if (!(await ev("!!document.querySelector('.w-bigplay')"))) throw new Error('the player did not start (check index.html loads the framework and walkthrough.js)');
    await ev("document.querySelector('.w-bigplay').click()");

    const budget = Math.max(60000, words / 2.6 / 2 * 1000 * 2.5 + 30000), limit = Date.now() + budget;
    const seen = new Set();
    let finished = false;
    while (Date.now() < limit) {
      await wait(400);
      const now = await ev("document.querySelector('.w-now').textContent");
      if (now) seen.add(now);
      if (await ev("!document.querySelector('.w-start').classList.contains('hide')")) { finished = true; break; }
    }
    if (!finished) problems.push(`did not finish within ${Math.round(budget / 1000)}s; last chapter reached: ${[...seen].pop()}`);
    else if (seen.size < def.chapters.length) notes.push(`only ${seen.size} of ${def.chapters.length} chapters were seen while playing`);
  } catch (e) {
    problems.push(e.message);
  } finally {
    await page.close();
  }

  [...new Set(notes)].forEach(n => console.log('note  ' + n));
  if (problems.length) { [...new Set(problems)].forEach(p => console.log('FAIL  ' + p)); process.exitCode = 1; }
  else console.log('PASS  played start to finish with no errors');
})().catch(e => { console.error(e); process.exitCode = 1; });
