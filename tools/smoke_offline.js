#!/usr/bin/env node
'use strict';
/* Prove an exported HTML file works fully offline: it must inline the resource
   maps, the open industry module and the merged translation dict, so opening it
   from disk with every network request blocked still renders the reference
   board, the chosen industry and the chosen language. */
const { chromium } = require('playwright');
const { serve, boardReady } = require('./lib_serve');
const fs = require('fs');
const path = require('path');
const os = require('os');

const results = [];
function check(n, c, d) { results.push(!!c); console.log((c ? 'PASS ' : 'FAIL ') + n + (d ? ' :: ' + d : '')); }

(async () => {
  const server = await serve();
  const port = server.address().port;
  const browser = await chromium.launch();

  // 1) Online: pick an industry + Arabic, then export the frozen HTML.
  const p1 = await browser.newPage();
  await p1.addInitScript(() => { try { localStorage.setItem('dbx-arch-tour-v1', '1'); } catch (e) {} });
  await p1.goto('http://127.0.0.1:' + port + '/index.html', { waitUntil: 'networkidle' });
  await boardReady(p1);
  await p1.waitForTimeout(400);
  await p1.evaluate(async () => { await applyIndustry('healthcare', true); });
  await p1.click('#opt-btn'); await p1.waitForTimeout(120);
  await p1.click('#lang-menu button[data-lang="ar"]'); await p1.waitForTimeout(700);
  const doc = await p1.evaluate(() => exportHtmlDoc());
  const hasRes = /id="frozen-resources"/.test(doc);
  const hasArch = /id="frozen-arch-healthcare"/.test(doc);
  const hasLang = /id="frozen-lang"/.test(doc) && /id="frozen-lang-code"/.test(doc);
  check('export inlines frozen-resources', hasRes);
  check('export inlines frozen-arch-healthcare', hasArch);
  check('export inlines frozen-lang + code', hasLang);

  const tmp = path.join(os.tmpdir(), 'offline_export_' + Date.now() + '.html');
  fs.writeFileSync(tmp, doc);

  // 2) Offline: open from disk, block EVERY network request.
  const ctx = await browser.newContext();
  await ctx.route('**', route => {
    const u = route.request().url();
    if (u.startsWith('file:') || u.startsWith('data:') || u.startsWith('blob:')) return route.continue();
    return route.abort();   // no http/https allowed
  });
  const p2 = await ctx.newPage();
  const errs = [];
  p2.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  await p2.addInitScript(() => { try { localStorage.setItem('dbx-arch-tour-v1', '1'); } catch (e) {} });
  await p2.goto('file://' + tmp, { waitUntil: 'load' });
  await boardReady(p2);
  await p2.waitForTimeout(900);

  const st = await p2.evaluate(() => ({
    industry: ARCH.industry,
    lang: I18N.lang,
    links: Object.keys(LINKS).length,
    refs: REFERENCES.length,
    conn: Object.keys(CONNECTORS).length,
    connRe: Object.values(CONNECTORS).every(c => c.re instanceof RegExp),
    indCached: !!INDUSTRIES.healthcare,
    dictSize: Object.keys(I18N.dict).length,
    atoms: document.querySelectorAll('#platform .atom').length,
  }));
  check('offline: industry restored (healthcare)', st.industry === 'healthcare', JSON.stringify(st));
  check('offline: language restored (ar)', st.lang === 'ar');
  check('offline: resources inlined (links+refs+connRe)', st.links > 100 && st.refs > 0 && st.connRe);
  check('offline: industry module inlined', st.indCached);
  check('offline: merged dict present', st.dictSize > 1000, 'dict=' + st.dictSize);
  check('offline: reference platform rendered', st.atoms > 0, 'atoms=' + st.atoms);
  // Board shows Arabic content offline.
  const anyArabic = await p2.evaluate(() => /[\u0600-\u06FF]/.test(document.querySelector('.board').textContent));
  check('offline: Arabic content on board', anyArabic);
  const draw = await p2.evaluate(async () => {
    const out = {};
    for (const kind of Object.keys(DRAW_EXPORTS)) {
      try { out[kind] = (await drawingBlob(kind)).size; } catch (e) { out[kind] = 'ERR ' + e.message; }
    }
    return out;
  });
  check('offline: all four drawing-app exports build', Object.values(draw).length === 4 &&
    Object.values(draw).every(v => typeof v === 'number' && v > 10000), JSON.stringify(draw));
  const deck = await p2.evaluate(async () => {
    const t = new TextDecoder().decode(new Uint8Array(await (await exportPptx()).arrayBuffer()));
    const title = docTitle();
    return { groups: (t.match(/<p:grpSp>/g) || []).length, arabicTitle: /[\u0600-\u06FF]/.test(title),
      title: t.includes('>' + xmlEsc(title) + '<'), noPicture: !t.includes('name="Architecture"') };
  });
  check('offline: PowerPoint deck builds with its editable, translated board slide (ar)',
    deck.groups > 0 && deck.arabicTitle && deck.title && deck.noPicture, JSON.stringify(deck));
  check('offline: no page errors', errs.length === 0, errs.slice(0, 5).join(' | '));

  fs.unlinkSync(tmp);
  await browser.close(); server.close();
  const failed = results.filter(r => !r).length;
  console.log('\n' + (results.length - failed) + '/' + results.length + ' checks passed');
  process.exit(failed ? 1 : 0);
})();
