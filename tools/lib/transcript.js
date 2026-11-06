// Writes a walkthrough's transcript.md: every narration line, numbered, with its stable line id
// (chapter-n), which is also its audio file name. Used by tools/export-transcript.js and the admin GUI.
const fs = require('fs');
const path = require('path');
const { loadWalkthrough } = require('./load-walkthrough');
const { writeFile } = require('./fs-retry');

function exportTranscript(dir) {
  const def = loadWalkthrough(dir);
  if (!def) throw new Error(`${path.join(dir, 'walkthrough.js')}: KZWalkthrough.create() was not called`);
  const words = def.chapters.reduce((n, c) => n + c.lines.reduce((m, l) => m + (typeof l === 'string' ? l : l.text).split(/\s+/).length, 0), 0);
  let md = `# ${def.title}\n\n${def.subtitle ? def.subtitle + '\n\n' : ''}`;
  md += `${def.chapters.reduce((n, c) => n + c.lines.length, 0)} lines, ${words} words (about ${Math.round(words / 150 * 60)} seconds of narration at 150 words per minute).\n`;
  def.chapters.forEach(c => {
    md += `\n## ${c.step ? `Step ${c.step}: ` : ''}${c.title}\n\n`;
    c.lines.forEach((l, i) => {
      const text = typeof l === 'string' ? l : l.text;
      const audio = typeof l === 'object' && l.audio ? ` (audio: \`${l.audio}\`)` : '';
      md += `${i + 1}. ${text} \`${c.id}-${i + 1}\`${audio}\n`;
    });
  });
  const file = path.join(dir, 'transcript.md');
  writeFile(file, md);
  return { file, chapters: def.chapters.length, words };
}

module.exports = { exportTranscript };
