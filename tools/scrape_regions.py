#!/usr/bin/env python3
"""Scrape Databricks regional availability into app/resources/regions.json.

Databricks does NOT publish a single product x region matrix. It publishes two
things per cloud, both server-rendered HTML tables:

  * "Databricks clouds and regions"  -> the flat list of supported regions.
  * "Features with limited regional availability" -> the ONLY features that are
    NOT available in every supported region, one column per feature.

Everything absent from the second page is available in every supported region of
that cloud (the page states this itself: "If a feature is supported in all
regions, it is not included"). So the runtime materialises a full matrix from:

    region in regionsFor(product) iff
        product maps to a limited-availability feature column -> that cell's value
        otherwise                                             -> every supported region

This scraper emits the raw scraped truth (supported regions + the limited-feature
tables) plus the curated product->feature-column ALIAS so the runtime resolver has
one authoritative file to read. Re-run whenever the docs change; a companion gate
(regiongate.py) fails the build on drift.

A product whose own page publishes a region list (PRODUCT_PAGES) is read from that
page instead: the list becomes a "<product> (product page)" column, its page is
recorded in feature_sources so the board links to it, and a cloud the page does not
list reads as not available there.

Usage:  python3 tools/scrape_regions.py   [--check]
"""
import argparse, concurrent.futures, datetime, json, os, re, sys, urllib.request
from html import unescape
from html.parser import HTMLParser
from urllib.parse import urljoin

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "app", "resources", "regions.json")
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/125 Safari/537.36")

# Doc pages per cloud. supported = the region list; feature = the limited table.
SOURCES = {
    "aws": {
        "supported": "https://docs.databricks.com/aws/en/resources/supported-regions",
        "feature":   "https://docs.databricks.com/aws/en/resources/feature-region-support",
    },
    "azure": {
        "supported": "https://learn.microsoft.com/en-us/azure/databricks/resources/supported-regions",
        "feature":   "https://learn.microsoft.com/en-us/azure/databricks/resources/feature-region-support",
    },
    "gcp": {
        "supported": "https://docs.databricks.com/gcp/en/resources/supported-regions",
        "feature":   "https://docs.databricks.com/gcp/en/resources/feature-region-support",
    },
}
for _cloud, _base in (("aws", "https://docs.databricks.com/aws/en/resources/"),
                      ("azure", "https://learn.microsoft.com/en-us/azure/databricks/resources/"),
                      ("gcp", "https://docs.databricks.com/gcp/en/resources/")):
    SOURCES[_cloud]["designated"] = _base + "designated-services"
    SOURCES[_cloud]["geos"] = _base + "databricks-geos"
    SOURCES[_cloud]["partner"] = _base.replace("/resources/", "/databricks-ai/") + "partner-powered"

# Curated product -> primary limited-availability feature column. The value is a
# case-insensitive substring matched against the scraped column labels of the
# active cloud. A product NOT listed here is treated as available in every
# supported region (the docs' own default). A product listed here but whose
# column is absent on a given cloud also falls back to all-supported for that
# cloud. One column per product keeps the truth defensible (no invented AND/OR).
ALIAS = {
    "AI Search": "AI Search",
    "Apps": "Databricks Apps",
    "Lakehouse//RT": "Lakehouse Real-Time",
    "Lakeflow Connect": "Managed connectors in Lakeflow Connect",
    "Zerobus": "Zerobus Ingest",
    "Unity Gateway": "Unity Gateway",
    "AI Functions": "Other AI functions",
    "Document Intelligence": "ai_parse_document",
    "Foundation Model APIs": "Foundation Model APIs (pay-per-token)",
    "Databricks Sandbox": "Databricks Sandbox",
    "Serverless Compute": "Serverless compute",
    "Model Serving": "Custom Model Serving capability (CPU serving)",
}

PART_OF = {
    "CMK": "customer-managed keys, an account setting with no box",
    "Custom Agents": "custom agents served on Model Serving, held by the Model Serving box",
    "Custom Model Serving capability (GPU serving)": "GPU serving inside Model Serving, whose box follows CPU serving",
    "Data Quality Monitoring": "a Unity Catalog capability",
    "Default storage": "a workspace storage option with no box",
    "Download visualizations API": "an AI/BI API",
    "External models": "models served through Model Serving",
    "Firewall enablement for serverless compute": "a Serverless Compute network option",
    "Foundation Model APIs (provisioned throughput)": "a Foundation Model APIs mode; the box follows pay-per-token",
    "Foundation Model Fine-tuning": "no box on the board",
    "Knowledge Assistant": "an Agent Bricks agent type",
    "Lakebase Autoscaling": "a Lakebase option; the box follows its product page",
    "MLflow traces in Unity Catalog": "an MLflow capability",
    "Managed disaster recovery": "no box on the board",
    "Model Training - forecasting": "no box on the board",
    "Predictive Optimization": "a Unity Catalog managed-table capability",
    "Private connectivity": "a network option for the compute planes",
    "PrivateLink (classic compute plane)": "a Classic Compute network option",
    "Serverless workspaces": "a Serverless Compute workspace option",
    "Supervisor Agent": "an Agent Bricks agent type",
    "System tables": "a Unity Catalog capability",
    "ai_": "an AI Functions function; the box follows the v1 functions",
}

REVIEWED = {
    "Genie Code": "only agent mode needs a supported Geo; without partner-powered AI features it runs everywhere on a Databricks-hosted model",
    "SQL Warehouses": "serverless warehouses follow Serverless Compute; classic and pro warehouses run in every supported region",
    "LTAP": "only the GCP page points to region availability, and LTAP is not available on GCP yet",
}
DOCS = {"aws": "https://docs.databricks.com/aws/en/",
        "azure": "https://learn.microsoft.com/en-us/azure/databricks/",
        "gcp": "https://docs.databricks.com/gcp/en/"}
