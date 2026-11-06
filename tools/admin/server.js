// Walkthrough admin: a local web app for editing narration, generating the voiceover, previewing, and
// managing walkthroughs and the gallery.
//
//   node tools/admin/server.js            opens http://localhost:8800/ in your browser
//   node tools/admin/server.js 8801       another port
//   node tools/admin/server.js --no-open  don't open a browser
//
// It only listens on this computer (127.0.0.1), and only accepts changes from its own page.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec, execFile } = require('child_process');
const { loadWalkthroughSource } = require('../lib/load-walkthrough');
const { plan, generate, apiKey, sharedVoice, previewVoice, SHARED_VOICE } = require('../lib/voiceover');
const { exportTranscript } = require('../lib/transcript');
const { editLine, editSettings } = require('../lib/edit-walkthrough');
const { setLine, setSetting } = require('../lib/source-edit');
const { writeFile, removeDir, unlink } = require('../lib/fs-retry');
const { createRunner } = require('./claude');
const { listPages } = require('../lib/docs');
const { exportVideo, findFfmpeg, EXPORTS } = require('../lib/export-video');
const { zipFolders } = require('../lib/make-zip');

// The walkthrough's last video export, if any, and whether the walkthrough has changed since.
function exportInfo(name) {
  const mp4 = path.join(EXPORTS, `${name}.mp4`);
  if (!fs.existsSync(mp4)) return null;
  const st = fs.statSync(mp4), dir = path.join(WT, name);
  const sources = ['walkthrough.js', 'voice.json', path.join('vo', 'manifest.json')].map(f => path.join(dir, f)).filter(f => fs.existsSync(f));
  const changed = sources.some(f => fs.statSync(f).mtimeMs > st.mtimeMs + 1000);
  const yt = path.join(EXPORTS, `${name}.youtube.txt`), srt = path.join(EXPORTS, `${name}.srt`);
  return {
    url: `/exports/${name}.mp4?v=${Math.round(st.mtimeMs)}`, bytes: st.size, at: st.mtimeMs, changed,
    srtUrl: fs.existsSync(srt) ? `/exports/${name}.srt?v=${Math.round(st.mtimeMs)}` : null,
    youtube: fs.existsSync(yt) ? fs.readFileSync(yt, 'utf8') : ''
  };
}

const ROOT = path.join(__dirname, '..', '..');
const WT = path.join(ROOT, 'walkthroughs');
const TEMPLATE = path.join(ROOT, 'framework', 'template');
const GALLERY = path.join(WT, 'gallery.js');
const args = process.argv.slice(2);
const PORT = +(args.find(a => /^\d+$/.test(a)) || 8800);

const STATIC = { '/walkthroughs/': WT, '/framework/': path.join(ROOT, 'framework'), '/admin/': path.join(__dirname, 'ui'), '/voice-preview/': path.join(ROOT, 'raw', 'voice-preview'), '/exports/': path.join(ROOT, 'exports') };
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.md': 'text/plain; charset=utf-8' };

/* ------------------------------------------------------------- gallery */
function readGallery() {
  if (!fs.existsSync(GALLERY)) return [];
  const m = fs.readFileSync(GALLERY, 'utf8').match(/window\.WALKTHROUGHS\s*=\s*(\[[\s\S]*\])\s*;?\s*$/);
  return m ? JSON.parse(m[1]) : [];
}
function writeGallery(list) {
  const clean = list.map(e => ({ folder: String(e.folder), title: String(e.title || ''), summary: String(e.summary || ''), length: String(e.length || '') }));
  writeFile(GALLERY, `// The walkthroughs listed on the gallery page (index.html), in order. Edited by the admin tool\n// (node tools/admin/server.js); also fine to edit by hand.\nwindow.WALKTHROUGHS = ${JSON.stringify(clean, null, 2)};\n`);
}

/* -------------------------------------------------------- walkthroughs */
const names = () => fs.readdirSync(WT, { withFileTypes: true })
  .filter(d => d.isDirectory() && fs.existsSync(path.join(WT, d.name, 'walkthrough.js'))).map(d => d.name).sort();
function dirOf(name) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(name) || !names().includes(name)) throw Object.assign(new Error(`No walkthrough '${name}'`), { status: 404 });
  return path.join(WT, name);
}

