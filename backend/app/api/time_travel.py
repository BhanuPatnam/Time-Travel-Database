from fastapi import APIRouter, HTTPException
from app.repositories.oracle_repo import repository
from app.schemas.models import (
    TimeTravelRowRequest, TimeTravelRowResponse,
    TimeTravelTableRequest, TimeTravelTableResponse
)

router = APIRouter(prefix="/time-travel", tags=["Time Travel"])

@router.post("/row", response_model=TimeTravelRowResponse)
def reconstruct_row(req: TimeTravelRowRequest):
    try:
        data = repository.reconstruct_row(
            req.table_name, req.record_pk, req.target_timestamp, req.strategy or "ADAPTIVE"
        )
        return TimeTravelRowResponse(**data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Reconstruction failed: {str(e)}")

@router.post("/table", response_model=TimeTravelTableResponse)
def reconstruct_table(req: TimeTravelTableRequest):
    try:
        data = repository.reconstruct_table(
            req.table_name, req.target_timestamp, req.strategy or "ADAPTIVE"
        )
        return TimeTravelTableResponse(**data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Table reconstruction failed: {str(e)}")

@router.post("/database")
def reconstruct_database(req: TimeTravelTableRequest):
    """Reconstructs the complete multi-table database state (CUSTOMERS, PRODUCTS, ORDERS, ORDER_ITEMS) at target timestamp."""
    try:
        tables_res = {}
        total_changes = 0
        total_rows = 0
        total_latency = 0.0
        
        for tbl in ["CUSTOMERS", "PRODUCTS", "ORDERS", "ORDER_ITEMS"]:
            t_data = repository.reconstruct_table(tbl, req.target_timestamp, req.strategy or "ADAPTIVE")
            tables_res[tbl] = t_data
            total_changes += t_data.get("changes_replayed", 0)
            total_rows += t_data.get("total_active_rows", len(t_data.get("rows", [])))
            total_latency += t_data.get("execution_time_ms", 0.0)
            
        return {
            "target_timestamp": req.target_timestamp,
            "strategy_used": req.strategy or "ADAPTIVE",
            "total_active_rows": total_rows,
            "total_changes_replayed": total_changes,
            "total_execution_time_ms": round(total_latency, 3),
            "tables": tables_res
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database reconstruction failed: {str(e)}")
