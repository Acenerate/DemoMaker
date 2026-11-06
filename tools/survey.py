import re,sys,glob,collections
cls=collections.Counter();tags=collections.Counter();scripts=set()
for f in glob.glob('captured/pages/**/*.html',recursive=True):
    h=open(f,encoding='utf8').read()
    a=h.find('<article id="sd_content"');b=h.find('</article>',a)
    c=h[a:b]
    for m in re.findall(r'class="([^"]+)"',c):
        for k in m.split(): cls[k]+=1
    for m in re.findall(r'<([a-z0-9]+)[\s>]',c): tags[m]+=1
    for m in re.findall(r'<script[^>]*class="sd-theme-script"[^>]*>(.*?)</script>',h,re.S): scripts.add(m.strip()[:600])
print('TAGS',tags.most_common()); print('CLASSES',cls.most_common(80)); print('THEME SCRIPTS',scripts)
