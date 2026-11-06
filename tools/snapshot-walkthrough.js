// Takes screenshots of a walkthrough for checking its layout: plays it in headless Chrome at 2x speed
// and saves one image per narration line, taken just before the next line starts (so it shows the
// result of that line's animation), plus a mid-line image with --mid.
//
//   node tools/snapshot-walkthrough.js walkthroughs/landing-pages
//   node tools/snapshot-walkthrough.js walkthroughs/landing-pages style      only the chapter with id 'style'
//   node tools/snapshot-walkthrough.js walkthroughs/landing-pages --mid      also a mid-line image
//
// Images go to raw/snapshots/<name>/ (emptied first), named <line id>.jpg. It prints each file with
// its caption; open the images to check for overlaps, cut-off elements and empty screens.
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { loadWalkthrough, linesOf } = require('./lib/load-walkthrough');
const { launch, wait } = require('./lib/headless');

const args = process.argv.slice(2);
const dir = args.find(a => !a.startsWith('--'));
const chapterId = args.filter(a => !a.startsWith('--'))[1] || null;
const mid = args.includes('--mid');

(async () => {
  if (!dir) { console.log('Usage: node tools/snapshot-walkthrough.js walkthroughs/<name> [chapter id] [--mid]'); process.exitCode = 2; return; }
  const def = loadWalkthrough(dir);
  if (!def) throw new Error('walkthrough.js does not call KZWalkthrough.create()');
  const chapterIndex = chapterId ? def.chapters.findIndex(c => c.id === chapterId) : 0;
  if (chapterIndex < 0) throw new Error(`No chapter '${chapterId}'. Chapters: ${def.chapters.map(c => c.id).join(', ')}`);
  const lines = linesOf(def);
  const idOf = text => (lines.find(l => l.text === text) || {}).id;

  const name = path.basename(path.resolve(dir));
  const out = path.join(__dirname, '..', 'raw', 'snapshots', name);
  fs.mkdirSync(out, { recursive: true });
  for (const f of fs.readdirSync(out)) if (f.endsWith('.jpg')) fs.unlinkSync(path.join(out, f));

  const errors = [];
  const page = await launch({
    width: 1280, height: 900,
    init: "try { localStorage.setItem('w-speed', '2'); } catch (e) {}",
    onEvent(method, d) {
      if (method === 'Runtime.exceptionThrown') errors.push((d.exceptionDetails.exception?.description || d.exceptionDetails.text).split('\n')[0]);
      if (method === 'Runtime.consoleAPICalled' && d.type === 'error') errors.push(d.args.map(a => a.value ?? a.description).join(' ').split('\n')[0]);
    }
  });
  const { ev, send } = page;
  const saved = [];
  try {
    await page.navigate(pathToFileURL(path.resolve(dir, 'index.html')).href + '?captions=on');
    for (let i = 0; i < 50 && !(await ev("!!document.querySelector('.w-seg')")); i++) await wait(200);
    const rect = await ev("(() => { const r = document.querySelector('.w-viewport').getBoundingClientRect(); const c = document.querySelector('.w-caption').getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: c.bottom - r.top }; })()");
    const shot = async () => (await send('Page.captureScreenshot', { format: 'jpeg', quality: 72, clip: { ...rect, scale: 0.75 } })).result.data;
    await ev(`document.querySelectorAll('.w-seg')[${chapterIndex}].click()`);

    // Keep the latest frame for the current line; save it when the line changes.
    let caption = null, latest = null, lineStart = 0, midSaved = false;
    const stopAt = chapterId ? def.chapters[chapterIndex].title : null;
    const save = (id, data, suffix = '') => {
      if (!id || !data) return;
      const file = `${String(saved.length + 1).padStart(2, '0')}-${id}${suffix}.jpg`;
      fs.writeFileSync(path.join(out, file), Buffer.from(data, 'base64'));
      saved.push({ file, caption: (lines.find(l => l.id === id) || {}).text || '' });
    };
    const limit = Date.now() + 10 * 60 * 1000;
    while (Date.now() < limit) {
      const st = await ev("({ cap: document.querySelector('.w-caption').textContent, now: document.querySelector('.w-now').textContent, done: !document.querySelector('.w-start').classList.contains('hide') })");
      if (st.cap !== caption) {
        if (caption && idOf(caption)) save(idOf(caption), latest);
        caption = st.cap; lineStart = Date.now(); midSaved = false; latest = null;
        if (stopAt && !st.now.endsWith(stopAt)) break;
      }
      if (st.done) break;
      const frame = await shot();
      if (mid && !midSaved && Date.now() - lineStart > 900 && idOf(caption)) { save(idOf(caption), frame, '-mid'); midSaved = true; }
      latest = frame;
      await wait(150);
    }
    if (caption && idOf(caption) && latest && !saved.some(s => s.file.includes(idOf(caption) + '.'))) save(idOf(caption), latest);
  } finally {
    await page.close();
  }

  const shown = path.relative(path.join(__dirname, '..'), out).split(path.sep).join('/');
  console.log(`${saved.length} images in ${shown}/`);
  saved.forEach(s => console.log(`  ${s.file}  ${s.caption.slice(0, 90)}`));
  [...new Set(errors)].forEach(e => console.log('ERROR ' + e));
  if (errors.length) process.exitCode = 1;
})().catch(e => { console.error(e.message); process.exitCode = 1; });
