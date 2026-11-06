/* Klick-Zen Online Template Generator: build an email with buttons, import the buttons, link them, paste into Zendesk. */
(function () {
  'use strict';

  const K = KZKit;
  const DARK = '#1f2a37';
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const COPY_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>';

  // The generator's choices (labels from the docs).
  const WHEN = ['Ticket received', 'Pending reminder', 'Solved', 'CSAT survey', 'Re-engagement'];
  const DO = ['Reply', 'Confirm it’s fixed', 'Pick a topic', 'Rate us', 'Answer a question'];
  const TONE = ['Friendly', 'Professional'];
  const TEMPLATES = ['Choose a ready-made template…', 'Approval request', 'Refund decision', 'Escalation', 'Appointment confirmation'];
  const FILE = 'klick-zen-buttons-solved-confirm-it-s-fixed.kzb';

  // Buttons the generator lays out, per "What should the customer do?" choice.
  const TOPIC_BTNS = [{ label: 'Billing question', bg: '#2563d9' }, { label: 'Technical issue', bg: '#5a3fd0' }, { label: 'Order status', bg: '#127566' }];
  const CONFIRM_BTNS = [
    { label: 'Yes, all set', name: 'Yes all set', bg: K.GREEN, chips: ['Status → Solved', 'Tag customer_confirmed'], skip: 'Skip if tag customer_confirmed' },
    { label: 'I still need help', name: 'I still need help', bg: DARK, chips: ['Status → Open', 'Tag customer_needs_help'], skip: 'Skip if tag customer_needs_help' }
  ];
  const SNIP = "<a href='https://app.klick-zen.com/ext/href/7c2e91ab-…/{{ticket.id}}/{{ticket.requester.id}}'><img src='https://app.klick-zen.com/ext/src/7c2e91ab-…/{{ticket.id}}' /></a>";
  const GEN_HTML = "<table role=\"presentation\" width=\"100%\" style=\"font-family:Arial,sans-serif;font-size:15px;color:#2f3941\"><tr><td><p>Hi {{ticket.requester.first_name}},</p><p>Good news: we've marked ticket #{{ticket.id}} as solved. Is everything working the way it should?</p><p><a href='https://app.klick-zen.com/ext/href/7c2e91ab-…/{{ticket.id}}/{{ticket.requester.id}}'><img src='https://app.klick-zen.com/ext/src/7c2e91ab-…/{{ticket.id}}' alt='Yes, all set' /></a> <a href='https://app.klick-zen.com/ext/href/d41f0c37-…/{{ticket.id}}/{{ticket.requester.id}}'><img src='https://app.klick-zen.com/ext/src/d41f0c37-…/{{ticket.id}}' alt='I still need help' /></a></p><p>Thanks,<br>The Support Team</p></td></tr></table>";

  // Scroll offset for the left panel that brings an element (inside #tg-inner) into view.
  const scrollFor = (sel, margin = 80) => {   // margin keeps it clear of the step badge
    const el = document.querySelector(sel), box = document.querySelector('#tg-opts');
    return Math.max(0, el.offsetTop + el.offsetHeight + margin - box.clientHeight);
  };

  const pb = (b, real, extra = '') => `<span class="tg-pb${real ? ' tg-real' : ''}"${real ? ` style="background:${b.bg}"` : ''}${extra}>${esc(b.label)}</span>`;
  const chipRow = (items, sel) => `<div class="tg-chips">${items.map((t, i) => `<span class="tg-chip" id="tg-${sel}-${i}">${esc(t)}</span>`).join('')}</div>`;

  // The generator page (a browser window).
  const genScene = `
    <section class="scene tg-scene" data-scene="gen"><div class="cam">
      <div class="tg-win">
        <div class="tg-bar"><div class="tg-dots"><i></i><i></i><i></i></div><div class="tg-url">klick-zen.com/email-template-generator</div>
          <div class="tg-dlfile" id="tg-dlfile"><div class="tg-fic">KZB</div><div><b>${FILE}</b><small>Download complete · 4 KB</small></div></div></div>
        <div class="tg-head"><img src="${K.assets}klick-zen-logo.png" alt=""><h1>Zendesk Email Template Generator</h1><span class="tg-free">FREE</span></div>
        <div class="tg-cols">
          <div class="tg-opts" id="tg-opts"><div class="tg-inner" id="tg-inner">
            <h3>Build your email</h3>
            <div class="tg-q" id="tg-q-when"><label>When does the email go out?</label>${chipRow(WHEN, 'when')}</div>
            <div class="tg-q" id="tg-q-do"><label>What should the customer do?</label>${chipRow(DO, 'do')}</div>
            <div class="tg-q" id="tg-q-tone"><label>Tone</label><div class="tg-seg">${TONE.map((t, i) => `<span id="tg-tone-${i}">${t}</span>`).join('')}</div></div>
            <div class="tg-q"><label>Or start from a ready-made template</label>
              <div class="tg-sel" id="tg-tpl">${esc(TEMPLATES[0])} ${K.CHEVRON}
                <div class="tg-list" id="tg-tpl-list">${TEMPLATES.slice(1).map(t => `<div>${esc(t)}</div>`).join('')}<div>…and more</div></div></div></div>
            <div class="tg-more">&#9656; More options</div>
            <div class="tg-sec" id="tg-sec">
              <h3>Making it a working email</h3>
              <div class="tg-goes">Where it goes: a Zendesk <b>trigger</b>, sent when the ticket is solved</div>
              <div class="tg-what" id="tg-what"><div class="tg-what-h" id="tg-what-h"><i>&#9656;</i>What each button does</div>
                <div class="tg-what-b">${CONFIRM_BTNS.map(b => `<div class="tg-wrow"><div>${pb(b, true)}</div>${b.chips.map(c => `<span class="tg-c">${esc(c)}</span>`).join('')}<span class="tg-c tg-x">${esc(b.skip)}</span></div>`).join('')}</div></div>
              <div class="tg-links" id="tg-links"><h4>Your Klick-Zen button links</h4>
                <div class="tg-note" id="tg-note"></div>
                <span class="tg-dl" id="tg-dl"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>Download buttons</span>
                ${CONFIRM_BTNS.map((b, i) => `<div class="tg-lrow" id="tg-lrow-${i}"><span class="tg-pb" id="tg-lb-${i}">${esc(b.label)}</span><div class="tg-in" id="tg-link-${i}"></div></div>`).join('')}
              </div>
            </div>
          </div></div>
          <div class="tg-prev" id="tg-prev">
            <div class="tg-ptop"><div class="tg-tabs"><span id="tg-tab-preview">Preview</span><span id="tg-tab-html">HTML</span></div>
              <div class="tg-sample" id="tg-sample"><span class="tg-box" id="tg-sample-box">${K.CHECK(12)}</span>Show sample data</div></div>
            <div class="tg-mail" id="tg-mail">
              <div class="tg-subj">Subject: <b id="tg-subj"></b></div>
              <div class="tg-body" id="tg-body"></div>
              <div class="tg-code" id="tg-code">${esc(GEN_HTML)}</div>
            </div>
            <div class="tg-pfoot"><span class="tg-copy" id="tg-copy">${COPY_ICON}Copy HTML<em class="tg-copied">Copied!</em></span></div>
          </div>
        </div>
      </div>
    </div></section>`;

  // The Import buttons dialogs, laid over the Klick-Zen app (added once by render).
  const importOverlay = `
    <div class="tg-ov" id="tg-ov">
      <div class="tg-dlg" id="tg-dlg-pick"><div class="tg-dlg-h">Import buttons</div>
        <div class="tg-dlg-b"><div class="tg-pick" id="tg-pick">Choose a .kzb button file<small>Made by the Klick-Zen Email Template Generator</small></div></div>
        <div class="tg-dlg-f"><span class="tg-btn tg-out">Cancel</span></div></div>
      <div class="tg-dlg" id="tg-dlg-import"><div class="tg-dlg-h">Import buttons <small>${FILE}</small></div>
        <div class="tg-dlg-b"><div class="tg-sall">Select all / Select none</div>
          ${CONFIRM_BTNS.map((b, i) => `<div class="tg-irow" id="tg-irow-${i}"><span class="tg-chk">${K.CHECK(13)}</span>${pb(b, true)}<span class="tg-nm">${esc(b.name)}</span>
            <span class="tg-sum">${b.chips.map(c => `<span class="tg-c">${esc(c)}</span>`).join('')}<span class="tg-c tg-x">${esc(b.skip)}</span></span></div>`).join('')}</div>
        <div class="tg-dlg-f"><span class="tg-btn tg-out">Cancel</span><span class="tg-btn tg-pri" id="tg-imp-go">Import 2 buttons</span></div></div>
      <div class="tg-dlg" id="tg-dlg-sum"><div class="tg-dlg-h">2 buttons imported <small>Copy each button’s HTML into the generator</small></div>
        <div class="tg-dlg-b">
          ${CONFIRM_BTNS.map((b, i) => `<div class="tg-irow" id="tg-srow-${i}">${pb(b, true)}<span class="tg-nm">${esc(b.name)}</span>
            <span class="tg-snip"><code>${esc(SNIP)}</code><i id="tg-scopy-${i}">${COPY_ICON}</i></span></div>`).join('')}</div>
        <div class="tg-dlg-f"><span class="tg-btn tg-pri" id="tg-done">Done</span></div></div>
    </div>`;

  // The email in the preview, from the current choices.
  function previewHtml(M) {
    const ph = (t, v) => M.tgSample ? esc(v) : `<span class="tg-ph">${esc(t)}</span>`;
    const fn = ph('{{ticket.requester.first_name}}', 'Jordan'), id = ph('{{ticket.id}}', '4821');
    const friendly = M.tgTone === 0, solved = M.tgWhen === 2;
    const subj = solved ? (friendly ? `All sorted, ${fn}?` : `Your request #${id} has been solved`) : (friendly ? 'Thanks, we’ve got your request!' : 'We have received your request');
    const msg = solved
      ? (friendly ? `Good news: we’ve marked ticket #${id} as solved. Is everything working the way it should?` : `We have marked your request #${id} as solved. Please let us know whether the issue has been resolved.`)
      : (friendly ? `Thanks for getting in touch! We’ve opened ticket #${id}, and we’ll be with you shortly.` : `Thank you for contacting us. Your request #${id} has been received, and an agent will respond shortly.`);
    const ask = M.tgDo === 1 ? '' : '<p>So we can route it to the right person, what is it about?</p>';
    const btns = M.tgDo === 1 ? CONFIRM_BTNS.map((b, i) => pb(b, M.tgLinked[i], ` id="tg-pv-${i}"`)).join('') : TOPIC_BTNS.map(b => pb(b, false)).join('');
    return {
      subj,
      body: `<p>${friendly ? 'Hi' : 'Dear'} ${fn},</p><p>${msg}</p>${ask}<div class="tg-btns" id="tg-btns">${btns}</div><p style="margin:0;color:#68737d">${friendly ? 'Thanks,' : 'Kind regards,'}<br>The Support Team</p>`
    };
  }

  KZWalkthrough.create({
    title: 'Klick-Zen Online Template Generator',
    subtitle: 'An animated walkthrough, about two minutes',
    logo: { light: '../../framework/assets/klick-zen-logo.png', dark: '../../framework/assets/klick-zen-logo-dark.png' },
    intro: { title: 'The Online Template Generator', text: 'A ready-to-paste Zendesk email, with working buttons, in a few minutes.' },
    end: {
      title: 'A finished email. Working buttons.',
      text: 'Ready to try it with your own customers?',
      link: { href: K.MARKETPLACE, label: 'Get Klick-Zen on the Zendesk Marketplace →' }
    },
    narration: { mode: 'audio' },
    captions: false,
    tempo: 1.15,

    stage: [
      K.titleScene({
        headline: 'The email <em>and</em> the buttons, written for you.',
        lead: 'Pick a few options, and get a ready-to-paste Zendesk email with Klick-Zen buttons already laid out.',
        card: { from: 'Acme Support', subject: 'All sorted, Jordan?', text: 'Good news: we’ve marked your ticket as solved. Is everything working the way it should?', button: 'Yes, all set', done: 'Ticket confirmed' }
      }),
      genScene,
      K.zendeskScene({
        views: { views: false },
        trigger: { title: 'Notify requester: ticket solved', subject: 'All sorted, {{ticket.requester.first_name}}?' },
        ticket: { tags: ['billing'], event: 'Jordan Lee clicked <b>Yes, all set</b> &middot; Tag added: customer_confirmed' }
      }),
      K.inboxScene({
        subject: 'All sorted, Jordan?',
        paragraphs: ['Hi Jordan,', 'Good news: we’ve marked ticket #4821 as solved. Is everything working the way it should?'],
        signature: 'The Support Team'
      }),
      K.browserScene({ name: 'landing' }),
      K.outroScene({
        headline: 'A finished email.<br><em>Working buttons.</em>',
        ideas: ['Five moments in a ticket’s life', 'Ready-made templates to start from', 'Every button imported in one step'],
        cta: { eyebrow: 'Available on the', big: 'Zendesk Marketplace', pill: 'klick-zen.com' }
      })
    ].join(''),

    state: Object.assign(K.defaults(), {
      label: 'Yes, all set', bg: K.GREEN, fg: '#ffffff', bold: true, round: 0.86,   // the inbox button
      tgWhen: 0, tgDo: 2, tgTone: 1, tgSample: false, tgTplOpen: false, tgWhatOpen: false, tgScroll: 0,
      tgDlBubble: false, tgLinked: [false, false], tgTab: 'preview', tgCopied: false,
      tgModal: null, tgSumCopied: -1, tgTagged: false
    }),

    render(M, api) {
      K.render(M, api);
      const $ = s => api.$(s);

      // generator: choices
      WHEN.forEach((t, i) => $('#tg-when-' + i).classList.toggle('tg-on', M.tgWhen === i));
      DO.forEach((t, i) => $('#tg-do-' + i).classList.toggle('tg-on', M.tgDo === i));
      TONE.forEach((t, i) => $('#tg-tone-' + i).classList.toggle('tg-on', M.tgTone === i));
      $('#tg-tpl-list').classList.toggle('tg-on', M.tgTplOpen);
      $('#tg-inner').style.transform = `translateY(${-(M.tgScroll || 0)}px)`;
      $('#tg-what').classList.toggle('tg-open', M.tgWhatOpen);
      $('#tg-dlfile').classList.toggle('tg-on', M.tgDlBubble);

      // generator: button links
      const linked = M.tgLinked.filter(Boolean).length;
      const note = $('#tg-note');
      note.textContent = linked === CONFIRM_BTNS.length ? 'All buttons are linked.' : 'Paste each button’s Klick-Zen HTML into the box next to it.';
      note.classList.toggle('tg-ok', linked === CONFIRM_BTNS.length);
      CONFIRM_BTNS.forEach((b, i) => {
        const box = $('#tg-link-' + i);
        box.textContent = M.tgLinked[i] ? SNIP : 'Paste the button’s HTML or link';
        box.classList.toggle('tg-filled', M.tgLinked[i]);
        const lb = $('#tg-lb-' + i);
        lb.classList.toggle('tg-real', M.tgLinked[i]);
        lb.style.background = M.tgLinked[i] ? b.bg : '';
      });

      // generator: preview
      const p = previewHtml(M);
      $('#tg-subj').innerHTML = p.subj;
      if ($('#tg-body').dataset.html !== p.body) { $('#tg-body').innerHTML = p.body; $('#tg-body').dataset.html = p.body; }
      $('#tg-sample-box').classList.toggle('tg-on', M.tgSample);
      $('#tg-tab-preview').classList.toggle('tg-on', M.tgTab === 'preview');
      $('#tg-tab-html').classList.toggle('tg-on', M.tgTab === 'html');
      $('#tg-code').classList.toggle('tg-on', M.tgTab === 'html');
      $('#tg-copy').classList.toggle('tg-on', M.tgCopied);

      // Klick-Zen: the import dialogs (added once)
      if (!$('#tg-ov')) $('#kz').insertAdjacentHTML('beforeend', importOverlay);
      $('#tg-ov').classList.toggle('tg-on', !!M.tgModal);
      $('#tg-dlg-pick').classList.toggle('tg-on', M.tgModal === 'pick');
      $('#tg-dlg-import').classList.toggle('tg-on', M.tgModal === 'import');
      $('#tg-dlg-sum').classList.toggle('tg-on', M.tgModal === 'summary');
      CONFIRM_BTNS.forEach((b, i) => $('#tg-scopy-' + i).classList.toggle('tg-on', M.tgSumCopied >= i));

      // inbox: the second button beside the kit's (added once)
      if (!$('#tg-mail-help')) $('#mail-btn').insertAdjacentHTML('afterend', '<span class="tg-mail-help" id="tg-mail-help">I still need help</span>');

      // ticket: already solved when the email went out; the click adds the tag
      const props = $('#zd-ticket .tk-props');
      if (!$('#tg-newtag')) props.lastElementChild.querySelector('.tr-in').insertAdjacentHTML('beforeend', '<span class="tg-newtag" id="tg-newtag">customer_confirmed</span>');
      props.classList.toggle('tg-tagged', M.tgTagged);
      $('#tk-badge').className = 'badge b-solved';
      $('#tk-badge').textContent = 'Solved';
      $('#tk-submit').textContent = 'Submit as Solved';
    },

    chapters: [
      {
        id: 'intro', title: 'Introduction', start: { scene: 'title' },
        lines: [
          'Writing a good customer email, then building the buttons to go in it, takes time. The Klick-Zen Online Template Generator does both for you, for free.',
          'Pick a few options, and it writes a ready-to-paste Zendesk email with Klick-Zen buttons already laid out.'
        ],
        async run(h) {
          await h.beat(0, async () => {
            h.set({ reveal: 0 });
            await h.sleep(5200);
            await h.move('#demo-btn', { ms: 900 });
            await h.click();
            h.set({ demoClicked: true });
            await h.sleep(900);
          });
          await h.beat(1, async () => {
            h.set({ reveal: 1 });
            await h.move('#demo-card', { fx: 1.15, fy: 1.2, ms: 900 });
            await h.sleep(2600);
          });
        }
      },

      {
        id: 'build', title: 'Build the email', step: 1,
        start: { scene: 'gen', tgWhen: 0, tgDo: 2, tgTone: 1, tgSample: false, tgTplOpen: false, tgWhatOpen: false, tgScroll: 0, tgLinked: [false, false], tgTab: 'preview', tgCopied: false, tgDlBubble: false, demoClicked: false },
        lines: [
          "Open the generator and start on the left. When does the email go out? We'll choose Solved.",
          "What should the customer do? Confirm it's fixed. Then pick a tone: Friendly or Professional.",
          'The preview on the right updates as you go: a subject, a message, and buttons that fit. Show sample data fills in example values.',
          'Prefer a head start? Pick one of the ready-made templates instead, for approvals, refunds, escalations and more.',
          'Under Making it a working email, open What each button does, to see exactly what every button will do to the ticket.'
        ],
        async run(h) {
          await h.beat(0, async () => {
            await h.cam('#tg-opts', 1.35, 0.5, 0.25);
            await h.move('#tg-q-when', { fx: 0.6, fy: 0.15 });
            h.ring('#tg-q-when', 6);
            await h.sleep(1600);
            h.ring(null);
            await h.move('#tg-when-2');
            await h.click();
            h.set({ tgWhen: 2 });
            await h.sleep(500);
          });
          await h.beat(1, async () => {
            await h.move('#tg-do-1');
            await h.click();
            h.set({ tgDo: 1 });
            await h.sleep(900);
            await h.move('#tg-tone-0');
            await h.click();
            h.set({ tgTone: 0 });
            await h.sleep(500);
          });
          await h.beat(2, async () => {
            await h.camReset();
            await h.move('#tg-mail', { fx: 0.6, fy: 0.45, ms: 800 });
            h.ring('#tg-mail', 6);
            await h.sleep(2400);
            h.ring(null);
            await h.move('#tg-sample-box');
            await h.click();
            h.set({ tgSample: true });
            await h.sleep(1400);
          });
          await h.beat(3, async () => {
            await h.cam('#tg-opts', 1.35, 0.5, 0.45);
            await h.tween('tgScroll', 150, 500);   // brings the open list clear of the step badge
            await h.move('#tg-tpl', { fx: 0.4 });
            await h.click();
            h.set({ tgTplOpen: true });
            await h.sleep(2600);
            h.set({ tgTplOpen: false });
            await h.sleep(300);
          });
          await h.beat(4, async () => {
            await h.tween('tgScroll', 330, 900);
            await h.move('#tg-what-h', { fx: 0.3 });
            await h.click();
            h.set({ tgWhatOpen: true });
            await h.sleep(600);
            await h.move('#tg-what', { fx: 0.85, fy: 0.7 });
            h.ring('#tg-what', 6);
            await h.sleep(2400);
            h.ring(null);
          });
        }
      },

      {
        id: 'download', title: 'Download the buttons', step: 2,
        start: { scene: 'gen', tgWhen: 2, tgDo: 1, tgTone: 0, tgSample: true, tgWhatOpen: true, tgScroll: 330, tgDlBubble: false },
        lines: [
          'The buttons start out as placeholders. To make them work, click Download buttons.',
          "You get one button file, with each button's text, colors and actions already set."
        ],
        async run(h) {
          await h.beat(0, async () => {
            await h.cam('#tg-opts', 1.35, 0.5, 0.75);
            await h.move('#tg-btns', { fx: 0.3, fy: 1.4, ms: 800 });
            h.ring('#tg-btns', 8);
            await h.sleep(1500);
            h.ring(null);
            await h.tween('tgScroll', scrollFor('#tg-links'), 700);
            await h.move('#tg-dl');
            await h.click();
          });
          await h.beat(1, async () => {
            await h.camReset();
            h.set({ tgDlBubble: true });
            await h.sleep(300);
            await h.move('#tg-dlfile', { fx: 0.6, fy: 1.3 });
            h.ring('#tg-dlfile', 6);
            await h.sleep(2600);
            h.ring(null);
          });
        }
      },

      {
        id: 'import', title: 'Import them into Klick-Zen', step: 3,
        start: { scene: 'zd', zdView: 'kz', kzView: 'home', tgModal: null, tgSumCopied: -1, tgDlBubble: false },
        lines: [
          'In Klick-Zen, under Available KlickButtons, click Import buttons, and choose that file.',
          'Each button is listed with a short summary of what it does. Click Import.',
          "Klick-Zen creates them all in one step, and shows each button's HTML, ready to copy."
        ],
        async run(h) {
          await h.beat(0, async () => {
            h.set({ tgDlBubble: false });
            await h.move('#kz-nav-available');
            await h.sleep(300);
            h.ring('#kz-home .btn-out', 6);
            await h.move('#kz-home .btn-out');
            await h.click();
            h.ring(null);
            h.set({ tgModal: 'pick' });
            await h.sleep(600);
            await h.move('#tg-pick');
            await h.click();
            h.set({ tgModal: 'import' });
            await h.sleep(400);
          });
          await h.beat(1, async () => {
            await h.move('#tg-irow-0 .tg-sum', { fx: 0.5, fy: 0.5, ms: 700 });
            h.ring('#tg-irow-0', 4);
            await h.sleep(1300);
            h.ring('#tg-irow-1', 4);
            await h.move('#tg-irow-1 .tg-sum', { fx: 0.5, fy: 0.5, ms: 500 });
            await h.sleep(1100);
            h.ring(null);
            await h.move('#tg-imp-go');
            await h.click();
          });
          await h.beat(2, async () => {
            h.set({ tgModal: 'summary' });
            await h.sleep(900);
            h.ring('#tg-dlg-sum .tg-dlg-b', 4);
            await h.sleep(1500);
            h.ring(null);
            await h.move('#tg-scopy-0');
            await h.click();
            h.set({ tgSumCopied: 0 });
            await h.sleep(500);
          });
        }
      },

      {
        id: 'link', title: 'Link them in the generator', step: 4,
        start: { scene: 'gen', tgScroll: 330, tgLinked: [false, false], tgModal: 'summary', tgSumCopied: 0 },
        lines: [
          "Back in the generator, paste each button's HTML into the box next to it.",
          'The preview switches to your real Klick-Zen buttons, and the note confirms: All buttons are linked.'
        ],
        async run(h) {
          await h.beat(0, async () => {
            await h.cam('#tg-opts', 1.35, 0.5, 0.85);
            await h.tween('tgScroll', scrollFor('#tg-links'), 500);
            await h.move('#tg-link-0', { fx: 0.3 });
            await h.click();
            h.keycap('Ctrl+V');
            h.set({ tgLinked: [true, false] });
            await h.sleep(800);
            h.keycap(false);
            await h.move('#tg-link-1', { fx: 0.3 });
            await h.click();
            h.keycap('Ctrl+V');
            h.set({ tgLinked: [true, true], tgSumCopied: 1 });
            await h.sleep(800);
            h.keycap(false);
          });
          await h.beat(1, async () => {
            await h.camReset();
            await h.move('#tg-btns', { fx: 0.4, fy: 1.5, ms: 800 });
            h.ring('#tg-btns', 8);
            await h.sleep(1800);
            await h.move('#tg-note', { fx: 0.5, fy: 1.6 });
            h.ring('#tg-note', 5);
            await h.sleep(1800);
            h.ring(null);
          });
        }
      },

      {
        id: 'zendesk', title: 'Add it to Zendesk', step: 5,
        start: { scene: 'gen', tgScroll: 330, tgLinked: [true, true], tgTab: 'preview', tgCopied: false, tgModal: null, zdView: 'kz', body: '', snippet: false, trToast: false },
        lines: [
          'Now click Copy HTML. This email goes out when a ticket is solved, so it belongs in a trigger.',
          "Paste it into the trigger's Email body, use the generator's subject, and save."
        ],
        async run(h) {
          await h.beat(0, async () => {
            h.set({ tgModal: null });
            await h.move('#tg-tab-html');
            await h.click();
            h.set({ tgTab: 'html' });
            await h.sleep(900);
            await h.move('#tg-copy');
            await h.click();
            h.set({ tgCopied: true });
            await h.tween('tgScroll', 330, 600);
            await h.move('.tg-goes', { fx: 0.5, fy: 0.5 });
            h.ring('.tg-goes', 5);
            await h.sleep(1500);
            h.ring(null);
          });
          await h.beat(1, async () => {
            h.set({ scene: 'zd', zdView: 'trigger', tgCopied: false });
            await h.sleep(700);
            await h.move('#tr-body', { fx: 0.3, fy: 0.25 });
            await h.click();
            h.set({ caret: 'body' });
            h.keycap('Ctrl+V');
            await h.sleep(300);
            h.set({ body: GEN_HTML });
            await h.sleep(900);
            h.keycap(false);
            h.set({ caret: null });
            await h.move('#tr-save');
            await h.click();
            h.set({ trToast: true });
            await h.sleep(800);
          });
        }
      },

      {
        id: 'result', title: 'What your customer sees',
        start: { scene: 'inbox', zdView: 'trigger', body: GEN_HTML, trToast: false, tgTagged: false, ticketSolved: false, tgTab: 'preview' },
        lines: [
          'Your customer gets a clear, friendly email, with two simple choices.',
          'One click on Yes, all set, and they land on a thank-you page. Nothing to type.',
          'Back in Zendesk, the answer is already on the ticket, with no reply to read.'
        ],
        async run(h) {
          await h.beat(0, async () => {
            h.set({ trToast: false });
            h.tag('Your customer');
            await h.cam('.mail-body', 1.3);
            await h.move('#mail-btn', { fy: 1.6, dx: 80 });
            h.ring('.mail-body p:nth-child(3)', 10);
            await h.sleep(1300);
          });
          await h.beat(1, async () => {
            h.ring(null);
            await h.move('#mail-btn');
            await h.click();
            h.set({ scene: 'landing' });
            await h.sleep(500);
            await h.move('.landing h1', { fx: 0.9, fy: 2.4, ms: 900 });
            await h.sleep(1500);
          });
          await h.beat(2, async () => {
            h.tag(false);
            h.set({ scene: 'zd', zdView: 'ticket' });
            h.camReset('inbox', false);
            await h.sleep(900);
            h.set({ ticketSolved: true, tgTagged: true });
            await h.move('#tk-evt', { fx: 0.5, fy: 1.8 });
            h.ring('#tk-evt', 6);
            await h.sleep(1700);
            h.ring('#tg-newtag', 5);
            await h.move('#tg-newtag', { fx: 1.2, fy: 1.4 });
            await h.sleep(1500);
            h.ring(null);
          });
        }
      },

      {
        id: 'outro', title: 'Next steps', start: { scene: 'outro' },
        lines: [
          'A finished email and working buttons, in minutes.',
          'Try the free Online Template Generator, and find Klick-Zen on the Zendesk Marketplace.'
        ],
        async run(h) {
          h.park();
          await h.beat(0, async () => {
            h.set({ reveal: 0 });
            await h.sleep(900);
            h.set({ reveal: 1 });
          });
          await h.beat(1, () => h.set({ reveal: 2 }));
        }
      }
    ]
  });
})();
