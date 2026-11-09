# AGENTS.md — SSScribe

## Objective

Build a working local mock of an authenticated speech-to-text application. Prioritize a usable React UI, realistic API contracts and replaceable service adapters.

## Repository conventions

- `frontend/`: React + TypeScript + Vite, **pnpm**, existing **Oxlint** configuration and plain CSS.
- `backend/`: Python + FastAPI + Uvicorn, existing virtual environment and `requirements.txt` workflow.
- Preserve Vite's `/api` proxy to port 8000 and dev-container ports 5173/8000.
- Inspect the repository before changing files and reuse established conventions.
- Keep dependencies minimal. Express, additional Node backends, Docker orchestration, Redis, Celery and live Azure integrations are prohibited for the local prototype.
- Keep secrets, local data, audio, `.venv/`, `node_modules/` and build output out of Git.

## Current milestone

The UI preview is implemented for review. It restores an Austin/John backend session or opens the access-key sign-in form, with navy accents, light/dark themes, a persistent banner, Upload/History navigation, simulated runs and sample transcript details.

- `frontend/src/preview.ts`: temporary fixtures, sample transcript creation and simulated transitions. `src/run.ts` owns the run contract and display helpers; `src/history.ts` owns History preferences. Transcript details render `run.transcript` verbatim for display, Copy and Download.
- `App.tsx`: shell, navigation, theme, backend session/sign-in, preview state and timer. `components/SignInForm.tsx` renders sign-in; `components/HistoryPage.tsx` renders History. `src/api/auth.ts` owns typed auth calls.
- `frontend/src/components/`: one file per UI component, including shared visuals, Upload and run details. Keep static images in `src/assets/`, request clients in `src/api/` and app coordination in `App.tsx`. Keep folders shallow and use idiomatic React/TypeScript. Keep teaching explanations in conversation; questions about traces do not by themselves authorize refactors. See `frontend/README.md#source-layout`.
- Reload resets preview runs, form and navigation, then restores identity through `/api/auth/me`. Sign-out and each new sign-in reset preview runs. Theme persists under `ssscribe-theme` when localStorage is available.
- Simulation continues across internal navigation and pauses while signed out or an auth request is pending. History remains shared sample data; SQL user filtering is deferred.
- The picker accepts non-empty MP3/WAV up to **4,000,000,000 bytes inclusive**, checking extension and size. Requested speakers are Automatic or 1–10, language English, speaker labels/timestamps default on.
- Main FastAPI exposes health plus `/api/auth/sign-in`, `/api/auth/me` and `/api/auth/sign-out`. Access keys and stable IDs are exactly `austin` and `john`; sessions are in memory with an HttpOnly cookie. Restart requires sign-in. `backend/api/auth.py` exposes `get_current_user` for future SQL ownership checks.

**Current UI is complete for this scope; the user explicitly approved it on 2026-11-09. Local Austin/John auth and its interaction review are also complete. Responsive layout review is deferred; browser/accessibility checks and focused interaction tests remain follow-up validation. The UI approval gate is satisfied; connected History/upload integration remains planned and requires its own implementation request.**

## Planned connected architecture

FastAPI owns routes, fixed-user mock auth and lifespan-managed background loops. SQL stores workflow state; loops query due rows to execute submit/poll/import/recovery logic. Start with one backend process, one Uvicorn worker and one instance. Add SQL-backed leases before scale-out and enable App Service Always On on a supported plan.

| Responsibility | Local connected implementation | Production service |
|---|---|---|
| Frontend | React/Vite | Azure Static Web Apps |
| API and background loops | FastAPI/Uvicorn | Azure App Service |
| Authentication | Fixed-user adapter inside FastAPI | Microsoft Entra ID |
| Runs, files, jobs, transcripts | SQLite through SQLAlchemy | Azure SQL Database |
| Audio | Separate HTTP storage mock backed by files | Private Azure Blob Storage |
| Batch transcription | Separate HTTP Speech API mock | Azure AI Speech |

Keep HTTP clients/adapters narrow and service contracts realistic. The Speech mock owns simulated batch jobs/results and reads/checks source audio through the storage boundary. FastAPI owns application SQL and imports readable text.

### Upload and persistence

- Create persistent run/options before transfer so History includes active, interrupted, failed and cancelled submissions.
- Authorize a direct single-request browser upload to the storage mock. Stream to safe generated temporary paths with bounded memory, enforce actual-byte limits and finalize stored objects before marking a SQL job ready.
- The shell owns upload requests across internal navigation and reports measured bytes/progress. Interruption requires restart/reselection. Reconcile lost completion responses before resending bytes.
- Persist cancellation/failure stages, clean partials/abandoned objects and recover stale uploads using evidence of inactivity while preserving healthy slow transfers.
- Store provider/object keys and Speech IDs privately in SQL. Public DTOs expose run/file IDs, metadata, settings and application state.
- Store readable transcripts as SQLite `TEXT`, later Azure SQL `NVARCHAR(MAX)`, and commit transcript/completion atomically.
- Resolve connected size/duration/options policy before uploads: Speech batch documents a **1 GB input limit** and **240 minutes with diarization**, while the preview accepts 4 GB. Preserve the preview policy until a product decision is recorded.

