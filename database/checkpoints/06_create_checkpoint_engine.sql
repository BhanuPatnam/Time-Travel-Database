-- ============================================================================
-- SCRIPT 06: Create Checkpoint Engine Tables and Indexes
-- Project: Time Travel Database System
-- Target: Oracle Database 21c XE
-- Description: Checkpoints metadata, row data snapshots, and adaptive policy decisions.
-- ============================================================================

-- Safe cleanup
BEGIN
    EXECUTE IMMEDIATE 'DROP TABLE TT_POLICY_DECISIONS CASCADE CONSTRAINTS';
EXCEPTION WHEN OTHERS THEN NULL;
END;
/

BEGIN
    EXECUTE IMMEDIATE 'DROP TABLE TT_CHECKPOINT_DATA CASCADE CONSTRAINTS';
EXCEPTION WHEN OTHERS THEN NULL;
END;
/

BEGIN
    EXECUTE IMMEDIATE 'DROP TABLE TT_CHECKPOINTS CASCADE CONSTRAINTS';
EXCEPTION WHEN OTHERS THEN NULL;
END;
/

-- 1. TT_CHECKPOINTS: Snapshot boundaries and states
CREATE TABLE TT_CHECKPOINTS (
    checkpoint_id           NUMBER PRIMARY KEY,
    checkpoint_name         VARCHAR2(100),
    table_name              VARCHAR2(60) NOT NULL,
    target_boundary_ts      TIMESTAMP WITH TIME ZONE NOT NULL,
    boundary_tx_id          NUMBER,
    boundary_change_id      NUMBER,
    strategy_used           VARCHAR2(30) NOT NULL,
    status                  VARCHAR2(20) DEFAULT 'IN_PROGRESS' NOT NULL
                            CHECK (status IN ('IN_PROGRESS', 'VALID', 'FAILED', 'SUPERSEDED')),
    row_count               NUMBER DEFAULT 0 NOT NULL,
    storage_bytes           NUMBER DEFAULT 0 NOT NULL,
    creation_duration_ms    NUMBER DEFAULT 0,
    decision_reason         VARCHAR2(1000),
    created_at              TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL
);

CREATE INDEX IDX_TT_CP_LOOKUP 
    ON TT_CHECKPOINTS(table_name, status, target_boundary_ts);

-- 2. TT_CHECKPOINT_DATA: Row snapshots captured at the checkpoint boundary
CREATE TABLE TT_CHECKPOINT_DATA (
    data_id                 NUMBER PRIMARY KEY,
    checkpoint_id           NUMBER NOT NULL 
                            REFERENCES TT_CHECKPOINTS(checkpoint_id) ON DELETE CASCADE,
    table_name              VARCHAR2(60) NOT NULL,
    record_pk               VARCHAR2(255) NOT NULL,
    row_data                CLOB NOT NULL,
    created_at              TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT chk_tt_cp_json CHECK (row_data IS JSON)
);

CREATE INDEX IDX_TT_CPDATA_LOOKUP 
    ON TT_CHECKPOINT_DATA(checkpoint_id, table_name, record_pk);

-- 3. TT_POLICY_DECISIONS: Auditable decisions of the adaptive checkpoint policy
CREATE TABLE TT_POLICY_DECISIONS (
    decision_id             NUMBER PRIMARY KEY,
    evaluated_at            TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    table_name              VARCHAR2(60) NOT NULL,
    changes_since_last_cp   NUMBER NOT NULL,
    estimated_replay_cost_ms NUMBER(10,3) NOT NULL,
    historical_query_freq   NUMBER NOT NULL,
    storage_used_mb         NUMBER(10,2) NOT NULL,
    storage_budget_mb       NUMBER(10,2) NOT NULL,
    action_taken            VARCHAR2(30) NOT NULL 
                            CHECK (action_taken IN ('CHECKPOINT_CREATED', 'SKIPPED_BELOW_THRESHOLD', 'SKIPPED_STORAGE_LIMIT', 'MANUAL_TRIGGER')),
    decision_reason         VARCHAR2(1000) NOT NULL,
    checkpoint_id           NUMBER REFERENCES TT_CHECKPOINTS(checkpoint_id)
);

CREATE INDEX IDX_TT_POLICY_DECISIONS 
    ON TT_POLICY_DECISIONS(table_name, evaluated_at);

COMMENT ON TABLE TT_CHECKPOINTS IS 'Logical snapshot boundaries at verified consistent timestamps';
COMMENT ON TABLE TT_CHECKPOINT_DATA IS 'Materialized row state at a specific checkpoint boundary';
COMMENT ON TABLE TT_POLICY_DECISIONS IS 'Workload-aware audit decisions for checkpoint creation vs skipping';
