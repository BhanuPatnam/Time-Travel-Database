# System Architecture: Time Travel Database System
**Title:** A Workload-Aware Historical Data Reconstruction System Using Adaptive Checkpointing  
**Authoritative Core:** Oracle Database 21c SQL & PL/SQL  

---

## 1. Architectural Philosophy
The core database engine is built **entirely within Oracle Database 21c SQL and PL/SQL**. The backend (FastAPI) and frontend (React 19) are non-authoritative client layers designed to provide a developer management console, REST endpoints, and visualization.

The database can be installed, operated, queried, and demonstrated independently in **Oracle SQL Developer** or **SQL*Plus** without launching Python or React.

---

## 2. Three-Tier Architectural Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    TIER 1: CLIENT PRESENTATION (React 19)                    │
│   • Operations Console       • Time Travel Replay       • Version Timeline   │
│   • Relational SQL Grids     • Historical Diffing       • Benchmark Center   │
└──────────────────────────────────────┬───────────────────────────────────────┘
                                       │ HTTP / JSON REST
┌──────────────────────────────────────▼───────────────────────────────────────┐
│                     TIER 2: BACKEND SERVICE (FastAPI)                        │
│   • Endpoint Routing         • oracledb Connection Pool • Pydantic Schemas   │
│   • Error Translation        • Diagnostic Emulator (Dev Fallback Only)       │
└──────────────────────────────────────┬───────────────────────────────────────┘
                                       │ SQL*Net / Direct PL/SQL Calls
┌──────────────────────────────────────▼───────────────────────────────────────┐
│                  TIER 3: CORE ORACLE DATABASE ENGINE (21c XE)                │
│                                                                              │
│  [A. Relational Business Layer]                                              │
│     CUSTOMERS ── PRODUCTS ── ORDERS ── ORDER_ITEMS                           │
│                                                                              │
│  [B. Same-Transaction Change-Data-Capture (CDC)]                             │
│     Triggers (TRG_*_BIUD) ──> TT_CORE_PKG.log_change() ──> TT_CHANGE_LOG     │
│                                                                              │
│  [C. Checkpoint & Storage Management]                                        │
│     TT_CHECKPOINT_PKG ──> TT_CHECKPOINTS & TT_CHECKPOINT_DATA                │
│                                                                              │
│  [D. Adaptive Workload Policy Engine]                                        │
│     TT_QUERY_METRICS ──> Cost Formula Evaluation ──> TT_POLICY_DECISIONS    │
│                                                                              │
│  [E. Point-in-Time Reconstruction Engine]                                    │
│     TT_RECONSTRUCTION_PKG (reconstruct_row, reconstruct_table)               │
│                                                                              │
│  [F. Audit Diff & Safe Forward Restoration]                                  │
│     TT_DIFF_RESTORE_PKG (compare_states, preview_restore, execute_restore)   │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Transaction Model & ACID Consistency Guarantees

### 3.1. Same-Transaction Audit Guarantee
- In this architecture, business table DML (`INSERT`, `UPDATE`, `DELETE`) and its corresponding audit entry in `TT_CHANGE_LOG` occur **within the exact same Oracle transaction**.
- **No Autonomous Transactions for History**: Triggers and `TT_CORE_PKG.log_change` never issue `COMMIT` or declare `PRAGMA AUTONOMOUS_TRANSACTION`.
- **Atomicity under Rollback**: If a business operation fails or issues `ROLLBACK`, the change log entry is automatically rolled back by the Oracle kernel. Uncommitted transactions never enter authoritative history.

### 3.2. Commit Ordering & Determinism
- Microsecond wall-clock timestamps can collide under concurrent transactions.
- To guarantee strict linear serializability during delta replay, the database maintains `TT_COMMIT_ORDER_SEQ.NEXTVAL`.
- Delta replay strictly follows:
  ```sql
  ORDER BY commit_order_seq ASC, change_id ASC
  ```

### 3.3. Proper Use of Autonomous Transactions
`PRAGMA AUTONOMOUS_TRANSACTION` is restricted strictly to two non-authoritative administrative subprograms:
1. **`TT_RECONSTRUCTION_PKG.reconstruct_row`**: Declares autonomous transaction solely to record query latency telemetry into `TT_QUERY_METRICS` without blocking callers or violating `ORA-14551: cannot perform DML inside query`.
2. **`TT_CHECKPOINT_PKG.create_checkpoint`**: Declares autonomous transaction to snapshot table state and commit checkpoint metadata without holding row-level locks on user sessions.

---

## 4. Point-in-Time Reconstruction Workflow