function summary(name) {
  const dir = path.join(WT, name);
  try {
    const p = plan(dir);
    const count = s => p.jobs.filter(j => j.state === s).length;
    const words = p.jobs.reduce((n, j) => n + j.caption.split(/\s+/).length, 0);
    return {
      name, title: p.def.title, subtitle: p.def.subtitle || '', tempo: p.def.tempo || 1, captions: p.def.captions !== false, mode: (p.def.narration || {}).mode || 'transcript',
      chapters: p.def.chapters.length, lines: p.jobs.length, words,
      audio: { ok: count('ok'), changed: count('changed'), missing: count('missing') },
      inGallery: readGallery().some(g => g.folder === name),
      voiceName: p.voice.voiceName || p.voice.voiceId, ownVoice: fs.existsSync(path.join(dir, 'voice.json'))
    };
  } catch (e) { return { name, error: e.message }; }
}

function detail(name) {
  const dir = dirOf(name);
  const p = plan(dir);
  const src = fs.readFileSync(path.join(dir, 'walkthrough.js'), 'utf8');
  const manifest = p.manifest.lines;
  const chapters = p.def.chapters.map(c => ({
    id: c.id, title: c.title, step: c.step || null,
    lines: p.jobs.filter(j => j.chapter.id === c.id).map(j => {
      const index = +j.id.split('-').pop() - 1;
      let editable = true;
      try { setLine(src, c.id, index, j.caption); } catch (e) { editable = false; }
      const rel = path.relative(dir, j.file).split(path.sep).join('/');
      return {
        id: j.id, index, caption: j.caption, spoken: j.text, state: j.state, editable, chars: j.text.length,
        audioUrl: j.state === 'missing' || j.state === 'custom' ? null : `/walkthroughs/${name}/${rel}?v=${(manifest[j.id] || {}).hash || Date.now()}`
      };
    })
  }));
  const pending = p.jobs.filter(j => j.state === 'changed' || j.state === 'missing');
  return {
    ...summary(name), chapters,
    pending: { lines: pending.length, chars: pending.reduce((n, j) => n + j.text.length, 0) },
    allChars: p.jobs.filter(j => j.state !== 'custom').reduce((n, j) => n + j.text.length, 0),
    gallery: readGallery().find(g => g.folder === name) || null,
    voice: { id: p.voice.voiceId, name: p.voice.voiceName || p.voice.voiceId, picked: fs.existsSync(path.join(dir, 'voice.json')) },
    video: exportInfo(name), ffmpeg: !!findFfmpeg()
  };
}

function voiceInfo() {
  try {
    const v = JSON.parse(fs.readFileSync(path.join(WT, 'voice.json'), 'utf8'));
    return { name: v.voiceName || v.voiceId, id: v.voiceId, model: v.model, settings: v.settings, pronunciations: v.pronunciations || {}, voices: v.voices || [{ name: v.voiceName || v.voiceId, id: v.voiceId }] };
  } catch (e) { return { error: e.message }; }
}

const VOICE_ID = /^[A-Za-z0-9]{8,40}$/;

// Sets a walkthrough's voice (writes its own voice.json), or clears it to use the default (null).
function setWalkthroughVoice(dir, voiceId) {
  const file = path.join(dir, 'voice.json');
  if (!voiceId) { if (fs.existsSync(file)) unlink(file); return; }
  const v = (sharedVoice().voices || []).find(x => x.id === voiceId);
  if (!v) throw new Error('That voice is not in the voice list.');
  writeFile(file, JSON.stringify({ voiceId: v.id, voiceName: v.name }, null, 2) + '\n');
}

// Sets every walkthrough's captions setting. Captions-only walkthroughs have no voice, so captions stay on there.
function setAllCaptions(on) {
  const skipped = [], failed = [];
  for (const n of names()) {
    const w = summary(n);
    if (w.error) { failed.push(n); continue; }
    if (!on && w.mode === 'transcript') { skipped.push(w.title); continue; }
    try { editSettings(path.join(WT, n), { captions: on }); } catch (e) { failed.push(w.title); }
  }
  return { skipped, failed };
}

