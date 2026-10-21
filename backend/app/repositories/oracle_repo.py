import json
import logging
import time
from typing import Dict, List, Any, Optional, Union
from datetime import datetime, timezone
import oracledb

from app.core.config import settings
from app.core.database import db_manager
from app.repositories.oracle_engine_emulator import oracle_emulator

logger = logging.getLogger("tt_repository")

def _format_iso_ts(ts: Any) -> str:
    """Formats any input timestamp or ISO string into canonical Oracle TO_TIMESTAMP_TZ format."""
    if isinstance(ts, datetime):
        dt = ts
    elif not ts:
        dt = datetime.now(timezone.utc)
    else:
        try:
            s = str(ts).strip().replace("Z", "+00:00")
            if len(s) == 16 and "T" in s:
                s += ":00+00:00"
            dt = datetime.fromisoformat(s)
        except Exception:
            dt = datetime.now(timezone.utc)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    tz_str = dt.strftime("%z")
    tz_formatted = (tz_str[:3] + ":" + tz_str[3:]) if len(tz_str) == 5 else "+00:00"
    return dt.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + tz_formatted

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
                    for tbl in ["CUSTOMERS", "PRODUCTS", "ORDERS", "ORDER_ITEMS"]:
                        cur.execute(f"SELECT COUNT(*) FROM {tbl}")
                        row_cnt = cur.fetchone()[0]
                        cur.execute("SELECT COUNT(*) FROM TT_CHANGE_LOG WHERE table_name = :1", [tbl])
                        hist_cnt = cur.fetchone()[0]
                        
                        pk_col = "CUSTOMER_ID" if tbl == "CUSTOMERS" else (
                            "PRODUCT_ID" if tbl == "PRODUCTS" else (
                                "ORDER_ID" if tbl == "ORDERS" else "ITEM_ID"
                            )
                        )
                        tables.append({
                            "name": tbl,
                            "row_count": row_cnt,
                            "history_count": hist_cnt,
                            "columns": [{"name": pk_col, "type": "NUMBER"}],
                            "primary_key": pk_col.lower()
                        })
                return tables
            except Exception as e:
                logger.error(f"Oracle query failed: {e}")
                raise ValueError(f"Failed to fetch table overview: {e}")

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
                    rows = []
                    for row in cur.fetchall():
                        rec = {}
                        for col, val in zip(cols, row):
                            if isinstance(val, (datetime, )):
                                rec[col] = val.isoformat()
                            elif hasattr(val, 'read'):
                                rec[col] = val.read()
                            else:
                                rec[col] = val
                        rows.append(rec)
                    if search:
                        s = search.lower()
                        rows = [r for r in rows if any(s in str(v).lower() for v in r.values())]
                    return rows
            except Exception as e:
                logger.error(f"Error fetching {tbl} records: {e}")
                raise ValueError(f"Failed to fetch {tbl} records: {e}")

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
        pk_field = "customer_id" if tbl == "CUSTOMERS" else (
            "product_id" if tbl == "PRODUCTS" else (
                "order_id" if tbl == "ORDERS" else "item_id"
            )
        )
        for r in records:
            if str(r.get(pk_field)) == str(record_pk):
                return r
        return None

    # --- HISTORICAL RECONSTRUCTION ---
    def reconstruct_row(self, table_name: str, record_pk: str, target_ts: Union[str, datetime], strategy: str = "ADAPTIVE") -> Dict[str, Any]:
        tbl = self._validate_table(table_name)
        conn = db_manager.get_connection()
        if conn:
            try:
                iso_str = _format_iso_ts(target_ts)
                with conn.cursor() as cur:
                    cur.execute("""
                        SELECT TT_RECONSTRUCTION_PKG.reconstruct_row(
                            :1, :2, 
                            TO_TIMESTAMP_TZ(:3, 'YYYY-MM-DD"T"HH24:MI:SS.FF3TZH:TZM'), 
                            :4
                        ) FROM DUAL
                    """, [tbl, str(record_pk), iso_str, strategy])
                    res = cur.fetchone()[0]
                    content = res.read() if hasattr(res, 'read') else res
                    data = json.loads(content)
                    if "reconstructed_at" not in data:
                        data["reconstructed_at"] = datetime.now(timezone.utc).isoformat()
                    return data
            except Exception as e:
                logger.error(f"Oracle PL/SQL reconstruct_row failed: {e}")
                raise ValueError(f"Reconstruction failed: {str(e)}")

        return oracle_emulator.reconstruct_row(tbl, record_pk, target_ts if isinstance(target_ts, str) else target_ts.isoformat(), strategy)

    def reconstruct_table(self, table_name: str, target_ts: Union[str, datetime], strategy: str = "ADAPTIVE") -> Dict[str, Any]:
        tbl = self._validate_table(table_name)
        conn = db_manager.get_connection()
        if conn:
            try:
                iso_str = _format_iso_ts(target_ts)
                pk_col = "CUSTOMER_ID" if tbl == "CUSTOMERS" else (
                    "PRODUCT_ID" if tbl == "PRODUCTS" else (
                        "ORDER_ID" if tbl == "ORDERS" else "ITEM_ID"
                    )
                )
                
                with conn.cursor() as cur:
                    cur.execute(f"SELECT TO_CHAR({pk_col}) FROM {tbl} UNION SELECT record_pk FROM TT_CHANGE_LOG WHERE table_name = :1", [tbl])
                    all_pks = [r[0] for r in cur.fetchall()]
                    
                    rows = []
                    total_changes = 0
                    cp_used = None
                    t_start = time.perf_counter()
                    
                    for pk in sorted(all_pks, key=lambda x: int(x) if x.isdigit() else x):
                        cur.execute("""
                            SELECT TT_RECONSTRUCTION_PKG.reconstruct_row(
                                :1, :2, 
                                TO_TIMESTAMP_TZ(:3, 'YYYY-MM-DD"T"HH24:MI:SS.FF3TZH:TZM'), 
                                :4
                            ) FROM DUAL
                        """, [tbl, str(pk), iso_str, strategy])
                        res = cur.fetchone()[0]
                        content = res.read() if hasattr(res, 'read') else res
                        row_env = json.loads(content)
                        total_changes += row_env.get("changes_replayed", 0)
                        if row_env.get("checkpoint_id_used"):
                            cp_used = row_env["checkpoint_id_used"]
                        if row_env.get("row_state"):
                            rows.append(row_env["row_state"])
                            
                    t_end = time.perf_counter()
                    exec_ms = round((t_end - t_start) * 1000, 3)
                    
                    return {
                        "table_name": tbl,
                        "target_timestamp": iso_str,
                        "strategy_used": strategy,
                        "checkpoint_id_used": cp_used,
                        "changes_replayed": total_changes,
                        "execution_time_ms": exec_ms,
                        "total_active_rows": len(rows),
                        "rows": rows
                    }
            except Exception as e:
                logger.error(f"Oracle PL/SQL reconstruct_table failed: {e}")
                raise ValueError(f"Table reconstruction failed: {str(e)}")

        return oracle_emulator.reconstruct_table(tbl, target_ts if isinstance(target_ts, str) else target_ts.isoformat(), strategy)

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
                    data = json.loads(content or "[]")
                    return data
            except Exception as e:
                logger.error(f"Oracle get_version_timeline failed: {e}")
                raise ValueError(f"Version timeline fetch failed: {str(e)}")

        return oracle_emulator.get_timeline(tbl, record_pk)

    # --- DIFF ---
    def compare_states(self, table_name: str, ts1: Union[str, datetime], ts2: Union[str, datetime]) -> Dict[str, Any]:
        tbl = self._validate_table(table_name)
        conn = db_manager.get_connection()
        if conn:
            try:
                iso1 = _format_iso_ts(ts1)
                iso2 = _format_iso_ts(ts2)
                with conn.cursor() as cur:
                    cur.execute("""
                        SELECT TT_DIFF_RESTORE_PKG.compare_states(
                            :1, 
                            TO_TIMESTAMP_TZ(:2, 'YYYY-MM-DD"T"HH24:MI:SS.FF3TZH:TZM'),
                            TO_TIMESTAMP_TZ(:3, 'YYYY-MM-DD"T"HH24:MI:SS.FF3TZH:TZM')
                        ) FROM DUAL
                    """, [tbl, iso1, iso2])
                    res = cur.fetchone()[0]
                    content = res.read() if hasattr(res, 'read') else res
                    data = json.loads(content)
                    if isinstance(data.get("changes"), str):
                        data["changes"] = json.loads(data["changes"])
                    return data
            except Exception as e:
                logger.error(f"Oracle compare_states failed: {e}")
                raise ValueError(f"State comparison failed: {str(e)}")

        return oracle_emulator.compare_states(tbl, ts1 if isinstance(ts1, str) else ts1.isoformat(), ts2 if isinstance(ts2, str) else ts2.isoformat())

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
                logger.error(f"Oracle create_checkpoint failed: {e}")
                raise ValueError(f"Checkpoint creation failed: {str(e)}")

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
                logger.error(f"Oracle get_checkpoints failed: {e}")
                raise ValueError(f"Failed to fetch checkpoints: {str(e)}")

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
                logger.error(f"Oracle evaluate_adaptive_policy failed: {e}")
                raise ValueError(f"Adaptive policy evaluation failed: {str(e)}")

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
                logger.error(f"Oracle get_policy_decisions failed: {e}")
                raise ValueError(f"Failed to fetch policy decisions: {str(e)}")

        decs = oracle_emulator.policy_decisions
        if table_name:
            decs = [d for d in decs if d["table_name"] == table_name.upper()]
        return sorted(decs, key=lambda x: x["decision_id"], reverse=True)

    # --- RESTORATION ---
    def preview_restore(self, table_name: str, record_pk: str, target_ts: Union[str, datetime]) -> Dict[str, Any]:
        tbl = self._validate_table(table_name)
        conn = db_manager.get_connection()
        if conn:
            try:
                iso_str = _format_iso_ts(target_ts)
                with conn.cursor() as cur:
                    cur.execute("""
                        SELECT TT_DIFF_RESTORE_PKG.preview_restore(
                            :1, :2, 
                            TO_TIMESTAMP_TZ(:3, 'YYYY-MM-DD"T"HH24:MI:SS.FF3TZH:TZM')
                        ) FROM DUAL
                    """, [tbl, str(record_pk), iso_str])
                    res = cur.fetchone()[0]
                    content = res.read() if hasattr(res, 'read') else res
                    data = json.loads(content)
                    if isinstance(data.get("historical_state"), str):
                        try:
                            data["historical_state"] = json.loads(data["historical_state"])
                        except Exception:
                            pass
                    if isinstance(data.get("current_state"), str):
                        try:
                            data["current_state"] = json.loads(data["current_state"])
                        except Exception:
                            pass
                    return data
            except Exception as e:
                logger.error(f"Oracle preview_restore failed: {e}")
                raise ValueError(f"Restore preview failed: {str(e)}")

        return oracle_emulator.preview_restore(tbl, record_pk, target_ts if isinstance(target_ts, str) else target_ts.isoformat())

    def execute_restore(self, table_name: str, record_pk: str, target_ts: Union[str, datetime], user_note: str) -> Dict[str, Any]:
        tbl = self._validate_table(table_name)
        conn = db_manager.get_connection()
        if conn:
            try:
                iso_str = _format_iso_ts(target_ts)
                with conn.cursor() as cur:
                    res_var = cur.var(oracledb.CLOB)
                    cur.execute("""
                        BEGIN
                            :1 := TT_DIFF_RESTORE_PKG.execute_restore(
                                :2, :3, 
                                TO_TIMESTAMP_TZ(:4, 'YYYY-MM-DD"T"HH24:MI:SS.FF3TZH:TZM'),
                                :5
                            );
                        END;
                    """, [res_var, tbl, str(record_pk), iso_str, user_note])
                    val = res_var.getvalue()
                    content = val.read() if hasattr(val, 'read') else val
                    data = json.loads(content)
                    if data.get("status") == "FAILED":
                        raise ValueError(data.get("error", "Restoration failed"))
                    return data
            except Exception as e:
                logger.error(f"Oracle execute_restore failed: {e}")
                raise ValueError(f"Restoration execution failed: {str(e)}")

        return oracle_emulator.execute_restore(tbl, record_pk, target_ts if isinstance(target_ts, str) else target_ts.isoformat(), user_note)

    # --- DML OPERATIONS ---
    def insert_record(self, table_name: str, data: Dict[str, Any]) -> Dict[str, Any]:
        tbl = self._validate_table(table_name)
        conn = db_manager.get_connection()
        if conn:
            try:
                pk_col = "CUSTOMER_ID" if tbl == "CUSTOMERS" else (
                    "PRODUCT_ID" if tbl == "PRODUCTS" else (
                        "ORDER_ID" if tbl == "ORDERS" else "ITEM_ID"
                    )
                )
                system_cols = {"CREATED_AT", "UPDATED_AT"}
                
                insertable_items = []
                for col, val in data.items():
                    c_up = col.upper()
                    # If PK is empty/None, omit it so sequence/trigger assigns it
                    if c_up == pk_col and (val is None or str(val).strip() == ""):
                        continue
                    if c_up in system_cols and (val is None or str(val).strip() == ""):
                        continue
                    if val == "":
                        val = None
                    elif c_up in {"CREDIT_LIMIT", "UNIT_PRICE", "TOTAL_AMOUNT", "SUBTOTAL"}:
                        try:
                            val = float(val)
                        except (ValueError, TypeError):
                            pass
                    elif c_up in {"STOCK_QUANTITY", "QUANTITY", "CUSTOMER_ID", "ORDER_ID", "PRODUCT_ID", pk_col}:
                        try:
                            val = int(val)
                        except (ValueError, TypeError):
                            pass
                    insertable_items.append((col, val))

                cols = [col for col, _ in insertable_items]
                placeholders = [f":{i+1}" for i in range(len(insertable_items))]
                vals = [val for _, val in insertable_items]
                sql = f"INSERT INTO {tbl} ({', '.join(cols)}) VALUES ({', '.join(placeholders)})"
                
                with conn.cursor() as cur:
                    cur.execute(sql, vals)
                    conn.commit()
                return {"status": "SUCCESS", "message": f"Successfully inserted row into {tbl}."}
            except Exception as e:
                conn.rollback()
                logger.error(f"Oracle insert failed: {e}")
                raise ValueError(f"Oracle insert failed: {str(e)}")

        return oracle_emulator.insert_record(tbl, data)

    def update_record(self, table_name: str, record_pk: str, data: Dict[str, Any]) -> Dict[str, Any]:
        tbl = self._validate_table(table_name)
        conn = db_manager.get_connection()
        if conn:
            try:
                pk_col = "CUSTOMER_ID" if tbl == "CUSTOMERS" else (
                    "PRODUCT_ID" if tbl == "PRODUCTS" else (
                        "ORDER_ID" if tbl == "ORDERS" else "ITEM_ID"
                    )
                )
                system_cols = {"CREATED_AT", "UPDATED_AT"}
                
                # Filter out PK and auto-managed timestamp columns
                editable_items = []
                for col, val in data.items():
                    c_up = col.upper()
                    if c_up != pk_col and c_up not in system_cols:
                        if val == "" or val is None:
                            val = None
                        elif c_up in {"CREDIT_LIMIT", "UNIT_PRICE", "TOTAL_AMOUNT", "SUBTOTAL"}:
                            try:
                                val = float(val)
                            except (ValueError, TypeError):
                                pass
                        elif c_up in {"STOCK_QUANTITY", "QUANTITY", "CUSTOMER_ID", "ORDER_ID", "PRODUCT_ID"}:
                            try:
                                val = int(val)
                            except (ValueError, TypeError):
                                pass
                        editable_items.append((col, val))

                if not editable_items:
                    return {"status": "SUCCESS", "message": f"No editable columns provided for {tbl} row {record_pk}."}

                set_clauses = [f"{col} = :{i+1}" for i, (col, _) in enumerate(editable_items)]
                vals = [val for _, val in editable_items]
                vals.append(record_pk)
                sql = f"UPDATE {tbl} SET {', '.join(set_clauses)} WHERE {pk_col} = :{len(vals)}"
                
                with conn.cursor() as cur:
                    cur.execute(sql, vals)
                    if cur.rowcount == 0:
                        raise ValueError(f"Record with {pk_col}={record_pk} does not exist in {tbl}")
                    conn.commit()
                return {"status": "SUCCESS", "message": f"Successfully updated row {record_pk} in {tbl}."}
            except Exception as e:
                conn.rollback()
                logger.error(f"Oracle update failed: {e}")
                raise ValueError(f"Oracle update failed: {str(e)}")

        return oracle_emulator.update_record(tbl, record_pk, data)

    def delete_record(self, table_name: str, record_pk: str) -> Dict[str, Any]:
        tbl = self._validate_table(table_name)
        conn = db_manager.get_connection()
        if conn:
            try:
                pk_col = "CUSTOMER_ID" if tbl == "CUSTOMERS" else (
                    "PRODUCT_ID" if tbl == "PRODUCTS" else (
                        "ORDER_ID" if tbl == "ORDERS" else "ITEM_ID"
                    )
                )
                with conn.cursor() as cur:
                    sql = f"DELETE FROM {tbl} WHERE {pk_col} = :1"
                    cur.execute(sql, [record_pk])
                    if cur.rowcount == 0:
                        raise ValueError(f"Record with {pk_col}={record_pk} does not exist in {tbl}")
                    conn.commit()
                return {"status": "SUCCESS", "message": f"Successfully deleted row {record_pk} from {tbl}."}
            except Exception as e:
                conn.rollback()
                logger.error(f"Oracle delete failed: {e}")
                raise ValueError(f"Oracle delete failed: {str(e)}")

        return oracle_emulator.delete_record(tbl, record_pk)

    # --- STORAGE & CONFIG ---
    def get_storage_stats(self) -> Dict[str, Any]:
        return oracle_emulator.get_storage_stats()

    def get_configs(self) -> Dict[str, str]:
        return dict(oracle_emulator.config)

    def update_config(self, key: str, value: str):
        oracle_emulator.config[key.upper()] = str(value)

repository = TimeTravelRepository()
