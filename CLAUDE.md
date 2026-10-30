# CLAUDE.md: Databricks Reference Architecture (repo guide)

Canonical repo: `databricks-industry-solutions/databricks-reference-architecture` (PUBLIC).
Live site: https://databricks-industry-solutions.github.io/databricks-reference-architecture/

This file is the authoritative engineering guide for THIS repo. Read it first.
`README.md` describes what the board is and lists the repository layout; this file holds
the rules for changing it.

---

## 1. What this is

See `README.md`. What every change here depends on:

- The static board is a single file: `app/index.html`.
- The AI variant is NOT a second board. `app/ai/app.py` serves the SAME `app/index.html`
  and injects the AI layer (`app/ai/ai.css` + `app/ai/ai.js`) at request time. There is
  only ONE board file to edit; a fix in `app/index.html` reaches the AI app automatically.
- Every board has two views on the same shape and boxes: Simplified, the default, and
  Detailed. Simplified keeps the first tiles of each group (`SIMPLE_RAIL_CAP`,
  `SIMPLE_TOP_CAP`), every tile marked `core: true`, the use cases with customer stories and
  the cloud tiles a reader needs (`SIMPLE_CLOUD_ROLES`: storage, identity, catalog, model
  providers with Anthropic / OpenAI, BI, cloud ETL, streaming and federation, plus one compute
  tile named Compute). CI/CD, monitoring, operational stores and orchestrators wait for
  Detailed. So the first tile of every group in an industry YAML is its
  most essential one and never repeats what another group already leads with, and every other
  system, consumer or team the industry cannot be read without carries `core: true`: an
  airline board without its GDS, or a bank without its core banking system, is not credible.
  Keep at most one extra Business team, since the Teams pocket sets the board's height.
  Simplified then fills the room it leaves: a Sources, Ingestion, Consumers or Teams group shows
  its first `simplified: N` tiles when the YAML records one (`simple:N` on the generic board's
  group in `app/index.html`). `tools/fill_simple.js` sets them, adding each group's next tile in
  turn while the board stays at its Simplified height in every shape, on every cloud, in English
  and German, and no label clips. It never adds an orchestrator, a monitoring or CI/CD tool or an
  operational write-back store. Rerun it after a change to a board's rails and commit what it
  writes. On screen the platform shows the same tiles, icons, type and spacing in both views, and
  Simplified leaves out captions, capability tags and descriptions. Only the Simplified PowerPoint
  and PDF set the platform's names, labels and their small icons one fixed step larger, so they use
  the room the captions leave on the page: `exportType()` switches on `deck-type` (`--pk` in
  `app/index.html`) while the export reads the board and switches it off before the next paint.
  The same layout sets the capability chips inside Genie and Agent Bricks at 7pt on the slide and
  on the PDF page (`DECK_CHIP_PT`), sized from each page's own scale and wrapped onto as many rows
  as they need so every rectangle holds its text, and sets the Genie and Agent Bricks names in the
  proportion to their chips the screen shows, so a name always reads larger than its chips. On
  screen the chips are 11.5px in both views, in three columns in Genie and two in Agent Bricks,
  and a panel whose chip must shrink to fit gives all its chips that size; the PowerPoint and PDF
  wrap their 7pt chips onto rows from the leading edge. The icon tiles
  keep their size, and the screen and every other export keep the screen's type. In both views the
  cloud band takes the size of the Genie Agents band, label column included.
- No word ever breaks across lines, in any language. A name too long for its tile shrinks to fit,
  down to 10px, and a name that never wraps, such as a chip or a panel head, shrinks as a whole; a rail tile whose longest word still does not fit takes the whole width of its
  group. Names joined by a slash are written with spaced slashes ("Anthropic / OpenAI") so the
  line can break at the spaces; acronym pairs (I/O, A/B) and product names keep theirs.

## 2. Layout

The full tree is in `README.md` under "Repository layout". Two files it does not list:

- `app/version.json`: `{ "build": "<semver>" }` for cache-busting. It moves with `const BUILD`
  in `app/index.html` (§3, rule 4).
- `index.html` (repo root): a cache-busting redirect to `app/index.html`; with `.nojekyll`
  this is what GitHub Pages serves at the site root.

## 3. HARD rules

1. **Databricks Serverless-safe only.** No `cache`/`persist`/`uncache`, no `SparkContext`,
   nothing that assumes a classic cluster. Any notebook/py here must run on Serverless.