PARTNER_GEO = re.compile(r"When the partner-powered AI features setting is disabled[^.]*\.\s*For workspaces in other geographies[^.]*\.", re.I)
PUBLIC_DOCS = {c: re.sub(r"^https://learn\.microsoft\.com/[a-z]{2}-[a-z]{2}/", "https://learn.microsoft.com/", u) for c, u in DOCS.items()}
REGION_REQ = re.compile(r"[^.\n]*(?:supported regions?\b|region availability|available in (?:these|the following) regions"
                        r"|not available in (?:all|every|some)? ?regions?)[^.\n]*", re.I)
REGION_LINK = re.compile(r'href="[^"]*(?:feature-region-support|supported-regions)[^"]*"')

PRODUCT_PAGES = {
    "Lakebase": {
        "aws": "https://docs.databricks.com/aws/en/oltp/projects/manage-projects",
        "azure": "https://learn.microsoft.com/en-us/azure/databricks/oltp/projects/manage-projects",
        "gcp": "https://docs.databricks.com/gcp/en/oltp/projects/manage-projects",
    },
    "Genie App Builder": {
        "aws": "https://docs.databricks.com/aws/en/dev-tools/databricks-apps/genie-app-builder",
        "azure": "https://learn.microsoft.com/en-us/azure/databricks/dev-tools/databricks-apps/genie-app-builder",
        "gcp": "https://docs.databricks.com/aws/en/dev-tools/databricks-apps/genie-app-builder",
    },
}
PAGE_SUFFIX = " (product page)"
AVAIL_HEAD = re.compile(r"region availability|requirements and availability|supported regions", re.I)
AVAIL_LEAD = re.compile(r"\bin a supported region\s*:", re.I)

CHECK = "✓"
MARK = re.compile(r"\*\*|[*†‡§¶‖⥂]")
MARK_LEAD = re.compile(r"^(\*\*|[*†‡§¶‖⥂])\s*(\S.*)$")
STAGE_IN_NAME = re.compile(r"\s*\((?:Beta|Public Preview|Private Preview)\)\s*$", re.I)
DS_STATUS = re.compile(r"^(Available|Not available|Not applicable)(\s*\([^)]*\))?((?:\*\*|[*†‡§¶‖⥂])*)$", re.I)
MARK_EFFECT = {
    ("feature", "⥂"): "conditional",
    ("feature", "**"): "note",
    ("feature", "‡"): "note",
    ("feature", "†", "aws"): "note",
    ("feature", "†", "azure"): "conditional",
    ("designated", "*"): "conditional",
    ("designated", "†"): "note",
    ("designated", "‡"): "note",
    ("designated", "§"): "note",
    ("designated", "‖"): "note",
    ("designated", "¶"): "note",
    ("partner", "*"): "note",
    ("partner", "†"): "note",
    ("partner", "‡"): "note",
}
LINK_TEXT = {
    "CMK": ["Customer-managed keys"],
    "PrivateLink (classic compute plane)": ["AWS PrivateLink"],
    "Lakebase Autoscaling": ["Lakebase Postgres Autoscaling"],
    "Managed connectors in Lakeflow Connect": ["Managed connectors in Lakeflow Connect", "Lakeflow Connect connector concepts"],
    "Foundation Model APIs (pay-per-token)": ["Foundation Model API pay-per-token"],
    "Foundation Model APIs (provisioned throughput)": ["Foundation Model API provisioned throughput"],
    "Private connectivity": ["Serverless private connectivity"],
    "Data Quality Monitoring": ["Databricks Data Quality Monitoring"],
}
DERIVED = {
    "MCP servers": "Custom Model Serving capability (CPU serving)",
    "Unity Catalog HTTP connections": "Custom Model Serving capability (CPU serving)",
}
DERIVED_SAYS = "same regions as custom model serving"
SAME_FEATURE = {
    "Custom Agents on Model Serving and Evaluation": "Custom Agents and Evaluation",
    "Serverless compute (notebooks, jobs, pipelines, and SQL warehouses)":
        "Serverless compute for notebooks, jobs, pipelines, and SQL warehouses",
}
EEA = {"Austria", "Belgium", "Bulgaria", "Croatia", "Cyprus", "Czechia", "Denmark", "Estonia", "Finland", "France",
       "Germany", "Greece", "Hungary", "Iceland", "Ireland", "Italy", "Latvia", "Liechtenstein", "Lithuania",
       "Luxembourg", "Malta", "Netherlands", "Norway", "Poland", "Portugal", "Romania", "Slovakia", "Slovenia",
       "Spain", "Sweden"}
