INSERT INTO main.diagnostics_labs.test_catalog (test_code, test_name, loinc_code, specimen_type, bench, send_out, tat_target_routine_hours, tat_target_stat_hours, min_retest_days) VALUES
  ('CMP', 'Comprehensive Metabolic Panel', '24323-8', 'Serum', 'Chemistry', FALSE, 4.0, 1.0, NULL),
  ('CBC', 'Complete Blood Count', '58410-2', 'Whole Blood', 'Hematology', FALSE, 4.0, 1.0, NULL),
  ('A1C', 'Hemoglobin A1c', '4548-4', 'Whole Blood', 'Chemistry', FALSE, 24.0, 4.0, 90),
  ('TSH', 'Thyroid Stimulating Hormone', '3016-3', 'Serum', 'Chemistry', FALSE, 24.0, 4.0, NULL),
  ('UCX', 'Urine Culture', '630-4', 'Urine', 'Microbiology', FALSE, 72.0, 48.0, NULL),
  ('SARS', 'SARS-CoV-2 RNA PCR', '94500-6', 'Swab', 'Molecular', FALSE, 24.0, 2.0, NULL),
  ('VITD', '25-Hydroxyvitamin D', '62292-8', 'Serum', 'Send-out', TRUE, 120.0, 72.0, 90);

INSERT INTO main.diagnostics_labs.components (component_code, component_name, loinc_code, units, critical_low, critical_high) VALUES
  ('GLU', 'Glucose', '2345-7', 'mg/dL', 40.0, 450.0),
  ('K', 'Potassium', '2823-3', 'mmol/L', 2.8, 6.2),
  ('CREAT', 'Creatinine', '2160-0', 'mg/dL', NULL, NULL),
  ('WBC', 'White Blood Cell Count', '6690-2', '10*3/uL', 2.0, 30.0),
  ('HGB', 'Hemoglobin', '718-7', 'g/dL', 7.0, 20.0),
  ('PLT', 'Platelet Count', '777-3', '10*3/uL', 20.0, 1000.0),
  ('A1C', 'Hemoglobin A1c', '4548-4', '%', NULL, NULL),
  ('TSH', 'Thyrotropin', '3016-3', 'mIU/L', NULL, NULL),
  ('UCX', 'Urine Culture', '630-4', NULL, NULL, NULL),
  ('SARS', 'SARS-CoV-2 RNA', '94500-6', NULL, NULL, NULL),
  ('VITD', '25-Hydroxyvitamin D', '62292-8', 'ng/mL', NULL, NULL);

INSERT INTO main.diagnostics_labs.test_components (test_code, component_code) VALUES
  ('CMP', 'GLU'),
  ('CMP', 'K'),
  ('CMP', 'CREAT'),
  ('CBC', 'WBC'),
  ('CBC', 'HGB'),
  ('CBC', 'PLT'),
  ('A1C', 'A1C'),
  ('TSH', 'TSH'),
  ('UCX', 'UCX'),
  ('SARS', 'SARS'),
  ('VITD', 'VITD');

INSERT INTO main.diagnostics_labs.providers (provider_id, provider_name, specialty) VALUES
  ('P01', 'Provider 01', 'Internal Medicine'),
  ('P02', 'Provider 02', 'Emergency Medicine'),
  ('P03', 'Provider 03', 'Family Medicine'),
  ('P04', 'Provider 04', 'Endocrinology');

INSERT INTO main.diagnostics_labs.instruments (instrument_id, instrument_name, instrument_type, bench) VALUES
  ('I-CHEM1', 'Chemistry Analyzer 1', 'Chemistry Analyzer', 'Chemistry'),
  ('I-CHEM2', 'Chemistry Analyzer 2', 'Chemistry Analyzer', 'Chemistry'),
  ('I-HEME1', 'Hematology Analyzer 1', 'Hematology Analyzer', 'Hematology'),
  ('I-MICRO1', 'Microbiology ID System 1', 'Microbiology ID System', 'Microbiology'),
  ('I-MOL1', 'PCR System 1', 'PCR System', 'Molecular');

