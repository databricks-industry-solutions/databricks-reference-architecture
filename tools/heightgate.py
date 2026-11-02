#!/usr/bin/env python3
"""Fail if any industry board is taller than the standard reference architecture.

The board is fitted to the viewport by whichever of width or height binds first,
and every board here is height-bound. The two corner pockets (People, External
Ingestion) are single narrow columns, and the platform block beside a
pocket grows to whatever height the pocket needs. So a pocket row added by an
industry is paid for by every label on the diagram: the airlines pocket at four
groups and thirteen tiles took the board from 1126 design px to 1677 and the
fitted scale from 0.819 to 0.550, shrinking all text by a third.

Height is therefore a budget, not an outcome, and this is the gate on it. Run it
after editing INDUSTRIES; it drives a real browser because the numbers come from
layout, not from counting tiles in the source.

    python3 tools/heightgate.py [--tolerance 8] [--app app/index.html] [--tighten]

Exits non-zero when any board goes unmeasured, when an industry exceeds the
reference height by more than the tolerance, or when a board already over it
grows past the height recorded for it in heightgate_baseline.json, so it can be
chained with && in a release step. --tighten writes lower heights back for
boards that shrank and drops boards that fit again; it never raises or adds one.
"""
import argparse
import functools
import http.server
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import time
from html import unescape

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

DRIVER = r"""
(function(){
  function measure(){
    if(typeof fitBoard === "function") fitBoard();
    document.body.getBoundingClientRect();
    var board = document.getElementById("board");
    var dw = parseFloat(getComputedStyle(document.body).getPropertyValue("--designw"));
    var clip = 0, squeezed = 0, clipped = [];
    function textLines(n){
      var tops = [], walk = document.createTreeWalker(n, NodeFilter.SHOW_TEXT), t;
      while((t = walk.nextNode())){
        if(!t.textContent.trim()) continue;
        var rg = document.createRange(); rg.selectNodeContents(t);
        Array.prototype.forEach.call(rg.getClientRects(), function(r){
          if(r.width < 0.5) return;
          if(!tops.some(function(y){ return Math.abs(y - r.top) < r.height / 2; })) tops.push(r.top);
        });
      }
      return tops.length;
    }
    /* .rg-label is in this list because it is the one label on the board that
       cannot wrap: a group header is nowrap, so an over-long industry group name
       is silently cut rather than reflowed, and a clip check that skipped it
       passed "OPERATIONS & TECHNI" as clean. */
    document.querySelectorAll(".t-name,.p-name,.bl-name,.rg-label,.pcard .p-cap,.t-cap").forEach(function(n){
      if(n.scrollWidth > n.clientWidth + 1){
        clip++;
        if(clipped.length < 4) clipped.push(n.textContent.trim());
      }
      if(textLines(n) >= 3 && n.textContent.trim().split(/\s+/).length <= 2) squeezed++;
    });
    return { h: board.offsetHeight,
             scale: Math.round(board.getBoundingClientRect().width / dw * 1000) / 1000,
             clip: clip, squeezed: squeezed, clipped: clipped };
  }
  /* Every shape, not just the one the board opens on. */
  var SHAPES = ["z", "s", "t", "rt"], VIEWS = ["detailed", "simple"];
  var ids = (window.HG_ONLY && window.HG_ONLY.length) ? window.HG_ONLY : ["generic"].concat(INDUSTRY_CATALOG.map(function(row){ return row[0]; })
    .filter(function(id){ return !INDUSTRY_BUILT || INDUSTRY_BUILT.has(id); }));
  var res = {}, failed = [];
  function wait(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
  async function whyNot(id){
    try {
      var r = await fetch(APP_BASE + "architectures/" + id + ".yaml", { cache:"no-store" });
      return r.ok ? "fetched but did not parse" : "HTTP " + r.status;
    } catch(e){ return String((e && e.message) || e); }
  }
  async function run(){
    for(var i = 0; i < ids.length; i++){
      var id = ids[i];
      let loaded = false;
      for(let attempt = 0; attempt < 3 && !loaded; attempt++){ loaded = await loadIndustry(id); if(!loaded) await wait(500); }
      if(!loaded){ failed.push(id + " (" + (await whyNot(id)) + ")"); continue; }
      for(var v = 0; v < VIEWS.length; v++) for(var j = 0; j < SHAPES.length; j++){
        viewMode = VIEWS[v];
        await applyIndustry(id, false);
        try { applyShape(SHAPES[j], false); } catch(e){}
        await wait(300);
        if(document.body.classList.contains("view-simple") !== (VIEWS[v] === "simple")) continue;
        res[id + "@" + SHAPES[j] + (VIEWS[v] === "simple" ? ".simple" : "")] = measure();
      }
    }
    var pre = document.createElement("pre");
    pre.id = "GATE";
    pre.textContent = JSON.stringify({ res: res, failed: failed, expected: ids.length * SHAPES.length * VIEWS.length });
    document.body.appendChild(pre);
  }
  (typeof INTRO_DONE !== "undefined" ? INTRO_DONE : Promise.resolve()).then(run);
})();
"""
APP_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "app")
GATE_PATH = "/__heightgate.html"


