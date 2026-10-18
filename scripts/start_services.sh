#!/usr/bin/env bash
# Quickstart script to launch FastAPI Backend and React Frontend
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"
cd "$DIR"

echo "=========================================================="
echo " Starting Time Travel Database Application"
echo "=========================================================="

# Activate virtualenv if present
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# Start FastAPI Backend in background
echo "[1/2] Starting FastAPI backend on http://localhost:8000..."
PYTHONPATH=backend python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

trap "echo 'Stopping services...'; kill $BACKEND_PID; exit 0" INT TERM EXIT

sleep 2

# Start Vite Frontend
echo "[2/2] Starting Vite frontend on http://localhost:5173..."
cd frontend
npm run dev
