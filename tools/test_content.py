#!/usr/bin/env python3
import importlib.util, os, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
spec = importlib.util.spec_from_file_location("refresh_videos", os.path.join(HERE, "refresh_videos.py"))
rv = importlib.util.module_from_spec(spec)
spec.loader.exec_module(rv)
lg = rv.lg
results = []


def check(name, cond, detail=""):
    results.append((name, bool(cond), detail))


FEED = ("<feed><entry><yt:videoId>a1</yt:videoId><title>Genie Code in action</title></entry>"
        "<entry><yt:videoId>b2</yt:videoId><title>Investigating &amp; Resolving incidents with Genie ZeroOps</title></entry>"
        "<entry><title>no id</title></entry></feed>")
check("a feed yields id and unescaped title per entry", rv.parse_feed(FEED) ==
      [("a1", "Genie Code in action"), ("b2", "Investigating & Resolving incidents with Genie ZeroOps")], rv.parse_feed(FEED))
NAMES = ["Genie", "Genie Code", "Genie ZeroOps", "Unity Catalog", "Lakeflow Connect", "AI/BI"]
check("a title names the most specific box, not its prefix", rv.boxes_named("Genie Code in action", NAMES) == ["Genie Code"])
check("a title naming two boxes names both", rv.boxes_named("Unity Catalog meets Lakeflow Connect", NAMES) == ["Lakeflow Connect", "Unity Catalog"])
check("a box name matches as a whole phrase only", rv.boxes_named("Lakeflow Connectors overview", NAMES) == [])
check("punctuation in a box name still matches", rv.boxes_named("AI BI dashboards in five minutes", NAMES) == ["AI/BI"])

LINKS = {"Genie Code": {"doc": "genie-code/", "videos": [{"id": "x%d" % i, "t": "Genie Code %d" % i} for i in range(rv.CAP)]},
         "Genie ZeroOps": {"doc": "zeroops/"}, "Unity Catalog": {"doc": "uc/", "videos": [{"id": "u1", "t": "Unity Catalog Overview"}]},
         "Lakeflow Connect": {"doc": "lc/"}, "Competitor": {"site": "https://example.com"}}
feed = [("a1", "Genie Code in action"), ("b2", "Genie ZeroOps triage"), ("b2", "Genie ZeroOps triage"),
        ("u1", "Unity Catalog Overview"), ("s9", "Lakeflow Connect recap"), ("c3", "Competitor launch")]
BOXES = {"Genie", "Genie Code", "Genie ZeroOps", "Unity Catalog", "Lakeflow Connect", "Lakebase", "Teams", "Rival BI", "Competitor"}
add, full = rv.plan(LINKS, feed, BOXES, skip={"s9": "event recap"})
check("a new upload naming a box is planned once", add == [("Genie ZeroOps", "b2", "Genie ZeroOps triage")], add)
check("a box at the cap is reported, not filled", full == [("Genie Code", "a1", "Genie Code in action")], full)
check("an upload that is already linked, skipped or names no Databricks box is left alone",
      not any(v in ("u1", "s9", "c3") for _, v, _ in add + full))

BOX = {"Genie ZeroOps": {"blog": "https://www.databricks.com/blog/genie-zeroops", "note": "x"},
       "Rival BI": {"site": "https://rival.example.com"}, "Teams": {"doc": "teams/"}, "Lakebase": {"doc": "lakebase/"}}
check("an undocumented Databricks box is a candidate, a competitor and an everyday word are not",
      sorted(rv.box_names(BOX, BOXES)) == ["Genie ZeroOps", "Lakebase"], sorted(rv.box_names(BOX, BOXES)))
check("a title about Genie ZeroOps goes to Genie ZeroOps, not to Genie",
      rv.plan({"Genie": {"doc": "genie/"}, **BOX}, [("z1", "Resolving incidents with Genie ZeroOps")], BOXES)[0] == [("Genie ZeroOps", "z1", "Resolving incidents with Genie ZeroOps")])
check("an everyday word in a title links nothing", rv.plan(BOX, [("t1", "Governing Cyber Agent Teams")], BOXES) == ([], []))
check("a recent upload that names no box is listed for a decision, once, unless it is linked or skipped",
      rv.unnamed(LINKS, feed + [("v1", "Vibe Data Modeling: AI Data Models That Match Your Business"), ("v1", "Vibe Data Modeling: AI Data Models That Match Your Business")],
                 BOXES, skip={"s9": "event recap"}) == [("c3", "Competitor launch"), ("v1", "Vibe Data Modeling: AI Data Models That Match Your Business")],
      rv.unnamed(LINKS, feed, BOXES, skip={"s9": "event recap"}))
CHIP = {"Agent memory": {"doc": "agents/custom-agents/stateful-agents"}, "Agent Runtime and Memory": {"doc": "agents/deploy/agent-runtime"}}
check("a documented entry that is no box on any board is not a candidate, so its videos could light no dot",
      rv.box_names(CHIP, {"Agent Runtime and Memory"}) == ["Agent Runtime and Memory"], rv.box_names(CHIP, {"Agent Runtime and Memory"}))
