#!/usr/bin/env node
'use strict';
const { chromium } = require('playwright');
const { serve, boardReady } = require('./lib_serve');

const BOARDS = ['generic', 'banking'];
const EXEMPT = [
  ['svg text, tspan', 'a logo keeps its brand colours (CLAUDE.md 4b)'],
  ['.p-caps i', 'the dividers between capabilities are decoration, not text'],
  [':disabled', 'an inactive control is exempt from the contrast minimum'],
];

const results = [];
function check(name, cond, detail) { results.push({ name, ok: !!cond, detail }); console.log((cond ? 'PASS ' : 'FAIL ') + name + (detail ? ' :: ' + detail : '')); }

function measure(rootSel, exempt) {
  const rgba = s => { const m = String(s).match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; };
  const over = (top, bot) => [0, 1, 2].map(i => top[i] * top[3] + bot[i] * (1 - top[3])).concat([1]);
  const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const lum = c => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const bgOf = el => {
    const stack = [];
    for (let e = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.backgroundImage && cs.backgroundImage !== 'none' && !/url\(/.test(cs.backgroundImage)) return null;
      const c = rgba(cs.backgroundColor);
      if (c && c[3] > 0) { stack.push(c); if (c[3] >= 1) break; }
    }
    let acc = [255, 255, 255, 1];
    for (let i = stack.length - 1; i >= 0; i--) acc = over(stack[i], acc);
    return acc;
  };
  const out = { n: 0, unknown: [], fails: [] };
  for (const root of document.querySelectorAll(rootSel)) {
    for (const el of root.querySelectorAll('*')) {
      if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
      if (exempt.some(sel => el.matches(sel))) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      let op = 1; for (let e = el; e; e = e.parentElement) op *= +getComputedStyle(e).opacity;
      if (op < 0.9) continue;
      const fg = rgba(cs.color), bg = bgOf(el);
      if (!fg) continue;
      const tag = el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
      if (!bg) { out.unknown.push(tag); continue; }
      out.n++;
      const px = parseFloat(cs.fontSize), w = +cs.fontWeight;
      const bar = (px >= 24 || (px >= 18.66 && w >= 700)) ? 3 : 4.5;
      const k = ratio(over(fg, bg), bg);
      if (k < bar) out.fails.push(tag + ' "' + el.textContent.trim().slice(0, 24) + '" ' + k.toFixed(2) + '<' + bar);
    }
  }
  return out;
}

function deckInks() {
  const bg = expBg(), bad = [];
  const need = (what, a, b, min) => { const k = contrastHex(a, b); if (k < min) bad.push(what + ' ' + k.toFixed(2)); };
  need('brand text on the page', expBrandText(), bg, 4.5);
  need('kicker on the brand fill', onRoleInk(expBrandFill()), expBrandFill(), 4.5);
  for (const r of DECK_ROLES) {
    need('ink on role ' + r, onRoleInk(r), r, 4.5);
    need('chip text on role ' + r + ' tint', deckRoleInk(r, 0.28), deckTint(r), 4.5);
    need('card text on role ' + r + ' tint', deckRoleInk(r, 0.30), deckTint(r), 4.5);
    need('section title in role ' + r, readableHex(r, bg, 3), bg, 3);
    need('eyebrow in role ' + r, readableHex(r, bg), bg, 4.5);
  }
  need('who pill text', readableHex(mixHex(expBrand(), expInk(), 0.25), deckTint(expBrand())), deckTint(expBrand()), 4.5);
  return bad;
}

