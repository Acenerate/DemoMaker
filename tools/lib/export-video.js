// Exports a walkthrough as a YouTube-ready MP4, plus an SRT captions file and a text file with a title,
// description and chapter timestamps. Used by tools/export-video.js and the admin's Video tab.
//
// How: the walkthrough plays once in headless Chrome at 1920x1080 in the player's video mode, while
// every rendered frame is captured with its timestamp, and every narration clip, caption and chapter
// change is logged with the time it happened. FFmpeg then turns the frames into 30 fps video and lays
// the original voice clips onto the soundtrack at exactly those times (at the walkthrough's tempo).
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { pathToFileURL, fileURLToPath } = require('url');
const { loadWalkthrough, linesOf } = require('./load-walkthrough');
const { launch, wait } = require('./headless');
const { writeFile, removeDir } = require('./fs-retry');

const ROOT = path.join(__dirname, '..', '..');
const EXPORTS = path.join(ROOT, 'exports');
const W = 1920, H = 1080, FPS = 30, HOLD_END = 4;   // seconds the end card stays up

function findFfmpeg() {
  const exe = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
  const candidates = [process.env.FFMPEG_PATH];
  for (const d of (process.env.PATH || '').split(path.delimiter)) candidates.push(path.join(d, exe));
  const la = process.env.LOCALAPPDATA;
  if (la) {
    candidates.push(path.join(la, 'Microsoft', 'WinGet', 'Links', exe));
    const pk = path.join(la, 'Microsoft', 'WinGet', 'Packages');
    if (fs.existsSync(pk)) {
      for (const p of fs.readdirSync(pk).filter(n => /ffmpeg/i.test(n))) {
        const base = path.join(pk, p);
        for (const sub of fs.readdirSync(base)) candidates.push(path.join(base, sub, 'bin', exe));
      }
    }
  }
  candidates.push('C:\\ffmpeg\\bin\\ffmpeg.exe', '/usr/bin/ffmpeg', '/usr/local/bin/ffmpeg', '/opt/homebrew/bin/ffmpeg');
  return candidates.find(p => p && fs.existsSync(p)) || null;
}

// Page script: logs clips, captions and chapters with wall-clock times (same clock as the frames).
const INSTRUMENT = `
  try { localStorage.setItem('w-speed', '1'); } catch (e) {}
  window.__ex = [];
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    window.__ex.push({ type: 'clip', src: this.src, rate: this.playbackRate, t: Date.now() });
    return play.call(this);
  };
  document.addEventListener('DOMContentLoaded', () => {
    const cap = document.querySelector('.w-caption'), now = document.querySelector('.w-now');
    const watch = (el, type) => el && new MutationObserver(() => window.__ex.push({ type, text: el.textContent, t: Date.now() }))
      .observe(el, { childList: true, characterData: true, subtree: true });
    watch(cap, 'caption'); watch(now, 'chapter');
  });`;

