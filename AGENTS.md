
# AGENTS.md — Transcription Application

## Objective

Build a **working local mock** of an authenticated speech-to-text web application. Prioritize a usable React UI and realistic end-to-end API contracts over real cloud integrations or transcription accuracy. This is a prototype, **not** a production deployment.

## Existing project

- `frontend/`: React + TypeScript + Vite; use **pnpm** and the project's existing **Oxlint** configuration.
- `backend/`: Python + FastAPI + Uvicorn; use the existing Python virtual environment and `requirements.txt` workflow.
- `.devcontainer/`: VS Code development container with Python and Node.js.
- React can already reach FastAPI through Vite's `/api` proxy. Preserve this setup.
- The project is tracked in a private Git repository.

Inspect the repository before changing files. Reuse established conventions and avoid replacing working setup or adding a separate JavaScript server.

## Target prototype

1. **File dashboard:** list uploaded recordings, dates, size, and status (`queued`, `processing`, `completed`, `failed`).
2. **Upload interface:** choose a local audio file and show a realistic upload/queued workflow.
3. **Transcript view:** select a completed file to read a formatted transcript. For an incomplete file, show its status.
4. **Job simulation:** queued jobs progress to completed or failed; allow retry of failures. Use deterministic sample transcripts rather than running speech recognition.
5. **Mock sign-in:** show a development user and sign-in/sign-out flow without integrating real Microsoft Entra ID.
6. **UX states:** loading, empty list, errors, retry, and responsive layout.

## Architecture and mock boundaries

Preserve the eventual Azure-oriented architecture, but replace external calls with local implementations:

| Production responsibility | Local prototype implementation |
|---|---|
| Microsoft Entra ID authentication | Mock auth provider / fixed development identity |
| Azure SQL Database or SQL Server | **SQLite** through SQLAlchemy; real local persistence |
| Azure Blob Storage | Local file storage adapter, or in-memory/mock storage for UI tests |
| Azure Queue Storage | Local job queue adapter; persisted job records in SQLite |
| Python transcription worker / external speech engine | Fake transcription adapter producing sample results |
| Azure App Service | Locally running FastAPI via Uvicorn |
| Azure Static Web Apps | Locally running React via Vite |

**Important:** keep API endpoints, JSON responses, service method names, and job lifecycle realistic. Mock the external service implementations behind clearly named interfaces/adapters. Do not add Azure credentials, request live cloud resources, or call real speech APIs.

The browser should communicate with **FastAPI**, not directly with SQLite or ad hoc mock JSON inside React. The backend should be authoritative for file records, statuses, and transcripts. For the prototype, uploading a file may use a multipart FastAPI endpoint; retain an abstraction for a future direct-to-Blob upload authorization/confirmation flow. Do not pretend a local upload URL is an actual Azure SAS token.

## Suggested API contract

Maintain endpoints consistent with eventual production needs, with additional local-only endpoints when useful:

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/health` | Backend health |
| `GET` | `/api/files` | List files and statuses |
| `GET` | `/api/files/{file_id}` | File metadata and job state |
| `GET` | `/api/files/{file_id}/transcript` | Completed transcript |
| `POST` | `/api/uploads/authorize` | Mock upload authorization (production-shaped response) |
| `POST` | `/api/uploads/complete` | Confirm a stored upload and enqueue job |
| `POST` | `/api/files/{file_id}/retry` | Retry failed job |

For a working local browser upload, add a clearly identified **development upload endpoint** if necessary, or supply a local mock storage URL and implement it properly. Avoid stubs that claim to upload data but silently discard it. Use Pydantic response models, stable IDs, appropriate HTTP status codes, and predictable errors.

## Data model

Use SQLite (e.g., `backend/data/app.db`, ignored by Git) via SQLAlchemy. Start with minimal tables:

- `files`: id, filename, content type, size, local object path, uploader, created timestamp.
- `jobs`: id, file id, status, attempts, timestamps, error message.
- `transcripts`: id, file id or job id, text, optional original mock JSON, created timestamp.

Seed a **small, deterministic** dataset for a first-run demonstration; avoid reseeding duplicates. A local uploaded file should persist between backend restarts. Keep schema migration complexity proportional to a prototype.

## UI guidelines

Use React + TypeScript with a clean, accessible interface. Favor simple component separation (dashboard, upload, status, transcript details). Use existing project dependencies and styling first; do not introduce a large UI/state framework unless needed. Keep all backend calls in a small typed API client, rather than embedding mock file lists in components. Poll job status conservatively while jobs are active, and stop polling when unnecessary.

## Implementation constraints

- Keep dependencies minimal; use **pnpm** for frontend commands and Python venv/pip for backend commands already established in the repo.
- Do not install Express, Node backend services, Docker orchestration, Redis, Celery, or real Azure integrations for this prototype.
- No real audio transcription, OAuth, real SAS credentials, or production authentication is required.
- Avoid blocking HTTP requests for simulated transcription; represent jobs as asynchronous and persist their status. A lightweight local background task or periodic job runner is sufficient, with clear limitations documented.
- Never commit `.venv/`, `node_modules/`, local SQLite DBs, uploaded audio, `.env` secrets, or generated build files.
- Maintain the existing Vite-to-FastAPI `/api` proxy and use the dev container's forwarded ports (5173 frontend, 8000 backend).
- Do not break current functionality; add targeted tests for API behavior, job state transitions, and core UI interactions where practical.

## Definition of done

A developer can start the Vite and FastAPI servers and, entirely locally, sign in as a mock user, see example files, upload a file, observe its queued/processing/completed state, open a transcript, and retry a failed job. Reloading the page preserves records in SQLite. No Azure account or API credentials are required. Document startup commands, mock behavior, limitations, and future Azure replacement points in `README.md`.
