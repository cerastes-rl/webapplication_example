
#!/usr/bin/env bash

set -x

echo "Startup script executed"
echo "Current directory: $(pwd)"
echo "Current user: $(whoami)"
echo "Node location: $(command -v node)"
echo "pnpm location: $(command -v pnpm)"
echo "Python location: $(command -v python)"

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

# Both Python services share the backend virtual environment.
cd "$ROOT/backend"
if [ ! -x ".venv/bin/python" ]; then
    echo "Creating Python virtual environment..."
    python -m venv .venv
    .venv/bin/python -m pip install -r requirements.txt
fi

# Start Python + FastAPI
if ! curl -fsS http://localhost:8000/api/health >/dev/null 2>&1; then

    nohup .venv/bin/python -m uvicorn main:app \
        --reload --host 0.0.0.0 --port 8000 \
        > "$LOGS/uvicorn.log" 2>&1 < /dev/null &

    echo "Started Uvicorn"
fi

# Start the standalone Speech mock (one worker, without reload).
if ! curl -fsS http://localhost:8002/openapi.json >/dev/null 2>&1; then
    nohup .venv/bin/python -m uvicorn services.speech_mock:app \
        --host 0.0.0.0 --port 8002 \
        > "$LOGS/speech-mock.log" 2>&1 < /dev/null &

    echo "Started Speech mock"
fi
