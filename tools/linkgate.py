#!/usr/bin/env python3
"""Completeness + live-URL gate for every clickable entity in the board.

Dumps the app's in-memory ARCH / LINKS / INDUSTRIES with tools/pw_dump.js (served
over HTTP, every industry loaded), then:
  * every Databricks product (a band tile whose LINKS entry has a `doc` path)
    must also carry `site` and `blog` (Bronze/Silver/Gold exempt from `site`,
    they are medallion concepts); the late-added products must exist, and a
    `docClouds` list limits a doc path to the clouds that publish it.
  * every Source tile, generic and per industry, must carry what / users /
    dataOut(+vol); data-format tiles (standards, not systems) are exempt.
  * every industry use case must carry at least one customer story.
  * every certification maps onto a real platform box or Teams box, links to
    databricks.com, and each team's cloud badges cover every cloud.
With --urls it HEAD-checks every outbound URL (YouTube via oEmbed) in parallel
and fails on any dead link. Exit non-zero on any failure so it gates a push.
"""
import argparse, concurrent.futures as cf, glob, json, os, re, shutil, subprocess, tempfile, urllib.request, urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Official Databricks YouTube channel author_name as reported by oEmbed. A video
# in LINKS[name].videos is only legitimate if oEmbed says it lives here AND its
# title carries the feature name (there is no human review step, so the gate is
# the review). Anything else is a third-party upload and must be rejected.
OFFICIAL_YT = {"Databricks", "Databricks Events"}

# Medallion tiers are architecture concepts, not products with a landing page.
SITE_EXEMPT = {"Bronze", "Silver", "Gold"}
# Platform tiles that MUST carry a full LINKS entry (doc/site/blog). These are
# real product tiles in ARCH.bands; "Omnigent" is intentionally NOT here because
# it is an Apache-2.0 OSS project with a GitHub home and no Databricks doc path.
REQUIRED_PRODUCTS = ["Streaming", "Document Intelligence"]
DOC_HOSTS = {"aws": "https://docs.databricks.com/aws/en/",
             "azure": "https://learn.microsoft.com/azure/databricks/",
             "gcp": "https://docs.databricks.com/gcp/en/"}
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36"
RETIRED_NAME = "Data Intelligence Platform"
ARCHIVED_REPO = "interactive-databricks-enterprise-architecture"
ARCHIVED_REPO_OK = {"CLAUDE.md"}
SELLER_PHRASES = ("customer meeting", "customer-ready", "in front of a customer", "in front of the customer",
                  "for a specific customer", "describe a customer", "describe the customer", "customer deploys",
                  "a customer can deploy", "you only pitch", "nobody pitches")
APP_OWNER_PENDING = {"app/ai/ai.js": (RETIRED_NAME, "describe a customer"), "app/mcp/server.py": (RETIRED_NAME,),
                     "tools/build_installer.py": (ARCHIVED_REPO,)}
