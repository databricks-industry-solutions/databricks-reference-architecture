#!/usr/bin/env node
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { serve, boardReady, withView } = require('./lib_serve');

const LOGO_DIR = path.join(__dirname, '..', 'app', 'resources', 'logos');
const CLOUDS = ['aws', 'azure', 'gcp'];
const UNSAFE = /<(image|script|foreignObject)\b|\bhref="(https?:|data:|javascript:)|\son[a-z]+=/i;

const results = [];
function check(name, cond, detail) { results.push({ name, ok: !!cond, detail }); console.log((cond ? 'PASS ' : 'FAIL ') + name + (detail ? ' :: ' + detail : '')); }

function audit() {
  const set = LOGO_SETS[curCloud()] || { tiles: {}, art: {} };
  const label = document.querySelector('#cloud .cloud-lbl');
  const wrong = [], missing = [], marksMissing = [];
  let logos = 0, plated = 0;
  const backdrop = s => [...s.children].some(c => c.tagName === 'rect' && +c.getAttribute('width') >= 40 && /^#fff(fff)?$|^white$/i.test(c.getAttribute('fill') || ''));
  for (const el of document.querySelectorAll('.atom')) {
    const rec = byId[el.dataset.id], t = rec && rec.tile;
    if (!t) continue;
    const icons = [...el.querySelectorAll('svg')].filter(s => s.closest('.atom') === el && !s.closest('.zx, .badge-dot, .addbtn'));
    const own = icons.filter(s => s.classList.contains('tile-logo'));
    const want = !!set.tiles[t.n] && !shownByCategory(t) && !PRODUCT_MARKS[t.mark || t.n] && !t.fmt && !t.brand;
    if (own.length) { logos++; plated += own.filter(backdrop).length; }
    if (want && !own.length && icons.length) missing.push(t.n);
    if (!want && own.length) wrong.push(t.n);
    if (icons.length && !t.fmt && !t.brand && PRODUCT_MARKS[t.mark || t.n] && !icons.some(s => s.classList.contains('mark'))) marksMissing.push(t.n);
  }
  const prov = document.querySelector('#cloud .cloud-logo svg.provlogo');
  const inked = prov && prov.querySelector('[style*="--logo-ink"]');
  const leftOf = !!(prov && label) && prov.getBoundingClientRect().right <= label.getBoundingClientRect().left + 1;
  return { cloud: curCloud(), provLabel: prov ? prov.getAttribute('aria-label') : null, chip: !!(label && label.querySelector('.provchip')), leftOf,
    provPlated: prov ? backdrop(prov) : null, provInk: inked ? getComputedStyle(inked).fill : null, logos, plated,
    missing: [...new Set(missing)], wrong: [...new Set(wrong)], marksMissing: [...new Set(marksMissing)] };
}

function lum(rgb) {
  const m = String(rgb).match(/[\d.]+/g); if (!m) return null;
  const f = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(+m[0]) + 0.7152 * f(+m[1]) + 0.0722 * f(+m[2]);
}

function hexLum(h) {
  if (h === 'black') return 0;
  const x = h.replace('#', ''); const s = x.length === 3 ? x.split('').map(c => c + c).join('') : x.slice(0, 6);
  return lum('rgb(' + [0, 2, 4].map(i => parseInt(s.slice(i, i + 2), 16)).join(',') + ')');
}

function strayInk(svg) {
  const open = svg.replace(/<(defs|mask|clipPath|pattern)\b[\s\S]*?<\/\1>/g, '');
  return [...open.matchAll(/(?:fill|stroke)(?:="|\s*:\s*)(black|#[0-9a-f]{3}(?:[0-9a-f]{3})?)\b/gi)].map(m => m[1].toLowerCase())
    .filter(c => { const x = c === 'black' ? '000' : c.slice(1); const s = x.length === 3 ? x.split('').map(q => q + q).join('') : x;
      const v = [0, 2, 4].map(i => parseInt(s.slice(i, i + 2), 16) / 255); return hexLum(c) < 0.2 && Math.max(...v) - Math.min(...v) < 0.15; });
}

(async () => {
  for (const cloud of CLOUDS) {
    const b = JSON.parse(fs.readFileSync(path.join(LOGO_DIR, cloud + '.json'), 'utf8'));
    const dangling = Object.entries(b.tiles).filter(([, k]) => !b.art[k]).map(([n]) => n);
    const unused = Object.keys(b.art).filter(k => !Object.values(b.tiles).includes(k));
    const unsourced = Object.keys(b.art).filter(k => !b.src || !b.src[k]);
    const unsafe = Object.keys(b.art).filter(k => UNSAFE.test(b.art[k]));
    check(cloud + ' bundle: every tile points at artwork, every artwork is used and names its source',
      !dangling.length && !unused.length && !unsourced.length, JSON.stringify({ dangling, unused, unsourced }));
    check(cloud + ' bundle: no artwork carries an external reference or a script', !unsafe.length, unsafe.join(', '));
    const dark = Object.keys(b.art).filter(k => strayInk(b.art[k]).length);
    check(cloud + ' bundle: near-black ink follows the theme, so a transparent icon still reads in dark mode', !dark.length, dark.join(', '));
  }
  {
    const html = fs.readFileSync(path.join(__dirname, '..', 'app', 'index.html'), 'utf8');
    const block = (html.match(/const CLOUD_LOGOS = (\{[\s\S]*?\n\});/) || [, '{}'])[1];
    const logos = JSON.parse(block.replace(/,\s*\}$/, '}'));
    const dark = Object.keys(logos).filter(k => strayInk(logos[k].g).length);
    check('cloud logos: near-black ink follows the theme', Object.keys(logos).length === 3 && !dark.length, dark.join(', ') || Object.keys(logos).join(','));
  }

  const server = await serve();
  const base = 'http://127.0.0.1:' + server.address().port + '/index.html';
  const browser = await chromium.launch();
  const errors = [];
  const open = async (q, dark) => {
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, colorScheme: dark ? 'dark' : 'light' });
    await ctx.addInitScript(() => { try { localStorage.setItem('dbx-arch-tour-v1', '1'); } catch (e) {} });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(withView(base + q, 'detailed'), { waitUntil: 'networkidle' });
    await boardReady(page);
    if (dark) await page.evaluate(() => applyTheme(true, false));
    await page.waitForTimeout(300);
    return { ctx, page };
  };
  const labels = { aws: 'AWS', azure: 'Azure', gcp: 'GCP' };

  for (const cloud of CLOUDS) {
    for (const [q, label] of [['?cloud=' + cloud, 'generic board'], ['?industry=banking&display=branded&cloud=' + cloud, 'banking, branded'],
                              ['?industry=banking&display=category&cloud=' + cloud, 'banking, categorized']]) {
      const { ctx, page } = await open(q);
      const r = await page.evaluate(audit);
      const tag = cloud + ', ' + label;
      check(tag + ': the bottom band leads with the ' + labels[cloud] + ' logo on its left, transparent, with no text chip',
        r.provLabel === labels[cloud] && !r.chip && r.provPlated === false && r.leftOf, JSON.stringify({ prov: r.provLabel, chip: r.chip, plated: r.provPlated, leftOf: r.leftOf }));
      check(tag + ': every cloud tile that shows its own name shows its official icon', !r.missing.length, r.missing.join(', '));
      check(tag + ': no tile outside the cloud set, and no tile showing a category, carries a logo', !r.wrong.length, r.wrong.join(', '));
      check(tag + ': every Databricks box with an official mark shows it', !r.marksMissing.length, r.marksMissing.join(', '));
      check(tag + ': logos drawn, all transparent', r.logos > 0 && r.plated === 0, 'logos=' + r.logos + ' plated=' + r.plated);
      await ctx.close();
    }
  }

  for (const dark of [false, true]) {
    const { ctx, page } = await open('?industry=banking&display=branded&cloud=aws', dark);
    const r = await page.evaluate(audit);
    const l = r.provInk ? lum(r.provInk) : null;
    check((dark ? 'dark' : 'light') + ' theme: the AWS wordmark takes the board logo ink, ' + (dark ? 'light' : 'dark') + ', and the logos stay transparent',
      r.logos > 0 && r.plated === 0 && l !== null && (dark ? l > 0.5 : l < 0.05), 'ink=' + r.provInk + ' lum=' + (l === null ? 'n/a' : l.toFixed(3)) + ' logos=' + r.logos);
    await ctx.close();
  }

  {
    const { ctx, page } = await open('?cloud=aws');
    const before = await page.evaluate(() => Object.keys(LOGO_SETS));
    await page.click('#cloud-seg button:has-text("Azure")');
    await page.waitForFunction(() => !!LOGO_SETS.azure && document.querySelectorAll('svg.tile-logo').length > 0 && curCloud() === 'azure', null, { timeout: 8000 }).catch(() => {});
    const r = await page.evaluate(audit);
    check('a cloud switch loads only that cloud\'s icons, then draws them', before.join() === 'aws' && r.cloud === 'azure' && r.provLabel === 'Azure' && !r.missing.length && r.logos > 0,
      JSON.stringify({ before, cloud: r.cloud, prov: r.provLabel, missing: r.missing, logos: r.logos }));
    const doc = await page.evaluate(() => exportHtmlDoc());
    const frozen = JSON.parse((doc.match(/<script type="application\/json" id="frozen-resources">([\s\S]*?)<\/script>/) || [, '{}'])[1]);
    check('the offline HTML export freezes the logo sets it has loaded', frozen.logos && frozen.logos.azure && frozen.logos.aws, Object.keys(frozen.logos || {}).join(','));
    await ctx.close();
    const file = path.join(os.tmpdir(), 'verify_logos_export.html');
    fs.writeFileSync(file, doc);
    const op = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    op.on('pageerror', e => errors.push('offline: ' + e.message));
    op.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|Fetch API cannot load file:/.test(m.text())) errors.push('offline: ' + m.text()); });
    await op.goto('file://' + file, { waitUntil: 'load' });
    await boardReady(op);
    await op.waitForTimeout(800);
    const o = await op.evaluate(() => ({ logos: document.querySelectorAll('svg.tile-logo').length, prov: !!document.querySelector('#cloud svg.provlogo'), cloud: curCloud() }));
    check('the exported file, opened from disk where no resource can be fetched, draws the cloud logos', o.logos > 0 && o.prov, JSON.stringify(o));
    await op.close();
    fs.unlinkSync(file);
  }

  check('no page or console errors, so every icon path parses', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
  server.close();
  const failed = results.filter(r => !r.ok);
  console.log((failed.length ? 'FAIL ' : 'PASS ') + (results.length - failed.length) + '/' + results.length);
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
