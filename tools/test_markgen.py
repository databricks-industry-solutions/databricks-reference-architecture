#!/usr/bin/env python3
import importlib.util, os, pathlib, sys, tempfile, zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("markgen", os.path.join(HERE, "markgen.py"))
mg = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mg)
results = []


def check(name, cond, detail=""):
    results.append((name, bool(cond), detail))


def raises(fn, exc):
    try:
        fn()
    except exc as e:
        return str(e) or True
    return False


body = '<style>.a{fill:#f00}.b{stroke:#00f;stroke-width:2}</style><path class="a b" d="M0 0"/><path class="a" style="opacity:.5" d="M1 1"/>'
out = mg.inline_styles("t", body)
check("a class rule becomes an inline style and the style block goes", '<path style="fill:#f00;stroke:#00f;stroke-width:2" d="M0 0"/>' in out and "<style" not in out, out)
check("an element's own style keeps the last word over its class rule", 'style="fill:#f00;opacity:.5"' in out, out)
check("a rule that is not a single class is refused instead of dropped", raises(lambda: mg.inline_styles("t", "<style>path{fill:red}</style><path/>"), ValueError))

for label, svg in [("an external image", '<svg viewBox="0 0 10 10"><image href="https://x.example/y.png"/></svg>'),
                   ("a script", '<svg viewBox="0 0 10 10"><script>alert(1)</script></svg>'),
                   ("an event handler", '<svg viewBox="0 0 10 10"><path onload="x()" d="M0 0"/></svg>'),
                   ("a data URI", '<svg viewBox="0 0 10 10"><use href="data:image/svg+xml,abc"/></svg>')]:
    check("a logo carrying %s is refused" % label, raises(lambda s=svg: mg.transform_logo("k", s), ValueError))

g, box, attrs = mg.transform_logo("k", '<svg viewBox="0 0 10 10" fill="none"><defs><linearGradient id="g1"/><filter id="f"><feGaussianBlur/></filter></defs>'
                                       '<path filter="url(#f)" fill="url(#g1)" d="M0 0"/></svg>')
check("ids are namespaced per logo so two logos on one page never share a gradient", 'id="lg-k-g1"' in g and "url(#lg-k-g1)" in g and 'id="g1"' not in g, g)
check("filters are dropped from logos", "<filter" not in g and "filter=" not in g, g)
xg, _, _ = mg.transform_logo("x", '<svg viewBox="0 0 10 10"><defs><path id="a" d="M0 0"/></defs><use xlink:href="#a"/></svg>')
check("xlink:href becomes href, so a logo decodes as a standalone image in the decks", 'href="#lg-x-a"' in xg and "xlink:" not in xg, xg)
check("the root fill carries onto the logo group, so shapes that rely on it still paint", attrs == ' fill="none"' and box == (0.0, 0.0, 10.0, 10.0), (attrs, box))

fit = mg.service_logo("w", '<svg viewBox="0 0 100 50"><path d="M0 0h100v50z" fill="#123456"/></svg>')
check("a wide service icon is centred on the canvas inside the logo padding", fit.startswith('<g transform="translate(2 13) scale(0.44)">'), fit[:60])
ink = mg.service_logo("i", '<svg viewBox="0 0 10 10"><path d="M0 0" fill="black"/><path d="M1 1" style="fill:#232f3e;opacity:.5"/>'
                           '<path d="M2 2" fill="#ff9900"/><mask id="k"><rect width="10" height="10" fill="#000"/></mask></svg>')
check("near-black ink follows the theme, with its own colour as the fallback",
      'style="fill:var(--logo-ink,black)"' in ink and 'style="fill:var(--logo-ink,#232f3e);opacity:.5"' in ink, ink)
check("a brand colour keeps its colour", 'fill="#ff9900"' in ink, ink)
check("black inside a mask stays black, so the mask still hides what it should", '<rect width="10" height="10" fill="#000"/>' in ink, ink)
bd = mg.service_logo("b", '<svg viewBox="0 0 20 10"><rect width="20" height="9.8" fill="white"/><rect x="2" y="2" width="4" height="4" fill="white"/>'
                          '<clipPath id="c"><rect width="20" height="10" fill="white"/></clipPath><path d="M1 1" fill="#ff0000"/></svg>')
check("a light backdrop that covers the canvas goes, so the logo is transparent", 'width="20" height="9.8"' not in bd, bd)
check("a small light detail and a clip rect stay", 'width="4" height="4" fill="white"' in bd and '<clipPath id="lg-b-c"><rect width="20" height="10" fill="white"/></clipPath>' in bd, bd)
check("a service icon keeps its own colours", 'fill="#123456"' in fit, fit)
prov = mg.provider_logo("p", '<svg viewBox="0 0 300 100"><path d="M0 0h300v100z" fill="#ff9900"/></svg>')
check("a provider logo keeps its own aspect and colours for the band label", prov["vb"] == "0 0 300 100" and 'fill="#ff9900"' in prov["g"], prov)

