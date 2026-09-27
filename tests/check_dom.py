# -*- coding: utf-8 -*-
# Статична сверка: всяко id, търсено от JS, съществува в index.html; всеки внос има
# насрещен износ; всичко в SHELL на sw.js съществува; няма API ключ в кода.
#   python3 tests/check_dom.py
import io, os, re, glob
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rd = lambda p: io.open(os.path.join(R, p), encoding="utf-8").read()
html = rd("index.html")
ids = set(re.findall(r'\bid="([^"]+)"', html))
JS = sorted(os.path.relpath(p, R) for p in glob.glob(os.path.join(R, "js/**/*.js"), recursive=True))
src = {f: rd(f) for f in JS}
bad = []
for f, s in src.items():
    for m in re.finditer(r"""(?:\$|on|show|openSheet|closeSheet)\(\s*'([A-Za-z][\w-]*)'""", s):
        if m.group(1) not in ids: bad.append("%s: липсва id=\"%s\"" % (f, m.group(1)))
exp = {}
for f, s in src.items():
    n = set(re.findall(r"export\s+(?:async\s+)?function\s+([\w$]+)", s))
    n |= set(re.findall(r"export\s+(?:const|let|var)\s+([\w$]+)", s))
    exp[f] = n
for f, s in src.items():
    for names, path in re.findall(r"import\s*\{([^}]*)\}\s*from\s*'([^']+)'", s):
        tgt = os.path.normpath(os.path.join(os.path.dirname(f), path))
        if tgt not in exp: bad.append("%s: непознат модул %s" % (f, path)); continue
        for x in [y.strip().split()[-1] for y in names.split(",") if y.strip()]:
            if x not in exp[tgt]: bad.append("%s: '%s' не се изнася от %s" % (f, x, path))
for p in re.findall(r"'\./([^']+)'", rd("sw.js")):
    if p and not os.path.exists(os.path.join(R, p)): bad.append("sw.js: липсва %s" % p)
for f in JS:
    if f not in ["js/" + p for p in []] and ("./" + f) not in rd("sw.js"):
        bad.append("sw.js: %s не е в SHELL — няма да работи офлайн" % f)
for f in JS + ["index.html", "sw.js"]:
    if re.search(r"sk-ant-[A-Za-z0-9]", rd(f)): bad.append("%s: API ключ в кода!" % f)
print("\n".join(bad) if bad else "ВСИЧКО Е НАРЕД: %d id-та, %d модула" % (len(ids), len(JS)))
