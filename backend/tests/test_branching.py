import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from app.main import app
from app.repositories.oracle_engine_emulator import oracle_emulator

client = TestClient(app)

@pytest.fixture(autouse=True)
def reset_db():
    oracle_emulator.reset_and_seed()
    yield

def test_01_create_branch_from_main():
    """1. Creating a branch from main."""
    res = client.post("/api/branches", json={
        "branch_name": "feature/discount-tier",
        "parent_branch_name": "main",
        "description": "Branching from production main"
    })
    assert res.status_code == 201
    data = res.json()
    assert data["branch_name"] == "feature/discount-tier"
    assert data["parent_name"] == "main"
    assert data["branch_status"] == "ACTIVE"
    assert data["commit_count"] >= 1  # Initial commit created

def test_02_create_branch_from_historical_timestamp():
    """2. Creating a branch from a historical timestamp."""
    past_ts = (datetime.now(timezone.utc) - timedelta(minutes=45)).isoformat()
    res = client.post("/api/branches", json={
        "branch_name": "audit/q3-reconciliation",
        "parent_branch_name": "main",
        "base_timestamp": past_ts,
        "description": "Historical audit branch at 45 mins ago"
    })
    assert res.status_code == 201
    data = res.json()
    assert data["branch_name"] == "audit/q3-reconciliation"
    assert "base_timestamp" in data

def test_03_create_branch_from_another_branch():
    """3. Creating a branch from another branch."""
    # First create parent feature branch
    r1 = client.post("/api/branches", json={
        "branch_name": "feature/pricing-v2",
        "parent_branch_name": "main"
    })
    assert r1.status_code == 201
    parent_id = r1.json()["branch_id"]

    # Now branch from feature/pricing-v2
    r2 = client.post("/api/branches", json={
        "branch_name": "subfeature/bulk-discounts",
        "parent_branch_name": "feature/pricing-v2"
    })
    assert r2.status_code == 201
    child = r2.json()
    assert child["parent_branch_id"] == parent_id
    assert child["parent_name"] == "feature/pricing-v2"

def test_04_independent_branch_updates_and_isolation():
    """4. Independent branch updates (main remains unmodified)."""
    # Create branch
    client.post("/api/branches", json={"branch_name": "exp/customer-credit"})
    
    # Baseline credit limit on main
    main_rec = client.get("/api/tables/CUSTOMERS/records/101").json()
    orig_credit = main_rec["credit_limit"]

    # Commit update on the branch
    commit_res = client.post("/api/branches/exp/customer-credit/commits", json={
        "commit_message": "Increase Acme credit limit to $250,000",
        "author": "analyst@company.com",
        "changes": [{
            "table_name": "CUSTOMERS",
            "record_id": "101",
            "operation_type": "UPDATE",
            "before_values": {"customer_id": 101, "credit_limit": orig_credit},
            "after_values": {"customer_id": 101, "credit_limit": 250000.0},
            "changed_columns": "credit_limit"
        }]
    })
    assert commit_res.status_code == 201
    assert "commit_id" in commit_res.json()

    # Verify branch state has the updated value
    b_state = client.get("/api/branches/exp/customer-credit/state", params={"table_name": "CUSTOMERS"}).json()
    acme_on_branch = next(r for r in b_state["records"] if str(r.get("customer_id")) == "101")
    assert acme_on_branch["credit_limit"] == 250000.0

    # Verify main database remains COMPLETELY UNTOUCHED
    main_rec_after = client.get("/api/tables/CUSTOMERS/records/101").json()
    assert main_rec_after["credit_limit"] == orig_credit

