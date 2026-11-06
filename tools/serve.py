"""Static file server that copes with Windows paths longer than MAX_PATH.

Usage: python -I tools/serve.py [port] [directory] [allowed top-level folder ...]

With allowed folders, only those folders of the directory are served and "/" redirects to the first,
e.g. `serve.py 8791 . walkthroughs framework` serves the walkthroughs without exposing .env or raw/.
With no directory, that's what it does.
"""
import functools, http.server, os, sys


class Handler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        p = super().translate_path(path)
        if os.name == 'nt' and not p.startswith('\\\\?\\'):
            p = '\\\\?\\' + os.path.abspath(p)
        return p

    def send_head(self):
        if allowed:
            top = self.path.split('?')[0].split('#')[0].lstrip('/').split('/')[0]
            if top == '':
                self.send_response(302)
                self.send_header('Location', '/' + allowed[0] + '/')
                self.end_headers()
                return None
            if top not in allowed:
                self.send_error(404)
                return None
        return super().send_head()


port = int(sys.argv[1]) if len(sys.argv) > 1 else 8791
root = os.path.abspath(sys.argv[2] if len(sys.argv) > 2 else '.')
allowed = sys.argv[3:] if len(sys.argv) > 2 else ['walkthroughs', 'framework']
http.server.ThreadingHTTPServer(('127.0.0.1', port), functools.partial(Handler, directory=root)).serve_forever()
