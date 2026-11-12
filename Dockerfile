FROM node:24-trixie-slim AS node

FROM python:3.15-slim-trixie

COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules/ /usr/local/lib/node_modules/
RUN ln -s ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
    && ln -s ../lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx \
    && npm install --global pnpm@12.18.0 \
    && pnpm --version

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1
WORKDIR /app
COPY backend/requirements.txt backend/requirements.txt
RUN python -m pip install --no-cache-dir -r backend/requirements.txt
COPY frontend/package.json frontend/pnpm-lock.yaml frontend/
RUN cd frontend && pnpm install --frozen-lockfile
COPY backend/ backend/
COPY services/ services/
COPY frontend/ frontend/

EXPOSE 5173 8000 8001 8002
SHELL ["/bin/bash", "-c"]
CMD set -e; \
    python backend/src/database.py; \
    pids=(); \
    shutdown() { \
      trap - EXIT; \
      kill -TERM "${pids[@]}" 2>/dev/null || true; \
      wait "${pids[@]}" 2>/dev/null || true; \
    }; \
    trap shutdown EXIT; \
    trap 'exit 0' TERM INT; \
    python -m uvicorn services.storage_mock:app --host 0.0.0.0 --port 8001 & pids+=($!); \
    python -m uvicorn services.speech_mock:app --host 0.0.0.0 --port 8002 & pids+=($!); \
    python -m uvicorn main:app --app-dir backend --host 0.0.0.0 --port 8000 & pids+=($!); \
    node frontend/node_modules/vite/bin/vite.js --config frontend/vite.config.ts --host 0.0.0.0 --port 5173 --strictPort frontend & pids+=($!); \
    wait -n "${pids[@]}"
