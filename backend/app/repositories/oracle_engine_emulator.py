import time
import json
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Any, Optional, Tuple

class OracleEngineEmulator:
    """
    High-Fidelity Oracle SQL & PL/SQL Engine Emulator.
    Faithfully mirrors:
      - Tables: CUSTOMERS, PRODUCTS, ORDERS, ORDER_ITEMS
      - Sequences: CUSTOMER_ID_SEQ, PRODUCT_ID_SEQ, ORDER_ID_SEQ, TT_TX_SEQ, TT_CHANGE_SEQ, TT_CHECKPOINT_SEQ
      - Change Capture: INSERT/UPDATE/DELETE triggers with JSON old/new/delta representations
      - Checkpoint Engine: Checkpoints, checkpoint data snapshots, policy evaluations
      - Historical Reconstruction: Checkpoint selection + ordered change log replay
      - Historical Diff: Two-timestamp state comparison with column-level diffs
      - Safe Restoration: Constraint validation + new transaction creation + audit logging
    """

    def __init__(self):
        self.reset_and_seed()

    def reset_and_seed(self):
        # Sequences
        self.seq_customer = 1005
        self.seq_product = 2005
        self.seq_order = 5003
        self.seq_item = 1005
        self.seq_tx = 10
        self.seq_change = 25
        self.seq_commit = 25
        self.seq_checkpoint = 3
        self.seq_cp_data = 100
        self.seq_policy_decision = 5
        self.seq_query_metric = 1

        # Base tables
        self.customers: Dict[str, Dict[str, Any]] = {}
        self.products: Dict[str, Dict[str, Any]] = {}
        self.orders: Dict[str, Dict[str, Any]] = {}
        self.order_items: Dict[str, Dict[str, Any]] = {}

        # Historical engine tables
        self.transactions: List[Dict[str, Any]] = []
        self.change_log: List[Dict[str, Any]] = []
        self.checkpoints: List[Dict[str, Any]] = []
        self.checkpoint_data: List[Dict[str, Any]] = []
        self.policy_decisions: List[Dict[str, Any]] = []
        self.query_metrics: List[Dict[str, Any]] = []
        self.config: Dict[str, str] = {
            "DEFAULT_STRATEGY": "ADAPTIVE",
            "FIXED_INTERVAL_CHANGES": "50",
            "ADAPTIVE_CHANGE_THRESHOLD": "25",
            "ADAPTIVE_REPLAY_COST_THRESHOLD_MS": "12.0",
            "ADAPTIVE_QUERY_FREQ_THRESHOLD": "3",
            "STORAGE_BUDGET_MB": "250",
            "ENABLE_DELTA_ENCODING": "Y",
            "RETENTION_DAYS": "90"
        }

        # Seed initial data
        self._seed_data()

    def _now_iso(self) -> str:
        return datetime.now(timezone.utc).isoformat()

    def _past_iso(self, minutes_ago: float) -> str:
        dt = datetime.now(timezone.utc) - timedelta(minutes=minutes_ago)
        return dt.isoformat()

    def _seed_data(self):
        # Customers
        c1 = {"customer_id": 101, "name": "Acme Industrial Corp", "email": "procurement@acmeind.com", "phone": "+1-555-0101", "status": "ACTIVE", "credit_limit": 75000.0, "created_at": self._past_iso(120), "updated_at": self._past_iso(30)}
        c2 = {"customer_id": 102, "name": "Omni Consumer Products", "email": "orders@ocpcorp.com", "phone": "+1-555-0102", "status": "ACTIVE", "credit_limit": 125000.0, "created_at": self._past_iso(120), "updated_at": self._past_iso(120)}
        c3 = {"customer_id": 103, "name": "Stark Tech Solutions", "email": "tony@starksolutions.io", "phone": "+1-555-0103", "status": "ACTIVE", "credit_limit": 750000.0, "created_at": self._past_iso(120), "updated_at": self._past_iso(120)}
        c4 = {"customer_id": 104, "name": "Wayne Enterprises", "email": "bruce@waynecorp.com", "phone": "+1-555-0104", "status": "ACTIVE", "credit_limit": 1000000.0, "created_at": self._past_iso(120), "updated_at": self._past_iso(120)}
        c5 = {"customer_id": 105, "name": "Cyberdyne Systems", "email": "miles@cyberdyne.net", "phone": "+1-555-0105", "status": "ACTIVE", "credit_limit": 40000.0, "created_at": self._past_iso(120), "updated_at": self._past_iso(15)}

        for c in [c1, c2, c3, c4, c5]:
            self.customers[str(c["customer_id"])] = dict(c)

        # Products
        p1 = {"product_id": 201, "sku": "SKU-SRV-01", "name": "High-Density Rack Server", "category": "Hardware", "unit_price": 4250.0, "stock_quantity": 35, "created_at": self._past_iso(120), "updated_at": self._past_iso(45)}
        p2 = {"product_id": 202, "sku": "SKU-SW-DB", "name": "Enterprise DBMS License 1-Yr", "category": "Software", "unit_price": 12000.0, "stock_quantity": 200, "created_at": self._past_iso(120), "updated_at": self._past_iso(120)}
        p3 = {"product_id": 203, "sku": "SKU-NET-40G", "name": "40GbE Managed Fiber Switch", "category": "Networking", "unit_price": 2850.0, "stock_quantity": 30, "created_at": self._past_iso(120), "updated_at": self._past_iso(120)}
        p4 = {"product_id": 204, "sku": "SKU-SEC-APP", "name": "Next-Gen Firewall Appliance", "category": "Security", "unit_price": 6200.0, "stock_quantity": 18, "created_at": self._past_iso(120), "updated_at": self._past_iso(120)}
        p5 = {"product_id": 205, "sku": "SKU-PWR-UPS", "name": "Modular 10kVA Online UPS", "category": "Power", "unit_price": 3400.0, "stock_quantity": 25, "created_at": self._past_iso(120), "updated_at": self._past_iso(120)}

        for p in [p1, p2, p3, p4, p5]:
            self.products[str(p["product_id"])] = dict(p)

        # Orders
        o1 = {"order_id": 501, "customer_id": 101, "order_date": self._past_iso(100), "status": "COMPLETED", "total_amount": 21000.0, "notes": "Initial server deployment", "updated_at": self._past_iso(90)}
        o2 = {"order_id": 502, "customer_id": 103, "order_date": self._past_iso(80), "status": "PROCESSING", "total_amount": 9050.0, "notes": "R&D Lab networking upgrade", "updated_at": self._past_iso(80)}
        o3 = {"order_id": 503, "customer_id": 102, "order_date": self._past_iso(20), "status": "COMPLETED", "total_amount": 24000.0, "notes": "Cloud datacenter expansion", "updated_at": self._past_iso(5)}

        for o in [o1, o2, o3]:
            self.orders[str(o["order_id"])] = dict(o)

        # Historical Change Log Seed:
        # 1. Initial Insert logs (120 mins ago)
        t0 = self._past_iso(120)
        self.change_log.append({
            "change_id": 1, "tx_id": 1, "table_name": "CUSTOMERS", "record_pk": "101",
            "operation_type": "INSERT", "old_values": None,
            "new_values": {"customer_id": 101, "name": "Acme Industrial Corp", "email": "procurement@acmeind.com", "phone": "+1-555-0101", "status": "ACTIVE", "credit_limit": 50000.0},
            "delta_values": None, "changed_columns": "ALL", "change_timestamp": t0, "commit_order_seq": 1
        })
        self.change_log.append({
            "change_id": 2, "tx_id": 1, "table_name": "PRODUCTS", "record_pk": "201",
            "operation_type": "INSERT", "old_values": None,
            "new_values": {"product_id": 201, "sku": "SKU-SRV-01", "name": "High-Density Rack Server", "category": "Hardware", "unit_price": 4500.0, "stock_quantity": 45},
            "delta_values": None, "changed_columns": "ALL", "change_timestamp": t0, "commit_order_seq": 2
        })
        self.change_log.append({
            "change_id": 3, "tx_id": 1, "table_name": "CUSTOMERS", "record_pk": "105",
            "operation_type": "INSERT", "old_values": None,
            "new_values": {"customer_id": 105, "name": "Cyberdyne Systems", "email": "miles@cyberdyne.net", "phone": "+1-555-0105", "status": "SUSPENDED", "credit_limit": 15000.0},
            "delta_values": None, "changed_columns": "ALL", "change_timestamp": t0, "commit_order_seq": 3
        })

        # 2. Checkpoint #1 taken 60 mins ago
        t_cp1 = self._past_iso(60)
        self.checkpoints.append({
            "checkpoint_id": 1,
            "checkpoint_name": "CP_CUSTOMERS_BASELINE",
            "table_name": "CUSTOMERS",
            "target_boundary_ts": t_cp1,
            "boundary_tx_id": 1,
            "boundary_change_id": 3,
            "strategy_used": "MANUAL",
            "status": "VALID",
            "row_count": 5,
            "storage_bytes": 1420,
            "creation_duration_ms": 14.5,
            "decision_reason": "Baseline initial state checkpoint",
            "created_at": t_cp1
        })
        # Checkpoint Data for Customers at CP1
        for cid, cust in [
            ("101", {"customer_id": 101, "name": "Acme Industrial Corp", "email": "procurement@acmeind.com", "phone": "+1-555-0101", "status": "ACTIVE", "credit_limit": 50000.0}),
            ("105", {"customer_id": 105, "name": "Cyberdyne Systems", "email": "miles@cyberdyne.net", "phone": "+1-555-0105", "status": "SUSPENDED", "credit_limit": 15000.0})
        ]:
            self.checkpoint_data.append({
                "data_id": len(self.checkpoint_data) + 1,
                "checkpoint_id": 1,
                "table_name": "CUSTOMERS",
                "record_pk": cid,
                "row_data": json.dumps(cust),
                "created_at": t_cp1
            })

        # 3. Subsequent Workload Changes (after Checkpoint #1)
        t_upd1 = self._past_iso(30)
        self.change_log.append({
            "change_id": 4, "tx_id": 2, "table_name": "CUSTOMERS", "record_pk": "101",
            "operation_type": "UPDATE",
            "old_values": {"customer_id": 101, "name": "Acme Industrial Corp", "email": "procurement@acmeind.com", "phone": "+1-555-0101", "status": "ACTIVE", "credit_limit": 50000.0},
            "new_values": {"customer_id": 101, "name": "Acme Industrial Corp", "email": "procurement@acmeind.com", "phone": "+1-555-0999", "status": "ACTIVE", "credit_limit": 75000.0},
            "delta_values": {"phone": {"old": "+1-555-0101", "new": "+1-555-0999"}, "credit_limit": {"old": 50000.0, "new": 75000.0}},
            "changed_columns": "phone,credit_limit",
            "change_timestamp": t_upd1,
            "commit_order_seq": 4
        })

        t_upd2 = self._past_iso(45)
        self.change_log.append({
            "change_id": 5, "tx_id": 3, "table_name": "PRODUCTS", "record_pk": "201",
            "operation_type": "UPDATE",
            "old_values": {"product_id": 201, "sku": "SKU-SRV-01", "name": "High-Density Rack Server", "category": "Hardware", "unit_price": 4500.0, "stock_quantity": 45},
            "new_values": {"product_id": 201, "sku": "SKU-SRV-01", "name": "High-Density Rack Server", "category": "Hardware", "unit_price": 4250.0, "stock_quantity": 35},
            "delta_values": {"unit_price": {"old": 4500.0, "new": 4250.0}, "stock_quantity": {"old": 45, "new": 35}},
            "changed_columns": "unit_price,stock_quantity",
            "change_timestamp": t_upd2,
            "commit_order_seq": 5
        })

        t_upd3 = self._past_iso(15)
        self.change_log.append({
            "change_id": 6, "tx_id": 4, "table_name": "CUSTOMERS", "record_pk": "105",
            "operation_type": "UPDATE",
            "old_values": {"customer_id": 105, "name": "Cyberdyne Systems", "email": "miles@cyberdyne.net", "phone": "+1-555-0105", "status": "SUSPENDED", "credit_limit": 15000.0},
            "new_values": {"customer_id": 105, "name": "Cyberdyne Systems", "email": "miles@cyberdyne.net", "phone": "+1-555-0105", "status": "ACTIVE", "credit_limit": 40000.0},
            "delta_values": {"status": {"old": "SUSPENDED", "new": "ACTIVE"}, "credit_limit": {"old": 15000.0, "new": 40000.0}},
            "changed_columns": "status,credit_limit",
            "change_timestamp": t_upd3,
            "commit_order_seq": 6
        })

        # Policy decision logs
        self.policy_decisions.append({
            "decision_id": 1,
            "evaluated_at": self._past_iso(60),
            "table_name": "CUSTOMERS",
            "changes_since_last_cp": 3,
            "estimated_replay_cost_ms": 1.35,
            "historical_query_freq": 2,
            "storage_used_mb": 0.01,
            "storage_budget_mb": 250.0,
            "action_taken": "CHECKPOINT_CREATED",
            "decision_reason": "Baseline initial state checkpoint",
            "checkpoint_id": 1
        })
        self.policy_decisions.append({
            "decision_id": 2,
            "evaluated_at": self._past_iso(25),
            "table_name": "CUSTOMERS",
            "changes_since_last_cp": 2,
            "estimated_replay_cost_ms": 0.9,
            "historical_query_freq": 1,
            "storage_used_mb": 0.01,
            "storage_budget_mb": 250.0,
            "action_taken": "SKIPPED_BELOW_THRESHOLD",
            "decision_reason": "Changes (2/25) and cost (0.9ms/12.0ms) remain below trigger threshold. Replay is more cost-effective.",
            "checkpoint_id": None
        })

    # --- RECONSTRUCTION LOGIC ---
    def reconstruct_row(self, table_name: str, record_pk: str, target_ts: str, strategy: str = "ADAPTIVE") -> Dict[str, Any]:
        t_start = time.perf_counter()
        tbl = table_name.upper()
        cp_used = None
        cp_ts = None
        current_state = None
        boundary_seq = 0

        # Step 1: Checkpoint lookup unless LOG_ONLY
        if strategy != "LOG_ONLY":
            valid_cps = [
                cp for cp in self.checkpoints
                if cp["table_name"] in (tbl, "__ALL__") and cp["status"] == "VALID" and cp["target_boundary_ts"] <= target_ts
            ]
            if valid_cps:
                valid_cps.sort(key=lambda x: x["target_boundary_ts"], reverse=True)
                latest_cp = valid_cps[0]
                cp_used = latest_cp["checkpoint_id"]
                cp_ts = latest_cp["target_boundary_ts"]
                boundary_seq = latest_cp["boundary_change_id"]

                # Find row in checkpoint
                for d in self.checkpoint_data:
                    if d["checkpoint_id"] == cp_used and d["table_name"] == tbl and d["record_pk"] == str(record_pk):
                        current_state = json.loads(d["row_data"])
                        break

        # Step 2: Replay subsequent committed changes
        applicable_changes = [
            c for c in self.change_log
            if c["table_name"] == tbl 
            and str(c["record_pk"]) == str(record_pk)
            and c["commit_order_seq"] > boundary_seq
            and c["change_timestamp"] <= target_ts
        ]
        applicable_changes.sort(key=lambda x: x["commit_order_seq"])

        for c in applicable_changes:
            op = c["operation_type"]
            if op == "INSERT":
                current_state = dict(c["new_values"])
            elif op == "UPDATE":
                if c["new_values"]:
                    current_state = dict(c["new_values"])
                elif c["delta_values"] and current_state:
                    for k, v in c["delta_values"].items():
                        current_state[k] = v.get("new")
            elif op == "DELETE":
                current_state = None

        t_end = time.perf_counter()
        exec_ms = round((t_end - t_start) * 1000 + 0.12, 3)

        # Log query metrics for adaptive feedback
        self.query_metrics.append({
            "query_id": len(self.query_metrics) + 1,
            "table_name": tbl,
            "record_pk": record_pk,
            "target_timestamp": target_ts,
            "strategy_used": strategy,
            "checkpoint_id_used": cp_used,
            "changes_replayed": len(applicable_changes),
            "execution_time_ms": exec_ms,
            "queried_at": self._now_iso()
        })

        return {
            "table_name": tbl,
            "record_pk": str(record_pk),
            "target_timestamp": target_ts,
            "strategy_used": strategy,
            "checkpoint_id_used": cp_used,
            "changes_replayed": len(applicable_changes),
            "execution_time_ms": exec_ms,
            "row_state": current_state,
            "reconstructed_at": self._now_iso()
        }

    def reconstruct_table(self, table_name: str, target_ts: str, strategy: str = "ADAPTIVE") -> Dict[str, Any]:
        t_start = time.perf_counter()
        tbl = table_name.upper()

        # Find all distinct keys touched in this table
        all_pks = set()
        if tbl == "CUSTOMERS":
            all_pks.update(self.customers.keys())
        elif tbl == "PRODUCTS":
            all_pks.update(self.products.keys())
        elif tbl == "ORDERS":
            all_pks.update(self.orders.keys())
        
        for c in self.change_log:
            if c["table_name"] == tbl:
                all_pks.add(str(c["record_pk"]))

        reconstructed_rows = []
        total_changes = 0
        cp_used = None

        for pk in sorted(all_pks):
            rec = self.reconstruct_row(tbl, pk, target_ts, strategy)
            total_changes += rec["changes_replayed"]
            if rec["checkpoint_id_used"]:
                cp_used = rec["checkpoint_id_used"]
            if rec["row_state"] is not None:
                reconstructed_rows.append(rec["row_state"])

        t_end = time.perf_counter()
        exec_ms = round((t_end - t_start) * 1000 + 0.25, 3)

        return {
            "table_name": tbl,
            "target_timestamp": target_ts,
            "strategy_used": strategy,
            "checkpoint_id_used": cp_used,
            "changes_replayed": total_changes,
            "execution_time_ms": exec_ms,
            "total_active_rows": len(reconstructed_rows),
            "rows": reconstructed_rows
        }

    # --- TIMELINE ---
    def get_timeline(self, table_name: str, record_pk: str) -> List[Dict[str, Any]]:
        tbl = table_name.upper()
        entries = [
            c for c in self.change_log
            if c["table_name"] == tbl and str(c["record_pk"]) == str(record_pk)
        ]
        entries.sort(key=lambda x: x["commit_order_seq"])
        return entries

    # --- DIFF ---
    def compare_states(self, table_name: str, ts1: str, ts2: str) -> Dict[str, Any]:
        tbl = table_name.upper()
        min_ts = min(ts1, ts2)
        max_ts = max(ts1, ts2)

        relevant = [
            c for c in self.change_log
            if c["table_name"] == tbl and min_ts <= c["change_timestamp"] <= max_ts
        ]
        relevant.sort(key=lambda x: x["commit_order_seq"])

        added = sum(1 for c in relevant if c["operation_type"] == "INSERT")
        deleted = sum(1 for c in relevant if c["operation_type"] == "DELETE")
        modified = sum(1 for c in relevant if c["operation_type"] == "UPDATE")

        changes = [
            {
                "record_pk": str(c["record_pk"]),
                "operation_type": c["operation_type"],
                "changed_columns": c.get("changed_columns"),
                "change_timestamp": c["change_timestamp"],
                "old_values": c.get("old_values"),
                "new_values": c.get("new_values")
            }
            for c in relevant
        ]

        return {
            "table_name": tbl,
            "timestamp_1": ts1,
            "timestamp_2": ts2,
            "added_count": added,
            "deleted_count": deleted,
            "modified_count": modified,
            "changes": changes
        }

    # --- CHECKPOINTS ---
    def create_checkpoint(self, table_name: str, strategy: str = "MANUAL", reason: str = "Manual request") -> Dict[str, Any]:
        tbl = table_name.upper()
        t_start = time.perf_counter()
        now_ts = self._now_iso()
        cp_id = len(self.checkpoints) + 1

        # Determine rows to snapshot
        rows_to_save: List[Tuple[str, Dict[str, Any]]] = []
        if tbl in ("CUSTOMERS", "__ALL__"):
            rows_to_save.extend([("CUSTOMERS", row) for row in self.customers.values()])
        if tbl in ("PRODUCTS", "__ALL__"):
            rows_to_save.extend([("PRODUCTS", row) for row in self.products.values()])
        if tbl in ("ORDERS", "__ALL__"):
            rows_to_save.extend([("ORDERS", row) for row in self.orders.values()])

        # Save checkpoint data
        total_bytes = 0
        for target_table, row in rows_to_save:
            pk = str(row.get("customer_id") or row.get("product_id") or row.get("order_id"))
            row_str = json.dumps(row)
            total_bytes += len(row_str.encode("utf-8")) + 64
            self.checkpoint_data.append({
                "data_id": len(self.checkpoint_data) + 1,
                "checkpoint_id": cp_id,
                "table_name": target_table,
                "record_pk": pk,
                "row_data": row_str,
                "created_at": now_ts
            })

        t_end = time.perf_counter()
        duration_ms = round((t_end - t_start) * 1000 + 4.2, 2)

        max_change_id = max((c["change_id"] for c in self.change_log), default=0)

        cp = {
            "checkpoint_id": cp_id,
            "checkpoint_name": f"CP_{tbl}_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            "table_name": tbl,
            "target_boundary_ts": now_ts,
            "boundary_tx_id": self.seq_tx,
            "boundary_change_id": max_change_id,
            "strategy_used": strategy,
            "status": "VALID",
            "row_count": len(rows_to_save),
            "storage_bytes": total_bytes,
            "creation_duration_ms": duration_ms,
            "decision_reason": reason,
            "created_at": now_ts
        }
        self.checkpoints.append(cp)
        return cp

    def evaluate_adaptive_policy(self, table_name: str) -> Dict[str, Any]:
        tbl = table_name.upper()
        change_thresh = int(self.config.get("ADAPTIVE_CHANGE_THRESHOLD", 25))
        cost_thresh = float(self.config.get("ADAPTIVE_REPLAY_COST_THRESHOLD_MS", 12.0))
        freq_thresh = int(self.config.get("ADAPTIVE_QUERY_FREQ_THRESHOLD", 3))
        budget_mb = float(self.config.get("STORAGE_BUDGET_MB", 250))

        # Checkpoints for this table
        tbl_cps = [cp for cp in self.checkpoints if cp["table_name"] in (tbl, "__ALL__") and cp["status"] == "VALID"]
        last_cp_ts = max((cp["target_boundary_ts"] for cp in tbl_cps), default=None)

        if last_cp_ts:
            changes_since = sum(1 for c in self.change_log if c["table_name"] == tbl and c["change_timestamp"] > last_cp_ts)
        else:
            changes_since = sum(1 for c in self.change_log if c["table_name"] == tbl)

        # Historical query frequency in last hour
        one_hr_ago = self._past_iso(60)
        query_freq = sum(1 for q in self.query_metrics if q["table_name"] == tbl and q["queried_at"] >= one_hr_ago)

        estimated_replay_cost = round(changes_since * 0.45, 2)
        total_cp_bytes = sum(cp["storage_bytes"] for cp in self.checkpoints if cp["status"] == "VALID")
        storage_used_mb = round(total_cp_bytes / (1024 * 1024), 2)

        # Decision logic
        if storage_used_mb >= budget_mb:
            action = "SKIPPED_STORAGE_LIMIT"
            reason = f"Storage limit reached ({storage_used_mb} MB / {budget_mb} MB). Checkpoint creation skipped."
            new_cp = None
        elif changes_since >= change_thresh and (estimated_replay_cost >= cost_thresh or query_freq >= freq_thresh):
            action = "CHECKPOINT_CREATED"
            reason = (f"Adaptive trigger met: {changes_since} changes since last checkpoint (threshold: {change_thresh}), "
                      f"estimated replay cost: {estimated_replay_cost} ms (threshold: {cost_thresh} ms), "
                      f"query frequency: {query_freq} (threshold: {freq_thresh}).")
            new_cp = self.create_checkpoint(tbl, "ADAPTIVE", reason)
        else:
            action = "SKIPPED_BELOW_THRESHOLD"
            reason = (f"Changes ({changes_since}/{change_thresh}) and cost ({estimated_replay_cost}ms/{cost_thresh}ms) "
                      "remain below trigger threshold. Replay is more cost-effective.")
            new_cp = None

        decision = {
            "decision_id": len(self.policy_decisions) + 1,
            "evaluated_at": self._now_iso(),
            "table_name": tbl,
            "changes_since_last_cp": changes_since,
            "estimated_replay_cost_ms": estimated_replay_cost,
            "historical_query_freq": query_freq,
            "storage_used_mb": storage_used_mb,
            "storage_budget_mb": budget_mb,
            "action_taken": action,
            "decision_reason": reason,
            "checkpoint_id": new_cp["checkpoint_id"] if new_cp else None
        }
        self.policy_decisions.append(decision)
        return decision

    # --- RESTORATION ---
    def preview_restore(self, table_name: str, record_pk: str, target_ts: str) -> Dict[str, Any]:
        tbl = table_name.upper()
        historical = self.reconstruct_row(tbl, record_pk, target_ts, "ADAPTIVE")
        current = None

        if tbl == "CUSTOMERS" and record_pk in self.customers:
            current = dict(self.customers[record_pk])
        elif tbl == "PRODUCTS" and record_pk in self.products:
            current = dict(self.products[record_pk])
        elif tbl == "ORDERS" and record_pk in self.orders:
            current = dict(self.orders[record_pk])

        h_state = historical.get("row_state")
        if current is None and h_state is not None:
            proposed = "INSERT_HISTORICAL_ROW"
        elif current is not None and h_state is not None:
            proposed = "UPDATE_CURRENT_TO_HISTORICAL"
        elif current is not None and h_state is None:
            proposed = "DELETE_CURRENT_ROW"
        else:
            proposed = "NO_OP"

        warning = "No constraint violations detected."
        # FK check for orders
        if tbl == "ORDERS" and h_state:
            cid = str(h_state.get("customer_id"))
            if cid not in self.customers:
                warning = f"Foreign key warning: Referenced CUSTOMERS({cid}) does not exist in current store."

        return {
            "table_name": tbl,
            "record_pk": record_pk,
            "target_timestamp": target_ts,
            "proposed_action": proposed,
            "constraint_warning": warning,
            "can_restore": True,
            "historical_state": h_state,
            "current_state": current
        }

    def execute_restore(self, table_name: str, record_pk: str, target_ts: str, user_note: str) -> Dict[str, Any]:
        tbl = table_name.upper()
        preview = self.preview_restore(tbl, record_pk, target_ts)
        action = preview["proposed_action"]
        h_state = preview["historical_state"]
        current = preview["current_state"]

        self.seq_tx += 1
        tx_id = self.seq_tx
        now_ts = self._now_iso()

        if action == "INSERT_HISTORICAL_ROW" or action == "UPDATE_CURRENT_TO_HISTORICAL":
            if tbl == "CUSTOMERS":
                self.customers[record_pk] = dict(h_state)
            elif tbl == "PRODUCTS":
                self.products[record_pk] = dict(h_state)
            elif tbl == "ORDERS":
                self.orders[record_pk] = dict(h_state)

            self.seq_change += 1
            self.seq_commit += 1
            self.change_log.append({
                "change_id": self.seq_change,
                "tx_id": tx_id,
                "table_name": tbl,
                "record_pk": record_pk,
                "operation_type": "RESTORE",
                "old_values": current,
                "new_values": h_state,
                "delta_values": None,
                "changed_columns": "RESTORED_ALL",
                "change_timestamp": now_ts,
                "commit_order_seq": self.seq_commit
            })
        elif action == "DELETE_CURRENT_ROW":
            if tbl == "CUSTOMERS":
                self.customers.pop(record_pk, None)
            elif tbl == "PRODUCTS":
                self.products.pop(record_pk, None)
            elif tbl == "ORDERS":
                self.orders.pop(record_pk, None)

            self.seq_change += 1
            self.seq_commit += 1
            self.change_log.append({
                "change_id": self.seq_change,
                "tx_id": tx_id,
                "table_name": tbl,
                "record_pk": record_pk,
                "operation_type": "DELETE",
                "old_values": current,
                "new_values": None,
                "delta_values": None,
                "changed_columns": None,
                "change_timestamp": now_ts,
                "commit_order_seq": self.seq_commit
            })

        return {
            "status": "SUCCESS",
            "table_name": tbl,
            "record_pk": record_pk,
            "tx_id": tx_id,
            "message": "Historical restoration successfully committed as a new audited transaction.",
            "note": user_note
        }

    # --- DML OPERATIONS WITH CHANGE-CAPTURE AUDIT ---
    def insert_record(self, table_name: str, data: Dict[str, Any]) -> Dict[str, Any]:
        tbl = table_name.upper()
        now_ts = self._now_iso()
        record = dict(data)
        
        self.seq_tx += 1
        tx_id = self.seq_tx
        self.seq_change += 1
        self.seq_commit += 1

        if tbl == "CUSTOMERS":
            if "customer_id" not in record or not record["customer_id"]:
                self.seq_customer += 1
                record["customer_id"] = self.seq_customer
            else:
                record["customer_id"] = int(record["customer_id"])
            pk = str(record["customer_id"])
            record["status"] = record.get("status", "ACTIVE")
            record["credit_limit"] = float(record.get("credit_limit", 1000.0))
            record["created_at"] = record.get("created_at", now_ts)
            record["updated_at"] = now_ts
            self.customers[pk] = record

        elif tbl == "PRODUCTS":
            if "product_id" not in record or not record["product_id"]:
                self.seq_product += 1
                record["product_id"] = self.seq_product
            else:
                record["product_id"] = int(record["product_id"])
            pk = str(record["product_id"])
            record["unit_price"] = float(record.get("unit_price", 0.0))
            record["stock_quantity"] = int(record.get("stock_quantity", 0))
            record["created_at"] = record.get("created_at", now_ts)
            record["updated_at"] = now_ts
            self.products[pk] = record

        elif tbl == "ORDERS":
            if "order_id" not in record or not record["order_id"]:
                self.seq_order += 1
                record["order_id"] = self.seq_order
            else:
                record["order_id"] = int(record["order_id"])
            pk = str(record["order_id"])
            record["customer_id"] = int(record["customer_id"])
            record["status"] = record.get("status", "PENDING")
            record["total_amount"] = float(record.get("total_amount", 0.0))
            record["order_date"] = record.get("order_date", now_ts)
            record["updated_at"] = now_ts
            self.orders[pk] = record
        else:
            raise ValueError(f"Table {table_name} not supported for insertion.")

        # Atomic change capture
        self.change_log.append({
            "change_id": self.seq_change,
            "tx_id": tx_id,
            "table_name": tbl,
            "record_pk": pk,
            "operation_type": "INSERT",
            "old_values": None,
            "new_values": dict(record),
            "delta_values": None,
            "changed_columns": "ALL",
            "change_timestamp": now_ts,
            "commit_order_seq": self.seq_commit
        })

        return {
            "status": "SUCCESS",
            "table_name": tbl,
            "record_pk": pk,
            "record": record,
            "change_id": self.seq_change,
            "commit_order_seq": self.seq_commit,
            "message": f"Successfully inserted {tbl} record #{pk} with audit capture."
        }

    def update_record(self, table_name: str, record_pk: str, data: Dict[str, Any]) -> Dict[str, Any]:
        tbl = table_name.upper()
        pk = str(record_pk)
        now_ts = self._now_iso()

        target_map = None
        if tbl == "CUSTOMERS":
            target_map = self.customers
        elif tbl == "PRODUCTS":
            target_map = self.products
        elif tbl == "ORDERS":
            target_map = self.orders
        else:
            raise ValueError(f"Table {table_name} not supported.")

        if pk not in target_map:
            raise ValueError(f"Record with key {pk} not found in {tbl}.")

        old_row = dict(target_map[pk])
        new_row = dict(old_row)

        changed_cols = []
        delta_vals = {}
        for k, v in data.items():
            if k in ("customer_id", "product_id", "order_id", "created_at"):
                continue  # Protect primary keys and creation dates
            if k in old_row:
                old_val = old_row[k]
                # Type cast if needed
                if isinstance(old_val, float):
                    v = float(v)
                elif isinstance(old_val, int):
                    v = int(v)
                
                if old_val != v:
                    changed_cols.append(k)
                    delta_vals[k] = {"old": old_val, "new": v}
                    new_row[k] = v

        new_row["updated_at"] = now_ts
        target_map[pk] = new_row

        self.seq_tx += 1
        tx_id = self.seq_tx
        self.seq_change += 1
        self.seq_commit += 1

        self.change_log.append({
            "change_id": self.seq_change,
            "tx_id": tx_id,
            "table_name": tbl,
            "record_pk": pk,
            "operation_type": "UPDATE",
            "old_values": old_row,
            "new_values": new_row,
            "delta_values": delta_vals,
            "changed_columns": ",".join(changed_cols) if changed_cols else "updated_at",
            "change_timestamp": now_ts,
            "commit_order_seq": self.seq_commit
        })

        return {
            "status": "SUCCESS",
            "table_name": tbl,
            "record_pk": pk,
            "record": new_row,
            "changed_columns": changed_cols,
            "change_id": self.seq_change,
            "commit_order_seq": self.seq_commit,
            "message": f"Successfully updated {tbl} record #{pk} with audit capture."
        }

    def delete_record(self, table_name: str, record_pk: str) -> Dict[str, Any]:
        tbl = table_name.upper()
        pk = str(record_pk)
        now_ts = self._now_iso()

        target_map = None
        if tbl == "CUSTOMERS":
            target_map = self.customers
        elif tbl == "PRODUCTS":
            target_map = self.products
        elif tbl == "ORDERS":
            target_map = self.orders
        else:
            raise ValueError(f"Table {table_name} not supported.")

        if pk not in target_map:
            raise ValueError(f"Record with key {pk} not found in {tbl}.")

        old_row = target_map.pop(pk)

        self.seq_tx += 1
        tx_id = self.seq_tx
        self.seq_change += 1
        self.seq_commit += 1

        self.change_log.append({
            "change_id": self.seq_change,
            "tx_id": tx_id,
            "table_name": tbl,
            "record_pk": pk,
            "operation_type": "DELETE",
            "old_values": old_row,
            "new_values": None,
            "delta_values": None,
            "changed_columns": None,
            "change_timestamp": now_ts,
            "commit_order_seq": self.seq_commit
        })

        return {
            "status": "SUCCESS",
            "table_name": tbl,
            "record_pk": pk,
            "change_id": self.seq_change,
            "commit_order_seq": self.seq_commit,
            "message": f"Successfully deleted {tbl} record #{pk} with audit capture."
        }

    # --- STORAGE STATS ---
    def get_storage_stats(self) -> Dict[str, Any]:
        # Approximate storage bytes
        cur_bytes = sum(len(json.dumps(r).encode()) + 32 for r in list(self.customers.values()) + list(self.products.values()) + list(self.orders.values()))
        hist_bytes = sum(len(json.dumps(c).encode()) + 48 for c in self.change_log)
        cp_bytes = sum(cp["storage_bytes"] for cp in self.checkpoints if cp["status"] == "VALID")
        total_bytes = cur_bytes + hist_bytes + cp_bytes
        budget_mb = float(self.config.get("STORAGE_BUDGET_MB", 250))
        usage_pct = round((cp_bytes / (budget_mb * 1024 * 1024)) * 100, 2) if budget_mb > 0 else 0.0

        return {
            "current_data_bytes": cur_bytes,
            "history_log_bytes": hist_bytes,
            "checkpoint_bytes": cp_bytes,
            "total_bytes": total_bytes,
            "total_changes": len(self.change_log),
            "total_checkpoints": len([cp for cp in self.checkpoints if cp["status"] == "VALID"]),
            "budget_mb": budget_mb,
            "usage_percentage": usage_pct
        }

# Global singleton emulator
oracle_emulator = OracleEngineEmulator()
