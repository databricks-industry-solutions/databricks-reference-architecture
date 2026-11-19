/* Inject the assistant DOM into <body> at runtime. Done here (not spliced as
   HTML) so it lands reliably regardless of the shared board's markup, and so
   the elements exist before the wiring below reads them. */
document.body.insertAdjacentHTML("beforeend", `

<!-- ===================== AI Architecture Assistant ===================== -->
<button class="ai-fab" id="ai-fab" title="Tailor this architecture to a customer with AI">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 4.6L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5 10.1 7.6z"/><path d="M18 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/></svg>
  Ask AI
</button>

<section class="ai-panel" id="ai-panel" aria-label="AI architecture assistant">
  <div class="ai-head">
    <span class="ai-logo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 4.6L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5 10.1 7.6z"/></svg></span>
    <div>
      <h4>Architecture Assistant</h4>
      <div class="ai-conn"><span class="ai-dot" id="ai-dot"></span> <span id="ai-conn-txt">checking…</span></div>
    </div>
    <button class="ai-x" id="ai-x" title="Close">✕</button>
  </div>
  <div class="ai-msgs" id="ai-msgs"></div>
  <div class="ai-sugg" id="ai-sugg">
    <button data-q="Design a real-time fraud detection solution for a retail bank.">Fraud detection</button>
    <button data-q="Map a customer 360 and churn prediction use case.">Customer 360</button>
    <button data-q="Show an agentic RAG assistant over enterprise documents.">Agentic RAG</button>
  </div>
  <div class="ai-foot">
    <select id="ai-model" class="ai-model-sel" title="Model — Fast is quickest, Thinking is most capable">
      <option value="fast">Fast · Haiku 4.5</option>
      <option value="balanced">Balanced · Sonnet 5</option>
      <option value="thinking" selected>Thinking · Opus 5</option>
    </select>
    <a id="ai-edit-toggle" hidden style="margin-left:auto">✎ Editing: on</a>
    <a id="ai-clear">Clear highlight</a>
  </div>
  <div class="ai-indhint" id="ai-indhint" hidden></div>
  <div class="ai-attach" id="ai-attach" hidden></div>
  <div class="ai-input">
    <button class="ai-attach-btn" id="ai-attach-btn" title="Attach image, PDF, or text — or paste a screenshot">📎</button>
    <input type="file" id="ai-file" accept="image/*,.pdf,.txt,.md,.markdown,.csv,text/*" multiple hidden>
    <textarea id="ai-text" rows="1" placeholder="Describe your use case — or attach/paste a diagram or doc…"></textarea>
    <button class="ai-send" id="ai-send" title="Send">➤</button>
  </div>
</section>
`);

/* ==================================================================
   10. AI ARCHITECTURE ASSISTANT
   Describe a customer / use case and the model builds a tailored
   architecture as a new tab. Two-phase: phase-1 detects the industry
   on the generic catalog; if an industry is detected, phase-2
   re-grounds selection on that industry's own board.
   Connection: the app backend /generate (served by this app's FastAPI process,
   which calls the Databricks-hosted model under the App service principal). If
   the backend is unreachable the assistant reports an error — there is no
   third-party fallback.
   ================================================================== */
/* Selectable model tiers. Discovered at runtime from the backend /models
   endpoint (the newest Claude opus/sonnet/haiku on the workspace), so a new
   Claude version is picked up with no code change. This list is the static
   fallback used only to populate the picker when /models can't be reached.
   `endpoint` is the Databricks serving endpoint. */
let AI_MODELS = [
  { id:"fast",     tier:"Fast",     endpoint:"databricks-claude-haiku-4-5", default:false },
  { id:"balanced", tier:"Balanced", endpoint:"databricks-claude-sonnet-5",  default:false },
  { id:"thinking", tier:"Thinking", endpoint:"databricks-claude-opus-5",    default:true  },
];
const AI_MODEL_KEY = "dbxarch.dais2026.aimodel";
function aiDefaultModelId(){ const d = AI_MODELS.find(m=>m.default); return d ? d.id : (AI_MODELS[0] && AI_MODELS[0].id) || "thinking"; }
function aiModelLabel(m){
  const rest = (m.endpoint||"").replace(/^databricks-claude-/,"");
  if(!rest) return m.tier;
  const i = rest.indexOf("-");
  const fam = (i<0 ? rest : rest.slice(0,i));
  const ver = (i<0 ? "" : rest.slice(i+1).replace(/-/g,"."));   // "4-5" -> "4.5"
  const pretty = fam.replace(/\b\w/g,c=>c.toUpperCase()) + (ver ? " "+ver : "");
  return m.tier + " · " + pretty;
}
let aiModelId = (function(){
  const s = store.get(AI_MODEL_KEY);
  return AI_MODELS.some(m=>m.id===s) ? s : aiDefaultModelId();
})();
/* Rebuild the picker <option>s from AI_MODELS and keep the selection valid. */
function aiRenderModelOptions(){
  const sel = aiEls && aiEls.model; if(!sel) return;
  sel.innerHTML = "";
  AI_MODELS.forEach(m=>{ const o = document.createElement("option"); o.value = m.id; o.textContent = aiModelLabel(m); sel.appendChild(o); });
  if(!AI_MODELS.some(m=>m.id===aiModelId)) aiModelId = aiDefaultModelId();
  sel.value = aiModelId;
}
/* Fetch the live tiers from the backend and rebuild the picker. If the user has
   not explicitly picked (nothing stored), follow the server's default tier. */
