# Database Design: Time Travel Database System
**Target Engine:** Oracle Database 21c XE / Standard Edition  
**Dialect:** Oracle SQL & PL/SQL  

---

## 1. Entity-Relationship Model (Mermaid Diagram)

```mermaid
erDiagram
    CUSTOMERS ||--o{ ORDERS : places
    ORDERS ||--|{ ORDER_ITEMS : contains
    PRODUCTS ||--o{ ORDER_ITEMS : included_in

    TT_TRANSACTIONS ||--o{ TT_CHANGE_LOG : contains
    TT_CHECKPOINTS ||--o{ TT_CHECKPOINT_DATA : stores

    TT_BRANCHES ||--o{ TT_BRANCH_COMMITS : contains
    TT_BRANCH_COMMITS ||--o{ TT_BRANCH_CHANGESET : contains
    TT_BRANCHES ||--o{ TT_BRANCH_MERGE_HISTORY : source_of
    TT_BRANCHES ||--o{ TT_BRANCH_MERGE_HISTORY : target_of

    CUSTOMERS {
        NUMBER customer_id PK
        VARCHAR2 name
        VARCHAR2 email UK
        VARCHAR2 phone
        VARCHAR2 status
        NUMBER credit_limit
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    PRODUCTS {
        NUMBER product_id PK
        VARCHAR2 sku UK
        VARCHAR2 name
        VARCHAR2 category
        NUMBER unit_price
        NUMBER stock_quantity
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    ORDERS {
        NUMBER order_id PK
        NUMBER customer_id FK
        TIMESTAMP order_date
        VARCHAR2 status
        NUMBER total_amount
        VARCHAR2 notes
        TIMESTAMP updated_at
    }

    ORDER_ITEMS {
        NUMBER item_id PK
        NUMBER order_id FK
        NUMBER product_id FK
        NUMBER quantity
        NUMBER unit_price
        NUMBER subtotal
    }

    TT_TRANSACTIONS {
        NUMBER tx_id PK
        VARCHAR2 tx_name
        VARCHAR2 client_identifier
        TIMESTAMP started_at
        TIMESTAMP committed_at
        VARCHAR2 status
        NUMBER commit_order_seq
    }

    TT_CHANGE_LOG {
        NUMBER change_id PK
        NUMBER tx_id FK
        VARCHAR2 table_name
        VARCHAR2 record_pk
        VARCHAR2 operation_type
        CLOB old_values
        CLOB new_values
        CLOB delta_values
        VARCHAR2 changed_columns
        TIMESTAMP change_timestamp
        NUMBER commit_order_seq
        NUMBER schema_version
    }

    TT_CHECKPOINTS {
        NUMBER checkpoint_id PK
        VARCHAR2 checkpoint_name
        VARCHAR2 table_name
        VARCHAR2 strategy_used
        VARCHAR2 status
        NUMBER row_count
        NUMBER storage_bytes
        NUMBER creation_duration_ms
        NUMBER boundary_commit_seq
        TIMESTAMP boundary_timestamp
        TIMESTAMP created_at
    }

    TT_CHECKPOINT_DATA {
        NUMBER data_id PK
        NUMBER checkpoint_id FK
        VARCHAR2 table_name
        VARCHAR2 record_pk
        CLOB row_data
    }

    TT_BRANCHES {
        NUMBER branch_id PK
        VARCHAR2 branch_name UK
        NUMBER parent_branch_id FK
        VARCHAR2 base_commit_id
        TIMESTAMP base_timestamp
        VARCHAR2 branch_status
        NUMBER is_default
    }

    TT_BRANCH_COMMITS {
        VARCHAR2 commit_id PK
        NUMBER branch_id FK
        VARCHAR2 parent_commit_id FK
        VARCHAR2 commit_message
        TIMESTAMP commit_timestamp
        NUMBER commit_order_seq
        VARCHAR2 commit_type
        VARCHAR2 merge_parent_commit_id
    }

    TT_BRANCH_CHANGESET {
        NUMBER changeset_id PK
        VARCHAR2 commit_id FK
        VARCHAR2 table_name
        VARCHAR2 record_id
        VARCHAR2 operation_type
        CLOB before_values
        CLOB after_values
        CLOB delta_values
    }

    TT_BRANCH_MERGE_HISTORY {
        NUMBER merge_id PK
        NUMBER source_branch_id FK
        NUMBER target_branch_id FK
        VARCHAR2 source_commit_id
        VARCHAR2 target_commit_id
        VARCHAR2 merge_commit_id
        VARCHAR2 merge_status
        NUMBER conflicts_count
    }
```

