# SSScribe — Transcription workspace

SSScribe is a React UI preview for submitting recordings, following simulated progress and reading sample transcripts. It uses `#15263B` navy accents in both light/dark themes and local Austin/John authentication. Preview runs live in browser memory; theme preference persists in localStorage.

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
- MP3/WAV picker with extension and size validation (also accepts `.txt` without changing the displayed guidance): non-empty files up to **1 GB**.
- Requested speakers: Automatic or 1–10. Language: English. Speaker labels and timestamps default on.
- Begin upload creates an in-memory Run ID and navigates to History. Simulated progress continues across internal navigation: uploading → finalizing → queued → processing → completed.
- History temporarily includes 64 sample recordings for pagination review (`EXTRA_HISTORY_EXAMPLES` in `frontend/src/preview.ts` controls the extra 60), saved options, separate upload/transcription statuses, View transcript/Retry/Cancel buttons and sample transcript details. Pagination offers 10, 25 or 50 recordings per page, with filename search and sortable Submitted and Size columns (newest first by default).
- Upload cancellation asks for confirmation from History and details.
- Sign-out confirms cancellation of active simulated transfers, revokes the backend session and clears the preview workspace. Each sign-in starts fresh shared sample runs; SQL ownership filtering is planned.
- Recording details show the transcript beside recording metadata, upload/transcription statuses and saved transcription settings. Completed transcripts can be copied or downloaded as identical plain text.
- The footer and sidebar use the version in `frontend/package.json`.
- Theme toggle, responsive layout, scrollable History table, labeled controls, skip link, focus styles and reduced-motion support.

Reloading restores initial preview runs, navigation and form, then checks the backend session to restore identity. All completed runs use the shared sample transcript. The user approved the current UI on 2026-11-09. Responsive layout review is deferred; browser/accessibility checks and focused interaction tests remain follow-up work.

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
- `GET /api/runs` reads the signed-in user’s persisted runs (newest first; `limit=50`, maximum 100, and `offset=0`).
- `GET /api/runs/{run_id}/transcript` returns `{run_id, transcript_text}` verbatim for a completed run; unavailable transcripts return 409.
- `GET /api/auth/me` restores the user; signed-out/unknown sessions return 401.
- `POST /api/auth/sign-out` revokes the session and clears the cookie.

Use one Uvicorn worker. Sessions live in memory: browser refresh preserves sign-in, while restarting the API requires signing in again. The run read API enforces SQL ownership; the UI still shows shared preview records for both users.

Run backend auth and SQLite API checks from the repository root:

```bash
backend/.venv/bin/python -m unittest discover -s backend/tests -v
```

The dev container forwards 5173/8000/8001/8002. On container creation, `postCreateCommand` creates/reuses `backend/.venv` and installs `backend/requirements.txt`. Rebuild the container to apply setup changes. After dependency changes, run `backend/.venv/bin/python -m pip install -r backend/requirements.txt` from the repository root.

`.vscode/tasks.json` defines folder-open startup tasks for Vite, the main FastAPI app, both mocks and database initialization. You can also run **Start Speech Mock** from VS Code's Run Task menu. `.devcontainer/start-dev.sh` starts missing services and writes logs under `.devcontainer/logs/`, including `speech-mock.log` and `storage-mock.log`. It installs Python requirements when creating a missing venv; update existing environments explicitly. Install frontend dependencies with pnpm.

See the [project structure guide](docs/PROJECT_STRUCTURE.md) for the source tree and editing map. Frontend UI components live in `src/components/` and auth requests in `src/api/`. `App.tsx` coordinates shared state and navigation; `run.ts` defines the run contract and display helpers, `history.ts` defines History preferences, and `preview.ts` owns fixtures and simulation.

## Local SQLite database

Create the database from the repository root using the existing Python environment:

```bash
backend/.venv/bin/python backend/src/database.py
```

VS Code also runs this initialization on folder open through the **Initialize Database** task. This creates `backend/data/databases/app.db` with one empty `runs` table on first initialization. Repeating the command preserves existing rows. The API also initializes the database during startup, preserving existing rows. Set `SSSCRIBE_DATABASE_PATH` to an absolute file path to use a different local database (including with the initialization command). The database and its sidecars are ignored by Git at the default location; keep alternate stores under ignored `backend/data/` or outside the checkout. `backend/src/schema.sql` is the maintained schema and `backend/src/database.py` initializes it using Python's built-in SQLite support.