async function aiLoadModels(){
  try{
    const r = await fetch("/models"); if(!r.ok) return;
    const d = await r.json();
    if(!Array.isArray(d.models) || !d.models.length) return;
    AI_MODELS = d.models.map(m=>({ id:m.id, tier:m.label||m.id, endpoint:m.endpoint||"", default:!!m.default }));
    const stored = store.get(AI_MODEL_KEY);
    if(!AI_MODELS.some(m=>m.id===stored)) aiModelId = aiDefaultModelId();
    aiRenderModelOptions();
  }catch(_){ /* keep the static fallback */ }
}
const aiState = { busy:false, bridge:false, history:[] };

/* ------------------------------------------------------------------
   Board-transform helpers (Task 5)
   ------------------------------------------------------------------ */

/* Pure, synchronous industry overlay. Assumes INDUSTRIES[id] already
   loaded by caller (via await loadIndustry). Mutates `fields` in place;
   no build/persist/side-effects. Mirrors the field-mutation body of the
   base's async applyIndustry (lines ~3946-3987 of app/index.html). */
function applyIndustryTo(fields, id){
  const ind = INDUSTRIES[id];
  const fresh = JSON.parse(JSON.stringify(BASE));
  fields.rails = fresh.rails;
  fields.top   = fresh.top;
  /* Reset only medallion stages from BASE, not whole bands. */
  const baseStages = (function(){
    for(const band of fresh.bands){
      for(const row of (band.rows || [])){
        if(row.kind === "medallion" && Array.isArray(row.stages)) return row.stages;
      }
    }
    return null;
  })();
  const stages = (function(){
    for(const band of fields.bands){
      for(const row of (band.rows || [])){
        if(row.kind === "medallion" && Array.isArray(row.stages)) return row.stages;
      }
    }
    return null;
  })();
  if(stages && baseStages){
    stages.forEach((st, i)=>{
      const b = baseStages[i];
      if(b){ st.s = b.s; st.long = b.long; }
    });
  }
  fields.industry = ind ? id : "generic";
  if(ind){
    if(ind.rails){
      RAIL_IDS.forEach(rid=>{
        if(Array.isArray(ind.rails[rid])) fields.rails[rid].groups = JSON.parse(JSON.stringify(ind.rails[rid]));
      });
    }
    if(Array.isArray(ind.top)){
      fields.top.secs = JSON.parse(JSON.stringify(ind.top));
      if(typeof prioritiseUseCases === "function") prioritiseUseCases(fields.top.secs);
    }
    if(ind.blurb) fields.top.sub = ind.blurb;
    if(ind.medallion && stages){
      stages.forEach(st=>{
        const o = ind.medallion[st.n];
        if(o){ if(o.s) st.s = o.s; if(o.long) st.long = o.long; }
      });
    }
  }
}

/* Async: load the industry if needed, then return a deep-cloned arch
   snapshot with that industry's overlay applied. Never mutates the live
   board or refSnap. Returns null if the industry cannot be loaded. */
async function industryArch(id){
  if(!(await loadIndustry(id))) return null;
  const src = refSnap || boardSnapshot();
  const clone = JSON.parse(JSON.stringify({ bands:src.bands, rails:src.rails, top:src.top, cloud:src.cloud }));
  applyIndustryTo(clone, id);
  clone.industry = id;
  return { schema:SCHEMA, industry:id, bands:clone.bands, rails:clone.rails, top:clone.top, cloud:clone.cloud };
}

/* Keep only selected atoms. `selected` is a Set of name/cloud:role strings.
   `base` is an optional arch snapshot (e.g. from industryArch); falls back
   to refSnap then boardSnapshot — never a CANON global. */
function filterArch(selected, base){
  const src = base || refSnap || boardSnapshot();
  const clone = JSON.parse(JSON.stringify({ bands:src.bands, rails:src.rails, top:src.top, cloud:src.cloud }));
  const keepTile = t => t && typeof t.n === "string" &&
    (selected.has(t.n) || (t.role && selected.has("cloud:" + t.role)));
  const isAtomArray = arr => Array.isArray(arr) && arr.some(x => x && typeof x === "object" && typeof x.n === "string");
  const walk = node => {
    let kept = false;
    if(Array.isArray(node)){
      if(isAtomArray(node)){
        for(let i = node.length - 1; i >= 0; i--){
          if(node[i] && typeof node[i].n === "string"){
            if(keepTile(node[i])) kept = true; else node.splice(i, 1);
          } else if(walk(node[i])) kept = true;
        }
      } else {
        for(let i = node.length - 1; i >= 0; i--){ if(walk(node[i])) kept = true; }
      }
    } else if(node && typeof node === "object"){
      for(const k of Object.keys(node)){ if(walk(node[k])) kept = true; }
    }
    return kept;
  };
  /* Trim only Sources (src) and Consumers (cons) to the ones this use case uses.
     The platform bands, ingestion, People and Apps/Use Cases are kept WHOLE — the
     generated tab dims their unused products (see paintRef __tab__) rather than
     removing them, so the full Databricks platform stays visible. */
  ["src","cons"].forEach(rid => {
    const rail = clone.rails[rid]; if(!rail) return;
    rail.groups = (rail.groups || []).filter(g => walk(g));
  });
  return { schema:SCHEMA, industry:(src.industry || "generic"), bands:clone.bands, rails:clone.rails, top:clone.top, cloud:clone.cloud };
}

