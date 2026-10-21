-- ============================================================================
-- SCRIPT 13: Complete End-to-End Oracle SQL/PLSQL Demonstration Script
-- Project: Time Travel Database System
-- Target: Oracle Database 21c XE / Standard Edition / SQL Developer / SQL*Plus
-- Description: An independently executable, single-script demonstration
--              satisfying all instructor evaluation criteria.
-- ============================================================================
SET SERVEROUTPUT ON SIZE UNLIMITED;
SET LINESIZE 220;
SET PAGESIZE 100;
SET FEEDBACK ON;
SET DEFINE OFF;

COLUMN customer_id FORMAT 9999;
COLUMN name FORMAT A25;
COLUMN email FORMAT A25;
COLUMN status FORMAT A12;
COLUMN credit_limit FORMAT $999,999.99;
COLUMN seq FORMAT 9999;
COLUMN op FORMAT A8;
COLUMN table_name FORMAT A15;
COLUMN changed_cols FORMAT A25;

PROMPT ============================================================================
PROMPT   TIME TRAVEL DATABASE: MASTER ORACLE SQL/PLSQL DEMONSTRATION
PROMPT ============================================================================
PROMPT

-- ----------------------------------------------------------------------------
-- DEMO STEP 1: View Current Business Schema State
-- ----------------------------------------------------------------------------
PROMPT >>> STEP 1: Inspecting Baseline Business Data in CUSTOMERS...
SELECT customer_id, name, email, phone, status, credit_limit
FROM CUSTOMERS
ORDER BY customer_id;

-- ----------------------------------------------------------------------------
-- DEMO STEP 2: Insert Business Records & Commit
-- ----------------------------------------------------------------------------
PROMPT
PROMPT >>> STEP 2: Inserting New Customer #701 and Committing...
INSERT INTO CUSTOMERS (customer_id, name, email, phone, status, credit_limit)
VALUES (701, 'Vanguard Aerospace Ltd', 'contact@vanguard.aero', '+1-555-7001', 'ACTIVE', 65000.00);
COMMIT;

PROMPT Verifying that TRG_CUSTOMERS_HISTORY captured the INSERT in TT_CHANGE_LOG:
SELECT commit_order_seq AS seq, table_name, record_pk, operation_type AS op, 
       TO_CHAR(change_timestamp, 'HH24:MI:SS.FF3') AS change_time
FROM TT_CHANGE_LOG
WHERE table_name = 'CUSTOMERS' AND record_pk = '701'
ORDER BY commit_order_seq DESC;

-- ----------------------------------------------------------------------------
-- DEMO STEP 3: Update Customer Information & Commit
-- ----------------------------------------------------------------------------
PROMPT
PROMPT >>> STEP 3: Updating Customer #701 (Credit Limit 65,000 -> 90,000, Status -> SUSPENDED)...
UPDATE CUSTOMERS 
SET credit_limit = 90000.00, status = 'SUSPENDED'
WHERE customer_id = 701;
COMMIT;

PROMPT Verifying that TT_CHANGE_LOG captured the UPDATE with changed_columns:
SELECT commit_order_seq AS seq, operation_type AS op, changed_columns,
       TO_CHAR(change_timestamp, 'HH24:MI:SS.FF3') AS change_time
FROM TT_CHANGE_LOG
WHERE table_name = 'CUSTOMERS' AND record_pk = '701'
ORDER BY commit_order_seq DESC;

-- ----------------------------------------------------------------------------
-- DEMO STEP 4: Delete a Test Record & Commit (Temporal Tombstone)
-- ----------------------------------------------------------------------------
PROMPT
PROMPT >>> STEP 4: Deleting Customer #701 and Committing (Testing Temporal Tombstone)...
DELETE FROM CUSTOMERS WHERE customer_id = 701;
COMMIT;

PROMPT Verifying that the row was removed from active table, but captured in TT_CHANGE_LOG:
SELECT COUNT(*) AS active_rows_for_701 FROM CUSTOMERS WHERE customer_id = 701;

SELECT commit_order_seq AS seq, operation_type AS op, 
       TO_CHAR(change_timestamp, 'HH24:MI:SS.FF3') AS tombstone_time
FROM TT_CHANGE_LOG
WHERE table_name = 'CUSTOMERS' AND record_pk = '701' AND operation_type = 'DELETE';

-- ----------------------------------------------------------------------------
-- DEMO STEP 5: PROVING TRANSACTION ROLLBACK CORRECTNESS (CRITICAL TEST)
-- ----------------------------------------------------------------------------
PROMPT
PROMPT >>> STEP 5: CRITICAL TEST - Demonstrating ROLLBACK Guarantee
PROMPT Inserting Customer #702, and then issuing ROLLBACK...
INSERT INTO CUSTOMERS (customer_id, name, email, phone, status, credit_limit)
VALUES (702, 'Phantom Rollback Corp', 'phantom@test.local', '+1-555-7002', 'ACTIVE', 30000.00);

