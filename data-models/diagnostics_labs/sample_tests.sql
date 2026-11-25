SELECT 'order_metrics: Orders' AS check_name, IF(bad = 0, 'PASS', raise_error(CONCAT('order_metrics: Orders: ', bad, ' rows differ from expected'))) AS result
FROM (
  SELECT COUNT(*) AS bad
  FROM (SELECT 'all' AS k, CAST(MEASURE(`Orders`) AS DOUBLE) AS v FROM main.diagnostics_labs.order_metrics) a
  FULL OUTER JOIN (VALUES
    ('all', 16.0)) AS e(k, v) ON a.k = e.k
  WHERE a.k IS NULL OR e.k IS NULL OR NOT (a.v <=> e.v OR ABS(a.v - e.v) < 1e-9)
);

SELECT 'order_metrics: Resulted Orders' AS check_name, IF(bad = 0, 'PASS', raise_error(CONCAT('order_metrics: Resulted Orders: ', bad, ' rows differ from expected'))) AS result
FROM (
  SELECT COUNT(*) AS bad
  FROM (SELECT 'all' AS k, CAST(MEASURE(`Resulted Orders`) AS DOUBLE) AS v FROM main.diagnostics_labs.order_metrics) a
  FULL OUTER JOIN (VALUES
    ('all', 11.0)) AS e(k, v) ON a.k = e.k
  WHERE a.k IS NULL OR e.k IS NULL OR NOT (a.v <=> e.v OR ABS(a.v - e.v) < 1e-9)
);

SELECT 'order_metrics: Open Orders' AS check_name, IF(bad = 0, 'PASS', raise_error(CONCAT('order_metrics: Open Orders: ', bad, ' rows differ from expected'))) AS result
FROM (
  SELECT COUNT(*) AS bad
  FROM (SELECT 'all' AS k, CAST(MEASURE(`Open Orders`) AS DOUBLE) AS v FROM main.diagnostics_labs.order_metrics) a
  FULL OUTER JOIN (VALUES
    ('all', 1.0)) AS e(k, v) ON a.k = e.k
  WHERE a.k IS NULL OR e.k IS NULL OR NOT (a.v <=> e.v OR ABS(a.v - e.v) < 1e-9)
);

SELECT 'order_metrics: Cancelled Orders' AS check_name, IF(bad = 0, 'PASS', raise_error(CONCAT('order_metrics: Cancelled Orders: ', bad, ' rows differ from expected'))) AS result
FROM (
  SELECT COUNT(*) AS bad
  FROM (SELECT 'all' AS k, CAST(MEASURE(`Cancelled Orders`) AS DOUBLE) AS v FROM main.diagnostics_labs.order_metrics) a
  FULL OUTER JOIN (VALUES
    ('all', 1.0)) AS e(k, v) ON a.k = e.k
  WHERE a.k IS NULL OR e.k IS NULL OR NOT (a.v <=> e.v OR ABS(a.v - e.v) < 1e-9)
);

SELECT 'order_metrics: Completed Orders' AS check_name, IF(bad = 0, 'PASS', raise_error(CONCAT('order_metrics: Completed Orders: ', bad, ' rows differ from expected'))) AS result
FROM (
  SELECT COUNT(*) AS bad
  FROM (SELECT 'all' AS k, CAST(MEASURE(`Completed Orders`) AS DOUBLE) AS v FROM main.diagnostics_labs.order_metrics) a
  FULL OUTER JOIN (VALUES
    ('all', 14.0)) AS e(k, v) ON a.k = e.k
  WHERE a.k IS NULL OR e.k IS NULL OR NOT (a.v <=> e.v OR ABS(a.v - e.v) < 1e-9)
);

SELECT 'order_metrics: Rejected Orders' AS check_name, IF(bad = 0, 'PASS', raise_error(CONCAT('order_metrics: Rejected Orders: ', bad, ' rows differ from expected'))) AS result
FROM (
  SELECT COUNT(*) AS bad
  FROM (SELECT 'all' AS k, CAST(MEASURE(`Rejected Orders`) AS DOUBLE) AS v FROM main.diagnostics_labs.order_metrics) a
  FULL OUTER JOIN (VALUES
    ('all', 2.0)) AS e(k, v) ON a.k = e.k
  WHERE a.k IS NULL OR e.k IS NULL OR NOT (a.v <=> e.v OR ABS(a.v - e.v) < 1e-9)
);

SELECT 'order_metrics: Order Rejection Rate' AS check_name, IF(bad = 0, 'PASS', raise_error(CONCAT('order_metrics: Order Rejection Rate: ', bad, ' rows differ from expected'))) AS result
FROM (
  SELECT COUNT(*) AS bad
  FROM (SELECT 'all' AS k, CAST(MEASURE(`Order Rejection Rate`) AS DOUBLE) AS v FROM main.diagnostics_labs.order_metrics) a
  FULL OUTER JOIN (VALUES
    ('all', 0.14285714285714285)) AS e(k, v) ON a.k = e.k
  WHERE a.k IS NULL OR e.k IS NULL OR NOT (a.v <=> e.v OR ABS(a.v - e.v) < 1e-9)
);

