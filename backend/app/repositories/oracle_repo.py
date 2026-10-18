import json
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime, timezone
import oracledb

from app.core.config import settings
from app.core.database import db_manager
from app.repositories.oracle_engine_emulator import oracle_emulator

logger = logging.getLogger("tt_repository")

class TimeTravelRepository:

    def _validate_table(self, table_name: str) -> str:
        tbl = table_name.upper().strip()
        if tbl not in settings.SUPPORTED_TABLES and tbl != "__ALL__":
            raise ValueError(f"Table '{table_name}' is not supported. Allowed: {sorted(list(settings.SUPPORTED_TABLES))}")
        return tbl

    def get_tables_overview(self) -> List[Dict[str, Any]]:
        conn = db_manager.get_connection()
        if conn:
            try:
                tables = []
                with conn.cursor() as cur:
                    for tbl in sorted(list(settings.SUPPORTED_TABLES)):
                        cur.execute(f"SELECT COUNT(*) FROM {tbl}")
                        row_cnt = cur.fetchone()[0]
                        cur.execute("SELECT COUNT(*) FROM TT_CHANGE_LOG WHERE table_name = :1", [tbl])
                        hist_cnt = cur.fetchone()[0]
                        
                        pk_col = "CUSTOMER_ID" if tbl == "CUSTOMERS" else ("PRODUCT_ID" if tbl == "PRODUCTS" else ("ORDER_ID" if tbl == "ORDERS" else "ITEM_ID"))
                        tables.append({
                            "name": tbl,
                            "row_count": row_cnt,
                            "history_count": hist_cnt,
                            "columns": [{"name": pk_col, "type": "NUMBER"}],
                            "primary_key": pk_col.lower()
                        })
                return tables
            except Exception as e:
                logger.error(f"Oracle query failed: {e}. Falling back to emulator.")

        # Fallback to emulator
        tables = [
            {
                "name": "CUSTOMERS",
                "row_count": len(oracle_emulator.customers),
                "history_count": sum(1 for c in oracle_emulator.change_log if c["table_name"] == "CUSTOMERS"),
                "columns": [
                    {"name": "customer_id", "type": "NUMBER"},
                    {"name": "name", "type": "VARCHAR2(100)"},
                    {"name": "email", "type": "VARCHAR2(150)"},
                    {"name": "phone", "type": "VARCHAR2(30)"},
                    {"name": "status", "type": "VARCHAR2(20)"},
                    {"name": "credit_limit", "type": "NUMBER(12,2)"}
                ],
                "primary_key": "customer_id"
            },
            {
                "name": "PRODUCTS",
                "row_count": len(oracle_emulator.products),
                "history_count": sum(1 for c in oracle_emulator.change_log if c["table_name"] == "PRODUCTS"),
                "columns": [
                    {"name": "product_id", "type": "NUMBER"},
                    {"name": "sku", "type": "VARCHAR2(50)"},
                    {"name": "name", "type": "VARCHAR2(150)"},
                    {"name": "category", "type": "VARCHAR2(50)"},
                    {"name": "unit_price", "type": "NUMBER(10,2)"},
                    {"name": "stock_quantity", "type": "NUMBER(8)"}
                ],
                "primary_key": "product_id"
            },
            {
                "name": "ORDERS",
                "row_count": len(oracle_emulator.orders),
                "history_count": sum(1 for c in oracle_emulator.change_log if c["table_name"] == "ORDERS"),
                "columns": [
                    {"name": "order_id", "type": "NUMBER"},
                    {"name": "customer_id", "type": "NUMBER"},
                    {"name": "order_date", "type": "TIMESTAMP"},
                    {"name": "status", "type": "VARCHAR2(30)"},
                    {"name": "total_amount", "type": "NUMBER(12,2)"},
                    {"name": "notes", "type": "VARCHAR2(400)"}
                ],
                "primary_key": "order_id"
            }
        ]
        return tables

    def get_table_records(self, table_name: str, search: Optional[str] = None) -> List[Dict[str, Any]]:
        tbl = self._validate_table(table_name)
        conn = db_manager.get_connection()
        if conn:
            try:
                with conn.cursor() as cur:
                    cur.execute(f"SELECT * FROM {tbl} ORDER BY 1 ASC")
                    cols = [col[0].lower() for col in cur.description]
                    rows = [dict(zip(cols, row)) for row in cur.fetchall()]
                    if search:
                        s = search.lower()
                        rows = [r for r in rows if any(s in str(v).lower() for v in r.values())]
                    return rows
            except Exception as e:
                logger.error(f"Error fetching {tbl} records: {e}")

        # Emulator
        records = []
        if tbl == "CUSTOMERS":
            records = list(oracle_emulator.customers.values())
        elif tbl == "PRODUCTS":
            records = list(oracle_emulator.products.values())
        elif tbl == "ORDERS":
            records = list(oracle_emulator.orders.values())
        
        if search:
            s = search.lower()
            records = [r for r in records if any(s in str(v).lower() for v in r.values())]
        return records

    def get_record(self, table_name: str, record_pk: str) -> Optional[Dict[str, Any]]:
        tbl = self._validate_table(table_name)
        records = self.get_table_records(tbl)
        pk_field = "customer_id" if tbl == "CUSTOMERS" else ("product_id" if tbl == "PRODUCTS" else "order_id")
        for r in records:
            if str(r.get(pk_field)) == str(record_pk):
                return r
        return None

    # --- HISTORICAL RECONSTRUCTION ---
    def reconstruct_row(self, table_name: str, record_pk: str, target_ts: str, strategy: str = "ADAPTIVE") -> Dict[str, Any]:
        tbl = self._validate_table(table_name)
        conn = db_manager.get_connection()
        if conn:
            try:
                with conn.cursor() as cur:
                    res = cur.callfunc(
                        "TT_RECONSTRUCTION_PKG.reconstruct_row",
                        oracledb.CLOB,
                        [tbl, str(record_pk), target_ts, strategy]
                    )
                    data = json.loads(res.read() if hasattr(res, 'read') else res)
                    return data
            except Exception as e:
                logger.error(f"Oracle PL/SQL reconstruct_row failed: {e}. Using emulator.")

        return oracle_emulator.reconstruct_row(tbl, record_pk, target_ts, strategy)

    def reconstruct_table(self, table_name: str, target_ts: str, strategy: str = "ADAPTIVE") -> Dict[str, Any]:
        tbl = self._validate_table(table_name)
        conn = db_manager.get_connection()
        if conn:
            try:
                with conn.cursor() as cur:
                    res = cur.callfunc(
                        "TT_RECONSTRUCTION_PKG.reconstruct_table",
                        oracledb.CLOB,
                        [tbl, target_ts, strategy]
                    )
                    data = json.loads(res.read() if hasattr(res, 'read') else res)
                    # Fetch active reconstructed rows
                    return data
            except Exception as e:
                logger.error(f"Oracle PL/SQL reconstruct_table failed: {e}. Using emulator.")

        return oracle_emulator.reconstruct_table(tbl, target_ts, strategy)

    # --- TIMELINE ---
    def get_timeline(self, table_name: str, record_pk: str) -> List[Dict[str, Any]]:
        tbl = self._validate_table(table_name)
        conn = db_manager.get_connection()
        if conn:
            try:
                with conn.cursor() as cur:
                    res = cur.callfunc(
                        "TT_RECONSTRUCTION_PKG.get_version_timeline",
                        oracledb.CLOB,
                        [tbl, str(record_pk)]
                    )
                    content = res.read() if hasattr(res, 'read') else res
                    return json.loads(content or "[]")
            except Exception as e:
                logger.error(f"Oracle get_version_timeline failed: {e}. Using emulator.")

        return oracle_emulator.get_timeline(tbl, record_pk)

    # --- DIFF ---
    def compare_states(self, table_name: str, ts1: str, ts2: str) -> Dict[str, Any]:
        tbl = self._validate_table(table_name)
        conn = db_manager.get_connection()
        if conn:
            try:
                with conn.cursor() as cur:
                    res = cur.callfunc(
                        "TT_DIFF_RESTORE_PKG.compare_states",
                        oracledb.CLOB,
                        [tbl, ts1, ts2]
                    )
                    content = res.read() if hasattr(res, 'read') else res
                    return json.loads(content)
            except Exception as e:
                logger.error(f"Oracle compare_states failed: {e}. Using emulator.")

        return oracle_emulator.compare_states(tbl, ts1, ts2)

    # --- CHECKPOINTS ---
    def create_checkpoint(self, table_name: str, strategy: str = "MANUAL", reason: str = "Manual request") -> Dict[str, Any]:
        tbl = self._validate_table(table_name)
        conn = db_manager.get_connection()
        if conn:
            try:
                with conn.cursor() as cur:
                    cp_id = cur.callfunc(
                        "TT_CHECKPOINT_PKG.create_checkpoint",
                        int,
                        [tbl, strategy, reason]
                    )
                    cur.execute("SELECT * FROM TT_CHECKPOINTS WHERE checkpoint_id = :1", [cp_id])
                    cols = [col[0].lower() for col in cur.description]
                    return dict(zip(cols, cur.fetchone()))
            except Exception as e:
                logger.error(f"Oracle create_checkpoint failed: {e}. Using emulator.")

        return oracle_emulator.create_checkpoint(tbl, strategy, reason)

    def get_checkpoints(self, table_name: Optional[str] = None) -> List[Dict[str, Any]]:
        conn = db_manager.get_connection()
        if conn:
            try:
                with conn.cursor() as cur:
                    if table_name:
                        cur.execute("SELECT * FROM TT_CHECKPOINTS WHERE table_name = :1 ORDER BY checkpoint_id DESC", [table_name.upper()])
                    else:
                        cur.execute("SELECT * FROM TT_CHECKPOINTS ORDER BY checkpoint_id DESC")
                    cols = [col[0].lower() for col in cur.description]
                    return [dict(zip(cols, r)) for r in cur.fetchall()]
            except Exception as e:
                logger.error(f"Oracle get_checkpoints failed: {e}. Using emulator.")

        cps = oracle_emulator.checkpoints
        if table_name:
            cps = [c for c in cps if c["table_name"] == table_name.upper()]
        return sorted(cps, key=lambda x: x["checkpoint_id"], reverse=True)

    def evaluate_adaptive_policy(self, table_name: str) -> Dict[str, Any]:
        tbl = self._validate_table(table_name)
        conn = db_manager.get_connection()
        if conn:
            try:
                with conn.cursor() as cur:
                    act = cur.callfunc("TT_CHECKPOINT_PKG.evaluate_adaptive_policy", str, [tbl])
                    cur.execute("SELECT * FROM TT_POLICY_DECISIONS WHERE table_name = :1 ORDER BY decision_id DESC FETCH FIRST 1 ROWS ONLY", [tbl])
                    cols = [col[0].lower() for col in cur.description]
                    return dict(zip(cols, cur.fetchone()))
            except Exception as e:
                logger.error(f"Oracle evaluate_adaptive_policy failed: {e}. Using emulator.")

        return oracle_emulator.evaluate_adaptive_policy(tbl)

    def get_policy_decisions(self, table_name: Optional[str] = None) -> List[Dict[str, Any]]:
        conn = db_manager.get_connection()
        if conn:
            try:
                with conn.cursor() as cur:
                    if table_name:
                        cur.execute("SELECT * FROM TT_POLICY_DECISIONS WHERE table_name = :1 ORDER BY decision_id DESC", [table_name.upper()])
                    else:
                        cur.execute("SELECT * FROM TT_POLICY_DECISIONS ORDER BY decision_id DESC")
                    cols = [col[0].lower() for col in cur.description]
                    return [dict(zip(cols, r)) for r in cur.fetchall()]
            except Exception as e:
                logger.error(f"Oracle get_policy_decisions failed: {e}. Using emulator.")

        decs = oracle_emulator.policy_decisions
        if table_name:
            decs = [d for d in decs if d["table_name"] == table_name.upper()]
        return sorted(decs, key=lambda x: x["decision_id"], reverse=True)

    # --- RESTORATION ---
    def preview_restore(self, table_name: str, record_pk: str, target_ts: str) -> Dict[str, Any]:
        tbl = self._validate_table(table_name)
        conn = db_manager.get_connection()
        if conn:
            try:
                with conn.cursor() as cur:
                    res = cur.callfunc(
                        "TT_DIFF_RESTORE_PKG.preview_restore",
                        oracledb.CLOB,
                        [tbl, str(record_pk), target_ts]
                    )
                    content = res.read() if hasattr(res, 'read') else res
                    return json.loads(content)
            except Exception as e:
                logger.error(f"Oracle preview_restore failed: {e}. Using emulator.")

        return oracle_emulator.preview_restore(tbl, record_pk, target_ts)

    def execute_restore(self, table_name: str, record_pk: str, target_ts: str, user_note: str) -> Dict[str, Any]:
        tbl = self._validate_table(table_name)
        conn = db_manager.get_connection()
        if conn:
            try:
                with conn.cursor() as cur:
                    res = cur.callfunc(
                        "TT_DIFF_RESTORE_PKG.execute_restore",
                        oracledb.CLOB,
                        [tbl, str(record_pk), target_ts, user_note]
                    )
                    content = res.read() if hasattr(res, 'read') else res
                    return json.loads(content)
            except Exception as e:
                logger.error(f"Oracle execute_restore failed: {e}. Using emulator.")

        return oracle_emulator.execute_restore(tbl, record_pk, target_ts, user_note)

    # --- DML OPERATIONS ---
    def insert_record(self, table_name: str, data: Dict[str, Any]) -> Dict[str, Any]:
        tbl = self._validate_table(table_name)
        conn = db_manager.get_connection()
        if conn:
            try:
                # Parameterized insert into Oracle
                with conn.cursor() as cur:
                    cols = [k for k in data.keys()]
                    bind_placeholders = [f":{idx+1}" for idx in range(len(cols))]
                    vals = [data[k] for k in cols]
                    sql = f"INSERT INTO {tbl} ({', '.join(cols)}) VALUES ({', '.join(bind_placeholders)})"
                    cur.execute(sql, vals)
                    conn.commit()
                return {"status": "SUCCESS", "message": f"Successfully inserted row into {tbl}."}
            except Exception as e:
                logger.error(f"Oracle insert failed: {e}. Falling back to emulator.")

        return oracle_emulator.insert_record(tbl, data)

    def update_record(self, table_name: str, record_pk: str, data: Dict[str, Any]) -> Dict[str, Any]:
        tbl = self._validate_table(table_name)
        conn = db_manager.get_connection()
        if conn:
            try:
                pk_col = "CUSTOMER_ID" if tbl == "CUSTOMERS" else ("PRODUCT_ID" if tbl == "PRODUCTS" else "ORDER_ID")
                with conn.cursor() as cur:
                    set_clauses = [f"{col} = :{idx+1}" for idx, col in enumerate(data.keys()) if col.upper() != pk_col]
                    vals = [data[col] for col in data.keys() if col.upper() != pk_col]
                    vals.append(record_pk)
                    sql = f"UPDATE {tbl} SET {', '.join(set_clauses)} WHERE {pk_col} = :{len(vals)}"
                    cur.execute(sql, vals)
                    conn.commit()
                return {"status": "SUCCESS", "message": f"Successfully updated row {record_pk} in {tbl}."}
            except Exception as e:
                logger.error(f"Oracle update failed: {e}. Falling back to emulator.")

        return oracle_emulator.update_record(tbl, record_pk, data)

    def delete_record(self, table_name: str, record_pk: str) -> Dict[str, Any]:
        tbl = self._validate_table(table_name)
        conn = db_manager.get_connection()
        if conn:
            try:
                pk_col = "CUSTOMER_ID" if tbl == "CUSTOMERS" else ("PRODUCT_ID" if tbl == "PRODUCTS" else "ORDER_ID")
                with conn.cursor() as cur:
                    sql = f"DELETE FROM {tbl} WHERE {pk_col} = :1"
                    cur.execute(sql, [record_pk])
                    conn.commit()
                return {"status": "SUCCESS", "message": f"Successfully deleted row {record_pk} from {tbl}."}
            except Exception as e:
                logger.error(f"Oracle delete failed: {e}. Falling back to emulator.")

        return oracle_emulator.delete_record(tbl, record_pk)

    # --- STORAGE & CONFIG ---
    def get_storage_stats(self) -> Dict[str, Any]:
        return oracle_emulator.get_storage_stats()

    def get_configs(self) -> Dict[str, str]:
        return dict(oracle_emulator.config)

    def update_config(self, key: str, value: str):
        oracle_emulator.config[key.upper()] = str(value)

repository = TimeTravelRepository()
