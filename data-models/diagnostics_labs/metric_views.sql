CREATE OR REPLACE VIEW main.diagnostics_labs.order_metrics
WITH METRICS
LANGUAGE YAML
AS $$
version: 1.1
source: main.diagnostics_labs.order_summary
comment: "Ordered tests: volume, status, turnaround against target, send-outs and early repeats. One row per ordered test."
joins:
  - name: test_menu
    source: main.diagnostics_labs.test_catalog
    'on': source.test_code = test_menu.test_code
  - name: provider
    source: main.diagnostics_labs.providers
    'on': source.provider_id = provider.provider_id
dimensions:
  - name: Order Month
    expr: "DATE_TRUNC('MONTH', source.ordered_ts)"
    comment: "Month the test was ordered."
    synonyms: [month]
  - name: Order Date
    expr: "CAST(source.ordered_ts AS DATE)"
    comment: "Date the test was ordered."
  - name: Test
    expr: test_menu.test_name
    comment: "Test ordered."
    synonyms: [test name, assay, panel]
  - name: Test LOINC Code
    expr: test_menu.loinc_code
    comment: "LOINC code of the test ordered."
  - name: Bench
    expr: test_menu.bench
    comment: "Bench or section that performs or refers the test."
    synonyms: [section, department]
  - name: Send-out
    expr: test_menu.send_out
    comment: "True if the test is referred to a reference lab."
  - name: Priority
    expr: source.priority
    comment: "STAT or Routine."
    synonyms: [stat, urgency]
  - name: Patient Class
    expr: source.patient_class
    comment: "Emergency, Inpatient or Outpatient."
    synonyms: [patient location, setting]
  - name: Ordering Specialty
    expr: provider.specialty
    comment: "Specialty of the ordering provider."
    synonyms: [specialty]
  - name: Ordering Provider
    expr: provider.provider_name
    comment: "Provider who ordered the test."
    synonyms: [provider, ordering physician]
  - name: Order Status
    expr: source.order_status
    comment: "Resulted, In Process, Rejected, Not Reportable or Cancelled."
    synonyms: [status]
  - name: Has Specimen Exception
    expr: source.accession_exception_count > 0
    comment: "True if the specimen the test ran on had at least one exception."
