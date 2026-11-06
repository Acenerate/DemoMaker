/* Using Buttons in the Ticket Editor: an agent drops one-click buttons straight into a ticket reply. */
(function () {
  'use strict';

  const K = KZKit;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Buttons offered in the Klick-Zen pop-up (each shown as a picture of the button itself).
  const BUTTONS = [
    { label: "Yes, it's resolved", bg: '#1b7a33' },
    { label: 'I still need help', bg: '#1f2a37' },
    { label: 'Talk to a human', bg: '#c2410c' },
    { label: 'Urgent!', bg: '#b91c1c' }
  ];
  const REPLY = "Hi Jordan,\n\nWe've corrected the duplicate line on your invoice, and the updated copy is in your account. Did that sort it out? Just let us know with one click:\n\n";
  const TAIL = '\n\nThanks,\nSam';

  const btnHtml = (b, id) => `<span class="te-btn"${id ? ` id="${id}"` : ''} style="background:${b.bg};border-color:${b.bg}">${esc(b.label)}</span>`;
  const svg = p => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${p}</svg>`;
  const field = (label, value) => `<div><label>${label}</label><div class="te-field">${value}</div></div>`;

  // A Zendesk ticket with the reply composer open (the kit's ticket view has no composer).
  // Own te- classes and ids throughout; only the sidebar comes from the kit, so it matches every walkthrough.
  const replyScene = `
    <section class="scene" data-scene="reply"><div class="cam">
      <div class="te-shell">
        ${K.zdNav({ active: 'home', ids: false })}
        <div class="te-main">
          <div class="te-top"><div class="te-tab te-on">Question about my invoice #4821</div><div class="te-tab">+ Add</div><div class="te-sp"></div><div class="te-avatar">SA</div></div>
          <div class="te-body">
            <div class="te-ticket">
              <div class="te-props">
                ${field('Requester', 'Jordan Lee')}
                ${field('Assignee', 'Sam Agent')}
                ${field('Type', `Question ${K.CHEVRON}`)}
                ${field('Priority', `Normal ${K.CHEVRON}`)}
                ${field('Tags', '<span class="te-tag">billing</span>')}
              </div>
              <div class="te-conv">
                <div class="te-head"><i class="te-status">Open</i><h3>Question about my invoice</h3><span>#4821</span></div>
                <div class="te-msgs">
                  <div class="te-msg"><div class="te-av">JL</div><div class="te-bub"><small>Jordan Lee &middot; 2 hours ago</small>Hi, my last invoice shows two line items for the same plan. Can you check?</div></div>
                </div>
                <div class="te-reply" id="te-reply">
                  <div class="te-rhead"><b>&#8617; Public reply ${K.CHEVRON}</b><span>To</span><span class="te-to"><i>JL</i>Jordan Lee</span></div>
                  <div class="te-text" id="te-text"><span id="te-before"></span><span id="te-btns"></span><span id="te-after"></span></div>
                  <div class="te-tip" id="te-tip">app.klick-zen.com/ext/href/f5oiecf1…/<b>4821</b>/<b>1187</b></div>
                  <div class="te-tools">
                    <span class="te-tool">${svg('<path d="M4 20h16M7 4h10M12 4v12"/>')}</span>
                    <span class="te-tool">${svg('<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5h.01M15 9.5h.01"/>')}</span>
                    <span class="te-tool">${svg('<path d="m20 11-8.5 8.5a5 5 0 0 1-7-7L13 4a3.3 3.3 0 0 1 4.7 4.7L9.4 17a1.7 1.7 0 0 1-2.4-2.4l7.8-7.8"/>')}</span>
                    <span class="te-tool">${svg('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>')}</span>
                    <span class="te-tool">${svg('<path d="m4 20 12-12M15 4v2M19 8h2M18 4l-1 1"/>')}</span>
                    <span class="te-tool" id="te-kz">${K.MARK(22, '#07363f')}</span>
                  </div>
                  <div class="te-picker" id="te-picker">${BUTTONS.map((b, i) => btnHtml(b, 'te-opt-' + i)).join('')}</div>
                </div>
                <div class="te-foot"><span class="te-submit" id="te-submit">Submit as Open</span></div>
              </div>
            </div>
            <div class="te-toast" id="te-toast">${K.CHECK(16, '#7ed492')}Reply sent</div>
          </div>
        </div>
      </div>
    </div></section>`;

  KZWalkthrough.create({
    title: 'Using Buttons in the Ticket Editor',
    subtitle: 'An animated walkthrough, about one minute',
    logo: { light: '../../framework/assets/klick-zen-logo.png', dark: '../../framework/assets/klick-zen-logo-dark.png' },
    intro: { title: 'Buttons in the ticket editor', text: 'Watch an agent drop one-click buttons into a Zendesk reply.' },
    end: {
      title: 'One click, right from the reply.',
      text: 'Ready to try it with your own customers?',
      link: { href: K.MARKETPLACE, label: 'Get Klick-Zen on the Zendesk Marketplace →' }
    },
    narration: { mode: 'audio' },
    captions: false,
    tempo: 1.15,

    stage: [
      K.titleScene({
        headline: 'One-click buttons, <em>right in your replies.</em>',
        lead: 'Drop a Klick-Zen button into any Zendesk ticket reply, in a couple of clicks.',
        card: { from: 'Acme Support', subject: 'Re: Question about my invoice', text: "We've corrected your invoice. Did that sort it out?", button: "Yes, it's resolved", done: 'Ticket solved' }
      }),
      replyScene,
      K.outroScene({
        headline: 'One click,<br><em>right from the reply.</em>',
        ideas: ['Confirm a fix worked', 'Gather more details', 'Offer a choice of next steps'],
        cta: { eyebrow: 'Available on the', big: 'Zendesk Marketplace', pill: 'klick-zen.com' }
      })
    ].join(''),

    // The kit's model, plus the reply composer's own keys.
    state: Object.assign(K.defaults(), {
      reply: '', inserted: [], tail: '', rpFocus: false, rpCaret: false,
      pop: false, kzOn: false, linkTip: false, sent: false
    }),

    render(M, api) {
      K.render(M, api);
      const $ = s => api.$(s);
      $('#te-reply').classList.toggle('te-focus', M.rpFocus);
      $('#te-before').textContent = M.reply;
      // Add or remove inserted buttons one at a time, so only a new one plays its pop-in.
      const box = $('#te-btns');
      M.inserted.forEach((b, i) => { if (!box.children[i]) box.insertAdjacentHTML('beforeend', btnHtml(BUTTONS[b], 'te-btn-' + i)); });
      while (box.children.length > M.inserted.length) box.lastChild.remove();
      $('#te-after').innerHTML = esc(M.tail) + (M.rpCaret ? '<span class="caret"></span>' : '');   // .caret: the engine's blinking caret
      $('#te-kz').classList.toggle('te-on', M.kzOn);
      $('#te-picker').classList.toggle('te-on', M.pop);
      const tip = $('#te-tip'), first = $('#te-btn-0');
      tip.classList.toggle('te-on', M.linkTip && !!first);
      if (first) tip.style.top = (first.offsetTop + first.offsetHeight + 8) + 'px';
      $('#te-toast').classList.toggle('te-on', M.sent);
    },

    chapters: [
      {
        id: 'intro', title: 'Introduction', start: { scene: 'title' },
        lines: [
          'Sometimes the best place for a one-click button is right in the middle of a reply.',
          'With Klick-Zen, your agents can drop one into any ticket response, with just a click.'
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
        id: 'insert', title: 'Insert a button', step: 1,
        start: { scene: 'reply', reply: '', inserted: [], tail: '', rpFocus: false, rpCaret: false, pop: false, kzOn: false, linkTip: false, sent: false },
        lines: [
          'Write your reply in the Zendesk ticket editor as usual, and place your cursor where the button should go.',
          'Then click the Klick-Zen icon in the editor toolbar.',
          'A pop-up shows the buttons in your account, each one pictured just as it looks, so you pick by sight.',
          'Click one, and it lands right in your message, exactly as your customer will see it.'
        ],
        async run(h) {
          await h.beat(0, async () => {
            await h.move('#te-text', { fx: 0.3, fy: 0.3 });
            await h.click();
            h.set({ rpFocus: true, rpCaret: true });
            await h.type('reply', REPLY, { speed: 22 });
          });
          await h.beat(1, async () => {
            await h.cam('#te-reply', 1.35, 0.4, 0.75);
            h.ring('#te-kz', 4);
            await h.move('#te-kz');
            await h.click();
            h.ring(null);
            h.set({ kzOn: true, pop: true });
            await h.sleep(400);
          });
          await h.beat(2, async () => {
            h.ring('#te-picker', 6);
            await h.move('#te-opt-3', { fy: 1.6, ms: 900 });
            await h.sleep(500);
            await h.move('#te-opt-0', { ms: 900 });
            h.ring(null);
          });
          await h.beat(3, async () => {
            await h.click();
            h.set({ pop: false, kzOn: false, inserted: [0] });
            await h.sleep(300);
            h.ring('#te-btn-0', 8);
            await h.sleep(1600);
            h.ring(null);
          });
        }
      },

      {
        id: 'choice', title: 'Offer a choice', step: 2,
        start: { scene: 'reply', reply: REPLY, inserted: [0], tail: '', rpFocus: true, rpCaret: true, pop: false, kzOn: false, linkTip: false, sent: false },
        lines: [
          'Want to give your customer a choice? Add a second button right beside the first.',
          "Klick-Zen fills in this ticket's details as each button goes in, so every link is ready to go.",
          "Add a closing line, send your reply, and you're done."
        ],
        async run(h) {
          await h.beat(0, async () => {
            await h.cam('#te-reply', 1.35, 0.4, 0.75);
            await h.move('#te-kz');
            await h.click();
            h.set({ kzOn: true, pop: true });
            await h.sleep(300);
            await h.move('#te-opt-1');
            await h.click();
            h.set({ pop: false, kzOn: false, inserted: [0, 1] });
            await h.sleep(500);
          });
          await h.beat(1, async () => {
            await h.move('#te-btn-0', { fx: 0.6, fy: 0.7 });
            h.set({ linkTip: true });
            h.ring('#te-tip', 6);
            await h.sleep(2600);
            h.ring(null);
            h.set({ linkTip: false });
          });
          await h.beat(2, async () => {
            await h.type('tail', TAIL, { speed: 45 });
            h.set({ rpCaret: false });
            await h.camReset();
            await h.move('#te-submit');
            await h.click();
            h.set({ sent: true, rpFocus: false });
            await h.sleep(900);
          });
        }
      },

      {
        id: 'outro', title: 'Next steps', start: { scene: 'outro', sent: false },
        lines: [
          "It's perfect for the moments an automation won't catch: confirming a fix, gathering details, or offering next steps.",
          'Find Klick-Zen on the Zendesk Marketplace, and put one-click answers into every reply.'
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
