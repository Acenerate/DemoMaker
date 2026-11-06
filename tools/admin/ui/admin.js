/* Walkthrough admin page. Talks to tools/admin/server.js. */
(function () {
  'use strict';

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const main = $('#main');
  const ICON = {
    play: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M8 5.5v13l11-6.5z"/></svg>',
    stop: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M7 7h10v10H7z"/></svg>',
    redo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M20 12a8 8 0 1 1-2.4-5.7M20 4v5h-5"/></svg>',
    up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M6 15l6-6 6 6"/></svg>',
    down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M6 9l6 6 6-6"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M6 6l12 12M18 6L6 18"/></svg>'
  };

  let S = null;              // /api/state
  let D = null;              // /api/w/<current>
  let current = null, tab = 'script', page = 'walkthrough';
  let running = false;       // a voiceover job is streaming
  const player = new Audio();

  /* ------------------------------------------------------------ server */
  async function api(path, body) {
    const res = await fetch('/api/' + path, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Admin': '1' }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || res.statusText);
    return data;
  }
  function toast(msg, bad) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.toggle('bad', !!bad);
    t.classList.add('show');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => t.classList.remove('show'), bad ? 6000 : 2600);
  }
  const fail = e => toast(e.message, true);

  /* ------------------------------------------------------------ status */
  function audioPill(w) {
    if (w.error) return '<span class="pill bad">Error</span>';
    if (w.mode !== 'audio') return '<span class="pill none">Captions only</span>';
    const need = w.audio.changed + w.audio.missing;
    return need ? `<span class="pill warn">${need} need${need === 1 ? 's' : ''} audio</span>` : '<span class="pill ok">Audio ready</span>';
  }
  const LINE_STATE = {
    ok: ['ok', 'Audio ready'], changed: ['warn', 'Needs new audio'], missing: ['bad', 'No audio'], custom: ['none', 'Own audio file']
  };

  /* ----------------------------------------------------------- sidebar */
  async function loadState() {
    S = await api('state');
    const v = S.voice;
    $('#voice-chip').innerHTML = v.error ? 'voice.json unreadable' : `Voice: <b>${esc(v.name)}</b> · ${esc(v.model)}${S.hasKey ? '' : ' · <b>no API key</b>'}`;
    $('#list').innerHTML = S.walkthroughs.map(w => `
      <button class="item${page === 'walkthrough' && w.name === current ? ' on' : ''}" data-name="${esc(w.name)}" type="button">
        <b>${esc(w.title || w.name)}</b><small>${esc(w.name)}${w.lines ? ` · ${w.lines} lines` : ''}</small>${audioPill(w)}
      </button>`).join('');
    $('#gallery-btn').classList.toggle('on', page === 'gallery');
    $('#claude-btn').classList.toggle('on', page === 'claude');
    $('#voices-btn').classList.toggle('on', page === 'voices');
  }
  $('#list').addEventListener('click', e => {
    const b = e.target.closest('.item');
    if (b && confirmLeave()) open(b.dataset.name);
  });

  function confirmLeave() {
    return !$$('.line.dirty').length || confirm('You have unsaved line edits. Discard them?');
  }
  window.addEventListener('beforeunload', e => { if ($$('.line.dirty').length || running) { e.preventDefault(); e.returnValue = ''; } });

  async function open(name, keepTab) {
    current = name; page = 'walkthrough';
    if (!keepTab) tab = 'script';
    try { location.hash = name; } catch (e) { /* ignore */ }
    await Promise.all([loadState(), loadDetail()]);
  }
  async function loadDetail() {
    try { D = await api('w/' + encodeURIComponent(current)); } catch (e) { D = null; main.innerHTML = `<div class="note">${esc(e.message)}</div>`; return; }
    draw();
  }

  /* --------------------------------------------------------- main view */
  function draw() {
    const w = D;
    main.innerHTML = `
      <div class="wh">
        <div class="grow"><h2>${esc(w.title)}</h2><p class="muted">${esc(w.subtitle || '')}${w.subtitle ? ' · ' : ''}<code>walkthroughs/${esc(w.name)}</code> · ${w.chapters.length} chapters · ${w.lines} lines · ${w.words} words · tempo ${w.tempo}× · voice ${esc(w.voice.name)}</p></div>
        ${audioPill(w)}
      </div>
      <div class="tabs">
        <button class="tab${tab === 'script' ? ' on' : ''}" data-tab="script" type="button">Script &amp; voiceover</button>
        <button class="tab${tab === 'preview' ? ' on' : ''}" data-tab="preview" type="button">Preview</button>
        <button class="tab${tab === 'video' ? ' on' : ''}" data-tab="video" type="button">Video</button>
        <button class="tab${tab === 'embed' ? ' on' : ''}" data-tab="embed" type="button">Embed</button>
        <button class="tab${tab === 'settings' ? ' on' : ''}" data-tab="settings" type="button">Settings</button>
      </div>
      <div id="pane"></div>`;
    $$('.tab', main).forEach(t => t.addEventListener('click', () => {
      if (t.dataset.tab === tab || (tab === 'script' && !confirmLeave())) return;
      tab = t.dataset.tab; draw();
    }));
    ({ script: drawScript, preview: drawPreview, video: drawVideo, embed: drawEmbed, settings: drawSettings })[tab]($('#pane'));
  }

  /* ------------------------------------------------------------ script */
  function drawScript(pane) {
    const w = D, audio = w.mode === 'audio';
    pane.innerHTML = `
      ${audio ? '' : `<div class="note">This walkthrough plays <b>captions only</b>, so the audio below isn't used yet. When the script is final, switch <b>Narration</b> to <b>Recorded audio</b> in Settings.</div>`}
      ${S.hasKey ? '' : '<div class="note">No ElevenLabs API key found. Add <code>ELEVENLABS_API_KEY=...</code> to the <code>.env</code> file in the project folder, then reload.</div>'}
      <div class="bar">
        <button class="btn primary" id="gen" type="button" ${!w.pending.lines || !S.hasKey ? 'disabled' : ''}>Generate audio for ${w.pending.lines} line${w.pending.lines === 1 ? '' : 's'}${w.pending.lines ? ` · ${w.pending.chars.toLocaleString()} chars` : ''}</button>
        <button class="btn" id="gen-all" type="button" ${S.hasKey ? '' : 'disabled'}>Regenerate all · ${w.allChars.toLocaleString()} chars</button>
        <span class="grow"></span>
        <span class="muted" style="font-size:12.5px">Edits save to <code>walkthrough.js</code> and update <code>transcript.md</code>.</span>
      </div>
      <div class="log" id="log" hidden></div>
      ${w.chapters.map((c, ci) => `
        <section class="chapter">
          <div class="chapter-head">
            ${c.step ? `<span class="step">Step ${c.step}</span>` : ''}
            <h3>${esc(c.title)}</h3><span class="grow"></span>
            <button class="btn small ghost" data-preview="${ci}" type="button">Preview from here</button>
          </div>
          ${c.lines.map(l => lineRow(c, l)).join('')}
        </section>`).join('')}
      <p class="muted" style="font-size:12.5px">To add, remove or reorder lines, edit the chapter in <code>walkthrough.js</code>: each line is paired with an animation step there.</p>`;

    $$('textarea', pane).forEach(autosize);
    $('#gen', pane).addEventListener('click', () => runVoiceover({}, `Generate audio for ${D.pending.lines} line(s)? This uses about ${D.pending.chars} ElevenLabs characters.`));
    $('#gen-all', pane).addEventListener('click', () => runVoiceover({ force: true }, `Regenerate ALL ${D.lines} lines? This uses about ${D.allChars} ElevenLabs characters.`));
    pane.addEventListener('click', onScriptClick);
    pane.addEventListener('input', e => {
      const ta = e.target.closest('textarea');
      if (!ta) return;
      autosize(ta);
      ta.closest('.line').classList.toggle('dirty', ta.value.trim() !== ta.dataset.orig);
    });
    pane.addEventListener('keydown', e => {
      const ta = e.target.closest('textarea');
      if (!ta) return;
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); saveLine(ta.closest('.line')); }
      else if (e.key === 'Enter') e.preventDefault();   // lines are single paragraphs
      else if (e.key === 'Escape') { ta.value = ta.dataset.orig; ta.dispatchEvent(new Event('input', { bubbles: true })); ta.blur(); }
    });
  }

  function lineRow(c, l) {
    const [cls, label] = LINE_STATE[l.state];
    return `
      <div class="line" data-id="${esc(l.id)}" data-chapter="${esc(c.id)}" data-index="${l.index}">
        <div class="lid">${esc(l.id)}</div>
        <div>
          <textarea rows="1" ${l.editable ? '' : 'readonly title="This line is written in a way only walkthrough.js can change"'} data-orig="${esc(l.caption)}" aria-label="Line ${esc(l.id)}">${esc(l.caption)}</textarea>
          ${l.spoken !== l.caption ? `<div class="spoken">Spoken as: “${esc(l.spoken)}”</div>` : ''}
          <div class="edit-actions"><button class="btn small primary" data-act="save" type="button">Save</button><button class="btn small ghost" data-act="cancel" type="button">Cancel</button><span class="muted" style="font-size:12px">Ctrl+Enter saves · Esc cancels</span></div>
        </div>
        <div class="side-ctl">
          <span class="pill ${cls}">${label}</span>
          <button class="icon-btn" data-act="play" type="button" title="Play this line's audio" ${l.audioUrl ? `data-src="${esc(l.audioUrl)}"` : 'disabled'}>${ICON.play}</button>
          <button class="icon-btn" data-act="regen" type="button" title="Regenerate this line's audio (${l.chars} chars)" ${S.hasKey && l.state !== 'custom' ? '' : 'disabled'}>${ICON.redo}</button>
        </div>
      </div>`;
  }

  function autosize(ta) { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 2 + 'px'; }

  function onScriptClick(e) {
    const pv = e.target.closest('[data-preview]');
    if (pv) { if (confirmLeave()) { tab = 'preview'; draw(); jumpTo(+pv.dataset.preview); } return; }
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const row = b.closest('.line');
    const act = b.dataset.act;
    if (act === 'save') saveLine(row);
    else if (act === 'cancel') { const ta = $('textarea', row); ta.value = ta.dataset.orig; autosize(ta); row.classList.remove('dirty'); }
    else if (act === 'play') togglePlay(b, row);
    else if (act === 'regen') {
      if (row.classList.contains('dirty')) return toast('Save the line first, then regenerate its audio.', true);
      runVoiceover({ only: [row.dataset.id] }, null);
    }
  }

  async function saveLine(row) {
    const ta = $('textarea', row);
    if (ta.value.trim() === ta.dataset.orig) { row.classList.remove('dirty'); return; }
    try {
      D = await api(`w/${encodeURIComponent(current)}/line`, { chapter: row.dataset.chapter, index: +row.dataset.index, text: ta.value });
      const id = row.dataset.id;
      const c = D.chapters.find(ch => ch.id === row.dataset.chapter), l = c.lines[+row.dataset.index];
      const fresh = document.createElement('div');
      fresh.innerHTML = lineRow(c, l);
      row.replaceWith(fresh.firstElementChild);
      autosize($(`.line[data-id="${id}"] textarea`));
      refreshBar();
      loadState();
      toast(D.mode === 'audio' ? `Saved ${id}. It needs new audio.` : `Saved ${id}.`);
    } catch (e) { fail(e); }
  }

  // Updates the generate buttons without redrawing the lines (keeps other unsaved edits).
  function refreshBar() {
    const g = $('#gen'), a = $('#gen-all');
    if (!g) return;
    g.disabled = !D.pending.lines || !S.hasKey;
    g.textContent = `Generate audio for ${D.pending.lines} line${D.pending.lines === 1 ? '' : 's'}${D.pending.lines ? ` · ${D.pending.chars.toLocaleString()} chars` : ''}`;
    a.textContent = `Regenerate all · ${D.allChars.toLocaleString()} chars`;
  }

  function togglePlay(btn, row) {
    const was = btn.classList.contains('on');
    stopAudio();
    if (was) return;
    player.src = btn.dataset.src;
    player.play().catch(fail);
    btn.classList.add('on'); btn.innerHTML = ICON.stop; row.classList.add('playing');
  }
  function stopAudio() {
    player.pause();
    $$('[data-act="play"].on').forEach(b => { b.classList.remove('on'); b.innerHTML = ICON.play; b.closest('.line').classList.remove('playing'); });
  }
  player.addEventListener('ended', stopAudio);

  async function runVoiceover(opts, question) {
    if (running) return;
    if ($$('.line.dirty').length) return toast('Save or cancel your line edits first.', true);
    if (question && !confirm(question)) return;
    stopAudio();
    running = true;
    $$('#gen, #gen-all, [data-act="regen"]').forEach(b => { b.disabled = true; });
    const log = $('#log');
    log.hidden = false; log.textContent = '';
    const add = (t, err) => { const d = document.createElement('div'); if (err) d.className = 'e'; d.textContent = t; log.appendChild(d); log.scrollTop = log.scrollHeight; };
    try {
      const res = await fetch(`/api/w/${encodeURIComponent(current)}/voiceover`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Admin': '1' }, body: JSON.stringify(opts) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
      const reader = res.body.getReader(), dec = new TextDecoder();
      let buf = '', result = null;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf('\n')) >= 0) {
          const msg = JSON.parse(buf.slice(0, i)); buf = buf.slice(i + 1);
          if (msg.log) add(msg.log);
          if (msg.error) { add(msg.error, true); result = msg; }
          if (msg.done) result = msg;
        }
      }
      if (result && result.error) toast(result.error, true);
      else if (result) toast(result.generated ? `Generated ${result.generated} clip${result.generated === 1 ? '' : 's'} (${result.chars} chars).` : 'Nothing needed new audio.');
    } catch (e) { add(e.message, true); fail(e); }
    running = false;
    const keep = log.innerHTML;
    await Promise.all([loadState(), loadDetail()]);
    const l2 = $('#log');
    if (l2) { l2.hidden = false; l2.innerHTML = keep; l2.scrollTop = l2.scrollHeight; }
  }

  /* ----------------------------------------------------------- preview */
  function drawPreview(pane) {
    const src = `/walkthroughs/${encodeURIComponent(D.name)}/index.html?t=${Date.now()}`;
    pane.innerHTML = `
      <div class="jump">
        ${D.chapters.map((c, i) => `<button class="btn small" data-jump="${i}" type="button">${c.step ? c.step + '. ' : ''}${esc(c.title)}</button>`).join('')}
        <span class="grow"></span>
        <button class="btn small" id="reload" type="button">Reload</button>
        <a class="btn small" href="${src}" target="_blank" rel="noopener">Open in new tab ↗</a>
      </div>
      <div class="preview-wrap"><iframe id="frame" src="${src}" title="Walkthrough preview" allow="autoplay"></iframe></div>
      <p class="muted" style="font-size:12.5px">Exactly what viewers get, including the speed button. Script edits and new audio show up after Reload.</p>`;
    $('#reload', pane).addEventListener('click', () => { $('#frame').src = `/walkthroughs/${encodeURIComponent(D.name)}/index.html?t=${Date.now()}`; });
    pane.addEventListener('click', e => { const b = e.target.closest('[data-jump]'); if (b) jumpTo(+b.dataset.jump); });
  }
  function jumpTo(i) {
    const frame = $('#frame');
    if (!frame) return;
    const go = () => { const seg = frame.contentDocument && frame.contentDocument.querySelectorAll('.w-seg')[i]; if (seg) seg.click(); };
    if (frame.contentDocument && frame.contentDocument.readyState === 'complete' && frame.contentDocument.querySelector('.w-seg')) go();
    else frame.addEventListener('load', () => setTimeout(go, 150), { once: true });
  }

  /* ------------------------------------------------------------- video */
  // Runs a streamed job (NDJSON lines of { log } / { error } / { done }) into a log box; returns the last message.
  async function streamJob(url, body, logBox) {
    const add = (t, err) => { const d = document.createElement('div'); if (err) d.className = 'e'; d.textContent = t; logBox.appendChild(d); logBox.scrollTop = logBox.scrollHeight; };
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Admin': '1' }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
    const reader = res.body.getReader(), dec = new TextDecoder();
    let buf = '', result = null;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const msg = JSON.parse(buf.slice(0, i)); buf = buf.slice(i + 1);
        if (msg.log) add(msg.log);
        if (msg.error) { add(msg.error, true); result = msg; }
        if (msg.done) result = msg;
      }
    }
    return result;
  }

  const fmtTime = s => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

  function drawVideo(pane) {
    const w = D, v = w.video, estimate = Math.round(w.words / 2.6 / (w.tempo || 1) + 25);
    const needAudio = w.mode === 'audio' ? w.audio.changed + w.audio.missing : 0;
    pane.innerHTML = `
      ${w.ffmpeg ? '' : '<div class="note"><b>FFmpeg isn\'t installed</b>, and it\'s needed to make the MP4. In PowerShell run <code>winget install Gyan.FFmpeg</code>, then restart the admin.</div>'}
      ${needAudio ? `<div class="note">${needAudio} line${needAudio === 1 ? ' has' : 's have'} no up-to-date audio, so the video would use old clips or silence there. Generate audio on the Script &amp; voiceover tab first.</div>` : ''}
      ${w.mode !== 'audio' ? '<div class="note info">This walkthrough plays captions only, so its video will have no voice. Burned-in captions are recommended (below).</div>' : ''}
      <div class="form" style="max-width:860px">
        <h3>Export a video</h3>
        <p class="muted" style="margin:-4px 0 14px">Makes a YouTube-ready <b>MP4</b> (1920×1080, 30 fps) with the voiceover, a <b>captions file</b> (.srt) and a <b>YouTube text</b> file with a title, description and chapter timestamps. It plays the walkthrough once in the background in real time, so it takes about ${fmtTime(estimate + Math.round(estimate * 0.3))}.</p>
        <label class="check"><input type="checkbox" id="x-captions"${w.mode !== 'audio' ? ' checked' : ''}> Burn captions into the picture</label>
        <p class="muted" style="font-size:12.5px;margin:4px 0 14px 24px">Usually leave this off and upload the .srt to YouTube instead: viewers can turn those captions on or off, and YouTube indexes them for search.</p>
        <div class="row"><button class="btn primary" id="x-go" type="button" ${w.ffmpeg ? '' : 'disabled'}>${v ? 'Export again' : 'Export video'}</button><span class="muted" id="x-note" style="font-size:12.5px"></span></div>
      </div>
      <div class="log" id="x-log" hidden></div>
      ${v ? `
      <div class="form" style="max-width:860px">
        <h3>Latest export</h3>
        ${v.changed ? '<div class="note" style="margin-bottom:12px">The walkthrough or its audio has changed since this video was made. Export again to include the changes.</div>' : ''}
        <video src="${esc(v.url)}" controls preload="metadata" style="width:100%;border-radius:8px;background:#000;display:block"></video>
        <p class="muted" style="font-size:12.5px">Made ${new Date(v.at).toLocaleString()} · ${(v.bytes / 1048576).toFixed(1)} MB · <code>exports/${esc(w.name)}.mp4</code></p>
        <div class="row">
          <a class="btn" href="${esc(v.url)}" download="${esc(w.name)}.mp4">Download MP4</a>
          ${v.srtUrl ? `<a class="btn" href="${esc(v.srtUrl)}" download="${esc(w.name)}.srt">Download captions (.srt)</a>` : ''}
          <button class="btn" id="x-reveal" type="button">Show in folder</button>
        </div>
        ${v.youtube ? `
        <h3 style="margin-top:22px">For YouTube</h3>
        <textarea class="plain" id="x-yt" rows="14" readonly style="font:12.5px/1.5 ui-monospace,Consolas,monospace">${esc(v.youtube)}</textarea>
        <div class="row" style="margin-top:8px"><button class="btn" id="x-copy-desc" type="button">Copy description</button><button class="btn ghost" id="x-copy-title" type="button">Copy title</button></div>
        <ol class="muted" style="font-size:13px;line-height:1.7;padding-left:20px;margin:14px 0 0">
          <li>In YouTube Studio, click <b>Create → Upload videos</b> and choose the MP4.</li>
          <li>Paste the title and the description (the chapter list makes chapters appear on the progress bar).</li>
          <li>Under <b>Subtitles</b>, add English and <b>Upload file → With timing</b>, choosing the .srt.</li>
        </ol>` : ''}
      </div>` : ''}`;
    const go = $('#x-go', pane);
    go.addEventListener('click', async () => {
      if (running) return;
      running = true; go.disabled = true; $('#x-note').textContent = 'Recording… you can keep using the admin, but leave this window open.';
      const log = $('#x-log'); log.hidden = false; log.textContent = '';
      try {
        const r = await streamJob(`/api/w/${encodeURIComponent(current)}/export`, { captions: $('#x-captions').checked }, log);
        if (r && r.error) toast(r.error, true); else if (r) toast(`Video ready (${fmtTime(r.seconds)}).`);
      } catch (e) { fail(e); }
      running = false;
      const keep = log.innerHTML;
      await loadDetail();
      const l2 = $('#x-log'); if (l2) { l2.hidden = false; l2.innerHTML = keep; }
    });
    const rv = $('#x-reveal', pane);
    if (rv) rv.addEventListener('click', () => api(`w/${encodeURIComponent(current)}/reveal`, {}).catch(fail));
    const ytText = v && v.youtube ? v.youtube : '';
    const part = (from, to) => { const a = ytText.indexOf(from + '\n'); if (a < 0) return ''; const b = to ? ytText.indexOf('\n' + to + '\n', a) : -1; return ytText.slice(a + from.length + 1, b < 0 ? undefined : b).trim(); };
    const copy = async (text, what) => { try { await navigator.clipboard.writeText(text); toast(`${what} copied.`); } catch (e) { const t = $('#x-yt'); t.select(); document.execCommand('copy'); toast(`${what} copied.`); } };
    const cd = $('#x-copy-desc', pane); if (cd) cd.addEventListener('click', () => copy(part('DESCRIPTION', 'CAPTIONS'), 'Description'));
    const ct = $('#x-copy-title', pane); if (ct) ct.addEventListener('click', () => copy(part('TITLE', 'DESCRIPTION'), 'Title'));
  }

  /* ------------------------------------------------------------- embed */
  // Builds the iframe code for another page; choices are remembered in this browser.
  const EMBED_SIZES = [['', 'Full width of its column'], ['959', 'Large · 959px'], ['720', 'Medium · 720px'], ['560', 'Small · 560px'], ['400', 'Compact · 400px'], ['custom', 'Custom…']];
  function embedPrefs() {
    let p = {};
    try {
      p = JSON.parse(localStorage.getItem('embed-prefs-2') || 'null');
      // Choices remembered before 959px became the default keep everything but their size.
      if (!p) { p = JSON.parse(localStorage.getItem('embed-prefs') || '{}'); delete p.size; }
    } catch (e) { /* storage unavailable */ }
    if (typeof p.captions === 'boolean') p.captions = p.captions ? '' : 'off';
    return Object.assign({ base: '', size: '959', custom: 640, center: false, theme: '', captions: '' }, p);
  }
  function embedCode(name, title, p, base) {
    base = base.trim() ? base.trim().replace(/\/*$/, '/') : '/';
    const width = p.size === 'custom' ? Math.max(280, +p.custom || 640) : +p.size;
    const query = ['embed', p.theme && 'theme=' + p.theme, p.captions && 'captions=' + p.captions].filter(Boolean).join('&');
    const style = `display:block;width:100%;${width ? `max-width:${width}px;` : ''}${p.center ? 'margin:0 auto;' : ''}aspect-ratio:16/12.5;border:0;color-scheme:normal`;
    return {
      src: `walkthroughs/${name}/?${query}`, style,
      code: `<iframe src="${base}walkthroughs/${name}/?${query}" title="${title.replace(/"/g, '&quot;')}" style="${style}" loading="lazy" data-resize="false"></iframe>\n<script src="${base}framework/embed.js" async></script>`
    };
  }

  function drawEmbed(pane) {
    const p = embedPrefs();
    pane.innerHTML = `
      <div class="form" style="max-width:860px">
        <h3>Embed on a web page</h3>
        <p class="muted" style="margin:-4px 0 14px">The interactive player (speed, chapters, captions, transcript) in an iframe. The height adjusts itself to the width you choose.</p>
        <div class="embed-grid">
          <label>Size<select id="e-size">${EMBED_SIZES.map(([v, t]) => `<option value="${v}"${p.size === v ? ' selected' : ''}>${t}</option>`).join('')}</select>
            <small>The most it will grow to; it shrinks to fit narrower screens.</small></label>
          <label id="e-custom-wrap"${p.size === 'custom' ? '' : ' hidden'}>Width (px)<input id="e-custom" type="number" min="280" max="2000" step="10" value="${p.custom}"></label>
          <label>Colours<select id="e-theme"><option value=""${!p.theme ? ' selected' : ''}>Match the page it's on</option><option value="light"${p.theme === 'light' ? ' selected' : ''}>Always light</option><option value="dark"${p.theme === 'dark' ? ' selected' : ''}>Always dark</option></select></label>
          <label class="full">Site address<input id="e-base" value="${esc(p.base)}" placeholder="Blank: same site, e.g. the docs site">
            <small>Where the <code>walkthroughs</code> and <code>framework</code> folders are hosted, e.g. <code>https://docs.klick-zen.com/</code>. Leave blank when the page is on that same site.</small></label>
          <label>Captions<select id="e-captions"><option value=""${!p.captions ? ' selected' : ''}>This walkthrough's setting (${D.captions ? 'on' : 'off'})</option><option value="on"${p.captions === 'on' ? ' selected' : ''}>Always start on</option><option value="off"${p.captions === 'off' ? ' selected' : ''}>Always start off</option></select></label>
          <label class="check"><input type="checkbox" id="e-center"${p.center ? ' checked' : ''}> Center it on the page</label>
        </div>
        <h3 style="margin-top:18px">Embed code</h3>
        <textarea class="plain" id="e-code" rows="4" readonly style="font:12.5px/1.5 ui-monospace,Consolas,monospace"></textarea>
        <div class="row" style="margin-top:8px"><button class="btn primary" id="e-copy" type="button">Copy embed code</button></div>
        <ol class="muted" style="font-size:13px;line-height:1.7;padding-left:20px;margin:14px 0 0">
          <li>Copy the <code>walkthroughs/${esc(D.name)}</code> folder and the <code>framework</code> folder to the site, keeping them side by side (<code>/walkthroughs/${esc(D.name)}/</code> and <code>/framework/</code>). Re-copy after changes.</li>
          <li>Paste the code where the walkthrough should appear. The <code>&lt;script&gt;</code> line is needed once per page, however many walkthroughs it embeds.</li>
        </ol>
      </div>
      <div class="form" style="max-width:none">
        <h3>Preview at this size</h3>
        <p class="muted" style="margin:-4px 0 14px">How it sits on a page as wide as this box. Make the admin window narrower to see it shrink.</p>
        <div class="embed-stage"><iframe id="e-frame" title="Embed preview"></iframe></div>
      </div>`;
    if (!document.querySelector('script[src="/framework/embed.js"]')) {
      const s = document.createElement('script'); s.src = '/framework/embed.js'; document.head.appendChild(s);
    }
    const frame = $('#e-frame', pane);
    let lastSrc = '';
    const update = () => {
      const q = {
        base: $('#e-base').value, size: $('#e-size').value, custom: +$('#e-custom').value || 640,
        center: $('#e-center').checked, theme: $('#e-theme').value, captions: $('#e-captions').value
      };
      try { localStorage.setItem('embed-prefs-2', JSON.stringify(q)); } catch (e) { /* storage unavailable */ }
      $('#e-custom-wrap').hidden = q.size !== 'custom';
      const e = embedCode(D.name, D.title, q, q.base);
      $('#e-code').value = e.code;
      // Only width and centring change here; the height is embed.js's to keep.
      if (!frame.style.display) frame.setAttribute('style', e.style);
      frame.style.maxWidth = (/max-width:(\d+px)/.exec(e.style) || [])[1] || '';
      frame.style.margin = q.center ? '0 auto' : '';
      if (e.src !== lastSrc) { lastSrc = e.src; frame.src = '/' + e.src; }
    };
    $$('input, select', pane).forEach(el => el.addEventListener('input', update));
    $('#e-copy', pane).addEventListener('click', async () => {
      try { await navigator.clipboard.writeText($('#e-code').value); } catch (e) { $('#e-code').select(); document.execCommand('copy'); }
      toast('Embed code copied.');
    });
    update();
  }

  /* ---------------------------------------------------------- settings */
  function drawSettings(pane) {
    const w = D, g = w.gallery;
    pane.innerHTML = `
      <form class="form" id="set-form">
        <h3>Walkthrough</h3>
        <label>Title<input name="title" value="${esc(w.title)}" required></label>
        <label>Subtitle<input name="subtitle" value="${esc(w.subtitle)}"><small>Shown under the title above the player.</small></label>
        <label>Tempo
          <div class="tempo"><input type="range" name="tempoRange" min="0.5" max="2" step="0.05" value="${w.tempo}"><input type="number" name="tempo" min="0.5" max="2" step="0.05" value="${w.tempo}"></div>
          <small>Overall speed of voice and animation. 1 is normal; 0.8 to 1.3 is the comfortable range. Viewers' speed button multiplies on top.</small>
        </label>
        <label>Narration
          <select name="mode">
            <option value="transcript"${w.mode === 'transcript' ? ' selected' : ''}>Captions only (timed text, no voice)</option>
            <option value="audio"${w.mode === 'audio' ? ' selected' : ''}>Recorded audio (ElevenLabs clips)</option>
            <option value="speech"${w.mode === 'speech' ? ' selected' : ''}>Browser voice (built-in, quality varies)</option>
          </select>
        </label>
        <label>Captions
          <div class="row" style="margin-top:6px;flex-wrap:nowrap">
            <select name="captions" style="margin:0">
              <option value="on"${w.captions ? ' selected' : ''}>On when it starts</option>
              <option value="off"${w.captions ? '' : ' selected'}>Off when it starts</option>
            </select>
            <button class="btn" type="button" id="cc-all" style="white-space:nowrap">Apply to all walkthroughs</button>
          </div>
          <small>Viewers can always switch them with the CC button. A link or embed can override this. Exported videos aren't affected.</small>
        </label>
        <div class="note" id="cc-note" hidden>This walkthrough plays captions only, with no voice. With captions off, viewers get no explanation unless they press CC.</div>
        <label>Voice
          <div class="row" style="margin-top:6px;flex-wrap:nowrap">
            <select name="voice" style="margin:0">
              <option value="">Default (${esc(S.voice.name)})</option>
              ${(S.voice.voices || []).map(v => `<option value="${esc(v.id)}"${w.voice.picked && w.voice.id === v.id ? ' selected' : ''}>${esc(v.name)}</option>`).join('')}
            </select>
            <button class="btn" type="button" id="v-preview" ${S.hasKey ? '' : 'disabled'}>${ICON.play} Preview</button>
          </div>
          <small>The ElevenLabs voice for this walkthrough's audio. Preview reads its first line in the chosen voice (about ${(w.chapters[0] && w.chapters[0].lines[0] ? w.chapters[0].lines[0].chars : 100)} characters the first time; replays are free). Changing the voice means every line needs new audio. Manage the list on the Voices page.</small>
        </label>
        <h3 style="margin-top:22px">Gallery card</h3>
        <label class="check"><input type="checkbox" name="show"${g ? ' checked' : ''}> Show on the gallery page</label>
        <div id="g-fields"${g ? '' : ' hidden'}>
          <label>Card title<input name="gtitle" value="${esc(g ? g.title : w.title)}"></label>
          <label>Summary<input name="gsummary" value="${esc(g ? g.summary : '')}" placeholder="One line on what the viewer will see"></label>
          <label>Length<input name="glength" value="${esc(g ? g.length : '')}" placeholder="~2 min"></label>
        </div>
        <div class="row end"><button class="btn primary" type="submit">Save settings</button></div>
      </form>
      <div class="form">
        <h3>Files</h3>
        <p class="muted" style="margin:0">Scenes and animations live in <code>walkthroughs/${esc(w.name)}/walkthrough.js</code>. The authoring guide is <code>framework/README.md</code>. Voices and pronunciations for all walkthroughs are on the Voices page.</p>
      </div>`;
    const f = $('#set-form', pane);
    f.tempoRange.addEventListener('input', () => { f.tempo.value = f.tempoRange.value; });
    f.tempo.addEventListener('input', () => { f.tempoRange.value = f.tempo.value; });
    f.show.addEventListener('change', () => { $('#g-fields', pane).hidden = !f.show.checked; });
    const ccNote = () => { $('#cc-note', pane).hidden = !(f.captions.value === 'off' && f.mode.value === 'transcript'); };
    f.captions.addEventListener('change', ccNote);
    f.mode.addEventListener('change', ccNote);
    ccNote();
    $('#cc-all', pane).addEventListener('click', async () => {
      const on = f.captions.value === 'on';
      if (!confirm(`Start captions ${on ? 'on' : 'off'} in every walkthrough?${on ? '' : ' Captions-only walkthroughs keep them on, since they have no voice.'}`)) return;
      try {
        const r = await api('captions-all', { on });
        await loadState();
        if (on || w.mode !== 'transcript') w.captions = on;
        toast(r.failed.length ? `Couldn't change: ${r.failed.join(', ')}.` : `Captions now start ${on ? 'on' : 'off'}.${r.skipped.length ? ` Kept on (no voice): ${r.skipped.join(', ')}.` : ''}`, r.failed.length > 0);
      } catch (err) { fail(err); }
    });
    $('#v-preview', pane).addEventListener('click', function () {
      const line = w.chapters[0] && w.chapters[0].lines[0];
      previewVoice(this, f.voice.value || S.voice.id, line ? line.caption : undefined);
    });
    f.addEventListener('submit', async e => {
      e.preventDefault();
      const was = w.voice.picked ? w.voice.id : '', now = f.voice.value;
      const newId = now || S.voice.id;
      if (now !== was && newId !== w.voice.id &&
        !confirm(`Switch this walkthrough's voice? All ${w.lines} lines will need new audio (about ${w.allChars.toLocaleString()} ElevenLabs characters when you generate it).`)) return;
      try {
        if (now !== was) await api(`w/${encodeURIComponent(current)}/voice`, { voiceId: now || null });
        D = await api(`w/${encodeURIComponent(current)}/settings`, {
          settings: { title: f.title.value.trim(), subtitle: f.subtitle.value.trim(), tempo: +f.tempo.value, captions: f.captions.value === 'on', mode: f.mode.value },
          gallery: f.show.checked ? { title: f.gtitle.value.trim() || f.title.value.trim(), summary: f.gsummary.value.trim(), length: f.glength.value.trim() } : { show: false }
        });
        await loadState();
        draw();
        toast('Settings saved.');
      } catch (err) { fail(err); }
    });
  }

  // Plays a short sample of a voice (generated once, then cached). btn shows progress.
  async function previewVoice(btn, voiceId, text) {
    if (btn.disabled) return;
    const label = btn.innerHTML;
    btn.disabled = true; btn.textContent = 'Generating…';
    try {
      const r = await api('voice-preview', { voiceId, text });
      stopAudio();
      player.src = r.url;
      await player.play();
      if (!r.cached) toast(`Preview made (${r.chars} characters). Replaying it is free.`);
    } catch (e) { fail(e); }
    btn.disabled = false; btn.innerHTML = label;
  }

  /* ------------------------------------------------------------ voices */
  $('#voices-btn').addEventListener('click', () => { if (confirmLeave()) openVoices(); });
  async function openVoices() {
    page = 'voices'; current = null;
    try { location.hash = 'voices'; } catch (e) { /* ignore */ }
    await loadState();
    main.innerHTML = '';
    drawVoices(S.voice.voices.map(v => ({ ...v })), S.voice.id);
    drawPronunciations(savedPronunciations());
  }
  function drawVoices(list, defaultId) {
    const used = {};
    // Redrawing the voice list keeps any unsaved pronunciation edits below it.
    const pron = $('#p-slot');
    main.innerHTML = `
      <div class="wh"><div class="grow"><h2>Voices</h2><p class="muted">The ElevenLabs voices you can pick for a walkthrough (in its Settings tab). The default is used by every walkthrough that hasn't picked one. Model and settings are shared by all voices and stay in <code>walkthroughs/voice.json</code>.</p></div></div>
      <form class="form" id="v-form" style="max-width:860px">
        <div class="v-rows">
          ${list.map((v, i) => `
            <div class="v-row" data-i="${i}">
              <label class="check" title="Default voice"><input type="radio" name="def" value="${i}"${v.id === defaultId ? ' checked' : ''}> Default</label>
              <input name="name" value="${esc(v.name)}" placeholder="Name" aria-label="Voice name">
              <input name="id" value="${esc(v.id)}" placeholder="ElevenLabs voice ID" aria-label="Voice ID" class="mono">
              <button class="btn small" type="button" data-v="preview" ${S.hasKey ? '' : 'disabled'}>${ICON.play} Preview</button>
              <button class="icon-btn" type="button" data-v="remove" title="Remove" ${list.length > 1 ? '' : 'disabled'}>${ICON.x}</button>
            </div>`).join('')}
        </div>
        <button class="btn small" type="button" id="v-add">+ Add a voice</button>
        <label style="margin-top:16px">Preview sentence<input name="sample" value="Hi! This is how a Klick-Zen walkthrough sounds in this voice."><small>Each new preview uses its length in ElevenLabs characters; replaying one is free.</small></label>
        <p class="muted" style="font-size:12.5px">Find a voice's ID in ElevenLabs under Voices: open the voice and use "Copy voice ID". Your plan must allow API use of that voice.</p>
        <div class="row end"><button class="btn primary" type="submit">Save voices</button></div>
      </form>`;
    if (pron) main.appendChild(pron);
    const f = $('#v-form');
    const read = () => $$('.v-row', f).map(r => ({ name: $('[name=name]', r).value.trim(), id: $('[name=id]', r).value.trim() }));
    const def = () => { const c = $('[name=def]:checked', f); return c ? +c.value : 0; };
    f.addEventListener('click', e => {
      const b = e.target.closest('[data-v]');
      if (!b) return;
      const i = +b.closest('.v-row').dataset.i, cur = read();
      if (b.dataset.v === 'remove') { const d = def(); cur.splice(i, 1); drawVoices(cur, (cur[d > i ? d - 1 : d === i ? 0 : d] || cur[0]).id); }
      if (b.dataset.v === 'preview') previewVoice(b, cur[i].id, f.sample.value);
    });
    $('#v-add').addEventListener('click', () => { const cur = read(); const d = def(); cur.push({ name: '', id: '' }); drawVoices(cur, (cur[d] || cur[0]).id); $$('.v-row [name=name]').pop().focus(); });
    f.addEventListener('submit', async e => {
      e.preventDefault();
      const cur = read().filter(v => v.name || v.id);
      const newDefault = (read()[def()] || {}).id;
      if (newDefault !== S.voice.id) {
        const affected = S.walkthroughs.filter(w => !w.error && w.mode === 'audio' && !w.ownVoice).map(w => w.title || w.name);
        if (!confirm(`Change the default voice? Walkthroughs that use the default will need all their audio generated again${affected.length ? ': ' + affected.join(', ') : ''}.`)) return;
      }
      try {
        await api('voices', { voices: cur, defaultId: newDefault });
        await loadState();
        drawVoices(S.voice.voices.map(v => ({ ...v })), S.voice.id);
        toast('Voices saved.');
      } catch (err) { fail(err); }
    });
  }

  const savedPronunciations = () => Object.entries(S.voice.pronunciations || {}).map(([word, say]) => ({ word, say }));
  function drawPronunciations(list) {
    let slot = $('#p-slot');
    if (!slot) { slot = document.createElement('div'); slot.id = 'p-slot'; main.appendChild(slot); }
    slot.innerHTML = `
      <form class="form" id="p-form" style="max-width:860px">
        <h3>Pronunciations</h3>
        <p class="muted" style="font-size:12.5px">Words the voice should say differently from how the captions spell them, for every walkthrough and voice. A word only matches whole and with the same capitals, so "SLA" doesn't change "SLAs" or "sla". After saving, lines with a changed word show as needing new audio.</p>
        ${list.map((r, i) => `
          <div class="p-row" data-i="${i}">
            <input name="word" value="${esc(r.word)}" placeholder="Word, as written" aria-label="Word, as written">
            <input name="say" value="${esc(r.say)}" placeholder="Say it like" aria-label="Say it like">
            <button class="btn small" type="button" data-p="preview" title="Hear this in the default voice. Uses a few ElevenLabs characters the first time; replaying is free." ${S.hasKey ? '' : 'disabled'}>${ICON.play} Preview</button>
            <button class="icon-btn" type="button" data-p="remove" title="Remove">${ICON.x}</button>
          </div>`).join('')}
        <button class="btn small" type="button" id="p-add">+ Add a word</button>
        <div class="row end"><button class="btn primary" type="submit">Save pronunciations</button></div>
      </form>`;
    const f = $('#p-form');
    const read = () => $$('.p-row', f).map(r => ({ word: $('[name=word]', r).value.trim(), say: $('[name=say]', r).value.trim() }));
    f.addEventListener('click', e => {
      const b = e.target.closest('[data-p]');
      if (!b) return;
      const i = +b.closest('.p-row').dataset.i, cur = read();
      if (b.dataset.p === 'remove') { cur.splice(i, 1); drawPronunciations(cur); }
      if (b.dataset.p === 'preview') {
        if (cur[i].say) previewVoice(b, S.voice.id, cur[i].say);
        else toast('Fill in how to say it first.', true);
      }
    });
    $('#p-add').addEventListener('click', () => { const cur = read(); cur.push({ word: '', say: '' }); drawPronunciations(cur); $$('.p-row [name=word]').pop().focus(); });
    f.addEventListener('submit', async e => {
      e.preventDefault();
      try {
        await api('pronunciations', { rows: read().filter(r => r.word || r.say) });
        await loadState();
        drawPronunciations(savedPronunciations());
        toast('Pronunciations saved.');
      } catch (err) { fail(err); }
    });
  }

  /* --------------------------------------------------------------- zip */
  // Fetched rather than linked, so a failure shows as a toast instead of a broken download.
  $('#zip-btn').addEventListener('click', async e => {
    const btn = e.currentTarget, label = btn.textContent;
    btn.disabled = true; btn.textContent = 'Preparing ZIP…';
    try {
      const res = await fetch('/api/zip');
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = (/filename="([^"]+)"/.exec(res.headers.get('Content-Disposition')) || [])[1];
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) { fail(err); }
    finally { btn.disabled = false; btn.textContent = label; }
  });

  /* ----------------------------------------------------------- gallery */
  $('#gallery-btn').addEventListener('click', () => { if (confirmLeave()) openGallery(); });
  async function openGallery() {
    page = 'gallery'; current = null;
    try { location.hash = 'gallery'; } catch (e) { /* ignore */ }
    await loadState();
    drawGallery();
  }
  function drawGallery() {
    const g = S.gallery, missing = S.walkthroughs.filter(w => !g.some(e => e.folder === w.name));
    main.innerHTML = `
      <div class="wh"><div class="grow"><h2>Gallery</h2><p class="muted">The walkthroughs listed on <a href="/walkthroughs/" target="_blank" rel="noopener">the gallery page</a>, in order. Changes save immediately.</p></div></div>
      <div class="form">
        ${g.length ? g.map((e, i) => `
          <div class="g-item" data-i="${i}">
            <div class="grow"><b>${esc(e.title)}</b><small>${esc(e.folder)}${e.length ? ' · ' + esc(e.length) : ''}${e.summary ? ' · ' + esc(e.summary) : ''}</small></div>
            <button class="icon-btn" data-g="up" type="button" title="Move up" ${i ? '' : 'disabled'}>${ICON.up}</button>
            <button class="icon-btn" data-g="down" type="button" title="Move down" ${i < g.length - 1 ? '' : 'disabled'}>${ICON.down}</button>
            <button class="icon-btn" data-g="remove" type="button" title="Remove from gallery">${ICON.x}</button>
          </div>`).join('') : '<p class="muted">No walkthroughs are listed yet.</p>'}
        ${missing.length ? `<h3 style="margin-top:18px">Not in the gallery</h3>${missing.map(w => `
          <div class="g-item"><div class="grow"><b>${esc(w.title || w.name)}</b><small>${esc(w.name)}</small></div>
          <button class="btn small" data-add="${esc(w.name)}" type="button">Add</button></div>`).join('')}` : ''}
        <p class="muted" style="font-size:12.5px;margin-bottom:0">Edit a card's title, summary and length in that walkthrough's Settings tab.</p>
      </div>`;
    main.onclick = async e => {
      const b = e.target.closest('[data-g], [data-add]');
      if (!b || page !== 'gallery') return;
      const list = S.gallery.slice();
      if (b.dataset.add) {
        const w = S.walkthroughs.find(x => x.name === b.dataset.add);
        list.push({ folder: w.name, title: w.title || w.name, summary: '', length: '' });
      } else {
        const i = +b.closest('.g-item').dataset.i;
        if (b.dataset.g === 'up') [list[i - 1], list[i]] = [list[i], list[i - 1]];
        if (b.dataset.g === 'down') [list[i + 1], list[i]] = [list[i], list[i + 1]];
        if (b.dataset.g === 'remove') list.splice(i, 1);
      }
      try { await api('gallery', { entries: list }); await loadState(); drawGallery(); } catch (err) { fail(err); }
    };
  }


  /* ------------------------------------------------------- Ask Claude */
  const C = { events: [], total: 0, running: false, installed: true, docs: null, before: null };
  let pollTimer = null;

  $('#claude-btn').addEventListener('click', () => { if (confirmLeave()) openClaude(); });

  async function openClaude() {
    page = 'claude'; current = null;
    try { location.hash = 'claude'; } catch (e) { /* ignore */ }
    await loadState();
    await refreshClaude(true);
    drawClaude();
    if (C.running) pollClaude();
  }

  async function refreshClaude(all) {
    const st = await api('claude?since=' + (all ? 0 : C.total));
    C.events = all ? st.events : C.events.concat(st.events);
    C.total = st.total; C.installed = st.installed;
    const wasRunning = C.running;
    C.running = st.running;
    $('#claude-dot').hidden = !C.running;
    return { fresh: st.events, finished: wasRunning && !st.running };
  }

  // Polls while Claude works, from any page; the chat updates when it is showing.
  function pollClaude() {
    clearTimeout(pollTimer);
    pollTimer = setTimeout(async () => {
      try {
        const { fresh, finished } = await refreshClaude(false);
        if (page === 'claude') { appendEvents(fresh); setWorking(); }
        if (finished) {
          await loadState();
          if (page === 'claude') showOpenButtons();
          const ok = C.events.length && C.events[C.events.length - 1].kind === 'done';
          toast(ok ? 'Claude is done.' : 'Claude stopped.', !ok);
          notifyTitle(ok ? '✓ Claude is done' : 'Claude stopped');
        }
      } catch (e) { /* server restarting; try again */ }
      if (C.running) pollClaude();
    }, 900);
  }

  // Shows the news in the browser tab's title until this tab is looked at again.
  function notifyTitle(text) {
    if (!document.hidden) return;
    const base = notifyTitle.base || (notifyTitle.base = document.title);
    document.title = `${text} · ${base}`;
    document.addEventListener('visibilitychange', function back() {
      if (document.hidden) return;
      document.title = base;
      document.removeEventListener('visibilitychange', back);
    });
  }

  function md(text) {
    const blocks = esc(text).split(/```/);
    const inline = t => t.replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1');
    return blocks.map((b, i) => {
      if (i % 2) return `<pre class="log">${b.replace(/^[a-z]*\n/, '')}</pre>`;
      return b.split(/\n{2,}/).filter(par => par.trim()).map(par => {
        const lines = par.split('\n').filter(l => l.trim());
        if (lines.every(l => /^\s*([-*]|\d+\.)\s/.test(l))) {
          const ordered = /^\s*\d+\./.test(lines[0]);
          return `<${ordered ? 'ol' : 'ul'}>${lines.map(l => `<li>${inline(l.replace(/^\s*([-*]|\d+\.)\s/, ''))}</li>`).join('')}</${ordered ? 'ol' : 'ul'}>`;
        }
        if (/^#{1,4}\s/.test(par)) return `<h4>${inline(par.replace(/^#{1,4}\s/, ''))}</h4>`;
        return `<p>${inline(par).replace(/\n/g, '<br>')}</p>`;
      }).join('');
    }).join('');
  }

  function eventHtml(e) {
    if (e.kind === 'user') return `<div class="msg-user">${esc(e.text)}</div>`;
    if (e.kind === 'text') return `<div class="msg-text">${md(e.text)}</div>`;
    if (e.kind === 'tool') return `<div class="msg-tool">${esc(e.text)}</div>`;
    if (e.kind === 'tool-error') return `<div class="msg-tool err">${esc(e.text)}</div>`;
    if (e.kind === 'blocked' || e.kind === 'check-fail') return `<div class="msg-tool warn">${esc(e.text)}</div>`;
    if (e.kind === 'check-ok') return `<div class="msg-tool ok">${esc(e.text)}</div>`;
    if (e.kind === 'done') return `<div class="msg-done"><span class="tick">&#10003;</span><b>Claude is done</b><span>finished in ${e.seconds >= 60 ? Math.floor(e.seconds / 60) + 'm ' : ''}${e.seconds % 60}s</span></div>`;
    if (e.kind === 'stopped') return '<div class="msg-end err">Stopped.</div>';
    return `<div class="msg-end err">${esc(e.text)}</div>`;
  }

  function drawClaude() {
    const empty = !C.events.length;
    main.innerHTML = `
      <div class="wh"><div class="grow"><h2>Ask Claude</h2>
        <p class="muted">Claude Code works right in this project: it reads the Klick-Zen docs, writes walkthroughs and their animations, and checks they play. It never generates audio; you do that on a walkthrough's Script tab once you're happy with the words.</p></div>
        <button class="btn" id="c-reset" type="button" ${empty ? 'disabled' : ''}>New conversation</button></div>
      ${C.installed ? '' : '<div class="note">Claude Code isn\'t installed on this computer, so this panel can\'t run. Install it, run <code>claude</code> once in a terminal to sign in, then reload this page.</div>'}
      <div id="c-start" ${empty ? '' : 'hidden'}>
        <div class="starters">
          <button class="starter" data-start="new" type="button"><b>New walkthrough</b><span>From a docs page: Claude writes the script, builds the animation and checks it plays.</span></button>
          <button class="starter" data-start="change" type="button"><b>Change a walkthrough</b><span>Add a step, change what's shown, or rework the pacing.</span></button>
          <button class="starter" data-start="check" type="button"><b>Check a walkthrough</b><span>Play it through, find errors, and fix them.</span></button>
        </div>
        <form class="form brief" id="c-brief" hidden>
          <label>Docs page<select name="doc" required><option value="">Loading…</option></select><small>What the walkthrough explains. Claude reads this page (and related ones) for the details. <span id="c-docs-src"></span></small></label>
          <label>Audience<input name="audience" value="Potential customers evaluating Klick-Zen"></label>
          <label>Length<select name="length"><option>about 1 minute</option><option selected>about 2 minutes</option><option>about 3 minutes</option></select></label>
          <label class="full">Emphasise (optional)<input name="focus" placeholder="e.g. how little setup it needs; the customer's experience"></label>
          <div class="row end full"><button class="btn ghost" type="button" id="c-brief-cancel">Cancel</button><button class="btn primary" type="submit">Write the request</button></div>
        </form>
      </div>
      <div class="chat" id="chat">${C.events.map(eventHtml).join('')}</div>
      <div id="c-after"></div>
      <div class="working" id="c-working" hidden><span class="spinner"></span><span>Claude is working. A new walkthrough can take several minutes; you can use the rest of the admin meanwhile.</span></div>
      <div class="composer">
        <textarea id="c-input" placeholder="${empty ? 'Describe what you want, or pick a starter above.' : 'Reply, or ask for changes…'}" ${C.installed ? '' : 'disabled'}></textarea>
        <div class="row end"><span class="muted" style="font-size:12px">Ctrl+Enter to send</span><span class="grow"></span>
          <button class="btn" id="c-stop" type="button" hidden>Stop</button>
          <button class="btn primary" id="c-send" type="button" ${C.installed ? '' : 'disabled'}>Send</button></div>
      </div>`;
    setWorking();
    const chat = $('#chat');
    if (chat.lastElementChild) chat.lastElementChild.scrollIntoView({ block: 'end' });
    const input = $('#c-input');
    input.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); sendClaude(); } });
    $('#c-send').addEventListener('click', sendClaude);
    $('#c-stop').addEventListener('click', async () => { try { await api('claude/stop', {}); } catch (e) { fail(e); } });
    $('#c-reset').addEventListener('click', async () => {
      if (!confirm('Start a new conversation? Claude forgets this one (your files are not affected).')) return;
      try { await api('claude/reset', {}); C.events = []; C.total = 0; drawClaude(); } catch (e) { fail(e); }
    });
    $$('[data-start]', main).forEach(b => b.addEventListener('click', () => starter(b.dataset.start)));
    $('#c-brief-cancel').addEventListener('click', () => { $('#c-brief').hidden = true; });
    $('#c-brief').addEventListener('submit', e => {
      e.preventDefault();
      const f = e.target, doc = C.docs.pages.find(d => d.path === f.doc.value);
      const arg = doc.path.replace(/^\/|\/$/g, '');
      input.value = `Create a new walkthrough about ${/^["“]/.test(doc.title) ? doc.title : `"${doc.title}"`} (${doc.section}), based on the docs page ${doc.path} ` +
        `(read it with: node tools/read-docs.js ${arg}) and any related docs pages.\n` +
        `Audience: ${f.audience.value.trim() || 'potential customers'}.\nLength: ${f.length.value}.\n` +
        (f.focus.value.trim() ? `Emphasise: ${f.focus.value.trim()}.\n` : '') +
        'Follow CLAUDE.md, add it to the gallery, and make sure tools/check-walkthrough.js passes.';
      $('#c-brief').hidden = true;
      input.focus();
    });
  }

  async function starter(kind) {
    const input = $('#c-input');
    const name = (S.walkthroughs.find(w => !w.error) || {}).name || 'quick-start';
    if (kind === 'new') {
      const form = $('#c-brief');
      form.hidden = false;
      if (!C.docs) { try { C.docs = await api('docs'); } catch (e) { return fail(e); } }
      const groups = {};
      C.docs.pages.forEach(d => { (groups[d.section] = groups[d.section] || []).push(d); });
      $('#c-docs-src').innerHTML = C.docs.source === 'live'
        ? `${C.docs.pages.length} pages from the live docs at <code>${esc(C.docs.base)}</code>.`
        : `<b>The live docs site couldn't be reached</b> (${esc(C.docs.liveError || 'no docsUrl in config.json')}), so these are from the offline copy, which may be out of date.`;
      form.doc.innerHTML = '<option value="">Choose a page…</option>' + Object.entries(groups).map(([g, list]) =>
        `<optgroup label="${esc(g)}">${list.map(d => `<option value="${esc(d.path)}">${esc(d.title)}</option>`).join('')}</optgroup>`).join('');
      form.doc.focus();
      return;
    }
    input.value = kind === 'change' ? `In the ${name} walkthrough, ` : `Check the ${name} walkthrough with tools/check-walkthrough.js and fix anything it reports.`;
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }

  async function sendClaude() {
    const input = $('#c-input');
    const text = input.value.trim();
    if (!text || C.running) return;
    try {
      C.before = new Set(S.walkthroughs.map(w => w.name));
      await api('claude/send', { prompt: text });
      input.value = '';
      $('#c-start').hidden = true;
      $('#c-reset').disabled = false;
      $('#c-after').innerHTML = '';
      C.running = true;
      $('#claude-dot').hidden = false;
      const { fresh } = await refreshClaude(false);
      appendEvents(fresh);
      setWorking();
      pollClaude();
    } catch (e) { fail(e); }
  }

  function appendEvents(list) {
    const chat = $('#chat');
    if (!chat || !list.length) return;
    chat.insertAdjacentHTML('beforeend', list.map(eventHtml).join(''));
    chat.lastElementChild.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }

  function setWorking() {
    const w = $('#c-working');
    if (!w) return;
    w.hidden = !C.running;
    $('#c-stop').hidden = !C.running;
    $('#c-send').disabled = C.running || !C.installed;
  }

  // After a run: buttons to open walkthroughs that are new, or that Claude's messages mention.
  function showOpenButtons() {
    const names = S.walkthroughs.map(w => w.name);
    const said = C.events.filter(e => e.kind === 'text' || e.kind === 'tool').map(e => e.text).join(' ');
    const hit = names.filter(n => (C.before && !C.before.has(n)) || said.includes(`walkthroughs/${n}`));
    const box = $('#c-after');
    if (!box || !hit.length) return;
    box.innerHTML = `<div class="msg-open">${hit.map(n => `<button class="btn" data-open="${esc(n)}" type="button">Open ${esc((S.walkthroughs.find(w => w.name === n) || {}).title || n)}</button>`).join('')}</div>`;
    $$('[data-open]', box).forEach(b => b.addEventListener('click', () => { open(b.dataset.open).then(() => { tab = 'preview'; draw(); }); }));
  }

  /* ------------------------------------------------------------ create */
  const dlg = $('#new-dlg'), form = $('#new-form');
  $('#new-btn').addEventListener('click', () => { if (!confirmLeave()) return; form.reset(); $('#new-err').textContent = ''; dlg.showModal(); });
  form.title.addEventListener('input', () => {
    if (form.name.dataset.touched) return;
    form.name.value = form.title.value.toLowerCase().split(':')[0].replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  });
  form.name.addEventListener('input', () => { form.name.dataset.touched = '1'; });
  form.addEventListener('submit', async e => {
    if (e.submitter && e.submitter.value === 'cancel') return;
    e.preventDefault();
    try {
      await api('new', { name: form.name.value.trim(), title: form.title.value.trim() });
      dlg.close();
      delete form.name.dataset.touched;
      await open(form.name.value.trim());
      toast('Created. Build its scenes and animation in walkthrough.js.');
    } catch (err) { $('#new-err').textContent = err.message; }
  });

  /* -------------------------------------------------------------- boot */
  (async () => {
    try {
      await loadState();
      const h = decodeURIComponent(location.hash.slice(1));
      pollClaude();
      if (h === 'gallery') return openGallery();
      if (h === 'voices') return openVoices();
      if (h === 'claude') return openClaude();
      const first = S.walkthroughs.find(w => w.name === h) || S.walkthroughs.find(w => !w.error);
      if (first) await open(first.name);
    } catch (e) { main.innerHTML = `<div class="note">Can't reach the admin server: ${esc(e.message)}. Is <code>node tools/admin/server.js</code> running?</div>`; }
  })();
})();