SELECT 'order_metrics: Not Reportable Orders' AS check_name, IF(bad = 0, 'PASS', raise_error(CONCAT('order_metrics: Not Reportable Orders: ', bad, ' rows differ from expected'))) AS result
FROM (
  SELECT COUNT(*) AS bad
  FROM (SELECT 'all' AS k, CAST(MEASURE(`Not Reportable Orders`) AS DOUBLE) AS v FROM main.diagnostics_labs.order_metrics) a
  FULL OUTER JOIN (VALUES
    ('all', 1.0)) AS e(k, v) ON a.k = e.k
  WHERE a.k IS NULL OR e.k IS NULL OR NOT (a.v <=> e.v OR ABS(a.v - e.v) < 1e-9)
);

SELECT 'order_metrics: Not Reportable Rate' AS check_name, IF(bad = 0, 'PASS', raise_error(CONCAT('order_metrics: Not Reportable Rate: ', bad, ' rows differ from expected'))) AS result
FROM (
  SELECT COUNT(*) AS bad
  FROM (SELECT 'all' AS k, CAST(MEASURE(`Not Reportable Rate`) AS DOUBLE) AS v FROM main.diagnostics_labs.order_metrics) a
  FULL OUTER JOIN (VALUES
    ('all', 0.07142857142857142)) AS e(k, v) ON a.k = e.k
  WHERE a.k IS NULL OR e.k IS NULL OR NOT (a.v <=> e.v OR ABS(a.v - e.v) < 1e-9)
);

SELECT 'order_metrics: Avg Receipt-to-Verify Hours' AS check_name, IF(bad = 0, 'PASS', raise_error(CONCAT('order_metrics: Avg Receipt-to-Verify Hours: ', bad, ' rows differ from expected'))) AS result
FROM (
  SELECT COUNT(*) AS bad
  FROM (SELECT 'all' AS k, CAST(MEASURE(`Avg Receipt-to-Verify Hours`) AS DOUBLE) AS v FROM main.diagnostics_labs.order_metrics) a
  FULL OUTER JOIN (VALUES
    ('all', 17.977272727272727)) AS e(k, v) ON a.k = e.k
  WHERE a.k IS NULL OR e.k IS NULL OR NOT (a.v <=> e.v OR ABS(a.v - e.v) < 1e-9)
);

SELECT 'order_metrics: Median Receipt-to-Verify Hours' AS check_name, IF(bad = 0, 'PASS', raise_error(CONCAT('order_metrics: Median Receipt-to-Verify Hours: ', bad, ' rows differ from expected'))) AS result
FROM (
  SELECT COUNT(*) AS bad
  FROM (SELECT 'all' AS k, CAST(MEASURE(`Median Receipt-to-Verify Hours`) AS DOUBLE) AS v FROM main.diagnostics_labs.order_metrics) a
  FULL OUTER JOIN (VALUES
    ('all', 4.0)) AS e(k, v) ON a.k = e.k
  WHERE a.k IS NULL OR e.k IS NULL OR NOT (a.v <=> e.v OR ABS(a.v - e.v) < 1e-9)
);

SELECT 'order_metrics: P90 Receipt-to-Verify Hours' AS check_name, IF(bad = 0, 'PASS', raise_error(CONCAT('order_metrics: P90 Receipt-to-Verify Hours: ', bad, ' rows differ from expected'))) AS result
FROM (
  SELECT COUNT(*) AS bad
  FROM (SELECT 'all' AS k, CAST(MEASURE(`P90 Receipt-to-Verify Hours`) AS DOUBLE) AS v FROM main.diagnostics_labs.order_metrics) a
  FULL OUTER JOIN (VALUES
    ('all', 50.0)) AS e(k, v) ON a.k = e.k
  WHERE a.k IS NULL OR e.k IS NULL OR NOT (a.v <=> e.v OR ABS(a.v - e.v) < 1e-9)
);

SELECT 'order_metrics: Avg Collect-to-Verify Hours' AS check_name, IF(bad = 0, 'PASS', raise_error(CONCAT('order_metrics: Avg Collect-to-Verify Hours: ', bad, ' rows differ from expected'))) AS result
FROM (
  SELECT COUNT(*) AS bad
  FROM (SELECT 'all' AS k, CAST(MEASURE(`Avg Collect-to-Verify Hours`) AS DOUBLE) AS v FROM main.diagnostics_labs.order_metrics) a
  FULL OUTER JOIN (VALUES
    ('all', 18.818181818181817)) AS e(k, v) ON a.k = e.k
  WHERE a.k IS NULL OR e.k IS NULL OR NOT (a.v <=> e.v OR ABS(a.v - e.v) < 1e-9)
);

SELECT 'order_metrics: Median Collect-to-Verify Hours' AS check_name, IF(bad = 0, 'PASS', raise_error(CONCAT('order_metrics: Median Collect-to-Verify Hours: ', bad, ' rows differ from expected'))) AS result
FROM (
  SELECT COUNT(*) AS bad
  FROM (SELECT 'all' AS k, CAST(MEASURE(`Median Collect-to-Verify Hours`) AS DOUBLE) AS v FROM main.diagnostics_labs.order_metrics) a
  FULL OUTER JOIN (VALUES
    ('all', 5.0)) AS e(k, v) ON a.k = e.k
  WHERE a.k IS NULL OR e.k IS NULL OR NOT (a.v <=> e.v OR ABS(a.v - e.v) < 1e-9)
);

