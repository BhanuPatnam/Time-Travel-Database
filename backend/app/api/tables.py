from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Query, Body
from app.repositories.oracle_repo import repository
from app.schemas.models import TableInfo

router = APIRouter(prefix="/tables", tags=["Current Data & DML"])

@router.get("", response_model=List[TableInfo])
def list_tables():
    return repository.get_tables_overview()

@router.get("/{table_name}/records")
def get_table_records(table_name: str, search: Optional[str] = Query(None)):
    try:
        return repository.get_table_records(table_name, search=search)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{table_name}/records/{record_pk}")
def get_record(table_name: str, record_pk: str):
    try:
        rec = repository.get_record(table_name, record_pk)
        if not rec:
            raise HTTPException(status_code=404, detail=f"Record {record_pk} not found in {table_name}")
        return rec
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{table_name}/records")
def create_record(table_name: str, data: Dict[str, Any] = Body(...)):
    """Inserts a new record into the specified table with atomic change capture."""
    try:
        res = repository.insert_record(table_name, data)
        return res
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to insert record: {str(e)}")

@router.put("/{table_name}/records/{record_pk}")
def update_record(table_name: str, record_pk: str, data: Dict[str, Any] = Body(...)):
    """Updates an existing record in the specified table with atomic delta capture."""
    try:
        res = repository.update_record(table_name, record_pk, data)
        return res
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update record: {str(e)}")

@router.delete("/{table_name}/records/{record_pk}")
def delete_record(table_name: str, record_pk: str):
    """Deletes a record from the specified table with atomic delete audit capture."""
    try:
        res = repository.delete_record(table_name, record_pk)
        return res
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete record: {str(e)}")
