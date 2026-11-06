// Reads the Klick-Zen docs from the docs site set in config.json ("docsUrl"). Used by tools/read-docs.js,
// the admin's docs picker, and (through read-docs) Claude when it builds walkthroughs.
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

const ROOT = path.join(__dirname, '..', '..');
const CONFIG = path.join(ROOT, 'config.json');

function config() {
  try { return JSON.parse(fs.readFileSync(CONFIG, 'utf8')); } catch (e) { return {}; }
}
function docsUrl() {
  const url = config().docsUrl;
  if (!url) throw new Error('No docsUrl in config.json');
  return url.replace(/\/?$/, '/');
}

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
    req.on('error', e => reject(e.message.startsWith(url) ? e : new Error(`Could not reach ${url}: ${e.message}`)));
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
  // The site's HTML is minified, so attribute values may have no quotes (id=sd_content).
  const i = html.search(/\bid=["']?sd_content\b/);
  let s = i >= 0 ? html.slice(html.indexOf('>', i) + 1) : html;
  const end = s.search(/\bid=["']?(sd_footer|sd_table_of_contents)\b|<footer\b/);
  if (end > 0) s = s.slice(0, s.lastIndexOf('<', end));
  s = s.replace(/<(script|style|svg|button)[\s\S]*?<\/\1>/gi, '')
    .replace(/<a[^>]*class=(?:"[^"]*permalink[^"]*"|[^\s>]*permalink\b)[^>]*>[\s\S]*?<\/a>/gi, '')
    .replace(/<img[^>]*\balt=(?:"([^"]*)"|([^\s>]+))[^>]*>/gi, (m, a, b) => ((a || b || '').trim() ? ` [image: ${(a || b).trim()}] ` : ''))
    .replace(/<h([1-4])[^>]*>/gi, (m, n) => '\n\n' + '#'.repeat(+n) + ' ')
    .replace(/<\/h[1-4]>/gi, '\n')
    .replace(/<li[^>]*>(\s*<p\b[^>]*>)?/gi, '\n- ')
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

// { url, title, text }
async function readPage(p) {
  const url = new URL(normal(p).slice(1), docsUrl()).href;
  const html = await get(url);
  // The site answers unknown paths with a normal page titled "Page not found".
  if (/^page not found$/i.test(heading(html) || '')) throw new Error(`No docs page ${normal(p)} (run node tools/read-docs.js for the list)`);
  return { url, title: heading(html), text: toText(html) };
}

// Every page, from the sitemap (titles from each page's heading): { base, pages: [{ path, section, title }] }
async function listPages() {
  const base = docsUrl();
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
  return { base, pages: pages.map(withSection).sort(order) };
}

function withSection(p) {
  const seg = p.path.split('/').filter(Boolean)[0] || '';
  const section = seg.replace(/-/g, ' ').replace(/^./, c => c.toUpperCase())
    .replace(/\bi\b/g, 'I').replace(/klick zen/i, 'Klick-Zen').replace(/zendesk/g, 'Zendesk');
  return { ...p, section };
}
const order = (a, b) => a.section.localeCompare(b.section) || (b.path.split('/').length - a.path.split('/').length) || a.title.localeCompare(b.title);

module.exports = { readPage, listPages, docsUrl, config, CONFIG };
