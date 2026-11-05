from datetime import datetime
from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel, Field

# 1. Health & Status
class HealthResponse(BaseModel):
    status: str
    database_connected: bool
    database_type: str
    oracle_dsn: Optional[str] = None
    server_time: str
    version: str

# 2. Table & Record Schemas
class TableInfo(BaseModel):
    name: str
    table_name: Optional[str] = None
    row_count: int
    history_count: int
    columns: List[Dict[str, str]]
    primary_key: str

class RecordData(BaseModel):
    table_name: str
    primary_key: str
    data: Dict[str, Any]

# 3. Time Travel Reconstruction
class TimeTravelRowRequest(BaseModel):
    table_name: str
    record_pk: str
    target_timestamp: str  # ISO-8601
    strategy: Optional[str] = "ADAPTIVE"  # LOG_ONLY, FIXED_INTERVAL, ADAPTIVE

class TimeTravelRowResponse(BaseModel):
    table_name: str
    record_pk: str
    target_timestamp: str
    strategy_used: str
    checkpoint_id_used: Optional[int] = None
    changes_replayed: int
    execution_time_ms: float
    row_state: Optional[Dict[str, Any]] = None
    reconstructed_at: str

class TimeTravelTableRequest(BaseModel):
    table_name: str
    target_timestamp: str
    strategy: Optional[str] = "ADAPTIVE"

class TimeTravelTableResponse(BaseModel):
    table_name: str
    target_timestamp: str
    strategy_used: str
    checkpoint_id_used: Optional[int] = None
    changes_replayed: int
    execution_time_ms: float
    total_active_rows: int
    rows: List[Dict[str, Any]]
    change_markers: Dict[str, Dict[str, Any]] = Field(default_factory=dict)

# 4. Version Timeline
class TimelineEntry(BaseModel):
    change_id: int
    tx_id: Optional[int] = None
    operation_type: str
    changed_columns: Optional[str] = None
    change_timestamp: Union[datetime, str]
    commit_order_seq: int
    old_values: Optional[Dict[str, Any]] = None
    new_values: Optional[Dict[str, Any]] = None
    delta_values: Optional[Dict[str, Any]] = None

class TimelineResponse(BaseModel):
    table_name: str
    record_pk: str
    total_versions: int
    timeline: List[TimelineEntry]

# 5. Historical Diff
class DiffRequest(BaseModel):
    table_name: str
    timestamp_1: str
    timestamp_2: str

class DiffChangeItem(BaseModel):
    record_pk: str
    operation_type: str
    changed_columns: Optional[str] = None
    change_timestamp: Union[datetime, str]
    old_values: Optional[Dict[str, Any]] = None
    new_values: Optional[Dict[str, Any]] = None

class DiffResponse(BaseModel):
    table_name: str
    timestamp_1: str
    timestamp_2: str
    added_count: int
    deleted_count: int
    modified_count: int
    changes: List[DiffChangeItem]

# 6. Checkpoint Engine
class CheckpointItem(BaseModel):
    checkpoint_id: int
    checkpoint_name: str
    table_name: str
    target_boundary_ts: Union[datetime, str]
    strategy_used: str
    status: str
    row_count: int
    storage_bytes: int
    creation_duration_ms: float
    decision_reason: Optional[str] = None
    created_at: Union[datetime, str]

class CreateCheckpointRequest(BaseModel):
    table_name: str
    strategy: Optional[str] = "MANUAL"
    reason: Optional[str] = "Manual request from Dashboard"

class PolicyDecisionItem(BaseModel):
    decision_id: int
    evaluated_at: Union[datetime, str]
    table_name: str
    changes_since_last_cp: int
    estimated_replay_cost_ms: float
    historical_query_freq: int
    storage_used_mb: float
    storage_budget_mb: float
    action_taken: str
    decision_reason: str
    checkpoint_id: Optional[int] = None

# 7. Restoration Engine
class RestorePreviewRequest(BaseModel):
    table_name: str
    record_pk: str
    target_timestamp: str

class RestorePreviewResponse(BaseModel):
    table_name: str
    record_pk: str
    target_timestamp: str
    proposed_action: str
    constraint_warning: str
    can_restore: bool
    historical_state: Optional[Dict[str, Any]] = None
    current_state: Optional[Dict[str, Any]] = None

class RestoreExecuteRequest(BaseModel):
    table_name: str
    record_pk: str
    target_timestamp: str
    user_note: Optional[str] = "Restoration triggered from Dashboard"
    confirm_action: bool

