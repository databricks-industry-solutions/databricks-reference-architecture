import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import (
    app, biz, cons_rail, dashboard, data_out, fed_group, flow, genie, ing_rail,
    medallion, tile, top_band, uc,
)


def ppl2(business_tiles, tech_tiles):
    """Business tiles plus an explicit, industry-specific Technical group of 3."""
    return [
        {"box": "Business", "ic": "zbrief", "tiles": business_tiles[:5]},
        {"box": "Technical", "ic": "code", "tiles": tech_tiles[:3]},
    ]


INDUSTRIES_BATCH_GENOMICS_BIOTECH = {
    'genomics_biotech': {
        "label": "Genomics & Biotech",
        "blurb": "Genomics and biotechnology: sequencing pipelines, variant interpretation, lab operations, clinical trial biomarkers and regulated research data.",
        "medallion": medallion(
            "Raw sequence and LIMS",
            "FASTQ and BAM files, LIMS sample metadata, instrument QC metrics and electronic lab notebook entries, landed exactly as received so a variant call or a sample chain can always be replayed.",
            "Conformed sample, variant",
            "Samples, subjects, assays and variant calls resolved into single conformed entities across LIMS, sequencers and analysis pipelines, with sample lineage reconciled from collection through report.",
            "Actionable clinical biomarkers",
            "Contracted products clinical and research teams run on: variant classification tiers, trial enrolment biomarker rates, lab turnaround time, and pipeline QC pass rates.",
        ),
        "rails": {
            "src": [
                {"box": "Sequencing & Omics", "ic": "stream", "tiles": [
                    tile("Illumina BaseSpace", "db", "Run metadata, cluster density and demultiplexed FASTQ from NovaSeq and NextSeq instruments.", "illumina-basespace",
                         cat="Sequencing Platform (NGS)",
                         what="Runs short-read sequencing and emits run metadata, QC metrics and demultiplexed FASTQ from NovaSeq and NextSeq instruments into the analysis pipeline.",
                         users="Bioinformatics, Pipeline Engineers and Lab Operations.",
                         data_out=data_out(
                             batch=flow(["unstructured", "structured"], "0.5-5 TB/run (FASTQ/BAM)", "Per-run on completion (hours)"))),
                    tile("Oxford Nanopore EPI2ME", "iot", "Long-read basecalls, methylation and structural variant calls from MinION and PromethION.", "nanopore-epi2me",
                         cat="Long-Read Sequencing Platform",
                         what="Produces long-read basecalls, methylation and structural-variant calls in real time from MinION and PromethION devices for genome assembly and SV detection.",
                         users="Bioinformatics, Computational Biologists and Pipeline Engineers.",
                         data_out=data_out(
                             batch=flow(["unstructured", "structured"], "0.1-3 TB/run", "Per-run"),
                             stream=flow(["semi-structured"], "reads as basecalled", "Continuous during run"))),
                    tile("10x Genomics Cloud", "api", "Single-cell and spatial gene expression matrices from Chromium and Visium workflows.", "10x-cloud",
                         cat="Single-Cell / Spatial Genomics Platform",
                         what="Processes Chromium and Visium workflows into single-cell and spatial gene-expression matrices for target discovery and tumour-microenvironment analysis.",
                         users="Computational Biologists, Single-Cell Analysts and Bioinformatics.",
                         data_out=data_out(
                             batch=flow(["structured", "unstructured"], "10-200 GB/run (matrices)", "Per-run"))),
                ]},
                {"box": "Lab & Sample Mgmt", "ic": "erp", "tiles": [
                    tile("Benchling R&D Cloud", "notebook", "Sample registration, chain of custody and structured experiment records.", "benchling",
                         cat="Electronic Lab Notebook / R&D Platform",
                         what="Registers samples, records structured experiments and holds chain of custody so bench work and molecular biology data stay linked to a sample identity.",
                         users="Research scientists, Computational Biologists and Biobank Managers.",
                         data_out=data_out(
                             batch=flow(["structured", "semi-structured"], "1-5 GB/day", "Nightly sync + on save"))),
                    tile("LabVantage LIMS", "db", "Clinical and research sample accessioning, aliquots and result release.", "labvantage",
                         cat="Laboratory Information Management System (LIMS)",
                         what="Manages sample accessioning, aliquots, testing workflow and result release across clinical and research labs, the operational spine of the lab.",
                         users="Lab Operations, Lab Directors and Variant Scientists.",
                         data_out=data_out(
                             batch=flow(["structured"], "1-10 GB/day", "Nightly batch + intraday updates"))),
                    tile("Thermo SampleManager", "sheet", "Biobank specimen tracking, storage location and stability across sample freezers.", "samplemanager",
                         cat="Biobank / Sample Management System",
                         what="Tracks biobank specimens, freezer storage location and stability so aliquot custody and conditions are known from collection through use.",
                         users="Biobank Managers, Reagent & Inventory Leads and Lab Operations.",
                         data_out=data_out(
                             batch=flow(["structured"], "0.5-3 GB/day", "Nightly batch"))),
                ]},
                {"box": "Clinical & Trials", "ic": "people", "tiles": [
                    tile("Medidata Rave EDC", "gavel", "Electronic case report forms, visit schedules and protocol deviations.", "medidata-rave",
                         cat="Electronic Data Capture (EDC)",
                         what="Captures case report forms, visit schedules and protocol deviations for the trials that consume biomarker and genomic results.",
                         users="Clinical Operations, Clinical Trial Managers and Site Monitors.",
                         data_out=data_out(
                             batch=flow(["structured"], "1-8 GB/day per study", "Nightly extracts"))),
                    tile("Veeva Vault CTMS", "partner", "Site activation, enrolment milestones and monitoring visit findings.", "veeva-ctms",
                         cat="Clinical Trial Management System (CTMS)",
                         what="Tracks site activation, enrolment milestones and monitoring visit findings so trial operations see enrolment against target by site.",
                         users="Clinical Operations, Clinical Trial Managers and Patient Recruitment Leads.",
                         data_out=data_out(
                             batch=flow(["structured"], "0.5-3 GB/day", "Nightly sync"))),
                    tile("Flatiron Oncology EHR", "custlake", "De-identified oncology clinical records for real-world evidence cohorts.", "flatiron",
                         cat="Real-World Oncology Data (EHR-derived)",
                         what="De-identified, curated oncology EHR records used to build real-world-evidence cohorts and link genomic results to treatment outcomes.",
                         users="CSO & CFO, Computational Biologists and Patient Recruitment Leads.",
                         data_out=data_out(
                             batch=flow(["structured", "unstructured"], "10-50 GB per cohort", "Periodic curated refreshes"))),
                ]},
                {"box": "Knowledge & Reference", "ic": "globe", "tiles": [
                    tile("ClinVar & gnomAD", "share", "Public variant pathogenicity and population frequency references for annotation.", "clinvar",
                         cat="Variant Reference Database",
                         what="Public references for variant pathogenicity (ClinVar) and population allele frequency (gnomAD) used to annotate and classify called variants.",
                         users="Bioinformatics, Variant Scientists and Reference Data Curators.",
                         data_out=data_out(
                             batch=flow(["structured"], "GBs (reference releases)", "Periodic version releases"))),
                    tile("COSMIC Cancer DB", "db", "Somatic mutation catalogue for oncology biomarker interpretation.", "cosmic",
                         cat="Somatic Mutation Reference Database",
                         what="Catalogue of somatic mutations in cancer used to interpret oncology biomarkers and prioritise variants for review.",
                         users="Bioinformatics, Variant Scientists and Computational Biologists.",
                         data_out=data_out(
                             batch=flow(["structured"], "GBs (reference releases)", "Periodic version releases"))),
                    tile("Instrument QC Telemetry", "observ", "Sequencer health, reagent lot and calibration drift joined to run outcomes.",
                         cat="Sequencer Instrument Telemetry",
                         what="Streams sequencer health, reagent-lot and calibration-drift signals joined to run outcomes so failing runs are caught before bad calls propagate.",
                         users="Lab Operations, Pipeline Engineers and Quality Managers.",
                         data_out=data_out(
                             stream=flow(["semi-structured"], "continuous instrument metrics", "Continuous during runs"))),
                ]},
                fed_group(
                    "CRO Analysis Results",
                    "Contract research organisation variant reports left at partners and queried in place under Unity Catalog.",
                    cat="CRO Bioinformatics Results",
                    what="Variant and QC analysis results produced by contract research organisations, left at the partner and queried in place through federation rather than copied.",
                    users="Bioinformatics, Regulatory & Quality and Compliance Leads.",
                    data_out=data_out(
                        batch=flow(["structured", "semi-structured"], "TB-scale partner results", "Queried on demand (federated)"))),
            ],
            "ing": ing_rail([
                tile("GA4GH WES/WGS APIs", "api", "Beacon and phenopacket exchange endpoints consumed inbound for federated discovery.", "ga4gh",
                     cat="Genomics Data Exchange Standard (GA4GH)",
                     what="Beacon and phenopacket exchange endpoints consumed inbound for federated variant discovery across institutions without moving patient-level files.",
                     users="Bioinformatics, Computational Biologists and Compliance Leads.",
                     data_out=data_out(
                         stream=flow(["semi-structured"], "100s of API calls/query", "Continuous (API / federated)"))),
                tile("HL7 FHIR Genomics", "stream", "Diagnostic report and observation resources normalised on ingest for clinical integration.", "fhir-genomics",
                     cat="Clinical Interoperability Standard (FHIR Genomics)",
                     what="Diagnostic-report and observation resources normalised on ingest so genomic results integrate with clinical systems at ordering and reporting.",
                     users="Bioinformatics, Clinical Operations and App Developers.",
                     data_out=data_out(
                         stream=flow(["semi-structured"], "10s-100s of resources/sec", "Continuous (API / event)"))),
                tile("dbGaP Authorised Access", "gavel", "Controlled-access cohort files retrieved under DAC-approved scopes.",
                     cat="Controlled-Access Genomic Data Repository",
                     what="Controlled-access cohort files (genotypes and phenotypes) retrieved under Data Access Committee-approved scopes for research cohorts.",
                     users="Computational Biologists, Bioinformatics and Compliance Leads.",
                     data_out=data_out(
                         batch=flow(["structured", "unstructured"], "100s of GB per cohort", "On approval / periodic pulls"))),
            ]),
            "ppl": ppl2([
                biz("CSO & CFO", "Genie One", "The CSO on sequencing throughput and biomarker programme progress; the CFO on CRO spend, cost-per-sample and trial enrolment velocity.",
                    [["Genie One", "Ask how many samples cleared QC this week without waiting on bioinformatics."], ["AI/BI", "Throughput, QC and trial metrics on one certified set of Metric Views."], ["Unity Catalog", "Certification and the business glossary, so \"pathogenic\" means one thing across labs."]],
                    sub=[
                        ["Chief Scientific Officer", "sequencing throughput and whether biomarker programmes are converting into targets."],
                        ["Chief Financial Officer", "CRO spend, cost-per-sample and trial enrolment velocity against the budget."],
                        ["Head of Translational Research", "which discovery programmes are ready to move into the clinic."],
                    ],
                    ucs=["Biomarker Discovery", "Real-World Evidence", "Trial Enrolment"]),
                biz("Bioinformatics", "Model Serving", "Pipeline engineers and analysts on variant calling, annotation and the VUS queue, deciding what is safe to release to clinicians at sign-out.",
                    [["Variant Review Workbench", "VUS queues prioritised by evidence tier before sign-out."], ["Model Serving", "Classifier models scored in the interpretation path."], ["MLflow", "Pipeline runs tracked for CLIA and CAP audit."]],
                    sub=[
                        ["Variant Scientists", "the VUS queue and the evidence tier behind every classification at sign-out."],
                        ["Pipeline Engineers", "that variant calling and annotation stay reproducible release to release."],
                        ["Computational Biologists", "single-cell and multi-omic signals that point to a new target."],
                    ],
                    ucs=["Variant Interpretation", "Single-Cell Analytics", "Reference Data Harmonisation", "Pharmacogenomics"]),
                biz("Clinical Operations", "AI/BI", "Trial managers on site enrolment against target, sample-collection SLAs and protocol deviations before a site is at risk of closing.",
                    [["Trial Enrolment Tracker", "Biomarker-positive screen failures surfaced before sites close."], ["AI/BI", "Enrolment and deviation metrics on certified Metric Views."], ["Unity Catalog", "One definition of subject status across EDC and LIMS."]],
                    sub=[
                        ["Clinical Trial Managers", "site enrolment against target and the screen-failure rate by protocol."],
                        ["Site Monitors", "protocol deviations and sample-collection SLAs before a site is at risk."],
                        ["Patient Recruitment Leads", "matching biomarker-positive candidates to open protocols."],
                    ],
                    ucs=["Trial Enrolment", "Real-World Evidence", "Biomarker Discovery"]),
                biz("Lab Operations", "Lakeflow", "Lab directors on assay turnaround time, reagent-lot inventory and instrument utilisation before a client escalates a late result.",
                    [["Lab Ops Dashboard", "Queue depth and TAT by assay before clients escalate."], ["Lakeflow", "LIMS and instrument feeds conformed for operations analytics."], ["Lakewatch", "Freshness on the tables sign-out depends on."]],
                    sub=[
                        ["Lab Directors", "assay turnaround time and whether sign-out will hit its SLA today."],
                        ["Reagent & Inventory Leads", "reagent-lot availability and expiry before it stops a run."],
                        ["Biobank Managers", "aliquot location, storage conditions and sample chain of custody."],
                    ],
                    ucs=["Lab Turnaround Optimisation", "Sample Chain of Custody"]),
                biz("Regulatory & Quality", "AI/BI", "Quality and regulatory affairs on CAP and CLIA audits, QC failure rates and the validation documentation a submission stands or falls on.",
                    [["Lab Quality & Accreditation", "QC failure rates and CAPA aging on governed definitions."], ["AI/BI", "Audit-ready dashboards regulators can trace."], ["Unity Catalog", "Lineage from raw FASTQ to signed report."]],
                    sub=[
                        ["Quality Managers", "QC failure rates, CAPA aging and proficiency testing outcomes."],
                        ["Regulatory Affairs", "the validation and reproducibility evidence a submission stands on."],
                        ["Compliance Leads", "CAP and CLIA audit readiness and lineage from FASTQ to signed report."],
                    ],
                    ucs=["Pipeline Reproducibility", "Sample Chain of Custody", "Reference Data Harmonisation"]),
            ], [
                biz("Data Engineers", "Lakeflow", "Land the sequencer, LIMS and trial EDC feeds; own the Bronze to Silver path and the pager when a run or sample feed breaks.",
                    [["Lakeflow Connect", "Managed connectors for BaseSpace, LIMS and EDC sources."], ["Lakeflow Designer", "Declarative pipelines with expectations on FASTQ and sample feeds."], ["Lakewatch", "Freshness on the tables sign-out and trial teams read every morning."]],
                    sub=[
                        ["Ingestion Engineers", "the BaseSpace, LIMS and EDC connectors and the Bronze-to-Silver path."],
                        ["Pipeline Reliability", "the pager when a sequencing run or a sample feed breaks overnight."],
                        ["Reference Data Curators", "versioned ClinVar, gnomAD and COSMIC tables downstream teams depend on."],
                    ],
                    ucs=["Lab Turnaround Optimisation", "Reference Data Harmonisation", "Sample Chain of Custody"]),
                biz("Data Scientists", "MLflow", "Variant-classification, biomarker-discovery and turnaround-time models, and whether they still hold under CAP and CLIA validation.",
                    [["Feature Store", "Sample and variant features defined once for training and serving."], ["MLflow", "Every pipeline run tracked for CLIA and CAP audit."], ["Model Serving", "Classifier models scored in the interpretation path."]],
                    sub=[
                        ["ML Engineers", "variant-classification and biomarker models and their drift over time."],
                        ["Validation Scientists", "whether a model still holds under CAP and CLIA validation."],
                        ["Single-Cell Analysts", "clustering, annotation and perturbation across large cell atlases."],
                    ],
                    ucs=["Variant Interpretation", "Biomarker Discovery", "Single-Cell Analytics", "Pharmacogenomics"]),
                biz("App Developers", "Apps", "Ship the variant review, enrolment-tracking and lab-ops applications the labs work in, hosted next to governed data.",
                    [["Apps", "Review and lab screens with no separate web tier to run or secure."], ["Lakebase", "Serverless Postgres for sign-out and sample writes."], ["Agent Bricks", "Agents that draft a variant summary or enrolment check against governed tools."]],
                    sub=[
                        ["Full-Stack Engineers", "the variant review, enrolment and lab-ops screens scientists work in."],
                        ["Lakebase Engineers", "serverless Postgres for sign-out and sample writes next to governed data."],
                        ["Agent Developers", "agents that draft a variant summary or an enrolment check against governed tools."],
                    ],
                    ucs=["Variant Interpretation", "Trial Enrolment", "Lab Turnaround Optimisation"]),
            ]),
            "cons": cons_rail([
                {"box": "BI & Productivity", "ic": "chart", "from": "bi", "tiles": [
                    tile("Tableau / Qlik / ThoughtSpot", "chart", "External BI against serverless SQL warehouses, with Unity Catalog permissions enforced end to end."),
                    tile("Microsoft Teams", "chat", "Genie in Teams for Unity Catalog-governed answers from the lakehouse, and lab alerts in the channel teams already work in (Beta)."),
                    tile("Notebooks & IDEs", "notebook", "Notebooks, VS Code and JetBrains against governed data and Genie Code.")
                ]},
                {"box": "Clinical Writeback", "ic": "opdb", "tiles": [
                    tile("Signed Report Release", "gavel", "Interpreted variants and diagnostic narratives written back into LIMS for clinician delivery.", "labvantage"),
                    tile("EDC Biomarker Flags", "db", "Enrolment eligibility results pushed to the trial EDC at screening.", "medidata-rave"),
                    tile("Lab Queue Mobile", "apps", "Sample prep tasks and exception handling pushed to bench technologists.")
                ]},
                {"box": "Research Partners", "ic": "partner", "tiles": [
                    tile("CRO Data Exchange", "share", "Variant and QC tables shared with contract labs over Delta Sharing under study agreements."),
                    tile("Academic Collaborations", "globe", "Federated cohort queries via GA4GH beacons without exporting patient-level files.", "ga4gh"),
                    tile("Pharma Alliance Feeds", "product", "Biomarker prevalence and response summaries exchanged under collaboration MSAs.")
                ]},
                {"box": "Regulatory & Reporting", "ic": "gavel", "tiles": [
                    tile("CLIA/CAP Compliance", "gavel", "QC, proficiency and corrective action records produced from governed lab tables."),
                    tile("FDA Submission Packages", "share", "Validation summaries and analysis reproducibility filed from contracted Gold products.")
                ]},
                {"box": "Published Products", "ic": "product", "tiles": [
                    tile("Data Products", "product", "Published, contracted products discoverable in Unity Catalog Domains and shared over OpenSharing."),
                    tile("Sharing Recipients", "share", "CROs, pharma partners and consortia reading live tables with no copy and no egress duplication.")
                ]},
            ], genie_spaces=[
                genie("Variant Interpretation", "Ask about variant classifications, evidence and the VUS queue in plain language.",
                      feeds=["Illumina BaseSpace", "ClinVar & gnomAD", "COSMIC Cancer DB", "Conformed sample, variant"],
                      teams=["Bioinformatics", "Variant Scientists", "Computational Biologists"],
                      questions=[
                          "How many variants are in the VUS queue awaiting review?",
                          "Which variants were reclassified since the last reference release?",
                          "What evidence supports the pathogenic calls signed out this week?",
                          "Which genes carry the most variants of uncertain significance?",
                          "How does our classification agree with ClinVar for this variant?"]),
                genie("Lab Operations & Turnaround", "Explore assay turnaround, sample custody and instrument QC across the lab.",
                      feeds=["LabVantage LIMS", "Thermo SampleManager", "Instrument QC Telemetry", "Conformed sample, variant"],
                      teams=["Lab Operations", "Lab Directors", "Biobank Managers"],
                      questions=[
                          "What is turnaround time by assay against SLA today?",
                          "Where are samples stalling between accession and sign-out?",
                          "Which reagent lots are near expiry or running low?",
                          "How many samples cleared QC this week without rework?",
                          "Which instruments are drifting toward a QC failure?"]),
                genie("Trial Enrolment & Biomarkers", "Answer enrolment, screen-failure and biomarker-matching questions across trials.",
                      feeds=["Medidata Rave EDC", "Veeva Vault CTMS", "Flatiron Oncology EHR", "Actionable clinical biomarkers"],
                      teams=["Clinical Operations", "Clinical Trial Managers", "Patient Recruitment Leads"],
                      questions=[
                          "How is enrolment tracking to target by site and protocol?",
                          "What is the biomarker-positive screen-failure rate this month?",
                          "Which sites are behind on sample-collection SLAs?",
                          "How many biomarker-positive candidates match open protocols?",
                          "Which protocols have the highest protocol-deviation rate?"]),
                genie("Quality & Compliance", "Ask about QC failures, CAPA aging and lineage for CAP, CLIA and FDA audits.",
                      feeds=["LabVantage LIMS", "Instrument QC Telemetry", "CRO Analysis Results", "Raw sequence and LIMS"],
                      teams=["Regulatory & Quality", "Quality Managers", "Compliance Leads"],
                      questions=[
                          "What is our QC failure rate by assay this quarter?",
                          "Which CAPAs are open past their target closure date?",
                          "Can we trace this signed report from FASTQ to release?",
                          "How did we perform on the last proficiency-testing round?",
                          "Which pipeline versions produced the reports under audit?"]),
            ], dashboards=[
                dashboard("Sequencing Throughput & QC", "Samples through QC, pipeline pass rate and cost per sample on certified Metric Views.",
                          kpis=["Samples through QC", "Pipeline QC pass rate", "Cost per sample", "Sequencing turnaround", "Rework rate"],
                          teams=["CSO & CFO", "Lab Operations", "Bioinformatics"]),
                dashboard("Variant Review & Sign-out", "VUS queue depth, time to sign-out and reclassification across the review workbench.",
                          kpis=["VUS queue depth", "Time to sign-out", "Reclassification rate", "Evidence-tier coverage", "Cases per curator"],
                          teams=["Bioinformatics", "Variant Scientists", "Computational Biologists"]),
                dashboard("Trial Enrolment", "Enrolment against target, biomarker-positive rate and deviations across trials.",
                          kpis=["Enrolment vs target", "Biomarker-positive rate", "Screen-failure rate", "Sample-collection SLA", "Protocol deviations"],
                          teams=["Clinical Operations", "CSO & CFO", "Patient Recruitment Leads"]),
                dashboard("Lab Quality & Accreditation", "QC failure, CAPA aging and proficiency testing for CAP and CLIA readiness.",
                          kpis=["QC failure rate", "CAPA aging", "Proficiency-testing outcome", "Assay TAT", "Chain-of-custody exceptions"],
                          teams=["Regulatory & Quality", "Lab Operations", "Quality Managers"]),
            ]),
        },
        "top": top_band(
            [
                app("Variant Review Workbench", "Clinical sign-out", "gauge", "VUS and pathogenic calls ranked by evidence tier with literature and population frequency at the curator's fingertips."),
                app("Trial Enrolment Tracker", "Biomarker screening", "people", "Sites, screen failures and biomarker-positive enrolment against protocol targets in real time."),
                app("Lab Ops Dashboard", "Throughput & TAT", "stream", "Instrument queues, reagent lots and turnaround time by assay before clients escalate."),
                app("Pipeline QC Console", "Bioinformatics", "iot", "Run-level QC metrics and pipeline failures surfaced before downstream annotation consumes bad calls."),
            ],
            [
                uc("Variant Interpretation", "Diagnostics", "gauge", "Somatic and germline variants classified with reproducible evidence chains clinicians can defend.",
                    problem="Somatic and germline calls are assembled by hand from scattered tools and papers, so curators cannot reproduce the evidence behind a classification when a clinician or auditor questions it.",
                    who="Bioinformatics",
                    how="Sequencer output lands through Lakeflow onto Delta Lake, classifier scores from Model Serving and ClinVar and COSMIC evidence surface in the Variant Review Workbench for sign-out.",
                    comps=["Variant Review Workbench", "Model Serving", "ClinVar & gnomAD", "COSMIC Cancer DB", "Unity Catalog"],
                    stories=[
                        ["How Regeneron accelerates genomic discovery and drug-target ID", "https://www.databricks.com/customers/regeneron"],
                        ["Biogen annotates two million variants in minutes with Databricks", "https://www.databricks.com/customers/biogen"],
                    ]),
                uc("Biomarker Discovery", "Research", "sheet", "Multi-omic signals ranked for trial enrichment and companion diagnostic development.",
                    problem="Candidate biomarkers hide across sequencing, expression and outcome data in separate systems, so ranking signals for trial enrichment takes months of manual joins and one-off scripts.",
                    who="CSO & CFO",
                    how="Multi-omic features are engineered in Feature Store and scored through Model Serving, with runs tracked in MLflow and results explored in AI/BI to rank biomarkers for enrichment.",
                    comps=["Model Serving", "Feature Store", "MLflow", "10x Genomics Cloud", "AI/BI"],
                    stories=[
                        ["AstraZeneca builds a knowledge graph to generate novel target hypotheses", "https://www.databricks.com/customers/astrazeneca"],
                    ]),
                uc("Trial Enrolment", "Clinical ops", "people", "Screening workflows that match patients to protocols from genomic and clinical criteria.",
                    problem="Matching patients to protocols means reconciling genomic criteria against EDC and EHR records by hand, so biomarker-positive candidates are missed and sites fall behind enrolment targets.",
                    who="Clinical Operations",
                    how="EDC and LIMS feeds conform under Unity Catalog and eligibility is scored against genomic criteria, surfacing screen failures and biomarker-positive candidates in the Trial Enrolment Tracker.",
                    comps=["Trial Enrolment Tracker", "Medidata Rave EDC", "Veeva Vault CTMS", "AI/BI", "Unity Catalog"]),
                uc("Lab Turnaround Optimisation", "Operations", "stream", "Queue bottlenecks identified from accession through sign-out, not average TAT alone.",
                    problem="Turnaround is judged on an average that hides where samples stall, so a bottleneck between accession and sign-out is only found after a client escalates a late result.",
                    who="Lab Operations",
                    how="LIMS and instrument feeds conform through Lakeflow with Lakewatch guarding freshness, so queue depth and TAT by assay surface in the Lab Ops Dashboard before clients escalate.",
                    comps=["Lab Ops Dashboard", "LabVantage LIMS", "Lakeflow", "Lakewatch", "AI/BI"]),
                uc("Real-World Evidence", "Outcomes", "custlake", "Treatment response cohorts built from linked genomic and oncology EHR records under governance.",
                    problem="Treatment-response cohorts need genomic results linked to oncology EHR records held in different systems under different consent, so building a governed, defensible cohort is slow.",
                    who="CSO & CFO",
                    how="De-identified EHR and genomic data are conformed on Delta Lake under Unity Catalog governance and explored in AI/BI, so outcome cohorts are built with lineage instead of ad hoc extracts.",
                    comps=["Flatiron Oncology EHR", "Unity Catalog", "Delta Lake", "AI/BI", "Genie One"]),
                uc("Single-Cell Analytics", "Discovery", "notebook", "Cell-type resolution across tumour microenvironment for target identification.",
                    problem="Single-cell and spatial matrices run to millions of cells, so clustering and differential expression overwhelm a workstation and only a specialist can turn a run into a target hypothesis.",
                    who="Bioinformatics",
                    how="Expression matrices land on Delta Lake and are processed at scale with Apache Spark in Notebooks & IDEs, with runs tracked in MLflow so cell-type signals feed target identification.",
                    comps=["10x Genomics Cloud", "Apache Spark", "Notebooks & IDEs", "MLflow", "Delta Lake"],
                    stories=[
                        ["Transforming omics data management on the Databricks Platform", "https://www.databricks.com/blog/transforming-omics-data-management-databricks-data-intelligence-platform"],
                        ["Genesis Workbench: a blueprint for life sciences applications on Databricks", "https://www.databricks.com/blog/genesis-workbench-blueprint-life-sciences-applications-databricks"],
                    ]),
                uc("Pipeline Reproducibility", "Quality", "gavel", "Every analysis from FASTQ to report traced for CAP, CLIA and FDA inspection.",
                    problem="An inspector can ask how a report was produced years later, but pipeline versions, parameters and reference data are scattered across scripts and servers, so reconstructing a run is painful.",
                    who="Regulatory & Quality",
                    how="Every run is tracked in MLflow and its inputs and outputs versioned on Delta Lake under Unity Catalog, so the Pipeline QC Console can replay any analysis from FASTQ to signed report.",
                    comps=["Pipeline QC Console", "MLflow", "Unity Catalog", "Delta Lake", "Lakeflow"],
                    stories=[
                        ["Amgen modernizes analytics with a unified lakehouse to speed drug development", "https://www.databricks.com/blog/2022/03/22/amgen-modernizes-analytics-with-a-unified-data-lakehouse-to-speed-drug-development-delivery.html"],
                    ]),
                uc("Reference Data Harmonisation", "Annotation", "globe", "ClinVar, gnomAD and COSMIC updates propagated without breaking historical calls.",
                    problem="ClinVar, gnomAD and COSMIC release on their own cadence, so an annotation refresh can silently change historical calls and no one can tell which reports would move if a reference updated.",
                    who="Bioinformatics",
                    how="Reference releases land through Lakeflow as versioned Delta tables under Unity Catalog, so annotation is reproducible and the impact of an update on prior calls is traceable.",
                    comps=["ClinVar & gnomAD", "COSMIC Cancer DB", "Lakeflow", "Delta Lake", "Unity Catalog"],
                    stories=[
                        ["Genesis Workbench: GPU-accelerated variant calling and ClinVar annotation", "https://www.databricks.com/blog/genesis-workbench-blueprint-industry-ai-life-sciences-powered-databricks-and-nvidia"],
                    ]),
                uc("Sample Chain of Custody", "Compliance", "product", "Aliquot location and handling events reconciled from collection through destruction.",
                    problem="A sample moves through collection, aliquoting, storage and analysis logged in different systems, so reconstructing its handling for an audit means chasing records across LIMS and freezers.",
                    who="Lab Operations",
                    how="Registration and custody events from Benchling and LIMS conform on Delta Lake under Unity Catalog, so each aliquot's location and handling is reconciled from collection through destruction.",
                    comps=["Benchling R&D Cloud", "LabVantage LIMS", "Unity Catalog", "Delta Lake", "Lakeflow"]),
                uc("Pharmacogenomics", "Therapeutics", "market", "Drug-gene interactions surfaced at ordering for precision prescribing programmes.",
                    problem="Drug-gene interactions live in guidelines and prior sequencing that never reach the clinician at ordering, so a prescription is written without the genotype that should shape the dose.",
                    who="Bioinformatics",
                    how="Prior variant results are conformed under Unity Catalog and matched to drug-gene rules with AI Functions and Model Serving, surfacing interactions in the Variant Review Workbench at ordering.",
                    comps=["Variant Review Workbench", "HL7 FHIR Genomics", "Model Serving", "AI Functions", "Unity Catalog"],
                    stories=[
                        ["How Regeneron pairs genomic and EHR data to find drug targets", "https://www.databricks.com/customers/regeneron"],
                    ]),
            ],
        ),
        "sources": {
            "illumina-basespace": {"t": "Illumina BaseSpace Sequence Hub", "u": "https://www.illumina.com/products/by-type/informatics-products/basespace-sequence-hub.html"},
            "nanopore-epi2me": {"t": "Oxford Nanopore EPI2ME", "u": "https://epi2me.nanoporetech.com/"},
            "10x-cloud": {"t": "10x Genomics Cloud Analysis", "u": "https://www.10xgenomics.com/products/cloud-analysis"},
            "benchling": {"t": "Benchling R&D Cloud", "u": "https://www.benchling.com/"},
            "labvantage": {"t": "LabVantage LIMS", "u": "https://www.labvantage.com/"},
            "samplemanager": {"t": "Thermo Fisher SampleManager LIMS", "u": "https://www.thermofisher.com/samplemanager"},
            "medidata-rave": {"t": "Medidata Rave EDC", "u": "https://www.medidata.com/en/clinical-trial-products/clinical-data-management/edc-systems/"},
            "veeva-ctms": {"t": "Veeva Vault CTMS", "u": "https://www.veeva.com/products/vault-ctms/"},
            "flatiron": {"t": "Flatiron Health oncology data", "u": "https://flatiron.com/"},
            "clinvar": {"t": "NCBI ClinVar", "u": "https://www.ncbi.nlm.nih.gov/clinvar/"},
            "cosmic": {"t": "COSMIC cancer database", "u": "https://cancer.sanger.ac.uk/cosmic"},
            "ga4gh": {"t": "Global Alliance for Genomics and Health", "u": "https://www.ga4gh.org/"},
            "fhir-genomics": {"t": "HL7 FHIR genomics implementation guide", "u": "https://hl7.org/fhir/uv/genomics-reporting/"}
        },
    },
}