measures:
  - name: Orders
    expr: COUNT(1)
    display_name: Orders
    comment: "Count of ordered tests, all statuses. Test volume when grouped by Test."
    synonyms: [test volume, ordered tests, tests]
    format: {type: number, decimal_places: {type: exact, places: 0}}
  - name: Resulted Orders
    expr: COUNT(1) FILTER (WHERE source.order_status = 'Resulted')
    display_name: Resulted Orders
    comment: "Count of orders with every analyte verified."
    synonyms: [completed tests, resulted tests]
    format: {type: number, decimal_places: {type: exact, places: 0}}
  - name: Open Orders
    expr: COUNT(1) FILTER (WHERE source.order_status = 'In Process')
    display_name: Open Orders
    comment: "Count of orders received and not yet resulted, rejected or cancelled: the backlog as of the latest load."
    synonyms: [backlog, pending orders, work in progress]
    format: {type: number, decimal_places: {type: exact, places: 0}}
  - name: Cancelled Orders
    expr: COUNT(1) FILTER (WHERE source.order_status = 'Cancelled')
    display_name: Cancelled Orders
    comment: "Count of orders cancelled."
    format: {type: number, decimal_places: {type: exact, places: 0}}
  - name: Completed Orders
    expr: COUNT(1) FILTER (WHERE source.order_status IN ('Resulted', 'Rejected', 'Not Reportable'))
    display_name: Completed Orders
    comment: "Count of orders that reached an outcome: Resulted, Rejected or Not Reportable. The denominator of the order outcome rates."
    format: {type: number, decimal_places: {type: exact, places: 0}}
  - name: Rejected Orders
    expr: COUNT(1) FILTER (WHERE source.order_status = 'Rejected')
    display_name: Rejected Orders
    comment: "Count of orders whose specimen was rejected, so a new specimen is needed."
    format: {type: number, decimal_places: {type: exact, places: 0}}
  - name: Order Rejection Rate
    expr: "try_divide(MEASURE(`Rejected Orders`), MEASURE(`Completed Orders`))"
    display_name: Order Rejection Rate
    comment: "Rejected Orders / Completed Orders. Specimen Rejection Rate in accession_metrics counts specimens instead of tests."
    format: {type: percentage, decimal_places: {type: exact, places: 1}}
  - name: Not Reportable Orders
    expr: COUNT(1) FILTER (WHERE source.order_status = 'Not Reportable')
    display_name: Not Reportable Orders
    comment: "Count of orders with no reportable result."
    format: {type: number, decimal_places: {type: exact, places: 0}}
  - name: Not Reportable Rate
    expr: "try_divide(MEASURE(`Not Reportable Orders`), MEASURE(`Completed Orders`))"
    display_name: Not Reportable Rate
    comment: "Not Reportable Orders / Completed Orders."
    format: {type: percentage, decimal_places: {type: exact, places: 1}}
  - name: Avg Receipt-to-Verify Hours
    expr: AVG(source.receipt_to_verify_hours)
    display_name: Avg Receipt-to-Verify (h)
    comment: "Average hours from specimen receipt to the last verified analyte, resulted orders only. The in-lab turnaround the targets apply to."
    synonyms: [turnaround time, TAT, in-lab turnaround, average turnaround]
    format: {type: number, decimal_places: {type: exact, places: 1}}
  - name: Median Receipt-to-Verify Hours
    expr: PERCENTILE(source.receipt_to_verify_hours, 0.5)
    display_name: Median Receipt-to-Verify (h)
    comment: "Median hours from specimen receipt to the last verified analyte, resulted orders only."
    synonyms: [median TAT, median turnaround]
    format: {type: number, decimal_places: {type: exact, places: 1}}
  - name: P90 Receipt-to-Verify Hours
    expr: PERCENTILE(source.receipt_to_verify_hours, 0.9)
    display_name: 90th Percentile Receipt-to-Verify (h)
    comment: "Hours within which 90 percent of resulted orders were verified after receipt."
    synonyms: [90th percentile TAT, P90 turnaround]
    format: {type: number, decimal_places: {type: exact, places: 1}}
  - name: Avg Collect-to-Verify Hours
    expr: AVG(source.collect_to_verify_hours)
    display_name: Avg Collect-to-Verify (h)
    comment: "Average hours from specimen collection to the last verified analyte, resulted orders only. The turnaround the ordering provider sees, transport included."
    synonyms: [total turnaround, collection to result]
    format: {type: number, decimal_places: {type: exact, places: 1}}
  - name: Median Collect-to-Verify Hours
    expr: PERCENTILE(source.collect_to_verify_hours, 0.5)
    display_name: Median Collect-to-Verify (h)
    comment: "Median hours from specimen collection to the last verified analyte, resulted orders only."
    format: {type: number, decimal_places: {type: exact, places: 1}}
  - name: Within Target Rate
    expr: try_divide(COUNT(1) FILTER (WHERE source.within_target), COUNT(source.within_target))
    display_name: Within Target Rate
    comment: "Share of resulted orders verified within the receipt-to-verify target for their test and priority."
    synonyms: [TAT compliance, on-time rate, turnaround against target]
    format: {type: percentage, decimal_places: {type: exact, places: 1}}
  - name: STAT Within Target Rate
    expr: try_divide(COUNT(1) FILTER (WHERE source.within_target AND source.priority = 'STAT'), COUNT(source.within_target) FILTER (WHERE source.priority = 'STAT'))
    display_name: STAT Within Target Rate
    comment: "Share of resulted STAT orders verified within their STAT target."
    synonyms: [STAT compliance, STAT TAT compliance]
    format: {type: percentage, decimal_places: {type: exact, places: 1}}
  - name: Straight-Through Turnaround Hours
    expr: AVG(source.receipt_to_verify_hours) FILTER (WHERE source.accession_exception_count = 0)
    display_name: Straight-Through Turnaround (h)
    comment: "Average receipt-to-verify hours for resulted orders whose specimen had no exception: the time of the lab's standard path."
    synonyms: [standard TAT, standard turnaround]
    format: {type: number, decimal_places: {type: exact, places: 1}}
  - name: Send-out Orders
    expr: COUNT(1) FILTER (WHERE test_menu.send_out)
    display_name: Send-out Orders
    comment: "Count of orders for tests referred to a reference lab."
    synonyms: [send-outs, referral tests]
    format: {type: number, decimal_places: {type: exact, places: 0}}
  - name: Send-out Rate
    expr: "try_divide(MEASURE(`Send-out Orders`), MEASURE(`Orders`))"
    display_name: Send-out Rate
    comment: "Send-out Orders / Orders."
    format: {type: percentage, decimal_places: {type: exact, places: 1}}
  - name: Early Repeat Orders
    expr: COUNT(1) FILTER (WHERE source.early_repeat)
    display_name: Early Repeat Orders
    comment: "Count of orders placed for a patient sooner than the test's retest interval after a previous order of the same test. Cancelled orders do not count."
    synonyms: [redundant orders, duplicate tests, repeat orders]
    format: {type: number, decimal_places: {type: exact, places: 0}}
  - name: Early Repeat Rate
    expr: "try_divide(MEASURE(`Early Repeat Orders`), MEASURE(`Orders`))"
    display_name: Early Repeat Rate
    comment: "Early Repeat Orders / Orders."
    synonyms: [redundant order rate]
    format: {type: percentage, decimal_places: {type: exact, places: 1}}