---

## 2. Table Specifications & Constraint Details

### 2.1. Business Tables
1. **`CUSTOMERS`**:
   - `customer_id` (NUMBER, PK): Primary key populated from `CUSTOMER_ID_SEQ`.
   - `name` (VARCHAR2(100), NOT NULL): Customer legal or corporate name.
   - `email` (VARCHAR2(100), UNIQUE, NOT NULL): Unique contact email.
   - `status` (VARCHAR2(20), CHECK `status IN ('ACTIVE','INACTIVE','SUSPENDED','VIP')`).
   - `credit_limit` (NUMBER(12,2), CHECK `credit_limit >= 0`).

2. **`PRODUCTS`**:
   - `product_id` (NUMBER, PK): Primary key from `PRODUCT_ID_SEQ`.
   - `sku` (VARCHAR2(50), UNIQUE, NOT NULL): Stock keeping unit.
   - `unit_price` (NUMBER(10,2), CHECK `unit_price >= 0`).
   - `stock_quantity` (NUMBER(8), CHECK `stock_quantity >= 0`).

3. **`ORDERS`**:
   - `order_id` (NUMBER, PK): Primary key from `ORDER_ID_SEQ`.
   - `customer_id` (NUMBER, FK): References `CUSTOMERS(customer_id)`.
   - `status` (VARCHAR2(20), CHECK `status IN ('PENDING','PROCESSING','COMPLETED','DELIVERED','CANCELLED')`).
   - `total_amount` (NUMBER(12,2), CHECK `total_amount >= 0`).

4. **`ORDER_ITEMS`**:
   - `item_id` (NUMBER, PK): Primary key from `ORDER_ITEM_ID_SEQ`.
   - `order_id` (NUMBER, FK): References `ORDERS(order_id)` ON DELETE CASCADE.
   - `product_id` (NUMBER, FK): References `PRODUCTS(product_id)`.
   - `quantity` (NUMBER(6), CHECK `quantity > 0`).

---

### 2.2. Temporal & History Tables
1. **`TT_CHANGE_LOG`**:
   - `change_id` (NUMBER, PK): Monotonic sequence `TT_CHANGE_SEQ`.
   - `tx_id` (NUMBER, FK): Links to `TT_TRANSACTIONS(tx_id)`.
   - `table_name` (VARCHAR2(60), NOT NULL): Target entity.
   - `record_pk` (VARCHAR2(255), NOT NULL): Primary key value as string.
   - `operation_type` (VARCHAR2(10), CHECK `IN ('INSERT','UPDATE','DELETE','RESTORE')`).
   - `old_values` (CLOB, CHECK `IS JSON`): Full state prior to operation.
   - `new_values` (CLOB, CHECK `IS JSON`): Full state after operation.
   - `delta_values` (CLOB, CHECK `IS JSON`): Minimal JSON patch of altered columns only.
   - `commit_order_seq` (NUMBER, NOT NULL): Strict deterministic sequencing.

2. **`TT_CHECKPOINTS` & `TT_CHECKPOINT_DATA`**:
   - Stores pre-materialized row states at verified points in time.
   - Indexed by `(table_name, boundary_timestamp)` for rapid $O(\log n)$ lookup during historical queries.

3. **`TT_POLICY_DECISIONS`**:
   - `decision_id` (NUMBER, PK).
   - `table_name` (VARCHAR2(60)).
   - `input_metrics` (VARCHAR2(500)): Explains delta count, query frequency, and storage weight.
   - `computed_score` (NUMBER(10,3)): The numerical score from the adaptive cost model.
   - `action_taken` (VARCHAR2(30)): `CHECKPOINT_CREATED` or `DEFERRED_BELOW_COST_THRESHOLD`.
   - `decision_reason` (VARCHAR2(500)): Human-readable explanation.

---

### 2.3. Temporal Branching & Merge Tables
1. **`TT_BRANCHES`**:
   - `branch_id` (NUMBER, PK): Primary key from `TT_BRANCH_SEQ`.
   - `branch_name` (VARCHAR2(100), UNIQUE, NOT NULL): Human-readable branch tag (e.g., `feature/pricing-v2`).
   - `parent_branch_id` (NUMBER, FK): References parent branch in `TT_BRANCHES(branch_id)`.
   - `base_commit_id` (VARCHAR2(64)): Ancestor commit point at branch creation.
   - `base_timestamp` (TIMESTAMP WITH TIME ZONE, NOT NULL): State baseline timestamp.
   - `branch_status` (VARCHAR2(20), CHECK `IN ('ACTIVE', 'MERGED', 'DELETED')`).
   - `is_default` (NUMBER(1), CHECK `IN (0, 1)`): Flag indicating default branch (`main` = 1).

