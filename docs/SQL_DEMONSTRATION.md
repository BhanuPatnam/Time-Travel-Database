# Pure Oracle SQL Demonstration Guide
**Script:** `database/13_run_demo.sql`  
**Target:** Oracle SQL Developer, SQL*Plus, SQLcl, or DBeaver  
**Prerequisites:** None (no Python or React required)  

---

## 1. Quick Start Execution Commands

### In Oracle SQL*Plus or SQLcl:
```sql
-- Connect to Oracle XE pluggable database:
CONNECT tt_admin/tt_secret_123@//localhost:1521/XEPDB1;

-- 1. Install / Reinstall complete schema & packages:
@database/run_all.sql

-- 2. Run the interactive demonstration script:
@database/13_run_demo.sql
```

### In Oracle SQL Developer:
1. Open SQL Developer and connect to `XEPDB1` as `tt_admin`.
2. Open `database/run_all.sql` and click **Run Script (F5)**.
3. Open `database/13_run_demo.sql` and click **Run Script (F5)**.
4. View the formatted results in the **Script Output** window.

---

## 2. Step-by-Step Demonstration Walkthrough

### Step 1: Inspecting Current Baseline Records
Queries `CUSTOMERS` to establish starting balances and contact details.

### Step 2: DML INSERT and Same-Transaction CDC Capture
Inserts Customer #701 (`Vanguard Aerospace Ltd`, credit limit `$65,000.00`) and issues `COMMIT`.  
Queries `TT_CHANGE_LOG` to prove the row-level trigger automatically captured the operation with `operation_type = 'INSERT'`.

### Step 3: DML UPDATE and Delta Computation
Updates Customer #701 to `$90,000.00` and status `VIP`.  
Queries `TT_CHANGE_LOG` to verify that `changed_columns = 'credit_limit,status'` and that old vs new JSON states were preserved.

### Step 4: DML DELETE and Temporal Tombstoning
Deletes Customer #701. Queries `CUSTOMERS` to prove it is absent (count = 0), and queries `TT_CHANGE_LOG` to prove an auditable tombstone record with `operation_type = 'DELETE'` was preserved.

### Step 5: Critical Proof of Transaction ROLLBACK Correctness
- Inserts test Customer #702.
- Inspects session uncommitted state.
- Issues `ROLLBACK`.
- Queries both `CUSTOMERS` and `TT_CHANGE_LOG`.
- **Proof:** Count is 0 in both tables. This proves that uncommitted changes do **NOT** pollute the authoritative historical log because triggers participate in the user's active transaction without autonomous commits!

### Step 6: Consistent Checkpoint Creation
Calls `TT_CHECKPOINT_PKG.create_checkpoint('CUSTOMERS', 'MANUAL', ...)` to take a point-in-time boundary. Inspects row count and byte size in `TT_CHECKPOINTS`.

### Step 7: 3-Way Reconstruction Equivalence
Reconstructs Customer #101 as of 1 hour ago across all three strategies:
1. **LOG_ONLY**
2. **FIXED_INTERVAL**
3. **ADAPTIVE**
- All three strategies output identical relational SQL states: `credit_limit = $50,000.00` and `status = ACTIVE`.

### Step 8: Adaptive Policy Evaluation & Explainability
Evaluates `TT_CHECKPOINT_PKG.evaluate_adaptive_policy('CUSTOMERS')` and inspects `TT_POLICY_DECISIONS` to explain the decision rationale and formula score.

### Step 9: Full Table Snapshot Reconstructed via Oracle JSON_TABLE
Reconstructs the entire `CUSTOMERS` table as a relational table using native `JSON_TABLE(...)`:
```sql
SELECT jt.*
FROM DUAL,
     JSON_TABLE(
         TT_RECONSTRUCTION_PKG.reconstruct_table('CUSTOMERS', SYSTIMESTAMP - INTERVAL '1' HOUR, 'ADAPTIVE'),
         '$[*]' COLUMNS (
             customer_id   NUMBER(10)     PATH '$.customer_id',
             name          VARCHAR2(100)  PATH '$.name',
             status        VARCHAR2(20)   PATH '$.status',
             credit_limit  NUMBER(12,2)   PATH '$.credit_limit'
         )
     ) jt;
```

### Step 10: Historical State Diffing
Calls `TT_DIFF_RESTORE_PKG.compare_states(...)` between 1 hour ago and current time to identify added, modified, and deleted entities.

### Step 11: Safe Forward Restoration
Previews and executes `TT_DIFF_RESTORE_PKG.execute_restore(...)` on Customer #101 back to 1 hour ago. Proves that restoration itself is recorded as a new forward transaction rather than destroying intermediate history.

### Step 12: Real Measured Performance Benchmark
Runs `TT_BENCHMARK_PKG.run_benchmark_suite('CUSTOMERS', 25, 5, 'DEMO_RUN')` and prints measured latency (ms), throughput (TPS), and storage consumption (KB) directly in the console.