$$;

CREATE OR REPLACE VIEW main.diagnostics_labs.accession_metrics
WITH METRICS
LANGUAGE YAML
AS $$
version: 1.1
source: main.diagnostics_labs.accession_summary
comment: "Specimens: accession volume, exceptions, rejections and transport time. One row per accession."
dimensions:
  - name: Accession Month
    expr: "DATE_TRUNC('MONTH', source.accessioned_ts)"
    comment: "Month the specimen was accessioned."
    synonyms: [month]
  - name: Accession Date
    expr: "CAST(source.accessioned_ts AS DATE)"
    comment: "Date the specimen was accessioned."
  - name: Specimen Type
    expr: source.specimen_type
    comment: "Specimen received."
    synonyms: [sample type]
  - name: Has Exception
    expr: source.exception_count > 0
    comment: "True if the accession had at least one exception."
  - name: Specimen Rejected
    expr: source.rejected
    comment: "True if the specimen was rejected and a new specimen is needed."
measures:
  - name: Accession Volume
    expr: COUNT(1)
    display_name: Accession Volume
    comment: "Count of accessioned specimens."
    synonyms: [accessions, specimens received, specimens]
    format: {type: number, decimal_places: {type: exact, places: 0}}
  - name: Ordered Tests per Accession
    expr: SUM(source.order_count) / COUNT(1)
    display_name: Ordered Tests per Accession
    comment: "Average number of ordered tests a specimen carries."
    format: {type: number, decimal_places: {type: exact, places: 2}}
  - name: Accessions with Exception
    expr: COUNT(1) FILTER (WHERE source.exception_count > 0)
    display_name: Accessions with Exception
    comment: "Count of accessions with at least one exception."
    format: {type: number, decimal_places: {type: exact, places: 0}}
  - name: Exception Volume
    expr: SUM(source.exception_count)
    display_name: Exception Volume
    comment: "Count of exceptions across all accessions (an accession can have several)."
    synonyms: [exceptions, exception count]
    format: {type: number, decimal_places: {type: exact, places: 0}}
  - name: Accession Exception Rate
    expr: "try_divide(MEASURE(`Accessions with Exception`), MEASURE(`Accession Volume`))"
    display_name: Accession Exception Rate
    comment: "Accessions with Exception / Accession Volume: how often a specimen does not flow straight through."
    synonyms: [exception rate]
    format: {type: percentage, decimal_places: {type: exact, places: 1}}
  - name: Exceptions per 100 Accessions
    expr: "try_divide(MEASURE(`Exception Volume`) * 100.0, MEASURE(`Accession Volume`))"
    display_name: Exceptions per 100 Accessions
    comment: "Exception Volume x 100 / Accession Volume: the exception workload per 100 specimens. Can exceed 100."
    synonyms: [exception intensity]
    format: {type: number, decimal_places: {type: exact, places: 1}}
  - name: Exceptions per Accession with Exception
    expr: "try_divide(MEASURE(`Exception Volume`), MEASURE(`Accessions with Exception`))"
    display_name: Exceptions per Accession with Exception
    comment: "Exception Volume / Accessions with Exception: separates 'more specimens have problems' from 'problem specimens have more problems'."
    format: {type: number, decimal_places: {type: exact, places: 2}}
  - name: Rejection-Risk Exceptions
    expr: SUM(source.rejection_risk_exception_count)
    display_name: Rejection-Risk Exceptions
    comment: "Count of exceptions whose type leads to a rejected specimen if left unresolved, resolved or not."
    format: {type: number, decimal_places: {type: exact, places: 0}}
  - name: Rejection-Risk Exceptions per 100 Accessions
    expr: "try_divide(MEASURE(`Rejection-Risk Exceptions`) * 100.0, MEASURE(`Accession Volume`))"
    display_name: Rejection-Risk Exceptions per 100 Accessions
    comment: "Rejection-Risk Exceptions x 100 / Accession Volume."
    format: {type: number, decimal_places: {type: exact, places: 1}}
  - name: Rejected Specimens
    expr: COUNT(1) FILTER (WHERE source.rejected)
    display_name: Rejected Specimens
    comment: "Count of specimens rejected: an exception that leads to rejection was left unresolved."
    synonyms: [rejections, rejected samples]
    format: {type: number, decimal_places: {type: exact, places: 0}}
  - name: Specimen Rejection Rate
    expr: "try_divide(MEASURE(`Rejected Specimens`), MEASURE(`Accession Volume`))"
    display_name: Specimen Rejection Rate
    comment: "Rejected Specimens / Accession Volume. A pre-analytic quality indicator labs track for accreditation."
    synonyms: [rejection rate]
    format: {type: percentage, decimal_places: {type: exact, places: 1}}
  - name: Avg Collection-to-Receipt Hours
    expr: AVG(TIMESTAMPDIFF(MINUTE, source.collected_ts, source.received_ts) / 60.0)
    display_name: Avg Collection-to-Receipt (h)
    comment: "Average hours from collection to the lab receiving the specimen: transport time."
    synonyms: [transport time, transit time]
    format: {type: number, decimal_places: {type: exact, places: 1}}