/* Real, highlightable component names grouped by section. Built from byId
   (post-build) so it always matches the live board + current cloud provider. */
function componentCatalog(){
  const bySection = new Map();
  const seen = new Set();
  Object.values(byId).forEach(rec=>{
    const name = rec.tile && rec.tile.n; if(!name) return;
    const key = rec.section || "Platform";
    if(!bySection.has(key)) bySection.set(key, []);
    const tag = key + " " + name;
    if(seen.has(tag)) return; seen.add(tag);
    bySection.get(key).push(name);
  });
  return [...bySection.entries()].map(([sec, names])=> `  ${sec}: ${names.join(" | ")}`).join("\n");
}

/* Component catalog built from an arbitrary arch object (e.g. an industry board),
   not the live byId. */
function catalogFromArch(arch){
  const lines = [];
  const names = node => { const out = []; (function walk(n){
    if(Array.isArray(n)) n.forEach(walk);
    else if(n && typeof n === "object"){
      if(typeof n.n === "string") out.push(n.n);
      Object.keys(n).forEach(k=>{ if(k!=="n") walk(n[k]); });
    }
  })(node); return [...new Set(out)]; };
  (arch.bands||[]).forEach(b=>{ const ns = names(b); if(ns.length) lines.push(`  ${b.name||b.id}: ${ns.join(" | ")}`); });
  ["src","ing","ppl","cons"].forEach(rid=>{ const rail = arch.rails && arch.rails[rid]; if(!rail) return;
    const ns = names(rail.groups); if(ns.length) lines.push(`  ${rail.name||rid}: ${ns.join(" | ")}`); });
  if(arch.top && Array.isArray(arch.top.secs)){ const ns = names(arch.top.secs); if(ns.length) lines.push(`  Apps & Use Cases: ${ns.join(" | ")}`); }
  if(arch.cloud){ const ns = names([arch.cloud.extras, arch.cloud.providers]); if(ns.length) lines.push(`  Cloud Services & Integrations: ${ns.join(" | ")}`); }
  return lines.join("\n");
}

/* The set of names (and cloud:<role> handles) an arch actually contains. */
function archAtomSet(arch){
  const set = new Set();
  (function walk(n){
    if(Array.isArray(n)) n.forEach(walk);
    else if(n && typeof n === "object"){
      if(typeof n.n === "string") set.add(n.n);
      if(typeof n.role === "string") set.add("cloud:" + n.role);
      Object.keys(n).forEach(k=> walk(n[k]));
    }
  })({ bands:arch.bands, rails:arch.rails, top:arch.top, cloud:arch.cloud });
  return set;
}

/* Industry ids the model may pick from — only those actually built.
   INDUSTRY_BUILT is a Set loaded from architectures/manifest.json, or null if
   the manifest is missing (treat all catalog entries as candidates). */
function industryPromptList(){
  return INDUSTRY_CATALOG
    .filter(([id]) => INDUSTRY_BUILT === null || INDUSTRY_BUILT.has(id))
    .map(([id, label]) => `  ${id} — ${label}`)
    .join("\n");
}

