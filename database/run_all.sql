-- ============================================================================
-- MASTER INSTALLATION SCRIPT FOR ORACLE DATABASE 21c / 19c / XE
-- Runs all schema, package, trigger, and engine scripts in correct dependency order
-- ============================================================================
SET ECHO ON
SET FEEDBACK ON
SET DEFINE OFF;
SET SERVEROUTPUT ON SIZE UNLIMITED
WHENEVER SQLERROR CONTINUE;

PROMPT [1/12] Creating Core Relational Schema...
@@01_create_schema.sql

PROMPT [2/12] Creating Time Travel History Tables...
@@02_create_history_tables.sql

PROMPT [3/12] Creating Commit and Primary Key Sequences...
@@03_create_sequences.sql

PROMPT [4/12] Compiling TT_CORE_PKG Package Specification and Body...
@@05_create_packages.sql

PROMPT [5/12] Compiling Temporal Database Triggers...
@@04_create_triggers.sql

PROMPT [6/12] Creating Checkpoint Tables and Policy Decision Schema...
@@06_create_checkpoint_engine.sql

PROMPT [7/12] Compiling TT_CHECKPOINT_PKG Adaptive Checkpointing Engine...
@@06_create_checkpoint_pkg.sql

PROMPT [8/12] Compiling TT_RECONSTRUCTION_PKG Point-in-Time Reconstruction Engine...
@@07_create_reconstruction_engine.sql

PROMPT [9/12] Compiling TT_DIFF_RESTORE_PKG Historical Diff and Restore Engine...
@@08_create_diff_and_restore.sql

PROMPT [10/12] Loading Seed Workload and Historical Lifecycle Transactions...
@@09_seed_data.sql

PROMPT [11/12] Creating Benchmark Results Tables...
@@10_create_benchmark_objects.sql

PROMPT [12/15] Compiling TT_BENCHMARK_PKG Suite...
@@14_run_benchmarks.sql

PROMPT [13/15] Creating Temporal Branching and Merge Schema Tables...
@@15_create_branching_tables.sql

PROMPT [14/15] Compiling TT_BRANCH_PKG Temporal Branching & Merge Engine...
@@16_create_branch_pkg.sql

PROMPT [15/15] Running System Verification Suite...
@@11_verify_installation.sql

PROMPT ============================================================================
PROMPT Installation Complete! Run @@13_run_demo.sql to execute the instructor demo.
PROMPT ============================================================================
