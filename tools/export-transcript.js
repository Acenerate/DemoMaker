// Writes transcript.md for walkthroughs: every narration line, numbered, with a stable line id
// (chapter-n) to use as the audio file name when the voiceover is recorded.
// Usage: node tools/export-transcript.js walkthroughs/quick-start [walkthroughs/other ...]
const { exportTranscript } = require('./lib/transcript');

for (const dir of process.argv.slice(2)) {
  try {
    const r = exportTranscript(dir);
    console.log(`${r.file}: ${r.chapters} chapters, ${r.words} words`);
  } catch (e) { console.error(e.message); process.exitCode = 1; }
}
