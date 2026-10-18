from fastapi import APIRouter, HTTPException
from app.repositories.oracle_repo import repository
from app.schemas.models import TimelineResponse, TimelineEntry

router = APIRouter(prefix="/timeline", tags=["Version Timeline"])

@router.get("/{table_name}/{record_pk}", response_model=TimelineResponse)
def get_record_timeline(table_name: str, record_pk: str):
    try:
        entries = repository.get_timeline(table_name, record_pk)
        return TimelineResponse(
            table_name=table_name.upper(),
            record_pk=str(record_pk),
            total_versions=len(entries),
            timeline=[TimelineEntry(**e) for e in entries]
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Timeline fetch failed: {str(e)}")
