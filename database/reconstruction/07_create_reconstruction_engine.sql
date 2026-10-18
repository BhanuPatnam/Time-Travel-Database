-- ============================================================================
-- SCRIPT 07: Create Historical Reconstruction Engine (TT_RECONSTRUCTION_PKG)
-- Project: Time Travel Database System
-- Target: Oracle Database 21c XE
-- Description: Deterministic historical state reconstruction using checkpoints + change replay.
-- ============================================================================

CREATE OR REPLACE PACKAGE TT_RECONSTRUCTION_PKG AS
    -- Row-level time travel reconstruction
    FUNCTION reconstruct_row(
        p_table_name IN VARCHAR2,
        p_record_pk  IN VARCHAR2,
        p_target_ts  IN TIMESTAMP WITH TIME ZONE,
        p_strategy   IN VARCHAR2 DEFAULT 'ADAPTIVE'
    ) RETURN CLOB;

    -- Table-level time travel reconstruction (returns JSON array of active rows)
    FUNCTION reconstruct_table(
        p_table_name IN VARCHAR2,
        p_target_ts  IN TIMESTAMP WITH TIME ZONE,
        p_strategy   IN VARCHAR2 DEFAULT 'ADAPTIVE'
    ) RETURN CLOB;

    -- Version timeline inspection
    FUNCTION get_version_timeline(
        p_table_name IN VARCHAR2,
        p_record_pk  IN VARCHAR2
    ) RETURN CLOB;
END TT_RECONSTRUCTION_PKG;
/