def test_05_branch_specific_deletes():
    """5. Branch-specific deletes without deleting live main records."""
    client.post("/api/branches", json={"branch_name": "exp/remove-deprecated"})

    # Commit delete on branch for product 201
    del_res = client.post("/api/branches/exp/remove-deprecated/commits", json={
        "commit_message": "Deprecate server SKU-SRV-01 on branch",
        "author": "dev@company.com",
        "changes": [{
            "table_name": "PRODUCTS",
            "record_id": "201",
            "operation_type": "DELETE",
            "before_values": {"product_id": 201, "sku": "SKU-SRV-01"},
            "after_values": None
        }]
    })
    assert del_res.status_code == 201

    # Check branch state: product 201 should NOT exist
    b_state = client.get("/api/branches/exp/remove-deprecated/state", params={"table_name": "PRODUCTS"}).json()
    assert not any(str(r.get("product_id")) == "201" for r in b_state["records"])

    # Check main database: product 201 MUST still exist
    main_prod = client.get("/api/tables/PRODUCTS/records/201").json()
    assert main_prod is not None
    assert str(main_prod["product_id"]) == "201"

def test_06_commit_history_integrity():
    """6. Commit history integrity: monotonic order, parent links, immutable trail."""
    client.post("/api/branches", json={"branch_name": "exp/ledger"})

    c1 = client.post("/api/branches/exp/ledger/commits", json={
        "commit_message": "First update",
        "changes": [{"table_name": "CUSTOMERS", "record_id": "102", "operation_type": "UPDATE", "after_values": {"status": "SUSPENDED"}}]
    }).json()

    c2 = client.post("/api/branches/exp/ledger/commits", json={
        "commit_message": "Second update",
        "changes": [{"table_name": "CUSTOMERS", "record_id": "103", "operation_type": "UPDATE", "after_values": {"status": "SUSPENDED"}}]
    }).json()

    history = client.get("/api/branches/exp/ledger/commits").json()
    assert len(history) >= 3  # Initial + C1 + C2
    # Verify descending ordering
    assert history[0]["commit_id"] == c2["commit_id"]
    assert history[1]["commit_id"] == c1["commit_id"]
    # Verify parent pointer
    assert history[0]["parent_commit_id"] == c1["commit_id"]

def test_07_branch_comparison():
    """7. Branch comparison against base branch."""
    client.post("/api/branches", json={"branch_name": "exp/pricing-mod"})

    # Make updates and an insert
    client.post("/api/branches/exp/pricing-mod/commits", json={
        "commit_message": "Modify product pricing and add promotional item",
        "changes": [
            {
                "table_name": "PRODUCTS",
                "record_id": "201",
                "operation_type": "UPDATE",
                "before_values": {"product_id": 201, "unit_price": 4250.0},
                "after_values": {"product_id": 201, "unit_price": 3999.0}
            },
            {
                "table_name": "PRODUCTS",
                "record_id": "299",
                "operation_type": "INSERT",
                "before_values": None,
                "after_values": {"product_id": 299, "sku": "SKU-PROMO", "name": "Promo Bundle", "category": "Promo", "unit_price": 99.0, "stock_quantity": 500}
            }
        ]
    })

    comp_res = client.post("/api/branches/compare", json={
        "base_branch": "main",
        "compare_branch": "exp/pricing-mod"
    })
    assert comp_res.status_code == 200
    comp = comp_res.json()
    assert comp["total_changes"] == 2
    assert comp["added_count"] == 1
    assert comp["modified_count"] == 1

def test_08_fast_forward_merge():
    """8. Fast-forward merge when target branch has not diverged."""
    client.post("/api/branches", json={"branch_name": "feature/fast-forward-test"})

    client.post("/api/branches/feature/fast-forward-test/commits", json={
        "commit_message": "Feature addition for fast forward",
        "changes": [{
            "table_name": "PRODUCTS",
            "record_id": "203",
            "operation_type": "UPDATE",
            "after_values": {"product_id": 203, "stock_quantity": 75}
        }]
    })

    merge_res = client.post("/api/branches/merge", json={
        "source_branch": "feature/fast-forward-test",
        "target_branch": "main",
        "merge_message": "Fast-forward merge to main"
    })
    assert merge_res.status_code == 200
    m_data = merge_res.json()
    assert m_data["status"] == "SUCCESS"
    assert m_data["merge_type"] == "FAST_FORWARD"
    assert m_data["conflicts_count"] == 0

