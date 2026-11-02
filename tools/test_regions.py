#!/usr/bin/env python3
import contextlib, copy, importlib.util, io, json, os, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load(name):
    spec = importlib.util.spec_from_file_location(name, os.path.join(ROOT, "tools", name + ".py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


sr = load("scrape_regions")
rg = load("regiongate")
results = []


def check(name, cond, detail=""):
    results.append((name, bool(cond), detail))


AWS = ["us-east-1", "us-west-2", "eu-west-1", "ap-south-1"]
AZURE = ["eastus", "westeurope", "swedencentral", "uksouth"]
GCP = ["us-central1", "europe-west3"]

LAKEBASE_LIKE = """<html><head><script>var s = "<code>eu-west-1</code>";</script></head><body>
<h2>Limits<a href="#limits">#</a></h2><p><code>us-west-2</code></p>
<h3>Region availability<a href="#region-availability">\u200b</a></h3><p>Supported regions:</p>
<ul><li><code>us-east-1</code> (US East)</li><li><code>us-west-2</code> (US West)</li><li><code>eastus</code> (East US)</li></ul>
<h4>Postgres version support</h4><p><code>ap-south-1</code></p></body></html>"""
BOTH_CLOUDS = """<h2>Requirements and availability</h2><p>AWS: <code>us-east-1</code>, <code>eu-west-1</code>.
Azure: <code>eastus</code>, <code>uksouth\u2020</code>. GCP is not supported.</p><h2>Next steps</h2><p><code>westeurope</code></p>"""


def listed(col):
    return sorted(k for k, v in col.items() if v)


col = sr.parse_product_page(LAKEBASE_LIKE, AWS)
check("a product page yields exactly the codes under its region heading", listed(col) == ["us-east-1", "us-west-2"], listed(col))
check("every supported region gets a value, listed or not", sorted(col) == sorted(AWS), sorted(col))
check("codes inside scripts and in later sections are ignored", not col["eu-west-1"] and not col["ap-south-1"], col)
check("a heading with an anchor inside still matches", listed(sr.parse_product_page(LAKEBASE_LIKE, AZURE)) == ["eastus"])
check("one section listing two clouds splits by cloud (AWS)", listed(sr.parse_product_page(BOTH_CLOUDS, AWS)) == ["eu-west-1", "us-east-1"])
check("one section listing two clouds splits by cloud, footnote marks stripped (Azure)",
      listed(sr.parse_product_page(BOTH_CLOUDS, AZURE)) == ["eastus", "uksouth"])
check("a cloud the page does not list reads as not available", listed(sr.parse_product_page(BOTH_CLOUDS, GCP)) == [])
check("a page without a region heading lists nothing", listed(sr.parse_product_page("<h2>Overview</h2><code>us-east-1</code>", AWS)) == [])
check("a 'Supported regions' heading also counts", listed(sr.parse_product_page("<h3>Supported regions</h3><code>us-west-2</code>", AWS)) == ["us-west-2"])
REQUIREMENTS_LIKE = ('<h2 id="requirements">Requirements</h2><p>You need the following:</p><ul>'
                     "<li><p>A workspace in a supported region:</p><p><code>us-east-1</code>, <code>us-west-2</code></p>"
                     "<p>GovCloud regions are not supported.</p></li><li><p>Run <code>eu-west-1</code> elsewhere</p></li></ul>"
                     '<h2 id="share">Share an app</h2><code>ap-south-1</code>')
check("a 'supported region:' list counts only inside the item that names it",
      listed(sr.parse_product_page(REQUIREMENTS_LIKE, AWS)) == ["us-east-1", "us-west-2"],
      listed(sr.parse_product_page(REQUIREMENTS_LIKE, AWS)))
check("the Requirements section is the anchor of a 'supported region:' list", sr.product_anchor(REQUIREMENTS_LIKE) == "requirements",
      sr.product_anchor(REQUIREMENTS_LIKE))
check("a 'supported region:' sentence outside a list counts up to the next heading",
      listed(sr.parse_product_page("<h2>Requirements</h2><p>Use a workspace in a supported region:</p><p><code>us-west-2</code></p>"
                                   "<h2>Share</h2><code>us-east-1</code>", AWS)) == ["us-west-2"])
check("a Requirements section without the supported-region sentence lists nothing",
      listed(sr.parse_product_page('<h2 id="requirements">Requirements</h2><code>us-east-1</code>', AWS)) == [])

SUPPORTED_PAGE = "<table><tr><th>Region</th><th>Location</th></tr>{}</table>"
FEATURE_PAGE = ('<h2 id="ai-and-machine-learning-features-availability">AI and machine learning features availability</h2>'
                '<p>Features with limited availability:</p><ul><li><a href="../ai-search/ai-search">AI Search</a></li></ul>'
                "<table><tr><th>Region</th><th>Location</th><th>AI Search</th></tr>{}</table>"
                "<p>⥂ Region supported only when cross geography routing is enabled.</p>")
DS_GEOS = {"aws": ["Americas", "Europe", "India"], "azure": ["United States", "EU Data boundary", "United Kingdom"],
           "gcp": ["Americas", "Europe", "India"]}
DS_PAGE = ('<h2 id="availability-of-designated-services-in-each-geo">Availability of Designated Services in each Geo</h2>'
           "<table><tr><th>Feature</th><th>Model provider</th>{}</tr>"
           '<tr><td><a href="../machine-learning/foundation-model-apis/#token-foundation-apis">Pay-per-token Foundation Model APIs</a></td>'
           "<td>Model-dependent</td>{}</tr></table>"
           "<p>* This feature is only available when you enable cross-Geo processing on your workspace.</p>")
GEO_PAGE = ("<table><tr><th>Databricks Geo</th><th>Comprising regions in:</th></tr>"
            "<tr><td>Americas</td><td><p>United States</p><p>Canada</p></td></tr>"
            "<tr><td>Europe</td><td><p>European Economic Area (EEA)</p><p>Switzerland</p><p>United Kingdom</p></td></tr>"
            "<tr><td>India</td><td><p>India</p></td></tr></table>")
PP_PAGE = ('<p>When the partner-powered AI features setting is disabled, AI assistive features use Databricks-hosted models where '
           'available for workspaces in the Americas and Europe. For workspaces in other geographies, Databricks-hosted models require '
           'cross geography processing. Some features are not available.</p><h2 id="features">Features</h2>'
           "<table><tr><th>Feature</th><th>Hosting provider when partner-powered AI features is enabled</th>"
           "<th>Hosting provider when partner-powered AI features is disabled</th></tr>"
           "<tr><td>Genie One</td><td>Anthropic on Databricks{}</td><td>Feature is not available</td></tr>"
           "<tr><td>AI-generated comments</td><td>Azure OpenAI service</td><td>Databricks</td></tr>"
           "<tr><td>LLMs as judges*</td><td>Azure OpenAI service</td><td>Users must specify model to use</td></tr>"
           "<tr><td>Companion agents (Public Preview)</td><td>Azure OpenAI service</td><td>Feature is not available</td></tr></table>"
           "<p>* These features are not AI assistive features, but require the partner-powered AI features setting.</p>"
           "<p>† Anthropic on Databricks uses endpoints hosted by Databricks within the Databricks security perimeter.</p>")
DOC_PAGE = "<html><body><main><h1>Page</h1><p>Body.</p></main></body></html>"
BETA_PAGE = ('<html><body><main><h1>AI Search</h1><div class="theme-admonition"><p>This feature is in '
             '<a href="/release-notes/release-types">Beta</a>.</p></div></main></body></html>')


def site():
    pages, calls = {}, []
    for cloud, codes in (("aws", AWS), ("azure", AZURE), ("gcp", GCP)):
        src = sr.SOURCES[cloud]
        pages[src["supported"]] = SUPPORTED_PAGE.format("".join(f"<tr><td>{c}</td><td>Place</td></tr>" for c in codes))
        pages[src["feature"]] = FEATURE_PAGE.format("".join(
            f"<tr><td>{c}</td><td>Place</td><td>{('✓⥂' if i == 2 else '✓') if i % 2 == 0 else ''}</td></tr>" for i, c in enumerate(codes)))
        pages[src["designated"]] = DS_PAGE.format("".join(f"<th>{g}</th>" for g in DS_GEOS[cloud]),
                                                  "<td>Available</td><td>Available*</td><td>Not available</td>")
        pages[src["geos"]] = GEO_PAGE
        pages[src["partner"]] = PP_PAGE.format("†")
        pages[sr.DOCS[cloud] + "ai-search/ai-search"] = BETA_PAGE
    pages["https://docs.example/lakebase-aws"] = LAKEBASE_LIKE
    pages["https://docs.example/both"] = BOTH_CLOUDS

    def fetch(u):
        calls.append(u)
        if u in pages:
            return pages[u]
        if u.startswith(tuple(sr.DOCS.values())):
            return DOC_PAGE
        raise KeyError(u)
    return fetch, calls


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


fetch, calls = site()
pages = {"Lakebase": {"aws": "https://docs.example/lakebase-aws", "azure": "https://docs.example/both", "gcp": "https://docs.example/both"}}
with patched(sr, fetch=fetch, PRODUCT_PAGES=pages, ALIAS={"AI Search": "AI Search"}, DERIVED={}):
    data = sr.build()
label = "Lakebase" + sr.PAGE_SUFFIX
check("a product-page product is mapped to its own column", data["alias"].get("Lakebase") == label, data["alias"])
check("curated mappings are kept", data["alias"].get("AI Search") == "AI Search")
check("the product-page column lands on every cloud", all(label in data["clouds"][c]["features"] for c in ("aws", "azure", "gcp")))
check("each cloud records the page its column came from",
      data["clouds"]["aws"]["feature_sources"][label] == "https://docs.example/lakebase-aws" and data["clouds"]["gcp"]["feature_sources"][label] == "https://docs.example/both")
check("the column holds that cloud's listed regions", listed(data["clouds"]["azure"]["features"][label]) == ["eastus", "uksouth"])
check("a cloud the page does not list is not available there", listed(data["clouds"]["gcp"]["features"][label]) == [])
check("a page shared by two clouds is fetched once", calls.count("https://docs.example/both") == 1, calls)

fetch, _ = site()
with patched(sr, fetch=fetch, PRODUCT_PAGES=pages, ALIAS={"Lakebase": "Lakebase Autoscaling"}, DERIVED={}):
    try:
        sr.build()
        check("a product mapped both ways is refused", False)
    except SystemExit as e:
        check("a product mapped both ways is refused", "mapped twice" in str(e), str(e))

empty = copy.deepcopy(data)
for c in empty["clouds"].values():
    c["features"][label] = {k: False for k in c["features"][label]}
with tempfile.TemporaryDirectory() as tmp, patched(sr, build=lambda: empty, OUT=os.path.join(tmp, "regions.json"), PRODUCT_PAGES=pages):
    argv = sys.argv
    sys.argv = ["scrape_regions.py"]
    try:
        sr.main()
        check("a product page that lists no region anywhere stops the scrape", False)
    except SystemExit as e:
        check("a product page that lists no region anywhere stops the scrape", "list no region on any cloud" in str(e), str(e))
    finally:
        sys.argv = argv
    check("nothing is written when the scrape stops", not os.path.exists(os.path.join(tmp, "regions.json")))

committed = json.load(open(rg.REGIONS, encoding="utf-8"))
links = json.load(open(rg.LINKS, encoding="utf-8"))


def gate(regions, links_data=None):
    with tempfile.TemporaryDirectory() as tmp:
        rp, lp = os.path.join(tmp, "regions.json"), os.path.join(tmp, "links.json")
        json.dump(regions, open(rp, "w"))
        json.dump(links_data if links_data is not None else links, open(lp, "w"))
        out, code = io.StringIO(), 0
        argv = sys.argv
        sys.argv = ["regiongate.py"]
        with patched(rg, REGIONS=rp, LINKS=lp), contextlib.redirect_stdout(out):
            try:
                rg.main()
            except SystemExit as e:
                code = e.code
            finally:
                sys.argv = argv
        return code, out.getvalue()


code, out = gate(committed)
check("the committed region data passes the gate", code == 0 and "REGIONGATE OK" in out, out[-200:])
page_labels = [v for v in committed["alias"].values() if v.endswith(rg.PAGE_SUFFIX)]
check("the committed data maps Lakebase and Genie App Builder from their own pages",
      committed["alias"].get("Lakebase") == "Lakebase" + rg.PAGE_SUFFIX and committed["alias"].get("Genie App Builder") == "Genie App Builder" + rg.PAGE_SUFFIX, page_labels)

bad = copy.deepcopy(committed)
bad["clouds"]["aws"]["feature_sources"]["Ghost (product page)"] = "https://docs.databricks.com/aws/en/ghost"
code, out = gate(bad)
check("gate: a source for a column that does not exist fails", code == 1 and "names no feature column" in out, out[-200:])

bad = copy.deepcopy(committed)
bad["clouds"]["azure"]["feature_sources"]["Lakebase (product page)"] = "https://example.com/lakebase"
code, out = gate(bad)
check("gate: a source off the Databricks docs fails", code == 1 and "is not a Databricks docs page" in out, out[-200:])

bad = copy.deepcopy(committed)
del bad["clouds"]["gcp"]["feature_sources"]["Lakebase (product page)"]
code, out = gate(bad)
check("gate: a product-page column without its page fails", code == 1 and "has no source page" in out, out[-200:])

bad = copy.deepcopy(committed)
for c in bad["clouds"].values():
    col = c["features"]["Lakebase (product page)"]
    c["features"]["Lakebase (product page)"] = {k: False for k in col}
code, out = gate(bad)
check("gate: a product-page column listing no region anywhere fails", code == 1 and "lists no region on any cloud" in out, out[-200:])

bad_links = copy.deepcopy(links)
bad_links["Genie App Builder"] = {"note": "no doc, no site"}
code, out = gate(committed, bad_links)
check("gate: a mapped product that is neither documented nor a product page fails", code == 1 and "'Genie App Builder' is not a Databricks product tile" in out, out[-200:])

bad = copy.deepcopy(committed)
bad["clouds"]["azure"]["features"]["Brand new feature"] = {r["code"]: False for r in bad["clouds"]["azure"]["regions"]}
code, out = gate(bad)
check("gate: a limited column that belongs to no board product fails", code == 1 and "'Brand new feature' belongs to no board product" in out, out[-200:])

with patched(rg.scrape_regions, PART_OF=dict(sr.PART_OF, **{"Retired feature": "gone"})):
    code, out = gate(committed)
check("gate: a PART_OF entry that matches no column fails", code == 1 and "PART_OF['Retired feature'] matches no limited column" in out, out[-200:])

old = {k: v for k, v in committed["alias"].items() if k not in ("Serverless Compute", "Model Serving")}
gaps = rg.unowned(committed["clouds"]["azure"]["features"], old, {k: v for k, v in sr.PART_OF.items()})
check("without the Serverless Compute and Model Serving mappings their columns belong to no board product",
      any(g.startswith("Serverless compute") for g in gaps) and any(g.startswith("Custom Model Serving capability (CPU") for g in gaps), gaps)
check("every limited column on every cloud belongs to a board product or says why not",
      all(not rg.unowned(c["features"], committed["alias"], sr.PART_OF) for c in committed["clouds"].values()))
cols = {"Firewall enablement for serverless compute": {}, "Serverless compute (notebooks, jobs, pipelines, and SQL warehouses)": {}}
check("an alias resolves to the column that starts with it, whatever the order",
      rg.feature_label(cols, "Serverless compute") == "Serverless compute (notebooks, jobs, pipelines, and SQL warehouses)")
az = committed["clouds"]["azure"]["features"]
serverless, serving = rg.feature_label(az, committed["alias"]["Serverless Compute"]), rg.feature_label(az, committed["alias"]["Model Serving"])
check("Qatar Central has neither serverless compute nor Model Serving",
      az[serverless]["qatarcentral"] is False and az[serving]["qatarcentral"] is False, (serverless, serving))

check("a 'supported region' requirement on a product page is found",
      "supported region" in (sr.region_statement("<p>Your workspace must be in a supported region. See Geo availability.</p>") or ""))
check("a 'region availability' heading is found", sr.region_statement("<h2>Limitations and region availability</h2>"))
check("a link to the regional availability page is found",
      sr.region_statement('<p>See <a href="../resources/feature-region-support#x">limits</a>.</p>') == "links to the regional availability page")
check("a page with no region requirement is not flagged",
      sr.region_statement("<h1>Delta Lake</h1><p>Open table format, available everywhere you run Databricks.</p>") is None)
check("a link in the site navigation is ignored", sr.region_statement('<nav><a href="/resources/supported-regions">Regions</a></nav><p>Spark</p>') is None)
flags = {"Mapped": [("aws", "x")], "Paged": [("aws", "x")], "Known": [("gcp", "x")], "Missed": [("azure", "in a supported region")]}
probs = sr.page_problems(flags, {"Mapped": "m"}, {"Paged": {}}, {"Known": "why", "Gone": "why"})
check("a product page with a region requirement that is not mapped or reviewed is reported",
      any(p.startswith("Missed: its azure docs page states a region requirement") for p in probs), probs)
check("mapped, product-page and reviewed products are not reported", not any(p.startswith(("Mapped", "Paged", "Known")) for p in probs), probs)
check("a reviewed product whose page no longer states a requirement is reported", any("REVIEWED['Gone']" in p for p in probs), probs)

SEC = "ai-and-machine-learning-features-availability"
check("every cloud's table row links the feature's own docs page on that cloud",
      all(data["clouds"][c]["meta"]["AI Search"]["doc"] == sr.PUBLIC_DOCS[c] + "ai-search/ai-search" for c in sr.DOCS),
      {c: data["clouds"][c]["meta"]["AI Search"]["doc"] for c in sr.DOCS})
check("every row cites the docs section that states its availability",
      all(data["clouds"][c]["meta"]["AI Search"]["src"] == sr.public_url(sr.SOURCES[c]["feature"]) + "#" + SEC for c in sr.DOCS))
check("the row's category is its docs section", data["clouds"]["aws"]["meta"]["AI Search"]["cat"] == "AI and machine learning features")
check("the row's stage is read from its own docs page", all(data["clouds"][c]["meta"]["AI Search"]["st"] == "Beta" for c in sr.DOCS))
check("a cell's marker is kept for that region", data["clouds"]["aws"]["marks"]["AI Search"] == {AWS[2]: "⥂"}, data["clouds"]["aws"]["marks"])
check("the section's legend explains the marker and marks it conditional",
      data["clouds"]["aws"]["legend"][SEC]["⥂"] == {"t": "Region supported only when cross geography routing is enabled.", "c": True},
      data["clouds"]["aws"]["legend"])
ds = data["clouds"]["azure"]["designated"]
check("a Designated Service keeps its provider and its value in every Geo",
      ds["rows"][0]["n"] == "Pay-per-token Foundation Model APIs" and ds["rows"][0]["prov"] == "Model-dependent"
      and ds["rows"][0]["geo"] == {"United States": "Available", "EU Data boundary": "Available*", "United Kingdom": "Not available"}, ds["rows"])
check("a Designated Service links its own docs page on each cloud",
      all(data["clouds"][c]["designated"]["rows"][0]["doc"] == sr.PUBLIC_DOCS[c] + "machine-learning/foundation-model-apis/#token-foundation-apis" for c in sr.DOCS))
check("the Designated Services footnote is kept and marked conditional", ds["legend"]["*"]["c"] is True and ds["src"].endswith("#availability-of-designated-services-in-each-geo"), ds["legend"])
geo = {c: data["clouds"][c]["geo"] for c in sr.DOCS}
check("each region gets its country and the Geo of its Designated Services column",
      geo["aws"]["eu-west-1"] == {"country": "Ireland", "geo": "Europe", "iso": "IE"} and geo["aws"]["ap-south-1"] == {"country": "India", "geo": "India", "iso": "IN"}
      and geo["azure"]["westeurope"] == {"country": "Netherlands", "geo": "EU Data boundary", "iso": "NL"}
      and geo["azure"]["uksouth"] == {"country": "United Kingdom", "geo": "United Kingdom", "iso": "GB"}
      and geo["gcp"]["europe-west3"] == {"country": "Germany", "geo": "Europe", "iso": "DE"}, geo)

check("a Geo matches its column across 'and' and '&'",
      sr.geo_of("aws", "Australia", {"Australia and New Zealand": ["Australia", "New Zealand"]}, ["Australia & New Zealand"]) == "Australia & New Zealand")
check("Switzerland belongs to the EU Data boundary on Azure", sr.geo_of("azure", "Switzerland", {}, ["EU Data boundary"]) == "EU Data boundary")
probs = []
sr.region_geos("aws", [{"code": "zz-nowhere-1", "loc": "Nowhere"}], {}, [], probs)
check("a region with no country is reported", any("has no country in REGION_COUNTRY" in p for p in probs), probs)
probs = []
with patched(sr, REGION_COUNTRY={"r1": "Atlantis", "r2": "Saudi Arabia"}):
    sr.region_geos("gcp", [{"code": "r1", "loc": "x"}, {"code": "r2", "loc": "y"}], {"Americas": ["United States"]}, ["Americas"], probs)
check("a country no Geo covers is reported unless NO_GEO records it",
      any("Atlantis" in p for p in probs) and not any("Saudi Arabia" in p for p in probs), probs)
check("every region on every cloud has a country", all(r["code"] in sr.REGION_COUNTRY for c in committed["clouds"].values() for r in c["regions"]))

check("an Azure link is stored without its locale, so Learn opens in the reader's language",
      sr.public_url("https://learn.microsoft.com/en-us/azure/databricks/ai-search/") == "https://learn.microsoft.com/azure/databricks/ai-search/"
      and sr.public_url("https://docs.databricks.com/aws/en/x") == "https://docs.databricks.com/aws/en/x")
check("the source pages the board cites carry no locale either", all("/en-us/" not in u for u in committed["sources"]["azure"].values()), committed["sources"]["azure"])
check("no stored Azure link carries a locale", not any("/en-us/" in (m.get("doc", "") + m.get("src", ""))
      for m in list(committed["clouds"]["azure"]["meta"].values()) + list(committed["clouds"]["azure"]["derived"].values())
      + committed["clouds"]["azure"]["designated"]["rows"]))
check("a header marker is split off the feature name", sr.split_label("Foundation Model APIs (provisioned throughput) **") == ("Foundation Model APIs (provisioned throughput)", "**"))
check("a marker glued to the name is split off too", sr.split_label("Foundation Model APIs (provisioned throughput)**") == ("Foundation Model APIs (provisioned throughput)", "**"))
check("a name without a marker is unchanged", sr.split_label("CMK") == ("CMK", ""))
check("a link text named in LINK_TEXT matches its column", sr.link_for("CMK", [("Customer-managed keys (CMK)", "/k")]) == "/k")
check("a link matches a column that starts with its words", sr.link_for("ai_forecast and ai_detect_anomalies", [("ai_forecast", "/f")]) == "/f")
check("a link never matches inside a word", sr.link_for("AI Search", [("AI Sea", "/x")]) is None)
check("a stage in the column name does not block its link", sr.link_for("Databricks Sandbox (Beta)", [("Databricks Sandbox", "/s")]) == "/s")

TABLE = "<table><tr><th>Region</th><th>Location</th><th>{}</th></tr><tr><td>us-east-1</td><td>x</td><td>{}</td></tr></table>"
probs = []
sr.feature_meta('<h2 id="s">S availability</h2>' + TABLE.format("Mystery feature", "✓"), "https://docs.databricks.com/aws/en/resources/feature-region-support", "aws", probs)
check("a feature the docs section does not link is reported", any("'Mystery feature' has no docs link" in p for p in probs), probs)
probs = []
sr.feature_meta('<h2 id="s">S</h2><ul><li><a href="../x">X</a></li></ul>' + TABLE.format("X", "✓‡"), "https://docs.databricks.com/aws/en/resources/feature-region-support", "aws", probs)
check("a marker its section does not explain is reported", any("explains no such marker" in p for p in probs), probs)
probs = []
sr.feature_meta('<h2 id="s">S</h2><ul><li><a href="../x">X</a></li></ul>' + TABLE.format("X", "✓§") + "<p>§ Something new.</p>",
                "https://docs.databricks.com/aws/en/resources/feature-region-support", "aws", probs)
check("a marker with no recorded meaning is reported", any("has no MARK_EFFECT entry" in p for p in probs), probs)

MCP = ('<h2 id="mcp">MCP availability</h2><p><a href="../agents/mcp-tools/">MCP servers</a> and <a href="../query-federation/http">Unity Catalog HTTP connections</a>'
       " are supported in the same regions as Custom Model Serving.</p>")
cpu = {"Custom Model Serving capability (CPU serving)": {}}
probs = []
rows = sr.derived_rows(sr.parsed(MCP), "https://docs.databricks.com/aws/en/resources/feature-region-support", "aws", cpu, probs)
check("MCP servers and UC HTTP connections follow Custom Model Serving where the docs say so",
      not probs and set(rows) == set(sr.DERIVED) and rows["MCP servers"]["doc"] == "https://docs.databricks.com/aws/en/agents/mcp-tools/"
      and rows["MCP servers"]["src"].endswith("#mcp"), (rows, probs))
check("a derived row quotes the docs sentence that ties it, under its section's category",
      rows["MCP servers"]["say"].endswith("supported in the same regions as Custom Model Serving.") and rows["MCP servers"]["cat"] == "MCP", rows)
probs = []
sr.derived_rows(sr.parsed(MCP.replace("same regions as", "regions like")), "https://docs.databricks.com/aws/en/", "aws", cpu, probs)
check("the derived rows are refused once the docs stop saying it", any("no section says" in p for p in probs), probs)
probs = []
sr.derived_rows(sr.parsed(MCP), "https://docs.databricks.com/aws/en/", "aws", {}, probs)
check("a derived row whose source column is gone is refused", any("is not a feature column" in p for p in probs), probs)

check("a feature named with a list reads as one line", sr.ds_name("AI Functions:\nai_classify v2\nai_extract v2") == "AI Functions: ai_classify v2, ai_extract v2")
check("an 'excludes:' list reads in brackets",
      sr.ds_name("AI Functions optimized for batch inference excludes:\nai_parse_document v2\nai_prep_search") == "AI Functions optimized for batch inference (excludes ai_parse_document v2, ai_prep_search)")
cell = sr.parsed("<table><tr><td>AI Functions:<ul><li>ai_classify v2</li><li>ai_extract v2</li></ul></td></tr></table>").tables[0][0][0]
check("list items run together in the markup are kept apart", sr.ds_name(cell) == "AI Functions: ai_classify v2, ai_extract v2", cell)
DS = ('<h2 id="geo">Geo</h2><table><tr><th>Feature</th><th>Model provider</th><th>Asia</th></tr>'
      "<tr><td>Genie Code chat and cell actions</td><td>Databricks</td><td>{}</td></tr></table>"
      '<h2 id="local">Country</h2><table><tr><th>Feature</th><th>Japan</th><th>Korea</th></tr>'
      "<tr><td>Genie Code chat and cell actions</td><td>Processed in Japan</td><td>Processed in Korea</td></tr></table>"
      "<p>† Asia Geo traffic can be sent for processing within regions in Japan.</p>")
probs = []
out = sr.designated(DS.format("Available†") * 1, "https://docs.databricks.com/aws/en/resources/designated-services", "aws", probs)
check("the country table is read, with Korea named South Korea",
      not probs and out["local"] == {"Genie Code chat and cell actions": {"Japan": "Processed in Japan", "South Korea": "Processed in Korea"}}
      and out["local_sec"] == "local" and out["legend"]["†"]["c"] is False, (out, probs))
probs = []
sr.designated(DS.format("Maybe later"), "https://docs.databricks.com/aws/en/resources/designated-services", "aws", probs)
check("an unknown Designated Services status is reported", any("is not a known status" in p for p in probs), probs)
probs = []
sr.designated(DS.format("Available‡"), "https://docs.databricks.com/aws/en/resources/designated-services", "aws", probs)
check("a Designated Services marker the page does not explain is reported", any("explains no such marker" in p for p in probs), probs)

clouds = {c: {"designated": {"rows": [{"n": "Genie Code chat and cell actions", "doc": ""}]}} for c in ("aws", "gcp")}
clouds["azure"] = {"designated": {"rows": [{"n": "Genie Code chat and cell actions", "doc": sr.DOCS["azure"] + "genie-code/"}]}}
clouds["gcp"]["designated"]["rows"].append({"n": "Only on GCP", "doc": ""})
probs = []
sr.fill_designated_docs(clouds, probs)
check("a Designated Service with no link borrows Azure's docs path on its own cloud",
      clouds["aws"]["designated"]["rows"][0]["doc"] == sr.DOCS["aws"] + "genie-code/", clouds["aws"])
check("a Designated Service with no link and no Azure twin is reported", any("Only on GCP" in p for p in probs), probs)

import urllib.error
def fake(u):
    if u.endswith("/gone"):
        raise urllib.error.HTTPError(u, 404, "Not Found", {}, None)
    if "/api/" in u:
        return '<span class="apiOp__stage--public-preview">x</span>'
    return BETA_PAGE
probs = []
with patched(sr, fetch=fake):
    st = sr.page_stages([sr.DOCS["aws"] + "beta-page#anchor", sr.DOCS["aws"] + "gone", "https://docs.databricks.com/api/x/y"], probs)
check("a docs page's notice sets the row's stage, anchors ignored", st.get(sr.DOCS["aws"] + "beta-page") == "Beta", st)
check("an API reference page reads its stage badge", st.get("https://docs.databricks.com/api/x/y") == "Public Preview", st)
check("a docs page that is gone is reported", any("/gone is missing" in p for p in probs), probs)

with tempfile.TemporaryDirectory() as tmp, patched(sr, build=lambda: copy.deepcopy(data), OUT=os.path.join(tmp, "regions.json"), PRODUCT_PAGES=pages,
                                                    review_pages=lambda links: ({}, {"aws": {"Genie": "GA", "Apps": "Beta"}, "gcp": {"Genie": "Beta"}}),
                                                    staged_boxes=lambda: {"Apps"}, REVIEWED={}):
    argv = sys.argv
    sys.argv = ["scrape_regions.py"]
    try:
        sr.main()
        wrote = json.load(open(os.path.join(tmp, "regions.json"), encoding="utf-8"))
    finally:
        sys.argv = argv
check("board products the stage scraper does not read keep their docs stage per cloud, and staged boxes are left to it",
      wrote["clouds"]["aws"]["products"] == {"Genie": "GA"} and wrote["clouds"]["gcp"]["products"] == {"Genie": "Beta"}
      and wrote["clouds"]["azure"]["products"] == {}, {c: wrote["clouds"][c]["products"] for c in wrote["clouds"]})

check("an AWS feature name is merged into the name the other clouds use",
      sr.column_name("Serverless compute (notebooks, jobs, pipelines, and SQL warehouses) **") == "Serverless compute for notebooks, jobs, pipelines, and SQL warehouses"
      and sr.column_name("Custom Agents on Model Serving and Evaluation") == "Custom Agents and Evaluation")
twin = {"aws": {"meta": {"Old name": {"doc": sr.DOCS["aws"] + "x/page#a"}}}, "azure": {"meta": {"New name": {"doc": sr.DOCS["azure"] + "x/page"}}}}
probs = sr.variant_problems(twin)
check("two names on different clouds sharing one docs page are reported until merged", len(probs) == 1 and "SAME_FEATURE" in probs[0], probs)
both = {"aws": {"meta": {"CPU": {"doc": sr.DOCS["aws"] + "serving/"}, "GPU": {"doc": sr.DOCS["aws"] + "serving/"}}},
        "azure": {"meta": {"CPU": {"doc": sr.DOCS["azure"] + "serving/"}, "GPU": {"doc": sr.DOCS["azure"] + "serving/"}}}}
check("two features that share a page on the same clouds are not reported", sr.variant_problems(both) == [])
cl = {"aws": {"meta": {"Only AWS": {"cat": "Security", "doc": sr.DOCS["aws"] + "sec/page"}, "API one": {"cat": "Agent", "doc": "https://docs.databricks.com/api/x"}},
              "designated": {"rows": [{"n": "Shared", "doc": sr.DOCS["aws"] + "s/"}, {"n": "Only AWS", "doc": sr.DOCS["aws"] + "d/"}]}},
      "gcp": {"meta": {}, "designated": {"rows": [{"n": "Shared", "doc": sr.DOCS["gcp"] + "s/"}]}}}
sr.fill_elsewhere(cl)
g = {(e["kind"], e["n"]): e for e in cl["gcp"]["elsewhere"]}
check("a cloud gets every feature and Designated Service another cloud lists, kept apart by kind even under one name",
      set(g) == {("feature", "Only AWS"), ("feature", "API one"), ("designated", "Only AWS")} and cl["aws"]["elsewhere"] == [], sorted(g))
check("a missing feature is looked up at the same docs path on this cloud",
      g[("feature", "Only AWS")]["doc"] == sr.DOCS["gcp"] + "sec/page" and g[("feature", "Only AWS")]["src_doc"] == sr.DOCS["aws"] + "sec/page"
      and g[("feature", "Only AWS")]["from"] == "aws" and g[("feature", "Only AWS")]["cat"] == "Security", g[("feature", "Only AWS")])
check("an API reference page is the same on every cloud", g[("feature", "API one")]["doc"] == "https://docs.databricks.com/api/x")
probs = []
with patched(sr, fetch=fake):
    st = sr.page_stages([sr.DOCS["aws"] + "gone"], probs, required=False)
check("a page that a cloud lacks is not a problem when it is only being looked up", st == {} and probs == [], (st, probs))
check("every country with a region has an ISO code", all(v in sr.COUNTRY_ISO.values() for v in ["QA", "AE", "US"]) and len(sr.COUNTRY_ISO) == len(set(sr.COUNTRY_ISO.values())))
probs = []
with patched(sr, REGION_COUNTRY={"r1": "Atlantis"}):
    out = sr.region_geos("aws", [{"code": "r1", "loc": "x"}], {}, [], probs)
check("a country without an ISO code is reported", any("no ISO code" in p for p in probs) and out["r1"]["iso"] == "", probs)
flags = json.load(open(os.path.join(ROOT, "app", "resources", "flags.json"), encoding="utf-8"))
check("every region on every cloud has a flag, and the flag set carries its license",
      all(e["iso"] in flags["flags"] for c in committed["clouds"].values() for e in c["geo"].values()) and "MIT License" in flags["license"])
check("flags are plain SVG with no script or link", all(v.startswith("<svg") and "<script" not in v and "href" not in v for v in flags["flags"].values()))
def keys(cv):
    return rg.table_keys(cv)
check("every cloud's region table carries the same rows", len({frozenset(keys(c)) for c in committed["clouds"].values()}) == 1,
      {c: len(keys(v)) for c, v in committed["clouds"].items()})

def mutated(fn):
    bad = copy.deepcopy(committed)
    fn(bad["clouds"])
    return gate(bad)
az_row = next(iter(committed["clouds"]["azure"]["meta"]))
code, out = mutated(lambda c: c["azure"]["meta"][az_row].update(doc=sr.DOCS["aws"] + "x"))
check("gate: a row linking another cloud's docs fails", code == 1 and "not a azure docs page" in out, out[-300:])
code, out = mutated(lambda c: c["azure"]["meta"][az_row].pop("st"))
check("gate: a row without a stage fails", code == 1 and "has no release stage" in out, out[-300:])
code, out = mutated(lambda c: c["azure"]["meta"].pop(az_row))
check("gate: a feature column without a table row fails", code == 1 and "has no row in the region table" in out, out[-300:])
mk_col, mk_regions = next(iter(committed["clouds"]["azure"]["marks"].items()))
code, out = mutated(lambda c: c["azure"]["marks"][mk_col].update({next(iter(mk_regions)): "‡"}))
check("gate: a marker its section does not explain fails", code == 1 and "explains no such marker" in out, out[-300:])
no_region = next(r for r, v in committed["clouds"]["azure"]["features"][mk_col].items() if not v)
code, out = mutated(lambda c: c["azure"]["marks"][mk_col].update({no_region: "⥂"}))
check("gate: a marker on a region the feature does not list fails", code == 1 and "which the feature does not list" in out, out[-300:])
code, out = mutated(lambda c: c["aws"]["designated"]["rows"][0]["geo"].update(Americas="Soon"))
check("gate: an unknown Designated Services status fails", code == 1 and "not a known status" in out, out[-300:])
code, out = mutated(lambda c: c["aws"]["geo"].pop("us-east-1"))
check("gate: a region without a country and Geo fails", code == 1 and "us-east-1 has no country and Geo" in out, out[-300:])
code, out = mutated(lambda c: c["aws"]["geo"]["us-east-1"].update(geo=None))
check("gate: a region left without a Geo that NO_GEO does not record fails", code == 1 and "has no Designated Services Geo" in out, out[-300:])
code, out = mutated(lambda c: c["gcp"]["derived"]["MCP servers"].update({"from": "Gone column"}))
check("gate: a derived row following a missing column fails", code == 1 and "which is not a feature column" in out, out[-300:])
code, out = mutated(lambda c: c["azure"]["products"].update(Genie="Soonish"))
check("gate: a board product with no docs stage fails", code == 1 and "'Genie' has no release stage" in out, out[-300:])
code, out = mutated(lambda c: c["gcp"].update(elsewhere=[e for e in c["gcp"]["elsewhere"] if e["n"] != "CMK"]))
check("gate: a cloud whose table lacks a row another cloud lists fails", code == 1 and "lacks 1 row" in out, out[-300:])
here = next(i for i, e in enumerate(committed["clouds"]["gcp"]["elsewhere"]) if e["doc"])
code, out = mutated(lambda c: c["gcp"]["elsewhere"][here].update(doc=sr.PUBLIC_DOCS["aws"] + "x"))
check("gate: a looked-up row linking another cloud's docs as its own fails", code == 1 and "needs a gcp docs page" in out, out[-300:])
gone = next(i for i, e in enumerate(committed["clouds"]["gcp"]["elsewhere"]) if not e["doc"])
code, out = mutated(lambda c: c["gcp"]["elsewhere"][gone].update(st="GA"))
check("gate: a row with no page on this cloud may not carry a stage", code == 1 and "with no stage" in out, out[-300:])
code, out = mutated(lambda c: c["azure"]["geo"]["qatarcentral"].update(iso="XQ"))
check("gate: a region whose country has no flag fails", code == 1 and "qatarcentral (Qatar) has no flag" in out, out[-300:])
cz = committed["clouds"]["azure"]
check("Qatar Central's Designated Services Geo is Qatar, and Dammam's on GCP is recorded as uncovered",
      cz["geo"]["qatarcentral"] == {"country": "Qatar", "geo": "Qatar", "iso": "QA"} and committed["clouds"]["gcp"]["geo"]["me-central2"]["geo"] is None)
check("every row on every cloud links that cloud's docs and cites them",
      all(rg.on_cloud(m["doc"], c, True) and rg.on_cloud(m["src"], c) for c, cv in committed["clouds"].items()
          for m in list(cv["meta"].values()) + list(cv["derived"].values())))

PP_URL = "https://learn.microsoft.com/en-us/azure/databricks/databricks-ai/partner-powered"
probs = []
pp = sr.partner(PP_PAGE.format("†") + PP_PAGE.format("†").split("</p>", 1)[1], PP_URL, "azure", probs)
check("partner-powered rows are read once, with markers and stage words taken out of the names",
      not probs and [r["n"] for r in pp["rows"]] == ["Genie One", "AI-generated comments", "LLMs as judges", "Companion agents"]
      and pp["rows"][0]["marks"] == ["†"] and pp["rows"][2]["marks"] == ["*"] and pp["rows"][3]["st"] == "Public Preview"
      and pp["rows"][0]["on"] == "Anthropic on Databricks" and pp["src"] == PP_URL + "#features", (pp, probs))
check("the security perimeter legend and the geography sentence come from the page",
      "within the Databricks security perimeter" in pp["legend"]["†"]["t"] and pp["legend"]["†"]["c"] is False
      and pp["geo"].startswith("When the partner-powered AI features setting is disabled") and pp["geo"].endswith("cross geography processing."), pp)
probs = []
sr.partner(PP_PAGE.format("‡"), PP_URL, "azure", probs)
check("a partner-powered marker the page does not explain is reported", any("explains no such marker" in p for p in probs), probs)
probs = []
sr.partner(PP_PAGE.format("†").replace("For workspaces in other geographies", "Elsewhere"), PP_URL, "azure", probs)
check("a partner-powered page that stops naming where models need cross geography processing is reported",
      any("cross geography processing" in p for p in probs), probs)
probs = []
sr.partner(DOC_PAGE, PP_URL, "azure", probs)
check("a partner-powered page without its table is reported", any("no partner-powered AI features table" in p for p in probs), probs)
check("the scrape records the partner-powered rows on every cloud with their docs stages",
      all(len(data["clouds"][c]["partner"]["rows"]) == 4 for c in ("aws", "azure", "gcp"))
      and [r["st"] for r in data["clouds"]["aws"]["partner"]["rows"]] == ["GA", "GA", "GA", "Public Preview"]
      and data["clouds"]["azure"]["partner"]["src"] == sr.PUBLIC_DOCS["azure"] + "databricks-ai/partner-powered#features",
      {c: data["clouds"][c]["partner"] for c in ("aws",)})
code, out = mutated(lambda c: c["gcp"]["partner"]["rows"].pop(0))
check("gate: a cloud whose partner-powered table lacks a feature another cloud lists fails", code == 1 and "lacks 1 row" in out, out[-300:])
code, out = mutated(lambda c: c["aws"]["partner"]["rows"][0].update(marks=["§"]))
check("gate: a partner-powered marker the page does not explain fails", code == 1 and "which the page does not explain" in out, out[-300:])
code, out = mutated(lambda c: c["gcp"]["partner"].update(src=sr.PUBLIC_DOCS["aws"] + "databricks-ai/partner-powered"))
check("gate: partner-powered rows citing another cloud's docs fail", code == 1 and "not a gcp docs page" in out, out[-300:])
code, out = mutated(lambda c: c["azure"]["partner"].update(geo=""))
check("gate: partner-powered rows without the geography sentence fail", code == 1 and "carry no sentence" in out, out[-300:])
check("every cloud names the same partner-powered features, and the security perimeter note is on the rows the docs mark",
      len({tuple(r["n"] for r in cv["partner"]["rows"]) for cv in committed["clouds"].values()}) == 1
      and all("security perimeter" in cv["partner"]["legend"]["†"]["t"] for cv in committed["clouds"].values()))

failed = [r for r in results if not r[1]]
for name, ok, detail in results:
    if not ok:
        print("FAIL  %s  %s" % (name, str(detail)[:300]))
print("%s %d/%d" % ("PASS" if not failed else "FAIL", len(results) - len(failed), len(results)))
sys.exit(1 if failed else 0)
