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

    PROCEDURE execute_restore(
        p_table_name IN VARCHAR2,
        p_record_pk  IN VARCHAR2,
        p_target_ts  IN TIMESTAMP WITH TIME ZONE,
        p_user_note  IN VARCHAR2 DEFAULT 'Historical restoration'
    );
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
        v_result CLOB;
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

        SELECT JSON_OBJECT(
            'table_name'     VALUE v_tbl,
            'timestamp_1'    VALUE TO_CHAR(p_ts1, 'YYYY-MM-DD"T"HH24:MI:SS.FF3TZH:TZM'),
            'timestamp_2'    VALUE TO_CHAR(p_ts2, 'YYYY-MM-DD"T"HH24:MI:SS.FF3TZH:TZM'),
            'added_count'    VALUE v_added_count,
            'deleted_count'  VALUE v_deleted_count,
            'modified_count' VALUE v_modified_count,
            'changes'        VALUE (CASE WHEN v_changes_json IS NOT NULL THEN JSON_QUERY(v_changes_json, '$' RETURNING CLOB) ELSE JSON_ARRAY(RETURNING CLOB) END)
            RETURNING CLOB
        ) INTO v_result FROM DUAL;

        RETURN v_result;
    END compare_states;

    FUNCTION preview_restore(
        p_table_name IN VARCHAR2,
        p_record_pk  IN VARCHAR2,
        p_target_ts  IN TIMESTAMP WITH TIME ZONE
    ) RETURN CLOB IS
        v_tbl VARCHAR2(60) := UPPER(p_table_name);
        v_historical_json CLOB;
        v_hist_row CLOB := NULL;
        v_current_json CLOB := NULL;
        v_action VARCHAR2(30);
        v_constraint_warning VARCHAR2(500) := 'OK';
        v_can_restore VARCHAR2(5) := 'YES';
    BEGIN
        -- 1. Reconstruct historical target
        v_historical_json := TT_RECONSTRUCTION_PKG.reconstruct_row(v_tbl, p_record_pk, p_target_ts, 'ADAPTIVE');
        SELECT JSON_QUERY(v_historical_json, '$.row_state') INTO v_hist_row FROM DUAL;

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
        ELSIF v_tbl = 'ORDER_ITEMS' THEN
            BEGIN
                SELECT TT_CORE_PKG.order_item_to_json(item_id, order_id, product_id, quantity, unit_price, subtotal)
                INTO v_current_json FROM ORDER_ITEMS WHERE item_id = TO_NUMBER(p_record_pk);
            EXCEPTION WHEN NO_DATA_FOUND THEN v_current_json := NULL; END;
        END IF;

        -- Determine action
        IF v_current_json IS NULL AND v_hist_row IS NOT NULL THEN
            v_action := 'INSERT_HISTORICAL_ROW';
            v_constraint_warning := 'OK';
            v_can_restore := 'YES';
        ELSIF v_current_json IS NOT NULL AND v_hist_row IS NOT NULL THEN
            v_action := 'UPDATE_CURRENT_TO_HISTORICAL';
            v_constraint_warning := 'OK';
            v_can_restore := 'YES';
        ELSIF v_current_json IS NOT NULL AND v_hist_row IS NULL THEN
            v_action := 'DELETE_CURRENT_ROW';
            v_constraint_warning := 'Record did not exist at target timestamp. Restoration will safely remove current record.';
            v_can_restore := 'YES';
        ELSE
            v_action := 'NO_OP';
            v_constraint_warning := 'Record does not exist in either historical or current state.';
            v_can_restore := 'NO';
        END IF;

        RETURN JSON_OBJECT(
            'table_name'          VALUE v_tbl,
            'record_pk'           VALUE p_record_pk,
            'target_timestamp'    VALUE TO_CHAR(p_target_ts, 'YYYY-MM-DD"T"HH24:MI:SS.FF3TZH:TZM'),
            'proposed_action'     VALUE v_action,
            'constraint_warning'  VALUE v_constraint_warning,
            'can_restore'         VALUE v_can_restore,
            'historical_state'    VALUE (CASE WHEN v_hist_row IS NOT NULL THEN JSON_QUERY(v_hist_row, '$') ELSE NULL END),
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
        v_tx_id NUMBER;
        v_row_json CLOB;
        v_hist_row CLOB := NULL;
        v_status VARCHAR2(20) := 'SUCCESS';
        v_message VARCHAR2(500) := 'Restoration applied successfully as a new transaction';
        v_err_msg VARCHAR2(1000);
    BEGIN
        v_tx_id := TT_CORE_PKG.get_or_create_tx('RESTORE_' || v_tbl || '_' || p_record_pk);

        -- Reconstruct row
        v_row_json := TT_RECONSTRUCTION_PKG.reconstruct_row(v_tbl, p_record_pk, p_target_ts, 'ADAPTIVE');
        SELECT JSON_QUERY(v_row_json, '$.row_state') INTO v_hist_row FROM DUAL;

        IF v_hist_row IS NULL THEN
            IF v_tbl = 'CUSTOMERS' THEN
                DELETE FROM CUSTOMERS WHERE customer_id = TO_NUMBER(p_record_pk);
            ELSIF v_tbl = 'PRODUCTS' THEN
                DELETE FROM PRODUCTS WHERE product_id = TO_NUMBER(p_record_pk);
            ELSIF v_tbl = 'ORDERS' THEN
                DELETE FROM ORDERS WHERE order_id = TO_NUMBER(p_record_pk);
            ELSIF v_tbl = 'ORDER_ITEMS' THEN
                DELETE FROM ORDER_ITEMS WHERE item_id = TO_NUMBER(p_record_pk);
            END IF;
            v_message := 'Current record deleted to match historical state (did not exist at target timestamp)';
        ELSE
            IF v_tbl = 'CUSTOMERS' THEN
                FOR r IN (
                    SELECT name, email, phone, status, credit_limit
                    FROM JSON_TABLE(v_hist_row, '$'
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
                    FROM JSON_TABLE(v_hist_row, '$'
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
            ELSIF v_tbl = 'ORDERS' THEN
                FOR r IN (
                    SELECT customer_id, order_date, status, total_amount, notes
                    FROM JSON_TABLE(v_hist_row, '$'
                        COLUMNS (
                            customer_id NUMBER PATH '$.customer_id',
                            order_date VARCHAR2(50) PATH '$.order_date',
                            status VARCHAR2(30) PATH '$.status',
                            total_amount NUMBER(12,2) PATH '$.total_amount',
                            notes VARCHAR2(400) PATH '$.notes'
                        )
                    )
                ) LOOP
                    MERGE INTO ORDERS o
                    USING (SELECT TO_NUMBER(p_record_pk) as id FROM DUAL) s
                    ON (o.order_id = s.id)
                    WHEN MATCHED THEN
                        UPDATE SET o.customer_id = r.customer_id, o.status = r.status,
                                   o.total_amount = r.total_amount, o.notes = r.notes,
                                   o.updated_at = SYSTIMESTAMP
                    WHEN NOT MATCHED THEN
                        INSERT (order_id, customer_id, order_date, status, total_amount, notes, updated_at)
                        VALUES (s.id, r.customer_id, SYSTIMESTAMP, r.status, r.total_amount, r.notes, SYSTIMESTAMP);
                END LOOP;
            ELSIF v_tbl = 'ORDER_ITEMS' THEN
                FOR r IN (
                    SELECT order_id, product_id, quantity, unit_price, subtotal
                    FROM JSON_TABLE(v_hist_row, '$'
                        COLUMNS (
                            order_id NUMBER PATH '$.order_id',
                            product_id NUMBER PATH '$.product_id',
                            quantity NUMBER(6) PATH '$.quantity',
                            unit_price NUMBER(10,2) PATH '$.unit_price',
                            subtotal NUMBER(12,2) PATH '$.subtotal'
                        )
                    )
                ) LOOP
                    MERGE INTO ORDER_ITEMS i
                    USING (SELECT TO_NUMBER(p_record_pk) as id FROM DUAL) s
                    ON (i.item_id = s.id)
                    WHEN MATCHED THEN
                        UPDATE SET i.order_id = r.order_id, i.product_id = r.product_id,
                                   i.quantity = r.quantity, i.unit_price = r.unit_price,
                                   i.subtotal = r.subtotal
                    WHEN NOT MATCHED THEN
                        INSERT (item_id, order_id, product_id, quantity, unit_price, subtotal)
                        VALUES (s.id, r.order_id, r.product_id, r.quantity, r.unit_price, r.subtotal);
                END LOOP;
            END IF;
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
        v_err_msg := SUBSTR(SQLERRM, 1, 900);
        IF v_tx_id IS NOT NULL THEN
            TT_CORE_PKG.mark_tx_rollback(v_tx_id);
        END IF;
        RETURN JSON_OBJECT(
            'status'  VALUE 'FAILED',
            'error'   VALUE v_err_msg,
            'message' VALUE 'Restoration rolled back without partial application'
        );
    END execute_restore;

    PROCEDURE execute_restore(
        p_table_name IN VARCHAR2,
        p_record_pk  IN VARCHAR2,
        p_target_ts  IN TIMESTAMP WITH TIME ZONE,
        p_user_note  IN VARCHAR2 DEFAULT 'Historical restoration'
    ) IS
        v_res CLOB;
    BEGIN
        v_res := execute_restore(p_table_name, p_record_pk, p_target_ts, p_user_note);
    END execute_restore;

END TT_DIFF_RESTORE_PKG;
/
