#!/usr/bin/env node
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { chromium } = require('playwright');
const { serve, boardReady } = require('./lib_serve');

const DOCS = path.join(__dirname, '..', 'docs');
const VW = 1728, VH = 1180, CAPW = 1440, CAPH = Math.round(CAPW * VH / VW), OUTW = 960, FPS = 25;
const AZ = '&cloud=azure&theme=light';
const FREEZE = '.flow::before,.medal-arrow::before,.pocket.ing::before,.pocket.ppl::before,.zring path,' +
  '.badge-dot::after,.d-badge .db-dot::after,.ix{animation:none!important}';

function cursorOverlay() {
  const make = () => {
    if (window.__gifCursor) return;
    const c = document.createElement('div');
    c.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="32" viewBox="0 0 28 32">' +
      '<path d="M3 2 L3 25 L9 19.5 L13.2 28.5 L17.2 26.7 L13 17.8 L21 17.8 Z" fill="#fff" stroke="#111" ' +
      'stroke-width="1.7" stroke-linejoin="round"/></svg>';
    Object.assign(c.style, { position: 'fixed', left: '0', top: '0', width: '28px', height: '32px', zIndex: '2147483647',
      pointerEvents: 'none', transform: 'translate(-200px,-200px)', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.4))' });
    const ring = document.createElement('div');
    Object.assign(ring.style, { position: 'fixed', left: '-19px', top: '-19px', width: '38px', height: '38px', borderRadius: '50%',
      border: '3px solid #FF3621', zIndex: '2147483646', pointerEvents: 'none', opacity: '0' });
    document.documentElement.appendChild(ring);
    document.documentElement.appendChild(c);
    addEventListener('mousemove', e => { c.style.transform = 'translate(' + (e.clientX - 3) + 'px,' + (e.clientY - 2) + 'px)'; }, true);
    addEventListener('mousedown', e => {
      const at = 'translate(' + e.clientX + 'px,' + e.clientY + 'px)';
      ring.animate([{ opacity: 0.95, transform: at + ' scale(.35)' }, { opacity: 0, transform: at + ' scale(1.45)' }],
        { duration: 460, easing: 'ease-out' });
    }, true);
    window.__gifCursor = c;
  };
  if (document.documentElement) make(); else document.addEventListener('DOMContentLoaded', make);
}

function pilot(page) {
  let at = [-60, -60];
  const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const p = {
    page,
    async place(x, y) { at = [x, y]; await page.mouse.move(x, y); },
    async glide(x, y, ms = 750) {
      const [x0, y0] = at, steps = Math.max(10, Math.round(ms / 16));
      for (let i = 1; i <= steps; i++) {
        const e = ease(i / steps);
        await page.mouse.move(x0 + (x - x0) * e, y0 + (y - y0) * e);
        await page.waitForTimeout(ms / steps);
      }
      at = [x, y];
    },
    async glideTo(target, ms = 750, fx = 0.5, fy = 0.5) {
      const b = await page.evaluate(t => {
        let el = null;
        if (t.tile) el = atomsNamed(t.tile)[0] || null;
        else if (t.text) {
          const hits = [...document.querySelector(t.within).querySelectorAll(t.tag)]
            .filter(e => e.textContent.includes(t.text) && e.getBoundingClientRect().width > 0);
          const area = e => e.getBoundingClientRect().width * e.getBoundingClientRect().height;
          el = hits.sort((a, b) => area(a) - area(b))[0] || null;
        } else el = document.querySelector(t.sel);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height };
      }, target);
      if (!b) throw new Error('nothing on the board matches ' + JSON.stringify(target));
      await p.glide(b.x + b.w * fx, b.y + b.h * fy, ms);
    },
    async click() { await page.mouse.down(); await page.waitForTimeout(110); await page.mouse.up(); },
    async hold(ms) { await page.waitForTimeout(ms); },
    async type(text, delay = 110) { await page.keyboard.type(text, { delay }); },
    async drawerOpen() {
      await page.waitForFunction(() => document.getElementById('drawer').getBoundingClientRect().x < innerWidth - 100, null, { timeout: 15000 });
      await page.waitForTimeout(450);
    },
    async industry(id) {
      await page.waitForFunction(i => ARCH.industry === i && Object.keys(nameIndex).length > 10, id, { timeout: 30000 });
    },
  };
  return p;
}