2. **No code comments and no stray docs.** Do not add comments to code and do not create
   `.md`/`.txt` files for changes unless explicitly asked. (This `CLAUDE.md` was explicitly
   requested.)
3. **DRY.** Search before writing. Two implementations of one concept is a bug. The AI app
   reuses the shared board for exactly this reason, so do not re-fork it.
4. **Single-digit semver.** Every segment is one digit 0-9; at 9 it rolls to 0 and carries
   left (… v0.4.9 → v0.5.0 … v0.9.9 → v1.0.0). `app/version.json` and the `const BUILD` in
   `app/index.html` move together.
5. **SCHEMA bump on persisted-board content changes.** The board persists to `localStorage`
   keyed by `const SCHEMA = N;`. A returning browser ignores new baked-in content until
   `SCHEMA` changes. If you change anything baked into a persisted board (platform
   bands/rails, top band, cloud band, consumers, or any industry YAML that renders into
   them), bump `SCHEMA` by 1 in `app/index.html`. `SCHEMA` is a plain counter, NOT the
   semver. Pure CSS / render-logic / i18n-corpus changes do not need a bump.
   Verify: `grep -n "const SCHEMA" app/index.html`.
6. **Two refreshes, Platform then Content, only when you open a PR.** Run them when you are
   asked to open a PR, never before or during a change, and commit what they change with your
   work:
   - **Platform:** `python3 tools/refresh_public_data.py` re-reads everything the board takes
     from public Databricks pages: regional availability, release stages, the Lakeflow Connect
     connector catalog, certifications and Academy courses (§5).
   - **Content:** `python3 tools/refresh_content.py` re-reads what the board offers as
     highlights (product tours and tutorials from the Databricks demo center, videos from the
     official Databricks YouTube channels), then checks every tile on every board and cloud
     against them, label fit and translation coverage in every language, and every highlight
     link (§5b).

   Run Platform first: the content checks read the connector catalog it refreshes. Each exits
   non-zero when a step fails or the data has drifted; fix that before you continue. `--check`
   reports without writing. Skip the Content refresh when the last one finished less than 72 hours
   ago, unless you are asked to run it: `python3 tools/refresh_content.py --if-older 72` reads the
   time each full run records in `tools/.content_refresh` and runs only when that is older.
7. **Write for the reader, who may be a customer.** The board, its tour, the exports, the
   README and anything written about them are read by customers. Speak to the reader ("you",
   "your team", "a meeting"), never about them as someone being sold to: no selling verbs, no
   field jargon, no meeting or design named after the customer. "Databricks customer stories"
   and an industry's own customers are fine. `linkgate` fails on the phrases in
   `SELLER_PHRASES` in any tracked file.
8. **Check every translation before any PR.** After the Content refresh, run
   `node tools/verify_ui_i18n.js` and fix what it reports. Every string a reader sees in a
   non-English language is translated, with the sense it has on the board: the board, the details
   and region panels, the tour, tooltips and the Excel download. Product, feature and brand names,
   region codes and titles quoted as published stay English, and so do the toolbar and its menus.
   A word that is truly the same in a language goes in `tools/i18n_same.json` for that language
   only. A wrong sense found once (ingestion read as eating, work teams as sports teams, cloud as
   weather, a lakehouse as a house by a lake, a copilot as an aircraft co-pilot) goes in the gate's
   sense list so it cannot come back, and a name found translated once (Anthropic, Kinesis, Oracle)
   goes in its list of names that stay as written. A machine translation of a short label is never
   final until it has been read in context.

## 4. Links policy

- Every clickable surface on the board links to Databricks only, enforced at render time by
  `isDatabricksUrl()` (allowlist: `databricks.com` and subdomains, the Azure Databricks docs
  on `learn.microsoft.com`, YouTube, and `github.com/databricks*`). A non-allowlisted URL is
  refused by `linkRow()`/`linksHref()`.
- The one exception is a data-format tile's `spec_url`, which links to the STANDARD body's
  own page (iso20022.org, fixtrading.org, finos.org, hl7.org, …). A standard is not a
  competitor.
- Never link to a competitor product page. Competitors live in `links.json` only as unlinked
  `.url`/`.site` fields; only the Databricks federation doc (`.dbx`) renders.
- Docs search fallback must use `…/search?q=` (not `search.html?q=`).

## 4b. Logos

