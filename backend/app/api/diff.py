from fastapi import APIRouter, HTTPException
from app.repositories.oracle_repo import repository
from app.schemas.models import DiffRequest, DiffResponse, DiffChangeItem

router = APIRouter(prefix="/diff", tags=["Historical Diff"])

@router.post("", response_model=DiffResponse)
def compare_historical_states(req: DiffRequest):
    try:
        data = repository.compare_states(req.table_name, req.timestamp_1, req.timestamp_2)
        return DiffResponse(
            table_name=data["table_name"],
            timestamp_1=data["timestamp_1"],
            timestamp_2=data["timestamp_2"],
            added_count=data["added_count"],
            deleted_count=data["deleted_count"],
            modified_count=data["modified_count"],
            changes=[DiffChangeItem(**c) for c in data.get("changes", [])]
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Diff calculation failed: {str(e)}")