INSERT INTO main.diagnostics_labs.accessions (accession_id, specimen_type, collected_ts, received_ts, accessioned_ts) VALUES
  ('A001', 'Serum', TIMESTAMP'2026-10-01 07:00:00', TIMESTAMP'2026-10-01 08:00:00', TIMESTAMP'2026-10-01 08:10:00'),
  ('A002', 'Whole Blood', TIMESTAMP'2026-10-01 06:30:00', TIMESTAMP'2026-10-01 07:00:00', TIMESTAMP'2026-10-01 07:05:00'),
  ('A003', 'Whole Blood', TIMESTAMP'2026-10-02 09:00:00', TIMESTAMP'2026-10-02 10:00:00', TIMESTAMP'2026-10-02 10:20:00'),
  ('A004', 'Serum', TIMESTAMP'2026-10-02 08:30:00', TIMESTAMP'2026-10-02 09:30:00', TIMESTAMP'2026-10-02 09:40:00'),
  ('A005', 'Urine', TIMESTAMP'2026-10-03 08:00:00', TIMESTAMP'2026-10-03 08:45:00', TIMESTAMP'2026-10-03 09:00:00'),
  ('A006', 'Swab', TIMESTAMP'2026-10-04 14:00:00', TIMESTAMP'2026-10-04 14:30:00', TIMESTAMP'2026-10-04 14:35:00'),
  ('A007', 'Serum', TIMESTAMP'2026-10-06 07:00:00', TIMESTAMP'2026-10-06 08:00:00', TIMESTAMP'2026-10-06 08:15:00'),
  ('A008', 'Whole Blood', TIMESTAMP'2026-10-10 09:00:00', TIMESTAMP'2026-10-10 10:00:00', TIMESTAMP'2026-10-10 10:10:00'),
  ('A009', 'Serum', TIMESTAMP'2026-11-03 02:00:00', TIMESTAMP'2026-11-03 02:30:00', TIMESTAMP'2026-11-03 02:40:00'),
  ('A010', 'Serum', TIMESTAMP'2026-11-04 09:00:00', TIMESTAMP'2026-11-04 10:00:00', TIMESTAMP'2026-11-04 10:30:00'),
  ('A011', 'Swab', TIMESTAMP'2026-11-05 09:30:00', TIMESTAMP'2026-11-05 10:30:00', TIMESTAMP'2026-11-05 10:40:00'),
  ('A012', 'Whole Blood', TIMESTAMP'2026-11-06 06:00:00', TIMESTAMP'2026-11-06 06:45:00', TIMESTAMP'2026-11-06 06:50:00'),
  ('A013', 'Serum', TIMESTAMP'2026-11-08 08:00:00', TIMESTAMP'2026-11-08 09:00:00', TIMESTAMP'2026-11-08 09:10:00');