CERT_FILE = os.path.join(ROOT, "app", "resources", "certifications.json")
CERT_KINDS = {"Certification", "Accreditation", "Badge"}
CERT_LEVELS = {"Associate", "Professional"}
OUTCOME_MAP_FILE = os.path.join(ROOT, "tools", "outcome_map.json")
LINKS_FILE = os.path.join(ROOT, "app", "resources", "links.json")
THIRD_PARTY = re.compile(r":cite$|^LINKS\[.*\]\.(site|url|also)$")
DATABRICKS_URL = re.compile(r"^https?://(([a-z0-9-]+\.)*databricks\.com|databricks[a-z0-9-]*\.github\.io|github\.com/databricks(labs)?(-[a-z0-9-]+)?)(/|$)", re.I)
STORY_EXEMPT_REASONS = {"no public story"}
STORY_EXEMPT = {
    "advertising": {"Agency Reconciliation": "no public story"},
    "apparel_fashion": {"3D Sample Reduction": "no public story", "Factory Risk Monitoring": "no public story", "Sustainable Sourcing": "no public story", "Wholesale Chargebacks": "no public story"},
    "crypto_digital_assets": {"Proof of Reserves": "no public story", "Treasury & Settlement": "no public story"},
    "data_centers": {"Financial Analytics": "no public story"},
    "edtech": {"Exam Integrity": "no public story"},
    "education": {"Research Compliance": "no public story", "Space & Scheduling": "no public story"},
    "genomics_biotech": {"Lab Turnaround Optimisation": "no public story"},
    "grocery": {"E-commerce Substitution": "no public story", "Labor Scheduling": "no public story", "Shrink Attribution": "no public story"},
    "insurance_pandc": {"Subrogation Recovery": "no public story"},
    "legal": {"Conflicts Screening": "no public story", "Docket Monitoring": "no public story", "Legal Research Analytics": "no public story", "Outside Counsel Spend": "no public story", "Time Entry Compliance": "no public story"},
    "life_insurance": {"Embedded Value": "no public story", "New Business Strain": "no public story"},
    "mortgage_lending": {"Lead & Pull-Through": "no public story", "Pipeline Hedging": "no public story"},
    "ngo": {"Grant Compliance": "no public story", "Sanctions Screening": "no public story"},
    "payments_fintech": {"Interchange Optimisation": "no public story", "Payment Routing": "no public story"},
    "professional_services": {"Proposal Analytics": "no public story"},
    "real_estate": {"CAM Reconciliation": "no public story", "Capex Planning": "no public story"},
    "restaurants": {"Franchise Compliance": "no public story", "New Store Analytics": "no public story", "Shrink & Void Control": "no public story"},
    "sports_entertainment": {"Broadcast Highlights": "no public story", "Crowd Safety Analytics": "no public story"},
    "staffing_hr": {"Client Profitability": "no public story", "Overtime Control": "no public story"},
    "waste_management": {"Disposal & Transfer Logistics": "no public story", "Dynamic Pricing & Working Capital": "no public story"},
    "water_utilities": {"Pressure Management": "no public story"},
}


def dump():
    tmp = tempfile.mkdtemp()
    out = os.path.join(tmp, "dump.json")
    try:
        res = subprocess.run(["node", os.path.join(ROOT, "tools", "pw_dump.js"), out],
                             capture_output=True, text=True, timeout=300)
        try:
            return json.load(open(out, encoding="utf-8"))
        except (OSError, ValueError):
            raise SystemExit("dump failed; pw_dump.js stderr tail:\n" + res.stderr[-800:])
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def mentions(text, name):
    return name.lower() in text.lower()


def board_names(root=ROOT):
    names = set(re.findall(r'\bn:"([^"]+)"', open(os.path.join(root, "app", "index.html"), encoding="utf-8").read()))
    for f in glob.glob(os.path.join(root, "app", "architectures", "*.yaml")):
        for v in re.findall(r"^\s*(?:-\s+)?name:\s*(.+?)\s*$", open(f, encoding="utf-8").read(), re.M):
            names.add(v.strip("\"'"))
    with open(os.path.join(root, "app", "resources", "aliases.json"), encoding="utf-8") as fh:
        names |= set(json.load(fh).values())
    return names


