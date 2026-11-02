#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { chromium } = require('playwright');
const { serve, boardReady, APP_ROOT } = require('./lib_serve');
const AS = require(path.join(APP_ROOT, 'arch_schema.js'));

const CHECK = process.argv.includes('--check');
const ONLY = ((process.argv.find(a => a.startsWith('--only=')) || '').slice(7)).split(',').filter(Boolean);
const PAGES = Math.max(1, +((process.argv.find(a => a.startsWith('--pages=')) || '').slice(8)) || 3);
const RAILS = ['src', 'ing', 'cons', 'ppl'];
const YKEY = { src: 'sources', ing: 'cloud_integrations', ppl: 'pipelines', cons: 'consumers' };
const ARCH_DIR = path.join(APP_ROOT, 'architectures');
const INDEX = path.join(APP_ROOT, 'index.html');

const IN_PAGE = () => {
  const SHAPES = ['z', 's', 't', 'rt'], CLOUDS = ['aws', 'azure', 'gcp'];
  const CLIP = '.t-name,.p-name,.bl-name,.rg-label,.pcard .p-cap,.t-cap';
  window.__fill = {
    async open(id){
      viewMode = 'simple';
      await applyIndustry(id, false);
      for(const rid of Object.keys(ARCH.rails)) for(const g of ARCH.rails[rid].groups) delete g.simple;
      for(const c of CLOUDS) await loadLogos(c);
      return Object.fromEntries(Object.keys(ARCH.rails).map(rid => [rid, ARCH.rails[rid].groups.map(g => ({
        box: g.box, own: g.tiles.length, shown: cappedRailEntries(rid, g).length, all: railGroupEntries(g).length,
        cap: SIMPLE_RAIL_CAP[rid] || 0, tiles: g.tiles.map(t => ({ n: t.n, cat: t.cat || '' }))
      }))]));
    },
    set(rid, gi, n){
      const g = ARCH.rails[rid].groups[gi];
      if(n) g.simple = n; else delete g.simple;
      return cappedRailEntries(rid, g).length;
    },
    measure(){
      const out = {};
      for(const c of CLOUDS){
        ARCH.cloud.provider = c;
        for(const s of SHAPES){
          applyShape(s, false);
          document.body.getBoundingClientRect();
          let clip = 0;
          document.querySelectorAll(CLIP).forEach(n => { if(n.scrollWidth > n.clientWidth + 1) clip++; });
          out[c + '@' + s] = { h: document.getElementById('board').offsetHeight, clip };
        }
      }
      return out;
    }
  };
};

const DETAILED_ONLY = /orchestrat|schedul|observab|monitoring platform|application monitoring|\bAPM\b|CI\/CD|devops|source control|version control/i;
const WRITEBACK = /writeback|write-back|operational stores?/i;

function fits(now, base){
  return Object.keys(base).every(k => now[k].h <= base[k].h && now[k].clip <= base[k].clip);
}

async function openPage(browser, port, lang){
  const page = await browser.newPage({ viewport: { width: 1728, height: 1080 }, deviceScaleFactor: 1 });
  await page.goto('http://127.0.0.1:' + port + '/index.html?lang=' + lang, { waitUntil: 'load' });
  await boardReady(page);
  await page.evaluate(IN_PAGE);
  return page;
}

async function fillBoard(pair, id){
  const [en, de] = pair;
  const groups = await en.evaluate(id => window.__fill.open(id), id);
  await de.evaluate(id => window.__fill.open(id), id);
  const base = { en: await en.evaluate(() => window.__fill.measure()), de: await de.evaluate(() => window.__fill.measure()) };
  const cur = {}, done = new Set();
  const slots = [];
  for(const rid of RAILS) (groups[rid] || []).forEach((g, gi) => { if(g.cap && g.shown < g.all && !WRITEBACK.test(g.box)) slots.push([rid, gi]); else done.add(rid + gi); });
  let progress = true;
  while(progress){
    progress = false;
    for(const [rid, gi] of slots){
      const key = rid + gi;
      if(done.has(key)) continue;
      const g = groups[rid][gi];
      const from = cur[key] || g.cap;
      let n = from, shown = g.shown;
      while(shown <= g.shown && n < g.own){ n++; shown = await en.evaluate(([r, i, k]) => window.__fill.set(r, i, k), [rid, gi, n]); }
      const reveals = g.tiles[n - 1];
      if(shown <= g.shown || DETAILED_ONLY.test(reveals.cat)){ await en.evaluate(([r, i, k]) => window.__fill.set(r, i, k), [rid, gi, cur[key] || 0]); done.add(key); continue; }
      await de.evaluate(([r, i, k]) => window.__fill.set(r, i, k), [rid, gi, n]);
      let ok = fits(await en.evaluate(() => window.__fill.measure()), base.en);
      if(ok) ok = fits(await de.evaluate(() => window.__fill.measure()), base.de);
      if(ok){ cur[key] = n; g.shown = shown; progress = true; }
      else {
        for(const p of pair) await p.evaluate(([r, i, k]) => window.__fill.set(r, i, k), [rid, gi, cur[key] || 0]);
        done.add(key);
      }
    }
  }
  const res = {}, added = [];
  for(const rid of RAILS) (groups[rid] || []).forEach((g, gi) => {
    const n = cur[rid + gi];
    if(!n) return;
    (res[rid] = res[rid] || {})[g.box] = n;
    added.push(g.box + ': ' + g.tiles.slice(g.cap, n).map(t => t.n).join(', '));
  });
  return { res, added };
}

