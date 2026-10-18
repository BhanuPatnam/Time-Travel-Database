from typing import Dict
from fastapi import APIRouter
from app.repositories.oracle_repo import repository
from app.schemas.models import StorageStatsResponse, ConfigUpdate

router = APIRouter(tags=["Settings & Storage"])

@router.get("/settings", response_model=Dict[str, str])
def get_settings():
    return repository.get_configs()

@router.post("/settings")
def update_setting(update: ConfigUpdate):
    repository.update_config(update.param_key, update.param_value)
    return {"status": "SUCCESS", "param_key": update.param_key, "param_value": update.param_value}

@router.get("/storage/stats", response_model=StorageStatsResponse)
def get_storage_stats():
    data = repository.get_storage_stats()
    return StorageStatsResponse(**data)
