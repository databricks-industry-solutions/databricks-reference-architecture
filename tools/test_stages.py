#!/usr/bin/env python3
import contextlib, copy, importlib.util, json, os, re, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load(name):
    spec = importlib.util.spec_from_file_location(name, os.path.join(ROOT, "tools", name + ".py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


ss = load("scrape_stages")
results = []


def check(name, cond, detail=""):
    results.append((name, bool(cond), detail))


@contextlib.contextmanager
def patched(mod, **kw):
    saved = {k: getattr(mod, k) for k in kw}
    for k, v in kw.items():
        setattr(mod, k, v)
    try:
        yield
    finally:
        for k, v in saved.items():
            setattr(mod, k, v)


def crumbs_html(crumbs):
    items = []
    for label, href in crumbs:
        if href:
            items.append(f'<li class="breadcrumbs__item"><a class="breadcrumbs__link" href="{href}"><span>{label}</span></a></li>')
        else:
            items.append(f'<li class="breadcrumbs__item"><span class="breadcrumbs__link" aria-current="page"><span>{label}</span></span></li>')
    return '<nav aria-label="Breadcrumbs"><ul class="breadcrumbs">' + "".join(items) + "</ul></nav>"


def box(text, head="note"):
    return (f'<div class="theme-admonition theme-admonition-{head} alert"><div class="admonitionHeading"><span>'
            f'<svg viewBox="0 0 14 16"><path d="M7 2"/></svg></span>{head}</div>'
            f'<div class="admonitionContent"><p>{text}</p></div></div>')


def dbx(h1, top="", later="", crumbs=None):
    return ("<html><head><script>var s='This feature is in Beta';</script></head><body>"
            + (crumbs_html(crumbs) if crumbs else "")
            + f'<article><header><h1>{h1}</h1></header>{top}<p>Intro.</p><h2 id="more">More</h2>{later}</article></body></html>')


def learn(h1, top="", later=""):
    return (f'<html><body><h1>{h1}</h1><nav id="center-doc-outline"><h2 id="ms--in-this-article">In this article</h2></nav>'
            f'<div class="content">{top}<p>Intro.</p><h2 id="next">Next</h2>{later}</div></body></html>')


def stage(page_html):
    return ss.notice_stage(ss.parse(page_html))


LINKED = 'This feature is in <a class="" href=/aws/en/release-notes/release-types>{}</a>. Reach out to your account team.'
check("a linked Beta notice at the top of a docs.databricks.com page reads Beta", stage(dbx("Lakehouse//RT", box(LINKED.format("Beta"), "beta"))) == "Beta")
check("a Learn IMPORTANT box reads its stage, past the 'In this article' heading",
      stage(learn("Genie Ontology", '<div class="IMPORTANT"><p>Important</p><p>This feature is in <a href="../../release-notes/release-types">Public Preview</a>.</p></div>')) == "Public Preview")
check("an unlinked notice still counts", stage(dbx("MySQL ingestion connector", box("The MySQL connector is in Public Preview. Contact your account team.", "info"))) == "Public Preview")
check("an 'available in Beta on <cloud>' notice counts", stage(dbx("Lakebase", box("As of June 15, Lakebase is available in Beta on GCP."))) == "Beta")
check("a Private Preview notice reads Private Preview", stage(dbx("X", box(LINKED.format("Private Preview")))) == "Private Preview")
check("a page without a top notice reads GA", stage(dbx("Unity Catalog", "<p>Govern everything.</p>")) == "GA")
check("'connectors are in various release states' is not a stage", stage(dbx("Lakeflow Connect", box('Lakeflow Connect connectors are in various <a href="/aws/en/release-notes/release-types">release states</a>.'))) == "GA")
check("'is in active development' is not a stage", stage(dbx("Lakehouse//RT", box("Lakehouse//RT is in active development."))) == "GA")
check("a sub-feature notice below the first section heading is ignored", stage(dbx("Genie One", "", box(LINKED.format("Public Preview")))) == "GA")
check("a stage sentence outside a notice box is ignored", stage(dbx("Auto Loader", "<p>Ingesting files as FILE is in Beta.</p>")) == "GA")
check("a stage inside a script is ignored", stage(dbx("Delta Lake")) == "GA")
check("on Learn, a box after the first real heading is ignored", stage(learn("Genie One", "", '<div class="IMPORTANT"><p>This feature is in Beta.</p></div>')) == "GA")
check("the first notice wins when two boxes carry a stage", stage(dbx("X", box(LINKED.format("Beta")) + box(LINKED.format("Public Preview")))) == "Beta")

LTAP_AWS = ("<table><tr><th>Capability<th>Status<th>Description<tr><td>Register Lakebase in Unity Catalog<td>GA<td>a"
            "<tr><td>Serve data with synced tables<td>GA<td>b<tr><td>Lakehouse//RT querying Lakebase<td>Beta<td>c"
            "<tr><td>Lakebase Change Data Feed<td>Public Preview<td>d</table>")
LTAP_GCP = LTAP_AWS.replace("<td>Beta<td>c", "<td>Not available on GCP<td>c").replace("<td>Public Preview<td>d", "<td>Not available on GCP<td>d")
check("a capability table reads its least mature status", ss.capability_stage(LTAP_AWS) == "Beta")
check("'Not available on <cloud>' in a capability table reads Coming soon", ss.capability_stage(LTAP_GCP) == "Coming soon")
LTAP_SUB = (LTAP_AWS.replace("<td>Beta<td>c", "<td>GA<td>c").replace("<td>Public Preview<td>d", "<td>GA<td>d")
            .replace("<td>GA<td>b", "<td>GA (LTAP Direct Writes: Beta)<td>b"))
check("a status that names a sub-capability reads the less mature of the two", ss.status_of("GA (LTAP Direct Writes: Beta)") == "Beta")
check("a capability table counts a sub-capability's stage", ss.capability_stage(LTAP_SUB) == "Beta")
for label, page_html in (("an unknown status", LTAP_AWS.replace("<td>Beta<td>c", "<td>Soonish<td>c")),
                         ("a sub-capability with an unknown status", LTAP_AWS.replace("<td>GA<td>b", "<td>GA (LTAP Direct Writes: Soonish)<td>b")),
                         ("no capability table", "<table><tr><th>Component<th>Description<tr><td>a<td>b</table>")):
    try:
        ss.capability_stage(page_html)
        check(f"a capability page with {label} is refused", False)
    except ValueError:
        check(f"a capability page with {label} is refused", True)

HOME = [("", "/aws/en/"), ("Data engineering", "/aws/en/data-engineering/"), ("Lakeflow Connect", "/aws/en/ingestion/overview")]
landing = ss.parse(dbx("GitLab connector", crumbs=HOME + [("SaaS connectors", "/aws/en/ingestion/lakeflow-connect/saas-overview"), ("GitLab", "")]))
overview = ss.parse(dbx("Zendesk Support connector overview", crumbs=HOME + [("SaaS connectors", "/x"), ("Zendesk Support", "")]))
setup = ss.parse(dbx("Configure OAuth U2M for Confluence ingestion", crumbs=HOME + [("SaaS connectors", "/x"), ("Confluence", "/aws/en/ingestion/lakeflow-connect/confluence"), ("Set up data source", "")]))
howto = ss.parse(dbx("Create a query-based ingestion pipeline", crumbs=HOME + [("Query-based connectors", "/x"), ("Create ingestion pipeline", "")]))
pattern = ss.parse(dbx("Enable history tracking (SCD type 2) connector", crumbs=HOME + [("Common patterns", "/x"), ("History tracking", "")]))
check("a connector landing page is recognised", ss.is_connector_landing(landing))
check("a landing page titled '<name> connector overview' is recognised", ss.is_connector_landing(overview))
check("a setup page is not a landing page", not ss.is_connector_landing(setup))
check("a setup page points back to its connector's landing page", ss.landing_crumb(setup) == ("Confluence", "/aws/en/ingestion/lakeflow-connect/confluence"), ss.landing_crumb(setup))
check("a how-to page under a connector category is not a connector", not ss.is_connector_landing(howto))
check("a page outside a connector category is not a connector, whatever its title", not ss.is_connector_landing(pattern))
check("the breadcrumb home link has an empty label", landing.crumbs[0] == ("", "/aws/en/"), landing.crumbs[:1])
INDEX = ('<nav><a href="/aws/en/ingestion/lakeflow-connect/sidebar-only">Sidebar</a></nav><h1>SaaS connectors</h1>'
         '<a href=/aws/en/ingestion/lakeflow-connect/gitlab>GitLab</a> <a href="/aws/en/ingestion/lakeflow-connect/jira-source-setup">'
         '<span>Jira</span></a> <a href="/aws/en/ingestion/lakeflow-connect/gitlab#limits">limits</a> <a href="/aws/en/other/page">x</a>')
check("index links keep connector pages after the title and drop anchors, other sections and the sidebar",
      ss.index_links(INDEX) == [("ingestion/lakeflow-connect/gitlab", "GitLab"), ("ingestion/lakeflow-connect/jira-source-setup", "Jira")], ss.index_links(INDEX))


def site(pages):
    seen = []

    def get(url):
        seen.append(url)
        return pages.get(url)
    return get, seen


D = ss.DOCS
staged = {"Box A": {"st": "GA", "stByCloud": {}}, "Box B": {"st": "Beta", "stByCloud": {}},
          "LTAP": {"st": "Coming soon", "stByCloud": {}}, "Secret": {"st": "Private Preview", "stByCloud": {}}}
links = {"Box A": {"doc": "a/"}, "Box B": {"doc": "b/"}, "LTAP": {"doc": "ltap/"}, "Secret": {"site": "https://www.databricks.com/x"}}
pages = {D["aws"] + "a/": dbx("A"), D["azure"] + "a/": learn("A"), D["gcp"] + "a/": dbx("A", box(LINKED.format("Beta"))),
         D["aws"] + "b/": dbx("B", box(LINKED.format("Beta"))), D["azure"] + "b/": learn("B", '<div class="IMPORTANT"><p>This feature is in Beta.</p></div>'),
         D["aws"] + "ltap/": LTAP_AWS, D["azure"] + "ltap/": LTAP_AWS, D["gcp"] + "ltap/": LTAP_GCP}
get, _ = site(pages)
with patched(ss, get=get):
    products, missing, undocumented = ss.product_stages(staged, links)
check("each box reads its own page per cloud", products["Box A"] == {"aws": "GA", "azure": "GA", "gcp": "Beta"}, products.get("Box A"))
check("a page missing on one cloud reads Coming soon there and is recorded", products["Box B"]["gcp"] == "Coming soon" and missing == {"Box B": ["gcp"]}, (products.get("Box B"), missing))
cap_links = {"Cap ok": {"doc": "a/", "docClouds": ["aws", "azure", "gcp"]}, "Cap new cloud": {"doc": "b/", "docClouds": ["aws"]},
             "Cap gone": {"doc": "ltap/", "docClouds": ["azure", "aws", "gcp"]}, "Box B": {"doc": "b/", "docClouds": ["aws"]}, "No limit": {"doc": "a/"}}
cap_pages = {k: v for k, v in pages.items() if k != D["gcp"] + "ltap/"}
get, _ = site(cap_pages)
with patched(ss, get=get):
    drift = ss.doc_cloud_drift(staged, cap_links)
check("a docClouds list that matches the docs, in any order, raises nothing",
      not any(d.startswith("Cap ok") for d in drift), drift)
check("a page published on a cloud docClouds leaves out is reported, so the tag can show there",
      any(d.startswith("Cap new cloud") and d.endswith("exists on aws, azure") for d in drift), drift)
check("a page gone from a cloud docClouds still lists is reported", any(d.startswith("Cap gone") and d.endswith("exists on aws, azure") for d in drift), drift)
check("a staged box and an entry without docClouds are left to the box stage check", not any(d.startswith(("Box B", "No limit")) for d in drift), drift)
check("LTAP reads its capability table on every cloud", products["LTAP"] == {"aws": "Beta", "azure": "Beta", "gcp": "Coming soon"}, products.get("LTAP"))
check("a staged box without a docs path is listed as undocumented, not guessed", undocumented == ["Secret"] and "Secret" not in products, undocumented)
get, _ = site({})
with patched(ss, get=get):
    try:
        ss.product_stages({"Box A": staged["Box A"]}, links)
        check("a docs page missing on every cloud stops the scrape", False)
    except SystemExit as e:
        check("a docs page missing on every cloud stops the scrape", "missing on every cloud" in str(e), str(e))

LC = ss.LC
SAAS = HOME + [("SaaS connectors", "/aws/en/" + LC + "saas-overview")]
cpages = {
    D["aws"] + LC + "saas-overview": ('<h1>SaaS connectors</h1><a href="/aws/en/' + LC + 'newone">New One</a>'
                                      '<a href="/aws/en/' + LC + 'kept-source-setup">Kept</a><a href="/aws/en/' + LC + 'howto">How to</a>'),
    D["aws"] + LC + "newone": dbx("New One connector", box(LINKED.format("Beta")), crumbs=SAAS + [("New One", "")]),
    D["azure"] + LC + "newone": learn("New One connector", '<div class="IMPORTANT"><p>This feature is in Beta.</p></div>'),
    D["gcp"] + LC + "newone": dbx("New One connector", box(LINKED.format("Beta"))),
    D["aws"] + LC + "kept-source-setup": dbx("Configure Kept", crumbs=SAAS + [("Kept", "/aws/en/" + LC + "kept"), ("Set up", "")]),
    D["aws"] + LC + "kept": dbx("Kept connector", crumbs=SAAS + [("Kept", "")]),
    D["azure"] + LC + "kept": learn("Kept connector", '<div class="IMPORTANT"><p>The Kept connector is in Public Preview.</p></div>'),
    D["gcp"] + LC + "kept": dbx("Kept connector"),
    D["aws"] + LC + "howto": dbx("Create a pipeline", crumbs=HOME + [("Query-based connectors", "/x"), ("Create", "")]),
}
platdocs = {"connectors": [{"n": "Kept (curated name)", "p": LC + "kept", "st": "GA"}, {"n": "Gone", "p": LC + "gone", "st": "Beta"}]}
get, _ = site(cpages)
with patched(ss, get=get, CONNECTOR_INDEXES=["saas-overview"]):
    out, added, dropped = ss.connector_catalog(platdocs)
by_name = {c["n"]: c for c in out}
check("a connector found in the docs index is added under its docs name", added == ["New One"] and by_name["New One"]["p"] == LC + "newone", (added, out))
check("a curated connector keeps its curated name", "Kept (curated name)" in by_name and "Kept" not in by_name, list(by_name))
check("a connector whose page is gone on every cloud is dropped", dropped == ["Gone"] and "Gone" not in by_name, dropped)
check("a connector whose stage differs by cloud carries stByCloud for the odd cloud only", by_name["Kept (curated name)"].get("stByCloud") == {"azure": "Public Preview"}, by_name.get("Kept (curated name)"))
check("a connector with one stage everywhere carries no stByCloud", "stByCloud" not in by_name["New One"] and by_name["New One"]["st"] == "Beta", by_name.get("New One"))
check("a how-to page linked from an index is not added", all("howto" not in c["p"] for c in out))
check("the catalog is written sorted by name", [c["n"] for c in out] == sorted((c["n"] for c in out), key=str.casefold))
bad_pages = dict(cpages)
bad_pages[D["aws"] + LC + "kept"] = dbx("Kept setup guide", crumbs=SAAS + [("Kept", "/x"), ("Guide", "")])
get, _ = site(bad_pages)
with patched(ss, get=get, CONNECTOR_INDEXES=["saas-overview"]):
    try:
        ss.connector_catalog({"connectors": [{"n": "Kept", "p": LC + "kept", "st": "GA"}]})
        check("a curated connector path that is not a landing page stops the scrape", False)
    except SystemExit as e:
        check("a curated connector path that is not a landing page stops the scrape", "not a connector landing page" in str(e), str(e))

API_PAGE = '<dt><span class="apiAttr__name">execution_mode</span><span class="apiAttr__stage apiAttr__stage--beta">Beta</span></dt>'
check("an API reference stage badge reads Beta", ss.api_stage(API_PAGE) == "Beta")
check("the least mature API badge wins", ss.api_stage(API_PAGE + '<span class="apiOp__stage--public-preview">x</span>') == "Beta")
check("an API page without a badge reads GA", ss.api_stage("<dt>name</dt>") == "GA")

check("prose 'GA' counts only in capitals", [s for _, s in ss.prose_hits("A saga in Galway went GA.")] == ["GA"])
check("prose stage words are canonical", [s for _, s in ss.prose_hits("generally available, in beta, Private Preview, public preview")] == ["GA", "Beta", "Private Preview", "Public Preview"])
check("a bare 'preview' is not a stage word", not list(ss.prose_hits("turn on the workspace preview")))

p = ss.prose_problems([("Apps", "index.html", "App Spaces (Beta)")])
check("a stage word in a description is reported", len(p) == 1 and "Apps says Beta" in p[0] and "descriptions carry no release stage" in p[0], p)
p = ss.prose_problems([("Lakehouse//RT", "links.json", "In Beta, read-only.")])
check("a description restating its box's own docs stage is reported", len(p) == 1 and "Lakehouse//RT says Beta" in p[0], p)
p = ss.prose_problems([("Lakewatch", "links.json", "Agentic SIEM in Private Preview.")])
check("a box without a docs page may not state a stage either", len(p) == 1 and "Private Preview" in p[0], p)
p = ss.prose_problems([("Genie One", "links.json", "Generally available on web, iOS and Android.")])
check("generally available is a stage word", len(p) == 1 and "Genie One says GA" in p[0], p)
p = ss.prose_problems([("", "x.yaml", "Now in Beta.")])
check("a stage word outside any box is reported", len(p) == 1 and p[0].startswith("(no box) says Beta"), p)
check("a description without a stage word passes",
      ss.prose_problems([("Apps", "index.html", "Turn it on from the workspace Previews page; a saga in Galway.")]) == [])
p = ss.prose_problems([("Teams", "a.yaml", "Answers in Teams (Beta)."), ("Teams", "b.yaml", "Updates in Teams (Beta).")])
check("one problem line lists every place, with distinct snippets", len(p) == 1 and "a.yaml" in p[0] and "b.yaml" in p[0] and "2 places" in p[0], p)

with tempfile.TemporaryDirectory() as tmp:
    out_p, plat_p = os.path.join(tmp, "stages.json"), os.path.join(tmp, "platform_docs.json")
    fake = ({"generated": "2026-01-01", "products": {}, "missing": {}, "undocumented": [], "source": ss.SOURCE},
            {"connectors": [{"n": "A", "p": LC + "a", "st": "Beta"}]}, ["X says Beta: stale"], [])
    argv = sys.argv
    try:
        sys.argv = ["scrape_stages.py"]
        with patched(ss, build=lambda: fake, OUT=out_p, PLATDOCS=plat_p), contextlib.redirect_stderr(open(os.devnull, "w")):
            try:
                ss.main()
                code = 0
            except SystemExit as e:
                code = e.code
        check("a stage word in prose fails the refresh", code == 1, code)
        check("the refreshed data is still written when prose carries a stage", os.path.exists(out_p) and os.path.exists(plat_p))
        sys.argv = ["scrape_stages.py", "--check"]
        with patched(ss, build=lambda: (fake[0], fake[1], [], []), OUT=out_p, PLATDOCS=plat_p), contextlib.redirect_stderr(open(os.devnull, "w")):
            try:
                ss.main()
                code = 0
            except SystemExit as e:
                code = e.code
        check("--check passes when the files match, ignoring the date", code == 0, code)
        for mode in (["scrape_stages.py", "--check"], ["scrape_stages.py"]):
            sys.argv = mode
            with patched(ss, build=lambda: (fake[0], fake[1], [], ["AI Runtime: docClouds drift"]), OUT=out_p, PLATDOCS=plat_p), contextlib.redirect_stderr(open(os.devnull, "w")):
                try:
                    ss.main()
                    code = 0
                except SystemExit as e:
                    code = e.code
            check(f"a docClouds list out of step with the docs fails {' '.join(mode[1:]) or 'the refresh'}", code == 1, code)
        sys.argv = ["scrape_stages.py", "--check"]
        moved = copy.deepcopy(fake[1])
        moved["connectors"][0]["st"] = "GA"
        with patched(ss, build=lambda: (dict(fake[0], generated="2030-01-01"), moved, [], []), OUT=out_p, PLATDOCS=plat_p), contextlib.redirect_stderr(open(os.devnull, "w")):
            try:
                ss.main()
                code = 0
            except SystemExit as e:
                code = e.code
        check("--check fails on a changed connector stage", code == 1, code)
    finally:
        sys.argv = argv

committed = json.load(open(ss.OUT, encoding="utf-8"))
links_now = json.load(open(ss.LINKS, encoding="utf-8"))
plat_now = json.load(open(ss.PLATDOCS, encoding="utf-8"))
arch = ss.board_arch()
staged_now = ss.staged_tiles(arch)
check("stages.json has exactly the expected keys", sorted(committed) == ["generated", "missing", "products", "source", "undocumented"], sorted(committed))
check("stages.json carries an ISO date", bool(re.fullmatch(r"\d{4}-\d{2}-\d{2}", committed["generated"])), committed["generated"])
check("every box stage is on the ladder for all three clouds",
      all(sorted(v) == sorted(ss.CLOUDS) and all(s in ss.LADDER for s in v.values()) for v in committed["products"].values()))
check("every staged box on the board is read from docs or listed as undocumented, never both",
      set(committed["products"]) | set(committed["undocumented"]) == set(staged_now) and not set(committed["products"]) & set(committed["undocumented"]),
      sorted(set(staged_now) ^ (set(committed["products"]) | set(committed["undocumented"]))))
check("a box is read from docs exactly when links.json gives it a docs path",
      all(bool((links_now.get(n) or {}).get("doc")) == (n in committed["products"]) for n in staged_now))
check("a cloud recorded as missing reads Coming soon",
      all(committed["products"][n][c] == "Coming soon" for n, cs in committed["missing"].items() for c in cs))
docclouds_bad = [n for n in committed["products"]
                 if (links_now[n].get("docClouds") or ss.CLOUDS) != [c for c in ss.CLOUDS if c not in committed["missing"].get(n, [])]]
check("links.json docClouds matches the clouds whose docs page exists", not docclouds_bad, docclouds_bad)
cons = plat_now["connectors"]
check("connector names and pages are unique", len({c["n"] for c in cons}) == len(cons) == len({c["p"] for c in cons}))
check("every connector page is a Lakeflow Connect page", all(c["p"].startswith(LC) for c in cons))
check("every connector stage is on the ladder, and stByCloud only lists clouds that differ",
      all(c["st"] in ss.LADDER and all(k in ss.CLOUDS and v in ss.LADDER and v != c["st"] for k, v in (c.get("stByCloud") or {}).items()) for c in cons))
check("the connector catalog is sorted by name", [c["n"] for c in cons] == sorted((c["n"] for c in cons), key=lambda n: n.casefold()))
check("platform_docs.json is in its canonical form", open(ss.PLATDOCS, encoding="utf-8").read() == ss.dump_platdocs(plat_now))
check("stages.json is in its canonical form", open(ss.OUT, encoding="utf-8").read() == ss.dump_stages(committed))
live = ss.prose_problems(ss.collect_prose(arch, ss.load_yamls(), links_now))
check("no description on the board carries a release stage", live == [], live)

failed = [r for r in results if not r[1]]
for name, ok, detail in results:
    if not ok:
        print("FAIL  %s  %s" % (name, str(detail)[:400]))
print("%s %d/%d" % ("PASS" if not failed else "FAIL", len(results) - len(failed), len(results)))
sys.exit(1 if failed else 0)
