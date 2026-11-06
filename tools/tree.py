import json,sys
d=json.load(open(sys.argv[1],encoding='utf8'))
c=json.loads(d['content'])
def walk(n,dep=0):
    for x in n:
        keys=[k for k in x if k not in('children',)]
        print('  '*dep+f"{x['type']:7} {x['path']}  keys={keys}" if dep==0 else '  '*dep+f"{x['type']:7} {x['path']}")
        walk(x.get('children',[]),dep+1)
walk(c)
print(json.dumps(c[0],indent=1)[:2500])
print('SEARCH[0]:',json.dumps(d['search'][0])[:1500])
print('CUSTOM:',json.dumps(d['customizations'],indent=1)[:3000])
print('OPTIONS:',json.dumps(d['options'])[:3000])
