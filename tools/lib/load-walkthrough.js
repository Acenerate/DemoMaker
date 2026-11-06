// Loads a walkthrough's definition in Node: runs the kit and walkthrough.js with a stubbed
// KZWalkthrough.create() and returns the object it was called with (or null).
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const KIT = path.join(__dirname, '..', '..', 'framework', 'kit', 'klickzen.js');

const lineText = l => (typeof l === 'string' ? l : l.text);

function loadWalkthrough(dir) {
  const file = path.join(dir, 'walkthrough.js');
  return loadWalkthroughSource(fs.readFileSync(file, 'utf8'), file);
}

// Same, from source text (used to check an edit before it is saved).
function loadWalkthroughSource(src, filename) {
  let def = null;
  const ctx = { console, KZWalkthrough: { create: d => { def = d; } } };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(KIT, 'utf8'), ctx, { filename: KIT });
  vm.runInContext(src, ctx, { filename });
  return def;
}

// Every narration line with its transcript id (chapter-n), in playing order.
function linesOf(def) {
  const out = [];
  def.chapters.forEach(c => c.lines.forEach((l, i) => out.push({
    id: `${c.id}-${i + 1}`, chapter: c, text: lineText(l), audio: typeof l === 'object' ? l.audio : null
  })));
  return out;
}

module.exports = { loadWalkthrough, loadWalkthroughSource, linesOf, lineText };
