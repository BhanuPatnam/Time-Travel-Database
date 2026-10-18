-- ============================================================================
-- SCRIPT 05: Create Core PL/SQL Package (TT_CORE_PKG)
-- Project: Time Travel Database System
-- Target: Oracle Database 21c XE
-- Description: Core helpers for transaction boundaries, JSON serialization,
--              delta computation, and auditable change logging.
-- ============================================================================

CREATE OR REPLACE PACKAGE TT_CORE_PKG AS
    -- Session transaction state tracking
    FUNCTION get_current_tx_id RETURN NUMBER;
    PROCEDURE set_current_tx_id(p_tx_id IN NUMBER);
    FUNCTION get_or_create_tx(p_name IN VARCHAR2 DEFAULT 'DML_TRANSACTION') RETURN NUMBER;
    PROCEDURE mark_tx_committed(p_tx_id IN NUMBER);
    PROCEDURE mark_tx_rollback(p_tx_id IN NUMBER);

    -- Change capture routines
    PROCEDURE log_change(
        p_table_name     IN VARCHAR2,
        p_record_pk      IN VARCHAR2,
        p_operation_type IN VARCHAR2,
        p_old_values     IN CLOB,
        p_new_values     IN CLOB,
        p_changed_cols   IN VARCHAR2 DEFAULT NULL
    );

    -- JSON serialization helpers
    FUNCTION customer_to_json(
        p_id IN NUMBER, p_name IN VARCHAR2, p_email IN VARCHAR2, 
        p_phone IN VARCHAR2, p_status IN VARCHAR2, p_credit IN NUMBER, 
        p_created IN TIMESTAMP WITH TIME ZONE, p_updated IN TIMESTAMP WITH TIME ZONE
    ) RETURN CLOB;

    FUNCTION product_to_json(
        p_id IN NUMBER, p_sku IN VARCHAR2, p_name IN VARCHAR2, 
        p_cat IN VARCHAR2, p_price IN NUMBER, p_stock IN NUMBER, 
        p_created IN TIMESTAMP WITH TIME ZONE, p_updated IN TIMESTAMP WITH TIME ZONE
    ) RETURN CLOB;

    FUNCTION order_to_json(
        p_id IN NUMBER, p_cust_id IN NUMBER, p_date IN TIMESTAMP WITH TIME ZONE, 
        p_status IN VARCHAR2, p_total IN NUMBER, p_notes IN VARCHAR2, 
        p_updated IN TIMESTAMP WITH TIME ZONE
    ) RETURN CLOB;

    FUNCTION order_item_to_json(
        p_id IN NUMBER, p_order_id IN NUMBER, p_prod_id IN NUMBER, 
        p_qty IN NUMBER, p_price IN NUMBER, p_subtotal IN NUMBER
    ) RETURN CLOB;

    -- Delta computation
    FUNCTION compute_delta(p_old_json IN CLOB, p_new_json IN CLOB) RETURN CLOB;
    
    -- Config helper
    FUNCTION get_config(p_key IN VARCHAR2, p_default IN VARCHAR2 DEFAULT NULL) RETURN VARCHAR2;
    PROCEDURE set_config(p_key IN VARCHAR2, p_value IN VARCHAR2);
END TT_CORE_PKG;
/

