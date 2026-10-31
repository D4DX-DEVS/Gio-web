import json, sys, os, urllib.request, urllib.error
OUT = os.path.join(sys.argv[1], "rest")
os.makedirs(OUT, exist_ok=True)
UA = {"User-Agent": "Mozilla/5.0 (read-only audit)"}
BASE = "https://www.giokerala.org/wp-json"

def get(url):
    req = urllib.request.Request(url, headers=UA)
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            return r.status, dict(r.headers), r.read()
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), e.read()

def paged(path, extra=""):
    items, page = [], 1
    while True:
        st, h, b = get(f"{BASE}{path}?per_page=100&page={page}{extra}")
        if st != 200: break
        d = json.loads(b)
        if not d: break
        items += d
        tp = int(h.get("X-WP-TotalPages") or h.get("x-wp-totalpages") or 1)
        if page >= tp: break
        page += 1
    return items

for name, path in [("posts", "/wp/v2/posts"), ("pages", "/wp/v2/pages"), ("media", "/wp/v2/media"),
                   ("categories", "/wp/v2/categories"), ("tags", "/wp/v2/tags"), ("users", "/wp/v2/users"),
                   ("navigation", "/wp/v2/navigation"), ("tribe_venue", "/wp/v2/tribe_venue"),
                   ("tribe_organizer", "/wp/v2/tribe_organizer"), ("tribe_events_cat", "/wp/v2/tribe_events_cat"),
                   ("vid_playlist_ytub", "/wp/v2/vid_playlist_ytub")]:
    d = paged(path)
    json.dump(d, open(os.path.join(OUT, name + ".json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(name, len(d))

# Events Calendar own API (includes past events with start_date far back)
evs, page = [], 1
while True:
    st, h, b = get(f"{BASE}/tribe/events/v1/events?per_page=50&page={page}&start_date=2000-01-01&end_date=2100-01-01&status=publish")
    if st != 200:
        print("tribe events api", st, b[:200]); break
    d = json.loads(b)
    evs += d.get("events", [])
    if page >= d.get("total_pages", 1): break
    page += 1
json.dump(evs, open(os.path.join(OUT, "tribe_events_v1.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("tribe_events(v1)", len(evs))

# probe theme CPTs on REST just in case
for cpt in ["savelife_project", "savelife_team", "save_testimonials", "savelife_faqs", "nekit-mm-cpt", "elementor-hf"]:
    st, h, b = get(f"{BASE}/wp/v2/{cpt}")
    print("probe", cpt, st)