Every logo on the board comes from an approved source, never from a web search, a vendor site or
an icon collection.

- Databricks product marks, the three cloud provider logos and partner logos come from the
  Databricks brand library (Brandfolder). `tools/markgen.py` names each asset and file. Fetching
  needs a Brandfolder API key, read from `BRANDFOLDER_API_KEY` or `brandfolder_api_key` in
  `~/.fe-logo-fetcher/config.json`; the files stay in `tools/.markcache`. A third-party tile may
  carry only a logo the library tags Partner Logos, and only when the library has a square mark
  for it. Customer logos and untagged logos are never used.
- A cloud service the library lacks takes the provider's own architecture icon (AWS, Azure,
  Microsoft Entra, Microsoft Fabric, Power Platform, Google Cloud), whose terms allow
  architecture diagrams. Each package is pinned by URL in `markgen.py`, and every icon records
  its package in its bundle.
- Product marks take the theme colour (`currentColor`). Logos are transparent and keep their brand
  colours: `markgen.py` drops a light backdrop that covers the canvas, and near-black ink (a
  wordmark's text) takes the board's `--logo-ink` token, the same one the project wordmarks use,
  so it reads on light and dark. A tile shows a logo only while it shows its own name, so a tile
  showing its category in Categorized mode keeps its glyph.
- The provider logos are inline (`CLOUD_LOGOS`). Each cloud's service icons ship in
  `app/resources/logos/<cloud>.json`, fetched with the boot resources for the active cloud only
  and frozen into the HTML export.
- After changing a source, run `python3 tools/markgen.py` and commit what it writes. `--refresh`
  downloads new versions and `--measure` checks that a new mark still reads at tile size.

## 5. Regional availability and release stages

`app/resources/regions.json` is generated from two PUBLIC Databricks doc pages per cloud
(`supported-regions` + `feature-region-support`) by `tools/scrape_regions.py`, which holds
the `ALIAS` map (product name → limited-feature column). Policy is PERMISSIVE: a product is
available in ALL supported regions UNLESS the PRODUCT ITSELF is published as region-limited
in public docs. If a limit applies only to a sub-capability, relax it (drop the alias →
all regions). A box's own capability is never a sub-capability: the Serverless Compute box
follows the serverless compute column and Model Serving follows CPU serving. Never show a
restriction that public docs do not publish for the product.
When a product's own doc page publishes its region list (`PRODUCT_PAGES` in the scraper,
today Lakebase and Genie App Builder), that list is the source and wins over the feature
table; a cloud the page does not list counts as not available there.
Every limited column on every cloud belongs to a board product (`ALIAS` or `PRODUCT_PAGES`) or
says in `PART_OF` why it has no box of its own; `regiongate.py` fails on a column that does
neither. The scraper also reads the docs page of every board product on every cloud, and fails
when a page states a region requirement that is neither mapped nor recorded in `REVIEWED` with
the reason it stays unmapped.

**Before every PR, check regional availability against the public docs**: run the Platform
refresh (it re-scrapes the tables and reviews every product page) and `regiongate.py --live`,
and when either reports a gap, settle it from the docs pages before you open the PR.
Availability shows only when the reader picks a region in the Region menu: the menu closes, the
board dims the products that region cannot run, and the region panel opens. It lists the same rows
in every region on every cloud: every feature and Designated Service any cloud's docs publish (the
limited-feature tables, the MCP rows the docs tie to Custom Model Serving, Designated Services
through the region's Geo from `REGION_COUNTRY`, the docs' Geo tables and `AZURE_GEO`), the
partner-powered AI features table (the hosting provider with the setting on and off, the page's
markers such as the Databricks security perimeter, and where Databricks-hosted models need cross
geography processing), and every board product with a docs page. A row another cloud lists reads
Yes here when its docs page exists on this cloud, since the docs leave features that run in every
region out of their tables, and No when it does not. Every row links a docs page on the reader's
cloud; a row with no page there links that cloud's docs search and says so. Each row gives its
stage, its availability (Yes, Conditional, No or Not listed) and only the notes the docs publish,
and cites the docs section that states it. Every column sorts, Stage and Available filter like a
spreadsheet, the filters, sort and search travel in the address bar, and the list downloads as an
Excel file. Each region shows its country's flag and All regions a globe; the Region button shows the
selected flag with no highlight behind it (`COUNTRY_ISO`; `app/resources/flags.json` holds
country-flag-icons under its MIT license). The
Platform refresh rebuilds this data and fails when a docs feature has no docs link (`LINK_TEXT`), a
marker has no recorded meaning (`MARK_EFFECT`), a region has no country, ISO code or Geo (`NO_GEO`
records the exceptions), two clouds name one feature differently (`SAME_FEATURE`), the docs stop
tying a derived row to its column (`DERIVED`), or the partner-powered page loses its table or its
geography sentence. A box's detail panel shows no availability line.

