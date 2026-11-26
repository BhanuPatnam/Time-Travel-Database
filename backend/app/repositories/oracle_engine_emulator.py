import time
import json
import copy
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Any, Optional, Tuple, Union

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
        self.seq_item = 2000
        self.seq_tx = 10
        self.seq_change = 200
        self.seq_commit = 200
        self.seq_checkpoint = 3
        self.seq_cp_data = 100
        self.seq_policy_decision = 5
        self.seq_query_metric = 1
        self.seq_branch = 1
        self.seq_branch_commit = 101
        self.seq_changeset = 1
        self.seq_merge = 1

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
        self.branches: List[Dict[str, Any]] = []
        self.branch_commits: List[Dict[str, Any]] = []
        self.branch_changesets: List[Dict[str, Any]] = []
        self.branch_merges: List[Dict[str, Any]] = []
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

    @staticmethod
    def _normalize_iso(timestamp: str) -> str:
        """Normalize browser ``Z`` timestamps before chronological comparison."""
        try:
            parsed = datetime.fromisoformat(str(timestamp).replace("Z", "+00:00"))
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            return parsed.astimezone(timezone.utc).isoformat()
        except (TypeError, ValueError):
            raise ValueError(f"Invalid ISO-8601 timestamp: {timestamp}")

    def _seed_data(self):
        # Customers
        c1 = {"customer_id": 101, "name": "Acme Industrial Corp", "email": "procurement@acmeind.com", "phone": "+1-555-0101", "status": "ACTIVE", "credit_limit": 75000.0, "created_at": self._past_iso(120), "updated_at": self._past_iso(30)}
        c2 = {"customer_id": 102, "name": "Omni Consumer Products", "email": "orders@ocpcorp.com", "phone": "+1-555-0102", "status": "ACTIVE", "credit_limit": 125000.0, "created_at": self._past_iso(120), "updated_at": self._past_iso(120)}
        c3 = {"customer_id": 103, "name": "Stark Tech Solutions", "email": "tony@starksolutions.io", "phone": "+1-555-0103", "status": "ACTIVE", "credit_limit": 750000.0, "created_at": self._past_iso(120), "updated_at": self._past_iso(120)}
        c4 = {"customer_id": 104, "name": "Wayne Enterprises", "email": "bruce@waynecorp.com", "phone": "+1-555-0104", "status": "ACTIVE", "credit_limit": 1000000.0, "created_at": self._past_iso(120), "updated_at": self._past_iso(120)}
        c5 = {"customer_id": 105, "name": "Cyberdyne Systems", "email": "miles@cyberdyne.net", "phone": "+1-555-0105", "status": "ACTIVE", "credit_limit": 40000.0, "created_at": self._past_iso(120), "updated_at": self._past_iso(15)}

        for c in [c1, c2, c3, c4, c5]:
            self.customers[str(c["customer_id"])] = dict(c)

        # Additional realistic enterprise customers (106..150 -> total 50)
        extra_companies = [
            "Apex Logistics", "BlueSky Robotics", "Cascade Energy", "Delta BioLabs", "Evergreen Retail",
            "Falcon Aerospace", "Granite Construction", "Horizon Telecom", "Ironclad Security", "Jade Financial",
            "Keystone Health", "Lumina Photonics", "Meridian Shipping", "Northstar Cloud", "Obsidian Mining",
            "Pacific Semiconductor", "Quantum Networks", "Redwood Analytics", "Silverline Transit", "Titan Manufacturing",
            "Unity Software", "Vanguard Defense", "Westcoast Media", "Xenon Pharma", "Yellowstone Agri",
            "Zenith Electronics", "Atlas Freight", "Beacon Software", "Cobalt Materials", "Dynamic Motors",
            "Eclipse Systems", "Frontier Energy", "Global Foods", "Harbor Marine", "Infinity AI",
            "Jupiter Space", "Kinetix Robotics", "Liberty Insurance", "Matrix Solutions", "Nexus Biotech",
            "Orion Optics", "Pinnacle Capital", "Quest Diagnostics", "Summit Outdoors", "Vertex Engineering"
        ]
        statuses = ["ACTIVE", "ACTIVE", "ACTIVE", "ACTIVE", "SUSPENDED"]
        extra_customers = []
        for idx, comp_name in enumerate(extra_companies, start=106):
            slug = comp_name.lower().replace(" ", "")
            cust_obj = {
                "customer_id": idx,
                "name": comp_name,
                "email": f"ops@{slug}.com",
                "phone": f"+1-555-{idx:04d}",
                "status": statuses[idx % len(statuses)],
                "credit_limit": float(((idx % 10) + 1) * 25000),
                "created_at": self._past_iso(120),
                "updated_at": self._past_iso(120)
            }
            self.customers[str(idx)] = dict(cust_obj)
            extra_customers.append(cust_obj)

        # Products
        p1 = {"product_id": 201, "sku": "SKU-SRV-01", "name": "High-Density Rack Server", "category": "Hardware", "unit_price": 4250.0, "stock_quantity": 35, "created_at": self._past_iso(120), "updated_at": self._past_iso(45)}
        p2 = {"product_id": 202, "sku": "SKU-SW-DB", "name": "Enterprise DBMS License 1-Yr", "category": "Software", "unit_price": 12000.0, "stock_quantity": 200, "created_at": self._past_iso(120), "updated_at": self._past_iso(120)}
        p3 = {"product_id": 203, "sku": "SKU-NET-40G", "name": "40GbE Managed Fiber Switch", "category": "Networking", "unit_price": 2850.0, "stock_quantity": 30, "created_at": self._past_iso(120), "updated_at": self._past_iso(120)}
        p4 = {"product_id": 204, "sku": "SKU-SEC-APP", "name": "Next-Gen Firewall Appliance", "category": "Security", "unit_price": 6200.0, "stock_quantity": 18, "created_at": self._past_iso(120), "updated_at": self._past_iso(120)}
        p5 = {"product_id": 205, "sku": "SKU-PWR-UPS", "name": "Modular 10kVA Online UPS", "category": "Power", "unit_price": 3400.0, "stock_quantity": 25, "created_at": self._past_iso(120), "updated_at": self._past_iso(120)}

        for p in [p1, p2, p3, p4, p5]:
            self.products[str(p["product_id"])] = dict(p)

        # Additional realistic enterprise products (206..250 -> total 50)
        categories = ["Hardware", "Software", "Networking", "Security", "Power", "Storage"]
        extra_products = []
        for idx in range(206, 251):
            cat = categories[idx % len(categories)]
            prod_obj = {
                "product_id": idx,
                "sku": f"SKU-{cat[:3].upper()}-{idx}",
                "name": f"Enterprise {cat} Unit Model {idx - 200}",
                "category": cat,
                "unit_price": float(500 + (idx - 200) * 150),
                "stock_quantity": 10 + (idx % 40) * 5,
                "created_at": self._past_iso(120),
                "updated_at": self._past_iso(120)
            }
            self.products[str(idx)] = dict(prod_obj)
            extra_products.append(prod_obj)

        # Orders
        o1 = {"order_id": 501, "customer_id": 101, "order_date": self._past_iso(100), "status": "COMPLETED", "total_amount": 21000.0, "notes": "Initial server deployment", "updated_at": self._past_iso(90)}
        o2 = {"order_id": 502, "customer_id": 103, "order_date": self._past_iso(80), "status": "PROCESSING", "total_amount": 9050.0, "notes": "R&D Lab networking upgrade", "updated_at": self._past_iso(80)}
        o3 = {"order_id": 503, "customer_id": 102, "order_date": self._past_iso(20), "status": "COMPLETED", "total_amount": 24000.0, "notes": "Cloud datacenter expansion", "updated_at": self._past_iso(5)}

        for o in [o1, o2, o3]:
            self.orders[str(o["order_id"])] = dict(o)

        # Additional realistic orders (504..550 -> total 50)
        order_statuses = ["COMPLETED", "PROCESSING", "PENDING", "DELIVERED", "COMPLETED"]
        extra_orders = []
        for idx in range(504, 551):
            cust_id = 101 + ((idx - 504) % 50)
            ord_obj = {
                "order_id": idx,
                "customer_id": cust_id,
                "order_date": self._past_iso(110),
                "status": order_statuses[idx % len(order_statuses)],
                "total_amount": float(1500 + (idx - 500) * 350),
                "notes": f"Enterprise procurement batch #{idx}",
                "updated_at": self._past_iso(100)
            }
            self.orders[str(idx)] = dict(ord_obj)
            extra_orders.append(ord_obj)

        # Order Items (Referencing ORDERS.order_id and PRODUCTS.product_id)
        # Multiple products per order!
        base_items = [
            {"item_id": 1001, "order_id": 501, "product_id": 201, "quantity": 2, "unit_price": 4500.0, "subtotal": 9000.0},
            {"item_id": 1002, "order_id": 501, "product_id": 202, "quantity": 1, "unit_price": 12000.0, "subtotal": 12000.0},
            {"item_id": 1003, "order_id": 502, "product_id": 203, "quantity": 1, "unit_price": 2850.0, "subtotal": 2850.0},
            {"item_id": 1004, "order_id": 502, "product_id": 204, "quantity": 1, "unit_price": 6200.0, "subtotal": 6200.0},
            {"item_id": 1005, "order_id": 503, "product_id": 202, "quantity": 2, "unit_price": 12000.0, "subtotal": 24000.0},
        ]
        for it in base_items:
            self.order_items[str(it["item_id"])] = dict(it)

        extra_items = []
        next_item_id = 1006
        for idx in range(504, 551):
            p_id_1 = 201 + ((idx - 504) % 50)
            qty_1 = 1 + (idx % 3)
            up_1 = float(self.products[str(p_id_1)]["unit_price"])
            it1 = {
                "item_id": next_item_id, "order_id": idx, "product_id": p_id_1,
                "quantity": qty_1, "unit_price": up_1, "subtotal": round(qty_1 * up_1, 2)
            }
            self.order_items[str(next_item_id)] = dict(it1)
            extra_items.append(it1)
            next_item_id += 1

            # Give every 2nd order a second product so orders showcase multi-product line items
            if idx % 2 == 0:
                p_id_2 = 201 + ((idx - 504 + 7) % 50)
                qty_2 = 1 + ((idx + 1) % 2)
                up_2 = float(self.products[str(p_id_2)]["unit_price"])
                it2 = {
                    "item_id": next_item_id, "order_id": idx, "product_id": p_id_2,
                    "quantity": qty_2, "unit_price": up_2, "subtotal": round(qty_2 * up_2, 2)
                }
                self.order_items[str(next_item_id)] = dict(it2)
                extra_items.append(it2)
                next_item_id += 1

            # Keep order total_amount consistent with its line items
            order_total = sum(
                it["subtotal"] for it in self.order_items.values() if it["order_id"] == idx
            )
            self.orders[str(idx)]["total_amount"] = round(order_total, 2)

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

        # Every seeded live row needs an originating change event.  Without
        # these entries, table-level reconstruction silently discarded rows
        # that had never been updated after startup.
        initial_rows = [
            ("CUSTOMERS", "102", c2), ("CUSTOMERS", "103", c3), ("CUSTOMERS", "104", c4),
            ("PRODUCTS", "202", p2), ("PRODUCTS", "203", p3), ("PRODUCTS", "204", p4), ("PRODUCTS", "205", p5),
            ("ORDERS", "501", o1), ("ORDERS", "502", o2), ("ORDERS", "503", o3),
        ]
        for c_obj in extra_customers:
            initial_rows.append(("CUSTOMERS", str(c_obj["customer_id"]), c_obj))
        for p_obj in extra_products:
            initial_rows.append(("PRODUCTS", str(p_obj["product_id"]), p_obj))
        for o_obj in extra_orders:
            initial_rows.append(("ORDERS", str(o_obj["order_id"]), o_obj))
        for it_obj in base_items + extra_items:
            initial_rows.append(("ORDER_ITEMS", str(it_obj["item_id"]), it_obj))

        last_init_change_id = 3
        for change_id, (table_name, record_pk, row) in enumerate(initial_rows, start=4):
            last_init_change_id = change_id
            self.change_log.append({
                "change_id": change_id, "tx_id": 1, "table_name": table_name, "record_pk": record_pk,
                "operation_type": "INSERT", "old_values": None,
                "new_values": {key: value for key, value in row.items() if key not in {"created_at", "updated_at"}},
                "delta_values": None, "changed_columns": "ALL", "change_timestamp": t0,
                "commit_order_seq": change_id,
            })

        # 2. Checkpoint #1 taken 60 mins ago
        t_cp1 = self._past_iso(60)
        self.checkpoints.append({
            "checkpoint_id": 1,
            "checkpoint_name": "CP_CUSTOMERS_BASELINE",
            "table_name": "CUSTOMERS",
            "target_boundary_ts": t_cp1,
            "boundary_tx_id": 1,
            "boundary_change_id": last_init_change_id,
            "strategy_used": "MANUAL",
            "status": "VALID",
            "row_count": 50,
            "storage_bytes": 14200,
            "creation_duration_ms": 14.5,
            "decision_reason": "Baseline initial state checkpoint",
            "created_at": t_cp1
        })
        # Checkpoint Data for Customers at CP1
        cp_customers = [
            ("101", {"customer_id": 101, "name": "Acme Industrial Corp", "email": "procurement@acmeind.com", "phone": "+1-555-0101", "status": "ACTIVE", "credit_limit": 50000.0}),
            ("102", {key: value for key, value in c2.items() if key not in {"created_at", "updated_at"}}),
            ("103", {key: value for key, value in c3.items() if key not in {"created_at", "updated_at"}}),
            ("104", {key: value for key, value in c4.items() if key not in {"created_at", "updated_at"}}),
            ("105", {"customer_id": 105, "name": "Cyberdyne Systems", "email": "miles@cyberdyne.net", "phone": "+1-555-0105", "status": "SUSPENDED", "credit_limit": 15000.0})
        ]
        for c_obj in extra_customers:
            cp_customers.append((str(c_obj["customer_id"]), {key: value for key, value in c_obj.items() if key not in {"created_at", "updated_at"}}))

        for cid, cust in cp_customers:
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
            "change_id": last_init_change_id + 1, "tx_id": 2, "table_name": "CUSTOMERS", "record_pk": "101",
            "operation_type": "UPDATE",
            "old_values": {"customer_id": 101, "name": "Acme Industrial Corp", "email": "procurement@acmeind.com", "phone": "+1-555-0101", "status": "ACTIVE", "credit_limit": 50000.0},
            "new_values": {"customer_id": 101, "name": "Acme Industrial Corp", "email": "procurement@acmeind.com", "phone": "+1-555-0999", "status": "ACTIVE", "credit_limit": 75000.0},
            "delta_values": {"phone": {"old": "+1-555-0101", "new": "+1-555-0999"}, "credit_limit": {"old": 50000.0, "new": 75000.0}},
            "changed_columns": "phone,credit_limit",
            "change_timestamp": t_upd1,
            "commit_order_seq": last_init_change_id + 1
        })

        t_upd2 = self._past_iso(45)
        self.change_log.append({
            "change_id": last_init_change_id + 2, "tx_id": 3, "table_name": "PRODUCTS", "record_pk": "201",
            "operation_type": "UPDATE",
            "old_values": {"product_id": 201, "sku": "SKU-SRV-01", "name": "High-Density Rack Server", "category": "Hardware", "unit_price": 4500.0, "stock_quantity": 45},
            "new_values": {"product_id": 201, "sku": "SKU-SRV-01", "name": "High-Density Rack Server", "category": "Hardware", "unit_price": 4250.0, "stock_quantity": 35},
            "delta_values": {"unit_price": {"old": 4500.0, "new": 4250.0}, "stock_quantity": {"old": 45, "new": 35}},
            "changed_columns": "unit_price,stock_quantity",
            "change_timestamp": t_upd2,
            "commit_order_seq": last_init_change_id + 2
        })

        t_upd3 = self._past_iso(15)
        self.change_log.append({
            "change_id": last_init_change_id + 3, "tx_id": 4, "table_name": "CUSTOMERS", "record_pk": "105",
            "operation_type": "UPDATE",
            "old_values": {"customer_id": 105, "name": "Cyberdyne Systems", "email": "miles@cyberdyne.net", "phone": "+1-555-0105", "status": "SUSPENDED", "credit_limit": 15000.0},
            "new_values": {"customer_id": 105, "name": "Cyberdyne Systems", "email": "miles@cyberdyne.net", "phone": "+1-555-0105", "status": "ACTIVE", "credit_limit": 40000.0},
            "delta_values": {"status": {"old": "SUSPENDED", "new": "ACTIVE"}, "credit_limit": {"old": 15000.0, "new": 40000.0}},
            "changed_columns": "status,credit_limit",
            "change_timestamp": t_upd3,
            "commit_order_seq": last_init_change_id + 3
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

        # 3. Seed default 'main' branch and initial commit
        main_now = self._now_iso()
        self.branches.append({
            "branch_id": 1,
            "branch_name": "main",
            "parent_branch_id": None,
            "parent_name": None,
            "base_commit_id": "c-main-init",
            "base_timestamp": main_now,
            "created_at": main_now,
            "created_by": "SYSTEM",
            "branch_status": "ACTIVE",
            "is_default": "Y",
            "description": "Production default database branch"
        })
        self.branch_commits.append({
            "commit_id": "c-main-init",
            "branch_id": 1,
            "parent_commit_id": None,
            "commit_message": "Initial baseline from production database",
            "commit_timestamp": main_now,
            "commit_order_seq": 1,
            "author": "SYSTEM",
            "commit_type": "INITIAL",
            "merge_parent_commit_id": None
        })

    # --- RECONSTRUCTION LOGIC ---
    def reconstruct_row(self, table_name: str, record_pk: str, target_ts: str, strategy: str = "ADAPTIVE") -> Dict[str, Any]:
        target_ts = self._normalize_iso(target_ts)
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
        target_ts = self._normalize_iso(target_ts)

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
        change_markers = {}

        for pk in sorted(all_pks):
            rec = self.reconstruct_row(tbl, pk, target_ts, strategy)
            total_changes += rec["changes_replayed"]
            if rec["checkpoint_id_used"]:
                cp_used = rec["checkpoint_id_used"]
            if rec["row_state"] is not None:
                reconstructed_rows.append(rec["row_state"])

            changes_after_target = [
                change for change in self.change_log
                if change["table_name"] == tbl
                and str(change["record_pk"]) == str(pk)
                and change["change_timestamp"] > target_ts
            ]
            if changes_after_target:
                latest_change = max(changes_after_target, key=lambda change: change["commit_order_seq"])
                change_markers[str(pk)] = {
                    "operation_type": latest_change["operation_type"],
                    "changed_columns": latest_change.get("changed_columns") or "ALL",
                    "change_timestamp": latest_change["change_timestamp"],
                }

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
            "rows": reconstructed_rows,
            "change_markers": change_markers,
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
            cust_id = int(record.get("customer_id", 0))
            if str(cust_id) not in self.customers:
                raise ValueError(f"ORA-02291: integrity constraint violated - parent key CUSTOMERS#{cust_id} not found")
            if "order_id" not in record or not record["order_id"]:
                self.seq_order += 1
                record["order_id"] = self.seq_order
            else:
                record["order_id"] = int(record["order_id"])
            pk = str(record["order_id"])
            record["customer_id"] = cust_id
            record["status"] = record.get("status", "PENDING")

            # Support creating an order with multiple products ("items": [{product_id, quantity}, ...])
            items_input = record.pop("items", None)
            created_items = []
            if isinstance(items_input, list) and len(items_input) > 0:
                computed_total = 0.0
                for item in items_input:
                    pid = int(item.get("product_id", 0))
                    qty = int(item.get("quantity", 1))
                    if str(pid) not in self.products:
                        raise ValueError(f"ORA-02291: integrity constraint violated - parent key PRODUCTS#{pid} not found")
                    if qty <= 0:
                        raise ValueError("CHECK constraint violated: ORDER_ITEMS.quantity must be > 0")
                    unit_price = float(item.get("unit_price") if item.get("unit_price") is not None else self.products[str(pid)]["unit_price"])
                    subtotal = round(qty * unit_price, 2)
                    computed_total += subtotal
                    self.seq_item += 1
                    item_rec = {
                        "item_id": self.seq_item,
                        "order_id": record["order_id"],
                        "product_id": pid,
                        "quantity": qty,
                        "unit_price": unit_price,
                        "subtotal": subtotal
                    }
                    created_items.append(item_rec)
                record["total_amount"] = round(computed_total, 2)
            else:
                record["total_amount"] = float(record.get("total_amount", 0.0))

            record["order_date"] = record.get("order_date", now_ts)
            record["updated_at"] = now_ts
            self.orders[pk] = record

            for item_rec in created_items:
                ipk = str(item_rec["item_id"])
                self.order_items[ipk] = item_rec
                self.seq_change += 1
                self.seq_commit += 1
                self.change_log.append({
                    "change_id": self.seq_change,
                    "tx_id": tx_id,
                    "table_name": "ORDER_ITEMS",
                    "record_pk": ipk,
                    "operation_type": "INSERT",
                    "old_values": None,
                    "new_values": dict(item_rec),
                    "delta_values": None,
                    "changed_columns": "ALL",
                    "change_timestamp": now_ts,
                    "commit_order_seq": self.seq_commit
                })

        elif tbl == "ORDER_ITEMS":
            ord_id = int(record.get("order_id", 0))
            prod_id = int(record.get("product_id", 0))
            if str(ord_id) not in self.orders:
                raise ValueError(f"ORA-02291: integrity constraint violated - parent key ORDERS#{ord_id} not found")
            if str(prod_id) not in self.products:
                raise ValueError(f"ORA-02291: integrity constraint violated - parent key PRODUCTS#{prod_id} not found")
            qty = int(record.get("quantity", 1))
            if qty <= 0:
                raise ValueError("CHECK constraint violated: ORDER_ITEMS.quantity must be > 0")
            if "item_id" not in record or not record["item_id"]:
                self.seq_item += 1
                record["item_id"] = self.seq_item
            else:
                record["item_id"] = int(record["item_id"])
            pk = str(record["item_id"])
            unit_price = float(record.get("unit_price") if record.get("unit_price") is not None else self.products[str(prod_id)]["unit_price"])
            record["order_id"] = ord_id
            record["product_id"] = prod_id
            record["quantity"] = qty
            record["unit_price"] = unit_price
            record["subtotal"] = round(qty * unit_price, 2)
            self.order_items[pk] = record
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
            if "customer_id" in data and str(int(data["customer_id"])) not in self.customers:
                raise ValueError(f"ORA-02291: integrity constraint violated - parent key CUSTOMERS#{data['customer_id']} not found")
            target_map = self.orders
        elif tbl == "ORDER_ITEMS":
            if "order_id" in data and str(int(data["order_id"])) not in self.orders:
                raise ValueError(f"ORA-02291: integrity constraint violated - parent key ORDERS#{data['order_id']} not found")
            if "product_id" in data and str(int(data["product_id"])) not in self.products:
                raise ValueError(f"ORA-02291: integrity constraint violated - parent key PRODUCTS#{data['product_id']} not found")
            target_map = self.order_items
        else:
            raise ValueError(f"Table {table_name} not supported.")

        if pk not in target_map:
            raise ValueError(f"Record with key {pk} not found in {tbl}.")

        old_row = dict(target_map[pk])
        new_row = dict(old_row)

        changed_cols = []
        delta_vals = {}
        for k, v in data.items():
            if k in ("customer_id", "product_id", "order_id", "item_id", "created_at") and k == (
                "customer_id" if tbl == "CUSTOMERS" else "product_id" if tbl == "PRODUCTS" else "order_id" if tbl == "ORDERS" else "item_id"
            ):
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
        elif tbl == "ORDER_ITEMS":
            target_map = self.order_items
        else:
            raise ValueError(f"Table {table_name} not supported.")

        if pk not in target_map:
            raise ValueError(f"Record with key {pk} not found in {tbl}.")

        # Enforce Referenced Key constraints (ORA-02292) and ON DELETE CASCADE
        if tbl == "PRODUCTS":
            ref_items = [it for it in self.order_items.values() if str(it.get("product_id")) == pk]
            if ref_items:
                raise ValueError(
                    f"ORA-02292: integrity constraint violated - child record found in ORDER_ITEMS ({len(ref_items)} line item(s) reference PRODUCTS#{pk})"
                )
        elif tbl == "CUSTOMERS":
            ref_orders = [o for o in self.orders.values() if str(o.get("customer_id")) == pk]
            if ref_orders:
                raise ValueError(
                    f"ORA-02292: integrity constraint violated - child record found in ORDERS ({len(ref_orders)} order(s) reference CUSTOMERS#{pk})"
                )

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

        # ON DELETE CASCADE for ORDERS -> ORDER_ITEMS
        if tbl == "ORDERS":
            child_keys = [ipk for ipk, it in self.order_items.items() if str(it.get("order_id")) == pk]
            for ipk in child_keys:
                old_item = self.order_items.pop(ipk)
                self.seq_change += 1
                self.seq_commit += 1
                self.change_log.append({
                    "change_id": self.seq_change,
                    "tx_id": tx_id,
                    "table_name": "ORDER_ITEMS",
                    "record_pk": ipk,
                    "operation_type": "DELETE",
                    "old_values": old_item,
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

    # =========================================================================
    # TEMPORAL BRANCHING & MERGE ENGINE
    # =========================================================================

    def _resolve_branch(self, branch_id_or_name: Union[int, str]) -> Dict[str, Any]:
        """Resolves active branch by ID or name."""
        s = str(branch_id_or_name).strip()
        for b in self.branches:
            if b.get("branch_status") != "DELETED":
                if str(b["branch_id"]) == s or b["branch_name"].lower() == s.lower():
                    return b
        raise ValueError(f"Branch not found: {branch_id_or_name}")

    def _get_branch_head(self, branch_id: int) -> Optional[str]:
        """Returns head commit_id for a branch."""
        commits = [c for c in self.branch_commits if c["branch_id"] == branch_id]
        if not commits:
            return None
        commits.sort(key=lambda x: (x.get("commit_order_seq", 0), x.get("commit_timestamp", "")), reverse=True)
        return commits[0]["commit_id"]

    def create_branch(
        self,
        branch_name: str,
        parent_branch_name: str = "main",
        base_timestamp: Optional[str] = None,
        base_commit_id: Optional[str] = None,
        created_by: str = "developer",
        description: Optional[str] = None
    ) -> Dict[str, Any]:
        bname = branch_name.strip()
        if not bname:
            raise ValueError("Branch name cannot be empty")

        for b in self.branches:
            if b.get("branch_status") != "DELETED" and b["branch_name"].lower() == bname.lower():
                raise ValueError(f"Branch already exists: {branch_name}")

        parent = None
        if parent_branch_name:
            try:
                parent = self._resolve_branch(parent_branch_name)
            except ValueError:
                parent = None

        parent_id = parent["branch_id"] if parent else None
        parent_name = parent["branch_name"] if parent else None

        if parent and not base_commit_id:
            base_commit_id = self._get_branch_head(parent["branch_id"])

        if not base_timestamp:
            if base_commit_id:
                for c in self.branch_commits:
                    if c["commit_id"] == base_commit_id:
                        base_timestamp = c["commit_timestamp"]
                        break
            if not base_timestamp:
                base_timestamp = self._now_iso()
        else:
            base_timestamp = self._normalize_iso(base_timestamp)

        self.seq_branch += 1
        new_branch_id = self.seq_branch
        now_ts = self._now_iso()

        new_branch = {
            "branch_id": new_branch_id,
            "branch_name": bname,
            "parent_branch_id": parent_id,
            "parent_name": parent_name,
            "base_commit_id": base_commit_id,
            "base_timestamp": base_timestamp,
            "created_at": now_ts,
            "created_by": created_by or "developer",
            "branch_status": "ACTIVE",
            "is_default": "N",
            "description": description or f"Branch branched from {parent_name or 'main'}"
        }
        self.branches.append(new_branch)

        # Create initial commit for the branch
        self.seq_branch_commit += 1
        self.seq_commit += 1
        init_commit_id = f"c{self.seq_branch_commit}"
        init_commit = {
            "commit_id": init_commit_id,
            "branch_id": new_branch_id,
            "parent_commit_id": base_commit_id,
            "commit_message": f"Branch created from {parent_name or 'main'}",
            "commit_timestamp": now_ts,
            "commit_order_seq": self.seq_commit,
            "author": created_by or "developer",
            "commit_type": "INITIAL",
            "merge_parent_commit_id": None
        }
        self.branch_commits.append(init_commit)

        return self.get_branch(new_branch_id)

    def list_branches(self) -> List[Dict[str, Any]]:
        result = []
        for b in self.branches:
            if b.get("branch_status") == "DELETED":
                continue
            b_copy = dict(b)
            commits = [c for c in self.branch_commits if c["branch_id"] == b["branch_id"]]
            b_copy["commit_count"] = len(commits)
            if commits:
                commits.sort(key=lambda x: (x.get("commit_order_seq", 0), x.get("commit_timestamp", "")), reverse=True)
                b_copy["head_commit_id"] = commits[0]["commit_id"]
                b_copy["head_commit_message"] = commits[0]["commit_message"]
            else:
                b_copy["head_commit_id"] = None
                b_copy["head_commit_message"] = None
            result.append(b_copy)
        result.sort(key=lambda x: (1 if x["is_default"] == "Y" else 0, x["created_at"]), reverse=True)
        return result

    def get_branch(self, branch_id_or_name: Union[int, str]) -> Dict[str, Any]:
        b = self._resolve_branch(branch_id_or_name)
        b_copy = dict(b)
        commits = [c for c in self.branch_commits if c["branch_id"] == b["branch_id"]]
        b_copy["commit_count"] = len(commits)
        if commits:
            commits.sort(key=lambda x: (x.get("commit_order_seq", 0), x.get("commit_timestamp", "")), reverse=True)
            b_copy["head_commit_id"] = commits[0]["commit_id"]
            b_copy["head_commit_message"] = commits[0]["commit_message"]
        else:
            b_copy["head_commit_id"] = None
            b_copy["head_commit_message"] = None
        return b_copy

    def delete_branch(self, branch_id_or_name: Union[int, str]) -> Dict[str, Any]:
        b = self._resolve_branch(branch_id_or_name)
        if b.get("is_default") == "Y":
            raise ValueError("Cannot delete the default branch (main)")
        b["branch_status"] = "DELETED"
        return {"status": "DELETED", "branch_id": b["branch_id"], "branch_name": b["branch_name"]}

    def create_branch_commit(
        self,
        branch_id_or_name: Union[int, str],
        commit_message: str,
        author: str = "developer",
        changes: Optional[List[Dict[str, Any]]] = None,
        parent_commit_id: Optional[str] = None,
        commit_type: str = "NORMAL",
        merge_parent_commit_id: Optional[str] = None
    ) -> Dict[str, Any]:
        b = self._resolve_branch(branch_id_or_name)
        msg = commit_message.strip()
        if not msg:
            raise ValueError("Commit message cannot be empty")

        if not parent_commit_id:
            parent_commit_id = self._get_branch_head(b["branch_id"])

        # Resolve current branch state before applying commit so before_values/deltas are always complete
        changes_list = changes or []
        existing_by_tbl: Dict[str, Dict[str, Dict[str, Any]]] = {}
        if changes_list:
            cur_state = self.get_branch_state(b["branch_id"], "__ALL__")
            for row in cur_state.get("records", []):
                t_name = row.get("_table", "CUSTOMERS")
                pk_val = str(row.get("customer_id") or row.get("product_id") or row.get("order_id") or row.get("item_id"))
                existing_by_tbl.setdefault(t_name, {})[pk_val] = {k: v for k, v in row.items() if not k.startswith("_")}

        self.seq_branch_commit += 1
        self.seq_commit += 1
        commit_id = f"c{self.seq_branch_commit}"
        now_ts = self._now_iso()

        commit_record = {
            "commit_id": commit_id,
            "branch_id": b["branch_id"],
            "parent_commit_id": parent_commit_id,
            "commit_message": msg,
            "commit_timestamp": now_ts,
            "commit_order_seq": self.seq_commit,
            "author": author or "developer",
            "commit_type": commit_type or "NORMAL",
            "merge_parent_commit_id": merge_parent_commit_id
        }
        self.branch_commits.append(commit_record)

        # Store changesets
        for chg in changes_list:
            self.seq_changeset += 1
            tbl = chg.get("table_name", "").upper()
            rec_id = str(chg.get("record_id"))
            op = chg.get("operation_type", "UPDATE").upper()
            before_val = chg.get("before_values")
            if before_val is None and op in ("UPDATE", "DELETE"):
                before_val = copy.deepcopy(existing_by_tbl.get(tbl, {}).get(rec_id))
            after_val = chg.get("after_values")
            if op == "UPDATE" and before_val and after_val:
                merged_after = copy.deepcopy(before_val)
                merged_after.update(after_val)
                after_val = merged_after

            delta_val = chg.get("delta_values")
            changed_cols = chg.get("changed_columns")
            if op == "UPDATE" and before_val and after_val:
                diff_cols = [k for k in after_val if before_val.get(k) != after_val.get(k) and k not in {"created_at", "updated_at"}]
                if not changed_cols:
                    changed_cols = ",".join(diff_cols) if diff_cols else "NONE"
                if not delta_val and diff_cols:
                    delta_val = {k: {"old": before_val.get(k), "new": after_val.get(k)} for k in diff_cols}
            elif not changed_cols:
                changed_cols = "ALL"

            self.branch_changesets.append({
                "changeset_id": self.seq_changeset,
                "commit_id": commit_id,
                "table_name": tbl,
                "record_id": rec_id,
                "operation_type": op,
                "before_values": before_val,
                "after_values": after_val,
                "delta_values": delta_val,
                "changed_columns": changed_cols
            })

        commit_copy = dict(commit_record)
        commit_copy["changeset_count"] = len(changes_list)
        commit_copy["changes"] = [cs for cs in self.branch_changesets if cs["commit_id"] == commit_id]
        return commit_copy

    def revert_branch_to_commit(
        self,
        branch_id_or_name: Union[int, str],
        target_commit_id: str,
        author: str = "developer",
        commit_message: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Non-destructively restores a branch's database state back to a specific earlier commit
        by creating a new commit containing the inverse changesets.
        """
        b = self._resolve_branch(branch_id_or_name)
        target_commit = next(
            (c for c in self.branch_commits if c["branch_id"] == b["branch_id"] and c["commit_id"] == target_commit_id),
            None
        )
        if not target_commit:
            raise ValueError(f"Commit '{target_commit_id}' not found on branch '{b['branch_name']}'")

        head_state = self.get_branch_state(b["branch_id"], "__ALL__")
        target_state = self.get_branch_state(b["branch_id"], "__ALL__", commit_id=target_commit_id)

        def index_state(recs: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
            indexed = {}
            for r in recs:
                t = r.get("_table", "CUSTOMERS")
                pk_val = str(r.get("customer_id") or r.get("product_id") or r.get("order_id") or r.get("item_id"))
                indexed[f"{t}:{pk_val}"] = {k: v for k, v in r.items() if not k.startswith("_")}
            return indexed

        head_idx = index_state(head_state["records"])
        target_idx = index_state(target_state["records"])

        changes = []
        for key in sorted(set(head_idx.keys()) | set(target_idx.keys())):
            tbl, pk = key.split(":", 1)
            h_row = head_idx.get(key)
            t_row = target_idx.get(key)

            if not h_row and t_row:
                changes.append({
                    "table_name": tbl,
                    "record_id": pk,
                    "operation_type": "INSERT",
                    "before_values": None,
                    "after_values": t_row
                })
            elif h_row and not t_row:
                changes.append({
                    "table_name": tbl,
                    "record_id": pk,
                    "operation_type": "DELETE",
                    "before_values": h_row,
                    "after_values": None
                })
            elif h_row != t_row:
                changes.append({
                    "table_name": tbl,
                    "record_id": pk,
                    "operation_type": "UPDATE",
                    "before_values": h_row,
                    "after_values": t_row
                })

        msg = commit_message or f"Revert branch '{b['branch_name']}' back to commit {target_commit_id}"
        return self.create_branch_commit(
            branch_id_or_name=b["branch_id"],
            commit_message=msg,
            author=author,
            changes=changes
        )

    def get_branch_commits(self, branch_id_or_name: Union[int, str]) -> List[Dict[str, Any]]:
        b = self._resolve_branch(branch_id_or_name)
        commits = [c for c in self.branch_commits if c["branch_id"] == b["branch_id"]]
        commits.sort(key=lambda x: (x.get("commit_order_seq", 0), x.get("commit_timestamp", "")), reverse=True)

        result = []
        for c in commits:
            c_copy = dict(c)
            cs_list = [cs for cs in self.branch_changesets if cs["commit_id"] == c["commit_id"]]
            c_copy["changeset_count"] = len(cs_list)
            c_copy["changes"] = cs_list
            result.append(c_copy)
        return result

    def get_branch_state(
        self,
        branch_id_or_name: Union[int, str],
        table_name: str = "__ALL__",
        commit_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Reconstructs the effective state of a branch up to a specific commit.
        Starts from the base state and sequentially replays changesets.
        """
        b = self._resolve_branch(branch_id_or_name)
        tbl = table_name.upper()

        target_commit_id = commit_id or self._get_branch_head(b["branch_id"])

        # 1. Base table state
        state: Dict[str, Dict[str, Dict[str, Any]]] = {
            "CUSTOMERS": {},
            "PRODUCTS": {},
            "ORDERS": {},
            "ORDER_ITEMS": {}
        }

        # If branch has parent and base commit, get baseline
        if b.get("parent_branch_id") and b.get("base_commit_id"):
            parent_b = self._resolve_branch(b["parent_branch_id"])
            if parent_b["branch_name"] == "main" and b.get("base_timestamp"):
                for t in ["CUSTOMERS", "PRODUCTS", "ORDERS"]:
                    t_recon = self.reconstruct_table(t, b["base_timestamp"])
                    for row in t_recon["rows"]:
                        pk_field = "customer_id" if t == "CUSTOMERS" else ("product_id" if t == "PRODUCTS" else "order_id")
                        pk = str(row[pk_field])
                        state[t][pk] = copy.deepcopy(row)
            else:
                parent_state = self.get_branch_state(parent_b["branch_id"], "__ALL__", b["base_commit_id"])
                for row in parent_state.get("records", []):
                    t = row.get("_table", "CUSTOMERS")
                    pk = str(row.get("customer_id") or row.get("product_id") or row.get("order_id") or row.get("item_id"))
                    state[t][pk] = {k: v for k, v in row.items() if not k.startswith("_")}
        else:
            # Baseline from current state at base_timestamp
            for t in ["CUSTOMERS", "PRODUCTS", "ORDERS"]:
                t_recon = self.reconstruct_table(t, b["base_timestamp"])
                for row in t_recon["rows"]:
                    pk_field = "customer_id" if t == "CUSTOMERS" else ("product_id" if t == "PRODUCTS" else "order_id")
                    pk = str(row[pk_field])
                    state[t][pk] = copy.deepcopy(row)

        # 2. Collect commits in order up to target_commit_id
        branch_commits = [c for c in self.branch_commits if c["branch_id"] == b["branch_id"]]
        branch_commits.sort(key=lambda x: x["commit_order_seq"])

        active_commits = []
        for c in branch_commits:
            active_commits.append(c)
            if target_commit_id and c["commit_id"] == target_commit_id:
                break

        # 3. Apply changesets
        for c in active_commits:
            cs_list = [cs for cs in self.branch_changesets if cs["commit_id"] == c["commit_id"]]
            cs_list.sort(key=lambda x: x["changeset_id"])
            for cs in cs_list:
                t = cs["table_name"]
                rec_id = str(cs["record_id"])
                op = cs["operation_type"]
                if t not in state:
                    state[t] = {}

                if op == "INSERT":
                    state[t][rec_id] = copy.deepcopy(cs["after_values"])
                elif op == "UPDATE":
                    if rec_id in state[t]:
                        if cs.get("after_values"):
                            state[t][rec_id].update(cs["after_values"])
                        elif cs.get("delta_values"):
                            for k, v in cs["delta_values"].items():
                                state[t][rec_id][k] = v.get("new") if isinstance(v, dict) else v
                    else:
                        state[t][rec_id] = copy.deepcopy(cs.get("after_values", {}))
                elif op == "DELETE":
                    state[t].pop(rec_id, None)

        # 4. Filter output
        records = []
        tables_to_include = ["CUSTOMERS", "PRODUCTS", "ORDERS", "ORDER_ITEMS"] if tbl == "__ALL__" else [tbl]
        for t in tables_to_include:
            for pk, row in state.get(t, {}).items():
                r = copy.deepcopy(row)
                r["_table"] = t
                records.append(r)

        return {
            "branch_id": b["branch_id"],
            "branch_name": b["branch_name"],
            "commit_id": target_commit_id,
            "table_name": tbl,
            "total_records": len(records),
            "records": records
        }

    def calculate_merge_base(
        self,
        source_branch_name_or_id: Union[int, str],
        target_branch_name_or_id: Union[int, str]
    ) -> Optional[str]:
        src = self._resolve_branch(source_branch_name_or_id)
        tgt = self._resolve_branch(target_branch_name_or_id)

        src_head = self._get_branch_head(src["branch_id"])
        tgt_head = self._get_branch_head(tgt["branch_id"])

        def get_ancestors(commit_id: Optional[str]) -> Dict[str, int]:
            ancestors = {}
            queue = [commit_id] if commit_id else []
            visited = set()
            while queue:
                curr = queue.pop(0)
                if not curr or curr in visited:
                    continue
                visited.add(curr)
                commit_obj = next((c for c in self.branch_commits if c["commit_id"] == curr), None)
                if commit_obj:
                    ancestors[curr] = commit_obj.get("commit_order_seq", 0)
                    if commit_obj.get("parent_commit_id"):
                        queue.append(commit_obj["parent_commit_id"])
                    if commit_obj.get("merge_parent_commit_id"):
                        queue.append(commit_obj["merge_parent_commit_id"])
            return ancestors

        src_anc = get_ancestors(src_head)
        tgt_anc = get_ancestors(tgt_head)

        common = set(src_anc.keys()) & set(tgt_anc.keys())
        if not common:
            return src.get("base_commit_id") or tgt.get("base_commit_id")

        sorted_common = sorted(common, key=lambda c: src_anc[c], reverse=True)
        return sorted_common[0]

    def compare_branches(
        self,
        base_branch_name_or_id: Union[int, str],
        compare_branch_name_or_id: Union[int, str]
    ) -> Dict[str, Any]:
        base_b = self._resolve_branch(base_branch_name_or_id)
        comp_b = self._resolve_branch(compare_branch_name_or_id)

        merge_base = self.calculate_merge_base(comp_b["branch_id"], base_b["branch_id"])

        base_state = self.get_branch_state(base_b["branch_id"], "__ALL__")
        comp_state = self.get_branch_state(comp_b["branch_id"], "__ALL__")

        def index_state(recs: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
            indexed = {}
            for r in recs:
                t = r.get("_table", "CUSTOMERS")
                pk_val = str(r.get("customer_id") or r.get("product_id") or r.get("order_id") or r.get("item_id"))
                key = f"{t}:{pk_val}"
                indexed[key] = {k: v for k, v in r.items() if not k.startswith("_")}
            return indexed

        base_idx = index_state(base_state["records"])
        comp_idx = index_state(comp_state["records"])

        all_keys = set(base_idx.keys()) | set(comp_idx.keys())
        changes = []
        added = 0
        modified = 0
        deleted = 0

        for key in sorted(all_keys):
            tbl, pk = key.split(":", 1)
            b_row = base_idx.get(key)
            c_row = comp_idx.get(key)

            if not b_row and c_row:
                added += 1
                changes.append({
                    "table_name": tbl,
                    "record_id": pk,
                    "operation_type": "INSERT",
                    "changed_columns": "ALL",
                    "before_values": None,
                    "after_values": c_row,
                    "delta_values": None
                })
            elif b_row and not c_row:
                deleted += 1
                changes.append({
                    "table_name": tbl,
                    "record_id": pk,
                    "operation_type": "DELETE",
                    "changed_columns": "ALL",
                    "before_values": b_row,
                    "after_values": None,
                    "delta_values": None
                })
            elif b_row != c_row:
                diff_cols = [k for k in set(b_row.keys()) | set(c_row.keys()) if b_row.get(k) != c_row.get(k) and k not in {"created_at", "updated_at"}]
                if diff_cols:
                    modified += 1
                    delta = {c: {"old": b_row.get(c), "new": c_row.get(c)} for c in diff_cols}
                    changes.append({
                        "table_name": tbl,
                        "record_id": pk,
                        "operation_type": "UPDATE",
                        "changed_columns": ",".join(diff_cols),
                        "before_values": b_row,
                        "after_values": c_row,
                        "delta_values": delta
                    })

        return {
            "base_branch": base_b["branch_name"],
            "compare_branch": comp_b["branch_name"],
            "merge_base_commit": merge_base,
            "total_changes": len(changes),
            "added_count": added,
            "modified_count": modified,
            "deleted_count": deleted,
            "changes": changes
        }

    def merge_branches(
        self,
        source_branch: Union[int, str],
        target_branch: Union[int, str] = "main",
        merge_message: Optional[str] = None,
        author: str = "developer",
        resolution_strategy: str = "AUTO",
        resolved_conflicts: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        src = self._resolve_branch(source_branch)
        tgt = self._resolve_branch(target_branch)

        src_head = self._get_branch_head(src["branch_id"])
        tgt_head = self._get_branch_head(tgt["branch_id"])
        merge_base = self.calculate_merge_base(src["branch_id"], tgt["branch_id"])

        self.seq_merge += 1
        merge_id = self.seq_merge
        msg = merge_message or f"Merge branch '{src['branch_name']}' into '{tgt['branch_name']}'"

        # 1. Fast-Forward Check
        if tgt_head == merge_base:
            self.seq_branch_commit += 1
            self.seq_commit += 1
            merge_commit_id = f"c{self.seq_branch_commit}"
            now_ts = self._now_iso()

            merge_commit = {
                "commit_id": merge_commit_id,
                "branch_id": tgt["branch_id"],
                "parent_commit_id": tgt_head,
                "commit_message": f"{msg} (fast-forward)",
                "commit_timestamp": now_ts,
                "commit_order_seq": self.seq_commit,
                "author": author or "developer",
                "commit_type": "FAST_FORWARD",
                "merge_parent_commit_id": src_head
            }
            self.branch_commits.append(merge_commit)

            # Copy source changesets
            src_commits = [c["commit_id"] for c in self.branch_commits if c["branch_id"] == src["branch_id"]]
            for cs in [c for c in self.branch_changesets if c["commit_id"] in src_commits]:
                self.seq_changeset += 1
                new_cs = dict(cs)
                new_cs["changeset_id"] = self.seq_changeset
                new_cs["commit_id"] = merge_commit_id
                self.branch_changesets.append(new_cs)

            self.branch_merges.append({
                "merge_id": merge_id,
                "source_branch_id": src["branch_id"],
                "target_branch_id": tgt["branch_id"],
                "source_commit_id": src_head,
                "target_commit_id": tgt_head,
                "merge_commit_id": merge_commit_id,
                "merge_status": "SUCCESS",
                "merge_type": "FAST_FORWARD",
                "merge_timestamp": now_ts,
                "conflicts_count": 0,
                "merge_message": msg,
                "conflict_details": None
            })

            return {
                "status": "SUCCESS",
                "merge_type": "FAST_FORWARD",
                "merge_id": merge_id,
                "merge_commit_id": merge_commit_id,
                "conflicts_count": 0,
                "conflicts": [],
                "message": "Fast-forward merge completed successfully"
            }

        # 2. Three-Way Merge
        base_state = self.get_branch_state(tgt["branch_id"], "__ALL__", commit_id=merge_base)
        src_state = self.get_branch_state(src["branch_id"], "__ALL__", commit_id=src_head)
        tgt_state = self.get_branch_state(tgt["branch_id"], "__ALL__", commit_id=tgt_head)

        def index_state(recs: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
            indexed = {}
            for r in recs:
                t = r.get("_table", "CUSTOMERS")
                pk_val = str(r.get("customer_id") or r.get("product_id") or r.get("order_id") or r.get("item_id"))
                key = f"{t}:{pk_val}"
                indexed[key] = {k: v for k, v in r.items() if not k.startswith("_")}
            return indexed

        base_idx = index_state(base_state["records"])
        src_idx = index_state(src_state["records"])
        tgt_idx = index_state(tgt_state["records"])

        all_keys = set(base_idx.keys()) | set(src_idx.keys()) | set(tgt_idx.keys())
        conflicts = []
        clean_applied_changes = []

        # Map resolved conflicts by key if provided
        resolutions_by_key = {}
        if resolved_conflicts:
            for res in resolved_conflicts:
                k = f"{res.get('table_name')}:{res.get('record_id')}"
                resolutions_by_key[k] = res

        for key in sorted(all_keys):
            tbl, pk = key.split(":", 1)
            b_val = base_idx.get(key)
            s_val = src_idx.get(key)
            t_val = tgt_idx.get(key)

            # Unchanged in both
            if s_val == b_val and t_val == b_val:
                continue

            # Changed only in source
            if s_val != b_val and t_val == b_val:
                op = "DELETE" if not s_val else ("INSERT" if not b_val else "UPDATE")
                clean_applied_changes.append({
                    "table_name": tbl,
                    "record_id": pk,
                    "operation_type": op,
                    "before_values": t_val,
                    "after_values": s_val,
                    "delta_values": None
                })
                continue

            # Changed only in target
            if s_val == b_val and t_val != b_val:
                # Keep target change
                continue

            # Changed in both!
            if s_val != b_val and t_val != b_val:
                # Case 1: Both deleted
                if not s_val and not t_val:
                    continue

                # Case 2: One deleted, other updated
                if not s_val or not t_val:
                    conflict_obj = {
                        "table_name": tbl,
                        "record_id": pk,
                        "conflict_type": "DELETE_VS_UPDATE",
                        "source_op": "DELETE" if not s_val else "UPDATE",
                        "target_op": "DELETE" if not t_val else "UPDATE",
                        "base_values": b_val,
                        "source_values": s_val,
                        "target_values": t_val
                    }
                    if key in resolutions_by_key:
                        res = resolutions_by_key[key]
                        clean_applied_changes.append({
                            "table_name": tbl,
                            "record_id": pk,
                            "operation_type": res.get("operation_type", "UPDATE"),
                            "before_values": t_val,
                            "after_values": res.get("resolved_values"),
                            "delta_values": None
                        })
                    else:
                        conflicts.append(conflict_obj)
                    continue

                # Case 3: Both inserted
                if not b_val:
                    if s_val == t_val:
                        continue  # Clean
                    conflict_obj = {
                        "table_name": tbl,
                        "record_id": pk,
                        "conflict_type": "CONCURRENT_INSERT",
                        "source_op": "INSERT",
                        "target_op": "INSERT",
                        "base_values": None,
                        "source_values": s_val,
                        "target_values": t_val
                    }
                    if key in resolutions_by_key:
                        res = resolutions_by_key[key]
                        clean_applied_changes.append({
                            "table_name": tbl,
                            "record_id": pk,
                            "operation_type": "INSERT",
                            "before_values": None,
                            "after_values": res.get("resolved_values"),
                            "delta_values": None
                        })
                    else:
                        conflicts.append(conflict_obj)
                    continue

                # Case 4: Both updated - check column divergence
                cols_changed_in_s = {k for k in set(b_val.keys()) | set(s_val.keys()) if b_val.get(k) != s_val.get(k)}
                cols_changed_in_t = {k for k in set(b_val.keys()) | set(t_val.keys()) if b_val.get(k) != t_val.get(k)}
                overlapping_cols = cols_changed_in_s & cols_changed_in_t

                conflicting_cols = [c for c in overlapping_cols if s_val.get(c) != t_val.get(c)]

                if conflicting_cols:
                    conflict_obj = {
                        "table_name": tbl,
                        "record_id": pk,
                        "conflict_type": "SAME_COLUMN_MODIFICATION",
                        "conflicting_columns": conflicting_cols,
                        "source_op": "UPDATE",
                        "target_op": "UPDATE",
                        "base_values": b_val,
                        "source_values": s_val,
                        "target_values": t_val
                    }
                    if key in resolutions_by_key:
                        res = resolutions_by_key[key]
                        clean_applied_changes.append({
                            "table_name": tbl,
                            "record_id": pk,
                            "operation_type": "UPDATE",
                            "before_values": t_val,
                            "after_values": res.get("resolved_values"),
                            "delta_values": None
                        })
                    else:
                        conflicts.append(conflict_obj)
                else:
                    # Column-level automatic clean merge!
                    merged_row = copy.deepcopy(b_val)
                    for c in cols_changed_in_t:
                        merged_row[c] = t_val.get(c)
                    for c in cols_changed_in_s:
                        merged_row[c] = s_val.get(c)

                    clean_applied_changes.append({
                        "table_name": tbl,
                        "record_id": pk,
                        "operation_type": "UPDATE",
                        "before_values": t_val,
                        "after_values": merged_row,
                        "delta_values": None,
                        "changed_columns": ",".join(cols_changed_in_s)
                    })

        # If conflicts exist and not resolved, record conflict state
        if conflicts:
            self.branch_merges.append({
                "merge_id": merge_id,
                "source_branch_id": src["branch_id"],
                "target_branch_id": tgt["branch_id"],
                "source_commit_id": src_head,
                "target_commit_id": tgt_head,
                "merge_commit_id": None,
                "merge_status": "CONFLICT",
                "merge_type": "THREE_WAY",
                "merge_timestamp": self._now_iso(),
                "conflicts_count": len(conflicts),
                "merge_message": msg,
                "conflict_details": conflicts
            })
            return {
                "status": "CONFLICT",
                "merge_type": "THREE_WAY",
                "merge_id": merge_id,
                "conflicts_count": len(conflicts),
                "conflicts": conflicts,
                "message": f"Merge has {len(conflicts)} conflict(s). Resolution required."
            }

        # Otherwise, commit the 3-way merge
        self.seq_branch_commit += 1
        self.seq_commit += 1
        merge_commit_id = f"c{self.seq_branch_commit}"
        now_ts = self._now_iso()

        merge_commit = {
            "commit_id": merge_commit_id,
            "branch_id": tgt["branch_id"],
            "parent_commit_id": tgt_head,
            "commit_message": msg,
            "commit_timestamp": now_ts,
            "commit_order_seq": self.seq_commit,
            "author": author or "developer",
            "commit_type": "MERGE",
            "merge_parent_commit_id": src_head
        }
        self.branch_commits.append(merge_commit)

        for chg in clean_applied_changes:
            self.seq_changeset += 1
            self.branch_changesets.append({
                "changeset_id": self.seq_changeset,
                "commit_id": merge_commit_id,
                "table_name": chg["table_name"],
                "record_id": chg["record_id"],
                "operation_type": chg["operation_type"],
                "before_values": chg.get("before_values"),
                "after_values": chg.get("after_values"),
                "delta_values": chg.get("delta_values"),
                "changed_columns": chg.get("changed_columns", "resolved_or_merged")
            })

        self.branch_merges.append({
            "merge_id": merge_id,
            "source_branch_id": src["branch_id"],
            "target_branch_id": tgt["branch_id"],
            "source_commit_id": src_head,
            "target_commit_id": tgt_head,
            "merge_commit_id": merge_commit_id,
            "merge_status": "SUCCESS",
            "merge_type": "THREE_WAY",
            "merge_timestamp": now_ts,
            "conflicts_count": 0,
            "merge_message": msg,
            "conflict_details": None
        })

        return {
            "status": "SUCCESS",
            "merge_type": "THREE_WAY",
            "merge_id": merge_id,
            "merge_commit_id": merge_commit_id,
            "conflicts_count": 0,
            "conflicts": [],
            "message": "Three-way merge completed successfully"
        }

    def resolve_merge_conflict(
        self,
        merge_id: int,
        resolutions: List[Dict[str, Any]],
        author: str = "developer"
    ) -> Dict[str, Any]:
        merge_rec = next((m for m in self.branch_merges if m["merge_id"] == merge_id), None)
        if not merge_rec:
            raise ValueError(f"Merge operation #{merge_id} not found")
        if merge_rec["merge_status"] != "CONFLICT":
            raise ValueError(f"Merge operation #{merge_id} is not in CONFLICT status")

        src = self._resolve_branch(merge_rec["source_branch_id"])
        tgt = self._resolve_branch(merge_rec["target_branch_id"])

        return self.merge_branches(
            source_branch=src["branch_id"],
            target_branch=tgt["branch_id"],
            merge_message=f"Resolved merge: {merge_rec.get('merge_message')}",
            author=author,
            resolution_strategy="MANUAL",
            resolved_conflicts=resolutions
        )

    def abort_merge(self, merge_id: int) -> Dict[str, Any]:
        merge_rec = next((m for m in self.branch_merges if m["merge_id"] == merge_id), None)
        if not merge_rec:
            raise ValueError(f"Merge operation #{merge_id} not found")
        merge_rec["merge_status"] = "ABORTED"
        return {"status": "ABORTED", "merge_id": merge_id, "message": "Merge cancelled successfully"}

    def get_branch_timeline(self, branch_id_or_name: Optional[Union[int, str]] = None) -> Dict[str, Any]:
        """
        Builds graph data (nodes, links, branches, lanes) for SVG visualization.
        """
        palette = ["#6366f1", "#10b981", "#ec4899", "#f59e0b", "#06b6d4", "#8b5cf6", "#14b8a6", "#f43f5e"]
        branches_data = []
        branch_lane_map = {}

        active_branches = [b for b in self.branches if b.get("branch_status") != "DELETED"]
        # Ensure 'main' is lane 0
        main_b = next((b for b in active_branches if b.get("is_default") == "Y"), active_branches[0] if active_branches else None)

        ordered_branches = []
        if main_b:
            ordered_branches.append(main_b)
        for b in active_branches:
            if b != main_b:
                ordered_branches.append(b)

        for idx, b in enumerate(ordered_branches):
            color = palette[idx % len(palette)]
            branch_lane_map[b["branch_id"]] = idx
            branches_data.append({
                "branch_id": b["branch_id"],
                "branch_name": b["branch_name"],
                "is_default": b.get("is_default") == "Y",
                "color": color,
                "lane": idx
            })

        all_commits = list(self.branch_commits)
        all_commits.sort(key=lambda x: x["commit_order_seq"])

        nodes = []
        for c in all_commits:
            b_id = c["branch_id"]
            lane = branch_lane_map.get(b_id, 0)
            branch_info = next((b for b in branches_data if b["branch_id"] == b_id), None)
            color = branch_info["color"] if branch_info else "#6366f1"
            cs_list = [cs for cs in self.branch_changesets if cs["commit_id"] == c["commit_id"]]

            nodes.append({
                "commit_id": c["commit_id"],
                "branch_id": b_id,
                "branch_name": branch_info["branch_name"] if branch_info else "unknown",
                "commit_message": c["commit_message"],
                "commit_timestamp": c["commit_timestamp"],
                "commit_order_seq": c.get("commit_order_seq", 0),
                "author": c.get("author", "developer"),
                "commit_type": c.get("commit_type", "NORMAL"),
                "parent_commit_id": c.get("parent_commit_id"),
                "merge_parent_commit_id": c.get("merge_parent_commit_id"),
                "changeset_count": len(cs_list),
                "changes": cs_list,
                "lane": lane,
                "color": color
            })

        links = []
        for n in nodes:
            if n.get("parent_commit_id"):
                links.append({
                    "source": n["parent_commit_id"],
                    "target": n["commit_id"],
                    "type": "direct"
                })
            if n.get("merge_parent_commit_id"):
                links.append({
                    "source": n["merge_parent_commit_id"],
                    "target": n["commit_id"],
                    "type": "merge"
                })

        return {
            "branches": branches_data,
            "nodes": nodes,
            "links": links
        }


# Global singleton emulator
oracle_emulator = OracleEngineEmulator()
