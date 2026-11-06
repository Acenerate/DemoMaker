/* Landing Pages: brand the page a customer sees after clicking a Klick-Zen button. */
(function () {
  'use strict';

  const K = KZKit;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // The example company's logo (a "header image"), and the colors picked for it.
  const ACME = '<span class="lp-acme"><i>A</i><b>Acme Support</b></span>';
  const NOLOGO = '<span class="lp-nologo">Your logo</span>';   // before one is uploaded
  const COLORS = ['#ffffff', '#f1f1f1', '#eef4ff', '#fff6e5', '#eaf6ec', '#1f2a37', '#444444', '#07363f', '#2563d9', '#c2410c'];
  const BRAND = { title: 'Acme Support', brand: '#2563d9', accent: '#eef4ff', text: '#1f2a37' };

  // Markdown for the two pages: the starting text, and what gets typed.
  const CONFIRM_P = 'We appreciate you taking the time to let us know.';
  const CONFIRM0 = '# Thank you!\n## Your response has been received\n\n' + CONFIRM_P;
  const CONFIRM_NEW = "Thanks for letting us know. Our team has your update, and we'll take it from here.";
  const CONFIRM1 = CONFIRM0.slice(0, -CONFIRM_P.length) + CONFIRM_NEW;
  const BOLD = "There's nothing more you need to do.";
  const CLOSED0 = '# Sorry!\n## This ticket has already been closed\n\nYour response could not be applied to this ticket.';
  const CLOSED_ADD = "\n\nStill need help? Just email **support@acme.com** and we'll be glad to help.";
  const CLOSED1 = CLOSED0 + CLOSED_ADD;

  // A tiny markdown renderer for the previews: # and ## headings, - lists, **bold**, paragraphs.
  function md(src) {
    const inline = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
    let out = '', list = false;
    src.split('\n').forEach(l => {
      const li = /^- (.*)/.exec(l);
      if (li) { if (!list) { out += '<ul>'; list = true; } out += `<li>${inline(li[1])}</li>`; return; }
      if (list) { out += '</ul>'; list = false; }
      if (l.startsWith('## ')) out += `<h2>${inline(l.slice(3))}</h2>`;
      else if (l.startsWith('# ')) out += `<h1>${inline(l.slice(2))}</h1>`;
      else if (l.trim()) out += `<p>${inline(l)}</p>`;
    });
    return out + (list ? '</ul>' : '');
  }
  const confirmText = M => M.lpConfirm + (M.lpBold !== null ? '\n\n**' + M.lpBold + '**' : '');

  // One markdown section ("Confirmation" or "Ticket Closed"): edit area with toolbar, and a preview.
  const section = (key, legend, hint) => `
    <fieldset class="lp-fs" id="lp-${key}"><legend>${legend}</legend>
      <div class="lp-fsbar"><span class="lp-hint">${hint}</span><span class="lp-prev" id="lp-prev-${key}">Preview this page</span></div>
      <div class="lp-ed">
        <div class="lp-edit" id="lp-edit-${key}">
          <div class="lp-tools"><span id="lp-bold-${key}">B</span><span class="lp-i">I</span><span>H</span><i class="lp-div"></i><span>&bull;&#8801;</span><span>1.</span><i class="lp-div"></i><span>&#128279;</span><span>&#9636;</span></div>
          <div class="lp-md" id="lp-md-${key}"></div>
        </div>
        <div class="lp-pv" id="lp-pv-${key}"></div>
      </div>
    </fieldset>`;

  // The Klick-Zen "Default Landing Page" screen, inside Zendesk. Own lp- classes and ids throughout.
  const editorScene = `
    <section class="scene" data-scene="lp"><div class="cam">
      <div class="lp-shell">
        ${K.zdNav({ active: 'app', ids: false })}
        <div class="lp-main">
          <div class="lp-top"><div class="lp-tab lp-on">Klick-Zen</div><div class="lp-tab">+ Add</div><div class="lp-sp"></div><div class="lp-avatar">JD</div></div>
          <div class="lp-app">
            <div class="lp-head"><span class="lp-mark">${K.MARK(22)}</span>Klick-Zen Action Buttons</div>
            <div class="lp-cols">
              <div class="lp-side">
                <h6>BUTTONS</h6><hr>
                <div>Available KlickButtons</div><div>Default Button Template</div><div class="lp-on">Default Landing Page</div>
                <h6>SYSTEM</h6><hr><div>Settings</div>
                <h6>HELP</h6><hr><div>Documentation</div><div>Contact Support</div>
              </div>
              <div class="lp-content" id="lp-content">
                <div class="lp-scroll" id="lp-scroll">
                  <div class="lp-titlebar"><h2><b>Default</b> Landing Page</h2></div>
                  <fieldset class="lp-fs" id="lp-global"><legend>Global Landing Page Settings</legend>
                    <div class="lp-grid">
                      <label>HTML Browser Title</label><div class="lp-in" id="lp-title"></div>
                      <label>Template Colors</label>
                      <div class="lp-colors">
                        <span class="lp-l">Brand Color</span><span class="lp-sw" id="lp-sw-brand"><div></div></span>
                        <span class="lp-l">Accent Color</span><span class="lp-sw" id="lp-sw-accent"><div></div></span>
                        <span class="lp-l">Text Color</span><span class="lp-sw" id="lp-sw-text"><div></div></span>
                      </div>
                      <label>Page Header Image</label>
                      <div class="lp-img"><div class="lp-thumb" id="lp-thumb"></div><span class="lp-btn-out" id="lp-select">Select new image</span>
                        <div class="lp-files" id="lp-files"><div id="lp-file-0"><i></i>acme-logo.png</div><div><i></i>team-photo.jpg</div><div><i></i>office.gif</div></div></div>
                    </div>
                  </fieldset>
                  ${section('confirm', '"Confirmation" Page', 'Shown when the ticket is still active')}
                  ${section('closed', '"Ticket Closed" Page', 'Shown when the ticket is no longer active')}
                  <div class="lp-foot"><span class="lp-update" id="lp-update">Update</span></div>
                </div>
                <div class="lp-toast" id="lp-toast">${K.CHECK(16)}Landing pages updated</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div></section>`;

  // The customer's browser, with a tab (showing the HTML Browser Title) and the landing page.
  const webScene = `
    <section class="scene lp-web" data-scene="web"><div class="cam">
      <div class="lp-br">
        <div class="lp-br-tabs"><div class="lp-dots"><i></i><i></i><i></i></div>
          <div class="lp-br-tab" id="lp-br-tab"><span class="lp-fav" id="lp-fav"></span><span id="lp-br-title"></span><i>&times;</i></div></div>
        <div class="lp-br-bar"><div class="lp-br-url" id="lp-br-url"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4b5a66" stroke-width="2.4"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>buttons.acme.com/ext/href/f5oiecf1-338e-4ddf&hellip;/4821</div></div>
        <div class="lp-page" id="lp-page">
          <div class="lp-page-head" id="lp-page-head"></div>
          <div class="lp-page-body" id="lp-page-body"></div>
        </div>
      </div>
    </div></section>`;

  // Scroll offsets for the editor screen.
  // `above` leaves room over the element (so a zoom centred on it doesn't show the empty app header).
  const scrollMax = () => document.querySelector('#lp-scroll').offsetHeight - document.querySelector('#lp-content').clientHeight;
  const scrollTo = (sel, above = 6) => Math.max(0, Math.min(scrollMax(), document.querySelector(sel).offsetTop - above));

  KZWalkthrough.create({
    title: 'Landing Pages: what customers see after the click',
    subtitle: 'An animated walkthrough, about three minutes',
    logo: { light: '../../framework/assets/klick-zen-logo.png', dark: '../../framework/assets/klick-zen-logo-dark.png' },
    intro: { title: 'Landing pages', text: 'Brand the page your customers see after they click a button.' },
    end: {
      title: 'Every click, answered in your brand.',
      text: 'Ready to try it with your own customers?',
      link: { href: K.MARKETPLACE, label: 'Get Klick-Zen on the Zendesk Marketplace →' }
    },
    narration: { mode: 'audio' },
    captions: false,
    tempo: 1.15,

    stage: [
      K.titleScene({
        headline: 'What customers see <em>after the click.</em>',
        lead: 'Klick-Zen landing pages confirm every click, with your logo, your colors and your words.',
        card: { from: 'Acme Support', subject: 'Re: Question about my invoice', text: "We've corrected your invoice. Did that sort it out?", button: "Yes, it's resolved", done: 'Response received' }
      }),
      K.inboxScene({
        subject: 'Re: Question about my invoice',
        paragraphs: ['Hi Jordan,', "We've corrected the duplicate line on your invoice. Did that sort it out? Just let us know with one click."]
      }),
      webScene,
      K.zendeskScene({ views: { trigger: false, ticket: false } }),
      editorScene,
      K.outroScene({
        headline: 'Every click,<br><em>in your brand.</em>',
        ideas: ['Use your own subdomain', 'Send customers to a page of your own', 'Pick a different page for one button'],
        cta: { eyebrow: 'Available on the', big: 'Zendesk Marketplace', pill: 'klick-zen.com' }
      })
    ].join(''),

    // The kit's model (the email button is styled from label/bg/fg/bold/round), plus this
    // walkthrough's own keys for the landing page screen and the browser.
    state: Object.assign(K.defaults(), {
      label: "Yes, it's resolved", bg: '#1b7a33', fg: '#ffffff', bold: true, round: 0.86,
      lpTitle: 'Your Company', lpBrand: '#07363f', lpAccent: '#f1f1f1', lpText: '#444444', lpLogo: 'none',
      lpConfirm: CONFIRM0, lpBold: null, lpClosed: CLOSED0,
      lpCaret: null,          // 'title' | 'confirm' | 'closed' | null
      lpFiles: false, lpDirty: false, lpToast: false, lpScroll: 0,
      lpWhich: 'confirm'      // which page the browser shows: 'confirm' | 'closed'
    }),

    render(M, api) {
      K.render(M, api);
      const $ = s => api.$(s);
      const caret = key => (M.lpCaret === key ? '<span class="caret"></span>' : '');
      const logo = M.lpLogo === 'acme' ? ACME : NOLOGO;
      const setHtml = (sel, html) => { const e = $(sel); if (e.dataset.html !== html) { e.innerHTML = html; e.dataset.html = html; } };

      // editor screen
      $('#lp-scroll').style.transform = `translateY(${-(M.lpScroll || 0)}px)`;
      $('#lp-title').innerHTML = esc(M.lpTitle) + caret('title');
      $('#lp-title').classList.toggle('lp-focus', M.lpCaret === 'title');
      $('#lp-sw-brand div').style.backgroundColor = M.lpBrand;
      $('#lp-sw-accent div').style.backgroundColor = M.lpAccent;
      $('#lp-sw-text div').style.backgroundColor = M.lpText;
      setHtml('#lp-thumb', logo);
      $('#lp-files').classList.toggle('lp-on', M.lpFiles);
      const ctext = confirmText(M);
      $('#lp-md-confirm').innerHTML = M.lpBold !== null
        ? esc(M.lpConfirm + '\n\n**' + M.lpBold) + caret('confirm') + '**'
        : esc(M.lpConfirm) + caret('confirm');
      $('#lp-md-closed').innerHTML = esc(M.lpClosed) + caret('closed');
      $('#lp-edit-confirm').classList.toggle('lp-focus', M.lpCaret === 'confirm');
      $('#lp-edit-closed').classList.toggle('lp-focus', M.lpCaret === 'closed');
      $('#lp-pv-confirm').innerHTML = md(ctext);
      $('#lp-pv-closed').innerHTML = md(M.lpClosed);
      $('#lp-prev-confirm').classList.toggle('lp-dim', M.lpDirty);
      $('#lp-prev-closed').classList.toggle('lp-dim', M.lpDirty);
      $('#lp-toast').classList.toggle('lp-on', M.lpToast);

      // browser
      $('#lp-br-title').textContent = M.lpTitle;
      setHtml('#lp-fav', M.lpLogo === 'acme' ? ACME : '<i class="lp-nofav"></i>');
      setHtml('#lp-page-head', logo);
      $('#lp-page-head').style.borderBottomColor = M.lpBrand;
      $('#lp-page').style.backgroundColor = M.lpAccent;
      const body = $('#lp-page-body');
      body.style.color = M.lpText;
      if (body.dataset.which !== M.lpWhich) {   // replay the fade when switching pages
        body.dataset.which = M.lpWhich;
        body.style.animation = 'none'; void body.offsetWidth; body.style.animation = '';
      }
      setHtml('#lp-page-body', md(M.lpWhich === 'closed' ? M.lpClosed : ctext));
    },

    chapters: [
      {
        id: 'intro', title: 'Introduction', start: { scene: 'title' },
        lines: [
          'When a customer clicks a Klick-Zen button in your email, what do they see next?',
          "A landing page. In the next few minutes, we'll make it look and sound like your brand, with no web design needed."
        ],
        async run(h) {
          await h.beat(0, async () => {
            h.set({ reveal: 0 });
            await h.sleep(1800);
            await h.move('#demo-btn', { ms: 900 });
            await h.click();
            h.set({ demoClicked: true });
          });
          await h.beat(1, async () => {
            h.set({ reveal: 1 });
            await h.move('#demo-card', { fx: 1.15, fy: 1.2, ms: 900 });
          });
        }
      },

      {
        id: 'why', title: 'Why landing pages matter', start: { scene: 'inbox', lpWhich: 'confirm' },
        lines: [
          'Clicking any link in an email opens a web browser, and Klick-Zen buttons are no different. That visit is what tells Klick-Zen to update the ticket.',
          'The landing page is what your customer sees next: clear confirmation that their click worked, instead of a blank tab or an error.',
          "Klick-Zen hosts it for you, and it reads clearly on phones and desktops alike. There's nothing to build or host yourself."
        ],
        async run(h) {
          await h.beat(0, async () => {
            h.tag('Your customer');
            await h.cam('.mail-body', 1.3);
            await h.move('#mail-btn', { fy: 1.6, dx: 60 });
            h.ring('#mail-btn', 10);
            await h.sleep(1400);
            await h.move('#mail-btn');
            h.ring(null);
            await h.click();
            h.set({ scene: 'web' });
            h.camReset('inbox', false);
            await h.sleep(900);
          });
          await h.beat(1, async () => {
            await h.move('#lp-page-body h1', { fx: 1.1, fy: 1.4, ms: 900 });
            h.ring('#lp-page-body', 4);
            await h.sleep(2600);
            h.ring(null);
          });
          await h.beat(2, async () => {
            h.tag(false);
            h.ring('#lp-br-url', 4);
            await h.move('#lp-br-url', { fx: 0.5, fy: 1.6, ms: 900 });
            await h.sleep(1800);
            h.ring(null);
          });
        }
      },

      {
        id: 'open', title: 'Open the landing page settings', step: 1,
        start: { scene: 'zd', zdView: 'views', kzView: 'home', lpScroll: 0 },
        lines: [
          'To make it yours, open Klick-Zen in Zendesk, and click Default Landing Page in the left-hand menu.',
          'There are two pages here, a Confirmation page and a Ticket Closed page, and one set of global settings that styles them both.'
        ],
        async run(h) {
          await h.beat(0, async () => {
            h.camReset('web', false);
            await h.sleep(200);
            await h.move('#zd-app');
            await h.click();
            h.set({ zdView: 'kz', kzView: 'home' });
            await h.sleep(700);
            h.ring('#kz-nav-landing', 4);
            await h.move('#kz-nav-landing');
            await h.click();
            h.ring(null);
            h.set({ scene: 'lp' });
            await h.sleep(700);
          });
          await h.beat(1, async () => {
            h.ring('#lp-confirm', 4);
            await h.move('#lp-confirm legend', { fx: 1.4, fy: 1.5 });
            await h.sleep(900);
            h.ring(null);
            await h.tween('lpScroll', scrollMax(), 800);
            h.ring('#lp-closed', 4);
            await h.move('#lp-closed legend', { fx: 1.4, fy: 1.5 });
            await h.sleep(900);
            h.ring(null);
            await h.tween('lpScroll', 0, 800);
            h.ring('#lp-global', 4);
            await h.move('#lp-global legend', { fx: 1.4, fy: 1.5 });
            await h.sleep(1100);
            h.ring(null);
          });
        }
      },

      {
        id: 'brand', title: 'Match your brand', step: 2,
        start: { scene: 'lp', lpScroll: 0, lpDirty: false, lpCaret: null, lpFiles: false },
        lines: [
          'Start with the Global Landing Page Settings. The HTML Browser Title is the text in the browser tab, usually your company name.',
          "Next, the Template Colors. The Brand Color draws the bold outlines, so it's usually the darker of your colors.",
          "The Accent Color sits behind the text, and the Text Color is the text itself. Choose a pair that's easy to read.",
          'Then the Page Header Image, usually your logo. Click Select new image, and choose a JPG, GIF or PNG up to 3 megabytes.'
        ],
        async run(h) {
          await h.beat(0, async () => {
            await h.cam('#lp-global', 1.4, 0.4, 0.5);
            await h.move('#lp-title', { fx: 0.5 });
            await h.click();
            h.set({ lpCaret: 'title', lpDirty: true });
            await h.sleep(300);
            await h.erase('lpTitle');
            await h.type('lpTitle', BRAND.title, { speed: 70 });
            await h.sleep(300);
            h.set({ lpCaret: null });
          });
          await h.beat(1, async () => {
            await h.pickColor('#lp-sw-brand', COLORS, COLORS.indexOf(BRAND.brand));
            h.set({ lpBrand: BRAND.brand });
            await h.sleep(400);
          });
          await h.beat(2, async () => {
            await h.pickColor('#lp-sw-accent', COLORS, COLORS.indexOf(BRAND.accent));
            h.set({ lpAccent: BRAND.accent });
            await h.sleep(400);
            await h.pickColor('#lp-sw-text', COLORS, COLORS.indexOf(BRAND.text));
            h.set({ lpText: BRAND.text });
            await h.sleep(400);
          });
          await h.beat(3, async () => {
            await h.move('#lp-select');
            await h.click();
            h.set({ lpFiles: true });
            await h.sleep(500);
            await h.move('#lp-file-0', { fx: 0.4 });
            await h.click();
            h.set({ lpFiles: false, lpLogo: 'acme' });
            await h.sleep(300);
            h.ring('#lp-thumb', 6);
            await h.sleep(1400);
            h.ring(null);
          });
        }
      },

      {
        id: 'confirm', title: 'Write your confirmation', step: 3,
        start: { scene: 'lp', lpTitle: BRAND.title, lpBrand: BRAND.brand, lpAccent: BRAND.accent, lpText: BRAND.text, lpLogo: 'acme', lpDirty: true, lpFiles: false },
        lines: [
          "Now the Confirmation page. It's shown while the ticket is still active, to let your customer know their response went through.",
          'Type your message on the left using simple markdown, and the preview on the right shows how it will look.',
          'The toolbar adds common formatting for you, such as bold text or a bulleted list.',
          'For security, active content like HTML, JavaScript and CSS is never rendered, so the page stays safe for every customer.'
        ],
        async run(h) {
          await h.beat(0, async () => {
            await h.camReset();
            await h.tween('lpScroll', scrollTo('#lp-confirm', 110), 800);
            await h.cam('#lp-confirm', 1.3);
            h.ring('#lp-confirm .lp-hint', 6);
            await h.move('#lp-confirm .lp-hint', { fx: 0.9, fy: 1.6 });
            await h.sleep(1600);
            h.ring(null);
          });
          await h.beat(1, async () => {
            await h.move('#lp-md-confirm', { fx: 0.8, fy: 0.62 });
            await h.click();
            h.set({ lpCaret: 'confirm' });
            await h.erase('lpConfirm', { count: CONFIRM_P.length, speed: 28 });
            await h.type('lpConfirm', CONFIRM_NEW, { speed: 30 });
          });
          await h.beat(2, async () => {
            h.ring('#lp-bold-confirm', 4);
            await h.move('#lp-bold-confirm');
            await h.click();
            h.ring(null);
            h.set({ lpBold: '' });
            await h.sleep(200);
            await h.type('lpBold', BOLD, { speed: 42 });
            h.set({ lpCaret: null });
          });
          await h.beat(3, async () => {
            h.ring('#lp-pv-confirm', 6);
            await h.move('#lp-pv-confirm', { fx: 0.75, fy: 0.85, ms: 900 });
            await h.sleep(2600);
            h.ring(null);
          });
        }
      },

      {
        id: 'closed', title: 'Handle closed tickets', step: 4,
        start: { scene: 'lp', lpConfirm: CONFIRM1, lpBold: BOLD, lpCaret: null },
        lines: [
          "The Ticket Closed page appears when the ticket is no longer active, for example when it's already been solved and closed.",
          "It lets your customer know their click can't change anything now, so a helpful next step here goes a long way."
        ],
        async run(h) {
          await h.beat(0, async () => {
            await h.camReset();
            await h.tween('lpScroll', scrollTo('#lp-closed', 110), 900);
            await h.cam('#lp-closed', 1.3);
            await h.move('#lp-pv-closed', { fx: 0.6, fy: 0.5 });
            h.ring('#lp-pv-closed', 6);
            await h.sleep(1500);
            h.ring(null);
          });
          await h.beat(1, async () => {
            await h.move('#lp-md-closed', { fx: 0.8, fy: 0.62 });
            await h.click();
            h.set({ lpCaret: 'closed' });
            await h.type('lpClosed', CLOSED_ADD, { speed: 32 });
            await h.sleep(300);
            h.set({ lpCaret: null });
          });
        }
      },

      {
        id: 'save', title: 'Save and preview', step: 5,
        start: { scene: 'lp', lpClosed: CLOSED1, lpCaret: null, lpToast: false },
        lines: [
          'The Preview this page button stays greyed out until your changes are saved. So click Update, at the bottom of the page.',
          'Now click Preview this page, and see the finished page exactly as your customers will.'
        ],
        async run(h) {
          await h.beat(0, async () => {
            await h.camReset();
            await h.move('#lp-prev-closed');
            h.ring('#lp-prev-closed', 4);
            await h.sleep(1300);
            h.ring(null);
            await h.tween('lpScroll', scrollMax(), 700);
            h.ring('#lp-update', 6);
            await h.move('#lp-update');
            await h.click();
            h.ring(null);
            h.set({ lpDirty: false, lpToast: true });
            await h.sleep(1400);
          });
          await h.beat(1, async () => {
            h.set({ lpToast: false });
            await h.tween('lpScroll', scrollTo('#lp-confirm'), 800);
            h.ring('#lp-prev-confirm', 4);
            await h.move('#lp-prev-confirm');
            await h.sleep(300);
            await h.click();
            h.ring(null);
            h.set({ scene: 'web', lpWhich: 'confirm' });
            await h.sleep(900);
            await h.move('#lp-page-head', { fx: 0.75, fy: 0.6, ms: 900 });
            await h.sleep(800);
          });
        }
      },

      {
        id: 'result', title: 'What your customer sees',
        start: { scene: 'inbox', lpDirty: false, lpToast: false, lpScroll: 0, lpWhich: 'confirm' },
        lines: [
          'So when your customer clicks a button in your email,',
          "they land on a page with your logo, your colors and your words, in a browser tab with your company's name.",
          "And if they click a button on a ticket that's already closed, your Ticket Closed page tells them what to do next."
        ],
        async run(h) {
          await h.beat(0, async () => {
            h.camReset('web', false);
            h.tag('Your customer');
            await h.move('#mail-btn', { fy: 1.6, dx: 60 });
            await h.sleep(300);
            await h.move('#mail-btn');
            await h.click();
            h.set({ scene: 'web', lpWhich: 'confirm' });
            await h.sleep(500);
          });
          await h.beat(1, async () => {
            h.ring('#lp-page-head', 4);
            await h.move('#lp-page-head', { fx: 0.62, fy: 0.55 });
            await h.sleep(1300);
            h.ring('#lp-page-body', 4);
            await h.move('#lp-page-body p', { fx: 0.5, fy: 1.5 });
            await h.sleep(1300);
            h.ring('#lp-br-tab', 4);
            await h.move('#lp-br-tab', { fx: 0.5, fy: 1.5 });
            await h.sleep(1300);
            h.ring(null);
          });
          await h.beat(2, async () => {
            h.tag('Weeks later');
            h.set({ scene: 'inbox' });
            await h.sleep(800);
            await h.move('#mail-btn');
            await h.click();
            h.set({ scene: 'web', lpWhich: 'closed' });
            await h.sleep(700);
            h.tag(false);
            h.ring('#lp-page-body', 4);
            await h.move('#lp-page-body b', { fx: 0.5, fy: 1.6, ms: 900 });
            await h.sleep(1500);
            h.ring(null);
          });
        }
      },

      {
        id: 'outro', title: 'Next steps', start: { scene: 'outro' },
        lines: [
          "That's landing pages: a clear, friendly answer to every click, in your own brand, with nothing to host.",
          'Want to go further? Use your own subdomain, or send customers to a page of your own, such as a help article or a survey, for every button or just one.',
          'Find Klick-Zen on the Zendesk Marketplace, and make every click feel like part of your brand.'
        ],
        async run(h) {
          h.park();
          await h.beat(0, () => h.set({ reveal: 0 }));
          await h.beat(1, () => h.set({ reveal: 1 }));
          await h.beat(2, () => h.set({ reveal: 2 }));
        }
      }
    ]
  });
})();
