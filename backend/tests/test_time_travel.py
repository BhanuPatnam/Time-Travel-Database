import pytest
from datetime import datetime, timezone, timedelta
from app.repositories.oracle_engine_emulator import OracleEngineEmulator

@pytest.fixture
def emulator():
    emu = OracleEngineEmulator()
    return emu

def test_insert_followed_by_historical_lookup(emulator):
    # Customer 101 was inserted 120 mins ago with credit 50000.0
    target_ts = emulator._past_iso(90) # between insert (120 mins) and first update (30 mins)
    res = emulator.reconstruct_row("CUSTOMERS", "101", target_ts, strategy="LOG_ONLY")
    assert res["row_state"] is not None
    assert res["row_state"]["customer_id"] == 101
    assert res["row_state"]["credit_limit"] == 50000.0

def test_update_followed_by_lookup_before_and_after(emulator):
    # Update occurred 30 mins ago changing credit from 50000 to 75000
    before_ts = emulator._past_iso(40)
    after_ts = emulator._past_iso(10)

    res_before = emulator.reconstruct_row("CUSTOMERS", "101", before_ts)
    res_after = emulator.reconstruct_row("CUSTOMERS", "101", after_ts)

    assert res_before["row_state"]["credit_limit"] == 50000.0
    assert res_after["row_state"]["credit_limit"] == 75000.0
    assert res_before["row_state"]["phone"] == "+1-555-0101"
    assert res_after["row_state"]["phone"] == "+1-555-0999"

def test_delete_followed_by_lookup_before_and_after(emulator):
    # Add record then delete
    now = emulator._now_iso()
    t_insert = emulator._past_iso(10)
    t_delete = emulator._past_iso(5)

    emulator.change_log.append({
        "change_id": 901, "tx_id": 99, "table_name": "CUSTOMERS", "record_pk": "777",
        "operation_type": "INSERT", "old_values": None,
        "new_values": {"customer_id": 777, "name": "Ephemeral User", "email": "eph@test.com", "phone": "111", "status": "ACTIVE", "credit_limit": 1000.0},
        "delta_values": None, "changed_columns": "ALL",
        "change_timestamp": t_insert, "commit_order_seq": 901
    })
    emulator.change_log.append({
        "change_id": 902, "tx_id": 100, "table_name": "CUSTOMERS", "record_pk": "777",
        "operation_type": "DELETE", "old_values": {"customer_id": 777, "name": "Ephemeral User"},
        "new_values": None, "delta_values": None, "changed_columns": None,
        "change_timestamp": t_delete, "commit_order_seq": 902
    })

    # Lookup before delete: must exist
    res_before = emulator.reconstruct_row("CUSTOMERS", "777", emulator._past_iso(7))
    assert res_before["row_state"] is not None
    assert res_before["row_state"]["customer_id"] == 777

    # Lookup after delete: must be None
    res_after = emulator.reconstruct_row("CUSTOMERS", "777", emulator._past_iso(2))
    assert res_after["row_state"] is None

def test_reconstruction_with_and_without_checkpoint(emulator):
    target_ts = emulator._past_iso(10)
    # With checkpoint (ADAPTIVE)
    res_adaptive = emulator.reconstruct_row("CUSTOMERS", "101", target_ts, strategy="ADAPTIVE")
    # Without checkpoint (LOG_ONLY)
    res_log_only = emulator.reconstruct_row("CUSTOMERS", "101", target_ts, strategy="LOG_ONLY")

    # Both must reach the exact same state!
    assert res_adaptive["row_state"] == res_log_only["row_state"]
    # Checkpoint ID must be used for ADAPTIVE
    assert res_adaptive["checkpoint_id_used"] is not None
    # LOG_ONLY should not use a checkpoint
    assert res_log_only["checkpoint_id_used"] is None
    # Changes replayed in ADAPTIVE should be less than or equal to LOG_ONLY
    assert res_adaptive["changes_replayed"] <= res_log_only["changes_replayed"]


def test_table_snapshot_keeps_rows_that_have_not_been_updated(emulator):
    """Initial rows must not disappear merely because they have no later mutation."""
    snapshot = emulator.reconstruct_table("CUSTOMERS", emulator._past_iso(5))

    assert snapshot["total_active_rows"] == 5
    assert {row["customer_id"] for row in snapshot["rows"]} == {101, 102, 103, 104, 105}


def test_table_snapshot_marks_rows_updated_after_target_time(emulator):
    snapshot = emulator.reconstruct_table("CUSTOMERS", emulator._past_iso(40))

    assert snapshot["change_markers"]["101"]["changed_columns"] == "phone,credit_limit"
    assert snapshot["change_markers"]["105"]["changed_columns"] == "status,credit_limit"