INSERT INTO main.diagnostics_labs.orders (order_id, patient_id, provider_id, test_code, accession_id, priority, patient_class, ordered_ts, order_status) VALUES
  ('O001', 'PT01', 'P01', 'CMP', 'A001', 'Routine', 'Outpatient', TIMESTAMP'2026-10-01 06:40:00', 'Resulted'),
  ('O002', 'PT01', 'P01', 'TSH', 'A001', 'Routine', 'Outpatient', TIMESTAMP'2026-10-01 06:40:00', 'Resulted'),
  ('O003', 'PT02', 'P02', 'CBC', 'A002', 'STAT', 'Emergency', TIMESTAMP'2026-10-01 06:20:00', 'Resulted'),
  ('O004', 'PT03', 'P04', 'A1C', 'A003', 'Routine', 'Outpatient', TIMESTAMP'2026-10-02 08:30:00', 'Resulted'),
  ('O005', 'PT04', 'P03', 'CMP', 'A004', 'Routine', 'Outpatient', TIMESTAMP'2026-10-02 08:00:00', 'Rejected'),
  ('O006', 'PT05', 'P03', 'UCX', 'A005', 'Routine', 'Outpatient', TIMESTAMP'2026-10-03 07:30:00', 'Resulted'),
  ('O007', 'PT06', 'P02', 'SARS', 'A006', 'STAT', 'Emergency', TIMESTAMP'2026-10-04 13:45:00', 'Resulted'),
  ('O008', 'PT07', 'P04', 'TSH', 'A007', 'Routine', 'Outpatient', TIMESTAMP'2026-10-06 06:30:00', 'Not Reportable'),
  ('O009', 'PT07', 'P04', 'CMP', 'A007', 'Routine', 'Outpatient', TIMESTAMP'2026-10-06 06:30:00', 'Resulted'),
  ('O010', 'PT03', 'P04', 'A1C', 'A008', 'Routine', 'Outpatient', TIMESTAMP'2026-10-10 08:30:00', 'Resulted'),
  ('O011', 'PT08', 'P02', 'CMP', 'A009', 'STAT', 'Emergency', TIMESTAMP'2026-11-03 01:45:00', 'Resulted'),
  ('O012', 'PT01', 'P01', 'VITD', 'A010', 'Routine', 'Outpatient', TIMESTAMP'2026-11-04 08:30:00', 'Resulted'),
  ('O013', 'PT09', 'P03', 'SARS', 'A011', 'Routine', 'Outpatient', TIMESTAMP'2026-11-05 09:00:00', 'In Process'),
  ('O014', 'PT10', 'P01', 'CBC', 'A012', 'Routine', 'Inpatient', TIMESTAMP'2026-11-06 05:30:00', 'Rejected'),
  ('O015', 'PT11', 'P03', 'CMP', NULL, 'Routine', 'Outpatient', TIMESTAMP'2026-11-07 10:00:00', 'Cancelled'),
  ('O016', 'PT07', 'P04', 'TSH', 'A013', 'Routine', 'Outpatient', TIMESTAMP'2026-11-08 07:30:00', 'Resulted');

INSERT INTO main.diagnostics_labs.exception_types (exception_type, exception_category, stage, outcome_if_unresolved) VALUES
  ('Hemolyzed Specimen', 'Specimen Integrity', 'Specimen Receipt', 'Rejected'),
  ('Insufficient Quantity', 'Specimen Integrity', 'Specimen Receipt', 'Rejected'),
  ('Specimen Outside Stability Window', 'Specimen Integrity', 'Manual Review', 'Rejected'),
  ('Mislabeled Specimen', 'Labeling and Identity', 'Specimen Receipt', 'Rejected'),
  ('Patient Identity Not Confirmed', 'Labeling and Identity', 'Manual Review', 'Rejected'),
  ('Barcode Unreadable', 'Labeling and Identity', 'Automated Accessioning', NULL),
  ('Requisition Missing', 'Order and Patient Info', 'Manual Review', NULL),
  ('Duplicate Order', 'Order and Patient Info', 'Manual Review', NULL),
  ('Manual Handling Required', 'Workflow', 'Manual Review', NULL),
  ('QC Failure', 'Analytical', 'Testing', 'Not Reportable');

INSERT INTO main.diagnostics_labs.accession_exceptions (exception_id, accession_id, order_id, exception_type, detected_ts, resolution_status, resolved_ts) VALUES
  ('E01', 'A004', NULL, 'Hemolyzed Specimen', TIMESTAMP'2026-10-02 09:45:00', 'Unresolved', NULL),
  ('E02', 'A005', NULL, 'Requisition Missing', TIMESTAMP'2026-10-03 09:00:00', 'Resolved', TIMESTAMP'2026-10-03 15:00:00'),
  ('E03', 'A007', 'O008', 'QC Failure', TIMESTAMP'2026-10-06 11:00:00', 'Unresolved', NULL),
  ('E04', 'A007', NULL, 'Barcode Unreadable', TIMESTAMP'2026-10-06 08:20:00', 'Resolved', TIMESTAMP'2026-10-06 09:20:00'),
  ('E05', 'A009', NULL, 'Mislabeled Specimen', TIMESTAMP'2026-11-03 02:45:00', 'Resolved', TIMESTAMP'2026-11-03 03:15:00'),
  ('E06', 'A012', NULL, 'Insufficient Quantity', TIMESTAMP'2026-11-06 06:55:00', 'Unresolved', NULL),
  ('E07', 'A012', 'O014', 'Duplicate Order', TIMESTAMP'2026-11-06 07:00:00', 'Resolved', TIMESTAMP'2026-11-06 07:30:00');

