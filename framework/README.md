# Klick-Zen walkthroughs

Animated, captioned walkthroughs of Klick-Zen features, built on a small framework in plain
HTML, CSS and JavaScript. No build step, no dependencies. Open them straight from disk, or host the
`walkthroughs/` and `framework/` folders side by side on any static host.

```
walkthroughs/           every subfolder is a walkthrough, and nothing else
  index.html            gallery page of all walkthroughs
  gallery.js            which walkthroughs the gallery lists, in order
  voice.json            ElevenLabs voice and settings shared by every walkthrough
  quick-start/          a walkthrough: index.html, walkthrough.js, transcript.md, vo/ (audio)
framework/              the shared machinery (this guide lives here)
  engine/               the player: timeline, cursor, camera, captions, controls, transcript
  kit/                  recreated Klick-Zen + Zendesk screens and their renderer
  assets/               logos, favicon, font
  template/             a runnable starter: copy this to make a new walkthrough
```

## The admin tool

Day-to-day work happens in the admin: double-click **`Start Admin.cmd`** in the project folder (or
run `node tools/admin/server.js`). It opens http://localhost:8800/ in your browser; close the command
window to stop it. It only works on your own computer. From there you can:

- **Script & voiceover:** edit any narration line (Ctrl+Enter saves it to `walkthrough.js` and
  refreshes `transcript.md`). See each line's audio state (ready, needs new audio, or none) and play
  its clip. Generate audio for every changed line, regenerate one line, or regenerate all; the
  ElevenLabs character cost is shown on each button. "Spoken as" shows a line's pronunciation swaps.
- **Preview:** the walkthrough exactly as viewers see it, with buttons that jump to each chapter.
- **Video:** exports a YouTube-ready video to `exports/<name>.mp4` (1920×1080, 30 fps, H.264 + AAC), along
  with `<name>.srt` (captions with matching timings) and `<name>.youtube.txt` (title, description and
  chapter timestamps to paste into YouTube Studio). It plays the walkthrough once in the background in
  real time, records every frame, and lays the original voice clips onto the soundtrack at the exact
  moments they played. Captions can also be burned into the picture. The tab shows the latest export,
  with download links, a copy button for the description, and a warning when the walkthrough has
  changed since. It needs FFmpeg (`winget install Gyan.FFmpeg`). From the command line:
  `node tools/export-video.js walkthroughs/<name> [--captions]`. YouTube only accepts chapters of
  10 seconds or more, so shorter steps are combined with the one before ("Step 1: … & Label the button").
- **Embed:** builds the code to put the interactive player on another web page (see "Embedding" below):
  pick a size, colours and how captions start, see a preview at that size, and copy the code.
- **Settings:** title, subtitle, tempo, captions on or off at the start (for one walkthrough or all of
  them), narration mode (captions, recorded audio or browser voice),
  the walkthrough's **voice** (with a Preview button), and its gallery card. A walkthrough's own voice
  pick is stored in its folder's `voice.json`; without one it uses the default.
- **Ask Claude:** a chat with Claude Code, working in this project. Pick **New walkthrough**, choose
  a docs page (listed live from the docs site; see "The docs" below), audience and length, and Claude
  writes the script, builds the scenes and animation, adds
  it to the gallery, and checks it plays (`tools/check-walkthrough.js`). Follow-up messages continue
  the same conversation ("make step 3 shorter", "add the confirmation page"). It follows the project
  guide in `CLAUDE.md`, and it can't generate audio or touch `.env`. It needs the Claude Code CLI,
  installed and signed in, and uses your Claude plan.
- **New walkthrough:** copies the template into `walkthroughs/<name>/` and adds it to the gallery.
- **Gallery order:** reorder, add or remove the walkthroughs on the gallery page.
- **Voices:** the ElevenLabs voices to choose from (name and voice ID), which one is the default, and a
  preview of each. Changing the default means every walkthrough using it needs new audio. Previews are
  cached in `raw/voice-preview/`, so replaying one is free. The same page edits the **pronunciations**
  shared by every walkthrough and voice, each with its own preview. Lines containing a changed word
  then show as needing new audio.

What still happens in `walkthrough.js` is anything structural: scenes, animations, and adding,
removing or reordering lines, since each line is paired with its animation step. The model and voice
settings (shared by every voice) are set in `walkthroughs/voice.json`.

### The docs

