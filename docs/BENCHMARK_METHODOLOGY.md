# Benchmark Methodology & Empirical Evaluation
**Engine:** Oracle Database 21c PL/SQL Benchmark Package (`TT_BENCHMARK_PKG`)  
**Results Table:** `TT_BENCHMARK_RESULTS`  

---

## 1. Research Objective
The primary research goal is to empirically evaluate the trade-offs among three time-travel architectures:
1. **Strategy 1: Log-Only (CDC Delta Replay)**
   - No checkpoints materialized.
   - Historical state is reconstructed by replaying the change log backward or forward from the initial state.
   - *Expected Trade-off:* Minimal storage footprint; query latency degrades linearly ($O(N)$) as change volume grows.
2. **Strategy 2: Fixed-Interval Checkpointing**
   - Checkpoints materialized strictly after every $K$ modifications (e.g. $K = 20$).
   - *Expected Trade-off:* Fast, bounded query latency ($O(K)$); severe storage bloat and high write amplification on cold or rarely queried tables.
3. **Strategy 3: Workload-Aware Adaptive Checkpointing**
   - Checkpoints materialized dynamically based on empirical query frequency, mutation velocity, and remaining storage budget.
   - *Expected Trade-off:* Bounded query latency on active entities; near log-only storage efficiency on cold entities.

---

## 2. The Adaptive Mathematical Cost Model

The decision engine evaluates the following objective function inside `TT_CHECKPOINT_PKG.evaluate_adaptive_policy`:

$$\text{Score}(T) = (C_T \times Q_T) - (\alpha \times S_T)$$

Where:
- $C_T$: Number of un-checkpointed mutations in `TT_CHANGE_LOG` for table $T$ since the last checkpoint.
- $Q_T$: Observed time-travel query frequency for table $T$ recorded in `TT_QUERY_METRICS` within the active observation window.
- $\alpha$: Configurable storage penalty coefficient (`COST_ALPHA` in `TT_CONFIG`, default = 0.5).
- $S_T$: Current estimated byte size of the table snapshot.

### Decision Rules:
1. **Budget Check**: If total checkpoint storage $\ge \text{MAX\_STORAGE\_BUDGET\_MB}$ (e.g. 250 MB), checkpoint creation is skipped to prevent disk exhaustion.
2. **Threshold Check**: If $\text{Score}(T) > \text{ADAPTIVE\_CHANGE\_THRESHOLD}$ (e.g. 25.0), the engine autonomously triggers `create_checkpoint(T, 'ADAPTIVE', ...)` and logs the action `CHECKPOINT_CREATED` in `TT_POLICY_DECISIONS`.
3. **Deferral**: If the score is below the threshold, it logs `DEFERRED_BELOW_COST_THRESHOLD` and relies on delta replay.

---

## 3. Measurement Methods & Metrics Collected

All measurements in `14_run_benchmarks.sql` are collected directly within Oracle:
- **Execution Latency (ms)**: Measured using `DBMS_UTILITY.GET_TIME` before and after `TT_RECONSTRUCTION_PKG.reconstruct_row`. (Precision: 1/100th second converted to milliseconds).
- **Changes Replayed**: Read from `TT_QUERY_METRICS.changes_replayed` to count the exact number of delta patches applied in memory.
- **Storage Consumption (Bytes)**: Measured via `DBMS_LOB.GETLENGTH` across `old_values`, `new_values`, and `delta_values` in `TT_CHANGE_LOG`, and `storage_bytes` in `TT_CHECKPOINTS`.
- **Write Throughput (TPS)**: Measured as $\frac{\text{Writes Completed}}{\text{Duration in Seconds}}$.
- **Correctness Pass Rate (%)**: Verified by comparing the reconstructed row attributes against ground-truth values.

---

## 4. How to Run the Benchmark Suite in Oracle SQL

In SQL*Plus, SQL Developer, or SQLcl:
```sql
-- 1. Execute benchmark suite: 50 writes, 10 queries
EXEC TT_BENCHMARK_PKG.run_benchmark_suite('CUSTOMERS', 50, 10, 'ORACLE_XE_RUN');

-- 2. Print formatted results summary:
EXEC TT_BENCHMARK_PKG.print_latest_results;

-- 3. Query the results table directly:
SELECT strategy_tested, avg_reconstruction_latency_ms, avg_changes_replayed,
       ROUND(history_storage_bytes/1024, 1) AS hist_kb,
       ROUND(checkpoint_storage_bytes/1024, 1) AS cp_kb,
       write_throughput_tps
FROM TT_BENCHMARK_RESULTS
ORDER BY result_id DESC
FETCH FIRST 3 ROWS ONLY;
```