container = ('<g filter="url(#f)"><rect x="50" y="10" width="80" height="80" rx="20" fill="white"/></g>'
             '<path d="M60 20h20v20z" fill="#FF3621"/><path d="M65 25h5v5z" fill="white"/>'
             '<defs><filter id="f"><feGaussianBlur/></filter><clipPath id="c"><rect width="10" height="10" fill="white"/></clipPath></defs>')
cbody, cbox, cuts = mg.uncontain("T", container)
check("a container icon is cropped to its container tile", cbox == (50.0, 10.0, 80.0, 80.0), cbox)
check("a white detail on top of colour becomes a cut-out, the clip rect is left alone",
      len(cuts) == 1 and 'fill="#000"' in cuts[0] and '<clipPath id="c"><rect width="10" height="10" fill="white"/></clipPath>' in cbody, (cuts, cbody))
check("the container's shadow filter goes with the container", "filter" not in cbody and "<rect x=\"50\"" not in cbody, cbody)
check("a container without a light first rect is refused", raises(lambda: mg.uncontain("T", '<rect width="5" height="5" fill="#000"/>'), ValueError))
saved = set(mg.CONTAINERS)
try:
    mg.CONTAINERS.add("Test Box")
    mark = mg.transform("Test Box", '<svg viewBox="0 0 200 100">' + container + "</svg>")
    check("a container mark keeps its cut-out as a mask, so it reads in every theme",
          '<mask id="test-box-ko" maskUnits="userSpaceOnUse" x="50" y="10" width="80" height="80">' in mark and 'mask="url(#test-box-ko)"' in mark, mark[:200])
    check("a container mark is scaled to the container, not to the wide canvas", mark.startswith('<g transform="translate(-25.5 -3.5) scale(0.55)">'), mark[:60])
finally:
    mg.CONTAINERS.clear()
    mg.CONTAINERS.update(saved)
plain = mg.transform("Plain", '<svg viewBox="0 0 10 10"><rect width="10" height="10" fill="white"/><path d="M1 1h8v8z" fill="#FF3621"/></svg>')
check("an ordinary mark still drops its white plate and gets no mask", "<mask" not in plain and "#FF3621" not in plain and "currentColor" in plain, plain)

check("rounding never merges a whole number into the next dot-led number", mg.shrink_numbers('<path d="M1.995.5L3 4"/>') == '<path d="M2 .5L3 4"/>',
      mg.shrink_numbers('<path d="M1.995.5L3 4"/>'))
check("rounding never reads the tail of a dot-led number and the next one as a single number",
      mg.shrink_numbers('<path d="M.64-.609.995-.752 10.064-4.056"/>') == '<path d="M.64-.609.995-.752 10.06-4.06"/>',
      mg.shrink_numbers('<path d="M.64-.609.995-.752 10.064-4.056"/>'))
check("rounding leaves packed numbers that keep a decimal point packed", mg.shrink_numbers('<path d="M1.234.5-2.001.25"/>') == '<path d="M1.23.5-2 .25"/>',
      mg.shrink_numbers('<path d="M1.234.5-2.001.25"/>'))
for member, want in [("Architecture-Service-Icons_07312026/Arch_Storage/48/Arch_Amazon-Simple-Storage-Service_48.svg", "amazon-simple-storage-service"),
                     ("Resource-Icons_07312026/Res_Analytics/Res_AWS-Glue_Data-Catalog_48.svg", "aws-glue-data-catalog"),
                     ("Azure_Public_Service_Icons/Icons/storage/10090-icon-service-Data-Lake-Storage-Gen1.svg", "data-lake-storage-gen1"),
                     ("v6.1.0/package/dist/svg/purview_48_color.svg", "purview"), ("v6.1.0/package/dist/svg/data_factory_64_item.svg", "data-factory"),
                     ("Power Platform/PowerPlatform_scalable.svg", "powerplatform"), ("Unique Icons/BigQuery/SVG/BigQuery-512-color.svg", "bigquery"),
                     ("Microsoft Entra architecture icons - Oct 2023/Microsoft Entra color icons SVG/Microsoft Entra ID color icon.svg", "microsoft-entra-id")]:
    check("artwork key for %s" % want, mg.art_key(member) == want, mg.art_key(member))

