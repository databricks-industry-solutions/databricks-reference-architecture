#!/usr/bin/env node
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { serve, boardReady, withView, VIEWS, DECK_CHIP_PT, headChipRatio, deckChipAudit } = require('./lib_serve');

const LANGS = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'app', 'translations', 'manifest.json'), 'utf8')).languages.map(l => l.code);
const CLOUDS = ['azure', 'aws', 'gcp'];
const LIMITS = { centre: 1.5, gap: 2, dot: 3 };

function audit(L) {
  const out = [];
  const board = document.getElementById('board');
  const k = board.getBoundingClientRect().width / board.offsetWidth;
  const px = v => v / k;
  const rtl = document.documentElement.dataset.dir === 'rtl';
  const vis = e => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const edges = (e, withPad) => {
    const r = e.getBoundingClientRect(), cs = getComputedStyle(e), f = p => parseFloat(cs[p]) * k;
    const b = { top: r.top + f('borderTopWidth'), bottom: r.bottom - f('borderBottomWidth'), left: r.left + f('borderLeftWidth'), right: r.right - f('borderRightWidth') };
    return withPad ? { top: b.top + f('paddingTop'), bottom: b.bottom - f('paddingBottom'), left: b.left + f('paddingLeft'), right: b.right - f('paddingRight') } : b;
  };
  const union = rs => rs.length ? { top: Math.min(...rs.map(r => r.top)), bottom: Math.max(...rs.map(r => r.bottom)), left: Math.min(...rs.map(r => r.left)), right: Math.max(...rs.map(r => r.right)) } : null;
  const ink = els => union(els.filter(vis).map(e => e.getBoundingClientRect()));
  const textInk = lbl => union([...lbl.children].filter(c => !c.classList.contains('badge-dot') && vis(c)).flatMap(c => {
    const rg = document.createRange(); rg.selectNodeContents(c);
    return [...rg.getClientRects()].filter(r => r.width > 0 && r.height > 0);
  }));
  const pen = document.createElement('canvas').getContext('2d');
  const glyphInk = lbl => {
    const out = [], walk = document.createTreeWalker(lbl, NodeFilter.SHOW_TEXT);
    for (let n; (n = walk.nextNode());) {
      const el = n.parentElement;
      if (!n.textContent.trim() || el.closest('.badge-dot') || !vis(el)) continue;
      const cs = getComputedStyle(el);
      pen.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const m = pen.measureText(n.textContent);
      const up = (m.fontBoundingBoxAscent - m.actualBoundingBoxAscent) * k, down = (m.fontBoundingBoxDescent - m.actualBoundingBoxDescent) * k;
      const rg = document.createRange(); rg.selectNodeContents(n);
      [...rg.getClientRects()].filter(r => r.width > 0 && r.height > 0).forEach(r => out.push({ top: r.top + up, bottom: r.bottom - down, left: r.left, right: r.right }));
    }
    return out;
  };
  const label = e => (e.dataset.en || e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40);
  const zone = e => (e.className.match(/\b(b-[a-z]+|top|bot)\b/) || [, 'band'])[1];
  const title = (lbl, box) => {
    const t = textInk(lbl);
    if (!t) return;
    const c = edges(box), off = px((t.top + t.bottom) / 2 - (c.top + c.bottom) / 2);
    if (Math.abs(off) > L.centre) out.push(`${zone(box)}: title '${label(lbl)}' sits ${off.toFixed(1)}px off the middle of its box`);
    const lc = edges(lbl, true), lead = rtl ? px(lc.right - t.right) : px(t.left - lc.left);
    if (Math.abs(lead) > L.centre) out.push(`${zone(box)}: title '${label(lbl)}' starts ${lead.toFixed(1)}px in from its leading edge`);
  };
  const TILE = '.pcard, .fmt, .panel, .foot-chip, .mstage, .band-row.medallion .oi-lbl, .medal-arrow';
  document.querySelectorAll('.band').forEach(bd => {
    if (!vis(bd)) return;
    const c = edges(bd), lbl = bd.querySelector(':scope > .band-lbl:not(.band-rlbl)');
    if (!bd.closest('.arm')) {
      if (lbl) title(lbl, bd);
      const rl = bd.querySelector(':scope > .band-rlbl');
      if (rl) title(rl, bd);
      const t = ink([...bd.querySelectorAll(TILE)].filter(e => !e.parentElement.closest('.pcard, .panel, .fmt')));
      if (t) {
        const top = px(t.top - c.top), bot = px(c.bottom - t.bottom);
        if (Math.abs(top - bot) > L.gap) out.push(`${zone(bd)}: tiles sit ${top.toFixed(1)}px from the top and ${bot.toFixed(1)}px from the bottom`);
      }
      return;
    }
    const cards = [...bd.querySelectorAll('.band-row.cards > .pcard')].filter(vis).map(e => e.getBoundingClientRect());
    if (!lbl || !cards.length) return;
    const gaps = [px(cards[0].top - lbl.getBoundingClientRect().bottom)];
    for (let i = 1; i < cards.length; i++) gaps.push(px(cards[i].top - cards[i - 1].bottom));
    gaps.push(px(c.bottom - cards[cards.length - 1].bottom));
    if (Math.max(...gaps) - Math.min(...gaps) > L.gap) out.push(`${zone(bd)}: cards are spaced ${gaps.map(g => g.toFixed(1)).join(' / ')}px, not evenly`);
    const lc = edges(bd, true), t = textInk(lbl);
    if (!t) return;
    const lead = rtl ? px(lc.right - t.right) : px(t.left - lc.left);
    if (Math.abs(lead) > L.centre) out.push(`${zone(bd)}: title '${label(lbl)}' starts ${lead.toFixed(1)}px in from its leading edge`);
  });
  document.querySelectorAll('.band-row.medallion .medal-arrow').forEach(a => {
    const st = a.previousElementSibling, cyl = st && st.querySelector('svg');
    if (!vis(a) || !cyl || !vis(cyl)) return;
    const r = a.getBoundingClientRect(), s = cyl.getBoundingClientRect(), off = px((r.top + r.bottom) / 2 - (s.top + s.bottom) / 2);
    if (Math.abs(off) > L.centre) out.push(`b-infra: the medallion arrow after '${label(st)}' sits ${off.toFixed(1)}px off its cylinder's center line`);
  });
  document.querySelectorAll('.cloud').forEach(cl => {
    const lbl = cl.querySelector(':scope > .cloud-lbl');
    if (vis(cl) && lbl && getComputedStyle(cl).flexDirection === 'row') title(lbl, cl);
  });
  document.querySelectorAll('.band, .cloud').forEach(bx => {
    if (!vis(bx)) return;
    const c = edges(bx);
    bx.querySelectorAll('.badge-dot').forEach(d => {
      if (!vis(d)) return;
      const r = d.getBoundingClientRect();
      const room = px(Math.min(r.top - c.top, c.bottom - r.bottom, r.left - c.left, c.right - r.right));
      if (room < L.dot) out.push(`${zone(bx)}: a highlight dot on '${label(d.parentElement)}' is ${room.toFixed(1)}px from the box border`);
      const lbl = d.parentElement.closest('.band-lbl, .cloud-lbl');
      if (!lbl) return;
      const marks = [...lbl.querySelectorAll('svg')].filter(vis).map(s => s.getBoundingClientRect()).concat(glyphInk(lbl));
      if (marks.some(m => Math.min(r.right, m.right) - Math.max(r.left, m.left) > 0.5 && Math.min(r.bottom, m.bottom) - Math.max(r.top, m.top) > 0.5))
        out.push(`${zone(bx)}: a highlight dot on '${label(lbl)}' covers its title or icon`);
    });
  });
  document.querySelectorAll('.cloudwrap .ctile, .hband.top .ctile, .rtile').forEach(t => {
    if (!vis(t)) return;
    const body = ink([...t.children].filter(c => !c.classList.contains('badge-dot')));
    if (!body) return;
    const c = edges(t, true), off = px((body.top + body.bottom) / 2 - (c.top + c.bottom) / 2);
    const where = t.closest('.cloudwrap') ? 'cloud' : t.closest('.hband.top') ? 'top band' : 'rail';
    if (Math.abs(off) > L.centre) out.push(`${where}: '${label(t)}' sits ${off.toFixed(1)}px off the vertical middle of its tile`);
  });
  document.querySelectorAll('.panel.stack').forEach(pn => {
    const sizes = [...new Set([...pn.querySelectorAll('.tagpill')].filter(vis).map(e => getComputedStyle(e).fontSize))];
    const head = pn.querySelector('.ph-name');
    if (sizes.length > 1) out.push(`platform: the chips in '${head ? label(head) : 'a stacked panel'}' come in ${sizes.length} sizes (${sizes.join(', ')}), not one`);
  });
  const tb = document.getElementById('topband'), cb = document.getElementById('cloud');
  if (document.body.classList.contains('fitting') && tb && cb && vis(tb) && vis(cb)) {
    const a = tb.getBoundingClientRect(), b = cb.getBoundingClientRect();
    Object.entries({ width: b.width - a.width, height: b.height - a.height, 'left edge': b.left - a.left }).forEach(([what, d]) => {
      if (Math.abs(px(d)) > 0.5) out.push(`bands: the cloud band's ${what} is ${px(d).toFixed(1)}px off the Genie Agents band's`);
    });
    const la = tb.querySelector(':scope > .cloud-lbl'), lb = cb.querySelector(':scope > .cloud-lbl');
    const dw = la && lb ? px(lb.getBoundingClientRect().width - la.getBoundingClientRect().width) : 0;
    if (Math.abs(dw) > 0.5) out.push(`bands: the cloud band's label column is ${dw.toFixed(1)}px off the Genie Agents band's`);
  }
  return out;
}

