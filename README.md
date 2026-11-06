# DemoMaker: Klick-Zen walkthroughs

Animated, captioned walkthroughs of Klick-Zen features, built on a reusable framework: an engine (the
player), a kit of recreated Klick-Zen and Zendesk screens, and one small `walkthrough.js` per
walkthrough. Every subfolder of `walkthroughs/` is a walkthrough (`quick-start/` is the first); the
shared engine, kit, assets and starter template live in `framework/`. See
[framework/README.md](framework/README.md) for the authoring guide.

- **Admin:** double-click `StartAdmin.cmd` (or `node tools/admin/server.js`) to edit scripts, generate
  the voiceover, preview, manage walkthroughs, and ask Claude to build new ones, all in your browser.
  **Download ZIP** in its sidebar downloads `framework/` and `walkthroughs/` as one ZIP file.
- `python -I tools/serve.py 8791 . walkthroughs framework`, then open http://localhost:8791/ for the gallery
  (only those two folders are served, so `.env` stays private).
- `node tools/export-transcript.js walkthroughs/<name>` writes that walkthrough's `transcript.md`.
- `node tools/make-voiceover.js walkthroughs/<name>` generates its ElevenLabs voiceover (key in `.env`;
  voice in `walkthroughs/voice.json`).
- `node tools/read-docs.js [page]` lists or prints the Klick-Zen docs, from the docs site set in
  `config.json`. There's no local copy of the docs here; if the site can't be reached, it reports an error.
- `node tools/snapshot-walkthrough.js walkthroughs/<name>` saves a screenshot per line to `raw/snapshots/`.
- `node tools/export-video.js walkthroughs/<name>` makes `exports/<name>.mp4` (YouTube-ready, 1080p) plus
  captions (`.srt`) and a YouTube title/description/chapters file. Needs FFmpeg.
- **Embedding** on another page (the docs site, say): the admin's Embed tab gives the iframe code; see
  "Embedding" in [framework/README.md](framework/README.md).
- `node tools/check-walkthrough.js walkthroughs/<name>` plays one start to finish in headless Chrome and reports
  any errors (used by Claude to verify its work).
- `tools/capture-frames.js` plays one in headless Chrome and saves timed screenshots for review.