AZURE_GEO = {
    "United States": "United States", "Canada": "Canada", "Brazil": "Brazil", "Mexico": "Mexico",
    "Hong Kong": "Asia Pacific", "Singapore": "Asia Pacific", "Japan": "Japan", "South Korea": "South Korea",
    "Australia": "Australia", "United Kingdom": "United Kingdom", "United Arab Emirates": "UAE", "Qatar": "Qatar",
    "India": "India", "South Africa": "South Africa", "Switzerland": "EU Data boundary",
}
NO_GEO = {("gcp", "Saudi Arabia"), ("azure", "Mainland China")}
COUNTRY_ISO = {
    "Australia": "AU", "Belgium": "BE", "Brazil": "BR", "Canada": "CA", "France": "FR", "Germany": "DE", "Hong Kong": "HK",
    "India": "IN", "Indonesia": "ID", "Ireland": "IE", "Japan": "JP", "Mainland China": "CN", "Mexico": "MX", "Netherlands": "NL",
    "Norway": "NO", "Qatar": "QA", "Saudi Arabia": "SA", "Singapore": "SG", "South Africa": "ZA", "South Korea": "KR",
    "Sweden": "SE", "Switzerland": "CH", "United Arab Emirates": "AE", "United Kingdom": "GB", "United States": "US",
}
LOCAL_ALIAS = {"Korea": "South Korea"}
REGION_COUNTRY = {
    "ap-northeast-1": "Japan", "ap-northeast-2": "South Korea", "ap-south-1": "India", "ap-southeast-1": "Singapore",
    "ap-southeast-2": "Australia", "ap-southeast-3": "Indonesia", "ca-central-1": "Canada", "eu-central-1": "Germany",
    "eu-west-1": "Ireland", "eu-west-2": "United Kingdom", "eu-west-3": "France", "sa-east-1": "Brazil",
    "us-east-1": "United States", "us-east-2": "United States", "us-gov-west-1": "United States",
    "us-west-1": "United States", "us-west-2": "United States",
    "australiacentral": "Australia", "australiacentral2": "Australia", "australiaeast": "Australia",
    "australiasoutheast": "Australia", "brazilsouth": "Brazil", "canadacentral": "Canada", "canadaeast": "Canada",
    "centralindia": "India", "centralus": "United States", "chinaeast2": "Mainland China",
    "chinaeast3": "Mainland China", "chinanorth2": "Mainland China", "chinanorth3": "Mainland China",
    "eastasia": "Hong Kong", "eastus": "United States", "eastus2": "United States", "francecentral": "France",
    "germanywestcentral": "Germany", "japaneast": "Japan", "japanwest": "Japan", "jioindiawest": "India",
    "koreacentral": "South Korea", "mexicocentral": "Mexico", "northcentralus": "United States",
    "northeurope": "Ireland", "norwayeast": "Norway", "qatarcentral": "Qatar", "southafricanorth": "South Africa",
    "southcentralus": "United States", "southeastasia": "Singapore", "southindia": "India",
    "swedencentral": "Sweden", "switzerlandnorth": "Switzerland", "switzerlandwest": "Switzerland",
    "uaenorth": "United Arab Emirates", "uksouth": "United Kingdom", "ukwest": "United Kingdom",
    "usgovaz": "United States", "usgovva": "United States", "westcentralus": "United States",
    "westeurope": "Netherlands", "westindia": "India", "westus": "United States", "westus2": "United States",
    "westus3": "United States",
    "asia-northeast1": "Japan", "asia-south1": "India", "asia-southeast1": "Singapore",
    "australia-southeast1": "Australia", "europe-west1": "Belgium", "europe-west2": "United Kingdom",
    "europe-west3": "Germany", "me-central2": "Saudi Arabia", "northamerica-northeast1": "Canada",
    "southamerica-east1": "Brazil", "us-central1": "United States", "us-east1": "United States",
    "us-east4": "United States", "us-west1": "United States", "us-west4": "United States",
}


class TableParser(HTMLParser):
    """Collect every <table> as a list of rows, each row a list of cell texts.
    Tolerant of the unclosed <td><p> markup docs.databricks.com emits and of the
    standard fully-closed markup learn.microsoft.com emits."""

    def __init__(self):
        super().__init__()
        self.tables, self._rows, self._cells, self._buf = [], None, None, []
        self._in_table = 0
        self._in_cell = False
        self.links, self.where, self.blocks = [], [], []
        self._row_links, self._cell_links, self._anchor = None, [], None
        self._sec, self._cat, self._head, self._hid, self._htext = "", "", None, None, []
        self._block, self._block_links, self._skip = None, [], 0

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style", "nav", "header", "footer"):
            self._skip += 1
        elif tag in ("h2", "h3") and not self._in_table:
            self._flush_block()
            self._head, self._hid, self._htext = tag, dict(attrs).get("id"), []
        elif tag == "table":
            self._flush_block()
            self._in_table += 1
            self._rows, self._table_links = [], []
            self._table_where = (self._sec, self._cat)
        elif tag == "tr" and self._in_table:
            self._flush_row()
            self._cells, self._row_links = [], []
        elif tag in ("td", "th") and self._in_table:
            # a new cell starts: close the previous one, then begin capturing.
            # Text between <tr> and the first cell (whitespace on fully-closed
            # markup) is ignored because _in_cell is still False there.
            self._flush_cell()
            self._buf, self._cell_links = [], []
            self._in_cell = True
        elif tag in ("li", "br", "p") and self._in_cell:
            self._buf.append("\n")
        elif tag in ("p", "li") and not self._in_table and not self._head:
            self._flush_block()
            self._block, self._block_links = [], []
        if tag == "a" and (self._in_cell or self._block is not None):
            self._anchor = [dict(attrs).get("href") or "", []]

    def handle_endtag(self, tag):
        if tag in ("script", "style", "nav", "header", "footer") and self._skip:
            self._skip -= 1
        elif tag == self._head:
            text = re.sub(r"\s+", " ", "".join(self._htext).replace("\u200b", "")).strip()
            self._sec = self._hid or re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
            self._cat = text
            self._head = None
        elif tag == "a" and self._anchor is not None:
            pair = (re.sub(r"\s+", " ", "".join(self._anchor[1])).strip(), self._anchor[0])
            (self._cell_links if self._in_cell else self._block_links).append(pair)
            self._anchor = None
        elif tag in ("td", "th") and self._in_table:
            self._flush_cell()
        elif tag == "table" and self._in_table:
            self._flush_row()
            if self._rows:
                self.tables.append(self._rows)
                self.links.append(self._table_links)
                self.where.append(self._table_where)
            self._rows, self._in_table = None, self._in_table - 1
        elif tag in ("p", "li") and self._block is not None:
            self._flush_block()

    def handle_data(self, data):
        if self._skip:
            return
        if self._head:
            self._htext.append(data)
        if self._in_cell:
            self._buf.append(data)
        elif self._block is not None:
            self._block.append(data)
        if self._anchor is not None:
            self._anchor[1].append(data)

    def _flush_cell(self):
        if self._cells is not None and self._in_cell:
            self._cells.append("".join(self._buf).strip())
            self._row_links.append(self._cell_links)
        self._buf, self._cell_links = [], []
        self._in_cell = False

    def _flush_row(self):
        self._flush_cell()
        if self._cells:
            self._rows.append(self._cells)
            self._table_links.append(self._row_links)
        self._cells, self._row_links = None, None

    def _flush_block(self):
        if self._block is not None:
            text = re.sub(r"\s+", " ", "".join(self._block)).strip()
            if text:
                self.blocks.append((self._sec, self._cat, text, self._block_links))
        self._block, self._block_links = None, []


class AvailabilityParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.codes, self._head, self._htext, self._capture, self._code, self._ctext, self._skip = [], None, [], False, False, [], 0
        self.anchor, self._hid, self._blocks, self._lead = "", None, [], None

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self._skip += 1
        elif tag in ("h1", "h2", "h3", "h4"):
            self._head, self._htext, self._capture, self._lead = tag, [], False, None
            self._hid = dict(attrs).get("id")
        elif tag == "code":
            self._code, self._ctext = True, []
        elif tag in ("li", "p"):
            self._blocks.append(tag)

    def handle_endtag(self, tag):
        if tag in ("script", "style") and self._skip:
            self._skip -= 1
        elif tag in ("li", "p") and self._blocks:
            self._blocks.pop()
            if self._lead is not None and len(self._blocks) < self._lead:
                self._capture, self._lead = False, None
        elif tag == self._head:
            self._capture = bool(AVAIL_HEAD.search("".join(self._htext)))
            if self._capture and not self.anchor and self._hid:
                self.anchor = self._hid
            self._head = None
        elif tag == "code" and self._code:
            self._code = False
            if self._capture:
                self.codes.append("".join(self._ctext).strip())

    def handle_data(self, data):
        if self._skip:
            return
        if self._head:
            self._htext.append(data)
        elif self._code:
            self._ctext.append(data)
        elif not self._capture and AVAIL_LEAD.search(data):
            items = [i for i, t in enumerate(self._blocks) if t == "li"]
            self._capture, self._lead = True, (items[-1] + 1 if items else None)
            if not self.anchor and self._hid:
                self.anchor = self._hid


def parse_product_page(html, supported):
    p = AvailabilityParser()
    p.feed(html)
    listed = {clean_code(c) for c in p.codes}
    return {code: code in listed for code in supported}


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=45) as r:
        return r.read().decode("utf-8", "replace")


def tables_of(html):
    p = TableParser()
    p.feed(html)
    return p.tables


def clean_code(s):
    """Region codes carry footnote markers on the Azure docs (southcentralus*,
    uksouth†) that differ between the supported-regions and feature-region tables,
    so the same region reads as two different codes and a feature cell orphans off
    the region list. Strip every trailing non-alphanumeric so both tables agree."""
    return re.sub(r"[^a-z0-9]+$", "", (s or "").strip())


def is_region_row(cell):
    return bool(re.fullmatch(r"[a-z]{2}(-[a-z]+)?-[a-z0-9-]*\d", cell.strip())) \
        or bool(re.fullmatch(r"[a-z]+[a-z0-9]*", cell.strip())) and "-" not in cell


def parse_supported(html):
    """The region list: the table whose header is Region | Location and whose
    rows are region-code | location, with no extra feature columns."""
    out = {}
    for rows in tables_of(html):
        if not rows:
            continue
        head = [c.lower() for c in rows[0]]
        if len(head) == 2 and head[0].startswith("region") and "location" in head[1]:
            for r in rows[1:]:
                if len(r) >= 2 and r[0]:
                    out[clean_code(r[0])] = r[1].strip()
    return out


def parse_features(html):
    """Every limited-availability table: header Region|Location|<feat>|<feat>...
    Returns {feature_label: {region_code: bool}}. Later duplicate tables (the doc
    renders each twice) simply overwrite with identical data."""
    feats = {}
    for rows in tables_of(html):
        if len(rows) < 2:
            continue
        head = rows[0]
        low = [c.lower() for c in head]
        if not (low[0].startswith("region") and len(head) >= 3 and "location" in low[1]):
            continue
        cols = head[2:]
        for r in rows[1:]:
            if len(r) < 2 or not r[0]:
                continue
            code = clean_code(r[0])
            vals = r[2:]
            for i, label in enumerate(cols):
                lab = column_name(label)
                if not lab:
                    continue
                has = i < len(vals) and CHECK in vals[i]
                feats.setdefault(lab, {})[code] = bool(has)
    return feats


def squash(s):
    return re.sub(r"\s+", " ", s or "").strip()


def split_label(label):
    lab = squash(label)
    m = re.match(r"^(.*?)\s*((?:\*\*|[*†‡§¶‖⥂])+)$", lab)
    return (m.group(1), m.group(2)) if m and m.group(1) else (lab, "")