`app/resources/stages.json` holds every board box's release stage per cloud, read by
`tools/scrape_stages.py` from the notice at the top of the box's own docs page (the `links.json`
`doc` path): "This feature is in Beta / Public Preview / Private Preview", linked or not. A page
without that notice is GA. A box whose page does not exist on a cloud is "Coming soon" there,
and its `links.json` `docClouds` must list exactly the clouds that have the page. LTAP reads its
"Capability | Status" table: the least mature capability wins, and "Not available" is "Coming
soon". A box with no public docs page (`undocumented`) keeps the stage typed on the board.
`stageFor` gives the docs stage for every box that carries a typed `st`/`stByCloud` and falls back
to the typed value; a box without a typed stage never takes one from the docs, even when it shares
a product's name. Keep the typed values in step when you touch a box. No product shows a stage
label, on the board or in its panel: the stage only takes effect when the reader filters with the
Stage menu. The region panel's table is the one exception: it lists each row's stage, from
`stages.json` for a staged box and from the row's own docs page otherwise. The same scraper refreshes the Lakeflow Connect connector catalog in
`platform_docs.json`: it adds connectors the docs list, drops connectors whose page is gone, and
records each connector's stage per cloud; the connector panel lists them A to Z with no stage.
Prose carries no release stage either: no GA, generally available, Public Preview, Private
Preview, Beta or Coming soon in descriptions, capability tags, notes or industry YAML. The
Platform refresh fails on any. Titles of Databricks posts and videos are quoted as published.

## 5b. Highlights and use cases

Every tile shows every highlight that matches it: customer story, Lakeflow connector, product
tour, demo, Academy course, certification, video and solution accelerator. Panel and section
heads show their own highlights; the board title shows none. `tools/verify_highlights.js` holds
the rules and reads the dots the board actually draws:

- One connector list, `app/resources/connectors.json`, drives both the connector dot and its
  callout.
- A tile whose name differs from the entry it matches reaches it through
  `app/resources/aliases.json` (tile name → entry name). `linkgate` refuses an alias that points
  at itself, chains, names no entry or hides an entry of the same name.
- Every video, demo, course, certification and accelerator lights a dot on some tile, or carries
  a reason in the gate's exemptions.
- Videos come only from the channels in `OFFICIAL_YT` (Databricks, Databricks Events), and the
  title carries the box name or an alias `a` declared on the video. `tools/refresh_videos.py`
  follows title changes, drops videos that are gone, and links each new upload whose title names
  a box. Review what it links; an upload that should not be linked goes in its `SKIP` with the
  reason. It also lists the recent uploads whose title names no box: one that belongs to a box gets
  a video entry with an alias `a` taken from its title. The feeds hold only each channel's latest 15
  uploads, so an older video is added by hand the same way.
- `tools/build_demos.py` owns every demo list through its path → tile `MAP`; never add a demo to
  `links.json` by hand. A tour that should not show maps to an empty list.

`tools/outcome_map.json` marks every use case that comes from a Databricks industry outcome map.
The board never shows the mark. Such a use case needs no customer story, and `linkgate` fails if
it leaves its board or is renamed; it goes only together with its entry in that file. A use case
may give way to a new one only when it has no customer story, no accelerator and no outcome-map
entry, and the new one goes on the board where it belongs.

## 6. Gates: run before every PR