$$;

CREATE OR REPLACE VIEW main.diagnostics_labs.exception_metrics
WITH METRICS
LANGUAGE YAML
AS $$
version: 1.1
source: main.diagnostics_labs.accession_exceptions
comment: "Exceptions by type, category, stage and resolution. One row per exception."
joins:
  - name: accession
    source: main.diagnostics_labs.accessions
    'on': source.accession_id = accession.accession_id
  - name: etype
    source: main.diagnostics_labs.exception_types
    'on': source.exception_type = etype.exception_type
dimensions:
  - name: Accession Month
    expr: "DATE_TRUNC('MONTH', accession.accessioned_ts)"
    comment: "Month the specimen was accessioned."
    synonyms: [month]
  - name: Specimen Type
    expr: accession.specimen_type
    comment: "Specimen the exception was logged against."
  - name: Exception Type
    expr: source.exception_type
    comment: "Exception type, for example Hemolyzed Specimen."
    synonyms: [problem type, issue type, rejection reason]
  - name: Exception Category
    expr: etype.exception_category
    comment: "Group of exception types."
  - name: Stage
    expr: etype.stage
    comment: "Where the exception is raised."
  - name: Outcome if Unresolved
    expr: "COALESCE(etype.outcome_if_unresolved, 'None (delay only)')"
    comment: "What the exception does if not resolved: Rejected, Not Reportable, or a delay only."
  - name: Resolution Status
    expr: source.resolution_status
    comment: "Resolved or Unresolved."
