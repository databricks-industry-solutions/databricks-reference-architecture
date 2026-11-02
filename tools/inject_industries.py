#!/usr/bin/env python3
"""Emit per-industry architecture modules from tools/industries/batch*.py.

Since the data-modularisation split, index.html ships only the reference board;
every industry lives in app/architectures/<id>.yaml (a readable descriptor) and is
fetched on demand. This tool regenerates those YAML modules from the batch
authoring files (the source of truth for the 62 generated industries). `airlines`
is hand-authored and lives only as app/architectures/airlines.yaml, so it is not
emitted here.

The field selection mirrors what the runtime consumes: only the keys below are
built, so an incidental authoring field never leaks into a shipped module. The
same swap_layout() the board relied on (Genie Agents lead the top band; apps drop
to the Consumers rail) is applied before emit. The terse dict is then converted to
the readable YAML descriptor by tools/terse_to_yaml.js, so the terse<->readable
schema lives in exactly one place (app/arch_schema.js) and never forks into Python.

Usage:
  inject_industries.py            # (re)write app/architectures/<id>.yaml
  inject_industries.py --check    # compare against existing files, write nothing
"""
import importlib.util
import json
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
ARCH_DIR = ROOT / "app" / "architectures"
BATCH_DIR = ROOT / "tools" / "industries"


# ---- dict builders (mirror the runtime-consumed shape, dropping absent keys) ----
def build_flow(f: dict) -> dict:
    return {"types": list(f.get("types", [])), "vol": f.get("vol", ""), "interval": f.get("interval", "")}


def build_data_out(do: dict) -> dict:
    out = {}
    if do.get("batch"):
        out["batch"] = build_flow(do["batch"])
    if do.get("stream"):
        out["stream"] = build_flow(do["stream"])
    return out


def build_tile(tile: dict, ppl: bool = False) -> dict:
    t = {"n": tile["n"]}
    if not ppl and tile.get("ic"):
        t["ic"] = tile["ic"]
    for k in ("s", "mark", "long"):
        if tile.get(k):
            t[k] = tile[k]
    if tile.get("cite"):
        t["cite"] = list(tile["cite"])
    for k in ("cat", "what", "users"):
        if tile.get(k):
            t[k] = tile[k]
    if tile.get("dataOut"):
        t["dataOut"] = build_data_out(tile["dataOut"])
    for k in ("feeds", "kpis", "teams", "questions"):
        if tile.get(k):
            t[k] = list(tile[k])
    if tile.get("uses"):
        t["uses"] = [[u[0], u[1]] for u in tile["uses"]]
    for k in ("caps", "rel"):
        if tile.get(k):
            t[k] = list(tile[k])
    if tile.get("sub"):
        t["sub"] = [{"n": p["n"], "cares": p["cares"]} for p in tile["sub"]]
    if tile.get("ucs"):
        t["ucs"] = list(tile["ucs"])
    return t


def build_group(g: dict, rail_id: str = "") -> dict:
    ppl = rail_id == "ppl"
    grp = {"box": g["box"], "ic": g["ic"]}
    if g.get("from"):
        grp["from"] = g["from"]
    if g.get("tail"):
        grp["tail"] = True
    grp["tiles"] = [build_tile(t, ppl=ppl) for t in g.get("tiles", [])]
    return grp


def build_rails(rails: dict) -> dict:
    return {rid: [build_group(g, rid) for g in rails[rid]] for rid in ("src", "ing", "ppl", "cons")}


def build_top_tile(t: dict) -> dict:
    o = {"n": t["n"]}
    for k in ("s", "ic", "long", "problem", "who", "how"):
        if t.get(k):
            o[k] = t[k]
    if t.get("comps"):
        o["comps"] = list(t["comps"])
    for k in ("feeds", "teams", "questions"):
        if t.get(k):
            o[k] = list(t[k])
    if t.get("stories"):
        o["stories"] = [{"t": s["t"], "u": s["u"]} for s in t["stories"]]
    return o


def build_top(top: list) -> list:
    return [
        {"title": sec["title"], "ic": sec["ic"], "span": sec["span"], "cols": sec["cols"],
         "tiles": [build_top_tile(t) for t in sec["tiles"]]}
        for sec in top
    ]


def build_sources(sources: dict) -> dict:
    return {k: {"t": v["t"], "u": v["u"]} for k, v in sources.items()}


