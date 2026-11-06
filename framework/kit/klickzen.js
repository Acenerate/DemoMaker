/*
 * Klick-Zen kit: scene builders for walkthroughs (recreated Klick-Zen, Zendesk, email and browser
 * screens) plus a render() that draws them from the walkthrough model.
 *
 * Builders return HTML strings for KZWalkthrough.create({ stage }). Each builds one scene
 * (<section class="scene" data-scene="...">); content options all have sensible defaults.
 * Element ids inside the kit are fixed (e.g. #kz-preview), so use each screen once per walkthrough.
 *
 * Model keys the kit reads are listed in KZKit.defaults().
 */
(function (global) {
  'use strict';

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const CARET = '<span class="caret"></span>';
  const MARK = (size, cursorFill = '#fff') => `<svg width="${size}" height="${size}" viewBox="0 0 44 44"><path d="M27.5 29.5A12.5 12.5 0 1 1 33 21" fill="none" stroke="#e8a61b" stroke-width="4.5" stroke-linecap="round"/><path d="M24 22v17l4.4-4.2 3.3 7 3-1.4-3.2-6.8 6.1-.3z" fill="${cursorFill}"/></svg>`;
  const CHECK = (size, fill = '#fff') => `<svg width="${size}" height="${size}" viewBox="0 0 24 24"><path fill="${fill}" d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>`;
  const CHEVRON = '<svg class="kz-chev" viewBox="0 0 12 8" aria-hidden="true"><path d="M1.5 1.75 6 6.25l4.5-4.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';   // drop-down arrow; pinned to the right of a select

  const KZKit = {
    /** Path to the shared assets folder, relative to the walkthrough page. */
    assets: '../../framework/assets/',   // relative to a walkthrough's page (walkthroughs/<name>/)

    /** Drop-down arrow (SVG) for select-like fields; sits at the right edge of a flex box. */
    CHEVRON,

    GREEN: '#17700f',
    PALETTE: ['#ffffff', '#c8c8c8', '#1f2a37', '#2563d9', '#5a3fd0', '#17700f', '#127566', '#c2410c', '#b91c1c', '#f59e0b'],
    ACTIONS: ['SELECT AN ACTION:', 'Update Ticket Field', 'Set Ticket Status', 'Add Private Comment', 'Add Public Comment', 'Add Ticket Tag', 'Set Ticket Assignee', 'Set Ticket Type', 'Set Ticket Priority'],
    STATUSES: ['Open', 'In Progress', 'Pending', 'Solved'],
    SNIPPET: "<a href='https://app.klick-zen.com/ext/href/f5oiecf1-338e-4ddfgdf8-dfg4v2444-gfg-83cc5b/{{ticket.id}}/{{ticket.requester.id}}'><img src='https://app.klick-zen.com/ext/src/f5oiecf1-338e-4ddfgdf8-dfg4v2444-gfg-83cc5b/{{ticket.id}}' /></a>",
    MARKETPLACE: 'https://www.zendesk.com/marketplace/apps/support/1097296/klick-zen-action-buttons/',
    MARK, CHECK,

    /** Model keys the kit renders, with their starting values. Spread into your state. */
    defaults() {
      return {
        scene: 'title', reveal: -1, demoClicked: false,
        // Zendesk shell: 'views' | 'kz' | 'trigger' | 'ticket'
        zdView: 'views',
        // Klick-Zen app page: 'home' | 'editor' | 'list'
        kzView: 'home',
        // button editor
        name: 'Blank Button', nameSel: false, caret: null,   // caret: 'name' | 'label' | 'assignee' | 'body' | null
        label: 'Button Text', bg: '#c8c8c8', fg: '#00008b', bold: false, round: 0.47,
        actions: [],          // [{ type: null | 'status' | 'assignee' | 'tag' | 'field', value, ifBlank, field }]
        attention: false, addDim: false, scroll: 0,
        // button list
        toast: false, copied: false,
        // trigger email body
        body: '', snippet: false, snippetSettled: false, trToast: false,
        // ticket
        ticketSolved: false
      };
    },

    /** Scroll offset that brings an element in the editor into view (for h.tween('scroll', ...)). */
    scrollTarget(sel, margin = 40) {
      const el = document.querySelector(sel), page = document.querySelector('#kz-editor');
      return Math.max(0, el.offsetTop + el.offsetHeight + margin - page.clientHeight);
    },

    /* ============================================================ scenes */

    /** Branded title card. card: { from, subject, text, button, done } for the mini email demo (optional). */
    titleScene(o = {}) {
      const c = o.card;
      return `<section class="scene brand-scene" data-scene="${o.name || 'title'}">
        <img class="logo reveal" data-r="0" src="${KZKit.assets}klick-zen-logo-dark.png" alt="">
        <h2 class="reveal" data-r="0">${o.headline || 'Let customers <em>solve tickets</em> with one click.'}</h2>
        ${o.lead ? `<p class="lead reveal" data-r="1">${esc(o.lead)}</p>` : ''}
        ${c ? `<div class="demo-card reveal" data-r="0" id="demo-card">
          <div class="from"><div class="av">${esc((c.from || 'A')[0])}</div><div><b>${esc(c.from || 'Acme Support')}</b><span>${esc(c.subject || '')}</span></div></div>
          <p>${esc(c.text || '')}</p>
          <span class="kz-btn-img" id="demo-btn">${esc(c.button || 'Close Ticket')}</span>
          <div class="ok" id="demo-ok"><i>${CHECK(14)}</i>${esc(c.done || 'Ticket solved')}</div>
        </div>` : ''}
      </section>`;
    },

    /** Branded closing card. ideas: [string], cta: { eyebrow, big, pill } */
    outroScene(o = {}) {
      const cta = o.cta;
      return `<section class="scene brand-scene" data-scene="${o.name || 'outro'}">
        <img class="logo reveal" data-r="0" src="${KZKit.assets}klick-zen-logo-dark.png" alt="">
        <h2 class="reveal" data-r="0" style="top:190px">${o.headline || 'One click.<br><em>Ticket solved.</em>'}</h2>
        <div class="outro-ideas">${(o.ideas || []).map(t => `<div class="reveal" data-r="1"><i></i>${esc(t)}</div>`).join('')}</div>
        ${cta ? `<div class="cta reveal" data-r="2"><div class="mp">${esc(cta.eyebrow || '')}</div><div class="big">${esc(cta.big || '')}</div>${cta.pill ? `<span class="pill">${esc(cta.pill)}</span>` : ''}</div>` : ''}
      </section>`;
    },

    /**
     * The Zendesk left sidebar (Home, Views, Customers, Reporting, Klick-Zen, Admin Center).
     * Shared by zendeskScene and any custom Zendesk screen, so every walkthrough's sidebar matches.
     * o.active: 'home' | 'app' | 'admin' | null (highlighted icon)
     * o.ids: give the icons their fixed ids (#zd-home, #zd-app, #zd-admin) that zendeskScene and
     *   KZKit.render use. Default true; pass false in a custom scene that sits beside zendeskScene.
     */
    zdNav(o = {}) {
      const icon = p => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
      const item = (key, html) => `<div class="ico${o.active === key ? ' on' : ''}"${o.ids !== false ? ` id="zd-${key}"` : ''}>${html}</div>`;
      const gear = '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>';
      return `<nav class="zd-nav">
            <div class="brand">Z</div>
            ${item('home', icon('<path d="M3 11 12 4l9 7v9H5v-9"/>'))}
            <div class="ico">${icon('<path d="M4 6h16M4 12h16M4 18h10"/>')}</div>
            <div class="ico">${icon('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c2 .7 3.2 2.4 3.6 5.2"/>')}</div>
            <div class="ico">${icon('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>')}</div>
            <div class="sep"></div>
            ${item('app', MARK(26))}
            <div class="sep"></div>
            ${item('admin', icon(gear))}
          </nav>`;
    },

    /**
     * Zendesk agent workspace with the Klick-Zen app. Views shown via model.zdView.
     * o.views: which views to include (default all): { views, kz, trigger, ticket }
     * o.trigger: { title, subject }   o.ticket: { subject, number, requester, assignee, tags, messages, event }
     */
    zendeskScene(o = {}) {
      const v = Object.assign({ views: true, kz: true, trigger: true, ticket: true }, o.views);
      return `<section class="scene" data-scene="${o.name || 'zd'}"><div class="cam">
        <div class="zd">
          ${KZKit.zdNav({ active: 'home' })}
          <div class="zd-main">
            <div class="zd-top"><div class="zd-tab on" id="zd-tab">Views</div><div class="zd-tab">+ Add</div><div class="sp"></div><div class="avatar">JD</div></div>
            <div class="zd-body" data-ticket-tab="${esc((o.ticket && o.ticket.subject) || 'Question about my invoice')} #${esc((o.ticket && o.ticket.number) || '4821')}">
              ${v.views ? KZKit._views(o.viewsList) : ''}
              ${v.kz ? KZKit._kzApp() : ''}
              ${v.trigger ? KZKit._trigger(o.trigger) : ''}
              ${v.ticket ? KZKit._ticket(o.ticket) : ''}
            </div>
          </div>
        </div>
      </div></section>`;
    },

    /** A customer's webmail inbox showing one email. The button is styled from the model (label/bg/fg/bold/round). */
    inboxScene(o = {}) {
      const paras = o.paragraphs || ['Hi Jordan,', "We haven't heard back from you in a while. If everything is sorted, just click the button below and we'll close your ticket."];
      return `<section class="scene" data-scene="${o.name || 'inbox'}"><div class="cam">
        <div class="mail">
          <div class="mail-top"><div class="lg"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#3d5a80" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>Mail</div><div class="search">Search mail</div></div>
          <div class="mail-cols">
            <div class="mail-list">
              <div class="mail-item on"><b>${esc(o.from || 'Acme Support')}</b>${esc(o.subject || 'Can we be of further help?')}</div>
              <div class="mail-item"><b>Team Calendar</b>Weekly sync moved to Thursday</div>
              <div class="mail-item"><b>Newsletter</b>Five tips for a calmer inbox</div>
              <div class="mail-item"><b>Airline</b>Your boarding pass is ready</div>
            </div>
            <div class="mail-read">
              <h3>${esc(o.subject || 'Can we be of further help?')}</h3>
              <div class="mail-from"><div class="av">${esc((o.from || 'A')[0])}</div><div><b>${esc(o.from || 'Acme Support')}</b> &lt;${esc(o.email || 'support@acme.com')}&gt;<br>to me &middot; 9:41 AM</div></div>
              <div class="mail-body">
                ${paras.map(p => `<p>${esc(p)}</p>`).join('')}
                <p style="margin:22px 0 24px"><span class="kz-btn-img" id="mail-btn"></span></p>
                <p style="margin:0;color:#68737d">${esc(o.signoff || 'Thanks,')}<br>${esc(o.signature || 'The Acme Support Team')}</p>
              </div>
            </div>
          </div>
        </div>
      </div></section>`;
    },

    /** A browser window. body: HTML (e.g. KZKit.landingPage()). */
    browserScene(o = {}) {
      return `<section class="scene" data-scene="${o.name || 'browser'}" style="background:#cfd8dc"><div class="cam">
        <div class="browser">
          <div class="browser-bar"><div class="dots"><i></i><i></i><i></i></div>
            <div class="url"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4b5a66" stroke-width="2.4"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>${esc(o.url || 'buttons.acme.com/ext/href/f5oiecf1-338e-4ddf…/4821')}</div></div>
          ${o.body || KZKit.landingPage()}
        </div>
      </div></section>`;
    },

    /** The landing page a customer sees after clicking (default: confirmation page). It carries the
        customer's own branding, so the default header is the example company's logo, never Klick-Zen's.
        logo: optional image URL to use instead. */
    landingPage(o = {}) {
      const paras = o.paragraphs || ['We appreciate you taking the time to let us know. Your feedback goes straight to our team and helps us keep improving.', '<b>There’s nothing more you need to do</b> - you can safely close this window.'];
      return `<div class="landing">
        <div class="lhead">${o.logo ? `<img src="${o.logo}" alt="">` : '<span class="lbrand"><i>A</i><b>Acme Support</b></span>'}</div>
        <div class="lbody"><h1>${esc(o.heading || 'Thank you!')}</h1><h2>${esc(o.subheading || 'Your response has been received')}</h2><hr>
          ${paras.map(p => `<p>${p}</p>`).join('')}</div>
      </div>`;
    },

    /* ======================================================= sub-views */

    _views(rows) {
      rows = rows || [
        ['open', 'Question about my invoice', 'Jordan Lee', '14 days ago'], ['pending', "Can't reset my password", 'Priya Shah', '2 days ago'],
        ['open', 'Shipping address change', 'Marco Silva', 'Yesterday'], ['new', 'Bulk order discount?', 'Emma Clarke', '3 hours ago'],
        ['pending', 'Refund for duplicate charge', 'Sam Okafor', '5 days ago']];
      return `<div class="zd-views" id="zd-views">
        <aside><h4>Views</h4><div class="on">Your unsolved tickets <span>12</span></div><div>Unassigned tickets <span>4</span></div><div>All unsolved tickets <span>31</span></div><div>Recently updated <span>9</span></div><div>Pending tickets <span>7</span></div><div>Recently solved <span>58</span></div></aside>
        <main><h3>Your unsolved tickets</h3><div class="zd-row h"><span>Status</span><span>Subject</span><span>Requester</span><span>Updated</span></div>
          ${rows.map(r => `<div class="zd-row"><span><i class="badge b-${r[0]}">${r[0]}</i></span><span>${esc(r[1])}</span><span>${esc(r[2])}</span><span>${esc(r[3])}</span></div>`).join('')}</main>
      </div>`;
    },

    _kzApp() {
      const tb = (bg, t, fg) => `<span class="tb" style="background:${bg}${fg ? ';color:' + fg : ''}">${t}</span>`;
      return `<div class="kz" id="kz">
        <div class="kz-head"><span class="kz-mark">${MARK(22)}</span>Klick-Zen Action Buttons</div>
        <div class="kz-cols">
          <div class="kz-side">
            <h6>BUTTONS</h6><hr>
            <div class="on" id="kz-nav-available">Available KlickButtons</div><div id="kz-nav-template">Default Button Template</div><div id="kz-nav-landing">Default Landing Page</div>
            <h6>SYSTEM</h6><hr><div id="kz-nav-settings">Settings</div>
            <h6>HELP</h6><hr><div>Documentation</div><div>Contact Support</div>
          </div>
          <div class="kz-content">
            <div class="kz-page" id="kz-home">
              <div class="kz-titlebar"><h2><b>Klick-Zen</b> Workflow Buttons</h2>
                <div class="kz-actions">Built buttons with our Email Template Generator? &rarr; <span class="btn-out">Import buttons</span>
                  <span class="btn-split" id="kz-create"><span id="kz-create-main">Create new button</span><i id="kz-create-arrow">${CHEVRON}</i></span></div></div>
              <div class="kz-welcome">
                <h3>Welcome to Klick-Zen!</h3>
                <p>Klick-Zen allows you to quickly create functional Zendesk action buttons that, when clicked by one of your end users, take an action on their ticket, such as adding a tag or setting the value of a custom field.</p>
                <p>These buttons can be automatically inserted into emails that are sent to your end users via a trigger, or added manually by a Zendesk agent while responding to a ticket.</p>
                <div class="kz-tpl">
                  <span>Resolve &amp; confirm</span><div>${tb('#1b7a33', "Yes it's resolved")}${tb('#1f2a37', 'I still need help')}${tb('#ffd34d', 'Not yet, I need a few days', '#1f2a37')}${tb('#127566', 'I found the answer myself')}</div>
                  <span>Route &amp; escalate</span><div>${tb('#2563d9', 'Billing question')}${tb('#5a3fd0', 'Technical issue')}${tb('#127566', 'Order status')}${tb('#c2410c', 'Talk to a human')}${tb('#b91c1c', 'Escalate to a manager')}</div>
                  <span>Approvals</span><div>${tb('#1b7a33', 'Approve')}${tb('#b91c1c', 'Deny')}${tb('#f59e0b', 'I need more detail')}</div>
                </div>
              </div>
            </div>
            <div class="kz-page" id="kz-editor"><div class="kz-scroll" id="kz-scroll">
              <div class="kz-name" id="kz-name"></div>
              <fieldset class="kz-fs" id="fs-appearance"><legend>Button Appearance</legend>
                <div class="kz-hint">Type directly inside the button to change the text; 25 characters max</div>
                <span id="kz-preview"></span>
                <div class="kz-row"><span class="tog" id="tog-bold"></span>Bold<span class="tog" style="margin-left:10px"></span>Italic<span class="kz-select" style="width:206px;margin-left:12px">Arial ${CHEVRON}</span></div>
                <div class="kz-row">Border <span class="sw" id="sw-border"><div style="background:#666"></div></span><span class="swap">&#8646;</span>Background <span class="sw" id="sw-bg"><div></div></span><span style="margin-left:6px">Text</span> <span class="sw" id="sw-fg"><div></div></span></div>
                <div class="kz-row" style="display:block">Roundness<div class="slider" id="slider"><div class="track"></div><div class="fill" id="slider-fill"></div><div class="thumb" id="slider-thumb"></div></div></div>
              </fieldset>
              <fieldset class="kz-fs" id="fs-actions"><legend>Button Actions</legend>
                <div class="kz-hint">This is what will happen to the ticket when the button is clicked; <b>you MUST have at least one action defined</b></div>
                <div id="kz-actions"></div><span class="btn-ghost" id="kz-add">Add button action</span>
              </fieldset>
              <fieldset class="kz-fs" id="fs-settings"><legend>Settings</legend>
                <div class="kz-row"><span class="tog on"></span>Button Enabled</div><div class="kz-row"><span class="tog on"></span>Visible in Ticket Editor</div>
              </fieldset>
              <div class="kz-foot"><span class="btn-red" id="kz-cancel">Cancel</span><span class="btn-blue" id="kz-save">Create</span></div>
            </div></div>
            <div class="kz-page" id="kz-list">
              <div class="kz-toast" id="kz-toast">${CHECK(16)}Button created</div>
              <div class="kz-titlebar"><h2><b>Klick-Zen</b> Workflow Buttons</h2><div class="kz-actions"><span class="btn-out">Import buttons</span><span class="btn-split"><span>Create new button</span><i>${CHEVRON}</i></span></div></div>
              <p style="font-size:12.5px;font-style:italic;color:#5b6c72;margin:14px 0 0">Copy the HTML code to insert the button into a custom Zendesk trigger email template; these are for pasting into email responses from <u>triggers</u>, <u>automations</u>, and <u>macros</u>.</p>
              <div class="kz-card" id="kz-card">
                <div class="top"><span class="kz-btn-img" id="card-btn" style="font-size:17px;padding:9px 22px"></span><span class="nm" id="card-name"></span>
                  <span class="snip"><code>&lt;a href='https://app.klick-zen.com/ext/href/f5oiecf1…</code><i id="kz-copy"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg><em class="copied" id="kz-copied">Copied!</em></i></span></div>
                <div class="meta"><b>ACTIONS</b><span id="card-chips"></span><b>USED IN</b><span style="font-style:italic;color:#87929d">no triggers, automations or macros</span></div>
              </div>
              <div class="kz-card ghost"><div class="top"><span class="kz-btn-img" style="font-size:17px;padding:9px 22px;background:#1f2a37;border-color:#1f2a37">I still need help</span><span class="nm">Still need help</span></div></div>
            </div>
          </div>
        </div>
      </div>`;
    },

    _trigger(o = {}) {
      return `<div class="tr-page" id="zd-trigger" style="display:none">
        <div class="crumbs">Admin Center &rsaquo; Objects and rules &rsaquo; Business rules &rsaquo; Triggers <span>&rsaquo; Edit</span></div>
        <h2>${esc(o.title || 'Notify requester: no response in 14 days')}</h2>
        <div class="tr-box"><h4>Actions</h4>
          <div class="tr-grid">
            <div class="tr-field"><label>Category</label><div class="tr-in">Notify by &rsaquo; User email ${CHEVRON}</div></div>
            <div class="tr-field"><label>Recipient</label><div class="tr-in">Ticket &rsaquo; (requester) ${CHEVRON}</div></div>
            <div class="tr-field" style="grid-column:1/3"><label>Email subject</label><div class="tr-in">${esc(o.subject || 'Can we be of further help?')}</div></div>
            <div class="tr-field" style="grid-column:1/3"><label>Email body</label><div class="tr-body" id="tr-body"></div></div>
          </div>
          <div class="tr-links"><span>View available placeholders</span><span>Learn about simplified email threading</span></div>
        </div>
        <div class="tr-bar"><span class="zbtn sec">Cancel</span><span class="zbtn pri" id="tr-save">Save</span></div>
        <div class="zd-toast" id="tr-toast">${CHECK(16, '#7ed492')}Trigger saved</div>
      </div>`;
    },

    _ticket(o = {}) {
      const msgs = o.messages || [
        { who: 'Jordan Lee', initials: 'JL', when: '16 days ago', text: 'Hi, my last invoice shows two line items for the same plan. Can you check?' },
        { who: 'Super Agent', initials: 'SA', when: '15 days ago', agent: true, text: 'Thanks Jordan! That was a display issue on our side; your account was only charged once. Let us know if anything still looks off.' }];
      return `<div class="tk" id="zd-ticket" style="display:none">
        <div class="tk-props">
          <div><label>Requester</label><div class="tr-in">${esc(o.requester || 'Jordan Lee')}</div></div>
          <div><label>Assignee</label><div class="tr-in">${esc(o.assignee || 'Super Agent')}</div></div>
          <div><label>Type</label><div class="tr-in">Question ${CHEVRON}</div></div>
          <div><label>Priority</label><div class="tr-in">Normal ${CHEVRON}</div></div>
          <div><label>Tags</label><div class="tr-in" style="justify-content:flex-start;gap:6px">${(o.tags || ['billing']).map(t => `<span class="chip" style="margin:0">${esc(t)}</span>`).join('')}</div></div>
        </div>
        <div class="tk-conv">
          <div class="tk-head"><i class="badge b-open" id="tk-badge">Open</i><h3>${esc(o.subject || 'Question about my invoice')}</h3><span style="color:#87929d">#${esc(o.number || '4821')}</span></div>
          <div class="tk-msgs" id="tk-msgs" data-event="${esc(o.event || 'Jordan Lee clicked <b>Close Ticket</b> &middot; Status changed Open &rarr; Solved')}">
            ${msgs.map(m => `<div class="msg"><div class="av" style="${m.agent ? 'background:#03363d;color:#fff' : 'background:#dbe8ea;color:#03363d'}">${esc(m.initials)}</div><div class="bub"><small>${esc(m.who)} &middot; ${esc(m.when)}</small>${esc(m.text)}</div></div>`).join('')}
          </div>
          <div class="tk-foot"><span class="submit-as" id="tk-submit">Submit as Open</span></div>
        </div>
      </div>`;
    },

    /* ============================================================ render */

    /** Draw every kit screen present on the stage from the model. Use as (or call from) your render(). */
    render(M, api) {
      const $ = s => (api ? api.$(s) : document.querySelector(s));
      // Every lookup is optional: a walkthrough may use only some kit screens, plus custom screens of
      // its own (whatever classes those use), so anything not on the stage is simply skipped.
      const with_ = (sel, fn) => { const e = $(sel); if (e) fn(e); };
      const show = (sel, on) => with_(sel, e => { e.style.display = on ? '' : 'none'; });
      const toggle = (sel, cls, on) => with_(sel, e => e.classList.toggle(cls, !!on));
      const text = (sel, t) => with_(sel, e => { e.textContent = t; });
      const btnStyle = el => {
        if (!el) return;
        el.textContent = M.label;
        Object.assign(el.style, { backgroundColor: M.bg, color: M.fg, fontWeight: M.bold ? '700' : '400', borderRadius: Math.round(M.round * 20) + 'px' });
      };

      // title card
      toggle('#demo-ok', 'in', M.demoClicked);

      // Zendesk shell (recognised by the kit's own ids, not by class names a custom scene might reuse)
      if ($('#zd-tab')) {
        const v = M.zdView;
        show('#zd-views', v === 'views');
        show('#kz', v === 'kz' || v === 'views');
        toggle('#kz', 'on', v === 'kz');
        show('#zd-trigger', v === 'trigger');
        show('#zd-ticket', v === 'ticket');
        toggle('#zd-home', 'on', v === 'views' || v === 'ticket');
        toggle('#zd-app', 'on', v === 'kz');
        toggle('#zd-admin', 'on', v === 'trigger');
        const zb = $('.zd-body');
        text('#zd-tab', { views: 'Views', kz: 'Klick-Zen', trigger: 'Admin Center', ticket: zb ? zb.dataset.ticketTab : 'Ticket' }[v] || '');
      }

      // Klick-Zen app
      if ($('#kz')) {
        ['home', 'editor', 'list'].forEach(p => toggle('#kz-' + p, 'on', M.kzView === p));
        with_('#kz-name', name => {
          name.classList.toggle('focus', M.nameSel || M.caret === 'name');
          name.innerHTML = M.nameSel ? `<span class="sel">${esc(M.name)}</span>` : esc(M.name) + (M.caret === 'name' ? CARET : '');
        });
        with_('#kz-preview', pv => {
          btnStyle(pv);
          if (M.caret === 'label') pv.insertAdjacentHTML('beforeend', CARET);
          pv.classList.toggle('focus', M.caret === 'label');
        });
        with_('#sw-bg div', e => { e.style.backgroundColor = M.bg; });
        with_('#sw-fg div', e => { e.style.backgroundColor = M.fg; });
        toggle('#tog-bold', 'on', M.bold);
        with_('#slider-thumb', e => { e.style.left = M.round * 100 + '%'; });
        with_('#slider-fill', e => { e.style.width = M.round * 100 + '%'; });
        with_('#kz-scroll', e => { e.style.transform = `translateY(${-(M.scroll || 0)}px)`; });
        KZKit._renderActions(M, $);
        toggle('#kz-add', 'dim', M.addDim);
        // list
        toggle('#kz-toast', 'show', M.toast);
        toggle('#kz-copied', 'show', M.copied);
        toggle('#kz-copy', 'ok', M.copied);
        btnStyle($('#card-btn'));
        text('#card-name', M.name);
        with_('#card-chips', e => { e.innerHTML = (M.actions || []).filter(a => a.type).map(a => `<span class="chip">${esc({ status: 'Status', tag: 'Tag', field: a.field || 'Field' }[a.type] || 'Assign')} &rarr; ${esc(a.value)}</span>`).join(''); });
      }

      // trigger
      with_('#tr-body', body => {
        body.classList.toggle('focus', M.caret === 'body');
        body.innerHTML = esc(M.body || '') + (M.snippet ? `<span class="pasted${M.snippetSettled ? ' settle' : ''}">${esc(KZKit.SNIPPET)}</span>` : '') + (M.caret === 'body' ? CARET : '');
        toggle('#tr-toast', 'show', M.trToast && M.zdView === 'trigger');
      });

      // inbox button mirrors the built button
      btnStyle($('#mail-btn'));

      // ticket
      with_('#tk-badge', badge => {
        badge.className = 'badge ' + (M.ticketSolved ? 'b-solved' : 'b-open');
        badge.textContent = M.ticketSolved ? 'Solved' : 'Open';
        text('#tk-submit', M.ticketSolved ? 'Submit as Solved' : 'Submit as Open');
        const msgs = $('#tk-msgs');
        let evt = $('#tk-evt');
        if (M.ticketSolved && !evt && msgs) {
          evt = document.createElement('div');
          evt.className = 'evt'; evt.id = 'tk-evt';
          evt.innerHTML = MARK(16, '#07363f') + (msgs.dataset.event || '');
          msgs.appendChild(evt);
        } else if (!M.ticketSolved && evt) evt.remove();
      });
    },

    _actionRow(a, i, M) {
      if (a.type === null) return `<span class="kz-select" id="act-${i}-type">SELECT AN ACTION: ${CHEVRON}</span>`;
      if (a.type === 'status') {
        return `<span class="kz-select dim">Set Ticket Status ${CHEVRON}</span><label>New Status:</label>` +
          `<span class="kz-select" style="width:250px" id="act-${i}-val">${esc(a.value || '')} ${CHEVRON}</span>` +
          (M.attention ? '<div class="attention"><div>* ATTENTION *</div>Required fields must be populated before the ticket can be solved, or the button update will fail for that ticket.<div>Required: <span style="color:#1d2b30">Assignee</span></div></div>' : '');
      }
      if (a.type === 'assignee') {
        return `<span class="kz-select dim">Set Ticket Assignee ${CHEVRON}</span><label>Email Address:</label>` +
          `<span class="inp" id="act-${i}-val">${esc(a.value || '')}${M.caret === 'assignee' ? CARET : ''}</span>` +
          `<span class="tog${a.ifBlank ? ' on' : ''}" id="act-${i}-blank" style="margin-left:6px"></span><label>If Blank</label><span class="x">&times;</span>`;
      }
      // caret for the rows below: M.caret === 'act-<i>' (tag / field value)
      const caret = M.caret === 'act-' + i ? CARET : '';
      if (a.type === 'tag') {
        // Typed into a box, then shown as a pill once entered.
        if (a.value && !caret) return `<span class="kz-select dim">Add Ticket Tag ${CHEVRON}</span><label>Tag Name:</label><span class="kz-tag" id="act-${i}-val">${esc(a.value)}<i>&times;</i></span>`;
        return `<span class="kz-select dim">Add Ticket Tag ${CHEVRON}</span><label>Tag Name:</label>` +
          `<span class="inp" id="act-${i}-val">${esc(a.value || '')}${caret}</span>`;
      }
      if (a.type === 'field') {
        return `<span class="kz-select dim">Update Ticket Field ${CHEVRON}</span><label>Field:</label>` +
          `<span class="kz-select" style="width:190px" id="act-${i}-field">${esc(a.field || '')} ${CHEVRON}</span><label>Value:</label>` +
          `<span class="inp" style="width:150px" id="act-${i}-val">${esc(a.value || '')}${caret}</span><span class="x">&times;</span>`;
      }
      return '';
    },

    // Update action rows in place: only newly added rows play their entry animation.
    _renderActions(M, $) {
      const box = $('#kz-actions');
      if (!box) return;
      (M.actions || []).forEach((a, i) => {
        let row = box.children[i];
        if (!row) { row = document.createElement('div'); row.className = 'kz-action'; box.appendChild(row); }
        const html = KZKit._actionRow(a, i, M);
        if (row.dataset.html !== html) {
          // keep the attention notice from replaying its animation on unrelated edits
          const hadAttention = !!row.querySelector('.attention');
          row.innerHTML = html;
          row.dataset.html = html;
          const att = row.querySelector('.attention');
          if (att && hadAttention) att.style.animation = 'none';
        }
      });
      while (box.children.length > (M.actions || []).length) box.lastChild.remove();
    }
  };

  global.KZKit = KZKit;
})(window);
