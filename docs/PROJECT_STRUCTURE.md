# SSScribe project structure

Maintained files, responsibilities and common editing locations. See [README](../README.md) for startup, [frontend guide](../frontend/README.md) for review and [implementation plan](IMPLEMENTATION_PLAN.md) for future work.

## Quick orientation

- **`frontend/`:** React UI preview with in-memory runs and simulated progress.
- **`backend/`:** health/auth and SQLite run read API.
- **`services/`:** standalone storage and Speech mock processes, using the shared backend Python environment.
- **`docs/`:** requirements, architecture, delivery plan and research.
- **`.devcontainer/`, `.vscode/`, `.github/`:** development and repository configuration.

## Maintained files and directories

Paths are relative to the repository root.

```text
SSScribe/                            Repository root (actual checkout name may differ)
|--- README.md                       Overview, capabilities, startup and verification
|--- AGENTS.md                       Coding-agent constraints and maintenance rules
|--- .gitignore                      Repository-wide ignore rules
|
|--- frontend/                       React + TypeScript + Vite UI
|    |--- README.md                  Preview usage, scenarios and review checklist
|    |--- package.json               Dependencies and dev/build/lint/preview scripts
|    |--- pnpm-lock.yaml             Resolved dependency versions; managed by pnpm
|    |--- tests/auth.test.ts         Auth-client checks using Node's built-in test runner
|    |--- .gitignore                 Additional frontend-specific ignore rules
|    |--- .oxlintrc.json              Existing Oxlint plugins and rules
|    |--- index.html                 HTML entry, page title, description and favicon link
|    |--- vite.config.ts             Vite/React setup, port 5173 and /api proxy
|    |--- tsconfig.json              TypeScript project references
|    |--- tsconfig.app.json          Browser/application TypeScript configuration
|    |--- tsconfig.node.json         Tooling/Vite TypeScript configuration
|    |
|    |--- src/                       Source bundled by Vite
|    |    |--- main.tsx              Loads global CSS and mounts App in StrictMode
|    |    |--- App.tsx               App shell, auth, navigation and preview state
|    |    |--- components/           UI components, one file per component
|    |    |    |--- Brand.tsx        SSScribe logo
|    |    |    |--- EmptyState.tsx   Empty/error state presentation
|    |    |    |--- HistoryPage.tsx  History table, counts, search and pagination
|    |    |    |--- Icon.tsx         Shared inline SVG icons
|    |    |    |--- RunDetail.tsx    Run information and sample transcript
|    |    |    |--- SignInForm.tsx   Sign-in form and session feedback
|    |    |    |--- SortableHeader.tsx Shared sortable table heading
|    |    |    |--- StatusBadge.tsx  Run status label
|    |    |    |--- UploadPage.tsx   File picker, options and validation
|    |    |--- run.ts                Run contract, size limit, formatting and stage mapping
|    |    |--- history.ts            History view preferences and defaults
|    |    |--- preview.ts            Fixtures, sample text creation and simulation
|    |    |--- api/auth.ts           Typed auth requests and session response validation
|    |    |--- index.css             Global defaults and light/dark theme tokens
|    |    |--- App.css               Layout, component styles and responsive rules
|    |
|    |--- public/                    Static assets served without module imports
|         |--- favicon.svg           Favicon referenced by index.html
|
|--- backend/                        Python/FastAPI application API
|    |--- main.py                    FastAPI lifespan, health, routers and normalized request errors
|    |--- api/                       Application HTTP endpoints
|    |    |--- auth.py               Austin/John sessions, routes and current-user dependency
|    |    |--- runs.py               Run list/transcript response models and authenticated read routes
|    |--- src/                       Application logic and database access
|    |    |--- database.py           SQLite initialization, connections and owner-scoped reads
|    |    |--- schema.sql            Accepted single-table runs schema
|    |--- tests/test_auth.py         Shared isolated HTTP server harness and auth checks
|    |--- tests/test_storage.py      Blob HTTP contracts, limits, interruption and restart checks
|    |--- tests/test_runs.py         SQL ownership, paging, transcript, validation and restart checks
|    |--- data/blobs/audio/example*   Version-controlled text fixtures, including example1.txt–example5.txt
|    |--- requirements.txt           Pinned Python runtime dependencies
|
|--- services/                       Independent mock services; use backend/.venv
|    |--- storage_mock.py            Azure-style PUT, HEAD and DELETE backed by local files
|    |--- speech_mock.py             Batch mock: submit, timed states, result files and expiry
|
|--- docs/                           Project documentation
|    |--- PROJECT_STRUCTURE.md       This guide: paths, responsibilities and editing map
|    |--- REQUIREMENTS.md            Behavior, coverage/gaps and acceptance criteria
|    |--- IMPLEMENTATION_PLAN.md     Target architecture, Speech API flow, Azure deployment and optional Functions/queue scaling
|    |--- LOCAL_IMPLEMENTATION_PLAN.md  Local delivery slices, contracts, recovery and checks
|    |--- API_DATA_FLOW.md           Planned end-state call sequences, triggers, schedules and recovery
|    |--- UI_RESEARCH.md             Public-product research and design rationale
|    |--- notes.md                   Informal demo feedback
|
|--- .devcontainer/                  VS Code development-container configuration
|    |--- devcontainer.json          Python image, Node/pnpm feature and forwarded ports
|    |--- devcontainer-lock.json     Locked feature resolution; generated by dev tooling
|    |--- start-dev.sh               Optional helper to start Vite, the API and both mocks
|
|--- .vscode/
|    |--- tasks.json                 VS Code startup tasks for Vite, FastAPI, both mocks and database initialization
|
|--- .github/
     |--- dependabot.yml             Automated dependency-update configuration
```