SELECT 'order_metrics: Within Target Rate' AS check_name, IF(bad = 0, 'PASS', raise_error(CONCAT('order_metrics: Within Target Rate: ', bad, ' rows differ from expected'))) AS result
FROM (
  SELECT COUNT(*) AS bad
  FROM (SELECT 'all' AS k, CAST(MEASURE(`Within Target Rate`) AS DOUBLE) AS v FROM main.diagnostics_labs.order_metrics) a
  FULL OUTER JOIN (VALUES
    ('all', 0.8181818181818182)) AS e(k, v) ON a.k = e.k
  WHERE a.k IS NULL OR e.k IS NULL OR NOT (a.v <=> e.v OR ABS(a.v - e.v) < 1e-9)
);

SELECT 'order_metrics: STAT Within Target Rate' AS check_name, IF(bad = 0, 'PASS', raise_error(CONCAT('order_metrics: STAT Within Target Rate: ', bad, ' rows differ from expected'))) AS result
FROM (
  SELECT COUNT(*) AS bad
  FROM (SELECT 'all' AS k, CAST(MEASURE(`STAT Within Target Rate`) AS DOUBLE) AS v FROM main.diagnostics_labs.order_metrics) a
  FULL OUTER JOIN (VALUES
    ('all', 0.6666666666666666)) AS e(k, v) ON a.k = e.k
  WHERE a.k IS NULL OR e.k IS NULL OR NOT (a.v <=> e.v OR ABS(a.v - e.v) < 1e-9)
);

SELECT 'order_metrics: Straight-Through Turnaround Hours' AS check_name, IF(bad = 0, 'PASS', raise_error(CONCAT('order_metrics: Straight-Through Turnaround Hours: ', bad, ' rows differ from expected'))) AS result
FROM (
  SELECT COUNT(*) AS bad
  FROM (SELECT 'all' AS k, CAST(MEASURE(`Straight-Through Turnaround Hours`) AS DOUBLE) AS v FROM main.diagnostics_labs.order_metrics) a
  FULL OUTER JOIN (VALUES
    ('all', 17.65625)) AS e(k, v) ON a.k = e.k
  WHERE a.k IS NULL OR e.k IS NULL OR NOT (a.v <=> e.v OR ABS(a.v - e.v) < 1e-9)
);

SELECT 'order_metrics: Send-out Orders' AS check_name, IF(bad = 0, 'PASS', raise_error(CONCAT('order_metrics: Send-out Orders: ', bad, ' rows differ from expected'))) AS result
FROM (
  SELECT COUNT(*) AS bad
  FROM (SELECT 'all' AS k, CAST(MEASURE(`Send-out Orders`) AS DOUBLE) AS v FROM main.diagnostics_labs.order_metrics) a
  FULL OUTER JOIN (VALUES
    ('all', 1.0)) AS e(k, v) ON a.k = e.k
  WHERE a.k IS NULL OR e.k IS NULL OR NOT (a.v <=> e.v OR ABS(a.v - e.v) < 1e-9)
);

SELECT 'order_metrics: Send-out Rate' AS check_name, IF(bad = 0, 'PASS', raise_error(CONCAT('order_metrics: Send-out Rate: ', bad, ' rows differ from expected'))) AS result
FROM (
  SELECT COUNT(*) AS bad
  FROM (SELECT 'all' AS k, CAST(MEASURE(`Send-out Rate`) AS DOUBLE) AS v FROM main.diagnostics_labs.order_metrics) a
  FULL OUTER JOIN (VALUES
    ('all', 0.0625)) AS e(k, v) ON a.k = e.k
  WHERE a.k IS NULL OR e.k IS NULL OR NOT (a.v <=> e.v OR ABS(a.v - e.v) < 1e-9)
);

SELECT 'order_metrics: Early Repeat Orders' AS check_name, IF(bad = 0, 'PASS', raise_error(CONCAT('order_metrics: Early Repeat Orders: ', bad, ' rows differ from expected'))) AS result
FROM (
  SELECT COUNT(*) AS bad
  FROM (SELECT 'all' AS k, CAST(MEASURE(`Early Repeat Orders`) AS DOUBLE) AS v FROM main.diagnostics_labs.order_metrics) a
  FULL OUTER JOIN (VALUES
    ('all', 1.0)) AS e(k, v) ON a.k = e.k
  WHERE a.k IS NULL OR e.k IS NULL OR NOT (a.v <=> e.v OR ABS(a.v - e.v) < 1e-9)
);

SELECT 'order_metrics: Early Repeat Rate' AS check_name, IF(bad = 0, 'PASS', raise_error(CONCAT('order_metrics: Early Repeat Rate: ', bad, ' rows differ from expected'))) AS result
FROM (
  SELECT COUNT(*) AS bad
  FROM (SELECT 'all' AS k, CAST(MEASURE(`Early Repeat Rate`) AS DOUBLE) AS v FROM main.diagnostics_labs.order_metrics) a
  FULL OUTER JOIN (VALUES
    ('all', 0.0625)) AS e(k, v) ON a.k = e.k
  WHERE a.k IS NULL OR e.k IS NULL OR NOT (a.v <=> e.v OR ABS(a.v - e.v) < 1e-9)
);

