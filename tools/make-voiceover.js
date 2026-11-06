// Generates a walkthrough's voiceover with ElevenLabs: one audio file per narration line, named after
// its transcript id (vo/style-2.mp3), which the player plays in narration mode 'audio'.
//
//   node tools/make-voiceover.js walkthroughs/quick-start            generate new and changed lines
//   node tools/make-voiceover.js walkthroughs/quick-start --dry-run  list what would be generated
//   node tools/make-voiceover.js walkthroughs/quick-start --only style-2,actions-1
//   node tools/make-voiceover.js walkthroughs/quick-start --force    regenerate every line
//   node tools/make-voiceover.js --voices                            list the voices on your account
//
// The API key comes from ELEVENLABS_API_KEY, or from a line ELEVENLABS_API_KEY=... in a .env file at the
// project root. The voice, model and settings come from walkthroughs/voice.json, overridden per
// walkthrough by narration.voice in its walkthrough.js. vo/manifest.json records what each file was made
// from, so unchanged lines are skipped (and not billed) on the next run.
const fs = require('fs');
const { listVoices, generate } = require('./lib/voiceover');

const args = process.argv.slice(2);
const flag = f => args.includes(f);
const opt = f => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };

(async () => {
  if (flag('--voices')) {
    for (const v of await listVoices()) console.log(`${v.id}  ${v.name.padEnd(28)} ${[v.description, v.category].filter(Boolean).join(', ')}`);
    console.log('\nPut the id you want in walkthroughs/voice.json ("voiceId"), or in a walkthrough\'s narration.voice.');
    return;
  }
  const dirs = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--only');
  if (!dirs.length) { console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(0, 15).map(l => l.replace(/^\/\/ ?/, '')).join('\n')); return; }
  const only = opt('--only') ? opt('--only').split(',').map(s => s.trim()) : null;
  for (const d of dirs) await generate(d, { only, force: flag('--force'), dryRun: flag('--dry-run') });
})().catch(e => { console.error(e.message); process.exitCode = 1; });