### Frontend responsibilities in more detail

| File | Responsibility |
|---|---|
| `src/main.tsx` | Imports global styles and mounts `App` in React StrictMode. |
| `src/App.tsx` | Shell, navigation, theme, session restore/sign-in/sign-out, shared preview state/actions, History view state across internal navigation and lifecycle timer. |
| `src/components/SignInForm.tsx` | Sign-in form, session-check message and auth feedback; receives state and callbacks from App. |
| `src/components/HistoryPage.tsx` | History table, summary counts, upload/transcription statuses, action buttons, filename search, Submitted/Size sorting and 10/25/50-row pagination controls in the top toolbar; receives runs, persistent view state and action callbacks from App. |
| `src/components/UploadPage.tsx` | File/options state, validation and new preview run submission. |
| `src/components/RunDetail.tsx` | Transcript panel, recording metadata, separate upload/transcription statuses, saved settings, state-specific actions and identical plain-text display/Copy/Download from `run.transcript`; Download starts a standard browser download. |
| `src/components/Brand.tsx`, `Icon.tsx`, `StatusBadge.tsx`, `EmptyState.tsx` | Shared UI components. |
| `src/api/auth.ts` | Typed sign-in/session/sign-out requests and response/error handling. Validates user response fields; the backend owns allowed identities. |
| `frontend/package.json` | Shared application version, dependencies and scripts. |
| `src/run.ts` | Run types, size limit, date/size formatting and stage status mapping. |
| `src/history.ts` | History view state and defaults. |
| `src/preview.ts` | Four base fixtures plus configurable temporary pagination examples, sample transcript creation and `advanceRuns`. |
| `src/index.css` | Theme tokens, global styles, focus/reduced-motion rules and control defaults. |
| `src/App.css` | Shell, History, forms, details, sign-in, theme toggle and responsive component styles. |

### Configuration and tooling

