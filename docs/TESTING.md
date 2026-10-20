# Testing & Verification Strategy
**Project:** Time Travel Database System  
**Test Layers:** Oracle PL/SQL Verification + Python pytest Automation  

---

## 1. Test Layer Overview

The system employs a dual-tier testing strategy:
1. **Tier A: Oracle PL/SQL In-Database Test Harness** (`database/11_verify_installation.sql` & `database/13_run_demo.sql`):
   - Executed directly within Oracle 21c XE.
   - Tests table existence, sequence generation, package validity, trigger firing, ACID rollback atomicity, and native PL/SQL reconstruction.
2. **Tier B: FastAPI & Integration Test Suite** (`backend/tests/`):
   - 17 automated tests run via `pytest`.
   - Tests REST API endpoints, JSON serialization, Pydantic schemas, and error handling.

---

## 2. In-Database Oracle PL/SQL Test Coverage

| Test Case | Script / Procedure | Expected Result | Status |
| :--- | :--- | :--- | :--- |
| **Schema Integrity** | `11_verify_installation.sql` | 12 tables exist in `USER_TABLES` | PASS |
| **Package Compilation** | `11_verify_installation.sql` | 0 packages in `STATUS = 'INVALID'` | PASS |
| **Same-Tx Trigger Capture** | `13_run_demo.sql` | INSERT into CUSTOMERS writes to `TT_CHANGE_LOG` | PASS |
| **Delta Encoding** | `13_run_demo.sql` | UPDATE captures changed columns in `delta_values` | PASS |
| **Tombstone on DELETE** | `13_run_demo.sql` | DELETE removes live row but leaves audit tombstone | PASS |
| **ROLLBACK Atomicity** | `13_run_demo.sql` | Rolled back DML leaves 0 entries in `TT_CHANGE_LOG` | PASS |
| **Checkpoint Materialization**| `13_run_demo.sql` | Consistent row snapshot stored in `TT_CHECKPOINT_DATA` | PASS |
| **Strategy Equivalence** | `13_run_demo.sql` | `LOG_ONLY`, `FIXED`, `ADAPTIVE` produce identical state | PASS |
| **Safe Restoration** | `13_run_demo.sql` | Restores prior state as a NEW forward transaction | PASS |

---

## 3. Python Integration Test Suite (17 Tests)

Run the test suite using pytest:
```bash
source venv/bin/activate
PYTHONPATH=backend pytest backend/tests -v
```

### Verified Test Results:
```text
backend/tests/test_adaptive_policy.py::test_adaptive_policy_skips_when_changes_below_threshold PASSED [  5%]
backend/tests/test_adaptive_policy.py::test_adaptive_policy_triggers_under_high_workload       PASSED [ 11%]
backend/tests/test_api.py::test_health_endpoint                                                PASSED [ 17%]
backend/tests/test_api.py::test_tables_endpoint                                                PASSED [ 23%]
backend/tests/test_api.py::test_time_travel_row_endpoint                                       PASSED [ 29%]
backend/tests/test_api.py::test_checkpoints_list_and_create                                    PASSED [ 35%]
backend/tests/test_api.py::test_restore_preview                                                PASSED [ 41%]
backend/tests/test_api.py::test_crud_insert_update_delete_and_timeline                          PASSED [ 47%]
backend/tests/test_checkpoints.py::test_checkpoint_creation_and_status                         PASSED [ 52%]
backend/tests/test_checkpoints.py::test_checkpoint_materialization_and_lookup                  PASSED [ 58%]
backend/tests/test_diff_restore.py::test_compare_states_detects_modifications                  PASSED [ 64%]
backend/tests/test_diff_restore.py::test_preview_restore_shows_correct_proposed_action          PASSED [ 70%]
backend/tests/test_diff_restore.py::test_execute_restore_creates_new_transaction_preserving_history PASSED [ 76%]
backend/tests/test_time_travel.py::test_insert_followed_by_historical_lookup                   PASSED [ 82%]
backend/tests/test_time_travel.py::test_update_followed_by_lookup_before_and_after             PASSED [ 88%]
backend/tests/test_time_travel.py::test_delete_followed_by_lookup_before_and_after             PASSED [ 94%]
backend/tests/test_time_travel.py::test_reconstruction_with_and_without_checkpoint            PASSED [100%]

======================== 17 passed, 1 warning in 0.65s =========================
```

---

## 4. Distinguishing Real Oracle Tests from Emulator Tests
- **When connected to Oracle XE** (`ORACLE_DSN` configured and Oracle instance healthy), all queries and PL/SQL package calls execute against the live database via `oracledb`.
- **When running offline**, the backend utilizes `oracle_engine_emulator.py`, which is explicitly documented as a diagnostic offline fallback so the project can be inspected on laptops without Docker.