SELECT 'accession_metrics: Accession Volume' AS check_name, IF(bad = 0, 'PASS', raise_error(CONCAT('accession_metrics: Accession Volume: ', bad, ' rows differ from expected'))) AS result
FROM (
  SELECT COUNT(*) AS bad
  FROM (SELECT 'all' AS k, CAST(MEASURE(`Accession Volume`) AS DOUBLE) AS v FROM main.diagnostics_labs.accession_metrics) a
  FULL OUTER JOIN (VALUES
    ('all', 13.0)) AS e(k, v) ON a.k = e.k
  WHERE a.k IS NULL OR e.k IS NULL OR NOT (a.v <=> e.v OR ABS(a.v - e.v) < 1e-9)
);

SELECT 'accession_metrics: Ordered Tests per Accession' AS check_name, IF(bad = 0, 'PASS', raise_error(CONCAT('accession_metrics: Ordered Tests per Accession: ', bad, ' rows differ from expected'))) AS result
FROM (
  SELECT COUNT(*) AS bad
  FROM (SELECT 'all' AS k, CAST(MEASURE(`Ordered Tests per Accession`) AS DOUBLE) AS v FROM main.diagnostics_labs.accession_metrics) a
  FULL OUTER JOIN (VALUES
    ('all', 1.1538461538461537)) AS e(k, v) ON a.k = e.k
  WHERE a.k IS NULL OR e.k IS NULL OR NOT (a.v <=> e.v OR ABS(a.v - e.v) < 1e-9)
);

SELECT 'accession_metrics: Accessions with Exception' AS check_name, IF(bad = 0, 'PASS', raise_error(CONCAT('accession_metrics: Accessions with Exception: ', bad, ' rows differ from expected'))) AS result
FROM (
  SELECT COUNT(*) AS bad
  FROM (SELECT 'all' AS k, CAST(MEASURE(`Accessions with Exception`) AS DOUBLE) AS v FROM main.diagnostics_labs.accession_metrics) a
  FULL OUTER JOIN (VALUES
    ('all', 5.0)) AS e(k, v) ON a.k = e.k
  WHERE a.k IS NULL OR e.k IS NULL OR NOT (a.v <=> e.v OR ABS(a.v - e.v) < 1e-9)
);

SELECT 'accession_metrics: Exception Volume' AS check_name, IF(bad = 0, 'PASS', raise_error(CONCAT('accession_metrics: Exception Volume: ', bad, ' rows differ from expected'))) AS result
FROM (
  SELECT COUNT(*) AS bad
  FROM (SELECT 'all' AS k, CAST(MEASURE(`Exception Volume`) AS DOUBLE) AS v FROM main.diagnostics_labs.accession_metrics) a
  FULL OUTER JOIN (VALUES
    ('all', 7.0)) AS e(k, v) ON a.k = e.k
  WHERE a.k IS NULL OR e.k IS NULL OR NOT (a.v <=> e.v OR ABS(a.v - e.v) < 1e-9)
);

SELECT 'accession_metrics: Accession Exception Rate' AS check_name, IF(bad = 0, 'PASS', raise_error(CONCAT('accession_metrics: Accession Exception Rate: ', bad, ' rows differ from expected'))) AS result
FROM (
  SELECT COUNT(*) AS bad
  FROM (SELECT 'all' AS k, CAST(MEASURE(`Accession Exception Rate`) AS DOUBLE) AS v FROM main.diagnostics_labs.accession_metrics) a
  FULL OUTER JOIN (VALUES
    ('all', 0.38461538461538464)) AS e(k, v) ON a.k = e.k
  WHERE a.k IS NULL OR e.k IS NULL OR NOT (a.v <=> e.v OR ABS(a.v - e.v) < 1e-9)
);

SELECT 'accession_metrics: Exceptions per 100 Accessions' AS check_name, IF(bad = 0, 'PASS', raise_error(CONCAT('accession_metrics: Exceptions per 100 Accessions: ', bad, ' rows differ from expected'))) AS result
FROM (
  SELECT COUNT(*) AS bad
  FROM (SELECT 'all' AS k, CAST(MEASURE(`Exceptions per 100 Accessions`) AS DOUBLE) AS v FROM main.diagnostics_labs.accession_metrics) a
  FULL OUTER JOIN (VALUES
    ('all', 53.84615384615385)) AS e(k, v) ON a.k = e.k
  WHERE a.k IS NULL OR e.k IS NULL OR NOT (a.v <=> e.v OR ABS(a.v - e.v) < 1e-9)
);

SELECT 'accession_metrics: Exceptions per Accession with Exception' AS check_name, IF(bad = 0, 'PASS', raise_error(CONCAT('accession_metrics: Exceptions per Accession with Exception: ', bad, ' rows differ from expected'))) AS result
FROM (
  SELECT COUNT(*) AS bad
  FROM (SELECT 'all' AS k, CAST(MEASURE(`Exceptions per Accession with Exception`) AS DOUBLE) AS v FROM main.diagnostics_labs.accession_metrics) a
  FULL OUTER JOIN (VALUES
    ('all', 1.4)) AS e(k, v) ON a.k = e.k
  WHERE a.k IS NULL OR e.k IS NULL OR NOT (a.v <=> e.v OR ABS(a.v - e.v) < 1e-9)
);

