#!/usr/bin/env python3
"""
Database Migration and Setup Runner for Oracle Database 21c XE
Project: Time Travel Database System
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Load environment
root_dir = Path(__file__).resolve().parent.parent
load_dotenv(root_dir / ".env")

import oracledb

ORACLE_USER = os.getenv("ORACLE_USER", "tt_admin")
ORACLE_PASSWORD = os.getenv("ORACLE_PASSWORD", "tt_secret_123")
ORACLE_DSN = os.getenv("ORACLE_DSN", "localhost:1521/XEPDB1")

# Exact dependency compilation order:
# Packages (TT_CORE_PKG) must compile before Triggers that call them.
SQL_SCRIPTS = [
    "01_create_schema.sql",
    "02_create_history_tables.sql",
    "03_create_sequences.sql",
    "05_create_packages.sql",               # TT_CORE_PKG (Required by triggers)
    "04_create_triggers.sql",               # Change capture triggers
    "06_create_checkpoint_engine.sql",      # Checkpoint tables
    "06_create_checkpoint_pkg.sql",         # TT_CHECKPOINT_PKG
    "07_create_reconstruction_engine.sql",  # TT_RECONSTRUCTION_PKG
    "08_create_diff_and_restore.sql",       # TT_DIFF_RESTORE_PKG
    "09_seed_data.sql",                     # Seed and initial baseline checkpoints
    "10_create_benchmark_objects.sql",      # Benchmark results schema
    "14_run_benchmarks.sql",                # TT_BENCHMARK_PKG (Pure PL/SQL benchmark suite)
    "15_create_branching_tables.sql",       # Temporal branching schema tables
    "16_create_branch_pkg.sql",             # TT_BRANCH_PKG Temporal branching & merge engine
    "11_verify_installation.sql",           # Verification script
]

def run_migrations():
    print(f"Connecting to Oracle at {ORACLE_DSN} as {ORACLE_USER}...")
    try:
        conn = oracledb.connect(
            user=ORACLE_USER,
            password=ORACLE_PASSWORD,
            dsn=ORACLE_DSN
        )
        print("Connected successfully!")
    except Exception as e:
        print(f"ERROR: Could not connect to Oracle database: {e}")
        print("Ensure Oracle Database 21c XE is running or start it via docker-compose:")
        print("  docker compose up -d oracle-db")
        return False

    db_dir = root_dir / "database"

    for script_name in SQL_SCRIPTS:
        script_path = db_dir / script_name
        if not script_path.exists():
            print(f"Warning: {script_name} not found in {db_dir}")
            continue

        print(f"\n---> Executing {script_name}...")
        with open(script_path, "r", encoding="utf-8") as f:
            content = f.read()

        # Split into blocks separated by '/' on individual lines
        blocks = []
        current = []
        for line in content.splitlines():
            if line.strip() == "/":
                if current:
                    blocks.append("\n".join(current))
                    current = []
            else:
                current.append(line)
        if current:
            blocks.append("\n".join(current))

        with conn.cursor() as cursor:
            for idx, block in enumerate(blocks, 1):
                clean_block = block.strip()
                if not clean_block or (clean_block.startswith("--") and len(clean_block.splitlines()) == 1):
                    continue
                try:
                    cursor.execute(clean_block)
                except Exception as ex:
                    print(f"  [Block {idx}] Error: {ex}")

        conn.commit()
        print(f"  [DONE] {script_name}")

    conn.close()
    print("\nAll database migration scripts finished successfully!")
    return True

if __name__ == "__main__":
    success = run_migrations()
    sys.exit(0 if success else 1)
