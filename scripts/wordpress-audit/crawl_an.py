import json, os, sys, re, csv, html, glob, collections, urllib.parse
S = sys.argv[1]; OUT = sys.argv[2]; os.makedirs(OUT, exist_ok=True)
crawl = json.load(open(os.path.join(S, "crawl.json"), encoding="utf-8"))
R = os.path.join(S, "rest")
L = lambda n: json.load(open(os.path.join(R, n), encoding="utf-8"))
media = L("media.json"); posts = L("posts.json")
pages = L("pages.json") + [json.load(open(f, encoding="utf-8")) for f in glob.glob(os.path.join(R, "page_*.json"))]
events = L("tribe_events_v1.json")

def classify(u, rec):
    p = urllib.parse.unquote(urllib.parse.urlsplit(u).path)
    bc = rec.get("body_class", "")
    if re.match(r"^/(savelife_project|savelife_team|save_testimonials|savelife_faqs|project_cat|testimonials_cat|team_cat|faqs_cat)/", p): return "theme-demo-cpt"
    if p.startswith("/event/") or "single-tribe_events" in bc: return "event"
    if p.startswith("/events/"): return "event-archive"
    if p.startswith("/category/") or p.startswith("/tag/"): return "taxonomy-archive"
    if p.startswith("/author/"): return "author-archive"
    if p.startswith("/elementor-hf/") or p.startswith("/nekit-mm-cpt/"): return "builder-template"
    if "/page/" in p: return "pagination"
    if "single-post" in bc: return "post"
    if "page-template" in bc or " page " in f" {bc} " or "page-id-" in bc or "home" in bc.split(): return "page"
    if "archive" in bc or "blog" in bc.split(): return "archive"
    return "other"

def key(u):  # normalise upload URL: strip size suffix + scaled + query
    u = html.unescape(u).split("?")[0].replace("http://", "https://").replace("https://giokerala.org", "https://www.giokerala.org")
    return re.sub(r"-(\d+x\d+|scaled|e\d{10,})(?=\.\w+$)", "", u).lower()

lib = {}
for m in media:
    lib[key(m["source_url"])] = m
    for s in ((m.get("media_details") or {}).get("sizes") or {}).values():
        lib.setdefault(key(s["source_url"]), m)

rows = []
for u, r in crawl.items():
    rows.append({"url": urllib.parse.unquote(u), "status": r["status"], "final": urllib.parse.unquote(r.get("final", "")),
                 "type": classify(u, r) if r["status"] == 200 else "error", "in_sitemap": r.get("sitemap") or "NO",
                 "title": r.get("title", ""), "images": len(r.get("imgs", [])), "docs": len(r.get("docs", [])),
                 "iframes": " ".join(r.get("iframes", [])), "youtube": " ".join(r.get("yt", [])), "forms": r.get("forms", 0) or (1 if r.get("file") and "wpr-form" in open(os.path.join(S, "html", r["file"]), encoding="utf-8").read() else 0),
                 "widgets": " ".join(r.get("widgets", []))})
with open(os.path.join(OUT, "url_inventory.csv"), "w", newline="", encoding="utf-8-sig") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(sorted(rows, key=lambda x: (x["type"], x["url"])))
print("URL total", len(rows)); print(collections.Counter(r["type"] for r in rows).most_common())
print("status:", collections.Counter(r["status"] for r in rows).most_common())
print("\nNOT IN SITEMAP:"); [print("  ", r["status"], r["type"], r["url"]) for r in rows if r["in_sitemap"] == "NO"]
print("\nNON-200:"); [print("  ", r["status"], r["url"]) for r in rows if r["status"] != 200]
print("\nIFRAMES:", sorted(set(i for r in crawl.values() for i in r.get("iframes", []))))
print("YOUTUBE:", sorted(set(i for r in crawl.values() for i in r.get("yt", []))))
print("FORMS on:", [r["url"] for r in rows if r["forms"]])