SELECT 'accession_metrics: Rejection-Risk Exceptions' AS check_name, IF(bad = 0, 'PASS', raise_error(CONCAT('accession_metrics: Rejection-Risk Exceptions: ', bad, ' rows differ from expected'))) AS result
FROM (
  SELECT COUNT(*) AS bad
  FROM (SELECT 'all' AS k, CAST(MEASURE(`Rejection-Risk Exceptions`) AS DOUBLE) AS v FROM main.diagnostics_labs.accession_metrics) a
  FULL OUTER JOIN (VALUES
    ('all', 3.0)) AS e(k, v) ON a.k = e.k
  WHERE a.k IS NULL OR e.k IS NULL OR NOT (a.v <=> e.v OR ABS(a.v - e.v) < 1e-9)
);

SELECT 'accession_metrics: Rejection-Risk Exceptions per 100 Accessions' AS check_name, IF(bad = 0, 'PASS', raise_error(CONCAT('accession_metrics: Rejection-Risk Exceptions per 100 Accessions: ', bad, ' rows differ from expected'))) AS result
FROM (
  SELECT COUNT(*) AS bad
  FROM (SELECT 'all' AS k, CAST(MEASURE(`Rejection-Risk Exceptions per 100 Accessions`) AS DOUBLE) AS v FROM main.diagnostics_labs.accession_metrics) a
  FULL OUTER JOIN (VALUES
    ('all', 23.076923076923077)) AS e(k, v) ON a.k = e.k
  WHERE a.k IS NULL OR e.k IS NULL OR NOT (a.v <=> e.v OR ABS(a.v - e.v) < 1e-9)
);

SELECT 'accession_metrics: Rejected Specimens' AS check_name, IF(bad = 0, 'PASS', raise_error(CONCAT('accession_metrics: Rejected Specimens: ', bad, ' rows differ from expected'))) AS result
FROM (
  SELECT COUNT(*) AS bad
  FROM (SELECT 'all' AS k, CAST(MEASURE(`Rejected Specimens`) AS DOUBLE) AS v FROM main.diagnostics_labs.accession_metrics) a
  FULL OUTER JOIN (VALUES
    ('all', 2.0)) AS e(k, v) ON a.k = e.k
  WHERE a.k IS NULL OR e.k IS NULL OR NOT (a.v <=> e.v OR ABS(a.v - e.v) < 1e-9)
);

SELECT 'accession_metrics: Specimen Rejection Rate' AS check_name, IF(bad = 0, 'PASS', raise_error(CONCAT('accession_metrics: Specimen Rejection Rate: ', bad, ' rows differ from expected'))) AS result
FROM (
  SELECT COUNT(*) AS bad
  FROM (SELECT 'all' AS k, CAST(MEASURE(`Specimen Rejection Rate`) AS DOUBLE) AS v FROM main.diagnostics_labs.accession_metrics) a
  FULL OUTER JOIN (VALUES
    ('all', 0.15384615384615385)) AS e(k, v) ON a.k = e.k
  WHERE a.k IS NULL OR e.k IS NULL OR NOT (a.v <=> e.v OR ABS(a.v - e.v) < 1e-9)
);

SELECT 'accession_metrics: Avg Collection-to-Receipt Hours' AS check_name, IF(bad = 0, 'PASS', raise_error(CONCAT('accession_metrics: Avg Collection-to-Receipt Hours: ', bad, ' rows differ from expected'))) AS result
FROM (
  SELECT COUNT(*) AS bad
  FROM (SELECT 'all' AS k, CAST(MEASURE(`Avg Collection-to-Receipt Hours`) AS DOUBLE) AS v FROM main.diagnostics_labs.accession_metrics) a
  FULL OUTER JOIN (VALUES
    ('all', 0.8461538461538461)) AS e(k, v) ON a.k = e.k
  WHERE a.k IS NULL OR e.k IS NULL OR NOT (a.v <=> e.v OR ABS(a.v - e.v) < 1e-9)
);

SELECT 'exception_metrics: Exceptions' AS check_name, IF(bad = 0, 'PASS', raise_error(CONCAT('exception_metrics: Exceptions: ', bad, ' rows differ from expected'))) AS result
FROM (
  SELECT COUNT(*) AS bad
  FROM (SELECT 'all' AS k, CAST(MEASURE(`Exceptions`) AS DOUBLE) AS v FROM main.diagnostics_labs.exception_metrics) a
  FULL OUTER JOIN (VALUES
    ('all', 7.0)) AS e(k, v) ON a.k = e.k
  WHERE a.k IS NULL OR e.k IS NULL OR NOT (a.v <=> e.v OR ABS(a.v - e.v) < 1e-9)
);

SELECT 'exception_metrics: Unresolved Exceptions' AS check_name, IF(bad = 0, 'PASS', raise_error(CONCAT('exception_metrics: Unresolved Exceptions: ', bad, ' rows differ from expected'))) AS result
FROM (
  SELECT COUNT(*) AS bad
  FROM (SELECT 'all' AS k, CAST(MEASURE(`Unresolved Exceptions`) AS DOUBLE) AS v FROM main.diagnostics_labs.exception_metrics) a
  FULL OUTER JOIN (VALUES
    ('all', 3.0)) AS e(k, v) ON a.k = e.k
  WHERE a.k IS NULL OR e.k IS NULL OR NOT (a.v <=> e.v OR ABS(a.v - e.v) < 1e-9)
);

