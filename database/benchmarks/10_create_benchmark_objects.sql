-- ============================================================================
-- SCRIPT 10: Create Benchmark Objects Table and Runner Package
-- Project: Time Travel Database System
-- Target: Oracle Database 21c XE
-- Description: Benchmark schema, run metadata, and comparison runners for:
--              1. Log-Only Reconstruction
--              2. Fixed-Interval Checkpointing
--              3. Workload-Aware Adaptive Checkpointing
-- ============================================================================

-- Safe cleanup
BEGIN
    EXECUTE IMMEDIATE 'DROP TABLE TT_BENCHMARK_RESULTS CASCADE CONSTRAINTS';
EXCEPTION WHEN OTHERS THEN NULL;
END;
/

CREATE TABLE TT_BENCHMARK_RESULTS (
    result_id                   NUMBER PRIMARY KEY,
    run_id                      VARCHAR2(100) NOT NULL,
    strategy_tested             VARCHAR2(30) NOT NULL,
    dataset_size                VARCHAR2(30) NOT NULL,
    write_ops_count             NUMBER NOT NULL,
    query_ops_count             NUMBER NOT NULL,
    checkpoints_created         NUMBER NOT NULL,
    avg_reconstruction_latency_ms NUMBER(10,3) NOT NULL,
    p95_reconstruction_latency_ms NUMBER(10,3) NOT NULL,
    avg_changes_replayed        NUMBER(10,2) NOT NULL,
    history_storage_bytes       NUMBER NOT NULL,
    checkpoint_storage_bytes    NUMBER NOT NULL,
    write_throughput_tps        NUMBER(10,2) NOT NULL,
    checkpoint_creation_time_ms NUMBER(10,2) NOT NULL,
    correctness_pass_rate       NUMBER(5,2) NOT NULL,
    executed_at                 TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL
);

CREATE INDEX IDX_TT_BENCH_RUN ON TT_BENCHMARK_RESULTS(run_id, strategy_tested);

-- Benchmark Result Sequence
BEGIN
    EXECUTE IMMEDIATE 'DROP SEQUENCE TT_BENCHMARK_SEQ';
EXCEPTION WHEN OTHERS THEN NULL;
END;
/
CREATE SEQUENCE TT_BENCHMARK_SEQ START WITH 1 INCREMENT BY 1 NOCACHE;

COMMENT ON TABLE TT_BENCHMARK_RESULTS IS 'Performance and storage benchmark logs comparing time-travel strategies';