measures:
  - name: Exceptions
    expr: COUNT(1)
    display_name: Exceptions
    comment: "Count of exceptions."
    format: {type: number, decimal_places: {type: exact, places: 0}}
  - name: Unresolved Exceptions
    expr: COUNT(1) FILTER (WHERE source.resolution_status = 'Unresolved')
    display_name: Unresolved Exceptions
    comment: "Count of exceptions not resolved."
    format: {type: number, decimal_places: {type: exact, places: 0}}
  - name: Unresolved Rate
    expr: "try_divide(MEASURE(`Unresolved Exceptions`), MEASURE(`Exceptions`))"
    display_name: Unresolved Rate
    comment: "Unresolved Exceptions / Exceptions. Most useful filtered to Outcome if Unresolved = Rejected or Not Reportable: those are the exceptions whose resolution decides the result."
    format: {type: percentage, decimal_places: {type: exact, places: 1}}
  - name: Accessions Affected
    expr: COUNT(DISTINCT source.accession_id)
    display_name: Accessions Affected
    comment: "Distinct accessions with at least one matching exception."
    format: {type: number, decimal_places: {type: exact, places: 0}}
  - name: Avg Hours to Resolve
    expr: AVG(TIMESTAMPDIFF(MINUTE, source.detected_ts, source.resolved_ts) / 60.0)
    display_name: Avg Hours to Resolve
    comment: "Average hours from detection to resolution. Unresolved exceptions have no resolution time, so only resolved exceptions count."
    format: {type: number, decimal_places: {type: exact, places: 1}}
$$;

CREATE OR REPLACE VIEW main.diagnostics_labs.result_metrics
WITH METRICS
LANGUAGE YAML
AS $$
version: 1.1
source: main.diagnostics_labs.results
comment: "Analyte results: abnormal and critical results, critical calls, autoverification and corrections. One row per analyte result."
joins:
  - name: ord
    source: main.diagnostics_labs.orders
    'on': source.order_id = ord.order_id
    joins:
      - name: test_menu
        source: main.diagnostics_labs.test_catalog
        'on': ord.test_code = test_menu.test_code
  - name: component
    source: main.diagnostics_labs.components
    'on': source.component_code = component.component_code
  - name: analyzer
    source: main.diagnostics_labs.instruments
    'on': source.instrument_id = analyzer.instrument_id
dimensions:
  - name: Verified Month
    expr: "DATE_TRUNC('MONTH', source.verified_ts)"
    comment: "Month the result was verified."
    synonyms: [month]
  - name: Verified Date
    expr: "CAST(source.verified_ts AS DATE)"
    comment: "Date the result was verified."
  - name: Analyte
    expr: component.component_name
    comment: "Analyte reported, for example Potassium."
    synonyms: [component, analyte name]
  - name: Analyte LOINC Code
    expr: component.loinc_code
    comment: "LOINC code of the analyte result."
  - name: Test
    expr: ord.test_menu.test_name
    comment: "Test the analyte was reported on."
    synonyms: [test name, panel]
  - name: Bench
    expr: ord.test_menu.bench
    comment: "Bench or section that performs or refers the test."
    synonyms: [section, department]
  - name: Instrument
    expr: analyzer.instrument_name
    comment: "Analyzer that produced the result; null for send-out and manual results."
    synonyms: [analyzer]
  - name: Priority
    expr: ord.priority
    comment: "STAT or Routine."
  - name: Abnormal Flag
    expr: source.abnormal_flag
    comment: "N, L, H, LL (critical low), HH (critical high) or A (abnormal qualitative)."
    synonyms: [flag, interpretation]
  - name: Autoverified
    expr: source.autoverified
    comment: "True if the result was released by autoverification rules."
