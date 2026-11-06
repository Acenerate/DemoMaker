/* How Klick-Zen Works: what Klick-Zen is, how a button gets from the app to an email, and what a click does. */
(function () {
  'use strict';

  const K = KZKit;
  const svg = (p, size = 20, stroke = 'currentColor') => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  const SHIELD = '<path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>';
  const BOLT = '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>';

  const MESSAGE = "Hi {{ticket.requester.first_name}},\n\nWe haven't heard back from you in a while. If everything is sorted, just click the button below and we'll close your ticket.\n\n";
  const STYLE = { label: 'Close Ticket', bg: K.GREEN, fg: '#ffffff', bold: true, round: 0.86 };
  const ACTIONS = [{ type: 'status', value: 'Solved' }, { type: 'tag', value: 'customer_confirmed' }];

  // What happens on a click: inbox -> Klick-Zen -> your Zendesk.
  const step = label => `<div class="hw-chk"><i>${K.CHECK(16)}</i>${label}</div>`;
  const flowScene = `
    <section class="scene hw-scene" data-scene="hw-flow"><div class="cam">
      <h3 class="hw-h">What happens when your customer clicks</h3>
      <div class="hw-node" id="hw-n-mail">
        <div class="hw-nh">Customer's inbox</div>
        <div class="hw-mfrom"><i>A</i><div><b>Acme Support</b><br><span style="color:#68737d;font-size:12.5px">Can we be of further help?</span></div></div>
        <p class="hw-mtext">All sorted? Just click below and we'll close your ticket.</p>
        <span class="hw-btnimg" id="hw-btn">Close Ticket</span>
      </div>
      <div class="hw-arrow" id="hw-a1"><div class="hw-line"></div><div class="hw-al">One click</div></div>
      <div class="hw-node" id="hw-n-kz">
        <div class="hw-nh">Klick-Zen</div>
        <div class="hw-nt">${svg(SHIELD, 26, '#e8a61b')}Applies your actions</div>
        <div id="hw-steps">${step('Set status to Solved')}${step('Add tag: customer_confirmed')}</div>
      </div>
      <div class="hw-arrow" id="hw-a2"><div class="hw-line"></div><div class="hw-al">Ticket update</div></div>
      <div class="hw-node" id="hw-n-zd">
        <div class="hw-nh">Your Zendesk</div>
        <div class="hw-nt">Ticket #4821</div>
        <div class="hw-tk">
          <div class="hw-tk-row"><i class="hw-badge" id="hw-badge">Open</i>Question about my invoice</div>
          <div class="hw-tags"><span class="hw-tag">billing</span><span class="hw-tag hw-new" id="hw-tag">customer_confirmed</span></div>
        </div>
        <div class="hw-trig" id="hw-trig">${svg(BOLT, 18, '#c2410c')}Your triggers and automations run as usual</div>
      </div>
      <div class="hw-guard" id="hw-guard">
        ${['One ticket per link', 'Only the actions you set', 'No customer login', 'Email scanners ignored'].map(t => `<div class="hw-g">${svg(SHIELD, 18, '#e8a61b')}${t}</div>`).join('')}
      </div>
    </div></section>`;

  // Starting model for the flow scene, so every chapter can be jumped to directly.
  const FLOW_START = { hwClick: false, hwDone: 0, hwApi: false, hwSolved: false, hwTrig: false, hwGuard: 0, hwGlow: null };
  const FLOW_DONE = { hwClick: true, hwDone: 2, hwApi: true, hwSolved: true, hwTrig: true, hwGuard: 0, hwGlow: null };

  KZWalkthrough.create({
    title: 'How Klick-Zen Works',
    subtitle: 'An animated walkthrough, about two minutes',
    logo: { light: '../../framework/assets/klick-zen-logo.png', dark: '../../framework/assets/klick-zen-logo-dark.png' },
    intro: { title: 'How Klick-Zen works', text: 'What Klick-Zen is, and what happens when your customer clicks.' },
    end: {
      title: 'One click. Ticket solved.',
      text: 'Ready to try it with your own customers?',
      link: { href: K.MARKETPLACE, label: 'Get Klick-Zen on the Zendesk Marketplace →' }
    },
    narration: { mode: 'audio' },
    tempo: 1.15,

    stage: [
      K.titleScene({
        headline: 'How <em>Klick-Zen</em> works.',
        lead: 'What Klick-Zen is, and what happens when your customer clicks.',
        card: { from: 'Acme Support', subject: 'Re: Question about my invoice', text: "All sorted? Just click below and we'll close your ticket.", button: 'Close Ticket', done: 'Ticket solved' }
      }),
      K.zendeskScene(),
      K.inboxScene(),
      flowScene,
      K.browserScene({ name: 'landing' }),
      K.outroScene({
        ideas: ['Close tickets in one click', 'Let customers route their own requests', 'Collect one-click CSAT ratings'],
        cta: { eyebrow: 'Available on the', big: 'Zendesk Marketplace', pill: 'klick-zen.com' }
      })
    ].join(''),

    state: Object.assign(K.defaults(), FLOW_START),

    render(M, api) {
      K.render(M, api);
      const $ = s => api.$(s);
      $('#hw-a1').classList.toggle('hw-live', M.hwClick);
      $('#hw-a2').classList.toggle('hw-live', M.hwApi);
      api.$$('.hw-chk').forEach((c, i) => c.classList.toggle('hw-on', i < M.hwDone));
      const badge = $('#hw-badge');
      badge.textContent = M.hwSolved ? 'Solved' : 'Open';
      badge.classList.toggle('hw-solved', M.hwSolved);
      $('#hw-tag').classList.toggle('hw-on', M.hwSolved);
      $('#hw-trig').classList.toggle('hw-on', M.hwTrig);
      ['mail', 'kz', 'zd'].forEach(n => $('#hw-n-' + n).classList.toggle('hw-glow', M.hwGlow === n));
      api.$$('.hw-g').forEach((g, i) => g.classList.toggle('hw-on', i < M.hwGuard));
    },

    chapters: [
      {
        id: 'intro', title: 'Introduction', start: { scene: 'title' },
        lines: [
          'What if your customers could update their support tickets with a single click, right from an email?',
          "That's Klick-Zen. Let's look at what it is, and how it works."
        ],
        async run(h) {
          await h.beat(0, async () => {
            h.set({ reveal: 0 });
            await h.sleep(2400);
            await h.move('#demo-btn', { ms: 900 });
            await h.click();
            h.set({ demoClicked: true });
            await h.sleep(600);
          });
          await h.beat(1, async () => {
            h.set({ reveal: 1 });
            await h.move('#demo-card', { fx: 1.15, fy: 1.2, ms: 900 });
          });
        }
      },

      {
        id: 'what', title: 'What Klick-Zen is', step: 1, start: { scene: 'zd', zdView: 'views', kzView: 'home' },
        lines: [
          'Klick-Zen is an app for Zendesk that adds one-click action buttons to your emails, agent replies, and Help Center.',
          "Each button does something useful to the ticket. Confirm it's resolved, route it to the right team, or approve a request.",
          'No login, no reply, and no trip to your support portal. Just one click.'
        ],
        async run(h) {
          await h.beat(0, async () => {
            await h.sleep(600);
            await h.move('#zd-app');
            await h.click();
            h.set({ zdView: 'kz', kzView: 'home' });
            await h.sleep(800);
            await h.move('.kz-welcome h3', { fx: 0.8, fy: 1.5, ms: 900 });
          });
          await h.beat(1, async () => {
            await h.cam('.kz-tpl', 1.35, 0.4, 0.5);
            h.ring('.kz-tpl', 10);
            await h.move('.kz-tpl', { fx: 0.3, fy: 0.15, ms: 800 });
            await h.sleep(1300);
            await h.move('.kz-tpl', { fx: 0.4, fy: 0.5, ms: 800 });
            await h.sleep(1300);
            await h.move('.kz-tpl', { fx: 0.3, fy: 0.85, ms: 800 });
            await h.sleep(900);
            h.ring(null);
          });
          await h.beat(2, async () => {
            await h.camReset();
            await h.move('#kz-create-main', { ms: 900 });
          });
        }
      },

      {
        id: 'build', title: 'Build a button', step: 2,
        start: { scene: 'zd', zdView: 'kz', kzView: 'editor', name: 'Close Ticket', label: 'Button Text', bg: '#c8c8c8', fg: '#00008b', bold: false, round: 0.47, actions: [], scroll: 0, caret: null, addDim: false, attention: false },
        lines: [
          'You build buttons right inside Zendesk. Choose the words, colors and style to match your brand.',
          'Then pick what it does when clicked: set the status, add a tag, post a comment, and more. One button can do several actions at once.'
        ],
        async run(h) {
          await h.beat(0, async () => {
            await h.cam('#fs-appearance', 1.6, 0.3, 0.5);
            await h.move('#kz-preview', { fx: 0.8 });
            await h.click();
            h.set({ caret: 'label' });
            await h.erase('label');
            await h.type('label', 'Close Ticket', { speed: 60 });
            h.set({ caret: null });
            await h.pickColor('#sw-bg', K.PALETTE, K.PALETTE.indexOf(K.GREEN));
            h.set({ bg: K.GREEN });
            await h.pickColor('#sw-fg', K.PALETTE, 0);
            h.set({ fg: '#ffffff' });
            await h.move('#tog-bold');
            await h.click();
            h.set({ bold: true, round: 0.86 });
          });
          await h.beat(1, async () => {
            await h.cam('#fs-actions', 1.3, 0.45, 0.2);
            await h.move('#kz-add');
            await h.click();
            h.set({ actions: [{ type: null }], addDim: true });
            await h.choose('#act-0-type', K.ACTIONS, 2);
            h.set({ actions: [{ type: 'status', value: '' }] });
            await h.choose('#act-0-val', K.STATUSES, 3);
            h.set({ actions: [ACTIONS[0]], addDim: false });
            await h.tween('scroll', 170, 600);   // scroll the editor so the new row stays in view
            await h.move('#kz-add');
            await h.click();
            h.set({ actions: [ACTIONS[0], { type: null }], addDim: true });
            await h.choose('#act-1-type', K.ACTIONS, 5);
            h.set({ actions: [ACTIONS[0], { type: 'tag', value: '' }], addDim: false, caret: 'act-1' });
            await h.move('#act-1-val', { fx: 0.2 });
            await h.type('actions.1.value', 'customer_confirmed', { speed: 40 });
            h.set({ caret: null });
            await h.sleep(500);
          });
        }
      },

      {
        id: 'send', title: 'Add it to your emails', step: 3,
        start: Object.assign({ scene: 'zd', zdView: 'kz', kzView: 'editor', name: 'Close Ticket', actions: ACTIONS, caret: null, scroll: 170, body: '', snippet: false, snippetSettled: false, trToast: false, toast: false, copied: false }, STYLE),
        lines: [
          "When it's ready, click Create, and Klick-Zen gives you a small snippet to copy.",
          'Paste it into a trigger, automation or macro, or drop a button straight into a reply from the ticket editor.',
          'Zendesk fills in the ticket details on every email, so each button knows exactly which ticket it belongs to.'
        ],
        async run(h) {
          await h.beat(0, async () => {
            await h.camReset();
            await h.tween('scroll', K.scrollTarget('#kz-save'), 900);
            await h.move('#kz-save');
            await h.click();
            h.set({ kzView: 'list', toast: true });
            await h.sleep(1000);
            h.set({ toast: false });
            await h.move('#kz-copy');
            await h.click();
            h.set({ copied: true });
            await h.sleep(400);
          });
          await h.beat(1, async () => {
            h.set({ copied: false });
            await h.move('#zd-admin');
            await h.click();
            h.set({ zdView: 'trigger' });
            await h.sleep(400);
            await h.cam('#tr-body', 1.32);
            await h.move('#tr-body', { fx: 0.3, fy: 0.25 });
            await h.click();
            h.set({ caret: 'body' });
            await h.type('body', MESSAGE, { speed: 6 });
            h.keycap('Ctrl+V');
            await h.sleep(300);
            h.set({ snippet: true, snippetSettled: false });
            await h.sleep(80);
            h.set({ snippetSettled: true });
            await h.sleep(500);
            h.keycap(false);
            h.set({ caret: null });
          });
          await h.beat(2, async () => {
            h.ring('#tr-body .pasted', 6);
            await h.move('#tr-body .pasted', { fx: 0.6, fy: 0.9, ms: 800 });
            await h.sleep(2600);
            h.ring(null);
            await h.camReset();
            await h.move('#tr-save');
            await h.click();
            h.set({ trToast: true });
            await h.sleep(700);
          });
        }
      },

      {
        id: 'click', title: 'The click', step: 4,
        start: Object.assign({ scene: 'inbox', zdView: 'trigger', body: MESSAGE, snippet: true, snippetSettled: true, trToast: false, actions: ACTIONS }, STYLE, FLOW_START),
        lines: [
          "Here's what your customer receives: a friendly message, and one clear button.",
          'When they click, Klick-Zen applies the actions you chose to their ticket, through its secure connection to your Zendesk.',
          "It's a normal ticket update, so your triggers and automations react just as they would to an agent's change."
        ],
        async run(h) {
          await h.beat(0, async () => {
            h.tag('Your customer');
            await h.cam('.mail-body', 1.3);
            await h.move('#mail-btn', { fy: 1.6, dx: 60 });
            h.ring('#mail-btn', 10);
            await h.sleep(1200);
          });
          await h.beat(1, async () => {
            await h.move('#mail-btn');
            h.ring(null);
            await h.click();
            h.tag(false);
            h.set({ scene: 'hw-flow', hwGlow: 'mail' });
            h.camReset('inbox', false);
            await h.move('#hw-btn', { ms: 700 });
            h.set({ hwClick: true, hwGlow: 'kz' });
            await h.sleep(900);
            h.set({ hwDone: 1 });
            await h.sleep(900);
            h.set({ hwDone: 2 });
            await h.sleep(700);
            h.set({ hwApi: true });
            await h.sleep(700);
            h.set({ hwSolved: true, hwGlow: 'zd' });
            await h.move('#hw-badge', { fx: 1.6, fy: 1.8, ms: 700 });
          });
          await h.beat(2, async () => {
            h.set({ hwTrig: true });
            await h.move('#hw-trig', { fx: 0.7, fy: 1.4, ms: 700 });
            h.ring('#hw-trig', 6);
            await h.sleep(2600);
            h.ring(null);
            h.set({ hwGlow: null });
          });
        }
      },

      {
        id: 'after', title: 'After the click',
        start: Object.assign({ scene: 'landing', zdView: 'ticket', ticketSolved: false }, STYLE, FLOW_DONE),
        lines: [
          'Your customer lands on a confirmation page with your logo, colors and message, hosted by Klick-Zen.',
          'And back in Zendesk, the ticket is already solved, with nothing left for your agents to do.'
        ],
        async run(h) {
          await h.beat(0, async () => {
            h.camReset('hw-flow', false);
            h.tag('Your customer');
            await h.move('.landing h1', { fx: 0.3, fy: 1.7, ms: 900 });
            await h.sleep(2400);
          });
          await h.beat(1, async () => {
            h.tag(false);
            h.camReset('zd', false);
            h.set({ scene: 'zd', zdView: 'ticket' });
            await h.sleep(900);
            await h.move('#tk-badge', { fx: 1.5, fy: 2.2 });
            h.set({ ticketSolved: true });
            h.ring('#tk-badge', 6);
            await h.sleep(1400);
            h.ring('#tk-evt', 6);
            await h.sleep(1400);
            h.ring(null);
          });
        }
      },

      {
        id: 'safe', title: 'Safe by design', step: 5,
        start: Object.assign({ scene: 'hw-flow', zdView: 'ticket', ticketSolved: true }, STYLE, FLOW_DONE),
        lines: [
          'Is it safe? Yes. Each link works only for its own ticket, and a click can only do what you set up.',
          "Customers never need to log in, and automated email scanners can't set a button off by accident."
        ],
        async run(h) {
          await h.beat(0, async () => {
            await h.move('#hw-guard', { fx: 0.3, fy: 1.6, ms: 800 });
            h.set({ hwGuard: 1 });
            await h.sleep(1500);
            h.set({ hwGuard: 2 });
            await h.sleep(1500);
          });
          await h.beat(1, async () => {
            h.set({ hwGuard: 3 });
            await h.move('#hw-guard', { fx: 0.7, fy: 1.6, ms: 800 });
            h.set({ hwGuard: 4 });
            h.ring('#hw-guard', 8);
            await h.sleep(2200);
            h.ring(null);
          });
        }
      },

      {
        id: 'outro', title: 'Next steps', start: { scene: 'outro' },
        lines: [
          'Faster resolutions, cleaner ticket data, and a customer experience that feels effortless.',
          'Find Klick-Zen on the Zendesk Marketplace, and give your customers a one-click way to get things done.'
        ],
        async run(h) {
          h.park();
          await h.beat(0, async () => {
            h.set({ reveal: 0 });
            await h.sleep(1500);
            h.set({ reveal: 1 });
          });
          await h.beat(1, () => h.set({ reveal: 2 }));
        }
      }
    ]
  });
})();
