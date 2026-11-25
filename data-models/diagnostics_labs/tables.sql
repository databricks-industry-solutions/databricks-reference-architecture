CREATE SCHEMA IF NOT EXISTS main.diagnostics_labs COMMENT 'Diagnostics & Labs data model: orders, specimens, exceptions, analyte results and analyzer QC as conformed Silver tables and views. The Gold metric views are in metric_views.sql.';

CREATE TABLE IF NOT EXISTS main.diagnostics_labs.test_catalog (
  test_code STRING NOT NULL COMMENT 'Orderable test code, unique within the test menu.',
  test_name STRING COMMENT 'Test name as shown on orders and reports.',
  loinc_code STRING COMMENT 'LOINC code of the orderable test or panel.',
  specimen_type STRING COMMENT 'Specimen the test runs on, for example Serum, Whole Blood, Urine, Swab.',
  bench STRING COMMENT 'Bench or section that performs or refers the test, for example Chemistry, Hematology, Microbiology, Molecular, Send-out.',
  send_out BOOLEAN COMMENT 'True if the test is referred to a reference lab instead of run in house.',
  tat_target_routine_hours DOUBLE COMMENT 'Target hours from specimen receipt to verified result for a routine order.',
  tat_target_stat_hours DOUBLE COMMENT 'Target hours from specimen receipt to verified result for a STAT order.',
  min_retest_days INT COMMENT 'Fewest days between two orders of this test for one patient before the second counts as an early repeat; null if the test has no retest interval.',
  CONSTRAINT pk_test_catalog PRIMARY KEY (test_code)
) COMMENT 'Test menu: one row per orderable test or panel, with its LOINC code, specimen type, bench, turnaround targets and retest interval.';

CREATE TABLE IF NOT EXISTS main.diagnostics_labs.components (
  component_code STRING NOT NULL COMMENT 'Analyte code, unique within the lab, for example GLU for glucose.',
  component_name STRING COMMENT 'Analyte name as shown on the report.',
  loinc_code STRING COMMENT 'LOINC code of the analyte result.',
  units STRING COMMENT 'Reporting units in UCUM, for example mg/dL; null for qualitative results.',
  critical_low DOUBLE COMMENT 'Value below which a result is critical and must be called to the ordering provider; null if there is no low critical limit.',
  critical_high DOUBLE COMMENT 'Value above which a result is critical and must be called to the ordering provider; null if there is no high critical limit.',
  CONSTRAINT pk_components PRIMARY KEY (component_code)
) COMMENT 'Analyte dictionary: one row per reported analyte, with its LOINC code, units and critical limits.';

CREATE TABLE IF NOT EXISTS main.diagnostics_labs.test_components (
  test_code STRING NOT NULL COMMENT 'Orderable test; joins to test_catalog.',
  component_code STRING NOT NULL COMMENT 'Analyte the test reports; joins to components.',
  CONSTRAINT pk_test_components PRIMARY KEY (test_code, component_code),
  CONSTRAINT fk_test_components_test_code FOREIGN KEY (test_code) REFERENCES main.diagnostics_labs.test_catalog (test_code),
  CONSTRAINT fk_test_components_component_code FOREIGN KEY (component_code) REFERENCES main.diagnostics_labs.components (component_code)
) COMMENT 'Which analytes each orderable test reports: one row per test and analyte. A panel such as a metabolic panel has several.';

CREATE TABLE IF NOT EXISTS main.diagnostics_labs.providers (
  provider_id STRING NOT NULL COMMENT 'Ordering provider identifier.',
  provider_name STRING COMMENT 'Ordering provider name.',
  specialty STRING COMMENT 'Ordering provider specialty, for example Emergency Medicine, Endocrinology.',
  CONSTRAINT pk_providers PRIMARY KEY (provider_id)
) COMMENT 'Ordering providers: one row per provider, with specialty for utilization by who orders.';

CREATE TABLE IF NOT EXISTS main.diagnostics_labs.instruments (
  instrument_id STRING NOT NULL COMMENT 'Analyzer identifier.',
  instrument_name STRING COMMENT 'Analyzer name as the lab knows it.',
  instrument_type STRING COMMENT 'Kind of analyzer, for example Chemistry Analyzer, Hematology Analyzer, PCR System.',
  bench STRING COMMENT 'Bench the analyzer sits on.',
  CONSTRAINT pk_instruments PRIMARY KEY (instrument_id)
) COMMENT 'Analyzers: one row per instrument that produces patient results and runs quality control.';