```bash
python3 tools/refresh_public_data.py --check # Platform: regions, release stages, connectors, certifications, Academy: no drift, no release stage in any description
python3 tools/refresh_content.py --check --if-older 72 # Content: demos and videos current, every tile shows its highlights, labels fit and are translated in every language, highlight links live; skipped within 72 hours of the last full refresh unless you are asked to run it
python3 tools/regiongate.py --live          # region data consistent, every limited column owned by a board product or explained, every region-table row linked to its cloud's docs with a stage and its markers explained, the same rows on every cloud, every region in a Geo and with a flag, alias parity, source docs live
node   tools/verify_all_sections.js         # 70 industries + the generic board, uc/genie/dash/app = 10/4/4/4, the deck's editable board slide builds, 0 page errors
node   tools/verify_i18n_coverage.js        # translation coverage over the DATA corpus
node   tools/verify_ui_i18n.js                # every string a reader sees is translated with the right sense in all fifteen languages: wrong-sense terms, names that stay as written, leftover tokens and the tour offline; the board, the panels, the tour, tooltips and the Excel headers on screen
node   tools/verify_highlights.js           # every tile on every board and cloud draws the dots of the highlights that match it: one connector list for dot and callout, aliases, no orphaned resources
node   tools/verify_label_fit.js            # every panel, card, heading and band label fits its box, and no heading runs under its zoom button, in all sixteen languages and every board shape; on every board, cloud and language in both views and in the PowerPoint and PDF layouts of Simplified no word breaks across lines, sticks out of its box or is cut off, and every Genie and Agent Bricks chip of those layouts reaches the slide and the page at 7pt inside its rectangle, under a panel name that keeps the screen's proportion to its chips
node   tools/verify_core.js                 # every board and cloud, both views, Branded and Categorized: Simplified shows every core tile and every group's first tile, the cloud BI tool, model providers with Anthropic / OpenAI, storage, identity, catalog, ETL, streaming and one Compute tile, and no CI/CD, monitoring, operational store or orchestrator; Detailed keeps every tile
node   tools/verify_alignment.js            # every board, cloud, shape and language in both views: platform-box titles centered and at their leading edge, tiles midway between top and bottom, arm cards evenly spaced, highlight dots clear of borders, every cloud, top-band and rail tile holding its content at its vertical middle, the cloud band the size of the Genie Agents band, medallion arrows on their cylinders' center line, the platform showing the same tiles, icons, type and spacing in both views on screen, one chip size in each Genie and Agent Bricks panel, the PowerPoint and PDF layouts of Simplified holding every check above with their type one fixed step larger, their Genie and Agent Bricks chips at 7pt inside their rectangles under a panel name in the screen's proportion, and giving the screen back unchanged, panel link arrows at the end of their rows
node   tools/fill_simple.js --check          # every Simplified count recorded in a board's YAML still fills the free space of its rails, without growing the board in any shape, cloud or language
python3 tools/linkgate.py                    # structural completeness, retired names, seller phrasing, outcome-map use cases still on their boards, every chip alias names a chip on some board and a LINKS entry (add --urls for live link check, --scope highlights to skip third-party citations)
python3 tools/heightgate.py                  # every board in every shape against the reference height, no clipping, a board that does not load measured once more; a board already over it holds its height in tools/heightgate_baseline.json and may not grow (--tighten after one shrinks)
node   tools/perfgate.js                     # motion rests at idle, reduced motion honoured, boot fetches once and in parallel; the opening intro plays once the board is built, ends on input and leaves nothing behind
node   tools/verify_exports.js               # deck with its editable board slide + PDF, Simplified platform names at 7.4pt or more and Genie and Agent Bricks chips at 7pt inside their rectangles under a larger panel name on the slide and on the PDF page, the Simplified PDF taking the PowerPoint's type step, while the screen keeps its own type and comes back unchanged after each export, the four drawing-app exports (shape parity, structure, links; --live also opens them in draw.io, excalidraw.com, LibreOffice), line breaks that keep every word whole, and the HTML export (every boot resource frozen, opens offline)
node   tools/smoke_yaml.js                   # YAML descriptor round trip; edited, AI and imported tabs export what is on screen
node   tools/smoke_share.js                  # share links and the address bar: every option in the URL, a copied link reopens the same board
python3 tools/test_certifications.py         # certification builder + gate, offline: catalog drift, exam-guide evidence, mapping integrity
python3 tools/test_linkgate.py               # linkgate file checks, offline: retired name, archived repo, owner-pending exemptions, tile aliases, chip aliases, outcome map, story rule
python3 tools/test_content.py                # content refresh, offline: feed parsing, box matching, cap and skip, title follow-up, highlight link scope
python3 tools/test_heightgate.py             # heightgate, offline: reference budget, held heights, tighten, coverage
python3 tools/test_regions.py                # region scraper + gate, offline: product-page lists, source pages, mapping integrity, region-table parsing (sections, links, markers, Designated Services, Geos, partner-powered AI features, rows another cloud lists, flags)
node   tools/smoke_regions.js                # no box panel shows an availability line; picking a region closes the menu, dims what it cannot run and opens the region panel: the same rows everywhere, every row linked to that cloud's docs, partner-powered notes, cells as the docs read them, spreadsheet filters and sorting kept in the address bar, an .xlsx equal to the table, flags and the globe
node   tools/smoke_ui.js                     # one menu open at a time, an active icon button ringed rather than filled, no AI link in the header, a tour of at most 10 steps that glides without doubling back and shows a box's highlights, opening its panel on a click, Skip quieter than Next, and the toolbar stays usable while a box panel is open: the industry picker opens on the first click
python3 tools/test_stages.py                 # stage scraper, offline: notices, missing clouds, LTAP table, connector discovery, API stage badges, no stage in prose, data integrity
node   tools/smoke_stages.js                 # every box carries its docs stage for the Stage filter on each cloud and shows no stage label; connectors list A to Z with no stage heading; docs win over typed stages; undated credit
python3 tools/markgen.py --check             # product marks, cloud logos and per-cloud icon bundles current, inside the size budget, and every one matched to a tile
node   tools/verify_logos.js                 # each cloud: provider logo on the band, official icons on its tiles, none on a tile showing its category, Databricks marks shown, white plates in dark mode, cloud switch, offline export
python3 tools/test_markgen.py                # markgen, offline: style inlining, unsafe logos refused, id namespacing, plate fit, container crop and cut-outs, shared icons, cache and key
node   tools/verify_contrast.js              # every text on the board, the toolbar and its menus, the details and region panels, tooltips, the tour and the deck clears WCAG AA on its own background in every palette, light and dark, in both views
```