async function deckSlides(page) {
  await page.evaluate(async () => {
    const html = [dsCover(), dsIndex()];
    let si = 0;
    for (const sec of deckSections()) {
      if (sec.kind === 'uc') html.push(dsUC(sec.tiles[0], sec.eyebrow));
      else if (sec.kind === 'genie') html.push(dsGenie(sec.tiles[0], sec.eyebrow));
      else if (sec.kind === 'dash') html.push(dsDash(sec.tiles[0], sec.eyebrow));
      else if (sec.kind !== 'board') html.push(dsGrid(sec, si));
      si++;
    }
    html.push(dsClosing());
    const urls = [];
    for (const h of html) {
      const s = await deckSlideRGB(h);
      const c = document.createElement('canvas');
      c.width = s.w; c.height = s.h;
      const ctx = c.getContext('2d'), im = ctx.createImageData(s.w, s.h);
      for (let i = 0, j = 0; j < s.rgb.length; i += 4) {
        im.data[i] = s.rgb[j++]; im.data[i + 1] = s.rgb[j++]; im.data[i + 2] = s.rgb[j++]; im.data[i + 3] = 255;
      }
      ctx.putImageData(im, 0, 0);
      urls.push(c.toDataURL('image/png'));
    }
    const o = document.createElement('div');
    Object.assign(o.style, { position: 'fixed', inset: '0', background: '#f1f3f6', zIndex: '2147483645', display: 'none',
      alignItems: 'center', justifyContent: 'center', cursor: 'none' });
    const img = document.createElement('img');
    Object.assign(img.style, { maxWidth: '90%', maxHeight: '90%', boxShadow: '0 10px 30px rgba(20,30,45,.28)' });
    o.appendChild(img);
    document.documentElement.appendChild(o);
    window.__slide = i => {
      if (window.__gifCursor) window.__gifCursor.style.display = 'none';
      o.style.display = 'flex';
      img.src = urls[i];
      return img.decode();
    };
    window.__slideCount = urls.length;
  });
  return page.evaluate(() => window.__slideCount);
}