CREATE TABLE IF NOT EXISTS main.diagnostics_labs.accessions (
  accession_id STRING NOT NULL COMMENT 'Accession identifier assigned when the specimen is logged into the lab system.',
  specimen_type STRING COMMENT 'Specimen received, for example Serum, Whole Blood, Urine, Swab.',
  collected_ts TIMESTAMP COMMENT 'When the specimen was collected. Collect-to-verify turnaround starts here.',
  received_ts TIMESTAMP COMMENT 'When the lab received the specimen. Receipt-to-verify turnaround starts here.',
  accessioned_ts TIMESTAMP COMMENT 'When the specimen was accessioned (logged into the lab system). Accession month comes from this time.',
  CONSTRAINT pk_accessions PRIMARY KEY (accession_id)
) COMMENT 'Specimens accessioned by the lab: one row per specimen. One specimen can carry several ordered tests.';

CREATE TABLE IF NOT EXISTS main.diagnostics_labs.orders (
  order_id STRING NOT NULL COMMENT 'Ordered test identifier: one row per test ordered for a patient.',
  patient_id STRING COMMENT 'Patient identifier from the enterprise patient index.',
  provider_id STRING COMMENT 'Ordering provider; joins to providers.',
  test_code STRING COMMENT 'Test ordered; joins to test_catalog.',
  accession_id STRING COMMENT 'Specimen the test is performed on; joins to accessions. Null if the order was cancelled before a specimen was received.',
  priority STRING COMMENT 'STAT or Routine. Sets which turnaround target applies.',
  patient_class STRING COMMENT 'Where the patient was when the test was ordered: Emergency, Inpatient or Outpatient.',
  ordered_ts TIMESTAMP COMMENT 'When the test was ordered. Order month comes from this time.',
  order_status STRING COMMENT 'Resulted (every analyte verified), In Process, Rejected (specimen rejected, a new specimen is needed), Not Reportable (no result could be reported) or Cancelled.',
  CONSTRAINT pk_orders PRIMARY KEY (order_id),
  CONSTRAINT fk_orders_provider_id FOREIGN KEY (provider_id) REFERENCES main.diagnostics_labs.providers (provider_id),
  CONSTRAINT fk_orders_test_code FOREIGN KEY (test_code) REFERENCES main.diagnostics_labs.test_catalog (test_code),
  CONSTRAINT fk_orders_accession_id FOREIGN KEY (accession_id) REFERENCES main.diagnostics_labs.accessions (accession_id)
) COMMENT 'Ordered tests: one row per test ordered for a patient, with priority, ordering provider, the specimen it runs on and its status.';

CREATE TABLE IF NOT EXISTS main.diagnostics_labs.exception_types (
  exception_type STRING NOT NULL COMMENT 'Exception type, for example Hemolyzed Specimen, Mislabeled Specimen, Requisition Missing.',
  exception_category STRING COMMENT 'Group of exception types: Specimen Integrity, Labeling and Identity, Order and Patient Info, Workflow, Analytical.',
  stage STRING COMMENT 'Where the exception is raised: Automated Accessioning, Specimen Receipt, Manual Review, Testing.',
  outcome_if_unresolved STRING COMMENT 'What happens if the exception is not resolved: Rejected (new specimen needed), Not Reportable (no result), or null if it only delays the result.',
  CONSTRAINT pk_exception_types PRIMARY KEY (exception_type)
) COMMENT 'Reference list of pre-analytic and analytical exception types, with category, stage and the outcome if left unresolved.';

