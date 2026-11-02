const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const { serve, boardReady, withView, VIEWS, DECK_CHIP_PT, headChipRatio, deckChipAudit } = require("./lib_serve");

const LANGS = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "app", "translations", "manifest.json"), "utf8")).languages.map(l => l.code);

function wordAudit(){
  const WORD = /[^\s\p{scx=Han}\p{scx=Hira}\p{scx=Kana}]+/gu;
  const board = document.getElementById("board"), out = [];
  const k = board.getBoundingClientRect().width / board.offsetWidth || 1;
  const blockOf = e => { while (e && getComputedStyle(e).display.startsWith("inline")) e = e.parentElement; return e; };
  const name = e => ((e.className && e.className.baseVal === undefined ? e.className : "") || e.tagName.toLowerCase()).toString().split(" ")[0];
  const blocks = new Map(), seq = new Map();
  const walk = document.createTreeWalker(board, NodeFilter.SHOW_TEXT);
  for (let n; (n = walk.nextNode());) {
    seq.set(n, seq.size);
    const p = n.parentElement;
    if (!n.textContent.trim() || !p || p.closest("svg, style, script, textarea") || !p.getClientRects().length || getComputedStyle(p).visibility === "hidden") continue;
    const b = blockOf(p);
    if (b) (blocks.get(b) || blocks.set(b, []).get(b)).push(n);
  }
  blocks.forEach((nodes, b) => {
    const cs = getComputedStyle(b), br = b.getBoundingClientRect();
    if (cs.textOverflow === "ellipsis") {
      const r = document.createRange(); r.selectNodeContents(b);
      const box = br.width - (parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth)) * k;
      if (b.scrollWidth > b.clientWidth + 0.5 || r.getBoundingClientRect().width > box + 0.05 * k) out.push(`'${b.textContent.trim().slice(0, 48)}' is cut off in ${name(b)}`);
    }
    let left = br.left + (parseFloat(cs.paddingLeft) + parseFloat(cs.borderLeftWidth)) * k - 0.5;
    let right = br.right - (parseFloat(cs.paddingRight) + parseFloat(cs.borderRightWidth)) * k + 0.5;
    const p = b.parentElement;
    if (p && p !== board && /flex$/.test(getComputedStyle(p).display) && !/^(absolute|fixed)$/.test(cs.position)) {
      const pc = getComputedStyle(p), pr = p.getBoundingClientRect();
      left = Math.max(left, pr.left + (parseFloat(pc.paddingLeft) + parseFloat(pc.borderLeftWidth)) * k - 0.5);
      right = Math.min(right, pr.right - (parseFloat(pc.paddingRight) + parseFloat(pc.borderRightWidth)) * k + 0.5);
    }
    const words = [];
    const joined = (a, b) => {
      if (seq.get(b) !== seq.get(a) + 1) return false;
      const r = document.createRange(); r.setStartAfter(a); r.setEndBefore(b);
      return !r.cloneContents().querySelector("br");
    };
    nodes.forEach(n => {
      for (const m of n.textContent.matchAll(WORD)) {
        const w = { a: n, i: m.index, z: n, j: m.index + m[0].length, t: m[0] };
        const prev = words[words.length - 1];
        if (m.index === 0 && prev && prev.j === prev.z.textContent.length && joined(prev.z, n)) { prev.z = n; prev.j = w.j; prev.t += w.t; }
        else words.push(w);
      }
    });
    for (const w of words) {
      if (w.t.length < 2) continue;
      const r = document.createRange(); r.setStart(w.a, w.i); r.setEnd(w.z, w.j);
      const rs = [...r.getClientRects()].filter(x => x.width > 0.5);
      if (!rs.length) continue;
      if (rs.some(x => x.top - rs[0].top >= rs[0].height / 2)) { out.push(`'${w.t.slice(0, 40)}' breaks across lines in ${name(b)}`); continue; }
      if (rs.some(x => x.right > right || x.left < left)) out.push(`'${w.t.slice(0, 40)}' sticks out of ${name(b)}`);
    }
  });
  return out;
}

function labelAudit(){
  const out = [], pairs = [];
  document.querySelectorAll(".panel").forEach(pn => pn.querySelectorAll(".panel-head, .ph-name, .ph-sub, .tagpill, .pc-desc").forEach(el => {
    const card = el.closest(".pcol");
    pairs.push([el, card || pn, card ? "card" : "panel"]);
  }));
  document.querySelectorAll(".band").forEach(bd => bd.querySelectorAll(":scope > .band-lbl, :scope > .band-rlbl").forEach(el => pairs.push([el, bd, "band"])));
  document.querySelectorAll(".colhead, .pockhead").forEach(h => {
    const node = [...h.childNodes].find(n => n.nodeType === 3 && n.textContent.trim());
    if (!node) return;
    const r = document.createRange(); r.selectNodeContents(node);
    const t = r.getBoundingClientRect(), b = h.getBoundingClientRect(), zx = h.querySelector(".zx");
    pairs.push([node, h, "heading"]);
    if (Math.max(b.left - t.left, t.right - b.right) > 0.5) out.push(`'${node.textContent.trim().slice(0, 48)}' runs outside its heading`);
    if (zx) { const z = zx.getBoundingClientRect(); if (t.right > z.left + 0.5 && t.left < z.right - 0.5) out.push(`'${node.textContent.trim().slice(0, 48)}' runs under its zoom button`); }
  });
  for (const [el, box, kind] of pairs) {
    if (kind === "heading") continue;
    const e = el.getBoundingClientRect(), b = box.getBoundingClientRect();
    if (!e.width || !b.width) continue;
    const over = Math.max(b.left - e.left, e.right - b.right);
    if (over > 0.5) out.push(`'${(el.textContent || "").trim().slice(0, 48)}' runs ${over.toFixed(1)}px outside its ${kind}`);
  }
  return { n: pairs.length, out, view: viewMode };
}

