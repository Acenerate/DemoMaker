// Exports a walkthrough as a YouTube-ready video: exports/<name>.mp4 (1920x1080, 30 fps, H.264 + AAC),
// exports/<name>.srt (captions) and exports/<name>.youtube.txt (title, description, chapters).
//
//   node tools/export-video.js walkthroughs/quick-start
//   node tools/export-video.js walkthroughs/quick-start --captions   captions burned into the picture too
//
// Needs FFmpeg (winget install Gyan.FFmpeg). Plays in real time, so it takes a little longer than the
// walkthrough itself.
const { exportVideo } = require('./lib/export-video');

const args = process.argv.slice(2);
const dir = args.find(a => !a.startsWith('--'));
if (!dir) { console.log('Usage: node tools/export-video.js walkthroughs/<name> [--captions]'); process.exitCode = 2; }
else exportVideo(dir, { captions: args.includes('--captions') }).catch(e => { console.error(e.message); process.exitCode = 1; });
