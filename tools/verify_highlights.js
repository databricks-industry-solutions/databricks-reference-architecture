const { chromium } = require("playwright");
const { serve, boardReady, withView } = require("./lib_serve");

const CLOUDS = ["aws", "azure", "gcp"];
const CONNECTOR_EXEMPT = {
  "Salesforce Commerce": "the Salesforce connector reads Sales and Service Cloud, not Commerce Cloud",
  "Salesforce Commerce Cloud": "the Salesforce connector reads Sales and Service Cloud, not Commerce Cloud",
  "Twilio Comms": "the catalog connector is SendGrid email, not Twilio messaging",
  "Twilio Event Streams": "the catalog connector is SendGrid email, not Twilio event streams",
  "The Graph Indexer": "The Graph is a blockchain indexing protocol, not the Microsoft Graph that the Microsoft Graph Logs connector reads",
};
const ORPHAN_EXEMPT = {
  "Databricks Data + AI Platform": "the board title opens these in its side panel and carries no dots by design",
  "Responsible Gaming": "no Gaming use case may give way to it: each one has a story, an accelerator or comes from the outcome map",
};
const NAME_EXEMPT = {
  "Unity Catalog OSS": "the open-source project; the managed Unity Catalog's courses, certifications and tours do not cover it",
};
const VENDOR_STRIP = /\b(event logs|audit logs|system logs|unified audit logs|logs|organization|activity logging|hcm|reports|event stream|waf|support|aggregated|falcon)\b/gi;
const VENDOR_SKIP = new Set(["zip", "square", "atlassian", "anthropic", "openai", "glean"]);
const BUSINESS_TRACKS = new Set(["Business Teams", "Executives", "Risk & Compliance"]);
const KAFKA_BROKERS = /\bkafka\b|confluent|\bmsk\b|event hubs?|streaming brokers/i;

const norm = s => String(s || "").toLowerCase().replace(/\(.*?\)/g, " ").replace(/\b(databricks|oss|the)\b/g, " ")
  .replace(/[^a-z0-9+]+/g, " ").replace(/\s+/g, " ").trim();
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function vendorPatterns(catalog) {
  const out = [];
  for (const c of catalog) {
    const base = c.n.replace(/\(.*?\)/g, " ").replace(/^microsoft (?!365)/i, "").replace(VENDOR_STRIP, " ").replace(/\s+/g, " ").trim();
    const alts = [base].concat((c.n.match(/\(([^)]+)\)/g) || []).map(x => x.slice(1, -1)));
    for (const a of alts) if (a && !VENDOR_SKIP.has(a.toLowerCase())) out.push([c.n, new RegExp("(?<![a-z0-9])" + esc(a) + "(?![a-z0-9])", "i")]);
  }
  return out;
}

