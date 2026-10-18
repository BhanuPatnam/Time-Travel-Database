import pytest
from app.repositories.oracle_engine_emulator import OracleEngineEmulator

def test_checkpoint_creation_and_status():
    emulator = OracleEngineEmulator()
    cp = emulator.create_checkpoint("CUSTOMERS", strategy="MANUAL", reason="Unit test checkpoint")

    assert cp["checkpoint_id"] > 0
    assert cp["status"] == "VALID"
    assert cp["row_count"] >= 5
    assert cp["storage_bytes"] > 0
    assert cp["table_name"] == "CUSTOMERS"
    assert cp["target_boundary_ts"] is not None

def test_checkpoint_materialization_and_lookup():
    emulator = OracleEngineEmulator()
    cp = emulator.create_checkpoint("PRODUCTS", strategy="MANUAL", reason="Products snapshot")

    # Verify rows materialized in checkpoint_data
    cp_rows = [d for d in emulator.checkpoint_data if d["checkpoint_id"] == cp["checkpoint_id"]]
    assert len(cp_rows) == len(emulator.products)
