# SSScribe — Transcription workspace

SSScribe is a React UI preview for submitting recordings, following simulated progress and reading sample transcripts. It uses navy-blue accents, light/dark themes and local Austin/John authentication. Preview runs live in browser memory; theme preference persists in localStorage.

## Documentation

- [Project structure](docs/PROJECT_STRUCTURE.md): maintained files, responsibilities and editing guide.
- [Frontend guide](frontend/README.md): controls, scenarios, manual review and the [source layout](frontend/README.md#source-layout).
- [Requirements](docs/REQUIREMENTS.md): current coverage and acceptance criteria.
- [Architecture and end-state plan](docs/IMPLEMENTATION_PLAN.md): service boundaries, Azure deployment and architecture diagrams.
- [Local implementation plan](docs/LOCAL_IMPLEMENTATION_PLAN.md): minimal connected delivery slices, contracts, recovery and acceptance checks.
- [API and data flow](docs/API_DATA_FLOW.md): ordered calls, Speech operation names, triggers and schedules.
- [UI research](docs/UI_RESEARCH.md): product references and design rationale.
- [Agent instructions](AGENTS.md): implementation and documentation guidelines.

## Current capabilities

- Persistent SSScribe banner, Upload/History navigation and backend sign-in/out. Enter `austin` or `john` as the access key; existing sessions are restored on load.
- MP3/WAV picker with extension and size validation: non-empty files up to **4 GB (4,000,000,000 bytes inclusive)**.
- Requested speakers: Automatic or 1–10. Language: English. Speaker labels and timestamps default on.
- Begin upload creates an in-memory Run ID and navigates to History. Simulated progress continues across internal navigation: uploading → finalizing → queued → processing → completed.
- History includes three completed fixtures and one retriable failure, saved options, status, open/retry/cancel actions and sample transcript details.
- Preview controls for normal, empty, error and loading History states.
- Sign-out confirms cancellation of active simulated transfers, revokes the backend session and clears the preview workspace. Each sign-in starts fresh shared sample runs; SQL ownership filtering is planned.
- Theme toggle, responsive layout, scrollable History table, labeled controls, skip link, focus styles and reduced-motion support.

Reloading restores initial preview runs, navigation and form, then checks the backend session to restore identity. All completed runs use the shared sample transcript. Browser, keyboard, responsive and accessibility review remains the current acceptance task.

## Run the UI

Use the development container's Node.js/pnpm environment:

```bash
cd frontend
pnpm install                     # first run / dependency changes
pnpm dev --host 0.0.0.0 --port 5173 --strictPort
```

Open **http://localhost:5173**. Check existing VS Code tasks/dev-container startup before launching servers. Start the API below for sign-in. Vite's `/api` proxy targets `http://localhost:8000`.

### Checks

```bash
cd frontend
pnpm lint
pnpm test:auth                   # auth-client tests; no extra dependencies
pnpm build                       # TypeScript check + Vite production build
```

Application interaction tests are a planned acceptance task. Use the [frontend checklist](frontend/README.md#checks) for manual review.

## Run the API

```bash
cd backend
python -m venv .venv             # first run; reuse an existing venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

- `GET http://localhost:8000/api/health` → `{"status":"OK!"}`.
- FastAPI OpenAPI UI: http://localhost:8000/docs.
- `POST /api/auth/sign-in` with `{"access_key":"austin"}` or `{"access_key":"john"}` returns the user and sets an HttpOnly session cookie.
- `GET /api/auth/me` restores the user; signed-out/unknown sessions return 401.
- `POST /api/auth/sign-out` revokes the session and clears the cookie.

Use one Uvicorn worker. Sessions live in memory: browser refresh preserves sign-in, while restarting the API requires signing in again. The UI shows shared preview records for both users. Run/file ownership will be enforced through SQL later.

Run backend auth checks from the repository root:

```bash
backend/.venv/bin/python -m unittest discover -s backend/tests -v
```

The dev container forwards 5173/8000/8002. On container creation, `postCreateCommand` creates/reuses `backend/.venv` and installs `backend/requirements.txt`. Rebuild the container to apply setup changes. After dependency changes, run `backend/.venv/bin/python -m pip install -r backend/requirements.txt` from the repository root.

`.vscode/tasks.json` defines folder-open startup tasks for Vite, the main FastAPI app, the Speech mock and database initialization. You can also run **Start Speech Mock** from VS Code's Run Task menu. `.devcontainer/start-dev.sh` starts missing services and writes logs under `.devcontainer/logs/`, including `speech-mock.log`. It installs Python requirements when creating a missing venv; update existing environments explicitly. Install frontend dependencies with pnpm.

See the [project structure guide](docs/PROJECT_STRUCTURE.md) for the source tree and editing map. Frontend UI components live in `src/components/`, static images in `src/assets/` and auth requests in `src/api/`; `App.tsx` coordinates shared state and navigation.

## Local SQLite database

Create the database from the repository root using the existing Python environment:

```bash
backend/.venv/bin/python backend/database.py
```

VS Code also runs this initialization on folder open through the **Initialize Database** task. This creates `backend/data/databases/app.db` with one empty `runs` table on first initialization. Repeating the command preserves existing rows. The database and its sidecars are ignored by Git; `backend/schema.sql` is the maintained schema and `backend/database.py` initializes it using Python's built-in SQLite support.

The table stores sequential run IDs, ownership, source metadata, saved options, application/Speech statuses, transcript text, errors and UTC timestamps. Speech statuses match the current mock: `NotStarted`, `Running`, `Succeeded`, `Failed`. Nullable fields remain `NULL` until known; Automatic speakers is `NULL`, and booleans use `0`/`1`. Inserts default to `uploading`, `en-US`, enabled speaker labels/timestamps and current UTC timestamps. Future application updates must set `updated_at` explicitly.

Database creation is implemented. API access, worker processing and UI persistence remain pending. The accepted single-table schema supersedes the earlier multi-table proposal for the current local slice. Re-running initialization creates missing tables; it does not migrate an existing schema.

## Run the standalone Speech mock

```bash
cd backend
.venv/bin/python -m uvicorn speech_mock:app --host 127.0.0.1 --port 8002
```

Open http://localhost:8002/docs. Port 8002 is included in dev-container forwarding; rebuild the container to apply configuration changes. The Speech startup task runs without reload so code edits do not reset in-memory jobs; restart the task to apply Speech code changes. This standalone mock reads/writes local files; it needs no storage service. Paths are relative to `backend/` and must stay under `data/blobs/`. A leading slash is optional and still means a backend-relative mock path.

Ready-to-use UTF-8 text fixtures are in `backend/data/blobs/audio/`: `example.txt` and `example1.txt` through `example5.txt`. For example:

```bash
curl -sS -X POST 'http://localhost:8002/speechtotext/transcriptions:submit' \
  -H 'Content-Type: application/json' \
  -d '{
    "displayName": "Text example",
    "locale": "en-US",
    "contentUrls": ["/data/blobs/audio/example.txt"],
    "properties": {
      "destinationContainerUrl": "/data/blobs/transcripts"
    }
  }'
```

Jobs spend 10 seconds in `NotStarted`, then 20 seconds in `Running`. The mock reads up to 1 MB of source text, appends “This sentence was appended by the mock Speech service.” and writes `contenturl_0.json` and `report.json` under `backend/data/blobs/transcripts/<job-id>/`. The resulting text is in `combinedRecognizedPhrases[0].display`. Optional `mock_fail=true` simulates failure.

Poll the returned `self` URL for status. After success, follow `links.files` for file metadata/download URLs only. List Files accepts `skip` and `top` (for example, `?top=1`), returning `values` and an `@nextLink` when another page exists. It does not read files. GET each `contentUrl` separately to download through the mock's `/blobs/` route, or open the files on disk.

A maintenance loop advances jobs without polling and removes only terminal job entries after 30 minutes, checking once per second. Source and output files are never deleted. Saved download URLs continue to work after job expiry and service restart. Run one worker; in-memory jobs disappear on restart. Missing files, invalid UTF-8 or failed writes mark the job failed; partial output from a failed write is retained. Local data and generated results are ignored by Git; files named `example*` directly inside `backend/data/blobs/audio/` are eligible for version control. The UI is not connected to this service.

## Planned connected application

**Local auth is complete and its interaction review was approved by the user on 2026-11-09; broader UI acceptance and connected History/upload integration remain pending.** Follow the [local implementation plan](docs/LOCAL_IMPLEMENTATION_PLAN.md) for delivery and its [component status table](docs/LOCAL_IMPLEMENTATION_PLAN.md#1-small-local-architecture) for what is implemented. The connected milestone makes FastAPI/SQLite authoritative for runs, status and transcripts, with actual audio stored by a separate HTTP storage mock. A separate Speech API mock produces deterministic batch results.

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

Production can later move background execution to [timer/queue-triggered Azure Functions](docs/IMPLEMENTATION_PLAN.md#production-consideration-timer-and-queue-triggered-azure-functions) when independent worker scaling is justified. This is an optional production consideration.

**Open decisions:** connected size/duration policy, Speech option mapping, production session/access contracts and cleanup intervals. Local session and upload cancellation contracts are defined in the local implementation plan. The preview's 4 GB limit must be reconciled with Speech batch's documented **1 GB input** and **240-minute diarization** limits. See [Speech planning notes and sources](docs/IMPLEMENTATION_PLAN.md#azure-speech-api-interaction).

The local database is `backend/data/databases/app.db`; `backend/data/uploads/` remains a proposed upload store. Local databases, sidecars, audio and partials are ignored by Git. Document service startup, seeds, reset and cleanup commands as those features are delivered.
