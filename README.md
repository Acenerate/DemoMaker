# Klick-Zen docs — static offline copy

A standalone, dependency-free copy of https://docs.klick-zen.com in plain HTML, CSS and JavaScript.
Nothing is loaded from the network: every stylesheet, font, icon and image is in `site/assets/`.

## What's in `site/`

```
site/
  index.html                         "/" (renders the Introduction page, as on the live site)
  en/<section>/index.html            folder pages, e.g. en/managing-buttons/
  en/<section>/<page>/index.html     every documentation page (52 pages total)
  assets/
    css/      SnazzyDocs theme (sd_certainty), loader, error and highlight.js styles
    fonts/    Montserrat, Material Symbols Outlined (+ their CSS)
    vendor/   Font Awesome 6.7.1, KaTeX 0.16 CSS + fonts
    images/   logos, favicon and every image used in the docs
    js/app.js            the site's behaviour (replaces the SnazzyDocs runtime)
    js/search-index.js   the search index (same data the live site searches)
    js/fuse.min.js       Fuse.js 6.4.6, the fuzzy-search library the live site uses
```

## Viewing

- **Offline:** open `site/index.html` in a browser. Navigation happens in place, like the original
  single-page app. Browsers only let a page opened from disk change the query/hash part of its address,
  so offline the current page is shown as `index.html?p=en/managing-buttons/`; reloading or bookmarking
  that address reopens the same page.
- **Hosted:** upload the contents of `site/` to any static host (Netlify, S3, GitHub Pages, nginx...).
  Navigation happens in place and the address bar shows each page's real path.
- **Locally over http:** `python tools/serve.py 8780 site`, then open http://localhost:8780/.
  (`serve.py` is Python's static server plus support for Windows paths longer than 260 characters.)

Each page folder holds `index.html` (the complete page, used on first load and without JavaScript) and
`page.js` (just the parts that change between pages, loaded with a `<script>` tag during in-place
navigation, which works from disk as well as over http).

## Rebuilt behaviour (`assets/js/app.js`)

- In-place page navigation from the menu, content links and search results, with history/back support
  and the menu folders' open/close grid-row animation (including the open animation on page load)
- Dark mode toggle, remembered in `localStorage` exactly like the original (`isDarkmode`)
- Search modal: `/` or `⌘K` to toggle, `Esc` to close, click outside to close, arrow keys + Enter,
  hover selection, no-results message, same Fuse.js settings and result filtering as the original
- Image lightbox, mobile menu (open/close/backdrop), code-block copy button, linkable cards,
  permalink headings, in-page anchor scrolling with the original header offset, print button

## Walkthroughs (`walkthroughs/` + `framework/`)

Animated, captioned walkthroughs of Klick-Zen features, built on a reusable framework: an engine (the
player), a kit of recreated Klick-Zen and Zendesk screens, and one small `walkthrough.js` per
walkthrough. Every subfolder of `walkthroughs/` is a walkthrough (`quick-start/` is the first); the
shared engine, kit, assets and starter template live in `framework/`. See
[framework/README.md](framework/README.md) for the authoring guide.

- **Admin:** double-click `Start Admin.cmd` (or `node tools/admin/server.js`) to edit scripts, generate
  the voiceover, preview, manage walkthroughs, and ask Claude to build new ones, all in your browser.
  **Download ZIP** in its sidebar downloads `framework/` and `walkthroughs/` as one ZIP file.
- `python -I tools/serve.py 8791 . walkthroughs framework`, then open http://localhost:8791/ for the gallery
  (only those two folders are served, so `.env` stays private).
- `node tools/export-transcript.js walkthroughs/<name>` writes that walkthrough's `transcript.md`.
- `node tools/make-voiceover.js walkthroughs/<name>` generates its ElevenLabs voiceover (key in `.env`;
  voice in `walkthroughs/voice.json`).
- `node tools/read-docs.js [page]` lists or prints the Klick-Zen docs, from the live docs site set in
  `config.json` (falling back to the offline copy in `site/`).
- `node tools/snapshot-walkthrough.js walkthroughs/<name>` saves a screenshot per line to `raw/snapshots/`.
- `node tools/export-video.js walkthroughs/<name>` makes `exports/<name>.mp4` (YouTube-ready, 1080p) plus
  captions (`.srt`) and a YouTube title/description/chapters file. Needs FFmpeg.
- **Embedding** on another page (the docs site, say): the admin's Embed tab gives the iframe code; see
  "Embedding" in [framework/README.md](framework/README.md).
- `node tools/check-walkthrough.js walkthroughs/<name>` plays one start to finish in headless Chrome and reports
  any errors (used by Claude to verify its work).
- `tools/capture-frames.js` plays one in headless Chrome and saves timed screenshots for review.

## Rebuilding from the live site

`tools/` holds the pipeline that produced `site/`:

1. `tools/receiver.py` — proxies the live pages to `localhost:8765` so the original app renders them in a
   browser, and saves each rendered DOM to `captured/pages/`.
2. `tools/extract.py` — pulls the documentation state (`raw/doc.json`) out of the page shell.
3. `tools/build.py` — strips the SnazzyDocs scripts, downloads every referenced asset (recursing through
   CSS `url()`s), rewrites all URLs to relative local paths and writes `site/`.
   Run with `python -I tools/build.py`.