- **Frontend commands:** `pnpm dev`, `pnpm lint`, `pnpm build` (`tsc -b && vite build`) and `pnpm preview`. Update dependency resolution through pnpm.
- **Vite:** React plugin, port 5173 and `/api` proxy to `http://localhost:8000`. `public/` files are served at root paths; imported source assets are bundled.
- **Backend:** `main.py` exports `app` for `uvicorn main:app`. `requirements.txt` pins FastAPI/Uvicorn/Pydantic and supporting dependencies. Use `backend/.venv` and pip requirements.
- **Dev container:** Python image with Node/pnpm, ports 5173/8000/8001/8002. On creation, `postCreateCommand` creates/reuses the venv and installs requirements. Rebuild to apply setup changes; rerun pip after requirements changes. The lockfile records resolved feature metadata.
- **Startup:** `.vscode/tasks.json` defines folder-open tasks for Vite, the API, storage/Speech mocks and **Initialize Database** (`.venv/bin/python src/database.py` from `backend/`). Database initialization runs once per folder open and preserves existing rows. Mock tasks launch from the repository root using `backend/.venv/bin/python`; their data paths remain under `backend/data/`. Speech runs on port 8002 without reload to preserve in-memory jobs during code edits. `.devcontainer/start-dev.sh` starts missing services and logs to `.devcontainer/logs/` (`speech-mock.log` for Speech, `storage-mock.log` for storage). It installs requirements when creating a missing venv. Install frontend dependencies with pnpm and update existing venvs explicitly.
- **Checks:** `.oxlintrc.json` owns lint rules; `tsconfig*.json` owns TypeScript configuration.
- **Repository automation:** `.github/dependabot.yml` configures dependency updates.

## How the current app fits together

```text
Browser opens frontend/index.html
    |
    v
src/main.tsx -> imports index.css -> mounts App.tsx
    |
    |--- Theme: saved choice / initial system preference
    |            -> data-theme on <html> -> CSS theme variables
    |
    |--- Shell + React page state
    |    |--- History table and scenario controls (components/HistoryPage.tsx)
    |    |--- Upload form (components/UploadPage.tsx)
    |    |--- Run details / sample transcript (components/RunDetail.tsx)
    |    |--- Sign-in form (components/SignInForm.tsx)
    |
    |--- In-memory runs initialized from preview.ts
         |--- Begin upload -> new preview run -> History
         |--- App timer -> advanceRuns -> updated status/progress
         |--- Cancel / retry -> update in-memory run
         |--- Completed details -> shared illustrative transcript

Application API:
backend/main.py -> GET /api/health -> {"status":"OK!"}
                -> api/auth.py -> sign-in / me / sign-out -> in-memory cookie sessions
                -> api/runs.py -> src/database.py -> owner-filtered SQLite run/transcript reads
```

The app restores a backend session or opens the Austin/John access-key form. React state owns navigation; the shell timer continues across page changes. Leaving Upload resets the form. Sign-out confirms cancellation of simulated transfers, revokes the backend session and resets preview state. Reload restores initial preview runs/page and checks the backend session; theme preference persists under `ssscribe-theme`.

## Where do I change something?

All frontend paths in this table are relative to `frontend/` unless otherwise noted.

| Change | Start here |
|---|---|
| App name/logo | `src/components/Brand.tsx`, `src/components/SignInForm.tsx` (welcome), `src/App.tsx` (header/sidebar/footer), `index.html` (title/description), then relevant docs |
| Banner, navigation or which page opens first | `src/App.tsx`; layout in `src/App.css` |
| Navy palette, dark/light colors or focus color | Theme variables in `src/index.css` |
| Theme preference or top-bar toggle behavior | `src/App.tsx`; icons in `src/components/Icon.tsx`, toggle layout in `src/App.css` |
| Page spacing, typography or responsive layout | `src/App.css` and global rules in `src/index.css` |
| File picker, speakers, language and option fields | `src/components/UploadPage.tsx` |
| Upload size limit | `MAX_FILE_SIZE` in `src/run.ts`; update guidance/error copy in `components/UploadPage.tsx` and documentation too |
| Extension validation | `UploadPage.validate()` in `src/components/UploadPage.tsx`; picker `accept` is only a convenience. MP3/WAV and silent `.txt` acceptance share the same size checks |
| History columns, summary counts or action buttons | `src/components/HistoryPage.tsx` |
| Application version in the footer/sidebar | `frontend/package.json` |
| Sample runs and transcript creation | `src/preview.ts` |
| Stage status mapping and date/size formatting | `src/run.ts` |
| Simulation stages versus timing | Transition helper in `src/preview.ts`; interval, retry and cancellation in `src/App.tsx` |
| Transcript/details presentation | `src/components/RunDetail.tsx`; styles in `src/App.css` |
| Local sign-in/out | Form in `src/components/SignInForm.tsx`; session/events in `src/App.tsx`; requests in `src/api/auth.ts` |
| Browser metadata or favicon | `index.html`, `public/favicon.svg` |
| Frontend dependencies or package scripts | `package.json` and pnpm-managed `pnpm-lock.yaml` |
| Development proxy/port | `vite.config.ts`; align root startup docs, `.vscode/tasks.json` and helper configuration as applicable |
| Current Python endpoints | Repository-root `backend/main.py`, `backend/api/auth.py` and `backend/api/runs.py` |
| SQLite queries and startup path | `backend/src/database.py`; optional `SSSCRIBE_DATABASE_PATH` override |
| Python dependencies | Repository-root `backend/requirements.txt`, installed into existing venv |
| Startup/environment troubleshooting | Root README, `.vscode/tasks.json`, `.devcontainer/start-dev.sh`, `.devcontainer/devcontainer.json` |
| Product scope or implementation status | `docs/REQUIREMENTS.md`, `docs/IMPLEMENTATION_PLAN.md`, root/frontend READMEs |
| Planned service boundaries, callers or Azure Speech API flow | `docs/IMPLEMENTATION_PLAN.md` for service ownership; `docs/API_DATA_FLOW.md` for ordered Mermaid call sequences, exact Speech operation names, triggers and schedules |

