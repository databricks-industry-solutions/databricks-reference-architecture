#!/usr/bin/env python3
import importlib.util, json, os, shutil, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location("linkgate", os.path.join(ROOT, "tools", "linkgate.py"))
lg = importlib.util.module_from_spec(spec)
spec.loader.exec_module(lg)

RN, AR = lg.RETIRED_NAME, lg.ARCHIVED_REPO
AI_SELL = next(p for p in lg.APP_OWNER_PENDING["app/ai/ai.js"] if p in lg.SELLER_PHRASES)
SP = lg.SELLER_PHRASES[0]
results, made = [], []


def check(name, cond, detail=""):
    results.append((name, bool(cond), detail))


def fixture(changes=None, untracked=None, check=None):
    files = {
        "app/index.html": "<title>Databricks Data + AI Platform</title>",
        "app/ai/ai.js": "return `tailor a Databricks %s reference architecture`; // %s and use case" % (RN, AI_SELL.capitalize()),
        "app/mcp/server.py": '"""list and search Databricks %s reference architectures"""' % RN,
        "tools/build_installer.py": 'DEFAULT_REPO = "amralieg/%s"' % AR,
        "CLAUDE.md": "The old amralieg/%s repo is ARCHIVED." % AR,
        "app/resources/links.json": json.dumps({"Lakehouse": {"videos": [{"id": "v1", "t": "What is the %s" % RN, "a": RN}]}}),
    }
    for rel, text in (changes or {}).items():
        if text is None:
            files.pop(rel, None)
        else:
            files[rel] = text
    d = tempfile.mkdtemp()
    made.append(d)
    for rel, text in list(files.items()) + list((untracked or {}).items()):
        p = os.path.join(d, rel)
        os.makedirs(os.path.dirname(p), exist_ok=True)
        with open(p, "w", encoding="utf-8") as fh:
            fh.write(text)
    subprocess.run(["git", "init", "-q", d], check=True)
    subprocess.run(["git", "-C", d, "add", "--", *files.keys()], check=True)
    return (check or lg.retired_refs)(d)


def has(fails, text):
    return any(text in f for f in fails)


fails = fixture()
check("a clean tree with the recorded owner-pending files passes", fails == [], fails)

fails = fixture({"app/index.html": "<h1>Databricks %s</h1>" % RN})
check("the retired name anywhere else fails", has(fails, "retired product name '%s' in app/index.html" % RN), fails)

fails = fixture({"app/index.html": '<span class="ds-kick">DATABRICKS %s</span>' % RN.upper()})
check("the retired name in capitals fails", has(fails, "retired product name '%s' in app/index.html" % RN), fails)

fails = fixture({"app/index.html": '<a href="https://amralieg.github.io/%s/">old</a>' % AR})
check("the archived repo anywhere else fails", has(fails, "archived repo or site '%s' in app/index.html" % AR), fails)

fails = fixture({"app/index.html": '<a href="https://github.com/amralieg/%s">old</a>' % AR.title()})
check("the archived repo in another case fails", has(fails, "archived repo or site '%s' in app/index.html" % AR), fails)

fails = fixture({"app/ai/ai.js": "return `TAILOR A DATABRICKS %s REFERENCE ARCHITECTURE`; // %s" % (RN.upper(), AI_SELL.upper())})
check("an owner-pending file whose recorded string is in capitals keeps its exemption", fails == [], fails)

for phrase in lg.SELLER_PHRASES:
    fails = fixture({"README.md": "Take the board into the next %s." % phrase})
    check("the seller phrase '%s' fails" % phrase, has(fails, "seller phrase '%s' in README.md" % phrase), fails)

fails = fixture({"app/index.html": '<p class="tour">%s</p>' % SP.upper()})
check("a seller phrase in capitals fails", has(fails, "seller phrase '%s' in app/index.html" % SP), fails)

fails = fixture({"app/architectures/banking.yaml": "what_it_is: The customer master behind every account, PitchBook comps, "
                                                     "turbine pitch telemetry, customer care and billing, and a bank's customers."})
check("an industry's own customers and pitch data are not seller phrasing", fails == [], fails)

fails = fixture({"app/ai/ai.js": "return `tailor a Databricks %s reference architecture`; // %s, %s" % (RN, AI_SELL, SP)})
check("an owner-pending file may not add another seller phrase", has(fails, "seller phrase '%s' in app/ai/ai.js" % SP), fails)

