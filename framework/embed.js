/*
 * Walkthrough embeds: sizes each walkthrough iframe (src ending in ?embed) to the height of its
 * content, so the captions, controls and transcript are never cut off or followed by empty space,
 * and tells it whether the page behind it is light or dark so its colours match (unless the embed
 * code pins a theme). Add it once to any page that embeds walkthroughs:
 *   <script src="/framework/embed.js" async></script>
 * Without it the iframe keeps the height its style gives it (the admin's embed code sets a sensible
 * aspect ratio) and follows the visitor's light/dark setting, so an embed still works.
 */
(function () {
  'use strict';
  if (window.__kzWalkthroughEmbed) return;
  window.__kzWalkthroughEmbed = true;

  // Light or dark, from the first solid background behind the iframe.
  function themeBehind(el) {
    for (el = el && el.parentElement; el; el = el.parentElement) {
      var m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/.exec(getComputedStyle(el).backgroundColor);
      if (!m || (m[4] !== undefined && +m[4] < 0.5)) continue;
      return (0.2126 * m[1] + 0.7152 * m[2] + 0.0722 * m[3]) / 255 < 0.45 ? 'dark' : 'light';
    }
    return getComputedStyle(document.documentElement).colorScheme === 'dark' ? 'dark' : 'light';
  }

  function frameOf(win) {
    var frames = document.getElementsByTagName('iframe');
    for (var i = 0; i < frames.length; i++) if (frames[i].contentWindow === win) return frames[i];
    return null;
  }

  function sendTheme(frame) {
    try { frame.contentWindow.postMessage({ type: 'kz-walkthrough:theme', theme: themeBehind(frame) }, '*'); } catch (e) { /* gone */ }
  }

  // Phone view: the player asks to fill the window. The iframe is restyled in place, never moved, since
  // moving it would reload it. The history entry lets the phone's back button close the view rather
  // than leave the page.
  var expanded = null, savedStyle = null, savedOverflow = '';
  var FILL = { position: 'fixed', top: '0', left: '0', width: '100%', height: '100%', 'max-width': 'none', margin: '0', 'aspect-ratio': 'auto', 'z-index': '2147483647', background: '#0b1214' };

  function expand(frame) {
    if (expanded) return;
    expanded = frame;
    savedStyle = frame.getAttribute('style');
    Object.keys(FILL).forEach(function (k) { frame.style.setProperty(k, FILL[k], 'important'); });
    savedOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    history.pushState({ kzWalkthrough: true }, '');
  }

  function collapse() {
    var frame = expanded;
    if (!frame) return null;
    expanded = null;
    if (savedStyle === null) frame.removeAttribute('style'); else frame.setAttribute('style', savedStyle);
    document.documentElement.style.overflow = savedOverflow;
    return frame;
  }

  window.addEventListener('popstate', function () {
    var frame = collapse();
    if (frame) frame.contentWindow.postMessage({ type: 'kz-walkthrough:close' }, '*');
  });

  var known = [];
  window.addEventListener('message', function (e) {
    var d = e.data;
    if (!d) return;
    if (d.type === 'kz-walkthrough:expand') {
      var target = frameOf(e.source);
      if (d.on) { if (target) expand(target); }
      else if (collapse()) history.back();
      return;
    }
    if (d.type !== 'kz-walkthrough:height' || typeof d.height !== 'number') return;
    var frame = frameOf(e.source);
    if (!frame || frame === expanded) return;
    frame.style.height = Math.max(120, Math.min(Math.round(d.height), 5000)) + 'px';
    frame.style.aspectRatio = 'auto';
    // The docs site's script forces iframes to 16:9, which would cut off the controls, unless told not to.
    frame.setAttribute('data-resize', 'false');
    // The iframe now always fits, so the player can drop its own scrollbar.
    e.source.postMessage({ type: 'kz-walkthrough:sized', canExpand: true }, '*');
    if (known.indexOf(frame) < 0) known.push(frame);
    sendTheme(frame);
  });

  // Follow the page's own light/dark switch (a class or attribute change on <html> or <body>).
  function watch() {
    var again = function () { known.forEach(sendTheme); };
    var mo = new MutationObserver(again);
    [document.documentElement, document.body].forEach(function (el) { if (el) mo.observe(el, { attributes: true }); });
    if (window.matchMedia) {
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      if (mq.addEventListener) mq.addEventListener('change', again);
    }
  }
  if (document.body) watch(); else document.addEventListener('DOMContentLoaded', watch);
})();