// Replaces the voice list and the default voice in walkthroughs/voice.json (other settings untouched).
function setVoices(voices, defaultId) {
  const list = (voices || []).map(v => ({ name: String(v.name || '').trim(), id: String(v.id || '').trim() }));
  if (!list.length) throw new Error('Keep at least one voice.');
  for (const v of list) {
    if (!v.name) throw new Error('Every voice needs a name.');
    if (!VOICE_ID.test(v.id)) throw new Error(`"${v.id}" doesn't look like an ElevenLabs voice ID (letters and numbers, like i2SoWWnAm3qCyr53Jenw).`);
  }
  if (new Set(list.map(v => v.id)).size !== list.length) throw new Error('The same voice ID is listed twice.');
  const def = list.find(v => v.id === defaultId) || list[0];
  // A voice that a walkthrough uses can't be removed.
  for (const n of names()) {
    const f = path.join(WT, n, 'voice.json');
    if (!fs.existsSync(f)) continue;
    const id = JSON.parse(fs.readFileSync(f, 'utf8')).voiceId;
    if (!list.some(v => v.id === id)) throw new Error(`The ${n} walkthrough uses that voice. Pick another voice for it first.`);
  }
  const v = sharedVoice();
  v.voices = list; v.voiceId = def.id; v.voiceName = def.name;
  const order = ['provider', 'voiceId', 'voiceName', 'voices'];
  const out = {};
  order.concat(Object.keys(v)).forEach(k => { if (k in v && !(k in out)) out[k] = v[k]; });
  writeFile(SHARED_VOICE, JSON.stringify(out, null, 2) + '\n');
}

// Replaces the pronunciations in walkthroughs/voice.json (other settings untouched).
function setPronunciations(rows) {
  const out = {};
  for (const r of rows || []) {
    const word = String(r.word || '').trim(), say = String(r.say || '').trim();
    if (!word) throw new Error(`"${say}" needs a word to replace.`);
    if (!say) throw new Error(`"${word}" needs a spoken form.`);
    if (Object.prototype.hasOwnProperty.call(out, word)) throw new Error(`"${word}" is listed twice.`);
    out[word] = say;
  }
  const v = sharedVoice();
  v.pronunciations = out;
  writeFile(SHARED_VOICE, JSON.stringify(v, null, 2) + '\n');
}

// Builds the new walkthrough's files in memory from the template, then writes each one once (sync
// tools lock a file right after it is written, so files are never rewritten straight away). If anything
// fails, the half-made folder is removed so the same name can be tried again.
function createWalkthrough(name, title) {
  if (!/^[a-z0-9][a-z0-9-]{1,40}$/.test(name)) throw new Error('Folder names use lowercase letters, numbers and dashes (for example landing-pages).');
  const dir = path.join(WT, name);
  if (fs.existsSync(dir)) throw new Error(`walkthroughs/${name} already exists.`);
  title = String(title || name).trim();

  let js = fs.readFileSync(path.join(TEMPLATE, 'walkthrough.js'), 'utf8');
  js = setSetting(setSetting(js, 'title', title, 'string'), 'subtitle', '', 'string');
  const def = loadWalkthroughSource(js, path.join(dir, 'walkthrough.js'));
  if (!def || def.title !== title) throw new Error('Could not set the title in the template; nothing was created.');
  const html = fs.readFileSync(path.join(TEMPLATE, 'index.html'), 'utf8')
    .replace(/<title>[^<]*<\/title>/, `<title>${title.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))}</title>`);

  fs.mkdirSync(dir);
  try {
    writeFile(path.join(dir, 'walkthrough.js'), js);
    writeFile(path.join(dir, 'index.html'), html);
    exportTranscript(dir);
    writeGallery([...readGallery().filter(g => g.folder !== name), { folder: name, title, summary: '', length: '' }]);
  } catch (e) {
    try { removeDir(dir); } catch (e2) { /* leave it; the error below says what failed */ }
    throw new Error(`Could not create walkthroughs/${name}: ${e.message}`);
  }
}

// The docs pages for the Ask Claude panel's page picker: live docs site, or the offline copy.
let docsCache = null;
async function docsPages() {
  if (docsCache && Date.now() - docsCache.at < 60000) return docsCache.data;
  const data = await listPages();
  docsCache = { at: Date.now(), data };
  return data;
}

/* ---------------------------------------------------------------- http */
let busy = null;   // the voiceover job in progress, if any
const claude = createRunner();   // the Ask Claude panel's Claude Code session