function aiSystemPrompt(catalogText){
  const cat = catalogText || componentCatalog();
  return `You are a Databricks solutions architect helping a colleague tailor a Databricks Data Intelligence Platform reference architecture to a customer's needs.

You are given a fixed catalog of architecture COMPONENTS (below), organized by section. The sections span the whole board: the platform bands, the Apps & Use Cases band, the Sources / Cloud & 3rd-Party Ingestion / People / Consumers boxes, and the Cloud Services & Integrations band. Your job: from the user's description of a customer / use case / data, decide which components across ALL sections are relevant, and explain briefly how each is used for THIS solution. You do not invent or rename Databricks PLATFORM products — reference those by their exact catalog names only. The customer's own sources, consumers and external/3rd-party systems are taken FAITHFULLY from what they describe or show (see RULES).

COMPONENTS (grouped by section):
${cat}

INDUSTRIES (pick the single best-matching id for the customer, or "" if none clearly applies):
${industryPromptList()}

Respond with ONLY a single JSON object (no prose, no markdown fences), shaped exactly:
{
  "reply": "1-3 sentence conversational message to the user about what you highlighted or answering their question",
  "title": "<Customer or use-case> — <short solution name>",
  "blurb": "one sentence describing the solution flow",
  "industry": "<one industry id from the list above, or empty string if none clearly fits>",
  "components": [
    { "name": "<EXACT catalog name, OR the customer's own label for a source/consumer not in the catalog>",
      "custom": false,  "section": "<ONLY for custom items (custom:true): Sources | Cloud & 3rd-Party Ingestion | People | Consumers | Cloud Services>",
      "notes": ["short phrase on how it is used here", "optional 2nd phrase"] }
  ]
}

RULES:
- If the user attaches an image (architecture diagram, whiteboard photo, screenshot) or a document, read it carefully and enumerate EVERY labelled box in it — especially every Source and every Consumer — before you decide. Your architecture must account for ALL of them.
- Databricks PLATFORM components: use ONLY exact names from the catalog; never invent or rename a Databricks product. Drop a platform name only if it has no catalog match.
- The customer's own SOURCES, CONSUMERS and TEAMS/people: represent EVERY one the user shows or names — never drop or silently replace them. STRONGLY PREFER mapping each to the closest existing catalog category — the Sources, Consumers and Teams bands use broad, generic categories that cover virtually ANY real system, so you can almost always find a fit — and put the specific system name(s) in that box's notes. Examples: state/registry/operational systems -> "Operational Databases" (notes ["EVERS birth/death registry"]); packaged apps/ERP/CRM -> "Business Applications"; HL7/XML/CSV or other files -> "Files & Object Stores"; healthcare records -> "FHIR · Healthcare"; service/REST APIs -> "APIs & Webhooks"; partner/agency feeds -> "Partner Feeds"; open/public data -> "Public & Open Data". Mapping is the DEFAULT and renders on the board. Emit a custom box (custom:true, exact name, section) ONLY as a genuine last resort when no category plausibly fits. Do NOT invent sources, consumers or teams the user did not show.
- The SOURCES band is the customer's ORIGINATING systems (where the data is born) — ALWAYS populate it from the sources the user shows/describes; never leave Sources empty when the user named sources. Map each to a Sources-band category (state/registry/operational systems -> "Operational Databases" or "Business Applications"; HL7/XML/CSV or other files -> "Files & Object Stores"; healthcare records -> "FHIR · Healthcare"; service/REST APIs -> "APIs & Webhooks"; partner/agency feeds -> "Partner Feeds"; public/open data -> "Public & Open Data"), or a custom box with section "Sources" if nothing fits. The External / 3rd-Party Ingestion band is ingestion TOOLING/CONNECTORS (Lakeflow Connect, Auto Loader, cloud/3rd-party connectors) — it is NOT a substitute for the Sources band; do not represent originating sources only there.
- Include the relevant Sources / ingestion / People / Consumers / Cloud Services components that surround this use case — not just the platform bands.
- Pick the components that genuinely matter (typically 8-18 across all sections) — do not select everything.
- Each component gets 1-2 concise usage notes specific to this customer/use case.
- For a follow-up that refines the current solution, return the FULL updated component set (not just the delta).
- If the user only asks a question and no change is needed, return "components": [] and keep "reply" helpful.
- Set "industry" to the ONE id that best fits the customer's sector; use "" (empty) if the description is generic or spans many. Never invent an id.
- Return ONLY the JSON object.`;
}

function aiExtractJson(text){
  let t = String(text).trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if(fence) t = fence[1].trim();
  if(t[0] !== "{"){ const a=t.indexOf("{"), b=t.lastIndexOf("}"); if(a>=0&&b>a) t=t.slice(a,b+1); }
  return JSON.parse(t);
}

async function aiBridgeHealthy(){
  try{ const r = await fetch("/health"); if(!r.ok) return false; const d = await r.json(); return !!d.ok; }
  catch(_){ return false; }
}
async function aiCallBridge(system, user){
  const r = await fetch("/generate", { method:"POST", headers:{"content-type":"application/json"},
    body: JSON.stringify({ model:aiModelId, system, user }) });
  if(!r.ok){ let m=r.status+" "+r.statusText; try{const e=await r.json(); if(e.error)m=e.error;}catch(_){} throw new Error(m); }
  return (await r.json()).text || "";
}
/* ----- chat UI ----- */
const aiEls = {
  fab: document.getElementById("ai-fab"), panel: document.getElementById("ai-panel"),
  msgs: document.getElementById("ai-msgs"), text: document.getElementById("ai-text"),
  send: document.getElementById("ai-send"), dot: document.getElementById("ai-dot"),
  conn: document.getElementById("ai-conn-txt"), sugg: document.getElementById("ai-sugg"),
  model: document.getElementById("ai-model"),
  attach: document.getElementById("ai-attach"), attachBtn: document.getElementById("ai-attach-btn"),
  file: document.getElementById("ai-file"),
};
if(aiEls.model){
  aiRenderModelOptions();                 // static fallback first, so the picker is never empty
  aiEls.model.addEventListener("change", ()=>{
    aiModelId = aiEls.model.value;
    store.set(AI_MODEL_KEY, aiModelId);
  });
  aiLoadModels();                         // then replace with the live tiers from the backend
}

/* ------------------------------------------------------------------
   Attachments — images (PNG/JPG, incl. pasted screenshots), PDFs, and
   text/markdown/csv. Images ride along as vision content blocks; text
   and extracted-PDF text fold into the prompt. Pending items live in
   aiAttach until the next send, then clear.
   ------------------------------------------------------------------ */
let aiAttach = [];
const AI_MAX_ATTACH = 5, AI_IMG_MAXDIM = 1568, AI_DOC_MAXCHARS = 20000;