def retired_refs(root=ROOT):
    listed = subprocess.run(["git", "-C", root, "ls-files", "-z"], capture_output=True, text=True, check=True).stdout
    tracked = list(filter(None, listed.split("\0")))
    fails = [f"owner-pending exemption names '{rel}', which is not a tracked file"
             for rel in APP_OWNER_PENDING if rel not in tracked]
    for rel in tracked:
        if os.path.abspath(os.path.join(root, rel)) == os.path.abspath(__file__):
            continue
        try:
            text = open(os.path.join(root, rel), encoding="utf-8").read()
        except (UnicodeDecodeError, OSError):
            continue
        pending = APP_OWNER_PENDING.get(rel, ())
        for p in pending:
            if not mentions(text, p):
                fails.append(f"owner-pending exemption for {rel} is stale: it no longer contains '{p}'")
        if rel == "app/resources/links.json":
            links = json.loads(text)
            for L in links.values():
                for v in (L.get("videos") or []) if isinstance(L, dict) else []:
                    if isinstance(v, dict):
                        v.pop("t", None)
                        v.pop("a", None)
            text = json.dumps(links)
        if mentions(text, RETIRED_NAME) and RETIRED_NAME not in pending:
            fails.append(f"retired product name '{RETIRED_NAME}' in {rel}")
        if mentions(text, ARCHIVED_REPO) and rel not in ARCHIVED_REPO_OK and ARCHIVED_REPO not in pending:
            fails.append(f"archived repo or site '{ARCHIVED_REPO}' in {rel}")
        for phrase in SELLER_PHRASES:
            if mentions(text, phrase) and phrase not in pending:
                fails.append(f"seller phrase '{phrase}' in {rel}: write to the reader, who may be a customer")
    return fails


FENCE = re.compile(r"^\s*```.*?^\s*```", re.M | re.S)
README_LINK = re.compile(r"!?\[[^\]]*\]\(([^)\s]+)(?:\s+\"[^\"]*\")?\)|\b(?:src|href)=\"([^\"]+)\"")


def heading_slugs(markdown):
    seen, slugs = {}, set()
    for line in FENCE.sub("", markdown).split("\n"):
        m = re.match(r"#{1,6} +(.+?) *#*$", line)
        if not m:
            continue
        base = re.sub(r"[^\w\- ]", "", m.group(1).strip().lower()).replace(" ", "-")
        n = seen.get(base, 0)
        seen[base] = n + 1
        slugs.add(base if n == 0 else f"{base}-{n}")
    return slugs


def readme_refs(root=ROOT):
    listed = subprocess.run(["git", "-C", root, "ls-files", "-z"], capture_output=True, text=True, check=True).stdout
    tracked = set(filter(None, listed.split("\0")))
    dirs = {os.path.dirname(p) for p in tracked}
    for d in list(dirs):
        while d:
            d = os.path.dirname(d)
            dirs.add(d)
    text = open(os.path.join(root, "README.md"), encoding="utf-8").read()
    slugs, fails = heading_slugs(text), []
    for m in README_LINK.finditer(FENCE.sub("", text)):
        target = m.group(1) or m.group(2)
        if re.match(r"[a-z][a-z0-9+.-]*:", target, re.I):
            continue
        if target.startswith("#"):
            if target[1:] not in slugs:
                fails.append(f"README links to '{target}', which is not a heading in README.md")
            continue
        rel = os.path.normpath(target.split("#")[0].split("?")[0])
        if rel not in tracked and rel not in dirs:
            fails.append(f"README links to '{rel}', which is not a tracked file")
    return fails


