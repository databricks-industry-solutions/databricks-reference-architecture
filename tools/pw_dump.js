#!/usr/bin/env node
/* The dump linkgate.py gates on: serves app/ over HTTP (lib_serve), loads
 * index.html in Playwright's own isolated Chromium (never the user's default
 * Chrome profile, which locks --headless=new on this machine), loads EVERY
 * industry board, and extracts { LINKS, prodNames, personas, genSrc, genBoard, cloudNames, inds, chipAlias, chips, load_failed }
 * to the file given as argv[2]. PW_DUMP_URL (or argv[3]) points it at an
 * already running server instead. */
const { chromium } = require('playwright');
const fs = require('fs');
const { serve } = require('./lib_serve');

const OUT = process.argv[2] || '/tmp/gate_dump.json';

(async () => {
  const fixedUrl = process.argv[3] || process.env.PW_DUMP_URL;
  const server = fixedUrl ? null : await serve();
  const URL = fixedUrl || ('http://127.0.0.1:' + server.address().port + '/index.html');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newContext().then(c => c.newPage());
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message)));
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
  const loadFailed = await page.evaluate(async () => {
    const failed = [];
    for (const row of INDUSTRY_CATALOG) { if (!(await loadIndustry(row[0]))) failed.push(row[0]); }
    return failed;
  });
  const out = await page.evaluate(() => {
    function vol(t){ return t.dataOut && ((t.dataOut.batch&&t.dataOut.batch.vol)||(t.dataOut.stream&&t.dataOut.stream.vol)); }
    function srow(t){ return {n:t.n, fmt:!!t.fmt, what:!!t.what, users:!!t.users, dataOut:!!t.dataOut, vol:!!vol(t)}; }
    var out = { LINKS:{}, prodNames:[], genSrc:[], inds:{} };
    try { out.LINKS = (typeof LINKS!=='undefined') ? LINKS : {}; } catch(e){ out.links_error=String(e); }
    try {
      var seen={};
      (function walk(o){ if(!o||typeof o!=='object')return;
        if(typeof o.n==='string'){ seen[o.n]=1; }
        (Array.isArray(o)?o:Object.values(o)).forEach(walk); })(ARCH.bands);
      out.prodNames = Object.keys(seen);
    } catch(e){ out.prod_error=String(e); }
    try { (ARCH.rails.src.groups||[]).forEach(function(g){ (g.tiles||[]).forEach(function(t){ out.genSrc.push(srow(t)); }); }); } catch(e){ out.gen_error=String(e); }
    try {
      var ps={};
      (function walk(o){ if(!o||typeof o!=='object')return;
        if(typeof o.n==='string' && isPersonaTile(o)){ ps[o.n]=1; }
        (Array.isArray(o)?o:Object.values(o)).forEach(walk); })({ r:ARCH.rails, t:ARCH.top });
      out.personas = Object.keys(ps);
    } catch(e){ out.persona_error=String(e); }
    try {
      out.chipAlias = (typeof CHIP_ALIAS!=='undefined') ? CHIP_ALIAS : {};
      var chips={}, seenObj=new WeakSet();
      function addChip(v){ if(typeof v==='string' && v) chips[v]=1; }
      (function walk(o){ if(!o||typeof o!=='object'||seenObj.has(o))return; seenObj.add(o);
        if(!Array.isArray(o)){
          ['caps','caps2','rel'].forEach(function(k){ (Array.isArray(o[k])?o[k]:[]).forEach(addChip); });
          addChip(o.who);
          (Array.isArray(o.uses)?o.uses:[]).forEach(function(u){ addChip(Array.isArray(u)?u[0]:u); });
          if(o.dataOut) ['batch','stream'].forEach(function(k){ ((o.dataOut[k]&&o.dataOut[k].types)||[]).forEach(addChip); });
        }
        (Array.isArray(o)?o:Object.values(o)).forEach(walk); })({ a:ARCH, i:INDUSTRIES });
      out.chips = Object.keys(chips);
    } catch(e){ out.chip_error=String(e); }
    function teamRefs(rails, top, o){
      var names={}, tops={};
      ['src','ing','ppl','cons'].forEach(function(k){ ((rails&&rails[k])||[]).forEach(function(g){ (g.tiles||[]).forEach(function(t){ if(t&&typeof t.n==='string') names[t.n]=1; }); }); });
      (top||[]).forEach(function(s){ (s.tiles||[]).forEach(function(t){ if(t&&typeof t.n==='string'){ names[t.n]=1; tops[t.n]=1; } }); });
      o.names=Object.keys(names); o.top=Object.keys(tops); o.teams=[];
      ((rails&&rails.ppl)||[]).forEach(function(g){ (g.tiles||[]).forEach(function(t){ if(isPersonaTile(t)) o.teams.push({n:t.n, ucs:t.ucs||[], uses:personaProductNames(t)}); }); });
      return o;
    }
    try {
      out.genBoard = teamRefs({ src:ARCH.rails.src.groups, ing:ARCH.rails.ing.groups, ppl:ARCH.rails.ppl.groups, cons:ARCH.rails.cons.groups }, ARCH.top.secs, {});
      var cn={}; (function walk(o){ if(!o||typeof o!=='object')return; if(typeof o.n==='string') cn[o.n]=1; (Array.isArray(o)?o:Object.values(o)).forEach(walk); })(ARCH.cloud);
      out.cloudNames = Object.keys(cn);
    } catch(e){ out.team_error=String(e); }
    try {
      Object.keys(INDUSTRIES).forEach(function(id){
        var ind=INDUSTRIES[id], o={uc:[], src:[], cites:[]};
        teamRefs(ind.rails, ind.top, o);
        ((ind.rails&&ind.rails.src)||[]).forEach(function(g){ (g.tiles||[]).forEach(function(t){ o.src.push(srow(t)); }); });
        (ind.top||[]).forEach(function(s){ if(/Business Use Cases|Use Cases/i.test(s.title)){ (s.tiles||[]).forEach(function(t){
          o.uc.push({n:t.n, stories:(t.stories||[]).map(function(x){return x.u;})}); }); } });
        var src=ind.sources||{}; Object.keys(src).forEach(function(k){ if(src[k]&&src[k].u) o.cites.push(src[k].u); });
        out.inds[id]=o;
      });
    } catch(e){ out.ind_error=String(e); }
    return out;
  });
  out.load_failed = loadFailed;
  await browser.close();
  if (server) server.close();
  if (errs.length) process.stderr.write('PAGE ERRORS: ' + JSON.stringify(errs.slice(0, 5)) + '\n');
  fs.writeFileSync(OUT, JSON.stringify(out));
  process.stderr.write(`dump written: ${OUT}  LINKS=${Object.keys(out.LINKS).length} prod=${out.prodNames.length} inds=${Object.keys(out.inds).length} load_failed=${loadFailed.length}\n`);
  if (out.links_error || out.prod_error || out.ind_error || out.persona_error || out.chip_error || out.team_error)
    process.stderr.write('EXTRACT ERRORS: ' + JSON.stringify({l:out.links_error,p:out.prod_error,i:out.ind_error,t:out.persona_error,c:out.chip_error,r:out.team_error}) + '\n');
})();