CREATE TABLE IF NOT EXISTS main.diagnostics_labs.accession_exceptions (
  exception_id STRING NOT NULL COMMENT 'Exception identifier.',
  accession_id STRING COMMENT 'Specimen the exception was logged against; joins to accessions.',
  order_id STRING COMMENT 'Ordered test the exception concerns, for example a QC failure on one test; joins to orders. Null if it concerns the whole specimen.',
  exception_type STRING COMMENT 'Exception type; joins to exception_types.',
  detected_ts TIMESTAMP COMMENT 'When the exception was raised.',
  resolution_status STRING COMMENT 'Resolved, or Unresolved if the specimen was rejected or no result could be reported because of it.',
  resolved_ts TIMESTAMP COMMENT 'When the exception was resolved; null if unresolved.',
  CONSTRAINT pk_accession_exceptions PRIMARY KEY (exception_id),
  CONSTRAINT fk_accession_exceptions_accession_id FOREIGN KEY (accession_id) REFERENCES main.diagnostics_labs.accessions (accession_id),
  CONSTRAINT fk_accession_exceptions_order_id FOREIGN KEY (order_id) REFERENCES main.diagnostics_labs.orders (order_id),
  CONSTRAINT fk_accession_exceptions_exception_type FOREIGN KEY (exception_type) REFERENCES main.diagnostics_labs.exception_types (exception_type)
) COMMENT 'Exceptions logged during accessioning and testing: one row per exception. A specimen can have several.';

CREATE TABLE IF NOT EXISTS main.diagnostics_labs.results (
  result_id STRING NOT NULL COMMENT 'Result identifier: one row per analyte reported on an ordered test.',
  order_id STRING COMMENT 'Ordered test the result belongs to; joins to orders.',
  component_code STRING COMMENT 'Analyte reported; joins to components.',
  instrument_id STRING COMMENT 'Analyzer that produced the result; joins to instruments. Null for send-out and manual results.',
  value_numeric DOUBLE COMMENT 'Numeric result value; null for qualitative results.',
  value_text STRING COMMENT 'Qualitative result, for example Detected or Not Detected; null for numeric results.',
  units STRING COMMENT 'Units the result was reported in.',
  reference_low DOUBLE COMMENT 'Low end of the reference range reported with the result.',
  reference_high DOUBLE COMMENT 'High end of the reference range reported with the result.',
  reference_text STRING COMMENT 'Expected qualitative result, for example Not Detected; null for numeric results.',
  abnormal_flag STRING COMMENT 'Interpretation flag as in HL7 table 0078: N normal, L low, H high, LL critical low, HH critical high, A abnormal (qualitative).',
  verified_ts TIMESTAMP COMMENT 'When the result was first verified and released. Turnaround ends at the last analyte of an order.',
  autoverified BOOLEAN COMMENT 'True if the result was released by autoverification rules without a technologist review.',
  critical_notified_ts TIMESTAMP COMMENT 'When a critical result was called to and read back by the ordering provider; null if the result is not critical.',
  corrected_ts TIMESTAMP COMMENT 'When a corrected result replaced the first release; null if the result was never corrected.',
  CONSTRAINT pk_results PRIMARY KEY (result_id),
  CONSTRAINT fk_results_order_id FOREIGN KEY (order_id) REFERENCES main.diagnostics_labs.orders (order_id),
  CONSTRAINT fk_results_component_code FOREIGN KEY (component_code) REFERENCES main.diagnostics_labs.components (component_code),
  CONSTRAINT fk_results_instrument_id FOREIGN KEY (instrument_id) REFERENCES main.diagnostics_labs.instruments (instrument_id)
) COMMENT 'Analyte results: one row per analyte on an ordered test, with value, units, reference range, flag, release and critical call.';

CREATE TABLE IF NOT EXISTS main.diagnostics_labs.qc_runs (
  qc_run_id STRING NOT NULL COMMENT 'Quality-control run identifier: one control measurement on one analyzer.',
  instrument_id STRING COMMENT 'Analyzer the control ran on; joins to instruments.',
  component_code STRING COMMENT 'Analyte the control measures; joins to components.',
  control_lot STRING COMMENT 'Control material lot.',
  control_level STRING COMMENT 'Control level, for example Level 1 (low) or Level 2 (high).',
  run_ts TIMESTAMP COMMENT 'When the control was run.',
  observed_value DOUBLE COMMENT 'Value the analyzer measured on the control.',
  target_mean DOUBLE COMMENT 'Established mean for this control lot, level and analyte.',
  target_sd DOUBLE COMMENT 'Established standard deviation for this control lot, level and analyte.',
  westgard_rule STRING COMMENT 'Westgard rule the run broke, as evaluated by the QC software: 1-2s (warning), 1-3s, 2-2s, R-4s, 4-1s or 10x (rejection); null if none.',
  qc_status STRING COMMENT 'Accepted, Warning (1-2s only) or Rejected (patient testing on the analyte stops until the cause is fixed).',
  CONSTRAINT pk_qc_runs PRIMARY KEY (qc_run_id),
  CONSTRAINT fk_qc_runs_instrument_id FOREIGN KEY (instrument_id) REFERENCES main.diagnostics_labs.instruments (instrument_id),
  CONSTRAINT fk_qc_runs_component_code FOREIGN KEY (component_code) REFERENCES main.diagnostics_labs.components (component_code)
) COMMENT 'Analyzer quality control: one row per control measurement, with the target mean and SD and the Westgard rule broken.';