Walkthroughs are built from the Klick-Zen docs. `config.json` in the project folder says where they
are:

```json
{ "docsUrl": "http://docs.klick-zen.com.localhost/" }
```

Change it to `https://docs.klick-zen.com/` once the new site is published. `node tools/read-docs.js`
lists every page (from the site's `sitemap.xml`), and `node tools/read-docs.js landing-pages/overview`
prints a page's text. Claude uses it to read the docs. If the site can't be reached, it falls back to
the offline copy in `site/` and says so, since that copy may be out of date.

## Making a new walkthrough

1. In the admin, click **New walkthrough** (or copy `framework/template/` to `walkthroughs/<name>/`
   and add it to `walkthroughs/gallery.js` yourself).
2. Edit `walkthrough.js`: the scenes, the model, and the chapters (see below).
3. Refine the wording in the admin. Each save also updates `transcript.md`; from the command line,
   `node tools/export-transcript.js walkthroughs/landing-pages` does the same.
4. Preview it in the admin's Preview tab, or just open its `index.html`.
5. When the script is final, set Narration to Recorded audio in the admin's Settings tab and
   generate the voiceover there (or see [Making the voiceover](#making-the-voiceover-elevenlabs)
   for the command line).

## How a walkthrough is put together

```js
KZWalkthrough.create({
  title, subtitle, logo: { light, dark },
  intro: { title, text },                       // start screen
  end:   { title, text, link: { href, label } }, // end screen
  narration: { mode: 'transcript' },
  tempo: 1,                                     // overall speed (see Pacing)
  captions: false,                              // start with captions off (default: on)
  stage: '...scenes...',                        // HTML for the 1280x720 stage
  state: { ... },                               // the model
  render(M, api) { ... },                       // draws the model onto the stage
  chapters: [ ... ]
});
```

**Stage and scenes.** The stage is a fixed 1280x720 canvas that scales to fit the page. It holds
*scenes*: `<section class="scene" data-scene="name">`. The model's `scene` value decides which one is
showing (they cross-fade). Wrap a scene's content in `<div class="cam">` to be able to zoom into it.
Elements with `class="reveal" data-r="N"` fade in once the model's `reveal` value reaches N.

**Model and render.** Everything that changes on screen lives in the model (`state`). Animations
change the model with `h.set()` / `h.update()`, and `render(M)` draws it. Because each chapter declares
the model it starts from, any chapter can be jumped to directly and look right.

**Chapters.** A chapter is one segment of the progress bar:

```js
{
  id: 'style',                  // stable id (used for transcript line ids and audio file names)
  title: 'Make it yours',
  step: 3,                      // optional: shows the "Step 3 of N" badge
  start: { label: 'Close Ticket' },   // model patch applied when the chapter starts
  lines: ['First caption.', 'Second caption.'],
  async run(h) {
    await h.beat(0, async () => { /* animation shown with line 0 */ });
    await h.beat(1, async () => { /* animation shown with line 1 */ });
  }
}
```

`h.beat(i, fn)` shows line *i* and runs the animation at the same time. The next beat starts when
**both** have finished, so changing a line's wording never breaks the timing.

A chapter's starting model is the `state` plus every earlier chapter's `start` patch, plus its own.
During continuous play the previous chapter's end state carries straight through.

## Pacing

A walkthrough's length is mostly its narration: a line's animation runs *while* the line is spoken,
and the next line waits for both. So:

- **Overall speed.** `tempo: 1.2` plays the whole walkthrough 20% faster: voice, cursor, typing,
  zooms, fades and pauses together, with no regeneration. Viewers also get a speed button
  (1×, 1.25×, 1.5×, 2×, or the `<` and `>` keys) that multiplies on top of `tempo`. Browsers keep the
  voice's pitch natural when it is sped up.
- **Dead time.** Anything awaited *outside* a `h.beat()` (such as an opening `h.cam()`) plays in
  silence, so do it as the first step inside beat 0 instead. Within a beat, keep the animation no
  longer than its line. Shorten `h.sleep()`s, or type faster (`h.type(..., { speed })`, ms per
  character).
- **Finding it.** `tools/capture-frames.js` and a timed run show which lines' animations outlast their
  audio. The gap after a line should be about 0.3 seconds.

## Helper reference (`h`)

| Helper | What it does |
|---|---|
| `h.beat(i, fn)` | Show line *i* while `fn` runs; wait for both. |
| `h.set(patch)` / `h.update('a.b.0', v)` | Change the model and re-render. |
| `h.M` | Read the model. |
| `h.move(sel, { fx, fy, dx, dy, ms })` | Glide the cursor to an element (fx/fy = point inside it, 0 to 1). |
| `h.click()` | Click (press animation and ripple). |
| `h.type('path', text, { speed, replace })` | Type into a model string, a character at a time. |
| `h.erase('path', { count })` | Backspace a model string. |
| `h.cam(sel, zoom, fx, fy)` / `h.camReset(scene?, wait?)` | Zoom the camera onto an element / zoom back out. |
| `h.tween('path', to, ms)` | Animate a number, such as a scroll offset. |
| `h.drag(trackSel, 'path', to, ms, { min, max })` | Drag a slider; the cursor follows. |
| `h.choose(sel, items, index, { pass })` | Click a select and pick from its dropdown. |
| `h.pickColor(sel, colors, index)` | Open a swatch grid and pick a color. |
| `h.ring(sel, pad)` / `h.ring(null)` | Pulse a highlight ring around an element. |
| `h.keycap('Ctrl+V')` / `h.keycap(false)` | Show a keyboard shortcut. |
| `h.tag('Your customer')` / `h.tag(false)` | Label the cursor. |
| `h.park()` | Move the cursor off-stage. |
| `h.sleep(ms)` | Wait. |

Selectors are looked up inside the stage. A missing element throws an error that names the selector
(check the browser console).

## The Klick-Zen kit (`KZKit`)

Ready-made scenes, each with default content that you can override:

- `titleScene({ headline, lead, card })` and `outroScene({ headline, ideas, cta })`: branded cards.
- `zendeskScene({ views, trigger, ticket })`: the Zendesk workspace. The model's `zdView` switches
  between `views` (ticket list), `kz` (the Klick-Zen app), `trigger` (trigger editor) and `ticket`.
  Inside the app, `kzView` switches between `home`, `editor` and `list`.
- `inboxScene({ subject, from, paragraphs })`: a customer's email. Its button mirrors the button
  being built (`label`, `bg`, `fg`, `bold`, `round`).
- `browserScene({ url, body })` and `landingPage({ heading, subheading, paragraphs, logo })`. Landing
  pages show the customer's branding, so the header defaults to the dummy "Acme Support" logo. Never
  use the Klick-Zen logo on one.
- `zdNav({ active, ids })`: the Zendesk left sidebar on its own, for a custom Zendesk screen, so its
  icons match the kit's. `active` is `'home'`, `'app'` or `'admin'`. Pass `ids: false` so its ids
  don't clash with `zendeskScene`'s.

`KZKit.defaults()` lists every model key the kit draws. Spread it into your `state`, and use
`KZKit.render` as your `render` (or call it from yours). Useful constants: `ACTIONS`, `STATUSES`,
`PALETTE`, `GREEN`, `SNIPPET`, `MARKETPLACE`. Element ids (`#kz-preview`, `#tr-body`, `#tk-badge`,
...) are fixed, so use each kit screen once per walkthrough.

For a screen the kit doesn't have, write a custom scene in `stage` (with its CSS in the page's
`<style>`) and draw it in your `render`, as `framework/template` does. If a screen will be needed in more than
one walkthrough, add it to the kit instead.

## Narration and voice

Every line has a stable id, `<chapter id>-<n>` (`style-2`, ...). `tools/export-transcript.js` writes
them all to `transcript.md`. `narration.mode` picks how lines are delivered:

| Mode | What plays |
|---|---|
| `'audio'` | `vo/<line id>.mp3` for each line (the voiceover made below). The player waits for each clip to end, and buffers the next one while this one plays. |
| `'transcript'` | Captions only, each shown for its reading time (`narration.wordsPerSecond`, default 2.6). |
| `'speech'` | The browser's built-in voices, with a voice picker. Quality depends on the viewer's browser. |

In every mode the captions, the mute button and the transcript panel work the same way, and an
animation never gets ahead of its line. In `'audio'` mode a missing clip falls back to the caption's
reading time (with a warning in the console), so a walkthrough still plays while its voiceover is
being made. Muting holds each caption for its reading time instead. A single line can also point at
its own file: `{ text: '...', audio: 'vo/custom.mp3' }`.

### Making the voiceover (ElevenLabs)

1. Put your API key in a `.env` file in the project root (copy `.env.example`):
   `ELEVENLABS_API_KEY=...`. `.env` is git-ignored. Setting the `ELEVENLABS_API_KEY` environment
   variable works too.
2. Pick the voice. `node tools/make-voiceover.js --voices` lists the voices on your account. Put the
   id in `walkthroughs/voice.json`, which every walkthrough shares so they all sound alike.
3. Check what will be generated (and how many characters it costs):
   `node tools/make-voiceover.js walkthroughs/quick-start --dry-run`
4. Generate: `node tools/make-voiceover.js walkthroughs/quick-start`. This writes `vo/*.mp3` and
   `vo/manifest.json` in the walkthrough's folder.

Re-run step 4 after editing the script: only new or changed lines are generated (and billed). Clips
for deleted lines are removed. `--only style-2,actions-1` remakes specific lines (for a take you
don't like), and `--force` remakes them all (after changing the voice).

`voice.json` holds:

- `voiceId`, `voiceName`, `model` (`eleven_multilingual_v2` is ElevenLabs' most natural model), and
  `outputFormat`.
- `settings`: `stability` (lower is more expressive, higher is steadier), `similarity_boost`,
  `style`, `use_speaker_boost`, and `speed`.
- `pronunciations`: words the voice should say differently from how the caption spells them. For
  example, `"Klick-Zen": "Click Zen"` keeps the brand spelling on screen but makes the voice say it
  right. Edit these on the admin's Voices page.

A walkthrough can override any of these with `narration: { mode: 'audio', voice: { ... } }`. Each
line is generated knowing the lines before and after it, so the intonation flows across clips.

## Reviewing

`tools/capture-frames.js` plays a walkthrough in headless Chrome and saves a screenshot at a fixed
interval, so you can check every scene without watching in real time:

```
node tools/capture-frames.js "C:/Program Files/Google/Chrome/Application/chrome.exe" http://localhost:8791/walkthroughs/quick-start/index.html raw/frames <profile dir> 2500 200000 [chapter]
```

Set `SCALE=1` for full-size frames and `WIDTH=390` to check a phone layout.

## Embedding

Any walkthrough can sit on another page (the docs site, a landing page, a help article) as an iframe:

```html
<iframe src="/walkthroughs/quick-start/?embed" title="Quick Start" style="display:block;width:100%;max-width:959px;aspect-ratio:16/12.5;border:0;color-scheme:normal" loading="lazy"></iframe>
<script src="/framework/embed.js" async></script>
```

The admin's **Embed** tab writes this for you. To host it, copy the walkthrough's folder and the
`framework` folder to the site side by side (`/walkthroughs/<name>/` and `/framework/`); for another
site, put the full address in front of both paths.

- **Size:** `max-width` is the most it grows to; it shrinks to fit narrower columns and phones. The
  picture always keeps 16:9 and scales as a whole, so any width works (about 360px and up reads well).
  Below 480px the controls get more compact.
- **Phones:** at 640px wide or less, the embed is a card (title, rough length, play button) instead of
  the player, because the picture is too small to read at that width. Its play button makes the iframe
  fill the window and starts playing, with captions on (even with `&captions=off`), a close button, and
  controls that hide in landscape. Closing takes one history step back, so a page that handles
  `popstate` itself must ignore a step onto the page already showing. This needs `embed.js`; without
  it the embed stays as the normal player.
- **Height:** `framework/embed.js` (once per page) makes each iframe exactly as tall as its player,
  including when the transcript opens. Without it the iframe uses its aspect ratio and scrolls.
  `data-resize="false"` stops the docs site's own script forcing iframes to 16:9, which cuts off the controls.
- **Colours:** with `embed.js` the player matches the page around it, light or dark, and follows the
  page's own dark-mode switch. `&theme=light` or `&theme=dark` pins it.
- **Captions:** they start as the walkthrough's Captions setting says. `&captions=off` or `&captions=on`
  overrides that for this embed (viewers can still switch them). This also works on a direct link to the
  player, with `?captions=off`.
- **Full screen:** browsers allow it by default when the player is on the same site as the page, so the
  player shows its full-screen button. `allow="fullscreen 'none'"` on the iframe hides it. Embedded from
  another site, it needs `allow="fullscreen"` to appear.

Embed mode drops the title header and page padding and makes the page see-through. `?video` is a
separate mode used only by the video export.