def cert_checks(d, certs):
    fails = []
    creds = certs.get("creds") or {}
    by_prod = certs.get("byProduct") or {}
    by_pers = certs.get("byPersona") or {}
    if not creds or not by_prod or not by_pers:
        fails.append("certifications.json has no credentials, products or teams")
    prods = set(d.get("prodNames") or [])
    personas = set(d.get("personas") or [])
    if not personas:
        fails.append("dump has no Teams boxes, so no certification team check ran")
    for k in by_prod:
        if k not in prods:
            fails.append(f"certifications: product '{k}' is not a platform box")
    for k in by_pers:
        if personas and k not in personas:
            fails.append(f"certifications: team '{k}' is not a Teams box on the reference board")
    used = set()
    for where, table in (("byProduct", by_prod), ("byPersona", by_pers)):
        for k, ids in table.items():
            for cid in ids:
                used.add(cid)
                if cid not in creds:
                    fails.append(f"certifications: {where}['{k}'] names unknown credential '{cid}'")
    for cid, rec in creds.items():
        host = (urllib.parse.urlsplit(rec.get("u") or "").hostname or "").lower()
        if cid not in used:
            fails.append(f"certifications: credential '{cid}' is attached to nothing")
        if not (host == "databricks.com" or host.endswith(".databricks.com")):
            fails.append(f"certifications: '{cid}' links off Databricks: {rec.get('u')}")
        if not rec.get("t"):
            fails.append(f"certifications: '{cid}' has no name")
        if rec.get("kind") not in CERT_KINDS:
            fails.append(f"certifications: '{cid}' has unknown kind '{rec.get('kind')}'")
        if rec.get("level") and rec["level"] not in CERT_LEVELS:
            fails.append(f"certifications: '{cid}' has unknown level '{rec['level']}'")
        if rec.get("cloud") and rec["cloud"] not in DOC_HOSTS:
            fails.append(f"certifications: '{cid}' has unknown cloud '{rec['cloud']}'")
    for k, ids in by_pers.items():
        clouds = sorted(creds[i]["cloud"] for i in ids if i in creds and creds[i].get("cloud"))
        if clouds and clouds != sorted(DOC_HOSTS):
            fails.append(f"certifications: team '{k}' needs one cloud badge per cloud, has {clouds}")
    return fails


def outcome_map_checks(inds, om):
    if not isinstance(om, dict):
        return ["outcome_map.json is not an object"]
    fails = []
    for iid, names in om.items():
        if not isinstance(names, list) or not all(isinstance(n, str) and n.strip() for n in names):
            fails.append(f"outcome map for '{iid}' must be a list of use-case names")
            continue
        if len(set(names)) != len(names):
            fails.append(f"outcome map for '{iid}' repeats a use case")
        if iid not in inds:
            fails.append(f"outcome map names '{iid}', which is not an industry board")
            continue
        have = {uc["n"] for uc in inds[iid]["uc"]}
        for n in names:
            if n not in have:
                fails.append(f"{iid}: outcome-map use case '{n}' is not on the board; it leaves only with its entry in tools/outcome_map.json")
    return fails


def team_ref_checks(inds, gen, shared, aliases):
    fails, teams = [], 0
    boards = dict({"generic": gen} if gen else {}, **inds)
    known = set(shared) | set(aliases)
    for iid, o in boards.items():
        names, tops = set(o.get("names") or []), set(o.get("top") or [])
        for t in o.get("teams") or []:
            teams += 1
            for n in t.get("ucs") or []:
                if n not in tops:
                    fails.append(f"{iid}: team '{t['n']}' lists the use case '{n}', which is not on the board")
            for n in t.get("uses") or []:
                if n not in names and n not in known:
                    fails.append(f"{iid}: team '{t['n']}' uses '{n}', which is no box on the board and no platform product")
    if not teams:
        fails.append("no Teams box loaded, so no team reference check ran")
    return fails, teams


def story_checks(inds, exempt_map, om):
    fails, missing = [], 0
    for iid, o in inds.items():
        exempt, mapped = exempt_map.get(iid, {}), set(om.get(iid) or [])
        by_name = {uc["n"]: uc for uc in o["uc"]}
        for uc in o["uc"]:
            if not uc["stories"] and uc["n"] not in exempt and uc["n"] not in mapped:
                missing += 1
                fails.append(f"{iid}: use case '{uc['n']}' has no story")
        for n, why in exempt.items():
            if why not in STORY_EXEMPT_REASONS:
                fails.append(f"{iid}: story exemption for '{n}' has an unknown reason '{why}'")
            elif n not in by_name:
                fails.append(f"{iid}: story exemption for '{n}' matches no use case")
            elif by_name[n]["stories"]:
                fails.append(f"{iid}: story exemption for '{n}' is stale, it now has a story")
            elif n in mapped:
                fails.append(f"{iid}: '{n}' is an outcome-map use case, so it needs no story exemption")
    if inds:
        for iid in exempt_map:
            if iid not in inds:
                fails.append(f"story exemptions name '{iid}', which is not an industry board")
    return fails, missing