function send(res, status, body, type = 'application/json') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(type === 'application/json' ? JSON.stringify(body) : body);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let b = '';
    req.on('data', d => { b += d; if (b.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(b ? JSON.parse(b) : {}); } catch (e) { reject(Object.assign(new Error('Bad JSON'), { status: 400 })); } });
  });
}

function serveFile(req, res, file) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, 'Not found', 'text/plain');
    const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    if (range) {
      const start = range[1] ? +range[1] : st.size - +range[2], end = range[1] && range[2] ? +range[2] : st.size - 1;
      res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Content-Length': end - start + 1, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' });
      return fs.createReadStream(file, { start, end }).pipe(res);
    }
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
}

async function api(req, res, url) {
  const parts = url.pathname.split('/').filter(Boolean).slice(1);   // after 'api'
  const body = req.method === 'POST' ? await readBody(req) : {};

  if (req.method === 'GET' && parts[0] === 'state') {
    return send(res, 200, { walkthroughs: names().map(summary), gallery: readGallery(), voice: voiceInfo(), hasKey: !!apiKey(), busy: busy && busy.name });
  }
  if (req.method === 'GET' && parts[0] === 'docs') return send(res, 200, await docsPages());
  if (req.method === 'GET' && parts[0] === 'zip') {
    const zip = zipFolders(ROOT, ['framework', 'walkthroughs']);
    const filename = `klick-zen-walkthroughs-${new Date().toLocaleDateString('en-CA')}.zip`;   // en-CA: YYYY-MM-DD
    res.writeHead(200, { 'Content-Type': 'application/zip', 'Content-Length': zip.length, 'Content-Disposition': `attachment; filename="${filename}"`, 'Cache-Control': 'no-store' });
    return res.end(zip);
  }
  if (parts[0] === 'claude') {
    if (req.method === 'GET') return send(res, 200, claude.status(+url.searchParams.get('since') || 0));
    if (parts[1] === 'send') { claude.start(body.prompt); return send(res, 200, claude.status()); }
    if (parts[1] === 'stop') { claude.stop(); return send(res, 200, { ok: true }); }
    if (parts[1] === 'reset') { claude.reset(); return send(res, 200, { ok: true }); }
  }
  if (req.method === 'POST' && parts[0] === 'new') { createWalkthrough(body.name, body.title); return send(res, 200, { ok: true }); }
  if (req.method === 'POST' && parts[0] === 'captions-all') return send(res, 200, setAllCaptions(!!body.on));
  if (req.method === 'POST' && parts[0] === 'voices') { setVoices(body.voices, body.defaultId); return send(res, 200, { voice: voiceInfo() }); }
  if (req.method === 'POST' && parts[0] === 'pronunciations') { setPronunciations(body.rows); return send(res, 200, { voice: voiceInfo() }); }
  if (req.method === 'POST' && parts[0] === 'voice-preview') {
    if (!VOICE_ID.test(String(body.voiceId || ''))) throw new Error('Pick a voice to preview.');
    const r = await previewVoice(body.voiceId, String(body.text || 'Hi! This is how a Klick-Zen walkthrough sounds in this voice.'));
    return send(res, 200, { url: '/voice-preview/' + path.basename(r.file), cached: r.cached, chars: r.chars });
  }
  if (req.method === 'POST' && parts[0] === 'gallery') {
    const all = names();
    const list = (body.entries || []).filter(e => all.includes(e.folder));
    writeGallery(list);
    return send(res, 200, { gallery: readGallery() });
  }

  if (parts[0] === 'w' && parts[1]) {
    const name = parts[1], dir = dirOf(name), action = parts[2];
    if (req.method === 'GET' && !action) return send(res, 200, detail(name));
    if (req.method === 'POST' && action === 'line') {
      editLine(dir, String(body.chapter), +body.index, body.text);
      exportTranscript(dir);
      return send(res, 200, detail(name));
    }
    if (req.method === 'POST' && action === 'settings') {
      editSettings(dir, body.settings || {});
      if (body.gallery) {
        const g = readGallery(), i = g.findIndex(e => e.folder === name);
        if (body.gallery.show === false) { if (i >= 0) g.splice(i, 1); }
        else {
          const entry = { folder: name, title: body.gallery.title, summary: body.gallery.summary, length: body.gallery.length };
          if (i >= 0) g[i] = entry; else g.push(entry);
        }
        writeGallery(g);
      }
      exportTranscript(dir);
      return send(res, 200, detail(name));
    }
    if (req.method === 'POST' && action === 'transcript') return send(res, 200, exportTranscript(dir));
    if (req.method === 'POST' && action === 'voice') { setWalkthroughVoice(dir, body.voiceId || null); return send(res, 200, detail(name)); }
    if (req.method === 'POST' && action === 'reveal') {
      const f = path.join(EXPORTS, `${name}.mp4`);
      if (!fs.existsSync(f)) throw new Error('There is no export yet.');
      if (process.platform === 'win32') execFile('explorer.exe', ['/select,', f], () => {});
      else exec(`${process.platform === 'darwin' ? 'open -R' : 'xdg-open'} "${process.platform === 'darwin' ? f : EXPORTS}"`);
      return send(res, 200, { ok: true });
    }
    if (req.method === 'POST' && action === 'export') {
      if (busy) return send(res, 409, { error: `Busy with ${busy.name}. Wait for it to finish.` });
      busy = { name };
      res.writeHead(200, { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-store' });
      const out = o => res.write(JSON.stringify(o) + '\n');
      try {
        const r = await exportVideo(dir, { captions: !!body.captions }, log => out({ log }));
        out({ done: true, seconds: r.seconds, bytes: r.bytes });
      } catch (e) { out({ error: e.message }); }
      finally { busy = null; res.end(); }
      return;
    }
    if (req.method === 'POST' && action === 'voiceover') {
      if (busy) return send(res, 409, { error: `Already generating audio for ${busy.name}. Wait for it to finish.` });
      busy = { name };
      res.writeHead(200, { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-store' });
      const out = o => res.write(JSON.stringify(o) + '\n');
      try {
        const r = await generate(dir, { only: Array.isArray(body.only) ? body.only : null, force: !!body.force }, log => out({ log }));
        out({ done: true, ...r });
      } catch (e) { out({ error: e.message }); }
      finally { busy = null; res.end(); }
      return;
    }
  }
  send(res, 404, { error: 'Unknown request' });
}

const server = http.createServer(async (req, res) => {
  // Only this computer, only by its own name (blocks other sites reaching it through DNS tricks).
  const host = (req.headers.host || '').toLowerCase();
  if (host !== `localhost:${PORT}` && host !== `127.0.0.1:${PORT}`) return send(res, 403, 'Forbidden', 'text/plain');
  const url = new URL(req.url, `http://${host}`);
  try {
    if (url.pathname.startsWith('/api/')) {
      // Changes must come from the admin page itself: other websites can't send this header.
      if (req.method !== 'GET' && req.headers['x-admin'] !== '1') return send(res, 403, { error: 'Forbidden' });
      return await api(req, res, url);
    }
    if (url.pathname === '/' || url.pathname === '/admin') { res.writeHead(302, { Location: '/admin/' }); return res.end(); }
    for (const [prefix, base] of Object.entries(STATIC)) {
      if (!url.pathname.startsWith(prefix)) continue;
      let rel = decodeURIComponent(url.pathname.slice(prefix.length));
      if (rel === '' || rel.endsWith('/')) rel += 'index.html';
      const file = path.resolve(base, rel);
      if (!file.startsWith(path.resolve(base) + path.sep)) return send(res, 403, 'Forbidden', 'text/plain');
      return serveFile(req, res, file);
    }
    send(res, 404, 'Not found', 'text/plain');
  } catch (e) {
    if (!res.headersSent) send(res, e.status || 400, { error: e.message });
  }
});

server.on('error', e => {
  console.error(e.code === 'EADDRINUSE' ? `Port ${PORT} is in use: the admin may already be running at http://localhost:${PORT}/ (or pass another port).` : e.message);
  process.exitCode = 1;
});
// Closing the admin also stops a Claude run in progress.
['SIGINT', 'SIGTERM', 'SIGHUP'].forEach(sig => process.on(sig, () => { claude.stop(); setTimeout(() => process.exit(0), 300); }));

server.listen(PORT, '127.0.0.1', () => {
  const link = `http://localhost:${PORT}/`;
  console.log(`Walkthrough admin running at ${link}  (Ctrl+C to stop)`);
  if (!args.includes('--no-open')) exec(process.platform === 'win32' ? `start "" "${link}"` : process.platform === 'darwin' ? `open "${link}"` : `xdg-open "${link}"`);
});
