#!/usr/bin/env python3
import importlib.util, os, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("heightgate", os.path.join(HERE, "heightgate.py"))
hg = importlib.util.module_from_spec(spec)
spec.loader.exec_module(hg)
results = []


def check(name, cond, detail=""):
    results.append((name, bool(cond), detail))


def board(h, clip=0, squeezed=0):
    return {"h": h, "scale": .7, "clip": clip, "squeezed": squeezed, "clipped": []}


RES = {"generic@z": board(1200), "generic@t": board(1500),
       "fits@z": board(1232), "over@z": board(1233), "held@z": board(1300), "grew@z": board(1301),
       "shrank@z": board(1280), "fitsnow@z": board(1220), "clipped@z": board(1100, clip=1),
       "squeezed@z": board(1100, squeezed=1), "tall@t": board(1530)}
BASE = {"held@z": 1300, "grew@z": 1300, "shrank@z": 1300, "fitsnow@z": 1300, "gone@z": 1400}

rows, stale = hg.judge(RES, BASE, 32)
by = {r["name"]: r for r in rows}
check("a board exactly at the reference plus the tolerance passes", not by["fits@z"]["fail"], by["fits@z"])
check("a board one pixel over the budget with no recorded height fails", by["over@z"]["fail"], by["over@z"])
check("a held board at its recorded height passes", not by["held@z"]["fail"], by["held@z"])
check("a held board one pixel past its recorded height fails", by["grew@z"]["fail"], by["grew@z"])
check("a held board that shrank passes", not by["shrank@z"]["fail"], by["shrank@z"])
check("a clipped label fails whatever the height", by["clipped@z"]["fail"])
check("a squeezed label fails whatever the height", by["squeezed@z"]["fail"])
check("each shape is judged against its own reference", not by["tall@t"]["fail"] and by["tall@t"]["ref"] == 1500)
check("the reference boards are not judged against themselves", not any(n.startswith("generic@") for n in by))
check("a recorded board that is no longer measured is reported stale", stale == ["gone@z"], stale)

VIEWED = {"generic@z": board(1200), "generic@z.simple": board(900), "a@z": board(1200), "a@z.simple": board(1000)}
vrows = {r["name"]: r for r in hg.judge(VIEWED, {}, 32)[0]}
check("a Simplified board is judged against the Simplified reference, not the Detailed one",
      vrows["a@z.simple"]["ref"] == 900 and vrows["a@z.simple"]["fail"] and not vrows["a@z"]["fail"], vrows)
check("the Simplified reference is not judged against itself", "generic@z.simple" not in vrows)

new = hg.tightened(RES, BASE, 32)
check("tightening lowers a board that shrank", new.get("shrank@z") == 1280, new)
check("tightening keeps a held board at its height", new.get("held@z") == 1300, new)
check("tightening never raises a board that grew", new.get("grew@z") == 1300, new)
check("tightening drops a board that fits the budget again", "fitsnow@z" not in new, new)
check("tightening drops a board that is no longer measured", "gone@z" not in new, new)
check("tightening never adds a board over the budget with no recorded height", "over@z" not in new, new)

check("every board measured is full coverage", hg.coverage({"res": {"a": 1, "b": 2}, "failed": [], "expected": 2}) is None)
check("a board that was not measured fails coverage", hg.coverage({"res": {"a": 1}, "failed": [], "expected": 2}))
check("a board's id is read back from its failure reason", hg.failed_ids({"failed": ["media_broadcasting (fetched but did not parse)", "x"]}) == ["media_broadcasting", "x"])
first = {"res": {"a@z": 1}, "failed": ["b (Failed to fetch)"], "expected": 2}
check("a board that loads on the second pass completes coverage", hg.coverage(hg.merged(first, {"res": {"b@z": 2}, "failed": [], "expected": 1})) is None)
check("a board that fails both passes still fails coverage and is named",
      "b (HTTP 404)" in (hg.coverage(hg.merged(first, {"res": {}, "failed": ["b (HTTP 404)"], "expected": 1})) or ""))
check("a board that did not load fails coverage and is named",
      "retail" in (hg.coverage({"res": {"a": 1, "b": 2}, "failed": ["retail"], "expected": 2}) or ""))

with tempfile.TemporaryDirectory() as d:
    path = os.path.join(d, "baseline.json")
    check("a missing baseline reads as empty", hg.load_baseline(path) == {})
    hg.save_baseline(new, path)
    check("a saved baseline reads back the same", hg.load_baseline(path) == new)
    check("a saved baseline is sorted by board", list(hg.load_baseline(path)) == sorted(new))

committed = hg.load_baseline()
check("the committed baseline holds positive heights keyed industry@shape or industry@shape.simple and no reference board",
      committed and all(isinstance(v, int) and v > 0 and k.count("@") == 1 and not k.startswith("generic@")
                        and k.split("@")[1] in ("z", "s", "t", "rt", "z.simple", "s.simple", "t.simple", "rt.simple")
                        for k, v in committed.items()), len(committed))

failed = [r for r in results if not r[1]]
for name, ok, detail in results:
    if not ok:
        print("FAIL  %s  %s" % (name, str(detail)[:300]))
print("%s %d/%d" % ("PASS" if not failed else "FAIL", len(results) - len(failed), len(results)))
sys.exit(1 if failed else 0)
