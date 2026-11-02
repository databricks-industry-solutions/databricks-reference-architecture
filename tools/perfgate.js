'use strict';
const { chromium } = require('playwright');
const { serve } = require('./lib_serve');

const PAINT_ALLOWED = new Set(['flowdash', 'flowdashv', 'flowdashl', 'flowdashu', 'zdash']);
const COMPOSITED = new Set(['transform', 'opacity']);
const SHAPES = ['z', 's', 't', 'rt'];
const R = [];
const ok = (n, c, d) => { R.push({ n, c: !!c }); console.log((c ? 'PASS ' : 'FAIL ') + n + (d ? ' :: ' + d : '')); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const inventory = page => page.evaluate(() => document.getAnimations()
  .filter(a => a.playState === 'running')
  .map(a => ({
    name: a.animationName || '',
    iterations: a.effect.getTiming().iterations,
    duration: a.effect.getTiming().duration,
    props: [...new Set(a.effect.getKeyframes().flatMap(k => Object.keys(k)
      .filter(p => !['offset', 'easing', 'composite', 'computedOffset'].includes(p))))],
  })));

async function open(browser, url, opts = {}) {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 1728, height: 993 } }, opts.ctx || {}));
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.addInitScript(o => {
    if (!o.tour) try { localStorage.setItem('dbx-arch-tour-v1', '1'); } catch (e) {}
    if (o.lang) try { localStorage.setItem('dbxarch.lang', o.lang); } catch (e) {}
    window.__firstBuild = null;
    window.__nav = [];
    window.__intro = [];
    new MutationObserver(ms => {
      ms.forEach(m => { if (m.type === 'attributes' && m.target.id === 'nav-progress')
        window.__nav.push({ on: m.target.classList.contains('on'), t: performance.now() }); });
      if (!window.__firstBuild && document.querySelector('#platform .atom'))
        window.__firstBuild = { lang: document.documentElement.getAttribute('lang') };
    }).observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    new MutationObserver(() => {
      const s = document.body && document.body.dataset.intro, last = window.__intro[window.__intro.length - 1];
      if (s && (!last || last.s !== s)) window.__intro.push({ s, t: performance.now() });
    }).observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-intro'] });
  }, { lang: opts.lang || null, tour: !!opts.tour });
  if (opts.clock) await page.clock.install();
  if (opts.rtt) {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: opts.rtt, downloadThroughput: 20 * 125000, uploadThroughput: 5 * 125000 });
  }
  await page.goto(url, { waitUntil: opts.until || 'networkidle' });
  return { ctx, page, errs };
}

const introState = page => page.evaluate(() => document.body.dataset.intro || null);
const introRun = page => page.waitForFunction(() => document.body.dataset.intro === 'run', null, { timeout: 15000 });
const introDone = page => page.waitForFunction(() => document.body.dataset.intro === 'done', null, { timeout: 15000 });
const introSpan = page => page.evaluate(() => {
  const l = window.__intro, end = l.length - 1;
  return l[end] && l[end].s === 'done' && l[end - 1] && l[end - 1].s === 'run' ? Math.round(l[end].t - l[end - 1].t) : null;
});
const introResidue = page => page.evaluate(() => ({
  ix: document.querySelectorAll('.ix').length,
  vars: [...document.querySelectorAll('[style]')].filter(el => /--ix|--vx|--vy|--sw/.test(el.getAttribute('style'))).length,
  cls: ['intro-run', 'booting'].filter(c => document.body.classList.contains(c)),
  running: document.getAnimations().filter(a => /^ix/.test(a.animationName || '')).length,
}));
const clean = r => !r.ix && !r.vars && !r.cls.length && !r.running;
const finiteRunning = page => page.evaluate(() => document.getAnimations()
  .filter(a => a instanceof CSSAnimation && Number.isFinite(a.effect.getTiming().iterations) && a.playState === 'running')
  .map(a => a.animationName));

