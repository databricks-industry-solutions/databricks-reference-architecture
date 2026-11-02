const { chromium } = require("playwright");
const { serve, boardReady, withView } = require("./lib_serve");
(async () => {
  // Serve over HTTP so industries can lazy-load from architectures/*.json
  // (fetch() cannot read them over file://).
  const server = await serve();
  const base = "http://127.0.0.1:" + server.address().port + "/index.html";
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.addInitScript(() => { try { localStorage.setItem("dbx-arch-tour-v1", "1"); } catch (e) {} });
  const errs = [];
  page.on("pageerror", e => errs.push(String(e)));
  await page.goto(withView(base, "detailed"), { waitUntil: "networkidle" });
  await boardReady(page);
  const ids = await page.evaluate(() => ["generic"].concat(INDUSTRY_CATALOG.map(x => x[0])));
  const scan = async () => {
    const rows = [];
    for (const id of ids) {
      await page.evaluate(async (i) => { await applyIndustry(i, false); }, id);
      const r = await page.evaluate(async () => {
        const s = deckSections();
        const by = k => { const x = s.find(z => z.kind === k); return x ? x.tiles.length : 0; };
        let boardSlide = "";
        try {
          const m = collectBoard(), sl = await pptxEditableSlide(m), grp = (sl.body.match(/<p:grpSp>/g) || []).length;
          const want = 2 * exportLogos(m).uniq.length, empty = sl.media.filter(x => !(x.u8 || x).length).length;
          if (!grp || grp !== m.groups.length || sl.media.length !== want || empty)
            boardSlide = `groups ${grp}/${m.groups.length} media ${sl.media.length}/${want} empty ${empty}`;
        } catch (e) { boardSlide = "throws: " + (e && e.message || e); }
        const boxes = [...document.querySelectorAll("#board .rg-label, #board .band > .band-lbl .bl-name, #board .panel .panel-head .ph-name")]
          .map(el => el.textContent.trim());
        return { ind: ARCH.industry, view: viewMode, sec: s.map(z => z.kind).join(","), uc: by("uc"), genie: by("genie"), dash: by("dash"), app: by("app"),
          boardSlide, boxes, atoms: document.querySelectorAll("#board [data-id]").length };
      });
      rows.push({ id, ...r });
    }
    return rows;
  };
  const rows = await scan();
  await page.click('#view-seg button:has-text("Simplified")');
  await page.waitForFunction(() => document.body.classList.contains("view-simple"));
  const simple = await scan();
  await browser.close();
  server.close();
  const short = rows.filter(r => !(r.uc >= 1 && r.genie >= 1 && r.dash >= 1 && r.app >= 1));
  // S1: assert the exact ten/four contract (not merely non-empty). dash/app keep
  // their non-empty contract because the reviewed spec fixes only uc=10, genie=4.
  const wrong = rows.filter(r => r.uc !== 10 || r.genie !== 4);
  const notDetailed = rows.filter(r => r.view !== "detailed");
  console.log(`industries scanned: ${rows.length}`);
  console.log(`scanned in Detailed: ${rows.length - notDetailed.length}/${rows.length}`);
  console.log(`missing a section (uc/genie/dash/app==0): ${short.length}`);
  short.slice(0, 30).forEach(r => console.log(`  ❌ ${r.id}  uc=${r.uc} genie=${r.genie} dash=${r.dash} app=${r.app}  [${r.sec}]`));
  console.log(`wrong count (uc!=10 or genie!=4): ${wrong.length}`);
  wrong.slice(0, 30).forEach(r => console.log(`  ❌ ${r.id}  uc=${r.uc} genie=${r.genie}  [${r.sec}]`));
  // distribution of counts
  const dist = {};
  rows.forEach(r => { const k = `${r.uc}/${r.genie}/${r.dash}/${r.app}`; dist[k] = (dist[k] || 0) + 1; });
  console.log("count distribution uc/genie/dash/app -> #industries:");
  Object.entries(dist).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
  const slideBad = rows.concat(simple).filter(r => r.boardSlide);
  console.log(`editable deck board slide fails to build (both views): ${slideBad.length}`);
  slideBad.slice(0, 30).forEach(r => console.log(`  ❌ ${r.id} ${r.view}  ${r.boardSlide}`));
  const simpleBad = simple.map((s, i) => {
    const d = rows[i], why = [];
    if (s.view !== "simple") why.push("not in Simplified");
    if (s.sec !== d.sec) why.push(`sections [${s.sec}] vs Detailed [${d.sec}]`);
    if (s.boxes.join("|") !== d.boxes.join("|")) why.push(`boxes differ: ${s.boxes.filter(b => !d.boxes.includes(b)).concat(d.boxes.filter(b => !s.boxes.includes(b))).join(", ") || "order"}`);
    if (!(s.uc >= 1 && s.genie >= 1 && s.dash >= 1 && s.app >= 1)) why.push(`a section is empty uc=${s.uc} genie=${s.genie} dash=${s.dash} app=${s.app}`);
    if (s.uc > d.uc || s.genie > d.genie || s.dash > d.dash || s.app > d.app) why.push("shows more than Detailed");
    if (!(s.atoms < d.atoms)) why.push(`${s.atoms} tiles, not fewer than Detailed's ${d.atoms}`);
    return why.length ? `${s.id}: ${why.join("; ")}` : null;
  }).filter(Boolean);
  const avg = k => (simple.reduce((a, r) => a + r[k], 0) / simple.length).toFixed(1);
  console.log(`Simplified keeps every section and box of Detailed with fewer tiles: ${simple.length - simpleBad.length}/${simple.length}` +
    `  (avg tiles ${avg("atoms")} vs ${(rows.reduce((a, r) => a + r.atoms, 0) / rows.length).toFixed(1)}, uc ${avg("uc")}, genie ${avg("genie")})`);
  simpleBad.slice(0, 30).forEach(m => console.log(`  ❌ ${m}`));
  console.log("page errors:", errs.length);
  errs.slice(0, 5).forEach(e => console.log("  ! " + e));
  process.exit(short.length || wrong.length || notDetailed.length || slideBad.length || simpleBad.length || errs.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
