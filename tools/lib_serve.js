'use strict';
/*
  Shared static server for the Playwright gates. Serves app/ with the production
  server's semantics (app/main.py): a known file is returned with its MIME type;
  any unknown path returns index.html as HTML/200 (the single-page fallback), so
  the loadIndustry content-type guard is exercised for a bad industry id.

  Since the data-modularisation split, industries and resources are fetched from
  architectures/*.json and resources/*.json. `fetch()` does not work on file://,
  so every gate that drives industry loading MUST serve over HTTP through this
  helper instead of opening index.html directly. Kept in one place so the four
  gates and the smoke tests share identical serving behaviour.
*/
const http = require('http');
const fs = require('fs');
const path = require('path');

const APP_ROOT = path.join(__dirname, '..', 'app');
const MIME = { '.html': 'text/html', '.json': 'application/json', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.yaml': 'text/yaml', '.yml': 'text/yaml', '.png': 'image/png' };

// Start a server on an ephemeral port. Resolves to the http.Server; read its
// port via server.address().port. Close it with server.close() when done.
function serve(root) {
  const base = root || APP_ROOT;
  return new Promise(res => {
    const s = http.createServer((req, r) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/index.html';
      const fp = path.join(base, p);
      fs.readFile(fp, (e, d) => {
        if (e) { // production fallback: any unknown path is the single page
          r.writeHead(200, { 'Content-Type': 'text/html' });
          r.end(fs.readFileSync(path.join(base, 'index.html')));
          return;
        }
        r.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
        r.end(d);
      });
    });
    s.listen(0, () => res(s));
  });
}

function boardReady(page) {
  return page.waitForFunction(() => document.body && document.body.dataset.intro === 'done', null, { timeout: 20000 });
}

const VIEWS = ['simple', 'detailed'];
function withView(q, view) {
  if (view !== 'detailed') return q;
  const bare = !q.includes('?') && !q.includes('/');
  return q + (bare ? (q ? '&' : '') : (q.includes('?') ? '&' : '?')) + 'view=detailed';
}

const DECK_CHIP_PT = 7;
function headChipRatio() {
  const own = e => { const fitted = e.style.fontSize; e.style.fontSize = ''; const v = parseFloat(getComputedStyle(e).fontSize); e.style.fontSize = fitted; return v; };
  const pn = [...document.querySelectorAll('.board .panel.stack')].find(p => p.offsetParent && p.querySelector('.ph-name') && p.querySelector('.tagpill'));
  return pn ? own(pn.querySelector('.ph-name')) / Math.max(...[...pn.querySelectorAll('.tagpill')].filter(e => e.offsetParent).map(own)) : 0;
}
function deckChipAudit([want, kind, ratio]) {
  const out = [], board = document.querySelector('.board');
  const kpt = EXPORT_PT[kind](board.offsetWidth, board.offsetHeight), page = kind === 'pdf' ? 'the PDF page' : 'the slide';
  const chips = [...board.querySelectorAll('.panel.stack .tagpill')].filter(e => e.offsetParent && e.getClientRects().length);
  if (!chips.length) out.push('no Genie or Agent Bricks chips to measure');
  chips.forEach(p => {
    const name = p.textContent.trim(), pt = parseFloat(getComputedStyle(p).fontSize) * kpt;
    if (Math.round(pt * 100) !== Math.round(want * 100)) out.push(`chip '${name}' reaches ${page} at ${pt.toFixed(2)}pt, not ${want}pt`);
    const txt = [...p.childNodes].find(n => n.nodeType === 3 && n.textContent.trim());
    const r = p.getBoundingClientRect(), pn = p.closest('.panel').getBoundingClientRect();
    if (txt) {
      const rg = document.createRange(); rg.selectNodeContents(txt);
      const t = rg.getBoundingClientRect();
      const over = Math.max(r.left - t.left, t.right - r.right, r.top - t.top, t.bottom - r.bottom);
      if (over > 0.5) out.push(`chip '${name}' text runs ${over.toFixed(1)}px past its rectangle`);
    }
    if (r.left < pn.left - 0.5 || r.right > pn.right + 0.5 || r.top < pn.top - 0.5 || r.bottom > pn.bottom + 0.5) out.push(`chip '${name}' sticks out of its panel`);
  });
  new Set(chips.map(p => p.closest('.panel'))).forEach(pn => {
    const head = pn.querySelector('.ph-name');
    if (!head) return out.push('a Genie or Agent Bricks panel has no name to measure');
    const hp = parseFloat(getComputedStyle(head).fontSize) * kpt;
    const cp = Math.max(...chips.filter(p => p.closest('.panel') === pn).map(p => parseFloat(getComputedStyle(p).fontSize) * kpt));
    if (hp <= cp) out.push(`'${head.textContent.trim()}' reaches ${page} at ${hp.toFixed(1)}pt, no larger than its ${cp.toFixed(1)}pt chips`);
    else if (!(ratio > 0)) out.push(`no screen proportion of '${head.textContent.trim()}' to its chips to hold ${page} to`);
    else if (hp / cp < ratio - 0.01) out.push(`'${head.textContent.trim()}' reaches ${page} at ${hp.toFixed(1)}pt over ${cp.toFixed(1)}pt chips, ${(hp / cp).toFixed(2)} times their size where the screen shows ${ratio.toFixed(2)}`);
  });
  return out;
}

module.exports = { serve, boardReady, withView, VIEWS, APP_ROOT, MIME, DECK_CHIP_PT, headChipRatio, deckChipAudit };