Every browser gate waits for the opening intro to finish before it measures the board: call
`boardReady(page)` from `tools/lib_serve.js` after each board load. The board opens in the
Simplified view, so a gate names the view it measures with `withView()` from the same file, and
a gate that checks what a board shows runs in both views.

Local preview: `cd app && python3 -m http.server 8777` then open
`http://localhost:8777/index.html`.

## 7. Fork + PR workflow (HARD)

- `origin`: your fork of the canonical repo. Push all day-to-day work there.
- `upstream`: fetch from `https://github.com/databricks-industry-solutions/databricks-reference-architecture.git`.
  Disable its push URL so `git push upstream` fails by design:
  `git remote set-url --push upstream DISABLED-use-a-PR`.
- The old `amralieg/interactive-databricks-enterprise-architecture` repo is ARCHIVED; do not use it.

Anything landing on the canonical repo goes through a PULL REQUEST, never a direct push:

```bash
git fetch upstream && git checkout -b <feature> upstream/main   # branch off the canonical main
# ...edit, bump BUILD + version.json (+ SCHEMA if persisted content changed), run §6 gates...
python3 tools/refresh_public_data.py && python3 tools/refresh_content.py --if-older 72   # §3 rule 6: Platform, then Content unless it ran in the last 72 hours
python3 tools/regiongate.py --live                                               # §5: regional availability checked against the public docs
node tools/verify_ui_i18n.js                                                     # §3 rule 8: every translation checked in all fifteen languages
git push origin <feature>                                        # to your fork
gh pr create --repo databricks-industry-solutions/databricks-reference-architecture \
  --base main --head <your-github-user>:<feature>
```

Keep the PR description short and to the point: two or three sentences on what changes and why,
one line per change, one line on which gates pass, and only the risks a reviewer needs. Detailed
notes belong on the release (§8), not in the PR.

Keep the branch current with the canonical repo before opening a PR:

```bash
git fetch upstream && git rebase upstream/main && git push --force-with-lease origin <feature>
```

## 8. Release process

A release is a merged PR into the canonical `main`. Run both refreshes right before the PR,
Platform then Content (§3, rule 6: Content is skipped when it ran in the last 72 hours, unless you
are asked to run it), so the release ships current data and every tile shows its highlights, and
ship any change with it. Bump `const BUILD` + `app/version.json`
to the next single-digit semver (and `SCHEMA` if persisted content changed), pass all §6
gates, open the PR, and tag `vX.Y.Z` after merge. The release notes go on that tag's GitHub
release and cover a summary, highlights, per-change detail, regressions, validation, and upgrade
notes. GitHub Pages redeploys
automatically from `main`.
