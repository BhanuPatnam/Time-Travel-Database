from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query
from app.repositories.oracle_repo import repository
from app.schemas.models import (
    CheckpointItem, CreateCheckpointRequest, PolicyDecisionItem
)

router = APIRouter(prefix="/checkpoints", tags=["Checkpoints"])

@router.get("", response_model=List[CheckpointItem])
def list_checkpoints(table_name: Optional[str] = Query(None)):
    cps = repository.get_checkpoints(table_name)
    return [CheckpointItem(**c) for c in cps]

@router.post("", response_model=CheckpointItem)
def create_checkpoint(req: CreateCheckpointRequest):
    try:
        cp = repository.create_checkpoint(
            req.table_name, req.strategy or "MANUAL", req.reason or "Manual request"
        )
        return CheckpointItem(**cp)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Checkpoint creation failed: {str(e)}")

@router.post("/evaluate-adaptive", response_model=PolicyDecisionItem)
def evaluate_adaptive_policy(table_name: str = Query(...)):
    try:
        decision = repository.evaluate_adaptive_policy(table_name)
        return PolicyDecisionItem(**decision)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Policy evaluation failed: {str(e)}")

@router.get("/decisions", response_model=List[PolicyDecisionItem])
def list_policy_decisions(table_name: Optional[str] = Query(None)):
    decs = repository.get_policy_decisions(table_name)
    return [PolicyDecisionItem(**d) for d in decs]