def test_09_three_way_merge_clean():
    """9. Clean three-way merge when both branches have non-conflicting commits."""
    # Create feature branch
    client.post("/api/branches", json={"branch_name": "feature/branch-a"})
    # Commit on feature branch
    client.post("/api/branches/feature/branch-a/commits", json={
        "commit_message": "Update customer 101",
        "changes": [{
            "table_name": "CUSTOMERS",
            "record_id": "101",
            "operation_type": "UPDATE",
            "after_values": {"customer_id": 101, "phone": "+1-555-7777"}
        }]
    })

    # Commit on main to make it diverge
    client.post("/api/branches/main/commits", json={
        "commit_message": "Update customer 104 on main",
        "changes": [{
            "table_name": "CUSTOMERS",
            "record_id": "104",
            "operation_type": "UPDATE",
            "after_values": {"customer_id": 104, "phone": "+1-555-8888"}
        }]
    })

    merge_res = client.post("/api/branches/merge", json={
        "source_branch": "feature/branch-a",
        "target_branch": "main"
    })
    assert merge_res.status_code == 200
    m_data = merge_res.json()
    assert m_data["status"] == "SUCCESS"
    assert m_data["merge_type"] == "THREE_WAY"
    assert m_data["conflicts_count"] == 0

def test_10_same_column_conflict_detection():
    """10. Same-column conflict detection."""
    client.post("/api/branches", json={"branch_name": "feature/conflict-test"})

    # Source modifies credit limit of 101 to 90000
    client.post("/api/branches/feature/conflict-test/commits", json={
        "commit_message": "Branch changes credit limit",
        "changes": [{
            "table_name": "CUSTOMERS",
            "record_id": "101",
            "operation_type": "UPDATE",
            "after_values": {"customer_id": 101, "credit_limit": 90000.0}
        }]
    })

    # Target (main) modifies SAME credit limit to 85000
    client.post("/api/branches/main/commits", json={
        "commit_message": "Main changes credit limit",
        "changes": [{
            "table_name": "CUSTOMERS",
            "record_id": "101",
            "operation_type": "UPDATE",
            "after_values": {"customer_id": 101, "credit_limit": 85000.0}
        }]
    })

    merge_res = client.post("/api/branches/merge", json={
        "source_branch": "feature/conflict-test",
        "target_branch": "main"
    })
    assert merge_res.status_code == 200
    m_data = merge_res.json()
    assert m_data["status"] == "CONFLICT"
    assert m_data["conflicts_count"] >= 1
    conf = m_data["conflicts"][0]
    assert conf["conflict_type"] == "SAME_COLUMN_MODIFICATION"
    assert "credit_limit" in conf["conflicting_columns"]

def test_11_different_column_modification_clean_merge():
    """11. Different-column modifications on the same record result in clean column-level auto-merge."""
    client.post("/api/branches", json={"branch_name": "feature/phone-update"})

    # Branch modifies phone of customer 102
    client.post("/api/branches/feature/phone-update/commits", json={
        "commit_message": "Update customer 102 phone",
        "changes": [{
            "table_name": "CUSTOMERS",
            "record_id": "102",
            "operation_type": "UPDATE",
            "after_values": {"customer_id": 102, "phone": "+1-555-9999"}
        }]
    })

    # Main modifies credit_limit of customer 102
    client.post("/api/branches/main/commits", json={
        "commit_message": "Update customer 102 credit limit",
        "changes": [{
            "table_name": "CUSTOMERS",
            "record_id": "102",
            "operation_type": "UPDATE",
            "after_values": {"customer_id": 102, "credit_limit": 140000.0}
        }]
    })

    # Merge should succeed automatically via column-level merge
    merge_res = client.post("/api/branches/merge", json={
        "source_branch": "feature/phone-update",
        "target_branch": "main"
    })
    assert merge_res.status_code == 200
    m_data = merge_res.json()
    assert m_data["status"] == "SUCCESS"
    assert m_data["conflicts_count"] == 0