const PLAT_STYLE = {
  '.plat-head': ['fontSize', 'minHeight'], '.ph-mark': ['width', 'height'],
  '.band:not(.b-work) > .band-lbl': ['flexBasis'], '.b-work > .band-lbl': ['flexBasis'], '.bl-name': ['fontSize', 'fontWeight', 'flexDirection'], '.bl-ic': ['width', 'height'],
  '.pcard': ['flexDirection', 'gap', 'paddingTop', 'paddingLeft'], '.pico': ['width', 'height'], '.pico svg': ['width', 'height'],
  '.p-name': ['fontSize', 'fontWeight'], '.panel.stack .ph-name': ['fontSize', 'fontWeight'], '.panel:not(.stack) .ph-name': ['fontSize', 'fontWeight'], '.pl-name': ['fontSize', 'fontWeight'],
  '.panel.stack .tagpill': ['fontSize'], '.panel:not(.stack) .tagpill': ['fontSize'],
  '.foot-chip': ['gap', 'paddingLeft'], '.foot-chip svg': ['width'], '.fc-name': ['fontSize'], '.oi-lbl': ['fontSize', 'flexBasis'],
  '.fmt': ['fontSize', 'paddingTop'], '.fmt-logo': ['height'], '.mstage': ['flexBasis'], '.mstage svg': ['width'], '.ms-n': ['fontSize'],
};
const PLAT_SCALED = new Set([
  '.band:not(.b-work) > .band-lbl flexBasis', '.bl-name fontSize', '.bl-ic width', '.bl-ic height', '.p-name fontSize', '.panel:not(.stack) .ph-name fontSize',
  '.pl-name fontSize', '.foot-chip svg width', '.fc-name fontSize', '.oi-lbl fontSize', '.oi-lbl flexBasis', '.fmt fontSize', '.ms-n fontSize',
]);
const DECK_OWN = new Set(['.panel.stack .tagpill fontSize', '.panel.stack .ph-name fontSize']);
function platSig(STYLE) {
  const vis = e => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const step = parseFloat(getComputedStyle(document.getElementById('platform')).getPropertyValue('--pk')) || 1;
  const roots = [...document.querySelectorAll('.plat-head, #plat-top, #platform')];
  const all = sel => roots.flatMap(r => (r.matches(sel) ? [r] : []).concat([...r.querySelectorAll(sel)])).filter(vis);
  const tiles = all('.atom').map(e => { const rec = byId[e.dataset.id]; return rec && rec.tile ? rec.tile.n || rec.tile.tag || '' : ''; }).filter(Boolean).sort();
  const style = {};
  Object.entries(STYLE).forEach(([sel, props]) => props.forEach(p => {
    const els = all(sel), vals = new Set(els.filter(e => p !== 'fontSize' || !e.style.fontSize).map(e => getComputedStyle(e)[p]));
    if (vals.size) style[`${sel} ${p}`] = [...vals].sort().join(' | ');
    else if (els.length) style[`${sel} ${p}`] = 'fitted';
  }));
  const board = document.querySelector('.board');
  const fit = [...board.querySelectorAll('[data-wfit]')].map(e => `${(e.textContent || '').trim().slice(0, 30)}@${e.style.fontSize}`).sort().join(', ');
  return { tiles, style, step, h: board.offsetHeight, fit, deck: ['deck-type', 'deck-chips'].some(c => document.body.classList.contains(c)) };
}
const LAYOUTS = { pptx: 'the PowerPoint layout of Simplified', pdf: 'the PDF layout of Simplified' };
function platDiff(key, s, d, mode) {
  const out = [], deck = !!mode;
  const where = LAYOUTS[mode] || 'Simplified on screen';
  const only = (a, b) => { const left = [...b]; return a.filter(x => { const i = left.indexOf(x); if (i < 0) return true; left.splice(i, 1); return false; }); };
  const lost = only(d.tiles, s.tiles), extra = only(s.tiles, d.tiles);
  if (lost.length) out.push(`[${key}] ${where} leaves out platform tiles Detailed shows: ${lost.join(', ')}`);
  if (extra.length) out.push(`[${key}] ${where} shows platform tiles Detailed does not: ${extra.join(', ')}`);
  if (d.step !== 1) out.push(`[${key}] the Detailed platform carries a type step of ${d.step}, not 1`);
  if (deck && !(s.step > 1)) out.push(`[${key}] ${where} carries no type step above Detailed (--pk reads ${s.step})`);
  if (!deck && s.step !== 1) out.push(`[${key}] ${where} carries a type step of ${s.step}; only the PowerPoint and PDF layouts may`);
  const scale = (v, f) => v.split(' | ').map(x => /^-?[\d.]+px$/.test(x) ? +(parseFloat(x) * f).toFixed(2) + 'px' : x).sort().join(' | ');
  const same = (a, b) => {
    const x = (a || '').split(' | '), y = (b || '').split(' | ');
    return x.length === y.length && x.every((v, i) => v === y[i] || (/px$/.test(v) && /px$/.test(y[i]) && Math.abs(parseFloat(v) - parseFloat(y[i])) <= 0.05));
  };
  new Set(Object.keys(s.style).concat(Object.keys(d.style))).forEach(k => {
    if ((mode && DECK_OWN.has(k)) || s.style[k] === 'fitted' || d.style[k] === 'fitted') return;
    const scaled = deck && PLAT_SCALED.has(k);
    const want = scaled && d.style[k] ? scale(d.style[k], s.step) : d.style[k];
    if (!same(s.style[k], want)) out.push(`[${key}] platform ${k} reads ${s.style[k] || 'nothing'} in ${where} and ${d.style[k] || 'nothing'} in Detailed${scaled ? `, which the ${s.step} step makes ${want}` : ''}`);
  });
  return out;
}

