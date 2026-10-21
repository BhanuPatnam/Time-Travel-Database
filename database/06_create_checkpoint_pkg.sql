-- ============================================================================
-- SCRIPT 06b: Create Checkpoint Package (TT_CHECKPOINT_PKG)
-- Project: Time Travel Database System
-- Target: Oracle Database 21c XE
-- Description: Checkpoint creation, transaction boundaries, and adaptive policies.
-- ============================================================================

CREATE OR REPLACE PACKAGE TT_CHECKPOINT_PKG AS
    -- Core checkpoint routines
    FUNCTION create_checkpoint(
        p_table_name IN VARCHAR2,
        p_strategy   IN VARCHAR2 DEFAULT 'MANUAL',
        p_reason     IN VARCHAR2 DEFAULT 'Manual request'
    ) RETURN NUMBER;

    PROCEDURE create_checkpoint(
        p_table_name IN VARCHAR2,
        p_strategy   IN VARCHAR2 DEFAULT 'MANUAL',
        p_reason     IN VARCHAR2 DEFAULT 'Manual request'
    );

    -- Adaptive & Fixed-Interval Policy evaluation
    FUNCTION evaluate_adaptive_policy(p_table_name IN VARCHAR2) RETURN VARCHAR2;
    FUNCTION evaluate_fixed_interval_policy(p_table_name IN VARCHAR2) RETURN VARCHAR2;

    -- Lookup
    PROCEDURE get_latest_valid_checkpoint(
        p_table_name     IN VARCHAR2,
        p_target_ts      IN TIMESTAMP WITH TIME ZONE,
        o_checkpoint_id  OUT NUMBER,
        o_boundary_ts    OUT TIMESTAMP WITH TIME ZONE,
        o_boundary_seq   OUT NUMBER
    );

    -- Maintenance & storage
    FUNCTION get_total_checkpoint_storage_bytes RETURN NUMBER;
    PROCEDURE purge_old_checkpoints(p_keep_count IN NUMBER DEFAULT 10);
END TT_CHECKPOINT_PKG;
/

