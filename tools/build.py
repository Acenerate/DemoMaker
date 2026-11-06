"""Build a static, offline copy of docs.klick-zen.com from captured rendered pages.

Usage: python -I tools/build.py
Reads  captured/pages/**.html (rendered DOM snapshots) and raw/doc.json (SnazzyDocs state).
Writes site/ (pages as <path>/index.html, assets under site/assets/).
"""
import hashlib, html, json, os, re, shutil, sys, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'captured', 'pages')
OUT = os.path.join(ROOT, 'site')
CACHE = os.path.join(ROOT, 'raw', 'cache')  # downloaded originals, keyed by URL hash
ORIGIN = 'https://docs.klick-zen.com'
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
ASSET_HOSTS = {'cdn-2.snazzydocs.com', 'cdn-a.snazzydocs.com', 'app.snazzydocs.com', 'assets.snazzydocs.com',
               'cdnjs.cloudflare.com', 'cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'}
EXTRA_ASSETS = ['https://cdn.jsdelivr.net/npm/fuse.js@6.4.6/dist/fuse.min.js']

failed = []


def lp(path):
    """Long-path-safe filesystem path (Windows MAX_PATH is easily exceeded by doc slugs)."""
    path = os.path.abspath(path)
    prefix = '\\\\?\\'
    return prefix + path if os.name == 'nt' and not path.startswith(prefix) else path


# ---------------------------------------------------------------- assets

def fetch(url):
    os.makedirs(CACHE, exist_ok=True)
    p = os.path.join(CACHE, hashlib.sha1(url.encode()).hexdigest())
    if os.path.exists(p):
        return open(p, 'rb').read()
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Referer': ORIGIN + '/'})
    data = urllib.request.urlopen(req, timeout=60).read()
    open(p, 'wb').write(data)
    return data


def local_name(url):
    """Map an absolute asset URL to a path under assets/."""
    u = urllib.parse.urlsplit(url)
    path = urllib.parse.unquote(u.path)
    base = re.sub(r'[<>:"|?*@]', '_', path.rsplit('/', 1)[-1]) or 'index'
    host = u.netloc
    if host == 'fonts.googleapis.com':
        family = re.search(r'family=([^:&]+)', urllib.parse.unquote(u.query))
        slug = (family.group(1) if family else 'font').replace('+', '-').lower()
        return f'assets/fonts/{slug}-{hashlib.sha1(u.query.encode()).hexdigest()[:6]}.css'
    if host == 'fonts.gstatic.com':          # /s/<family>/<version>/<file>
        parts = path.split('/')
        ext = base.rsplit('.', 1)[-1]
        short = base if len(base) <= 40 else hashlib.sha1(base.encode()).hexdigest()[:12] + '.' + ext
        return f'assets/fonts/{parts[2]}/{short}'
    if host in ('cdn-a.snazzydocs.com', 'app.snazzydocs.com'):
        return f'assets/images/{base}'
    if host in ('cdn-2.snazzydocs.com', 'assets.snazzydocs.com'):
        return f'assets/{"css" if base.endswith(".css") else "misc"}/{base}'
    m = re.search(r'/libs/([^/]+)/[^/]+/(.*)$', path)
    if host == 'cdnjs.cloudflare.com' and m:
        lib, rest = m.groups()
        if lib == 'highlight.js':
            return f'assets/css/hljs-{base}'
        return f'assets/vendor/{lib}/{rest}'
    m = re.search(r'/npm/([^@/]+)@[^/]+/(?:dist/)?(.*)$', path)
    if host == 'cdn.jsdelivr.net' and m:
        return f'assets/vendor/{m.group(1)}/{m.group(2)}'
    return f'assets/misc/{host}/{base}'


saved = {}  # url -> local path (relative to site root)


def save_asset(url):
    if url.startswith('//'):
        url = 'https:' + url
    url = html.unescape(url)
    key = url.split('#')[0]
    if key in saved:
        return saved[key]
    name = local_name(key)
    if name in saved.values():  # two URLs flattened to the same file name
        stem, dot, ext = name.rpartition('.')
        name = f'{stem}-{hashlib.sha1(key.encode()).hexdigest()[:6]}{dot}{ext}'
    saved[key] = name
    try:
        data = fetch(key)
    except Exception as e:  # keep going; report at the end
        failed.append((key, str(e)))
        return name
    dest = os.path.join(OUT, name)
    os.makedirs(lp(os.path.dirname(dest)), exist_ok=True)
    if name.endswith('.css'):
        data = rewrite_css(data.decode('utf8', 'replace'), key, name).encode('utf8')
    open(lp(dest), 'wb').write(data)
    return name


def rel(from_file, to_file):
    """Relative URL from one site file to another (both relative to site root)."""
    r = os.path.relpath(to_file, os.path.dirname(from_file) or '.').replace('\\', '/')
    return r