## Generated and machine-local directories

| Path | Purpose / handling |
|---|---|
| `.git/` | Git history and repository metadata. |
| `frontend/node_modules/` | Installed packages. Ignored; recreate with pnpm. |
| `frontend/dist/` | Generated production build. Ignored; recreate with `pnpm build`. |
| `backend/.venv/` | Local Python environment. Ignored; recreate with venv/pip. |
| `backend/__pycache__/`, `*.pyc` | Generated Python bytecode, ignored. |
| `backend/data/databases/app.db` | Local SQLite runs table, initialized on API startup or with `backend/.venv/bin/python backend/src/database.py`; database and sidecars ignored. |
| `backend/data/storage/` | Blob files and temporary hidden `.partial` uploads; all ignored. |
| `backend/data/` | Local stores are ignored except `example*` files directly inside `blobs/audio/`. `blobs/audio/` contains local text sources and `blobs/transcripts/` can hold Speech mock results. Job expiry never deletes files. |
| `.devcontainer/logs/` | Helper logs (`vite.log`, `uvicorn.log`), ignored. |
| Other editor caches / TypeScript build metadata | Tool output; handled by the applicable ignore rules. |

Root `.gitignore` and `frontend/.gitignore` define exclusions. Only `example*` files directly inside `backend/data/blobs/audio/` are allowed through the data exclusions; generated results and other local files stay ignored.

## Standalone storage mock

`services/storage_mock.py` is a small standalone FastAPI service on port 8001. It stores file bytes under ignored `backend/data/storage/`, separately from application SQL. The fixed container is `blobs`; blob names are flat, 1–255 characters, start with an ASCII letter/digit and contain only letters, digits, dots, underscores or hyphens.

| Method and route | Implemented interface |
|---|---|
| `PUT /blobs/{name}` | Raw bytes, required `x-ms-blob-type: BlockBlob` and Content-Length. Creates or overwrites the blob; returns 201 with ETag and Last-Modified. Empty blobs are supported. |
| `HEAD /blobs/{name}` | Returns 200 with Content-Length, ETag, Last-Modified and `x-ms-blob-type: BlockBlob`, with no response body. Missing blob: 404. |
| `DELETE /blobs/{name}` | Deletes the file and returns 202. Missing blob: 404. |

