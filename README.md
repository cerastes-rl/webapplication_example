# SSScribe — Transcription workspace

SSScribe is a React UI preview for submitting recordings, following simulated progress and reading sample transcripts. It uses navy-blue accents, light/dark themes and a fixed development identity. Preview runs live in browser memory; theme preference persists in localStorage.

## Documentation

- [Project structure](docs/PROJECT_STRUCTURE.md): maintained files, responsibilities and editing guide.
- [Frontend guide](frontend/README.md): controls, scenarios and manual review checklist.
- [Requirements](docs/REQUIREMENTS.md): current coverage and acceptance criteria.
- [Architecture and end-state plan](docs/IMPLEMENTATION_PLAN.md): service boundaries, Azure deployment and architecture diagrams.
- [Local implementation plan](docs/LOCAL_IMPLEMENTATION_PLAN.md): minimal connected delivery slices, contracts, recovery and acceptance checks.
- [API and data flow](docs/API_DATA_FLOW.md): ordered calls, Speech operation names, triggers and schedules.
- [UI research](docs/UI_RESEARCH.md): product references and design rationale.
- [Agent instructions](AGENTS.md): implementation and documentation guidelines.

## Current capabilities

- Persistent SSScribe banner, Upload/History navigation, development user and mock sign-in/out. The preview starts signed in on History.
- MP3/WAV picker with extension and size validation: non-empty files up to **4 GB (4,000,000,000 bytes inclusive)**.
- Requested speakers: Automatic or 1–10. Language: English. Speaker labels and timestamps default on.
- Begin upload creates an in-memory Run ID and navigates to History. Simulated progress continues across internal navigation: uploading → finalizing → queued → processing → completed.
- History includes three completed fixtures and one retriable failure, saved options, status, open/retry/cancel actions and sample transcript details.
- Preview controls for normal, empty, error and loading History states.
- Sign-out hides records, confirms cancellation of active simulated transfers and pauses the remaining simulation. Sign-in resumes it.
- Theme toggle, responsive layout, scrollable History table, labeled controls, skip link, focus styles and reduced-motion support.

Reloading restores the initial runs, navigation, form and mock identity. All completed runs use the shared sample transcript. Browser, keyboard, responsive and accessibility review remains the current acceptance task.

## Run the UI

Use the development container's Node.js/pnpm environment:

```bash
cd frontend
pnpm install                     # first run / dependency changes
pnpm dev --host 0.0.0.0 --port 5173 --strictPort
```

Open **http://localhost:5173**. Check existing VS Code tasks/dev-container startup before launching servers. Vite's `/api` proxy targets `http://localhost:8000` for the connected milestone.

### Checks

```bash
cd frontend
pnpm lint
pnpm build                       # TypeScript check + Vite production build
```

Application interaction tests are a planned acceptance task. Use the [frontend checklist](frontend/README.md#checks) for manual review.

## Run the health API

```bash
cd backend
python -m venv .venv             # first run; reuse an existing venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

- `GET http://localhost:8000/api/health` → `{"status":"OK!"}`.
- FastAPI OpenAPI UI: http://localhost:8000/docs.

The dev container forwards 5173/8000. On container creation, `postCreateCommand` creates/reuses `backend/.venv` and installs `backend/requirements.txt`. Rebuild the container to apply setup changes. After dependency changes, run `backend/.venv/bin/python -m pip install -r backend/requirements.txt` from the repository root.

`.vscode/tasks.json` defines folder-open startup tasks. `.devcontainer/start-dev.sh` checks ports before starting servers and writes logs under `.devcontainer/logs/`. It installs Python requirements when creating a missing venv; update existing environments explicitly. Install frontend dependencies with pnpm.

See the [project structure guide](docs/PROJECT_STRUCTURE.md) for the source tree and editing map.

## Planned connected application

**Approve the UI before backend integration.** Follow the [local implementation plan](docs/LOCAL_IMPLEMENTATION_PLAN.md) for delivery. The connected milestone makes FastAPI/SQLite authoritative for runs, status and transcripts, with actual audio stored by a separate HTTP storage mock. A separate Speech API mock produces deterministic batch results.

FastAPI hosts request handlers and lifespan-managed background loops. SQL stores workflow state, claims, Speech IDs, next-action times, errors and unfinished imports. Loops query due rows, submit jobs, poll Speech, import results and recover interrupted work.

| Responsibility | Connected local milestone | Production service |
|---|---|---|
| React frontend | Vite | Azure Static Web Apps |
| API and background loops | FastAPI/Uvicorn | Azure App Service |
| Authentication | Fixed-user adapter inside FastAPI | Microsoft Entra ID |
| Runs, files, jobs and transcripts | SQLite via SQLAlchemy | Azure SQL Database |
| Audio storage | HTTP storage mock, streamed to disk | Private Azure Blob Storage |
| Batch transcription | HTTP Speech API mock | Azure AI Speech |

The upload flow saves a run/options before transfer, streams audio directly to storage and verifies the stored object before marking the SQL job ready. The shell owns the transfer across internal navigation. Interrupted transfers restart from zero and may require file reselection. Backend jobs continue while backend services run.

Start with one backend process, one Uvicorn worker and one App Service instance. Add SQL-backed leases before scale-out. Enable App Service Always On on a supported plan and resume durable work after restarts. Store readable transcripts as SQLite `TEXT` and Azure SQL `NVARCHAR(MAX)`, with private storage references and Speech IDs in SQL.

**Open decisions:** connected size/duration policy, Speech option mapping, production session/access contracts and cleanup intervals. Local session and upload cancellation contracts are defined in the local implementation plan. The preview's 4 GB limit must be reconciled with Speech batch's documented **1 GB input** and **240-minute diarization** limits. See [Speech planning notes and sources](docs/IMPLEMENTATION_PLAN.md#azure-speech-api-interaction).

Proposed local persistence paths are `backend/data/app.db` and `backend/data/uploads/`. Add Git exclusions for databases, sidecars, audio and partials before generating them. Document service startup, seeds, reset and cleanup commands as those features are delivered.