INSERT INTO main.diagnostics_labs.results (result_id, order_id, component_code, instrument_id, value_numeric, value_text, units, reference_low, reference_high, reference_text, abnormal_flag, verified_ts, autoverified, critical_notified_ts, corrected_ts) VALUES
  ('R001', 'O001', 'GLU', 'I-CHEM1', 105.0, NULL, 'mg/dL', 70.0, 99.0, NULL, 'H', TIMESTAMP'2026-10-01 10:30:00', FALSE, NULL, NULL),
  ('R002', 'O001', 'K', 'I-CHEM1', 4.2, NULL, 'mmol/L', 3.5, 5.1, NULL, 'N', TIMESTAMP'2026-10-01 10:30:00', TRUE, NULL, NULL),
  ('R003', 'O001', 'CREAT', 'I-CHEM1', 1.0, NULL, 'mg/dL', 0.6, 1.3, NULL, 'N', TIMESTAMP'2026-10-01 11:00:00', TRUE, NULL, NULL),
  ('R004', 'O002', 'TSH', 'I-CHEM2', 2.1, NULL, 'mIU/L', 0.4, 4.0, NULL, 'N', TIMESTAMP'2026-10-01 12:00:00', TRUE, NULL, NULL),
  ('R005', 'O003', 'WBC', 'I-HEME1', 12.5, NULL, '10*3/uL', 4.0, 11.0, NULL, 'H', TIMESTAMP'2026-10-01 07:45:00', FALSE, NULL, NULL),
  ('R006', 'O003', 'HGB', 'I-HEME1', 6.5, NULL, 'g/dL', 12.0, 17.5, NULL, 'LL', TIMESTAMP'2026-10-01 07:45:00', FALSE, TIMESTAMP'2026-10-01 07:55:00', NULL),
  ('R007', 'O003', 'PLT', 'I-HEME1', 250.0, NULL, '10*3/uL', 150.0, 400.0, NULL, 'N', TIMESTAMP'2026-10-01 07:45:00', TRUE, NULL, NULL),
  ('R008', 'O004', 'A1C', 'I-CHEM1', 7.2, NULL, '%', 4.0, 5.6, NULL, 'H', TIMESTAMP'2026-10-03 08:00:00', FALSE, NULL, TIMESTAMP'2026-10-03 10:00:00'),
  ('R009', 'O006', 'UCX', 'I-MICRO1', NULL, '>100,000 CFU/mL Escherichia coli', NULL, NULL, NULL, 'No growth', 'A', TIMESTAMP'2026-10-05 10:45:00', FALSE, NULL, NULL),
  ('R010', 'O007', 'SARS', 'I-MOL1', NULL, 'Not Detected', NULL, NULL, NULL, 'Not Detected', 'N', TIMESTAMP'2026-10-04 16:00:00', TRUE, NULL, NULL),
  ('R011', 'O009', 'GLU', 'I-CHEM2', 88.0, NULL, 'mg/dL', 70.0, 99.0, NULL, 'N', TIMESTAMP'2026-10-06 13:00:00', TRUE, NULL, NULL),
  ('R012', 'O009', 'K', 'I-CHEM2', 3.3, NULL, 'mmol/L', 3.5, 5.1, NULL, 'L', TIMESTAMP'2026-10-06 13:00:00', FALSE, NULL, NULL),
  ('R013', 'O009', 'CREAT', 'I-CHEM2', 1.4, NULL, 'mg/dL', 0.6, 1.3, NULL, 'H', TIMESTAMP'2026-10-06 13:00:00', FALSE, NULL, TIMESTAMP'2026-10-07 09:00:00'),
  ('R014', 'O010', 'A1C', 'I-CHEM1', 6.9, NULL, '%', 4.0, 5.6, NULL, 'H', TIMESTAMP'2026-10-10 20:00:00', FALSE, NULL, NULL),
  ('R015', 'O011', 'GLU', 'I-CHEM1', 32.0, NULL, 'mg/dL', 70.0, 99.0, NULL, 'LL', TIMESTAMP'2026-11-03 04:00:00', FALSE, TIMESTAMP'2026-11-03 04:45:00', NULL),
  ('R016', 'O011', 'K', 'I-CHEM1', 6.5, NULL, 'mmol/L', 3.5, 5.1, NULL, 'HH', TIMESTAMP'2026-11-03 04:00:00', FALSE, TIMESTAMP'2026-11-03 04:20:00', NULL),
  ('R017', 'O011', 'CREAT', 'I-CHEM1', 1.1, NULL, 'mg/dL', 0.6, 1.3, NULL, 'N', TIMESTAMP'2026-11-03 04:00:00', TRUE, NULL, NULL),
  ('R018', 'O012', 'VITD', NULL, 22.0, NULL, 'ng/mL', 30.0, 100.0, NULL, 'L', TIMESTAMP'2026-11-08 10:00:00', FALSE, NULL, NULL),
  ('R019', 'O016', 'TSH', 'I-CHEM2', 5.6, NULL, 'mIU/L', 0.4, 4.0, NULL, 'H', TIMESTAMP'2026-11-08 13:00:00', FALSE, NULL, NULL);