def serve(page_bytes):
    class Handler(http.server.SimpleHTTPRequestHandler):
        def do_GET(self):
            if self.path.split("?")[0] == GATE_PATH:
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(page_bytes)))
                self.end_headers()
                self.wfile.write(page_bytes)
                return
            super().do_GET()

        def log_message(self, *args):
            pass

    class Server(http.server.ThreadingHTTPServer):
        request_queue_size = 128

    httpd = Server(("127.0.0.1", 0), functools.partial(Handler, directory=APP_DIR))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def render(app_path, only=None):
    page_html = open(app_path, encoding="utf-8").read()
    inject = ("<script>window.HG_ONLY=" + json.dumps(list(only or [])) + ";window.addEventListener('load',function(){"
              + DRIVER + "});</script>\n</body>")
    page_html = page_html.replace("</body>", inject, 1)
    httpd = serve(page_html.encode("utf-8"))
    tmp = tempfile.mkdtemp()
    dom = os.path.join(tmp, "dom.html")
    profile = os.path.join(tmp, "profile")

    # Chrome streams --dump-dom to stdout and then keeps the process alive, so
    # waiting for it to exit is waiting forever. Watch the dump until it stops
    # growing, then kill it.
    with open(dom, "wb") as sink:
        proc = subprocess.Popen(
            [CHROME, "--headless", "--disable-gpu", "--hide-scrollbars",
             "--force-device-scale-factor=1", "--user-data-dir=" + profile,
             "--window-size=1728,1080", "--virtual-time-budget=900000",
             "--dump-dom", "http://127.0.0.1:%d%s" % (httpd.server_address[1], GATE_PATH)],
            stdout=sink, stderr=subprocess.DEVNULL)
        prev, stable = -1, 0
        for _ in range(1200):
            time.sleep(0.5)
            size = os.path.getsize(dom)
            if size > 10000 and size == prev:
                stable += 1
                if stable >= 2:
                    break
            else:
                stable = 0
            prev = size
        proc.kill()
        proc.wait(timeout=20)
    httpd.shutdown()

    text = open(dom, encoding="utf-8", errors="replace").read()
    shutil.rmtree(tmp, ignore_errors=True)
    m = re.search(r'<pre id="GATE"[^>]*>(.*?)</pre>', text, re.S)
    if not m:
        sys.exit("gate driver produced no output (dom bytes: %d)" % len(text))
    return json.loads(unescape(m.group(1)))


BASELINE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "heightgate_baseline.json")


def load_baseline(path=BASELINE):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return {}


def save_baseline(baseline, path=BASELINE):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(dict(sorted(baseline.items())), f, indent=2)
        f.write("\n")


def failed_ids(out):
    return [f.split(" (")[0] for f in out.get("failed") or []]


def merged(first, second):
    res = dict(first["res"])
    res.update(second["res"])
    return {"res": res, "failed": second["failed"], "expected": first["expected"]}


def coverage(out):
    if out["failed"] or len(out["res"]) != out["expected"]:
        return ("measured %d of %d boards; did not load: %s"
                % (len(out["res"]), out["expected"], ", ".join(out["failed"]) or "none"))
    return None


