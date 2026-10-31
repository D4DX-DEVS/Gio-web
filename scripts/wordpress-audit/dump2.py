import json, sys, os, urllib.request, urllib.error
OUT = os.path.join(sys.argv[1], "rest")
UA = {"User-Agent": "Mozilla/5.0 (read-only audit)"}
def get(url):
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as r:
            return r.status, dict(r.headers), r.read()
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), e.read()
    except Exception as e:
        return 0, {}, str(e).encode()
for name, per in [("pages", 5), ("media", 25)]:
    items, page, errs = [], 1, []
    while True:
        st, h, b = get(f"https://www.giokerala.org/wp-json/wp/v2/{name}?per_page={per}&page={page}")
        if st != 200:
            errs.append((page, st, b[:150]))
            if st == 400 or page > 40: break
            page += 1; continue
        d = json.loads(b)
        if not d: break
        items += d
        if page >= int(h.get("X-WP-TotalPages", 1)): break
        page += 1
    json.dump(items, open(os.path.join(OUT, name + ".json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(name, len(items), "errors:", errs)