INSERT INTO main.diagnostics_labs.qc_runs (qc_run_id, instrument_id, component_code, control_lot, control_level, run_ts, observed_value, target_mean, target_sd, westgard_rule, qc_status) VALUES
  ('Q01', 'I-CHEM1', 'GLU', 'LOT-G1', 'Level 1', TIMESTAMP'2026-10-01 06:00:00', 101.0, 100.0, 2.0, NULL, 'Accepted'),
  ('Q02', 'I-CHEM1', 'GLU', 'LOT-G1', 'Level 1', TIMESTAMP'2026-10-02 06:00:00', 104.5, 100.0, 2.0, '1-2s', 'Warning'),
  ('Q03', 'I-CHEM1', 'GLU', 'LOT-G1', 'Level 1', TIMESTAMP'2026-10-03 06:00:00', 104.4, 100.0, 2.0, '2-2s', 'Rejected'),
  ('Q04', 'I-CHEM1', 'GLU', 'LOT-G1', 'Level 1', TIMESTAMP'2026-10-04 06:00:00', 99.0, 100.0, 2.0, NULL, 'Accepted'),
  ('Q05', 'I-CHEM1', 'K', 'LOT-K1', 'Level 1', TIMESTAMP'2026-10-01 06:05:00', 4.05, 4.0, 0.1, NULL, 'Accepted'),
  ('Q06', 'I-CHEM1', 'K', 'LOT-K1', 'Level 1', TIMESTAMP'2026-10-02 06:05:00', 3.65, 4.0, 0.1, '1-3s', 'Rejected'),
  ('Q07', 'I-CHEM1', 'K', 'LOT-K1', 'Level 1', TIMESTAMP'2026-10-03 06:05:00', 3.98, 4.0, 0.1, NULL, 'Accepted'),
  ('Q08', 'I-HEME1', 'HGB', 'LOT-H2', 'Level 2', TIMESTAMP'2026-10-01 06:10:00', 13.1, 13.0, 0.2, NULL, 'Accepted'),
  ('Q09', 'I-HEME1', 'HGB', 'LOT-H2', 'Level 2', TIMESTAMP'2026-10-02 06:10:00', 12.9, 13.0, 0.2, NULL, 'Accepted'),
  ('Q10', 'I-HEME1', 'HGB', 'LOT-H2', 'Level 2', TIMESTAMP'2026-11-03 06:10:00', 13.45, 13.0, 0.2, '1-2s', 'Warning'),
  ('Q11', 'I-HEME1', 'HGB', 'LOT-H2', 'Level 2', TIMESTAMP'2026-11-04 06:10:00', 12.7, 13.0, 0.2, NULL, 'Accepted'),
  ('Q12', 'I-CHEM2', 'TSH', 'LOT-T1', 'Level 1', TIMESTAMP'2026-10-06 10:30:00', 2.35, 2.0, 0.1, '1-3s', 'Rejected'),
  ('Q13', 'I-CHEM2', 'TSH', 'LOT-T1', 'Level 1', TIMESTAMP'2026-10-06 12:00:00', 2.05, 2.0, 0.1, NULL, 'Accepted');
