SELECT 'test_catalog: primary key unique' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('test_catalog: primary key unique: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT test_code FROM main.diagnostics_labs.test_catalog GROUP BY test_code HAVING COUNT(*) > 1));

SELECT 'test_catalog: primary key not null' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('test_catalog: primary key not null: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT * FROM main.diagnostics_labs.test_catalog WHERE test_code IS NULL));

SELECT 'components: primary key unique' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('components: primary key unique: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT component_code FROM main.diagnostics_labs.components GROUP BY component_code HAVING COUNT(*) > 1));

SELECT 'components: primary key not null' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('components: primary key not null: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT * FROM main.diagnostics_labs.components WHERE component_code IS NULL));

SELECT 'test_components: primary key unique' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('test_components: primary key unique: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT test_code, component_code FROM main.diagnostics_labs.test_components GROUP BY test_code, component_code HAVING COUNT(*) > 1));

SELECT 'test_components: primary key not null' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('test_components: primary key not null: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT * FROM main.diagnostics_labs.test_components WHERE test_code IS NULL OR component_code IS NULL));

SELECT 'providers: primary key unique' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('providers: primary key unique: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT provider_id FROM main.diagnostics_labs.providers GROUP BY provider_id HAVING COUNT(*) > 1));

SELECT 'providers: primary key not null' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('providers: primary key not null: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT * FROM main.diagnostics_labs.providers WHERE provider_id IS NULL));

SELECT 'instruments: primary key unique' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('instruments: primary key unique: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT instrument_id FROM main.diagnostics_labs.instruments GROUP BY instrument_id HAVING COUNT(*) > 1));

SELECT 'instruments: primary key not null' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('instruments: primary key not null: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT * FROM main.diagnostics_labs.instruments WHERE instrument_id IS NULL));

SELECT 'accessions: primary key unique' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('accessions: primary key unique: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT accession_id FROM main.diagnostics_labs.accessions GROUP BY accession_id HAVING COUNT(*) > 1));

SELECT 'accessions: primary key not null' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('accessions: primary key not null: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT * FROM main.diagnostics_labs.accessions WHERE accession_id IS NULL));

SELECT 'orders: primary key unique' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('orders: primary key unique: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT order_id FROM main.diagnostics_labs.orders GROUP BY order_id HAVING COUNT(*) > 1));

SELECT 'orders: primary key not null' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('orders: primary key not null: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT * FROM main.diagnostics_labs.orders WHERE order_id IS NULL));

SELECT 'exception_types: primary key unique' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('exception_types: primary key unique: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT exception_type FROM main.diagnostics_labs.exception_types GROUP BY exception_type HAVING COUNT(*) > 1));

SELECT 'exception_types: primary key not null' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('exception_types: primary key not null: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT * FROM main.diagnostics_labs.exception_types WHERE exception_type IS NULL));

SELECT 'accession_exceptions: primary key unique' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('accession_exceptions: primary key unique: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT exception_id FROM main.diagnostics_labs.accession_exceptions GROUP BY exception_id HAVING COUNT(*) > 1));

SELECT 'accession_exceptions: primary key not null' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('accession_exceptions: primary key not null: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT * FROM main.diagnostics_labs.accession_exceptions WHERE exception_id IS NULL));

SELECT 'results: primary key unique' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('results: primary key unique: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT result_id FROM main.diagnostics_labs.results GROUP BY result_id HAVING COUNT(*) > 1));

SELECT 'results: primary key not null' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('results: primary key not null: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT * FROM main.diagnostics_labs.results WHERE result_id IS NULL));

SELECT 'qc_runs: primary key unique' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('qc_runs: primary key unique: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT qc_run_id FROM main.diagnostics_labs.qc_runs GROUP BY qc_run_id HAVING COUNT(*) > 1));

SELECT 'qc_runs: primary key not null' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('qc_runs: primary key not null: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT * FROM main.diagnostics_labs.qc_runs WHERE qc_run_id IS NULL));

SELECT 'test_components.test_code: every value exists in test_catalog' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('test_components.test_code: every value exists in test_catalog: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT c.test_code FROM main.diagnostics_labs.test_components c LEFT ANTI JOIN main.diagnostics_labs.test_catalog p ON c.test_code = p.test_code WHERE c.test_code IS NOT NULL));

SELECT 'test_components.component_code: every value exists in components' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('test_components.component_code: every value exists in components: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT c.component_code FROM main.diagnostics_labs.test_components c LEFT ANTI JOIN main.diagnostics_labs.components p ON c.component_code = p.component_code WHERE c.component_code IS NOT NULL));

SELECT 'orders.provider_id: every value exists in providers' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('orders.provider_id: every value exists in providers: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT c.provider_id FROM main.diagnostics_labs.orders c LEFT ANTI JOIN main.diagnostics_labs.providers p ON c.provider_id = p.provider_id WHERE c.provider_id IS NOT NULL));

SELECT 'orders.test_code: every value exists in test_catalog' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('orders.test_code: every value exists in test_catalog: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT c.test_code FROM main.diagnostics_labs.orders c LEFT ANTI JOIN main.diagnostics_labs.test_catalog p ON c.test_code = p.test_code WHERE c.test_code IS NOT NULL));

SELECT 'orders.accession_id: every value exists in accessions' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('orders.accession_id: every value exists in accessions: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT c.accession_id FROM main.diagnostics_labs.orders c LEFT ANTI JOIN main.diagnostics_labs.accessions p ON c.accession_id = p.accession_id WHERE c.accession_id IS NOT NULL));

SELECT 'accession_exceptions.accession_id: every value exists in accessions' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('accession_exceptions.accession_id: every value exists in accessions: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT c.accession_id FROM main.diagnostics_labs.accession_exceptions c LEFT ANTI JOIN main.diagnostics_labs.accessions p ON c.accession_id = p.accession_id WHERE c.accession_id IS NOT NULL));

SELECT 'accession_exceptions.order_id: every value exists in orders' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('accession_exceptions.order_id: every value exists in orders: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT c.order_id FROM main.diagnostics_labs.accession_exceptions c LEFT ANTI JOIN main.diagnostics_labs.orders p ON c.order_id = p.order_id WHERE c.order_id IS NOT NULL));

SELECT 'accession_exceptions.exception_type: every value exists in exception_types' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('accession_exceptions.exception_type: every value exists in exception_types: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT c.exception_type FROM main.diagnostics_labs.accession_exceptions c LEFT ANTI JOIN main.diagnostics_labs.exception_types p ON c.exception_type = p.exception_type WHERE c.exception_type IS NOT NULL));

SELECT 'results.order_id: every value exists in orders' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('results.order_id: every value exists in orders: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT c.order_id FROM main.diagnostics_labs.results c LEFT ANTI JOIN main.diagnostics_labs.orders p ON c.order_id = p.order_id WHERE c.order_id IS NOT NULL));

SELECT 'results.component_code: every value exists in components' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('results.component_code: every value exists in components: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT c.component_code FROM main.diagnostics_labs.results c LEFT ANTI JOIN main.diagnostics_labs.components p ON c.component_code = p.component_code WHERE c.component_code IS NOT NULL));

SELECT 'results.instrument_id: every value exists in instruments' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('results.instrument_id: every value exists in instruments: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT c.instrument_id FROM main.diagnostics_labs.results c LEFT ANTI JOIN main.diagnostics_labs.instruments p ON c.instrument_id = p.instrument_id WHERE c.instrument_id IS NOT NULL));

SELECT 'qc_runs.instrument_id: every value exists in instruments' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('qc_runs.instrument_id: every value exists in instruments: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT c.instrument_id FROM main.diagnostics_labs.qc_runs c LEFT ANTI JOIN main.diagnostics_labs.instruments p ON c.instrument_id = p.instrument_id WHERE c.instrument_id IS NOT NULL));

SELECT 'qc_runs.component_code: every value exists in components' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('qc_runs.component_code: every value exists in components: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT c.component_code FROM main.diagnostics_labs.qc_runs c LEFT ANTI JOIN main.diagnostics_labs.components p ON c.component_code = p.component_code WHERE c.component_code IS NOT NULL));

SELECT 'orders.patient_id: not null' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('orders.patient_id: not null: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT * FROM main.diagnostics_labs.orders WHERE patient_id IS NULL));

SELECT 'orders.provider_id: not null' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('orders.provider_id: not null: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT * FROM main.diagnostics_labs.orders WHERE provider_id IS NULL));

SELECT 'orders.test_code: not null' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('orders.test_code: not null: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT * FROM main.diagnostics_labs.orders WHERE test_code IS NULL));

SELECT 'orders.priority: not null' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('orders.priority: not null: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT * FROM main.diagnostics_labs.orders WHERE priority IS NULL));

SELECT 'orders.patient_class: not null' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('orders.patient_class: not null: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT * FROM main.diagnostics_labs.orders WHERE patient_class IS NULL));

SELECT 'orders.ordered_ts: not null' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('orders.ordered_ts: not null: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT * FROM main.diagnostics_labs.orders WHERE ordered_ts IS NULL));

SELECT 'orders.order_status: not null' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('orders.order_status: not null: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT * FROM main.diagnostics_labs.orders WHERE order_status IS NULL));

SELECT 'accessions.specimen_type: not null' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('accessions.specimen_type: not null: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT * FROM main.diagnostics_labs.accessions WHERE specimen_type IS NULL));

SELECT 'accessions.collected_ts: not null' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('accessions.collected_ts: not null: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT * FROM main.diagnostics_labs.accessions WHERE collected_ts IS NULL));

SELECT 'accessions.received_ts: not null' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('accessions.received_ts: not null: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT * FROM main.diagnostics_labs.accessions WHERE received_ts IS NULL));

SELECT 'accessions.accessioned_ts: not null' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('accessions.accessioned_ts: not null: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT * FROM main.diagnostics_labs.accessions WHERE accessioned_ts IS NULL));

SELECT 'accession_exceptions.accession_id: not null' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('accession_exceptions.accession_id: not null: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT * FROM main.diagnostics_labs.accession_exceptions WHERE accession_id IS NULL));

SELECT 'accession_exceptions.exception_type: not null' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('accession_exceptions.exception_type: not null: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT * FROM main.diagnostics_labs.accession_exceptions WHERE exception_type IS NULL));

SELECT 'accession_exceptions.detected_ts: not null' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('accession_exceptions.detected_ts: not null: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT * FROM main.diagnostics_labs.accession_exceptions WHERE detected_ts IS NULL));

SELECT 'accession_exceptions.resolution_status: not null' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('accession_exceptions.resolution_status: not null: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT * FROM main.diagnostics_labs.accession_exceptions WHERE resolution_status IS NULL));

SELECT 'results.order_id: not null' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('results.order_id: not null: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT * FROM main.diagnostics_labs.results WHERE order_id IS NULL));

SELECT 'results.component_code: not null' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('results.component_code: not null: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT * FROM main.diagnostics_labs.results WHERE component_code IS NULL));

SELECT 'results.abnormal_flag: not null' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('results.abnormal_flag: not null: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT * FROM main.diagnostics_labs.results WHERE abnormal_flag IS NULL));

SELECT 'results.verified_ts: not null' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('results.verified_ts: not null: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT * FROM main.diagnostics_labs.results WHERE verified_ts IS NULL));

SELECT 'results.autoverified: not null' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('results.autoverified: not null: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT * FROM main.diagnostics_labs.results WHERE autoverified IS NULL));

SELECT 'qc_runs.instrument_id: not null' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('qc_runs.instrument_id: not null: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT * FROM main.diagnostics_labs.qc_runs WHERE instrument_id IS NULL));

SELECT 'qc_runs.component_code: not null' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('qc_runs.component_code: not null: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT * FROM main.diagnostics_labs.qc_runs WHERE component_code IS NULL));

SELECT 'qc_runs.control_lot: not null' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('qc_runs.control_lot: not null: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT * FROM main.diagnostics_labs.qc_runs WHERE control_lot IS NULL));

SELECT 'qc_runs.control_level: not null' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('qc_runs.control_level: not null: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT * FROM main.diagnostics_labs.qc_runs WHERE control_level IS NULL));

SELECT 'qc_runs.run_ts: not null' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('qc_runs.run_ts: not null: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT * FROM main.diagnostics_labs.qc_runs WHERE run_ts IS NULL));

SELECT 'qc_runs.observed_value: not null' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('qc_runs.observed_value: not null: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT * FROM main.diagnostics_labs.qc_runs WHERE observed_value IS NULL));

SELECT 'qc_runs.target_mean: not null' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('qc_runs.target_mean: not null: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT * FROM main.diagnostics_labs.qc_runs WHERE target_mean IS NULL));

SELECT 'qc_runs.target_sd: not null' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('qc_runs.target_sd: not null: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT * FROM main.diagnostics_labs.qc_runs WHERE target_sd IS NULL));

SELECT 'qc_runs.qc_status: not null' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('qc_runs.qc_status: not null: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT * FROM main.diagnostics_labs.qc_runs WHERE qc_status IS NULL));

SELECT 'test_catalog.test_name: not null' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('test_catalog.test_name: not null: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT * FROM main.diagnostics_labs.test_catalog WHERE test_name IS NULL));

SELECT 'test_catalog.loinc_code: not null' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('test_catalog.loinc_code: not null: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT * FROM main.diagnostics_labs.test_catalog WHERE loinc_code IS NULL));

SELECT 'test_catalog.specimen_type: not null' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('test_catalog.specimen_type: not null: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT * FROM main.diagnostics_labs.test_catalog WHERE specimen_type IS NULL));

SELECT 'test_catalog.bench: not null' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('test_catalog.bench: not null: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT * FROM main.diagnostics_labs.test_catalog WHERE bench IS NULL));

SELECT 'test_catalog.send_out: not null' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('test_catalog.send_out: not null: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT * FROM main.diagnostics_labs.test_catalog WHERE send_out IS NULL));

SELECT 'test_catalog.tat_target_routine_hours: not null' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('test_catalog.tat_target_routine_hours: not null: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT * FROM main.diagnostics_labs.test_catalog WHERE tat_target_routine_hours IS NULL));

SELECT 'test_catalog.tat_target_stat_hours: not null' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('test_catalog.tat_target_stat_hours: not null: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT * FROM main.diagnostics_labs.test_catalog WHERE tat_target_stat_hours IS NULL));

SELECT 'components.component_name: not null' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('components.component_name: not null: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT * FROM main.diagnostics_labs.components WHERE component_name IS NULL));

SELECT 'components.loinc_code: not null' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('components.loinc_code: not null: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT * FROM main.diagnostics_labs.components WHERE loinc_code IS NULL));

SELECT 'exception_types.exception_category: not null' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('exception_types.exception_category: not null: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT * FROM main.diagnostics_labs.exception_types WHERE exception_category IS NULL));

SELECT 'exception_types.stage: not null' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('exception_types.stage: not null: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT * FROM main.diagnostics_labs.exception_types WHERE stage IS NULL));

SELECT 'orders.priority: allowed values only' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('orders.priority: allowed values only: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT * FROM main.diagnostics_labs.orders WHERE priority NOT IN ('STAT', 'Routine') OR priority IS NULL));

SELECT 'orders.patient_class: allowed values only' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('orders.patient_class: allowed values only: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT * FROM main.diagnostics_labs.orders WHERE patient_class NOT IN ('Emergency', 'Inpatient', 'Outpatient') OR patient_class IS NULL));

SELECT 'orders.order_status: allowed values only' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('orders.order_status: allowed values only: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT * FROM main.diagnostics_labs.orders WHERE order_status NOT IN ('Resulted', 'In Process', 'Rejected', 'Not Reportable', 'Cancelled') OR order_status IS NULL));

SELECT 'accession_exceptions.resolution_status: allowed values only' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('accession_exceptions.resolution_status: allowed values only: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT * FROM main.diagnostics_labs.accession_exceptions WHERE resolution_status NOT IN ('Resolved', 'Unresolved') OR resolution_status IS NULL));

SELECT 'exception_types.outcome_if_unresolved: allowed values only' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('exception_types.outcome_if_unresolved: allowed values only: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT * FROM main.diagnostics_labs.exception_types WHERE outcome_if_unresolved NOT IN ('Rejected', 'Not Reportable')));

SELECT 'exception_types.stage: allowed values only' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('exception_types.stage: allowed values only: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT * FROM main.diagnostics_labs.exception_types WHERE stage NOT IN ('Automated Accessioning', 'Specimen Receipt', 'Manual Review', 'Testing') OR stage IS NULL));

SELECT 'results.abnormal_flag: allowed values only' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('results.abnormal_flag: allowed values only: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT * FROM main.diagnostics_labs.results WHERE abnormal_flag NOT IN ('N', 'L', 'H', 'LL', 'HH', 'A') OR abnormal_flag IS NULL));

SELECT 'qc_runs.qc_status: allowed values only' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('qc_runs.qc_status: allowed values only: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT * FROM main.diagnostics_labs.qc_runs WHERE qc_status NOT IN ('Accepted', 'Warning', 'Rejected') OR qc_status IS NULL));

SELECT 'qc_runs.westgard_rule: allowed values only' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('qc_runs.westgard_rule: allowed values only: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT * FROM main.diagnostics_labs.qc_runs WHERE westgard_rule NOT IN ('1-2s', '1-3s', '2-2s', 'R-4s', '4-1s', '10x')));

SELECT 'test_catalog: turnaround targets positive, STAT no longer than routine' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('test_catalog: turnaround targets positive, STAT no longer than routine: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT * FROM main.diagnostics_labs.test_catalog WHERE NOT (tat_target_stat_hours > 0 AND tat_target_routine_hours > 0 AND tat_target_stat_hours <= tat_target_routine_hours)));

SELECT 'test_catalog: every test reports at least one analyte' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('test_catalog: every test reports at least one analyte: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT * FROM main.diagnostics_labs.test_catalog c LEFT ANTI JOIN main.diagnostics_labs.test_components tc ON c.test_code = tc.test_code));

SELECT 'test_catalog: retest interval positive when set' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('test_catalog: retest interval positive when set: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT * FROM main.diagnostics_labs.test_catalog WHERE min_retest_days <= 0));

SELECT 'components: critical limits outside each other' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('components: critical limits outside each other: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT * FROM main.diagnostics_labs.components WHERE critical_low >= critical_high));

SELECT 'orders: every order not cancelled has a specimen' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('orders: every order not cancelled has a specimen: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT * FROM main.diagnostics_labs.orders WHERE order_status <> 'Cancelled' AND accession_id IS NULL));

SELECT 'orders: specimen matches the specimen type the test needs' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('orders: specimen matches the specimen type the test needs: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT o.order_id FROM main.diagnostics_labs.orders o JOIN main.diagnostics_labs.test_catalog c ON o.test_code = c.test_code JOIN main.diagnostics_labs.accessions a ON o.accession_id = a.accession_id WHERE a.specimen_type <> c.specimen_type));

SELECT 'accessions: every specimen carries at least one ordered test' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('accessions: every specimen carries at least one ordered test: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT * FROM main.diagnostics_labs.accessions a LEFT ANTI JOIN main.diagnostics_labs.orders o ON a.accession_id = o.accession_id));

SELECT 'accessions: collected <= received <= accessioned' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('accessions: collected <= received <= accessioned: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT * FROM main.diagnostics_labs.accessions WHERE NOT (collected_ts <= received_ts AND received_ts <= accessioned_ts)));

SELECT 'orders: ordered before the specimen was collected' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('orders: ordered before the specimen was collected: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT o.order_id FROM main.diagnostics_labs.orders o JOIN main.diagnostics_labs.accessions a ON o.accession_id = a.accession_id WHERE o.ordered_ts > a.collected_ts));

SELECT 'orders: status Rejected exactly when an unresolved exception rejects the specimen' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('orders: status Rejected exactly when an unresolved exception rejects the specimen: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT o.order_id FROM main.diagnostics_labs.orders o
    LEFT JOIN (SELECT DISTINCT order_id FROM (SELECT o.order_id, t.outcome_if_unresolved
     FROM main.diagnostics_labs.orders o
     JOIN main.diagnostics_labs.accession_exceptions e ON e.accession_id = o.accession_id AND (e.order_id IS NULL OR e.order_id = o.order_id)
     JOIN main.diagnostics_labs.exception_types t ON e.exception_type = t.exception_type
     WHERE e.resolution_status = 'Unresolved') WHERE outcome_if_unresolved = 'Rejected') r ON o.order_id = r.order_id
    WHERE o.order_status <> 'Cancelled' AND ((o.order_status = 'Rejected') <> (r.order_id IS NOT NULL))));

SELECT 'orders: status Not Reportable exactly when an unresolved exception blocks the result and the specimen is not rejected' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('orders: status Not Reportable exactly when an unresolved exception blocks the result and the specimen is not rejected: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT o.order_id FROM main.diagnostics_labs.orders o
    LEFT JOIN (SELECT DISTINCT order_id FROM (SELECT o.order_id, t.outcome_if_unresolved
     FROM main.diagnostics_labs.orders o
     JOIN main.diagnostics_labs.accession_exceptions e ON e.accession_id = o.accession_id AND (e.order_id IS NULL OR e.order_id = o.order_id)
     JOIN main.diagnostics_labs.exception_types t ON e.exception_type = t.exception_type
     WHERE e.resolution_status = 'Unresolved') WHERE outcome_if_unresolved = 'Not Reportable') n ON o.order_id = n.order_id
    WHERE o.order_status NOT IN ('Cancelled', 'Rejected') AND ((o.order_status = 'Not Reportable') <> (n.order_id IS NOT NULL))));

SELECT 'orders: Resulted orders have every analyte of their test, other statuses but In Process have none' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('orders: Resulted orders have every analyte of their test, other statuses but In Process have none: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT o.order_id FROM main.diagnostics_labs.orders o
    LEFT JOIN (SELECT order_id, COUNT(*) AS n FROM main.diagnostics_labs.results GROUP BY order_id) r ON o.order_id = r.order_id
    JOIN (SELECT test_code, COUNT(*) AS n FROM main.diagnostics_labs.test_components GROUP BY test_code) c ON o.test_code = c.test_code
    WHERE (o.order_status = 'Resulted' AND COALESCE(r.n, 0) <> c.n)
       OR (o.order_status IN ('Rejected', 'Not Reportable', 'Cancelled') AND r.n IS NOT NULL)
       OR (o.order_status = 'In Process' AND COALESCE(r.n, 0) >= c.n)));

SELECT 'results: each analyte belongs to the test ordered' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('results: each analyte belongs to the test ordered: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT r.result_id FROM main.diagnostics_labs.results r JOIN main.diagnostics_labs.orders o ON r.order_id = o.order_id LEFT ANTI JOIN main.diagnostics_labs.test_components tc ON tc.test_code = o.test_code AND tc.component_code = r.component_code));

SELECT 'results: one result per analyte per order' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('results: one result per analyte per order: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT order_id, component_code FROM main.diagnostics_labs.results GROUP BY order_id, component_code HAVING COUNT(*) > 1));

SELECT 'results: verified after the specimen was accessioned' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('results: verified after the specimen was accessioned: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT r.result_id FROM main.diagnostics_labs.results r JOIN main.diagnostics_labs.orders o ON r.order_id = o.order_id JOIN main.diagnostics_labs.accessions a ON o.accession_id = a.accession_id WHERE r.verified_ts < a.accessioned_ts));

SELECT 'results: exactly one of numeric value or text value' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('results: exactly one of numeric value or text value: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT * FROM main.diagnostics_labs.results WHERE (value_numeric IS NULL) = (value_text IS NULL)));

SELECT 'results: units as the analyte dictionary has them' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('results: units as the analyte dictionary has them: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT r.result_id FROM main.diagnostics_labs.results r JOIN main.diagnostics_labs.components c ON r.component_code = c.component_code WHERE NOT (r.units <=> c.units)));

SELECT 'results: numeric results carry a reference range, qualitative results an expected value' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('results: numeric results carry a reference range, qualitative results an expected value: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT * FROM main.diagnostics_labs.results WHERE (value_numeric IS NOT NULL AND (reference_low IS NULL OR reference_high IS NULL OR reference_low > reference_high)) OR (value_text IS NOT NULL AND reference_text IS NULL)));

SELECT 'results: abnormal flag agrees with the value, reference range and critical limits' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('results: abnormal flag agrees with the value, reference range and critical limits: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT r.result_id FROM main.diagnostics_labs.results r JOIN main.diagnostics_labs.components c ON r.component_code = c.component_code
    WHERE r.abnormal_flag <> CASE
      WHEN r.value_numeric IS NULL THEN IF(r.value_text = r.reference_text, 'N', 'A')
      WHEN r.value_numeric < c.critical_low THEN 'LL'
      WHEN r.value_numeric > c.critical_high THEN 'HH'
      WHEN r.value_numeric < r.reference_low THEN 'L'
      WHEN r.value_numeric > r.reference_high THEN 'H'
      ELSE 'N' END));

SELECT 'results: only critical results carry a critical call, and only after verification' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('results: only critical results carry a critical call, and only after verification: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT * FROM main.diagnostics_labs.results WHERE critical_notified_ts IS NOT NULL AND (abnormal_flag NOT IN ('LL', 'HH') OR critical_notified_ts < verified_ts)));

SELECT 'results: no critical result is autoverified' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('results: no critical result is autoverified: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT * FROM main.diagnostics_labs.results WHERE autoverified AND abnormal_flag IN ('LL', 'HH')));

SELECT 'results: a correction comes after the first release' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('results: a correction comes after the first release: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT * FROM main.diagnostics_labs.results WHERE corrected_ts <= verified_ts));

SELECT 'results: in-house results name an analyzer on the test''s bench, send-out results none' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('results: in-house results name an analyzer on the test''s bench, send-out results none: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT r.result_id FROM main.diagnostics_labs.results r JOIN main.diagnostics_labs.orders o ON r.order_id = o.order_id JOIN main.diagnostics_labs.test_catalog c ON o.test_code = c.test_code
    LEFT JOIN main.diagnostics_labs.instruments i ON r.instrument_id = i.instrument_id
    WHERE (c.send_out AND r.instrument_id IS NOT NULL) OR (NOT c.send_out AND (r.instrument_id IS NULL OR i.bench <> c.bench))));

SELECT 'accession_exceptions: resolved exactly when a resolution time is set' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('accession_exceptions: resolved exactly when a resolution time is set: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT * FROM main.diagnostics_labs.accession_exceptions WHERE (resolution_status = 'Resolved') <> (resolved_ts IS NOT NULL)));

SELECT 'accession_exceptions: resolved after detection' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('accession_exceptions: resolved after detection: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT * FROM main.diagnostics_labs.accession_exceptions WHERE resolved_ts < detected_ts));

SELECT 'accession_exceptions: detected after the specimen was received' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('accession_exceptions: detected after the specimen was received: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT e.exception_id FROM main.diagnostics_labs.accession_exceptions e JOIN main.diagnostics_labs.accessions a ON e.accession_id = a.accession_id WHERE e.detected_ts < a.received_ts));

SELECT 'accession_exceptions: an exception on an order is on that order''s specimen' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('accession_exceptions: an exception on an order is on that order''s specimen: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT e.exception_id FROM main.diagnostics_labs.accession_exceptions e JOIN main.diagnostics_labs.orders o ON e.order_id = o.order_id WHERE NOT (o.accession_id <=> e.accession_id)));

SELECT 'qc_runs: target SD positive' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('qc_runs: target SD positive: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT * FROM main.diagnostics_labs.qc_runs WHERE target_sd <= 0));

SELECT 'qc_runs: status follows the rule: none Accepted, 1-2s Warning, any other rule Rejected' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('qc_runs: status follows the rule: none Accepted, 1-2s Warning, any other rule Rejected: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT * FROM main.diagnostics_labs.qc_runs WHERE qc_status <> CASE WHEN westgard_rule IS NULL THEN 'Accepted' WHEN westgard_rule = '1-2s' THEN 'Warning' ELSE 'Rejected' END));

SELECT 'qc_runs: 1-3s exactly when the run is beyond 3 SD' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('qc_runs: 1-3s exactly when the run is beyond 3 SD: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT * FROM (SELECT q.*, (observed_value - target_mean) / target_sd AS z,
       LAG((observed_value - target_mean) / target_sd) OVER (PARTITION BY instrument_id, component_code, control_lot, control_level ORDER BY run_ts, qc_run_id) AS prev_z
     FROM main.diagnostics_labs.qc_runs q) WHERE (ABS(z) > 3) <> (westgard_rule <=> '1-3s')));

SELECT 'qc_runs: no rule only within 2 SD' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('qc_runs: no rule only within 2 SD: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT * FROM (SELECT q.*, (observed_value - target_mean) / target_sd AS z,
       LAG((observed_value - target_mean) / target_sd) OVER (PARTITION BY instrument_id, component_code, control_lot, control_level ORDER BY run_ts, qc_run_id) AS prev_z
     FROM main.diagnostics_labs.qc_runs q) WHERE westgard_rule IS NULL AND ABS(z) > 2));

SELECT 'qc_runs: 1-2s only between 2 and 3 SD and not a second run beyond 2 SD on the same side' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('qc_runs: 1-2s only between 2 and 3 SD and not a second run beyond 2 SD on the same side: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT * FROM (SELECT q.*, (observed_value - target_mean) / target_sd AS z,
       LAG((observed_value - target_mean) / target_sd) OVER (PARTITION BY instrument_id, component_code, control_lot, control_level ORDER BY run_ts, qc_run_id) AS prev_z
     FROM main.diagnostics_labs.qc_runs q) WHERE westgard_rule = '1-2s' AND NOT (ABS(z) > 2 AND ABS(z) <= 3 AND NOT ((z > 2 AND prev_z > 2) OR (z < -2 AND prev_z < -2)))));

SELECT 'qc_runs: 2-2s only on a second consecutive run beyond 2 SD on the same side' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('qc_runs: 2-2s only on a second consecutive run beyond 2 SD on the same side: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT * FROM (SELECT q.*, (observed_value - target_mean) / target_sd AS z,
       LAG((observed_value - target_mean) / target_sd) OVER (PARTITION BY instrument_id, component_code, control_lot, control_level ORDER BY run_ts, qc_run_id) AS prev_z
     FROM main.diagnostics_labs.qc_runs q) WHERE westgard_rule = '2-2s' AND NOT ((z > 2 AND prev_z > 2) OR (z < -2 AND prev_z < -2))));

SELECT 'qc_runs: analyzer bench runs the analyte' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('qc_runs: analyzer bench runs the analyte: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT q.qc_run_id FROM main.diagnostics_labs.qc_runs q JOIN main.diagnostics_labs.instruments i ON q.instrument_id = i.instrument_id
    LEFT ANTI JOIN (SELECT DISTINCT c.bench, tc.component_code FROM main.diagnostics_labs.test_catalog c JOIN main.diagnostics_labs.test_components tc ON c.test_code = tc.test_code) b
    ON b.bench = i.bench AND b.component_code = q.component_code));

SELECT 'order_summary: one row per order' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('order_summary: one row per order: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT 1 FROM (SELECT (SELECT COUNT(*) FROM main.diagnostics_labs.order_summary) AS a, (SELECT COUNT(*) FROM main.diagnostics_labs.orders) AS b) WHERE a <> b));

SELECT 'order_summary: turnaround only on Resulted orders, never negative' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('order_summary: turnaround only on Resulted orders, never negative: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT * FROM main.diagnostics_labs.order_summary WHERE (order_status = 'Resulted') <> (receipt_to_verify_hours IS NOT NULL) OR receipt_to_verify_hours < 0 OR collect_to_verify_hours < receipt_to_verify_hours));

SELECT 'accession_summary: one row per accession' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('accession_summary: one row per accession: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT 1 FROM (SELECT (SELECT COUNT(*) FROM main.diagnostics_labs.accession_summary) AS a, (SELECT COUNT(*) FROM main.diagnostics_labs.accessions) AS b) WHERE a <> b));

SELECT 'accession_summary: exception counts add up to the exceptions table' AS check_name, IF(n = 0, 'PASS', raise_error(CONCAT('accession_summary: exception counts add up to the exceptions table: ', n, ' rows break the rule'))) AS result
FROM (SELECT COUNT(*) AS n FROM (SELECT 1 FROM (SELECT (SELECT SUM(exception_count) FROM main.diagnostics_labs.accession_summary) AS a, (SELECT COUNT(*) FROM main.diagnostics_labs.accession_exceptions) AS b) WHERE a <> b));