measures:
  - name: Results
    expr: COUNT(1)
    display_name: Results
    comment: "Count of analyte results."
    synonyms: [analyte results, reported results]
    format: {type: number, decimal_places: {type: exact, places: 0}}
  - name: Abnormal Results
    expr: COUNT(1) FILTER (WHERE source.abnormal_flag <> 'N')
    display_name: Abnormal Results
    comment: "Count of results flagged outside the reference range or not as expected (any flag but N)."
    format: {type: number, decimal_places: {type: exact, places: 0}}
  - name: Abnormal Rate
    expr: "try_divide(MEASURE(`Abnormal Results`), MEASURE(`Results`))"
    display_name: Abnormal Rate
    comment: "Abnormal Results / Results."
    synonyms: [abnormal result rate]
    format: {type: percentage, decimal_places: {type: exact, places: 1}}
  - name: Critical Results
    expr: COUNT(1) FILTER (WHERE source.abnormal_flag IN ('LL', 'HH'))
    display_name: Critical Results
    comment: "Count of results beyond a critical limit (flag LL or HH)."
    synonyms: [critical values, panic values]
    format: {type: number, decimal_places: {type: exact, places: 0}}
  - name: Critical Result Rate
    expr: "try_divide(MEASURE(`Critical Results`), MEASURE(`Results`))"
    display_name: Critical Result Rate
    comment: "Critical Results / Results."
    format: {type: percentage, decimal_places: {type: exact, places: 1}}
  - name: Avg Minutes to Notify Critical
    expr: AVG(TIMESTAMPDIFF(MINUTE, source.verified_ts, source.critical_notified_ts)) FILTER (WHERE source.abnormal_flag IN ('LL', 'HH'))
    display_name: Avg Minutes to Notify Critical
    comment: "Average minutes from verifying a critical result to the provider reading it back."
    synonyms: [critical call time, critical notification time]
    format: {type: number, decimal_places: {type: exact, places: 1}}
  - name: Critical Calls Within 30 Minutes Rate
    expr: try_divide(COUNT(1) FILTER (WHERE source.abnormal_flag IN ('LL', 'HH') AND TIMESTAMPDIFF(MINUTE, source.verified_ts, source.critical_notified_ts) <= 30), COUNT(1) FILTER (WHERE source.abnormal_flag IN ('LL', 'HH')))
    display_name: Critical Calls Within 30 Minutes Rate
    comment: "Share of critical results read back by the provider within 30 minutes of verification. A critical result never called counts as late."
    synonyms: [critical call compliance]
    format: {type: percentage, decimal_places: {type: exact, places: 1}}
  - name: Autoverified Results
    expr: COUNT(1) FILTER (WHERE source.autoverified)
    display_name: Autoverified Results
    comment: "Count of results released by autoverification rules."
    format: {type: number, decimal_places: {type: exact, places: 0}}
  - name: Autoverification Rate
    expr: try_divide(COUNT(1) FILTER (WHERE source.autoverified AND source.instrument_id IS NOT NULL), COUNT(1) FILTER (WHERE source.instrument_id IS NOT NULL))
    display_name: Autoverification Rate
    comment: "Share of analyzer results released by autoverification rules. Send-out and manual results do not count."
    synonyms: [autoverify rate, auto-release rate]
    format: {type: percentage, decimal_places: {type: exact, places: 1}}
  - name: Corrected Results
    expr: COUNT(1) FILTER (WHERE source.corrected_ts IS NOT NULL)
    display_name: Corrected Results
    comment: "Count of results corrected after release."
    synonyms: [amended results, corrected reports]
    format: {type: number, decimal_places: {type: exact, places: 0}}
  - name: Corrected Result Rate
    expr: "try_divide(MEASURE(`Corrected Results`), MEASURE(`Results`))"
    display_name: Corrected Result Rate
    comment: "Corrected Results / Results. A post-analytic quality indicator labs track for accreditation."
    synonyms: [corrected report rate]
    format: {type: percentage, decimal_places: {type: exact, places: 1}}
$$;

CREATE OR REPLACE VIEW main.diagnostics_labs.qc_metrics
WITH METRICS
LANGUAGE YAML
AS $$
version: 1.1
source: main.diagnostics_labs.qc_runs
comment: "Analyzer quality control: QC failure rate, Westgard rule violations, bias (SDI) and imprecision (CV). One row per control measurement."
joins:
  - name: analyzer
    source: main.diagnostics_labs.instruments
    'on': source.instrument_id = analyzer.instrument_id
  - name: component
    source: main.diagnostics_labs.components
    'on': source.component_code = component.component_code
