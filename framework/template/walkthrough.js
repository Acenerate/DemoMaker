/*
 * Starter walkthrough. Copy this folder, rename it, and replace the scenes, lines and run() steps.
 * It shows both ways to build a scene:
 *   1. a custom scene: your own HTML in `stage`, drawn from the model in `render`
 *   2. kit scenes: ready-made Klick-Zen / Zendesk screens (KZKit.*Scene + KZKit.render)
 */
(function () {
  'use strict';

  const K = KZKit;

  // 1. A custom scene. Every scene is a <section class="scene" data-scene="name">; wrap the content in
  //    <div class="cam"> if you want to zoom the camera inside it.
  const customScene = `
    <section class="scene demo-scene" data-scene="custom"><div class="cam" style="display:grid;place-items:center">
      <div class="demo-panel">
        <h3>A custom screen</h3>
        <p>Anything you can build in HTML and CSS can be a scene.</p>
        <div class="demo-field" id="demo-field"></div>
        <span class="demo-go" id="demo-go">Save</span>
        <div class="demo-done" id="demo-done">Saved!</div>
      </div>
    </div></section>`;

  KZWalkthrough.create({
    title: 'Walkthrough template',
    subtitle: 'Copy this folder to start a new walkthrough',
    logo: { light: '../../framework/assets/klick-zen-logo.png', dark: '../../framework/assets/klick-zen-logo-dark.png' },
    intro: { title: 'Walkthrough template', text: 'A short demo of the building blocks.' },
    end: { title: 'That’s the template', text: 'Copy the folder and make it yours.' },
    narration: { mode: 'transcript' },   // timed captions; see README for voice options

    stage: [
      K.titleScene({ headline: 'Your walkthrough <em>title</em> goes here.', lead: 'A one-sentence promise of what the viewer will learn.' }),
      customScene,
      K.zendeskScene({ views: { views: false, trigger: false } }),
      K.outroScene({ headline: 'A closing <em>message</em>.', ideas: ['A next step', 'Another next step'], cta: { eyebrow: 'Available on the', big: 'Zendesk Marketplace', pill: 'klick-zen.com' } })
    ].join(''),

    // The model: everything that changes on screen. The kit's keys come from K.defaults().
    state: Object.assign(K.defaults(), { field: '', saved: false }),

    // Draw the model. Call the kit renderer, then update your own custom scene.
    render(M, api) {
      K.render(M, api);
      api.$('#demo-field').textContent = M.field;
      api.$('#demo-done').classList.toggle('on', M.saved);
    },

    chapters: [
      {
        id: 'intro', title: 'Introduction', start: { scene: 'title' },
        lines: ['This line is shown while the title card fades in.', 'Each line is one caption. The next one starts when this line and its animation have both finished.'],
        async run(h) {
          await h.beat(0, () => h.set({ reveal: 0 }));   // .reveal elements with data-r <= reveal fade in
          await h.beat(1, () => h.set({ reveal: 1 }));
        }
      },
      {
        id: 'custom', title: 'A custom scene', step: 1, start: { scene: 'custom', field: '', saved: false },
        lines: ['Move the cursor, click, and type into your own markup.', 'Then show the result.'],
        async run(h) {
          await h.beat(0, async () => {
            await h.move('#demo-field', { fx: 0.1 });
            await h.click();
            await h.type('field', 'Hello from the template');
          });
          await h.beat(1, async () => {
            await h.move('#demo-go');
            await h.click();
            h.set({ saved: true });
            h.ring('#demo-done', 6);
            await h.sleep(1200);
            h.ring(null);
          });
        }
      },
      {
        id: 'kit', title: 'Kit screens', step: 2, start: { scene: 'zd', zdView: 'kz', kzView: 'editor', name: 'My Button' },
        lines: ['Kit screens are ready-made. Zoom in, pick from dropdowns, and update the model.', 'Highlight what matters with a ring.'],
        async run(h) {
          await h.beat(0, async () => {
            await h.cam('#fs-actions', 1.4, 0.4, 0.2);   // inside the beat, so it doesn't play in silence
            await h.move('#kz-add');
            await h.click();
            h.set({ actions: [{ type: null }], addDim: true });
            await h.choose('#act-0-type', K.ACTIONS, 2);
            h.set({ actions: [{ type: 'status', value: '' }], addDim: false });
            await h.choose('#act-0-val', K.STATUSES, 3);
            h.update('actions.0.value', 'Solved');
          });
          await h.beat(1, async () => {
            h.ring('#act-0-val', 6);
            await h.sleep(1500);
            h.ring(null);
          });
        }
      },
      {
        id: 'outro', title: 'Wrap up', start: { scene: 'outro' },
        lines: ['Finish on a clear next step.'],
        async run(h) {
          h.park();
          await h.beat(0, () => h.set({ reveal: 2 }));
        }
      }
    ]
  });
})();