SELECT 'exception_metrics: Unresolved Rate' AS check_name, IF(bad = 0, 'PASS', raise_error(CONCAT('exception_metrics: Unresolved Rate: ', bad, ' rows differ from expected'))) AS result
FROM (
  SELECT COUNT(*) AS bad
  FROM (SELECT 'all' AS k, CAST(MEASURE(`Unresolved Rate`) AS DOUBLE) AS v FROM main.diagnostics_labs.exception_metrics) a
  FULL OUTER JOIN (VALUES
    ('all', 0.42857142857142855)) AS e(k, v) ON a.k = e.k
  WHERE a.k IS NULL OR e.k IS NULL OR NOT (a.v <=> e.v OR ABS(a.v - e.v) < 1e-9)
);

SELECT 'exception_metrics: Accessions Affected' AS check_name, IF(bad = 0, 'PASS', raise_error(CONCAT('exception_metrics: Accessions Affected: ', bad, ' rows differ from expected'))) AS result
FROM (
  SELECT COUNT(*) AS bad
  FROM (SELECT 'all' AS k, CAST(MEASURE(`Accessions Affected`) AS DOUBLE) AS v FROM main.diagnostics_labs.exception_metrics) a
  FULL OUTER JOIN (VALUES
    ('all', 5.0)) AS e(k, v) ON a.k = e.k
  WHERE a.k IS NULL OR e.k IS NULL OR NOT (a.v <=> e.v OR ABS(a.v - e.v) < 1e-9)
);

SELECT 'exception_metrics: Avg Hours to Resolve' AS check_name, IF(bad = 0, 'PASS', raise_error(CONCAT('exception_metrics: Avg Hours to Resolve: ', bad, ' rows differ from expected'))) AS result
FROM (
  SELECT COUNT(*) AS bad
  FROM (SELECT 'all' AS k, CAST(MEASURE(`Avg Hours to Resolve`) AS DOUBLE) AS v FROM main.diagnostics_labs.exception_metrics) a
  FULL OUTER JOIN (VALUES
    ('all', 2.0)) AS e(k, v) ON a.k = e.k
  WHERE a.k IS NULL OR e.k IS NULL OR NOT (a.v <=> e.v OR ABS(a.v - e.v) < 1e-9)
);

SELECT 'result_metrics: Results' AS check_name, IF(bad = 0, 'PASS', raise_error(CONCAT('result_metrics: Results: ', bad, ' rows differ from expected'))) AS result
FROM (
  SELECT COUNT(*) AS bad
  FROM (SELECT 'all' AS k, CAST(MEASURE(`Results`) AS DOUBLE) AS v FROM main.diagnostics_labs.result_metrics) a
  FULL OUTER JOIN (VALUES
    ('all', 19.0)) AS e(k, v) ON a.k = e.k
  WHERE a.k IS NULL OR e.k IS NULL OR NOT (a.v <=> e.v OR ABS(a.v - e.v) < 1e-9)
);

SELECT 'result_metrics: Abnormal Results' AS check_name, IF(bad = 0, 'PASS', raise_error(CONCAT('result_metrics: Abnormal Results: ', bad, ' rows differ from expected'))) AS result
FROM (
  SELECT COUNT(*) AS bad
  FROM (SELECT 'all' AS k, CAST(MEASURE(`Abnormal Results`) AS DOUBLE) AS v FROM main.diagnostics_labs.result_metrics) a
  FULL OUTER JOIN (VALUES
    ('all', 12.0)) AS e(k, v) ON a.k = e.k
  WHERE a.k IS NULL OR e.k IS NULL OR NOT (a.v <=> e.v OR ABS(a.v - e.v) < 1e-9)
);

SELECT 'result_metrics: Abnormal Rate' AS check_name, IF(bad = 0, 'PASS', raise_error(CONCAT('result_metrics: Abnormal Rate: ', bad, ' rows differ from expected'))) AS result
FROM (
  SELECT COUNT(*) AS bad
  FROM (SELECT 'all' AS k, CAST(MEASURE(`Abnormal Rate`) AS DOUBLE) AS v FROM main.diagnostics_labs.result_metrics) a
  FULL OUTER JOIN (VALUES
    ('all', 0.631578947368421)) AS e(k, v) ON a.k = e.k
  WHERE a.k IS NULL OR e.k IS NULL OR NOT (a.v <=> e.v OR ABS(a.v - e.v) < 1e-9)
);

SELECT 'result_metrics: Critical Results' AS check_name, IF(bad = 0, 'PASS', raise_error(CONCAT('result_metrics: Critical Results: ', bad, ' rows differ from expected'))) AS result
FROM (
  SELECT COUNT(*) AS bad
  FROM (SELECT 'all' AS k, CAST(MEASURE(`Critical Results`) AS DOUBLE) AS v FROM main.diagnostics_labs.result_metrics) a
  FULL OUTER JOIN (VALUES
    ('all', 3.0)) AS e(k, v) ON a.k = e.k
  WHERE a.k IS NULL OR e.k IS NULL OR NOT (a.v <=> e.v OR ABS(a.v - e.v) < 1e-9)
);

SELECT 'result_metrics: Critical Result Rate' AS check_name, IF(bad = 0, 'PASS', raise_error(CONCAT('result_metrics: Critical Result Rate: ', bad, ' rows differ from expected'))) AS result
FROM (
  SELECT COUNT(*) AS bad
  FROM (SELECT 'all' AS k, CAST(MEASURE(`Critical Result Rate`) AS DOUBLE) AS v FROM main.diagnostics_labs.result_metrics) a
  FULL OUTER JOIN (VALUES
    ('all', 0.15789473684210525)) AS e(k, v) ON a.k = e.k
  WHERE a.k IS NULL OR e.k IS NULL OR NOT (a.v <=> e.v OR ABS(a.v - e.v) < 1e-9)
);

