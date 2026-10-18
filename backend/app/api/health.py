from datetime import datetime, timezone
from fastapi import APIRouter
from app.core.config import settings
from app.core.database import db_manager
from app.schemas.models import HealthResponse

router = APIRouter(tags=["Health"])

@router.get("/health", response_model=HealthResponse)
def get_health():
    db_status = db_manager.get_status()
    return HealthResponse(
        status="healthy",
        database_connected=db_status["connected"],
        database_type=db_status["type"],
        oracle_dsn=db_status["dsn"],
        server_time=datetime.now(timezone.utc).isoformat(),
        version=settings.VERSION
    )

@router.get("/status")
def get_detailed_status():
    return db_manager.get_status()