When a query requests the state of a record at timestamp $T_{\text{target}}$:

```
                  [ USER REQUEST: Reconstruct Row at T_target ]
                                        │
                       Check Strategy (p_strategy)
                       ┌────────────────┴───────────────┐
                  LOG_ONLY                          ADAPTIVE / FIXED
                       │                                │
                       │                     Find Nearest Valid Checkpoint
                       │                     WHERE checkpoint_timestamp <= T_target
                       │                                │
                       │                     ┌──────────┴──────────┐
                       │                   FOUND               NOT FOUND
                       │                     │                     │
                       │           Load row from           Start from base
                       │         TT_CHECKPOINT_DATA       (or initial insert)
                       │                     │                     │
                       └──────────────┬──────┴─────────────────────┘
                                      │
                         Scan TT_CHANGE_LOG
                         WHERE commit_order_seq > boundary_seq
                           AND change_timestamp <= T_target
                         ORDER BY commit_order_seq ASC
                                      │
                         Replay Mutations (JSON Patch)
                         • INSERT: Current = new_values
                         • UPDATE: Current = Current + delta
                         • DELETE: Current = NULL (Tombstone)
                                      │
                         Return Materialized Row Envelope
                         (Optionally projected via Oracle JSON_TABLE)
```

---

## 5. Safe Forward Restoration Architecture
Unlike native `FLASHBACK TABLE`, which erases history between the point of failure and recovery, our system implements **Safe Forward-Only Restoration**:
1. It queries `TT_RECONSTRUCTION_PKG` to compute the historical state at $T_{\text{target}}$.
2. It generates a preview validating that foreign keys (e.g., customer of an order) currently exist.
3. Upon user confirmation, it applies an `UPDATE` or `INSERT` in the present as a **new, auditable transaction**.
4. The history trail remains 100% unbroken and fully traceable.

---

## 6. Temporal Branching & Three-Way Merge Engine

### 6.1. Concept & Workspace Isolation
The temporal branching engine enables isolated database sandboxes without copying entire physical tables.
- **Copy-On-Write Changeset Model:** The base database tables remain 100% immutable while experimenting on branches.
- **Branch Lineage:** A branch records its origin base (commit ID and/or historical timestamp) and tracks modifications exclusively as delta changesets in `TT_BRANCH_CHANGESET`.

### 6.2. Commit Graph & Ancestry
Every branch commit has:
- A unique `commit_id` (e.g., `c101`, `c102`)
- A primary parent (`parent_commit_id`)
- An optional merge parent (`merge_parent_commit_id`)
- A monotonic order sequence (`commit_order_seq`)
- Auditable metadata: author, timestamp, commit type (`INITIAL`, `NORMAL`, `MERGE`, `FAST_FORWARD`)

### 6.3. Three-Way Merge Engine Workflow

```
            [ Common Ancestor: Merge Base (S_base) ]
                           /            \
                          /              \
  [ Source Head (S_src) ]                  [ Target Head (S_tgt) ]
        \                                            /
         \                                          /
          └───► [ 1. Three-Way Record & Column Diff ]
                             │
            ┌────────────────┴────────────────┐
     [ Clean Merges ]                  [ Merge Conflicts ]
     • Disjoint Column Changes         • Same Column Different Values
     • Fast-Forward Advances           • Delete vs Update
     • Non-overlapping Inserts         • Concurrent Insert of Same PK
            │                                 │
            │                         [ Manual Resolver ]
            │                         • Accept Source
            │                         • Accept Target
            │                         • Custom Edited Values
            │                                 │
            └────────────────┬────────────────┘
                             │
            [ Validate Constraints & Foreign Keys ]
                             │
            [ Create Merge Commit with 2 Parents ]
            [ Log Entry in TT_BRANCH_MERGE_HISTORY ]
```

### 6.4. Conflict Detection Matrix

| Condition | Resolution | Action |
| :--- | :--- | :--- |
| Unchanged in Source & Target | No change | Keep Target value |
| Changed in Source, Unchanged in Target | Clean merge | Apply Source change |
| Unchanged in Source, Changed in Target | Clean merge | Retain Target change |
| Both Changed, Disjoint Columns | Column auto-merge | Merge column sets cleanly |
| Both Changed, Same Column Differently | **Conflict** | Flag `SAME_COLUMN_MODIFICATION` |
| One Deleted, One Updated | **Conflict** | Flag `DELETE_VS_UPDATE` |
| Both Inserted Same PK (Differing Values) | **Conflict** | Flag `CONCURRENT_INSERT` |