SELECT 'result_metrics: Avg Minutes to Notify Critical' AS check_name, IF(bad = 0, 'PASS', raise_error(CONCAT('result_metrics: Avg Minutes to Notify Critical: ', bad, ' rows differ from expected'))) AS result
FROM (
  SELECT COUNT(*) AS bad
  FROM (SELECT 'all' AS k, CAST(MEASURE(`Avg Minutes to Notify Critical`) AS DOUBLE) AS v FROM main.diagnostics_labs.result_metrics) a
  FULL OUTER JOIN (VALUES
    ('all', 25.0)) AS e(k, v) ON a.k = e.k
  WHERE a.k IS NULL OR e.k IS NULL OR NOT (a.v <=> e.v OR ABS(a.v - e.v) < 1e-9)
);

SELECT 'result_metrics: Critical Calls Within 30 Minutes Rate' AS check_name, IF(bad = 0, 'PASS', raise_error(CONCAT('result_metrics: Critical Calls Within 30 Minutes Rate: ', bad, ' rows differ from expected'))) AS result
FROM (
  SELECT COUNT(*) AS bad
  FROM (SELECT 'all' AS k, CAST(MEASURE(`Critical Calls Within 30 Minutes Rate`) AS DOUBLE) AS v FROM main.diagnostics_labs.result_metrics) a
  FULL OUTER JOIN (VALUES
    ('all', 0.6666666666666666)) AS e(k, v) ON a.k = e.k
  WHERE a.k IS NULL OR e.k IS NULL OR NOT (a.v <=> e.v OR ABS(a.v - e.v) < 1e-9)
);

SELECT 'result_metrics: Autoverified Results' AS check_name, IF(bad = 0, 'PASS', raise_error(CONCAT('result_metrics: Autoverified Results: ', bad, ' rows differ from expected'))) AS result
FROM (
  SELECT COUNT(*) AS bad
  FROM (SELECT 'all' AS k, CAST(MEASURE(`Autoverified Results`) AS DOUBLE) AS v FROM main.diagnostics_labs.result_metrics) a
  FULL OUTER JOIN (VALUES
    ('all', 7.0)) AS e(k, v) ON a.k = e.k
  WHERE a.k IS NULL OR e.k IS NULL OR NOT (a.v <=> e.v OR ABS(a.v - e.v) < 1e-9)
);

SELECT 'result_metrics: Autoverification Rate' AS check_name, IF(bad = 0, 'PASS', raise_error(CONCAT('result_metrics: Autoverification Rate: ', bad, ' rows differ from expected'))) AS result
FROM (
  SELECT COUNT(*) AS bad
  FROM (SELECT 'all' AS k, CAST(MEASURE(`Autoverification Rate`) AS DOUBLE) AS v FROM main.diagnostics_labs.result_metrics) a
  FULL OUTER JOIN (VALUES
    ('all', 0.3888888888888889)) AS e(k, v) ON a.k = e.k
  WHERE a.k IS NULL OR e.k IS NULL OR NOT (a.v <=> e.v OR ABS(a.v - e.v) < 1e-9)
);

SELECT 'result_metrics: Corrected Results' AS check_name, IF(bad = 0, 'PASS', raise_error(CONCAT('result_metrics: Corrected Results: ', bad, ' rows differ from expected'))) AS result
FROM (
  SELECT COUNT(*) AS bad
  FROM (SELECT 'all' AS k, CAST(MEASURE(`Corrected Results`) AS DOUBLE) AS v FROM main.diagnostics_labs.result_metrics) a
  FULL OUTER JOIN (VALUES
    ('all', 2.0)) AS e(k, v) ON a.k = e.k
  WHERE a.k IS NULL OR e.k IS NULL OR NOT (a.v <=> e.v OR ABS(a.v - e.v) < 1e-9)
);

SELECT 'result_metrics: Corrected Result Rate' AS check_name, IF(bad = 0, 'PASS', raise_error(CONCAT('result_metrics: Corrected Result Rate: ', bad, ' rows differ from expected'))) AS result
FROM (
  SELECT COUNT(*) AS bad
  FROM (SELECT 'all' AS k, CAST(MEASURE(`Corrected Result Rate`) AS DOUBLE) AS v FROM main.diagnostics_labs.result_metrics) a
  FULL OUTER JOIN (VALUES
    ('all', 0.10526315789473684)) AS e(k, v) ON a.k = e.k
  WHERE a.k IS NULL OR e.k IS NULL OR NOT (a.v <=> e.v OR ABS(a.v - e.v) < 1e-9)
);

SELECT 'qc_metrics: QC Runs' AS check_name, IF(bad = 0, 'PASS', raise_error(CONCAT('qc_metrics: QC Runs: ', bad, ' rows differ from expected'))) AS result
FROM (
  SELECT COUNT(*) AS bad
  FROM (SELECT 'all' AS k, CAST(MEASURE(`QC Runs`) AS DOUBLE) AS v FROM main.diagnostics_labs.qc_metrics) a
  FULL OUTER JOIN (VALUES
    ('all', 13.0)) AS e(k, v) ON a.k = e.k
  WHERE a.k IS NULL OR e.k IS NULL OR NOT (a.v <=> e.v OR ABS(a.v - e.v) < 1e-9)
);

