# SSScribe requirements

## Milestones

- **M1 — UI preview:** implemented for review. React/TypeScript/Vite, navy branding, light/dark themes, Upload/History navigation, mock identity, simulated progress and sample details. Browser/accessibility review, focused tests and UI approval are the current acceptance tasks.
- **Current backend:** health, Austin/John sign-in/me/sign-out with in-memory cookie sessions, owner-scoped SQLite run list/transcript reads and connected upload coordination. Vite's `/api` proxy and dev-container ports 5173/8000 are configured.
- **Standalone Speech mock — implemented:** local UTF-8 text input, timed states, retained result/report JSON, status and paginated List Files. Only in-memory jobs expire after 30 minutes; application integration is implemented; durable mock jobs remain planned. See the [component status table](IMPLEMENTATION_PLAN.md#current-local-architecture).
- **M2 — connected local application:** local authentication is complete, with user interaction approval recorded on 2026-11-09; SQL History and direct TXT uploads are implemented through upload completion, Speech submission/polling and transcript import. FastAPI/SQLite own records and workflow state, a storage HTTP mock persists audio, and a Speech HTTP mock returns deterministic batch results. FastAPI lifespan loops query SQL and execute submission, monitoring, import and recovery logic.
- **P1 — follow-ups:** filename/status search, transcript copy/download and transcript search.

Use the [local implementation plan](IMPLEMENTATION_PLAN.md) for delivery and local contracts, the [architecture plan](IMPLEMENTATION_PLAN.md) for the Azure end state, [UI research](UI_RESEARCH.md) for design rationale and [AGENTS.md](../AGENTS.md) for implementation conventions.

## Product behavior

### Application structure

- Persistent banner: SSScribe logo/title, theme toggle, demo indicator, identity and sign-out. Theme is available while signed out and persists under `ssscribe-theme` when localStorage is available.
- Signed-in navigation: Upload and History, with details opened from History. Current navigation uses React state. Narrow screens reflow navigation and use a scrollable History table.
- Upload: one file, format/size guidance, requested speakers, language, speaker labels/timestamps and Begin upload.
- History: every run, including active/interrupted transfers, with Run ID, filename, submission time, size, speakers, options, state and actions.
- Details: full run metadata/options, state, transcript when complete, error/retry when failed and Back to History.

### Current connected policy and lifecycle

The connected picker and application API accept non-empty TXT fixtures up to **1,000,000 bytes inclusive**. This local mock policy matches storage and the existing Speech fixture limit. Speakers are Automatic or 1–10, language English, labels/timestamps default on and options persist before transfer. Audio/duration/production Speech option mapping remain future decisions.

```text
Begin upload -> SQLite uploading row -> direct browser PUT -> API HEAD verification -> upload completed / transcription not started
uploading -> failed (upload stage) | cancelled
backend submit -> queued -> running -> importing -> completed
Speech errors -> failed | submission_uncertain
```


Cancellation conditionally persists state before requesting DELETE, and completion cannot queue cancelled work. The deliberately small storage interface cannot fence a late PUT; orphan cleanup remains deferred. Reloaded uploads can be checked/cancelled, and interrupted transfers require reselection/new runs. Theme preference persists separately.

## M1 — UI requirements and coverage

The table below records the earlier approved preview. The current connected TXT upload behavior and acceptance status above supersede its simulation details.

| ID | Acceptance criteria | Current coverage |
|---|---|---|
| UI-01 | Clear preview/sample labeling, Austin/John backend sign-in/out, signed-out record privacy, persistent banner and navigation. | Implemented; restores a backend session or shows the Austin/John access-key form. |
| UI-02 | History metadata/options and uploading/finalizing/not_started/running/importing/completed/failed/cancelled states with appropriate actions. | Implemented; active states follow Begin upload/retry. |
| UI-03 | Dedicated Upload validates choice/format/size, saves options in memory, starts a simulated run, navigates to History and guards duplicate submission. | Validation/navigation/simulation implemented. Transfer-failure and server-pending scenarios remain acceptance work. |
| UI-04 | Read-only sample transcript for completed runs, incomplete/error states, retry and Back to History. | Implemented with shared text and speaker/timestamp presentation. |
| UI-05 | Reproducible loading, empty, error/recovery, missing run, incomplete transcript, upload failure/validation and retry-pending states. | Normal/empty/error selector, 1.5-second loading and active transitions implemented. Explicit missing-run/upload-failure/retry-failure controls remain. |
| UI-06 | Usable shell/forms/details at 320px and desktop, contained table scrolling and accessible long filenames. | Responsive styles implemented; visual review pending. |
| UI-07 | Keyboard access, meaningful focus, semantic controls, associated errors, contrast ≥4.5:1, text statuses, restrained announcements and reduced-motion support. | Labels/headers/skip link/focus styles/live regions/reduced-motion CSS implemented. Return-to-origin focus and full browser/contrast/announcement review remain. |
| UI-09 | SSScribe/navy branding, theme toggle on signed-in/out surfaces and stored theme preference. | Implemented; cross-theme review pending. |

**M1 gate:** demonstrate UI-01–UI-09, close gaps or agree deferrals, complete browser/keyboard/responsive/theme review, add focused interaction tests, run lint/build and obtain explicit UI approval before further connected recording work. Austin/John authentication is complete; the user approved its interaction review on 2026-11-09.

## M2 — connected local requirements

### API and authentication

| ID | Acceptance criteria |
|---|---|
| API-01 | Small typed `/api` client, Pydantic request/response models, stable IDs, UTC timestamps and predictable errors. Proposed envelope: `{"error":{"code":"…","message":"…"}}`. API failures render actionable errors. Preserve health response. |
| AUTH-01 | Local auth complete; user interaction review approved on 2026-11-09. Two fixed users, `austin` and `john`, whose access keys equal their IDs, plus FastAPI sign-in/me/sign-out and an HttpOnly cookie session. Planned with SQL: protect recording/upload/transcript/retry/cancel using the session user ID and ownership checks, with 401 when signed out. Refresh restores the active session; a backend restart may require local sign-in again. Sign-out handles active transfer, clears protected views and stops UI polling; backend work continues. |
| API-02 | OpenAPI contracts for reads, authorization, streamed transfer, completion, retry and cancellation. Include run ID/options/upload state so unfinished submissions are visible. Storage keys and external Speech IDs remain private metadata. |

Health and local auth are implemented. The [local plan](IMPLEMENTATION_PLAN.md#application-contracts) defines the planned run-based contracts:

| Method / route | Response and behavior |
|---|---|
| `GET /api/health` | 200 `{"status":"OK!"}`. |
| `GET /api/runs` | 200 list including run ID/options and incomplete uploads. |
| `GET /api/runs/{run_id}/transcript` | 200 stored text/ID/time, 404 unknown run, 409 incomplete. |
| `POST /api/uploads/authorize` | 201 creates run/upload metadata and saves options before transfer; returns run/upload IDs, restricted local transport URL/method and constraints. |
| `PUT /blobs/{name}` on storage port 8001 | Raw streamed transfer; 201 stored/overwritten, 413 over the local limit. Require BlockBlob and Content-Length headers. |
| `POST /api/uploads/complete` | 202 verifies stored bytes, finalizes existing run/file and creates one ready SQL job. Missing/incomplete bytes: 409. Repeated confirmation returns the same IDs/current state across restarts. |
| `POST /api/runs/{run_id}/retry` | 202 marks eligible failed processing ready with the same recording/options. Unknown: 404; wrong state/concurrent duplicate: 409. |
| `/api/auth/sign-in`, `/api/auth/me`, `/api/auth/sign-out` | Implemented POST/GET/POST routes for Austin/John sessions. Sign-in accepts `{"access_key":"austin"}` or `{"access_key":"john"}`. |
| `POST /api/runs/{run_id}/cancel` | Cancel uploading/finalizing work before readiness; persist cancellation and clean partials/abandoned objects. Reconcile interrupted transfers before starting a new submission with reselection. |

### Transfer and persistence

| ID | Acceptance criteria |
|---|---|
| UP-01 | Enforce non-empty MP3/WAV and the agreed actual-byte limit in UI/storage. Proposed MIME policy: matching `audio/mpeg`, `audio/wav` or `audio/x-wav`; empty MIME can use permitted extension; reject contradictory metadata. Test exact limit/one byte over using synthetic streams or small injected limits. |
| UP-02 | Single-request streaming to generated temporary paths with bounded memory, actual-length validation, disk/disconnect handling and atomic storage finalization before SQL readiness. Clean abandoned objects/partials and recover stale uploads while preserving healthy slow transfers. |
| UP-03 | Shell upload manager preserves transfer across internal navigation. Begin creates run, starts transfer and opens History. Show measured bytes/progress, then finalizing until confirmation. Warn on leaving; interruption requires restart/reselection. Reconcile lost confirmation before resending. |
| DATA-01 | One SQLite runs table with owner, saved options, upload/transcription stages, private storage key, Speech ID, transcript and error. Persist readable text as SQLite `TEXT`, later Azure SQL `NVARCHAR(MAX)`. Commit transcript/completion together. Preserve bytes/records across restart. |
| DATA-02 | Seed labeled deterministic completed/retriable failed examples idempotently. Speech mock owns sample results; FastAPI imports them. |
| DATA-03 | Add Git exclusions for DB/upload/partial/sidecar files before generating persistence. Keep local data, secrets, environments, dependencies and build output out of Git. |

Proposed local stores: `backend/data/app.db`, `backend/data/uploads/`. Deliver startup, seed/reset and cleanup instructions alongside implementation. Persist object keys as durable identity and resolve fresh access URLs when needed.

### Jobs, integration and quality

| ID | Acceptance criteria |
|---|---|
| JOB-01 | Asynchronous SQL transcription stages not_started→queued→running→importing→completed, with failed/submission_uncertain error states, separate from upload stages. FastAPI loops query due work, conditionally claim submission, call Speech, save Speech IDs, poll status, download results and import readable text/errors. SQL retains workflow/scheduling state. |
| JOB-02 | Deterministic Speech mock results and a failed example that succeeds on retry. Preserve the run/options, save its Speech ID and resume monitoring that ID. Processing implementation remains a later slice. |
| JOB-03 | Start with one processing loop in one FastAPI process. Use non-blocking HTTP/waits, short SQL operations and clean shutdown. Add recovery/scheduling fields only when the requested processing behavior needs them. |
| INT-01 | Backend-authoritative state with conservative non-overlapping UI polling (proposed three seconds) while signed in with active runs. Stop on terminal work/sign-out/unmount. Preserve selection and ignore stale responses. |
| QA-01 | Tests for auth/contracts, streamed bytes, validation, interruption/cancel/cleanup, idempotent complete/retry/import, transitions, seeds and restart recovery. Isolated DB/storage, controlled clocks, synthetic streams. UI coverage for navigation, errors, themes and sign-out races; lint/build/manual review. |
| DOC-01 | Accurate startup, storage, seed/reset/cleanup, mock failures/timings, session behavior, upload policy, background-loop operation/recovery and Azure adapter instructions. |

**M2 gate:** sign in, view examples, upload actual bytes, see the run during transfer, navigate internally, observe processing, read a persisted transcript, retry failure and cancel an upload. Verify validation, interruption, outage/recovery, reload/restart, seed idempotency, auth races, keyboard/responsive/theme behavior and documented checks.

## Production direction

| Service | Responsibility |
|---|---|
| Azure Static Web Apps | React frontend |
| Azure App Service | FastAPI routes and SQL-driven background loops |
| Azure Blob Storage | Private audio |
| Azure SQL Database | Durable workflow state and readable transcripts |
| Azure AI Speech | Asynchronous batch recognition and results |
| Microsoft Entra ID | User authentication |

Replace local storage/Speech HTTP mocks and SQLite through their adapters. Production session/access contracts, cleanup intervals and connected file/duration/options policy remain open. Local sessions and cancellation follow the local implementation plan. See [architecture](IMPLEMENTATION_PLAN.md#architecture-diagrams) and [call sequences](API_DATA_FLOW.md).

## P1 follow-ups

- **NEXT-01:** filename search and status filters with distinct empty/no-match states.
- **NEXT-02:** copy/plain-text download of retrieved transcripts with failure feedback.
- **NEXT-03:** search within a transcript.

## Implemented backend SQLite read slice

The explicit initialization command creates the accepted single `runs` table using Python `sqlite3`; FastAPI does not initialize it. Authenticated run list/transcript routes enforce ownership and exclude private storage/Speech identifiers. The list returns every owned row; frontend handles pages; unknown and other-owner runs return 404, unavailable transcripts return 409, and invalid parameters return 422 with the application error envelope. Real-HTTP checks cover owner isolation, verbatim text and persistence across API restart. Database upload writes and frontend History integration are now implemented. Worker submission, polling and transcript import are implemented. The earlier SQLAlchemy/multi-table requirement describes future architecture, rather than this implemented slice.

## Implemented standalone storage slice

The current scope is a small Azure-style PUT/HEAD/DELETE interface backed by local files. PUT creates/overwrites with 201, HEAD returns size/properties with 200 and no body, DELETE returns 202, and missing blobs return 404. Raw requests require BlockBlob and Content-Length headers. The local text-fixture limit is configurable, default 1,000,000 bytes; empty blobs are supported as in Azure. Actual byte checks, temporary-file cleanup, atomic replacement and persistence are covered by real-HTTP tests. No GET operation, SAS/auth simulation, grant management or receipt database is included. This reduced scope supersedes the earlier full storage-simulation proposals. See [the implemented contract](PROJECT_STRUCTURE.md#standalone-storage-mock). Application/UI integration is implemented through upload completion, Speech submission/polling and transcript import.

## Connected upload acceptance

Implemented contracts: owner-scoped creation of one run per submission, direct XHR PUT/progress/abort, storage HEAD size verification, guarded completion/cancellation/failure updates and API-backed History. Tests cover the real app + SQLite + storage journey, separate submissions of the same file, owner isolation, exact policy boundaries, cancellation, lost completion across API restart and explicit database initialization. Frontend client tests cover a single whole-list request, direct API fields, metadata-only requests, file bytes, progress and abort. Browser navigation, keyboard/accessibility and responsive review remain pending. The backend worker now submits uploads, polls jobs and imports completed transcript text. Real-HTTP tests cover two runs and API restart; worker tests cover transient errors, terminal failures and uncertain submissions.