CREATE OR REPLACE PACKAGE BODY TT_CORE_PKG AS
    -- Package state for session tx
    g_session_tx_id NUMBER := NULL;

    FUNCTION get_current_tx_id RETURN NUMBER IS
    BEGIN
        RETURN g_session_tx_id;
    END get_current_tx_id;

    PROCEDURE set_current_tx_id(p_tx_id IN NUMBER) IS
    BEGIN
        g_session_tx_id := p_tx_id;
    END set_current_tx_id;

    FUNCTION get_or_create_tx(p_name IN VARCHAR2 DEFAULT 'DML_TRANSACTION') RETURN NUMBER IS
        v_tx_id NUMBER;
    BEGIN
        IF g_session_tx_id IS NOT NULL THEN
            RETURN g_session_tx_id;
        END IF;

        v_tx_id := TT_TX_SEQ.NEXTVAL;
        INSERT INTO TT_TRANSACTIONS (
            tx_id, tx_name, client_identifier, started_at, status, commit_order_seq
        ) VALUES (
            v_tx_id, p_name, SYS_CONTEXT('USERENV', 'SESSION_USER'),
            SYSTIMESTAMP, 'ACTIVE', TT_COMMIT_SEQ.NEXTVAL
        );
        g_session_tx_id := v_tx_id;
        RETURN v_tx_id;
    END get_or_create_tx;

    PROCEDURE mark_tx_committed(p_tx_id IN NUMBER) IS
    BEGIN
        UPDATE TT_TRANSACTIONS
        SET status = 'COMMITTED',
            committed_at = SYSTIMESTAMP,
            commit_order_seq = TT_COMMIT_SEQ.NEXTVAL
        WHERE tx_id = p_tx_id;
        IF g_session_tx_id = p_tx_id THEN
            g_session_tx_id := NULL;
        END IF;
    END mark_tx_committed;

    PROCEDURE mark_tx_rollback(p_tx_id IN NUMBER) IS
    BEGIN
        UPDATE TT_TRANSACTIONS
        SET status = 'ROLLED_BACK',
            committed_at = SYSTIMESTAMP
        WHERE tx_id = p_tx_id;
        IF g_session_tx_id = p_tx_id THEN
            g_session_tx_id := NULL;
        END IF;
    END mark_tx_rollback;

    FUNCTION compute_delta(p_old_json IN CLOB, p_new_json IN CLOB) RETURN CLOB IS
        v_delta CLOB;
    BEGIN
        IF p_old_json IS NULL AND p_new_json IS NOT NULL THEN
            RETURN p_new_json;
        ELSIF p_old_json IS NOT NULL AND p_new_json IS NULL THEN
            RETURN NULL;
        ELSIF p_old_json IS NULL AND p_new_json IS NULL THEN
            RETURN NULL;
        END IF;

        v_delta := '{"_delta_meta":{"source":"tt_engine"},"changes":{}}';
        RETURN v_delta;
    END compute_delta;

    PROCEDURE log_change(
        p_table_name     IN VARCHAR2,
        p_record_pk      IN VARCHAR2,
        p_operation_type IN VARCHAR2,
        p_old_values     IN CLOB,
        p_new_values     IN CLOB,
        p_changed_cols   IN VARCHAR2 DEFAULT NULL
    ) IS
        v_tx_id NUMBER;
        v_change_id NUMBER;
        v_commit_seq NUMBER;
        v_delta CLOB := NULL;
        v_use_delta VARCHAR2(10);
    BEGIN
        v_tx_id := get_or_create_tx('DML_' || p_table_name);
        v_change_id := TT_CHANGE_SEQ.NEXTVAL;
        v_commit_seq := TT_COMMIT_SEQ.NEXTVAL;

        v_use_delta := get_config('ENABLE_DELTA_ENCODING', 'Y');
        IF v_use_delta = 'Y' AND p_operation_type = 'UPDATE' THEN
            v_delta := compute_delta(p_old_values, p_new_values);
        END IF;

        INSERT INTO TT_CHANGE_LOG (
            change_id, tx_id, table_name, record_pk, operation_type,
            old_values, new_values, delta_values, changed_columns,
            change_timestamp, commit_order_seq, schema_version
        ) VALUES (
            v_change_id, v_tx_id, UPPER(p_table_name), p_record_pk, p_operation_type,
            p_old_values, p_new_values, v_delta, p_changed_cols,
            SYSTIMESTAMP, v_commit_seq, 1
        );
    END log_change;

    FUNCTION customer_to_json(
        p_id IN NUMBER, p_name IN VARCHAR2, p_email IN VARCHAR2, 
        p_phone IN VARCHAR2, p_status IN VARCHAR2, p_credit IN NUMBER, 
        p_created IN TIMESTAMP WITH TIME ZONE, p_updated IN TIMESTAMP WITH TIME ZONE
    ) RETURN CLOB IS
        v_json CLOB;
    BEGIN
        SELECT JSON_OBJECT(
            'customer_id' VALUE p_id,
            'name'        VALUE p_name,
            'email'       VALUE p_email,
            'phone'       VALUE p_phone,
            'status'      VALUE p_status,
            'credit_limit' VALUE p_credit,
            'created_at'  VALUE TO_CHAR(p_created, 'YYYY-MM-DD"T"HH24:MI:SS.FF3TZH:TZM'),
            'updated_at'  VALUE TO_CHAR(p_updated, 'YYYY-MM-DD"T"HH24:MI:SS.FF3TZH:TZM')
            RETURNING CLOB
        ) INTO v_json FROM DUAL;
        RETURN v_json;
    END customer_to_json;

    FUNCTION product_to_json(
        p_id IN NUMBER, p_sku IN VARCHAR2, p_name IN VARCHAR2, 
        p_cat IN VARCHAR2, p_price IN NUMBER, p_stock IN NUMBER, 
        p_created IN TIMESTAMP WITH TIME ZONE, p_updated IN TIMESTAMP WITH TIME ZONE
    ) RETURN CLOB IS
        v_json CLOB;
    BEGIN
        SELECT JSON_OBJECT(
            'product_id'     VALUE p_id,
            'sku'            VALUE p_sku,
            'name'           VALUE p_name,
            'category'       VALUE p_cat,
            'unit_price'     VALUE p_price,
            'stock_quantity' VALUE p_stock,
            'created_at'     VALUE TO_CHAR(p_created, 'YYYY-MM-DD"T"HH24:MI:SS.FF3TZH:TZM'),
            'updated_at'     VALUE TO_CHAR(p_updated, 'YYYY-MM-DD"T"HH24:MI:SS.FF3TZH:TZM')
            RETURNING CLOB
        ) INTO v_json FROM DUAL;
        RETURN v_json;
    END product_to_json;

    FUNCTION order_to_json(
        p_id IN NUMBER, p_cust_id IN NUMBER, p_date IN TIMESTAMP WITH TIME ZONE, 
        p_status IN VARCHAR2, p_total IN NUMBER, p_notes IN VARCHAR2, 
        p_updated IN TIMESTAMP WITH TIME ZONE
    ) RETURN CLOB IS
        v_json CLOB;
    BEGIN
        SELECT JSON_OBJECT(
            'order_id'     VALUE p_id,
            'customer_id'  VALUE p_cust_id,
            'order_date'   VALUE TO_CHAR(p_date, 'YYYY-MM-DD"T"HH24:MI:SS.FF3TZH:TZM'),
            'status'       VALUE p_status,
            'total_amount' VALUE p_total,
            'notes'        VALUE p_notes,
            'updated_at'   VALUE TO_CHAR(p_updated, 'YYYY-MM-DD"T"HH24:MI:SS.FF3TZH:TZM')
            RETURNING CLOB
        ) INTO v_json FROM DUAL;
        RETURN v_json;
    END order_to_json;

    FUNCTION order_item_to_json(
        p_id IN NUMBER, p_order_id IN NUMBER, p_prod_id IN NUMBER, 
        p_qty IN NUMBER, p_price IN NUMBER, p_subtotal IN NUMBER
    ) RETURN CLOB IS
        v_json CLOB;
    BEGIN
        SELECT JSON_OBJECT(
            'item_id'    VALUE p_id,
            'order_id'   VALUE p_order_id,
            'product_id' VALUE p_prod_id,
            'quantity'   VALUE p_qty,
            'unit_price' VALUE p_price,
            'subtotal'   VALUE p_subtotal
            RETURNING CLOB
        ) INTO v_json FROM DUAL;
        RETURN v_json;
    END order_item_to_json;

    FUNCTION get_config(p_key IN VARCHAR2, p_default IN VARCHAR2 DEFAULT NULL) RETURN VARCHAR2 IS
        v_val VARCHAR2(255);
    BEGIN
        SELECT param_value INTO v_val FROM TT_CONFIG WHERE param_key = UPPER(p_key);
        RETURN v_val;
    EXCEPTION WHEN NO_DATA_FOUND THEN
        RETURN p_default;
    END get_config;

    PROCEDURE set_config(p_key IN VARCHAR2, p_value IN VARCHAR2) IS
    BEGIN
        MERGE INTO TT_CONFIG c
        USING (SELECT UPPER(p_key) as k, p_value as v FROM DUAL) src
        ON (c.param_key = src.k)
        WHEN MATCHED THEN UPDATE SET param_value = src.v, updated_at = SYSTIMESTAMP
        WHEN NOT MATCHED THEN INSERT (param_key, param_value, updated_at) VALUES (src.k, src.v, SYSTIMESTAMP);
    END set_config;

END TT_CORE_PKG;
/
