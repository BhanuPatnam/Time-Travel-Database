-- ============================================================================
-- TIME TRAVEL DATABASE: PURE ORACLE SQL & PL/SQL DEMONSTRATION SCRIPT
-- Execute in SQL*Plus, SQL Developer, SQLcl, or DBeaver
-- ============================================================================
SET SERVEROUTPUT ON SIZE UNLIMITED;
SET LINESIZE 220;
SET PAGESIZE 100;
SET FEEDBACK ON;
COLUMN table_name FORMAT A15;
COLUMN operation_type FORMAT A8;
COLUMN changed_columns FORMAT A25;
COLUMN record_pk FORMAT A10;
COLUMN name FORMAT A25;
COLUMN email FORMAT A25;
COLUMN status FORMAT A12;
COLUMN credit_limit FORMAT $999,999.99;

PROMPT ============================================================================
PROMPT STEP 1: Current Live State in Business Table CUSTOMERS
PROMPT ============================================================================
SELECT customer_id, name, email, phone, status, credit_limit
FROM CUSTOMERS
ORDER BY customer_id;

PROMPT ============================================================================
PROMPT STEP 2: Auditable History Log in TT_CHANGE_LOG (Last 10 Changes)
PROMPT ============================================================================
SELECT 
    change_id,
    commit_order_seq AS seq,
    table_name,
    record_pk AS pk,
    operation_type AS op,
    NVL(changed_columns, 'ALL') AS changed_cols,
    TO_CHAR(change_timestamp, 'YYYY-MM-DD HH24:MI:SS') AS change_time
FROM TT_CHANGE_LOG
ORDER BY commit_order_seq DESC
FETCH FIRST 10 ROWS ONLY;

PROMPT ============================================================================
PROMPT STEP 3: Time Travel Row Reconstruction using Native Oracle JSON_TABLE
PROMPT Reconstructing Customer #101 as of 1 HOUR AGO (Before recent credit update)
PROMPT Returns a pure relational SQL table (Columns & Rows)
PROMPT ============================================================================
SELECT 
    jt.customer_id,
    jt.name,
    jt.email,
    jt.phone,
    jt.status,
    jt.credit_limit
FROM DUAL,
     JSON_TABLE(
         TT_RECONSTRUCTION_PKG.reconstruct_row(
             p_table_name       => 'CUSTOMERS',
             p_record_pk        => '101',
             p_target_timestamp => SYSTIMESTAMP - INTERVAL '1' HOUR,
             p_strategy         => 'ADAPTIVE'
         ),
         '$' COLUMNS (
             customer_id   NUMBER(10)     PATH '$.customer_id',
             name          VARCHAR2(100)  PATH '$.name',
             email         VARCHAR2(100)  PATH '$.email',
             phone         VARCHAR2(20)   PATH '$.phone',
             status        VARCHAR2(20)   PATH '$.status',
             credit_limit  NUMBER(12,2)   PATH '$.credit_limit'
         )
     ) jt;

PROMPT ============================================================================
PROMPT STEP 4: Time Travel Full Table Snapshot using Native Oracle JSON_TABLE
PROMPT Reconstructing the ENTIRE CUSTOMERS table as of 1 HOUR AGO
PROMPT ============================================================================
SELECT 
    jt.customer_id,
    jt.name,
    jt.status,
    jt.credit_limit
FROM DUAL,
     JSON_TABLE(
         TT_RECONSTRUCTION_PKG.reconstruct_table(
             p_table_name       => 'CUSTOMERS',
             p_target_timestamp => SYSTIMESTAMP - INTERVAL '1' HOUR,
             p_strategy         => 'ADAPTIVE'
         ),
         '$[*]' COLUMNS (
             customer_id   NUMBER(10)     PATH '$.customer_id',
             name          VARCHAR2(100)  PATH '$.name',
             status        VARCHAR2(20)   PATH '$.status',
             credit_limit  NUMBER(12,2)   PATH '$.credit_limit'
         )
     ) jt