def rewrite_css(css, css_url, css_name):
    def repl(m):
        raw = m.group(2).strip().strip('\'"')
        if raw.startswith('data:') or raw.startswith('#'):
            return m.group(0)
        absu = urllib.parse.urljoin(css_url, raw)
        frag = '#' + absu.split('#', 1)[1] if '#' in absu else ''
        return f'{m.group(1)}"{rel(css_name, save_asset(absu))}{frag}")'
    css = re.sub(r'(url\()\s*([^)]+)\)', repl, css)
    css = re.sub(r'@import\s+["\']([^"\']+)["\']',
                 lambda m: f'@import "{rel(css_name, save_asset(urllib.parse.urljoin(css_url, m.group(1))))}"', css)
    return css


# ---------------------------------------------------------------- pages

def page_out(path):
    return 'index.html' if path == '/' else path.strip('/') + '/index.html'


def captured_pages():
    out = {}
    for dp, _, files in os.walk(lp(SRC)):
        for f in files:
            full = os.path.join(dp, f)
            r = os.path.relpath(full, lp(SRC)).replace('\\', '/')[:-5]
            out['/' if r == 'index' else '/' + r] = full
    return out


def build_page(path, src, pages):
    h = open(lp(src), encoding='utf8').read()
    me = page_out(path)
    root = rel(me, 'index.html')[:-len('index.html')] or './'

    h = h.replace('http://localhost:8765', ORIGIN)
    # Drop every script: the SnazzyDocs runtime, its state blob, analytics, highlight.js loaders, theme hook.
    h = re.sub(r'<script\b[^>]*>.*?</script>', '', h, flags=re.S | re.I)
    h = re.sub(r'<link[^>]+rel="preconnect"[^>]*>\s*', '', h)
    # The theme hook script only injected the Montserrat link, which the capture already contains.

    def local_url(u):
        """Return a local relative URL for u, or None to leave it alone."""
        full = u if not u.startswith('//') else 'https:' + u
        sp = urllib.parse.urlsplit(html.unescape(full))
        if sp.netloc in ASSET_HOSTS:
            return rel(me, save_asset(full))
        if sp.netloc in ('', 'docs.klick-zen.com') and (full.startswith('/') or sp.netloc):
            p = sp.path.rstrip('/') or '/'
            if p in pages:
                return rel(me, page_out(p)) + ('#' + sp.fragment if sp.fragment else '')
        return None

    def attr_repl(m):
        name, q, val = m.group(1), m.group(2), m.group(3)
        if name in ('content',) or val.startswith(('#', 'data:', 'mailto:', 'javascript:')):
            return m.group(0)
        new = local_url(val)
        return m.group(0) if new is None else f'{name}={q}{new}{q}'

    head_end = h.find('</head>')
    head, body = h[:head_end], h[head_end:]
    # Keep og:url / canonical / alternate pointing at the real site; localise everything else.
    def head_repl(m):
        tag = m.group(0)
        if re.search(r'rel="(canonical|alternate)"', tag):
            return tag
        return re.sub(r'\b(href|src)=(["\'])([^"\']+)\2', attr_repl, tag)
    head = re.sub(r'<(link|img|script)\b[^>]*>', head_repl, head)
    body = re.sub(r'\b(href|src|data-src)=(["\'])([^"\']+)\2', attr_repl, body)

    # url(...) inside inline styles (e.g. custom menu icons); quotes may be &quot; entities.
    def style_url(m):
        q, u = m.group(1), m.group(2)
        new = local_url(u)
        return m.group(0) if new is None else f'url({q}{new}{q})'
    body = re.sub(r'url\(\s*(&quot;|["\']?)([^)"\'&]+?)\1\s*\)', style_url, body)
    h = head + body

    # The original builds the menu, then marks the active page's ancestor folders .active a tick
    # later, so those folders animate open on every load. Ship them closed (data-sd-open) and let
    # app.js re-add .active after first paint. A folder that *is* the active page starts open.
    page_id = (re.search(r'data-sd-page-id="([^"]*)"', h) or [None, None])[1]
    active_path = ID_TO_PATH.get(page_id)

    def folder_repl(m):
        tag, fid = m.group(0), m.group(1)
        cls = re.search(r'class="([^"]*)"', tag).group(1).split()
        if 'has-children' in cls and 'active' in cls and ID_TO_PATH.get(fid) != active_path:
            cls.remove('active')
            tag = re.sub(r'class="[^"]*"', f'class="{" ".join(cls)}" data-sd-open=""', tag)
        return tag
    h = re.sub(r'<li\b[^>]*\bid="menu-item_([^"]+)"[^>]*>', folder_repl, h)

    boot = (f'<noscript><style>.sd-menu--folder.has-children[data-sd-open]{{grid-template-rows:auto 1fr}}</style></noscript>\n'
            f'<script>/* apply saved dark mode before first paint */try{{if(localStorage.getItem("isDarkmode")==="true")'
            f'document.documentElement.classList.add("dark")}}catch(e){{}}\n'
            f'/* offline (file://) routes live in ?p=; keep the page hidden until app.js swaps it in */'
            f'if(location.protocol==="file:"&&/[?&]p=/.test(location.search))document.documentElement.classList.add("sd-routing")</script>\n'
            f'<style>html.sd-routing #sd_container{{visibility:hidden}}</style>\n'
            f'<script src="{root}assets/js/fuse.min.js" defer></script>\n'
            f'<script src="{root}assets/js/search-index.js" defer></script>\n'
            f'<script src="{root}assets/js/app.js" defer></script>\n')
    h = h.replace('</head>', boot + '</head>', 1)
    h = re.sub(r'<html\b', f'<html data-root="{root}"', h, count=1)

    dest = os.path.join(OUT, me)
    os.makedirs(lp(os.path.dirname(dest)), exist_ok=True)
    open(lp(dest), 'w', encoding='utf8', newline='\n').write(h)
    write_page_data(h, me)