def test_12_delete_versus_update_conflict():
    """12. Delete-versus-update conflict detection."""
    client.post("/api/branches", json={"branch_name": "feature/delete-test"})

    # Source deletes product 202
    client.post("/api/branches/feature/delete-test/commits", json={
        "commit_message": "Delete product 202 on branch",
        "changes": [{
            "table_name": "PRODUCTS",
            "record_id": "202",
            "operation_type": "DELETE",
            "after_values": None
        }]
    })

    # Target (main) updates product 202 price
    client.post("/api/branches/main/commits", json={
        "commit_message": "Update product 202 price on main",
        "changes": [{
            "table_name": "PRODUCTS",
            "record_id": "202",
            "operation_type": "UPDATE",
            "after_values": {"product_id": 202, "unit_price": 13500.0}
        }]
    })

    merge_res = client.post("/api/branches/merge", json={
        "source_branch": "feature/delete-test",
        "target_branch": "main"
    })
    assert merge_res.status_code == 200
    m_data = merge_res.json()
    assert m_data["status"] == "CONFLICT"
    assert any(c["conflict_type"] == "DELETE_VS_UPDATE" for c in m_data["conflicts"])

def test_13_abort_merge():
    """13. Failed or conflicted merge can be aborted cleanly."""
    client.post("/api/branches", json={"branch_name": "feature/abort-test"})

    client.post("/api/branches/feature/abort-test/commits", json={
        "commit_message": "Branch change",
        "changes": [{"table_name": "CUSTOMERS", "record_id": "103", "operation_type": "UPDATE", "after_values": {"credit_limit": 999999.0}}]
    })
    client.post("/api/branches/main/commits", json={
        "commit_message": "Main change",
        "changes": [{"table_name": "CUSTOMERS", "record_id": "103", "operation_type": "UPDATE", "after_values": {"credit_limit": 111111.0}}]
    })

    merge_res = client.post("/api/branches/merge", json={
        "source_branch": "feature/abort-test",
        "target_branch": "main"
    }).json()

    assert merge_res["status"] == "CONFLICT"
    merge_id = merge_res["merge_id"]

    # Abort merge
    abort_res = client.post(f"/api/branches/merge/{merge_id}/abort")
    assert abort_res.status_code == 200
    assert abort_res.json()["status"] == "ABORTED"

def test_14_main_branch_isolation_under_concurrent_branches():
    """14. Main branch isolation: Multiple concurrent branches make changes without polluting main."""
    b1 = client.post("/api/branches", json={"branch_name": "team-a/workspace"}).json()
    b2 = client.post("/api/branches", json={"branch_name": "team-b/workspace"}).json()

    # Team A updates customer 104
    client.post("/api/branches/team-a/workspace/commits", json={
        "commit_message": "Team A change",
        "changes": [{"table_name": "CUSTOMERS", "record_id": "104", "operation_type": "UPDATE", "after_values": {"status": "SUSPENDED"}}]
    })

    # Team B updates customer 105
    client.post("/api/branches/team-b/workspace/commits", json={
        "commit_message": "Team B change",
        "changes": [{"table_name": "CUSTOMERS", "record_id": "105", "operation_type": "UPDATE", "after_values": {"status": "SUSPENDED"}}]
    })

    # Verify team A state
    s_a = client.get("/api/branches/team-a/workspace/state", params={"table_name": "CUSTOMERS"}).json()
    c104_a = next(r for r in s_a["records"] if str(r.get("customer_id")) == "104")
    assert c104_a["status"] == "SUSPENDED"

    # Verify team B state does NOT see team A's change
    s_b = client.get("/api/branches/team-b/workspace/state", params={"table_name": "CUSTOMERS"}).json()
    c104_b = next(r for r in s_b["records"] if str(r.get("customer_id")) == "104")
    assert c104_b["status"] == "ACTIVE"

    # Verify main state is still untouched
    main_c104 = client.get("/api/tables/CUSTOMERS/records/104").json()
    assert main_c104["status"] == "ACTIVE"

