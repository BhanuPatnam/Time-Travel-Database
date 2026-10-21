#!/usr/bin/env bash
set -e

echo "=== [Time Travel DB] Starting Automated Schema Initialization ==="

# Wait until database is accessible
until echo "SELECT 1 FROM DUAL;" | sqlplus -s tt_admin/tt_secret_123@localhost:1521/XEPDB1 > /dev/null 2>&1; do
    echo "Waiting for Oracle PDB to become available..."
    sleep 3
done

echo "=== [Time Travel DB] Executing run_all.sql deployment ==="
cd /tmp/database
sqlplus -s tt_admin/tt_secret_123@localhost:1521/XEPDB1 @run_all.sql

echo "=== [Time Travel DB] Master Schema and Packages Ready ==="
