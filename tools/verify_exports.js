const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const zlib = require("zlib");
const { serve, boardReady, withView, DECK_CHIP_PT, headChipRatio, deckChipAudit } = require("./lib_serve");

const OUT = "/tmp/arch_exports";
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

// industry id, cloud, view
const CASES = [
  ["public_sector", "aws", "detailed"],
  ["public_sector", "azure", "detailed"],
  ["public_sector", "gcp", "detailed"],
  ["airlines", "aws", "detailed"],
  ["banking", "azure", "detailed"],
  ["retail", "gcp", "detailed"],
  ["generic", "aws", "detailed"],
  ["airlines", "aws", "simple"],
  ["banking", "azure", "simple"],
  ["generic", "aws", "simple"],
];
const caseTag = (ind, cloud, view) => `${ind}_${cloud}` + (view === "simple" ? "-simple" : "");

function u8FromB64(b64) { return Buffer.from(b64, "base64"); }

const LIVE = process.argv.includes("--live");
const DRAW_CASES = CASES.map(([ind, cloud, view]) => [withView(`industry=${ind}&cloud=${cloud}`, view), caseTag(ind, cloud, view)])
  .concat(["z", "s", "t", "rt"].flatMap(s => [[withView(`industry=banking&cloud=azure&shape=${s}`, "detailed"), `banking_${s}`],
    [`industry=banking&cloud=azure&shape=${s}`, `banking_${s}-simple`]]))
  .concat([
    [withView("industry=banking&cloud=azure&lang=ar", "detailed"), "banking_ar"],
    [withView("industry=banking&cloud=azure&lang=ja", "detailed"), "banking_ja"],
    [withView("cloud=aws&theme=dark", "detailed"), "generic_dark"],
    [withView("industry=airlines&cloud=aws&platform=1", "detailed"), "airlines_platform"],
    ["industry=banking&cloud=azure", "banking_edit", true],
  ]);
const kb = n => (n / 1024).toFixed(0) + "KB";
function shOk(cmd) { try { execSync(cmd, { stdio: "pipe" }); return true; } catch (e) { return false; } }