### Background execution

Use FastAPI lifespan to start/supervise loops and cancel/await them on shutdown. SQL persists claims/submission-start, attempts, Speech IDs, due times, errors and unfinished imports. Use asynchronous HTTP, non-blocking waits and short task-scoped SQL sessions. Commit transactions before network calls.

Resume saved Speech IDs and imports after restart. Reconcile uncertain submissions after lost responses/crashes. Conditional claims, concurrent-retry guards and idempotent imports protect work. UI polling reads persisted application state on a separate schedule from Speech polling.

### API direction

Use a small typed frontend API client and Pydantic request/response models with stable IDs, UTC timestamps, predictable errors and ownership checks. Connected API errors render actionable error states. Keep preview fixtures in the explicit UI-review boundary.

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/health` | Health |
| `GET` | `/api/files` | Run/file metadata and states |
| `GET` | `/api/files/{file_id}` | Details |
| `GET` | `/api/files/{file_id}/transcript` | Stored readable transcript |
| `POST` | `/api/uploads/authorize` | Create run/options and authorize storage transfer |
| `POST` | `/api/uploads/complete` | Verify stored bytes and mark SQL job ready |
| `POST` | `/api/files/{file_id}/retry` | Mark eligible failed processing ready |

Finalize auth, cancellation/restart routes and run-aware DTOs before implementing their slices. See [requirements](docs/REQUIREMENTS.md) and [call sequences](docs/API_DATA_FLOW.md).

### Data model

- `runs`: stable ID, file relationship, options, submitted time, upload/run state and failure stage.
- `files`: ID, filename, type, actual size, storage provider/object key, uploader and creation time.
- `jobs`: run/file relationships, processing state, claims/submission-start, attempts, Speech ID, next-action times, errors and import state.
- `transcripts`: run/file/job relationships, readable text and creation time.

Processing retry retains run/file/options; reprocessing with changed settings creates a new run. Seed deterministic examples idempotently and label them. Add DB/upload/partial/sidecar exclusions before generating proposed `backend/data/app.db` and `backend/data/uploads/` stores. Keep migration complexity proportional to the prototype.

## UI and validation

Use accessible controls, navy accents, light/dark theme tokens and responsive layouts. Keep typed data/transitions separate from rendering. Poll conservatively while active jobs exist and stop on sign-out or when work is terminal. Add focused tests for auth/contracts, streamed bytes, transitions, retry/cancel, restart recovery and core UI interactions as those features are delivered.

The connected acceptance journey covers sign-in, History, actual upload, queued/processing/completed states, stored transcript, failed-job retry, cancellation and persistence across reload/restart. Keep startup, mock behavior and recovery instructions current.

## Sequence diagrams and explanations

- Use one Mermaid `sequenceDiagram` for the complete requested flow, including related entry points such as sign-in and page refresh/session restoration.
- Split phases inside that diagram with clearly labeled `Note over` sections (for example, `PART 1 - Page load or refresh` and `PART 2 - Manual sign-in`). Use `autonumber`, descriptive participants and `alt`/`opt` branches for success, errors and conditional actions.
- Trace the actual function calls, helpers, HTTP requests/proxy routing, backend handlers, state/session changes and return paths. Distinguish implemented behavior from planned work.
- Follow the diagram with a compact table linking components/functions to their current source files and line numbers. Read the code first to verify those references.
- Present the diagram in a fenced `mermaid` block in chat. Keep a single combined diagram unless the user requests otherwise.
- Explain unfamiliar frontend concepts patiently in conversation, using concrete code references. Keep the implementation idiomatic and consistent with the existing React/TypeScript template; an explanation request is not a refactoring request.

## Documentation maintenance

- Review root `README.md` and `docs/PROJECT_STRUCTURE.md` when files, responsibilities, setup, configuration, architecture, behavior or persistence boundaries change. Update each where affected.
- Write simple, direct descriptions of what the project does. Omit comparisons with excluded features or discarded architectures.
- Separate current behavior, planned work, open decisions and acceptance tasks with clear headings/status labels.
- Keep README concise and link to detailed guides. Document maintained source separately from generated/local files and proposed paths.
- Verify documented paths/links and run `git diff --check` before finishing.