SELECT 'qc_metrics: QC Warnings' AS check_name, IF(bad = 0, 'PASS', raise_error(CONCAT('qc_metrics: QC Warnings: ', bad, ' rows differ from expected'))) AS result
FROM (
  SELECT COUNT(*) AS bad
  FROM (SELECT 'all' AS k, CAST(MEASURE(`QC Warnings`) AS DOUBLE) AS v FROM main.diagnostics_labs.qc_metrics) a
  FULL OUTER JOIN (VALUES
    ('all', 2.0)) AS e(k, v) ON a.k = e.k
  WHERE a.k IS NULL OR e.k IS NULL OR NOT (a.v <=> e.v OR ABS(a.v - e.v) < 1e-9)
);

SELECT 'qc_metrics: QC Rejections' AS check_name, IF(bad = 0, 'PASS', raise_error(CONCAT('qc_metrics: QC Rejections: ', bad, ' rows differ from expected'))) AS result
FROM (
  SELECT COUNT(*) AS bad
  FROM (SELECT 'all' AS k, CAST(MEASURE(`QC Rejections`) AS DOUBLE) AS v FROM main.diagnostics_labs.qc_metrics) a
  FULL OUTER JOIN (VALUES
    ('all', 3.0)) AS e(k, v) ON a.k = e.k
  WHERE a.k IS NULL OR e.k IS NULL OR NOT (a.v <=> e.v OR ABS(a.v - e.v) < 1e-9)
);

SELECT 'qc_metrics: QC Failure Rate' AS check_name, IF(bad = 0, 'PASS', raise_error(CONCAT('qc_metrics: QC Failure Rate: ', bad, ' rows differ from expected'))) AS result
FROM (
  SELECT COUNT(*) AS bad
  FROM (SELECT 'all' AS k, CAST(MEASURE(`QC Failure Rate`) AS DOUBLE) AS v FROM main.diagnostics_labs.qc_metrics) a
  FULL OUTER JOIN (VALUES
    ('all', 0.23076923076923078)) AS e(k, v) ON a.k = e.k
  WHERE a.k IS NULL OR e.k IS NULL OR NOT (a.v <=> e.v OR ABS(a.v - e.v) < 1e-9)
);

SELECT 'qc_metrics: Westgard Violations' AS check_name, IF(bad = 0, 'PASS', raise_error(CONCAT('qc_metrics: Westgard Violations: ', bad, ' rows differ from expected'))) AS result
FROM (
  SELECT COUNT(*) AS bad
  FROM (SELECT 'all' AS k, CAST(MEASURE(`Westgard Violations`) AS DOUBLE) AS v FROM main.diagnostics_labs.qc_metrics) a
  FULL OUTER JOIN (VALUES
    ('all', 5.0)) AS e(k, v) ON a.k = e.k
  WHERE a.k IS NULL OR e.k IS NULL OR NOT (a.v <=> e.v OR ABS(a.v - e.v) < 1e-9)
);

SELECT 'qc_metrics: Analyzers with QC Rejection' AS check_name, IF(bad = 0, 'PASS', raise_error(CONCAT('qc_metrics: Analyzers with QC Rejection: ', bad, ' rows differ from expected'))) AS result
FROM (
  SELECT COUNT(*) AS bad
  FROM (SELECT 'all' AS k, CAST(MEASURE(`Analyzers with QC Rejection`) AS DOUBLE) AS v FROM main.diagnostics_labs.qc_metrics) a
  FULL OUTER JOIN (VALUES
    ('all', 2.0)) AS e(k, v) ON a.k = e.k
  WHERE a.k IS NULL OR e.k IS NULL OR NOT (a.v <=> e.v OR ABS(a.v - e.v) < 1e-9)
);

SELECT 'qc_metrics: Mean SDI' AS check_name, IF(bad = 0, 'PASS', raise_error(CONCAT('qc_metrics: Mean SDI: ', bad, ' rows differ from expected'))) AS result
FROM (
  SELECT COUNT(*) AS bad
  FROM (SELECT 'all' AS k, CAST(MEASURE(`Mean SDI`) AS DOUBLE) AS v FROM main.diagnostics_labs.qc_metrics) a
  FULL OUTER JOIN (VALUES
    ('all', 0.4615384615384609)) AS e(k, v) ON a.k = e.k
  WHERE a.k IS NULL OR e.k IS NULL OR NOT (a.v <=> e.v OR ABS(a.v - e.v) < 1e-9)
);

SELECT 'qc_metrics: CV Percent' AS check_name, IF(bad = 0, 'PASS', raise_error(CONCAT('qc_metrics: CV Percent: ', bad, ' rows differ from expected'))) AS result
FROM (
  SELECT COUNT(*) AS bad
  FROM (SELECT 'all' AS k, CAST(MEASURE(`CV Percent`) AS DOUBLE) AS v FROM main.diagnostics_labs.qc_metrics) a
  FULL OUTER JOIN (VALUES
    ('all', 124.47423856384259)) AS e(k, v) ON a.k = e.k
  WHERE a.k IS NULL OR e.k IS NULL OR NOT (a.v <=> e.v OR ABS(a.v - e.v) < 1e-9)
);
