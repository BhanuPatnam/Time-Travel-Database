import pytest
from app.repositories.oracle_engine_emulator import OracleEngineEmulator

def test_adaptive_policy_skips_when_changes_below_threshold():
    emulator = OracleEngineEmulator()
    # At baseline, changes since last CP for CUSTOMERS is 2 (< 25)
    decision = emulator.evaluate_adaptive_policy("CUSTOMERS")
    assert decision["action_taken"] == "SKIPPED_BELOW_THRESHOLD"
    assert decision["checkpoint_id"] is None
    assert "below trigger threshold" in decision["decision_reason"]

def test_adaptive_policy_triggers_under_high_workload():
    emulator = OracleEngineEmulator()
    # Generate 30 changes to surpass ADAPTIVE_CHANGE_THRESHOLD (25)
    for i in range(30):
        emulator.seq_change += 1
        emulator.seq_commit += 1
        emulator.change_log.append({
            "change_id": emulator.seq_change,
            "tx_id": 100,
            "table_name": "CUSTOMERS",
            "record_pk": "101",
            "operation_type": "UPDATE",
            "old_values": {"credit_limit": 50000.0},
            "new_values": {"credit_limit": 50000.0 + i},
            "delta_values": None,
            "changed_columns": "credit_limit",
            "change_timestamp": emulator._now_iso(),
            "commit_order_seq": emulator.seq_commit
        })

    decision = emulator.evaluate_adaptive_policy("CUSTOMERS")
    assert decision["action_taken"] == "CHECKPOINT_CREATED"
    assert decision["checkpoint_id"] is not None
    assert "Adaptive trigger met" in decision["decision_reason"]
