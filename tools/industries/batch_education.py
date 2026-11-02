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


INDUSTRIES_BATCH_EDUCATION = {
    'education': {
        "label": "Education",
        "blurb": "Higher education and K-12: student lifecycle from inquiry through alumni, learning outcomes, financial aid, and campus operations.",
        "medallion": medallion(
            "Raw campus feeds",
            "SIS enrollments, LMS activity logs, admissions CRM events, aid awards and bursar transactions, landed exactly as received so a grade or an aid decision can always be replayed as it stood.",
            "Conformed student, course",
            "Students, courses, sections and terms resolved into single conformed entities across the SIS, LMS and CRM estates, with cross-system identifiers reconciled and transfer credit stitched to one academic record.",
            "Retention, enrollment, outcomes",
            "Contracted products academic and finance leaders run on: retention and persistence by cohort, enrollment yield and melt, learning outcome attainment, and aid packaging compliance.",
        ),
        "rails": {
            "src": [
                {"box": "Student Information", "ic": "erp", "tiles": [
                    tile("Ellucian Banner", "erp", "Student information system of record: enrollments, registrations, grades, degree progress and transcript history.", "ellucian-banner",
                         cat="Student Information System (SIS)",
                         what="System-of-record for enrollments, registrations, grades, degree progress and transcript history across the institution.",
                         users="Registrar, Advising and Institutional research teams.",
                         data_out=data_out(
                             batch=flow(["structured"], "5-30 GB/day", "Nightly batch + intraday deltas"))),
                    tile("Workday Student", "erp", "Cloud SIS for academic records, advising holds, program completion and residency rules.", "workday-student",
                         cat="Student Information System (SIS)",
                         what="Cloud SIS holding academic records, advising holds, program completion and residency rules.",
                         users="Registrar, Advising and Finance teams.",
                         data_out=data_out(
                             batch=flow(["structured"], "2-15 GB/day", "Nightly batch"),
                             stream=flow(["semi-structured"], "tens of events/sec", "Continuous CDC"))),
                    tile("PowerSchool SIS", "erp", "Dominant K-12 student information system: enrollments, attendance, grades and state reporting across districts.", "peoplesoft-campus",
                         cat="Student Information System (SIS)",
                         what="K-12 SIS covering enrollments, attendance, grades and mandated state reporting across districts.",
                         users="District administration, State reporting and Attendance teams.",
                         data_out=data_out(
                             batch=flow(["structured"], "1-10 GB/day", "Nightly batch"))),
                ]},
                {"box": "Learning & Content", "ic": "notebook", "tiles": [
                    tile("Canvas LMS", "notebook", "Course shells, assignments, discussion activity and outcome mastery data from the primary learning environment.", "canvas-lms",
                         cat="Learning Management System (LMS)",
                         what="Primary learning environment emitting course activity, assignment submissions, discussion events and outcome mastery data.",
                         users="Student success, Faculty and Learning analytics teams.",
                         data_out=data_out(
                             batch=flow(["structured", "semi-structured"], "10-50 GB/day activity logs", "Hourly / nightly"),
                             stream=flow(["semi-structured"], "hundreds of events/sec at peak", "Continuous (activity events)"))),
                    tile("Blackboard Learn", "notebook", "LMS engagement, assessment attempts and content access for institutions on the Blackboard estate.", "blackboard",
                         cat="Learning Management System (LMS)",
                         what="LMS engagement, assessment attempts and content access for institutions running on the Blackboard estate.",
                         users="Student success, Faculty and Learning analytics teams.",
                         data_out=data_out(
                             batch=flow(["structured", "semi-structured"], "5-30 GB/day", "Hourly / nightly"))),
                    tile("Panopto Lecture Capture", "stream", "Recorded lecture views, watch time and search queries joined to course enrollment for engagement analysis.", "panopto",
                         cat="Lecture Capture / Video Platform",
                         what="Captures lecture recordings and emits view, watch-time and search events joined to enrollment for engagement analysis.",
                         users="Learning analytics, Faculty and Instructional design teams.",
                         data_out=data_out(
                             batch=flow(["structured", "unstructured"], "GBs of video + view logs", "Continuous / daily"))),
                ]},
                {"box": "Admissions & CRM", "ic": "partner", "tiles": [
                    tile("Slate by Technolutions", "partner", "Inquiry, application, decision and yield events from the admissions CRM the recruitment team works in.", "slate",
                         cat="Admissions CRM",
                         what="Admissions CRM capturing inquiry, application, decision and yield events across the recruitment funnel.",
                         users="Admissions, Recruitment operations and Enrollment management teams.",
                         data_out=data_out(
                             batch=flow(["structured", "semi-structured"], "1-5 GB/day", "Hourly / nightly sync"))),
                    tile("Salesforce Education Cloud", "custlake", "Prospect journeys, recruiter activities and conversion funnels for institutions on Education Cloud.", "sf-edu-cloud",
                         cat="Education CRM",
                         what="Holds prospect journeys, recruiter activities and conversion funnels for institutions on Education Cloud.",
                         users="Admissions, Marketing and Enrollment management teams.",
                         data_out=data_out(
                             batch=flow(["structured"], "1-4 GB/day", "Hourly / nightly sync"),
                             stream=flow(["semi-structured"], "tens of events/sec", "Continuous CDC"))),
                    tile("National Student Clearinghouse", "share", "Enrollment verification, degree completion and transfer research files exchanged with peer institutions.", "nsc",
                         cat="Enrollment Verification Exchange",
                         what="Exchanges enrollment verification, degree completion and transfer research files with peer institutions.",
                         users="Registrar, Institutional research and Enrollment management teams.",
                         data_out=data_out(
                             batch=flow(["structured"], "sub-GB per exchange", "Periodic file exchanges"))),
                ]},
                {"box": "Finance & Student Aid", "ic": "market", "tiles": [
                    tile("PowerFAIDS", "market", "Need analysis, packaging rules and ISIR-driven award letters the financial aid office certifies.", "powerfaids",
                         cat="Financial Aid Management System",
                         what="Runs need analysis, packaging rules and ISIR-driven award letters the financial aid office certifies under Title IV.",
                         users="Financial aid, Bursar and Compliance teams.",
                         data_out=data_out(
                             batch=flow(["structured"], "1-3 GB/day awards + ISIR", "Nightly batch + award cycles"))),
                    tile("Nelnet Campus Commerce", "erp", "Tuition billing, payment plans and bursar receivables reconciled against enrollment status.", "nelnet",
                         cat="Tuition Billing & Payments",
                         what="Handles tuition billing, payment plans and bursar receivables reconciled against enrollment status.",
                         users="Bursar, Student accounts and Finance teams.",
                         data_out=data_out(
                             batch=flow(["structured"], "1-4 GB/day", "Nightly batch + intraday deltas"))),
                    tile("Web & Portal Clickstream", "observ", "Prospect and student portal events from search through registration, joined to applications and enrollments.",
                         cat="Web & Portal Clickstream",
                         what="Captures prospect and student portal events from search through registration, joined to applications and enrollments.",
                         users="Admissions, Marketing and Learning analytics teams.",
                         data_out=data_out(
                             stream=flow(["semi-structured"], "hundreds of events/sec at peak", "Continuous clickstream"))),
                ]},
                fed_group(
                    "Research Grants Ledger",
                    "Sponsored research accounting and effort certification marts left where they are and queried in place under Unity Catalog.",
                    cat="Sponsored Research Data Warehouse",
                    what="Sponsored-research accounting and effort-certification marts kept in the incumbent system and queried in place through federation.",
                    users="Sponsored programs, Research finance and Compliance teams.",
                    data_out=data_out(
                        batch=flow(["structured"], "GB-scale ledgers", "Queried on demand (federated)")),
                ),
            ],
            "ing": ing_rail([
                tile("Ed-Fi Data Standard", "api", "Interoperable student and assessment APIs normalised on ingest for state reporting and district exchange.", "ed-fi",
                     cat="Education Data Standard / API",
                     what="Provides interoperable student and assessment APIs normalised on ingest for state reporting and district data exchange.",
                     users="Integration engineering, State reporting and District data teams.",
                     data_out=data_out(
                         batch=flow(["structured", "semi-structured"], "1-5 GB/day", "Nightly / on schedule"))),
                tile("IMS Global LTI", "api", "Learning tool interoperability launches and grade passback events from third-party publishers.", "ims-lti",
                     cat="Learning Interoperability Standard (LTI)",
                     what="Carries learning-tool launch and grade-passback events between the LMS and third-party publisher tools.",
                     users="Learning platforms, Integration engineering and Faculty teams.",
                     data_out=data_out(
                         stream=flow(["semi-structured"], "tens-hundreds of events/sec at peak", "Continuous (launch / passback)"))),
                tile("IPEDS / State Reporting", "gavel", "Federal and state compliance file layouts consumed inbound for validation before submission season.", "ipeds",
                     cat="Regulatory Reporting Data",
                     what="Supplies federal and state compliance file layouts consumed for validation before submission season.",
                     users="Institutional research, Compliance and Finance teams.",
                     data_out=data_out(
                         batch=flow(["structured"], "sub-GB per submission", "Per reporting cycle"))),
            ]),
            "ppl": ppl2([
                biz("President & Provost", "Genie One", "The president and provost on enrollment health, first-year retention and six-year completion, and the trade between access and net-tuition sustainability.",
                    [["Genie One", "Ask what fall enrollment looks like against target without waiting on institutional research."], ["AI/BI", "Retention, yield and net tuition on one certified set of Metric Views."], ["Unity Catalog", "Certification and the business glossary, so \"retention\" means one thing across campus."]],
                    sub=[
                        ["President", "enrollment health, the completion rate and the trade between access and net-tuition sustainability."],
                        ["Provost", "academic program quality, learning outcomes and faculty resourcing across colleges."],
                        ["Institutional Research", "the certified numbers behind every board report and accreditation submission."],
                    ],
                    ucs=["Enrollment Forecasting", "Learning Analytics", "Accreditation Reporting", "Alumni Engagement"]),
                biz("Registrar & Records", "AI/BI", "Official academic records, transfer articulation and degree-audit exceptions, and who is eligible to walk at commencement this term.",
                    [["AI/BI", "Registration velocity, credit accumulation and stop-out patterns on governed definitions."], ["Genie One", "Ask which programs are behind on degree progress this term."], ["Unity Catalog", "One definition of enrollment status across SIS and LMS."]],
                    sub=[
                        ["University Registrar", "official academic records, transfer articulation and degree-audit integrity."],
                        ["Scheduling Office", "room utilisation, prime-time conflicts and section capacity each term."],
                        ["Degree Audit", "credit accumulation and who is eligible to walk at commencement this term."],
                    ],
                    ucs=["Curriculum Optimisation", "Space & Scheduling", "Accreditation Reporting"]),
                biz("Student Success", "Model Serving", "Advising, tutoring and early-alert teams intervening on rising-risk students from LMS inactivity, grade slippage and aid gaps before one silently stops out.",
                    [["Retention Risk Hub", "Risk scores and recommended outreach before census."], ["Model Serving", "Persistence models scored against live LMS and SIS signals."], ["CustomerLake", "Student segments without copying profiles into a separate CDP."]],
                    sub=[
                        ["Advising & Coaching", "rising-risk students and the outreach that keeps them enrolled."],
                        ["Tutoring & Learning Centers", "where students struggle by course and when to intervene."],
                        ["Early Alert Coordinators", "LMS inactivity and grade slippage before census closes."],
                    ],
                    ucs=["Early Alert & Retention", "Learning Analytics", "Curriculum Optimisation"]),
                biz("Admissions & Enrollment", "CustomerLake", "Recruitment yield by channel and territory, melt between deposit and day one, and section fill measured against instructional and housing capacity.",
                    [["Enrollment Forecasting", "Cohort scenarios scored on instructional and housing capacity."], ["CustomerLake", "Prospect journeys joined to application and enrollment outcomes."], ["AI/BI", "Yield and melt dashboards the cabinet reads each cycle."]],
                    sub=[
                        ["Director of Admissions", "the funnel from inquiry to deposit by channel and territory."],
                        ["Enrollment Management", "yield, melt and the class the cabinet promised."],
                        ["Recruitment Operations", "recruiter activity and the events that move applications."],
                    ],
                    ucs=["Recruitment Yield", "Enrollment Forecasting", "Financial Aid Packaging"]),
                biz("Finance & Financial Aid", "AI/BI", "Net tuition revenue, the aid discount rate and packaging that stays inside federal Title IV rules while hitting the class the cabinet promised.",
                    [["Aid Packaging Workbench", "Award scenarios tested against policy before letters release."], ["AI/BI", "Discount rate and tuition revenue on certified Metric Views."], ["Unity Catalog", "One definition of aid and billing across bursar and aid systems."]],
                    sub=[
                        ["Financial Aid Director", "packaging inside Title IV rules and the aid discount rate."],
                        ["Bursar", "tuition billing and receivables reconciled to enrollment status."],
                        ["Sponsored Programs", "effort certification and cost share on research grants."],
                    ],
                    ucs=["Financial Aid Packaging", "Research Compliance", "Enrollment Forecasting"]),
            ], [
                biz("Data Engineers", "Lakeflow", "Land the SIS, LMS and admissions CRM feeds; own the Bronze to Silver path and the pager when a nightly enrollment or grade load breaks.",
                    [["Lakeflow Connect", "Managed connectors for Banner, Canvas and Slate."], ["Lakeflow Designer", "Declarative pipelines with expectations on enrollment and grade feeds."], ["Lakewatch", "Freshness on the tables the registrar and advisors read every morning."]],
                    sub=[
                        ["Pipeline Engineering", "the Bronze-to-Silver path off Banner, Canvas and Slate."],
                        ["Integration & Reporting", "state and federal file layouts and the nightly enrollment load."],
                        ["Platform & Reliability", "the pager when a grade or aid load breaks before dawn."],
                    ],
                    ucs=["Early Alert & Retention", "Enrollment Forecasting", "Accreditation Reporting"]),
                biz("Data Scientists", "MLflow", "Retention-risk, enrollment-yield and course-demand models, and whether they still hold a term after deployment.",
                    [["Feature Store", "Student features defined once and read identically in training and serving."], ["MLflow", "Every retention model run tracked for audit and reproduction."], ["Model Serving", "Persistence and yield models scored against live LMS and SIS signals."]],
                    sub=[
                        ["Retention Modeling", "persistence and stop-out risk from LMS and SIS signals."],
                        ["Enrollment Modeling", "yield, melt and course-demand forecasts by cohort."],
                        ["MLOps", "whether a retention model still holds a term after deployment."],
                    ],
                    ucs=["Early Alert & Retention", "Enrollment Forecasting", "Recruitment Yield"]),
                biz("App Developers", "Apps", "Ship the advising, retention and aid-packaging applications the campus works in, hosted next to governed data.",
                    [["Apps", "Advising and retention screens with no separate web tier to run or secure."], ["Lakebase", "Serverless Postgres for advising notes and aid-decision writes."], ["Agent Bricks", "Agents that draft outreach or an aid scenario against governed tools."]],
                    sub=[
                        ["Advising Apps", "the screens coordinators work early alerts and notes in."],
                        ["Aid & Student Apps", "aid-scenario and student-portal writes over governed data."],
                        ["Platform Services", "auth, hosting and the API surface next to the lakehouse."],
                    ],
                    ucs=["Early Alert & Retention", "Financial Aid Packaging", "Alumni Engagement"]),
            ]),
            "cons": cons_rail([
                {"box": "BI & Productivity", "ic": "chart", "from": "bi", "tiles": [
                    tile("Tableau / Qlik / ThoughtSpot", "chart", "External BI against serverless SQL warehouses, with Unity Catalog permissions enforced end to end."),
                    tile("Microsoft Teams", "chat", "Genie in Teams for Unity Catalog-governed answers from the lakehouse, and advising updates in the channel teams already work in (Beta)."),
                    tile("Notebooks & IDEs", "notebook", "Notebooks, VS Code and JetBrains against governed data and Genie Code.")
                ]},
                {"box": "Student Systems", "ic": "opdb", "tiles": [
                    tile("Banner Registration Writeback", "db", "Section capacity and registration holds written back into the SIS so the answer reaches the student portal.", "ellucian-banner"),
                    tile("Canvas Grade Passback", "notebook", "Final grades and outcome mastery pushed to the LMS of record after faculty approval.", "canvas-lms"),
                    tile("Advising Mobile", "apps", "Early alerts, appointment notes and degree exceptions pushed to advisors in the field.")
                ]},
                {"box": "Learning Platforms", "ic": "partner", "tiles": [
                    tile("LTI Tool Provisioning", "api", "Publisher tools entitled from governed roster and outcome data rather than flat CSV exports.", "ims-lti"),
                    tile("Ed-Fi Partner Exchange", "share", "District and state partners reading roster and assessment tables over Delta Sharing.", "ed-fi"),
                    tile("Alumni & Advancement", "custlake", "Graduate outcomes and giving propensity shared to advancement without nightly flat files.")
                ]},
                {"box": "Regulatory & Reporting", "ic": "gavel", "tiles": [
                    tile("IPEDS & Federal Reporting", "gavel", "IPEDS, Clery and financial responsibility metrics produced from the same governed tables the institution runs on.", "ipeds"),
                    tile("FERPA Audit Trail", "share", "Directory and disclosure logs filed from contracted Gold products for compliance review.")
                ]},
                {"box": "Published Products", "ic": "product", "tiles": [
                    tile("Data Products", "product", "Published, contracted products discoverable in Unity Catalog Domains and shared over OpenSharing."),
                    tile("Sharing Recipients", "share", "Consortia, researchers and state agencies reading live tables with no copy and no egress duplication.")
                ]},
            ], genie_spaces=[
                genie("Enrollment & Yield", "Ask about the funnel, yield and melt against target across cycles in plain language.",
                      feeds=["Slate by Technolutions", "Salesforce Education Cloud", "Ellucian Banner", "Retention, enrollment, outcomes"],
                      teams=["Admissions & Enrollment", "Director of Admissions", "Enrollment Management"],
                      questions=[
                          "What does fall enrollment look like against target right now?",
                          "Which channels and territories convert inquiry to deposit best?",
                          "How much melt is occurring between deposit and day one?",
                          "Which programs are behind on their enrollment goal this cycle?",
                          "How does yield compare to the same point last cycle?"]),
                genie("Student Success & Retention", "Explore persistence risk, LMS activity and early-alert outreach across cohorts.",
                      feeds=["Canvas LMS", "Blackboard Learn", "Ellucian Banner", "Conformed student, course"],
                      teams=["Student Success", "Advising & Coaching", "Early Alert Coordinators"],
                      questions=[
                          "Which students show rising stop-out risk before census?",
                          "Which courses have the most students with LMS inactivity this week?",
                          "Where is grade slippage concentrated by program and term?",
                          "Which advising interventions correlate with improved persistence?",
                          "Which cohorts are below their expected retention rate?"]),
                genie("Learning Outcomes", "Answer questions on mastery, completion and course effectiveness across programs.",
                      feeds=["Canvas LMS", "Panopto Lecture Capture", "Ellucian Banner", "Retention, enrollment, outcomes"],
                      teams=["President & Provost", "Institutional Research", "Registrar & Records"],
                      questions=[
                          "Which courses have the lowest outcome-mastery attainment this term?",
                          "How does completion differ by course modality?",
                          "Which pathways bottleneck time-to-degree?",
                          "How does lecture-capture engagement relate to course grades?",
                          "Which programs improved learning outcomes year over year?"]),
                genie("Aid & Finance", "Ask about the aid discount rate, net tuition and Title IV packaging compliance.",
                      feeds=["PowerFAIDS", "Nelnet Campus Commerce", "IPEDS / State Reporting", "Retention, enrollment, outcomes"],
                      teams=["Finance & Financial Aid", "Financial Aid Director", "Bursar"],
                      questions=[
                          "What is the aid discount rate this cycle versus last?",
                          "Which award packages are drifting outside Title IV rules?",
                          "How does net tuition revenue track against budget by program?",
                          "Which students have unresolved bursar holds affecting enrollment?",
                          "How does packaging affect yield across need bands?"]),
            ], dashboards=[
                dashboard("Enrollment & Yield", "Funnel, yield, melt and net tuition on certified Metric Views.",
                          kpis=["Enrollment vs target", "Yield rate", "Melt rate", "Net tuition revenue", "Aid discount rate"],
                          teams=["Admissions & Enrollment", "President & Provost", "Finance & Financial Aid"]),
                dashboard("Retention & Persistence", "Cohort persistence, stop-out risk and early-alert outreach.",
                          kpis=["Retention rate", "Persistence rate", "Stop-out risk", "Early-alert volume", "Outreach completion"],
                          teams=["Student Success", "Advising & Coaching", "Institutional Research"]),
                dashboard("Learning Outcomes", "Mastery attainment, completion and course effectiveness across programs.",
                          kpis=["Outcome mastery", "Completion rate", "Time-to-degree", "Modality effectiveness", "Course pass rate"],
                          teams=["President & Provost", "Registrar & Records", "Institutional Research"]),
                dashboard("Aid & Finance", "Discount rate, net tuition and packaging compliance on governed tables.",
                          kpis=["Aid discount rate", "Net tuition revenue", "Packaging compliance", "Receivables aging", "Cost per enrolled student"],
                          teams=["Finance & Financial Aid", "Financial Aid Director", "Bursar"]),
            ]),
        },
        "top": top_band(
            [
                app("Student 360", "Unified learner view", "custlake", "Every touchpoint from inquiry through alumni on one screen: academics, aid, engagement and risk, on Databricks Apps over Lakebase."),
                app("Retention Risk Hub", "Early intervention", "gauge", "Cohort risk ranked before census with recommended outreach and advising appointments queued for coordinators."),
                app("Course Demand Planner", "Section planning", "sheet", "Historical fill and waitlist patterns scored against instructional capacity before the schedule locks."),
                app("Aid Packaging Workbench", "Award decisions", "market", "Packaging scenarios tested against policy and budget before award letters release to students."),
            ],
            [
                uc("Early Alert & Retention", "Persistence", "gauge", "Identifying students likely to stop out from LMS inactivity, grades and aid gaps, and intervening before census.",
                   problem="LMS inactivity, grade slippage and aid gaps hide across the SIS, LMS and aid systems, so advisors usually find a rising-risk student only after they have quietly stopped out.",
                   who="Student Success",
                   how="LMS activity, grades and aid signals land through Lakeflow and score persistence models in Model Serving, ranking risk in the Retention Risk Hub with outreach queued before census.",
                   comps=["Retention Risk Hub", "Model Serving", "Canvas LMS", "Feature Store", "Ellucian Banner"],
                   stories=[
                       ["Western Governors University predicts dropout patterns and retention", "https://www.databricks.com/customers/western-governors-university"],
                       ["Flinders University improves student success with data and ML", "https://www.databricks.com/customers/flinders-university"],
                   ]),
                uc("Enrollment Forecasting", "Capacity", "sheet", "Fall and spring headcount scenarios scored against housing, staffing and section capacity before the board commits.",
                   problem="Headcount is projected from last year's melt and gut feel, so the board commits to a class the campus cannot house, staff or fill sections for once deposits convert.",
                   who="Admissions & Enrollment",
                   how="Admissions CRM, deposit and historical yield feeds are conformed on Delta Lake and scored into headcount scenarios read against housing and section capacity in the Course Demand Planner.",
                   comps=["Course Demand Planner", "AI/BI", "Slate by Technolutions", "MLflow", "Delta Lake"],
                   stories=[
                       ["Flinders University gains a consistent view of student enrollment", "https://www.databricks.com/customers/flinders-university"],
                   ]),
                uc("Learning Analytics", "Outcomes", "notebook", "Course and modality effectiveness measured on mastery and completion, not satisfaction surveys alone.",
                   problem="Course and modality effectiveness is judged on end-of-term satisfaction surveys, so the mastery and completion signals sitting in the LMS never reach the leaders deciding what to fund.",
                   who="President & Provost",
                   how="LMS mastery, lecture-capture engagement and completion data are conformed on Delta Lake under Unity Catalog and surfaced as certified outcome measures in AI/BI.",
                   comps=["Canvas LMS", "Panopto Lecture Capture", "AI/BI", "Delta Lake", "Unity Catalog"],
                   stories=[
                       ["Western Governors University tailors curriculum from learning data", "https://www.databricks.com/customers/western-governors-university"],
                   ]),
                uc("Financial Aid Packaging", "Compliance", "market", "Need-based awards optimised within discount rate targets and federal packaging rules.",
                   problem="Aid is packaged in tools that cannot test a scenario against the discount-rate target and Title IV rules at once, so awards drift over budget or out of compliance before letters release.",
                   who="Finance & Financial Aid",
                   how="Need analysis, ISIR and budget data feed award scenarios scored in the Aid Packaging Workbench, with Model Serving optimising packages inside policy and Unity Catalog holding one aid definition.",
                   comps=["Aid Packaging Workbench", "PowerFAIDS", "Model Serving", "AI/BI", "Unity Catalog"],
                   stories=[
                       ["AI-enabled advisory services for higher education financial aid", "https://www.databricks.com/blog/ai-enabled-advisory-services-higher-education"],
                   ]),
                uc("Recruitment Yield", "Admissions", "partner", "Inquiry-to-enroll funnels by channel and territory, with melt between deposit and day one surfaced early.",
                   problem="Inquiry-to-enroll funnels sit split across the admissions CRM and marketing tools, so recruiters cannot see which channels convert or catch deposit-to-day-one melt until it is too late.",
                   who="Admissions & Enrollment",
                   how="Prospect journeys from Slate and Education Cloud land in CustomerLake and score conversion and melt models in Model Serving, with yield read by channel and territory in AI/BI.",
                   comps=["CustomerLake", "Slate by Technolutions", "Salesforce Education Cloud", "Model Serving", "AI/BI"],
                   stories=[
                       ["Baylor University unlocks the student voice across enrollment", "https://www.databricks.com/customers/baylor-university"],
                       ["AI-enabled advisory services for admissions and enrollment", "https://www.databricks.com/blog/ai-enabled-advisory-services-higher-education"],
                   ]),
                uc("Curriculum Optimisation", "Programs", "sheet", "Which courses and pathways drive time-to-degree and which bottleneck completion.",
                   problem="Course sequences and prerequisites that stall time-to-degree are invisible until a cohort graduates late, and the registration data that would flag them lives only in the SIS.",
                   who="Registrar & Records",
                   how="Registration, grade and degree-audit data from the SIS are conformed on Delta Lake and analysed in AI/BI and Genie to surface the courses and pathways that bottleneck completion.",
                   comps=["Course Demand Planner", "Ellucian Banner", "AI/BI", "Delta Lake", "Genie One"],
                   stories=[
                       ["Flinders University advises on curriculum changes from data", "https://www.databricks.com/customers/flinders-university"],
                   ]),
                uc("Accreditation Reporting", "Assurance", "gavel", "Learning outcomes and employment metrics produced from governed tables accreditors can trace.",
                   problem="Accreditors want learning-outcome and employment evidence traced to source, but the metrics are rebuilt by hand each cycle from spreadsheets no one can audit back to the record.",
                   who="President & Provost",
                   how="Outcome and employment data are conformed into governed data products on Delta Lake under Unity Catalog, so accreditation metrics in AI/BI trace to the same tables the institution runs on.",
                   comps=["IPEDS / State Reporting", "Data Products", "Unity Catalog", "AI/BI", "Delta Lake"],
                   stories=[
                       ["How the English Office for Students enhances higher education standards", "https://www.databricks.com/blog/how-english-office-students-leverages-databricks-enhance-higher-education-standards-and-drive"],
                   ]),
                uc("Space & Scheduling", "Operations", "stream", "Room utilisation and prime-time conflicts resolved before students register into overloaded sections.",
                   problem="Rooms sit empty off-peak while prime-time sections collide, because utilisation and registration demand are reconciled only after students have already registered into overloaded slots.",
                   who="Registrar & Records",
                   how="Registration, section and room data are conformed on Delta Lake through Lakeflow and modelled against demand in the Course Demand Planner, resolving prime-time conflicts before registration opens.",
                   comps=["Course Demand Planner", "Ellucian Banner", "Lakeflow", "AI/BI", "Delta Lake"]),
                uc("Alumni Engagement", "Advancement", "custlake", "Graduate outcomes and giving propensity scored from the same student record advancement already trusts.",
                   problem="Advancement works from nightly flat-file extracts of the student record, so graduate outcomes and giving propensity are stale and disconnected from the academic history they depend on.",
                   who="President & Provost",
                   how="The conformed student record feeds giving-propensity models in Model Serving and a graduate-outcome view in Student 360, so advancement reads live segments in AI/BI without a copied file.",
                   comps=["Student 360", "CustomerLake", "Model Serving", "AI/BI", "Delta Lake"]),
                uc("Research Compliance", "Grants", "product", "Effort certification and cost share reconciled against sponsored project ledgers without a second shadow mart.",
                   problem="Effort certification and cost share are reconciled in a shadow mart split from the sponsored-project ledger, so a grant audit means chasing numbers that no longer agree with the books.",
                   who="Finance & Financial Aid",
                   how="The sponsored-research ledger is queried in place under Unity Catalog and reconciled on Delta Lake, so effort and cost-share reports in AI/BI trace to the ledger without a second copy.",
                   comps=["Research Grants Ledger", "Unity Catalog", "Data Products", "AI/BI", "Delta Lake"]),
            ],
        ),
        "sources": {
            "ellucian-banner": {"t": "Ellucian Banner SIS", "u": "https://www.ellucian.com/solutions/ellucian-banner"},
            "workday-student": {"t": "Workday Student", "u": "https://www.workday.com/en-us/products/student.html"},
            "peoplesoft-campus": {"t": "PowerSchool SIS", "u": "https://www.powerschool.com/"},
            "canvas-lms": {"t": "Instructure Canvas LMS", "u": "https://www.instructure.com/canvas"},
            "blackboard": {"t": "Anthology Blackboard Learn", "u": "https://www.anthology.com/products/teaching-and-learning/learning-effectiveness/blackboard"},
            "panopto": {"t": "Panopto video platform", "u": "https://www.panopto.com/"},
            "slate": {"t": "Technolutions Slate", "u": "https://technolutions.com/slate"},
            "sf-edu-cloud": {"t": "Salesforce Education Cloud", "u": "https://www.salesforce.com/education/"},
            "nsc": {"t": "National Student Clearinghouse", "u": "https://www.studentclearinghouse.org/"},
            "powerfaids": {"t": "PowerFAIDS", "u": "https://www.powerfaids.org/"},
            "nelnet": {"t": "Nelnet Campus Commerce", "u": "https://en.wikipedia.org/wiki/Nelnet"},
            "ed-fi": {"t": "Ed-Fi data standard", "u": "https://www.ed-fi.org/"},
            "ims-lti": {"t": "IMS Global Learning Tools Interoperability", "u": "https://www.imsglobal.org/activity/learning-tools-interoperability"},
            "ipeds": {"t": "IPEDS federal reporting", "u": "https://nces.ed.gov/ipeds/"}
        },
    },
}
