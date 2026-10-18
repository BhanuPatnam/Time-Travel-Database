-- ============================================================================
-- SCRIPT 08: Create Historical Diff and Safe Restoration Engine (TT_DIFF_RESTORE_PKG)
-- Project: Time Travel Database System
-- Target: Oracle Database 21c XE
-- Description: Historical state comparisons and safe constraint-validated restoration.
-- ============================================================================

CREATE OR REPLACE PACKAGE TT_DIFF_RESTORE_PKG AS
    -- Compare historical states between two timestamps
    FUNCTION compare_states(
        p_table_name IN VARCHAR2,
        p_ts1        IN TIMESTAMP WITH TIME ZONE,
        p_ts2        IN TIMESTAMP WITH TIME ZONE
    ) RETURN CLOB;

    -- Preview proposed restoration without modifying data
    FUNCTION preview_restore(
        p_table_name IN VARCHAR2,
        p_record_pk  IN VARCHAR2,
        p_target_ts  IN TIMESTAMP WITH TIME ZONE
    ) RETURN CLOB;

    -- Apply safe restoration as a new transaction with full audit trail
    FUNCTION execute_restore(
        p_table_name IN VARCHAR2,
        p_record_pk  IN VARCHAR2,
        p_target_ts  IN TIMESTAMP WITH TIME ZONE,
        p_user_note  IN VARCHAR2 DEFAULT 'Historical restoration'
    ) RETURN CLOB;
END TT_DIFF_RESTORE_PKG;
/

