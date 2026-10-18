import logging
from typing import Optional, Any
import oracledb
from app.core.config import settings

logger = logging.getLogger("tt_database")

class DatabaseManager:
    _connection: Optional[Any] = None
    _is_oracle: bool = False
    _last_error: Optional[str] = None

    @classmethod
    def initialize(cls):
        """Attempts connection to Oracle Database 21c XE using python-oracledb Thin Mode."""
        try:
            logger.info(f"Connecting to Oracle Database at {settings.ORACLE_DSN} as {settings.ORACLE_USER}...")
            # oracledb thin mode does not require Oracle Instant Client
            conn = oracledb.connect(
                user=settings.ORACLE_USER,
                password=settings.ORACLE_PASSWORD,
                dsn=settings.ORACLE_DSN
            )
            with conn.cursor() as cursor:
                cursor.execute("SELECT banner FROM v$version WHERE ROWNUM = 1")
                row = cursor.fetchone()
                banner = row[0] if row else "Oracle Database"
                logger.info(f"Connected successfully to: {banner}")

            cls._connection = conn
            cls._is_oracle = True
            cls._last_error = None
        except Exception as e:
            cls._connection = None
            cls._is_oracle = False
            cls._last_error = str(e)
            logger.warning(
                f"Oracle Database connection unavailable ({e}). "
                "Engaging high-fidelity Oracle PL/SQL Engine Emulator for local development and testing."
            )

    @classmethod
    def get_connection(cls):
        if cls._is_oracle and cls._connection:
            try:
                # Ping check
                cls._connection.ping()
                return cls._connection
            except Exception:
                cls.initialize()
                return cls._connection
        return None

    @classmethod
    def is_connected(cls) -> bool:
        return cls._is_oracle and cls._connection is not None

    @classmethod
    def get_status(cls) -> dict:
        return {
            "connected": cls.is_connected(),
            "type": "Oracle Database 21c XE" if cls.is_connected() else "High-Fidelity Oracle PL/SQL Engine Emulator",
            "dsn": settings.ORACLE_DSN,
            "user": settings.ORACLE_USER,
            "last_error": cls._last_error
        }

db_manager = DatabaseManager
