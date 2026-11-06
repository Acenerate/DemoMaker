import json,sys
h=open(sys.argv[1],encoding='utf8').read()
line=[l for l in h.splitlines() if l.strip().startswith('documentation: {')][0]
doc=json.loads(line.strip()[len('documentation: '):].rstrip(','))
json.dump(doc,open(sys.argv[2],'w',encoding='utf8'),indent=1)
for k,v in doc.items():
    print(k, '=', (json.dumps(v) if not isinstance(v,str) else v)[:150])
