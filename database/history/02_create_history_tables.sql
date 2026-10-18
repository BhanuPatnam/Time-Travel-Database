-- ============================================================================
-- SCRIPT 02: Create Historical Audit Log and Version Store Tables
-- Project: Time Travel Database System
-- Target: Oracle Database 21c XE
-- Description: Historical transactions, change log with JSON representations, 
--              system configurations, and query metric logs.
-- ============================================================================

-- Safe cleanup
BEGIN
    EXECUTE IMMEDIATE 'DROP TABLE TT_QUERY_METRICS CASCADE CONSTRAINTS';
EXCEPTION WHEN OTHERS THEN NULL;
END;
/

BEGIN
    EXECUTE IMMEDIATE 'DROP TABLE TT_CHANGE_LOG CASCADE CONSTRAINTS';
EXCEPTION WHEN OTHERS THEN NULL;
END;
/

BEGIN
    EXECUTE IMMEDIATE 'DROP TABLE TT_TRANSACTIONS CASCADE CONSTRAINTS';
EXCEPTION WHEN OTHERS THEN NULL;
END;
/

BEGIN
    EXECUTE IMMEDIATE 'DROP TABLE TT_CONFIG CASCADE CONSTRAINTS';
EXCEPTION WHEN OTHERS THEN NULL;
END;
/

-- 1. TT_TRANSACTIONS: Explicit transaction boundary tracking
CREATE TABLE TT_TRANSACTIONS (
    tx_id               NUMBER PRIMARY KEY,
    tx_name             VARCHAR2(100),
    client_identifier   VARCHAR2(100),
    started_at          TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    committed_at        TIMESTAMP WITH TIME ZONE,
    status              VARCHAR2(20) DEFAULT 'COMMITTED' NOT NULL 
                        CHECK (status IN ('ACTIVE', 'COMMITTED', 'ROLLED_BACK')),
    commit_order_seq    NUMBER
);

-- 2. TT_CHANGE_LOG: Auditable historical change log
CREATE TABLE TT_CHANGE_LOG (
    change_id           NUMBER PRIMARY KEY,
    tx_id               NUMBER REFERENCES TT_TRANSACTIONS(tx_id),
    table_name          VARCHAR2(60) NOT NULL,
    record_pk           VARCHAR2(255) NOT NULL,
    operation_type      VARCHAR2(10) NOT NULL 
                        CHECK (operation_type IN ('INSERT', 'UPDATE', 'DELETE', 'RESTORE')),
    old_values          CLOB,
    new_values          CLOB,
    delta_values        CLOB,
    changed_columns     VARCHAR2(500),
    change_timestamp    TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    commit_order_seq    NUMBER NOT NULL,
    schema_version      NUMBER DEFAULT 1 NOT NULL,
    CONSTRAINT chk_tt_json_old CHECK (old_values IS NULL OR old_values IS JSON),
    CONSTRAINT chk_tt_json_new CHECK (new_values IS NULL OR new_values IS JSON),
    CONSTRAINT chk_tt_json_delta CHECK (delta_values IS NULL OR delta_values IS JSON)
);

-- High-performance indexes for historical reconstruction and timelines
CREATE INDEX IDX_TT_CHANGELOG_LOOKUP 
    ON TT_CHANGE_LOG(table_name, record_pk, change_timestamp);

CREATE INDEX IDX_TT_CHANGELOG_TIME 
    ON TT_CHANGE_LOG(table_name, change_timestamp, commit_order_seq);

CREATE INDEX IDX_TT_CHANGELOG_TX 
    ON TT_CHANGE_LOG(tx_id);

CREATE INDEX IDX_TT_CHANGELOG_SEQ 
    ON TT_CHANGE_LOG(commit_order_seq);

-- 3. TT_CONFIG: System and adaptive policy configuration
CREATE TABLE TT_CONFIG (
    param_key           VARCHAR2(60) PRIMARY KEY,
    param_value         VARCHAR2(255) NOT NULL,
    description         VARCHAR2(500),
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL
);

-- 4. TT_QUERY_METRICS: Historical query logs for workload-aware feedback
CREATE TABLE TT_QUERY_METRICS (
    query_id            NUMBER PRIMARY KEY,
    table_name          VARCHAR2(60) NOT NULL,
    record_pk           VARCHAR2(255),
    target_timestamp    TIMESTAMP WITH TIME ZONE NOT NULL,
    strategy_used       VARCHAR2(30) NOT NULL,
    checkpoint_id_used  NUMBER,
    changes_replayed    NUMBER DEFAULT 0 NOT NULL,
    execution_time_ms   NUMBER(10,3) NOT NULL,
    queried_at          TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL
);

CREATE INDEX IDX_TT_QMETRICS_TBL_TIME 
    ON TT_QUERY_METRICS(table_name, queried_at);

-- Seed default configurations
INSERT INTO TT_CONFIG (param_key, param_value, description)
VALUES ('DEFAULT_STRATEGY', 'ADAPTIVE', 'Active checkpointing strategy: LOG_ONLY, FIXED_INTERVAL, ADAPTIVE');

INSERT INTO TT_CONFIG (param_key, param_value, description)
VALUES ('FIXED_INTERVAL_CHANGES', '50', 'Threshold of changes before taking a fixed-interval checkpoint');

INSERT INTO TT_CONFIG (param_key, param_value, description)
VALUES ('ADAPTIVE_CHANGE_THRESHOLD', '25', 'Minimum changes since last checkpoint to trigger adaptive consideration');

INSERT INTO TT_CONFIG (param_key, param_value, description)
VALUES ('ADAPTIVE_REPLAY_COST_THRESHOLD_MS', '12.0', 'Estimated replay cost ms threshold for adaptive checkpoint');

INSERT INTO TT_CONFIG (param_key, param_value, description)
VALUES ('ADAPTIVE_QUERY_FREQ_THRESHOLD', '3', 'Observed historical query frequency threshold in recent window');

INSERT INTO TT_CONFIG (param_key, param_value, description)
VALUES ('STORAGE_BUDGET_MB', '250', 'Maximum storage budget allocated for checkpoints in MB');

INSERT INTO TT_CONFIG (param_key, param_value, description)
VALUES ('ENABLE_DELTA_ENCODING', 'Y', 'Whether to compute and store changed-field delta JSON');

INSERT INTO TT_CONFIG (param_key, param_value, description)
VALUES ('RETENTION_DAYS', '90', 'Number of days to retain historical change logs');

COMMIT;

COMMENT ON TABLE TT_TRANSACTIONS IS 'Auditable transaction boundaries for deterministic time-travel reconstruction';
COMMENT ON TABLE TT_CHANGE_LOG IS 'Row-level and column-delta change log for time-travel reconstruction';
COMMENT ON TABLE TT_CONFIG IS 'Runtime configuration and adaptive checkpointing parameters';
COMMENT ON TABLE TT_QUERY_METRICS IS 'Feedback metrics from historical queries used by the adaptive checkpoint policy';