fails = fixture({"app/ai/ai.js": "return `tailor a Databricks %s reference architecture`; // Describe a business and use case" % RN})
check("rewording the AI greeting makes its seller exemption stale",
      has(fails, "owner-pending exemption for app/ai/ai.js is stale: it no longer contains '%s'" % AI_SELL), fails)

fails = fixture({"app/resources/links.json": json.dumps({"Lakehouse": {"note": "Runs on the %s" % RN, "videos": []}})})
check("the retired name in a links.json note fails", has(fails, "in app/resources/links.json"), fails)

check("the retired name inside a verified video title is allowed", not has(fixture(), "links.json"), fixture())

fails = fixture({"app/ai/ai.js": "return `tailor a Databricks %s reference architecture from %s`;" % (RN, AR)})
check("an owner-pending file may carry only its recorded string", has(fails, "archived repo or site '%s' in app/ai/ai.js" % AR), fails)

fails = fixture({"app/ai/ai.js": "return `tailor a Databricks Data + AI Platform reference architecture`;"})
check("an owner-pending file that is fixed makes the exemption stale",
      has(fails, "owner-pending exemption for app/ai/ai.js is stale"), fails)

fails = fixture({"tools/build_installer.py": 'DEFAULT_REPO = "databricks-industry-solutions/databricks-reference-architecture"'})
check("the installer exemption goes stale once it names the canonical repo",
      has(fails, "owner-pending exemption for tools/build_installer.py is stale"), fails)

fails = fixture({"app/mcp/server.py": None})
check("an owner-pending file that no longer exists fails", has(fails, "names 'app/mcp/server.py', which is not a tracked file"), fails)

fails = fixture(untracked={"notes/scratch.md": "draft about the %s" % RN})
check("untracked files are not scanned", fails == [], fails)

fails = lg.retired_refs()
check("the real repository passes", fails == [], fails)

AI_HEAD = "## AI Architecture Assistant (`app/ai/`)\n"


def readme(text, extra=None, untracked=None):
    files = {"README.md": text}
    files.update(extra or {})
    return fixture(files, untracked=untracked, check=lg.readme_refs)


fails = readme(AI_HEAD + "![a](docs/a.gif) [rules](CLAUDE.md) [ai](#ai-architecture-assistant-appai) "
               "[site](https://example.com/x.png) [mail](mailto:a@b.c) [dir](app/)\n", {"docs/a.gif": "GIF89a"})
check("a README whose files and anchors resolve passes", fails == [], fails)

fails = readme(AI_HEAD + "![a](docs/missing.gif)\n")
check("a README image that is not in the repository fails", has(fails, "README links to 'docs/missing.gif'"), fails)

fails = readme(AI_HEAD + "![b](docs/b.gif)\n", untracked={"docs/b.gif": "GIF89a"})
check("a README image on disk but not committed fails", has(fails, "README links to 'docs/b.gif'"), fails)

fails = readme(AI_HEAD + '<img src="docs/c.png">\n')
check("an HTML image in the README is checked too", has(fails, "README links to 'docs/c.png'"), fails)

fails = readme(AI_HEAD + "[x](#no-such-heading)\n")
check("a README anchor with no heading fails", has(fails, "README links to '#no-such-heading'"), fails)

fails = readme(AI_HEAD + "```\n[x](missing.md) ![y](gone.gif)\n## Not a heading\n```\n[z](#not-a-heading)\n")
check("links and headings inside code blocks are ignored",
      not has(fails, "missing.md") and not has(fails, "gone.gif") and has(fails, "'#not-a-heading'"), fails)

fails = readme(AI_HEAD + "## Run it\n## Run it\n[again](#run-it-1)\n")
check("a repeated heading takes the next numbered anchor", fails == [], fails)

fails = lg.readme_refs()
check("the real README passes", fails == [], fails)

H = lg.DOC_HOSTS
urls = lg.collect_urls({"LINKS": {"Sandbox": {"doc": "compute/serverless/sandbox", "docClouds": ["aws", "azure"]},
                                  "Lakehouse": {"doc": "lakehouse/"}}, "inds": {}})
check("a doc limited to some clouds is not checked on the others",
      H["gcp"] + "compute/serverless/sandbox" not in urls, sorted(urls))
check("a doc limited to some clouds is still checked on its own clouds",
      H["aws"] + "compute/serverless/sandbox" in urls and H["azure"] + "compute/serverless/sandbox" in urls, sorted(urls))
check("a doc with no cloud limit is checked on every cloud", all(h + "lakehouse/" in urls for h in H.values()), sorted(urls))

