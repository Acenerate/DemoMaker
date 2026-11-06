/* Quick Start: build a Close Ticket button and put it in a trigger email. */
(function () {
  'use strict';

  const K = KZKit;
  const MESSAGE = "Hi {{ticket.requester.first_name}},\n\nWe haven't heard back from you in a while. If everything is sorted, just click the button below and we'll close your ticket.\n\n";

  KZWalkthrough.create({
    title: 'Quick Start: your first one-click button',
    subtitle: 'An animated walkthrough, under three minutes',
    logo: { light: '../../framework/assets/klick-zen-logo.png', dark: '../../framework/assets/klick-zen-logo-dark.png' },
    intro: { title: 'Your first one-click button', text: 'Watch a Close Ticket button go from idea to inbox.' },
    end: {
      title: 'One click. Ticket solved.',
      text: 'Ready to try it with your own customers?',
      link: { href: K.MARKETPLACE, label: 'Get Klick-Zen on the Zendesk Marketplace →' }
    },
    narration: { mode: 'audio' },          // vo/<line id>.mp3, made by tools/make-voiceover.js
    captions: false,
    tempo: 1.15,                          // overall speed; viewers' speed button multiplies on top

    stage: [
      K.titleScene({
        lead: 'Build your first Klick-Zen button and drop it into a Zendesk email, in about two minutes.',
        card: { from: 'Acme Support', subject: 'Re: Question about my invoice', text: "All sorted? Just click below and we'll close your ticket. No reply needed.", button: 'Close Ticket', done: 'Ticket solved' }
      }),
      K.zendeskScene(),
      K.inboxScene(),
      K.browserScene({ name: 'landing' }),
      K.outroScene({
        ideas: ['Offer a "Still need help" choice', 'Make buttons single use', 'Follow up with a one-click CSAT'],
        cta: { eyebrow: 'Available on the', big: 'Zendesk Marketplace', pill: 'klick-zen.com' }
      })
    ].join(''),

    state: K.defaults(),
    render: K.render,

    chapters: [
      {
        id: 'intro', title: 'Introduction', start: { scene: 'title' },
        lines: [
          'What if your customers could close their own support tickets with a single click? No reply, no login, no back and forth.',
          "That's Klick-Zen. In the next couple of minutes, we'll build a Close Ticket button and put it into a real Zendesk email."
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
        id: 'open', title: 'Start a new button', step: 1, start: { scene: 'zd', zdView: 'views', kzView: 'home' },
        lines: [
          'Klick-Zen lives right inside Zendesk. Open it from the sidebar',
          'Under Available KlickButtons, click "Create new button".',
          "First, give it an internal name, so your team can find it later. We'll call this one Ticket Close."
        ],
        async run(h) {
          await h.beat(0, async () => {
            await h.sleep(300);
            await h.move('#zd-app');
            await h.click();
            h.set({ zdView: 'kz', kzView: 'home' });
            await h.sleep(700);
          });
          await h.beat(1, async () => {
            await h.move('#kz-nav-available');
            await h.sleep(200);
            h.ring('#kz-create');
            await h.move('#kz-create-main');
            await h.click();
            h.ring(null);
            h.set({ kzView: 'editor', scroll: 0 });
            await h.sleep(500);
          });
          await h.beat(2, async () => {
            await h.cam('#kz-name', 1.55);
            await h.move('#kz-name', { fx: 0.4 });
            await h.click();
            h.set({ nameSel: true });
            await h.sleep(500);
            h.set({ nameSel: false, caret: 'name', name: '' });
            await h.type('name', 'Ticket Close');
            await h.sleep(400);
            h.set({ caret: null });
          });
        }
      },

      {
        id: 'label', title: 'Label the button', step: 2, start: { scene: 'zd', zdView: 'kz', kzView: 'editor', name: 'Ticket Close' },
        lines: [
          'Now for the words your customer will see. Just type right on the button.',
          'Close Ticket. Short, clear, and it says exactly what will happen.'
        ],
        async run(h) {
          await h.beat(0, async () => {
            await h.cam('#fs-appearance', 1.6, 0.3, 0.5);
            await h.move('#kz-preview', { fx: 0.8 });
            await h.click();
            h.set({ caret: 'label' });
            await h.sleep(250);
            await h.erase('label');
          });
          await h.beat(1, async () => {
            await h.type('label', 'Close Ticket', { speed: 75 });
            await h.sleep(500);
            h.set({ caret: null });
          });
        }
      },

      {
        id: 'style', title: 'Make it yours', step: 3, start: { label: 'Close Ticket' },
        lines: [
          "It already works, but let's make it look the part. A friendly green background,",
          'white text, bold lettering, and softer corners.',
          'Klick-Zen hosts the button image for you, so it looks exactly like this in every email client.'
        ],
        async run(h) {
          await h.beat(0, async () => {
            await h.cam('#fs-appearance', 1.6, 0.3, 0.5);
            await h.sleep(150);
            await h.pickColor('#sw-bg', K.PALETTE, K.PALETTE.indexOf(K.GREEN));
            h.set({ bg: K.GREEN });
            await h.sleep(450);
          });
          await h.beat(1, async () => {
            await h.pickColor('#sw-fg', K.PALETTE, 0);
            h.set({ fg: '#ffffff' });
            await h.sleep(200);
            await h.move('#tog-bold');
            await h.click();
            h.set({ bold: true });
            await h.sleep(150);
            await h.move('#slider-thumb');
            await h.drag('#slider', 'round', 0.86, 650);
          });
          await h.beat(2, async () => {
            await h.move('#kz-preview', { fx: 1.3, fy: 1.6, ms: 700 });
            h.ring('#kz-preview', 10);
            await h.sleep(2600);
            h.ring(null);
          });
        }
      },

      {
        id: 'action', title: 'Choose what it does', step: 4, start: { bg: K.GREEN, fg: '#ffffff', bold: true, round: 0.86 },
        lines: [
          'Next, tell the button what to do. Click Add button action, and choose Set Ticket Status.',
          "Set the new status to Solved. That's the whole workflow.",
          'Does your Zendesk require an assignee before a ticket can be solved? Add one here, and turn on If Blank, so existing assignments stay untouched.'
        ],
        async run(h) {
          await h.beat(0, async () => {
            await h.cam('#fs-actions', 1.3, 0.45, 0.2);
            await h.move('#kz-add');
            await h.click();
            h.set({ actions: [{ type: null }], addDim: true });
            await h.sleep(350);
            await h.choose('#act-0-type', K.ACTIONS, 2);
            h.set({ actions: [{ type: 'status', value: '' }] });
            await h.sleep(300);
          });
          await h.beat(1, async () => {
            await h.choose('#act-0-val', K.STATUSES, 3);
            h.set({ actions: [{ type: 'status', value: 'Solved' }], addDim: false });
            await h.sleep(200);
            h.ring('#act-0-val', 6);
            await h.sleep(1200);
            h.ring(null);
          });
          await h.beat(2, async () => {
            h.set({ attention: true });
            await h.sleep(900);
            await h.tween('scroll', 190, 800);   // scroll the editor so the new row stays in view
            await h.move('#kz-add');
            await h.click();
            h.set({ actions: [...h.M.actions, { type: null }], addDim: true });
            await h.sleep(300);
            await h.choose('#act-1-type', K.ACTIONS, 6);
            h.set({ actions: [h.M.actions[0], { type: 'assignee', value: '', ifBlank: false }], addDim: false, caret: 'assignee' });
            await h.move('#act-1-val', { fx: 0.2 });
            await h.type('actions.1.value', 'super.agent@acme.com', { speed: 38 });
            h.set({ caret: null });
            await h.move('#act-1-blank');
            await h.click();
            h.update('actions.1.ifBlank', true);
            await h.sleep(400);
          });
        }
      },

      {
        id: 'save', title: 'Save it', step: 5,
        start: { actions: [{ type: 'status', value: 'Solved' }, { type: 'assignee', value: 'super.agent@acme.com', ifBlank: true }], attention: true },
        lines: [
          'Click Create. Klick-Zen saves your button and generates a ready-to-paste snippet.',
          'Copy it with one click.'
        ],
        async run(h) {
          await h.beat(0, async () => {
            await h.camReset();
            await h.tween('scroll', K.scrollTarget('#kz-save'), 1300);
            h.ring('#kz-save', 6);
            await h.move('#kz-save');
            await h.click();
            h.ring(null);
            h.set({ kzView: 'list', toast: true });
            await h.sleep(2400);
            h.set({ toast: false });
          });
          await h.beat(1, async () => {
            await h.cam('#kz-card', 1.35);
            await h.move('#kz-copy');
            await h.click();
            h.set({ copied: true });
            await h.sleep(400);
          });
        }
      },

      {
        id: 'email', title: 'Add it to an email', step: 6, start: { kzView: 'list', copied: true },
        lines: [
          'Now put it where your customers will see it. In Zendesk, open a trigger that emails the requester.',
          'Write your message, then paste the snippet right below it.',
          "Save the trigger, and you're live."
        ],
        async run(h) {
          await h.beat(0, async () => {
            await h.camReset();
            h.set({ copied: false });
            await h.move('#zd-admin');
            await h.click();
            h.set({ zdView: 'trigger' });
            await h.sleep(600);
            h.ring('#tr-body', 6);
            await h.sleep(1400);
            h.ring(null);
          });
          await h.beat(1, async () => {
            await h.cam('#tr-body', 1.32);
            await h.move('#tr-body', { fx: 0.3, fy: 0.25 });
            await h.click();
            h.set({ caret: 'body' });
            await h.type('body', MESSAGE, { speed: 7 });
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
            await h.camReset();
            await h.move('#tr-save');
            await h.click();
            h.set({ trToast: true });
            await h.sleep(700);
          });
        }
      },

      {
        id: 'result', title: 'What your customer sees',
        start: { scene: 'inbox', zdView: 'trigger', copied: false, body: MESSAGE, snippet: true, snippetSettled: true, trToast: false },
        lines: [
          "Here's what your customer receives. A friendly message, and one obvious button.",
          'One click, and they land on a confirmation page. Nothing else to do.',
          'And back in Zendesk, the ticket is already solved. No reply to read, and no agent time spent.'
        ],
        async run(h) {
          await h.beat(0, async () => {
            h.tag('Your customer');
            await h.cam('.mail-body', 1.3);
            await h.move('#mail-btn', { fy: 1.6, dx: 60 });
            h.ring('#mail-btn', 10);
            await h.sleep(1300);
          });
          await h.beat(1, async () => {
            await h.move('#mail-btn');
            h.ring(null);
            await h.click();
            h.set({ scene: 'landing' });
            await h.sleep(400);
            await h.move('.landing h1', { fx: 0.9, fy: 2.4, ms: 900 });
          });
          await h.beat(2, async () => {
            h.tag(false);
            h.set({ scene: 'zd', zdView: 'ticket' });
            h.camReset('inbox', false);
            await h.sleep(1200);
            await h.move('#tk-badge', { fx: 1.5, fy: 2.2 });
            h.set({ ticketSolved: true });
            h.ring('#tk-badge', 6);
            await h.sleep(1600);
            h.ring('#tk-evt', 6);
            await h.sleep(1600);
            h.ring(null);
          });
        }
      },

      {
        id: 'outro', title: 'Next steps', start: { scene: 'outro' },
        lines: [
          "That's your first Klick-Zen button, built in minutes.",
          'From here, you can offer a Still need help choice, make buttons single use, or follow up with a one-click satisfaction survey.',
          'Find Klick-Zen on the Zendesk Marketplace, and let your customers close the loop with a single click.'
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