(async () => {
  const server = await serve();
  const base = 'http://127.0.0.1:' + server.address().port + '/index.html';
  const browser = await chromium.launch({ headless: true });
  const errs = [];

  {
    const { ctx, page, errs: e } = await open(browser, base + '?industry=banking');
    await sleep(800);
    const inv = await inventory(page);
    const bad = inv.filter(a => a.iterations === Infinity && !PAINT_ALLOWED.has(a.name) && !a.props.every(p => COMPOSITED.has(p)));
    ok('no endless animation repaints outside the allowlist', bad.length === 0, bad.map(a => a.name + '[' + a.props.join('+') + ']').join(', '));
    const nav = await page.evaluate(() => ({ on: document.getElementById('nav-progress').classList.contains('on'),
      running: document.getAnimations().some(a => a.animationName === 'navslide' && a.playState === 'running') }));
    ok('loading bar idle when nothing is loading', !nav.on && !nav.running, JSON.stringify(nav));
    const pulses = inv.filter(a => a.name === 'badgePulse');
    const finite = pulses.every(a => Number.isFinite(a.iterations) && a.iterations <= 5);
    ok('dot pulses are finite', pulses.length > 0 && finite, 'pulses=' + pulses.length);
    if (finite) await sleep(pulses.reduce((m, a) => Math.max(m, a.duration * a.iterations), 0) + 800);
    const after = await inventory(page);
    ok('dot pulses end and leave a static glow', !after.some(a => a.name === 'badgePulse'), 'still=' + after.filter(a => a.name === 'badgePulse').length);
    ok('steady state runs only the connector dots and the ring', after.every(a => PAINT_ALLOWED.has(a.name)), after.map(a => a.name).join(','));
    errs.push(...e);
    await ctx.close();
  }

  {
    const { ctx, page, errs: e } = await open(browser, base + '?industry=retail', { clock: true });
    const restMs = await page.evaluate(() => typeof MOTION_REST_MS === 'number' ? MOTION_REST_MS : 60000);
    await page.clock.fastForward(restMs - 2000);
    ok('still moving just before the rest timeout', !(await page.evaluate(() => document.body.classList.contains('motion-rest'))));
    await page.clock.fastForward(3000);
    const rest = await page.evaluate(() => ({ cls: document.body.classList.contains('motion-rest'),
      running: document.getAnimations().filter(a => a.playState === 'running').length }));
    ok('rests after ' + restMs / 1000 + ' s without input', rest.cls && rest.running === 0, JSON.stringify(rest));
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Performance.enable', { timeDomain: 'timeTicks' });
    const m = async () => (await cdp.send('Performance.getMetrics')).metrics.reduce((o, x) => (o[x.name] = x.value, o), {});
    const a = await m(); await sleep(3000); const b = await m();
    const busy = (b.TaskDuration - a.TaskDuration) / 3 * 100;
    ok('main thread idle at rest (< 2%)', busy < 2, busy.toFixed(2) + '%');
    const html = await page.evaluate(() => exportHtmlDoc());
    const bodyTag = (html.match(/<body[^>]*>/) || [''])[0];
    ok('HTML export does not carry the rest state', !/motion-rest/.test(bodyTag), bodyTag.slice(0, 120));
    await page.mouse.move(200, 300);
    await page.mouse.move(260, 340);
    await sleep(300);
    const woke = await page.evaluate(() => ({ cls: document.body.classList.contains('motion-rest'),
      running: document.getAnimations().filter(a => a.playState === 'running').length }));
    ok('pointer input wakes the motion', !woke.cls && woke.running > 0, JSON.stringify(woke));
    const vis = await page.evaluate(() => {
      const set = h => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => h }); document.dispatchEvent(new Event('visibilitychange')); };
      set(true); const hidden = document.body.classList.contains('motion-rest');
      set(false); const shown = document.body.classList.contains('motion-rest');
      return { hidden, shown };
    });
    ok('hidden tab rests, visible tab wakes', vis.hidden && !vis.shown, JSON.stringify(vis));
    errs.push(...e);
    await ctx.close();
  }

  for (const shape of SHAPES) {
    const { ctx, page, errs: e } = await open(browser, base + '?industry=banking&shape=' + shape, { ctx: { reducedMotion: 'reduce' } });
    await sleep(500);
    const deco = (await inventory(page)).filter(a => a.name !== 'navslide' && a.iterations === Infinity);
    ok('reduced motion stops every endless animation (' + shape + ')', deco.length === 0, deco.map(a => a.name).join(','));
    const pulses = (await inventory(page)).filter(a => a.name === 'badgePulse');
    ok('reduced motion shows no dot pulse (' + shape + ')', pulses.length === 0, 'pulses=' + pulses.length);
    errs.push(...e);
    await ctx.close();
  }

  {
    const { ctx, page, errs: e } = await open(browser, base + '?industry=banking&lang=de', { rtt: 150 });
    const t = await page.evaluate(() => performance.getEntriesByType('resource').map(r => ({
      p: new URL(r.name).pathname, s: r.startTime, e: r.responseEnd })));
    const want = ['/version.json', '/resources/links.json', '/resources/certifications.json', '/resources/logos/azure.json', '/architectures/manifest.json', '/architectures/banking.yaml', '/translations/de/_common.json', '/translations/de/banking.json'];
    const hits = want.map(w => t.filter(x => x.p.endsWith(w)));
    ok('every boot fetch issued exactly once', hits.every(h => h.length === 1), want.map((w, i) => w + '=' + hits[i].length).join(' '));
    const got = hits.filter(h => h.length).map(h => h[0]);
    const lastStart = Math.max(...got.map(x => x.s)), firstEnd = Math.min(...got.map(x => x.e));
    ok('boot fetches run in parallel, not one after another', got.length === want.length && lastStart < firstEnd,
      'last start ' + lastStart.toFixed(0) + 'ms, first end ' + firstEnd.toFixed(0) + 'ms');
    const lastEnd = Math.max(...got.map(x => x.e));
    const nav = await page.evaluate(() => window.__nav);
    const early = nav.filter(x => !x.on && x.t < lastEnd - 5);
    ok('loading bar stays on until the last boot fetch lands', nav.some(x => x.on) && early.length === 0,
      'last fetch ' + lastEnd.toFixed(0) + 'ms, bar off at ' + nav.filter(x => !x.on).map(x => x.t.toFixed(0)).join(',') + 'ms');
    const fb = await page.evaluate(() => window.__firstBuild);
    ok('first build is already in the linked language', fb && fb.lang === 'de', JSON.stringify(fb));
    errs.push(...e);
    await ctx.close();
  }

  {
    const { ctx, page, errs: e } = await open(browser, base, { lang: 'fr' });
    const fb = await page.evaluate(() => ({ first: window.__firstBuild, now: document.documentElement.getAttribute('lang') }));
    ok('first build is already in the saved language', fb.first && fb.first.lang === 'fr' && fb.now === 'fr', JSON.stringify(fb));
    errs.push(...e);
    await ctx.close();
  }

  {
    const { ctx, page, errs: e } = await open(browser, base + '?industry=banking', { until: 'load' });
    await introRun(page);
    const mid = await page.evaluate(() => ({ hidden: document.body.classList.contains('booting'),
      anims: document.getAnimations().filter(a => /^ix/.test(a.animationName || '')).length }));
    ok('the board opens with its intro', !mid.hidden && mid.anims > 0, JSON.stringify(mid));
    await introDone(page);
    const full = await introSpan(page);
    ok('the opening intro lasts at most 1.3 s', full !== null && full <= 1300, full + ' ms');
    const left = await introResidue(page);
    ok('the intro leaves no class, variable or animation behind', clean(left), JSON.stringify(left));
    await page.evaluate(() => { collectBoard(); });
    const restarted = await finiteRunning(page);
    ok('an export afterwards restarts no finished animation', restarted.length === 0, restarted.join(','));
    const doc = await page.evaluate(() => exportHtmlDoc());
    const bodyTag = (doc.match(/<body[^>]*>/) || [''])[0];
    ok('the HTML export opens hidden and plays its own intro', /\bbooting\b/.test(bodyTag) && !/data-intro/.test(bodyTag), bodyTag.slice(0, 120));
    await page.goto(base + '?industry=banking', { waitUntil: 'load' });
    await introDone(page);
    const short = await introSpan(page);
    ok('a second board in the same session plays the short intro', short !== null && short <= 750, short + ' ms');
    await page.evaluate(async () => { await applyIndustry('retail', true); });
    const sw = await page.evaluate(() => ({ state: document.body.dataset.intro,
      shown: [...document.querySelectorAll('.atom')].filter(a => a.getClientRects().length).length,
      moving: document.querySelectorAll('.atom.ix').length,
      platform: document.querySelectorAll('#plat-top .atom.ix, #platform .atom.ix').length,
      head: document.querySelector('.plat-head').classList.contains('ix') }));
    ok('an industry switch replays the whole board, platform included',
      sw.state === 'run' && sw.platform > 0 && sw.head && sw.moving === sw.shown, JSON.stringify(sw));
    await introDone(page);
    const span = await introSpan(page);
    ok('an industry switch plays the short intro', span !== null && span <= 750, span + ' ms');
    errs.push(...e);
    await ctx.close();
  }

  {
    const { ctx, page, errs: e } = await open(browser, base + '?industry=banking', { until: 'load' });
    await introRun(page);
    await page.keyboard.press('Shift');
    const r = await page.evaluate(() => new Promise(res => requestAnimationFrame(() => res({ state: document.body.dataset.intro,
      running: document.getAnimations().filter(a => /^ix/.test(a.animationName || '')).length }))));
    ok('a key press ends the intro at once', r.state === 'done' && r.running === 0, JSON.stringify(r));
    await page.goto(base + '?industry=banking', { waitUntil: 'load' });
    await introRun(page);
    const ex = await page.evaluate(() => { collectBoard(); return { state: document.body.dataset.intro,
      finite: document.getAnimations().filter(a => a instanceof CSSAnimation && Number.isFinite(a.effect.getTiming().iterations) && a.playState === 'running').length }; });
    ok('an export during the intro ends it and restarts nothing', ex.state === 'done' && ex.finite === 0, JSON.stringify(ex));
    await page.goto(base + '?industry=banking', { waitUntil: 'load' });
    await introRun(page);
    const deferred = await page.evaluate(() => { fitBoard(); return introRefit; });
    await introDone(page);
    const rows = await page.evaluate(() => {
      const read = () => [...document.querySelectorAll('.b-work .pc-desc')].map(d => d.style.minHeight).join('|');
      const after = read(); fitBoard(); return { after, fresh: read() };
    });
    ok('a refit during the intro waits and lands on the true layout', deferred && rows.after === rows.fresh, JSON.stringify({ deferred, same: rows.after === rows.fresh }));
    await page.goto(base + '?industry=banking', { waitUntil: 'load' });
    await introRun(page);
    const rebuilt = await page.evaluate(async () => { await applyIndustry('healthcare', false);
      return { state: document.body.dataset.intro, ix: document.querySelectorAll('.ix').length }; });
    ok('a rebuild during the intro ends it', rebuilt.state === 'done' && rebuilt.ix === 0, JSON.stringify(rebuilt));
    await page.goto(base + '?industry=banking&lang=ar', { waitUntil: 'load' });
    await introRun(page);
    const rtl = await page.evaluate(() => {
      const zone = s => parseFloat(document.querySelector(s).style.getPropertyValue('--ixd'));
      return { dir: document.documentElement.getAttribute('data-dir'), src: zone('.col.src'), cons: zone('.col.cons') };
    });
    ok('in a right-to-left language the intro still flows from sources to consumers', rtl.dir === 'rtl' && rtl.src < rtl.cons, JSON.stringify(rtl));
    errs.push(...e);
    await ctx.close();
  }

  {
    const { ctx, page, errs: e } = await open(browser, base + '?industry=banking', { ctx: { reducedMotion: 'reduce' } });
    const r = await page.evaluate(() => ({ state: document.body.dataset.intro, ran: window.__intro.some(x => x.s === 'run'),
      hidden: document.body.classList.contains('booting') }));
    ok('reduced motion opens the board without an intro', r.state === 'done' && !r.ran && !r.hidden, JSON.stringify(r));
    errs.push(...e);
    await ctx.close();
  }

  {
    const { ctx, page, errs: e } = await open(browser, base + '?industry=banking', { tour: true, until: 'load' });
    await introRun(page);
    const during = await page.evaluate(() => !!document.querySelector('.tour-pop'));
    await introDone(page);
    await page.waitForSelector('.tour-pop', { timeout: 3000 }).catch(() => null);
    const after = await page.evaluate(() => !!document.querySelector('.tour-pop'));
    ok('the first-visit tour waits for the intro', !during && after, JSON.stringify({ during, after }));
    errs.push(...e);
    await ctx.close();
  }

  {
    const ctx = await browser.newContext({ viewport: { width: 1728, height: 993 } });
    const page = await ctx.newPage();
    const e = [];
    page.on('pageerror', x => e.push(String(x)));
    await page.addInitScript(() => {
      try { localStorage.setItem('dbx-arch-tour-v1', '1'); } catch (x) {}
      window.__hid = true;
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => window.__hid });
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => window.__hid ? 'hidden' : 'visible' });
    });
    await page.goto(base + '?industry=banking', { waitUntil: 'networkidle' });
    await sleep(600);
    const waiting = await page.evaluate(() => ({ state: document.body.dataset.intro || null, hidden: document.body.classList.contains('booting') }));
    await page.evaluate(() => { window.__hid = false; document.dispatchEvent(new Event('visibilitychange')); });
    await introDone(page);
    ok('a board opened in a background tab plays its intro when first shown', waiting.state !== 'done' && waiting.hidden, JSON.stringify(waiting));
    errs.push(...e);
    await ctx.close();
  }

  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  await browser.close();
  server.close();
  const failed = R.filter(r => !r.c).length;
  console.log('\n' + (R.length - failed) + '/' + R.length + ' perf checks passed');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
