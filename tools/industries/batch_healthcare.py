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


INDUSTRIES_BATCH_HEALTHCARE = {
    'healthcare': {
        "label": "Healthcare",
        "blurb": "Health systems and hospitals: EHR clinical data, revenue cycle, capacity management, population health and quality reporting.",
        "medallion": medallion(
            "Raw clinical feeds",
            "HL7 ADT and ORU messages, FHIR resources, charge master transactions, imaging DICOM metadata and device telemetry, landed exactly as received so a diagnosis or a charge can always be replayed.",
            "Conformed patient, encounter",
            "Patients, encounters, orders and charges resolved into single conformed entities across EHR, billing and ancillary systems, with MRNs reconciled and transfers stitched to one episode.",
            "LOS, margin, outcomes",
            "Contracted products clinical and finance leaders run on: length of stay, contribution margin by service line, readmission rates, and quality measure attainment.",
        ),
        "rails": {
            "src": [
                {"box": "EHR & Clinical", "ic": "erp", "tiles": [
                    tile("Epic Caboodle", "db", "Orders, results, notes and billing extracts from the hospital EHR of record.", "epic",
                         cat="Electronic Health Record (EHR)",
                         what="Emits orders, results, clinical notes and billing extracts from the hospital EHR of record via its Caboodle data warehouse.",
                         users="Clinical Operations, Revenue Cycle and Population Health teams.",
                         data_out=data_out(
                             batch=flow(["structured", "unstructured"], "100-400 GB/day incl. notes", "Nightly Caboodle refresh + intraday deltas"),
                             stream=flow(["semi-structured"], "hundreds of HL7 msgs/sec at peak", "Continuous HL7/FHIR feed"))),
                    tile("Oracle Health Millennium", "erp", "Inpatient and ambulatory clinical, scheduling and documentation for Cerner estates.", "oracle-millennium",
                         cat="Electronic Health Record (EHR)",
                         what="Runs inpatient and ambulatory clinical care, scheduling and documentation on Cerner-based estates, feeding clinical and encounter records.",
                         users="Clinical Operations, clinicians and Quality & Safety teams.",
                         data_out=data_out(
                             batch=flow(["structured", "unstructured"], "50-200 GB/day", "Nightly batch"),
                             stream=flow(["semi-structured"], "hundreds of HL7 msgs/sec at peak", "Continuous HL7 feed"))),
                    tile("Meditech Expanse", "sheet", "Acute and post-acute clinical records for community hospital networks.", "meditech",
                         cat="Electronic Health Record (EHR)",
                         what="Holds acute and post-acute clinical records for community hospital networks, emitting encounter, order and result data.",
                         users="Clinical Operations, community-hospital clinicians and Revenue Cycle teams.",
                         data_out=data_out(
                             batch=flow(["structured", "unstructured"], "20-100 GB/day", "Nightly batch")))
                ]},
                {"box": "Revenue Cycle", "ic": "market", "tiles": [
                    tile("R1 RCM Platform", "market", "Charge capture, claims scrubbing, denials and patient collections workflow.", "r1-rcm",
                         cat="Revenue Cycle Management Platform",
                         what="Runs charge capture, claims scrubbing, denials and patient collections workflow, emitting charge, claim and denial transactions.",
                         users="Revenue Cycle, patient financial services and denial-management teams.",
                         data_out=data_out(
                             batch=flow(["structured"], "10-50 GB/day", "Nightly batch + intraday deltas"))),
                    tile("Waystar Claims", "api", "Eligibility, prior auth status and remittance advice across payers.", "waystar",
                         cat="Healthcare Claims Clearinghouse",
                         what="Handles eligibility, prior-auth status and remittance advice across payers, emitting eligibility, status and 835 remittance records.",
                         users="Revenue Cycle, billing and eligibility teams.",
                         data_out=data_out(
                             batch=flow(["structured"], "2-10 GB/day", "Daily remittance cycle"),
                             stream=flow(["semi-structured"], "tens of eligibility checks/sec", "Continuous (API)"))),
                    tile("3M 360 Encompass", "gavel", "Computer-assisted coding, CDI queries and DRG grouping across the inpatient record.", "3m-codeassist",
                         cat="Computer-Assisted Coding & CDI",
                         what="Provides computer-assisted coding, clinical-documentation-improvement queries and DRG grouping across the inpatient record.",
                         users="Revenue Cycle, clinical documentation and coding teams.",
                         data_out=data_out(
                             batch=flow(["structured", "unstructured"], "2-10 GB/day codes + queries", "Daily batch")))
                ]},
                {"box": "Imaging & Devices", "ic": "iot", "tiles": [
                    tile("Philips IntelliSpace", "stream", "Radiology worklists, study metadata and dose metrics from imaging PACS.", "philips-pacs",
                         cat="Imaging PACS / Radiology System",
                         what="Emits radiology worklists, study metadata and dose metrics from the imaging PACS for utilisation and quality analysis.",
                         users="Clinical Operations, radiology and imaging-informatics teams.",
                         data_out=data_out(
                             stream=flow(["semi-structured"], "hundreds of studies/hour", "Continuous worklist feed"))),
                    tile("Capsule Medical Device", "iot", "Bedside monitor vitals, ventilator settings and infusion pump alarms.", "capsule",
                         cat="Medical Device Integration Platform",
                         what="Aggregates bedside monitor vitals, ventilator settings and infusion-pump alarms into one device-telemetry stream.",
                         users="Quality & Safety, clinical engineering and bedside nursing teams.",
                         data_out=data_out(
                             stream=flow(["semi-structured"], "2-10k readings/sec at peak", "Continuous device telemetry"))),
                    tile("Masimo Patient SafetyNet", "gauge", "Continuous pulse oximetry and early warning scores from wearable sensors.", "masimo",
                         cat="Patient Monitoring System",
                         what="Streams continuous pulse oximetry and early-warning scores from wearable sensors for deterioration detection.",
                         users="Quality & Safety, patient-safety and rapid-response teams.",
                         data_out=data_out(
                             stream=flow(["semi-structured"], "1-5k readings/sec at peak", "Continuous sensor stream")))
                ]},
                {"box": "Operations & Staffing", "ic": "people", "tiles": [
                    tile("TeleTracking Capacity", "gauge", "Bed requests, patient placement and transfer centre milestones.", "teletracking",
                         cat="Patient Flow / Capacity Management System",
                         what="Tracks bed requests, patient placement and transfer-centre milestones, emitting bed, placement and transfer events.",
                         users="Clinical Operations, bed management and patient-flow teams.",
                         data_out=data_out(
                             stream=flow(["semi-structured"], "tens of placement events/sec", "Continuous placement feed"))),
                    tile("Kronos Workforce", "people", "Nurse schedules, acuity staffing and overtime by unit.", "kronos",
                         cat="Workforce Management System",
                         what="Holds nurse schedules, acuity staffing and overtime by unit, emitting schedule, timekeeping and overtime records.",
                         users="Clinical Operations, nursing leadership and workforce-planning teams.",
                         data_out=data_out(
                             batch=flow(["structured"], "1-5 GB/day", "Nightly batch"))),
                    tile("Press Ganey Experience", "partner", "HCAHPS and point-of-care patient satisfaction surveys.", "press-ganey",
                         cat="Patient Experience Survey Platform",
                         what="Collects HCAHPS and point-of-care patient satisfaction surveys, emitting survey responses and experience scores.",
                         users="Clinical Operations, patient-experience and quality teams.",
                         data_out=data_out(
                             batch=flow(["structured", "semi-structured"], "MBs-GBs (surveys)", "Weekly / survey cycle")))
                ]},
                fed_group(
                    "Affiliate EHR Feeds",
                    "Joint venture and affiliated clinic clinical summaries left at partner systems and queried in place under Unity Catalog.",
                    cat="Affiliated EHR / HIE Source",
                    what="Joint-venture and affiliated-clinic clinical summaries kept at partner systems and queried in place through federation instead of being copied.",
                    users="Population Health, Clinical Operations and clinical-analytics teams.",
                    data_out=data_out(
                        batch=flow(["structured", "unstructured"], "GB-scale affiliate marts", "Queried on demand (federated)")),
                ),
            ],
            "ing": ing_rail([
                tile("HL7 FHIR Bulk Data", "api", "Patient, encounter and observation exports normalised on ingest for analytics.", "fhir-bulk",
                     cat="Health Interoperability Standard (FHIR)",
                     what="Bulk Patient, Encounter and Observation FHIR exports normalised on ingest to build the conformed clinical model for analytics.",
                     users="Data Engineers, Population Health and clinical-analytics teams.",
                     data_out=data_out(
                         batch=flow(["semi-structured"], "10-50 GB/export", "Scheduled bulk export"),
                         stream=flow(["semi-structured"], "hundreds of resources/sec at peak", "Continuous FHIR subscription"))),
                tile("CMS Quality Reporting", "gavel", "Hospital compare and value-based programme specifications consumed inbound.", "cms-quality",
                     cat="Quality Program Specification",
                     what="Inbound Hospital Compare and value-based-programme specifications that define the quality measures the health system must report.",
                     users="Quality & Safety, regulatory and clinical-analytics teams.",
                     data_out=data_out(
                         batch=flow(["structured", "semi-structured"], "MBs (specifications)", "Annual / on release"))),
                tile("Syndromic Surveillance", "stream", "Public health case feeds exchanged under state reporting agreements.",
                     cat="Public Health Surveillance Feed",
                     what="Public-health case and syndromic feeds exchanged under state reporting agreements for outbreak monitoring and mandated reporting.",
                     users="Quality & Safety, infection prevention and public-health reporting teams.",
                     data_out=data_out(
                         stream=flow(["semi-structured"], "tens of case events/sec", "Continuous surveillance feed")))
            ]),
            "ppl": ppl2([
                biz("CEO, CNO & CMO", "Genie One", "The CEO on volume, contribution margin and quality scores; the CNO on staffing and patient safety; the CMO on outcomes and 30-day readmissions.",
                    [["Genie One", "Ask what yesterday's census and contribution margin were without waiting on finance."], ["AI/BI", "Volume, margin and quality on one certified set of Metric Views."], ["Unity Catalog", "Certification and the business glossary, so \"contribution margin\" means one thing across the health system."]],
                    sub=[
                        ["Chief Executive Officer", "volume, contribution margin and the quality and safety scores the board and public see."],
                        ["Chief Nursing Officer", "safe staffing ratios, patient safety and nurse retention across the units."],
                        ["Chief Medical Officer", "clinical outcomes, 30-day readmissions and physician documentation quality."],
                    ],
                    ucs=["Hospital Throughput", "Readmission Reduction", "Nurse Staffing", "Patient Experience"]),
                biz("Clinical Operations", "Lakehouse//RT", "Bed management, ED throughput and OR scheduling on a typical inpatient day, moving boarding patients before diversion becomes necessary.",
                    [["Capacity Command Centre", "ED boarding and bed placement options costed in real time."], ["Lakehouse//RT", "Live census and acuity at hospital operational latency."], ["AI/BI", "LOS and throughput on governed definitions."]],
                    sub=[
                        ["VP Patient Flow", "ED boarding, bed placement and discharge timing across the hospital."],
                        ["OR & Perioperative", "block-time utilisation, on-time first cases and surgical turnover."],
                        ["Bed Management", "transfer-centre throughput and the census that decides diversion."],
                    ],
                    ucs=["Hospital Throughput", "OR Utilisation", "Nurse Staffing", "Imaging Utilisation"]),
                biz("Revenue Cycle", "AI/BI", "Denials, underpayments and CDI queries that decide whether documented care is actually paid, flagged before the claim leaves the building.",
                    [["Denial Prevention Workbench", "At-risk accounts flagged before claim submission."], ["AI/BI", "Net revenue and denial rate on certified Metric Views."], ["Unity Catalog", "One definition of charges and payments across EHR and RCM."]],
                    sub=[
                        ["VP Revenue Cycle", "net revenue, denial rate and days in accounts receivable."],
                        ["Clinical Documentation", "query response and the gap between clinical truth and billed severity."],
                        ["Coding & Compliance", "DRG accuracy and coding audit risk before the claim submits."],
                    ],
                    ucs=["Denial Management", "Clinical Documentation"]),
                biz("Population Health", "Model Serving", "Care managers and physicians on attributed panels, open gaps in care and rising-risk patients before preventable utilisation spikes.",
                    [["Population Health Registry", "Attributed patients ranked by preventable utilisation risk."], ["Model Serving", "Readmission models scored at discharge."], ["CustomerLake", "Panel segments without copying payer files elsewhere."]],
                    sub=[
                        ["VP Population Health", "attributed-panel performance and total cost of care under value-based contracts."],
                        ["Care Management", "rising-risk patients and the interventions that prevent avoidable utilisation."],
                        ["Clinical Analytics", "risk stratification and the registries physicians act on."],
                    ],
                    ucs=["Readmission Reduction", "Research Cohorts"]),
                biz("Quality & Safety", "AI/BI", "Infection prevention, sepsis-bundle compliance and hospital-acquired-condition reduction, catching the deterioration before the public measure does.",
                    [["eCQM Quality Measures", "Core measures and HAC rates before public reporting."], ["AI/BI", "Mortality and complication indices on governed definitions."], ["Genie One", "Ask which units drove last month's CLABSI count."]],
                    sub=[
                        ["VP Quality", "core-measure attainment and the mortality and complication indices."],
                        ["Infection Prevention", "HAC, CLABSI and sepsis-bundle compliance across the units."],
                        ["Patient Safety", "harm events and the deterioration signals before the public measure moves."],
                    ],
                    ucs=["Sepsis Early Warning", "Patient Experience", "Readmission Reduction"]),
            ], [
                biz("Data Engineers", "Lakeflow", "Land the EHR, revenue-cycle and device feeds; own the Bronze to Silver path and the pager when an HL7 or charge feed breaks.",
                    [["Lakeflow Connect", "Managed connectors for EHR, RCM and ancillary sources."], ["Lakeflow Designer", "Declarative pipelines with expectations on ADT and charge feeds."], ["Lakewatch", "Freshness on the tables the command centre and finance read every morning."]],
                    sub=[
                        ["EHR Integration", "the HL7, FHIR and Clarity feeds and the pager when an ADT stream breaks."],
                        ["Revenue-Cycle Pipelines", "charge, claim and remittance feeds behind the finance tables."],
                        ["Streaming & Devices", "bedside monitor and PACS telemetry landed at operational latency."],
                    ],
                    ucs=["Hospital Throughput", "Denial Management", "Sepsis Early Warning"]),
                biz("Data Scientists", "MLflow", "Readmission, sepsis and denial-risk models, and whether they still hold six months after deployment.",
                    [["Feature Store", "Patient and encounter features defined once for training and serving."], ["MLflow", "Every clinical model run tracked for audit and reproduction."], ["Model Serving", "Readmission and sepsis models scored at discharge and bedside."]],
                    sub=[
                        ["Clinical Modelling", "readmission, sepsis and deterioration models validated against outcomes."],
                        ["Revenue Science", "denial-risk and underpayment models behind the workbench."],
                        ["MLOps", "drift and monitoring so a clinical model still holds six months on."],
                    ],
                    ucs=["Readmission Reduction", "Sepsis Early Warning", "Denial Management"]),
                biz("App Developers", "Apps", "Ship the capacity, denial-prevention and population-health applications the health system works in, hosted next to governed data.",
                    [["Apps", "Capacity and revenue screens with no separate web tier to run or secure."], ["Lakebase", "Serverless Postgres for bed-placement and query writes."], ["Agent Bricks", "Agents that draft a CDI query or discharge plan against governed tools."]],
                    sub=[
                        ["Operational Apps", "the capacity, denial and registry screens clinicians and finance work in."],
                        ["Clinical Agents", "CDI-query and discharge-plan agents against governed tools."],
                        ["Integration Services", "writeback into the EHR inbox and bed-placement workflows."],
                    ],
                    ucs=["Hospital Throughput", "Denial Management", "Research Cohorts"]),
            ]),
            "cons": cons_rail([
                {"box": "BI & Productivity", "ic": "chart", "from": "bi", "tiles": [
                    tile("Tableau / Qlik / ThoughtSpot", "chart", "External BI against serverless SQL warehouses, with Unity Catalog permissions enforced end to end."),
                    tile("Microsoft Teams", "chat", "Genie in Teams for Unity Catalog-governed answers from the lakehouse, and capacity alerts in the channel operations already works in (Beta)."),
                    tile("Notebooks & IDEs", "notebook", "Notebooks, VS Code and JetBrains against governed data and Genie Code.")
                ]},
                {"box": "Clinical Writeback", "ic": "opdb", "tiles": [
                    tile("EHR Chart Queries", "db", "CDI and quality queries written back into the EHR inbox for physician response.", "epic"),
                    tile("Bed Placement Orders", "gauge", "Accepted bed assignments pushed to transport and nursing workflows.", "teletracking"),
                    tile("Care Gap Outreach", "apps", "Preventive care tasks pushed to ambulatory care teams from panel registries.")
                ]},
                {"box": "Payer & Community", "ic": "partner", "tiles": [
                    tile("Payer Risk Contracts", "share", "Quality and utilisation metrics shared with payers under value-based arrangements."),
                    tile("HIE Clinical Exchange", "api", "Summaries and referrals exchanged with regional health information exchanges.", "fhir-bulk"),
                    tile("Employer Reporting", "partner", "Occupational health and direct-contract outcomes reported to self-insured employers.")
                ]},
                {"box": "Regulatory & Reporting", "ic": "gavel", "tiles": [
                    tile("CMS Quality Programs", "gavel", "HAC, readmission and MIPS measures produced from governed clinical tables.", "cms-quality"),
                    tile("State Reporting", "share", "Mandatory infection and utilization filings assembled from Gold products.")
                ]},
                {"box": "Published Products", "ic": "product", "tiles": [
                    tile("Data Products", "product", "Published, contracted products discoverable in Unity Catalog Domains and shared over OpenSharing."),
                    tile("Sharing Recipients", "share", "Researchers, payers and affiliates reading live tables with no copy and no egress duplication.")
                ]},
            ], genie_spaces=[
                genie("Capacity & Throughput", "Ask about census, boarding, length of stay and OR utilisation in plain language.",
                      feeds=["TeleTracking Capacity", "Epic Caboodle", "Kronos Workforce", "LOS, margin, outcomes"],
                      teams=["Clinical Operations", "VP Patient Flow", "Bed Management"],
                      questions=[
                          "What is our current census and how many patients are boarding in the ED?",
                          "Which units are driving excess length of stay this week?",
                          "What is OR block-time utilisation by service line?",
                          "Where are discharge delays holding up bed placement?",
                          "How does staffing align to the census forecast for tomorrow?"]),
                genie("Revenue Cycle & Denials", "Explore denials, days in A/R and documentation gaps across the revenue cycle.",
                      feeds=["R1 RCM Platform", "Waystar Claims", "3M 360 Encompass", "Conformed patient, encounter"],
                      teams=["Revenue Cycle", "Clinical Documentation", "Coding & Compliance"],
                      questions=[
                          "What is our denial rate and top denial reasons this month?",
                          "Which accounts are at highest risk of denial before submission?",
                          "Where is the gap between clinical documentation and billed severity?",
                          "What is days in accounts receivable by payer?",
                          "Which DRGs show the most coding-accuracy risk?"]),
                genie("Quality & Safety", "Answer core-measure, HAC and deterioration questions before public reporting.",
                      feeds=["Capsule Medical Device", "Masimo Patient SafetyNet", "CMS Quality Reporting", "LOS, margin, outcomes"],
                      teams=["Quality & Safety", "Infection Prevention", "Patient Safety"],
                      questions=[
                          "Which units drove last month's CLABSI and HAC counts?",
                          "What is our sepsis-bundle compliance rate by unit?",
                          "How does the 30-day readmission rate trend by service line?",
                          "Where are early-warning scores flagging deterioration now?",
                          "What is the mortality index versus expected this quarter?"]),
                genie("Population Health", "Ask about attributed panels, rising risk and gaps in care.",
                      feeds=["Epic Caboodle", "HL7 FHIR Bulk Data", "Conformed patient, encounter"],
                      teams=["Population Health", "Care Management", "Clinical Analytics"],
                      questions=[
                          "Which attributed patients are rising-risk and need outreach?",
                          "What is total cost of care by attributed panel under value-based contracts?",
                          "Which patients have open gaps in care across measures?",
                          "Where is preventable utilisation concentrated in the panel?",
                          "How is readmission risk distributed at discharge today?"]),
            ], dashboards=[
                dashboard("Volume, LOS & Margin", "Census, length of stay and contribution margin on certified operational Metric Views.",
                          kpis=["Census", "Length of stay", "Contribution margin", "Case mix index", "Discharge volume"],
                          teams=["CEO, CNO & CMO", "Clinical Operations", "Revenue Cycle"]),
                dashboard("Revenue Integrity", "Denial rate, days in A/R, net revenue and documentation quality across the revenue cycle.",
                          kpis=["Denial rate", "Days in A/R", "Net revenue", "CDI query rate", "DRG accuracy"],
                          teams=["Revenue Cycle", "Clinical Documentation", "Coding & Compliance"]),
                dashboard("Quality & Safety", "Readmissions, HAC, sepsis-bundle compliance and mortality index before public reporting.",
                          kpis=["Readmission rate", "HAC rate", "Sepsis-bundle compliance", "Mortality index", "CLABSI rate"],
                          teams=["Quality & Safety", "Infection Prevention", "Patient Safety"]),
                dashboard("Patient Flow & Staffing", "ED boarding, bed turnaround, OR utilisation and staffing across the hospital.",
                          kpis=["ED boarding", "Bed turnaround", "OR utilisation", "Overtime hours", "Staffing ratio"],
                          teams=["Clinical Operations", "VP Patient Flow", "CEO, CNO & CMO"]),
            ]),
        },
        "top": top_band(
            [
                app("Capacity Command Centre", "Patient flow", "gauge", "ED boarding, bed placement and surgical holds costed in real time before diversion becomes necessary."),
                app("Denial Prevention Workbench", "Revenue integrity", "market", "Accounts at risk of denial flagged from documentation, coding and payer rules before claims submit."),
                app("Population Health Registry", "Attributed panels", "people", "Rising-risk patients and gaps in care ranked for outreach before utilisation spikes."),
                app("Sepsis Surveillance", "Patient safety", "iot", "Early warning from vitals, labs and nursing assessments before bundle compliance windows close."),
            ],
            [
                uc("Hospital Throughput", "Operations", "gauge", "ED boarding, discharge planning and OR turnover optimised as one patient-flow problem.",
                    problem="ED boarding, discharge and OR turnover are run by separate teams on separate screens, so beds free too late and the whole hospital backs up before anyone sees it coming.",
                    who="Clinical Operations",
                    how="ADT, bed-request and discharge feeds land in Lakehouse//RT; placement options are costed live and surfaced in the Capacity Command Centre so flow moves before diversion.",
                    comps=["Capacity Command Centre", "TeleTracking Capacity", "Lakehouse//RT", "AI/BI", "Model Serving"],
                    stories=[["Providence turns Epic streaming data into real-time care", "https://www.databricks.com/customers/providence"], ["Providence scales ED census and occupancy forecasting", "https://www.databricks.com/blog/providence-health-automl"]]),
                uc("Readmission Reduction", "Quality", "people", "Discharge risk scored and interventions triggered before the 30-day window opens.",
                    problem="Discharge decisions are made without knowing who will bounce back, and the clinical, social and utilisation signals that predict a readmission sit in systems that never meet.",
                    who="Population Health",
                    how="Encounter and history features in Feature Store feed readmission models scored at discharge in Model Serving, ranking risk in the Population Health Registry for outreach.",
                    comps=["Population Health Registry", "Model Serving", "MLflow", "Feature Store", "Epic Caboodle"],
                    stories=[["Reducing referral leakage and readmissions with Databricks Genie", "https://www.databricks.com/blog/transforming-healthcare-referrals-fivetran-agentic-ai-and-databricks-genie"]]),
                uc("Denial Management", "Revenue", "market", "Root causes of denials traced to documentation, coding and authorization gaps.",
                    problem="Denials are worked one appeal at a time after the money is withheld, and the documentation, coding and authorization gaps that caused them are never traced to a root cause.",
                    who="Revenue Cycle",
                    how="Charge, claim and remittance feeds join clinical data under Unity Catalog; at-risk accounts are scored and surfaced in the Denial Prevention Workbench before the claim leaves.",
                    comps=["Denial Prevention Workbench", "R1 RCM Platform", "Waystar Claims", "AI/BI", "Unity Catalog"]),
                uc("Sepsis Early Warning", "Safety", "iot", "Deterioration detected from streaming vitals and labs before codes are called.",
                    problem="Sepsis turns deadly in hours, yet the vitals, labs and nursing signals of early deterioration are scattered across monitors and the chart and seen only when someone looks.",
                    who="Quality & Safety",
                    how="Streaming vitals and labs feed early-warning models tracked in MLflow and scored in Model Serving; the Sepsis Surveillance app alerts the bedside before the bundle window closes.",
                    comps=["Sepsis Surveillance", "Capsule Medical Device", "Lakehouse//RT", "Model Serving", "MLflow"],
                    stories=[["Children's National's Criticality Index flags deterioration early", "https://www.databricks.com/customers/childrens-national-medical-center"]]),
                uc("OR Utilisation", "Surgical", "sheet", "Block time, turnover and case mix analysed to recover lost surgical minutes.",
                    problem="Block time is allocated on history and habit, first cases start late and turnovers drag, so surgical minutes and revenue are lost while the backlog and wait times keep growing.",
                    who="Clinical Operations",
                    how="Scheduling, case and turnover data are conformed to certified Metric Views and explored in AI/BI and Genie One, surfacing block-release and turnover gaps in the Capacity Command Centre.",
                    comps=["Capacity Command Centre", "Epic Caboodle", "AI/BI", "Genie One", "Unity Catalog"]),
                uc("Nurse Staffing", "Workforce", "people", "Acuity-adjusted schedules that match census forecasts without chronic overtime.",
                    problem="Schedules are built weeks ahead against average census, so units swing between dangerous short-staffing and costly overtime and acuity is rarely matched to the nurses on the floor.",
                    who="CEO, CNO & CMO",
                    how="Census forecasts and acuity feeds are modelled in Model Serving against Kronos schedules on Lakehouse//RT, so staffing matches predicted demand rather than last year's grid.",
                    comps=["Kronos Workforce", "Model Serving", "AI/BI", "Lakehouse//RT", "TeleTracking Capacity"],
                    stories=[["Children's National predicts patient volumes and nurse staffing", "https://www.databricks.com/customers/childrens-national-medical-center"]]),
                uc("Clinical Documentation", "CDI", "gavel", "Queries raised where clinical truth and billed severity diverge before final coding.",
                    problem="What clinicians document and what gets billed drift apart, so severity is understated, quality scores suffer and coders chase queries long after the patient has gone home.",
                    who="Revenue Cycle",
                    how="Clinical and coding data are joined under AI Functions and governed tables, and the Denial Prevention Workbench raises documentation queries where clinical truth and billed severity diverge.",
                    comps=["Denial Prevention Workbench", "3M 360 Encompass", "Epic Caboodle", "AI Functions", "Agent Bricks"]),
                uc("Imaging Utilisation", "Ancillary", "stream", "Appropriate use and turnaround analysed by modality and site.",
                    problem="Imaging is ordered, read and billed across disconnected PACS and departmental systems, so nobody sees appropriate-use patterns, modality turnaround or where scans are duplicated.",
                    who="Clinical Operations",
                    how="Study metadata and worklists are conformed to Delta Lake under Unity Catalog and explored in AI/BI and Genie One, exposing utilisation and turnaround by modality and site.",
                    comps=["Philips IntelliSpace", "AI/BI", "Unity Catalog", "Delta Lake", "Genie One"],
                    stories=[["Akron Children's unifies imaging, lab and clinical data", "https://www.databricks.com/customers/akron-childrens-hospital"], ["Albert Einstein Hospital cuts radiology query time with Genie", "https://www.databricks.com/customers/albert-einstein-hospital/genie"]]),
                uc("Patient Experience", "HCAHPS", "partner", "Satisfaction drivers linked to operational and clinical variables teams can act on.",
                    problem="HCAHPS and point-of-care surveys arrive weeks late and detached from what happened on the unit, so teams cannot tell which operational and clinical drivers actually moved the score.",
                    who="Clinical Operations",
                    how="Survey, operational and clinical data are joined on certified Metric Views and scored in Model Serving, so drivers surface in AI/BI and Genie One where unit teams can act on them.",
                    comps=["Press Ganey Experience", "AI/BI", "Genie One", "Unity Catalog", "Model Serving"]),
                uc("Research Cohorts", "Evidence", "notebook", "De-identified cohorts built from governed EHR data under IRB protocols.",
                    problem="Building a study cohort means manual extracts and one-off scripts against the EHR, so researchers wait weeks, governance is unclear and de-identification is inconsistent across projects.",
                    who="Population Health",
                    how="FHIR resources are conformed under Unity Catalog with governed de-identification, and cohorts are built in Notebooks & IDEs and shared to researchers over OpenSharing under IRB protocols.",
                    comps=["Population Health Registry", "HL7 FHIR Bulk Data", "Unity Catalog", "OpenSharing", "Notebooks & IDEs"],
                    stories=[["Albert Einstein Hospital builds radiology cohorts with Genie", "https://www.databricks.com/customers/albert-einstein-hospital/genie"]]),
            ],
        ),
        "sources": {
            "epic": {"t": "Epic Systems EHR", "u": "https://www.epic.com/"},
            "oracle-millennium": {"t": "Oracle Health Millennium", "u": "https://www.oracle.com/industries/healthcare/"},
            "meditech": {"t": "Meditech Expanse", "u": "https://ehr.meditech.com/"},
            "r1-rcm": {"t": "R1 RCM revenue cycle", "u": "https://www.r1rcm.com/"},
            "waystar": {"t": "Waystar healthcare payments", "u": "https://www.waystar.com/"},
            "3m-codeassist": {"t": "3M 360 Encompass (Solventum)", "u": "https://www.solventum.com/"},
            "philips-pacs": {"t": "Philips IntelliSpace PACS", "u": "https://www.philips.com/healthcare"},
            "capsule": {"t": "Capsule medical device integration", "u": "https://www.capsuletech.com/"},
            "masimo": {"t": "Masimo Patient SafetyNet", "u": "https://www.masimo.com/"},
            "teletracking": {"t": "TeleTracking capacity management", "u": "https://www.teletracking.com/"},
            "kronos": {"t": "UKG workforce management", "u": "https://www.ukg.com/workforce-management"},
            "press-ganey": {"t": "Press Ganey patient experience", "u": "https://www.pressganey.com/"},
            "fhir-bulk": {"t": "HL7 FHIR Bulk Data Access", "u": "https://hl7.org/fhir/uv/bulkdata/"},
            "cms-quality": {"t": "CMS hospital quality reporting", "u": "https://www.cms.gov/medicare/quality/initiatives/hospital-quality-initiative"}
        },
    },
}