CREATE OR REPLACE VIEW main.diagnostics_labs.accession_summary
COMMENT 'One row per accession with the counts derived from its orders and exceptions: exceptions, rejection-risk exceptions and whether the specimen was rejected.'
AS
SELECT
  a.accession_id,
  a.specimen_type,
  a.collected_ts,
  a.received_ts,
  a.accessioned_ts,
  (SELECT COUNT(*) FROM main.diagnostics_labs.orders o WHERE o.accession_id = a.accession_id) AS order_count,
  COALESCE(x.exception_count, 0) AS exception_count,
  COALESCE(x.rejection_risk_exception_count, 0) AS rejection_risk_exception_count,
  COALESCE(x.rejected, FALSE) AS rejected
FROM main.diagnostics_labs.accessions a
LEFT JOIN (
  SELECT
    e.accession_id,
    COUNT(*) AS exception_count,
    COUNT_IF(t.outcome_if_unresolved = 'Rejected') AS rejection_risk_exception_count,
    BOOL_OR(t.outcome_if_unresolved = 'Rejected' AND e.resolution_status = 'Unresolved') AS rejected
  FROM main.diagnostics_labs.accession_exceptions e
  JOIN main.diagnostics_labs.exception_types t ON e.exception_type = t.exception_type
  GROUP BY e.accession_id
) x ON a.accession_id = x.accession_id;

CREATE OR REPLACE VIEW main.diagnostics_labs.order_summary
COMMENT 'One row per ordered test with its specimen times, verified time, turnaround in both definitions, the target that applies, whether it was met, and whether the order repeats the same test too soon.'
AS
WITH verified AS (
  SELECT order_id, MAX(verified_ts) AS resulted_ts
  FROM main.diagnostics_labs.results
  GROUP BY order_id
),
repeats AS (
  SELECT
    o.order_id,
    LAG(o.ordered_ts) OVER (PARTITION BY o.patient_id, o.test_code ORDER BY o.ordered_ts, o.order_id) AS previous_ordered_ts
  FROM main.diagnostics_labs.orders o
  WHERE o.order_status <> 'Cancelled'
),
base AS (
  SELECT
    o.order_id,
    o.patient_id,
    o.provider_id,
    o.test_code,
    o.accession_id,
    o.priority,
    o.patient_class,
    o.ordered_ts,
    o.order_status,
    a.collected_ts,
    a.received_ts,
    CASE WHEN o.order_status = 'Resulted' THEN v.resulted_ts END AS resulted_ts,
    CASE WHEN o.priority = 'STAT' THEN t.tat_target_stat_hours ELSE t.tat_target_routine_hours END AS tat_target_hours,
    COALESCE(s.exception_count, 0) AS accession_exception_count,
    COALESCE(r.previous_ordered_ts >= o.ordered_ts - make_interval(0, 0, 0, t.min_retest_days), FALSE) AS early_repeat
  FROM main.diagnostics_labs.orders o
  JOIN main.diagnostics_labs.test_catalog t ON o.test_code = t.test_code
  LEFT JOIN main.diagnostics_labs.accessions a ON o.accession_id = a.accession_id
  LEFT JOIN main.diagnostics_labs.accession_summary s ON o.accession_id = s.accession_id
  LEFT JOIN verified v ON o.order_id = v.order_id
  LEFT JOIN repeats r ON o.order_id = r.order_id
)
SELECT
  *,
  TIMESTAMPDIFF(MINUTE, collected_ts, resulted_ts) / 60.0 AS collect_to_verify_hours,
  TIMESTAMPDIFF(MINUTE, received_ts, resulted_ts) / 60.0 AS receipt_to_verify_hours,
  CASE WHEN resulted_ts IS NOT NULL THEN TIMESTAMPDIFF(MINUTE, received_ts, resulted_ts) / 60.0 <= tat_target_hours END AS within_target
FROM base;
