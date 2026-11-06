/* How do I create a one-click CSAT? Rating buttons in the solve email, recorded on the ticket. */
(function () {
  'use strict';

  const K = KZKit;
  const DARK = '#1f2a37';
  const FIELDS = ['Order number', 'csat_rating', 'Product'];
  const MESSAGE = "Hi {{ticket.requester.first_name}},\n\nYour ticket has been solved. How did we do? Just click one:\n\n";

  // The finished buttons, used as chapter start states.
  const GOOD = { name: 'CSAT Good', label: 'Great', bg: K.GREEN, fg: '#ffffff', bold: true, round: 0.86 };
  const GOOD_ACTIONS = [{ type: 'tag', value: 'csat_good' }, { type: 'field', field: 'csat_rating', value: 'good' }];
  const BAD = { name: 'CSAT Bad', label: 'Not so good', bg: DARK, fg: '#ffffff', bold: true, round: 0.86 };

  const btn = (label, bg) => `<span class="cs-btn" style="background:${bg}">${label}</span>`;
  const opt = (label, bg, tag) => `<div class="cs-opt">${btn(label, bg)}<span class="cs-tagpill">${tag}</span></div>`;

  // Two ways to build it: Good / Bad, or a 5-point scale.
  const scalesScene = `
    <section class="scene cs-scene" data-scene="scales"><div class="cam">
      <h3 class="cs-h" id="cs-scales-h">Pick the scale that fits</h3>
      <p class="cs-sub" id="cs-scales-sub">Every button records its rating on the ticket, as a tag and a custom field.</p>
      <div class="cs-panels">
        <div class="cs-panel" id="cs-simple"><h4>Simple: Good / Bad</h4><p>Two buttons, side by side.</p>
          ${opt('Great', K.GREEN, 'csat_good')}${opt('Not so good', DARK, 'csat_bad')}</div>
        <div class="cs-panel" id="cs-granular"><h4>Granular: 5-point scale</h4><p>Five buttons, as numbers or phrases.</p>
          ${opt('1 - Very bad', '#b91c1c', 'csat_1')}${opt('2 - Bad', '#c2410c', 'csat_2')}${opt('3 - OK', '#f59e0b', 'csat_3')}${opt('4 - Good', '#127566', 'csat_4')}${opt('5 - Great', K.GREEN, 'csat_5')}</div>
      </div>
    </div></section>`;

  // A bad rating fires a follow-up Zendesk trigger.
  const ACTS = [
    ['&#8635;', 'Status &rarr; <b>Open</b>'],
    ['!', 'Priority &rarr; <b>High</b>'],
    ['@', 'Notify <b>team lead</b>'],
    ['&#9993;', 'Email requester: <b>&ldquo;A senior agent is reviewing your ticket&rdquo;</b>']
  ];
  const loopScene = `
    <section class="scene cs-scene" data-scene="loop"><div class="cam">
      <h3 class="cs-h">Close the loop automatically</h3>
      <p class="cs-sub">The rating tag is an ordinary ticket update, so your Zendesk triggers react to it.</p>
      <div class="cs-flow">
        <div class="cs-click" id="cs-click"><small>Customer clicked</small>${btn('Not so good', DARK)}<br><span class="cs-tagpill">Tag added: csat_bad</span></div>
        <div class="cs-arrow" id="cs-arrow"></div>
        <div class="cs-trig" id="cs-trig">
          <div class="cs-trig-head">Trigger: CSAT bad rating recovery <span>Zendesk</span></div>
          <div class="cs-trig-body">
            <h5>Conditions</h5>
            <div class="cs-cond"><div>Tags</div><div>Contains at least one of the following</div><div><b>csat_bad</b></div></div>
            <h5>Actions</h5>
            ${ACTS.map((a, i) => `<div class="cs-act" id="cs-act-${i}"><i>${a[0]}</i><span>${a[1]}</span></div>`).join('')}
          </div>
        </div>
      </div>
      <div class="cs-banner" id="cs-banner">A bad rating becomes a <em>recovery</em>, within seconds</div>
    </div></section>`;

  KZWalkthrough.create({
    title: 'How do I create a one-click CSAT?',
    subtitle: 'An animated walkthrough, about two minutes',
    logo: { light: '../../framework/assets/klick-zen-logo.png', dark: '../../framework/assets/klick-zen-logo-dark.png' },
    intro: { title: 'A one-click CSAT survey', text: 'Put rating buttons right in the email, and record every answer on the ticket.' },
    end: {
      title: 'One click. Survey done.',
      text: 'Ready to hear from more of your customers?',
      link: { href: K.MARKETPLACE, label: 'Get Klick-Zen on the Zendesk Marketplace →' }
    },
    narration: { mode: 'audio' },
    captions: false,
    tempo: 1.15,

    stage: [
      K.titleScene({
        headline: 'A satisfaction survey in <em>one click.</em>',
        lead: 'Put the rating buttons right in the email, and record every answer on the ticket.',
        card: { from: 'Acme Support', subject: 'Your ticket has been solved', text: 'How did we do? Just click one.', button: 'Great', done: 'Thanks for rating!' }
      }),
      K.zendeskScene({
        trigger: { title: 'Notify requester: ticket solved', subject: 'How did we do?' },
        ticket: { tags: ['billing'], event: 'Jordan Lee clicked <b>Great</b> &middot; Tag added: csat_good &middot; csat_rating: good' }
      }),
      scalesScene,
      K.inboxScene({ subject: 'How did we do?', paragraphs: ['Hi Jordan,', 'Your ticket has been solved. How did we do? Just click one:'] }),
      K.browserScene({
        name: 'landing',
        body: K.landingPage({
          heading: 'Thanks for your feedback!', subheading: 'Your rating has been recorded',
          paragraphs: ['Every rating goes straight to our support team, and helps us keep improving.', '<b>There’s nothing more you need to do</b> - you can safely close this window.']
        })
      }),
      loopScene,
      K.outroScene({
        headline: 'One click.<br><em>Survey done.</em>',
        ideas: ['Your wording, colors and scale', 'In any trigger, macro or reply', 'Ratings you can report on in Explore'],
        cta: { eyebrow: 'Available on the', big: 'Zendesk Marketplace', pill: 'klick-zen.com' }
      })
    ].join(''),

    state: Object.assign(K.defaults(), { csScale: false, csRated: false, csLoop: 0 }),

    render(M, api) {
      K.render(M, api);
      const $ = s => api.$(s);
      $('#cs-granular').classList.toggle('cs-on', M.csScale);

      // title card: a second rating button beside the kit's (added once)
      if (!$('#cs-demo-bad')) $('#demo-btn').insertAdjacentHTML('afterend', '<span class="cs-demo-bad" id="cs-demo-bad">Not so good</span>');

      // inbox: a second rating button beside the kit's (added once)
      if (!$('#cs-mail-bad')) $('#mail-btn').insertAdjacentHTML('afterend', '<span class="cs-mail-bad" id="cs-mail-bad">Not so good</span>');

      // ticket: the rating appears as a new tag and a custom field (added once)
      const props = $('#zd-ticket .tk-props');
      if (!$('#cs-rating')) {
        props.lastElementChild.querySelector('.tr-in').insertAdjacentHTML('beforeend', '<span class="cs-newtag" id="cs-tag">csat_good</span>');
        props.insertAdjacentHTML('beforeend', '<div id="cs-rating"><label>csat_rating</label><div class="cs-in" id="cs-rating-val">-</div></div>');
      }
      props.classList.toggle('cs-rated', M.csRated);
      $('#cs-rating-val').textContent = M.csRated ? 'good' : '-';

      // close the loop
      $('#cs-click').classList.toggle('cs-on', M.csLoop >= 1);
      $('#cs-arrow').classList.toggle('cs-on', M.csLoop >= 1);
      ACTS.forEach((a, i) => $('#cs-act-' + i).classList.toggle('cs-on', M.csLoop >= i + 2));
      $('#cs-banner').classList.toggle('cs-on', M.csLoop >= 6);
    },

    chapters: [
      {
        id: 'intro', title: 'Introduction', start: { scene: 'title' },
        lines: [
          'Most satisfaction surveys lose people at the click-through: open a link, wait for a page, then fill out a form.',
          'With Klick-Zen, the rating buttons sit right in the email, so a single click is the entire survey.'
        ],
        async run(h) {
          await h.beat(0, async () => {
            h.set({ reveal: 0 });
            await h.sleep(4200);
            await h.move('#demo-btn', { ms: 900 });
          });
          await h.beat(1, async () => {
            await h.click();
            h.set({ demoClicked: true, reveal: 1 });
            await h.sleep(1200);
            await h.move('#demo-card', { fx: 1.15, fy: 1.2, ms: 900 });
          });
        }
      },

      {
        id: 'good', title: 'Build the "Great" button', step: 1,
        start: { scene: 'zd', zdView: 'kz', kzView: 'home', demoClicked: false },
        lines: [
          'Start with a button for happy customers. In Klick-Zen, click Create new button, and name it CSAT Good.',
          'Type its label right on the button: Great. Then give it a friendly green.',
          'Now the actions. Click Add button action, choose Add Ticket Tag, and enter csat_good.',
          'Add a second action, Update Ticket Field, to set a csat_rating custom field to good. Then click Create.'
        ],
        async run(h) {
          await h.beat(0, async () => {
            h.ring('#kz-create');
            await h.move('#kz-create-main');
            await h.click();
            h.ring(null);
            h.set({ kzView: 'editor', scroll: 0 });
            await h.sleep(500);
            await h.cam('#kz-name', 1.55);
            await h.move('#kz-name', { fx: 0.4 });
            await h.click();
            h.set({ caret: 'name', name: '' });
            await h.type('name', 'CSAT Good', { speed: 70 });
            h.set({ caret: null });
          });
          await h.beat(1, async () => {
            await h.cam('#fs-appearance', 1.6, 0.3, 0.5);
            await h.move('#kz-preview', { fx: 0.8 });
            await h.click();
            h.set({ caret: 'label', label: '' });
            await h.type('label', 'Great', { speed: 90 });
            h.set({ caret: null });
            await h.pickColor('#sw-bg', K.PALETTE, K.PALETTE.indexOf(K.GREEN));
            h.set({ bg: K.GREEN, fg: '#ffffff', bold: true, round: 0.86 });
            await h.sleep(300);
          });
          await h.beat(2, async () => {
            await h.cam('#fs-actions', 1.3, 0.45, 0.2);
            await h.move('#kz-add');
            await h.click();
            h.set({ actions: [{ type: null }], addDim: true });
            await h.sleep(250);
            await h.choose('#act-0-type', K.ACTIONS, 5);
            h.set({ actions: [{ type: 'tag', value: '' }], caret: 'act-0' });
            await h.move('#act-0-val', { fx: 0.2 });
            await h.type('actions.0.value', 'csat_good', { speed: 50 });
            h.set({ caret: null, addDim: false });
          });
          await h.beat(3, async () => {
            await h.tween('scroll', 150, 500);   // keep the new row in view
            await h.move('#kz-add');
            await h.click();
            h.set({ actions: [h.M.actions[0], { type: null }], addDim: true });
            await h.sleep(250);
            await h.choose('#act-1-type', K.ACTIONS, 1);
            h.set({ actions: [h.M.actions[0], { type: 'field', field: '', value: '' }] });
            await h.choose('#act-1-field', FIELDS, 1);
            h.update('actions.1.field', 'csat_rating');
            h.set({ caret: 'act-1' });
            await h.move('#act-1-val', { fx: 0.2 });
            await h.type('actions.1.value', 'good', { speed: 60 });
            h.set({ caret: null, addDim: false });
            await h.camReset();
            await h.tween('scroll', K.scrollTarget('#kz-save'), 700);
            await h.move('#kz-save');
            await h.click();
            h.set({ kzView: 'list', toast: true });
            await h.sleep(900);
          });
        }
      },

      {
        id: 'bad', title: 'Add a "Not so good" button', step: 2,
        start: Object.assign({ scene: 'zd', zdView: 'kz', kzView: 'editor', actions: [], scroll: 0, toast: false }, BAD),
        lines: [
          'Then build its partner, Not so good. It adds the tag csat_bad, and sets csat_rating to bad.',
          'It also sets the ticket status back to Open, so an unhappy customer gets attention straight away. Click Create.'
        ],
        async run(h) {
          await h.beat(0, async () => {
            h.set(Object.assign({ kzView: 'editor', actions: [], scroll: 0, toast: false }, BAD));
            await h.cam('#fs-actions', 1.3, 0.45, 0.2);
            await h.move('#kz-add');
            await h.click();
            h.set({ actions: [{ type: 'tag', value: '' }], caret: 'act-0' });
            await h.type('actions.0.value', 'csat_bad', { speed: 45 });
            await h.tween('scroll', 150, 450);
            await h.move('#kz-add');
            await h.click();
            h.set({ actions: [h.M.actions[0], { type: 'field', field: 'csat_rating', value: '' }], caret: 'act-1' });
            await h.type('actions.1.value', 'bad', { speed: 60 });
            h.set({ caret: null });
          });
          await h.beat(1, async () => {
            await h.tween('scroll', 290, 600);
            await h.move('#kz-add');
            await h.click();
            h.set({ actions: [...h.M.actions, { type: null }], addDim: true });
            await h.sleep(200);
            await h.choose('#act-2-type', K.ACTIONS, 2);
            h.set({ actions: [h.M.actions[0], h.M.actions[1], { type: 'status', value: '' }] });
            await h.choose('#act-2-val', K.STATUSES, 0);
            h.set({ actions: [h.M.actions[0], h.M.actions[1], { type: 'status', value: 'Open' }], addDim: false });
            h.ring('#act-2-val', 6);
            await h.sleep(700);
            h.ring(null);
            await h.camReset();
            await h.tween('scroll', K.scrollTarget('#kz-save'), 600);
            await h.move('#kz-save');
            await h.click();
            h.set({ kzView: 'list', toast: true });
            await h.sleep(700);
          });
        }
      },

      {
        id: 'scales', title: 'Pick your scale',
        start: { scene: 'scales', csScale: false, toast: false },
        lines: [
          "That's the simple version: two buttons, good or bad.",
          'Want more detail? Build five buttons instead, from 1, Very bad, to 5, Great, each with its own rating and tag.'
        ],
        async run(h) {
          await h.beat(0, async () => {
            h.set({ scene: 'scales', csScale: false, toast: false });
            h.camReset('zd', false);
            await h.move('#cs-simple', { fx: 0.5, fy: 1.08, ms: 800 });
            h.ring('#cs-simple', 8);
            await h.sleep(1600);
            h.ring(null);
          });
          await h.beat(1, async () => {
            h.set({ csScale: true });
            await h.sleep(600);
            await h.move('#cs-granular', { fx: 0.5, fy: 1.06, ms: 900 });
            h.ring('#cs-granular', 8);
            await h.sleep(4000);
            h.ring(null);
          });
        }
      },

      {
        id: 'email', title: 'Add them to the solve email', step: 3,
        start: { scene: 'zd', zdView: 'views', kzView: 'list', body: '', snippet: false, snippetSettled: false, trToast: false, csScale: true },
        lines: [
          'Put the buttons in the email that goes out when a ticket is solved. That can be a trigger email, or part of your solve macro.',
          'Write a short question, then paste the two snippets side by side.',
          'Save the trigger, and your survey is live.'
        ],
        async run(h) {
          await h.beat(0, async () => {
            h.set({ scene: 'zd', zdView: 'views', toast: false });
            await h.sleep(900);
            await h.move('#zd-admin');
            await h.click();
            h.set({ zdView: 'trigger' });
            await h.sleep(800);
            h.ring('#tr-body', 6);
            await h.sleep(2400);
            h.ring(null);
          });
          await h.beat(1, async () => {
            await h.cam('#tr-body', 1.3);
            await h.move('#tr-body', { fx: 0.3, fy: 0.2 });
            await h.click();
            h.set({ caret: 'body' });
            await h.type('body', MESSAGE, { speed: 7 });
            h.keycap('Ctrl+V');
            h.set({ snippet: true, snippetSettled: false });
            await h.sleep(80);
            h.set({ snippetSettled: true });
            await h.sleep(800);
            h.set({ body: MESSAGE + K.SNIPPET + ' ', snippetSettled: false });
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
        start: Object.assign({ scene: 'inbox', zdView: 'trigger', body: MESSAGE + K.SNIPPET + ' ', snippet: true, snippetSettled: true, trToast: false, ticketSolved: false, csRated: false }, GOOD),
        lines: [
          'Your customer gets one simple question, and two buttons.',
          "One click on Great, and they land on your branded thank-you page. That's the whole survey.",
          'Back in Zendesk, the rating is already on the ticket, as a tag and a custom field, ready to report on in Zendesk Explore.'
        ],
        async run(h) {
          await h.beat(0, async () => {
            h.set(Object.assign({ scene: 'inbox', trToast: false }, GOOD));
            h.tag('Your customer');
            await h.cam('.mail-body', 1.3);
            await h.move('#mail-btn', { fy: 1.6, dx: 80 });
            h.ring('.mail-body p:nth-child(3)', 10);
            await h.sleep(900);
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
            h.set({ ticketSolved: true, csRated: true });
            await h.move('#tk-evt', { fx: 0.5, fy: 1.8 });
            h.ring('#tk-evt', 6);
            await h.sleep(1800);
            h.ring('#cs-tag', 5);
            await h.move('#cs-tag', { fx: 1.2, fy: 1.4 });
            await h.sleep(1300);
            h.ring('#cs-rating-val', 5);
            await h.move('#cs-rating-val', { fx: 0.8, fy: 1.3 });
            await h.sleep(1500);
            h.ring(null);
          });
        }
      },

      {
        id: 'loop', title: 'Close the loop on bad ratings', step: 4,
        start: { scene: 'loop', csLoop: 0 },
        lines: [
          "Here's where it gets powerful. Because the rating is a tag, your Zendesk triggers can act on it instantly.",
          'When csat_bad is added, a trigger can reopen the ticket, raise the priority to High, alert a team lead, and tell the customer a senior agent is on it.',
          'A poor rating stops being a number in a dashboard, and becomes a recovery that starts within seconds.'
        ],
        async run(h) {
          await h.beat(0, async () => {
            h.set({ scene: 'loop', csLoop: 0 });
            await h.sleep(900);
            await h.move('#cs-click .cs-btn');
            await h.click();
            h.set({ csLoop: 1 });
            await h.sleep(1200);
            await h.move('.cs-cond', { fx: 0.8, fy: 1.4, ms: 900 });
            h.ring('.cs-cond', 6);
            await h.sleep(1600);
            h.ring(null);
          });
          await h.beat(1, async () => {
            for (let i = 0; i < ACTS.length; i++) {
              h.set({ csLoop: i + 2 });
              await h.move('#cs-act-' + i, { fx: 0.9, fy: 0.5, ms: 600 });
              await h.sleep(1700);
            }
          });
          await h.beat(2, async () => {
            h.set({ csLoop: 6 });
            await h.move('#cs-banner', { fx: 1.05, fy: 1.4, ms: 900 });
            h.ring('#cs-banner', 8);
            await h.sleep(2400);
            h.ring(null);
          });
        }
      },

      {
        id: 'outro', title: 'Next steps', start: { scene: 'outro' },
        lines: [
          "Compared with Zendesk's built-in survey, you choose the wording, the look, the scale, and where it appears.",
          "Use it in any trigger, macro, or reply, even where native satisfaction surveys aren't available.",
          'Find Klick-Zen on the Zendesk Marketplace, and make your next survey a single click.'
        ],
        async run(h) {
          h.park();
          await h.beat(0, async () => {
            h.set({ reveal: 0 });
            await h.sleep(900);
            h.set({ reveal: 1 });
          });
          await h.beat(1, () => {});
          await h.beat(2, () => h.set({ reveal: 2 }));
        }
      }
    ]
  });
})();