state = (mg.SERVICES, mg.CLOUD_LOGOS, mg.MARKS, mg.AGENT_LOGOS, mg.fetch_pkg)
try:
    mg.SERVICES = {"aws": {"A": ("aws", "x/Arch_Foo_48.svg"), "B": ("aws", "x/Arch_Foo_48.svg"), "C": ("azure", "y/00001-icon-service-Bar.svg")}}
    mg.CLOUD_LOGOS, mg.MARKS, mg.AGENT_LOGOS = {}, {}, {}
    mg.fetch_pkg = lambda pkg, member, refresh=False: '<svg viewBox="0 0 10 10"><path d="M0 0h10v10z" fill="#123"/></svg>'
    providers, bundles = mg.build_logos()
    b = bundles["aws"]
    check("two tiles that share one official icon share one artwork entry", b["tiles"] == {"A": "foo", "B": "foo", "C": "bar"} and sorted(b["art"]) == ["bar", "foo"], b["tiles"])
    check("every artwork records the package it came from", b["src"] == {"foo": mg.PACKAGES["aws"][1], "bar": mg.PACKAGES["azure"][1]}, b["src"])
    check("bundles serialise deterministically", mg.bundle_text(b) == mg.bundle_text({"src": b["src"], "art": b["art"], "tiles": b["tiles"]}))
    check("a service tile that no board carries is reported", mg.orphaned_keys('x n:"A" n:"B" y') == ["C"], mg.orphaned_keys('x n:"A" n:"B" y'))
    mg.AGENT_LOGOS = {"Acme": ("file", "acme"), "Zeta": ("file", "zeta")}
    got = mg.orphaned_keys('x n:"A" n:"B" n:"C" logos:["Acme","Other"] y')
    check("an agent logo is matched by a logos list and one no list names is reported", got == ["Zeta"], got)
finally:
    mg.SERVICES, mg.CLOUD_LOGOS, mg.MARKS, mg.AGENT_LOGOS, mg.fetch_pkg = state

with tempfile.TemporaryDirectory() as tmp:
    saved_cache, saved_key, saved_env = mg.CACHE, mg.BF_KEY_FILE, os.environ.pop("BRANDFOLDER_API_KEY", None)
    try:
        mg.CACHE, mg.BF_KEY_FILE = pathlib.Path(tmp), pathlib.Path(tmp) / "absent.json"
        msg = raises(mg.brandfolder_key, RuntimeError)
        check("a missing Brandfolder key fails with how to provide it", msg and "BRANDFOLDER_API_KEY" in str(msg), msg)
        (pathlib.Path(tmp) / "bf").mkdir()
        (pathlib.Path(tmp) / "bf" / "logo.svg").write_text('<svg viewBox="0 0 1 1">' + "x" * 100 + "</svg>")
        check("a cached brand library file needs no key", mg.fetch("Logo", ("bf", "asset", "logo.svg")).startswith("<svg"))
        (pathlib.Path(tmp) / "pkg").mkdir()
        with zipfile.ZipFile(pathlib.Path(tmp) / "pkg" / "aws.zip", "w") as z:
            z.writestr("a/b.svg", "<svg/>")
        check("a cached package serves its member without the network", mg.fetch("B", ("pkg", "aws", "a/b.svg")) == "<svg/>")
        check("a member the package lacks is named in the error", "a/missing.svg" in str(raises(lambda: mg.fetch_pkg("aws", "a/missing.svg"), ValueError)))
        mg.BF_KEY_FILE.write_text('{"brandfolder_api_key": "k1"}')
        check("the shared logo-fetcher config supplies the key", mg.brandfolder_key() == "k1")
        os.environ["BRANDFOLDER_API_KEY"] = "k2"
        check("the environment variable wins over the config file", mg.brandfolder_key() == "k2")
    finally:
        mg.CACHE, mg.BF_KEY_FILE = saved_cache, saved_key
        os.environ.pop("BRANDFOLDER_API_KEY", None)
        if saved_env is not None:
            os.environ["BRANDFOLDER_API_KEY"] = saved_env

check("a non-Databricks URL is still refused for a product mark", raises(lambda: mg.fetch("X", "https://example.com/x.svg"), ValueError))
check("every package, cloud logo and service source is declared",
      all(src[0] in mg.PACKAGES for c in mg.SERVICES.values() for src in c.values()) and all(s[0] == "bf" for s in mg.CLOUD_LOGOS.values()))
check("every cloud has a logo and a service set", sorted(mg.CLOUD_LOGOS) == sorted(mg.SERVICES) == ["aws", "azure", "gcp"])

failed = [r for r in results if not r[1]]
for name, ok, detail in results:
    if not ok:
        print("FAIL  %s  %s" % (name, str(detail)[:300]))
print("%s %d/%d" % ("PASS" if not failed else "FAIL", len(results) - len(failed), len(results)))
sys.exit(1 if failed else 0)