const stamp = (ms, sep = ',') => {
  const t = Math.max(0, Math.round(ms));
  const h = Math.floor(t / 3600000), m = Math.floor(t / 60000) % 60, s = Math.floor(t / 1000) % 60, x = t % 1000;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}${sep}${String(x).padStart(3, '0')}`;
};
const clock = ms => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

// Splits a caption into cues of at most two lines (about 42 characters each, YouTube's guideline),
// timed in proportion to their length.
function cues(text, start, end) {
  const lines = [];
  let line = '';
  for (const w of text.split(/\s+/)) {
    if (line && (line + ' ' + w).length > 42) { lines.push(line); line = w; } else line = line ? line + ' ' + w : w;
  }
  if (line) lines.push(line);
  // Pair the lines; an odd last line joins the previous cue only if that keeps it to two lines.
  const groups = [];
  for (let i = 0; i < lines.length; i += 2) groups.push(lines.slice(i, i + 2));
  const total = groups.reduce((n, g) => n + g.join(' ').length, 0);
  let t = start;
  return groups.map(g => {
    const d = (end - start) * g.join(' ').length / total;
    const cue = { start: t, end: t + d, text: g.join('\n') };
    t += d;
    return cue;
  });
}

function run(exe, args, onLine) {
  return new Promise((resolve, reject) => {
    const p = spawn(exe, args, { windowsHide: true });
    let err = '';
    p.stderr.on('data', d => {
      err += d;
      if (err.length > 20000) err = err.slice(-10000);
      const m = String(d).match(/time=(\d+):(\d+):(\d+\.\d+)/);
      if (m && onLine) onLine(+m[1] * 3600 + +m[2] * 60 + +m[3]);
    });
    p.on('error', reject);
    p.on('close', code => (code === 0 ? resolve() : reject(new Error('FFmpeg failed: ' + err.trim().split('\n').slice(-3).join(' ')))));
  });
}

async function exportVideo(dir, opt = {}, log = console.log) {
  const ffmpeg = findFfmpeg();
  if (!ffmpeg) throw new Error('FFmpeg was not found. Install it (winget install Gyan.FFmpeg), or set FFMPEG_PATH.');
  const def = loadWalkthrough(dir);
  if (!def) throw new Error('walkthrough.js does not call KZWalkthrough.create()');
  const name = path.basename(path.resolve(dir));
  const lines = linesOf(def), lineTexts = new Set(lines.map(l => l.text));
  const work = path.join(ROOT, 'raw', 'export-work', name);
  removeDir(work);
  fs.mkdirSync(path.join(work, 'frames'), { recursive: true });
  fs.mkdirSync(EXPORTS, { recursive: true });

  // 1. Play and capture.
  log(`Recording ${def.title} at ${W}x${H} in real time (about ${Math.round(lines.reduce((n, l) => n + l.text.split(/\s+/).length, 0) / 2.6 / (def.tempo || 1))}s)…`);
  const frames = [];
  const errors = [];
  let page;
  page = await launch({
    width: W, height: H, init: INSTRUMENT,
    onEvent(method, d) {
      if (method === 'Page.screencastFrame') {
        const file = `f${String(frames.length).padStart(6, '0')}.jpg`;
        fs.writeFileSync(path.join(work, 'frames', file), Buffer.from(d.data, 'base64'));
        frames.push({ file, t: d.metadata.timestamp * 1000 });
        page && page.send('Page.screencastFrameAck', { sessionId: d.sessionId });
      }
      if (method === 'Runtime.exceptionThrown') errors.push((d.exceptionDetails.exception?.description || d.exceptionDetails.text).split('\n')[0]);
    }
  });
  let t0, tEnd, events;
  try {
    const { ev, send } = page;
    await page.navigate(pathToFileURL(path.resolve(dir, 'index.html')).href + '?video' + (opt.captions ? '&captions' : ''));
    for (let i = 0; i < 50 && !(await ev("!!document.querySelector('.w-bigplay')")); i++) await wait(200);
    await wait(800);   // fonts and images settle
    await send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: W, maxHeight: H, everyNthFrame: 1 });
    await wait(300);
    t0 = await ev("(() => { document.querySelector('.w-bigplay').click(); return Date.now(); })()");
    const words = lines.reduce((n, l) => n + l.text.split(/\s+/).length, 0);
    const limit = Date.now() + Math.max(120000, words / 2.6 * 1000 * 3 + 60000);
    let lastLog = 0, finished = false;
    while (Date.now() < limit) {
      await wait(500);
      const st = await ev("({ done: !document.querySelector('.w-start').classList.contains('hide'), now: document.querySelector('.w-now').textContent })");
      if (Date.now() - lastLog > 15000) { log(`  ${clock(Date.now() - t0)}  ${st.now}`); lastLog = Date.now(); }
      if (st.done) { finished = true; break; }
    }
    if (!finished) throw new Error('The walkthrough did not finish playing.');
    await ev("document.querySelector('.w-caption').textContent = ''");
    await wait(HOLD_END * 1000);
    tEnd = await ev('Date.now()');
    await send('Page.stopScreencast');
    events = await ev('window.__ex');
  } finally {
    await page.close();
  }
  if (errors.length) log('  Note: the page reported: ' + [...new Set(errors)].join(' · '));
  if (!frames.length) throw new Error('No frames were captured.');
  const duration = (tEnd - t0) / 1000;
  log(`Captured ${frames.length} frames over ${clock(tEnd - t0)}.`);
  // Timing log of the last export (clips, captions, chapters), for troubleshooting sync.
  writeFile(path.join(ROOT, 'raw', 'export-last-events.json'), JSON.stringify({ t0, tEnd, firstFrame: frames[0].t, events }, null, 1));

  // 2. Frames -> a timed list for FFmpeg (the frame on screen at t0 starts the video).
  frames.sort((a, b) => a.t - b.t);
  let firstIdx = frames.findIndex(f => f.t > t0);
  firstIdx = firstIdx <= 0 ? 0 : firstIdx - 1;
  const used = frames.slice(firstIdx).filter(f => f.t < tEnd);
  if (!used.length) used.push(frames[frames.length - 1]);
  used[0] = { ...used[0], t: t0 };
  let list = 'ffconcat version 1.0\n';
  used.forEach((f, i) => {
    const next = i + 1 < used.length ? used[i + 1].t : tEnd;
    list += `file 'frames/${f.file}'\nduration ${Math.max(0.001, (next - f.t) / 1000).toFixed(4)}\n`;
  });
  list += `file 'frames/${used[used.length - 1].file}'\n`;
  writeFile(path.join(work, 'frames.ffconcat'), list);

  // 3. Voice clips at their start times, sped up by the tempo they played at.
  const clips = (events || []).filter(e => e.type === 'clip' && e.t >= t0 - 50).map(e => {
    let file = null;
    try { file = fileURLToPath(e.src.split('?')[0]); } catch (x) { /* not a file */ }
    return { file, rate: e.rate || 1, at: Math.max(0, e.t - t0) };
  }).filter(c => c.file && fs.existsSync(c.file));
  log(`Building the soundtrack from ${clips.length} voice clip${clips.length === 1 ? '' : 's'}.`);

  const mp4 = path.join(EXPORTS, `${name}.mp4`);
  const args = ['-hide_banner', '-y', '-f', 'concat', '-safe', '0', '-i', path.join(work, 'frames.ffconcat')];
  clips.forEach(c => args.push('-i', c.file));
  // The frames are full-range JPEGs; video players expect TV-range BT.709, so convert explicitly.
  let filter = `[0:v]fps=${FPS},scale=${W}:${H}:flags=lanczos:in_range=pc:out_range=tv:out_color_matrix=bt709,format=yuv420p[v]`;
  if (clips.length) {
    clips.forEach((c, i) => {
      const tempo = Math.abs(c.rate - 1) > 0.001 ? `atempo=${c.rate.toFixed(4)},` : '';
      // Reset each clip's timestamps first (MP3s don't start at exactly 0), or the mix ends up misplaced.
      filter += `;[${i + 1}:a]asetpts=PTS-STARTPTS,${tempo}aresample=48000,adelay=${Math.round(c.at)}:all=1[a${i}]`;
    });
    filter += `;${clips.map((c, i) => `[a${i}]`).join('')}amix=inputs=${clips.length}:normalize=0:dropout_transition=0,apad,asetpts=N/SR/TB,aformat=channel_layouts=stereo[aout]`;
  } else {
    args.push('-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo');
    filter += `;[1:a]anull[aout]`;
  }
  args.push('-filter_complex', filter, '-map', '[v]', '-map', '[aout]',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-r', String(FPS), '-pix_fmt', 'yuv420p',
    '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-t', duration.toFixed(3), '-movflags', '+faststart', mp4);
  log('Encoding the MP4…');
  let lastPct = -1;
  await run(ffmpeg, args, sec => {
    const pct = Math.min(100, Math.floor(sec / duration * 100 / 20) * 20);
    if (pct > lastPct) { lastPct = pct; log(`  encoding ${pct}%`); }
  }).catch(e => { throw new Error(e.message); });

  // 4. Captions (SRT) from when each line appeared on screen.
  const caps = (events || []).filter(e => e.type === 'caption' && e.t >= t0 - 50 && lineTexts.has(e.text));
  const srtCues = [];
  caps.forEach((c, i) => {
    if (i && caps[i - 1].text === c.text) return;
    const nextT = (caps.slice(i + 1).find(n => n.text !== c.text) || { t: tEnd - HOLD_END * 1000 }).t;
    srtCues.push(...cues(c.text, c.t - t0, nextT - t0 - 80));
  });
  const srt = path.join(EXPORTS, `${name}.srt`);
  writeFile(srt, srtCues.map((c, i) => `${i + 1}\n${stamp(c.start)} --> ${stamp(c.end)}\n${c.text}\n`).join('\n'));

  // 5. YouTube title, description and chapters (YouTube wants 0:00 first and chapters of 10s or more).
  const chapters = [];
  (events || []).filter(e => e.type === 'chapter' && e.t >= t0 - 50).forEach(e => {
    const title = e.text.replace(/^Step \d+:\s*/, (m) => m);
    if (!chapters.length || chapters[chapters.length - 1].title !== title) chapters.push({ at: Math.max(0, e.t - t0), title });
  });
  if (!chapters.length || chapters[0].at > 0) chapters.unshift({ at: 0, title: chapters.length ? chapters[0].title : def.title });
  chapters[0].at = 0;
  // A chapter under 10 seconds is folded into the one before it (or the first into the next), keeping its
  // name: "Step 1: Start a new button & Label the button".
  const merged = chapters.map(c => ({ ...c }));
  const short = i => (merged[i + 1] ? merged[i + 1].at : duration * 1000) - merged[i].at < 10000;
  const bare = t => t.replace(/^Step \d+:\s*/, '');
  for (let i = 0; i < merged.length && merged.length > 1;) {
    if (!short(i)) { i++; continue; }
    if (i > 0) { merged[i - 1].title += ' & ' + bare(merged[i].title); merged.splice(i, 1); }
    else { merged[0].title += ' & ' + bare(merged[1].title); merged.splice(1, 1); }
  }
  const end = def.end || {};
  const yt = path.join(EXPORTS, `${name}.youtube.txt`);
  writeFile(yt, [
    'TITLE',
    def.title,
    '',
    'DESCRIPTION',
    [def.subtitle, (def.intro || {}).text].filter(Boolean).join('. ').replace(/\.\./g, '.'),
    '',
    [end.title, end.text].filter(Boolean).join(' '),
    end.link ? `${end.link.label.replace(/\s*→\s*$/, '')}: ${end.link.href}` : '',
    '',
    merged.length >= 3 ? 'Chapters:\n' + merged.map(c => `${clock(c.at)} ${c.title}`).join('\n') : '',
    '',
    'CAPTIONS',
    `Upload ${name}.srt in YouTube Studio under Subtitles (language: English).`
  ].join('\n').replace(/\n{3,}/g, '\n\n'));

  removeDir(work);
  const size = fs.statSync(mp4).size;
  log(`Done: exports/${name}.mp4 (${clock(duration * 1000)}, ${(size / 1048576).toFixed(1)} MB), ${name}.srt (${srtCues.length} captions), ${name}.youtube.txt.`);
  return { mp4, srt, yt, seconds: duration, bytes: size, captions: srtCues.length };
}

module.exports = { exportVideo, findFfmpeg, EXPORTS };