def test_15_conflict_resolution_and_referential_integrity():
    """15. Conflict resolution flow with constraint validation."""
    client.post("/api/branches", json={"branch_name": "feature/resolve-test"})

    # Branch modifies product 204 unit_price to 7000.0
    client.post("/api/branches/feature/resolve-test/commits", json={
        "commit_message": "Price increase",
        "changes": [{
            "table_name": "PRODUCTS",
            "record_id": "204",
            "operation_type": "UPDATE",
            "after_values": {"product_id": 204, "unit_price": 7000.0}
        }]
    })

    # Main modifies product 204 unit_price to 6500.0
    client.post("/api/branches/main/commits", json={
        "commit_message": "Promotional discount",
        "changes": [{
            "table_name": "PRODUCTS",
            "record_id": "204",
            "operation_type": "UPDATE",
            "after_values": {"product_id": 204, "unit_price": 6500.0}
        }]
    })

    # Initial merge triggers conflict
    m1 = client.post("/api/branches/merge", json={
        "source_branch": "feature/resolve-test",
        "target_branch": "main"
    }).json()
    assert m1["status"] == "CONFLICT"
    merge_id = m1["merge_id"]

    # User manually resolves conflict
    resolve_res = client.post(f"/api/branches/merge/{merge_id}/resolve", json={
        "resolutions": [{
            "table_name": "PRODUCTS",
            "record_id": "204",
            "operation_type": "UPDATE",
            "resolved_values": {"product_id": 204, "sku": "SKU-SEC-APP", "name": "Next-Gen Firewall Appliance", "unit_price": 6800.0}
        }]
    })
    assert resolve_res.status_code == 200
    res_data = resolve_res.json()
    assert res_data["status"] == "SUCCESS"
    assert res_data["merge_commit_id"] is not None

def test_16_revert_branch_to_earlier_commit():
    """16. Going back in a branch: non-destructive revert to an earlier commit."""
    b = client.post("/api/branches", json={"branch_name": "exp/revert-demo"}).json()
    init_commit_id = b["head_commit_id"]

    # Commit 1: update credit limit of customer 101 to 99000
    c1 = client.post("/api/branches/exp/revert-demo/commits", json={
        "commit_message": "Increase 101 credit to 99k",
        "changes": [{
            "table_name": "CUSTOMERS",
            "record_id": "101",
            "operation_type": "UPDATE",
            "after_values": {"credit_limit": 99000.0}
        }]
    }).json()
    assert c1["commit_id"]

    # Verify branch state is 99000
    s1 = client.get("/api/branches/exp/revert-demo/state", params={"table_name": "CUSTOMERS"}).json()
    c101_s1 = next(r for r in s1["records"] if str(r.get("customer_id")) == "101")
    assert c101_s1["credit_limit"] == 99000.0

    # Revert branch back to initial commit
    rev = client.post(f"/api/branches/exp/revert-demo/revert/{init_commit_id}")
    assert rev.status_code == 200
    rev_data = rev.json()
    assert rev_data["changeset_count"] == 1

    # Verify branch state is back to 75000.0
    s2 = client.get("/api/branches/exp/revert-demo/state", params={"table_name": "CUSTOMERS"}).json()
    c101_s2 = next(r for r in s2["records"] if str(r.get("customer_id")) == "101")
    assert c101_s2["credit_limit"] == 75000.0

