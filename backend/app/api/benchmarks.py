from typing import List
from fastapi import APIRouter, HTTPException
from app.services.benchmark_service import benchmark_service
from app.schemas.models import BenchmarkConfigRequest, BenchmarkRunResult

router = APIRouter(prefix="/benchmarks", tags=["Benchmarks"])

@router.post("/run", response_model=BenchmarkRunResult)
def run_benchmark(config: BenchmarkConfigRequest):
    try:
        res = benchmark_service.run_benchmark_suite(
            workload_size=config.workload_size,
            iterations=config.iterations,
            read_write_ratio=config.read_write_ratio,
            strategies=config.include_strategies
        )
        return BenchmarkRunResult(**res)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Benchmark run failed: {str(e)}")

@router.get("/history", response_model=List[BenchmarkRunResult])
def get_benchmark_history():
    runs = benchmark_service.get_past_runs()
    return [BenchmarkRunResult(**r) for r in runs]
