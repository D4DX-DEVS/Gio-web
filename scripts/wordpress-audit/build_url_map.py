"""Build docs/audit/inventory/url_map.csv and missing_from_media_api.csv from the audit inventories.

Planning artifact only: reads local snapshot files, makes no network requests.
Usage: python -I scripts/wordpress-audit/build_url_map.py <project-root>
"""
import csv
import json
import sys
from urllib.parse import urlsplit

root = sys.argv[1]
inv = f"{root}/docs/audit/inventory"
snap = f"{root}/migration/snapshot-2026-10-27"

# action, target, decision_status, note per URL type. "pending" rows need client approval (decision D4 / A3).
SAME = ("same_path", "", "verified")
RULES = {
    "post": SAME,
    "page": SAME,
    "archive": SAME,
    "pagination": SAME,
    "taxonomy-archive": SAME,
    "event-archive": SAME,
    "event": SAME,
    "author-archive": ("pending_decision", "/news-events/", "needs_client_approval"),
    "builder-template": ("pending_decision", "/", "needs_client_approval"),
    "error": ("pending_decision", "/", "needs_client_approval"),
    "theme-demo-cpt": ("pending_decision", "/", "needs_client_approval"),
}
# Individual URLs that are public but are themselves demo or placeholder content.
OVERRIDES = {
    "/event/lets-run-for-the-poor-children-education-3/": ("pending_decision", "/events/", "needs_client_approval", "theme demo event (venue New York)"),
    "/coming-soon/": ("pending_decision", "/", "needs_client_approval", "theme placeholder page"),
    "/causes/": ("pending_decision", "/", "needs_client_approval", "HTTP 500 on live site"),
}
DEMO_TARGETS = {"savelife_team": "/team/", "team_cat": "/team/"}

rows = list(csv.DictReader(open(f"{inv}/url_inventory.csv", encoding="utf-8-sig")))
out = []
for r in rows:
    path = urlsplit(r["url"]).path
    action, target, status = RULES[r["type"]]
    note = ""
    if r["type"] == "theme-demo-cpt":
        first = path.strip("/").split("/")[0]
        target = DEMO_TARGETS.get(first, "/")
        note = f"theme demo ({first}); recommended 301 to {target} or 410"
    if path in OVERRIDES:
        action, target, status, note = OVERRIDES[path]
    out.append({
        "old_url": r["url"], "old_path": path, "type": r["type"], "live_status": r["status"],
        "in_sitemap": r["in_sitemap"], "new_path": path if action == "same_path" else "",
        "action": action, "recommended_target": target, "decision_status": status, "note": note,
    })

with open(f"{inv}/url_map.csv", "w", newline="", encoding="utf-8-sig") as f:
    w = csv.DictWriter(f, fieldnames=list(out[0]))
    w.writeheader()
    w.writerows(out)

heads = {h[0]: h for h in json.load(open(f"{snap}/asset_heads.json", encoding="utf-8"))}
assets = list(csv.DictReader(open(f"{inv}/asset_inventory.csv", encoding="utf-8-sig")))
miss = []
for a in assets:
    if a["in_media_api"] != "NO":
        continue
    h = heads.get(a["file_url"], [None, "not probed", 0, ""])
    refs = a["referenced_on_sample"]
    real = any(p for p in refs.split(" | ") if "savelife" not in p and "lets-run" not in p and "elementor-hf" not in p)
    miss.append({
        "file_url": a["file_url"], "live_status": h[1], "bytes": h[2], "mime": h[3],
        "referenced_on_count": a["referenced_on_count"], "referenced_on_sample": refs,
        "used_by_real_content": "yes" if real else "no (demo only)",
        "plan": "download by URL, store at same key, media row source=html_ref" if h[1] == 200
                else "unrecoverable from live; request from uploads archive; demo only",
    })
with open(f"{inv}/missing_from_media_api.csv", "w", newline="", encoding="utf-8-sig") as f:
    w = csv.DictWriter(f, fieldnames=list(miss[0]))
    w.writeheader()
    w.writerows(miss)

print(len(out), "url rows;", sum(1 for o in out if o["decision_status"] == "verified"), "verified;",
      len(miss), "missing-from-api files;", sum(1 for m in miss if m["live_status"] == 200), "reachable")