(async () => {
  const server = await serve();
  const base = "http://127.0.0.1:" + server.address().port + "/index.html";
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
  await page.addInitScript(() => { try { localStorage.setItem("dbx-arch-tour-v1", "1"); } catch (e) {} });
  const errs = [];
  page.on("pageerror", e => errs.push(e.message));
  const fails = [], words = [];
  let checked = 0, boards = 0;
  const inDeck = async measure => {
    const out = [], ratio = await page.evaluate(headChipRatio);
    for (const [kind, name] of [["pptx", "PowerPoint"], ["pdf", "PDF"]]) {
      if (!(await page.evaluate(k => typeof exportType === "function" && exportType(k, true), kind))) {
        words.push([`the board has no ${name} layout to measure`, kind]);
        return null;
      }
      try { out.push([kind === "pptx" ? "deck" : kind, await measure(kind, ratio)]); } finally { await page.evaluate(k => exportType(k, false), kind); }
    }
    return out;
  };
  await page.goto(base, { waitUntil: "networkidle" });
  await boardReady(page);
  const SHAPES = await page.evaluate(() => SHAPES.map(s => s.k));
  const BOARDS = await page.evaluate(() => INDUSTRY_CATALOG.map(r => r[0]).filter(id => !INDUSTRY_BUILT || INDUSTRY_BUILT.has(id)));
  if (BOARDS.length < 70) fails.push(`only ${BOARDS.length} industry boards found to check for split words`);
  for (const view of VIEWS) for (const shape of SHAPES) for (const lang of LANGS) {
    await page.goto(withView(`${base}?lang=${lang}&shape=${shape}`, view), { waitUntil: "networkidle" });
    await boardReady(page);
    await page.waitForTimeout(300);
    const r = await page.evaluate(labelAudit);
    checked += r.n;
    if (r.view !== view) fails.push(`[${lang} ${shape}] opened in ${r.view}, not ${view}`);
    r.out.forEach(m => fails.push(`[${view} ${lang} ${shape}] ${m}`));
    (await page.evaluate(wordAudit)).forEach(m => words.push([m, `${view} ${lang} ${shape}`]));
    if (view !== "simple") continue;
    const d = await inDeck(async (kind, ratio) => [await page.evaluate(labelAudit), await page.evaluate(wordAudit), await page.evaluate(deckChipAudit, [DECK_CHIP_PT, kind, ratio])]);
    if (!d) continue;
    d.forEach(([tag, m]) => {
      checked += m[0].n;
      m[0].out.forEach(x => fails.push(`[${tag} ${lang} ${shape}] ${x}`));
      m[1].concat(m[2]).forEach(x => words.push([x, `${tag} ${lang} ${shape}`]));
    });
  }
  const CLOUDS = ["azure", "aws", "gcp"];
  for (const view of VIEWS) for (const [li, lang] of LANGS.entries()) {
    await page.goto(withView(`${base}?lang=${lang}`, view), { waitUntil: "networkidle" });
    await boardReady(page);
    for (const [bi, ind] of ["generic", ...BOARDS].entries()) for (const cloud of ind === "generic" ? CLOUDS : [CLOUDS[(bi + li) % 3]]) {
      await page.evaluate(async ([ind, cloud]) => {
        if (ARCH.industry !== ind) await applyIndustry(ind);
        await loadLogos(cloud);
        if (ARCH.cloud.provider !== cloud) { ARCH.cloud.provider = cloud; build(); fitBoard(); }
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      }, [ind, cloud]);
      boards++;
      (await page.evaluate(wordAudit)).forEach(m => words.push([m, `${view} ${lang} ${ind} ${cloud}`]));
      if (view !== "simple") continue;
      const d = await inDeck(async (kind, ratio) => (await page.evaluate(wordAudit)).concat(await page.evaluate(deckChipAudit, [DECK_CHIP_PT, kind, ratio])));
      if (d) d.forEach(([tag, m]) => m.forEach(x => words.push([x, `${tag} ${lang} ${ind} ${cloud}`])));
    }
  }
  await browser.close();
  server.close();
  const seen = new Map();
  words.forEach(([m, at]) => seen.set(m, (seen.get(m) || []).concat(at)));
  seen.forEach((at, m) => fails.push(`${m} (${at.length}x: ${at.slice(0, 3).join("; ")})`));
  console.log(`views: ${VIEWS.length}, languages: ${LANGS.length}, shapes: ${SHAPES.length}, labels checked: ${checked}, boards checked word by word: ${boards}`);
  if (errs.length) fails.push(...errs.slice(0, 5).map(e => "page error: " + e));
  if (fails.length) { console.log(`\nFAIL (${fails.length})`); fails.slice(0, 160).forEach(f => console.log("  - " + f)); process.exit(1); }
  console.log("PASS: every panel, card, heading and band label fits its box, and no word anywhere on the board breaks across lines, sticks out of its box or is cut off, in both views and the PowerPoint and PDF layouts of Simplified, where every Genie and Agent Bricks chip reaches the slide and the page at 7pt inside its rectangle under a larger panel name, every language, shape, board and cloud");
})().catch(e => { console.error(e); process.exit(2); });
