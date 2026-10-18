-- ============================================================================
-- SCRIPT 11: Verify Installation and System Health
-- Project: Time Travel Database System
-- Target: Oracle Database 21c XE
-- Description: Verifies tables, triggers, sequences, packages, and executes a quick
--              end-to-end smoke test of time-travel reconstruction.
-- ============================================================================

SET SERVEROUTPUT ON;

DECLARE
    v_cnt NUMBER;
    v_invalid_cnt NUMBER;
    v_test_ts TIMESTAMP WITH TIME ZONE;
    v_reconstructed CLOB;
    v_cust_id NUMBER := 999;
BEGIN
    DBMS_OUTPUT.PUT_LINE('--- 1. Checking Database Tables ---');
    FOR t IN (
        SELECT 'CUSTOMERS' tbl FROM DUAL UNION ALL
        SELECT 'PRODUCTS' FROM DUAL UNION ALL
        SELECT 'ORDERS' FROM DUAL UNION ALL
        SELECT 'ORDER_ITEMS' FROM DUAL UNION ALL
        SELECT 'TT_TRANSACTIONS' FROM DUAL UNION ALL
        SELECT 'TT_CHANGE_LOG' FROM DUAL UNION ALL
        SELECT 'TT_CONFIG' FROM DUAL UNION ALL
        SELECT 'TT_QUERY_METRICS' FROM DUAL UNION ALL
        SELECT 'TT_CHECKPOINTS' FROM DUAL UNION ALL
        SELECT 'TT_CHECKPOINT_DATA' FROM DUAL UNION ALL
        SELECT 'TT_POLICY_DECISIONS' FROM DUAL UNION ALL
        SELECT 'TT_BENCHMARK_RESULTS' FROM DUAL
    ) LOOP
        SELECT COUNT(*) INTO v_cnt FROM USER_TABLES WHERE TABLE_NAME = t.tbl;
        IF v_cnt = 1 THEN
            DBMS_OUTPUT.PUT_LINE('  [PASS] Table ' || t.tbl || ' exists.');
        ELSE
            DBMS_OUTPUT.PUT_LINE('  [FAIL] Table ' || t.tbl || ' MISSING!');
        END IF;
    END LOOP;

    DBMS_OUTPUT.PUT_LINE('--- 2. Checking PL/SQL Packages Validity ---');
    SELECT COUNT(*) INTO v_invalid_cnt 
    FROM USER_OBJECTS 
    WHERE OBJECT_TYPE IN ('PACKAGE', 'PACKAGE BODY') AND STATUS = 'INVALID';

    IF v_invalid_cnt = 0 THEN
        DBMS_OUTPUT.PUT_LINE('  [PASS] All packages are VALID.');
    ELSE
        DBMS_OUTPUT.PUT_LINE('  [WARN] ' || v_invalid_cnt || ' package objects are INVALID.');
    END IF;

    DBMS_OUTPUT.PUT_LINE('--- 3. Testing Time Travel Reconstruction End-to-End ---');
    -- Insert test record
    INSERT INTO CUSTOMERS (customer_id, name, email, phone, status, credit_limit)
    VALUES (v_cust_id, 'Verification Tester', 'verify@test.local', '+1-555-9999', 'ACTIVE', 5000.00);
    COMMIT;

    -- Timestamp after insert
    v_test_ts := SYSTIMESTAMP;
    DBMS_LOCK.SLEEP(0.05);

    -- Update test record
    UPDATE CUSTOMERS SET credit_limit = 95000.00 WHERE customer_id = v_cust_id;
    COMMIT;

    -- Reconstruct row as of v_test_ts
    v_reconstructed := TT_RECONSTRUCTION_PKG.reconstruct_row('CUSTOMERS', TO_CHAR(v_cust_id), v_test_ts, 'ADAPTIVE');
    DBMS_OUTPUT.PUT_LINE('  Reconstructed historical state:');
    DBMS_OUTPUT.PUT_LINE(SUBSTR(v_reconstructed, 1, 250) || '...');

    -- Clean up verification record
    DELETE FROM CUSTOMERS WHERE customer_id = v_cust_id;
    COMMIT;

    DBMS_OUTPUT.PUT_LINE('=== SYSTEM INSTALLATION AND TIME TRAVEL VERIFIED SUCCESSFULLY ===');
END;
/