function panelAudit(L) {
  const out = [];
  const rtl = document.documentElement.dataset.dir === 'rtl';
  const arrows = [...document.querySelectorAll('.drawer .dl-go')].filter(g => g.getBoundingClientRect().width > 0);
  if (!arrows.length) return ['panel: the box panel opened with no link arrows to measure'];
  arrows.forEach(g => {
    const row = g.parentElement, r = g.getBoundingClientRect(), b = row.getBoundingClientRect(), cs = getComputedStyle(row), f = p => parseFloat(cs[p]);
    const room = rtl ? r.left - (b.left + f('borderLeftWidth') + f('paddingLeft')) : (b.right - f('borderRightWidth') - f('paddingRight')) - r.right;
    if (Math.abs(room) > L.centre) out.push(`panel: the link arrow on '${(row.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40)}' sits ${room.toFixed(1)}px short of the row's end`);
  });
  return out;
}

(async () => {
  const server = await serve();
  const base = 'http://127.0.0.1:' + server.address().port + '/index.html';
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await page.addInitScript(() => { try { localStorage.setItem('dbx-arch-tour-v1', '1'); } catch (e) {} });
  const errs = [], fails = [];
  page.on('pageerror', e => errs.push(e.message));
  let checked = 0;
  const sigs = {};
  const run = async (view, key) => {
    await page.waitForTimeout(250);
    await page.evaluate(() => fitBoard());
    const r = await page.evaluate(audit, LIMITS);
    const sig = (sigs[key] = sigs[key] || {});
    sig[view] = await page.evaluate(platSig, PLAT_STYLE);
    checked++;
    r.forEach(m => fails.push(`[${view} ${key}] ${m}`));
    if (view !== 'simple') return;
    const toggle = (kind, on) => page.evaluate(([kind, on]) => {
      if (typeof exportType !== 'function') return null;
      exportType(kind, on);
      return { on: document.body.classList.contains('deck-chips'), moving: document.getAnimations().filter(a => a instanceof CSSTransition).length };
    }, [kind, on]);
    const ratio = await page.evaluate(headChipRatio);
    for (const [kind, name] of [['pptx', 'PowerPoint'], ['pdf', 'PDF']]) {
      const tag = kind === 'pptx' ? 'deck' : kind;
      const into = await toggle(kind, true);
      if (!into || !into.on) {
        fails.push(`[${tag} ${key}] the board has no ${name} layout to measure`);
        continue;
      }
      if (into.moving) fails.push(`[${tag} ${key}] ${into.moving} transition(s) still run after switching to the ${name} layout, so it is measured mid-motion`);
      (await page.evaluate(audit, LIMITS)).forEach(m => fails.push(`[${tag} ${key}] ${m}`));
      (await page.evaluate(deckChipAudit, [DECK_CHIP_PT, kind, ratio])).forEach(m => fails.push(`[${tag} ${key}] ${m}`));
      sig[kind] = await page.evaluate(platSig, PLAT_STYLE);
      const out = await toggle(kind, false);
      if (out.moving) fails.push(`[${tag} ${key}] ${out.moving} transition(s) still run after switching back to the screen layout`);
      const back = await page.evaluate(platSig, PLAT_STYLE), was = sig[view];
      const moved = Object.keys({ ...was.style, ...back.style }).filter(k => was.style[k] !== back.style[k]).map(k => `${k} ${was.style[k]} -> ${back.style[k]}`);
      if (back.deck || back.h !== was.h || back.fit !== was.fit || moved.length)
        fails.push(`[${tag} ${key}] the screen does not return to its own layout after the ${name} layout: height ${was.h} -> ${back.h}${back.fit !== was.fit ? ', fitted names differ' : ''}${back.deck ? ', export class left on' : ''}${moved.length ? ', ' + moved.slice(0, 3).join('; ') : ''}`);
    }
  };
  for (const view of VIEWS) {
    await page.goto(withView(base, view), { waitUntil: 'networkidle' });
    await boardReady(page);
    const ids = await page.evaluate(() => ['generic'].concat(INDUSTRY_CATALOG.map(r => r[0]).filter(id => !INDUSTRY_BUILT || INDUSTRY_BUILT.has(id))));
    for (const id of ids) {
      const ok = await page.evaluate(async ({ id, view }) => {
        let ok = false;
        for (let a = 0; a < 3 && !ok; a++) { ok = await loadIndustry(id); if (!ok) await new Promise(r => setTimeout(r, 400)); }
        if (!ok) return false;
        viewMode = view;
        await applyIndustry(id, false);
        return document.body.classList.contains('view-simple') === (view === 'simple');
      }, { id, view });
      if (!ok) { fails.push(`[${view} ${id}] did not open in the ${view} view`); continue; }
      await run(view, id);
    }
    for (const cloud of CLOUDS) {
      await page.goto(withView(`${base}?cloud=${cloud}`, view), { waitUntil: 'networkidle' });
      await boardReady(page);
      await run(view, cloud);
    }
    const SHAPES = await page.evaluate(() => SHAPES.map(s => s.k));
    for (const shape of SHAPES) {
      await page.goto(withView(`${base}?shape=${shape}`, view), { waitUntil: 'networkidle' });
      await boardReady(page);
      await run(view, `shape ${shape}`);
    }
    for (const lang of LANGS) {
      await page.goto(withView(`${base}?lang=${lang}`, view), { waitUntil: 'networkidle' });
      await boardReady(page);
      await run(view, lang);
      if (view !== VIEWS[0]) continue;
      await page.click('.b-gov .pcard');
      await page.waitForFunction(() => document.body.classList.contains('detail-open'), null, { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(300);
      (await page.evaluate(panelAudit, LIMITS)).forEach(m => fails.push(`[${lang}] ${m}`));
    }
  }
  await browser.close();
  server.close();
  Object.entries(sigs).forEach(([key, v]) => {
    if (v.simple && v.detailed) fails.push(...platDiff(key, v.simple, v.detailed, ''));
    ['pptx', 'pdf'].forEach(mode => { if (v[mode] && v.detailed) fails.push(...platDiff(key, v[mode], v.detailed, mode)); });
  });
  console.log(`views: ${VIEWS.length}, boards, clouds, shapes and languages measured: ${checked}`);
  if (errs.length) fails.push(...errs.slice(0, 5).map(e => 'page error: ' + e));
  if (fails.length) { console.log(`\nFAIL (${fails.length})`); fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
  console.log('PASS: in every platform box the tiles sit midway between top and bottom, titles are centered and start at the leading edge, arm cards are evenly spaced, highlight dots clear the borders and never cover a title or its icon, every cloud, top-band and rail tile holds its content at its vertical middle, the cloud band is the size of the Genie Agents band, the medallion arrows ride their cylinders, the platform shows the same tiles, icons, type and spacing in both views on screen, the Genie and Agent Bricks chips of each panel share one size, the PowerPoint and PDF layouts of Simplified set the type one fixed step larger and those chips at 7pt inside their rectangles under a larger panel name, hold every check above and give the screen back unchanged, and panel link arrows end their rows in every language');
})().catch(e => { console.error(e); process.exit(2); });
