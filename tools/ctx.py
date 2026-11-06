import sys,re
s=open(sys.argv[1],encoding='utf8').read()
for pat in sys.argv[3:]:
    for m in list(re.finditer(pat,s))[:int(sys.argv[2])]:
        print('=== ',pat,m.start()); print(s[max(0,m.start()-300):m.start()+900]); print()