(async () => {
  const server = await serve();
  const base = 'http://127.0.0.1:' + server.address().port + '/index.html';
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 2036, height: 1300 } });
  await page.addInitScript(() => { try { localStorage.setItem('dbx-arch-tour-v1', '1'); } catch (e) {} });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(base, { waitUntil: 'networkidle' });
  await boardReady(page);
  await page.evaluate(src => { window.__measure = eval('(' + src + ')'); }, measure.toString());
  const exempt = EXEMPT.map(e => e[0]);
  EXEMPT.forEach(([sel, why]) => console.log('exempt ' + sel + ': ' + why));
  const pals = await page.evaluate(() => PALETTES.filter(p => !p.hd).map(p => p.k));
  check('every palette in the menu is measured', pals.length >= 13, pals.join(','));
  const set = (id, pal, dark, view) => page.evaluate(async ([id, pal, dark, view]) => {
    closeDrawer();
    await applyIndustry(id, false);
    applyPalette(pal, false); applyTheme(dark, false);
    viewMode = view; build(); fitBoard();
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  }, [id, pal, dark, view]);
  const run = (sel) => page.evaluate(([sel, ex]) => window.__measure(sel, ex), [sel, exempt]);
  const tally = {};
  const note = (what, o) => { const t = tally[what] || (tally[what] = { n: 0, fails: new Set(), unknown: new Set() }); t.n += o.n; o.fails.forEach(f => t.fails.add(f)); o.unknown.forEach(u => t.unknown.add(u)); };
  for (const dark of [false, true]) for (const pal of pals) {
    const tag = (pal || 'spectrum') + '/' + (dark ? 'dark' : 'light');
    for (const id of BOARDS) for (const view of ['simple', 'detailed']) {
      await set(id, pal, dark, view);
      const o = await run('header, #board');
      o.fails = o.fails.map(f => tag + ' ' + id + ' ' + view + ' ' + f);
      note('board and toolbar', o);
    }
    await set('banking', pal, dark, 'simple');
    for (const wrap of ['ind-wrap', 'region-wrap', 'dl-wrap', 'share-wrap', 'opt-wrap']) {
      const o = await page.evaluate(([w, ex]) => { const el = document.getElementById(w); if (!el) return { n: 0, fails: ['missing #' + w], unknown: [] };
        if (w === 'share-wrap') buildShareMenu();
        el.classList.add('open'); const r = window.__measure('#' + w, ex); el.classList.remove('open'); return r; }, [wrap, exempt]);
      o.fails = o.fails.map(f => tag + ' ' + f);
      note('toolbar menus', o);
    }
    await page.evaluate(() => { const a = document.querySelector('#board .atom[data-id]'); openDetail(a.dataset.id); });
    await page.waitForTimeout(80);
    { const o = await run('#drawer'); o.fails = o.fails.map(f => tag + ' ' + f); note('details panel', o); }
    await page.evaluate(() => closeDrawer());
    { const o = await page.evaluate(ex => { const tip = document.getElementById('tip');
        tip.innerHTML = '<div class="tip-name">' + svg('dot', '') + 'Unity Catalog</div><ul><li>Governs every table</li></ul><div class="tip-hint">Click for full detail</div>';
        tip.style.transition = 'none'; tip.classList.add('show'); const r = window.__measure('#tip', ex);
        tip.classList.remove('show'); tip.style.transition = ''; return r; }, exempt);
      o.fails = o.fails.map(f => tag + ' ' + f); note('tooltips', o); }
    { const o = await page.evaluate(ex => { const t = document.getElementById('share-flash'); if (!t) return { n: 0, fails: ['missing #share-flash'], unknown: [] };
        t.textContent = 'Link copied'; const r = window.__measure('#share-flash', ex); t.textContent = ''; return r; }, exempt);
      o.fails = o.fails.map(f => tag + ' ' + f); note('tooltips', o); }
    await page.click('#region-btn');
    await page.click('#region-menu button[data-region]');
    await page.waitForTimeout(120);
    { const o = await run('#drawer'); o.fails = o.fails.map(f => tag + ' ' + f); note('region panel', o); }
    await page.evaluate(() => closeDrawer());
    await page.click('#region-btn');
    await page.click('#region-menu button[data-region-all]');
    await page.click('#opt-btn');
    await page.click('#tour-btn');
    await page.waitForSelector('.tour-pop', { timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(450);
    { const o = await run('.tour-pop'); o.fails = o.fails.map(f => tag + ' ' + f); note('tour', o); }
    await page.keyboard.press('Escape');
    await page.evaluate(() => { const s = document.querySelector('.tour-skip'); if (s) s.click(); });
    const bad = await page.evaluate(deckInks.toString().replace(/^function deckInks\(\) \{/, '(() => {') + ')()');
    if (bad.length) note('deck, PPTX and PDF text', { n: 0, fails: bad.map(b => tag + ' ' + b), unknown: [] });
    else note('deck, PPTX and PDF text', { n: 1, fails: [], unknown: [] });
  }
  for (const [what, t] of Object.entries(tally)) {
    const f = [...t.fails];
    check(what + ': every text clears WCAG AA on its own background in every palette and theme (' + t.n + ' measured)', t.n > 0 && !f.length, f.slice(0, 8).join(' | ') + (f.length > 8 ? ' (+' + (f.length - 8) + ')' : ''));
    const u = [...t.unknown];
    check(what + ': no text sits on a gradient the gate cannot measure', !u.length, u.slice(0, 6).join(', '));
  }
  check('no page errors', !errors.length, errors.slice(0, 3).join(' | '));
  await browser.close();
  server.close();
  const failed = results.filter(r => !r.ok);
  console.log((failed.length ? 'FAIL ' : 'PASS ') + (results.length - failed.length) + '/' + results.length);
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
