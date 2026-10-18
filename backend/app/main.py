import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import db_manager
from app.api import (
    health, tables, time_travel, timeline,
    diff, checkpoints, restore, benchmarks, settings as app_settings
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("timetravel_db")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing Time Travel Database Backend...")
    db_manager.initialize()
    yield
    logger.info("Shutting down Time Travel Database Backend...")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description=(
        "Workload-Aware Historical Data Reconstruction System Using Adaptive Checkpointing. "
        "Built on Oracle Database 21c XE, Python FastAPI, and React."
    ),
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount all API routers
app.include_router(health.router, prefix=settings.API_PREFIX)
app.include_router(tables.router, prefix=settings.API_PREFIX)
app.include_router(time_travel.router, prefix=settings.API_PREFIX)
app.include_router(timeline.router, prefix=settings.API_PREFIX)
app.include_router(diff.router, prefix=settings.API_PREFIX)
app.include_router(checkpoints.router, prefix=settings.API_PREFIX)
app.include_router(restore.router, prefix=settings.API_PREFIX)
app.include_router(benchmarks.router, prefix=settings.API_PREFIX)
app.include_router(app_settings.router, prefix=settings.API_PREFIX)

@app.get("/")
def root():
    return {
        "message": "Time Travel Database API Engine",
        "docs": "/docs",
        "health": f"{settings.API_PREFIX}/health",
        "version": settings.VERSION
    }
