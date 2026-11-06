/*
 * Walkthrough engine.
 *
 *   KZWalkthrough.create({
 *     title, subtitle, logo: { light, dark },
 *     intro: { title, text, play }, end: { title, text, link: { href, label } },
 *     narration: { mode: 'transcript' | 'audio' | 'speech', wordsPerSecond, dir, ext },
 *     tempo: 1,                               // overall speed: 1.2 plays everything 20% faster
 *     stage: '<section class="scene" data-scene="...">...</section>...',
 *     state: { scene: '...', ... },          // the model; render() draws it
 *     render(M, api) { ... },                 // update the stage DOM from the model
 *     chapters: [{ id, title, step?, start?: {patch}, lines: ['...' | { text, audio }], async run(h) { ... } }]
 *   });
 *
 * A chapter's run(h) plays its lines with h.beat(i, async () => { ...animation... }): the line is
 * shown (and spoken, if a voice is configured) while the animation runs, and the next beat starts
 * when both are done. See README.md for the full helper reference.
 */
(function (global) {
  'use strict';

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clone = o => JSON.parse(JSON.stringify(o));
  const lineText = l => (typeof l === 'string' ? l : l.text);
  const getPath = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  function setPath(o, p, v) {
    const k = p.split('.');
    let t = o;
    for (let i = 0; i < k.length - 1; i++) t = t[k[i]];
    t[k[k.length - 1]] = v;
  }

  const ABORT = { abort: true };
  const PLAY_ICON = '<path fill="currentColor" d="M8 5.5v13l11-6.5z"/>';
  const PAUSE_ICON = '<path fill="currentColor" d="M7 5h4v14H7zM13 5h4v14h-4z"/>';
  const CURSOR_SVG = '<svg viewBox="0 0 28 28"><path d="M4 2.5v19.2l5-4.8 3.6 7.9 3.7-1.7-3.6-7.7h6.9z" fill="#fff" stroke="#1d2b30" stroke-width="1.6" stroke-linejoin="round"/></svg>';

  function create(def) {
    const chapters = def.chapters;
    const steps = chapters.filter(c => c.step).length;
    const narration = Object.assign({ mode: 'transcript', wordsPerSecond: 2.6, dir: 'vo', ext: 'mp3' }, def.narration);
    // Audio file for line j of chapter c: an explicit { audio } wins; in 'audio' mode every line
    // has one, named after its transcript id (vo/style-2.mp3), as tools/make-voiceover.js writes it.
    const audioSrc = (c, j) => {
      const l = chapters[c] && chapters[c].lines[j];
      if (!l) return null;
      if (typeof l === 'object' && l.audio) return l.audio;
      return narration.mode === 'audio' ? `${narration.dir}/${chapters[c].id}-${j + 1}.${narration.ext}` : null;
    };
    const hasAudio = narration.mode === 'audio' || chapters.some(c => c.lines.some(l => typeof l === 'object' && l.audio));
    const voiced = narration.mode === 'speech' || hasAudio;
    const logo = def.logo || {};
    const intro = Object.assign({ title: def.title, text: '', play: 'Play walkthrough' }, def.intro);
    // Rough length for the phone card, from the narration's reading time.
    const words = chapters.reduce((n, c) => n + c.lines.reduce((w, l) => w + lineText(l).split(/\s+/).length, 0), 0);
    const minutes = Math.max(1, Math.round(words / narration.wordsPerSecond / (def.tempo || 1) / 60));

    /* ------------------------------------------------------------ chrome */
    const root = typeof def.mount === 'string' ? $(def.mount) : (def.mount || $('#player'));
    root.classList.add('w-player');
    // Video mode (?video, used by tools/export-video.js): only the 16:9 picture fills the window, with
    // the captions over it when &captions is also given.
    const params = new URLSearchParams(global.location ? global.location.search : '');
    if (params.has('video')) {
      document.documentElement.classList.add('w-video-mode');
      if (params.has('captions')) document.documentElement.classList.add('w-video-captions');
    }
    // Embed mode (?embed, for an iframe on another page; see framework/embed.js): no header or page
    // padding, a transparent page, and the page's height reported to the host so the iframe fits it.
    // &theme=light|dark pins the colours.
    const embed = params.has('embed');
    if (embed) document.documentElement.classList.add('w-embed');
    if (/^(light|dark)$/.test(params.get('theme') || '')) document.documentElement.dataset.theme = params.get('theme');
    const canFull = !!(document.fullscreenEnabled && root.requestFullscreen);
    root.innerHTML = `
      <header class="w-head">
        ${logo.light ? `<img class="w-logo-light" src="${esc(logo.light)}" alt="">` : ''}
        ${logo.dark ? `<img class="w-logo-dark" src="${esc(logo.dark)}" alt="">` : ''}
        <div><h1>${esc(def.title || '')}</h1>${def.subtitle ? `<p>${esc(def.subtitle)}</p>` : ''}</div>
      </header>
      <div class="w-viewport">
        <div class="w-stage" aria-hidden="true">
          ${def.stage}
          <div class="w-step"><b></b><div><small></small><span></span></div></div>
          <div class="w-ring"></div>
          <div class="w-keycap"></div>
          <div class="w-cursor">${CURSOR_SVG}<span class="w-cursor-tag"></span></div>
        </div>
        <div class="w-overlay w-start">
          ${logo.dark ? `<img src="${esc(logo.dark)}" alt="">` : ''}
          <h2>${esc(intro.title)}</h2>
          <p>${esc(intro.text)}</p>
          <small class="w-card-len">About ${minutes} min</small>
          <button class="w-bigplay" type="button"><svg viewBox="0 0 24 24">${PLAY_ICON}</svg><span>${esc(intro.play)}</span></button>
          <a class="w-endlink" target="_blank" rel="noopener" hidden></a>
        </div>
      </div>
      <div class="w-caption" aria-live="polite">Press play to start the walkthrough.</div>
      <div class="w-controls">
        <button class="w-ctl w-play" type="button" aria-label="Play"><svg viewBox="0 0 24 24">${PLAY_ICON}</svg></button>
        <button class="w-ctl w-restart" type="button" aria-label="Restart"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v5h5"/></svg></button>
        <div class="w-segs"></div>
        <span class="w-now"></span>
        <button class="w-ctl w-cc" type="button" aria-pressed="true" aria-label="Captions">CC</button>
        <button class="w-ctl w-tx" type="button" aria-pressed="false">Transcript</button>
        ${voiced ? `<button class="w-ctl w-mute" type="button" aria-pressed="true" aria-label="Narration"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 9v6h4l5 4V5L8 9z"/><path class="w-waves" d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg></button>` : ''}
        ${narration.mode === 'speech' ? '<select class="w-voice" aria-label="Narrator voice"></select>' : ''}
        <button class="w-ctl w-speed" type="button" aria-label="Playback speed" title="Playback speed">1×</button>
        ${canFull ? `<button class="w-ctl w-full" type="button" aria-label="Full screen" title="Full screen"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/></svg></button>` : ''}
      </div>
      <div class="w-transcript" hidden></div>
      <p class="w-note"></p>
      <button class="w-close" type="button" aria-label="Close walkthrough"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      <p class="w-rotate"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="3" width="8" height="14" rx="1.5"/><path d="M4 15a8 8 0 0 0 8 6M4 15l-1.5 3M4 15l3 1.5"/></svg>Turn your phone sideways for a larger view</p>`;

    const stage = $('.w-stage', root), viewport = $('.w-viewport', root), cursor = $('.w-cursor', root);
    const caption = $('.w-caption', root), startOverlay = $('.w-start', root);
    const q = s => stage.querySelector(s);

    /* ------------------------------------------------------------ tempo */
    // One playback rate drives everything: waits, cursor moves, typing, tweens, narration and every
    // CSS transition/animation on the stage. rate = the author's tempo x the viewer's speed choice.
    const SPEEDS = [1, 1.25, 1.5, 2];
    const tempo = def.tempo || 1;
    let viewerSpeed = 1;
    try { const v = +localStorage.getItem('w-speed'); if (SPEEDS.includes(v)) viewerSpeed = v; } catch (e) { /* storage unavailable */ }
    let rate = tempo * viewerSpeed;
    const scaleAnims = target => (target.getAnimations ? target.getAnimations(target === stage ? { subtree: true } : undefined) : []).forEach(a => { a.playbackRate = rate; });
    ['transitionrun', 'animationstart'].forEach(ev => stage.addEventListener(ev, e => scaleAnims(e.target), true));
    function setSpeed(v) {
      viewerSpeed = v;
      rate = tempo * viewerSpeed;
      try { localStorage.setItem('w-speed', String(v)); } catch (e) { /* storage unavailable */ }
      const b = $('.w-speed', root);
      b.textContent = v + '×';
      b.classList.toggle('on', v !== 1);
      scaleAnims(stage);
      if (audio) audio.playbackRate = rate;
    }

    /* ----------------------------------------------------- scale to fit */
    let S = 1;
    function fit() { S = viewport.clientWidth / 1280; stage.style.transform = `scale(${S})`; }
    window.addEventListener('resize', fit);
    fit();

    /* ------------------------------------------------------------ model */
    let M = clone(def.state || {});
    function startState(i) {
      const m = clone(def.state || {});
      for (let k = 0; k <= i; k++) Object.assign(m, clone(chapters[k].start || {}));
      return m;
    }
    const api = { $: q, $$: s => $$(s, stage), esc, stage };
    function render() {
      $$('.scene', stage).forEach(s => s.classList.toggle('on', s.dataset.scene === M.scene));
      $$('.reveal', stage).forEach(el => {
        const sc = el.closest('.scene');
        el.classList.toggle('in', !!sc && sc.dataset.scene === M.scene && +el.dataset.r <= (M.reveal ?? -1));
      });
      if (def.render) def.render(M, api);
    }

    /* ---------------------------------------------------------- geometry */
    const CAM = {};
    const sceneOf = el => { const s = el.closest('.scene'); return s ? s.dataset.scene : null; };
    const camEl = key => stage.querySelector(`.scene[data-scene="${key}"] > .cam`);
    const camOf = key => CAM[key] || { x: 0, y: 0, z: 1 };

    // Rect in unscaled stage coordinates (what's on screen, after camera zoom).
    function stageRect(el) {
      const r = el.getBoundingClientRect(), sr = stage.getBoundingClientRect();
      return { x: (r.left - sr.left) / S, y: (r.top - sr.top) / S, w: r.width / S, h: r.height / S };
    }
    // Rect in the scene camera's own coordinates (before zoom).
    function camRect(el) {
      const c = camOf(sceneOf(el)), r = stageRect(el);
      return { x: (r.x - c.x) / c.z, y: (r.y - c.y) / c.z, w: r.w / c.z, h: r.h / c.z };
    }
    function setCam(key, c) {
      const el = camEl(key);
      if (!el) return;
      CAM[key] = c;
      el.style.transform = `translate(${c.x}px,${c.y}px) scale(${c.z})`;
    }
    function camFocus(el, z, fx = 0.5, fy = 0.5) {
      const r = camRect(el), cx = r.x + r.w * fx, cy = r.y + r.h * fy;
      setCam(sceneOf(el), {
        x: Math.min(0, Math.max(1280 - 1280 * z, 640 - cx * z)),
        y: Math.min(0, Math.max(720 - 720 * z, 360 - cy * z)),
        z
      });
    }
    function camReset(key) {
      const keys = key ? [key] : $$('.scene > .cam', stage).map(c => c.parentNode.dataset.scene);
      keys.forEach(k => setCam(k, { x: 0, y: 0, z: 1 }));
    }

    let cur = { x: 1300, y: 760 };
    function placeCursor(x, y, ms) {
      cursor.style.transitionDuration = (ms || 0) + 'ms';
      cursor.style.transform = `translate(${x}px,${y}px)`;
      cur = { x, y };
    }
    function ring(el, pad = 8) {
      const g = $('.w-ring', stage);
      if (!el) { g.classList.remove('show'); return; }
      const r = stageRect(el);
      Object.assign(g.style, { left: r.x - pad + 'px', top: r.y - pad + 'px', width: r.w + pad * 2 + 'px', height: r.h + pad * 2 + 'px' });
      g.classList.add('show');
    }
    function keycap(text) {
      const k = $('.w-keycap', stage);
      if (text) k.innerHTML = String(text).split('+').map(p => `<kbd>${esc(p.trim())}</kbd>`).join(' + ');
      k.classList.toggle('show', !!text);
    }
    function tag(text) {
      if (text) $('.w-cursor-tag', cursor).textContent = text;
      cursor.classList.toggle('tagged', !!text);
    }
    function closeOverlays() { $$('.w-dd, .w-picker', stage).forEach(d => d.remove()); }
    function overlayParent(anchor) { return camEl(sceneOf(anchor)) || stage; }
    // Keep a menu or picker (already placed below its anchor) on screen: open it upward when it doesn't
    // fit below, as real menus do; if it fits neither way, pan the camera just enough to show it.
    function fitOverlay(menu, anchor, gap) {
      const EDGE = 10, m = stageRect(menu), a = stageRect(anchor);
      if (m.y + m.h <= 720 - EDGE) return;
      const camKey = sceneOf(anchor), c = camOf(camKey);
      if (a.y - gap * c.z - m.h >= EDGE) {
        menu.style.top = camRect(anchor).y - gap - menu.offsetHeight + 'px';
        menu.classList.add('w-up');
        return;
      }
      if (!camEl(camKey)) return;
      const lift = Math.min(m.y + m.h - (720 - EDGE), m.y - EDGE);
      if (lift > 0) setCam(camKey, { x: c.x, y: c.y - lift, z: c.z });
    }

    /* --------------------------------------------------------- narration */
    const synth = narration.mode === 'speech' ? global.speechSynthesis || null : null;
    let voiceOn = true, voices = [], voice = null, audio = null, audioCut = null;
    const keep = [], clips = {};

    // Audio elements are cached per file, so the next line can buffer while this one plays.
    function clip(src) {
      if (!clips[src]) { const a = new Audio(src); a.preload = 'auto'; clips[src] = a; }
      return clips[src];
    }

    function rankVoice(v) {
      if (!/^en(-|_|$)/i.test(v.lang)) return null;
      const n = v.name;
      let s = 0;
      if (/natural/i.test(n)) s += 100;
      if (/online/i.test(n)) s += 20;
      if (/(Ava|Andrew|Emma|Brian|Jenny|Aria|Guy|Christopher|Michelle)/.test(n)) s += 15;
      if (/Google US English/.test(n)) s += 60;
      if (/Google UK English Female/.test(n)) s += 40;
      if (/(Samantha|\(Premium\)|\(Enhanced\))/.test(n)) s += 50;
      if (/en-US/i.test(v.lang)) s += 5;
      if (/(David|Zira|Mark)/.test(n) && /Microsoft/.test(n)) s -= 10;
      return s;
    }
    function loadVoices() {
      if (!synth) return;
      const list = synth.getVoices().filter(v => rankVoice(v) !== null).sort((a, b) => rankVoice(b) - rankVoice(a));
      if (!list.length) return;
      voices = list;
      const sel = $('.w-voice', root);
      let saved = null;
      try { saved = localStorage.getItem('w-voice'); } catch (e) { /* storage unavailable */ }
      sel.innerHTML = list.map((v, i) => `<option value="${i}">${esc(v.name.replace(/^Microsoft /, '').replace(/ - English.*$/, '').replace(/ Online \(Natural\)/, ' (Natural)'))}</option>`).join('');
      const idx = Math.max(0, list.findIndex(v => v.name === saved));
      sel.value = String(idx);
      voice = list[idx];
    }
    if (narration.mode === 'speech') {
      if (synth) {
        loadVoices();
        synth.addEventListener('voiceschanged', loadVoices);
        $('.w-voice', root).addEventListener('change', e => {
          voice = voices[+e.target.value];
          try { localStorage.setItem('w-voice', voice.name); } catch (err) { /* storage unavailable */ }
        });
        $('.w-note', root).textContent = 'Narration uses your browser’s built-in voices; Microsoft Edge offers the most natural ones.';
      } else {
        $('.w-voice', root).hidden = true;
        $('.w-note', root).textContent = 'This browser has no speech support, so the walkthrough plays with captions only.';
      }
    }
    if (audioSrc(0, 0)) clip(audioSrc(0, 0));

    // Reading time for a line when nothing is spoken (transcript mode, muted, or no voice).
    const estimate = text => Math.max(1800, text.split(/\s+/).length / narration.wordsPerSecond * 1000 + 500) / rate;

    function stopNarration() {
      if (synth) synth.cancel();
      if (audio) { audio.pause(); audio = null; }
      if (audioCut) audioCut();
    }

    /* ------------------------------------------------------------ runner */
    let RUN = 0, playing = false, chapter = 0, line = 0;

    function makeH(token) {
      const live = () => { if (token !== RUN) throw ABORT; };
      const sleep = ms => new Promise((res, rej) => setTimeout(() => (token !== RUN ? rej(ABORT) : res()), ms / rate));
      const el = t => {
        const e = typeof t === 'string' ? q(t) : t;
        if (!e) throw new Error('walkthrough: element not found: ' + t);
        return e;
      };
      const frame = () => new Promise(r => requestAnimationFrame(r));

      function narrate(l) {
        live();
        const text = lineText(l);
        caption.textContent = text;
        const src = audioSrc(chapter, line);
        if (src) { const next = audioSrc(chapter, line + 1) || audioSrc(chapter + 1, 0); if (next) clip(next); }
        if (voiceOn && src) {
          return new Promise(res => {
            const a = clip(src);
            audio = a;
            let done = false;
            const fin = () => {
              if (done) return;
              done = true; clearTimeout(guard);
              a.onended = a.onerror = null;
              if (audio === a) audio = null;
              if (audioCut === cut) audioCut = null;
              res();
            };
            // A missing or unplayable file falls back to the caption's reading time.
            const fallback = () => {
              if (done) return;
              console.warn('walkthrough: no narration audio at ' + src + '; showing the caption instead');
              clearTimeout(guard); guard = setTimeout(fin, estimate(text));
            };
            // Muted mid-line: hold the caption for the rest of its reading time.
            const cut = () => {
              const left = a.duration ? 1 - a.currentTime / a.duration : 1;
              clearTimeout(guard); guard = setTimeout(fin, estimate(text) * left);
            };
            let guard = setTimeout(fin, estimate(text) * 3 + 8000);
            audioCut = cut;
            a.onended = fin; a.onerror = fallback;
            try { a.currentTime = 0; } catch (e) { /* not loaded yet */ }
            a.playbackRate = rate;
            a.play().catch(err => { if (err && err.name === 'AbortError') return; fallback(); });
          }).then(live);
        }
        if (synth && !voice) loadVoices();  // voices can arrive after page load
        if (!synth || !voiceOn || !voice) return sleep(estimate(text));
        return new Promise(res => {
          const u = new SpeechSynthesisUtterance(text);
          let done = false;
          u.voice = voice; u.lang = voice.lang; u.rate = Math.min(2, rate);
          keep.push(u);  // keep a reference: Chrome drops end events for collected utterances
          const fin = () => { if (!done) { done = true; clearTimeout(guard); keep.splice(keep.indexOf(u), 1); res(); } };
          const guard = setTimeout(fin, estimate(text) * 2.2 + 4000);
          u.onend = fin; u.onerror = fin;
          synth.speak(u);
        }).then(live);
      }

      const h = {
        sleep,
        /** Merge a patch into the model and re-render. */
        set(patch) { live(); Object.assign(M, patch); render(); },
        /** Set one (possibly nested, dotted) model value: h.update('actions.1.value', 'x'). */
        update(path, value) { live(); setPath(M, path, value); render(); },

        /** Glide the cursor to an element. opt: fx/fy (0..1 point inside it), dx/dy offsets, ms. */
        async move(t, opt = {}) {
          live();
          const r = stageRect(el(t));
          const x = r.x + r.w * (opt.fx ?? 0.5) + (opt.dx || 0), y = r.y + r.h * (opt.fy ?? 0.5) + (opt.dy || 0);
          const ms = opt.ms || Math.min(1100, Math.max(380, Math.hypot(x - cur.x, y - cur.y) * 1.05));
          placeCursor(x, y, ms);
          await sleep(ms + 60);
        },
        /** Press the mouse at the cursor's position. */
        async click() {
          live();
          cursor.classList.add('press');
          const rp = document.createElement('div');
          rp.className = 'w-ripple';
          rp.style.left = cur.x + 4 + 'px'; rp.style.top = cur.y + 4 + 'px';
          stage.appendChild(rp);
          setTimeout(() => rp.remove(), 600 / rate);
          await sleep(150);
          cursor.classList.remove('press');
          await sleep(140);
        },
        /** Move the cursor off-stage. */
        park() { placeCursor(1300, 760, 600); },

        /** Type text into a model string, one character at a time. opt: speed (ms/char), replace. */
        async type(path, text, opt = {}) {
          const base = opt.replace ? '' : (getPath(M, path) || '');
          const speed = opt.speed || 62;
          for (let i = 1; i <= text.length; i++) {
            h.update(path, base + text.slice(0, i));
            await sleep(speed + Math.random() * speed * 0.6);
          }
        },
        /** Backspace a model string (all of it, or opt.count characters). */
        async erase(path, opt = {}) {
          let s = getPath(M, path) || '';
          const stop = opt.count ? Math.max(0, s.length - opt.count) : 0;
          while (s.length > stop) {
            s = s.slice(0, -1);
            h.update(path, s);
            await sleep(opt.speed || 35);
          }
        },

        /** Zoom the scene camera onto an element (fx/fy pick the focus point inside it). */
        async cam(t, z = 1.5, fx, fy) { live(); camFocus(el(t), z, fx, fy); await sleep(1050); },
        /** Zoom back out (one scene, or all). Pass wait=false to not wait for the move. */
        camReset(scene, wait = true) { live(); camReset(scene); return wait ? sleep(1050) : Promise.resolve(); },

        /** Pulse a highlight ring around an element; h.ring(null) hides it. */
        ring(t, pad) { live(); ring(t ? el(t) : null, pad); },
        /** Show a keyboard shortcut ('Ctrl+V'); h.keycap(false) hides it. */
        keycap(text) { live(); keycap(text); },
        /** Label the cursor ('Your customer'); h.tag(false) removes it. */
        tag(text) { live(); tag(text); },

        /** Open a dropdown menu under an element. Returns the menu element. */
        dropdown(anchor, items, opt = {}) {
          live();
          closeOverlays();
          const a = el(anchor), r = camRect(a), d = document.createElement('div');
          d.className = 'w-dd';
          Object.assign(d.style, { left: r.x + 'px', top: r.y + r.h + 2 + 'px', width: (opt.width || r.w) + 'px' });
          d.innerHTML = items.map(t => `<div>${esc(t)}</div>`).join('');
          overlayParent(a).appendChild(d);
          fitOverlay(d, a, 2);
          return d;
        },
        /** Click a select, then pick items[index] from its menu. opt.pass: item indexes to hover on the way. */
        async choose(anchor, items, index, opt = {}) {
          await h.move(anchor);
          await h.click();
          const d = h.dropdown(anchor, items, opt);
          await sleep(200);
          for (const p of opt.pass || []) {
            await h.move(d.children[p], { ms: 320 });
            d.children[p].classList.add('hl');
            await sleep(160);
            d.children[p].classList.remove('hl');
          }
          await h.move(d.children[index], { ms: opt.pass ? 320 : undefined });
          d.children[index].classList.add('hl');
          await sleep(260);
          await h.click();
          closeOverlays();
        },
        /** Open a swatch grid under an element and click colors[index]. */
        async pickColor(anchor, colors, index) {
          await h.move(anchor);
          await h.click();
          live();
          closeOverlays();
          const a = el(anchor), r = camRect(a), p = document.createElement('div');
          p.className = 'w-picker';
          Object.assign(p.style, { left: r.x - 40 + 'px', top: r.y + r.h + 6 + 'px' });
          p.innerHTML = colors.map(c => `<div style="background:${esc(c)}"></div>`).join('');
          overlayParent(a).appendChild(p);
          fitOverlay(p, a, 6);
          await sleep(350);
          await h.move(p.children[index]);
          await h.click();
          closeOverlays();
        },
        /** Close any open dropdown or picker. */
        close() { closeOverlays(); },

        /** Animate a numeric model value (e.g. a scroll offset) with easing. */
        async tween(path, to, ms = 800) {
          live();
          const from = getPath(M, path) || 0, t0 = performance.now();
          for (;;) {
            await frame(); live();
            const k = Math.min(1, (performance.now() - t0) * rate / ms), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
            setPath(M, path, from + (to - from) * e); render();
            if (k >= 1) break;
          }
        },
        /** Drag a slider: the cursor follows the value (0..1, or opt.min..opt.max) across the track. */
        async drag(track, path, to, ms = 900, opt = {}) {
          live();
          const min = opt.min ?? 0, max = opt.max ?? 1, from = getPath(M, path), t0 = performance.now();
          const tr = el(track), thumb = tr.querySelector('.thumb'), r = stageRect(tr);
          if (thumb) thumb.classList.add('grab');
          for (;;) {
            await frame(); live();
            const k = Math.min(1, (performance.now() - t0) * rate / ms), e = 1 - Math.pow(1 - k, 3), v = from + (to - from) * e;
            setPath(M, path, v); render();
            placeCursor(r.x + r.w * (v - min) / (max - min), cur.y, 0);
            if (k >= 1) break;
          }
          if (thumb) thumb.classList.remove('grab');
        },

        /** Read the model. */
        get M() { return M; },

        /** Play line i of this chapter while running fn; resolves when both have finished. */
        async beat(i, fn) {
          live();
          line = i;
          updateProgress();
          await Promise.all([narrate(chapters[chapter].lines[i]), fn ? fn() : null]);
          await sleep(280);
        }
      };
      return h;
    }

    /* --------------------------------------------------------- transport */
    function setStep() {
      const c = chapters[chapter], badge = $('.w-step', stage);
      if (c.step) {
        $('b', badge).textContent = c.step;
        $('small', badge).textContent = `Step ${c.step} of ${steps}`;
        $('span', badge).textContent = c.title;
      }
      badge.classList.toggle('show', !!c.step);
      $('.w-now', root).textContent = (c.step ? `Step ${c.step}: ` : '') + c.title;
    }

    function applyStart(i, instant) {
      closeOverlays();
      ring(null);
      keycap(false);
      tag(false);
      if (instant) {
        stage.classList.add('instant');
        M = startState(i);
        camReset();
        render();
        void stage.offsetWidth;
        stage.classList.remove('instant');
      } else {
        // continuous play: the previous chapter's end state flows into this one
        const patch = clone(chapters[i].start || {});
        if (patch.scene && patch.scene !== M.scene && !('reveal' in patch)) patch.reveal = -1;
        Object.assign(M, patch);
        render();
      }
    }

    function playFrom(i, continuous) {
      const token = ++RUN;
      stopNarration();
      playing = true;
      chapter = i; line = 0;
      updatePlayIcon();
      startOverlay.classList.add('hide');
      applyStart(i, !continuous);
      setStep();
      updateProgress();
      const h = makeH(token);
      h.sleep(continuous ? 350 : 150)
        .then(() => chapters[i].run(h))
        .then(() => {
          if (token !== RUN) return;
          line = chapters[i].lines.length;
          updateProgress();
          if (i + 1 < chapters.length) playFrom(i + 1, true);
          else finish();
        })
        .catch(e => { if (e !== ABORT) console.error(e); });
    }

    function pause() {
      RUN++;
      playing = false;
      stopNarration();
      updatePlayIcon();
      caption.textContent = 'Paused. Press play to resume this chapter.';
    }

    function finish() {
      playing = false;
      updatePlayIcon();
      const end = def.end || {};
      $('h2', startOverlay).textContent = end.title || 'Thanks for watching';
      $('p', startOverlay).textContent = end.text || '';
      $('.w-bigplay span', startOverlay).textContent = 'Watch again';
      const link = $('.w-endlink', startOverlay);
      if (end.link) { link.href = end.link.href; link.textContent = end.link.label; link.hidden = false; }
      startOverlay.classList.remove('hide');
    }

    function togglePlay() { if (playing) pause(); else playFrom(chapter); }
    function updatePlayIcon() {
      $('.w-play svg', root).innerHTML = playing ? PAUSE_ICON : PLAY_ICON;
      $('.w-play', root).setAttribute('aria-label', playing ? 'Pause' : 'Play');
    }

    // progress: one segment per chapter, sized and filled by its lines
    const segs = $('.w-segs', root);
    segs.innerHTML = chapters.map((c, i) => `<button class="w-seg" type="button" style="flex:${c.lines.length}" data-i="${i}" aria-label="Jump to ${esc(c.title)}"><span class="bar"><i></i></span><span class="tip">${esc((c.step ? c.step + '. ' : '') + c.title)}</span></button>`).join('');
    segs.addEventListener('click', e => { const s = e.target.closest('.w-seg'); if (s) playFrom(+s.dataset.i); });

    // transcript: every line, current one highlighted; chapter headings jump
    const tx = $('.w-transcript', root);
    tx.innerHTML = chapters.map((c, i) => `<h3><button class="w-tx-ch" type="button" data-i="${i}">${esc((c.step ? 'Step ' + c.step + ': ' : '') + c.title)}</button></h3>` +
      c.lines.map((l, j) => `<p data-c="${i}" data-l="${j}">${esc(lineText(l))}</p>`).join('')).join('');
    tx.addEventListener('click', e => { const b = e.target.closest('.w-tx-ch'); if (b) playFrom(+b.dataset.i); });

    function updateProgress() {
      $$('.w-seg', segs).forEach((s, i) => {
        const f = i < chapter ? 1 : i > chapter ? 0 : line / chapters[i].lines.length;
        $('i', s).style.width = f * 100 + '%';
      });
      $$('p', tx).forEach(p => p.classList.toggle('cur', playing && +p.dataset.c === chapter && +p.dataset.l === line));
    }

    $('.w-bigplay', root).addEventListener('click', () => {
      if (synth) { try { synth.speak(new SpeechSynthesisUtterance('')); } catch (e) { /* unlock only */ } }
      playFrom(0);
    });
    $('.w-play', root).addEventListener('click', togglePlay);
    $('.w-speed', root).addEventListener('click', () => setSpeed(SPEEDS[(SPEEDS.indexOf(viewerSpeed) + 1) % SPEEDS.length]));
    $('.w-restart', root).addEventListener('click', () => playFrom(0));
    $('.w-cc', root).addEventListener('click', function () {
      const on = this.getAttribute('aria-pressed') !== 'true';
      this.setAttribute('aria-pressed', String(on));
      caption.classList.toggle('off', !on);
    });
    $('.w-tx', root).addEventListener('click', function () {
      tx.hidden = !tx.hidden;
      this.setAttribute('aria-pressed', String(!tx.hidden));
    });
    // Captions start as the walkthrough's `captions` setting says; a link's &captions=on|off overrides it.
    const ccLink = params.get('captions');
    if (!params.has('video') && (ccLink === 'off' || (def.captions === false && ccLink !== 'on'))) $('.w-cc', root).click();
    const full = $('.w-full', root);
    if (full) full.addEventListener('click', () => {
      if (document.fullscreenElement) document.exitFullscreen(); else root.requestFullscreen().catch(() => {});
    });
    // Tell the host page how tall the player is (embed.js sizes the iframe to match).
    if (embed && global.parent !== global && global.ResizeObserver) {
      const report = () => global.parent.postMessage({ type: 'kz-walkthrough:height', height: Math.ceil(document.documentElement.getBoundingClientRect().height) }, '*');
      new ResizeObserver(report).observe(document.body);
      report();
      const pinned = /^(light|dark)$/.test(params.get('theme') || '');

      // Phone view: the picture is too small to read in a narrow embed, so until it starts the embed is
      // a card, and its play button opens the player filling the window. It needs the host's embed.js to
      // grow the iframe, so without that the embed stays as it is. Tapping play is the gesture that
      // starts playback, so there is no second tap.
      const html = document.documentElement;
      const phone = global.matchMedia('(max-width: 640px)');
      const ccBtn = $('.w-cc', root);
      let canExpand = false, watching = false, captionsForced = false, idleTimer = 0;
      const syncCard = () => {
        if (watching || startOverlay.classList.contains('hide')) return;
        html.classList.toggle('w-card', canExpand && phone.matches);
        fit();
      };
      const wake = () => {
        html.classList.remove('w-idle');
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => { if (watching && playing) html.classList.add('w-idle'); }, 3000);
      };
      function resetToStart() {
        RUN++;
        playing = false;
        stopNarration();
        updatePlayIcon();
        chapter = 0; line = 0;
        applyStart(0, true);
        setStep();
        updateProgress();
        $('h2', startOverlay).textContent = intro.title;
        $('p', startOverlay).textContent = intro.text;
        $('.w-bigplay span', startOverlay).textContent = intro.play;
        $('.w-endlink', startOverlay).hidden = true;
        startOverlay.classList.remove('hide');
        caption.textContent = 'Press play to start the walkthrough.';
      }
      function setWatching(on) {
        if (on === watching) return;
        watching = on;
        html.classList.toggle('w-watch', on);
        clearTimeout(idleTimer);
        html.classList.remove('w-idle');
        global.parent.postMessage({ type: 'kz-walkthrough:expand', on }, '*');
        if (on) {
          html.classList.remove('w-card');
          // Captions are real text outside the scaled picture, so they stay readable here. A phone may
          // also not play the narration. This overrides the embed's &captions=off once; viewers can
          // still switch them off.
          if (!captionsForced && ccBtn.getAttribute('aria-pressed') === 'false') ccBtn.click();
          captionsForced = true;
          wake();
        } else {
          resetToStart();
          syncCard();
          report();
        }
        fit();
      }
      $('.w-bigplay', root).addEventListener('click', () => { if (html.classList.contains('w-card')) setWatching(true); });
      $('.w-close', root).addEventListener('click', () => setWatching(false));
      root.addEventListener('pointerdown', () => { if (watching) wake(); });
      document.addEventListener('keydown', e => { if (e.key === 'Escape') setWatching(false); });
      phone.addEventListener('change', syncCard);

      global.addEventListener('message', e => {
        if (e.source !== global.parent || !e.data) return;
        if (e.data.type === 'kz-walkthrough:close') setWatching(false);
        if (e.data.type === 'kz-walkthrough:sized') {
          html.classList.add('w-embed-sized');
          if (e.data.canExpand && !canExpand) { canExpand = true; syncCard(); }
        }
        // The host page's light/dark, so the player matches the page around it.
        if (e.data.type === 'kz-walkthrough:theme' && !pinned && /^(light|dark)$/.test(e.data.theme)) document.documentElement.dataset.theme = e.data.theme;
      });
    }
    const mute = $('.w-mute', root);
    if (mute) mute.addEventListener('click', function () {
      voiceOn = !voiceOn;
      this.setAttribute('aria-pressed', String(voiceOn));
      $('.w-waves', this).style.display = voiceOn ? '' : 'none';
      if (!voiceOn) stopNarration();
    });
    document.addEventListener('keydown', e => {
      if (e.target.closest('select, input, textarea')) return;
      if (e.key === ' ' || e.key === 'k') {
        e.preventDefault();
        if (startOverlay.classList.contains('hide')) togglePlay(); else $('.w-bigplay', root).click();
      } else if (e.key === 'ArrowRight' && chapter + 1 < chapters.length) playFrom(chapter + 1);
      else if (e.key === 'ArrowLeft') playFrom(Math.max(0, chapter - (line > 0 ? 0 : 1)));
      else if (e.key === '>' || e.key === '<') setSpeed(SPEEDS[Math.max(0, Math.min(SPEEDS.length - 1, SPEEDS.indexOf(viewerSpeed) + (e.key === '>' ? 1 : -1)))]);
    });
    // Browsers suspend speech and timers in background tabs; pause cleanly instead.
    document.addEventListener('visibilitychange', () => { if (document.hidden && playing) pause(); });

    setSpeed(viewerSpeed);
    applyStart(0, true);
    setStep();
    updateProgress();

    return { play: () => playFrom(chapter), pause, playFrom: i => playFrom(i), setSpeed, get model() { return M; } };
  }

  global.KZWalkthrough = { create, util: { $, $$, esc } };
})(window);