ORDER BY jt.customer_id;

PROMPT ============================================================================
PROMPT STEP 5: Testing DML with Automatic Temporal Trigger Capture
PROMPT Inserting a new Customer #999, updating status, then checking change log
PROMPT ============================================================================
INSERT INTO CUSTOMERS (customer_id, name, email, phone, status, credit_limit)
VALUES (999, 'Pure Oracle SQL Enterprise', 'sql@oracle.com', '+1-555-7777', 'ACTIVE', 85000.00);
COMMIT;

UPDATE CUSTOMERS 
SET credit_limit = 120000.00, status = 'VIP'
WHERE customer_id = 999;
COMMIT;

PROMPT Checking TT_CHANGE_LOG for the new entries for Customer 999:
SELECT 
    change_id,
    commit_order_seq AS seq,
    operation_type AS op,
    changed_columns,
    TO_CHAR(change_timestamp, 'HH24:MI:SS.FF3') AS change_time
FROM TT_CHANGE_LOG
WHERE table_name = 'CUSTOMERS' AND record_pk = '999'
ORDER BY commit_order_seq;

PROMPT ============================================================================
PROMPT STEP 6: Reconstructing Customer #999 as of 2 SECONDS AGO (Prior to VIP update)
PROMPT ============================================================================
SELECT 
    jt.customer_id,
    jt.name,
    jt.status,
    jt.credit_limit
FROM DUAL,
     JSON_TABLE(
         TT_RECONSTRUCTION_PKG.reconstruct_row('CUSTOMERS', '999', SYSTIMESTAMP - INTERVAL '2' SECOND, 'ADAPTIVE'),
         '$' COLUMNS (
             customer_id   NUMBER(10)     PATH '$.customer_id',
             name          VARCHAR2(100)  PATH '$.name',
             status        VARCHAR2(20)   PATH '$.status',
             credit_limit  NUMBER(12,2)   PATH '$.credit_limit'
         )
     ) jt;

PROMPT ============================================================================
PROMPT STEP 7: Workload-Aware Adaptive Checkpoint Policy Evaluation
PROMPT Calculates storage cost vs query latency score in pure PL/SQL
PROMPT ============================================================================
DECLARE
    v_decision VARCHAR2(50);
BEGIN
    v_decision := TT_CHECKPOINT_PKG.evaluate_adaptive_policy('CUSTOMERS');
    DBMS_OUTPUT.PUT_LINE('Adaptive Policy Decision for CUSTOMERS: ' || v_decision);
    
    v_decision := TT_CHECKPOINT_PKG.evaluate_adaptive_policy('PRODUCTS');
    DBMS_OUTPUT.PUT_LINE('Adaptive Policy Decision for PRODUCTS:  ' || v_decision);
END;
/

PROMPT Inspecting Materialized Checkpoints in TT_CHECKPOINTS:
SELECT 
    checkpoint_id,
    table_name,
    checkpoint_name,
    strategy_used,
    status,
    row_count,
    storage_bytes,
    creation_duration_ms AS duration_ms
FROM TT_CHECKPOINTS
ORDER BY checkpoint_id DESC;

PROMPT ============================================================================
PROMPT STEP 8: Safe Forward Restoration Preview & Execution in Pure SQL
PROMPT ============================================================================
PROMPT Previewing what SQL statement will be generated to restore Customer 101:
SELECT TT_DIFF_RESTORE_PKG.preview_restore(
    p_table_name       => 'CUSTOMERS',
    p_record_pk        => '101',
    p_target_timestamp => SYSTIMESTAMP - INTERVAL '1' HOUR
) AS proposed_restoration_sql
FROM DUAL;

PROMPT Clean up test record 999:
DELETE FROM CUSTOMERS WHERE customer_id = 999;
COMMIT;

PROMPT ============================================================================
PROMPT PURE ORACLE SQL DEMO COMPLETE!
PROMPT ============================================================================