async function drawingProbe(edit) {
  if (edit) setEditMode(true);
  await new Promise(r => setTimeout(r, 300));
  const m = collectBoard();
  const by = {}, kinds = {};
  m.shapes.forEach(s => by[s.t] = (by[s.t] || 0) + 1);
  m.groups.forEach(g => kinds[g.kind] = (kinds[g.kind] || 0) + 1);
  const texts = m.shapes.filter(s => s.t === "text");
  const lineTexts = texts.flatMap(s => s.lines ? s.lines.map(l => l.txt) : [s.txt]);
  const links = [...new Set(m.groups.map(g => g.link).filter(Boolean))];
  const parse = (s, type) => { const x = new DOMParser().parseFromString(s, type); return x.querySelector("parsererror") ? null : x; };
  const plain = s => String(s).replace(/[\u2066-\u2069]/g, "");
  const total = m.shapes.length;
  const out = {
    by, kinds, total, groups: m.groups.length, links: links.length, badLinks: links.filter(u => !isDatabricksUrl(u)).length,
    leaves: [...document.querySelectorAll("#board .atom")].filter(el => {
      const rec = byId[el.dataset.id]; return rec && rec.arr != null && el.getClientRects().length > 0; }).length,
    addBtns: document.querySelectorAll("#board .addbtn").length,
    maxImgFrac: Math.max(0, ...m.shapes.filter(s => s.t === "img").map(s => s.box.w * s.box.h)) / (m.W * m.H),
    uniqLogos: exportLogos(m).uniq.length, bg: m.bg, dark: document.body.classList.contains("theme-dark"), f: {},
  };
  const dxText = drawioXml(m), dx = parse(dxText, "text/xml");
  if (dx) {
    const cells = [...dx.querySelectorAll("mxCell")], gm = dx.querySelector("mxGraphModel");
    const ids = [...dx.querySelectorAll("mxCell[id], UserObject[id]")].map(e => e.getAttribute("id"));
    const idSet = new Set(ids);
    const style = c => c.getAttribute("style") || "";
    const values = cells.filter(c => /^text;/.test(style(c))).map(c => {
      const t = document.createElement("textarea"); t.innerHTML = c.getAttribute("value") || ""; return plain(t.value); });
    const dxLinks = [...dx.querySelectorAll("UserObject[link]")].map(e => e.getAttribute("link"));
    out.f.drawio = { ok: true, bytes: dxText.length, text: dxText, adaptive: gm && gm.getAttribute("adaptiveColors"), bg: gm && gm.getAttribute("background"),
      vertices: cells.filter(c => c.getAttribute("vertex") === "1" && style(c) !== "group").length,
      edges: cells.filter(c => c.getAttribute("edge") === "1").length,
      groups: dx.querySelectorAll("UserObject").length,
      svgImgs: cells.filter(c => /^shape=image;.*image=data:image\/svg\+xml,/.test(style(c))).length,
      uniqueIds: idSet.size === ids.length, parentsOk: cells.every(c => !c.getAttribute("parent") || idSet.has(c.getAttribute("parent"))),
      textOk: texts.every(s => values.includes(s.txt.replace(/\n/g, "<br>"))), badLinks: dxLinks.filter(u => !isDatabricksUrl(u)).length };
  } else out.f.drawio = { ok: false, bytes: dxText.length, text: dxText };
  const svText = vectorSvg(m), sv = parse(svText, "image/svg+xml");
  if (sv) {
    const root = sv.documentElement, top = sel => [...sv.querySelectorAll(sel)].filter(e => e !== root && e.parentElement.closest("svg") === root);
    const svTexts = top("text").map(e => e.textContent);
    out.f.svg = { ok: true, bytes: svText.length, text: svText, rects: top("rect").length, texts: svTexts.length, logos: top("svg").length,
      heads: top("polygon").length, paths: top("path").length, foreign: sv.querySelectorAll("foreignObject").length,
      markers: sv.querySelectorAll("marker").length, tiles: sv.querySelectorAll('g[id^="tile-"]').length,
      textOk: lineTexts.every(t => svTexts.includes(t)), badLinks: [...sv.querySelectorAll("a")].filter(a => !isDatabricksUrl(a.getAttribute("href"))).length };
  } else out.f.svg = { ok: false, bytes: svText.length, text: svText };
  const exText = excalidrawJson(m);
  let ex = null; try { ex = JSON.parse(exText); } catch (e) {}
  if (ex && ex.type === "excalidraw" && Array.isArray(ex.elements)) {
    const els = ex.elements, imgs = els.filter(e => e.type === "image"), exTexts = els.filter(e => e.type === "text").map(e => plain(e.text));
    out.f.excalidraw = { ok: true, bytes: exText.length, text: exText, elements: els.length, imgs: imgs.length, bg: ex.appState && ex.appState.viewBackgroundColor,
      filesOk: imgs.every(e => ex.files[e.fileId] && /^data:image\/svg\+xml;base64,/.test(ex.files[e.fileId].dataURL)),
      groups: new Set(els.flatMap(e => e.groupIds)).size,
      textOk: texts.every(s => exTexts.includes(s.lines ? s.lines.map(l => l.txt).join("\n") : s.txt)),
      badLinks: els.filter(e => e.link && !isDatabricksUrl(e.link)).length };
  } else out.f.excalidraw = { ok: false, bytes: exText.length, text: exText };
  const zipB64 = async parts => u8ToB64(new Uint8Array(await zipStore(parts).arrayBuffer()));
  const xmlBad = parts => parts.filter(p => typeof p.data === "string" && !parse(p.data, "text/xml")).map(p => p.name);
  const vp = await vsdxParts(m), page1 = parse((vp.find(p => p.name === "visio/pages/page1.xml") || {}).data || "", "text/xml");
  const vShapes = page1 ? [...page1.getElementsByTagName("Shape")] : [];
  const vLinks = page1 ? [...page1.getElementsByTagName("Cell")].filter(c => c.getAttribute("N") === "Address").map(c => c.getAttribute("V")) : [];
  const vBg = vShapes.find(s => /^Background\./.test(s.getAttribute("NameU") || ""));
  const vBgFill = vBg && [...vBg.children].find(c => c.tagName === "Cell" && c.getAttribute("N") === "FillForegnd");
  out.f.vsdx = { b64: await zipB64(vp), bytes: 0, xmlBad: xmlBad(vp), names: vp.map(p => p.name), shapes: vShapes.length, bg: vBgFill && vBgFill.getAttribute("V"),
    groups: vShapes.filter(s => s.getAttribute("Type") === "Group").length, foreign: vShapes.filter(s => s.getAttribute("Type") === "Foreign").length,
    media: vp.filter(p => /^visio\/media\//.test(p.name)).length, links: vLinks.length, badLinks: vLinks.filter(u => !isDatabricksUrl(u)).length };
  out.f.vsdx.bytes = Math.round(out.f.vsdx.b64.length * 3 / 4);
  const pp = pptxParts([await pptxEditableSlide(m)], docTitle()), slides = pp.filter(p => /^ppt\/slides\/slide\d+\.xml$/.test(p.name));
  const s1 = parse((slides[0] || {}).data || "", "text/xml");
  const pn = tag => s1 ? s1.getElementsByTagNameNS(PPTX_NS.p, tag).length : 0;
  const rels = parse((pp.find(p => p.name === "ppt/slides/_rels/slide1.xml.rels") || {}).data || "", "text/xml");
  const pLinks = rels ? [...rels.getElementsByTagName("Relationship")].filter(r => /hyperlink$/.test(r.getAttribute("Type"))).map(r => r.getAttribute("Target")) : [];
  out.f.pptx = { b64: await zipB64(pp), bytes: 0, xmlBad: xmlBad(pp), slides: slides.length, grpSp: pn("grpSp"), pic: pn("pic"), sp: pn("sp"),
    svgMedia: pp.filter(p => /^ppt\/media\/.*\.svg$/.test(p.name)).length, links: pLinks.length, badLinks: pLinks.filter(u => !isDatabricksUrl(u)).length };
  out.f.pptx.bytes = Math.round(out.f.pptx.b64.length * 3 / 4);
  return out;
}

function drawingChecks(r) {
  const n = k => r.by[k] || 0, f = r.f;
  const boxes = n("rect") + n("text") + n("img"), lines = n("arrow") + n("line") + n("poly");
  const VSDX_PARTS = ["[Content_Types].xml", "_rels/.rels", "visio/document.xml", "visio/_rels/document.xml.rels",
    "visio/pages/pages.xml", "visio/pages/_rels/pages.xml.rels", "visio/pages/page1.xml", "visio/pages/_rels/page1.xml.rels"];
  const dim = hex => { const v = parseInt(String(hex).replace("#", ""), 16);
    return (0.2126 * (v >> 16 & 255) + 0.7152 * (v >> 8 & 255) + 0.0722 * (v & 255)) / 255 < 0.5; };
  const bgHex = String(r.bg).toUpperCase();
  return [
    ["the board on screen and its exported background are the same theme", r.dark === dim(r.bg) && r.dark === r.tag.endsWith("_dark")],
    ["drawio keeps the board's colors in draw.io's light and dark themes", f.drawio.adaptive === "none" && String(f.drawio.bg).toUpperCase() === bgHex],
    ["excalidraw canvas takes the board background", String(f.excalidraw.bg).toUpperCase() === bgHex],
    ["vsdx background takes the board background", String(f.vsdx.bg).toUpperCase() === bgHex],
    ["tile groups == visible tiles", r.kinds.tile === r.leaves && r.leaves > 0],
    ["zones present", (r.kinds.zone || 0) >= (r.tag.endsWith("_platform") ? 1 : 5)],
    ["no edit buttons exported", r.tag.endsWith("_edit") ? r.addBtns > 0 : true],
    ["links all Databricks", r.badLinks === 0 && r.links > 0],
    ["no board picture (max logo < 1% of board)", r.maxImgFrac < 0.01],
    ["drawio parses", f.drawio.ok && f.drawio.xmllint],
    ["drawio vertices == boxes", f.drawio.vertices === boxes],
    ["drawio edges == arrows+lines+ring", f.drawio.edges === lines],
    ["drawio groups == model groups", f.drawio.groups === r.groups],
    ["drawio logos are SVG", f.drawio.svgImgs === n("img")],
    ["drawio ids unique, parents valid", f.drawio.uniqueIds && f.drawio.parentsOk],
    ["drawio every label present", f.drawio.textOk],
    ["drawio links Databricks", f.drawio.badLinks === 0],
    ["svg parses", f.svg.ok && f.svg.xmllint],
    ["svg rects == model rects (no background)", f.svg.rects === n("rect")],
    ["svg logos == model logos", f.svg.logos === n("img")],
    ["svg arrowheads == arrows", f.svg.heads === n("arrow")],
    ["svg no foreignObject, no marker", f.svg.foreign === 0 && f.svg.markers === 0],
    ["svg tile groups == tiles", f.svg.tiles === r.kinds.tile],
    ["svg every label line present", f.svg.textOk],
    ["svg links Databricks", f.svg.badLinks === 0],
    ["excalidraw parses", f.excalidraw.ok],
    ["excalidraw elements == shapes", f.excalidraw.elements === r.total],
    ["excalidraw logos resolve to SVG files", f.excalidraw.imgs === n("img") && f.excalidraw.filesOk],
    ["excalidraw groups == model groups", f.excalidraw.groups === r.groups],
    ["excalidraw every label present", f.excalidraw.textOk],
    ["excalidraw links Databricks", f.excalidraw.badLinks === 0],
    ["vsdx zip + xml valid", f.vsdx.zipOk && !f.vsdx.xmlBad.length && !f.vsdx.xmllint.length],
    ["vsdx required parts", VSDX_PARTS.every(p => f.vsdx.names.includes(p))],
    ["vsdx shapes == shapes + groups + background", f.vsdx.shapes === r.total + r.groups + 1],
    ["vsdx groups == model groups", f.vsdx.groups === r.groups],
    ["vsdx foreign logos == logos, media == unique", f.vsdx.foreign === n("img") && f.vsdx.media === r.uniqLogos],
    ["vsdx hyperlinks == tile links, Databricks", f.vsdx.links >= r.links && f.vsdx.badLinks === 0],
    ["pptx zip + xml valid", f.pptx.zipOk && !f.pptx.xmlBad.length && !f.pptx.xmllint.length],
    ["pptx one slide", f.pptx.slides === 1],
    ["pptx groups == model groups", f.pptx.grpSp === r.groups],
    ["pptx pictures == logos, SVG media == unique", f.pptx.pic === n("img") && f.pptx.svgMedia === r.uniqLogos],
    ["pptx shapes == rects + texts + lines + title", f.pptx.sp === n("rect") + n("text") + lines + 1],
    ["pptx links == tile links, Databricks", f.pptx.links === r.links && f.pptx.badLinks === 0],
  ];
}

async function liveChecks(browser, stem, slides) {
  const out = [];
  const xml = fs.readFileSync(stem + ".drawio", "utf8");
  const p = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  try {
    await p.setContent('<iframe id="f" src="https://embed.diagrams.net/?embed=1&proto=json&spin=0&ui=min" style="width:1590px;height:990px;border:0"></iframe>');
    const r = await p.evaluate(xml => new Promise(resolve => {
      const f = document.getElementById("f"), t = setTimeout(() => resolve({ timeout: true }), 90000);
      window.addEventListener("message", e => {
        let m; try { m = JSON.parse(e.data); } catch (x) { return; }
        if (m.event === "init") f.contentWindow.postMessage(JSON.stringify({ action: "load", xml, autosave: 0 }), "*");
        else if (m.event === "load") f.contentWindow.postMessage(JSON.stringify({ action: "export", format: "png", scale: 1 }), "*");
        else if (m.event === "export") { clearTimeout(t); resolve({ png: m.data }); }
      });
    }), xml);
    if (r.png) fs.writeFileSync(stem + ".drawio.live.png", Buffer.from(r.png.split(",")[1], "base64"));
    out.push(["draw.io loads and renders the .drawio", !!r.png, r.png ? "rendered " + stem + ".drawio.live.png" : "no render (timeout)"]);
  } catch (e) { out.push(["draw.io loads and renders the .drawio", false, String(e).slice(0, 200)]); }
  await p.close();
  const json = fs.readFileSync(stem + ".excalidraw", "utf8"), want = JSON.parse(json).elements.length;
  const q = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  try {
    await q.goto("https://excalidraw.com/", { waitUntil: "networkidle" });
    await q.waitForSelector(".excalidraw canvas", { timeout: 60000 });
    const dt = await q.evaluateHandle(json => { const d = new DataTransfer();
      d.items.add(new File([json], "board.excalidraw", { type: "application/json" })); return d; }, json);
    await q.dispatchEvent(".excalidraw canvas", "drop", { dataTransfer: dt });
    await q.waitForTimeout(6000);
    const got = await q.evaluate(() => { const s = localStorage.getItem("excalidraw"); return s ? JSON.parse(s).length : 0; });
    await q.screenshot({ path: stem + ".excalidraw.live.png" });
    out.push(["excalidraw.com loads every element", got === want, got + "/" + want + " elements"]);
  } catch (e) { out.push(["excalidraw.com loads every element", false, String(e).slice(0, 200)]); }
  await q.close();
  const soffice = ["/opt/homebrew/bin/soffice", "/Applications/LibreOffice.app/Contents/MacOS/soffice", "/usr/bin/soffice"].find(f => fs.existsSync(f));
  if (!soffice) { out.push(["LibreOffice renders .vsdx and the deck", false, "soffice not installed"]); return out; }
  const lo = `"${soffice}" -env:UserInstallation=file:///tmp/verify_exports_lo --headless`;
  const png = stem + ".png";
  fs.rmSync(png, { force: true });
  const vOk = shOk(`${lo} --convert-to png --outdir "${path.dirname(stem)}" "${stem}.vsdx"`) && fs.existsSync(png);
  out.push(["LibreOffice renders .vsdx", vOk, vOk ? png : "conversion failed"]);
  const loDir = path.join(path.dirname(stem), "lo"), pdf = path.join(loDir, path.basename(stem) + ".pdf");
  fs.rmSync(loDir, { recursive: true, force: true });
  const dOk = shOk(`${lo} --convert-to pdf --outdir "${loDir}" "${stem}.pptx"`) && fs.existsSync(pdf);
  let pages = 0;
  if (dOk) { try { pages = Number((execSync(`pdfinfo "${pdf}"`).toString().match(/Pages:\s+(\d+)/) || [])[1]); }
    catch (e) { pages = pdfPageCount(fs.readFileSync(pdf)); } }
  out.push(["LibreOffice renders every deck slide", dOk && pages === slides, pages + "/" + slides + " pages  " + pdf]);
  return out;
}

// count "/Type /Page" (not /Pages) occurrences in a PDF buffer
function pdfPageCount(buf) {
  const s = buf.toString("latin1");
  const m = s.match(/\/Type\s*\/Page(?![s])/g);
  return m ? m.length : 0;
}

function pdfImage(buf, num) {
  const s = buf.toString("latin1"), head = "\n" + num + " 0 obj\n", at = s.indexOf(head);
  if (at < 0) return null;
  const d0 = at + head.length, d1 = s.indexOf(">>\nstream\n", d0);
  if (d1 < 0) return null;
  const dict = s.slice(d0, d1 + 2), num1 = re => +((dict.match(re) || [])[1] || 0);
  const st = d1 + ">>\nstream\n".length;
  return { dict, w: num1(/\/Width (\d+)/), h: num1(/\/Height (\d+)/), smask: num1(/\/SMask (\d+) 0 R/),
    data: buf.subarray(st, st + num1(/\/Length (\d+)/)) };
}

function pdfBoardBox(buf) {
  const s = buf.toString("latin1");
  const m = s.match(/\nq ([\d.]+) 0 0 ([\d.]+) ([\d.]+) ([\d.]+) cm \/Im0 Do Q\nBT \/F1 14 Tf [\d. ]+rg [\d.]+ ([\d.]+) Td/) ||
    s.match(/q 842 0 0 595 0 0 cm \/Im0 Do Q\nq ([\d.]+) 0 0 ([\d.]+) ([\d.]+) ([\d.]+) cm \/Im1 Do Q/);
  if (!m) return null;
  const [w, h, x, y] = m.slice(1, 5).map(Number);
  return { w, h, x, top: 595 - y - h, bottom: y, baseline: m[5] ? 595 - +m[5] : null,
    full: Math.abs(w - 830) < 0.02 || Math.abs(h - 565) < 0.02 };
}

function pdfBoardAlpha(buf) {
  const im = pdfImage(buf, 6);
  if (!im || !im.smask) return { smask: false };
  const m = pdfImage(buf, im.smask);
  if (!m || !/\/ColorSpace\/DeviceGray/.test(m.dict)) return { smask: false };
  const a = zlib.inflateSync(m.data);
  let clear = 0, solid = 0;
  for (const v of a) { if (v === 0) clear++; else if (v === 255) solid++; }
  return { smask: true, sizeOk: a.length === im.w * im.h && m.w === im.w && m.h === im.h, clear: clear / a.length, solid: solid / a.length };
}

function gifBlocks(buf) {
  let p = 13;
  if (buf[10] & 0x80) p += 3 * (1 << ((buf[10] & 7) + 1));
  const gces = [];
  let frames = 0;
  const skipSub = () => { while (buf[p] !== 0) p += buf[p] + 1; p++; };
  while (p < buf.length) {
    const b = buf[p++];
    if (b === 0x3B) return { gces, frames };
    if (b === 0x21) { if (buf[p++] === 0xF9) gces.push({ packed: buf[p + 1], tidx: buf[p + 4] }); skipSub(); }
    else if (b === 0x2C) { const ip = buf[p + 8]; p += 9; if (ip & 0x80) p += 3 * (1 << ((ip & 7) + 1)); p++; skipSub(); frames++; }
    else return null;
  }
  return null;
}

async function alphaStats(page, b64, mime, frames) {
  return page.evaluate(async ([b64, mime, frames]) => {
    const bin = atob(b64), u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    const stats = src => {
      const c = document.createElement("canvas"); c.width = src.displayWidth || src.width; c.height = src.displayHeight || src.height;
      const g = c.getContext("2d"); g.drawImage(src, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data, n = d.length / 4;
      let clear = 0, solid = 0;
      for (let i = 3; i < d.length; i += 4) { if (d[i] === 0) clear++; else if (d[i] === 255) solid++; }
      return { w: c.width, h: c.height, clear: clear / n, solid: solid / n };
    };
    if (!frames) return stats(await createImageBitmap(new Blob([u8], { type: mime })));
    const dec = new ImageDecoder({ data: u8, type: mime });
    await dec.tracks.ready;
    const out = [];
    for (const fi of frames) { const { image } = await dec.decode({ frameIndex: fi }); out.push({ fi, ...stats(image) }); image.close(); }
    return out;
  }, [b64, mime, frames || null]);
}
const transparentOk = s => !!s && s.clear > 0.03 && s.solid > 0.3;

(async () => {
  // Serve over HTTP: the deep-linked industry lazy-loads from architectures/*.json
  // (and resources/*.json), which fetch() cannot read over file://. Under file://
  // every case would silently fall back to generic and the export checks would
  // pass vacuously; HTTP makes the deck reflect the real industry content.
  const server = await serve();
  const BASE = "http://127.0.0.1:" + server.address().port + "/index.html";
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  page.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text()); });

  const results = [];
  for (const [ind, cloud, view] of CASES) {
    const url = withView(`${BASE}?industry=${ind}&cloud=${cloud}`, view);
    await page.goto(url, { waitUntil: "networkidle" });
    await boardReady(page);
    await page.waitForTimeout(700);

    const summary = await page.evaluate(() => {
      const secs = deckSections().map(s => ({ key: s.key, kind: s.kind, title: s.title, n: (s.tiles || []).length }));
      const topOn = names => { const s = ARCH.top.secs.find(x => names.includes(x.title));
        const el = s && [...document.querySelectorAll("#topband .cloud-sec")].find(e => e.querySelector(".rg-label").textContent.trim() === T(s.title));
        return el ? el.querySelectorAll(".ctile").length : 0; };
      const consOn = names => { const g = ARCH.rails.cons.groups.find(x => names.includes(x.box));
        const el = g && [...document.querySelectorAll("#rail-cons .rgroup")].find(e => e.querySelector(".rg-label").textContent.trim() === T(g.box));
        return el ? el.querySelectorAll(".rtile").length : 0; };
      return {
        view: viewMode,
        screen: { uc: topOn(["Business Use Cases", "Use Cases"]), genie: topOn(["Genie Agents", "Genie Spaces"]),
          dash: consOn(["AI/BI Dashboards", "AI/BI Dashboard", "Dashboards"]), apps: consOn(["Databricks Apps", "Apps"]) },
        industry: (typeof ARCH !== "undefined" && ARCH.industry) || null,
        cloud: (typeof ARCH !== "undefined" && ARCH.cloud && ARCH.cloud.provider) || null,
        label: (typeof deckIndustry === "function") ? deckIndustry() : null,
        secs,
        uc: (typeof useCaseTiles === "function") ? useCaseTiles().length : -1,
        genie: (typeof genieTiles === "function") ? genieTiles().length : -1,
        dash: (typeof dashboardTiles === "function") ? dashboardTiles().length : -1,
        apps: (typeof appTiles === "function") ? appTiles().length : -1,
      };
    });

    const screenSig = () => {
      const b = document.querySelector(".board");
      return { h: b.offsetHeight, step: parseFloat(getComputedStyle(document.getElementById("platform")).getPropertyValue("--pk")) || 1,
        deck: document.body.classList.contains("deck-type"), moving: document.getAnimations().filter(a => a instanceof CSSTransition).length,
        fit: [...b.querySelectorAll("[data-wfit]")].map(e => `${(e.textContent || "").trim().slice(0, 30)}@${e.style.fontSize}`).sort().join(", "),
        names: [...new Set([...document.querySelectorAll("#plat-top .p-name, #platform .p-name")].map(e => getComputedStyle(e).fontSize))].sort().join(" ") };
    };
    const screenBefore = await page.evaluate(screenSig);
    const pptxB64 = await page.evaluate(async () => {
      const blob = await exportPptx();
      const buf = new Uint8Array(await blob.arrayBuffer());
      let bin = ""; for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
      return btoa(bin);
    });
    const screenAfter = await page.evaluate(screenSig);
    const board = await page.evaluate(() => {
      const deck = typeof deckType === "function" && deckType(true);
      try {
        const m = collectBoard();
        return { groups: m.groups.length, imgs: m.shapes.filter(s => s.t === "img").length, title: docTitle(), deck: document.body.classList.contains("deck-type"),
          step: parseFloat(getComputedStyle(document.getElementById("platform")).getPropertyValue("--pk")) || 1,
          platNames: [...document.querySelectorAll("#plat-top .p-name, #platform .p-name")]
            .filter(e => e.offsetParent && !e.closest("[data-wfit]") && !e.querySelector("[data-wfit]")).map(e => e.textContent.trim()),
          chips: [...document.querySelectorAll(".board .panel.stack .tagpill")].filter(e => e.offsetParent).map(e => e.textContent.trim()) };
      } finally { if (deck) deckType(false); }
    });
    const pdfRun = await page.evaluate(async ([audit, headRatio, want]) => {
      const chipAudit = new Function("return " + audit)(), ratio = new Function("return " + headRatio)()(), orig = window.boardSvgMarkup;
      let seen = null;
      window.boardSvgMarkup = function () {
        const r = orig.apply(this, arguments);
        if (!seen) {
          const bd = document.querySelector(".board");
          seen = { W: bd.offsetWidth, step: parseFloat(getComputedStyle(document.getElementById("platform")).getPropertyValue("--pk")) || 1,
            names: [...new Set([...document.querySelectorAll("#plat-top .p-name, #platform .p-name")].map(e => getComputedStyle(e).fontSize))].sort().join(" "),
            chips: [...bd.querySelectorAll(".panel.stack .tagpill")].filter(e => e.offsetParent).map(e => [e.textContent.trim(), parseFloat(getComputedStyle(e).fontSize)]),
            bad: document.body.classList.contains("deck-chips") ? chipAudit([want, "pdf", ratio]) : ["the PDF reads the board without its PDF layout"],
            carried: /--deck-chip:[\d.]+px/.test(r.svg) };
        }
        return r;
      };
      try {
        const blob = await boardPdfBlob();
        if (!blob) return { b64: null, seen };
        const buf = new Uint8Array(await blob.arrayBuffer());
        let bin = ""; for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
        return { b64: btoa(bin), seen };
      } finally { window.boardSvgMarkup = orig; }
    }, [deckChipAudit.toString(), headChipRatio.toString(), DECK_CHIP_PT]);
    const pdfB64 = pdfRun.b64, pdfSeen = pdfRun.seen;
    const screenAfterPdf = await page.evaluate(screenSig);

    const tag = caseTag(ind, cloud, view);
    const pptxPath = path.join(OUT, tag + ".pptx");
    const pdfPath = path.join(OUT, tag + ".pdf");
    fs.writeFileSync(pptxPath, u8FromB64(pptxB64));
    if (pdfB64) fs.writeFileSync(pdfPath, u8FromB64(pdfB64));

    // PPTX slide count + content grep (zipStore is stored, so text is greppable in unzip -p)
    const slideList = execSync(`unzip -l "${pptxPath}" | grep -c 'ppt/slides/slide'`).toString().trim();
    const slideXml = execSync(`unzip -p "${pptxPath}" "ppt/slides/slide*.xml" 2>/dev/null || true`, { maxBuffer: 1 << 28 }).toString();
    const hasGenie = /Genie/i.test(slideXml);
    const hasDash = /Dashboard/i.test(slideXml);
    const hasApp = /\bApp/i.test(slideXml);
    // pull the first use case tile name to confirm it lands in the deck
    const firstUc = await page.evaluate(() => { const t = useCaseTiles()[0]; return t ? t.n : null; });
    const ucInDeck = firstUc ? slideXml.includes(firstUc.replace(/&/g, "&amp;").slice(0, 12)) : false;

    const pdfPages = pdfB64 ? pdfPageCount(u8FromB64(pdfB64)) : 0;
    const pdfAlpha = pdfB64 ? pdfBoardAlpha(u8FromB64(pdfB64)) : { smask: false };

    const n = Number(slideList), slideOf = i => `ppt/slides/slide${i}.xml`;
    const unz = name => execSync(`unzip -p "${pptxPath}" "${name}"`, { maxBuffer: 1 << 28 }).toString();
    const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const boardXml = unz(slideOf(3));
    const boardSlide = { ...board,
      grpSp: (boardXml.match(/<p:grpSp>/g) || []).length, pics: (boardXml.match(/<p:pic>/g) || []).length,
      titleOk: boardXml.includes(">" + esc(board.title) + "<"), noPicture: !boardXml.includes('name="Architecture"'),
      svgType: /Extension="svg"/.test(unz("[[]Content_Types].xml")),
      wellFormed: [slideOf(3), "ppt/slides/_rels/slide3.xml.rels"].every(f => shOk(`unzip -p "${pptxPath}" "${f}" | xmllint --noout -`)),
      zipOk: shOk(`unzip -tq "${pptxPath}"`) };

    const SW = 12192000, SH = 6858000, PAD = 0.03, BAND = Math.round(SH * 0.052), PT = 12700;
    const boxesOf = x => [...x.matchAll(/<a:off x="(-?\d+)" y="(-?\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"\/>/g)].map(m => m.slice(1).map(Number))
      .filter(b => b[2] || b[3]);
    const titleRe = /<p:sp><p:nvSpPr><p:cNvPr id="\d+" name="Title"\/>[\s\S]*?<\/p:sp>/;
    const overview = boxesOf(boardXml.replace(titleRe, "")), titleBox = boxesOf((boardXml.match(titleRe) || [""])[0])[0] || [0, 0, 0, 0];
    const span = (i, j) => Math.max(...overview.map(b => b[i] + b[j])) - Math.min(...overview.map(b => b[i]));
    const boardTop = Math.min(...overview.map(b => b[1])), boardBottom = Math.max(...overview.map(b => b[1] + b[3]));
    const platPt = board.platNames.map(t => boardXml.match(new RegExp(`<a:rPr [^>]*sz="(\\d+)"[^>]*>(?:(?!</a:rPr>).)*</a:rPr><a:t>${esc(t).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}</a:t>`)))
      .filter(Boolean).map(m => +m[1] / 100);
    const sps = [...boardXml.matchAll(/<p:sp>([\s\S]*?)<\/p:sp>/g)].map(m => {
      const b = m[1].match(/<a:off x="(-?\d+)" y="(-?\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"\/>/);
      return { box: b ? b.slice(1).map(Number) : null, rect: /name="box"/.test(m[1]), sz: +((m[1].match(/ sz="(\d+)"/) || [])[1] || 0),
        t: [...m[1].matchAll(/<a:t>([^<]*)<\/a:t>/g)].map(x => x[1]).join("") };
    }).filter(s => s.box);
    const inside = (a, b) => a[0] >= b[0] - 2 && a[1] >= b[1] - 2 && a[0] + a[2] <= b[0] + b[2] + 2 && a[1] + a[3] <= b[1] + b[3] + 2;
    const chipRuns = board.chips.map(c => {
      const runs = sps.filter(s => !s.rect && s.t === esc(c));
      const run = runs.find(s => sps.some(r => r.rect && inside(s.box, r.box) && r.box[2] < s.box[2] * 3)) || runs[0];
      return { c, sz: run ? run.sz : 0, held: !!run && sps.some(r => r.rect && inside(run.box, r.box) && r.box[2] < run.box[2] * 3) };
    });
    const SZ = DECK_CHIP_PT * 100;
    const layout = {
      chips: chipRuns.length, chips7: chipRuns.filter(r => r.sz === SZ && r.held).length,
      chipBad: chipRuns.filter(r => !(r.sz === SZ && r.held)).map(r => `${r.c}@${r.sz / 100}pt${r.held ? "" : " outside"}`),
      platNames: board.platNames.length, platFound: platPt.length, platMin: Math.min(Infinity, ...platPt),
      outside: boxesOf(boardXml).filter(([x, y, cx, cy]) => x < 0 || y < 0 || x + cx > SW || y + cy > SH).length,
      fill: Math.max(span(0, 2) / (SW * (1 - PAD * 2)), span(1, 3) / (SH * (1 - PAD * 2) - BAND)),
      gap: (boardTop - titleBox[1] - titleBox[3]) / PT, titleEdge: titleBox[1] / PT, bottomEdge: (SH - boardBottom) / PT,
      pdf: pdfB64 ? pdfBoardBox(u8FromB64(pdfB64)) : null };
    const pdfPt = layout.pdf && pdfSeen ? pdfSeen.chips.map(([c, px]) => [c, px * layout.pdf.w / pdfSeen.W]) : [];
    layout.pdfChips = pdfPt.length;
    layout.pdfChips7 = pdfPt.filter(([, pt]) => Math.round(pt * 100) === SZ).length;
    layout.pdfChipBad = pdfPt.filter(([, pt]) => Math.round(pt * 100) !== SZ).map(([c, pt]) => `${c}@${pt.toFixed(2)}pt`)
      .concat(pdfSeen ? pdfSeen.bad : ["the PDF never read the board"]).concat(pdfSeen && !pdfSeen.carried ? ["the PDF raster lost the chip size"] : []);

    results.push({ tag, want: view, ...summary, slides: n, boardSlide, layout, screenBefore, screenAfter, screenAfterPdf, pdfSeen, pptxHasGenie: hasGenie, pptxHasDash: hasDash, pptxHasApp: hasApp, firstUc, ucInDeck, pdfPages, pdfAlpha, pptxBytes: u8FromB64(pptxB64).length, pdfBytes: pdfB64 ? u8FromB64(pdfB64).length : 0 });
  }

  const b64Of = async (q, fn) => {
    await page.goto(`${BASE}?${q}`, { waitUntil: "networkidle" });
    await boardReady(page);
    await page.waitForTimeout(700);
    return page.evaluate(async fn => {
      const out = await (0, eval)(fn)();
      const blob = out && out.blob ? out.blob : out;
      if (!blob) return null;
      const u8 = new Uint8Array(await blob.arrayBuffer());
      let s = ""; for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
      return btoa(s);
    }, fn);
  };
  const pngB64 = await b64Of("industry=banking&cloud=azure", "() => boardPngBlob(1)");
  const pngDarkB64 = await b64Of("industry=banking&cloud=azure&theme=dark", "() => boardPngBlob(1)");
  const gifB64 = await b64Of("industry=banking&cloud=azure", "() => boardGifBlob()");
  const pdfArB64 = await b64Of("industry=banking&cloud=azure&lang=ar", "() => boardPdfBlob()");
  fs.writeFileSync(path.join(OUT, "banking_azure.png"), u8FromB64(pngB64));
  fs.writeFileSync(path.join(OUT, "banking_azure.gif"), u8FromB64(gifB64));
  const pngStats = await alphaStats(page, pngB64, "image/png");
  const pngDarkStats = await alphaStats(page, pngDarkB64, "image/png");
  const gifInfo = gifBlocks(u8FromB64(gifB64));
  const gifFrames = await alphaStats(page, gifB64, "image/gif", [0, 6]);
  const pdfAr = pdfArB64 ? u8FromB64(pdfArB64) : null;
  const pdfArAlpha = pdfAr ? pdfBoardAlpha(pdfAr) : { smask: false };
  const pdfArBoard = pdfAr ? pdfBoardBox(pdfAr) : null;
  const lineCases = await page.evaluate(() => [["fr", "Développement agentique", 60, "auto"],
      ["fr", "Pipelines de données auto-réparateurs", 70, "manual"], ["de", "Agent für Betrug und Finanzkriminalität", 80, "manual"],
      ["en", "Agent Developer Platform", 60, "auto"]].map(([lang, text, w, hy]) => {
    const host = document.createElement("div");
    host.lang = lang;
    host.style.cssText = `position:absolute;left:0;top:0;width:${w}px;font:700 16px sans-serif;hyphens:${hy};overflow-wrap:break-word`;
    host.textContent = text;
    document.body.appendChild(host);
    const runs = lineRuns(host.firstChild, text), txt = joinRuns(runs);
    host.remove();
    return { lang, text, lines: runs.length, txt };
  }));
  const textChecks = lineCases.map(c => [`a ${c.lang} line break keeps '${c.text}' whole`,
    c.lines > 1 && c.txt.replace(/-\n/g, "").replace(/\n/g, "") === c.text, `${c.lines} lines -> ${JSON.stringify(c.txt)}`]);
  const rasterChecks = [
    ["PNG background is transparent", transparentOk(pngStats), `clear=${(pngStats.clear * 100).toFixed(1)}% solid=${(pngStats.solid * 100).toFixed(1)}%`],
    ["PNG background is transparent in the dark theme", transparentOk(pngDarkStats), `clear=${(pngDarkStats.clear * 100).toFixed(1)}%`],
    ["GIF declares transparency (index 255) on every frame", !!gifInfo && gifInfo.frames > 1 && gifInfo.gces.length === gifInfo.frames &&
      gifInfo.gces.every(g => (g.packed & 1) && g.tidx === 255), gifInfo ? `frames=${gifInfo.frames} gce=${gifInfo.gces.length}` : "unparseable"],
    ["GIF background is transparent on the first and a later frame", gifFrames.every(transparentOk),
      gifFrames.map(f => `f${f.fi} clear=${(f.clear * 100).toFixed(1)}%`).join(" ")],
    ["GIF background stays put while the dashes move", Math.abs(gifFrames[0].clear - gifFrames[1].clear) < 0.005,
      `delta=${(Math.abs(gifFrames[0].clear - gifFrames[1].clear) * 100).toFixed(2)}%`],
    ["Arabic PDF draws the transparent board over its raster page", pdfArAlpha.smask && pdfArAlpha.sizeOk && transparentOk(pdfArAlpha) &&
      /\/Im1 6 0 R/.test(pdfAr.toString("latin1")), pdfArAlpha.smask ? `clear=${(pdfArAlpha.clear * 100).toFixed(1)}%` : "no soft mask"],
    ["Arabic PDF board keeps its full size 14pt below its title band", !!pdfArBoard && pdfArBoard.full && pdfArBoard.top >= 24 + 14 - 0.01 && pdfArBoard.bottom >= 6 - 0.01,
      pdfArBoard ? `${pdfArBoard.w.toFixed(0)}x${pdfArBoard.h.toFixed(0)}pt top=${pdfArBoard.top.toFixed(1)} bottom=${pdfArBoard.bottom.toFixed(1)}` : "board not found"],
  ];

  const drawing = [];
  for (const [q, tag, edit] of DRAW_CASES) {
    await page.goto(`${BASE}?${q}`, { waitUntil: "networkidle" });
    await boardReady(page);
    await page.waitForTimeout(700);
    const d = await page.evaluate(drawingProbe, !!edit);
    for (const kind of ["vsdx", "pptx"]) {
      const file = path.join(OUT, `${tag}.${kind === "pptx" ? "editable.pptx" : kind}`);
      fs.writeFileSync(file, u8FromB64(d.f[kind].b64));
      delete d.f[kind].b64;
      d.f[kind].zipOk = shOk(`unzip -tq "${file}"`);
      const dir = file + ".x";
      fs.rmSync(dir, { recursive: true, force: true });
      fs.mkdirSync(dir);
      execSync(`cd "${dir}" && unzip -q "${file}"`);
      const xml = execSync(`cd "${dir}" && find . -name "*.xml" -o -name "*.rels"`).toString().trim().split("\n");
      d.f[kind].xmllint = xml.filter(x => !shOk(`xmllint --noout "${dir}/${x}"`));
    }
    for (const [kind, ext] of [["drawio", "drawio"], ["svg", "svg"], ["excalidraw", "excalidraw"]]) {
      fs.writeFileSync(path.join(OUT, `${tag}.${ext}`), d.f[kind].text);
      delete d.f[kind].text;
    }
    d.f.drawio.xmllint = shOk(`xmllint --noout "${path.join(OUT, tag + ".drawio")}"`);
    d.f.svg.xmllint = shOk(`xmllint --noout "${path.join(OUT, tag + ".svg")}"`);
    drawing.push({ tag, ...d });
  }

  const bootNames = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "app", "index.html"), "utf8")
    .match(/const names = (\[[^\]]+\]);/)[1]);
  await page.goto(`${BASE}?industry=banking&cloud=azure`, { waitUntil: "networkidle" });
  await boardReady(page);
  await page.waitForTimeout(700);
  const liveDots = await page.evaluate(() => document.querySelectorAll(".atom > .badge-dot[data-hl]").length);
  const htmlDoc = await page.evaluate(() => exportHtmlDoc());
  const htmlPath = path.join(OUT, "banking_azure.html");
  fs.writeFileSync(htmlPath, htmlDoc);
  const frozenMatch = htmlDoc.match(/<script type="application\/json" id="frozen-resources">([\s\S]*?)<\/script>/);
  const frozen = frozenMatch ? JSON.parse(frozenMatch[1]) : {};
  const filled = v => Array.isArray(v) ? v.length > 0 : !!(v && typeof v === "object" && Object.keys(v).length);
  const offline = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const offlineErrors = [];
  offline.on("pageerror", e => offlineErrors.push(String(e)));
  await offline.goto("file://" + htmlPath, { waitUntil: "load" });
  await boardReady(offline);
  await offline.waitForTimeout(1500);
  const offlineDots = await offline.evaluate(() => document.querySelectorAll(".atom > .badge-dot[data-hl]").length);
  await offline.close();
  const stateTrips = [];
  for (const [want, scheme] of [
    ["industry=banking&cloud=gcp&shape=t&pal=ocean&theme=dark&display=branded&view=detailed&lang=de&stage=beta&hl=video&region=us-east1", "light"],
    ["industry=retail&cloud=aws&shape=s&theme=light&region=us-east-1&box=Unity%20Catalog", "dark"]]) {
    await page.goto(`${BASE}?${want}`, { waitUntil: "networkidle" });
    await boardReady(page);
    await page.waitForTimeout(700);
    const before = await page.evaluate(() => stateParams().toString());
    const file = path.join(OUT, `settings_${scheme}_reader.html`);
    fs.writeFileSync(file, await page.evaluate(() => exportHtmlDoc()));
    const p = await browser.newPage({ viewport: { width: 1600, height: 1000 }, colorScheme: scheme });
    await p.goto("file://" + file, { waitUntil: "load" });
    await boardReady(p);
    await p.waitForTimeout(1000);
    const after = await p.evaluate(() => stateParams().toString());
    await p.close();
    const a = new URLSearchParams(before), b = new URLSearchParams(after);
    stateTrips.push([scheme, [...new Set([...a.keys(), ...b.keys()])].filter(k => a.get(k) !== b.get(k)).map(k => `${k} ${a.get(k)} -> ${b.get(k)}`)]);
  }
  const htmlChecks = [
    ["every boot resource is frozen into the export (" + bootNames.join(", ") + ")",
      bootNames.every(n => filled(frozen[n])), bootNames.filter(n => !filled(frozen[n])).join(", ") || "all present"],
    ["the exported file opens offline with every highlight dot", offlineDots > 0 && offlineDots === liveDots, `live=${liveDots} offline=${offlineDots}`],
    ["the exported file opens offline without page errors", offlineErrors.length === 0, offlineErrors.slice(0, 2).join(" | ")],
    ["the exported file reopens with every board setting in a reader's light or dark browser", stateTrips.every(t => !t[1].length),
      stateTrips.map(t => `${t[0]} reader: ${t[1].join(", ") || "same"}`).join("; ")],
  ];

  const live = LIVE ? await liveChecks(browser, path.join(OUT, "banking_azure"), (results.find(r => r.tag === "banking_azure") || {}).slides) : null;

  await browser.close();
  server.close();

  console.log("\n================ EXPORT VERIFICATION ================\n");
  let fail = 0;
  for (const r of results) {
    const secLine = r.secs.map(s => `${s.key}:${s.n}`).join("  ");
    // expected content-page count in deck: uc tiles + genie tiles + 1(dash grid if dash) + 1(app grid if app) + breaks + cover + index + board
    const hasUc = r.uc > 0, hasGenieS = r.genie > 0, hasDashS = r.dash > 0, hasAppS = r.apps > 0;
    // narrative slides = per-section break(1) + pages; board is its own; cover+index
    let narr = 0, breaks = 0;
    r.secs.forEach(s => {
      if (s.kind === "board") return;
      breaks += 1;
      if (s.kind === "uc" || s.kind === "genie" || s.kind === "dash") narr += s.n; else narr += 1; // apps grid = 1
    });
    const z = r.layout, pb = z.pdf;
    const expSlides = 1 /*cover*/ + 1 /*index*/ + 1 /*board*/ + breaks + narr + 1 /*closing*/;

    const checks = [];
    // Guard against a silent fall-back to generic: the loaded industry must be
    // the one requested (proves the lazy per-industry fetch actually resolved).
    checks.push(["industry==" + r.tag.split("_")[0], r.industry === r.tag.slice(0, r.tag.lastIndexOf("_"))]);
    checks.push(["opened in " + r.want, r.view === r.want]);
    checks.push(["deck carries the tiles on screen", ["uc", "genie", "dash", "apps"].every(k => r[k] === r.screen[k])]);
    const twin = r.want === "simple" && results.find(x => x.tag === r.tag.replace("-simple", ""));
    if (twin) checks.push(["Simplified deck is shorter than Detailed's " + twin.slides + " slides", r.slides < twin.slides && r.uc < twin.uc]);
    checks.push(["uc>0", hasUc]);
    checks.push(["ucInDeck", r.ucInDeck]);
    checks.push(["genie>0", hasGenieS]);
    checks.push(["dash>0", hasDashS]);
    checks.push(["apps>0", hasAppS]);
    checks.push(["pptx has Genie", r.pptxHasGenie]);
    checks.push(["pptx has Dashboard", r.pptxHasDash]);
    checks.push(["slides==exp(" + expSlides + ")", r.slides === expSlides]);
    checks.push(["pdf pages==exp(" + expSlides + ")", r.pdfPages === expSlides]);
    const a = r.boardSlide;
    checks.push(["board slide groups == board groups", a.grpSp > 0 && a.grpSp === a.groups]);
    checks.push(["board slide pictures == board logos, no board picture", a.pics === a.imgs && a.noPicture]);
    checks.push(["board slide carries the deck title", a.titleOk]);
    checks.push(["board slide logos ship as svg", a.svgType]);
    checks.push(["deck zip + board slide xml valid", a.zipOk && a.wellFormed]);
    checks.push(["pdf board image has a transparent soft mask", r.pdfAlpha.smask && r.pdfAlpha.sizeOk && transparentOk(r.pdfAlpha)]);
    checks.push(["board overview fills the slide", z.fill >= 0.98]);
    checks.push(["every shape lies on its slide", z.outside === 0]);
    checks.push(["the board sits at least 12pt below the slide title", z.gap >= 12]);
    checks.push(["the slide title and the board keep 9pt to the slide edges", z.titleEdge >= 9 && z.bottomEdge >= 9]);
    checks.push(["the pdf board keeps its full width or height", !!pb && pb.full]);
    checks.push(["the pdf board sits at least 16pt below the title baseline", !!pb && pb.baseline != null && pb.top - pb.baseline >= 16 - 0.01]);
    checks.push(["the pdf board keeps its bottom margin", !!pb && pb.bottom >= 6 - 0.01]);
    checks.push(["the board slide names its platform products as the screen does", z.platNames >= 10 && z.platFound === z.platNames]);
    if (r.view === "simple") checks.push(["Simplified platform names reach the slide at 7.4pt or more", z.platMin >= 7.4]);
    if (r.view === "simple") checks.push(["Simplified Genie and Agent Bricks chips reach the slide at 7pt inside their rectangles", z.chips >= 8 && z.chips7 === z.chips]);
    if (r.view === "simple") checks.push(["Simplified Genie and Agent Bricks chips reach the PDF page at 7pt inside their rectangles under a larger panel name", z.pdfChips >= 8 && z.pdfChips7 === z.pdfChips && !z.pdfChipBad.length]);
    checks.push(r.view === "simple"
      ? ["the Simplified PDF sets the platform's type one step larger, as the PowerPoint does", !!r.pdfSeen && r.pdfSeen.step > 1 && r.pdfSeen.step === a.step]
      : ["the Detailed PDF keeps the screen's platform type", !!r.pdfSeen && r.pdfSeen.step === 1 && r.pdfSeen.names === r.screenBefore.names]);
    checks.push(["the PDF export gives the screen back unchanged", JSON.stringify(r.screenBefore) === JSON.stringify(r.screenAfterPdf)]);
    checks.push(["the screen shows the platform at its own type size", r.screenBefore.step === 1 && !r.screenBefore.deck]);
    checks.push(["the PowerPoint export gives the screen back unchanged", JSON.stringify(r.screenBefore) === JSON.stringify(r.screenAfter)]);
    checks.push([r.view === "simple" ? "the Simplified slide is read from the PowerPoint layout" : "the Detailed slide is read from the screen layout", a.deck === (r.view === "simple")]);

    const bad = checks.filter(c => !c[1]);
    if (bad.length) fail++;
    console.log(`● ${r.tag}  [${r.label}]  ${bad.length ? "❌" : "✅"}`);
    console.log(`   secs: ${secLine}`);
    console.log(`   ${r.view}  uc=${r.uc} genie=${r.genie} dash=${r.dash} apps=${r.apps} (screen ${r.screen.uc}/${r.screen.genie}/${r.screen.dash}/${r.screen.apps})  slides=${r.slides}(exp ${expSlides})  pdfPages=${r.pdfPages}  pptx=${(r.pptxBytes/1024).toFixed(0)}KB pdf=${(r.pdfBytes/1024).toFixed(0)}KB  board slide groups=${a.grpSp}/${a.groups} pics=${a.pics}/${a.imgs}`);
    console.log(`   board slide fill=${z.fill.toFixed(3)} title gap=${z.gap.toFixed(1)}pt edges=${z.titleEdge.toFixed(1)}/${z.bottomEdge.toFixed(1)}pt outside=${z.outside} platform names ${z.platFound}/${z.platNames} min=${z.platMin}pt chips ${z.chips7}/${z.chips} at 7pt${z.chipBad.length ? " (" + z.chipBad.slice(0, 4).join(", ") + ")" : ""} pdf chips ${z.pdfChips7}/${z.pdfChips}${r.view === "simple" && z.pdfChipBad.length ? " (" + z.pdfChipBad.slice(0, 4).join(", ") + ")" : ""} screen step=${r.screenBefore.step} height ${r.screenBefore.h}->${r.screenAfter.h}` +
      (pb ? `  pdf board ${pb.w.toFixed(0)}x${pb.h.toFixed(0)}pt top=${pb.top.toFixed(1)} baseline=${pb.baseline} bottom=${pb.bottom.toFixed(1)}` : "  pdf board not found"));
    console.log(`   firstUc=${JSON.stringify(r.firstUc)} inDeck=${r.ucInDeck}`);
    console.log(`   pdf board smask=${r.pdfAlpha.smask} clear=${r.pdfAlpha.smask ? (r.pdfAlpha.clear * 100).toFixed(1) + "%" : "n/a"}`);
    if (bad.length) console.log("   FAILS: " + bad.map(b => b[0]).join(", "));
  }
  console.log("\n================ DRAWING-APP EXPORTS ================\n");
  let drawFail = 0;
  for (const r of drawing) {
    const bad = drawingChecks(r).filter(c => !c[1]);
    if (bad.length) drawFail++;
    const sh = r.by;
    console.log(`● ${r.tag}  ${bad.length ? "❌" : "✅"}  shapes rect=${sh.rect || 0} text=${sh.text || 0} img=${sh.img || 0} arrow=${sh.arrow || 0} line=${sh.line || 0} ring=${sh.poly || 0}  groups zone=${r.kinds.zone || 0} box=${r.kinds.box || 0} tile=${r.kinds.tile || 0}  links=${r.links}`);
    console.log(`   sizes drawio=${kb(r.f.drawio.bytes)} svg=${kb(r.f.svg.bytes)} excalidraw=${kb(r.f.excalidraw.bytes)} vsdx=${kb(r.f.vsdx.bytes)} pptx=${kb(r.f.pptx.bytes)}`);
    if (bad.length) console.log("   FAILS: " + bad.map(b => b[0]).join(", "));
  }
  console.log("\n================ TEXT LINES ================\n");
  const textFail = textChecks.filter(c => !c[1]).length;
  for (const [name, ok, detail] of textChecks) console.log(`${ok ? "✅" : "❌"} ${name}  ${detail}`);
  console.log("\n================ RASTER EXPORTS ================\n");
  const rasterFail = rasterChecks.filter(c => !c[1]).length;
  for (const [name, ok, detail] of rasterChecks) console.log(`${ok ? "✅" : "❌"} ${name}  ${detail}`);
  console.log("\n================ HTML EXPORT ================\n");
  const htmlFail = htmlChecks.filter(c => !c[1]).length;
  for (const [name, ok, detail] of htmlChecks) console.log(`${ok ? "✅" : "❌"} ${name}  ${detail}`);
  let liveFail = 0;
  if (live) {
    console.log("\n================ LIVE (--live) ================\n");
    for (const [name, ok, detail] of live) { if (!ok) liveFail++; console.log(`${ok ? "✅" : "❌"} ${name}  ${detail}`); }
  }
  console.log("\nPage errors captured: " + errors.length);
  errors.slice(0, 10).forEach(e => console.log("   ! " + e));
  console.log(`\nRESULT: ${results.length - fail}/${results.length} deck cases passed, ${drawing.length - drawFail}/${drawing.length} drawing cases passed, ` +
    `${textChecks.length - textFail}/${textChecks.length} text line checks passed, ` +
    `${rasterChecks.length - rasterFail}/${rasterChecks.length} raster checks passed, ` +
    `${htmlChecks.length - htmlFail}/${htmlChecks.length} HTML export checks passed` +
    (live ? `, ${live.length - liveFail}/${live.length} live checks passed` : ""));
  console.log("Artifacts in " + OUT);
  process.exit(fail || drawFail || textFail || rasterFail || htmlFail || liveFail || errors.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