def column_name(label):
    lab = split_label(label)[0]
    return SAME_FEATURE.get(lab, lab)


def norm(s):
    return re.sub(r"[^a-z0-9_]+", " ", STAGE_IN_NAME.sub("", s or "").lower()).strip()


def mark_effect(kind, mark, cloud):
    return MARK_EFFECT.get((kind, mark, cloud)) or MARK_EFFECT.get((kind, mark))


def public_url(u):
    return re.sub(r"^https://learn\.microsoft\.com/[a-z]{2}-[a-z]{2}/", "https://learn.microsoft.com/", u or "")


def parsed(html):
    p = TableParser()
    p.feed(html)
    return p


def doc_links(p):
    out = {}
    for sec, _, _, links in p.blocks:
        for text, href in links:
            if text and href and not href.startswith(("#", "javascript")):
                out.setdefault(sec, []).append((text, href))
    return out


def link_for(col, links):
    want = next((v for k, v in LINK_TEXT.items() if col.startswith(k)), None)
    nc = norm(col)
    for text, href in links:
        nt = norm(text)
        if not nt:
            continue
        if want is not None:
            if any(nt.startswith(norm(w)) for w in want):
                return href
        elif nt == nc or nc.startswith(nt + " ") or nt.startswith(nc + " "):
            return href
    return None


def legends(p, kind, cloud, problems):
    out = {}
    for sec, _, text, _ in p.blocks:
        m = MARK_LEAD.match(text)
        if not m:
            continue
        mark, said = m.group(1), m.group(2)
        effect = mark_effect(kind, mark, cloud)
        if effect is None:
            problems.append(f"{cloud} {kind} page: marker {mark!r} ('{said[:70]}') has no MARK_EFFECT entry; "
                            f"record whether it makes availability conditional")
            continue
        entry = out.setdefault(sec, {}).setdefault(mark, {"t": "", "c": effect == "conditional"})
        if said not in entry["t"]:
            entry["t"] = (entry["t"] + " " + said).strip()
    return out


def category(title):
    return re.sub(r"\s+availability$", "", title or "", flags=re.I).strip() or title


def feature_meta(html, page_url, cloud, problems):
    p = parsed(html)
    links, legend = doc_links(p), legends(p, "feature", cloud, problems)
    meta, marks = {}, {}
    for rows, (sec, cat) in zip(p.tables, p.where):
        low = [c.lower() for c in rows[0]]
        if not (low[0].startswith("region") and len(low) >= 3 and "location" in low[1]):
            continue
        for i, label in enumerate(rows[0][2:]):
            col, hm = column_name(label), split_label(label)[1]
            if not col:
                continue
            if col not in meta:
                href = link_for(col, links.get(sec, []))
                if not href:
                    problems.append(f"{cloud}: feature '{col}' has no docs link in its section '{sec}' "
                                    f"(links there: {[t for t, _ in links.get(sec, [])]}); add it to LINK_TEXT")
                meta[col] = {"cat": category(cat), "sec": sec, "doc": urljoin(page_url, href) if href else "",
                             "src": page_url + "#" + sec}
                if hm:
                    meta[col]["hm"] = hm
            for r in rows[1:]:
                if len(r) < 2 or not r[0]:
                    continue
                v = r[2 + i] if 2 + i < len(r) else ""
                found = "".join(MARK.findall(v)) if CHECK in v else ""
                if found:
                    marks.setdefault(col, {})[clean_code(r[0])] = found
    for col, m in meta.items():
        used = set(MARK.findall(m.get("hm", ""))) | {x for v in marks.get(col, {}).values() for x in MARK.findall(v)}
        for mark in sorted(used - set(legend.get(m["sec"], {}))):
            problems.append(f"{cloud}: '{col}' carries {mark!r} but its section '{m['sec']}' explains no such marker")
    return meta, marks, legend, p


def derived_rows(p, page_url, cloud, meta, problems):
    if not DERIVED:
        return {}
    links = doc_links(p)
    said = sorted({sec for sec, _, text, _ in p.blocks if DERIVED_SAYS in text.lower()})
    says = {sec: (category(cat), re.search(r"[^.]*" + re.escape(DERIVED_SAYS) + r"[^.]*\.", text, re.I).group(0).strip())
            for sec, cat, text, _ in p.blocks if DERIVED_SAYS in text.lower()}
    if not said:
        problems.append(f"{cloud}: no section says '{DERIVED_SAYS}' any more; review DERIVED")
        return {}
    out = {}
    for name, col in DERIVED.items():
        if col not in meta:
            problems.append(f"{cloud}: DERIVED['{name}'] follows '{col}', which is not a feature column")
            continue
        href = next((link_for(name, links.get(sec, [])) for sec in said if link_for(name, links.get(sec, []))), None)
        if not href:
            problems.append(f"{cloud}: '{name}' has no docs link in the section that ties it to '{col}'")
            continue
        out[name] = {"from": col, "sec": said[0], "doc": urljoin(page_url, href), "src": page_url + "#" + said[0],
                     "cat": says[said[0]][0], "say": says[said[0]][1]}
    return out


def ds_name(cell):
    parts = [squash(x) for x in (cell or "").split("\n") if squash(x)]
    if len(parts) < 2:
        return parts[0] if parts else ""
    head, items = parts[0], parts[1:]
    if head.lower().endswith("excludes:"):
        return f"{head[:-len('excludes:')].strip()} (excludes {', '.join(items)})"
    return f"{head} {', '.join(items)}" if head.endswith(":") else " ".join(parts)


