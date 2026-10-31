import json, re, sys, os, urllib.request, urllib.error, time
OUT = sys.argv[1]
UA = {"User-Agent": "Mozilla/5.0 (read-only audit)"}
BASE = "https://www.giokerala.org"

def get(url, raw=False):
    req = urllib.request.Request(url, headers=UA)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            body = r.read()
            return r.status, dict(r.headers), body
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), e.read()
    except Exception as e:
        return 0, {}, str(e).encode()

# 1. sitemaps
idx = open(os.path.join(OUT, "sitemap_index.xml"), encoding="utf-8").read()
maps = re.findall(r"<loc>([^<]+)</loc>", idx)
sitemap_urls = {}
for m in maps:
    st, h, b = get(m)
    locs = re.findall(r"<loc>([^<]+)</loc>", b.decode("utf-8", "replace"))
    # sitemap image entries are also <loc> inside <image:loc>; separate them
    txt = b.decode("utf-8", "replace")
    pages = re.findall(r"<url>\s*<loc>([^<]+)</loc>", txt)
    imgs = re.findall(r"<image:loc>([^<]+)</image:loc>", txt)
    sitemap_urls[m.rsplit("/", 1)[1]] = {"status": st, "urls": pages, "images": imgs}
    print(f"{m.rsplit('/',1)[1]:40} {st} urls={len(pages)} imgs={len(imgs)}")
json.dump(sitemap_urls, open(os.path.join(OUT, "sitemaps.json"), "w"), indent=1)

# 2. REST collection totals
cols = ["posts", "pages", "media", "categories", "tags", "users", "comments", "menus", "menu-items",
        "navigation", "blocks", "tribe_events", "tribe_venue", "tribe_organizer", "tribe_events_cat",
        "blog_post", "blog-category", "vid_playlist_ytub", "e-floating-buttons", "elementor_library",
        "elementskit-content", "elementskit-template", "sp_wpcp_template", "templately_library",
        "tec_calendar_embed", "types", "taxonomies", "settings", "menu-locations", "sidebars", "widgets"]
res = {}
for c in cols:
    st, h, b = get(f"{BASE}/wp-json/wp/v2/{c}?per_page=1")
    tot = h.get("X-WP-Total") or h.get("x-wp-total")
    note = ""
    if st != 200:
        try: note = json.loads(b).get("code", "")
        except Exception: note = b[:80]
    res[c] = {"status": st, "total": tot, "note": str(note)}
    print(f"{c:25} {st} total={tot} {note}")
json.dump(res, open(os.path.join(OUT, "rest_totals.json"), "w"), indent=1)

st, h, b = get(f"{BASE}/wp-json/wp/v2/types")
if st == 200:
    t = json.loads(b)
    print("\nTYPES:")
    for k, v in t.items():
        print(f"  {k:28} rest_base={v.get('rest_base')} name={v.get('name')}")
st, h, b = get(f"{BASE}/wp-json/wp/v2/taxonomies")
if st == 200:
    t = json.loads(b)
    print("\nTAXONOMIES:")
    for k, v in t.items():
        print(f"  {k:28} rest_base={v.get('rest_base')} types={v.get('types')}")