def alias_checks(aliases, links, accels, academy, certs):
    if not isinstance(aliases, dict):
        return ["aliases.json is not an object"]
    catalog = (set(links or {}) | set(accels or {}) | set((academy or {}).get("byProduct") or {})
               | set((certs or {}).get("byProduct") or {}))
    fails = []
    for k, v in aliases.items():
        if not isinstance(k, str) or not k.strip() or not isinstance(v, str) or not v.strip():
            fails.append(f"alias {k!r} -> {v!r} must map a tile name to a catalog name")
            continue
        if k == v:
            fails.append(f"alias '{k}' points at itself")
        elif v in aliases:
            fails.append(f"alias '{k}' -> '{v}' chains to another alias")
        elif v not in catalog:
            fails.append(f"alias '{k}' -> '{v}' names no LINKS, accelerator, course or certification entry")
        if k in catalog:
            fails.append(f"alias '{k}' shadows the catalog entry of the same name")
    return fails


def chip_alias_checks(alias, chips, links):
    if not isinstance(alias, dict) or not alias:
        return ["CHIP_ALIAS did not load, so no chip alias check ran"]
    used = set(chips or [])
    fails = []
    for k, v in alias.items():
        if k == v:
            fails.append(f"CHIP_ALIAS '{k}' points at itself")
        elif k not in used:
            fails.append(f"CHIP_ALIAS '{k}' names no capability or related chip on any board: rename it with its chip or remove it")
        if v not in (links or {}):
            fails.append(f"CHIP_ALIAS '{k}' -> '{v}' names no LINKS entry")
    return fails

def doc_clouds_checks(links):
    fails = []
    for name, L in links.items():
        if not isinstance(L, dict) or "docClouds" not in L:
            continue
        dc = L["docClouds"]
        if not L.get("doc") or not isinstance(dc, list) or not dc or set(dc) - set(DOC_HOSTS):
            fails.append(f"LINKS[{name}].docClouds must be a non-empty list drawn from {sorted(DOC_HOSTS)} "
                         f"on an entry with a doc path, got {dc!r}")
    return fails


def write_links(links):
    open(LINKS_FILE, "w", encoding="utf-8").write(json.dumps(links, ensure_ascii=True))


def highlight_urls(urls):
    return {u: w for u, w in urls.items() if DATABRICKS_URL.match(u) or any(not THIRD_PARTY.search(x) for x in w)}


def collect_urls(d, certs=None):
    """Every outbound URL a click can reach, tagged with where it came from."""
    urls = {}
    def add(u, where):
        if u and isinstance(u, str) and u.startswith("http"):
            urls.setdefault(u, set()).add(where)
    for cid, rec in ((certs or {}).get("creds") or {}).items():
        add(rec.get("u"), f"certifications[{cid}]")
        add(rec.get("guide"), f"certifications[{cid}].guide")
    LINKS = d["LINKS"]
    for name, L in LINKS.items():
        if not isinstance(L, dict):
            continue
        if L.get("doc"):
            for cl, hostp in DOC_HOSTS.items():
                if cl in (L.get("docClouds") or DOC_HOSTS):
                    add(hostp + str(L["doc"]).lstrip("/"), f"LINKS[{name}].doc/{cl}")
        if L.get("dbx"):
            add(DOC_HOSTS["aws"] + str(L["dbx"]).lstrip("/"), f"LINKS[{name}].dbx")
        for k in ("site", "blog", "url", "video"):
            if L.get(k):
                add(L[k], f"LINKS[{name}].{k}")
        # `videos` list is verified separately (check_video) for channel + title,
        # not just liveness, so it is intentionally not added to the plain pool.
        for pair in (L.get("also") or []):
            if isinstance(pair, list) and len(pair) == 2:
                add(pair[1], f"LINKS[{name}].also")
        # Product tours and hands-on tutorials shown in the drawer (build_demos.py).
        for dm in (L.get("demos") or []):
            if isinstance(dm, dict) and dm.get("u"):
                add(dm["u"], f"LINKS[{name}].demos/{dm.get('kind', '?')}")
    for iid, o in d["inds"].items():
        for uc in o["uc"]:
            for u in uc["stories"]:
                add(u, f"{iid}:uc:{uc['n']}")
        for u in o["cites"]:
            add(u, f"{iid}:cite")
    return urls