def swap_layout(ind: dict) -> None:
    """Map the authoring shape to the rendered shape (in place).

    Authors still write Genie tiles into the Consumers rail (via cons_rail's
    genie_spaces=) and app tiles into the top band (via top_band). The board
    renders the opposite: Genie Agents lead the top band beside Business Use
    Cases, and the apps drop to the Consumers rail where Genie used to sit. Doing
    the swap here keeps all batch files untouched and the mapping in one place.
    Every Genie tile's name is suffixed with "Agent".
    """
    cons = ind["rails"]["cons"]
    gi = next(
        (i for i, g in enumerate(cons)
         if g.get("ic") == "genie" or g.get("box") in ("Genie Spaces", "Genie Agents")),
        None,
    )
    if gi is None:
        return
    genie_box = cons.pop(gi)
    genie_tiles = genie_box.get("tiles", [])
    for t in genie_tiles:
        if not t["n"].endswith("Agent"):
            t["n"] = t["n"] + " Agent"

    top = ind["top"]
    ai = next((i for i, s in enumerate(top) if s.get("title") == "Apps"), None)
    apps_sec = top.pop(ai) if ai is not None else {"tiles": []}
    for s in top:
        if s.get("title") == "Use Cases":
            s["title"] = "Business Use Cases"

    top.insert(0, {"title": "Genie Agents", "ic": "genie", "span": 3, "cols": 2,
                   "tiles": genie_tiles})
    cons.insert(gi, {"box": "Databricks Apps", "ic": "apps", "tiles": apps_sec.get("tiles", [])})


def render_industry(ind: dict) -> dict:
    swap_layout(ind)
    med = ind["medallion"]
    return {
        "label": ind["label"],
        "blurb": ind["blurb"],
        "medallion": {stage: {"s": med[stage]["s"], "long": med[stage]["long"]}
                      for stage in ("Bronze", "Silver", "Gold")},
        "rails": build_rails(ind["rails"]),
        "top": build_top(ind["top"]),
        "sources": build_sources(ind["sources"]),
    }


BRIDGE = ROOT / "tools" / "terse_to_yaml.js"


def terse_to_yaml(terse: dict) -> str:
    """Readable YAML descriptor for a terse board, via the single JS transform."""
    out = subprocess.run(["node", str(BRIDGE)], input=json.dumps(terse),
                         capture_output=True, text=True, check=True)
    return out.stdout


def yaml_to_terse(fp: pathlib.Path) -> dict:
    """Terse board rehydrated from an existing YAML descriptor, via the same JS transform."""
    out = subprocess.run(["node", str(BRIDGE), "--terse", str(fp)],
                         capture_output=True, text=True, check=True)
    return json.loads(out.stdout)


def carry_simple(rendered: dict, existing: dict) -> dict:
    for rid, groups in rendered["rails"].items():
        held = {g["box"]: g["simple"] for g in (existing.get("rails") or {}).get(rid, []) if g.get("simple")}
        for g in groups:
            if g["box"] in held:
                g["simple"] = held[g["box"]]
    return rendered


def load_batches():
    merged = {}
    for path in sorted(BATCH_DIR.glob("batch*.py")):
        spec = importlib.util.spec_from_file_location(path.stem, path)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        for name in dir(mod):
            if name.startswith("INDUSTRIES_BATCH"):
                merged.update(getattr(mod, name))
    return merged


def main():
    check = "--check" in sys.argv
    batches = load_batches()
    if not batches:
        print("No batch modules found.", file=sys.stderr)
        return 1

    ARCH_DIR.mkdir(parents=True, exist_ok=True)
    mismatches, written = [], 0
    for iid, ind in sorted(batches.items()):
        rendered = render_industry(ind)
        fp = ARCH_DIR / f"{iid}.yaml"
        existing = yaml_to_terse(fp) if fp.exists() else None
        if existing:
            carry_simple(rendered, existing)
        if check:
            # Compare on the terse structure, not the YAML text, so cosmetic
            # formatting never causes a false mismatch: the descriptor is correct
            # iff it rehydrates to the same board the batch source builds.
            if existing is None:
                mismatches.append(f"{iid} (missing file)")
            elif existing != rendered:
                mismatches.append(iid)
        else:
            fp.write_text(terse_to_yaml(rendered), encoding="utf-8")
            written += 1

    if check:
        if mismatches:
            print(f"MISMATCH ({len(mismatches)}): {', '.join(mismatches[:15])}", file=sys.stderr)
            return 1
        print(f"OK: {len(batches)} batch industries match app/architectures/*.yaml")
        return 0
    print(f"Wrote {written} industry modules to {ARCH_DIR}")
    return 0


if __name__ == "__main__":
    sys.exit(main() or 0)