function recorded(id){
  const out = {};
  if(id === 'generic'){
    const src = fs.readFileSync(INDEX, 'utf8');
    for(const m of src.matchAll(/\{ box:"([^"]+)", ic:"[^"]+", simple:(\d+)/g)) out[m[1]] = +m[2];
    return out;
  }
  const y = yaml.load(fs.readFileSync(path.join(ARCH_DIR, id + '.yaml'), 'utf8'));
  for(const rid of RAILS) for(const g of (y[YKEY[rid]] || [])) if(g.simplified) out[g.name] = g.simplified;
  return out;
}

function flat(res){ const o = {}; for(const rid in res) Object.assign(o, res[rid]); return o; }

function writeYaml(id, res){
  const fp = path.join(ARCH_DIR, id + '.yaml');
  const before = fs.readFileSync(fp, 'utf8');
  const lines = before.split('\n');
  const want = {};
  for(const rid of RAILS) want[YKEY[rid]] = (res[rid] || {});
  const out = [];
  let section = null, group = null;
  for(const line of lines){
    const top = /^([a-z_]+):\s*$/.exec(line);
    if(top){ section = top[1]; group = null; }
    const gm = /^  - name: (.*)$/.exec(line);
    if(gm && want[section]) group = yaml.load(gm[1]);
    if(want[section] && group != null && /^    simplified: /.test(line)) continue;
    if(want[section] && group != null && /^    tiles:/.test(line) && want[section][group]) out.push('    simplified: ' + want[section][group]);
    out.push(line);
  }
  const after = out.join('\n');
  const a = AS.toTerse(yaml.load(before)), b = AS.toTerse(yaml.load(after));
  for(const rid of RAILS) (b.rails[rid] || []).forEach((g, i) => {
    const expect = (res[rid] || {})[g.box];
    if((g.simple || 0) !== (expect || 0)) throw new Error(id + ': ' + g.box + ' wrote ' + g.simple + ', wanted ' + expect);
    delete g.simple; delete a.rails[rid][i].simple;
  });
  if(JSON.stringify(a) !== JSON.stringify(b)) throw new Error(id + ': the edit changed more than the Simplified counts');
  if(after !== before) fs.writeFileSync(fp, after);
}

function writeIndex(res){
  let src = fs.readFileSync(INDEX, 'utf8');
  const want = flat(res);
  src = src.replace(/(\{ box:"([^"]+)", ic:"[^"]+")(, simple:\d+)?/g, (m, head, box) => head + (want[box] ? ', simple:' + want[box] : ''));
  fs.writeFileSync(INDEX, src);
}

(async () => {
  const ids = ONLY.length ? ONLY : ['generic'].concat(fs.readdirSync(ARCH_DIR).filter(f => f.endsWith('.yaml')).map(f => f.slice(0, -5)).sort());
  const server = await serve();
  const port = server.address().port;
  const browser = await chromium.launch();
  const pairs = [];
  for(let i = 0; i < Math.min(PAGES, ids.length); i++) pairs.push([await openPage(browser, port, 'en'), await openPage(browser, port, 'de')]);
  const results = {};
  let next = 0;
  await Promise.all(pairs.map(async pair => {
    while(next < ids.length){
      const id = ids[next++];
      const t = Date.now();
      const { res, added } = await fillBoard(pair, id);
      results[id] = res;
      console.log('  ' + id.padEnd(30) + ' ' + String(added.length).padStart(2) + ' group(s) take more tiles  ' + Math.round((Date.now() - t) / 1000) + 's');
      if(!CHECK) added.forEach(a => console.log('      + ' + a));
    }
  }));
  await browser.close();
  server.close();
  const drift = [];
  for(const id of ids){
    const want = flat(results[id]), have = recorded(id);
    for(const box of new Set([...Object.keys(want), ...Object.keys(have)]))
      if((want[box] || 0) !== (have[box] || 0)) drift.push(id + ': ' + box + ' records ' + (have[box] || 'the default') + ', the free space fits ' + (want[box] || 'the default'));
  }
  if(CHECK){
    if(drift.length){ console.log('FAIL: ' + drift.length + ' Simplified count(s) differ from the free space:\n  ' + drift.join('\n  ') + '\nRun node tools/fill_simple.js to record them.'); process.exit(1); }
    console.log('PASS: every Simplified count fills the free space of its board, ' + ids.length + ' board(s).');
    return;
  }
  for(const id of ids){ if(id === 'generic') writeIndex(results[id]); else writeYaml(id, results[id]); }
  console.log('Wrote the Simplified counts of ' + ids.length + ' board(s); ' + drift.length + ' count(s) changed.');
})().catch(e => { console.error(e); process.exit(1); });
