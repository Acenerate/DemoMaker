/* Using Buttons in the Help Center Ticket View: put one-click buttons on the customer's request page. */
(function () {
  'use strict';

  const K = KZKit;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const svg = (p, s = 20) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;

  // The button used throughout (shown in the app, pasted into the theme, seen by the customer).
  const BUTTONS = [
    { label: 'Escalate', name: 'Escalate', bg: '#b42318', key: 'f5oiecf1' }
  ];
  const bimg = (b, cls, id) => `<span class="${cls}"${id ? ` id="${id}"` : ''} style="background:${b.bg};border-color:${b.bg}">${esc(b.label)}</span>`;

  // The Help Center Links toggle swaps the snippet's ticket placeholders for Help Center (Curlybars) ones.
  const snipCode = (b, hc) => `&lt;a href='…/ext/href/${b.key}…/<b${hc ? ' class="hc-hl"' : ''}>${hc ? '{{request.id}}' : '{{ticket.id}}'}</b>/…`;

  /* ------------------------------------------------ scene: Klick-Zen button list in Zendesk */
  // The Zendesk product switcher's menu: label, icon.
  const PRODUCTS = [
    ['Support', '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="14" width="4" height="6" rx="1"/><rect x="17" y="14" width="4" height="6" rx="1"/>'],
    ['Knowledge', '<path d="M6 3h12a1 1 0 0 1 1 1v17H7a2 2 0 0 1-2-2V4a1 1 0 0 1 1-1zM9 8h6M9 12h6"/>'],
    ['Community', '<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0M16 5a3 3 0 0 1 0 6M18 14a6 6 0 0 1 3 6"/>'],
    ['Chat', '<path d="M4 5h16v12H9l-5 4zM8 11h.01M12 11h.01M16 11h.01"/>'],
    ['Voice', '<path d="M5 3h4l2 5-3 2a12 12 0 0 0 6 6l2-3 5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 5a2 2 0 0 1 2-2z"/>'],
    ['Analytics', '<path d="M6 20v-7M12 20V4M18 20v-10"/>'],
    ['Sales', '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 15 4-4 3 3 4-5"/>'],
    ['Workforce management', '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01M16 17h.01"/>'],
    ['Quality assurance', '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 3h6v3H9zM9 13l2 2 4-4"/>'],
    ['AI agents', '<rect x="4" y="8" width="16" height="12" rx="2"/><path d="M12 4v4M9 13h.01M15 13h.01M9 17h6"/>'],
    ['Admin center', '<path d="m12 3 8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><circle cx="12" cy="11" r="2"/>']
  ];

  const vrow = (s, l, subj, who, when) => `<div class="hc-vrow"><span><i class="hc-vb ${s}">${l}</i></span><span>${subj}</span><span>${who}</span><span>${when}</span></div>`;
  const appScene = `
    <section class="scene" data-scene="hcapp"><div class="cam">
      <div class="hc-shell">
        ${K.zdNav({ active: 'home', ids: false })}
        <div class="hc-main">
          <div class="hc-top">
            <div class="hc-prods" id="hc-prods">Support${svg('<path d="m6 15 6-6 6 6"/>', 16)}</div>
            <div class="hc-tab hc-on" id="hc-tab">Views</div><div class="hc-tab">+ Add</div><div class="hc-sp"></div><div class="hc-avatar">JD</div>
            <div class="hc-pmenu" id="hc-pmenu">${PRODUCTS.map(([n, p]) => `<div${n === 'Support' ? ' class="hc-cur"' : n === 'Knowledge' ? ' id="hc-pm-know"' : ''}>${svg(p, 18)}${n}</div>`).join('')}</div>
          </div>
          <div class="hc-body">
            <div class="hc-views">
              <h3>Your unsolved tickets</h3>
              <div class="hc-vrow hc-h"><span>Status</span><span>Subject</span><span>Requester</span><span>Updated</span></div>
              ${vrow('o', 'open', 'Question about my invoice', 'Jordan Lee', 'Today')}
              ${vrow('p', 'pending', "Can't reset my password", 'Priya Shah', '2 days ago')}
              ${vrow('o', 'open', 'Shipping address change', 'Marco Silva', 'Yesterday')}
              ${vrow('n', 'new', 'Bulk order discount?', 'Emma Clarke', '3 hours ago')}
            </div>
            <div class="hc-kz" id="hc-kz">
              <div class="hc-kzhead"><span class="hc-kzmark">${K.MARK(22)}</span>Klick-Zen Action Buttons</div>
              <div class="hc-kzcols">
                <div class="hc-side">
                  <h6>BUTTONS</h6><hr>
                  <div id="hc-nav-available">Available KlickButtons</div><div>Default Button Template</div><div>Default Landing Page</div>
                  <h6>SYSTEM</h6><hr><div>Settings</div>
                  <h6>HELP</h6><hr><div>Documentation</div><div>Contact Support</div>
                </div>
                <div class="hc-content">
                  <div class="hc-page" id="hc-home">
                    <div class="hc-titlebar"><h2><b>Klick-Zen</b> Workflow Buttons</h2><span class="hc-create">Create new button</span></div>
                    <div class="hc-welcome"><h3>Welcome to Klick-Zen!</h3>Klick-Zen allows you to quickly create functional Zendesk action buttons that, when clicked by one of your end users, take an action on their ticket.</div>
                  </div>
                  <div class="hc-page" id="hc-list">
                    <div class="hc-titlebar"><h2><b>Klick-Zen</b> Workflow Buttons</h2><span class="hc-create">Create new button</span></div>
                    <div class="hc-switch" id="hc-switch"><span class="hc-tog" id="hc-tog"></span>Help Center Links</div>
                    <p class="hc-note">Copy the HTML code to insert the button where it's needed.</p>
                    ${BUTTONS.map((b, i) => `<div class="hc-card" id="hc-card-${i}">${bimg(b, 'hc-bimg')}<span class="hc-nm">${esc(b.name)}</span>
                      <span class="hc-snip"><code id="hc-code-${i}"></code><i id="hc-copy-${i}">${svg('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>', 18)}<em id="hc-copied-${i}">Copied!</em></i></span></div>`).join('')}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div></section>`;

  /* ------------------------------------------------ scene: the help center, as an agent sees it, with the Knowledge admin link */
  const hcHomeBody = `
    <div class="hc-portal">
      <div class="hc-phead"><span class="hc-plogo"><i></i>Acme</span><span>Help Center</span><span class="hc-sp"></span><span>Submit a request</span><span class="hc-ka" id="hc-ka">Knowledge admin</span><span class="hc-pav">JD</span></div>
      <div class="hc-hhero"><h1>How can we help?</h1><div class="hc-hsearch">Search</div></div>
      <div class="hc-hcats"><div><b>Billing</b>Invoices and payments</div><div><b>Your account</b>Passwords and settings</div><div><b>Shipping</b>Delivery times and addresses</div></div>
    </div>`;

  /* ------------------------------------------------ scene: Knowledge admin and the theme code editor */
  const thumb = '<div class="hc-thumb"><div class="t1"></div><div class="t2"><i></i></div><div class="t3"><i></i><i></i><i></i></div></div>';
  const FILES = ['article_page.hbs', 'category_page.hbs', 'error_page.hbs', 'home_page.hbs', 'new_request_page.hbs', 'request_page.hbs', 'requests_page.hbs', 'search_results.hbs', 'section_page.hbs'];
  const guideScene = `
    <section class="scene" data-scene="guide"><div class="cam">
      <div class="hc-g">
        <nav class="hc-gnav">
          <div class="hc-gbrand">K</div>
          <div class="hc-gico" id="hc-g-home">${svg('<path d="M3 11 12 4l9 7v9H5v-9"/>')}</div>
          <div class="hc-gico">${svg('<path d="M6 3h9l4 4v14H6zM14 3v5h5"/>')}</div>
          <div class="hc-gico">${svg('<path d="M4 6h16M4 12h16M4 18h10"/>')}</div>
          <div class="hc-gico" id="hc-g-design">${svg('<path d="M18.4 2.6a2 2 0 0 1 2.9 2.9L12 14.8 9.2 12zM9 12.4c-2 0-3.6 1.6-3.6 3.6 0 1.7-1.2 2.9-2.4 3.4 1 1 2.6 1.6 4.2 1.6 3 0 5.4-2.4 5.4-5.4"/>')}</div>
          <div class="hc-gico">${svg('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>')}</div>
        </nav>
        <div class="hc-main">
          <div class="hc-gtop"><b>Knowledge admin</b><span class="hc-sp"></span><span>View help center</span><div class="hc-avatar">JD</div></div>
          <div class="hc-body">
            <div class="hc-gpage" id="hc-gp-home"><div class="hc-gpad">
              <h2>Overview</h2><p class="hc-gsub">Acme Help Center</p>
              <div class="hc-stats"><div class="hc-stat"><b>128</b>Articles</div><div class="hc-stat"><b>14</b>Sections</div><div class="hc-stat"><b>6</b>Categories</div><div class="hc-stat"><b>2,341</b>Views this week</div></div>
              <div class="hc-glist"><div>Resetting your password<span>Updated 2 days ago</span></div><div>Understanding your invoice<span>Updated 5 days ago</span></div><div>Shipping and delivery times<span>Updated last week</span></div></div>
            </div></div>
            <div class="hc-gpage" id="hc-gp-themes"><div class="hc-gpad">
              <h2>Themes</h2><p class="hc-gsub">Customize the look and feel of your help center.</p>
              <div class="hc-themes">
                <div><div class="hc-sect">LIVE THEME</div>
                  <div class="hc-theme" id="hc-th-0">${thumb}<div class="hc-tfoot"><b>Copenhagen</b><span class="hc-live">Live</span><span class="hc-more" id="hc-th-more">&middot;&middot;&middot;</span><span class="hc-cust">Customize</span></div>
                    <div class="hc-menu" id="hc-menu"><div>Publish</div><div id="hc-dup">Duplicate</div><div>Download</div></div>
                  </div></div>
                <div><div class="hc-sect">LIBRARY</div>
                  <div class="hc-theme" id="hc-th-1">${thumb}<div class="hc-tfoot"><b>Copy of Copenhagen</b><span class="hc-more">&middot;&middot;&middot;</span><span class="hc-cust" id="hc-cust-1">Customize</span></div></div></div>
              </div>
            </div></div>
            <div class="hc-gpage" id="hc-gp-settings"><div class="hc-tset">
              <div class="hc-tpanel"><h3>Copy of Copenhagen</h3><p>Not live</p>
                <div>Brand <span>&rsaquo;</span></div><div>Colors <span>&rsaquo;</span></div><div>Fonts <span>&rsaquo;</span></div><div>Images <span>&rsaquo;</span></div><div>Search settings <span>&rsaquo;</span></div><div>Article settings <span>&rsaquo;</span></div></div>
              <div class="hc-tprev">${thumb}</div>
              <span class="hc-editcode" id="hc-editcode">Edit code</span>
            </div></div>
            <div class="hc-gpage" id="hc-gp-code"><div class="hc-ced">
              <div class="hc-tree"><div class="hc-dir">&#9662; assets</div><div class="hc-dir">&#9662; templates</div>
                ${FILES.map(f => `<div${f === 'request_page.hbs' ? ' id="hc-f-request"' : ''}>${f}</div>`).join('')}
                <div class="hc-dir">&#9656; script.js</div><div class="hc-dir">&#9656; style.css</div></div>
              <div class="hc-edit">
                <div class="hc-ehead"><code id="hc-path"></code><span class="hc-sp"></span><span class="hc-ebtn" id="hc-preview">Preview</span><span class="hc-ebtn hc-pri">Save</span></div>
                <div class="hc-code" id="hc-code"></div>
              </div>
            </div></div>
          </div>
        </div>
      </div>
    </div></section>`;

  // request_page.hbs, simplified. The pasted snippets go in the ticket details sidebar, below the details.
  const CODE_BEFORE = [
    '<div class="container">',
    '  <nav class="sub-nav">{{breadcrumbs}}</nav>',
    '  <div class="request-container">',
    '    <header class="request-header">',
    '      <h1>{{request.subject}}</h1>',
    '    </header>',
    '    <div class="request-main">',
    '      <ul class="comment-list">',
    '        {{#each comments}}',
    '          <li class="comment">{{body}}</li>',
    '        {{/each}}',
    '      </ul>',
    '    </div>',
    '    <aside class="request-sidebar">',
    '      <dl class="request-details">',
    '        {{request.status_name}}',
    '      </dl>'
  ];
  const CODE_AFTER = [
    '    </aside>',
    '  </div>',
    '</div>'
  ];
  const snippetLines = b => [
    `      <a href='https://app.klick-zen.com/ext/href/${b.key}…/{{request.id}}'>`,
    `        <img src='https://app.klick-zen.com/ext/src/${b.key}…/{{request.id}}' /></a>`
  ];
  const hilite = s => esc(s)
    .replace(/(&#39;[^&]*?&#39;|&quot;[^&]*?&quot;)/g, '<span class="hc-st">$1</span>')
    .replace(/(\{\{[^}]*\}\})/g, '<span class="hc-cb">$1</span>')
    .replace(/(&lt;\/?)([a-z0-9-]+)/g, '$1<span class="hc-tg">$2</span>');
  function codeHtml(M) {
    if (!M.codeOpen) return '<div class="hc-empty">Select a file to edit</div>';
    const rows = [];
    CODE_BEFORE.forEach(l => rows.push({ l }));
    for (let i = 0; i < M.pasted; i++) snippetLines(BUTTONS[i]).forEach(l => rows.push({ l, cls: 'hc-new' }));
    rows.push({ l: '      ', id: 'hc-ins', caret: M.codeCaret });
    CODE_AFTER.forEach(l => rows.push({ l }));
    return rows.map((r, n) => `<div class="hc-ln${r.cls ? ' ' + r.cls : ''}"${r.id ? ` id="${r.id}"` : ''}><u>${n + 1}</u><span>${hilite(r.l)}${r.caret ? '<i class="hc-caret"></i>' : ''}</span></div>`).join('');
  }

  /* ------------------------------------------------ scene: the customer's request page in the Help Center */
  const portalBody = `
    <div class="hc-portal">
      <div class="hc-pbar" id="hc-pbar"><span>Previewing <b>Copy of Copenhagen</b></span><span class="hc-sp"></span><span class="hc-exit">Exit preview</span><span class="hc-publish" id="hc-publish">Publish</span></div>
      <div class="hc-phead"><span class="hc-plogo"><i></i>Acme</span><span>Help Center</span><span class="hc-sp"></span><span>Submit a request</span><span>My requests</span><span class="hc-pav">JL</span></div>
      <div class="hc-pwrap">
        <div class="hc-crumbs">Acme Help Center &rsaquo; My requests &rsaquo; #4821</div>
        <h1>Question about my invoice</h1>
        <div class="hc-pcols">
          <div class="hc-pmain">
            <div class="hc-com"><div class="hc-av hc-ag">SA</div><div><small>Super Agent &middot; Today</small>Thanks Jordan! That was a display issue on our side; your account was only charged once. Let us know if anything still looks off.</div></div>
            <div class="hc-com"><div class="hc-av">JL</div><div><small>Jordan Lee &middot; Yesterday</small>Hi, my last invoice shows two line items for the same plan. Can you check?</div></div>
          </div>
          <aside class="hc-pright">
            <div class="hc-pside">
              <div>Requester <b>Jordan Lee</b></div><div>Created <b>Yesterday</b></div><div>Last activity <b>Today</b></div>
              <div>Id <b>#4821</b></div><div>Status <b class="hc-pstat">Open</b></div><div>Type <b>Question</b></div><div>Priority <b>Normal</b></div>
            </div>
            <div class="hc-pact" id="hc-pact">${BUTTONS.map((b, i) => bimg(b, 'hc-kb', 'hc-kb-' + i)).join('')}</div>
          </aside>
        </div>
      </div>
      <div class="hc-ptoast" id="hc-ptoast">${K.CHECK(16, '#7ed492')}Theme published</div>
    </div>`;

  KZWalkthrough.create({
    title: 'Using Buttons in the Help Center',
    subtitle: 'An animated walkthrough, about two minutes',
    logo: { light: '../../framework/assets/klick-zen-logo.png', dark: '../../framework/assets/klick-zen-logo-dark.png' },
    intro: { title: 'Buttons in your Help Center', text: 'Watch one-click buttons appear on the page where customers view their tickets.' },
    end: {
      title: 'One click, right in your Help Center.',
      text: 'Ready to try it with your own customers?',
      link: { href: K.MARKETPLACE, label: 'Get Klick-Zen on the Zendesk Marketplace →' }
    },
    narration: { mode: 'audio' },
    captions: false,
    tempo: 1.15,

    stage: [
      K.titleScene({
        headline: 'One-click buttons, <em>in your Help Center.</em>',
        lead: 'Let customers act on their tickets right from the page where they view them.',
        card: { from: 'Acme Help Center', subject: 'Request #4821: Question about my invoice', text: 'Need this looked at sooner? Let us know with one click.', button: 'Escalate', done: 'Ticket escalated' }
      }),
      appScene,
      K.browserScene({ name: 'hchome', url: 'support.acme.com/hc/en-us', body: hcHomeBody }),
      guideScene,
      K.browserScene({ name: 'portal', url: 'support.acme.com/hc/en-us/requests/4821', body: portalBody }),
      K.browserScene({ name: 'landing', url: 'buttons.acme.com/ext/href/f5oiecf1-338e-4ddf…/4821' }),
      K.zendeskScene({
        views: { views: false, kz: false, trigger: false, ticket: true },
        ticket: { event: 'Jordan Lee clicked <b>Escalate</b> &middot; Priority changed Normal &rarr; Urgent' }
      }),
      K.outroScene({
        headline: 'One click,<br><em>right in your Help Center.</em>',
        ideas: ['Confirm a fix worked', 'Offer a choice of next steps', 'Show buttons only on certain tickets'],
        cta: { eyebrow: 'Available on the', big: 'Zendesk Marketplace', pill: 'klick-zen.com' }
      })
    ].join(''),

    // The kit's model, plus this walkthrough's own keys.
    state: Object.assign(K.defaults(), {
      hcView: 'views', hcToggle: false, hcCopied: -1, hcProds: false, hcKnowHover: false, // Klick-Zen app: 'views' | 'home' | 'list'
      gView: 'home', gMenu: false, gDupHover: false, gCopy: false, // Knowledge admin: 'home' | 'themes' | 'settings' | 'code'
      codeOpen: false, codeCaret: false, pasted: 0,
      pbar: false, published: false, pToast: false, escalated: false
    }),

    render(M, api) {
      K.render(M, api);
      const $ = s => api.$(s);
      const on = (sel, cls, v) => { const e = $(sel); if (e) e.classList.toggle(cls, !!v); };

      // Klick-Zen app
      const nav = $('.hc-shell .zd-nav');
      if (nav) {
        nav.children[1].classList.toggle('on', M.hcView === 'views');   // Home
        nav.children[6].classList.toggle('on', M.hcView !== 'views');   // Klick-Zen
      }
      $('#hc-tab').textContent = M.hcView === 'views' ? 'Views' : 'Klick-Zen';
      on('#hc-kz', 'hc-on', M.hcView !== 'views');
      on('#hc-home', 'hc-on', M.hcView === 'home');
      on('#hc-list', 'hc-on', M.hcView === 'list');
      on('#hc-nav-available', 'hc-sel', M.hcView !== 'views');
      on('#hc-tog', 'hc-on', M.hcToggle);
      on('#hc-list', 'hc-links', M.hcToggle);
      on('#hc-pmenu', 'hc-on', M.hcProds);
      on('#hc-prods', 'hc-open', M.hcProds);
      on('#hc-pm-know', 'hc-hov', M.hcKnowHover);
      BUTTONS.forEach((b, i) => {
        $('#hc-code-' + i).innerHTML = snipCode(b, M.hcToggle);
        on('#hc-copy-' + i, 'hc-ok', M.hcCopied === i);
        on('#hc-copied-' + i, 'hc-on', M.hcCopied === i);
      });

      // Knowledge admin
      ['home', 'themes', 'settings', 'code'].forEach(p => on('#hc-gp-' + p, 'hc-on', M.gView === p));
      on('#hc-g-home', 'hc-on', M.gView === 'home');
      on('#hc-g-design', 'hc-on', M.gView !== 'home');
      on('#hc-menu', 'hc-on', M.gMenu);
      on('#hc-dup', 'hc-hov', M.gDupHover);
      on('#hc-th-1', 'hc-hide', !M.gCopy);
      on('#hc-f-request', 'hc-sel', M.codeOpen);
      $('#hc-path').textContent = M.codeOpen ? 'templates/request_page.hbs' : '';
      const code = $('#hc-code'), sig = `${M.codeOpen}|${M.pasted}|${M.codeCaret}`;
      if (code.dataset.sig !== sig) { code.innerHTML = codeHtml(M); code.dataset.sig = sig; }

      // Help Center request page
      on('#hc-pbar', 'hc-on', M.pbar);
      on('#hc-publish', 'hc-done', M.published);
      $('#hc-publish').textContent = M.published ? 'Published' : 'Publish';
      on('#hc-ptoast', 'hc-on', M.pToast);

      // Zendesk ticket: the kit only shows a Solved outcome, so draw the escalated one here (priority and event).
      const pri = $('#zd-ticket .tk-props > :nth-child(4) .tr-in');
      if (pri) {
        pri.firstChild.nodeValue = M.escalated ? 'Urgent ' : 'Normal ';
        pri.classList.toggle('hc-urgent', M.escalated);
      }
      const msgs = $('#tk-msgs');
      let evt = $('#hc-esc-evt');
      if (M.escalated && !evt && msgs) {
        evt = document.createElement('div');
        evt.className = 'evt'; evt.id = 'hc-esc-evt';
        evt.innerHTML = K.MARK(16, '#07363f') + msgs.dataset.event;
        msgs.appendChild(evt);
      } else if (!M.escalated && evt) evt.remove();
    },

    chapters: [
      {
        id: 'intro', title: 'Introduction', start: { scene: 'title' },
        lines: [
          'Your customers already check on their tickets in your Help Center. What if they could act on them right there, with one click?',
          'With Klick-Zen, you can add buttons to the page where a customer views their ticket, so they can confirm a fix, escalate, or choose a next step.'
        ],
        async run(h) {
          await h.beat(0, async () => {
            h.set({ reveal: 0 });
            await h.sleep(2600);
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
        id: 'copy', title: 'Copy the snippet', step: 1,
        start: { scene: 'hcapp', hcView: 'views', hcToggle: false, hcCopied: -1 },
        lines: [
          'Start in Zendesk. Open the Klick-Zen app from the left sidebar, and click Available KlickButtons.',
          "Now the important part: turn on the \"Help Center Links\" toggle. The Zendesk Help Center uses slightly different placeholders than it does for triggers and automations, so the standard snippets won't work there.",
          'Find the button you want, and click copy beside its HTML snippet.'
        ],
        async run(h) {
          await h.beat(0, async () => {
            await h.sleep(300);
            await h.move('.hc-shell .zd-nav > :nth-child(7)');
            await h.click();
            h.set({ hcView: 'home' });
            await h.sleep(700);
            await h.move('#hc-nav-available');
            await h.click();
            h.set({ hcView: 'list' });
            await h.sleep(400);
          });
          await h.beat(1, async () => {
            await h.cam('#hc-list', 1.3, 0.5, 0.3);
            h.ring('#hc-switch', 6);
            await h.move('#hc-tog');
            await h.click();
            h.ring(null);
            h.set({ hcToggle: true });
            await h.sleep(600);
            await h.move('#hc-code-0', { fx: 0.85, fy: 1.4 });
            h.ring('#hc-code-0', 4);
            await h.sleep(2200);
            h.ring(null);
          });
          await h.beat(2, async () => {
            await h.move('#hc-copy-0');
            await h.click();
            h.set({ hcCopied: 0 });
            await h.sleep(900);
          });
        }
      },

      {
        id: 'theme', title: 'Open the theme code', step: 2,
        start: { scene: 'hcapp', hcView: 'list', hcToggle: true, hcCopied: -1, hcProds: false, hcKnowHover: false, gView: 'home', gMenu: false, gDupHover: false, gCopy: false, codeOpen: false, codeCaret: false, pasted: 0 },
        lines: [
          'Next, click the Zendesk Products icon in the top bar, and select Knowledge. In your help center, click Knowledge admin in the top bar, then click the Customize design icon, the paintbrush.',
          'A good habit: duplicate your live theme and edit the copy, so you can preview the button before customers see it.',
          'On your copy, click Customize in the corner of the theme preview, then click Edit code.',
          "Open request_page.hbs. That's the template for the page where a customer views their own ticket."
        ],
        async run(h) {
          await h.beat(0, async () => {
            await h.camReset();
            h.ring('#hc-prods', 4);
            await h.move('#hc-prods');
            await h.click();
            h.ring(null);
            h.set({ hcProds: true });
            await h.sleep(500);
            await h.move('#hc-pm-know');
            h.set({ hcKnowHover: true });
            await h.click();
            h.set({ scene: 'hchome', hcProds: false, hcKnowHover: false });
            await h.sleep(1400);
            h.ring('#hc-ka', 5);
            await h.move('#hc-ka');
            await h.click();
            h.ring(null);
            h.set({ scene: 'guide' });
            await h.sleep(1200);
            h.ring('#hc-g-design', 4);
            await h.move('#hc-g-design');
            await h.click();
            h.ring(null);
            h.set({ gView: 'themes' });
            await h.sleep(500);
          });
          await h.beat(1, async () => {
            await h.move('#hc-th-more');
            await h.click();
            h.set({ gMenu: true });
            await h.sleep(400);
            await h.move('#hc-dup');
            h.set({ gDupHover: true });
            await h.click();
            h.set({ gMenu: false, gDupHover: false, gCopy: true });
            await h.sleep(500);
            h.ring('#hc-th-1', 6);
            await h.sleep(1600);
            h.ring(null);
          });
          await h.beat(2, async () => {
            await h.move('#hc-cust-1');
            await h.click();
            h.set({ gView: 'settings' });
            await h.sleep(800);
            h.ring('#hc-editcode', 5);
            await h.move('#hc-editcode');
            await h.click();
            h.ring(null);
            h.set({ gView: 'code' });
            await h.sleep(400);
          });
          await h.beat(3, async () => {
            await h.move('#hc-f-request');
            await h.click();
            h.set({ codeOpen: true });
            await h.sleep(500);
            h.ring('#hc-f-request', 3);
            await h.sleep(1600);
            h.ring(null);
          });
        }
      },

      {
        id: 'paste', title: 'Paste the snippet', step: 3,
        start: { scene: 'guide', gView: 'code', gCopy: true, codeOpen: true, codeCaret: false, pasted: 0 },
        lines: [
          'Choose where the button should appear, for example in the ticket details on the right, and paste the snippet in.',
          "One button is all that's needed for this example, and you can always paste more beside it to offer a choice.",
          'Keep it in request_page.hbs: the Help Center placeholders only fill in on this page.'
        ],
        async run(h) {
          await h.beat(0, async () => {
            await h.cam('#hc-code', 1.3, 0.25, 0.6);
            await h.move('#hc-ins', { fx: 0.12 });
            await h.click();
            h.set({ codeCaret: true });
            await h.sleep(600);
            h.keycap('Ctrl+V');
            await h.sleep(300);
            h.set({ pasted: 1 });
            await h.sleep(700);
            h.keycap(false);
          });
          await h.beat(1, async () => {
            await h.move('#hc-ins', { fx: 0.6, fy: -1.2 });
            h.ring('#hc-code .hc-new', 3);
            await h.sleep(2800);
            h.ring(null);
          });
          await h.beat(2, async () => {
            h.set({ codeCaret: false });
            await h.camReset();
            await h.move('#hc-path', { fx: 0.9, fy: 1.2 });
            h.ring('#hc-path', 5);
            await h.sleep(1400);
            h.ring('#hc-f-request', 3);
            await h.sleep(1400);
            h.ring(null);
          });
        }
      },

      {
        id: 'publish', title: 'Preview and publish', step: 4,
        start: { scene: 'guide', gView: 'code', gCopy: true, codeOpen: true, codeCaret: false, pasted: 1, pbar: false, published: false, pToast: false },
        lines: [
          'Preview the theme, and open a ticket as a customer to make sure the button shows up and links correctly.',
          "When you're happy, publish the theme. Every customer viewing their own ticket now sees the button, wired to their own request."
        ],
        async run(h) {
          await h.beat(0, async () => {
            await h.move('#hc-preview');
            await h.click();
            h.set({ scene: 'portal', pbar: true });
            await h.sleep(900);
            h.ring('#hc-pact', 8);
            await h.move('#hc-kb-0', { fx: 0.7, fy: 1.5 });
            await h.sleep(2000);
            h.ring(null);
          });
          await h.beat(1, async () => {
            await h.move('#hc-publish');
            await h.click();
            h.set({ published: true, pToast: true });
            await h.sleep(2200);
            h.set({ pToast: false });
          });
        }
      },

      {
        id: 'result', title: 'What your customer sees',
        start: { scene: 'portal', pbar: false, published: true, pToast: false, escalated: false },
        lines: [
          "Here's your customer's view: their ticket, the conversation, and one clear way to escalate.",
          'One click, and they land on a confirmation page. No reply to write, and nothing else to do.',
          'Back in Zendesk, the ticket is already marked Urgent, and no agent had to lift a finger.'
        ],
        async run(h) {
          await h.beat(0, async () => {
            h.tag('Your customer');
            await h.cam('.hc-pcols', 1.3, 0.6, 0.35);
            await h.move('#hc-kb-0', { fx: 0.7, fy: 1.5 });
            h.ring('#hc-pact', 8);
            await h.sleep(1500);
          });
          await h.beat(1, async () => {
            await h.move('#hc-kb-0');
            h.ring(null);
            await h.click();
            h.set({ scene: 'landing' });
            await h.sleep(400);
            await h.move('.landing h1', { fx: 0.9, fy: 2.4, ms: 900 });
          });
          await h.beat(2, async () => {
            h.tag(false);
            h.set({ scene: 'zd', zdView: 'ticket' });
            h.camReset('portal', false);
            await h.sleep(1200);
            await h.move('#zd-ticket .tk-props > :nth-child(4)', { fx: 0.8, fy: 1.3 });
            h.set({ escalated: true });
            h.ring('#zd-ticket .tk-props > :nth-child(4)', 6);
            await h.sleep(1400);
            h.ring('#hc-esc-evt', 6);
            await h.sleep(1400);
            h.ring(null);
          });
        }
      },

      {
        id: 'outro', title: 'Next steps', start: { scene: 'outro' },
        lines: [
          "That's Klick-Zen in your Help Center: one-click actions, right where customers already look.",
          "You can also use your own button image, or show buttons only on certain tickets, such as open ones, using your theme's existing logic.",
          'Find Klick-Zen on the Zendesk Marketplace, and give your customers a faster way forward.'
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
