// Reads the Klick-Zen docs: from the live docs site set in config.json ("docsUrl"), or, if that can't be
// reached, from the offline copy in site/. Used by tools/read-docs.js, the admin's docs picker, and
// (through read-docs) Claude when it builds walkthroughs.
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

const ROOT = path.join(__dirname, '..', '..');
const CONFIG = path.join(ROOT, 'config.json');

function config() {
  try { return JSON.parse(fs.readFileSync(CONFIG, 'utf8')); } catch (e) { return {}; }
}
const docsUrl = () => (config().docsUrl || '').replace(/\/?$/, '/');

// GET a URL as text. *.localhost names are sent to this computer directly (Node can't resolve them).
function get(url, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const local = /\.localhost$/i.test(u.hostname) || u.hostname === 'localhost';
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.request({
      host: local ? '127.0.0.1' : u.hostname, port: u.port || (u.protocol === 'https:' ? 443 : 80), path: u.pathname + u.search,
      headers: { Host: u.host, 'User-Agent': 'DemoMaker docs reader', Accept: '*/*' },
      servername: u.hostname, timeout
    }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) { res.resume(); return resolve(get(new URL(res.headers.location, url).href, timeout)); }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', d => { body += d; });
      res.on('end', () => (res.statusCode === 200 ? resolve(body) : reject(new Error(`${url}: HTTP ${res.statusCode}`))));
    });
    req.on('timeout', () => req.destroy(new Error(`${url}: no answer within ${timeout / 1000}s`)));
    req.on('error', reject);
    req.end();
  });
}

const decode = s => s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#39;|&rsquo;|&lsquo;/g, "'").replace(/&ldquo;|&rdquo;/g, '"').replace(/&mdash;/g, '—').replace(/&ndash;/g, '–').replace(/&hellip;/g, '…')
  .replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCodePoint(parseInt(n, 16)));

const heading = html => { const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i); return m ? decode(m[1].replace(/<[^>]+>/g, '')).trim() : null; };

// The page's readable content (inside #sd_content) as plain text with light structure:
// "# " headings, "- " list items, "[image: ...]" for pictures, " | " between table cells.
function toText(html) {
  const i = html.indexOf('id="sd_content"');
  let s = i >= 0 ? html.slice(html.indexOf('>', i) + 1) : html;
  const end = s.search(/id="sd_footer"|id="sd_table_of_contents"|<footer\b/);
  if (end > 0) s = s.slice(0, end);
  s = s.replace(/<(script|style|svg|button)[\s\S]*?<\/\1>/gi, '')
    .replace(/<a[^>]*class="[^"]*permalink[^"]*"[^>]*>[\s\S]*?<\/a>/gi, '')
    .replace(/<img[^>]*alt="([^"]*)"[^>]*>/gi, (m, a) => (a.trim() ? ` [image: ${a.trim()}] ` : ''))
    .replace(/<h([1-4])[^>]*>/gi, (m, n) => '\n\n' + '#'.repeat(+n) + ' ')
    .replace(/<\/h[1-4]>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<\/(td|th)>/gi, ' | ')
    .replace(/<(p|div|tr|br|ul|ol|table|blockquote|pre)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '');
  return decode(s).split('\n').map(l => l.replace(/[ \t]+/g, ' ').trim()).filter((l, k, a) => l || (a[k - 1] && a[k - 1].trim()))
    .join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// Page paths look like '/landing-pages/overview/'. Also accepts 'landing-pages/overview', full URLs, and
