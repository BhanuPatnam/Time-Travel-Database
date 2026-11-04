# Chapter-wise Database Topics & Project Implementation Mapping

**Course Reference:** Silberschatz, Korth, and Sudarshan, *Database System Concepts* (7th Edition)  
**Project Title:** Time Travel Database: A Workload-Aware Historical Data Reconstruction System Using Adaptive Checkpointing  
**Slide Location:** [`Slides/`](file:///Users/patnambhanuprakash/Desktop/DBMS/Slides)  
**Implementation Dialect & Stack:** Oracle Database 21c (SQL & PL/SQL), FastAPI (Python 3.13), React 19  

---

## 1. Syllabus & System Alignment Matrix

The table below outlines how each slide module from the 7th Edition textbook directly maps into executable components in this repository.

| Slide Deck | Textbook Chapter | Key Academic Concepts | Project Implementation Component | Primary Code Files |
| :--- | :--- | :--- | :--- | :--- |
| **`ch1.pdf`** | **Chapter 1: Introduction** | 3-Tier Architecture, Data Abstraction, Schema vs Instance | Presentation $\to$ Application $\to$ Database Decoupling; Multi-instance temporal queries | [`docs/ARCHITECTURE.md`](file:///Users/patnambhanuprakash/Desktop/DBMS/docs/ARCHITECTURE.md)<br>[`backend/app/main.py`](file:///Users/patnambhanuprakash/Desktop/DBMS/backend/app/main.py) |
| **`ch2.pdf`** | **Chapter 2: Intro to Relational Model** | Relational Schemas, Primary Keys, Foreign Keys, Relational Algebra | Normalized business schema, declarative key constraints | [`database/01_create_schema.sql`](file:///Users/patnambhanuprakash/Desktop/DBMS/database/01_create_schema.sql)<br>[`docs/DATABASE_DESIGN.md`](file:///Users/patnambhanuprakash/Desktop/DBMS/docs/DATABASE_DESIGN.md) |
| **`ch3.pdf`** | **Chapter 3: Introduction to SQL** | DDL, DML, Domain `CHECK` constraints, Nested Queries, Aggregates | Schema definitions, state mutations (`INSERT`, `UPDATE`, `DELETE`) | [`database/01_create_schema.sql`](file:///Users/patnambhanuprakash/Desktop/DBMS/database/01_create_schema.sql)<br>[`database/09_seed_data.sql`](file:///Users/patnambhanuprakash/Desktop/DBMS/database/09_seed_data.sql) |
| **`ch4.pdf`** | **Chapter 4: Intermediate SQL** | Joined Relations, Integrity Constraints, `ON DELETE CASCADE`, Large Objects | Cascading order-item dependencies, temporal `TIMESTAMP WITH TIME ZONE`, `CLOB` JSON storage | [`database/01_create_schema.sql`](file:///Users/patnambhanuprakash/Desktop/DBMS/database/01_create_schema.sql)<br>[`database/02_create_history_tables.sql`](file:///Users/patnambhanuprakash/Desktop/DBMS/database/02_create_history_tables.sql) |
| **`ch5.pdf`** | **Chapter 5: Advanced SQL** | Stored Procedures & Functions, Triggers, Embedded/Dynamic SQL | PL/SQL Autonomous Packages, Row-Level CDC Event Triggers, SQL/JSON projections | [`database/04_create_triggers.sql`](file:///Users/patnambhanuprakash/Desktop/DBMS/database/04_create_triggers.sql)<br>[`database/05_create_packages.sql`](file:///Users/patnambhanuprakash/Desktop/DBMS/database/05_create_packages.sql) |
| **`ch6.pdf`** | **Chapter 6: E-R Model** | Entity Sets, Relationship Cardinality ($1:N$, $M:N$), Key Constraints | Business entities (`CUSTOMERS`, `PRODUCTS`, `ORDERS`, `ORDER_ITEMS`) and temporal relationships | [`docs/DATABASE_DESIGN.md`](file:///Users/patnambhanuprakash/Desktop/DBMS/docs/DATABASE_DESIGN.md)<br>[`database/01_create_schema.sql`](file:///Users/patnambhanuprakash/Desktop/DBMS/database/01_create_schema.sql) |
| **`ch7.pdf`** | **Chapter 7: Normalization** | 3NF/BCNF Decomposition, **Temporal Data Modeling (Slides 85–86)** | Lossless business schemas + Transaction-time audit ledgers preserving temporal dependencies | [`database/01_create_schema.sql`](file:///Users/patnambhanuprakash/Desktop/DBMS/database/01_create_schema.sql)<br>[`database/02_create_history_tables.sql`](file:///Users/patnambhanuprakash/Desktop/DBMS/database/02_create_history_tables.sql) |
| **`ch13.pdf`** | **Chapter 13: Data Storage Structures** | Variable-Length Records, Large Objects (LOBs), Delta Storage | JSON Delta Encoding in `CLOB` attributes saving 80%–90% storage over full snapshotting | [`database/02_create_history_tables.sql`](file:///Users/patnambhanuprakash/Desktop/DBMS/database/02_create_history_tables.sql)<br>[`database/05_create_packages.sql`](file:///Users/patnambhanuprakash/Desktop/DBMS/database/05_create_packages.sql) |
| **`ch14.pdf`** | **Chapter 14: Indexing** | B+ Tree Indices, Multi-attribute Keys, **Temporal Indexing (Slides 76–77)** | Composite indices on `(table, pk, timestamp)` and commit sequence ordering | [`database/02_create_history_tables.sql`](file:///Users/patnambhanuprakash/Desktop/DBMS/database/02_create_history_tables.sql)<br>[`database/06_create_checkpoint_engine.sql`](file:///Users/patnambhanuprakash/Desktop/DBMS/database/06_create_checkpoint_engine.sql) |
| **`ch17.pdf`** | **Chapter 17: Transactions** | ACID Properties, Atomicity under Rollback, Serializability Ordering | Same-Transaction CDC guarantee; monotonic `TT_COMMIT_ORDER_SEQ` ordering | [`database/03_create_sequences.sql`](file:///Users/patnambhanuprakash/Desktop/DBMS/database/03_create_sequences.sql)<br>[`database/04_create_triggers.sql`](file:///Users/patnambhanuprakash/Desktop/DBMS/database/04_create_triggers.sql) |
| **`ch18.pdf`** | **Chapter 18: Concurrency Control** | Multiversion Schemes (MVCC), Snapshot Isolation, Lock Isolation | Historical row reconstruction without read-locks; `PRAGMA AUTONOMOUS_TRANSACTION` isolation | [`database/06_create_checkpoint_pkg.sql`](file:///Users/patnambhanuprakash/Desktop/DBMS/database/checkpoints/06_create_checkpoint_pkg.sql)<br>[`database/07_create_reconstruction_engine.sql`](file:///Users/patnambhanuprakash/Desktop/DBMS/database/reconstruction/07_create_reconstruction_engine.sql) |
| **`ch19.pdf`** | **Chapter 19: Recovery System** | Write-Ahead Logging (WAL), Undo/Redo Logs, **Checkpoints & Replay** | **Workload-Aware Adaptive Checkpoint Cost Model**; Forward delta replay algorithms | [`database/checkpoints/06_create_checkpoint_pkg.sql`](file:///Users/patnambhanuprakash/Desktop/DBMS/database/checkpoints/06_create_checkpoint_pkg.sql)<br>[`database/reconstruction/07_create_reconstruction_engine.sql`](file:///Users/patnambhanuprakash/Desktop/DBMS/database/reconstruction/07_create_reconstruction_engine.sql) |

---

## 2. Detailed Chapter-by-Chapter Breakdown

### Chapter 1: Introduction (`ch1.pdf`)
* **Slide Topics:**
  * Drawbacks of file-processing systems (data redundancy, inconsistency, access difficulty, atomicity problems, concurrent-access anomalies).
  * Data Abstraction levels (Physical level, Logical level, View level).
  * Instances and Schemas.
  * Three-Tier Database System Architecture (User Interface $\to$ Application Server $\to$ Database Engine).
* **Where and How Used in This Project:**
  1. **Three-Tier Architecture:**  
     * **Tier 1 (Presentation):** React 19 SPA ([`frontend/src/App.jsx`](file:///Users/patnambhanuprakash/Desktop/DBMS/frontend/src/App.jsx)) provides declarative tabular grids, timelines, and diff visualizations.
     * **Tier 2 (Application Service):** FastAPI REST API ([`backend/app/main.py`](file:///Users/patnambhanuprakash/Desktop/DBMS/backend/app/main.py)) orchestrates connection pools, data validation (Pydantic), and fallback telemetry.
     * **Tier 3 (Database Core):** Oracle Database 21c XE executes triggers, maintains constraints, and runs compiled PL/SQL packages.
  2. **Schema vs. Instance Separation:**  
     * In traditional databases, queries execute against only the *current instance*.  
     * This project allows clients to query any past *instance* $I(t)$ using an invariant logical *schema* $S$.

---

### Chapter 2: Intro to the Relational Model (`ch2.pdf`)
* **Slide Topics:**
  * Structure of Relational Databases (Tuples, Attributes, Domains, Atomic domains).
  * Database Schema vs. Database Instance.
  * Keys: Superkeys, Candidate Keys, Primary Keys (PK), Foreign Keys (FK).
  * Relational Query Languages and Relational Algebra.
* **Where and How Used in This Project:**
  1. **Primary & Foreign Key Constraints:**  
     * Configured in [`database/01_create_schema.sql`](file:///Users/patnambhanuprakash/Desktop/DBMS/database/01_create_schema.sql):  
       * `customer_id` is PK of `CUSTOMERS`.  
       * `product_id` is PK of `PRODUCTS`.  
       * `order_id` is PK of `ORDERS`, referencing `customer_id` as FK.  
       * `item_id` is PK of `ORDER_ITEMS`, referencing `order_id` and `product_id`.
  2. **Relational Table Projection:**  
     * Even though historical audit states are captured in JSON envelopes, they are projected back as strictly typed relational tuples using Oracle's `JSON_TABLE(...)` in [`database/test_time_travel_demo.sql`](file:///Users/patnambhanuprakash/Desktop/DBMS/database/test_time_travel_demo.sql).

---

### Chapter 3: Introduction to SQL (`ch3.pdf`)
* **Slide Topics:**
  * Data Definition Language (DDL): `CREATE TABLE`, integrity constraints, domain types.
  * Data Manipulation Language (DML): `INSERT`, `UPDATE`, `DELETE`, `SELECT`.
  * Domain Constraints: `NOT NULL`, `CHECK`, `DEFAULT`.
  * Aggregate Functions: `COUNT`, `SUM`, `AVG`, `MIN`, `MAX`.
* **Where and How Used in This Project:**
  1. **Domain & Integrity Constraints:**  
     * In [`database/01_create_schema.sql`](file:///Users/patnambhanuprakash/Desktop/DBMS/database/01_create_schema.sql):
       * `status VARCHAR2(20) CHECK (status IN ('ACTIVE', 'SUSPENDED', 'INACTIVE'))`
       * `credit_limit NUMBER(12,2) CHECK (credit_limit >= 0)`
       * `unit_price NUMBER(10,2) CHECK (unit_price >= 0)`
  2. **Auditable DML Mutations:**  
     * All live additions, modifications, and deletions pass through standard DML queries intercepted by triggers.
  3. **Aggregations in Telemetry:**  
     * Aggregate queries in [`backend/app/repositories/oracle_repo.py`](file:///Users/patnambhanuprakash/Desktop/DBMS/backend/app/repositories/oracle_repo.py) compute live metrics: `COUNT(*)`, `SUM(storage_bytes)`, and historical query frequencies.

---

### Chapter 4: Intermediate SQL (`ch4.pdf`)
* **Slide Topics:**
  * Joined Relations: Natural joins, Inner joins, Outer joins.
  * Referential Integrity Actions (`ON DELETE CASCADE`, `ON DELETE SET NULL`).
  * Advanced Data Types: `TIMESTAMP`, `INTERVAL`, Large Objects (`CLOB`, `BLOB`).
* **Where and How Used in This Project:**
  1. **Referential Integrity Actions:**  
     * In [`database/01_create_schema.sql`](file:///Users/patnambhanuprakash/Desktop/DBMS/database/01_create_schema.sql), `ORDER_ITEMS` enforces:
       ```sql
       FOREIGN KEY (order_id) REFERENCES ORDERS(order_id) ON DELETE CASCADE
       ```
       Deleting an order atomically cascades to its constituent line items.
  2. **Microsecond Timestamp & Interval Arithmetic:**  
     * Schema tables and history logs utilize `TIMESTAMP WITH TIME ZONE` and `SYSTIMESTAMP`.  
     * Testing scripts use interval arithmetic: `SYSTIMESTAMP - INTERVAL '2' HOUR`.
  3. **Character Large Objects (`CLOB`):**  
     * Used in [`database/02_create_history_tables.sql`](file:///Users/patnambhanuprakash/Desktop/DBMS/database/02_create_history_tables.sql) to store arbitrary JSON payload diffs (`old_values`, `new_values`, `delta_values`) validated with `CHECK (old_values IS JSON)`.

---

### Chapter 5: Advanced SQL & Database Programming (`ch5.pdf`)
* **Slide Topics:**
  * Accessing SQL from Programming Languages (DB-API / JDBC, PreparedStatement).
  * Functions, Stored Procedures, and Modular Packages.
  * Database Event Triggers (`BEFORE`/`AFTER`, `INSERT`/`UPDATE`/`DELETE`, `FOR EACH ROW`, `:NEW`/`:OLD` pseudo-records).
* **Where and How Used in This Project:**
  1. **Row-Level CDC Triggers:**  
     * Defined in [`database/04_create_triggers.sql`](file:///Users/patnambhanuprakash/Desktop/DBMS/database/04_create_triggers.sql) (`TRG_CUSTOMERS_BIUD`, `TRG_PRODUCTS_BIUD`, `TRG_ORDERS_BIUD`).  
     * Executes `FOR EACH ROW`, intercepts `:OLD` and `:NEW` values, and calls `TT_CORE_PKG.log_change()`.
  2. **Encapsulated PL/SQL Packages:**  
     * [`TT_CORE_PKG`](file:///Users/patnambhanuprakash/Desktop/DBMS/database/05_create_packages.sql): JSON row serialization and delta extraction.
     * [`TT_CHECKPOINT_PKG`](file:///Users/patnambhanuprakash/Desktop/DBMS/database/checkpoints/06_create_checkpoint_pkg.sql): Materializes snapshots and computes adaptive cost functions.
     * [`TT_RECONSTRUCTION_PKG`](file:///Users/patnambhanuprakash/Desktop/DBMS/database/reconstruction/07_create_reconstruction_engine.sql): Historical point-in-time state reconstruction.
     * [`TT_DIFF_RESTORE_PKG`](file:///Users/patnambhanuprakash/Desktop/DBMS/database/reconstruction/08_create_diff_and_restore.sql): Two-timestamp state comparator and safe forward restoration.
  3. **Programmatic Access:**  
     * Python connects via `python-oracledb` Thin Mode driver in [`backend/app/core/database.py`](file:///Users/patnambhanuprakash/Desktop/DBMS/backend/app/core/database.py).

---

### Chapter 6: Database Design Using the E-R Model (`ch6.pdf`)
* **Slide Topics:**
  * Design Phases (Requirement analysis, Conceptual design, Logical design).
  * Entities, Attributes, Entity Sets, and Relationship Sets.
  * Mapping Cardinalities ($1:1$, $1:N$, $M:N$).
  * Converting E-R Diagrams into Relational Schemas.
* **Where and How Used in This Project:**
  1. **E-R Domain Model:**  
     * Fully diagrammed in [`docs/DATABASE_DESIGN.md`](file:///Users/patnambhanuprakash/Desktop/DBMS/docs/DATABASE_DESIGN.md):
       * `CUSTOMERS` ($1:N$) `ORDERS`
       * `ORDERS` ($1:N$) `ORDER_ITEMS`
       * `PRODUCTS` ($1:N$) `ORDER_ITEMS`
       * `TT_TRANSACTIONS` ($1:N$) `TT_CHANGE_LOG`
       * `TT_CHECKPOINTS` ($1:N$) `TT_CHECKPOINT_DATA`
  2. **Entity Distinctions:**  
     * Active business entities are strictly separated from temporal metadata entities.

---

### Chapter 7: Normalization & Modeling Temporal Data (`ch7.pdf`)
* **Slide Topics:**
  * Pitfalls of bad relational design (redundancy, update/delete anomalies).
  * Functional Dependencies ($X \to Y$), Closure $F^+$, and Decomposition.
  * Normal Forms: 1NF, 2NF, 3NF, BCNF.
  * **Modeling Temporal Data (Slides 85–86):** Valid time, transaction time, snapshot instances, and temporal functional dependencies.
* **Where and How Used in This Project:**
  1. **3NF Normalization:**  
     * Base business tables are decomposed to 3NF/BCNF so customer names and credit limits are not repeated redundantly across orders.
  2. **Temporal Data Theory (Direct Implementation of Ch 7, Slides 85–86):**  
     * Standard normalization assumes functional dependencies like $\text{ID} \to \text{Address}$ hold universally; however, as noted in Slide 85, temporal changes invalidate static dependencies because attributes change over time.  
     * This project implements a **Transaction-Time Historical Model** using an append-only temporal ledger (`TT_CHANGE_LOG`), ensuring that every past snapshot instance $I(t)$ satisfies legal relational integrity.

---

### Chapter 13: Data Storage Structures (`ch13.pdf`)
* **Slide Topics:**
  * File and Record Organization.
  * Fixed-length vs. Variable-length records.
  * Storage of Large Objects (LOBs).
  * Storage representation of columnar and delta formats.
* **Where and How Used in This Project:**
  1. **Delta Compression vs. Snapshot Storage:**  
     * Taking full row copies on every transaction creates severe storage bloat ($O(N \cdot S)$).  
     * This project uses **Compact JSON Delta Logging** in [`TT_CORE_PKG`](file:///Users/patnambhanuprakash/Desktop/DBMS/database/05_create_packages.sql). When an `UPDATE` changes only one column (e.g. `credit_limit`), `delta_values` stores only `{"credit_limit": {"old": 50000, "new": 75000}}`, cutting historical disk usage by 80% to 90%.

---

### Chapter 14: Indexing & Temporal Indexing (`ch14.pdf`)
* **Slide Topics:**
  * Basic Concepts: Search keys, Index evaluation metrics (access time, insertion time, storage overhead).
  * Ordered Indices: Primary vs. Secondary, Dense vs. Sparse B+ Trees.
  * Multi-attribute Composite Keys.
  * **Indexing Temporal Data (Slides 76–77):** Fast point-in-time lookups and interval scans using compound keys on $(a, t)$.
* **Where and How Used in This Project:**
  1. **Temporal Composite B-Tree Indices:**  
     * Directly implements the temporal indexing pattern described in Ch 14 (Slide 77):
       * `IDX_TT_CHANGELOG_LOOKUP`: `(table_name, record_pk, change_timestamp)` enables $O(\log N)$ single-record historical queries without full table scans.
       * `IDX_TT_CHANGELOG_SEQ`: `(commit_order_seq)` guarantees indexed chronological retrieval during forward delta replaying.
       * `IDX_TT_CP_LOOKUP`: `(table_name, boundary_timestamp, status)` enables immediate discovery of the nearest preceding checkpoint.

---

### Chapter 17: Transactions & ACID Properties (`ch17.pdf`)
* **Slide Topics:**
  * Transaction Concept & States (`Active`, `Partially Committed`, `Committed`, `Failed`, `Aborted`).
  * **ACID Properties:**
    * **Atomicity:** All-or-nothing execution.
    * **Consistency:** Preservation of database invariants.
    * **Isolation:** Uncommitted changes hidden from concurrent transactions.
    * **Durability:** Committed updates persist through crashes.
  * Serializability and Commit Ordering.
* **Where and How Used in This Project:**
  1. **Same-Transaction CDC (Strict Atomicity Guarantee):**  
     * Database triggers in [`database/04_create_triggers.sql`](file:///Users/patnambhanuprakash/Desktop/DBMS/database/04_create_triggers.sql) execute inside the user's ongoing transaction.  
     * If an application operation rolls back, the historical audit log entry is **automatically rolled back** by the Oracle kernel. Uncommitted transactions never enter authoritative history.
  2. **Deterministic Commit Sequencing:**  
     * Microsecond timestamps can collide under concurrent write workloads.  
     * Monotonic sequence `TT_COMMIT_ORDER_SEQ.NEXTVAL` ([`database/03_create_sequences.sql`](file:///Users/patnambhanuprakash/Desktop/DBMS/database/03_create_sequences.sql)) guarantees strict serial commit ordering during historical state replay.

---

### Chapter 18: Concurrency Control & MVCC (`ch18.pdf`)
* **Slide Topics:**
  * Lock-Based Protocols and Multiple Granularity.
  * **Multiversion Schemes (MVCC):** Maintaining multiple versions of data items so readers do not block writers.
  * Snapshot Isolation.
  * Autonomous execution boundaries.
* **Where and How Used in This Project:**
  1. **Application-Level Multiversion Replay:**  
     * Native database MVCC retains undo blocks only until transactions finish or undo retention expires.  
     * This project extends MVCC into a **long-term historical reconstruction system** that can reconstruct versions spanning weeks, months, or years without blocking current OLTP writes.
  2. **Lock Isolation via `PRAGMA AUTONOMOUS_TRANSACTION`:**  
     * Used in [`TT_CHECKPOINT_PKG`](file:///Users/patnambhanuprakash/Desktop/DBMS/database/checkpoints/06_create_checkpoint_pkg.sql) to commit checkpoint data and in [`TT_RECONSTRUCTION_PKG`](file:///Users/patnambhanuprakash/Desktop/DBMS/database/reconstruction/07_create_reconstruction_engine.sql) to record telemetry metrics without acquiring locks on the caller's active business session.

---

### Chapter 19: Recovery System & Checkpoints (`ch19.pdf`)
* **Slide Topics:**
  * Failure Classification & Storage Structure.
  * Log-Based Recovery: Write-Ahead Logging (WAL), Redo logs, Undo logs.
  * **Checkpoints:** Purpose of checkpoints (bounding log replay time), Checkpoint types, Fuzzy checkpointing.
  * Recovery Algorithms: Replaying deltas forward (Redo) and backward (Undo).
* **Where and How Used in This Project:**
  1. **WAL-Inspired Historical Logging:**  
     * `TT_CHANGE_LOG` acts as an auditable write-ahead log:
       * `old_values` represents the **Undo** image.
       * `new_values` and `delta_values` represent the **Redo** image.
  2. **State Reconstruction via Checkpoint + Redo Replay:**  
     * [`TT_RECONSTRUCTION_PKG.reconstruct_row`](file:///Users/patnambhanuprakash/Desktop/DBMS/database/reconstruction/07_create_reconstruction_engine.sql) locates the closest preceding baseline checkpoint and applies subsequent forward Redo deltas up to $T_{\text{target}}$.
  3. **Workload-Aware Adaptive Checkpointing Cost Model:**  
     * Traditional recovery checkpoints bound crash recovery time. This project adapts that exact principle to **bound historical query latency**:
       $$\text{Score}(T) = (\Delta_{\text{changes}} \times Q_{\text{freq}}) - (\alpha \times S_{\text{bytes}})$$
     * Checkpoints are materialized only when the future query latency savings outweigh the snapshot storage overhead.

---

## 3. Reviewer & Viva Defense Guide

Use these talking points when defending the project's connection to textbook theory:

1. **"Why use custom triggers instead of Oracle Flashback Data Archive (FDA)?"**
   * *Answer (Ch 5 & 19):* FDA requires expensive Oracle Enterprise Edition licensing, operates as a black box, and performs destructive rollbacks that erase intermediate audit history. Our custom engine runs on standard/free editions (Oracle XE), provides transparent adaptive heuristics, and supports Safe Forward Restoration.
2. **"How does the project maintain ACID atomicity between business operations and audit logs?"**
   * *Answer (Ch 17):* Change data capture is synchronous within the user's DML transaction. Triggers do not commit autonomously; if the user's transaction issues a `ROLLBACK`, the change log entry is discarded by the database kernel simultaneously.
3. **"How does your adaptive checkpointing model prevent query degradation?"**
   * *Answer (Ch 13 & 19):* In a pure log-only system, querying a table with 10,000 updates requires replaying 10,000 deltas in memory ($O(N)$ latency). Our adaptive cost formula monitors change velocity and historical query frequencies, materializing a checkpoint boundary before replay latency degrades.
4. **"How does the system handle concurrent transactions with identical clock timestamps?"**
   * *Answer (Ch 17 & 18):* Wall-clock timestamps can collide or suffer clock skew. The engine enforces linear serializability using `TT_COMMIT_ORDER_SEQ.NEXTVAL` to strictly sequence delta replay.
5. **"Does JSON storage violate the Relational Model (1NF)?"**
   * *Answer (Ch 2 & 7):* No. The operational business tables (`CUSTOMERS`, `PRODUCTS`, `ORDERS`) are strictly 3NF relational schemas. JSON is used only as an optimized variable-length delta container in the temporal storage layer and is projected back into relational tuples on-demand via Oracle's `JSON_TABLE`.

