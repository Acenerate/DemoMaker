// Checked edits to a walkthrough.js: each edit is applied to the source, the result is loaded, and it is
// only saved if exactly the intended value changed (every other line and setting stays the same).
const fs = require('fs');
const path = require('path');
const { loadWalkthroughSource, linesOf } = require('./load-walkthrough');
const { setLine, setSetting, setNarrationMode } = require('./source-edit');
const { writeFile } = require('./fs-retry');

const snapshot = def => JSON.stringify({
  title: def.title, subtitle: def.subtitle, tempo: def.tempo || 1, captions: def.captions !== false, mode: (def.narration || {}).mode || 'transcript',
  lines: linesOf(def).map(l => [l.id, l.text])
});

function apply(dir, edit, expect) {
  const file = path.join(dir, 'walkthrough.js');
  const src = fs.readFileSync(file, 'utf8');
  const before = loadWalkthroughSource(src, file);
  const next = edit(src);
  let after;
  try { after = loadWalkthroughSource(next, file); } catch (e) { throw new Error('The edit would break walkthrough.js (' + e.message + '); nothing was saved.'); }
  if (!after) throw new Error('The edit would break walkthrough.js; nothing was saved.');
  const want = JSON.parse(snapshot(before));
  expect(want);
  if (snapshot(after) !== JSON.stringify(want)) throw new Error('The edit changed more than intended; nothing was saved.');
  if (next !== src) writeFile(file, next);
  return after;
}

function editLine(dir, chapterId, index, text) {
  text = String(text).replace(/\r\n?/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) throw new Error('A line cannot be empty.');
  return apply(dir, src => setLine(src, chapterId, index, text), want => {
    const l = want.lines.find(x => x[0] === `${chapterId}-${index + 1}`);
    if (!l) throw new Error(`No line ${chapterId}-${index + 1}`);
    l[1] = text;
  });
}

function editSettings(dir, s) {
  let def;
  if (s.title != null) def = apply(dir, src => setSetting(src, 'title', s.title, 'string'), w => { w.title = String(s.title); });
  if (s.subtitle != null) def = apply(dir, src => setSetting(src, 'subtitle', s.subtitle, 'string'), w => { w.subtitle = String(s.subtitle); });
  if (s.tempo != null) {
    const t = +s.tempo;
    if (!(t >= 0.5 && t <= 2)) throw new Error('Tempo must be between 0.5 and 2.');
    def = apply(dir, src => setSetting(src, 'tempo', t, 'number'), w => { w.tempo = t; });
  }
  if (s.captions != null) {
    // Captions on is the default, so a walkthrough that doesn't mention them is left untouched.
    const on = !!s.captions, file = path.join(dir, 'walkthrough.js');
    def = apply(dir, src => ((loadWalkthroughSource(src, file).captions !== false) === on ? src : setSetting(src, 'captions', on, 'boolean')), w => { w.captions = on; });
  }
  if (s.mode != null) {
    if (!['transcript', 'audio', 'speech'].includes(s.mode)) throw new Error('Unknown narration mode.');
    def = apply(dir, src => setNarrationMode(src, s.mode), w => { w.mode = s.mode; });
  }
  return def;
}

module.exports = { editLine, editSettings };