/* Downscale + re-encode an image blob to a JPEG data URL (caps token cost). */
function aiDownscaleImage(blob){
  return new Promise(res=>{
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = ()=>{
      let w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
      const scale = Math.min(1, AI_IMG_MAXDIM / Math.max(w, h));
      w = Math.max(1, Math.round(w*scale)); h = Math.max(1, Math.round(h*scale));
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      c.getContext("2d").drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      try{ res(c.toDataURL("image/jpeg", 0.92)); }catch(_){ res(null); }
    };
    img.onerror = ()=>{ URL.revokeObjectURL(url); res(null); };
    img.src = url;
  });
}

/* Lazy-load pdf.js (UMD build) from the CDN only when a PDF is attached. */
let _aiPdfjsP = null;
function aiLoadPdfjs(){
  if(_aiPdfjsP) return _aiPdfjsP;
  _aiPdfjsP = new Promise((res, rej)=>{
    if(window.pdfjsLib) return res(window.pdfjsLib);
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    s.onload = ()=>{ try{
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      res(window.pdfjsLib);
    }catch(e){ rej(e); } };
    s.onerror = ()=> rej(new Error("Couldn't load the PDF reader (offline?). Paste the text instead."));
    document.head.appendChild(s);
  });
  return _aiPdfjsP;
}
async function aiPdfText(file){
  const lib = await aiLoadPdfjs();
  const buf = await file.arrayBuffer();
  const pdf = await lib.getDocument({ data: buf }).promise;
  let out = ""; const N = Math.min(pdf.numPages, 30);
  for(let i=1; i<=N; i++){
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    out += tc.items.map(it=>it.str).join(" ") + "\n";
    if(out.length > AI_DOC_MAXCHARS) break;
  }
  const t = out.trim().slice(0, AI_DOC_MAXCHARS);
  if(!t) throw new Error("No selectable text found in that PDF (it may be scanned). Try an image instead.");
  return t;
}

async function aiAddFiles(files){
  for(const f of files){
    if(aiAttach.length >= AI_MAX_ATTACH){ aiAddMsg("bot", `⚠ Up to ${AI_MAX_ATTACH} attachments at a time.`); break; }
    try{
      if((f.type||"").startsWith("image/")){
        const du = await aiDownscaleImage(f);
        if(du) aiAttach.push({ kind:"image", name:f.name||"image.png", thumb:du,
          mime:"image/jpeg", b64:du.split(",")[1], dataUrl:du });
      } else if((f.type==="application/pdf") || /\.pdf$/i.test(f.name||"")){
        const t = await aiPdfText(f);
        aiAttach.push({ kind:"text", name:f.name||"document.pdf", text:t });
      } else {
        const t = (await f.text()).slice(0, AI_DOC_MAXCHARS);
        aiAttach.push({ kind:"text", name:f.name||"file.txt", text:t });
      }
    }catch(err){ const m = aiAddMsg("bot", "⚠ "+err.message); m.className = "ai-msg err"; }
  }
  aiRenderAttach();
}

function aiRenderAttach(){
  const box = aiEls.attach; if(!box) return;
  box.innerHTML = ""; box.hidden = !aiAttach.length;
  aiAttach.forEach((a, i)=>{
    const chip = document.createElement("div"); chip.className = "ai-chip";
    if(a.kind === "image"){ const im = document.createElement("img"); im.src = a.thumb; im.alt = ""; chip.appendChild(im); }
    const nm = document.createElement("span"); nm.className = "nm"; nm.textContent = a.name; chip.appendChild(nm);
    const rm = document.createElement("button"); rm.className = "rm"; rm.textContent = "✕"; rm.title = "Remove";
    rm.onclick = ()=>{ aiAttach.splice(i, 1); aiRenderAttach(); };
    chip.appendChild(rm); box.appendChild(chip);
  });
}

/* Build the model-facing content for a turn: text alone (string, as before)
   or an array of content blocks when images are attached. `imgs` is the
   snapshot of image attachments for this send. */
function aiBridgeContent(text, imgs){
  if(!imgs.length) return text;
  return [{ type:"text", text }, ...imgs.map(im=>({ type:"image_url", image_url:{ url: im.dataUrl } }))];
}
if(aiEls.attachBtn){
  aiEls.attachBtn.onclick = ()=> aiEls.file.click();
  aiEls.file.onchange = ()=>{ if(aiEls.file.files.length) aiAddFiles(Array.from(aiEls.file.files)); aiEls.file.value = ""; };
  aiEls.text.addEventListener("paste", e=>{
    const items = e.clipboardData && e.clipboardData.items; if(!items) return;
    const imgs = [];
    for(const it of items){ if((it.type||"").startsWith("image/")){ const f = it.getAsFile(); if(f) imgs.push(f); } }
    if(imgs.length){ e.preventDefault(); aiAddFiles(imgs); }
  });
}
function aiAddMsg(role, text, applied){
  const d = document.createElement("div");
  d.className = "ai-msg " + role;
  d.textContent = text;
  if(applied && applied.count){ const a=document.createElement("div"); a.className="applied";
    a.textContent = `✦ Created tab "${applied.title}" with ${applied.count} component${applied.count>1?"s":""}${applied.industry ? " (" + industryLabel(applied.industry) + ")" : ""}.`; d.appendChild(a); }
  else if(applied){ const a=document.createElement("div"); a.className="applied";
    a.textContent = `✦ Applied ${applied} components.`; d.appendChild(a); }
  aiEls.msgs.appendChild(d);
  aiEls.msgs.scrollTop = aiEls.msgs.scrollHeight;
  return d;
}
function aiSetBusy(b){
  aiState.busy = b;
  aiEls.send.disabled = b;
  aiEls.dot.className = "ai-dot " + (b ? "busy" : (aiState.bridge ? "on" : ""));
}
async function aiRefreshConn(){
  aiState.bridge = await aiBridgeHealthy();
  aiEls.dot.className = "ai-dot " + (aiState.bridge ? "on" : "");
  aiEls.conn.textContent = aiState.bridge ? "model connected" : "offline — the app backend is not reachable";
}

