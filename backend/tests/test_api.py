import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health_endpoint():
    resp = client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "healthy"
    assert "database_type" in data

def test_tables_endpoint():
    resp = client.get("/api/tables")
    assert resp.status_code == 200
    tables = resp.json()
    table_names = [t["name"] for t in tables]
    assert "CUSTOMERS" in table_names
    assert "PRODUCTS" in table_names
    assert "ORDERS" in table_names

def test_time_travel_row_endpoint():
    resp = client.post("/api/time-travel/row", json={
        "table_name": "CUSTOMERS",
        "record_pk": "101",
        "target_timestamp": "2026-10-18T10:00:00Z",
        "strategy": "ADAPTIVE"
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["table_name"] == "CUSTOMERS"
    assert data["record_pk"] == "101"
    assert "execution_time_ms" in data

def test_checkpoints_list_and_create():
    resp = client.get("/api/checkpoints")
    assert resp.status_code == 200

    create_resp = client.post("/api/checkpoints", json={
        "table_name": "PRODUCTS",
        "strategy": "MANUAL",
        "reason": "API test checkpoint"
    })
    assert create_resp.status_code == 200
    assert create_resp.json()["table_name"] == "PRODUCTS"

def test_restore_preview():
    resp = client.post("/api/restore/preview", json={
        "table_name": "CUSTOMERS",
        "record_pk": "101",
        "target_timestamp": "2026-10-18T10:00:00Z"
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "proposed_action" in data
    assert "can_restore" in data

def test_crud_insert_update_delete_and_timeline():
    # 1. Insert new customer
    insert_resp = client.post("/api/tables/CUSTOMERS/records", json={
        "name": "Quantum Leap AI",
        "email": "sam@quantumleap.io",
        "phone": "+1-555-8822",
        "status": "ACTIVE",
        "credit_limit": 80000.0
    })
    assert insert_resp.status_code == 200
    data = insert_resp.json()
    assert data["status"] == "SUCCESS"
    new_pk = data["record_pk"]

    # Verify record exists in table
    rec_resp = client.get(f"/api/tables/CUSTOMERS/records/{new_pk}")
    assert rec_resp.status_code == 200
    assert rec_resp.json()["name"] == "Quantum Leap AI"

    # 2. Update customer credit limit
    update_resp = client.put(f"/api/tables/CUSTOMERS/records/{new_pk}", json={
        "credit_limit": 120000.0,
        "phone": "+1-555-9999"
    })
    assert update_resp.status_code == 200
    assert update_resp.json()["status"] == "SUCCESS"

    # Verify updated
    rec_after = client.get(f"/api/tables/CUSTOMERS/records/{new_pk}")
    assert rec_after.json()["credit_limit"] == 120000.0

    # 3. Verify Version Timeline captured both events
    tl_resp = client.get(f"/api/timeline/CUSTOMERS/{new_pk}")
    assert tl_resp.status_code == 200
    timeline = tl_resp.json()["timeline"]
    assert len(timeline) == 2
    assert timeline[0]["operation_type"] == "INSERT"
    assert timeline[1]["operation_type"] == "UPDATE"

    # 4. Delete customer
    del_resp = client.delete(f"/api/tables/CUSTOMERS/records/{new_pk}")
    assert del_resp.status_code == 200
    assert del_resp.json()["status"] == "SUCCESS"

    # Verify deleted from current table
    get_del = client.get(f"/api/tables/CUSTOMERS/records/{new_pk}")
    assert get_del.status_code == 404

    # Verify timeline now includes DELETE
    tl_final = client.get(f"/api/timeline/CUSTOMERS/{new_pk}").json()["timeline"]
    assert len(tl_final) == 3
    assert tl_final[2]["operation_type"] == "DELETE"
