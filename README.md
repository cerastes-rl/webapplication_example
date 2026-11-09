# SSScribe — Transcription workspace

SSScribe is a local transcription workspace with Austin/John sign-in, persistent user-owned History and direct text-file uploads to a standalone storage mock. Runs and options live in SQLite; file bytes live on disk. A backend worker submits uploads to the Speech mock, polls jobs and imports readable transcripts. Theme preference persists in localStorage.

## Documentation

- [Project structure](docs/PROJECT_STRUCTURE.md): maintained files, responsibilities and editing guide.
- [Frontend guide](frontend/README.md): controls, scenarios, manual review and the [source layout](frontend/README.md#source-layout).
- [Requirements](docs/REQUIREMENTS.md): current coverage and acceptance criteria.
- [Implementation plan](docs/IMPLEMENTATION_PLAN.md): local implementation matrix, Azure equivalents and remaining work.
- [API and data flow](docs/API_DATA_FLOW.md): current calls from session restoration through transcript import.
- [UI research](docs/UI_RESEARCH.md): product references and design rationale.
- [Agent instructions](AGENTS.md): implementation and documentation guidelines.

## Current capabilities

- Austin/John sign-in, session restoration, navy accents and light/dark themes.
- Non-empty TXT mock files up to **1,000,000 bytes inclusive**; saved English, Automatic/1–10 speakers, labels and timestamp options.
- Begin upload persists a run, sends bytes directly to storage with measured progress, then verifies stored size. The worker submits completed uploads to Speech and imports results. Navigation preserves the transfer.
- History reads only the signed-in user's SQLite records, with filename search, sorting, pagination, Refresh and details. Reload and API restart preserve records; API restart requires signing in again.
- Cancel aborts the local transfer and persists cancellation. An interrupted or unconfirmed upload requires file reselection and a new submission.
- Stored completed transcripts, when present, are fetched separately and displayed/copied/downloaded verbatim. Refresh History to see backend processing updates and open completed transcripts.

The earlier UI was approved on 2026-11-09; connected browser/accessibility review remains pending.

## Run the UI

Use the development container's Node.js/pnpm environment:

```bash
cd frontend
pnpm install                     # first run / dependency changes
pnpm dev --host 0.0.0.0 --port 5173 --strictPort
```

Open **http://localhost:5173**. Check existing VS Code tasks/dev-container startup before launching servers. Start the API, storage mock and Speech mock below for the full transcription flow. Vite's `/api` proxy targets `http://localhost:8000`.

### Checks

```bash
cd frontend
pnpm lint
pnpm test                        # auth/recording client and XHR checks; no extra dependencies
pnpm build                       # TypeScript check + Vite production build
```

Browser interaction review remains a planned acceptance task. Use the [frontend checklist](frontend/README.md#checks) for manual review.

## Run the API

```bash
cd backend
python -m venv .venv             # first run; reuse an existing venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python src/database.py          # explicit initialization; preserves existing rows
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

- `GET http://localhost:8000/api/health` → `{"status":"OK!"}`.
- FastAPI OpenAPI UI: http://localhost:8000/docs.
- `POST /api/auth/sign-in` with `{"access_key":"austin"}` or `{"access_key":"john"}` returns the user and sets an HttpOnly session cookie.
- `GET /api/runs` reads all of the signed-in user’s persisted runs, newest first; the frontend handles pagination.
- `GET /api/runs/{run_id}/transcript` returns `{run_id, transcript_text}` verbatim for a completed run; unavailable transcripts return 409.
- `GET /api/auth/me` restores the user; signed-out/unknown sessions return 401.
- `POST /api/auth/sign-out` revokes the session and clears the cookie.
- `POST /api/uploads/authorize` creates a new owned run from file metadata/settings. Each submission creates a new row; creation is not automatically retried.
- `POST /api/uploads/complete` with `{run_id}` HEAD-checks storage before marking the upload completed; the backend worker handles Speech submission.
- `POST /api/runs/{run_id}/cancel` persists upload cancellation and requests blob deletion; repeat safely.
- `POST /api/runs/{run_id}/upload-failed` persists an upload failure without overwriting a completed/cancelled upload.

Use one Uvicorn worker. Sessions live in memory: browser refresh preserves sign-in, while restarting the API requires signing in again. The run read API enforces SQL ownership; the UI loads that user’s persisted records.

Run backend auth and SQLite API checks from the repository root:

```bash
backend/.venv/bin/python -m unittest discover -s backend/tests -v
```

The dev container forwards 5173/8000/8001/8002. On container creation, `postCreateCommand` creates/reuses `backend/.venv` and installs `backend/requirements.txt`. Rebuild the container to apply setup changes. After dependency changes, run `backend/.venv/bin/python -m pip install -r backend/requirements.txt` from the repository root.

`.vscode/tasks.json` is the automatic startup configuration for Vite, the API and both mocks. It also runs **Initialize Database**. Service output appears in the task terminals.

## Local SQLite database

Create the database from the repository root using the existing Python environment:

```bash
backend/.venv/bin/python backend/src/database.py
```

VS Code also runs this initialization on folder open through the **Initialize Database** task. This creates `backend/data/databases/app.db` with one empty `runs` table on first initialization. Repeating the command preserves existing rows. FastAPI does not initialize the database; run the command above or the VS Code task before starting it. Set `SSSCRIBE_DATABASE_PATH` to an absolute file path to use a different local database (including with the initialization command). The database and its sidecars are ignored by Git at the default location; keep alternate stores under ignored `backend/data/` or outside the checkout. `backend/src/schema.sql` is the maintained schema and `backend/src/database.py` initializes it using Python's built-in SQLite support.

The table stores sequential run IDs, ownership, source metadata, saved options, application/Speech statuses, transcript text, errors and UTC timestamps. Speech statuses match the current mock: `NotStarted`, `Running`, `Succeeded`, `Failed`. Nullable fields remain `NULL` until known; Automatic speakers is `NULL`, and booleans use `0`/`1`. Inserts default to `uploading`, `en-US`, enabled speaker labels/timestamps and current UTC timestamps. Upload state changes update `updated_at` explicitly. `upload_stage` and `transcription_stage` store each phase directly. New rows start at `uploading` / `not_started`; verified uploads become `completed` / `not_started`.

SQLite initialization and authenticated read API access are implemented using Python's built-in `sqlite3`; no new dependencies are required. Read routes return typed JSON, UTC timestamps, booleans and nullable unknown fields. Storage keys, Speech IDs and transcript bodies are excluded from run lists. Protected responses use `Cache-Control: no-store`; errors use `{error: {code, message}}`, including invalid request parameters (422).

The database starts empty and uploads create records. Repeated initialization preserves rows using the current schema; automatic legacy conversion is not included. There is no submission request ID or deduplication index. Tests isolate their databases and storage directories. The backend worker resumes polling/import from saved SQL state after API restart.

### Connected upload configuration

The API uses `SSSCRIBE_STORAGE_URL` (default `http://127.0.0.1:8001`) for HEAD/DELETE. Set `SSSCRIBE_STORAGE_PUBLIC_URL` on the **API process** if browsers need a different origin, such as a forwarded HTTPS port. Set `SSSCRIBE_STORAGE_UI_ORIGINS` on **storage** to the exact frontend origin. Start services after setting these variables. Vite continues proxying `/api` to port 8000; file bytes go directly to port 8001.

Completion and cancellation use conditional SQL updates, so cancelled uploads cannot become eligible for Speech submission. This deliberately small storage mock cannot fence an already in-flight PUT: a late write may leave an unreferenced object. Repeat cancellation to request deletion again. Automatic abandoned-object cleanup, resumable uploads and manual processing retry remain later work. If completion cannot be confirmed, select the file again to start a new submission.

### Connected Speech processing

FastAPI's lifespan starts one background thread. Its ordinary loop submits completed uploads, polls saved jobs and imports succeeded results, one run at a time in run-ID order. A stop event waits two seconds between cycles and wakes on shutdown. SQL connections close before HTTP calls. Shutdown finishes the current run and stops before the next one.

Set `SSSCRIBE_SPEECH_URL` on the **API process** to change the default `http://127.0.0.1:8002`. The worker submits `data/blobs/audio/<original filename>` and writes results under `data/blobs/transcripts/<job-id>/`. Storage and Speech must share that local source directory; a custom storage directory must be mirrored in the Speech mock's filesystem. The mock uses the saved language and source text; speaker/label/timestamp options remain saved metadata.

Before POST, the worker persists `submission_uncertain`. Confirmed submission saves the job ID and returned status together. Unconfirmed submissions are not automatically retried. Known HTTP 4xx rejections except timeout become failed. Temporary polling/download errors are recorded and retried next cycle; known terminal jobs are not polled. Missing/expired jobs or result URLs and malformed transcript content become failed. Successful import commits transcript text and `completed` together and is not repeated.

API restart resumes saved active jobs and unfinished imports. Speech restart clears its in-memory jobs, so subsequent polling records missing jobs as failed. Restarting the API never initializes or upgrades SQL. Same-name uploads replace source bytes, including bytes a pending Speech job may read.

Both mocks live in root-level `services/` and run as separate processes using `backend/.venv` and the shared `backend/requirements.txt`.

## Run the standalone storage mock

```bash
# From the repository root
backend/.venv/bin/python -m uvicorn services.storage_mock:app --host 127.0.0.1 --port 8001 --no-access-log
```

Open **http://localhost:8001/docs**. Run one worker. The **Start Storage Mock** task uses this command. Port 8001 is forwarded by the dev container; rebuild it to apply the forwarding change.

The mock implements three operations on `/blobs/{name}`: PUT (201, create/overwrite), HEAD (200, size/properties) and DELETE (202). Missing blobs return 404. Upload raw file bytes with `x-ms-blob-type: BlockBlob` and Content-Length. For example:

```bash
curl -i -X PUT http://localhost:8001/blobs/example.txt \
  -H 'x-ms-blob-type: BlockBlob' -H 'Content-Type: text/plain' --data-binary 'hello'
curl -I http://localhost:8001/blobs/example.txt
curl -i -X DELETE http://localhost:8001/blobs/example.txt
```

Uploads preserve the original filename; uploading the same name replaces the existing file, including across users. Bytes persist under ignored `backend/data/blobs/audio/`. The local text-fixture limit is **1,000,000 bytes**, configurable with `SSSCRIBE_STORAGE_MAX_BYTES`. This standalone mock has no authentication, SAS generation, GET/download operation or receipt store. See [the storage contract](docs/PROJECT_STRUCTURE.md#standalone-storage-mock) for supported headers/configuration. The application now uses PUT from the browser and HEAD/DELETE from the API.

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

A maintenance loop advances jobs without polling and removes only terminal job entries after 30 minutes, checking once per second. Source and output files are never deleted. Saved download URLs continue to work after job expiry and service restart. Run one worker; in-memory jobs disappear on restart. Missing files, invalid UTF-8 or failed writes mark the job failed; partial output from a failed write is retained. Local data and generated results are ignored by Git; files named `example*` directly inside `backend/data/blobs/audio/` are eligible for version control. The backend connects this service to application runs; the UI reads progress and results through the application API.

## Planned work

Manual processing retries and frontend automatic refresh remain planned. See the single [implementation plan](docs/IMPLEMENTATION_PLAN.md) for service boundaries, the next slice and production direction. Browser interaction/accessibility and responsive checks remain pending.

Transcription stages are `not_started`, `queued`, `running`, `importing`, `completed`, `failed` and `submission_uncertain`. Upload handlers leave transcription unchanged. Speech polling maps `NotStarted` with a saved Speech job ID to `queued`, `Running` to `running`, `Succeeded` to `importing` and `Failed` to `failed`; successful transcript persistence sets `completed`. The separate `speech_status` column retains the raw Speech status.