class RestoreExecuteResponse(BaseModel):
    status: str
    table_name: str
    record_pk: str
    tx_id: Optional[int] = None
    message: str
    note: Optional[str] = None

# 8. Benchmarks
class BenchmarkConfigRequest(BaseModel):
    workload_size: str = Field(default="MEDIUM", description="SMALL, MEDIUM, LARGE")
    iterations: int = Field(default=30, ge=5, le=500)
    read_write_ratio: float = Field(default=0.7, ge=0.1, le=0.9)
    include_strategies: List[str] = Field(default=["LOG_ONLY", "FIXED_INTERVAL", "ADAPTIVE"])

class BenchmarkStrategyMetrics(BaseModel):
    strategy: str
    avg_reconstruction_latency_ms: float
    p95_reconstruction_latency_ms: float
    avg_changes_replayed: float
    history_storage_bytes: int
    checkpoint_storage_bytes: int
    write_throughput_tps: float
    checkpoint_overhead_ms: float
    correctness_rate: float

class BenchmarkRunResult(BaseModel):
    run_id: str
    workload_size: str
    timestamp: str
    comparisons: List[BenchmarkStrategyMetrics]
    recommendation: str

# 9. Storage Statistics & System Config
class StorageStatsResponse(BaseModel):
    current_data_bytes: int
    history_log_bytes: int
    checkpoint_bytes: int
    total_bytes: int
    total_changes: int
    total_checkpoints: int
    budget_mb: float
    usage_percentage: float

class ConfigUpdate(BaseModel):
    param_key: str
    param_value: str

# 10. Temporal Branching & Merge System
class BranchCreateRequest(BaseModel):
    branch_name: str
    parent_branch_name: Optional[str] = "main"
    base_timestamp: Optional[str] = None
    base_commit_id: Optional[str] = None
    description: Optional[str] = None
    created_by: Optional[str] = "developer"

class BranchInfo(BaseModel):
    branch_id: int
    branch_name: str
    parent_branch_id: Optional[int] = None
    parent_name: Optional[str] = None
    base_commit_id: Optional[str] = None
    base_timestamp: str
    created_at: str
    created_by: str
    branch_status: str
    is_default: str
    description: Optional[str] = None
    commit_count: int = 0
    head_commit_id: Optional[str] = None
    head_commit_message: Optional[str] = None

class BranchCommitCreateRequest(BaseModel):
    commit_message: str
    author: Optional[str] = "developer"
    changes: List[Dict[str, Any]] = Field(default_factory=list)
    parent_commit_id: Optional[str] = None
    commit_type: Optional[str] = "NORMAL"
    merge_parent_commit_id: Optional[str] = None

class BranchCommitInfo(BaseModel):
    commit_id: str
    branch_id: int
    parent_commit_id: Optional[str] = None
    commit_message: str
    commit_timestamp: str
    commit_order_seq: int
    author: str
    commit_type: str
    merge_parent_commit_id: Optional[str] = None
    changeset_count: int = 0
    changes: Optional[List[Dict[str, Any]]] = None

class BranchCompareRequest(BaseModel):
    base_branch: str = "main"
    compare_branch: str

class BranchCompareResponse(BaseModel):
    base_branch: str
    compare_branch: str
    merge_base_commit: Optional[str] = None
    total_changes: int
    added_count: int
    modified_count: int
    deleted_count: int
    changes: List[Dict[str, Any]]

class BranchMergeRequest(BaseModel):
    source_branch: str
    target_branch: str = "main"
    merge_message: Optional[str] = None
    author: Optional[str] = "developer"
    resolution_strategy: Optional[str] = "AUTO"
    resolved_conflicts: Optional[List[Dict[str, Any]]] = None

class BranchMergeResponse(BaseModel):
    status: str  # SUCCESS, CONFLICT, FAST_FORWARD, ABORTED
    merge_type: Optional[str] = None
    merge_id: int
    merge_commit_id: Optional[str] = None
    conflicts_count: int = 0
    conflicts: Optional[List[Dict[str, Any]]] = None
    message: str

class MergeResolveRequest(BaseModel):
    resolutions: List[Dict[str, Any]]
    author: Optional[str] = "developer"

class BranchStateResponse(BaseModel):
    branch_id: int
    branch_name: Optional[str] = None
    commit_id: Optional[str] = None
    table_name: str
    total_records: int
    records: List[Dict[str, Any]]