check("a title that names only such an entry is listed for a decision instead of linked",
      rv.plan(CHIP, [("m1", "Introducing Agent memory on Databricks")], {"Agent Runtime and Memory"}) == ([], [])
      and rv.unnamed(CHIP, [("m1", "Introducing Agent memory on Databricks")], {"Agent Runtime and Memory"}) == [("m1", "Introducing Agent memory on Databricks")])
REAL = lg.board_names()
check("board names cover platform boxes, industry tiles and heads, and alias targets, not capability-only entries",
      {"Agent Runtime and Memory", "The Trade Desk", "Ad Platforms & DSP", "Customer 360"} <= REAL and "Agent memory" not in REAL,
      sorted(n for n in ("Agent Runtime and Memory", "The Trade Desk", "Ad Platforms & DSP", "Customer 360", "Agent memory") if n in REAL))
L2 = {"Unity Catalog": {"videos": [{"id": "u1", "t": "Old title", "a": "UC"}, {"id": "u2", "t": "Gone"}]}, "Lakebase": {"videos": [{"id": "g", "t": "x"}]}}
out = rv.apply(L2, [("Unity Catalog", "u1", "New title")], [("Unity Catalog", "u2", "HTTP Error 404"), ("Lakebase", "g", "HTTP Error 401")],
               [("Unity Catalog", "n1", "Unity Catalog deep dive")])
check("a changed title is followed and the alias kept", out["Unity Catalog"]["videos"][0] == {"id": "u1", "t": "New title", "a": "UC"}, out)
check("a gone video is dropped and a new upload appended", [v["id"] for v in out["Unity Catalog"]["videos"]] == ["u1", "n1"], out)
check("an entry whose only video is gone loses its video list", "videos" not in out["Lakebase"], out)
check("404 and 401 read as gone; a channel or title failure does not",
      bool(rv.GONE.search("oembed error HTTP Error 404: Not Found")) and bool(rv.GONE.search("oembed http 401"))
      and not rv.GONE.search("channel 'X' not official Databricks") and not rv.GONE.search("title lacks feature/alias 'A'"))
check("the official channels include Databricks Events", lg.OFFICIAL_YT >= set(rv.CHANNELS))

URLS = {"c": {"banking:cite"}, "s": {"LINKS[Rival].site"}, "d": {"LINKS[Unity Catalog].doc/aws"},
        "m": {"banking:cite", "banking:uc:Real-Time Fraud"}, "v": {"LINKS[Genie].demos/tour"},
        "https://www.databricks.com/blog/jumpstart": {"LINKS[Medallion Architecture].also"},
        "https://databricks-industry-solutions.github.io/lakehouse-industry-data-models/": {"LINKS[Medallion Architecture].also"},
        "https://rival.example.com/docs": {"LINKS[Rival].also"}}
check("the highlights scope keeps Databricks links in any field and drops third-party citations and competitor sites",
      sorted(lg.highlight_urls(URLS)) == ["d", "https://databricks-industry-solutions.github.io/lakehouse-industry-data-models/",
                                         "https://www.databricks.com/blog/jumpstart", "m", "v"], sorted(lg.highlight_urls(URLS)))

import refresh_content as rc
with tempfile.TemporaryDirectory() as tmp:
    stamp, now = os.path.join(tmp, "stamp"), 1_800_000_000
    check("no recorded refresh has no age, so the refresh runs", rc.hours_since(stamp, now) is None and not rc.fresh(None, 72))
    rc.record(stamp, now)
    check("a recorded refresh reads back its age in hours", rc.hours_since(stamp, now + 3 * 3600) == 3, rc.hours_since(stamp, now + 3 * 3600))
    check("the record carries a readable UTC time", open(stamp).read().split()[1] == "2027-01-15T08:00:00Z", open(stamp).read())
    check("a refresh 10 hours old is fresh within 72 hours", rc.fresh(rc.hours_since(stamp, now + 10 * 3600), 72))
    check("a refresh exactly 72 hours old is no longer fresh", not rc.fresh(rc.hours_since(stamp, now + 72 * 3600), 72))
    check("a refresh 80 hours old runs again", not rc.fresh(rc.hours_since(stamp, now + 80 * 3600), 72))
    check("a record from the future does not skip the refresh", not rc.fresh(rc.hours_since(stamp, now - 3600), 72))
    open(stamp, "w").write("yesterday\n")
    check("an unreadable record has no age, so the refresh runs", rc.hours_since(stamp, now) is None)
    open(stamp, "w").write("")
    check("an empty record has no age, so the refresh runs", rc.hours_since(stamp, now) is None)
check("the record lives beside the tools and git ignores it",
      rc.STAMP == os.path.join(HERE, ".content_refresh") and "tools/.content_refresh" in open(os.path.join(HERE, "..", ".gitignore")).read().split())

failed = [r for r in results if not r[1]]
for name, ok, detail in results:
    if not ok:
        print("FAIL  %s  %s" % (name, str(detail)[:300]))
print("%s %d/%d" % ("PASS" if not failed else "FAIL", len(results) - len(failed), len(results)))
sys.exit(1 if failed else 0)
