// ElevenLabs voiceover: works out which narration lines need audio, and generates it. Used by
// tools/make-voiceover.js (command line) and tools/admin/server.js (admin GUI).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { loadWalkthrough, linesOf } = require('./load-walkthrough');
const { writeFile, unlink } = require('./fs-retry');

const ROOT = path.join(__dirname, '..', '..');
const API = (process.env.ELEVENLABS_BASE_URL || 'https://api.elevenlabs.io').replace(/\/$/, '');
const wait = ms => new Promise(r => setTimeout(r, ms));

function apiKey() {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY.trim();
  const env = path.join(ROOT, '.env');
  if (fs.existsSync(env)) {
    const m = fs.readFileSync(env, 'utf8').match(/^\s*ELEVENLABS_API_KEY\s*=\s*["']?([^"'\r\n]+)/m);
    if (m) return m[1].trim();
  }
  return null;
}

async function call(urlPath, init = {}, log = console.log) {
  const key = apiKey();
  if (!key) throw new Error('No API key: set ELEVENLABS_API_KEY, or add ELEVENLABS_API_KEY=... to a .env file in the project root.');
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(API + urlPath, { ...init, headers: { 'xi-api-key': key, ...(init.headers || {}) } });
    if (res.ok) return res;
    const body = await res.text();
    if ((res.status === 429 || res.status >= 500) && attempt < 5) {
      const ms = 2000 * attempt;
      log(`  ${res.status} from ElevenLabs, retrying in ${ms / 1000}s`);
      await wait(ms);
      continue;
    }
    let detail = body;
    try { const j = JSON.parse(body); detail = j.detail?.message || j.detail?.status || JSON.stringify(j.detail || j); } catch (e) { /* not JSON */ }
    throw new Error(`ElevenLabs ${res.status}: ${detail}`);
  }
}

async function listVoices() {
  const { voices } = await (await call('/v1/voices')).json();
  return voices.map(v => {
    const l = v.labels || {};
    return { id: v.voice_id, name: v.name, category: v.category, description: [l.gender, l.age, l.accent, l.description || l.descriptive].filter(Boolean).join(', ') };
  });
}

// The text actually sent: pronunciations swapped in as whole words ("Klick-Zen" -> "Click Zen").
function spoken(text, pron) {
  let s = text;
  for (const [from, to] of Object.entries(pron || {})) {
    s = s.replace(new RegExp(`(^|[^\\w-])${from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=$|[^\\w-])`, 'g'), `$1${to}`);
  }
  return s;
}

const SHARED_VOICE = path.join(ROOT, 'walkthroughs', 'voice.json');
const sharedVoice = () => JSON.parse(fs.readFileSync(SHARED_VOICE, 'utf8'));

// A walkthrough's voice: the shared walkthroughs/voice.json, then the walkthrough's own voice.json (the
// voice picked for it in the admin), then narration.voice in its walkthrough.js.
function voiceFor(def, dir) {
  const shared = sharedVoice();
  const file = dir ? path.join(dir, 'voice.json') : null;
  const picked = file && fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  const own = { ...picked, ...((def.narration && def.narration.voice) || {}) };
  const { voices, ...base } = shared;
  return { ...base, ...own, settings: { ...shared.settings, ...own.settings }, pronunciations: { ...shared.pronunciations, ...own.pronunciations } };
}

// Generates (or reuses) a short sample in a voice, with the shared model and settings, for the admin's
// voice preview. Samples are cached in raw/voice-preview/. Returns { file, cached, chars }.
async function previewVoice(voiceId, text, log = () => {}) {
  const v = sharedVoice();
  const spokenText = spoken(String(text).slice(0, 300), v.pronunciations);
  const hash = crypto.createHash('sha1').update(JSON.stringify([spokenText, voiceId, v.model, v.settings])).digest('hex').slice(0, 16);
  const dir = path.join(ROOT, 'raw', 'voice-preview');
  const file = path.join(dir, hash + '.mp3');
  if (fs.existsSync(file)) return { file, cached: true, chars: 0 };
  fs.mkdirSync(dir, { recursive: true });
  const res = await call(`/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({ text: spokenText, model_id: v.model, voice_settings: v.settings })
  }, log);
  writeFile(file, Buffer.from(await res.arrayBuffer()));
  return { file, cached: false, chars: spokenText.length };
}

// Every line with its audio state: 'ok' (audio matches the line and voice), 'changed' (audio exists but
// was made from different text or settings), 'missing', or 'custom' (the line names its own file).
function plan(dir, opt = {}) {
  const def = loadWalkthrough(dir);
  if (!def) throw new Error(`${path.join(dir, 'walkthrough.js')}: KZWalkthrough.create() was not called`);
  const voice = voiceFor(def, dir);
  const ext = voice.outputFormat.split('_')[0];
  const voDir = path.join(dir, (def.narration && def.narration.dir) || 'vo');
  const manifestFile = path.join(voDir, 'manifest.json');
  const manifest = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, 'utf8')) : { lines: {} };
  const lines = linesOf(def);
  if (opt.only) {
    const unknown = opt.only.filter(id => !lines.some(l => l.id === id));
    if (unknown.length) throw new Error(`No such line id: ${unknown.join(', ')} (ids are listed in transcript.md)`);
  }
  const jobs = lines.map((l, i) => {
    const text = spoken(l.text, voice.pronunciations);
    const hash = crypto.createHash('sha1').update(JSON.stringify([text, voice.voiceId, voice.model, voice.outputFormat, voice.settings])).digest('hex').slice(0, 12);
    const file = path.join(voDir, `${l.id}.${ext}`);
    const exists = fs.existsSync(file);
    const state = l.audio ? 'custom' : !exists ? 'missing' : manifest.lines[l.id] && manifest.lines[l.id].hash === hash ? 'ok' : 'changed';
    const todo = l.audio ? false : opt.only ? opt.only.includes(l.id) : opt.force || state !== 'ok';
    return {
      ...l, caption: l.text, text, hash, file, state, todo,
      prev: lines[i - 1] && spoken(lines[i - 1].text, voice.pronunciations),
      next: lines[i + 1] && spoken(lines[i + 1].text, voice.pronunciations)
    };
  });
  return { def, voice, ext, voDir, manifestFile, manifest, jobs };
}

function saveManifest(p) {
  const { voice, manifest } = p;
  writeFile(p.manifestFile, JSON.stringify({ voice: { id: voice.voiceId, name: voice.voiceName, model: voice.model }, lines: manifest.lines }, null, 2));
}

// Generates audio for the lines plan() marks as todo. log(text) receives progress lines.
async function generate(dir, opt = {}, log = console.log) {
  const p = plan(dir, opt);
  const { voice, ext, voDir, manifest, jobs } = p;
  const todo = jobs.filter(j => j.todo);
  const chars = todo.reduce((n, j) => n + j.text.length, 0);
  log(`${path.relative(ROOT, path.resolve(dir)).split(path.sep).join('/')}: ${jobs.length} lines, ${todo.length} to generate (${chars} characters) with ${voice.voiceName || voice.voiceId}, ${voice.model}`);
  if ((p.def.narration || {}).mode !== 'audio') log(`Note: narration mode is '${(p.def.narration || {}).mode || 'transcript'}'; set it to 'audio' to play these files.`);
  if (opt.dryRun) { todo.forEach(j => log(`  ${j.id}: ${j.text}`)); return { generated: 0, chars }; }

  fs.mkdirSync(voDir, { recursive: true });
  let generated = 0;
  for (const j of todo) {
    const body = {
      text: j.text,
      model_id: voice.model,
      voice_settings: voice.settings,
      // Neighbouring lines keep intonation continuous across files.
      previous_text: j.prev || undefined,
      next_text: j.next || undefined
    };
    const res = await call(`/v1/text-to-speech/${encodeURIComponent(voice.voiceId)}?output_format=${encodeURIComponent(voice.outputFormat)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'audio/mpeg' }, body: JSON.stringify(body)
    }, log);
    const buf = Buffer.from(await res.arrayBuffer());
    writeFile(j.file, buf);
    manifest.lines[j.id] = { text: j.text, hash: j.hash, bytes: buf.length };
    saveManifest(p);
    generated++;
    log(`  ${path.basename(j.file)}  ${(buf.length / 1024).toFixed(0)} KB  ${j.text.slice(0, 70)}`);
  }

  // Remove files for lines that no longer exist (only on full runs).
  if (!opt.only) {
    for (const id of Object.keys(manifest.lines)) {
      if (jobs.some(j => j.id === id)) continue;
      const stale = path.join(voDir, `${id}.${ext}`);
      if (fs.existsSync(stale)) unlink(stale);
      delete manifest.lines[id];
      log(`  removed ${id}.${ext} (line no longer in the script)`);
    }
  }
  if (fs.existsSync(voDir)) saveManifest(p);
  log('Done.');
  return { generated, chars };
}

module.exports = { apiKey, listVoices, spoken, voiceFor, sharedVoice, previewVoice, plan, generate, SHARED_VOICE };