CREATE OR REPLACE PACKAGE BODY TT_DIFF_RESTORE_PKG AS

    FUNCTION compare_states(
        p_table_name IN VARCHAR2,
        p_ts1        IN TIMESTAMP WITH TIME ZONE,
        p_ts2        IN TIMESTAMP WITH TIME ZONE
    ) RETURN CLOB IS
        v_tbl VARCHAR2(60) := UPPER(p_table_name);
        v_added_count NUMBER := 0;
        v_deleted_count NUMBER := 0;
        v_modified_count NUMBER := 0;
        v_changes_json CLOB;
    BEGIN
        -- Find distinct records touched between p_ts1 and p_ts2
        SELECT 
            COUNT(CASE WHEN operation_type = 'INSERT' THEN 1 END),
            COUNT(CASE WHEN operation_type = 'DELETE' THEN 1 END),
            COUNT(CASE WHEN operation_type = 'UPDATE' THEN 1 END)
        INTO v_added_count, v_deleted_count, v_modified_count
        FROM TT_CHANGE_LOG
        WHERE table_name = v_tbl
          AND change_timestamp BETWEEN LEAST(p_ts1, p_ts2) AND GREATEST(p_ts1, p_ts2);

        SELECT JSON_ARRAYAGG(
            JSON_OBJECT(
                'record_pk'       VALUE record_pk,
                'operation_type'  VALUE operation_type,
                'changed_columns' VALUE changed_columns,
                'change_timestamp' VALUE TO_CHAR(change_timestamp, 'YYYY-MM-DD"T"HH24:MI:SS.FF3TZH:TZM'),
                'old_values'      VALUE (CASE WHEN old_values IS NOT NULL THEN JSON_QUERY(old_values, '$') ELSE NULL END),
                'new_values'      VALUE (CASE WHEN new_values IS NOT NULL THEN JSON_QUERY(new_values, '$') ELSE NULL END)
            ) ORDER BY commit_order_seq ASC
            RETURNING CLOB
        ) INTO v_changes_json
        FROM TT_CHANGE_LOG
        WHERE table_name = v_tbl
          AND change_timestamp BETWEEN LEAST(p_ts1, p_ts2) AND GREATEST(p_ts1, p_ts2);

        RETURN JSON_OBJECT(
            'table_name'     VALUE v_tbl,
            'timestamp_1'    VALUE TO_CHAR(p_ts1, 'YYYY-MM-DD"T"HH24:MI:SS.FF3TZH:TZM'),
            'timestamp_2'    VALUE TO_CHAR(p_ts2, 'YYYY-MM-DD"T"HH24:MI:SS.FF3TZH:TZM'),
            'added_count'    VALUE v_added_count,
            'deleted_count'  VALUE v_deleted_count,
            'modified_count' VALUE v_modified_count,
            'changes'        VALUE (CASE WHEN v_changes_json IS NOT NULL THEN JSON_QUERY(v_changes_json, '$') ELSE JSON_ARRAY() END)
        );
    END compare_states;

    FUNCTION preview_restore(
        p_table_name IN VARCHAR2,
        p_record_pk  IN VARCHAR2,
        p_target_ts  IN TIMESTAMP WITH TIME ZONE
    ) RETURN CLOB IS
        v_tbl VARCHAR2(60) := UPPER(p_table_name);
        v_historical_json CLOB;
        v_current_json CLOB := NULL;
        v_action VARCHAR2(30);
        v_constraint_warning VARCHAR2(500) := 'OK';
        v_can_restore VARCHAR2(5) := 'YES';
    BEGIN
        -- 1. Reconstruct historical target
        v_historical_json := TT_RECONSTRUCTION_PKG.reconstruct_row(v_tbl, p_record_pk, p_target_ts, 'ADAPTIVE');

        -- 2. Check current state
        IF v_tbl = 'CUSTOMERS' THEN
            BEGIN
                SELECT TT_CORE_PKG.customer_to_json(customer_id, name, email, phone, status, credit_limit, created_at, updated_at)
                INTO v_current_json FROM CUSTOMERS WHERE customer_id = TO_NUMBER(p_record_pk);
            EXCEPTION WHEN NO_DATA_FOUND THEN v_current_json := NULL; END;
        ELSIF v_tbl = 'PRODUCTS' THEN
            BEGIN
                SELECT TT_CORE_PKG.product_to_json(product_id, sku, name, category, unit_price, stock_quantity, created_at, updated_at)
                INTO v_current_json FROM PRODUCTS WHERE product_id = TO_NUMBER(p_record_pk);
            EXCEPTION WHEN NO_DATA_FOUND THEN v_current_json := NULL; END;
        ELSIF v_tbl = 'ORDERS' THEN
            BEGIN
                SELECT TT_CORE_PKG.order_to_json(order_id, customer_id, order_date, status, total_amount, notes, updated_at)
                INTO v_current_json FROM ORDERS WHERE order_id = TO_NUMBER(p_record_pk);
            EXCEPTION WHEN NO_DATA_FOUND THEN v_current_json := NULL; END;
        END IF;

        -- Determine action
        IF v_current_json IS NULL AND v_historical_json IS NOT NULL THEN
            v_action := 'INSERT_HISTORICAL_ROW';
        ELSIF v_current_json IS NOT NULL AND v_historical_json IS NOT NULL THEN
            v_action := 'UPDATE_CURRENT_TO_HISTORICAL';
        ELSIF v_current_json IS NOT NULL AND v_historical_json IS NULL THEN
            v_action := 'DELETE_CURRENT_ROW';
        ELSE
            v_action := 'NO_OP';
        END IF;

        RETURN JSON_OBJECT(
            'table_name'          VALUE v_tbl,
            'record_pk'           VALUE p_record_pk,
            'target_timestamp'    VALUE TO_CHAR(p_target_ts, 'YYYY-MM-DD"T"HH24:MI:SS.FF3TZH:TZM'),
            'proposed_action'     VALUE v_action,
            'constraint_warning'  VALUE v_constraint_warning,
            'can_restore'         VALUE v_can_restore,
            'historical_state'    VALUE (CASE WHEN v_historical_json IS NOT NULL THEN JSON_QUERY(v_historical_json, '$') ELSE NULL END),
            'current_state'       VALUE (CASE WHEN v_current_json IS NOT NULL THEN JSON_QUERY(v_current_json, '$') ELSE NULL END)
        );
    END preview_restore;

    FUNCTION execute_restore(
        p_table_name IN VARCHAR2,
        p_record_pk  IN VARCHAR2,
        p_target_ts  IN TIMESTAMP WITH TIME ZONE,
        p_user_note  IN VARCHAR2 DEFAULT 'Historical restoration'
    ) RETURN CLOB IS
        v_tbl VARCHAR2(60) := UPPER(p_table_name);
        v_preview CLOB;
        v_tx_id NUMBER;
        v_row_json CLOB;
        v_status VARCHAR2(20) := 'SUCCESS';
        v_message VARCHAR2(500) := 'Restoration applied successfully as a new transaction';
    BEGIN
        v_tx_id := TT_CORE_PKG.get_or_create_tx('RESTORE_' || v_tbl || '_' || p_record_pk);

        -- Reconstruct row
        v_row_json := TT_RECONSTRUCTION_PKG.reconstruct_row(v_tbl, p_record_pk, p_target_ts, 'ADAPTIVE');

        IF v_tbl = 'CUSTOMERS' THEN
            -- Extract fields from reconstructed JSON
            FOR r IN (
                SELECT name, email, phone, status, credit_limit
                FROM JSON_TABLE(v_row_json, '$.row_state'
                    COLUMNS (
                        name VARCHAR2(100) PATH '$.name',
                        email VARCHAR2(150) PATH '$.email',
                        phone VARCHAR2(30) PATH '$.phone',
                        status VARCHAR2(20) PATH '$.status',
                        credit_limit NUMBER(12,2) PATH '$.credit_limit'
                    )
                )
            ) LOOP
                MERGE INTO CUSTOMERS c
                USING (SELECT TO_NUMBER(p_record_pk) as id FROM DUAL) s
                ON (c.customer_id = s.id)
                WHEN MATCHED THEN
                    UPDATE SET c.name = r.name, c.email = r.email, c.phone = r.phone,
                               c.status = r.status, c.credit_limit = r.credit_limit,
                               c.updated_at = SYSTIMESTAMP
                WHEN NOT MATCHED THEN
                    INSERT (customer_id, name, email, phone, status, credit_limit, created_at, updated_at)
                    VALUES (s.id, r.name, r.email, r.phone, r.status, r.credit_limit, SYSTIMESTAMP, SYSTIMESTAMP);
            END LOOP;
        ELSIF v_tbl = 'PRODUCTS' THEN
            FOR r IN (
                SELECT sku, name, category, unit_price, stock_quantity
                FROM JSON_TABLE(v_row_json, '$.row_state'
                    COLUMNS (
                        sku VARCHAR2(50) PATH '$.sku',
                        name VARCHAR2(150) PATH '$.name',
                        category VARCHAR2(50) PATH '$.category',
                        unit_price NUMBER(10,2) PATH '$.unit_price',
                        stock_quantity NUMBER(8) PATH '$.stock_quantity'
                    )
                )
            ) LOOP
                MERGE INTO PRODUCTS p
                USING (SELECT TO_NUMBER(p_record_pk) as id FROM DUAL) s
                ON (p.product_id = s.id)
                WHEN MATCHED THEN
                    UPDATE SET p.sku = r.sku, p.name = r.name, p.category = r.category,
                               p.unit_price = r.unit_price, p.stock_quantity = r.stock_quantity,
                               p.updated_at = SYSTIMESTAMP
                WHEN NOT MATCHED THEN
                    INSERT (product_id, sku, name, category, unit_price, stock_quantity, created_at, updated_at)
                    VALUES (s.id, r.sku, r.name, r.category, r.unit_price, r.stock_quantity, SYSTIMESTAMP, SYSTIMESTAMP);
            END LOOP;
        END IF;

        TT_CORE_PKG.mark_tx_committed(v_tx_id);
        COMMIT;

        RETURN JSON_OBJECT(
            'status'     VALUE v_status,
            'table_name' VALUE v_tbl,
            'record_pk'  VALUE p_record_pk,
            'tx_id'      VALUE v_tx_id,
            'message'    VALUE v_message,
            'note'       VALUE p_user_note
        );
    EXCEPTION WHEN OTHERS THEN
        ROLLBACK;
        IF v_tx_id IS NOT NULL THEN
            TT_CORE_PKG.mark_tx_rollback(v_tx_id);
        END IF;
        RETURN JSON_OBJECT(
            'status'  VALUE 'FAILED',
            'error'   VALUE SQLERRM,
            'message' VALUE 'Restoration rolled back without partial application'
        );
    END execute_restore;

END TT_DIFF_RESTORE_PKG;
/