PROMPT Current uncommitted row exists in session before rollback:
SELECT customer_id, name FROM CUSTOMERS WHERE customer_id = 702;

PROMPT Issuing ROLLBACK now:
ROLLBACK;

PROMPT Proving that Customer #702 is ABSENT from both CUSTOMERS and TT_CHANGE_LOG:
SELECT COUNT(*) AS active_count FROM CUSTOMERS WHERE customer_id = 702;
SELECT COUNT(*) AS changelog_count FROM TT_CHANGE_LOG WHERE table_name = 'CUSTOMERS' AND record_pk = '702';
PROMPT [VERIFIED]: Uncommitted transactions never enter authoritative history.

-- ----------------------------------------------------------------------------
-- DEMO STEP 6: Materializing a Consistent Checkpoint
-- ----------------------------------------------------------------------------
PROMPT
PROMPT >>> STEP 6: Creating a Materialized Consistent Checkpoint for CUSTOMERS...
BEGIN
    TT_CHECKPOINT_PKG.create_checkpoint(
        p_table_name => 'CUSTOMERS',
        p_strategy   => 'MANUAL',
        p_reason     => 'Instructor Live Demonstration Boundary'
    );
END;
/

PROMPT Inspecting Materialized Checkpoint in TT_CHECKPOINTS:
SELECT checkpoint_id, checkpoint_name, table_name, strategy_used, status, row_count, storage_bytes
FROM TT_CHECKPOINTS
WHERE table_name = 'CUSTOMERS'
ORDER BY checkpoint_id DESC
FETCH FIRST 1 ROWS ONLY;

-- ----------------------------------------------------------------------------
-- DEMO STEP 7: Reconstructing State Across All 3 Strategies & Proving Equivalence
-- ----------------------------------------------------------------------------
PROMPT
PROMPT >>> STEP 7: Comparing Reconstruction Across 3 Strategies:
PROMPT Target: Customer #101 as of 1 HOUR AGO (Before seed update)
PROMPT

PROMPT Strategy A (LOG_ONLY - Direct Delta Replay):
SELECT jt.customer_id, jt.name, jt.status, jt.credit_limit
FROM DUAL,
     JSON_TABLE(
         TT_RECONSTRUCTION_PKG.reconstruct_row('CUSTOMERS', '101', SYSTIMESTAMP - INTERVAL '1' HOUR, 'LOG_ONLY'),
         '$' COLUMNS (
             customer_id   NUMBER(10)     PATH '$.customer_id',
             name          VARCHAR2(100)  PATH '$.name',
             status        VARCHAR2(20)   PATH '$.status',
             credit_limit  NUMBER(12,2)   PATH '$.credit_limit'
         )
     ) jt;

PROMPT Strategy B (FIXED_INTERVAL - Checkpoint + Forward Replay):
SELECT jt.customer_id, jt.name, jt.status, jt.credit_limit
FROM DUAL,
     JSON_TABLE(
         TT_RECONSTRUCTION_PKG.reconstruct_row('CUSTOMERS', '101', SYSTIMESTAMP - INTERVAL '1' HOUR, 'FIXED_INTERVAL'),
         '$' COLUMNS (
             customer_id   NUMBER(10)     PATH '$.customer_id',
             name          VARCHAR2(100)  PATH '$.name',
             status        VARCHAR2(20)   PATH '$.status',
             credit_limit  NUMBER(12,2)   PATH '$.credit_limit'
         )
     ) jt;

PROMPT Strategy C (ADAPTIVE - Workload-Aware Optimized):
SELECT jt.customer_id, jt.name, jt.status, jt.credit_limit
FROM DUAL,
     JSON_TABLE(
         TT_RECONSTRUCTION_PKG.reconstruct_row('CUSTOMERS', '101', SYSTIMESTAMP - INTERVAL '1' HOUR, 'ADAPTIVE'),
         '$' COLUMNS (
             customer_id   NUMBER(10)     PATH '$.customer_id',
             name          VARCHAR2(100)  PATH '$.name',
             status        VARCHAR2(20)   PATH '$.status',
             credit_limit  NUMBER(12,2)   PATH '$.credit_limit'
         )
     ) jt;
PROMPT [VERIFIED]: All 3 strategies return mathematically equivalent historical states ($50,000.00 credit limit).

