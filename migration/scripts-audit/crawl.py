import json, re, sys, os, time, hashlib, urllib.request, urllib.error, urllib.parse, html
OUT = sys.argv[1]
HT = os.path.join(OUT, "html"); os.makedirs(HT, exist_ok=True)
UA = {"User-Agent": "Mozilla/5.0 (read-only audit)"}
HOSTS = {"www.giokerala.org", "giokerala.org"}
SKIP = re.compile(r"/(wp-content|wp-json|wp-admin|wp-includes|feed|xmlrpc\.php|wp-login\.php|comments/feed)|\.(jpe?g|png|gif|webp|svg|pdf|docx?|xlsx?|pptx?|zip|mp4|mp3|css|js|xml|ico)$|/cdn-cgi/|/(day|week|photo)/|/\d{4}-\d{2}(-\d{2})?/|[?&](replytocom|share|ical|outlook-ical|tribe-bar-date|eventDisplay)=", re.I)

def norm(u, base):
    u = urllib.parse.urljoin(base, html.unescape(u.strip()))
    p = urllib.parse.urlsplit(u)
    if p.scheme not in ("http", "https") or p.netloc not in HOSTS: return None
    path = urllib.parse.quote(urllib.parse.unquote(p.path or "/"), safe="/%:@!$&'()*+,;=-._~").lower() if re.search(r"%[0-9a-fA-F]{2}|[^\x00-\x7f]", p.path) else (p.path or "/")
    return urllib.parse.urlunsplit(("https", "www.giokerala.org", path, p.query, ""))

PREV = {}
for line in open(os.path.join(OUT, "crawl1.log"), encoding="utf-8"):
    parts = line.split(" ", 2)
    if len(parts) == 3 and parts[1].isdigit() and parts[1] != "0": PREV[parts[2].strip()] = int(parts[1])
def fetch(url):
    fn = os.path.join(HT, hashlib.md5(url.encode()).hexdigest()[:12] + ".html")
    if url in PREV and os.path.exists(fn):
        return PREV[url], url, "text/html; cached", open(fn, encoding="utf-8").read().encode()
    req = urllib.request.Request(url, headers=UA)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, r.geturl(), r.headers.get("Content-Type", ""), r.read()
    except urllib.error.HTTPError as e:
        return e.code, url, e.headers.get("Content-Type", ""), e.read()
    except Exception as e:
        return 0, url, "", str(e).encode()

sm = json.load(open(os.path.join(OUT, "sitemaps.json")))
seeds = ["https://www.giokerala.org/"]
src_of = {}
for k, v in sm.items():
    for u in v["urls"]:
        seeds.append(u); src_of[u] = k
queue, seen, results = [], set(), {}
for s in seeds:
    n = norm(s, s)
    if n and n not in seen: seen.add(n); queue.append(n)
LIMIT = int(sys.argv[2]) if len(sys.argv) > 2 else 700
while queue and len(results) < LIMIT:
    u = queue.pop(0)
    st, final, ct, body = fetch(u)
    rec = {"status": st, "final": final, "ctype": ct, "sitemap": src_of.get(u), "len": len(body)}
    if "html" in ct:
        t = body.decode("utf-8", "replace")
        fn = hashlib.md5(u.encode()).hexdigest()[:12] + ".html"
        open(os.path.join(HT, fn), "w", encoding="utf-8").write(t)
        rec["file"] = fn
        m = re.search(r"<title>(.*?)</title>", t, re.S); rec["title"] = html.unescape(m.group(1).strip()) if m else ""
        m = re.search(r'<link rel="canonical" href="([^"]+)"', t); rec["canonical"] = m.group(1) if m else ""
        m = re.search(r'<body[^>]*class="([^"]+)"', t); rec["body_class"] = m.group(1) if m else ""
        rec["widgets"] = sorted(set(re.findall(r'data-widget_type="([^"]+)"', t)))
        rec["imgs"] = sorted(set(x for x in re.findall(r'(?:src|data-src|href)="([^"]+\.(?:jpe?g|png|gif|webp|svg))"', t, re.I) if "/uploads/" in x))
        rec["docs"] = sorted(set(re.findall(r'(?:href|src|data)="([^"]+\.(?:pdf|docx?|xlsx?|pptx?|zip))"', t, re.I)))
        rec["iframes"] = sorted(set(re.findall(r'<iframe[^>]+src="([^"]+)"', t)))
        rec["yt"] = sorted(set(re.findall(r'(?:youtu\.be/|youtube\.com/(?:embed/|watch\?v=))([\w-]{11})', t.replace("\\/", "/"))))
        rec["forms"] = len(re.findall(r'class="wpcf7-form', t))
        links = set()
        for h in re.findall(r'href="([^"#][^"]*)"', t):
            n = norm(h, final)
            if n: links.add(n)
        rec["out"] = sorted(links)
        for n in links:
            if n not in seen and not SKIP.search(urllib.parse.urlsplit(n).path + ("?" + urllib.parse.urlsplit(n).query if urllib.parse.urlsplit(n).query else "")):
                seen.add(n); queue.append(n)
    results[u] = rec
    print(len(results), st, u, flush=True)
    if "cached" not in rec["ctype"]: time.sleep(0.4)
    if len(results) % 20 == 0: json.dump(results, open(os.path.join(OUT, "crawl.json"), "w", encoding="utf-8"), ensure_ascii=False)
json.dump(results, open(os.path.join(OUT, "crawl.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("DONE", len(results), "queued-left", len(queue))