# referenced uploads across HTML crawl + REST content
refs = collections.defaultdict(set)
orig = {}
for cf in glob.glob(os.path.join(S, "css", "*.css")):
    for x in re.findall(r"""url\(["']?(https?://(?:www\.)?giokerala\.org/wp-content/uploads/\d[^)"']+)""", open(cf, encoding="utf-8", errors="replace").read()):
        refs[key(x)].add("elementor-css:" + os.path.basename(cf)); orig.setdefault(key(x), re.sub(r"-(\d+x\d+|scaled)(?=\.\w+$)", "", x))
for u, r in crawl.items():
    if r.get("file"):
        t = open(os.path.join(S, "html", r["file"]), encoding="utf-8").read().replace("\\/", "/")
        for x in re.findall(r'https?://(?:www\.)?giokerala\.org/wp-content/uploads/[^"\'\s)>,]+', t):
            if "/elementor/" in x or "/wpr-" in x or x.endswith(".css") or x.endswith(".js"): continue
            refs[key(x)].add(urllib.parse.unquote(u)); orig.setdefault(key(x), re.sub(r"-(\d+x\d+|scaled)(?=\.\w+$)", "", html.unescape(x).split("?")[0]))
for p in posts + pages:
    for x in re.findall(r'https?://(?:www\.)?giokerala\.org/wp-content/uploads/[^"\'\s)>,]+', p["content"]["rendered"]):
        refs[key(x)].add(p["link"])
for e in events:
    for x in re.findall(r'https?://(?:www\.)?giokerala\.org/wp-content/uploads/[^"\'\s)>,]+', json.dumps(e).replace("\\/", "/")):
        refs[key(x)].add(e["url"])
refs = {k: v for k, v in refs.items() if re.search(r"\.(jpe?g|png|gif|webp|svg|heic|pdf|docx?|xlsx?|pptx?|zip|mp4|mp3)$", k)}
not_in_lib = sorted(k for k in refs if k not in lib)
unused = sorted(m["source_url"] for m in media if key(m["source_url"]) not in refs)
print(f"\nUPLOADS referenced: {len(refs)} | in media library: {len(refs)-len(not_in_lib)} | referenced but NOT in public media API: {len(not_in_lib)} | library items never referenced on public pages: {len(unused)}")
with open(os.path.join(OUT, "asset_inventory.csv"), "w", newline="", encoding="utf-8-sig") as f:
    w = csv.writer(f); w.writerow(["file_url", "kind", "in_media_api", "media_id", "mime", "alt_text", "referenced_on_count", "referenced_on_sample"])
    allk = set(refs) | set(key(m["source_url"]) for m in media)
    for k in sorted(allk):
        m = lib.get(k); src = m["source_url"] if m and key(m["source_url"]) == k else orig.get(k, k)
        kind = "document" if re.search(r"\.(pdf|docx?|xlsx?|pptx?|zip)$", k) else "image"
        w.writerow([src, kind, "yes" if m else "NO", m["id"] if m else "", m["mime_type"] if m else "", (m or {}).get("alt_text", ""), len(refs.get(k, [])), " | ".join(sorted(refs.get(k, []))[:3])])
print("referenced-not-in-API:"); [print("  ", orig.get(k, k), "|", sorted(refs[k])[:2]) for k in not_in_lib]
json.dump(sorted(set(orig.get(k, k) for k in refs) | set(m["source_url"] for m in media)), open(os.path.join(S, "all_asset_urls.json"), "w"), indent=0)
docs = sorted(k for k in set(refs) | set(key(m["source_url"]) for m in media) if re.search(r"\.(pdf|docx?|xlsx?|pptx?|zip)$", k))
print("\nDOCUMENTS:"); [print("  ", d, "refs:", len(refs.get(d, []))) for d in docs]
ext = collections.Counter()
for r in crawl.values():
    pass
