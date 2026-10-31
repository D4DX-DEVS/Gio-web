import json, os, sys, re, collections, glob, html
R = os.path.join(sys.argv[1], "rest")
L = lambda n: json.load(open(os.path.join(R, n), encoding="utf-8"))
cats = {c["id"]: c for c in L("categories.json")}; tags = {t["id"]: t for t in L("tags.json")}
print("CATEGORIES:", [(c["id"], c["slug"], c["name"], c["count"], c["parent"]) for c in cats.values()])
print("TAGS:", [(t["id"], t["slug"], t["name"], t["count"]) for t in tags.values()])
print("USERS:", [(u["id"], u["slug"], u["name"]) for u in L("users.json")])
posts = L("posts.json")
print("\nPOSTS", len(posts))
yr = collections.Counter(p["date"][:4] for p in posts); print(" by year:", sorted(yr.items()))
for p in sorted(posts, key=lambda p: p["date"]):
    c = p["content"]["rendered"]
    imgs = len(set(re.findall(r'/uploads/[^"\s]+\.(?:jpe?g|png|gif|webp)', c, re.I)))
    docs = re.findall(r'/uploads/[^"\s]+\.(?:pdf|docx?)', c, re.I)
    emb = re.findall(r'(youtube|youtu\.be|facebook|instagram|twitter|x\.com)', c)
    el = "elementor" in c
    print(f" {p['id']:5} {p['date'][:10]} {p['status']} cat={[cats[x]['slug'] for x in p['categories'] if x in cats]} tags={len(p['tags'])} feat={p['featured_media']} imgs={imgs} docs={len(set(docs))} emb={sorted(set(emb))} elem={el} words~{len(re.sub('<[^>]+>',' ',c).split())} fmt={p['format']} | {html.unescape(p['title']['rendered'])[:60]}")
media = L("media.json")
print("\nMEDIA", len(media))
mt = collections.Counter(m["mime_type"] for m in media); print(" mime:", mt.most_common())
print(" by upload year:", sorted(collections.Counter((re.search(r"/uploads/(\d{4})/", m["source_url"]) or re.search("(flat)", "flat")).group(1) for m in media).items()))
tot = sum((m.get("media_details") or {}).get("filesize") or 0 for m in media); print(" sum filesize (where reported) MB:", round(tot/1e6, 1))
noalt = sum(1 for m in media if m["media_type"] == "image" and not m.get("alt_text")); print(" images without alt:", noalt)
print(" non-image media:")
for m in media:
    if not m["mime_type"].startswith("image/"): print("   ", m["id"], m["mime_type"], m["source_url"], "parent=", m["post"])
pages = L("pages.json") + [json.load(open(f, encoding="utf-8")) for f in glob.glob(os.path.join(R, "page_*.json"))]
print("\nPAGES", len(pages))
for p in pages:
    if "id" not in p: print("  ERR", str(p)[:100]); continue
    c = p["content"]["rendered"]
    print(f"  {p['id']} {p['slug']:18} tpl={p['template']:38} words~{len(re.sub('<[^>]+>',' ',c).split()):5} imgs={len(set(re.findall(r'/uploads/[^\"\s]+\.(?:jpe?g|png|gif|webp)', c, re.I)))} docs={sorted(set(re.findall(r'/uploads/[^\"\s]+\.pdf', c)))}")
print("\nNAV:", [(n["id"], n["title"]["rendered"], n["content"]["rendered"][:300]) for n in L("navigation.json")])
print("\nEVENTS v1:")
for e in L("tribe_events_v1.json"):
    print("  ", e["id"], e["start_date"], e["end_date"], e["all_day"], e["title"], "| venue:", (e.get("venue") or {}).get("venue") if isinstance(e.get("venue"), dict) else e.get("venue"), "| cats:", [c["slug"] for c in e.get("categories", [])], "| img:", bool(e.get("image")), "| cost:", e.get("cost"), "| url:", e["url"])
print("VENUES:", [(v["id"], html.unescape(v["title"]["rendered"])) for v in L("tribe_venue.json")])
print("ORGANIZERS:", [(v["id"], html.unescape(v["title"]["rendered"])) for v in L("tribe_organizer.json")])
print("EVENT CATS:", [(v["id"], v["slug"], v["count"]) for v in L("tribe_events_cat.json")])
print("YT PLAYLIST:", [(v["id"], v["title"]["rendered"], v["link"]) for v in L("vid_playlist_ytub.json")])