2. **`TT_BRANCH_COMMITS`**:
   - `commit_id` (VARCHAR2(64), PK): Unique commit identifier (e.g., `c101`).
   - `branch_id` (NUMBER, FK): Links to `TT_BRANCHES(branch_id)` ON DELETE CASCADE.
   - `parent_commit_id` (VARCHAR2(64), FK): Direct predecessor commit in branch history.
   - `commit_message` (VARCHAR2(500), NOT NULL): Description of the modification.
   - `commit_timestamp` (TIMESTAMP WITH TIME ZONE, NOT NULL): Commit creation time.
   - `commit_order_seq` (NUMBER, NOT NULL): Monotonic sequence number for serializability.
   - `commit_type` (VARCHAR2(20), CHECK `IN ('INITIAL', 'NORMAL', 'MERGE', 'FAST_FORWARD')`).
   - `merge_parent_commit_id` (VARCHAR2(64), FK): Second parent commit recorded on merges.

3. **`TT_BRANCH_CHANGESET`**:
   - `changeset_id` (NUMBER, PK): Primary key from `TT_CHANGESET_SEQ`.
   - `commit_id` (VARCHAR2(64), FK): Links to `TT_BRANCH_COMMITS(commit_id)` ON DELETE CASCADE.
   - `table_name` (VARCHAR2(60), NOT NULL): Entity altered.
   - `record_id` (VARCHAR2(255), NOT NULL): Entity primary key.
   - `operation_type` (VARCHAR2(10), CHECK `IN ('INSERT', 'UPDATE', 'DELETE')`).
   - `before_values`, `after_values`, `delta_values` (CLOB, CHECK `IS JSON`).

4. **`TT_BRANCH_MERGE_HISTORY`**:
   - `merge_id` (NUMBER, PK): Primary key from `TT_MERGE_SEQ`.
   - `source_branch_id` (NUMBER, FK), `target_branch_id` (NUMBER, FK).
   - `source_commit_id`, `target_commit_id`, `merge_commit_id`.
   - `merge_status` (VARCHAR2(20), CHECK `IN ('SUCCESS', 'CONFLICT', 'ABORTED', 'FAST_FORWARD')`).
   - `conflicts_count` (NUMBER): Count of unresolved or detected record conflicts.
   - `conflict_details` (CLOB, CHECK `IS JSON`): Full diagnostic 3-way conflict payload.

---

## 3. Indexing Strategy for Reconstruction Performance

| Index Name | Table | Indexed Columns | Purpose |
| :--- | :--- | :--- | :--- |
| `IDX_TT_CHANGELOG_LOOKUP` | `TT_CHANGE_LOG` | `(table_name, record_pk, change_timestamp)` | Fast point lookup for single-row reconstruction |
| `IDX_TT_CHANGELOG_TIME` | `TT_CHANGE_LOG` | `(table_name, change_timestamp, commit_order_seq)` | Table-wide time range scans |
| `IDX_TT_CHANGELOG_SEQ` | `TT_CHANGE_LOG` | `(commit_order_seq)` | Strict commit ordering during delta replay |
| `IDX_TT_CP_LOOKUP` | `TT_CHECKPOINTS` | `(table_name, boundary_timestamp, status)` | Fast discovery of nearest preceding checkpoint |
| `IDX_TT_CP_DATA` | `TT_CHECKPOINT_DATA` | `(checkpoint_id, table_name, record_pk)` | Instant retrieval of baseline row at checkpoint |
| `IDX_TT_QMETRICS_TBL_TIME` | `TT_QUERY_METRICS`| `(table_name, queried_at)` | Dynamic query frequency window computation |
| `IDX_TT_COMMITS_BRANCH` | `TT_BRANCH_COMMITS` | `(branch_id, commit_order_seq)` | Fast topological commit history queries |
| `IDX_TT_COMMITS_PARENT` | `TT_BRANCH_COMMITS` | `(parent_commit_id)` | Lineage and merge base traversal |
| `IDX_TT_CHANGESET_COMMIT` | `TT_BRANCH_CHANGESET`| `(commit_id)` | Quick retrieval of changes for a commit |
| `IDX_TT_CHANGESET_LOOKUP` | `TT_BRANCH_CHANGESET`| `(table_name, record_id)` | Entity mutation search in branch workspace |
| `IDX_TT_MERGE_STATUS` | `TT_BRANCH_MERGE_HISTORY`| `(merge_status, merge_timestamp)` | Fast lookup of pending / active merges |