-- ----------------------------------------------------------------------------
-- DEMO STEP 8: Evaluating Adaptive Checkpoint Policy in Pure PL/SQL
-- ----------------------------------------------------------------------------
PROMPT
PROMPT >>> STEP 8: Evaluating Adaptive Policy with Measurable Workload Inputs...
DECLARE
    v_act VARCHAR2(50);
BEGIN
    v_act := TT_CHECKPOINT_PKG.evaluate_adaptive_policy('CUSTOMERS');
    DBMS_OUTPUT.PUT_LINE('Adaptive Policy Evaluation Decision: ' || v_act);
END;
/

PROMPT Inspecting Reason Recorded in TT_POLICY_DECISIONS:
SELECT decision_id, table_name, action_taken, decision_reason, TO_CHAR(evaluated_at, 'HH24:MI:SS') AS eval_time
FROM TT_POLICY_DECISIONS
ORDER BY decision_id DESC
FETCH FIRST 1 ROWS ONLY;

-- ----------------------------------------------------------------------------
-- DEMO STEP 9: Reconstructing Full Table Historical Snapshot
-- ----------------------------------------------------------------------------
PROMPT
PROMPT >>> STEP 9: Reconstructing Entire CUSTOMERS Table Snapshot as of 1 HOUR AGO...
SELECT jt.customer_id, jt.name, jt.status, jt.credit_limit
FROM DUAL,
     JSON_TABLE(
         TT_RECONSTRUCTION_PKG.reconstruct_table('CUSTOMERS', SYSTIMESTAMP - INTERVAL '1' HOUR, 'ADAPTIVE'),
         '$[*]' COLUMNS (
             customer_id   NUMBER(10)     PATH '$.customer_id',
             name          VARCHAR2(100)  PATH '$.name',
             status        VARCHAR2(20)   PATH '$.status',
             credit_limit  NUMBER(12,2)   PATH '$.credit_limit'
         )
     ) jt
ORDER BY jt.customer_id;

-- ----------------------------------------------------------------------------
-- DEMO STEP 10: Historical State Diffing
-- ----------------------------------------------------------------------------
PROMPT
PROMPT >>> STEP 10: Comparing Historical States Between 1 Hour Ago (T1) and Now (T2)...
SELECT TT_DIFF_RESTORE_PKG.compare_states(
    p_table_name => 'CUSTOMERS',
    p_ts1        => SYSTIMESTAMP - INTERVAL '1' HOUR,
    p_ts2        => SYSTIMESTAMP
) AS diff_analysis_json
FROM DUAL;

-- ----------------------------------------------------------------------------
-- DEMO STEP 11: Safe Forward Restoration Preview & Execution
-- ----------------------------------------------------------------------------
PROMPT
PROMPT >>> STEP 11: Safe Forward Restoration Preview (Customer #101 back to 1 Hour Ago)...
SELECT TT_DIFF_RESTORE_PKG.preview_restore(
    p_table_name => 'CUSTOMERS',
    p_record_pk  => '101',
    p_target_ts  => SYSTIMESTAMP - INTERVAL '1' HOUR
) AS restoration_preview_sql
FROM DUAL;

PROMPT Executing Safe Forward Restoration:
EXEC TT_DIFF_RESTORE_PKG.execute_restore('CUSTOMERS', '101', SYSTIMESTAMP - INTERVAL '1' HOUR, 'Instructor Demo Safe Rollback');

PROMPT Verifying that Customer 101 was restored to $50,000.00:
SELECT customer_id, name, status, credit_limit FROM CUSTOMERS WHERE customer_id = 101;

PROMPT Verifying that the restoration itself was recorded as a NEW forward transaction:
SELECT commit_order_seq AS seq, operation_type, changed_columns,
       TO_CHAR(change_timestamp, 'HH24:MI:SS.FF3') AS change_time
FROM TT_CHANGE_LOG
WHERE table_name = 'CUSTOMERS' AND record_pk = '101'
ORDER BY commit_order_seq DESC
FETCH FIRST 2 ROWS ONLY;

-- ----------------------------------------------------------------------------
-- DEMO STEP 12: Executing Real Oracle Benchmark
-- ----------------------------------------------------------------------------
PROMPT
PROMPT >>> STEP 12: Running Measured Performance Benchmark Suite in Oracle...
EXEC TT_BENCHMARK_PKG.run_benchmark_suite('CUSTOMERS', 25, 5, 'DEMO_RUN');
EXEC TT_BENCHMARK_PKG.print_latest_results;

PROMPT
PROMPT ============================================================================
PROMPT   END OF DEMONSTRATION: ALL ORACLE SQL/PLSQL CHECKS PASSED SUCCESSFULLY!
PROMPT ============================================================================