(async () => {
  const server = await serve();
  const base = "http://127.0.0.1:" + server.address().port + "/index.html";
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await page.addInitScript(() => { try { localStorage.setItem("dbx-arch-tour-v1", "1"); } catch (e) {} });
  const errs = [];
  page.on("pageerror", e => errs.push(e.message));
  const tiles = [], simpleTiles = [], unseen = [], parity = [];
  const passes = CLOUDS.map(cloud => ["detailed", cloud]).concat([["simple", CLOUDS[0]]]);
  for (const [view, cloud] of passes) {
    await page.goto(withView(`${base}?cloud=${cloud}`, view), { waitUntil: "networkidle" });
    await boardReady(page);
    await page.waitForTimeout(800);
    const ids = await page.evaluate(() => ["generic"].concat(INDUSTRY_CATALOG.map(x => x[0])));
    for (const id of ids) {
      await page.evaluate(async i => { i === "generic" ? build() : await applyIndustry(i, false); }, id);
      (view === "detailed" ? tiles : simpleTiles).push(...await page.evaluate(({ board, cloud }) => Object.values(byId).filter(r => r.tile && typeof r.tile.n === "string").map(r => {
        const t = r.tile, cf = connectorFor(t), df = dataConnectorFor(t);
        const tg = r.el.closest(".pocket.ppl .rgroup, .rail.ppl .rgroup"), tgl = tg && tg.querySelector(".rg-label");
        return { board, cloud, n: t.n, canon: canonName(t.n), head: r.arr == null, title: r.el.classList.contains("plat-head"),
          team: !!tg, tech: !!tgl && tgl.textContent.trim() === T("Technical"), persona: isPersonaTile(t),
          track: isPersonaTile(t) ? personaTrackKey(t, ACADEMY.byPersona) : null,
          src: !!t.cat, kinds: hlKinds(t), dots: [...r.el.querySelectorAll(":scope > .badge-dot[data-hl]")].map(d => d.dataset.hl),
          cf: cf ? cf.n : null, df: df ? df.n : null, dfTier: df ? df.tier : null, dfKind: df ? df.kind : null };
      }), { board: view === "simple" ? id + "@simple" : id, cloud }));
      unseen.push(...await page.evaluate(board => {
        const out = [], probe = document.createElement("style");
        closeDrawer();
        probe.textContent = ".badge-dot { pointer-events:auto !important; }";
        document.head.appendChild(probe);
        for (const r of Object.values(byId)) {
          const E = r.el.getBoundingClientRect();
          if (!E.width || !E.height) continue;
          for (const d of r.el.querySelectorAll(":scope > .badge-dot[data-hl]")) {
            if (!/\bhl-p\d\b/.test(d.className)) continue;
            const R = d.getBoundingClientRect(), cx = R.left + R.width / 2, cy = R.top + R.height / 2;
            const onTile = R.width > 0 && cx >= E.left - 2 && cx <= E.right + 2 && cy >= E.top - 10 && cy <= E.bottom + 2;
            const top = cx >= 0 && cy >= 0 && cx < innerWidth && cy < innerHeight ? document.elementFromPoint(cx, cy) : d;
            if (!onTile || !(top === d || d.contains(top)))
              out.push(`${board}: the ${d.dataset.hl} dot of '${r.tile.n}' ${onTile ? "is covered by " + ((top && top.className) || "another element") : "sits off its tile"}`);
          }
        }
        probe.remove();
        return out;
      }, `${view === "simple" ? id + "@simple" : id}/${cloud}`));
      if (view === "detailed" && cloud === CLOUDS[0]) parity.push(...await page.evaluate(board => {
        const seen = window.__hlSeen || (window.__hlSeen = new Set()), out = [];
        const kindOf = d => (String(d.className).match(/\bhl-(story|conn|tour|demo|course|cert|video|accel)\b/) || [])[1];
        for (const [id, r] of Object.entries(byId)) {
          const t = r.tile;
          if (!t || typeof t.n !== "string") continue;
          const inPlat = !!r.el.closest(".band"), label = r.arr == null && !r.el.matches(".phead, .foot-chip");
          const key = JSON.stringify([canonName(t.n), r.arr == null, r.el.classList.contains("plat-head"), inPlat, label, r.el.classList.contains("mstage"), !!r.el.closest(".cloud"),
            isPersonaTile(t) ? [t.ucs || [], t.uses || []] : 0, (t.stories || []).map(s => s.u || s.url), !!t.problem, !!t.cat, !!t.conn, t.spark_connector || ""]);
          if (seen.has(key)) continue;
          seen.add(key);
          openDetail(id);
          const panel = [...new Set([...document.querySelectorAll("#drawer .badge-dot")].map(kindOf)
            .concat([...document.querySelectorAll("#drawer .d-badge")].map(b => b.classList.contains("accel") ? "accel" : b.classList.contains("conn") ? "conn" : null))
            .filter(Boolean))];
          const drawn = [...r.el.querySelectorAll(":scope > .badge-dot[data-hl]")].map(d => d.dataset.hl);
          const title = r.el.classList.contains("plat-head");
          const missing = title ? [] : panel.filter(k => !drawn.includes(k)), extra = drawn.filter(k => !panel.includes(k));
          if (missing.length || extra.length) out.push(`${board}: '${t.n}'` + (missing.length ? ` shows [${missing}] in its panel but not on the board` : "") +
            (extra.length ? ` draws [${extra}] on the board that its panel does not show` : ""));
          if (document.querySelector("#drawer .d-region, #drawer .d-regsum")) out.push(`${board}: '${t.n}' shows a regional availability line in its panel`);
        }
        closeDrawer();
        return out;
      }, id));
    }
  }
  const res = await page.evaluate(() => ({
    links: LINKS, accels: Object.keys(ACCEL_BY_NAME), aliases: ALIASES,
    course: Object.keys((ACADEMY && ACADEMY.byProduct) || {}).filter(k => (ACADEMY.byProduct[k] || []).length),
    cert: Object.keys((CERTS && CERTS.byProduct) || {}).filter(k => (CERTS.byProduct[k] || []).length),
    catalog: (PLATDOCS && PLATDOCS.connectors) || [] }));
  await browser.close();
  server.close();

  const leaf = tiles.filter(r => !r.head);
  const leafNames = new Set(leaf.map(r => r.n)), allNames = new Set(tiles.map(r => r.n));
  const fails = [];
  const once = new Set();
  const fail = (key, msg) => { if (!once.has(key)) { once.add(key); fails.push(msg); } };
  const hasDot = (r, kind) => kind === "demo" ? r.dots.includes("demo") || r.dots.includes("tour") : r.dots.includes(kind);

  unseen.forEach((m, i) => fail("unseen:" + m.replace(/^[^:]+\/[a-z]+: /, ""), m));
  parity.forEach(m => fail("parity:" + m, m));
  for (const r of tiles.concat(simpleTiles)) {
    const want = r.title ? [] : r.kinds;
    if (want.length !== r.dots.length || want.some(k => !r.dots.includes(k)))
      fail("dots:" + r.board + ":" + r.n, `'${r.n}' (${r.board}) draws dots [${r.dots}] but carries [${want}]`);
  }
  const teams = tiles.concat(simpleTiles).filter(r => !r.head && r.team);
  if (!teams.length || !teams.some(r => r.tech)) fail("teams-none", `the Teams rail placed ${teams.length} teams, ${teams.filter(r => r.tech).length} of them technical`);
  for (const r of tiles.concat(simpleTiles)) {
    if (r.head || r.team === r.persona) continue;
    fail("team:" + r.board + ":" + r.n, r.team ? `team '${r.n}' (${r.board}) is not read as a team, so it shows no learning track, certifications, demos or videos`
      : `'${r.n}' (${r.board}) is read as a team outside the Teams rail`);
  }
  for (const r of teams) {
    for (const k of ["course", "cert"]) if (!r.dots.includes(k)) fail("teamdot:" + r.board + ":" + r.n + ":" + k, `team '${r.n}' (${r.board}/${r.cloud}) draws no ${k} dot`);
    if (r.tech ? BUSINESS_TRACKS.has(r.track) && !(r.track === "Risk & Compliance" && /governance|admin/i.test(r.n)) : !BUSINESS_TRACKS.has(r.track))
      fail("track:" + r.board + ":" + r.n, `${r.tech ? "technical" : "business"} team '${r.n}' (${r.board}) takes the '${r.track}' learning track`);
  }
  for (const r of leaf) {
    if (!r.src && !r.cf) continue;
    if ((r.dfKind === "Lakeflow" && r.cf !== r.df) || (!r.df && r.cf))
      fail("par:" + r.n, `connector dot and callout disagree on '${r.n}' (${r.board}): callout=${r.cf} dot=${r.df}`);
  }
  for (const r of leaf) {
    if (r.persona || !KAFKA_BROKERS.test(r.n) || (r.df === "Apache Kafka" && r.cf === "Apache Kafka" && r.dots.includes("conn"))) continue;
    fail("broker:" + r.board + ":" + r.n, `'${r.n}' (${r.board}/${r.cloud}) is read with the Apache Kafka connector but shows ${r.df ? "the " + r.df + " connector" : "no connector"}`);
  }
  const pats = vendorPatterns(res.catalog);
  for (const r of leaf) {
    if (!r.src || r.cf || r.df || CONNECTOR_EXEMPT[r.n]) continue;
    const hits = [...new Set(pats.filter(([, rx]) => rx.test(r.n)).map(([n]) => n))];
    if (hits.length) fail("cat:" + r.n, `source '${r.n}' (${r.board}) names catalog connector ${hits.join(", ")} but shows no connector`);
  }
  const resourced = {
    video: Object.keys(res.links).filter(k => (res.links[k].videos || []).length),
    demo: Object.keys(res.links).filter(k => (res.links[k].demos || []).length),
    course: res.course, cert: res.cert, accel: res.accels };
  const surfaced = {};
  for (const r of tiles) for (const kind of Object.keys(resourced)) if (hasDot(r, kind)) (surfaced[kind] = surfaced[kind] || new Set()).add(r.canon);
  for (const [kind, keys] of Object.entries(resourced)) for (const k of keys) {
    if ((surfaced[kind] && surfaced[kind].has(k)) || ORPHAN_EXEMPT[k]) continue;
    fail("orph:" + kind + ":" + k, `${kind} resources keyed to '${k}' light no dot on any board or cloud`);
  }
  const byNorm = {};
  for (const [kind, keys] of Object.entries(resourced)) for (const k of keys) (byNorm[norm(k)] = byNorm[norm(k)] || []).push([kind, k]);
  for (const r of tiles) {
    if (NAME_EXEMPT[r.n] || r.title) continue;
    for (const [kind, k] of byNorm[norm(r.n)] || []) {
      if (k === r.canon) continue;
      if (!hasDot(r, kind)) fail("name:" + r.n + ":" + kind, `'${r.n}' (${r.board}) misses the ${kind} resources of '${k}', the same name once normalised`);
    }
  }
  for (const k of Object.keys(res.aliases)) if (!leafNames.has(k)) fail("alias:" + k, `alias '${k}' names no tile on any board or cloud`);
  for (const k of Object.keys(ORPHAN_EXEMPT)) {
    if (!allNames.has(k) && !Object.values(resourced).some(v => v.includes(k))) fail("dead-orph:" + k, `orphan exemption for '${k}' names nothing`);
    else if (Object.keys(resourced).some(kind => surfaced[kind] && surfaced[kind].has(k))) fail("stale-orph:" + k, `orphan exemption for '${k}' is stale, a tile now lights its dot`);
  }
  for (const k of Object.keys(NAME_EXEMPT)) if (!leafNames.has(k)) fail("stale-name:" + k, `name exemption for '${k}' matches no tile`);
  for (const k of Object.keys(CONNECTOR_EXEMPT)) if (!leafNames.has(k)) fail("stale-conn:" + k, `connector exemption for '${k}' matches no tile`);

  const detailedFirst = tiles.filter(r => r.cloud === CLOUDS[0]).length;
  if (!simpleTiles.length || simpleTiles.length >= detailedFirst)
    fail("simple-pass", `the Simplified pass placed ${simpleTiles.length} tiles, not fewer than Detailed's ${detailedFirst} on ${CLOUDS[0]}`);
  const srcCount = new Set(leaf.filter(r => r.src).map(r => r.n)).size;
  console.log(`boards: ${tiles.length ? new Set(tiles.map(r => r.board)).size : 0} x ${CLOUDS.length} clouds, tile placements: ${tiles.length}, distinct leaf tiles: ${leafNames.size}`);
  console.log(`Simplified on ${CLOUDS[0]}: ${simpleTiles.length} tile placements against ${detailedFirst} in Detailed, every one checked for its dots`);
  const techTeams = teams.filter(r => r.tech), trackCount = {};
  techTeams.forEach(r => trackCount[r.track] = (trackCount[r.track] || 0) + 1);
  console.log(`team placements: ${teams.length}, technical: ${techTeams.length} (${Object.entries(trackCount).map(([k, v]) => k + "=" + v).join(" ")})`);
  console.log(`source tiles: ${srcCount}, catalog connectors: ${res.catalog.length}, aliases: ${Object.keys(res.aliases).length}`);
  console.log(`resourced entries: ${Object.entries(resourced).map(([k, v]) => k + "=" + v.length).join(" ")}`);
  console.log(`exempt with a reason: orphans ${Object.keys(ORPHAN_EXEMPT).length}, names ${Object.keys(NAME_EXEMPT).length}, connectors ${Object.keys(CONNECTOR_EXEMPT).length}`);
  console.log(`heads with dots: ${new Set(tiles.filter(r => r.head && r.dots.length).map(r => r.n)).size}, board title dots: ${tiles.filter(r => r.title && r.dots.length).length}`);
  if (errs.length) fails.push(...errs.slice(0, 5).map(e => "page error: " + e));
  if (fails.length) { console.log(`\nFAIL (${fails.length})`); fails.forEach(f => console.log("  - " + f)); process.exit(1); }
  console.log("\nPASS: every tile shows the highlights that match it");
})().catch(e => { console.error(e); process.exit(2); });
