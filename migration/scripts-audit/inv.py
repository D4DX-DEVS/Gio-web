import json, os, sys, re, csv, html, glob, hashlib
S, OUT = sys.argv[1], sys.argv[2]
R = os.path.join(S, "rest"); L = lambda n: json.load(open(os.path.join(R, n), encoding="utf-8"))
cats = {c["id"]: c["slug"] for c in L("categories.json")}
media = {m["id"]: m["source_url"] for m in L("media.json")}
txt = lambda h: " ".join(html.unescape(re.sub(r"<[^>]+>", " ", h)).split())
with open(os.path.join(OUT, "posts.csv"), "w", newline="", encoding="utf-8-sig") as f:
    w = csv.writer(f); w.writerow(["wp_id", "date", "modified", "status", "category", "tags", "title", "slug_decoded", "url", "featured_image", "inline_images", "word_count", "notes"])
    for p in sorted(L("posts.json"), key=lambda p: p["date"]):
        c = p["content"]["rendered"]
        imgs = len(set(re.sub(r"-\d+x\d+(?=\.\w+$)", "", x) for x in re.findall(r'src="([^"]+/uploads/[^"]+)"', c)))
        notes = []
        if not p["title"]["rendered"].strip(): notes.append("EMPTY TITLE on live site")
        if "xs-share" in c: notes.append("contains injected share widget markup")
        if "transliteration" in c: notes.append("contains transliteration spans")
        if p["featured_media"] and p["featured_media"] not in media: notes.append("featured image not in public media API")
        w.writerow([p["id"], p["date"], p["modified"], p["status"], "|".join(cats.get(x, str(x)) for x in p["categories"]), len(p["tags"]),
                    txt(p["title"]["rendered"]), urllib_unq(p["slug"]) if False else __import__("urllib.parse").parse.unquote(p["slug"]), p["link"],
                    media.get(p["featured_media"], p["featured_media"] or ""), imgs, len(txt(c).split()), "; ".join(notes)])
# leaders from crawled HTML
crawl = json.load(open(os.path.join(S, "crawl.json"), encoding="utf-8"))
rows = []
for slug, scope in [("team", "state"), ("district-leaders", "district"), ("former-leaders", "former")]:
    u = f"https://www.giokerala.org/{slug}/"
    t = open(os.path.join(S, "html", crawl[u]["file"]), encoding="utf-8").read()
    for blk in re.split(r'data-widget_type="wpr-team-member\.default"', t)[1:]:
        blk = blk[:6000]
        img = re.search(r'<img[^>]+src="([^"]+)"', blk)
        name = re.search(r'wpr-member-name[^>]*>(.*?)</', blk, re.S)
        job = re.search(r'wpr-member-job[^>]*>(.*?)</', blk, re.S)
        desc = re.search(r'wpr-member-description[^>]*>(.*?)</div', blk, re.S)
        socials = re.findall(r'wpr-member-social[^"]*"[^>]*href="([^"]+)"|<a[^>]+href="(https://(?:www\.)?(?:facebook|instagram)[^"]+)"', blk)
        socials = sorted(set(a or b for a, b in socials))
        rows.append([scope, u, txt(name.group(1)) if name else "", txt(job.group(1)) if job else "", txt(desc.group(1)) if desc else "",
                     img.group(1) if img else "", " ".join(socials)])
with open(os.path.join(OUT, "leaders.csv"), "w", newline="", encoding="utf-8-sig") as f:
    w = csv.writer(f); w.writerow(["scope", "source_page", "name", "role_or_title", "description_or_term", "photo_url", "social_links"]); w.writerows(rows)
import collections
print("leaders:", collections.Counter(r[0] for r in rows))
print("sample:", rows[0], rows[-1], sep="\n")