def _norm(s):
    """Lowercase, strip everything but alphanumerics to single spaces, so
    'AI/BI' matches 'AI BI' and 'Unity Catalog' matches 'unity  catalog'."""
    return re.sub(r"[^a-z0-9]+", " ", (s or "").lower()).strip()


def check_video(vid, feature, alias=None):
    """oEmbed check for a LINKS videos entry: exists, lives on the official
    Databricks channel, and its title carries the feature name OR a declared
    alias (a renamed / prior product name, e.g. AI Search's 'Vector Search').
    The alias is verified the same way (whole-phrase, official channel), so a
    rename never opens the gate to an unrelated video. Returns (ok, detail):
    detail is the real title on success or the reason on failure."""
    url = "https://www.youtube.com/watch?v=" + vid
    oe = "https://www.youtube.com/oembed?format=json&url=" + urllib.parse.quote(url, safe="")
    try:
        req = urllib.request.Request(oe, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=20) as r:
            if r.status != 200:
                return (False, f"oembed http {r.status}")
            meta = json.loads(r.read().decode("utf-8"))
    except Exception as e:
        return (False, f"oembed error {str(e)[:50]}")
    author = (meta.get("author_name") or "").strip()
    title = meta.get("title") or ""
    if author not in OFFICIAL_YT:
        return (False, f"channel '{author}' not official Databricks")
    hay = " " + _norm(title) + " "
    terms = [feature] + ([alias] if alias else [])
    if not any((" " + _norm(t) + " ") in hay for t in terms if _norm(t)):
        want = "' / '".join(terms)
        return (False, f"title lacks feature/alias '{want}': '{title}'")
    return (True, title)


def check_url(u):
    """Return (ok, code). YouTube via oEmbed existence check; others HEAD->GET."""
    try:
        if "youtube.com/watch" in u or "youtu.be/" in u:
            oe = "https://www.youtube.com/oembed?format=json&url=" + urllib.parse.quote(u, safe="")
            req = urllib.request.Request(oe, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=20) as r:
                return (r.status == 200, r.status)
        for method in ("HEAD", "GET"):
            req = urllib.request.Request(u, method=method, headers={"User-Agent": UA})
            try:
                with urllib.request.urlopen(req, timeout=25) as r:
                    return (200 <= r.status < 400, r.status)
            except urllib.error.HTTPError as e:
                if e.code in (403, 405, 429) and method == "HEAD":
                    continue  # some hosts block HEAD; retry GET
                return (e.code in (403, 429), e.code)  # 403/429 = bot-blocked, treat as WARN-ok
        return (False, 0)
    except Exception as e:
        return (False, str(e)[:60])


