
#!/usr/bin/env bash

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOGS="$ROOT/.devcontainer/logs"

mkdir -p "$LOGS"

# Start React + Vite
if ! curl -fsS http://localhost:5173/ >/dev/null 2>&1; then
    cd "$ROOT/frontend"
    nohup pnpm dev --host 0.0.0.0 --port 5173 --strictPort \
        > "$LOGS/vite.log" 2>&1 < /dev/null &
    echo "Started Vite"
fi

# Start Python + FastAPI
if ! curl -fsS http://localhost:8000/api/health >/dev/null 2>&1; then
    cd "$ROOT/backend"

    # Ensure the virtual environment exists
    if [ ! -x ".venv/bin/python" ]; then
        echo "Creating Python virtual environment..."
        python -m venv .venv
        .venv/bin/python -m pip install -r requirements.txt
    fi

    nohup .venv/bin/python -m uvicorn main:app \
        --reload --host 0.0.0.0 --port 8000 \
        > "$LOGS/uvicorn.log" 2>&1 < /dev/null &

    echo "Started Uvicorn"
fi