def designated(html, page_url, cloud, problems):
    p = parsed(html)
    out = {"sec": "", "src": page_url, "geos": [], "rows": [], "local": {}, "local_sec": ""}
    for rows, lrows, (sec, _) in zip(p.tables, p.links, p.where):
        head = [squash(c) for c in rows[0]]
        if not head or head[0] != "Feature":
            continue
        if len(head) > 2 and head[1] == "Model provider":
            if out["rows"]:
                continue
            out["sec"], out["src"], out["geos"] = sec, page_url + "#" + sec, head[2:]
            for r, lr in zip(rows[1:], lrows[1:]):
                href = next((h for _, h in (lr[0] if lr else []) if h and not h.startswith("#")), "")
                geo = {g: squash(r[2 + i]) if 2 + i < len(r) else "" for i, g in enumerate(head[2:])}
                for g, v in geo.items():
                    if v and not DS_STATUS.match(v):
                        problems.append(f"{cloud}: Designated Services cell '{v}' ({ds_name(r[0])}, {g}) is not a known status")
                out["rows"].append({"n": ds_name(r[0]), "prov": squash(r[1]) if len(r) > 1 else "",
                                    "doc": urljoin(page_url, href) if href else "", "geo": geo})
        elif not out["local"]:
            out["local_sec"] = sec
            for r in rows[1:]:
                out["local"][ds_name(r[0])] = {LOCAL_ALIAS.get(head[1 + i], head[1 + i]): squash(v)
                                               for i, v in enumerate(r[1:]) if 1 + i < len(head) and squash(v)}
    if not out["rows"]:
        problems.append(f"{cloud}: no Designated Services table found on {page_url}")
    legend = {}
    for d in legends(p, "designated", cloud, problems).values():
        for k, v in d.items():
            legend.setdefault(k, v)
    out["legend"] = legend
    used = {x for row in out["rows"] for v in row["geo"].values() for x in MARK.findall(v)}
    for mark in sorted(used - set(legend)):
        problems.append(f"{cloud}: a Designated Services cell carries {mark!r} but the page explains no such marker")
    return out


def partner(html, page_url, cloud, problems):
    p = parsed(html)
    out = {"sec": "", "src": page_url, "rows": [], "legend": {}, "geo": ""}
    for rows, (sec, _) in zip(p.tables, p.where):
        head = [squash(c).lower() for c in rows[0]]
        if len(head) < 3 or head[0] != "feature" or "enabled" not in head[1] or "disabled" not in head[2]:
            continue
        out["sec"], out["src"] = sec, page_url + "#" + sec
        for r in rows[1:]:
            cells = [squash(x) for x in r[:3]] + [""] * (3 - len(r[:3]))
            marks = sorted(set(MARK.findall(" ".join(cells))))
            name, on, off = (MARK.sub("", c).strip() for c in cells)
            st = STAGE_IN_NAME.search(name)
            out["rows"].append({"n": STAGE_IN_NAME.sub("", name), "st": st.group(0).strip(" ()") if st else "",
                                "on": on, "off": off, "marks": marks})
        break
    if not out["rows"]:
        problems.append(f"{cloud}: no partner-powered AI features table found on {page_url}")
        return out
    out["legend"] = legends(p, "partner", cloud, problems).get(out["sec"], {})
    for mark in sorted({m for r in out["rows"] for m in r["marks"]} - set(out["legend"])):
        problems.append(f"{cloud}: a partner-powered AI features cell carries {mark!r} but the page explains no such marker")
    said = next((m.group(0) for _, _, text, _ in p.blocks for m in [PARTNER_GEO.search(squash(text))] if m), "")
    if not said:
        problems.append(f"{cloud}: the partner-powered AI features page no longer says where Databricks-hosted models "
                        f"need cross geography processing")
    out["geo"] = said
    return out


def geo_members(html):
    for rows in tables_of(html):
        if rows and rows[0] and rows[0][0].strip().lower().startswith("databricks geo"):
            return {squash(r[0]): [squash(x) for x in r[1].split("\n") if squash(x)] for r in rows[1:] if len(r) > 1}
    return {}


def geo_of(cloud, country, members, ds_geos):
    if cloud == "azure":
        col = AZURE_GEO.get(country) or ("EU Data boundary" if country in EEA else None)
    else:
        col = next((g for g, mem in members.items()
                    if country in mem or (country in EEA and any(m.startswith("European Economic Area") for m in mem))), None)
    if col is None:
        return None
    want = norm(col.replace("&", "and"))
    return next((g for g in ds_geos if norm(g.replace("&", "and")) == want), None)


def region_geos(cloud, regions, members, ds_geos, problems):
    out = {}
    for r in regions:
        country = REGION_COUNTRY.get(r["code"])
        if not country:
            problems.append(f"{cloud}: region {r['code']} ({r['loc']}) has no country in REGION_COUNTRY")
            continue
        geo = geo_of(cloud, country, members, ds_geos)
        if geo is None and (cloud, country) not in NO_GEO:
            problems.append(f"{cloud}: {r['code']} is in {country}, which no Designated Services Geo covers; "
                            f"map it or record it in NO_GEO")
        if country not in COUNTRY_ISO:
            problems.append(f"{cloud}: {r['code']} is in {country}, which has no ISO code in COUNTRY_ISO")
        out[r["code"]] = {"country": country, "geo": geo, "iso": COUNTRY_ISO.get(country, "")}
    return out