These are the small subsets of Azure [Put Blob](https://learn.microsoft.com/en-us/rest/api/storageservices/put-blob), [Get Blob Properties](https://learn.microsoft.com/en-us/rest/api/storageservices/get-blob-properties) and [Delete Blob](https://learn.microsoft.com/en-us/rest/api/storageservices/delete-blob) used here. Errors return an XML code and `x-ms-error-code`; HEAD errors have no body. Content-Length is required (411 when absent); missing/unsupported blob type returns 400, and the local byte limit returns 413. No GET route is provided. Content-Type and other custom Azure metadata are not persisted; HEAD implements only the properties listed above. Authentication, SAS verification, conditional requests, leases and snapshots are outside this mock's scope.

PUT streams through a temporary file without accumulating the request body. It verifies received length and atomically replaces the target only after the upload finishes. Disconnect/error cleanup removes the partial while preserving any previous blob. Startup removes abandoned temporary uploads and retains completed files. DELETE removes only the currently stored blob; it does not revoke or cancel an in-flight PUT. There is no receipt/state database or background recovery loop.

| Variable | Default |
|---|---|
| `SSSCRIBE_STORAGE_DIR` | `backend/data/storage/`; an alternate local directory can isolate tests. |
| `SSSCRIBE_STORAGE_MAX_BYTES` | `1000000`, inclusive; a local text-fixture limit. |
| `SSSCRIBE_STORAGE_UI_ORIGINS` | `http://localhost:5173`; comma-separated exact browser origins. CORS supports PUT/HEAD/DELETE and the supported request headers. |

See [startup and curl examples](../README.md#run-the-standalone-storage-mock). Run one worker. Check readiness through `/openapi.json`. Tests use real HTTP and a 16-byte injected limit. Stop the service before explicitly resetting its ignored data directory. Main API authorization/completion and UI integration remain planned; the existing Speech mock still uses its own local text fixtures.

## Standalone Speech mock

`services/speech_mock.py` runs on port 8002 with existing Python dependencies and no storage service. It owns an in-memory job dictionary and a lifespan maintenance task. Submissions use local paths under `backend/data/blobs/` in `contentUrls` and `properties.destinationContainerUrl`. After simulated processing, it reads UTF-8 text, appends a fixed sentence and writes result/report JSON to the destination/job-ID directory. List Files returns metadata/download URLs with `skip`/`top` pagination and `@nextLink`, without reading contents. The same app serves downloads at `/blobs/`. File work runs in a thread; jobs are processed sequentially. Job metadata expires after 30 minutes or restart; files remain. See [startup and limitations](../README.md#run-the-standalone-speech-mock). Durable jobs and production storage adapters remain later work.

## Planned connected structure

The [local architecture status table](LOCAL_IMPLEMENTATION_PLAN.md#1-small-local-architecture) tracks implemented components. Auth and its typed frontend client are complete; the user approved the auth interaction review and current UI on 2026-11-09. Responsive layout review is deferred; connected workflow integration and validation remain planned. Run read routes now use the accepted single-table SQLite schema through `sqlite3`. Frontend recording requests, upload/storage adapters, a Speech client and lifespan-managed SQL polling loops remain planned. Separate storage and Speech HTTP mocks own audio and simulated service jobs/results. Main FastAPI owns application SQL and business logic.

The current database is `backend/data/databases/app.db`, initialized by `backend/src/database.py` manually or through the VS Code folder-open task from `backend/src/schema.sql`. It contains the accepted single `runs` table with sequential IDs, ownership, file metadata, options, application and Speech statuses, transcript, error and UTC timestamps. Application updates must set `updated_at`. Initialization preserves existing rows and does not perform schema migrations. Authenticated run list/transcript reads are implemented in `backend/api/runs.py`; `main.py` initializes the configured database in its lifespan. Synchronous routes perform SQL work in FastAPI’s thread pool with task-local connections and a five-second busy timeout. Lists use `limit`/`offset` and order by creation time then ID descending. Tests use temporary databases and never write to the developer’s database. API writes, worker and UI integration remain pending; the older multi-table and scheduling-field proposals are future planning references. The standalone blob store is `backend/data/storage/`. Local data and database sidecars are already ignored. See the [local implementation plan](LOCAL_IMPLEMENTATION_PLAN.md) for candidate modules, contracts and delivery order, and the [architecture plan](IMPLEMENTATION_PLAN.md) for the Azure end state.

See the [frontend source layout](../frontend/README.md#source-layout) for module responsibilities and the sign-in call path.

## Keeping this guide useful

When paths, responsibilities, startup commands or implementation boundaries change, update this guide and the root README in the same change. Keep the README concise and link here for the detailed map. Document maintained files and common navigation tasks. Separate implemented source, generated/local output and planned additions. Follow the [maintenance instructions](../AGENTS.md) and verify local links/paths before finishing.
