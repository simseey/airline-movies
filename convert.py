import json, sys
src, dst = sys.argv[1], sys.argv[2]
rows=[]
for line in open(src, encoding="utf-8"):
    line=line.rstrip("\n")
    if not line.strip() or line.startswith("#"): continue
    p=line.split("|")
    while len(p)<10: p.append("")
    t,y,c,g,d,cast,imdb,rt,n,dur=[x.strip() for x in p[:10]]
    rows.append([t, int(y) if y else None, c, g, d, cast,
                 float(imdb) if imdb else None, int(rt) if rt else None, 1 if n=="N" else 0, dur])
with open(dst,"w",encoding="utf-8") as f:
    f.write("window.MOVIES=")
    json.dump(rows,f,ensure_ascii=False,separators=(",",":"))
    f.write(";\n")
print(dst, len(rows), "films", sum(r[8] for r in rows), "new")
