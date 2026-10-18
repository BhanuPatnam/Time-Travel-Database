import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from project root if present
root_dir = Path(__file__).resolve().parent.parent.parent.parent
load_dotenv(root_dir / ".env")

class Settings:
    PROJECT_NAME: str = "Time Travel Database System"
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"

    # Oracle Settings
    ORACLE_USER: str = os.getenv("ORACLE_USER", "tt_admin")
    ORACLE_PASSWORD: str = os.getenv("ORACLE_PASSWORD", "tt_secret_123")
    ORACLE_DSN: str = os.getenv("ORACLE_DSN", "localhost:1521/XEPDB1")
    ORACLE_WALLET_LOCATION: str = os.getenv("ORACLE_WALLET_LOCATION", "")
    ORACLE_WALLET_PASSWORD: str = os.getenv("ORACLE_WALLET_PASSWORD", "")

    # Server Settings
    APP_HOST: str = os.getenv("APP_HOST", "0.0.0.0")
    APP_PORT: int = int(os.getenv("APP_PORT", "8000"))
    CORS_ORIGINS: list[str] = [
        origin.strip() 
        for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173").split(",")
    ]

    # Adaptive Policy Defaults
    CHECKPOINT_DEFAULT_STRATEGY: str = os.getenv("CHECKPOINT_DEFAULT_STRATEGY", "ADAPTIVE")
    ADAPTIVE_CHANGE_THRESHOLD: int = int(os.getenv("ADAPTIVE_CHANGE_THRESHOLD", "25"))
    ADAPTIVE_REPLAY_COST_THRESHOLD_MS: float = float(os.getenv("ADAPTIVE_REPLAY_COST_THRESHOLD_MS", "12.0"))
    ADAPTIVE_QUERY_FREQ_THRESHOLD: int = int(os.getenv("ADAPTIVE_QUERY_FREQ_THRESHOLD", "3"))
    STORAGE_BUDGET_MB: float = float(os.getenv("STORAGE_BUDGET_MB", "250"))
    FIXED_INTERVAL_CHANGES: int = int(os.getenv("FIXED_INTERVAL_CHANGES", "50"))
    ENABLE_DELTA_ENCODING: bool = os.getenv("ENABLE_DELTA_ENCODING", "Y").upper() == "Y"

    # Supported tables allowlist (strict security against SQL injection)
    SUPPORTED_TABLES: set[str] = {"CUSTOMERS", "PRODUCTS", "ORDERS", "ORDER_ITEMS"}

settings = Settings()
