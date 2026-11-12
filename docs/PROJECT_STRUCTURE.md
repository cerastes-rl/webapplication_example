# OIGScribe project structure

See [README](../README.md) for commands, [requirements](REQUIREMENTS.md) for acceptance and the [implementation matrix](IMPLEMENTATION_PLAN.md#local-implementation-matrix) for current features, Azure equivalents and next work.

## Maintained source

```text
backend/
  main.py                    App, worker lifespan, routers, health and request errors
  api/
    auth.py                  Austin/John sessions and current-user dependency
    runs.py                  Owned run list and stored transcript routes
    uploads.py               Create, complete, cancel and fail uploads
  src/
    database.py              Explicit initialization and parameterized SQL
    schema.sql               Single runs table
    storage_client.py        Application HTTP HEAD/DELETE calls
    speech_client.py         Speech submission, status and result HTTP calls
    processing.py            Sequential submit/poll/import worker
  tests/
    test_auth.py             HTTP test setup and authentication checks
    test_runs.py             Owned whole-list reads and transcript contracts
    test_uploads.py          Application + SQLite + storage integration
    test_storage.py          Blob PUT/HEAD/DELETE contracts
    test_processing.py       Worker eligibility, transitions and failure recovery
    test_speech_flow.py      Real upload-to-transcript journey and API restart
  requirements.txt           Direct Python dependencies shared by all services
services/
  storage_mock.py            Independent storage process, port 8001
  speech_mock.py             Independent Speech process, port 8002
frontend/
  src/
    main.tsx                 React entry point
    App.tsx                  Shell, session, History loading and active upload
    api/auth.ts              Authentication calls and session response handling
    api/recordings.ts        Recording calls and direct XHR PUT/progress/abort
    assets/oigseal.png       OIG seal image used by the shared Logo component
    components/
      shared/                Banner, sidebar, sign-in form, logo, icons and sortable heading
      branding/              OIGScribe Brand and ScribeWordmark
    features/transcriptions/
      run.ts                 API-shaped Run type, upload limit and formatting
      history.ts             Search/status-filter/sort/page preferences
      components/            Recording screens, statuses and audio empty state
    App.css                  Scribe branding, recording, upload and transcript layouts
    DefaultLayout.tsx        Shared banner, sidebar, footer and content structure
    DefaultStyle.css         Shared themes, typography, controls and app shell
  tests/                     Auth and recording-client/XHR checks
  public/favicon.svg         Static favicon
  vite.config.ts             Port 5173 and /api proxy to port 8000
Dockerfile                   Single image with Node/Python and startup for all four services
.dockerignore                Excludes local data, secrets and generated files from builds
docs/DOCKER.md               Docker CLI build, initialization and service commands
.vscode/tasks.json           Automatic startup tasks and Initialize Database
.devcontainer/               Shared development environment and port forwarding
```

`components/shared/` contains `TopBanner`, `Sidebar`, `SignInForm`, `Logo`, `Icon` and `SortableHeader`. `components/branding/` contains `Brand` and `ScribeWordmark`. `features/transcriptions/components/` contains `EmptyState`, `UploadPage`, `HistoryPage`, `RunDetail` and `StatusBadge`; the feature also owns `run.ts` and `history.ts`. The shared sign-in form receives branding and description from `App.tsx`; the sortable heading uses an independent direction type. Shared components do not import Scribe components or recording models. `DefaultLayout` assembles the banner, sidebar, footer, skip link and signed-in/sign-in content containers. Apps supply branding, navigation, content and actions. `TopBanner.tsx` receives the app brand and keeps its private theme toggle, user identity and sign-out components together. `Sidebar.tsx` keeps navigation presentation and sidebar footer information together, receiving app navigation, name, version and description. The small page footer is inline in `DefaultLayout.tsx`. These components use shared `DefaultStyle.css` styles; `App.tsx` retains navigation, authentication and upload state/actions. The private `ThemeToggle` in `TopBanner.tsx` owns theme selection, system-preference fallback, the document theme attribute and persistence under `ssscribe-theme`; its appearance remains in `DefaultStyle.css`. `Logo` imports `frontend/src/assets/oigseal.png` for the header and sign-in title. Shared CSS derives its diameter and gap from each text-size variable using `--golden-ratio` (1.618): diameter = text size × ratio; gap = text size ÷ ratio². Group small private components with their parent reusable unit; separate independently reused or substantial components. Keep the layout shallow and import components directly. See the [shared template conventions](../AGENTS.md#shared-frontend-template). See the [frontend source layout](../frontend/README.md#source-layout).

The Upload screen uses a two-column form for file selection and transcription settings, with submission below the form and a clearly visible instructions panel on the right. The form panels stack at narrower widths; mobile uses a single column with instructions still visible. Its layout rules live in `frontend/src/App.css`.

## Current request flow

1. `App.tsx` restores the session or calls `api/auth.ts` from sign-in.
2. After sign-in/restoration, `GET /api/runs` returns all owned rows. The frontend filters by filename and status, sorts and slices pages locally. History reloads on entry, after mutations and on Refresh; Upload/details navigation does not reload it.
3. Begin upload passes the File/options to the shell. `POST /api/uploads/authorize` inserts one run and returns a local blob URL using the original filename and headers.
4. XHR sends bytes directly to storage, tracking measured progress. One shell-owned upload object contains its controller, numeric run ID and progress across navigation. Upload progress and transcription status are displayed in the Transcriptions table.
5. `POST /api/uploads/complete` HEAD-verifies size before setting upload completed / transcription not started. The background worker submits eligible runs, polls active jobs and imports succeeded transcripts.
6. Cancellation aborts the local request, conditionally saves cancellation and asks storage to DELETE. Failed/interrupted uploads require reselection/new submissions.
7. Completed transcript text is fetched separately and displayed/copied/downloaded verbatim.

Run field names and stages are the same in Python and TypeScript. There is no field-renaming model, preview data, fake attempt count or Check upload control. Aborted/stale requests cannot restore signed-out data. Theme persists under `ssscribe-theme`; History records remain in SQLite.

## Database initialization

The database is `backend/data/databases/app.db`, with an optional `SSSCRIBE_DATABASE_PATH` override. Initialize it explicitly with `backend/.venv/bin/python backend/src/database.py` or the VS Code **Initialize Database** task. FastAPI does not initialize or upgrade it. Initialization creates missing tables and preserves existing rows using the current schema. Automatic legacy-schema conversion has been removed.

The single `runs` table stores owner, filename/size/options, private storage key, upload/transcription stages, Speech fields, readable transcript, error and UTC timestamps. Each submission creates a new row. SQL uses short task-local connections and parameterized values; transactions end before storage HTTP calls. Normal responses omit storage keys, Speech IDs and transcript bodies. Other-owner and unknown IDs return 404.

## Backend processing

FastAPI lifespan starts one background thread running the ordinary loop in `src/processing.py`. Each cycle visits submit, poll and import selections in order, one run at a time. One stop event handles the two-second wait and shutdown. SQL helpers in `src/database.py` select runs, claim submissions, save raw/mapped Speech statuses and atomically persist transcripts with completion. `src/speech_client.py` owns HTTP requests, result listing pagination and transcript JSON extraction.

Confirmed jobs and unfinished imports resume after API restart. Submission uncertainty is retained without automatic resubmission. Poll/download outages retry on later cycles; missing jobs/results and malformed content record failure. No database initialization occurs in the worker. See [configuration and error behavior](../README.md#connected-speech-processing).

## Standalone storage mock

`services/storage_mock.py` stores bytes under ignored `backend/data/blobs/audio/` independently of SQL. Uploads preserve the original filename; the same name replaces existing bytes, including across users. The fixed container is `blobs`. Flat blob names preserve original filenames, including spaces and Unicode, up to 255 UTF-8 bytes. Leading dots, directory separators and control characters are rejected.

| Request | Supported interface |
|---|---|
| `PUT /blobs/{name}` | Raw bytes; require `x-ms-blob-type: BlockBlob` and Content-Length. Create/overwrite, 201 with ETag/Last-Modified. |
| `HEAD /blobs/{name}` | 200 with Content-Length, ETag, Last-Modified and BlockBlob type; no body. |
| `DELETE /blobs/{name}` | Remove stored file, 202. |

Missing blobs return 404. Missing Content-Length returns 411; invalid headers/names return 400; local byte-limit violations return 413. Errors use XML and `x-ms-error-code`; HEAD has no response body. Content-Type/custom metadata, authentication/SAS, GET, leases and snapshots are outside this mock's scope. These are small subsets of Azure [Put Blob](https://learn.microsoft.com/en-us/rest/api/storageservices/put-blob), [Get Blob Properties](https://learn.microsoft.com/en-us/rest/api/storageservices/get-blob-properties) and [Delete Blob](https://learn.microsoft.com/en-us/rest/api/storageservices/delete-blob).

PUT streams to a hidden temporary file, verifies actual length and atomically replaces the final file. Disconnect/error cleanup removes partials; startup removes abandoned partials. Completed bytes remain across restart. DELETE does not fence an in-flight late PUT, so automatic orphan cleanup remains deferred. There is no receipt database or recovery loop.

| Storage variable | Default |
|---|---|
| `SSSCRIBE_STORAGE_DIR` | `backend/data/blobs/audio/` |
| `SSSCRIBE_STORAGE_MAX_BYTES` | `1000000`, inclusive; the application accepts non-empty TXT within this limit |
| `SSSCRIBE_STORAGE_UI_ORIGINS` | `http://localhost:5173`; comma-separated exact browser origins |

The API uses `SSSCRIBE_STORAGE_URL` for backend requests and optional `SSSCRIBE_STORAGE_PUBLIC_URL` for browser-facing upload URLs. See [configuration and commands](../README.md#connected-upload-configuration). Run one storage worker; `/openapi.json` can check readiness.

## Standalone Speech mock

`services/speech_mock.py` still uses backend-relative paths under `backend/data/blobs/`. It reads UTF-8 text up to 1 MB, appends a fixed sentence and writes transcript/report JSON. Jobs spend 10 seconds in NotStarted and 20 seconds in Running. It supports submit, status, paginated result listings and downloads; `mock_fail=true` simulates failure.

A maintenance loop progresses jobs without polling. Terminal in-memory jobs expire after 30 minutes; source/output files are retained. Restart clears jobs, preserving files. Run one worker without reload. The application worker connects submission, polling and result import to SQLite. Refresh History to see the updated stages. See [Speech startup and examples](../README.md#run-the-standalone-speech-mock).

## Docker CLI

The root `Dockerfile` builds one image containing Node.js, pnpm, Python and all application services. Its inline Bash command explicitly initializes the database, then runs Vite, FastAPI, storage and Speech in the same container. It forwards shutdown to the services and stops the container if any service exits. FastAPI itself does not initialize the database. The [Docker guide](DOCKER.md) mounts a named volume at `/app/backend/data` for SQLite records, uploaded files and Speech output; sessions and Speech jobs remain in memory. Internal service calls use localhost and existing ports. `.dockerignore` excludes checkout data and dependencies from image builds. VS Code automatic startup continues to use `.vscode/tasks.json`.

## Generated and local files

| Path | Handling |
|---|---|
| `backend/.venv/` | Shared Python environment, ignored |
| `frontend/node_modules/`, `frontend/dist/` | Installed/generated frontend files, ignored |
| `backend/data/databases/` | SQLite database and sidecars, ignored |
| `backend/data/blobs/audio/` | Uploaded files and temporary uploads; maintained example fixtures remain eligible for tracking |
| `backend/data/blobs/` | Speech sources/results; only maintained `audio/example*` fixtures are tracked |
| `__pycache__/`, `*.pyc` | Python cache, ignored |

No runtime data or secrets belong in Git. Tests use temporary databases/storage and explicitly initialize test databases before starting FastAPI.

## Common editing locations

- Shared design styles: `frontend/src/DefaultStyle.css` (themes, typography, spacing, controls, navigation and shell, including responsive rules). Dropdown and text-box appearance, borders and interaction states are defined here; `App.css` only adjusts their screen-specific placement and dimensions. OIG logo size, spacing from the name and vertical alignment stay here for consistency across apps. Reuse this stylesheet across apps. Its `--font-size-*` variables define all text sizes; headings inherit the shared hierarchy without component or mobile size overrides.
- OIGScribe-specific italic Scribe and pencil styling, plus screen layouts: `frontend/src/App.css` and the relevant component.
- Upload policy: `frontend/src/features/transcriptions/run.ts`, `UploadPage.tsx`, `backend/api/uploads.py` and the storage limit.
- Routes/contracts: `backend/api/`; SQL: `backend/src/database.py`, `schema.sql`.
- Startup: `.vscode/tasks.json`; environment/forwarded ports: `.devcontainer/devcontainer.json`.
- Architecture/next slice: [implementation plan](IMPLEMENTATION_PLAN.md); planned production sequences: [API data flow](API_DATA_FLOW.md).

Update this guide and README when paths, responsibilities, configuration or behavior change. Keep current and planned work distinct and verify links and `git diff --check`.

Transcription stages are `not_started`, `queued`, `running`, `importing`, `completed`, `failed` and `submission_uncertain`. Upload handlers leave transcription unchanged. Speech polling maps `NotStarted` with a saved Speech job ID to `queued`, `Running` to `running`, `Succeeded` to `importing` and `Failed` to `failed`; successful transcript persistence sets `completed`. The separate `speech_status` column retains the raw Speech status.