function aiCreateTab(r, baseArch){
  const validSet = baseArch ? archAtomSet(baseArch) : null;
  const ok = name => validSet ? validSet.has(name) : !!resolveAtom(name);
  const selected = new Set();
  const notes = {};
  (r.components || []).forEach(c => {
    if(c && c.name && ok(c.name)){
      selected.add(c.name);
      const ns = Array.isArray(c.notes) ? c.notes.filter(Boolean) : (c.notes ? [String(c.notes)] : []);
      notes[c.name] = ns.length ? ns : ["Used in this solution."];
    }
  });
  /* Custom boxes: components the model marked custom (or that carry a section but
     have no catalog match) are the customer's own systems with no catalog fit —
     keep them as real boxes in the band they belong to instead of dropping them. */
  const SEC2RAIL = { "sources":"src","source":"src","consumers":"cons","consumer":"cons",
    "people":"ppl","teams":"ppl","team":"ppl","cloud & 3rd-party ingestion":"ing",
    "3rd-party ingestion":"ing","external ingestion":"ing","ingestion":"ing" };
  const customList = (r.components || []).filter(c =>
    c && c.name && !ok(c.name) && (c.custom === true || typeof c.section === "string"));
  const count = selected.size + customList.length;
  if(!count) return { count:0, title:"" };
  const snap = filterArch(selected, baseArch || null);
  if(customList.length){
    const byRail = {};
    customList.forEach(c => {
      const rid = SEC2RAIL[String(c.section || "Sources").trim().toLowerCase()] || "src";
      (byRail[rid] = byRail[rid] || []).push(c);
    });
    snap.rails = snap.rails || {};
    Object.keys(byRail).forEach(rid => {
      let rail = snap.rails[rid];
      if(!rail){ rail = snap.rails[rid] = { id:rid, name:rid, groups:[] }; }
      rail.groups = rail.groups || [];
      const tiles = byRail[rid].map(c => {
        const ns = Array.isArray(c.notes) ? c.notes.filter(Boolean) : (c.notes ? [String(c.notes)] : []);
        notes[c.name] = ns.length ? ns : ["From your diagram."];
        return { n:c.name, ic:"dot", s:(ns[0] || ""), long:ns.join(" "), custom:true, hl:true };
      });
      rail.groups.push({ box:"From your diagram", ic:"dot", tiles });
    });
  }
  const title = r.title || "AI Architecture";
  const blurb = r.blurb || "";
  const industry = baseArch ? baseArch.industry : null;
  const id = "custom" + (++tabSeq);
  if(activeRef){ clearReference(); refBanner.classList.remove("show"); }
  const tab = makeTab(id, title, "", snap);
  const rec = customTabs.get(id); if(rec){ rec.edit = true; rec.blurb = blurb; rec.notes = notes; }
  selectTab(tab);
  persistTabs();
  if(Object.keys(notes).length){
    activeRef = { id:"__tab__", name:title, blurb, map:notes };
    document.getElementById("ref-name").textContent = title;
    document.getElementById("ref-blurb").textContent = blurb;
    refBanner.classList.add("show");
  }
  return { count, title, industry };
}

