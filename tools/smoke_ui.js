#!/usr/bin/env node
'use strict';
const { chromium } = require('playwright');
const { serve, boardReady } = require('./lib_serve');

const results = [];
function check(name, cond, detail) { results.push({ name, ok: !!cond, detail }); console.log((cond ? 'PASS ' : 'FAIL ') + name + (detail ? ' :: ' + detail : '')); }
const sleep = ms => new Promise(r => setTimeout(r, ms));

const MENUS = [['#ind-btn', 'ind-wrap'], ['#region-btn', 'region-wrap'], ['#stage-btn', 'stage-wrap'], ['#hl-btn', 'hl-wrap'],
  ['#dl-btn', 'dl-wrap'], ['#share-btn', 'share-wrap'], ['#opt-btn', 'opt-wrap']];
const openMenus = page => page.evaluate(() => [...document.querySelectorAll('.pal-wrap.open, .dl-wrap.open')].map(w => w.id));

(async () => {
  const server = await serve();
  const base = 'http://127.0.0.1:' + server.address().port + '/index.html';
  const browser = await chromium.launch();
  const errors = [];
  const open = async (q, ctxOpts) => {
    const ctx = await browser.newContext(Object.assign({ viewport: { width: 1600, height: 1000 } }, ctxOpts || {}));
    await ctx.addInitScript(() => { try { localStorage.setItem('dbx-arch-tour-v1', '1'); } catch (e) {} });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(base + q, { waitUntil: 'networkidle' });
    await boardReady(page);
    return { ctx, page };
  };

  {
    const { ctx, page } = await open('?industry=banking');
    check('the header has no AI link', await page.evaluate(() => !document.getElementById('ai-link')));
    const wrong = [];
    for (const [btn, wrap] of MENUS) {
      await page.click(btn);
      const now = await openMenus(page);
      if (now.length !== 1 || now[0] !== wrap) wrong.push(btn + ' -> [' + now.join(',') + ']');
    }
    check('opening a menu closes the one already open, across all ' + MENUS.length + ' menus', wrong.length === 0, wrong.join(' | '));
    await page.click('#region-btn');
    await page.click('#region-q');
    const kept = await openMenus(page);
    await page.click('#stage-btn');
    const swapped = await openMenus(page);
    check('a click inside the region menu keeps it open, and the stage menu then replaces it',
      kept.join() === 'region-wrap' && swapped.join() === 'stage-wrap', JSON.stringify({ kept, swapped }));
    await page.click('#stage-btn');
    check('the same button closes its menu', (await openMenus(page)).length === 0);
    await page.click('#hl-btn');
    await page.mouse.click(8, 990);
    check('a click outside closes the open menu', (await openMenus(page)).length === 0);
    await ctx.close();
  }

  {
    const { ctx, page } = await open('?industry=banking');
    await page.click('#opt-btn');
    await page.click('#side-btn');
    const docked = await page.evaluate(() => ({ docked: document.body.classList.contains('docked'), open: document.getElementById('opt-wrap').classList.contains('open') }));
    await page.click('#opt-btn');
    const ticked = await page.evaluate(() => document.getElementById('side-btn').classList.contains('on'));
    await page.click('#opt-btn');
    const picks = {};
    for (const [k, btn, read] of [['palette', '#pal-menu [data-pal="mono"]', () => document.body.classList.contains('pal-mono')],
      ['shape', '#shape-menu [data-shape="t"]', () => document.body.classList.contains('shape-t')],
      ['language', '#lang-menu [data-lang="de"]', () => I18N.lang === 'de']]) {
      await page.click('#opt-btn');
      await page.click(btn);
      await page.waitForFunction(read, null, { timeout: 15000 }).catch(() => {});
      picks[k] = { applied: await page.evaluate(read), open: await page.evaluate(() => document.getElementById('opt-wrap').classList.contains('open')) };
    }
    await page.click('#share-btn');
    await page.click('#share-menu button[data-share="copy"]');
    await sleep(300);
    const tipNow = () => page.evaluate(() => {
      const t = document.getElementById('share-flash'), b = document.getElementById('share-btn').getBoundingClientRect(), r = t.getBoundingClientRect();
      return { text: t.textContent, shown: r.width > 0 && r.height > 0, below: r.top >= b.bottom, live: t.getAttribute('aria-live'), btn: document.getElementById('share-btn').textContent.trim() };
    });
    const tip = await tipNow();
    const flash = { lbl: tip.shown && tip.below && tip.live === 'polite' && !tip.btn ? tip.text : JSON.stringify(tip),
      open: await page.evaluate(() => document.getElementById('share-wrap').classList.contains('open')) };
    await sleep(1500);
    const gone = await tipNow();
    check('the Link copied note shows under the Share icon without changing the button, and clears itself', !gone.text && !gone.shown, JSON.stringify(gone));
    await page.click('#opt-btn');
    await page.click('#tour-btn');
    await page.waitForSelector('.tour-pop');
    const tour = await page.evaluate(() => !document.getElementById('opt-wrap').classList.contains('open'));
    check('each Options row acts and closes the menu: the dock docks the panel and shows its tick, a palette, a shape and a language apply, the tour starts; Copy link shows Link copied under the Share icon',
      docked.docked && !docked.open && ticked && Object.values(picks).every(p => p.applied && !p.open) && flash.lbl === 'Link copied' && !flash.open && tour,
      JSON.stringify({ docked, ticked, picks, flash, tour }));
    await ctx.close();
  }

  for (const vp of [{ width: 1600, height: 1000 }, { width: 1280, height: 800 }]) {
    const { ctx, page } = await open('?industry=banking', { viewport: vp });
    await page.click('#opt-btn');
    const m = await page.evaluate(() => {
      const el = document.getElementById('opt-menu'), r = el.getBoundingClientRect();
      const rows = sel => new Set([...document.querySelectorAll(sel)].map(b => Math.round(b.getBoundingClientRect().top))).size;
      const lang = document.querySelectorAll('#lang-menu button').length;
      return { scroll: el.scrollHeight - el.clientHeight, bottom: Math.round(r.bottom), vh: innerHeight, lang, langRows: rows('#lang-menu button'),
        shapeRows: rows('#shape-menu button'), palRows: rows('#pal-menu button'), groups: document.querySelectorAll('#pal-menu .men-sub').length };
    });
    check(`at ${vp.width}x${vp.height} the Options menu fits the window without scrolling: languages in two columns, each palette group on one row, the four shapes on one row`,
      m.scroll <= 0 && m.bottom <= m.vh && m.langRows === Math.ceil(m.lang / 2) && m.palRows === m.groups && m.shapeRows === 1, JSON.stringify(m));
    await ctx.close();
  }

  {
    const { ctx, page } = await open('?industry=banking&theme=light');
    const ico = () => page.evaluate(() => { const s = document.querySelector('#theme-ico > svg'); return s ? s.innerHTML : ''; });
    const light = await ico();
    await page.click('#theme-btn');
    const dark = await ico();
    const isDark = await page.evaluate(() => document.body.classList.contains('theme-dark'));
    check('the theme button draws a moon in light and a sun in dark', !!light && !!dark && light !== dark && isDark && /<path/.test(light) && /<circle/.test(dark), JSON.stringify({ light: light.slice(0, 30), dark: dark.slice(0, 30), isDark }));
    await ctx.close();
  }

  {
    const { ctx, page } = await open('?cloud=azure');
    const size = () => page.evaluate(() => ({ fit: document.body.dataset.fit, h: document.querySelector('.board').offsetHeight }));
    const fresh = await size();
    const seen = [];
    for (let i = 0; i < 2; i++) for (const v of ['Detailed', 'Simplified']) {
      await page.click(`#view-seg button:has-text("${v}")`);
      await sleep(500);
      const s = await size(), t = await page.evaluate(() => { fitBoard(); return { fit: document.body.dataset.fit, h: document.querySelector('.board').offsetHeight }; });
      seen.push(v[0] + ':' + s.fit + '/' + s.h + (s.fit === t.fit && s.h === t.h ? '' : ' (refit ' + t.fit + '/' + t.h + ')'));
    }
    const back = await size();
    check('switching to Detailed and back to Simplified re-fits the board each time, back to the scale and height of a fresh load',
      seen.every(s => !/refit/.test(s)) && back.fit === fresh.fit && back.h === fresh.h, 'fresh ' + fresh.fit + '/' + fresh.h + ' | ' + seen.join(' | '));
    await ctx.close();
  }

  {
    const { ctx, page } = await open('?industry=banking&hl=story&theme=dark');
    const look = await page.evaluate(() => {
      const cs = id => getComputedStyle(document.getElementById(id));
      const brand = getComputedStyle(document.body).getPropertyValue('--brand').trim();
      const probe = document.createElement('i'); probe.style.color = brand; document.body.appendChild(probe);
      const brandRgb = getComputedStyle(probe).color; probe.remove();
      return { on: document.getElementById('hl-btn').classList.contains('on'), bg: cs('hl-btn').backgroundColor, idle: cs('dl-btn').backgroundColor,
        border: cs('hl-btn').borderTopColor, brand: brandRgb };
    });
    check('an active icon button keeps its own background and shows a brand ring instead of a red fill',
      look.on && look.bg === look.idle && look.border === look.brand, JSON.stringify(look));
    await ctx.close();
  }

  {
    const { ctx, page } = await open('?industry=banking');
    await page.evaluate(() => window.__startArchTour());
    await page.waitForSelector('.tour-pop');
    const total = await page.evaluate(() => parseInt(document.querySelector('.tour-step').textContent.split('/')[1], 10));
    check('the tour has at most 10 steps', total > 0 && total <= 10, String(total));
    const style = await page.evaluate(() => {
      const cs = s => getComputedStyle(document.querySelector(s));
      return { hole: cs('.tour-hole').transitionDuration, pop: cs('.tour-pop').transitionDuration,
        skip: cs('.tour-skip').backgroundColor, skipBorder: cs('.tour-skip').borderTopStyle, next: cs('.tour-btn.accent').backgroundColor };
    });
    check('the spotlight and the panel glide between steps', /[1-9]/.test(style.hole) && /[1-9]/.test(style.pop), style.hole + ' / ' + style.pop);
    check('Skip is a visible button, quieter than Next',
      style.skip !== 'rgba(0, 0, 0, 0)' && style.skipBorder !== 'none' && style.skip !== style.next, JSON.stringify(style));
    const path = [];
    for (let i = 0; i < total; i++) {
      await sleep(900);
      path.push(await page.evaluate(() => { const h = document.querySelector('.tour-hole').getBoundingClientRect();
        return { n: document.querySelector('.tour-step').textContent.trim(), cx: Math.round(h.left + h.width / 2), cy: Math.round(h.top + h.height / 2) }; }));
      if (i === 1) {
        const h4 = await page.evaluateHandle(() => document.querySelector('.tour-pop h4'));
        await page.evaluate(() => window.dispatchEvent(new Event('resize')));
        check('a resize moves the tour panel without rebuilding it', await page.evaluate(h => h.isConnected, h4));
      }
      if (i < total - 1) await page.click('.tour-btn.accent');
    }
    check('every step finds its target', path.every((p, i) => p.n === (i + 1) + ' / ' + total), path.map(p => p.n).join(','));
    let turns = 0, dir = 0;
    for (let i = 1; i < path.length; i++) {
      const dx = path[i].cx - path[i - 1].cx;
      if (Math.abs(dx) < 40) continue;
      const d = Math.sign(dx);
      if (dir && d !== dir) turns++;
      dir = d;
    }
    check('the spotlight turns back across the page at most twice', turns <= 2, turns + ' turns over x ' + path.map(p => p.cx).join(','));
    const head = await page.evaluate(() => document.querySelector('header.top').getBoundingClientRect().bottom);
    let tail = [];
    for (let i = path.length - 1; i >= 0 && path[i].cy < head; i--) tail.unshift(path[i].cx);
    check('the toolbar steps glide one way, right to left', tail.length >= 3 && tail.every((x, i) => i === 0 || x < tail[i - 1]), tail.join(','));
    await page.click('.tour-skip');
    check('Skip ends the tour', await page.evaluate(() => !document.querySelector('.tour-pop')));
    await ctx.close();
  }

  {
    const { ctx, page } = await open('?industry=banking');
    await page.evaluate(() => window.__startArchTour());
    await page.waitForSelector('.tour-pop');
    const title = () => page.evaluate(() => (document.querySelector('.tour-pop h4') || {}).textContent || '');
    for (let i = 0; i < 10 && (await title()) !== 'Highlights on every box'; i++) { await page.click('.tour-btn.accent'); await sleep(300); }
    await sleep(900);
    const hl = await page.evaluate(() => {
      const h = document.querySelector('.tour-hole').getBoundingClientRect(), boxes = [...document.querySelectorAll('#plat-top .atom, #platform .atom')];
      const dots = el => el.querySelectorAll(':scope > .badge-dot[data-hl]').length;
      const box = boxes.find(el => { const b = el.getBoundingClientRect(); return b.width && Math.abs(b.left - h.left - 6) < 2 && Math.abs(b.top - h.top - 6) < 2; });
      return { id: box ? box.dataset.id : '', dots: box ? dots(box) : 0, most: Math.max(...boxes.map(dots)), x: h.left + h.width / 2, y: h.top + h.height / 2,
        body: document.querySelector('.tour-pop p').textContent };
    });
    check('the tour has a step that spotlights a platform box with the most highlights and asks you to click it',
      !!hl.id && hl.dots > 0 && hl.dots === hl.most && /Click this box/.test(hl.body), JSON.stringify(hl));
    await page.mouse.click(hl.x, hl.y);
    await sleep(800);
    const after = await page.evaluate(() => ({ title: (document.querySelector('.tour-pop h4') || {}).textContent || '', open: openId, drawer: document.body.classList.contains('detail-open') }));
    check('clicking that box keeps the tour going and opens its panel', after.title === 'Details for every box' && after.open === hl.id && after.drawer, JSON.stringify(after));
    if (await page.$('.tour-skip')) await page.click('.tour-skip');
    await ctx.close();
  }

  {
    const { ctx, page } = await open('?industry=banking', { reducedMotion: 'reduce' });
    await page.evaluate(() => window.__startArchTour());
    await page.waitForSelector('.tour-pop');
    const d = await page.evaluate(() => getComputedStyle(document.querySelector('.tour-hole')).transitionDuration);
    check('reduced motion moves the tour without gliding', !/[1-9]/.test(d), d);
    await ctx.close();
  }

  {
    const { ctx, page } = await open('?industry=banking&box=Lakebase');
    const pos = await page.evaluate(() => { const bb = document.getElementById('ind-btn').getBoundingClientRect(); return [bb.left + bb.width / 2, bb.top + bb.height / 2]; });
    const onTop = await page.evaluate(([x, y]) => { const btn = document.getElementById('ind-btn'), top = document.elementFromPoint(x, y); return top === btn || btn.contains(top); }, pos);
    const below = await page.evaluate(() => document.querySelector('.drawer').getBoundingClientRect().top >= document.querySelector('header.top').getBoundingClientRect().bottom - 1);
    await page.mouse.click(pos[0], pos[1]);
    const opened = await page.evaluate(() => ({ menu: document.getElementById('ind-wrap').classList.contains('open'), panel: document.body.classList.contains('detail-open') }));
    if (opened.menu) await page.click('#ind-menu >> text=Retail');
    await page.waitForTimeout(800);
    const switched = await page.evaluate(() => ARCH.industry);
    check('with a box panel open the toolbar stays on top: the industry picker opens on the first click and switches the board',
      onTop && below && opened.menu && opened.panel && switched === 'retail', JSON.stringify({ onTop, below, opened, switched }));
    await page.goto(base + '?industry=banking&box=Lakebase', { waitUntil: 'networkidle' });
    await boardReady(page);
    await page.mouse.click(300, 700);
    check('clicking the dimmed board still closes the panel', !(await page.evaluate(() => document.body.classList.contains('detail-open'))));
    await ctx.close();
  }

  check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
  server.close();
  const failed = results.filter(r => !r.ok);
  console.log('\n' + (results.length - failed.length) + '/' + results.length + ' checks passed');
  process.exit(failed.length ? 1 : 0);
})();
