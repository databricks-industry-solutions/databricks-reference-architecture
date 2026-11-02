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
  const open = async (q) => {
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
    await ctx.addInitScript(() => { try { localStorage.setItem('dbx-arch-tour-v1', '1'); } catch (e) {} });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(withView(base + q, 'detailed'), { waitUntil: 'networkidle' });
    await boardReady(page);
    await page.waitForTimeout(500);
    return { ctx, page };
  };

  for (const cloud of ['aws', 'azure', 'gcp']) {
    const { ctx, page } = await open('?cloud=' + cloud);
    const atoms = await page.evaluate(() => {
      const out = { total: 0, docs: 0, bad: [] };
      Object.values(byId).forEach(e => {
        const t = e.tile;
        if (!t || !e.el || !e.el.isConnected) return;
        const d = STAGEDATA.products[t.n];
        const want = stageKey((d && d[curCloud()]) || cloudStage(t));
        if (!want && !e.el.dataset.stage) return;
        out.total++;
        if (d) out.docs++;
        if ((e.el.dataset.stage || '') !== want) out.bad.push(t.n + ' shows ' + e.el.dataset.stage + ', docs say ' + want);
      });
      return out;
    });
    check(cloud + ': every staged box carries its docs stage for the filter (' + atoms.docs + ' of ' + atoms.total + ' read from docs)', atoms.total > 0 && atoms.docs > 0 && !atoms.bad.length, atoms.bad.slice(0, 4).join(' | '));

    const words = /\b(GA|Public Preview|Private Preview|Beta|Coming soon)\b/;
    const board = await page.evaluate(() => ({ chips: document.querySelectorAll('.fc-stage, .d-stage').length,
      tags: [...document.querySelectorAll('.foot-chip, .atom')].filter(a => a.querySelector('.fc-stage')).length }));
    check(cloud + ': no box on the board carries a stage label', board.chips === 0 && board.tags === 0, JSON.stringify(board));
    for (const name of ['Genie App Builder', 'LTAP', 'Lakebase', 'Genie Ontology']) {
      const r = await page.evaluate((name) => {
        const id = Object.keys(byId).find(k => byId[k].tile && byId[k].tile.n === name && byId[k].el.isConnected);
        if (!id) return null;
        const chip = byId[id].el.textContent;
        openDetail(id);
        const head = document.querySelector('#drawer .d-head').textContent;
        const badge = !!document.querySelector('#drawer .d-stage, #d-stage');
        closeDrawer();
        return { chip, head, badge, staged: !!byId[id].el.dataset.stage };
      }, name);
      check(cloud + ': ' + name + ' shows no stage label on its box or in its panel, and still carries its stage for the filter',
        r && !r.badge && !words.test(r.chip) && !words.test(r.head) && r.staged, r && JSON.stringify({ badge: r.badge, chip: r.chip.slice(0, 40), staged: r.staged }));
    }

    const conn = await page.evaluate(() => {
      const groups = ['GA', 'Public Preview', 'Beta', 'Private Preview'];
      const shown = PLATDOCS.connectors.filter(c => groups.indexOf(cloudStage(c)) >= 0);
      const id = Object.keys(byId).find(k => byId[k].tile && byId[k].tile.n === 'Lakeflow Connect' && byId[k].el.isConnected);
      openDetail(id);
      const body = document.getElementById('d-body');
      const h = [...body.querySelectorAll('h4')].find(x => /Lakeflow Connect managed connectors/.test(x.textContent));
      const count = h ? (h.textContent.match(/\((\d+)\)/) || [])[1] : null;
      const names = [...body.querySelectorAll('.d-conns .d-conn-n')].map(x => x.textContent);
      const sorted = names.slice().sort((a, b) => a.localeCompare(b));
      const words = /\b(Generally available|Public Preview|Private Preview|Beta)\b/;
      const labels = [...body.querySelectorAll('h4, .d-note, .d-catlbl')].map(x => x.textContent).filter(x => words.test(x));
      const hrefs = [...body.querySelectorAll('.d-conns .d-conn')].map(a => a.getAttribute('href'));
      closeDrawer();
      return { count: Number(count), expect: shown.length, missing: shown.map(c => c.n).filter(n => names.indexOf(n) < 0),
               az: names.join('|') === sorted.join('|'), labels, offDocs: hrefs.filter(u => !isDatabricksUrl(u)).length, total: PLATDOCS.connectors.length };
    });
    check(cloud + ': the connector panel counts every connector available on this cloud (' + conn.expect + ' of ' + conn.total + ')', conn.count === conn.expect, conn.count);
    check(cloud + ': every available connector is listed', conn.missing.length === 0, conn.missing.slice(0, 5).join(', '));
    check(cloud + ': connectors list A to Z with no stage heading', conn.az && conn.labels.length === 0, JSON.stringify({ az: conn.az, labels: conn.labels }));
    check(cloud + ': every connector links to the Databricks docs', conn.offDocs === 0, conn.offDocs);
    await ctx.close();
  }

  {
    const { ctx, page } = await open('?cloud=gcp');
    const r = await page.evaluate(() => {
      const group = ARCH.rails.cons.groups[0];
      const probe = { n: 'Lakehouse//RT', ic: 'gauge' };
      group.tiles.push(probe);
      build();
      const e = Object.values(byId).find(x => x.tile === probe);
      const out = { docs: STAGEDATA.products['Lakehouse//RT'].gcp, rendered: !!(e && e.el.isConnected),
                    attr: e ? (e.el.dataset.stage || '') : null, stage: stageFor(probe) };
      group.tiles.pop();
      build();
      return out;
    });
    check('a box that only shares a product name gets no stage from the docs (docs say ' + r.docs + ')', r.rendered && r.docs && r.attr === '' && r.stage === '', JSON.stringify(r));
    await ctx.close();
  }

  {
    const { ctx, page } = await open('?cloud=aws');
    const r = await page.evaluate(() => {
      const atomOf = n => Object.values(byId).find(e => e.tile && e.tile.n === n && e.el.isConnected);
      const saved = JSON.parse(JSON.stringify(STAGEDATA));
      const out = {};
      STAGEDATA.products['Genie One'].aws = 'Beta';
      build();
      out.docsWins = atomOf('Genie One').el.dataset.stage;
      STAGEDATA = null;
      build();
      out.fallbackGenieOne = atomOf('Genie One').el.dataset.stage;
      out.fallbackLakewatch = atomOf('Lakewatch').el.dataset.stage;
      ARCH.cloud.provider = 'gcp';
      build();
      out.fallbackLtapGcp = atomOf('LTAP').el.dataset.stage;
      out.fallbackBuilderGcp = atomOf('Genie App Builder').el.dataset.stage;
      ARCH.cloud.provider = 'aws';
      STAGEDATA = saved;
      build();
      out.restored = atomOf('Genie One').el.dataset.stage;
      return out;
    });
    check('a docs stage overrides the stage typed on the board', r.docsWins === 'beta', r.docsWins);
    check('without docs data the typed stage still applies', r.fallbackGenieOne === 'ga' && r.fallbackLakewatch === 'privpre', r.fallbackGenieOne + ' / ' + r.fallbackLakewatch);
    check('the typed per-cloud fallback matches the docs for LTAP and Genie App Builder on GCP', r.fallbackLtapGcp === 'soon' && r.fallbackBuilderGcp === 'soon', r.fallbackLtapGcp + ' / ' + r.fallbackBuilderGcp);
    check('restoring the docs data restores the docs stage', r.restored === 'ga', r.restored);

    const credit = await page.evaluate(() => ({ corner: document.getElementById('credit').textContent, docked: document.getElementById('d-credit').textContent, cover: creditText() }));
    check('the corner credit carries no date', credit.corner === '\u00a9 Databricks Industry Solutions' && !/\d{4}/.test(credit.docked), credit.corner + ' | ' + credit.docked);
    check('the PDF and deck covers read the same undated credit', credit.cover === '\u00a9 Databricks Industry Solutions', credit.cover);
    const note = await page.evaluate(() => {
      paintStageMenu();
      const n = [...document.querySelectorAll('#stage-menu .dl-note')].map(x => x.textContent).find(t => /last updated/i.test(t)) || '';
      const want = [REGIONS.generated, ACADEMY.generated, STAGEDATA.generated].filter(Boolean).sort().pop();
      return { n, want, stages: STAGEDATA.generated };
    });
    check('the stage menu dates the data it filters by, release stages included', note.n.endsWith(note.want) && note.want >= note.stages, note.n);
    await ctx.close();
  }

  check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
  server.close();
  const failed = results.filter(r => !r.ok);
  console.log('\n' + (results.length - failed.length) + '/' + results.length + ' checks passed');
  process.exit(failed.length ? 1 : 0);
})();
