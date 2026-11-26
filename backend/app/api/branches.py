import logging
from typing import List, Optional, Dict, Any, Union
from fastapi import APIRouter, HTTPException, Query, status

from app.schemas.models import (
    BranchCreateRequest,
    BranchInfo,
    BranchCommitCreateRequest,
    BranchCommitInfo,
    BranchCompareRequest,
    BranchCompareResponse,
    BranchMergeRequest,
    BranchMergeResponse,
    MergeResolveRequest,
    BranchStateResponse
)
from app.repositories.oracle_repo import repository

logger = logging.getLogger("api_branches")
router = APIRouter(prefix="/branches", tags=["Temporal Branching & Merge Engine"])

# =============================================================================
# 1. FIXED PREFIX ENDPOINTS (Listed before dynamic path parameters)
# =============================================================================

@router.get("", response_model=List[BranchInfo], summary="List all active temporal branches")
def list_branches():
    """Returns a list of all active database branches, commit counts, and latest HEAD commit details."""
    try:
        return repository.list_branches()
    except Exception as e:
        logger.error(f"Failed to list branches: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("", response_model=BranchInfo, status_code=status.HTTP_201_CREATED, summary="Create a new temporal branch")
def create_branch(payload: BranchCreateRequest):
    """
    Creates an isolated database branch from:
    - Current main state
    - Specific historical timestamp
    - Another existing branch commit
    """
    try:
        return repository.create_branch(
            branch_name=payload.branch_name,
            parent_branch_name=payload.parent_branch_name or "main",
            base_timestamp=payload.base_timestamp,
            base_commit_id=payload.base_commit_id,
            created_by=payload.created_by or "developer",
            description=payload.description
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to create branch: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/compare", response_model=BranchCompareResponse, summary="Compare two branches")
def compare_branches(payload: BranchCompareRequest):
    """
    Computes fine-grained differences between base_branch and compare_branch.
    Returns added, modified, and deleted records along with column-level deltas.
    """
    try:
        return repository.compare_branches(payload.base_branch, payload.compare_branch)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to compare branches: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/merge", response_model=BranchMergeResponse, summary="Execute or evaluate a branch merge")
def merge_branches(payload: BranchMergeRequest):
    """
    Executes a three-way merge or fast-forward merge from source_branch into target_branch.
    If conflicts are detected, returns conflict details and creates a pending merge record.
    If resolved_conflicts are supplied, applies resolutions and creates the merge commit.
    """
    try:
        return repository.merge_branches(
            source_branch=payload.source_branch,
            target_branch=payload.target_branch or "main",
            merge_message=payload.merge_message,
            author=payload.author or "developer",
            resolution_strategy=payload.resolution_strategy or "AUTO",
            resolved_conflicts=payload.resolved_conflicts
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to merge branches: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/merge/{merge_id}/resolve", response_model=BranchMergeResponse, summary="Resolve conflicts for a pending merge")
def resolve_merge_conflict(merge_id: int, payload: MergeResolveRequest):
    """Submits manual conflict resolutions for a pending conflicted merge operation."""
    try:
        return repository.resolve_merge_conflict(
            merge_id=merge_id,
            resolutions=payload.resolutions,
            author=payload.author or "developer"
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to resolve merge {merge_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/merge/{merge_id}/abort", summary="Abort a conflicted or pending merge")
def abort_merge(merge_id: int):
    """Aborts a pending merge and removes unmerged transaction state."""
    try:
        return repository.abort_merge(merge_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to abort merge {merge_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# =============================================================================
# 2. DYNAMIC PATH-PARAMETER ENDPOINTS ({branch_id:path})
# =============================================================================

@router.post("/{branch_id:path}/commits", response_model=Dict[str, Any], status_code=status.HTTP_201_CREATED, summary="Record a branch-specific commit")
def create_branch_commit(branch_id: str, payload: BranchCommitCreateRequest):
    """
    Records an immutable, isolated commit on the branch without touching the main database.
    Accepts changesets with INSERT, UPDATE, or DELETE operations across business entities.
    """
    try:
        return repository.create_branch_commit(
            branch_id_or_name=branch_id,
            commit_message=payload.commit_message,
            author=payload.author or "developer",
            changes=payload.changes,
            parent_commit_id=payload.parent_commit_id,
            commit_type=payload.commit_type or "NORMAL",
            merge_parent_commit_id=payload.merge_parent_commit_id
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to create branch commit on {branch_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{branch_id:path}/commits", response_model=List[BranchCommitInfo], summary="Get commit history for a branch")
def get_branch_commits(branch_id: str):
    """Returns the immutable chronological commit history for a branch."""
    try:
        return repository.get_branch_commits(branch_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to get commits for branch {branch_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{branch_id:path}/state", response_model=BranchStateResponse, summary="Get effective active table records on branch")
def get_branch_state(
    branch_id: str,
    table_name: str = Query(default="__ALL__", description="Target table or __ALL__"),
    commit_id: Optional[str] = Query(default=None, description="Optional commit ID to inspect historical branch state")
):
    """Reconstructs the effective branch database state by replaying branch changesets on top of the base state."""
    try:
        return repository.get_branch_state(branch_id, table_name, commit_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to get state for branch {branch_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{branch_id:path}/timeline", summary="Get visual SVG commit graph data for branch and its parents")
def get_branch_timeline(branch_id: str):
    """Generates lanes, nodes, and parent/merge links for rendering an interactive GitHub-style commit graph."""
    try:
        return repository.get_branch_timeline(branch_id)
    except Exception as e:
        logger.error(f"Failed to get timeline for branch {branch_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{branch_id:path}/revert/{target_commit_id}", response_model=Dict[str, Any], summary="Revert branch state back to an earlier commit")
def revert_branch_to_commit(
    branch_id: str,
    target_commit_id: str,
    author: str = Query(default="developer")
):
    """Non-destructively reverts a branch's database state back to target_commit_id via a new commit."""
    try:
        return repository.revert_branch_to_commit(branch_id, target_commit_id, author=author)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to revert branch {branch_id} to {target_commit_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{branch_id:path}", response_model=BranchInfo, summary="Get details for a specific branch")
def get_branch(branch_id: str):
    """Fetches metadata, origin base, and HEAD commit for a branch."""
    try:
        return repository.get_branch(branch_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to get branch {branch_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{branch_id:path}", summary="Delete / deactivate a temporal branch")
def delete_branch(branch_id: str):
    """Safely deactivates a branch. The default 'main' branch cannot be deleted."""
    try:
        return repository.delete_branch(branch_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to delete branch {branch_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
