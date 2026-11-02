/*
  Architecture descriptor schema transform — the single source of truth for
  converting between the terse on-runtime object the renderer consumes and the
  readable YAML descriptor authors edit. Used by the browser (download/import +
  loadIndustry) and by the Node build/gates, so it is authored as a UMD module.

  The canonical on-disk format is now the readable descriptor (architectures/*.yaml);
  toTerse() rehydrates the exact structure the renderer and build_i18n expect, and
  toReadable() produces the descriptor for download. The pair is LOSSLESS:
  toTerse(toReadable(d)) deep-equals d for every board (proved by
  tools/verify_arch_schema.js over all boards).

  Readable top level (what an author sees):
    name, description,
    sources, cloud_integrations, pipelines, consumers   # each: [ {name, icon, from?, tail?, simplified?, tiles:[...]} ]
    agent_usecases                                       # [ {name, icon, span, cols, tiles:[...]} ]
    medallion: { Bronze|Silver|Gold: {short, summary} }
    citation_index: { <slug>: {title, url} }

  Each tile: name, icon, what_it_is, who_uses_it, summary, category, data_out,
  citations, problem, who_benefits, how_built, components, kpis, questions, feeds,
  teams, stories, accelerator?, connector? … (fields present depend on tile role).

  terse -> readable rails/top mapping:
    label->name, blurb->description,
    rails.src->sources, rails.ing->cloud_integrations, rails.ppl->pipelines,
    rails.cons->consumers, top->agent_usecases, sources(map)->citation_index.
*/
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.ArchSchema = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Bijective tile/leaf key map (terse -> readable). Group `box`, section `title`,
  // root and rails/medallion keys are handled structurally, NOT here, so `name`
  // (from tile `n`) never collides with a group/section name on the reverse pass.
  var TILE_MAP = {
    n: 'name', ic: 'icon', long: 'summary', what: 'what_it_is', users: 'who_uses_it',
    cat: 'category', cite: 'citations', dataOut: 'data_out', problem: 'problem',
    who: 'who_benefits', how: 'how_built', comps: 'components', s: 'short',
    stories: 'stories', kpis: 'kpis', teams: 'teams', feeds: 'feeds', questions: 'questions',
    mark: 'mark', uses: 'uses', sub: 'sub', ucs: 'ucs', cares: 'cares', caps: 'capabilities',
    rel: 'related', vol: 'volume', types: 'types', interval: 'interval', t: 'title', u: 'url',
    // Per-tile accelerator/connector overrides (accelFor/connectorFor read these).
    // No board carries them today; download enrichment resolves + embeds them so an
    // author sees/edits them, and upload feeds them straight back through. Their
    // inner note/slug/url keys pass through renameDeep unchanged.
    accel: 'accelerator', conn: 'connector'
  };
  var TILE_REV = {}; for (var k in TILE_MAP) TILE_REV[TILE_MAP[k]] = k;

  // Recursively rename object keys through `map`, preserving arrays, nested arrays
  // (uses = [[id, prose]]) and scalars. Batch/stream/slug keys not in the map pass
  // through unchanged, which is still lossless because both directions pass them.
  function renameDeep(v, map) {
    if (v === null || typeof v !== 'object') return v;
    if (Array.isArray(v)) return v.map(function (x) { return renameDeep(x, map); });
    var o = {};
    for (var key in v) { o[map[key] != null ? map[key] : key] = renameDeep(v[key], map); }
    return o;
  }
  var tileToY = function (t) { return renameDeep(t, TILE_MAP); };
  var tileToT = function (t) { return renameDeep(t, TILE_REV); };

  function groupToY(g) {
    var o = { name: g.box, icon: g.ic };
    if ('from' in g) o.from = g.from;
    if ('tail' in g) o.tail = g.tail;
    if ('simple' in g) o.simplified = g.simple;
    o.tiles = (g.tiles || []).map(tileToY);
    return o;
  }
  function groupToT(y) {
    var g = { box: y.name, ic: y.icon };
    if ('from' in y) g.from = y.from;
    if ('tail' in y) g.tail = y.tail;
    if ('simplified' in y) g.simple = y.simplified;
    g.tiles = (y.tiles || []).map(tileToT);
    return g;
  }
  function sectionToY(s) { return { name: s.title, icon: s.ic, span: s.span, cols: s.cols, tiles: (s.tiles || []).map(tileToY) }; }
  function sectionToT(y) { return { title: y.name, ic: y.icon, span: y.span, cols: y.cols, tiles: (y.tiles || []).map(tileToT) }; }
  // medallion + citation_index: preserve top-level keys (Bronze.../slugs) verbatim,
  // rename only the leaf entries.
  function mapVals(obj, fn) { var o = {}; for (var key in obj) o[key] = fn(obj[key]); return o; }

  function toReadable(d) {
    var r = d.rails || {};
    var out = {
      name: d.label,
      description: d.blurb,
      sources: (r.src || []).map(groupToY),
      cloud_integrations: (r.ing || []).map(groupToY),
      pipelines: (r.ppl || []).map(groupToY),
      consumers: (r.cons || []).map(groupToY),
      agent_usecases: (d.top || []).map(sectionToY),
      medallion: mapVals(d.medallion || {}, tileToY),
      citation_index: mapVals(d.sources || {}, tileToY)
    };
    return out;
  }
  function toTerse(y) {
    return {
      label: y.name,
      blurb: y.description,
      medallion: mapVals(y.medallion || {}, tileToT),
      rails: {
        src: (y.sources || []).map(groupToT),
        ing: (y.cloud_integrations || []).map(groupToT),
        ppl: (y.pipelines || []).map(groupToT),
        cons: (y.consumers || []).map(groupToT)
      },
      top: (y.agent_usecases || []).map(sectionToT),
      sources: mapVals(y.citation_index || {}, tileToT)
    };
  }

  return { toReadable: toReadable, toTerse: toTerse, TILE_MAP: TILE_MAP };
});
