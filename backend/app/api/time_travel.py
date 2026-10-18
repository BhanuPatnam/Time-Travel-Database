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