def reference(res):
    return {k.split("@")[1]: v["h"] for k, v in res.items() if k.startswith("generic@")}


def judge(res, baseline, tolerance):
    ref = reference(res)
    rows = []
    for name in sorted(k for k in res if not k.startswith("generic@")):
        r, base, held = res[name], ref[name.split("@")[1]], baseline.get(name)
        limit = base + tolerance if held is None else max(base + tolerance, held)
        rows.append({"name": name, "r": r, "ref": base, "held": held,
                     "fail": bool(r["h"] > limit or r["clip"] or r["squeezed"])})
    return rows, sorted(k for k in baseline if k not in res)


def tightened(res, baseline, tolerance):
    ref = reference(res)
    return {name: min(held, res[name]["h"]) for name, held in baseline.items()
            if name in res and res[name]["h"] > ref[name.split("@")[1]] + tolerance}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--app", default="app/index.html")
    # 32px sits between the two things this gate has to tell apart. A row added to
    # a corner pocket costs ~45px and is the regression worth failing on, because
    # the platform block beside the pocket grows to match it. A top band carrying
    # more industry tiles legitimately measures taller when its tiles are narrow
    # enough for a sublabel to take a second line, and that is content, not a
    # layout fault.
    ap.add_argument("--tolerance", type=int, default=32,
                    help="design px an industry may exceed the reference by; "
                         "under one pocket row, over a top-band content difference")
    ap.add_argument("--tighten", action="store_true",
                    help="write the baseline back with boards that shrank lowered and boards that fit "
                         "or are gone dropped; it never raises or adds a board")
    args = ap.parse_args()

    out = render(args.app)
    again = failed_ids(out)
    if again:
        print("measuring again the boards that did not load: " + ", ".join(again))
        out = merged(out, render(args.app, again))
    gap = coverage(out)
    if gap:
        print("FAIL: " + gap)
        return 1
    res = out["res"]
    # The reference board is the budget, per shape: a shape legitimately has its
    # own height, so comparing an industry in t against the reference in z
    # would convict the shape rather than the industry.
    for key in sorted(k for k in res if k.startswith("generic@")):
        r = res[key]
        print("reference@%-4s h=%-5d scale=%.3f  clip=%-3d squeezed=%-3d %s"
              % (key.split("@")[1], r["h"], r["scale"], r["clip"], r["squeezed"], r["clipped"] or ""))

    baseline = load_baseline()
    rows, stale = judge(res, baseline, args.tolerance)
    for row in rows:
        r = row["r"]
        print("%-18s h=%-5d %+5d  held=%-5s scale=%.3f  clip=%-3d squeezed=%-3d  %-4s %s"
              % (row["name"], r["h"], r["h"] - row["ref"], row["held"] or "-", r["scale"], r["clip"],
                 r["squeezed"], "FAIL" if row["fail"] else "ok", r["clipped"] or ""))
    over = [x for x in rows if x["r"]["h"] > x["ref"] + args.tolerance]
    shrank = [x for x in rows if x["held"] is not None and x["r"]["h"] < x["held"]]
    rel = os.path.relpath(BASELINE, os.path.join(os.path.dirname(BASELINE), ".."))
    print("\n%d of %d boards are over the reference budget; the baseline (%s) holds %d."
          % (len(over), len(rows), rel, len(baseline)))
    if shrank:
        print("%d held boards shrank below their recorded height: run with --tighten to lock in the gain."
              % len(shrank))
    if stale:
        print("baseline entries for boards that are no longer measured: %s (run with --tighten)" % ", ".join(stale))
    if args.tighten:
        new = tightened(res, baseline, args.tolerance)
        save_baseline(new)
        print("baseline tightened: %d boards held (was %d)" % (len(new), len(baseline)))

    bad = [x["name"] for x in rows if x["fail"]]
    if bad:
        print("\nFAIL: " + ", ".join(bad))
        print("An industry may not outgrow the reference board, and a board held in the baseline may "
              "not grow past its recorded height. Consolidate the People and Ingestion pockets: fold "
              "roles into a tile's detail text rather than giving each one a row.")
        return 1
    print("\nPASS: no board grew. %d fit the reference height; %d are over it and held at their "
          "recorded height." % (len(rows) - len(over), len(over)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