check("docClouds naming an unknown cloud fails", lg.doc_clouds_checks({"X": {"doc": "x/", "docClouds": ["aws", "oci"]}}))
check("docClouds without a doc path fails", lg.doc_clouds_checks({"X": {"docClouds": ["aws"]}}))
check("an empty docClouds fails", lg.doc_clouds_checks({"X": {"doc": "x/", "docClouds": []}}))
check("docClouds that is not a list fails", lg.doc_clouds_checks({"X": {"doc": "x/", "docClouds": "aws"}}))
check("a valid docClouds passes", lg.doc_clouds_checks({"X": {"doc": "x/", "docClouds": ["aws", "azure"]}}) == [])
real_links = json.load(open(os.path.join(ROOT, "app", "resources", "links.json"), encoding="utf-8"))
check("the real links.json docClouds entries are valid", lg.doc_clouds_checks(real_links) == [], lg.doc_clouds_checks(real_links))
check("Databricks Sandbox is limited to AWS and Azure in links.json",
      real_links.get("Databricks Sandbox", {}).get("docClouds") == ["aws", "azure"], real_links.get("Databricks Sandbox"))

CAT = ({"Omnigent": {"videos": [{"id": "x"}]}, "Unity Catalog": {}}, {"Customer 360": {}}, {"byProduct": {"Genie": ["c"]}}, {"byProduct": {"Lakeflow": ["k"]}})
check("a valid alias map passes", lg.alias_checks({"Omnigent OSS": "Omnigent", "Guest 360": "Customer 360", "Genie Space": "Genie"}, *CAT) == [])
for label, bad in (("an alias pointing at itself", {"Omnigent": "Omnigent"}),
                   ("an alias that chains to another alias", {"A tile": "Omnigent OSS", "Omnigent OSS": "Omnigent"}),
                   ("an alias to an unknown entry", {"Omnigent OSS": "Omnigent Cloud"}),
                   ("an alias that shadows a real entry", {"Unity Catalog": "Omnigent"}),
                   ("an alias with a non-string target", {"Omnigent OSS": None})):
    check(f"{label} is refused", lg.alias_checks(bad, *CAT) != [], lg.alias_checks(bad, *CAT))
real_alias = json.load(open(os.path.join(ROOT, "app", "resources", "aliases.json"), encoding="utf-8"))
real_cat = (real_links, json.load(open(os.path.join(ROOT, "app", "resources", "accelerators.json"), encoding="utf-8")),
            json.load(open(os.path.join(ROOT, "app", "resources", "academy.json"), encoding="utf-8")),
            json.load(open(os.path.join(ROOT, "app", "resources", "certifications.json"), encoding="utf-8")))
check("the real aliases.json is valid", lg.alias_checks(real_alias, *real_cat) == [], lg.alias_checks(real_alias, *real_cat))

CHIPS, CL = ["App Spaces", "Real-Time Mode"], {"Apps": {}, "Streaming": {}, "App Spaces": {}}
check("a valid chip alias map passes", lg.chip_alias_checks({"App Spaces": "Apps", "Real-Time Mode": "Streaming"}, CHIPS, CL) == [])
for label, bad, want in (("a chip alias pointing at itself", {"App Spaces": "App Spaces"}, "points at itself"),
                         ("a chip alias whose chip is on no board", {"App Spaces (Private Preview)": "Apps"}, "names no capability"),
                         ("a chip alias to a name with no LINKS entry", {"Real-Time Mode": "Streaming Engine"}, "names no LINKS entry")):
    got = lg.chip_alias_checks(bad, CHIPS, CL)
    check(f"{label} is refused", len(got) == 1 and want in got[0], got)
check("a chip alias map that did not load fails", lg.chip_alias_checks(None, CHIPS, CL) != [])
check("Omnigent OSS resolves to the Omnigent entry and its videos", real_alias.get("Omnigent OSS") == "Omnigent" and
      len(real_links.get("Omnigent", {}).get("videos") or []) > 0, real_alias.get("Omnigent OSS"))

IND = {"gaming": {"uc": [{"n": "Churn", "stories": []}, {"n": "LTV", "stories": ["u"]}, {"n": "Toxicity", "stories": []}]}}
OM = {"gaming": ["Churn", "LTV"]}
check("a valid outcome map passes", lg.outcome_map_checks(IND, OM) == [], lg.outcome_map_checks(IND, OM))
for label, bad in (("an outcome-map use case that left its board", {"gaming": ["Churn", "Player Journey"]}),
                   ("an outcome map for a board that does not exist", {"casino": ["Churn"]}),
                   ("an outcome map that repeats a use case", {"gaming": ["Churn", "Churn"]}),
                   ("an outcome map that is not a list of names", {"gaming": "Churn"})):
    check(f"{label} is refused", lg.outcome_map_checks(IND, bad) != [], lg.outcome_map_checks(IND, bad))
