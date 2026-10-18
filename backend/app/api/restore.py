from fastapi import APIRouter, HTTPException
from app.repositories.oracle_repo import repository
from app.schemas.models import (
    RestorePreviewRequest, RestorePreviewResponse,
    RestoreExecuteRequest, RestoreExecuteResponse
)

router = APIRouter(prefix="/restore", tags=["Historical Restoration"])

@router.post("/preview", response_model=RestorePreviewResponse)
def preview_restore(req: RestorePreviewRequest):
    try:
        data = repository.preview_restore(req.table_name, req.record_pk, req.target_timestamp)
        return RestorePreviewResponse(**data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Restore preview failed: {str(e)}")

@router.post("/execute", response_model=RestoreExecuteResponse)
def execute_restore(req: RestoreExecuteRequest):
    if not req.confirm_action:
        raise HTTPException(status_code=400, detail="Restoration requires explicit user confirmation.")
    try:
        data = repository.execute_restore(
            req.table_name, req.record_pk, req.target_timestamp,
            req.user_note or "Restoration from Dashboard"
        )
        return RestoreExecuteResponse(**data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Restoration execution failed: {str(e)}")