import urllib.parse


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--urls", action="store_true", help="live-check every outbound URL")
    ap.add_argument("--scope", choices=["all", "highlights"], default="all",
                    help="with --urls: 'highlights' checks what the board offers as a highlight or Databricks link "
                         "and skips third-party citations and competitor sites")
    ap.add_argument("--dump-file", help="read a pre-dumped ARCH/LINKS JSON (from tools/pw_dump.js) "
                    "instead of launching Chrome; use when the default Chrome profile is locked")
    args = ap.parse_args()
    d = json.load(open(args.dump_file)) if args.dump_file else dump()
    fails = retired_refs() + readme_refs()
    print(f"retired names / archived repo references: {len(fails)}")
    if not d.get("LINKS"):
        fails.append("LINKS did not load, so no product, see-also or video check ran")
    if not d.get("inds"):
        fails.append("no industry board loaded, so no industry check ran")
    for iid in d.get("load_failed") or []:
        fails.append(f"industry '{iid}' failed to load")

    # ---- Products ----
    LINKS = d["LINKS"]
    prod = [n for n in d["prodNames"] if isinstance(LINKS.get(n), dict) and LINKS[n].get("doc")]
    for n in prod:
        L = LINKS[n]
        if n not in SITE_EXEMPT and not L.get("site"):
            fails.append(f"product '{n}' missing site (landing)")
        if not L.get("blog"):
            fails.append(f"product '{n}' missing blog")
    for n in REQUIRED_PRODUCTS:
        L = LINKS.get(n)
        if not isinstance(L, dict) or not L.get("doc") or not L.get("site") or not L.get("blog"):
            fails.append(f"required product '{n}' missing LINKS doc/site/blog")
    print(f"products checked: {len(prod)} (doc-bearing) + {len(REQUIRED_PRODUCTS)} required")
    dcf = doc_clouds_checks(LINKS)
    fails += dcf
    print(f"cloud-limited doc paths checked: {sum(1 for L in LINKS.values() if isinstance(L, dict) and 'docClouds' in L)}, "
          f"issues: {len(dcf)}")

    # ---- See-also references must resolve to a real, linkable feature ----
    sa_refs = 0
    for name, L in LINKS.items():
        if not isinstance(L, dict):
            continue
        for ref in (L.get("seealso") or []):
            sa_refs += 1
            tgt = LINKS.get(ref)
            if not isinstance(tgt, dict):
                fails.append(f"seealso '{ref}' (from '{name}') is not a LINKS feature")
            elif not (tgt.get("doc") or tgt.get("dbx") or tgt.get("site") or tgt.get("url")):
                fails.append(f"seealso '{ref}' (from '{name}') has no linkable URL")
            elif ref == name:
                fails.append(f"seealso '{ref}' points at itself")
    print(f"see-also references checked: {sa_refs}")

    # ---- Generic sources ----
    gbad = [r["n"] for r in d["genSrc"] if not r.get("fmt") and not (r["what"] and r["users"] and r["dataOut"] and r["vol"])]
    if gbad:
        fails.append(f"generic sources missing what/users/dataOut+vol: {gbad}")
    print(f"generic sources: {len(d['genSrc'])} tiles, incomplete: {len(gbad)}")

    # ---- Industry sources + use-case stories ----
    src_bad = 0
    for iid, o in d["inds"].items():
        for r in o["src"]:
            if not r.get("fmt") and not (r["what"] and r["users"] and r["dataOut"] and r["vol"]):
                src_bad += 1; fails.append(f"{iid}: source '{r['n']}' incomplete")
    try:
        om = json.load(open(OUTCOME_MAP_FILE, encoding="utf-8"))
    except (OSError, ValueError) as e:
        om = {}
        fails.append(f"tools/outcome_map.json unreadable: {e}")
    om_fails = outcome_map_checks(d["inds"], om) if d["inds"] else []
    st_fails, uc_bad = story_checks(d["inds"], STORY_EXEMPT, om if isinstance(om, dict) else {})
    fails += om_fails + st_fails
    n_exempt = sum(len(v) for v in STORY_EXEMPT.values())
    print(f"industry sources incomplete: {src_bad}")
    print(f"outcome-map use cases: {sum(len(v) for v in om.values()) if isinstance(om, dict) else 0} on "
          f"{len(om) if isinstance(om, dict) else 0} boards, missing from their board: {len(om_fails)}")
    print(f"industry use cases without a story: {uc_bad} (outcome map or exempt as no public story: {n_exempt})")

    try:
        certs = json.load(open(CERT_FILE, encoding="utf-8"))
    except (OSError, ValueError) as e:
        certs = {}
        fails.append(f"certifications.json unreadable: {e}")
    cfails = cert_checks(d, certs)
    fails += cfails
    print(f"certifications: {len(certs.get('creds') or {})} credentials on {len(certs.get('byProduct') or {})} "
          f"products and {len(certs.get('byPersona') or {})} teams, issues: {len(cfails)}")
    try:
        res = lambda n: json.load(open(os.path.join(ROOT, "app", "resources", n + ".json"), encoding="utf-8"))
        aliases = res("aliases")
        afails = alias_checks(aliases, LINKS, res("accelerators"), res("academy"), certs)
    except (OSError, ValueError) as e:
        aliases, afails = {}, [f"aliases.json, accelerators.json or academy.json unreadable: {e}"]
    fails += afails
    print(f"tile aliases: {len(aliases)}, issues: {len(afails)}")
    shared = set(LINKS) | set(d.get("prodNames") or []) | set(d.get("cloudNames") or [])
    trfails, n_teams = team_ref_checks(d.get("inds") or {}, d.get("genBoard"), shared, aliases)
    fails += trfails
    print(f"team references: {n_teams} teams, use cases and boxes they name that are not on their board: {len(trfails)}")
    cafails = chip_alias_checks(d.get("chipAlias"), d.get("chips"), LINKS)
    fails += cafails
    print(f"chip aliases: {len(d.get('chipAlias') or {})} over {len(d.get('chips') or [])} chip names, issues: {len(cafails)}")

    # ---- Live URL check ----
    if args.urls:
        urls = collect_urls(d, certs)
        if args.scope == "highlights":
            urls = highlight_urls(urls)
        print(f"\nlive-checking {len(urls)} unique URLs ({args.scope}) ...")
        bad = []
        with cf.ThreadPoolExecutor(max_workers=24) as ex:
            futs = {ex.submit(check_url, u): u for u in urls}
            for fut in cf.as_completed(futs):
                u = futs[fut]; ok, code = fut.result()
                if not ok:
                    bad.append((u, code, sorted(urls[u])[:3]))
        for u, code, where in sorted(bad):
            fails.append(f"DEAD [{code}] {u}  <- {where}")
        print(f"dead URLs: {len(bad)}")

        # ---- Databricks YouTube videos (channel + title, not just liveness) ----
        vids = []  # (feature, id, title-as-declared, alias)
        for name, L in LINKS.items():
            if isinstance(L, dict):
                for v in (L.get("videos") or []):
                    if isinstance(v, dict) and v.get("id"):
                        vids.append((name, v["id"], v.get("t", ""), v.get("a")))
        vbad = 0
        if vids:
            print(f"verifying {len(vids)} Databricks YouTube videos ...")
            with cf.ThreadPoolExecutor(max_workers=12) as ex:
                futs = {ex.submit(check_video, vid, feat, alias): (feat, vid, decl) for feat, vid, decl, alias in vids}
                for fut in cf.as_completed(futs):
                    feat, vid, decl = futs[fut]
                    ok, detail = fut.result()
                    if not ok:
                        vbad += 1
                        fails.append(f"BAD VIDEO {vid} (LINKS[{feat}].videos): {detail}")
                    elif decl and _norm(decl) != _norm(detail):
                        vbad += 1
                        fails.append(f"VIDEO TITLE DRIFT {vid} (LINKS[{feat}]): declared '{decl}' != oembed '{detail}'")
        print(f"bad videos: {vbad}")

    print("\n" + "=" * 72)
    if fails:
        print(f"FAIL ({len(fails)} issues)")
        for f in fails:
            print("  -", f)
        raise SystemExit(1)
    print("PASS — every clickable entity is complete" + (" and every URL is live" if args.urls else ""))


if __name__ == "__main__":
    main()
