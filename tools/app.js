/*
 * Klick-Zen docs — standalone runtime.
 * Re-implements the interactive behaviour of the original SnazzyDocs SPA in plain JavaScript:
 * in-place page navigation, menu state, mobile menu, dark mode, search modal, image lightbox,
 * copy-code buttons, linkable cards, permalinks and anchor scrolling.
 *
 * Every page is a complete static HTML file, so the site also works without this script.
 * In-place navigation loads each page's page.js with a <script> tag, which works over http(s)
 * and from file:// alike. Browsers only let a file:// page change its query/hash in the address
 * bar, so offline the current page is kept in ?p=<path> (e.g. index.html?p=en/managing-buttons/).
 */
(function () {
  'use strict';

  var html = document.documentElement;
  var ROOT_URL = new URL(html.getAttribute('data-root') || './', location.href).href;
  var IS_FILE = location.protocol === 'file:';
  var BASE_DOC = location.href.split('#')[0].split('?')[0];  // the file this document was loaded from

  var $ = function (sel, el) { return (el || document).querySelector(sel); };
  var $$ = function (sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); };

  /* ------------------------------------------------------------------ URLs */

  // Make every relative href/src absolute so the persistent chrome (menu, logo, ...) keeps
  // working after history.pushState changes the document's base URL.
  function absolutize(root, base) {
    $$('[href], [src]', root).forEach(function (el) {
      ['href', 'src'].forEach(function (attr) {
        var v = el.getAttribute(attr);
        if (v === null || v === '' || /^(#|mailto:|tel:|javascript:|data:)/i.test(v)) return;
        try { el.setAttribute(attr, new URL(v, base).href); } catch (e) { /* leave as is */ }
      });
    });
  }

  // "/en/foo/bar" (a documentation path) -> URL of its static page
  function pageUrl(docPath) {
    var p = docPath.replace(/^\/+|\/+$/g, '');
    return new URL(p ? p + '/index.html' : 'index.html', ROOT_URL).href;
  }

  function samePage(a, b) {
    var strip = function (u) { return u.split('#')[0].replace(/index\.html$/, ''); };
    return strip(a) === strip(b);
  }

  function isInternal(href) {
    return href && href.indexOf(ROOT_URL) === 0;
  }

  function stripPage(u) { return u.split('#')[0].split('?')[0].replace(/index\.html$/, ''); }
  function hashOf(u) { var i = u.indexOf('#'); return i === -1 ? '' : u.slice(i); }

  // Logical URL (the real page file) -> what the address bar shows.
  function addressFor(url) {
    if (!IS_FILE) return url;
    var page = stripPage(url);
    if (page === stripPage(BASE_DOC)) return BASE_DOC + hashOf(url);
    return BASE_DOC + '?p=' + page.slice(ROOT_URL.length) + hashOf(url);
  }

  // Address bar -> logical URL of the page it shows.
  function logicalFrom(address) {
    if (!IS_FILE) return address;
    var p = new URL(address).searchParams.get('p');
    return p === null ? BASE_DOC + hashOf(address) : new URL(p + 'index.html', ROOT_URL).href + hashOf(address);
  }

  var currentUrl = logicalFrom(location.href);  // the page being shown

  function pushUrl(url, title) {
    try {
      history.pushState({ url: url }, title, addressFor(url));
    } catch (e) {
      return false;
    }
    currentUrl = url;
    return true;
  }

  /* ------------------------------------------------------------ scrolling */

  function scrollToId(id, delay) {
    setTimeout(function () {
      var el = document.getElementById(id);
      if (!el) return;
      var nav = $('#sd_navbar');
      window.scrollTo({ top: el.offsetTop - nav.offsetHeight + 107 });
    }, delay || 0);
  }

  function isInViewport(el) {
    var r = el.getBoundingClientRect();
    return r.top >= 0 && r.left >= 0 &&
      r.bottom <= (window.innerHeight || html.clientHeight) &&
      r.right <= (window.innerWidth || html.clientWidth);
  }

  function scrollMenuToActivePage() {
    setTimeout(function () {
      var wrapper = $('#sd_menu_wrapper');
      if (!wrapper) return;
      var links = $$('#sd_menu a.active', wrapper);
      var last = links[links.length - 1];
      if (!last || isInViewport(last)) return;
      var wr = wrapper.getBoundingClientRect();
      wrapper.scrollTop = last.getBoundingClientRect().top - wr.top + wrapper.scrollTop - 50;
    }, 500);
  }

  function resizeEmbeds() {
    var els = $$('iframe, video');
    setTimeout(function () {
      els.forEach(function (el) {
        var flag = el.getAttribute('data-resize');
        if (flag !== null && flag !== true) return;
        var w = el.offsetWidth;
        var ratio = getComputedStyle(el).getPropertyValue('--aspect-ratio');
        el.style.height = (ratio ? w / parseFloat(ratio) : 0.5625 * w) + 'px';
      });
    }, 500);
  }

  /* ----------------------------------------------------------- navigation */

  var navigating = null;
  var pageData = {};  // page.js URL -> data

  // page.js files call this; they identify themselves by their path from the site root.
  window.__sdPage = function (data) { pageData[new URL(data.file, ROOT_URL).href] = data; };

  function dataUrl(url) {
    var page = stripPage(url);
    if (!/\/$/.test(page)) page += '/';
    return page + 'page.js';
  }

  function loadPageData(url) {
    var src = dataUrl(url);
    if (pageData[src]) return Promise.resolve(pageData[src]);
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = function () { s.remove(); pageData[src] ? resolve(pageData[src]) : reject(new Error('no data')); };
      s.onerror = function () { s.remove(); reject(new Error('load failed')); };
      document.head.appendChild(s);
    });
  }

  function navigate(url, opts) {
    opts = opts || {};
    if (!opts.fromPopstate && samePage(url, currentUrl) && url.indexOf('#') === -1) return;

    var token = {};
    navigating = token;
    loadPageData(url)
      .then(function (data) {
        if (navigating !== token) return;
        if (!opts.fromPopstate && !pushUrl(url, data.title)) throw new Error('history refused');
        currentUrl = url;
        swapPage(data, url);
        html.classList.remove('sd-routing');
        var hash = url.split('#')[1];
        if (hash) scrollToId(decodeURIComponent(hash), 0);
        else if (!opts.initial) window.scrollTo(0, 0);
        window.dispatchEvent(new CustomEvent('pageChanged'));
      })
      .catch(function () { location.href = url; });
  }

  function setHTML(sel, markup, base) {
    var el = $(sel);
    if (!el || markup === null || markup === undefined) return;
    var t = document.createElement('template');
    t.innerHTML = markup;
    absolutize(t.content, base);
    el.replaceChildren(t.content);
  }

  function swapPage(data, url) {
    document.title = data.title;
    html.setAttribute('data-sd-page-id', data.pageId || '');

    Object.keys(data.meta).forEach(function (sel) {
      var el = $(sel), v = data.meta[sel];
      if (el && v !== null) el.setAttribute(el.hasAttribute('content') ? 'content' : 'href', v);
    });

    Object.keys(data.html).forEach(function (sel) { setHTML(sel, data.html[sel], url); });

    var container = $('#sd_container');
    if (container && data.containerClass) container.className = data.containerClass;

    // Menu: apply the target page's active/expanded state to the live elements so the CSS
    // grid-row transitions on .sd-menu--folder animate exactly as in the original.
    setTimeout(function () {
      $$('#sd_menu li[id]').forEach(function (li) {
        var m = data.menu[li.id];
        if (!m) return;
        li.className = m[0];
        if (m[2]) li.classList.add('active');  // shipped closed for the load animation
        li.removeAttribute('data-sd-open');
        var a = li.querySelector(':scope > a');
        if (a) a.className = m[1];
      });
    }, 0);
  }

  window.addEventListener('popstate', function (e) {
    if (e.state && e.state.url) navigate(e.state.url, { fromPopstate: true });
  });

  window.addEventListener('pageChanged', function () {
    scrollMenuToActivePage();
    closeMobileMenu();
    bindContent();
  });

  /* ----------------------------------------------------------------- menu */

  // Folders shipped closed with data-sd-open open with the same grid-row transition as the original.
  function openActiveFolders() {
    var folders = $$('#sd_menu li[data-sd-open]');
    folders.forEach(function (li) { void li.offsetHeight; });
    setTimeout(function () {
      folders.forEach(function (li) {
        li.classList.add('active');
        li.removeAttribute('data-sd-open');
      });
    }, 0);
  }

  function bindMenu() {
    $$('#sd_menu a').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        window.scrollTo(0, window.scrollTop);
        if (a.href !== currentUrl) navigate(a.href);
      }, { passive: false });

      var li = a.parentNode;
      if (li.querySelector(':scope > ul')) {
        a.addEventListener('click', function (e) {
          if (e.target !== e.currentTarget) return;
          if (a.classList.contains('active')) {
            li.classList.toggle('expanded');
            li.classList.toggle('collapsed');
          } else {
            li.classList.replace('collapsed', 'expanded');
          }
        });
      }
    });
  }

  /* ---------------------------------------------------------- mobile menu */

  function closeMobileMenu() {
    var menu = $('.docs-menu');
    if (menu) menu.classList.remove('open');
    var backdrop = $('#sd_mobile_menu_backdrop');
    if (backdrop) backdrop.classList.add('hidden');
  }

  function bindMobileMenu() {
    var open = $('#sd_mobile_menu_button'), close = $('#sd_mobile_menu_close_button'), backdrop = $('#sd_mobile_menu_backdrop');
    if (!open || !close || !backdrop) return;
    open.addEventListener('click', function () {
      $('.docs-menu').classList.add('open');
      backdrop.classList.remove('hidden');
    }, false);
    close.addEventListener('click', closeMobileMenu, false);
  }

  /* ------------------------------------------------------------ dark mode */

  var DARK_ICON = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">\n<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />\n</svg>';
  var LIGHT_ICON = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">\n<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />\n</svg>';

  function storageGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function storageSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } }

  function initDarkMode() {
    if (!$('#sd_darkmode')) return;
    var cssDefault = getComputedStyle(html).getPropertyValue('--sd-darkmode');
    var stored = storageGet('isDarkmode');
    var isDark = stored !== null ? stored === 'true' : (cssDefault !== null && !!cssDefault);

    function switchTheme() {
      html.classList.toggle('dark', isDark);
      var sw = $('#sd_darkmode_toggle_switch');
      storageSet('isDarkmode', String(isDark));
      if (isDark) {
        sw.classList.remove('bg-yellow-500', '-translate-x-1.5');
        sw.classList.add('bg-gray-700', 'translate-x-2.5');
        setTimeout(function () { sw.innerHTML = DARK_ICON; }, 150);
      } else {
        sw.classList.add('bg-yellow-500', '-translate-x-1.5');
        sw.classList.remove('bg-gray-700', 'translate-x-2.5');
        setTimeout(function () { sw.innerHTML = LIGHT_ICON; }, 150);
      }
    }

    if (isDark) switchTheme();
    else html.classList.remove('dark');
    $('#sd_darkmode_toggle_button').addEventListener('click', function () {
      isDark = !isDark;
      switchTheme();
    }, false);
  }

  /* --------------------------------------------------------------- search */

  var FUSE_OPTIONS = {
    includeScore: true, threshold: 0.15, distance: 1000, location: 2, minMatchCharLength: 2,
    ignoreLocation: true, useExtendedSearch: false,
    keys: [
      { name: 'parentName', weight: 0.91 },
      { name: 'page.name', weight: 7 },
      { name: 'page.content', weight: 8 },
      { name: 'tags', weight: 9 }
    ]
  };
  var MIN_QUERY = 2;

  function debounce(fn, wait) {
    var t;
    return function () {
      var args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, wait);
    };
  }

  var search = {
    fuse: null,
    query: '',
    results: [],
    selected: 0,
    links: [],

    modal: function () { return document.getElementById('sd_search_modal'); },
    input: function () { return document.getElementById('sd_search'); },
    isOpen: function () { return document.body.classList.contains('sd-search-active'); },

    init: function () {
      var self = this;
      var btn = $('#sd_search_button');
      if (!btn || !this.input()) return;
      document.body.addEventListener('click', function (e) { self.onBodyClick(e); }, { passive: true });
      btn.addEventListener('click', function () { self.open(); }, { passive: true });
      this.setShortcutSymbol();
      document.addEventListener('keydown', function (e) {
        var isK = e.keyCode === 75 || e.key === 'k' || e.key === 'K';
        var isSlash = e.keyCode === 191 || e.key === '/';
        if ((isK && e.metaKey) || (isSlash && !e.shiftKey)) {
          self.isOpen() ? self.close() : self.open();
          e.preventDefault();
        }
        if (e.key === 'Escape') {
          self.close();
          e.preventDefault();
        }
      });

      var onInput = debounce(function (e) { self.onInput(e); }, 300);
      this.input().addEventListener('keyup', onInput, { passive: true });
      this.input().addEventListener('paste', onInput);
      this.input().addEventListener('input', onInput);  // IME / mobile keyboards; debounced with keyup
      $('.sd-search-close').addEventListener('click', function () { self.close(); }, { passive: true });

      var panel = $('#sd_search_panel');
      panel.addEventListener('keydown', function (e) { self.onKeyNav(e); }, { passive: true, capture: true });

      // The original moves the modal to the end of #sd_container when it opens.
      $('#sd_container').appendChild(this.modal());
    },

    setShortcutSymbol: function () {
      var el = $('span.sd-search-kb-shortcut-symbol');
      if (!el) return;
      el.innerHTML = /(Mac|iPhone|iPod|iPad)/i.test(navigator.userAgent)
        ? '⌘'
        : '<span class="flex text-xs align-top">Ctrl&nbsp;</span>';
    },

    ensureFuse: function () {
      if (!this.fuse && window.Fuse && window.SD_SEARCH_INDEX) {
        this.fuse = new window.Fuse(window.SD_SEARCH_INDEX, FUSE_OPTIONS);
      }
      return this.fuse;
    },

    open: function () {
      var modal = this.modal();
      modal.classList.add('flex');
      modal.classList.remove('hidden');
      this.ensureFuse();
      this.showEmptyState();
      this.input().focus();
      setTimeout(function () { document.body.classList.add('sd-search-active'); }, 200);
    },

    close: function () {
      var modal = this.modal();
      if (!modal) return;
      this.input().value = '';
      this.links = [];
      modal.classList.remove('flex');
      modal.classList.add('hidden');
      document.body.classList.remove('sd-search-active');
    },

    onBodyClick: function (e) {
      if (!this.isOpen()) return;
      if (e.target.closest('div#sd_search_panel')) return;
      this.close();
    },

    showEmptyState: function () {
      var aise = $('#sd_search_aise');
      if (aise) aise.classList.remove('active');
      this.input().setAttribute('placeholder', 'Search…');
      var fuse = $('#sd_search_fuse');
      fuse.classList.add('active');
      var empty = $('.sd-search-empty-state', fuse);
      if (empty) empty.classList.remove('hidden');
      var none = $('.sd-search-no-results', fuse);
      if (none) none.classList.add('invisible');
      $('#sd_search_fuse_help').classList.remove('hidden');
      $('#sd_search_fuse .sd-search-results').innerHTML = '';
    },

    // Mirrors the original reactive state handler that runs after query/results change.
    render: function () {
      var box = $('#sd_search_fuse'), results = $('.sd-search-results', box),
          empty = $('.sd-search-empty-state', box), none = $('.sd-search-no-results', box),
          help = $('#sd_search_fuse_help');
      if (this.query.length >= MIN_QUERY && this.results.length) {
        help.classList.add('hidden');
        results.classList.remove('hidden');
      }
      if (this.query.length >= MIN_QUERY && !this.results.length) {
        results.classList.add('hidden');
        empty.classList.add('hidden');
        none.classList.remove('invisible');
      }
      if (!this.query.length) {
        if (empty) empty.classList.remove('hidden');
        if (none) none.classList.add('invisible');
        help.classList.remove('hidden');
      }
    },

    setState: function (query, results) {
      this.results = []; this.render();
      this.query = query; this.render();
      this.results = results; this.render();
    },

    onInput: function (e) {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(e.key) !== -1) return;
      var q = e.target.value;
      if (q.length < MIN_QUERY || !this.ensureFuse()) { this.setState(q, []); return; }

      var found = this.fuse.search(q).slice(0, 10);
      var matches = this.filterMatches(found);
      this.setState(q, matches);

      if (!found.length || !matches.length) {
        this.modal().classList.add('active');
        $('#sd_search_fuse_help').classList.remove('hidden');
        var shown = q.replace(/^!\^|=|!|\^/, '').replace(/\$$/, '');
        var span = document.createElement('span');
        span.className = 'font-medium sd-search-query';
        span.style.color = '#636363';
        span.textContent = shown;
        var none = $('#sd_search_fuse .sd-search-no-results');
        none.innerHTML = '<span data-i18n="noResultsFor">We didn\'t find any results for</span> "';
        none.appendChild(span);
        none.appendChild(document.createTextNode('"'));
      }
      if (matches.length) {
        this.selected = 0;
        this.renderResults(matches);
      }
    },

    // Keep results whose score is within 1.5x of the spread between best and mean score.
    filterMatches: function (results, factor) {
      factor = factor === undefined ? 1.5 : factor;
      if (!results.length) return [];
      results.sort(function (a, b) { return a.score - b.score; });
      var best = results[0].score;
      var mean = results.reduce(function (s, r) { return s + r.score; }, 0) / results.length;
      var cut = best + factor * (mean - best);
      return results.filter(function (r) { return r.score <= cut; });
    },

    renderResults: function (matches) {
      var out = '<ul class="w-full">';
      matches.forEach(function (m) {
        var it = m.item;
        out += '<li><a href="' + pageUrl(it.relativePath) + '" target="_self">\n\t\t\t\t<div>\n\t\t\t\t\t<h5>' +
          it.pageName + '</h5>\n\t\t\t\t\t<span class="description">' + it.pathName +
          '</span>\n\t\t\t\t</div>\n\t\t\t\t<div class="icon"></div>\n\t\t\t</a></li>';
      });
      out += '</ul>';
      $('#sd_search_fuse .sd-search-results').innerHTML = out;
      this.bindResults();
    },

    bindResults: function () {
      var self = this;
      this.links = $$('#sd_search_modal_body a', this.modal());
      if (!this.links.length) return;
      this.selected = 0;
      this.links[0].classList.add('selected');
      this.links.forEach(function (a, i) {
        a.addEventListener('click', function (e) {
          e.preventDefault();
          navigate(a.href);
          self.close();
        });
        a.addEventListener('mousemove', function () {
          if (self.selected === i) return;
          self.links[self.selected].classList.remove('selected');
          a.classList.add('selected');
          self.selected = i;
        }, { passive: true });
      });
    },

    onKeyNav: function (e) {
      if (!this.links.length) return;
      var key = e.key;
      if (key === 'ArrowUp' || key === 'ArrowDown') {
        var body = document.getElementById('sd_search_modal_body');
        var n = this.links.length;
        this.links[this.selected].classList.remove('selected');
        this.selected = key === 'ArrowUp' ? (this.selected - 1 + n) % n : (this.selected + 1) % n;
        var cur = this.links[this.selected];
        cur.classList.add('selected');
        var r = cur.getBoundingClientRect(), b = body.getBoundingClientRect();
        var pad = parseInt(getComputedStyle(body.querySelector('ul')).paddingBottom, 10) || 0;
        var top = r.top - b.top + body.scrollTop, bottom = top + r.height + pad;
        if (top < body.scrollTop) body.scrollTop = top;
        else if (bottom > body.scrollTop + b.height) body.scrollTop = bottom - b.height;
      } else if (key === 'Enter') {
        this.links[this.selected].click();
      }
    }
  };

  /* -------------------------------------------------------------- content */

  function openLightbox(src) {
    var box = $('#sd_image_lightbox');
    $('#sd_image_lightbox_image_container').src = src;
    box.style.display = 'flex';
    document.body.classList.add('sd-lightbox-open');
  }

  function closeLightbox() {
    $('#sd_image_lightbox').style.display = 'none';
    document.body.classList.remove('sd-lightbox-open');
  }

  var COPY_ICON = null;
  var COPIED = '<small class="text-current">Copied! </small> <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/></svg>';
  var COPY_FAILED = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>';

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).catch(function () { return legacyCopy(text); });
    }
    return legacyCopy(text);
  }

  // execCommand fallback for contexts where the async clipboard API is missing or refused.
  function legacyCopy(text) {
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy') ? resolve() : reject(); } catch (e) { reject(e); }
      ta.remove();
    });
  }

  function bindContent() {
    var content = $('#sd_content');
    if (!content) return;

    // Links to other pages inside the article navigate in place.
    $$('#sd_content a[target="_self"]:not([href^="#"]), #sd_footer .workflow a[target="_self"]:not([href^="#"])').forEach(function (a) {
      a.addEventListener('click', function (e) {
        if (!isInternal(a.href)) return;
        e.preventDefault();
        if (a.hash && samePage(a.href, currentUrl)) {
          pushUrl(a.href, document.title);
          scrollToId(decodeURIComponent(a.hash.slice(1)), 0);
          return;
        }
        navigate(a.href);
      });
    });

    // In-page anchors.
    $$('#sd_content a[href^="#"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        var hash = a.getAttribute('href');
        if (hash.length < 2) return;
        pushUrl(currentUrl.split('#')[0] + hash, document.title);
        scrollToId(decodeURIComponent(hash.slice(1)), 0);
      });
    });

    // Permalinked headings update the address bar when clicked.
    $$('#sd_content h2[id]').forEach(function (h) {
      h.addEventListener('click', function () {
        pushUrl(currentUrl.split('#')[0] + '#' + h.id, document.title);
      });
    });

    // Lightbox for images that are not already links.
    $$('#sd_content img').forEach(function (img) {
      if (img.parentNode.nodeName === 'A') return;
      img.addEventListener('click', function () { openLightbox(img.getAttribute('src')); }, { passive: true });
    });

    // Linkable cards.
    $$('div.sd-card[href]').forEach(function (card) {
      card.addEventListener('click', function (e) {
        if (e.target.hasAttribute('href') && !e.target.classList.contains('sd-card')) return;
        var href = card.getAttribute('href');
        if (card.getAttribute('target') === '_blank') window.open(href, '_blank');
        else window.location.href = href;
      });
    });

    // Copy-to-clipboard buttons on code blocks.
    $$('.sd-copy-code-button').forEach(function (btn) {
      if (COPY_ICON === null) COPY_ICON = btn.innerHTML;
      var icon = btn.innerHTML;
      btn.addEventListener('click', function () {
        var code = btn.closest('pre') && btn.closest('pre').querySelector('code');
        copyText(code ? code.innerText : '').then(function () {
          btn.blur();
          btn.innerHTML = COPIED;
          btn.classList.add('success');
          setTimeout(function () { btn.innerHTML = icon; btn.classList.remove('success'); }, 1000);
        }, function () {
          btn.classList.add('failed');
          btn.innerHTML = COPY_FAILED;
        });
      });
    });

    resizeEmbeds();
  }

  /* ----------------------------------------------------------------- boot */

  function boot() {
    absolutize(document, location.href);
    history.replaceState({ url: currentUrl }, document.title, location.href);
    // Offline deep link (index.html?p=...): show the requested page in place of this one.
    if (!samePage(currentUrl, BASE_DOC)) navigate(currentUrl, { fromPopstate: true, initial: true });
    else html.classList.remove('sd-routing');

    openActiveFolders();
    bindMenu();
    bindMobileMenu();
    initDarkMode();
    search.init();
    bindContent();

    var lightbox = $('#sd_image_lightbox');
    if (lightbox) lightbox.addEventListener('click', closeLightbox, { passive: true });

    window.addEventListener('resize', resizeEmbeds, { passive: true });
    scrollMenuToActivePage();
    if (location.hash) scrollToId(decodeURIComponent(location.hash.slice(1)), 1000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