The table stores sequential run IDs, ownership, source metadata, saved options, application/Speech statuses, transcript text, errors and UTC timestamps. Speech statuses match the current mock: `NotStarted`, `Running`, `Succeeded`, `Failed`. Nullable fields remain `NULL` until known; Automatic speakers is `NULL`, and booleans use `0`/`1`. Inserts default to `uploading`, `en-US`, enabled speaker labels/timestamps and current UTC timestamps. Future application updates must set `updated_at` explicitly.

SQLite initialization and authenticated read API access are implemented using Python's built-in `sqlite3`; no new dependencies are required. Read routes return typed JSON, UTC timestamps, booleans and nullable unknown fields. Storage keys, Speech IDs and transcript bodies are excluded from run lists. Protected responses use `Cache-Control: no-store`; errors use `{error: {code, message}}`, including invalid request parameters (422).

The database starts empty; this step adds no seed data or write routes. Sign in at `http://localhost:8000/docs`, then try the run routes there. `GET /api/runs` returns an empty array until records exist. The UI and Begin upload still use browser-memory preview runs. Upload writes, worker processing and UI persistence remain pending. Tests create isolated temporary databases with fixtures, verify ownership and verbatim transcripts, and restart the API to confirm rows persist while sessions expire. The accepted single-table schema supersedes the earlier multi-table proposal for the current local slice. Re-running initialization creates missing tables; it does not migrate an existing schema.

Both mocks live in root-level `services/` and run as separate processes using `backend/.venv` and the shared `backend/requirements.txt`.

## Run the standalone storage mock

```bash
# From the repository root
backend/.venv/bin/python -m uvicorn services.storage_mock:app --host 127.0.0.1 --port 8001 --no-access-log
```

Open **http://localhost:8001/docs**. Run one worker. The **Start Storage Mock** task and startup helper use this command. Port 8001 is forwarded by the dev container; rebuild it to apply the forwarding change.

The mock implements three operations on `/blobs/{name}`: PUT (201, create/overwrite), HEAD (200, size/properties) and DELETE (202). Missing blobs return 404. Upload raw file bytes with `x-ms-blob-type: BlockBlob` and Content-Length. For example:

```bash
curl -i -X PUT http://localhost:8001/blobs/example.txt \
  -H 'x-ms-blob-type: BlockBlob' -H 'Content-Type: text/plain' --data-binary 'hello'
curl -I http://localhost:8001/blobs/example.txt
curl -i -X DELETE http://localhost:8001/blobs/example.txt
```

Bytes persist under ignored `backend/data/storage/`. The local text-fixture limit is **1,000,000 bytes**, configurable with `SSSCRIBE_STORAGE_MAX_BYTES`. This standalone mock has no authentication, SAS generation, GET/download operation or receipt store. See [the storage contract](docs/PROJECT_STRUCTURE.md#standalone-storage-mock) for supported headers/configuration. Main API and UI integration remain planned.

## Run the standalone Speech mock

```bash
# From the repository root
backend/.venv/bin/python -m uvicorn services.speech_mock:app --host 127.0.0.1 --port 8002
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

**Local auth is complete and its interaction review was approved by the user on 2026-11-09; the current UI was also approved on 2026-11-09. Connected History/upload integration remains planned, with responsive layout review deferred.** Follow the [local implementation plan](docs/LOCAL_IMPLEMENTATION_PLAN.md) for delivery and its [component status table](docs/LOCAL_IMPLEMENTATION_PLAN.md#1-small-local-architecture) for what is implemented. The connected milestone makes FastAPI/SQLite authoritative for runs, status and transcripts, with actual audio stored by a separate HTTP storage mock. A separate Speech API mock produces deterministic batch results.

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

**Open decisions:** connected size/duration policy, Speech option mapping, production session/access contracts and cleanup intervals. Local session and upload cancellation contracts are defined in the local implementation plan. The preview limit is **1 GB**; connected validation must also account for Speech batch's **240-minute diarization** limit. See [Speech planning notes and sources](docs/IMPLEMENTATION_PLAN.md#azure-speech-api-interaction).

The local database is `backend/data/databases/app.db`; the standalone storage mock uses `backend/data/storage/`. Local databases, sidecars, audio and partials are ignored by Git. Document service startup, seeds, reset and cleanup commands as those features are delivered.