const SCENES = {
  'industry-picker': {
    q: '?cloud=azure&theme=light', at: [760, 700],
    async run(a) {
      await a.hold(700);
      await a.glideTo({ sel: '#ind-btn' }, 950);
      await a.hold(250);
      await a.click();
      await a.page.waitForSelector('#ind-search', { state: 'visible' });
      await a.hold(500);
      await a.type('pharma', 130);
      await a.hold(650);
      await a.glideTo({ sel: '#ind-menu button[data-ind="pharmaceuticals"]' }, 600, 0.35, 0.5);
      await a.hold(350);
      await a.click();
      await a.industry('pharmaceuticals');
      await a.hold(500);
      await a.glide(760, 700, 900);
      await a.hold(2400);
    },
  },
  'six-industries': {
    q: '?industry=banking' + AZ, at: [-60, -60],
    async run(a) {
      await a.hold(1700);
      for (const id of ['healthcare', 'manufacturing', 'telecommunication', 'electric_utility', 'retail']) {
        await a.page.evaluate(i => applyIndustry(i, true), id);
        await a.industry(id);
        await a.hold(1700);
      }
    },
  },
  'use-case': {
    q: '?industry=banking' + AZ, at: [760, 700],
    async run(a) {
      await a.hold(600);
      await a.glideTo({ tile: 'Real-Time Fraud' }, 1000);
      await a.hold(650);
      await a.click();
      await a.drawerOpen();
      await a.glideTo({ text: 'Fraud Framework', within: '#drawer', tag: 'a' }, 900, 0.3, 0.5);
      await a.hold(900);
      await a.glideTo({ text: 'Coinbase', within: '#drawer', tag: 'a' }, 800, 0.3, 0.5);
      await a.hold(2400);
    },
  },
  region: {
    q: '?industry=banking' + AZ, at: [760, 700],
    async run(a) {
      await a.hold(600);
      await a.glideTo({ sel: '#region-btn' }, 1000);
      await a.hold(250);
      await a.click();
      await a.page.waitForSelector('#region-q', { state: 'visible' });
      await a.hold(400);
      await a.type('south africa', 95);
      await a.hold(500);
      await a.glideTo({ sel: '#region-menu button[data-region="southafricanorth"]' }, 650, 0.3, 0.5);
      await a.hold(350);
      await a.click();
      await a.page.waitForFunction(() => regionSel === 'southafricanorth');
      await a.hold(500);
      if (await a.page.evaluate(() => document.getElementById('region-wrap').classList.contains('open'))) {
        await a.glide(1100, 1150, 600);
        await a.click();
      }
      await a.glideTo({ tile: 'Lakebase' }, 1000);
      await a.hold(2600);
    },
  },
  language: {
    q: '?industry=banking' + AZ, at: [760, 700],
    async run(a) {
      await a.hold(600);
      await a.glideTo({ sel: '#opt-btn' }, 1000);
      await a.hold(250);
      await a.click();
      await a.page.waitForSelector('#lang-menu button[data-lang="ar"]', { state: 'visible' });
      await a.hold(400);
      await a.glideTo({ sel: '#lang-menu button[data-lang="ar"]' }, 700, 0.4, 0.5);
      await a.hold(400);
      await a.click();
      await a.page.waitForFunction(() => I18N.lang === 'ar' && document.documentElement.getAttribute('data-dir') === 'rtl', null, { timeout: 30000 });
      await a.hold(600);
      await a.glide(860, 700, 900);
      await a.hold(2600);
    },
  },
  export: {
    q: '?industry=banking' + AZ, at: [760, 700], prepare: deckSlides,
    async run(a) {
      await a.hold(600);
      await a.glideTo({ sel: '#dl-btn' }, 1000);
      await a.hold(250);
      await a.click();
      await a.page.waitForSelector('#dl-menu button[data-dl="pptx"]', { state: 'visible' });
      await a.hold(600);
      await a.glideTo({ sel: '#dl-menu button[data-dl="pdf"]' }, 600, 0.4, 0.5);
      await a.hold(350);
      await a.glideTo({ sel: '#dl-menu button[data-dl="pptx"]' }, 450, 0.4, 0.5);
      await a.hold(400);
      await a.click();
      await a.hold(300);
      for (let i = 0; i < a.slides; i++) {
        await a.page.evaluate(n => window.__slide(n), i);
        await a.hold(i ? 1050 : 1800);
      }
    },
  },
};

async function record(page, scene, dir) {
  const a = pilot(page);
  a.slides = scene.prepare ? await scene.prepare(page) : 0;
  await a.place(scene.at[0], scene.at[1]);
  await page.waitForTimeout(150);
  const cdp = await page.context().newCDPSession(page);
  const frames = [];
  cdp.on('Page.screencastFrame', f => {
    const file = path.join(dir, 'f' + String(frames.length).padStart(5, '0') + '.png');
    fs.writeFileSync(file, Buffer.from(f.data, 'base64'));
    frames.push({ file, t: f.metadata.timestamp });
    cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'png', maxWidth: CAPW, maxHeight: CAPH, everyNthFrame: 1 });
  await page.waitForTimeout(250);
  const start = Date.now() / 1000;
  await scene.run(a);
  const end = Date.now() / 1000;
  await cdp.send('Page.stopScreencast');
  await page.waitForTimeout(200);
  return { frames: frames.sort((x, y) => x.t - y.t), start, end };
}

