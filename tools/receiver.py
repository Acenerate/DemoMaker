import http.server, os, sys, urllib.parse
OUT = os.path.abspath(sys.argv[2] if len(sys.argv) > 2 else 'captured')
class H(http.server.BaseHTTPRequestHandler):
    def cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS, GET')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.send_header('Access-Control-Allow-Private-Network', 'true')
    def do_OPTIONS(self):
        self.send_response(204); self.cors(); self.end_headers()
    def do_GET(self):
        # proxy page shells from the live docs site so the SPA runs on this origin
        import urllib.request
        req = urllib.request.Request('https://docs.klick-zen.com' + self.path, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'})
        try:
            r = urllib.request.urlopen(req); body = r.read(); code = r.status; ct = r.headers.get('Content-Type', 'text/html')
        except urllib.error.HTTPError as e:
            body = e.read(); code = e.code; ct = 'text/plain'
        self.send_response(code); self.cors(); self.send_header('Content-Type', ct); self.end_headers(); self.wfile.write(body)
    def do_POST(self):
        q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        if 'name' not in q:  # e.g. analytics beacons from the proxied page
            self.send_response(204); self.cors(); self.end_headers(); return
        name = q['name'][0]
        name = os.path.normpath(name).lstrip('\\/').replace('..', '_')
        data = self.rfile.read(int(self.headers['Content-Length']))
        p = os.path.join(OUT, name)
        if os.name == 'nt': p = '\\\\?\\' + p  # allow paths past MAX_PATH
        os.makedirs(os.path.dirname(p), exist_ok=True)
        open(p, 'wb').write(data)
        self.send_response(200); self.cors(); self.end_headers(); self.wfile.write(b'saved')
http.server.ThreadingHTTPServer(('127.0.0.1', int(sys.argv[1])), H).serve_forever()