// paths that Git Bash on Windows rewrote ('/landing-pages/x' -> 'C:/Program Files/Git/landing-pages/x').
const normal = p => {
  let s = String(p || '').replace(/\\/g, '/').replace(/^https?:\/\/[^/]+/, '');
  if (/^[a-z]:\//i.test(s)) s = s.replace(/^.*?\/Git\/(usr\/)?/i, '/');
  return ('/' + s.replace(/^\/+|\/+$/g, '') + '/').replace(/^\/\/$/, '/');
};

function offlineFile(p) {
  const rel = normal(p).replace(/^\/(en\/)?/, '');
  for (const f of [path.join(ROOT, 'site', 'en', rel, 'index.html'), path.join(ROOT, 'site', rel, 'index.html')]) if (fs.existsSync(f)) return f;
  return null;
}

// { source: 'live' | 'offline', url, title, text }
async function readPage(p) {
  const base = docsUrl();
  let liveError = null;
  if (base) {
    try {
      const html = await get(new URL(normal(p).slice(1), base).href);
      // The site answers unknown paths with a normal page titled "Page not found".
      if (/^page not found$/i.test(heading(html) || '')) throw Object.assign(new Error(`No docs page ${normal(p)} (run node tools/read-docs.js for the list)`), { notFound: true });
      return { source: 'live', url: new URL(normal(p).slice(1), base).href, title: heading(html), text: toText(html) };
    } catch (e) { if (e.notFound) throw e; liveError = e.message; }
  }
  const f = offlineFile(p);
  if (!f) throw new Error(`No docs page ${normal(p)}${liveError ? ` (live site: ${liveError})` : ''}`);
  const html = fs.readFileSync(f, 'utf8');
  return { source: 'offline', url: path.relative(ROOT, f), title: heading(html), text: toText(html), liveError };
}

// Every page: [{ path, section, title }], from the live sitemap (titles from each page's heading), or
// from the offline copy. { source, pages, liveError? }
async function listPages() {
  const base = docsUrl();
  let liveError = null;
  if (base) {
    try {
      const xml = await get(new URL('sitemap.xml', base).href);
      const all = [...new Set([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => normal(decode(m[1]))))].filter(p => p !== '/');
      // A section folder (/landing-pages/) just shows its first page again, so list it only when it has no pages.
      const paths = all.filter(p => !all.some(q => q !== p && q.startsWith(p)));
      const pages = [];
      for (let k = 0; k < paths.length; k += 8) {
        const chunk = await Promise.all(paths.slice(k, k + 8).map(async p => {
          try { return { path: p, title: heading(await get(new URL(p.slice(1), base).href)) || p }; } catch (e) { return { path: p, title: p }; }
        }));
        pages.push(...chunk);
      }
      return { source: 'live', base, pages: pages.map(withSection).sort(order) };
    } catch (e) { liveError = e.message; }
  }
  const out = [];
  const en = path.join(ROOT, 'site', 'en');
  if (fs.existsSync(en)) {
    for (const sec of fs.readdirSync(en, { withFileTypes: true }).filter(d => d.isDirectory())) {
      const subs = fs.readdirSync(path.join(en, sec.name), { withFileTypes: true }).filter(d => d.isDirectory() && fs.existsSync(path.join(en, sec.name, d.name, 'index.html')));
      if (!subs.length) out.push({ path: `/${sec.name}/`, title: heading(fs.readFileSync(path.join(en, sec.name, 'index.html'), 'utf8')) || sec.name });
      for (const d of subs) out.push({ path: `/${sec.name}/${d.name}/`, title: heading(fs.readFileSync(path.join(en, sec.name, d.name, 'index.html'), 'utf8')) || d.name });
    }
  }
  return { source: 'offline', pages: out.map(withSection).sort(order), liveError };
}

function withSection(p) {
  const seg = p.path.split('/').filter(Boolean)[0] || '';
  const section = seg.replace(/-/g, ' ').replace(/^./, c => c.toUpperCase())
    .replace(/\bi\b/g, 'I').replace(/klick zen/i, 'Klick-Zen').replace(/zendesk/g, 'Zendesk');
  return { ...p, section };
}
const order = (a, b) => a.section.localeCompare(b.section) || (b.path.split('/').length - a.path.split('/').length) || a.title.localeCompare(b.title);

module.exports = { readPage, listPages, docsUrl, config, CONFIG };