def write_page_data(h, me):
    """Write page.js beside the page: the parts that change between pages, for in-place navigation.

    Loaded with a <script> tag (not fetch) so it also works when the site is opened from file://.
    URLs inside are relative to the page's own directory, exactly as in its index.html.
    """
    def inner(pattern):
        m = re.search(pattern, h, re.S)
        return m.group(1) if m else None

    def attr(tag_pattern, name):
        m = re.search(tag_pattern, h)
        return re.search(fr'\b{name}="([^"]*)"', m.group(0)).group(1) if m else None

    menu = {}
    for m in re.finditer(r'<li\b[^>]*\bid="(menu-item_[^"]+)"[^>]*>\s*(<a\b[^>]*>)?', h):
        li, a = m.group(0), m.group(2) or ''
        a_cls = re.search(r'class="([^"]*)"', a)
        menu[m.group(1)] = [re.search(r'class="([^"]*)"', li).group(1),
                            a_cls.group(1) if a_cls else '',
                            1 if 'data-sd-open' in li else 0]

    file = me[:-len('index.html')] + 'page.js'
    data = {
        'file': file,
        'title': html.unescape(inner(r'<title>(.*?)</title>') or ''),
        'pageId': inner(r'<html\b[^>]*data-sd-page-id="([^"]*)"'),
        'meta': {
            'meta[property="og:title"]': attr(r'<meta property="og:title"[^>]*>', 'content'),
            'meta[property="og:url"]': attr(r'<meta property="og:url"[^>]*>', 'content'),
            'meta[name="title"]': attr(r'<meta name="title"[^>]*>', 'content'),
            'link[rel="canonical"]': attr(r'<link rel="canonical"[^>]*>', 'href'),
            'link[rel="alternate"]': attr(r'<link rel="alternate"[^>]*>', 'href'),
        },
        'containerClass': attr(r'<main id="sd_container"[^>]*>', 'class'),
        'html': {
            '#sd_breadcrumbs_inner': inner(r'<div id="sd_breadcrumbs_inner"[^>]*>(.*?)</div>'),
            '#sd_content': inner(r'<article id="sd_content"[^>]*>(.*?)</article>'),
            '#sd_footer': inner(r'<footer id="sd_footer"[^>]*>(.*?)</footer>'),
            '#sd_table_of_contents': inner(r'<div id="sd_table_of_contents"[^>]*>(.*?)</div>'),
        },
        'menu': menu,
    }
    js = 'window.__sdPage(' + json.dumps(data, ensure_ascii=False) + ');\n'
    open(lp(os.path.join(OUT, file)), 'w', encoding='utf8', newline='\n').write(js)


def build_search_index(pages):
    doc = json.load(open(os.path.join(ROOT, 'raw', 'doc.json'), encoding='utf8'))
    items = json.loads(doc['search'])
    js = ('/* Search index extracted from the SnazzyDocs documentation state (Fuse.js items). */\n'
          'window.SD_SEARCH_INDEX = ' + json.dumps(items, ensure_ascii=False) + ';\n')
    os.makedirs(os.path.join(OUT, 'assets', 'js'), exist_ok=True)
    open(os.path.join(OUT, 'assets', 'js', 'search-index.js'), 'w', encoding='utf8').write(js)
    missing = [i['relativePath'] for i in items if i['relativePath'] not in pages]
    if missing:
        print('search paths with no captured page:', missing)


def load_tree():
    doc = json.load(open(os.path.join(ROOT, 'raw', 'doc.json'), encoding='utf8'))
    def walk(nodes):
        for n in nodes:
            ID_TO_PATH[n['id']] = n['path']
            walk(n.get('children') or [])
    walk(json.loads(doc['content']))


ID_TO_PATH = {}


def main():
    load_tree()
    pages = captured_pages()
    print('pages:', len(pages))
    for p, f in sorted(pages.items()):
        build_page(p, f, pages)
    os.makedirs(os.path.join(OUT, 'assets', 'js'), exist_ok=True)
    for u in EXTRA_ASSETS:
        data = fetch(u)
        open(os.path.join(OUT, 'assets', 'js', os.path.basename(u)), 'wb').write(data)
    build_search_index(pages)
    shutil.copy(os.path.join(ROOT, 'tools', 'app.js'), os.path.join(OUT, 'assets', 'js', 'app.js'))
    print('assets:', len(saved))
    for u, e in failed:
        print('FAILED', u, e)


if __name__ == '__main__':
    main()