async function aiSend(promptText){
  const input = (promptText || aiEls.text.value).trim();
  const atts = aiAttach.slice();
  if((!input && !atts.length) || aiState.busy) return;
  aiAttach = []; aiRenderAttach();
  aiEls.text.value = ""; aiEls.text.style.height = "auto";
  aiEls.sugg.style.display = "none";
  aiIndHint("");
  // Text/PDF attachments fold into the prompt; images ride along as vision blocks.
  const docText = atts.filter(a=>a.kind==="text")
    .map(a=>`\n\n--- Attached: ${a.name} ---\n${a.text}`).join("");
  const imgs = atts.filter(a=>a.kind==="image");
  const fullInput = (input + docText).trim() || "(see attached)";
  const names = atts.map(a=>a.name);
  aiAddMsg("user", input + (names.length ? (input ? "\n" : "") + "📎 " + names.join(", ") : ""));
  aiState.history.push({ role:"user", content:fullInput });
  aiSetBusy(true);
  const thinking = aiAddMsg("bot", "Thinking…");
  const convo = aiState.history.map(m=>`${m.role==="user"?"USER":"ASSISTANT"}: ${m.content}`).join("\n\n");
  try{
    const system = aiSystemPrompt(componentCatalog());
    if(!aiState.bridge) throw new Error("No connection to the app backend. The AI assistant needs the app's /generate endpoint.");
    let raw = await aiCallBridge(system, aiBridgeContent(convo, imgs));
    const result = aiExtractJson(raw);
    let baseArch = null;
    const indId = result.industry && result.industry !== "generic" &&
      (INDUSTRY_BUILT ? INDUSTRY_BUILT.has(result.industry) : false) ? result.industry : null;
    if(indId){
      baseArch = await industryArch(indId);
      if(baseArch){
        const sys2 = aiSystemPrompt(catalogFromArch(baseArch));
        let raw2;
        try{
          raw2 = await aiCallBridge(sys2, aiBridgeContent(convo, imgs));
          const r2 = aiExtractJson(raw2);
          if(Array.isArray(r2.components) && r2.components.length) result.components = r2.components;
        }catch(_){ /* keep phase-1 components on phase-2 failure */ }
      }
    }
    const made = aiCreateTab(result, baseArch);
    thinking.remove();
    aiAddMsg("bot", result.reply || (made.count ? `Built ${made.count} components.` : "Done."),
      made.count ? { count:made.count, title:made.title, industry:made.industry } : null);
    aiState.history.push({ role:"assistant", content: result.reply || "(applied)" });
    if(!made.count) aiAddMsg("bot", "Couldn't map any components — try a more specific description.");
  }catch(err){
    thinking.remove();
    const m = aiAddMsg("bot", "⚠ "+err.message); m.className="ai-msg err";
  }finally{ aiSetBusy(false); }
}

aiEls.fab.onclick = ()=>{ aiEls.panel.classList.add("show"); aiEls.fab.classList.add("hide");
  aiRefreshConn(); aiEls.text.focus();
  if(!aiEls.msgs.children.length) aiAddMsg("bot", "Describe a customer and use case, and I'll build a tailored architecture as a new tab. e.g. \"Real-time fraud detection for a retail bank streaming card transactions.\""); };
document.getElementById("ai-x").onclick = ()=>{ aiEls.panel.classList.remove("show"); aiEls.fab.classList.remove("hide"); };
aiEls.send.onclick = ()=> aiSend();
aiEls.text.addEventListener("keydown", e=>{ if(e.key==="Enter" && !e.shiftKey){ e.preventDefault(); aiSend(); } });
aiEls.text.addEventListener("input", ()=>{ aiEls.text.style.height="auto"; aiEls.text.style.height=Math.min(aiEls.text.scrollHeight,120)+"px"; aiIndHint(aiEls.text.value); });
aiEls.sugg.querySelectorAll("button").forEach(b=> b.onclick = ()=> aiSend(b.dataset.q));

