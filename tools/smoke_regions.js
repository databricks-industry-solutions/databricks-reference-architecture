#!/usr/bin/env node
'use strict';
const { chromium } = require('playwright');
const { serve, boardReady, withView } = require('./lib_serve');

const results = [];
function check(name, cond, detail) { results.push({ name, ok: !!cond, detail }); console.log((cond ? 'PASS ' : 'FAIL ') + name + (detail ? ' :: ' + detail : '')); }

(async () => {
  const server = await serve();
  const base = 'http://127.0.0.1:' + server.address().port + '/index.html';
  const browser = await chromium.launch();
  const errors = [];
  const open = async (q, width, view) => {
    const ctx = await browser.newContext({ viewport: { width: width || 1600, height: 1000 } });
    await ctx.addInitScript(() => { try { localStorage.setItem('dbx-arch-tour-v1', '1'); } catch (e) {} });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(withView(base + q, view || 'detailed'), { waitUntil: 'networkidle' });
    await boardReady(page);
    await page.waitForTimeout(500);
    return { ctx, page };
  };

  for (const cloud of ['aws', 'azure', 'gcp']) {
    const { ctx, page } = await open('?cloud=' + cloud);
    for (const name of ['Lakebase', 'Genie App Builder', 'AI Search', 'Model Serving', 'Unity Catalog']) {
      const r = await page.evaluate((name) => {
        const id = Object.keys(byId).find(k => byId[k].tile && byId[k].tile.n === name);
        openDetail(id);
        const body = document.getElementById('d-body');
        const out = { line: !!body.querySelector('.d-region, .d-regsum'),
          text: /Available in|Regional availability|Not yet available on/.test(body.textContent) };
        closeDrawer();
        return out;
      }, name);
      check(cloud + ': ' + name + "'s panel shows no regional availability", !r.line && !r.text, JSON.stringify(r));
    }
    const dim = await page.evaluate(() => {
      const cr = REGIONS.clouds[curCloud()], col = cr.features['Lakebase (product page)'];
      const out = cr.regions.find(x => !col[x.code]), inn = cr.regions.find(x => col[x.code]);
      const lakebase = () => [...document.querySelectorAll('.atom')].find(a => byId[a.dataset.id] && byId[a.dataset.id].tile.n === 'Lakebase');
      const res = {};
      if (out) { setRegion(out.code); res.outside = lakebase().classList.contains('rg-off'); }
      if (inn) { setRegion(inn.code); res.inside = lakebase().classList.contains('rg-off'); }
      setRegion('');
      return res;
    });
    if ('outside' in dim) check(cloud + ': a region Lakebase does not list dims it', dim.outside === true);
    if ('inside' in dim) check(cloud + ': a region Lakebase lists keeps it lit', dim.inside === false);
    const every = await page.evaluate(() => {
      const cr = REGIONS.clouds[curCloud()], out = { cases: 0, bad: [] };
      const atom = n => [...document.querySelectorAll('.atom')].find(a => byId[a.dataset.id] && byId[a.dataset.id].tile.n === n);
      for (const name of Object.keys(REGIONS.alias)) {
        const el = atom(name);
        if (!el) continue;
        const t = byId[el.dataset.id].tile, lab = regionFeatureLabel(t);
        if (!lab || stageKey(stageFor(t)) === 'soon') continue;
        const col = cr.features[lab];
        for (const [r, want] of [[cr.regions.find(x => !col[x.code]), true], [cr.regions.find(x => col[x.code]), false]]) {
          if (!r) continue;
          setRegion(r.code);
          out.cases++;
          if (atom(name).classList.contains('rg-off') !== want) out.bad.push(name + (want ? ' stays lit in ' : ' dims in ') + r.code);
        }
      }
      setRegion('');
      return out;
    });
    check(cloud + ': every mapped product dims where its docs column says no and stays lit where it says yes (' + every.cases + ' cases)',
      every.cases > 0 && !every.bad.length, every.bad.slice(0, 4).join(', '));
    if (cloud === 'azure') {
      const qatar = await page.evaluate(() => {
        const dimmed = n => { const a = [...document.querySelectorAll('.atom')].find(x => byId[x.dataset.id] && byId[x.dataset.id].tile.n === n); return a && a.classList.contains('rg-off'); };
        setRegion('qatarcentral');
        const out = { serverless: dimmed('Serverless Compute'), serving: dimmed('Model Serving'), uc: dimmed('Unity Catalog') };
        setRegion('westeurope');
        out.westServerless = dimmed('Serverless Compute');
        setRegion('');
        return out;
      });
      check('azure: Qatar Central dims Serverless Compute and Model Serving and keeps Unity Catalog; West Europe keeps serverless',
        qatar.serverless === true && qatar.serving === true && qatar.uc === false && qatar.westServerless === false, JSON.stringify(qatar));
    }
    await ctx.close();
  }

  {
    const rowsIn = async (view) => {
      const { ctx, page } = await open('?cloud=azure', null, view);
      await page.click('#region-btn');
      await page.click('#region-menu button[data-region="qatarcentral"]');
      await page.waitForTimeout(300);
      const r = await page.evaluate(() => {
        const dimmed = n => { const a = [...document.querySelectorAll('.atom')].find(x => byId[x.dataset.id] && byId[x.dataset.id].tile.n === n); return a ? a.classList.contains('rg-off') : null; };
        return { simple: document.body.classList.contains('view-simple'), open: !!document.querySelector('#d-body .rg-table'),
          rows: regionRowsNow.map(x => x.n + '|' + x.avail).sort().join('\n'), serving: dimmed('Model Serving'), uc: dimmed('Unity Catalog') };
      });
      await ctx.close();
      return r;
    };
    const s = await rowsIn('simple'), d = await rowsIn('detailed');
    check('Simplified, the default view: Qatar Central dims Model Serving, keeps Unity Catalog lit and opens the region panel',
      s.simple && !d.simple && s.open && s.serving === true && s.uc === false, JSON.stringify({ simple: s.simple, open: s.open, serving: s.serving, uc: s.uc }));
    check('the region panel lists the same rows with the same availability in Simplified and Detailed', s.rows === d.rows && s.rows.length > 0,
      s.rows.split('\n').length + ' vs ' + d.rows.split('\n').length);
  }

  const DOCS_OF = { aws: ['https://docs.databricks.com/aws/en/'], gcp: ['https://docs.databricks.com/gcp/en/'],
    azure: ['https://learn.microsoft.com/en-us/azure/databricks/', 'https://learn.microsoft.com/azure/databricks/'] };
  const LADDER = ['GA', 'Public Preview', 'Beta', 'Private Preview', 'Coming soon'];
  const listOf = {};
  for (const cloud of ['aws', 'azure', 'gcp']) {
    const { ctx, page } = await open('?cloud=' + cloud);
    const code = await page.evaluate(() => REGIONS.clouds[curCloud()].regions[0].code);
    await page.click('#region-btn');
    await page.click('#region-menu button[data-region="' + code + '"]');
    await page.waitForTimeout(300);
    const r = await page.evaluate(({ code, docs, ladder }) => {
      const cr = REGIONS.clouds[curCloud()], rows = regionRowsNow, names = new Set(rows.map(x => x.n));
      const onCloud = (u, api) => docs.some(d => (u || '').startsWith(d)) || (api && (u || '').startsWith('https://docs.databricks.com/api/'));
      const want = Object.keys(cr.meta).map(rgName).concat(Object.keys(cr.derived), cr.designated.rows.map(d => d.n), cr.elsewhere.map(e => rgName(e.n)), cr.partner.rows.map(d => d.n));
      const shown = [...document.querySelectorAll('#d-body .rg-row')], tag = document.getElementById('d-tagline');
      return { open: document.body.classList.contains('detail-open') && !!document.querySelector('#d-body .rg-table'),
        menuOpen: document.getElementById('region-wrap').classList.contains('open'),
        title: document.getElementById('d-title').textContent, missing: want.filter(n => !names.has(n)),
        offCloud: rows.filter(x => x.away ? x.doc !== docsSearchUrl(x.n) : (!onCloud(x.doc, true) || !onCloud(x.src))).map(x => x.n),
        away: rows.filter(x => x.away).map(x => ({ n: x.n, note: x.notes.indexOf("The link searches this cloud's docs.") >= 0, dbx: isDatabricksUrl(x.doc), avail: x.avail })),
        partner: cr.partner.rows.filter(d => { const row = rows.find(x => x.n === d.n);
          return !row || !row.notes.some(t => t === 'Hosting provider, partner-powered AI features on: ' + d.on) || !row.notes.some(t => t === 'Hosting provider, partner-powered AI features off: ' + d.off)
            || (d.marks.indexOf('†') >= 0 && !row.notes.some(t => /within the Databricks security perimeter/.test(t)))
            || (/^Databricks\b/.test(d.off) && row.notes.indexOf(cr.partner.geo) < 0)
            || (/^feature is not available/i.test(d.on) && row.avail !== 'no'); }).map(d => d.n),
        perimeter: rows.filter(x => x.notes.some(t => /within the Databricks security perimeter/.test(t))).length,
        noStage: rows.filter(x => !x.away && ladder.indexOf(rgStage(x.st)) < 0).map(x => x.n + ':' + x.st),
        rendered: shown.length, total: rows.length, linksOk: shown.every(tr => tr.querySelector('a.rg-n')),
        tally: tag.firstChild.textContent.match(/\d+/g).map(Number).reduce((a, b) => a + b, 0),
        asof: (tag.querySelector('.rg-asof') || {}).textContent || '', want: T('Data from the public Databricks docs') + ' · ' + dataUpdated(),
        flags: { menu: document.querySelectorAll('#region-menu button[data-region] .rg-flag svg').length, regions: cr.regions.length,
          button: !!document.querySelector('#region-ico .rg-flag svg'), title: !!document.querySelector('#d-title .rg-flag svg'),
          globe: !!document.querySelector('#region-menu button[data-region-all] .rg-globe svg'),
          plain: !document.getElementById('region-btn').classList.contains('on')
            && getComputedStyle(document.getElementById('region-btn')).backgroundColor === getComputedStyle(document.getElementById('dl-btn')).backgroundColor },
        url: location.search };
    }, { code, docs: DOCS_OF[cloud], ladder: LADDER });
    check(cloud + ': picking a region opens its panel and closes the Region menu', r.open && !r.menuOpen && r.title.indexOf('(' + code + ')') >= 0, r.title);
    check(cloud + ': the panel lists every docs feature, MCP row and Designated Service on any cloud (' + r.total + ' rows)', !r.missing.length, r.missing.slice(0, 4).join(', '));
    check(cloud + ': every row links a docs page on this cloud, a row this cloud lacks links its docs search, and each row cites the section that states it',
      !r.offCloud.length && r.linksOk, r.offCloud.slice(0, 4).join(', '));
    check(cloud + ': every partner-powered AI feature shows both hosting providers, the security perimeter where the docs mark it, and the geography rule where models fall back to Databricks (' + r.perimeter + ' rows within the perimeter)',
      !r.partner.length && r.perimeter > 0, r.partner.join(', '));
    check(cloud + ': a row with no docs page on this cloud reads No, searches this cloud\'s docs and says so',
      r.away.every(a => a.note && a.dbx && a.avail === 'no'), JSON.stringify(r.away.filter(a => !(a.note && a.dbx && a.avail === 'no')).slice(0, 3)));
    check(cloud + ': every row on this cloud carries a release stage from the docs', !r.noStage.length, r.noStage.slice(0, 4).join(', '));
    check(cloud + ': every row is drawn, the counts add up, and the docs date sits right under them',
      r.rendered === r.total && r.tally === r.total && r.asof === r.want, r.rendered + '/' + r.tally + '/' + r.total + ' ' + r.asof);
    check(cloud + ': every region in the menu shows its country flag, All regions shows a globe, and the Region button and the panel title show the selected flag with nothing behind it',
      r.flags.menu === r.flags.regions && r.flags.button && r.flags.title && r.flags.globe && r.flags.plain, JSON.stringify(r.flags));
    check(cloud + ': the address bar records the open panel', /[?&]panel=region/.test(r.url) && r.url.indexOf('region=' + code) >= 0, r.url);
    const same = await page.evaluate(() => {
      const lists = new Set();
      for (const reg of REGIONS.clouds[curCloud()].regions) { setRegion(reg.code); lists.add(regionRows().map(x => x.n + '|' + x.cat).sort().join('\n')); }
      return [...lists];
    });
    listOf[cloud] = same[0];
    check(cloud + ': every region lists the same products and features', same.length === 1, same.length + ' different lists');
    const truth = await page.evaluate(() => {
      const cr = REGIONS.clouds[curCloud()], bad = [];
      let cases = 0, marked = 0;
      for (const reg of cr.regions) {
        setRegion(reg.code);
        for (const lab of Object.keys(cr.meta)) {
          const row = regionRowsNow.find(x => x.n === rgName(lab)), on = !!cr.features[lab][reg.code];
          const m = (cr.marks[lab] || {})[reg.code] || '', cond = on && rgMarks(m).some(k => (cr.legend[cr.meta[lab].sec] || {})[k] && cr.legend[cr.meta[lab].sec][k].c);
          const want = !on ? 'no' : cond ? 'cond' : 'yes';
          cases++;
          if (!row || row.avail !== want) bad.push(reg.code + ' ' + lab + ' ' + (row && row.avail) + '!=' + want);
          if (cond) { marked++; if (!row.notes.some(t => /cross geography routing|not enabled for/.test(t))) bad.push(reg.code + ' ' + lab + ' lacks its note'); }
        }
      }
      return { cases, marked, bad };
    });
    check(cloud + ': every docs cell reads the same in the panel, and a conditional cell carries its note (' + truth.cases + ' cells, ' + truth.marked + ' conditional)',
      truth.cases > 0 && !truth.bad.length, truth.bad.slice(0, 3).join(', '));
    await page.evaluate((c) => setRegion(c), code);
    const file = await Promise.all([page.waitForEvent('download'), page.click('#d-body .rg-xlsx')]).then(([d]) => d);
    const bytes = require('fs').readFileSync(await file.path());
    const x = await page.evaluate(() => {
      const parts = xlsxParts(regionSheet()), sheet = parts.find(p => p.name === 'xl/worksheets/sheet1.xml').data;
      const urls = regionSheet().slice(1).reduce((n, row) => n + row.filter(v => /^https?:\/\//.test(v)).length, 0);
      return { sheet, names: parts.map(p => p.name), bad: parts.filter(p => new DOMParser().parseFromString(p.data, 'text/xml').querySelector('parsererror')).map(p => p.name),
        rows: (sheet.match(/<row /g) || []).length, visible: regionVisible().length, links: (sheet.match(/<hyperlink /g) || []).length, urls,
        head: regionSheet()[0].join(','), frozen: /state="frozen"/.test(sheet), filter: /<autoFilter ref="A1:L\d+"\/>/.test(sheet) };
    });
    const text = bytes.toString('utf8');
    check(cloud + ': Download Excel saves an .xlsx with a frozen header, a filter on every column, live links and one row per visible row',
      file.suggestedFilename() === 'databricks-' + cloud + '-' + code + '-availability.xlsx' && bytes.slice(0, 2).toString() === 'PK'
      && x.names.every(n => text.indexOf(n) >= 0) && text.indexOf(x.sheet) >= 0 && !x.bad.length && x.rows === x.visible + 1
      && x.links === x.urls && x.frozen && x.filter
      && x.head === 'Cloud,Region,Location,Product or feature,Category,Stage,Available,Notes,Docs page,Source,On the board,Data updated',
      file.suggestedFilename() + ' rows ' + x.rows + '/' + (x.visible + 1) + ' links ' + x.links + '/' + x.urls + ' bad ' + x.bad.join(','));
    const ui = await page.evaluate(() => {
      const pick = (col, keep) => {
        document.querySelector('#d-body .rg-filt[data-col="' + col + '"]').click();
        document.querySelectorAll('#d-body .rg-pop input[value]').forEach(i => { if ((i.value === keep) !== i.checked) { i.checked = !i.checked; i.dispatchEvent(new Event('change')); } });
      };
      const out = {};
      pick('avail', 'yes');
      out.onlyYes = regionVisible().length > 0 && regionVisible().every(r => r.avail === 'yes') && !!document.querySelector('#d-body .rg-filt[data-col="avail"].on');
      document.querySelector('#d-body .rg-pop input[data-all]').click();
      out.allBack = regionVisible().length === regionRowsNow.length;
      document.body.click();
      out.closed = !document.querySelector('#d-body .rg-pop');
      pick('st', 'GA');
      out.onlyGa = regionVisible().length > 0 && regionVisible().every(r => rgStage(r.st) === 'GA');
      document.querySelector('#d-body .rg-pop input[data-all]').click();
      document.body.click();
      const q = document.querySelector('#d-body .rg-q');
      q.value = 'serverless'; q.dispatchEvent(new Event('input'));
      const hits = [...document.querySelectorAll('#d-body .rg-row')].map(tr => tr.textContent.toLowerCase());
      out.searched = hits.length > 0 && hits.every(t => t.indexOf('serverless') >= 0);
      q.value = ''; q.dispatchEvent(new Event('input'));
      const names = () => regionVisible().map(r => T(r.n));
      const ordered = (a, dir) => a.every((v, i) => !i || dir * a[i - 1].localeCompare(v, I18N.lang, { sensitivity: 'base', numeric: true }) <= 0);
      document.querySelector('#d-body .rg-sort[data-col="n"]').click();
      out.az = ordered(names(), 1) && document.querySelector('#d-body th[data-col="n"]').getAttribute('aria-sort') === 'ascending';
      document.querySelector('#d-body .rg-sort[data-col="n"]').click();
      out.za = ordered(names(), -1) && document.querySelector('#d-body th[data-col="n"]').getAttribute('aria-sort') === 'descending';
      document.querySelector('#d-body .rg-sort[data-col="avail"]').click();
      out.byAvail = ordered(regionVisible().map(r => T(RG_AVAIL[r.avail])), 1);
      const body = document.getElementById('d-body'); body.scrollTop = body.scrollHeight;
      const th = document.querySelector('#d-body thead th').getBoundingClientRect(), tools = document.querySelector('#d-body .rg-tools').getBoundingClientRect();
      out.sticky = th.top >= tools.bottom - 1 && th.top <= tools.bottom + 1 && tools.top <= body.getBoundingClientRect().top + 1;
      body.scrollTop = 0;
      return out;
    });
    check(cloud + ': the Available and Stage filters keep only the values ticked, Select all brings every row back, and a click outside closes them',
      ui.onlyYes && ui.allBack && ui.closed && ui.onlyGa, JSON.stringify(ui));
    check(cloud + ': search narrows to matches, and every column sorts A to Z, then Z to A', ui.searched && ui.az && ui.za && ui.byAvail, JSON.stringify(ui));
    check(cloud + ': the search row and the column headings stay in place while the table scrolls', ui.sticky, JSON.stringify(ui));
    const at = (sel) => page.evaluate((sel) => !!document.activeElement && document.activeElement.matches(sel), sel);
    const exp = () => page.evaluate(() => document.querySelector('#d-body .rg-filt[data-col="avail"]').getAttribute('aria-expanded'));
    await page.click('#d-body .rg-filt[data-col="avail"]');
    const kb = { opened: await at('#d-body .rg-pop input[data-all]'), exp1: await exp() };
    await page.keyboard.press('Space');
    kb.none = await page.evaluate(() => regionVisible().length);
    kb.kept = await at('#d-body .rg-pop input[data-all]');
    await page.keyboard.press('Space');
    kb.all = await page.evaluate(() => regionVisible().length === regionRowsNow.length);
    await page.keyboard.press('Escape');
    Object.assign(kb, await page.evaluate(() => ({ pop: !!document.querySelector('#d-body .rg-pop'), open: document.body.classList.contains('detail-open') })));
    kb.back = await at('#d-body .rg-filt[data-col="avail"]');
    kb.exp2 = await exp();
    check(cloud + ': from the keyboard, a filter list opens on its first box, keeps focus as boxes are ticked, and Escape closes only the list',
      kb.opened && kb.exp1 === 'true' && kb.none === 0 && kb.kept && kb.all && !kb.pop && kb.open && kb.back && kb.exp2 === 'false', JSON.stringify(kb));
    await page.focus('#d-body .rg-sort[data-col="st"]');
    await page.keyboard.press('Enter');
    const sk = { kept: await at('#d-body .rg-sort[data-col="st"]'), col: await page.evaluate(() => rgSort.col) };
    await page.keyboard.press('Escape');
    sk.open = await page.evaluate(() => document.body.classList.contains('detail-open'));
    check(cloud + ': sorting from the keyboard keeps focus on the heading, and Escape then closes the panel', sk.kept && sk.col === 'st' && !sk.open, JSON.stringify(sk));
    const menuOpen = await page.evaluate(() => document.getElementById('region-wrap').classList.contains('open'));
    if (!menuOpen) await page.click('#region-btn');
    await page.click('#region-menu button[data-region-all]');
    const closed = await page.evaluate(() => ({ open: document.body.classList.contains('detail-open'), panel: regionPanel, url: location.search,
      globe: !document.querySelector('#region-ico .rg-flag') && !!document.querySelector('#region-ico svg') }));
    check(cloud + ': All regions closes the panel, drops it from the address bar and puts the globe back on the Region button',
      !closed.open && !closed.panel && !/panel=region/.test(closed.url) && closed.globe, JSON.stringify(closed));
    await ctx.close();
  }
  check('every region on every cloud lists the same products and features', listOf.aws === listOf.azure && listOf.azure === listOf.gcp,
    Object.entries(listOf).map(([c, l]) => c + ':' + l.split('\n').length).join(' '));

  {
    const { ctx, page } = await open('?cloud=azure&region=qatarcentral&panel=region');
    const state = () => page.evaluate(() => ({ open: regionPanel, rows: regionVisible().map(r => r.n), st: rgPick.st && [...rgPick.st].sort(),
      avail: rgPick.avail && [...rgPick.avail].sort(), sort: rgSort, q: regionQ, search: location.search }));
    await page.evaluate(() => {
      const untick = (col, v) => { document.querySelector('#d-body .rg-filt[data-col="' + col + '"]').click();
        const i = document.querySelector('#d-body .rg-pop input[value="' + v + '"]'); i.checked = false; i.dispatchEvent(new Event('change')); document.body.click(); };
      untick('avail', 'no');
      untick('st', 'Public Preview');
      document.querySelector('#d-body .rg-sort[data-col="st"]').click();
      document.querySelector('#d-body .rg-sort[data-col="st"]').click();
      const q = document.querySelector('#d-body .rg-q'); q.value = 'model'; q.dispatchEvent(new Event('input'));
    });
    const sent = await state();
    const u = new URLSearchParams(sent.search);
    check('the address bar carries the region panel filters, sort and search',
      u.get('panel') === 'region' && (u.get('ravail') || '').split(',').sort().join() === (sent.avail || []).join() && u.get('rstage') !== null && u.get('rstage').split(',').indexOf('pubpre') < 0
      && u.get('rsort') === '-st' && u.get('rq') === 'model' && sent.rows.length > 0, sent.search);
    const again = await open(sent.search);
    const got = await again.page.evaluate(() => ({ open: regionPanel, rows: regionVisible().map(r => r.n), st: rgPick.st && [...rgPick.st].sort(),
      avail: rgPick.avail && [...rgPick.avail].sort(), sort: rgSort, q: regionQ, search: location.search,
      shown: document.querySelectorAll('#d-body .rg-row').length, field: (document.querySelector('#d-body .rg-q') || {}).value }));
    check('a copied link reopens the region panel with the same filters, sort, search and rows',
      got.open && JSON.stringify(got.rows) === JSON.stringify(sent.rows) && JSON.stringify([got.st, got.avail, got.sort, got.q]) === JSON.stringify([sent.st, sent.avail, sent.sort, sent.q])
      && got.shown === sent.rows.length && got.field === 'model' && got.search === sent.search, JSON.stringify({ sent: sent.search, got: got.search, rows: [sent.rows.length, got.rows.length] }));
    await page.evaluate(() => closeDrawer());
    const closed = await page.evaluate(() => location.search);
    check('closing the panel drops its filters from the address bar but keeps the region', !/[?&](panel|rstage|ravail|rsort|rq)=/.test(closed) && /region=qatarcentral/.test(closed), closed);
    await again.ctx.close();
    await ctx.close();
  }

  {
    const { ctx, page } = await open('?cloud=azure&region=qatarcentral&panel=region');
    const back = await page.evaluate(() => ({ open: regionPanel && document.body.classList.contains('detail-open'),
      title: document.getElementById('d-title').textContent, rows: regionRowsNow.length,
      serverless: (regionRowsNow.find(x => /^Serverless compute/.test(x.n)) || {}).avail,
      fm: regionRowsNow.find(x => x.n === 'Pay-per-token Foundation Model APIs') }));
    check('a copied link with panel=region reopens the region panel', back.open && back.title.indexOf('(qatarcentral)') >= 0 && back.rows > 0, back.title);
    check('azure Qatar Central: serverless compute reads No, and pay-per-token Foundation Model APIs needs cross-Geo processing in the Qatar Geo',
      back.serverless === 'no' && back.fm && back.fm.avail === 'cond' && back.fm.notes.indexOf('Geo: Qatar') >= 0
      && back.fm.notes.some(t => /cross-Geo processing/.test(t)), JSON.stringify(back.fm && back.fm.notes));
    const kept = await page.evaluate(async () => {
      const ind = INDUSTRY_CATALOG.find(r => r[0] !== 'generic')[0];
      await applyIndustry(ind, true);
      return { open: regionPanel && !!document.querySelector('#d-body .rg-table'), ind };
    });
    check('switching industry keeps the region panel open', kept.open, kept.ind);
    const boxed = await page.evaluate(() => {
      const id = Object.keys(byId).find(k => byId[k].tile && byId[k].tile.n === 'Unity Catalog');
      openDetail(id);
      return { panel: regionPanel, table: !!document.querySelector('#d-body .rg-table'), url: location.search };
    });
    check('opening a box replaces the region panel', !boxed.panel && !boxed.table && !/panel=region/.test(boxed.url), JSON.stringify(boxed));
    const swapped = await page.evaluate(() => { closeDrawer(); setRegion('qatarcentral'); openRegionPanel(); return regionPanel; });
    await page.click('#cloud-seg button:not(.on)').catch(async () => { await page.evaluate(() => { ARCH.cloud.provider = 'aws'; build(); refreshDrawer(); }); });
    const afterCloud = await page.evaluate(() => ({ panel: regionPanel, open: document.body.classList.contains('detail-open'), region: regionSel }));
    check('switching cloud closes the region panel and clears the region', swapped && !afterCloud.panel && !afterCloud.open && !afterCloud.region, JSON.stringify(afterCloud));
    await ctx.close();
  }
  {
    const { ctx, page } = await open('?cloud=gcp&lang=ar&region=asia-northeast1&panel=region');
    const ar = await page.evaluate(() => ({ dir: document.getElementById('d-body').getAttribute('dir'),
      heads: [...document.querySelectorAll('#d-body .rg-table th .rg-sort')].map(b => b.firstChild.textContent),
      want: ['Product or feature', 'Stage', 'Available', 'Notes'].map(s => T(s)) }));
    check('the panel reads right to left in Arabic with translated column headings',
      ar.dir === 'rtl' && ar.heads.join('|') === ar.want.join('|') && ar.heads.every(h => !/^[A-Za-z ]+$/.test(h)), JSON.stringify(ar));
    await ctx.close();
  }

  check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
  server.close();
  const failed = results.filter(r => !r.ok);
  console.log('\n' + (results.length - failed.length) + '/' + results.length + ' checks passed');
  process.exit(failed.length ? 1 : 0);
})();