check("a story-less outcome-map use case needs no exemption",
      lg.story_checks(IND, {"gaming": {"Toxicity": "no public story"}}, OM) == ([], 0))
for label, ex, om in (("a story-less use case outside the map and the exemptions", {}, OM),
                      ("an outcome-map use case also exempt as no public story", {"gaming": {"Toxicity": "no public story", "Churn": "no public story"}}, OM),
                      ("a retired exemption reason", {"gaming": {"Toxicity": "outcome map"}}, OM),
                      ("a stale exemption on a use case that now has a story", {"gaming": {"Toxicity": "no public story", "LTV": "no public story"}}, OM)):
    check(f"{label} fails the story rule", lg.story_checks(IND, ex, om)[0] != [], lg.story_checks(IND, ex, om))
import yaml
real_om = json.load(open(os.path.join(ROOT, "tools", "outcome_map.json"), encoding="utf-8"))
real_ind = {}
for b in real_om:
    p = os.path.join(ROOT, "app", "architectures", b + ".yaml")
    if os.path.exists(p):
        y = yaml.safe_load(open(p, encoding="utf-8"))
        real_ind[b] = {"uc": [{"n": t["name"], "stories": t.get("stories") or []}
                              for g in y.get("agent_usecases", []) if g.get("name") == "Business Use Cases" for t in g.get("tiles", [])]}
check("the real outcome map names only use cases on their boards", lg.outcome_map_checks(real_ind, real_om) == [],
      lg.outcome_map_checks(real_ind, real_om)[:5])
check("Real-World Evidence is an outcome-map use case on Pharmaceuticals", "Real-World Evidence" in real_om.get("pharmaceuticals", []))
check("the replaced Assay & Screening Analytics use case is gone from the map and the exemptions",
      "Assay & Screening Analytics" not in real_om.get("pharmaceuticals", []) and "Assay & Screening Analytics" not in lg.STORY_EXEMPT.get("pharmaceuticals", {}))

TB = {"names": ["Fraud Cockpit", "Fraud Detection", "Risk Analysts"], "top": ["Fraud Detection"],
      "teams": [{"n": "Risk Analysts", "ucs": ["Fraud Detection"], "uses": ["Fraud Cockpit", "Genie", "Kinesis Alias"]}]}
TSHARED, TALIAS = {"Genie"}, {"Kinesis Alias": "Amazon Kinesis"}
check("team references that name boxes on the board, platform products or aliases pass",
      lg.team_ref_checks({"bank": TB}, None, TSHARED, TALIAS) == ([], 1), lg.team_ref_checks({"bank": TB}, None, TSHARED, TALIAS))
for label, team in (("a use case not on the board", {"n": "Risk Analysts", "ucs": ["Assay Analytics"], "uses": []}),
                    ("a box not on the board", {"n": "Risk Analysts", "ucs": [], "uses": ["Media Mix Model"]})):
    bad = dict(TB, teams=[team])
    check(f"a team naming {label} is refused", len(lg.team_ref_checks({"bank": bad}, None, TSHARED, TALIAS)[0]) == 1,
          lg.team_ref_checks({"bank": bad}, None, TSHARED, TALIAS))
check("a team on the generic board is checked too",
      len(lg.team_ref_checks({}, dict(TB, teams=[{"n": "Data Engineers", "ucs": [], "uses": ["Gone Product"]}]), TSHARED, TALIAS)[0]) == 1)
check("no Teams box at all is refused", lg.team_ref_checks({"bank": dict(TB, teams=[])}, None, TSHARED, TALIAS)[0] != [])
check("a use case named only by a box elsewhere on the board is refused",
      len(lg.team_ref_checks({"bank": dict(TB, teams=[{"n": "Risk Analysts", "ucs": ["Fraud Cockpit"], "uses": []}])}, None, TSHARED, TALIAS)[0]) == 1)

for d in made:
    shutil.rmtree(d, ignore_errors=True)
failed = [r for r in results if not r[1]]
for name, ok, detail in results:
    if not ok:
        print("FAIL  %s  %s" % (name, str(detail)[:300]))
print("%s %d/%d" % ("PASS" if not failed else "FAIL", len(results) - len(failed), len(results)))
sys.exit(1 if failed else 0)