def fill_designated_docs(clouds, problems):
    rel = {}
    for row in clouds["azure"]["designated"]["rows"]:
        if row["doc"].startswith(DOCS["azure"]):
            rel[norm(row["n"])] = row["doc"][len(DOCS["azure"]):]
    for cloud, c in clouds.items():
        for row in c["designated"]["rows"]:
            if row["doc"]:
                continue
            path = rel.get(norm(row["n"]))
            if path is None:
                problems.append(f"{cloud}: Designated Service '{row['n']}' links no docs page, and Azure has no page "
                                f"under the same name to borrow")
                continue
            row["doc"] = DOCS[cloud] + path


def rel_doc(cloud, url):
    for base in (DOCS[cloud], PUBLIC_DOCS[cloud]):
        if (url or "").startswith(base):
            return url[len(base):]
    return None


def variant_problems(clouds):
    pages = {}
    for cloud, c in clouds.items():
        for name, m in c["meta"].items():
            rel = rel_doc(cloud, m["doc"])
            if rel is not None:
                pages.setdefault(rel.split("#")[0], {}).setdefault(name, set()).add(cloud)
    out = []
    for rel, names in sorted(pages.items()):
        items = sorted(names.items())
        for i, (a, ca) in enumerate(items):
            for b, cb in items[i + 1:]:
                if not ca & cb:
                    out.append(f"'{a}' ({', '.join(sorted(ca))}) and '{b}' ({', '.join(sorted(cb))}) share the docs page "
                               f"{rel}; if they are one feature, name it once in SAME_FEATURE")
    return out


def fill_elsewhere(clouds):
    union = {}
    for cloud, c in clouds.items():
        for name, m in c["meta"].items():
            union.setdefault(("feature", name), (m["cat"], cloud, m["doc"]))
        for row in c["designated"]["rows"]:
            union.setdefault(("designated", row["n"]), ("Designated Services", cloud, row["doc"]))
    for cloud, c in clouds.items():
        have = {("feature", n) for n in c["meta"]} | {("designated", r["n"]) for r in c["designated"]["rows"]}
        out = []
        for (kind, name), (cat, src, src_doc) in sorted(union.items()):
            if (kind, name) in have:
                continue
            rel = rel_doc(src, src_doc)
            here = src_doc if rel is None else DOCS[cloud] + rel
            out.append({"n": name, "kind": kind, "cat": cat, "doc": here, "from": src, "src_doc": src_doc})
        c["elsewhere"] = out


def page_stages(urls, problems, required=True):
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import scrape_stages as ss
    pages = sorted({u.split("#")[0] for u in urls if u})
    ss.prefetch(pages, fetch)
    out = {}
    for u in pages:
        body = ss.get(u, fetch)
        if body is None:
            if required:
                problems.append(f"docs page {u} is missing")
            continue
        out[u] = ss.api_stage(body) if "/api/" in u else ss.notice_stage(ss.parse(body))
    return out


def region_statement(html):
    body = re.sub(r"<(script|style|nav|header|footer|aside)\b.*?</\1>", " ", html, flags=re.S | re.I)
    text = re.sub(r"\s+", " ", unescape(re.sub(r"<[^>]+>", " ", body)))
    m = REGION_REQ.search(text)
    if m:
        return m.group(0).strip()[:160]
    return "links to the regional availability page" if REGION_LINK.search(body) else None


def page_problems(flags, alias, product_pages, reviewed):
    out = []
    for name in sorted(flags):
        if name in alias or name in product_pages or name in reviewed:
            continue
        cloud, said = flags[name][0]
        out.append(f"{name}: its {cloud} docs page states a region requirement ('{said}'); "
                   f"map it in ALIAS or PRODUCT_PAGES, or record why not in REVIEWED")
    for name in sorted(set(reviewed) - set(flags)):
        out.append(f"REVIEWED[{name!r}] backs no region statement on any docs page any more; remove it")
    return out


def board_products():
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from scrape_stages import board_arch
    arch, names = board_arch(), set()

    def walk(node, keep):
        if isinstance(node, list):
            for x in node:
                walk(x, keep)
        elif isinstance(node, dict):
            if isinstance(node.get("n"), str) and keep(node):
                names.add(node["n"])
            for v in node.values():
                walk(v, keep)

    walk(arch.get("bands"), lambda t: True)
    walk((arch.get("cloud") or {}).get("providers"), lambda t: t.get("role") == "network")
    return names


def staged_boxes():
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import scrape_stages as ss
    return set(ss.staged_tiles(ss.board_arch()))


def review_pages(links):
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import scrape_stages as ss
    names = sorted(n for n in board_products() if (links.get(n) or {}).get("doc"))
    jobs = [(n, c) for n in names for c in (links[n].get("docClouds") or list(DOCS))]

    def one(job):
        n, c = job
        try:
            body = fetch(DOCS[c] + links[n]["doc"].lstrip("/"))
        except Exception:
            return n, c, None, None
        return n, c, region_statement(body), ss.notice_stage(ss.parse(body))

    flags, stages = {}, {}
    with concurrent.futures.ThreadPoolExecutor(8) as ex:
        for n, c, said, stage in ex.map(one, jobs):
            if said:
                flags.setdefault(n, []).append((c, said))
            if stage:
                stages.setdefault(c, {})[n] = stage
    return flags, stages


def product_anchor(html):
    p = AvailabilityParser()
    p.feed(html)
    return p.anchor