/* Type-ahead: surface built industries whose name matches the text. */
const aiIndHintEl = document.getElementById("ai-indhint");
const IND_SYNONYMS = {
  banking:["bank","banks","fintech finance","financial"], payments_fintech:["fintech","payments","payment"],
  healthcare:["hospital","health system","provider","clinic","patient"], health_insurance:["payer","health plan"],
  life_insurance:["insurer","insurance"], telecommunication:["telecom","telco","carrier","mobile operator"],
  retail:["retailer","store","shop"], ecommerce:["e-commerce","online store","webshop"],
  manufacturing:["factory","plant","industrial"], oil_gas:["oil","gas","petroleum","upstream"],
  energy_utilities:["utility","utilities","power","grid"], media_broadcasting:["media","broadcaster","streaming"],
  travel_hospitality:["hotel","hospitality","travel"], transport_shipping:["logistics","freight","transport"],
  automotive:["auto","car","vehicle","oem"], pharmaceuticals:["pharma","drug"],
  gaming:["games","game studio","igaming"], grocery:["supermarket","grocer"], restaurants:["restaurant","qsr","food service"],
};
const IND_STOP = new Set(["real","life","media","gas","oil","food","water","waste","health","goods","apparel","sports","chemical"]);
function aiIndustryMatches(text){
  const q = String(text||"").toLowerCase().trim();
  if(q.length < 3) return [];
  const scored = [];
  INDUSTRY_CATALOG.forEach(([id,label])=>{
    if(INDUSTRY_BUILT !== null && !INDUSTRY_BUILT.has(id)) return;
    const lc = label.toLowerCase();
    const words = lc.split(/[^a-z]+/).filter(Boolean);
    const strong = [lc, ...(IND_SYNONYMS[id]||[])];
    const weak = words.filter(w=> w.length >= 4 && !IND_STOP.has(w));
    let best = 0;
    const wb = t => new RegExp("\\b"+t.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"\\b").test(q);
    strong.forEach(t=>{
      if(!t) return;
      if(q === t) best = Math.max(best, 100);
      else if(wb(t)) best = Math.max(best, 85);
      else if(t.length >= 5 && q.includes(t)) best = Math.max(best, 60);
    });
    weak.forEach(t=>{ if(wb(t)) best = Math.max(best, 70); });
    if(best) scored.push({ id, label, score:best });
  });
  return scored.sort((a,b)=> b.score - a.score).slice(0,3);
}
function aiIndHint(text){
  const matches = aiIndustryMatches(text);
  aiIndHintEl.innerHTML = "";
  if(!matches.length){ aiIndHintEl.hidden = true; return; }
  const lbl = document.createElement("span"); lbl.className = "lbl"; lbl.textContent = "Use standard industry:";
  aiIndHintEl.appendChild(lbl);
  matches.forEach(m=>{
    const b = document.createElement("button");
    b.type = "button";
    b.innerHTML = `${esc(m.label)} <span class="arr">→</span>`;
    b.title = `Switch the Reference board to the ${m.label} architecture`;
    b.onclick = ()=>{
      const refTab = tabsEl.querySelector('.tab[data-tab="reference"]');
      const active = tabsEl.querySelector(".tab.active");
      if(refTab && active !== refTab) selectTab(refTab);
      applyIndustry(m.id, true);
      aiIndHintEl.hidden = true; aiIndHintEl.innerHTML = "";
      aiAddMsg("bot", `Switched the Reference board to the ${m.label} standard architecture.`);
    };
    aiIndHintEl.appendChild(b);
  });
  aiIndHintEl.hidden = false;
}
document.getElementById("ai-clear").onclick = ()=>{
  const activeTab = tabsEl.querySelector(".tab.active");
  const activeId = activeTab && activeTab.dataset.tab;
  const activeCustom = activeId && customTabs.get(activeId);
  if(activeCustom && activeCustom.snap){
    closeTab(activeTab);
    aiAddMsg("bot","Closed the generated tab — back to the full platform.");
  } else {
    clearReference(); refBanner.classList.remove("show");
    aiAddMsg("bot","Cleared the highlight — the full platform is shown again.");
  }
};
/* Edit toggle: visible only on a generated (editable) tab. */
const aiEditToggleEl = document.getElementById("ai-edit-toggle");
function activeGeneratedRec(){
  const act = activeTabEl();
  const rec = act && customTabs.get(act.dataset.tab);
  return (rec && rec.snap) ? rec : null;
}
function syncEditToggle(){
  const rec = activeGeneratedRec();
  if(!rec){ aiEditToggleEl.hidden = true; return; }
  aiEditToggleEl.hidden = false;
  aiEditToggleEl.textContent = "✎ Editing: " + (rec.edit ? "on" : "off");
}
aiEditToggleEl.onclick = ()=>{
  const rec = activeGeneratedRec(); if(!rec) return;
  rec.edit = !rec.edit;
  setEditMode(rec.edit);
  persistTabs();
  syncEditToggle();
};
(function(){ const _sel = selectTab; selectTab = function(tab){
  _sel(tab);
  /* Re-establish notes overlay and scope edit-mode to the active tab. */
  const act = activeTabEl && activeTabEl();
  const rec = act && customTabs && customTabs.get(act.dataset.tab);
  if(rec && rec.notes && typeof rec.notes === "object" && Object.keys(rec.notes).length){
    activeRef = { id:"__tab__", name:rec.name||"", blurb:rec.blurb||"", map:rec.notes };
    document.getElementById("ref-name").textContent = rec.name||"";
    document.getElementById("ref-blurb").textContent = rec.blurb||"";
    refBanner.classList.add("show");
  } else {
    if(activeRef && activeRef.id==="__tab__"){ clearReference(); refBanner.classList.remove("show"); }
  }
  /* _sel() already ran build() (which paints against the PREVIOUS activeRef), so
     repaint now that activeRef reflects the tab just selected — dims a generated
     tab, clears the dim on the reference/industry board. */
  if(activeRef) paintRef(activeRef); else clearRefPaint();
  const arec = activeGeneratedRec();
  setEditMode(arec ? !!arec.edit : false);
  syncEditToggle();
}; })();
syncEditToggle();

aiRefreshConn();

/* ------------------------------------------------------------------
   Overrides of two base paint functions (the shared board defines the
   originals; here we replace them so a generated __tab__ dims the unused
   platform products). Reassignment works because this runs in the board's
   own script scope. */
clearRefPaint = function(){
  document.body.classList.remove("ref-mode", "tab-dim");
  document.querySelectorAll(".mapped").forEach(t=>{
    t.classList.remove("mapped");
    const b = t.querySelector(".map-badge"); if(b) b.remove();
  });
  document.querySelectorAll(".used").forEach(t=> t.classList.remove("used"));
};
paintRef = function(ref){
  if(ref && ref.id === "__tab__"){
    clearRefPaint();
    if(ref.map && typeof ref.map === "object"){
      document.body.classList.add("tab-dim");
      Object.keys(ref.map).forEach(name=>{
        const id = resolveAtom(name); if(!id || !byId[id]) return;
        byId[id].el.classList.add("used");
      });
    }
    Object.keys(byId).forEach(id=>{
      const rec = byId[id]; if(!rec || !rec.el) return;
      const hl = rec.tile && rec.tile.hl;
      if(hl === true) rec.el.classList.add("used");
      else if(hl === false) rec.el.classList.remove("used");
    });
    return;
  }
  clearRefPaint();
  document.body.classList.add("ref-mode");
  Object.entries(ref.map).forEach(([name, items])=>{
    const id = resolveAtom(name); if(!id) return;
    const el = byId[id].el;
    el.classList.add("mapped");
    const badge = document.createElement("span");
    badge.className = "map-badge"; badge.textContent = items.length;
    el.appendChild(badge);
  });
};

