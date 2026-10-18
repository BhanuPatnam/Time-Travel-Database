import pytest
from app.repositories.oracle_engine_emulator import OracleEngineEmulator

def test_compare_states_detects_modifications():
    emulator = OracleEngineEmulator()
    t_start = emulator._past_iso(50)
    t_end = emulator._now_iso()

    diff = emulator.compare_states("CUSTOMERS", t_start, t_end)
    assert diff["table_name"] == "CUSTOMERS"
    assert diff["modified_count"] >= 1
    assert any(c["record_pk"] == "101" for c in diff["changes"])

def test_preview_restore_shows_correct_proposed_action():
    emulator = OracleEngineEmulator()
    # At 90 mins ago, customer 101 had credit 50000; currently has 75000
    preview = emulator.preview_restore("CUSTOMERS", "101", emulator._past_iso(90))
    assert preview["proposed_action"] == "UPDATE_CURRENT_TO_HISTORICAL"
    assert preview["can_restore"] is True
    assert preview["historical_state"]["credit_limit"] == 50000.0
    assert preview["current_state"]["credit_limit"] == 75000.0

def test_execute_restore_creates_new_transaction_preserving_history():
    emulator = OracleEngineEmulator()
    target_ts = emulator._past_iso(90)
    total_changes_before = len(emulator.change_log)

    res = emulator.execute_restore("CUSTOMERS", "101", target_ts, user_note="Automated test restore")
    assert res["status"] == "SUCCESS"
    assert res["tx_id"] > 0

    # Current value must be restored
    assert emulator.customers["101"]["credit_limit"] == 50000.0

    # History was not deleted; a new RESTORE entry was added
    assert len(emulator.change_log) == total_changes_before + 1
    latest_change = emulator.change_log[-1]
    assert latest_change["operation_type"] == "RESTORE"
    assert latest_change["record_pk"] == "101"