def build():
    clouds, problems = {}, []
    for cloud, urls in SOURCES.items():
        sup_html = fetch(urls["supported"])
        feat_html = fetch(urls["feature"])
        supported = parse_supported(sup_html)
        features = parse_features(feat_html)
        regions = [{"code": k, "loc": v} for k, v in supported.items()]
        meta, marks, legend, fp = feature_meta(feat_html, urls["feature"], cloud, problems)
        ds = designated(fetch(urls["designated"]), urls["designated"], cloud, problems)
        pp = partner(fetch(urls["partner"]), urls["partner"], cloud, problems)
        members = {} if cloud == "azure" else geo_members(fetch(urls["geos"]))
        clouds[cloud] = {
            "regions": regions,
            "features": features,
            "meta": meta,
            "marks": marks,
            "legend": legend,
            "derived": derived_rows(fp, urls["feature"], cloud, meta, problems),
            "designated": ds,
            "partner": pp,
            "geo": region_geos(cloud, regions, members, ds["geos"], problems),
        }
        sys.stderr.write(
            f"{cloud}: {len(supported)} regions, {len(features)} limited features, "
            f"{len(ds['rows'])} Designated Services\n")
    overlap = sorted(set(ALIAS) & set(PRODUCT_PAGES))
    if overlap:
        raise SystemExit(f"mapped twice (ALIAS and PRODUCT_PAGES): {overlap}")
    alias, pages = dict(ALIAS), {}
    for prod, by_cloud in PRODUCT_PAGES.items():
        label = prod + PAGE_SUFFIX
        alias[prod] = label
        for cloud, url in by_cloud.items():
            if url not in pages:
                pages[url] = fetch(url)
            codes = [r["code"] for r in clouds[cloud]["regions"]]
            col = parse_product_page(pages[url], codes)
            clouds[cloud]["features"][label] = col
            clouds[cloud].setdefault("feature_sources", {})[label] = url
            if url.startswith(DOCS[cloud]):
                anchor = product_anchor(pages[url])
                clouds[cloud]["meta"][label] = {"cat": "Product page", "sec": anchor, "doc": url,
                                                "src": url + ("#" + anchor if anchor else "")}
            sys.stderr.write(f"{cloud}: {prod} product page lists {sum(col.values())} of {len(codes)} regions\n")
    fill_designated_docs(clouds, problems)
    problems += variant_problems(clouds)
    rows = [m for c in clouds.values()
            for m in list(c["meta"].values()) + list(c["derived"].values()) + c["designated"]["rows"]]
    stages = page_stages([m["doc"] for m in rows] + [c["partner"]["src"] for c in clouds.values()], problems)
    for m in rows:
        if m["doc"]:
            m["st"] = stages.get(m["doc"].split("#")[0], "")
    for c in clouds.values():
        page = stages.get(c["partner"]["src"].split("#")[0], "")
        for r in c["partner"]["rows"]:
            r["st"] = r["st"] or page
    fill_elsewhere(clouds)
    away = [e for c in clouds.values() for e in c["elsewhere"]]
    found = page_stages([e["doc"] for e in away], problems, required=False)
    for e in away:
        st = found.get(e["doc"].split("#")[0])
        e["doc"], e["st"] = (e["doc"], st) if st else ("", "")
    for m in rows + away + [c[k] for c in clouds.values() for k in ("designated", "partner")]:
        for k in ("doc", "src", "src_doc"):
            if m.get(k):
                m[k] = public_url(m[k])
    if problems:
        raise SystemExit("regional availability data is incomplete:\n  " + "\n  ".join(problems))
    return {
        "generated": datetime.date.today().isoformat(),
        "sources": {c: {k: public_url(u) for k, u in v.items()} for c, v in SOURCES.items()},
        "alias": alias,
        "clouds": clouds,
    }

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true",
                    help="scrape and diff against the committed file; exit 1 on drift")
    args = ap.parse_args()
    data = build()

    # every cloud must have yielded regions and at least one limited feature, or
    # the doc layout moved and a silent empty file would poison the runtime.
    for cloud, c in data["clouds"].items():
        if not c["regions"]:
            raise SystemExit(f"{cloud}: 0 regions scraped — doc layout changed")
        if not c["features"]:
            raise SystemExit(f"{cloud}: 0 limited features scraped — doc layout changed")
    for prod in PRODUCT_PAGES:
        label = prod + PAGE_SUFFIX
        if not any(any((c["features"].get(label) or {}).values()) for c in data["clouds"].values()):
            raise SystemExit(f"{prod}: its product pages list no region on any cloud — doc layout changed")
    links = json.load(open(os.path.join(ROOT, "app", "resources", "links.json"), encoding="utf-8"))
    flags, stages = review_pages(links)
    staged = staged_boxes()
    for cloud, c in data["clouds"].items():
        c["products"] = {n: st for n, st in sorted(stages.get(cloud, {}).items()) if n not in staged}
    problems = page_problems(flags, ALIAS, PRODUCT_PAGES, REVIEWED)
    if problems:
        raise SystemExit("product pages state region requirements the data does not carry:\n  " + "\n  ".join(problems))
    sys.stderr.write(f"product pages: {len(flags)} board products state a region requirement, every one mapped or reviewed\n")

    new = json.dumps(data, ensure_ascii=False, indent=1, sort_keys=True)
    if args.check:
        old = open(OUT, encoding="utf-8").read() if os.path.exists(OUT) else ""
        # compare on everything but the generated date
        def strip_date(s):
            return re.sub(r'"generated":\s*"[^"]*"', '"generated":""', s)
        if strip_date(old) != strip_date(new):
            sys.stderr.write("regions.json is stale — re-run tools/scrape_regions.py\n")
            sys.exit(1)
        sys.stderr.write("regions.json up to date\n")
        return
    open(OUT, "w", encoding="utf-8").write(new)
    sys.stderr.write(f"wrote {OUT}\n")


if __name__ == "__main__":
    main()
