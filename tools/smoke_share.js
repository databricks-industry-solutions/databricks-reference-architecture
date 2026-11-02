#!/usr/bin/env node
'use strict';
/* Smoke test for the social Share control: the button sits to the right of the
   feedback button, its menu titles the post "Databricks Reference Architecture
   for <industry>", every network href carries the deep link that reopens THAT
   industry, and the deep link actually lands on the industry via seedFromUrl. */
const path = require('path');
const { chromium } = require('playwright');
const { serve, boardReady } = require('./lib_serve');

const results = [];
function check(name, cond, detail) { results.push({ name, ok: !!cond, detail }); console.log((cond ? 'PASS ' : 'FAIL ') + name + (detail ? ' :: ' + detail : '')); }

(async () => {
  const server = await serve();
  const port = server.address().port;
  const base = 'http://127.0.0.1:' + port + '/index.html';
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  await page.addInitScript(() => { try { localStorage.setItem('dbx-arch-tour-v1', '1'); } catch (e) {} });
  await page.goto(base, { waitUntil: 'networkidle' });
  await boardReady(page);
  await page.waitForTimeout(400);

  // ---- structure: Feedback and Share on the bar, Options last with the page-wide choices, the tour and the dock ----
  check('Options is the last control in the toolbar', await page.evaluate(() => {
    const tools = document.querySelector('.htools');
    return !!tools && tools.lastElementChild === document.getElementById('opt-wrap');
  }));
  const sections = await page.evaluate(() => [...document.getElementById('opt-menu').children].map(e =>
    (e.id || [...e.querySelectorAll('button[id]')].map(b => b.id).join('+')) + ':' + ((e.querySelector('.men-hd') || {}).textContent || '')).join());
  check('the Options menu opens on the platform shape, then the language and colour palette sections, each under its heading, then the tour and the dock',
    sections === 'shape-menu:Platform shape,lang-menu:Language,pal-menu:Colour palette,tour-btn+side-btn:', sections);
  check('Feedback and then Share, with its own menu, open the toolbar ahead of the industry picker; no language, palette or shape button is left on it', await page.evaluate(() => {
    const tools = document.querySelector('.htools'), fb = document.querySelector('.htools > #feedback-btn'), sw = document.querySelector('.htools > #share-wrap');
    return !!fb && !!sw && tools.firstElementChild === fb && fb.nextElementSibling === sw && sw.nextElementSibling === document.getElementById('ind-wrap') &&
      !!sw.querySelector(':scope > #share-btn') && !!sw.querySelector(':scope > #share-menu') &&
      !document.querySelector('#lang-btn, #pal-btn, #shape-btn, #lang-wrap, #pal-wrap, #shape-wrap');
  }));
  const icons = await page.evaluate(() => ['share-btn', 'opt-btn'].map(id => {
    const b = document.getElementById(id), r = b.getBoundingClientRect();
    return { id, ico: b.classList.contains('ico-only'), text: b.textContent.trim(), svg: !!b.querySelector('svg'), title: !!b.title, w: Math.round(r.width), h: Math.round(r.height) };
  }));
  check('Share and Options are icon-only buttons: a glyph, no text, a title that names them, square like the other icon buttons',
    icons.every(i => i.ico && !i.text && i.svg && i.title && Math.abs(i.w - i.h) <= 2), JSON.stringify(icons));

  // ---- default OG tags on index.html (the reference-board card LinkedIn scrapes) ----
  const head = await page.evaluate(() => document.head.innerHTML);
  check('index has default og:title', /property="og:title" content="Databricks Reference Architecture"/.test(head));
  check('index has og:image under /app/ (1200x630)',
    /property="og:image" content="[^"]+\/app\/assets\/og-cover\.png"/.test(head) && /property="og:image:width" content="1200"/.test(head), head.match(/og:image" content="([^"]+)"/) ? head.match(/og:image" content="([^"]+)"/)[1] : 'missing');
  check('index has twitter summary_large_image', /name="twitter:card" content="summary_large_image"/.test(head));
  check('og-cover.png is served', (await page.evaluate(async () => (await fetch('assets/og-cover.png')).status)) === 200);

  // ---- open an industry (default cloud = AWS), open the menu, read title/hrefs ----
  const IND = 'banking';
  const data = await page.evaluate(async (ind) => {
    await applyIndustry(ind, true);
    document.getElementById('share-btn').click();
    const menu = document.getElementById('share-menu');
    const title = menu.querySelector('.sh-title').textContent;
    const land = shareLandingUrl();
    const rows = Array.from(menu.querySelectorAll('button[data-share]')).map(b => b.dataset.share);
    const T = SHARE_TARGETS.reduce((a, t) => { a[t.k] = t.href ? t.href(shareLandingUrl(), shareTitle()) : null; return a; }, {});
    const actions = SHARE_TARGETS.filter(t => !t.href && !t.copy).map(t => t.k + ':' + typeof t.action);
    /* the menu row icon is a Lucide line-art SVG (not an emoji text node), so
       "carries an icon" means the .ind-ic holds a rendered <svg> glyph */
    const icon = document.querySelector('#ind-menu button[data-ind="banking"] .ind-ic svg') ? 'svg' : '';
    return { title, land, rows, hrefs: T, actions, label: industryLabel(ind), pageTitle: document.title, cloud: cloudLabelNow(), cloudKey: ARCH.cloud.provider, icon };
  }, IND);

  // the share card is English and now names the whatever cloud is selected
  const wantTitle = 'Databricks Reference Architecture for ' + data.label + ' on ' + data.cloud;
  check('menu titles the post with industry + cloud', data.title === wantTitle, data.title);
  check('share link is the per-industry, per-cloud stub', new RegExp('/share/banking_' + data.cloudKey + '\\.html(\\?|$)').test(data.land), data.land);
  check('industry menu row carries an icon glyph', data.icon.trim().length > 0, JSON.stringify(data.icon));

  check('page title names industry + cloud', new RegExp('Databricks Reference Architecture for Banking on ' + data.cloud).test(data.pageTitle), data.pageTitle);
  check('page title starts with the board name (the tab icon is the fixed favicon)', data.pageTitle.indexOf('Databricks Reference Architecture') === 0, data.pageTitle);

  const want = ['linkedin', 'x', 'facebook', 'reddit', 'hn', 'whatsapp', 'telegram', 'email', 'copy'];
  check('all networks present', want.every(k => data.rows.includes(k)), data.rows.join(','));
  check('a row that is not a link runs its own action (the PNG download)',
    data.actions.length > 0 && data.actions.every(a => a.endsWith(':function')) && data.actions.every(a => data.rows.includes(a.split(':')[0])), data.actions.join(','));

  const enc = encodeURIComponent(data.land);
  const encT = encodeURIComponent(wantTitle);
  check('linkedin href carries the stub link', data.hrefs.linkedin.includes('share-offsite') && data.hrefs.linkedin.includes(enc), data.hrefs.linkedin);
  check('x href carries title + stub link', data.hrefs.x.includes('intent/tweet') && data.hrefs.x.includes(encT) && data.hrefs.x.includes(enc));
  check('facebook href carries the stub link', data.hrefs.facebook.includes('sharer') && data.hrefs.facebook.includes(enc));
  check('reddit href carries title + stub link', data.hrefs.reddit.includes('reddit.com/submit') && data.hrefs.reddit.includes(encT) && data.hrefs.reddit.includes(enc));
  check('hn href carries title + stub link', data.hrefs.hn.includes('ycombinator') && data.hrefs.hn.includes(encT) && data.hrefs.hn.includes(enc));
  check('whatsapp href carries title + stub link', data.hrefs.whatsapp.includes('whatsapp') && data.hrefs.whatsapp.includes(encodeURIComponent(wantTitle + ' ' + data.land)));
  check('telegram href carries title + stub link', data.hrefs.telegram.includes('t.me/share') && data.hrefs.telegram.includes(encT) && data.hrefs.telegram.includes(enc));
  check('email mailto carries title + stub link', data.hrefs.email.startsWith('mailto:') && data.hrefs.email.includes(encT) && data.hrefs.email.includes(enc));

  const de = await page.evaluate(async () => { await applyLang('de', false); const r = { title: document.title, label: T(industryLabel('banking')), cloud: cloudLabelNow() }; await applyLang('en', false); return r; });
  check('page title keeps English chrome and localizes the industry (de)',
    de.label !== 'Banking' && de.title === 'Databricks Reference Architecture for ' + de.label + ' on ' + de.cloud, de.title);

  // ---- switching cloud re-points the stub + page title (switch to GCP, a cloud
  //      that differs from whatever the default is) ----
  const gcp = await page.evaluate(async () => {
    const seg = document.getElementById('cloud-seg');
    const b = Array.from(seg.querySelectorAll('button')).find(x => x.textContent === 'GCP');
    b.click();
    return { land: shareLandingUrl(), pageTitle: document.title };
  });
  check('cloud switch re-points the stub to _gcp', /\/share\/banking_gcp\.html(\?|$)/.test(gcp.land), gcp.land);
  check('cloud switch updates the page title to GCP', /on GCP$/.test(gcp.pageTitle), gcp.pageTitle);

  // ---- the stub carries per-industry, per-cloud OG tags AND redirects onto the board ----
  //      Read the RAW bytes via fetch (navigating would execute its redirect script
  //      and hand back index.html instead of the stub).
  const stub = await page.evaluate(async () => {
    const r = await fetch(APP_BASE + 'share/banking_aws.html');
    return { status: r.status, html: await r.text() };
  });
  check('stub served (200)', stub.status === 200, 'status=' + stub.status);
  check('stub has per-industry + cloud og:title', /og:title" content="Databricks Reference Architecture for Banking on AWS"/.test(stub.html));
  check('stub og:image is the per-industry cover under /app/', /og:image" content="[^"]+\/app\/assets\/og\/banking\.png"/.test(stub.html), (stub.html.match(/og:image" content="([^"]+)"/) || [])[1]);
  check('stub og:url is under /app/', /og:url" content="[^"]+\/app\/share\/banking_aws\.html"/.test(stub.html), (stub.html.match(/og:url" content="([^"]+)"/) || [])[1]);
  check('stub redirect carries the cloud', /industry=banking&cloud=aws/.test(stub.html));
  // A meta-refresh (or a canonical pointing at index.html) makes scrapers follow to
  // index.html and scrape ITS default card, losing the per-industry title. Lock both.
  check('stub has NO meta-refresh (scrapers follow it)', !/http-equiv=["']?refresh/i.test(stub.html));
  check('stub is self-canonical (not index.html)', /rel="canonical" href="[^"]+\/app\/share\/banking_aws\.html"/.test(stub.html) && !/rel="canonical" href="[^"]*index\.html/.test(stub.html));

  const landed = await (async () => {
    const p2 = await browser.newPage();
    await p2.addInitScript(() => { try { localStorage.setItem('dbx-arch-tour-v1', '1'); } catch (e) {} });
    await p2.goto('http://127.0.0.1:' + port + '/share/banking_azure.html', { waitUntil: 'networkidle' });
    await boardReady(p2);
    await p2.waitForTimeout(600);
    const st = await p2.evaluate(() => ({ ind: (typeof ARCH !== 'undefined' ? ARCH.industry : null), cloud: (typeof ARCH !== 'undefined' ? ARCH.cloud.provider : null) }));
    await p2.close();
    return st;
  })();
  check('stub redirects and reopens the industry on its cloud', landed.ind === IND && landed.cloud === 'azure', JSON.stringify(landed));

  // ---- backward-compatible plain stub still resolves (links shared before clouds) ----
  const compat = await page.evaluate(async () => { const r = await fetch(APP_BASE + 'share/banking.html'); return { status: r.status, html: await r.text() }; });
  check('legacy /share/<id>.html still served as the Banking stub', compat.status === 200 && /og:title" content="Databricks Reference Architecture for Banking/.test(compat.html), 'status=' + compat.status);

  // ---- generic board titles without an industry (still names the cloud) ----
  const gen = await page.evaluate(async () => {
    await applyIndustry('generic', true);
    document.getElementById('share-wrap').classList.remove('open'); // close first (outside-click does this for a real user)
    document.getElementById('share-btn').click();                    // reopen -> rebuild with the current board
    return { title: document.getElementById('share-menu').querySelector('.sh-title').textContent, land: shareLandingUrl(), pageTitle: document.title };
  });
  check('generic board titles without an industry (with cloud)', /^Databricks Reference Architecture on (AWS|Azure|GCP)$/.test(gen.title), gen.title);
  check('generic board shares index.html (not a stub)', /\/index\.html(\?|$)/.test(gen.land) && !/\/share\//.test(gen.land), gen.land);
  check('generic page title has no "for"', !/ for /.test(gen.pageTitle) && /Databricks Reference Architecture on (AWS|Azure|GCP)/.test(gen.pageTitle), gen.pageTitle);

  const closeMenus = () => page.evaluate(() => document.querySelectorAll('.pal-wrap.open').forEach(w => w.classList.remove('open')));
  const pick = async (btn, item) => { await closeMenus(); await page.click(btn); await page.click(item); await closeMenus(); };
  const bar = () => page.evaluate(() => { const s = new URL(shareLandingUrl()); return { bar: location.pathname + location.search, share: s.pathname + s.search }; });
  await page.evaluate(async () => { closeDrawer(); await applyIndustry('banking', true); });
  await page.waitForTimeout(300);
  const steps = [
    ['cloud', () => page.click('#cloud-seg button:has-text("AWS")')],
    ['style', () => pick('#opt-btn', '#shape-menu [data-shape="s"]')],
    ['palette', () => pick('#opt-btn', '#pal-menu [data-pal="mono"]')],
    ['theme', () => page.click('#theme-btn')],
    ['display', () => page.click('#display-seg button:has-text("Branded")')],
    ['view', () => page.click('#view-seg button:has-text("Detailed")')],
    ['stage', () => pick('#stage-btn', '#stage-menu [data-stage="beta"]')],
    ['highlights', () => pick('#hl-btn', '#hl-menu [data-hl="story"]')],
    ['region', () => pick('#region-btn', '#region-menu button[data-region]:not([data-region-all])')],
    ['filter the region panel', async () => { await page.click('#d-body .rg-filt[data-col="avail"]'); await page.click('#d-body .rg-pop input[data-all]'); await page.click('#d-body .rg-q'); }],
    ['sort the region panel', () => page.click('#d-body .rg-sort[data-col="avail"]')],
    ['search the region panel', () => page.fill('#d-body .rg-q', 'serverless')],
    ['close the region panel', () => page.click('#dclose')],
    ['zoom into Teams', () => page.click('.pockhead [data-zoom="ppl"]')],
    ['open a box', () => page.evaluate(() => atomsNamed('Data Engineers')[0].click())],
    ['dock the panel', () => pick('#opt-btn', '#side-btn')],
    ['language', () => pick('#opt-btn', '#lang-menu [data-lang="fr"]')],
  ];
  for (const [label, act] of steps) {
    const before = (await bar()).bar;
    await act();
    await page.waitForTimeout(500);
    const now = await bar();
    check('address bar == share link after ' + label, now.bar === now.share && now.bar !== before, now.bar);
  }

  const fresh = async (url, opts) => {
    const ctx = await browser.newContext();
    if (!(opts && opts.firstVisit)) await ctx.addInitScript(() => { try { localStorage.setItem('dbx-arch-tour-v1', '1'); } catch (e) {} });
    const p = await ctx.newPage();
    p.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
    await p.goto(url, { waitUntil: 'networkidle' });
    await boardReady(p);
    await p.waitForTimeout(800);
    return { ctx, p };
  };
  const sent = await page.evaluate(() => ({ url: location.href, state: stateParams().toString(), ind: ARCH.industry, box: openBox() }));
  {
    const { ctx, p } = await fresh(sent.url);
    const got = await p.evaluate(() => ({ url: location.href, state: stateParams().toString(), ind: ARCH.industry, box: openBox() }));
    check('a copied link reopens the same options in a fresh browser', got.ind === sent.ind && got.state === sent.state, got.state);
    check('a copied link reopens the same panel', !!sent.box && JSON.stringify(got.box) === JSON.stringify(sent.box), JSON.stringify(got.box));
    check('the reopened board shows the same address', got.url === sent.url, got.url);
    await ctx.close();
  }

  const dup = await page.evaluate(() => {
    applyZoom(null);
    const two = atomsNamed('Lakebase');
    if (two.length < 2) return { n: two.length };
    two[1].click();
    return { n: two.length, url: location.href, box: openBox() };
  });
  check('a box name used twice is told apart in the link', dup.n >= 2 && !!dup.box && dup.box.i === 1 && /[?&]boxn=1(&|$)/.test(dup.url), JSON.stringify(dup.box));
  if (dup.url) {
    const { ctx, p } = await fresh(dup.url);
    const got = await p.evaluate(() => openBox());
    check('a link to the second same-named box reopens that box', !!got && got.n === 'Lakebase' && got.i === 1, JSON.stringify(got));
    await ctx.close();
  }

  const rebuilt = await page.evaluate(() => {
    const before = location.pathname + location.search;
    ARCH.cloud.provider = ARCH.cloud.provider === 'gcp' ? 'aws' : 'gcp';
    build();
    const s = new URL(shareLandingUrl());
    return { before, bar: location.pathname + location.search, share: s.pathname + s.search };
  });
  check('a rebuild on its own leaves the address bar in sync', rebuilt.bar === rebuilt.share && rebuilt.bar !== rebuilt.before, rebuilt.bar);

  {
    const { ctx, p } = await fresh(base + '?industry=banking&cloud=aws&platform=1');
    const got = await p.evaluate(() => ({ zoom: zoomKey, plat: document.body.classList.contains('plat-only') }));
    check('an old platform=1 link still opens the platform zoom', got.zoom === 'plat' && got.plat, JSON.stringify(got));
    await ctx.close();
  }

  {
    const { ctx, p } = await fresh(sent.url, { firstVisit: true });
    await p.waitForTimeout(900);
    const tourRan = await p.evaluate(() => !!document.querySelector('.tour-catch'));
    let onPanelStep = false;
    for (let i = 0; i < 20 && !onPanelStep; i++) {
      await p.keyboard.press('ArrowRight');
      await p.waitForTimeout(150);
      onPanelStep = await p.evaluate((n) => { const b = openBox(); return !!b && b.n !== n; }, sent.box.n);
    }
    await p.keyboard.press('Escape');
    await p.waitForTimeout(400);
    const after = await p.evaluate(() => ({ url: location.href, box: openBox(), tour: !!document.querySelector('.tour-catch') }));
    check('the first-visit tour runs on a shared link and hands back the shared panel',
      tourRan && onPanelStep && !after.tour && JSON.stringify(after.box) === JSON.stringify(sent.box) && after.url === sent.url, JSON.stringify(after));
    await ctx.close();
  }

  {
    const ctx = await browser.newContext();
    await ctx.addInitScript(() => { try { localStorage.setItem('dbx-arch-tour-v1', '1'); } catch (e) {} });
    const own = await ctx.newPage();
    own.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
    await own.goto(base + '?industry=banking', { waitUntil: 'networkidle' });
    await boardReady(own);
    await own.waitForTimeout(500);
    const customId = await own.evaluate(() => { cloneCurrent(); return activeBoard; });
    await own.reload({ waitUntil: 'networkidle' });
    await boardReady(own);
    await own.waitForTimeout(800);
    const afterReload = await own.evaluate(() => activeBoard);
    check('a reload keeps the active custom tab', /^custom\d+$/.test(customId) && afterReload === customId, customId + ' -> ' + afterReload);
    const other = await ctx.newPage();
    other.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
    await other.goto(base + '?industry=retail&cloud=gcp', { waitUntil: 'networkidle' });
    await boardReady(other);
    await other.waitForTimeout(800);
    const followed = await other.evaluate(() => ({ board: activeBoard, ind: ARCH.industry, cloud: ARCH.cloud.provider }));
    check("a followed link opens the sender's board, not the reader's saved tab",
      followed.board === 'reference' && followed.ind === 'retail' && followed.cloud === 'gcp', JSON.stringify(followed));
    await ctx.close();
  }

  {
    const site = await serve(path.join(__dirname, '..'));
    const ctx = await browser.newContext();
    await ctx.addInitScript(() => { try { localStorage.setItem('dbx-arch-tour-v1', '1'); } catch (e) {} });
    const root = await ctx.newPage();
    root.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
    await root.goto('http://127.0.0.1:' + site.address().port + '/?industry=airlines&cloud=gcp&lang=fr', { waitUntil: 'load' });
    await boardReady(root);
    let landed = null;
    try {
      await root.waitForURL(/\/app\//, { timeout: 15000 });
      await root.waitForLoadState('networkidle');
      await root.waitForTimeout(800);
      landed = await root.evaluate(() => ({ ind: ARCH.industry, cloud: ARCH.cloud.provider, lang: I18N.lang }));
    } catch (e) { landed = { error: e.message.split('\n')[0] }; }
    check('the site root forwards every option to the board',
      !!landed && landed.ind === 'airlines' && landed.cloud === 'gcp' && landed.lang === 'fr', JSON.stringify(landed));
    await ctx.close();
    site.close();
  }

  check('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));

  await browser.close();
  server.close();
  const failed = results.filter(r => !r.ok);
  console.log('\n' + (results.length - failed.length) + '/' + results.length + ' checks passed');
  process.exit(failed.length ? 1 : 0);
})();
