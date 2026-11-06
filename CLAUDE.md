# DemoMaker: Klick-Zen walkthroughs

This project makes animated, narrated product walkthroughs of Klick-Zen (a Zendesk app for one-click
email buttons), for potential customers. Plain HTML/CSS/JS, no build step, no dependencies.

## Where things are

- `walkthroughs/<name>/`: one folder per walkthrough. `index.html` loads the framework, and
  `walkthrough.js` holds the script and animations. `transcript.md` is generated, and `vo/` holds the
  generated audio. `walkthroughs/gallery.js` lists walkthroughs on the gallery page, and
  `walkthroughs/voice.json` holds the shared ElevenLabs voice.
- `framework/`: the shared engine (`engine/player.js`), the kit of recreated Klick-Zen/Zendesk screens
  (`kit/klickzen.js` + `.css`), assets, and `template/` (the starter for new walkthroughs).
  **`framework/README.md` is the authoring guide**: read it before building or changing a walkthrough.
- `walkthroughs/quick-start/walkthrough.js` is the finished reference example. Follow its style and
  pacing.
- **The Klick-Zen docs are the source of truth** for what a feature does, its steps, its settings and
  their exact labels. Read them with `node tools/read-docs.js`: with no arguments it lists every page
  (path and title); with page paths (`node tools/read-docs.js landing-pages/overview`) it prints their
  text. It reads the docs site set in `config.json`. If the site can't be reached it reports an error;
  stop and say so rather than writing from memory.
- `tools/`: command-line tools. `tools/admin/` is the local admin web app.

## Making a new walkthrough

1. Read the relevant docs pages with `node tools/read-docs.js` (list them first, then read the main
   page and closely related ones), plus `framework/README.md` and the Quick Start example.
2. Create `walkthroughs/<name>/` (lowercase, dashes) from `framework/template/`, by writing
   `index.html` (set its `<title>`) and `walkthrough.js`. Don't copy `transcript.md` or `vo/`.
3. Write the script for a potential customer: warm, plain, benefit-first. Keep it short: about 2
   minutes, 15 to 25 lines, each 1 to 2 sentences. Use the product's real labels from the docs.
4. Build scenes from the kit where possible (`KZKit.zendeskScene`, `inboxScene`, `browserScene`,
   `titleScene`, `outroScene`, ...). If a screen is missing and others will need it too, add it to the
   kit; otherwise make a custom scene in the walkthrough (as the template shows).
5. Pacing (see "Pacing" in the guide): run zooms inside the first `h.beat()`, not before it. Keep
   each beat's animation about as long as its line (roughly 2.6 words per second). Every chapter needs
   `id`, `title`, `start` (so it can be jumped to directly), `lines` and `run`.
6. Use `narration: { mode: 'transcript' }` and no `tempo` until the user has approved the script.
7. Add the walkthrough to `walkthroughs/gallery.js` (folder, title, one-line summary, rough length).
8. Run `node tools/export-transcript.js walkthroughs/<name>`.
9. **Verify it runs:** `node tools/check-walkthrough.js walkthroughs/<name>`. It plays the whole
   walkthrough in headless Chrome at high speed and reports errors (such as a selector that doesn't
   exist). Fix everything it reports and re-run until it passes.
10. **Verify it looks right:** `node tools/snapshot-walkthrough.js walkthroughs/<name>` saves one image
    per line to `raw/snapshots/<name>/` (it empties that folder itself) and lists them. Open the images
    and check for overlapping or cut-off elements, text spilling out of boxes, the cursor pointing at the
    wrong thing, and empty screens. Add a chapter id to capture just that chapter, and `--mid` for
    mid-line images too. Fix what you find, then re-run both checks.

## Running commands

Commands run in the project folder, and only these are allowed without approval (nobody can approve
anything while you work from the admin panel): `node tools/check-walkthrough.js`,
`node tools/snapshot-walkthrough.js`, `node tools/export-transcript.js`, `node tools/read-docs.js`,
`ls`, `mkdir`, `cp`. So:

- Run them as plain single commands: no `cd`, no `VAR=value` prefixes, no `&&` chains, no `rm`.
- Give docs paths without a leading slash (`landing-pages/overview`, not `/landing-pages/overview/`).
- Use `tools/snapshot-walkthrough.js` for screenshots, not `tools/capture-frames.js`.
- Create and change files with your file tools (Write/Edit), not shell commands. Never delete a
  walkthrough folder.

## Rules

- **Never run `tools/make-voiceover.js`** or anything else that calls ElevenLabs: it spends the
  user's paid credits. The user generates audio in the admin when the script is final.
- Don't change `walkthroughs/voice.json`, any walkthrough's own `voice.json`, `config.json` or `.env`,
  and never print or copy the API key.
- Don't change `framework/engine/` or the kit in ways that alter existing walkthroughs. If an engine
  or kit change is needed, check every walkthrough still passes `tools/check-walkthrough.js`.
- In custom scenes, use your own class names and ids (prefix them with the walkthrough's name, such as
  `te-panel`), never the kit's (`zd`, `kz`, `mail`, ...).
- Narration lines are plain strings so the admin can edit them. Adding, removing or reordering lines
  means updating the matching `h.beat(i, ...)` calls.
- Finish with a short summary for the user: what was made or changed, the walkthrough's folder, its
  length in lines and words, and what to review in the admin (Preview tab, then wording, then audio).