dimensions:
  - name: Run Month
    expr: "DATE_TRUNC('MONTH', source.run_ts)"
    comment: "Month the control was run."
    synonyms: [month]
  - name: Run Date
    expr: "CAST(source.run_ts AS DATE)"
    comment: "Date the control was run."
  - name: Instrument
    expr: analyzer.instrument_name
    comment: "Analyzer the control ran on."
    synonyms: [analyzer]
  - name: Bench
    expr: analyzer.bench
    comment: "Bench the analyzer sits on."
  - name: Analyte
    expr: component.component_name
    comment: "Analyte the control measures."
  - name: Control Level
    expr: source.control_level
    comment: "Control level, for example Level 1 (low) or Level 2 (high)."
  - name: Control Lot
    expr: source.control_lot
    comment: "Control material lot."
  - name: Westgard Rule
    expr: "COALESCE(source.westgard_rule, 'None')"
    comment: "Westgard rule the run broke, or None."
    synonyms: [QC rule]
  - name: QC Status
    expr: source.qc_status
    comment: "Accepted, Warning or Rejected."
measures:
  - name: QC Runs
    expr: COUNT(1)
    display_name: QC Runs
    comment: "Count of control measurements."
    synonyms: [control runs, QC events]
    format: {type: number, decimal_places: {type: exact, places: 0}}
  - name: QC Warnings
    expr: COUNT(1) FILTER (WHERE source.qc_status = 'Warning')
    display_name: QC Warnings
    comment: "Count of control runs that broke only the 1-2s warning rule."
    format: {type: number, decimal_places: {type: exact, places: 0}}
  - name: QC Rejections
    expr: COUNT(1) FILTER (WHERE source.qc_status = 'Rejected')
    display_name: QC Rejections
    comment: "Count of control runs rejected by a Westgard rejection rule."
    synonyms: [QC failures, failed QC]
    format: {type: number, decimal_places: {type: exact, places: 0}}
  - name: QC Failure Rate
    expr: "try_divide(MEASURE(`QC Rejections`), MEASURE(`QC Runs`))"
    display_name: QC Failure Rate
    comment: "QC Rejections / QC Runs."
    synonyms: [QC rejection rate]
    format: {type: percentage, decimal_places: {type: exact, places: 1}}
  - name: Westgard Violations
    expr: COUNT(1) FILTER (WHERE source.westgard_rule IS NOT NULL)
    display_name: Westgard Violations
    comment: "Count of control runs that broke any Westgard rule, warnings included."
    synonyms: [Westgard breaches, rule violations]
    format: {type: number, decimal_places: {type: exact, places: 0}}
  - name: Analyzers with QC Rejection
    expr: COUNT(DISTINCT source.instrument_id) FILTER (WHERE source.qc_status = 'Rejected')
    display_name: Analyzers with QC Rejection
    comment: "Distinct analyzers with at least one rejected control run."
    format: {type: number, decimal_places: {type: exact, places: 0}}
  - name: Mean SDI
    expr: AVG(try_divide(source.observed_value - source.target_mean, source.target_sd))
    display_name: Mean SDI
    comment: "Average standard deviation index, (observed - target mean) / target SD: the bias of the analyzer. Read it by analyte and control level; a value drifting away from 0 signals a shift."
    synonyms: [bias, standard deviation index]
    format: {type: number, decimal_places: {type: exact, places: 2}}
  - name: CV Percent
    expr: try_divide(STDDEV_SAMP(source.observed_value) * 100.0, AVG(source.observed_value))
    display_name: CV (%)
    comment: "Coefficient of variation of the observed control values: the imprecision of the analyzer. Only meaningful grouped by analyte, control level and control lot."
    synonyms: [coefficient of variation, imprecision]
    format: {type: number, decimal_places: {type: exact, places: 2}}
$$;
