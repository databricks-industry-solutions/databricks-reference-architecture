#!/usr/bin/env node
'use strict';
const { chromium } = require('playwright');
const { serve, boardReady, withView, VIEWS } = require('./lib_serve');

const CLOUDS = ['azure', 'aws', 'gcp'];
const SHOW_ROLES = ['storage', 'identity', 'govcat', 'aisvc', 'bi', 'etl', 'streaming'];
const HIDE_ROLES = ['cicd', 'observability', 'opdb'];
const MUST_SHOW = ['bi', 'aisvc', 'storage', 'identity', 'govcat'];

function snapshot({ cloud, display }) {
  ARCH.cloud.provider = cloud;
  displayMode = display;
  build();
  const seen = new Map();
  Object.values(byId).forEach(x => {
    if (!x.tile || !x.el || !x.el.isConnected || !x.el.getClientRects().length) return;
    const nm = x.el.querySelector('.t-name, .ct-name, .p-name');
    if (!seen.has(x.tile)) seen.set(x.tile, (nm ? nm.textContent : x.el.textContent).trim());
  });
  const core = [], leads = [], bad = [];
  ['src', 'ing', 'ppl', 'cons'].forEach(r => (ARCH.rails[r].groups || []).forEach(g => {
    const shown = t => seen.has(t) || (display === 'category' && g.tiles.some(o => o !== t && seen.get(o) === displayName(t)));
    (g.tiles || []).forEach((t, i) => {
      if ('core' in t && t.core !== true) bad.push(`${g.box} › ${t.n} has core: ${JSON.stringify(t.core)}, not true`);
      if (t.core === true) core.push({ rail: r, group: g.box, n: t.n, shown: shown(t) });
      if (i === 0) leads.push({ rail: r, group: g.box, n: t.n, shown: shown(t) });
    });
  }));
  const prov = ARCH.cloud.providers[cloud];
  const cloudTiles = PROVIDER_TILE_KEYS.flatMap(k => prov[k] || []).concat(ARCH.cloud.extras || [])
    .map(t => ({ n: t.n, role: t.role || '', pinned: t.core === true || t.hl === true, shown: seen.has(t), label: seen.get(t) || '' }));
  return { simple: simpleView(), core, leads, bad, cloudTiles };
}

(async () => {
  const server = await serve();
  const base = 'http://127.0.0.1:' + server.address().port + '/index.html';
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await page.addInitScript(() => { try { localStorage.setItem('dbx-arch-tour-v1', '1'); } catch (e) {} });
  const errs = [], fails = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto(withView(base, 'detailed'), { waitUntil: 'networkidle' });
  await boardReady(page);
  const ids = await page.evaluate(() => ['generic'].concat(INDUSTRY_CATALOG.map(r => r[0]).filter(id => !INDUSTRY_BUILT || INDUSTRY_BUILT.has(id))));
  let checked = 0, coreTotal = 0;
  for (const id of ids) {
    const ok = await page.evaluate(async id => {
      for (let a = 0; a < 3; a++) { if (await loadIndustry(id)) return true; await new Promise(r => setTimeout(r, 400)); }
      return false;
    }, id);
    if (!ok) { fails.push(`${id}: the board did not load`); continue; }
    const take = async (view, cloud, display) => {
      await page.evaluate(async ({ id, view }) => { viewMode = view; await applyIndustry(id, false); }, { id, view });
      const s = await page.evaluate(snapshot, { cloud, display });
      checked++;
      const at = `[${view} ${cloud} ${display}] ${id}`;
      if (s.simple !== (view === 'simple')) { fails.push(`${at}: did not open in the ${view} view`); return null; }
      s.bad.forEach(m => fails.push(`${at}: ${m}`));
      s.core.filter(t => !t.shown).forEach(t => fails.push(`${at}: core tile '${t.n}' in ${t.group} is not on the board`));
      if (view === 'simple') s.leads.filter(t => !t.shown).forEach(t => fails.push(`${at}: '${t.n}', the first tile of ${t.group}, is not on the board`));
      return s;
    };
    for (const view of VIEWS) await take(view, CLOUDS[0], 'commercial');
    for (const cloud of CLOUDS) {
      const snap = {};
      for (const view of VIEWS) snap[view] = await take(view, cloud, 'category');
      if (!snap.simple || !snap.detailed) continue;
      coreTotal += snap.simple.core.length;
      const d = new Map(snap.detailed.cloudTiles.map(t => [t.n, t]));
      snap.simple.cloudTiles.forEach(t => {
        const at = `[${cloud}] ${id}`;
        const det = d.get(t.n);
        if (HIDE_ROLES.includes(t.role) && !(det && det.shown)) fails.push(`${at}: '${t.n}' (${t.role}) is missing from Detailed`);
        if (t.pinned) return;
        if (SHOW_ROLES.includes(t.role) && det && det.shown && !t.shown) fails.push(`${at}: '${t.n}' (${t.role}) shows in Detailed but not in Simplified`);
        if ((HIDE_ROLES.includes(t.role) || !t.role) && t.shown) fails.push(`${at}: '${t.n}' (${t.role || 'no role'}) shows in Simplified, which keeps only fundamentals`);
      });
      MUST_SHOW.forEach(role => {
        if (!snap.simple.cloudTiles.some(t => t.role === role && t.shown)) fails.push(`[simple ${cloud}] ${id}: no ${role} tile from the cloud is on the board`);
      });
      if (!snap.simple.cloudTiles.some(t => t.n === 'Anthropic / OpenAI' && t.shown)) fails.push(`[simple ${cloud}] ${id}: Anthropic / OpenAI is not on the board`);
      const net = snap.simple.cloudTiles.filter(t => t.role === 'network' && t.shown);
      if (net.length !== 1 || net[0].label !== 'Compute') fails.push(`[simple ${cloud}] ${id}: compute shows as ${JSON.stringify(net.map(t => t.label))}, not one tile named Compute`);
      ['Serverless Compute', 'Classic Compute'].forEach(n => {
        const t = snap.detailed.cloudTiles.find(x => x.n === n);
        if (!t || !t.shown || t.label !== n) fails.push(`[detailed ${cloud}] ${id}: ${n} is not shown under its own name (${t ? JSON.stringify(t.label) : 'absent'})`);
      });
    }
  }
  await browser.close();
  server.close();
  console.log(`boards: ${ids.length}, clouds: ${CLOUDS.length}, views: ${VIEWS.length}, board renders checked: ${checked}, core tiles checked per view: ${coreTotal}`);
  if (errs.length) fails.push(...errs.slice(0, 5).map(e => 'page error: ' + e));
  if (fails.length) { console.log(`\nFAIL (${fails.length})`); fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
  console.log('PASS: on every board and cloud, Simplified shows every core tile (by name when Branded, by its category when Categorized) and the first tile of every group, the cloud BI tool, model providers with Anthropic / OpenAI, storage, identity, catalog, ETL and streaming, one Compute tile, and no CI/CD, monitoring, operational store or orchestrator; Detailed keeps every tile and both compute planes under their own names');
})().catch(e => { console.error(e); process.exit(2); });