function encode(tl, dir, out, crop) {
  if (!tl.frames.length) throw new Error('the screencast sent no frames');
  const step = 1 / FPS, seq = [];
  let j = 0;
  for (let t = Math.max(tl.start, tl.frames[0].t); t < tl.end; t += step) {
    while (j + 1 < tl.frames.length && tl.frames[j + 1].t <= t) j++;
    const f = tl.frames[j].file;
    if (seq.length && seq[seq.length - 1][0] === f) seq[seq.length - 1][1] += step;
    else seq.push([f, step]);
  }
  const list = path.join(dir, 'list.ffconcat');
  fs.writeFileSync(list, 'ffconcat version 1.0\n' + seq.map(([f, d]) => "file '" + f + "'\nduration " + d.toFixed(3) + '\n').join('') +
    "file '" + seq[seq.length - 1][0] + "'\n");
  const tmp = out + '.part.gif', rgb = path.join(dir, 'frames.mkv');
  const k = CAPW / VW, px = v => Math.floor(v * k / 2) * 2;
  const ffmpeg = args => {
    const r = spawnSync('ffmpeg', ['-v', 'error', '-y'].concat(args), { encoding: 'utf8' });
    if (r.status !== 0) throw new Error('ffmpeg failed: ' + (r.stderr || '').trim());
  };
  ffmpeg(['-f', 'concat', '-safe', '0', '-i', list, '-vf',
    (crop ? 'crop=' + px(crop[2]) + ':' + px(crop[3]) + ':' + px(crop[0]) + ':' + px(crop[1]) + ',' : '') +
    'scale=' + OUTW + ':-1:flags=lanczos,format=rgb24', '-c:v', 'ffv1', '-fps_mode', 'passthrough', rgb]);
  ffmpeg(['-i', rgb, '-vf', 'split[a][b];[a]palettegen=max_colors=256:stats_mode=full[p];[b][p]paletteuse=dither=none:diff_mode=rectangle',
    '-fps_mode', 'passthrough', '-loop', '0', tmp]);
  const secs = seq.reduce((s, x) => s + x[1], 0);
  const got = +spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', tmp], { encoding: 'utf8' }).stdout;
  if (!(got > secs - 0.2)) throw new Error('the GIF runs ' + got.toFixed(2) + ' s of the ' + secs.toFixed(2) + ' s recorded');
  fs.renameSync(tmp, out);
  return { frames: seq.length, secs };
}

async function recordScenes(scenes, names, outDir) {
  if (spawnSync('ffmpeg', ['-version']).status !== 0) {
    console.error('readme_gifs needs ffmpeg on the PATH (brew install ffmpeg)');
    return 1;
  }
  names = names.length ? names : Object.keys(scenes);
  const unknown = names.filter(n => !scenes[n]);
  if (unknown.length) {
    console.error('unknown GIF: ' + unknown.join(', ') + '; choose from ' + Object.keys(scenes).join(', '));
    return 1;
  }
  const server = await serve();
  const base = 'http://127.0.0.1:' + server.address().port + '/index.html';
  const browser = await chromium.launch();
  let failed = 0;
  try {
    for (const name of names) {
      const scene = scenes[name];
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'readme-gif-'));
      const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2, colorScheme: 'light', acceptDownloads: true });
      try {
        await ctx.addInitScript(() => { try { localStorage.setItem('dbx-arch-tour-v1', '1'); localStorage.setItem('dbx-arch-theme', 'light'); } catch (e) {} });
        await ctx.addInitScript(cursorOverlay);
        const page = await ctx.newPage();
        const errors = [];
        page.on('pageerror', e => errors.push(String(e)));
        await page.goto(base + scene.q, { waitUntil: 'networkidle', timeout: 90000 });
        await page.waitForFunction(() => typeof nameIndex !== 'undefined' && Object.keys(nameIndex).length > 10, null, { timeout: 60000 });
        await boardReady(page);
        await page.addStyleTag({ content: FREEZE });
        await page.waitForTimeout(1600);
        const out = path.join(outDir, name + '.gif');
        const tl = await record(page, scene, dir);
        if (errors.length) throw new Error('page errors: ' + errors.slice(0, 3).join(' | '));
        const r = encode(tl, dir, out, scene.crop);
        console.log(name + '.gif  ' + (fs.statSync(out).size / 1e6).toFixed(2) + ' MB  ' + r.frames + ' frames  ' + r.secs.toFixed(1) + ' s');
      } catch (e) {
        failed++;
        console.error(name + '.gif  FAILED  ' + e.message.split('\n')[0]);
      } finally {
        await ctx.close();
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
  } finally {
    await browser.close();
    server.close();
  }
  return failed ? 1 : 0;
}

module.exports = { SCENES, recordScenes };

if (require.main === module) recordScenes(SCENES, process.argv.slice(2), DOCS).then(code => process.exit(code));