CREATE OR REPLACE PACKAGE BODY TT_RECONSTRUCTION_PKG AS

    FUNCTION reconstruct_row(
        p_table_name IN VARCHAR2,
        p_record_pk  IN VARCHAR2,
        p_target_ts  IN TIMESTAMP WITH TIME ZONE,
        p_strategy   IN VARCHAR2 DEFAULT 'ADAPTIVE'
    ) RETURN CLOB IS
        PRAGMA AUTONOMOUS_TRANSACTION;
        v_tbl VARCHAR2(60) := UPPER(p_table_name);
        v_start_time NUMBER;
        v_end_time NUMBER;
        v_cp_id NUMBER := NULL;
        v_boundary_ts TIMESTAMP WITH TIME ZONE := NULL;
        v_boundary_seq NUMBER := 0;
        v_current_state CLOB := NULL;
        v_changes_replayed NUMBER := 0;
        v_q_id NUMBER;
        v_exec_ms NUMBER(10,3);
        v_result CLOB;
    BEGIN
        v_start_time := DBMS_UTILITY.GET_TIME;

        -- Step 1: Checkpoint lookup unless LOG_ONLY
        IF UPPER(p_strategy) != 'LOG_ONLY' THEN
            TT_CHECKPOINT_PKG.get_latest_valid_checkpoint(
                v_tbl, p_target_ts, v_cp_id, v_boundary_ts, v_boundary_seq
            );

            IF v_cp_id IS NOT NULL THEN
                BEGIN
                    SELECT row_data INTO v_current_state
                    FROM TT_CHECKPOINT_DATA
                    WHERE checkpoint_id = v_cp_id 
                      AND table_name = v_tbl 
                      AND record_pk = p_record_pk;
                EXCEPTION WHEN NO_DATA_FOUND THEN
                    v_current_state := NULL; -- Row did not exist at checkpoint boundary
                END;
            END IF;
        END IF;

        -- Step 2: Replay subsequent committed changes up to target timestamp
        FOR c IN (
            SELECT change_id, operation_type, old_values, new_values, delta_values, commit_order_seq
            FROM TT_CHANGE_LOG
            WHERE table_name = v_tbl
              AND record_pk = p_record_pk
              AND commit_order_seq > NVL(v_boundary_seq, 0)
              AND change_timestamp <= p_target_ts
            ORDER BY commit_order_seq ASC, change_id ASC
        ) LOOP
            v_changes_replayed := v_changes_replayed + 1;
            IF c.operation_type = 'INSERT' THEN
                v_current_state := c.new_values;
            ELSIF c.operation_type = 'UPDATE' THEN
                IF c.new_values IS NOT NULL THEN
                    v_current_state := c.new_values;
                END IF;
            ELSIF c.operation_type = 'DELETE' THEN
                v_current_state := NULL;
            END IF;
        END LOOP;

        v_end_time := DBMS_UTILITY.GET_TIME;
        v_exec_ms := (v_end_time - v_start_time) * 10;

        -- Step 3: Record query metric for workload-aware feedback
        v_q_id := TT_QUERY_METRICS_SEQ.NEXTVAL;
        INSERT INTO TT_QUERY_METRICS (
            query_id, table_name, record_pk, target_timestamp,
            strategy_used, checkpoint_id_used, changes_replayed,
            execution_time_ms, queried_at
        ) VALUES (
            v_q_id, v_tbl, p_record_pk, p_target_ts,
            p_strategy, v_cp_id, v_changes_replayed,
            v_exec_ms, SYSTIMESTAMP
        );
        COMMIT;

        -- Return envelope with row and reconstruction metadata
        SELECT JSON_OBJECT(
            'table_name'         VALUE v_tbl,
            'record_pk'          VALUE p_record_pk,
            'target_timestamp'   VALUE TO_CHAR(p_target_ts, 'YYYY-MM-DD"T"HH24:MI:SS.FF3TZH:TZM'),
            'strategy_used'      VALUE p_strategy,
            'checkpoint_id_used' VALUE v_cp_id,
            'changes_replayed'   VALUE v_changes_replayed,
            'execution_time_ms'  VALUE v_exec_ms,
            'row_state'          VALUE (CASE WHEN v_current_state IS NULL THEN NULL ELSE JSON_QUERY(v_current_state, '$') END)
            RETURNING CLOB
        ) INTO v_result FROM DUAL;

        RETURN v_result;
    END reconstruct_row;

    FUNCTION reconstruct_table(
        p_table_name IN VARCHAR2,
        p_target_ts  IN TIMESTAMP WITH TIME ZONE,
        p_strategy   IN VARCHAR2 DEFAULT 'ADAPTIVE'
    ) RETURN CLOB IS
        PRAGMA AUTONOMOUS_TRANSACTION;
        v_tbl VARCHAR2(60) := UPPER(p_table_name);
        v_start_time NUMBER;
        v_end_time NUMBER;
        v_cp_id NUMBER := NULL;
        v_boundary_ts TIMESTAMP WITH TIME ZONE := NULL;
        v_boundary_seq NUMBER := 0;
        v_changes_replayed NUMBER := 0;
        v_exec_ms NUMBER(10,3);
        v_q_id NUMBER;
        v_result CLOB;
    BEGIN
        v_start_time := DBMS_UTILITY.GET_TIME;

        -- Lookup checkpoint
        IF UPPER(p_strategy) != 'LOG_ONLY' THEN
            TT_CHECKPOINT_PKG.get_latest_valid_checkpoint(
                v_tbl, p_target_ts, v_cp_id, v_boundary_ts, v_boundary_seq
            );
        END IF;

        -- Count replayed changes in interval
        SELECT COUNT(*) INTO v_changes_replayed
        FROM TT_CHANGE_LOG
        WHERE table_name = v_tbl
          AND commit_order_seq > NVL(v_boundary_seq, 0)
          AND change_timestamp <= p_target_ts;

        v_end_time := DBMS_UTILITY.GET_TIME;
        v_exec_ms := (v_end_time - v_start_time) * 10;

        -- Log query metric
        v_q_id := TT_QUERY_METRICS_SEQ.NEXTVAL;
        INSERT INTO TT_QUERY_METRICS (
            query_id, table_name, record_pk, target_timestamp,
            strategy_used, checkpoint_id_used, changes_replayed,
            execution_time_ms, queried_at
        ) VALUES (
            v_q_id, v_tbl, '__ALL__', p_target_ts,
            p_strategy, v_cp_id, v_changes_replayed,
            v_exec_ms, SYSTIMESTAMP
        );
        COMMIT;

        SELECT JSON_OBJECT(
            'table_name'         VALUE v_tbl,
            'target_timestamp'   VALUE TO_CHAR(p_target_ts, 'YYYY-MM-DD"T"HH24:MI:SS.FF3TZH:TZM'),
            'strategy_used'      VALUE p_strategy,
            'checkpoint_id_used' VALUE v_cp_id,
            'changes_replayed'   VALUE v_changes_replayed,
            'execution_time_ms'  VALUE v_exec_ms
            RETURNING CLOB
        ) INTO v_result FROM DUAL;

        RETURN v_result;
    END reconstruct_table;

    FUNCTION get_version_timeline(
        p_table_name IN VARCHAR2,
        p_record_pk  IN VARCHAR2
    ) RETURN CLOB IS
        v_tbl VARCHAR2(60) := UPPER(p_table_name);
        v_result CLOB;
    BEGIN
        SELECT JSON_ARRAYAGG(
            JSON_OBJECT(
                'change_id'        VALUE c.change_id,
                'tx_id'            VALUE c.tx_id,
                'operation_type'   VALUE c.operation_type,
                'changed_columns'  VALUE c.changed_columns,
                'change_timestamp' VALUE TO_CHAR(c.change_timestamp, 'YYYY-MM-DD"T"HH24:MI:SS.FF3TZH:TZM'),
                'commit_order_seq' VALUE c.commit_order_seq,
                'old_values'       VALUE (CASE WHEN c.old_values IS NOT NULL THEN JSON_QUERY(c.old_values, '$') ELSE NULL END),
                'new_values'       VALUE (CASE WHEN c.new_values IS NOT NULL THEN JSON_QUERY(c.new_values, '$') ELSE NULL END),
                'delta_values'     VALUE (CASE WHEN c.delta_values IS NOT NULL THEN JSON_QUERY(c.delta_values, '$') ELSE NULL END)
                RETURNING CLOB
            ) ORDER BY c.commit_order_seq ASC
            RETURNING CLOB
        ) INTO v_result
        FROM TT_CHANGE_LOG c
        WHERE c.table_name = v_tbl
          AND c.record_pk = p_record_pk;

        RETURN NVL(v_result, '[]');
    END get_version_timeline;

END TT_RECONSTRUCTION_PKG;
/