CREATE OR REPLACE PACKAGE BODY TT_CHECKPOINT_PKG AS

    FUNCTION create_checkpoint(
        p_table_name IN VARCHAR2,
        p_strategy   IN VARCHAR2 DEFAULT 'MANUAL',
        p_reason     IN VARCHAR2 DEFAULT 'Manual request'
    ) RETURN NUMBER IS
        PRAGMA AUTONOMOUS_TRANSACTION;
        v_cp_id NUMBER;
        v_start_time NUMBER;
        v_end_time NUMBER;
        v_boundary_ts TIMESTAMP WITH TIME ZONE;
        v_max_tx_id NUMBER;
        v_max_change_id NUMBER;
        v_row_count NUMBER := 0;
        v_storage_bytes NUMBER := 0;
        v_tbl VARCHAR2(60) := UPPER(p_table_name);
        v_sqlerrm VARCHAR2(1000);
    BEGIN
        v_start_time := DBMS_UTILITY.GET_TIME;
        v_boundary_ts := SYSTIMESTAMP;
        v_cp_id := TT_CHECKPOINT_SEQ.NEXTVAL;

        -- Capture consistent boundary markers
        SELECT NVL(MAX(tx_id), 0) INTO v_max_tx_id 
        FROM TT_TRANSACTIONS 
        WHERE status = 'COMMITTED' AND started_at <= v_boundary_ts;

        SELECT NVL(MAX(change_id), 0) INTO v_max_change_id 
        FROM TT_CHANGE_LOG 
        WHERE change_timestamp <= v_boundary_ts;

        -- Insert IN_PROGRESS record (never exposed as valid while running)
        INSERT INTO TT_CHECKPOINTS (
            checkpoint_id, checkpoint_name, table_name,
            target_boundary_ts, boundary_tx_id, boundary_change_id,
            strategy_used, status, row_count, storage_bytes,
            creation_duration_ms, decision_reason, created_at
        ) VALUES (
            v_cp_id, 'CP_' || v_tbl || '_' || TO_CHAR(SYSTIMESTAMP, 'YYYYMMDD_HH24MISS'),
            v_tbl, v_boundary_ts, v_max_tx_id, v_max_change_id,
            p_strategy, 'IN_PROGRESS', 0, 0,
            0, p_reason, SYSTIMESTAMP
        );

        -- Materialize table snapshots
        IF v_tbl = 'CUSTOMERS' OR v_tbl = '__ALL__' THEN
            FOR r IN (SELECT customer_id, name, email, phone, status, credit_limit, created_at, updated_at FROM CUSTOMERS) LOOP
                INSERT INTO TT_CHECKPOINT_DATA (
                    data_id, checkpoint_id, table_name, record_pk, row_data, created_at
                ) VALUES (
                    TT_CP_DATA_SEQ.NEXTVAL, v_cp_id, 'CUSTOMERS', TO_CHAR(r.customer_id),
                    TT_CORE_PKG.customer_to_json(r.customer_id, r.name, r.email, r.phone, r.status, r.credit_limit, r.created_at, r.updated_at),
                    v_boundary_ts
                );
                v_row_count := v_row_count + 1;
            END LOOP;
        END IF;

        IF v_tbl = 'PRODUCTS' OR v_tbl = '__ALL__' THEN
            FOR r IN (SELECT product_id, sku, name, category, unit_price, stock_quantity, created_at, updated_at FROM PRODUCTS) LOOP
                INSERT INTO TT_CHECKPOINT_DATA (
                    data_id, checkpoint_id, table_name, record_pk, row_data, created_at
                ) VALUES (
                    TT_CP_DATA_SEQ.NEXTVAL, v_cp_id, 'PRODUCTS', TO_CHAR(r.product_id),
                    TT_CORE_PKG.product_to_json(r.product_id, r.sku, r.name, r.category, r.unit_price, r.stock_quantity, r.created_at, r.updated_at),
                    v_boundary_ts
                );
                v_row_count := v_row_count + 1;
            END LOOP;
        END IF;

        IF v_tbl = 'ORDERS' OR v_tbl = '__ALL__' THEN
            FOR r IN (SELECT order_id, customer_id, order_date, status, total_amount, notes, updated_at FROM ORDERS) LOOP
                INSERT INTO TT_CHECKPOINT_DATA (
                    data_id, checkpoint_id, table_name, record_pk, row_data, created_at
                ) VALUES (
                    TT_CP_DATA_SEQ.NEXTVAL, v_cp_id, 'ORDERS', TO_CHAR(r.order_id),
                    TT_CORE_PKG.order_to_json(r.order_id, r.customer_id, r.order_date, r.status, r.total_amount, r.notes, r.updated_at),
                    v_boundary_ts
                );
                v_row_count := v_row_count + 1;
            END LOOP;
        END IF;

        IF v_tbl = 'ORDER_ITEMS' OR v_tbl = '__ALL__' THEN
            FOR r IN (SELECT item_id, order_id, product_id, quantity, unit_price, subtotal FROM ORDER_ITEMS) LOOP
                INSERT INTO TT_CHECKPOINT_DATA (
                    data_id, checkpoint_id, table_name, record_pk, row_data, created_at
                ) VALUES (
                    TT_CP_DATA_SEQ.NEXTVAL, v_cp_id, 'ORDER_ITEMS', TO_CHAR(r.item_id),
                    TT_CORE_PKG.order_item_to_json(r.item_id, r.order_id, r.product_id, r.quantity, r.unit_price, r.subtotal),
                    v_boundary_ts
                );
                v_row_count := v_row_count + 1;
            END LOOP;
        END IF;

        v_end_time := DBMS_UTILITY.GET_TIME;
        
        -- Compute storage estimate
        SELECT NVL(SUM(DBMS_LOB.GETLENGTH(row_data)), 0) + (COUNT(*) * 64)
        INTO v_storage_bytes
        FROM TT_CHECKPOINT_DATA
        WHERE checkpoint_id = v_cp_id;

        -- Transition state atomically to VALID
        UPDATE TT_CHECKPOINTS
        SET status = 'VALID',
            row_count = v_row_count,
            storage_bytes = v_storage_bytes,
            creation_duration_ms = (v_end_time - v_start_time) * 10
        WHERE checkpoint_id = v_cp_id;

        COMMIT;
        RETURN v_cp_id;

    EXCEPTION WHEN OTHERS THEN
        ROLLBACK;
        v_sqlerrm := SUBSTR(SQLERRM, 1, 900);
        UPDATE TT_CHECKPOINTS
        SET status = 'FAILED',
            decision_reason = 'Error: ' || v_sqlerrm
        WHERE checkpoint_id = v_cp_id;
        COMMIT;
        RAISE;
    END create_checkpoint;

    PROCEDURE create_checkpoint(
        p_table_name IN VARCHAR2,
        p_strategy   IN VARCHAR2 DEFAULT 'MANUAL',
        p_reason     IN VARCHAR2 DEFAULT 'Manual request'
    ) IS
        v_id NUMBER;
    BEGIN
        v_id := create_checkpoint(p_table_name, p_strategy, p_reason);
    END create_checkpoint;

    PROCEDURE get_latest_valid_checkpoint(
        p_table_name     IN VARCHAR2,
        p_target_ts      IN TIMESTAMP WITH TIME ZONE,
        o_checkpoint_id  OUT NUMBER,
        o_boundary_ts    OUT TIMESTAMP WITH TIME ZONE,
        o_boundary_seq   OUT NUMBER
    ) IS
    BEGIN
        SELECT checkpoint_id, target_boundary_ts, boundary_change_id
        INTO o_checkpoint_id, o_boundary_ts, o_boundary_seq
        FROM (
            SELECT checkpoint_id, target_boundary_ts, boundary_change_id
            FROM TT_CHECKPOINTS
            WHERE (table_name = UPPER(p_table_name) OR table_name = '__ALL__')
              AND status = 'VALID'
              AND target_boundary_ts <= p_target_ts
            ORDER BY target_boundary_ts DESC, checkpoint_id DESC
        )
        WHERE ROWNUM = 1;
    EXCEPTION WHEN NO_DATA_FOUND THEN
        o_checkpoint_id := NULL;
        o_boundary_ts := NULL;
        o_boundary_seq := 0;
    END get_latest_valid_checkpoint;

    FUNCTION get_total_checkpoint_storage_bytes RETURN NUMBER IS
        v_total NUMBER := 0;
    BEGIN
        SELECT NVL(SUM(storage_bytes), 0) INTO v_total FROM TT_CHECKPOINTS WHERE status = 'VALID';
        RETURN v_total;
    END get_total_checkpoint_storage_bytes;

    FUNCTION evaluate_adaptive_policy(p_table_name IN VARCHAR2) RETURN VARCHAR2 IS
        PRAGMA AUTONOMOUS_TRANSACTION;
        v_tbl VARCHAR2(60) := UPPER(p_table_name);
        v_last_cp_ts TIMESTAMP WITH TIME ZONE;
        v_changes_since_last NUMBER := 0;
        v_estimated_cost_ms NUMBER(10,3) := 0.0;
        v_query_freq NUMBER := 0;
        v_storage_used_bytes NUMBER := 0;
        v_storage_used_mb NUMBER(10,2) := 0.0;
        v_storage_budget_mb NUMBER(10,2);
        v_change_thresh NUMBER;
        v_cost_thresh NUMBER(10,3);
        v_freq_thresh NUMBER;
        v_decision_id NUMBER;
        v_action VARCHAR2(30);
        v_reason VARCHAR2(1000);
        v_new_cp_id NUMBER := NULL;
    BEGIN
        -- Load config thresholds
        v_change_thresh := TO_NUMBER(TT_CORE_PKG.get_config('ADAPTIVE_CHANGE_THRESHOLD', '25'));
        v_cost_thresh := TO_NUMBER(TT_CORE_PKG.get_config('ADAPTIVE_REPLAY_COST_THRESHOLD_MS', '12.0'));
        v_freq_thresh := TO_NUMBER(TT_CORE_PKG.get_config('ADAPTIVE_QUERY_FREQ_THRESHOLD', '3'));
        v_storage_budget_mb := TO_NUMBER(TT_CORE_PKG.get_config('STORAGE_BUDGET_MB', '250'));

        -- Determine last checkpoint timestamp
        BEGIN
            SELECT MAX(target_boundary_ts) INTO v_last_cp_ts
            FROM TT_CHECKPOINTS
            WHERE (table_name = v_tbl OR table_name = '__ALL__') AND status = 'VALID';
        EXCEPTION WHEN OTHERS THEN
            v_last_cp_ts := NULL;
        END;

        -- Count changes since last checkpoint
        IF v_last_cp_ts IS NULL THEN
            SELECT COUNT(*) INTO v_changes_since_last 
            FROM TT_CHANGE_LOG 
            WHERE table_name = v_tbl;
        ELSE
            SELECT COUNT(*) INTO v_changes_since_last 
            FROM TT_CHANGE_LOG 
            WHERE table_name = v_tbl AND change_timestamp > v_last_cp_ts;
        END IF;

        -- Historical query frequency in the last 60 minutes
        SELECT COUNT(*) INTO v_query_freq
        FROM TT_QUERY_METRICS
        WHERE table_name = v_tbl 
          AND queried_at >= SYSTIMESTAMP - INTERVAL '1' HOUR;

        -- Workload cost model: average 0.45ms per change replayed in PL/SQL
        v_estimated_cost_ms := v_changes_since_last * 0.45;

        -- Calculate current storage usage
        v_storage_used_bytes := get_total_checkpoint_storage_bytes();
        v_storage_used_mb := ROUND(v_storage_used_bytes / (1024 * 1024), 2);

        -- Deterministic Decision Tree
        IF v_storage_used_mb >= v_storage_budget_mb THEN
            v_action := 'SKIPPED_STORAGE_LIMIT';
            v_reason := 'Storage limit reached (' || v_storage_used_mb || ' MB / ' || v_storage_budget_mb || ' MB). Checkpoint creation skipped.';
        ELSIF v_changes_since_last >= v_change_thresh AND 
              (v_estimated_cost_ms >= v_cost_thresh OR v_query_freq >= v_freq_thresh) THEN
            v_action := 'CHECKPOINT_CREATED';
            v_reason := 'Adaptive trigger met: ' || v_changes_since_last || ' changes since last checkpoint (threshold: ' 
                        || v_change_thresh || '), estimated replay cost: ' || v_estimated_cost_ms 
                        || ' ms (threshold: ' || v_cost_thresh || ' ms), query frequency: ' 
                        || v_query_freq || ' (threshold: ' || v_freq_thresh || ').';
            v_new_cp_id := create_checkpoint(v_tbl, 'ADAPTIVE', v_reason);
        ELSE
            v_action := 'SKIPPED_BELOW_THRESHOLD';
            v_reason := 'Changes (' || v_changes_since_last || '/' || v_change_thresh 
                        || ') and cost (' || v_estimated_cost_ms || 'ms/' || v_cost_thresh 
                        || 'ms) remain below trigger threshold. Replay is more cost-effective.';
        END IF;

        -- Log auditable policy decision
        v_decision_id := TT_POLICY_DECISION_SEQ.NEXTVAL;
        INSERT INTO TT_POLICY_DECISIONS (
            decision_id, evaluated_at, table_name,
            changes_since_last_cp, estimated_replay_cost_ms,
            historical_query_freq, storage_used_mb, storage_budget_mb,
            action_taken, decision_reason, checkpoint_id
        ) VALUES (
            v_decision_id, SYSTIMESTAMP, v_tbl,
            v_changes_since_last, v_estimated_cost_ms,
            v_query_freq, v_storage_used_mb, v_storage_budget_mb,
            v_action, v_reason, v_new_cp_id
        );
        COMMIT;

        RETURN v_action;
    END evaluate_adaptive_policy;

    FUNCTION evaluate_fixed_interval_policy(p_table_name IN VARCHAR2) RETURN VARCHAR2 IS
        PRAGMA AUTONOMOUS_TRANSACTION;
        v_tbl VARCHAR2(60) := UPPER(p_table_name);
        v_last_cp_ts TIMESTAMP WITH TIME ZONE;
        v_changes_since_last NUMBER := 0;
        v_fixed_interval NUMBER;
        v_action VARCHAR2(30);
        v_reason VARCHAR2(1000);
        v_new_cp_id NUMBER := NULL;
        v_decision_id NUMBER;
    BEGIN
        v_fixed_interval := TO_NUMBER(TT_CORE_PKG.get_config('FIXED_INTERVAL_CHANGES', '50'));

        BEGIN
            SELECT MAX(target_boundary_ts) INTO v_last_cp_ts
            FROM TT_CHECKPOINTS
            WHERE (table_name = v_tbl OR table_name = '__ALL__') AND status = 'VALID';
        EXCEPTION WHEN OTHERS THEN
            v_last_cp_ts := NULL;
        END;

        IF v_last_cp_ts IS NULL THEN
            SELECT COUNT(*) INTO v_changes_since_last FROM TT_CHANGE_LOG WHERE table_name = v_tbl;
        ELSE
            SELECT COUNT(*) INTO v_changes_since_last FROM TT_CHANGE_LOG WHERE table_name = v_tbl AND change_timestamp > v_last_cp_ts;
        END IF;

        IF v_changes_since_last >= v_fixed_interval THEN
            v_action := 'CHECKPOINT_CREATED';
            v_reason := 'Fixed interval threshold reached: ' || v_changes_since_last || ' >= ' || v_fixed_interval || ' changes.';
            v_new_cp_id := create_checkpoint(v_tbl, 'FIXED_INTERVAL', v_reason);
        ELSE
            v_action := 'SKIPPED_BELOW_THRESHOLD';
            v_reason := 'Changes (' || v_changes_since_last || '/' || v_fixed_interval || ') below fixed interval.';
        END IF;

        v_decision_id := TT_POLICY_DECISION_SEQ.NEXTVAL;
        INSERT INTO TT_POLICY_DECISIONS (
            decision_id, evaluated_at, table_name,
            changes_since_last_cp, estimated_replay_cost_ms,
            historical_query_freq, storage_used_mb, storage_budget_mb,
            action_taken, decision_reason, checkpoint_id
        ) VALUES (
            v_decision_id, SYSTIMESTAMP, v_tbl,
            v_changes_since_last, v_changes_since_last * 0.45,
            0, 0, 0, v_action, v_reason, v_new_cp_id
        );
        COMMIT;

        RETURN v_action;
    END evaluate_fixed_interval_policy;

    PROCEDURE purge_old_checkpoints(p_keep_count IN NUMBER DEFAULT 10) IS
    BEGIN
        DELETE FROM TT_CHECKPOINTS
        WHERE checkpoint_id NOT IN (
            SELECT checkpoint_id FROM (
                SELECT checkpoint_id FROM TT_CHECKPOINTS ORDER BY target_boundary_ts DESC
            ) WHERE ROWNUM <= p_keep_count
        );
        COMMIT;
    END purge_old_checkpoints;

END TT_CHECKPOINT_PKG;
/
