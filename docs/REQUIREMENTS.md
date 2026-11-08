# SSScribe requirements

## Milestones

- **M1 — UI preview:** implemented for review. React/TypeScript/Vite, navy branding, light/dark themes, Upload/History navigation, mock identity, simulated progress and sample details. Browser/accessibility review, focused tests and UI approval are the current acceptance tasks.
- **Current backend:** `GET /api/health` → `{"status":"OK!"}`. Vite's `/api` proxy and dev-container ports 5173/8000 are configured.
- **M2 — connected local application:** planned after UI approval. FastAPI/SQLite own records and workflow state, a storage HTTP mock persists audio, and a Speech HTTP mock returns deterministic batch results. FastAPI lifespan loops query SQL and execute submission, monitoring, import and recovery logic.
- **P1 — follow-ups:** filename/status search, transcript copy/download and transcript search.

Use [implementation plan](IMPLEMENTATION_PLAN.md) for delivery, [UI research](UI_RESEARCH.md) for design rationale and [AGENTS.md](../AGENTS.md) for implementation conventions.

## Product behavior

### Application structure

- Persistent banner: SSScribe logo/title, theme toggle, demo indicator, identity and sign-out. Theme is available while signed out and persists under `ssscribe-theme` when localStorage is available.
- Signed-in navigation: Upload and History, with details opened from History. Current navigation uses React state. Narrow screens reflow navigation and use a scrollable History table.
- Upload: one file, format/size guidance, requested speakers, language, speaker labels/timestamps and Begin upload.
- History: every run, including active/interrupted transfers, with Run ID, filename, submission time, size, speakers, options, state and actions.
- Details: full run metadata/options, state, transcript when complete, error/retry when failed and Back to History.

### Current preview policy and lifecycle

The picker accepts non-empty `.mp3`/`.wav` files up to **4 GB (4,000,000,000 bytes inclusive)** using extension and size checks. Speakers are Unknown/Automatic or 1–10, language English, speaker labels/timestamps default on.

```text
Begin upload -> in-memory run -> History
uploading -> finalizing -> queued -> processing -> completed
uploading -> cancelled
failed fixture -> retry -> queued -> processing -> completed
```

The shell ticks every 1.3 seconds, adding eight percentage points during uploading and advancing each later stage on successive ticks. Completed runs share sample text. Cancel is offered while uploading. Sign-out confirms cancellation of uploading/finalizing runs, hides records and pauses other simulation. Sign-in resumes it. Reload restores three completed fixtures, one failed fixture, default identity/page and form state. Theme persists separately.

A **run** represents one submission and saved options. In M2 create its stable ID before transfer, separate upload/run state from processing job state and preserve run/file/options on processing retry. Changed-option reprocessing creates a new run.

**Connected policy decision:** reconcile the preview's 4 GB policy with Speech batch's documented **1 GB input** and **240-minute diarization** limits, and confirm option mapping before implementing uploads. See [Speech sources](IMPLEMENTATION_PLAN.md#azure-speech-api-interaction).

## M1 — UI requirements and coverage

| ID | Acceptance criteria | Current coverage |
|---|---|---|
| UI-01 | Clear preview/sample labeling, development sign-in/out, signed-out record privacy, persistent banner and navigation. | Implemented; starts signed in for review. |
| UI-02 | History metadata/options and uploading/finalizing/queued/processing/completed/failed/cancelled states with appropriate actions. | Implemented; active states follow Begin upload/retry. |
| UI-03 | Dedicated Upload validates choice/format/size, saves options in memory, starts a simulated run, navigates to History and guards duplicate submission. | Validation/navigation/simulation implemented. Transfer-failure and server-pending scenarios remain acceptance work. |
| UI-04 | Read-only sample transcript for completed runs, incomplete/error states, retry and Back to History. | Implemented with shared text and speaker/timestamp presentation. |
| UI-05 | Reproducible loading, empty, error/recovery, missing run, incomplete transcript, upload failure/validation and retry-pending states. | Normal/empty/error selector, 1.5-second loading and active transitions implemented. Explicit missing-run/upload-failure/retry-failure controls remain. |
| UI-06 | Usable shell/forms/details at 320px and desktop, contained table scrolling and accessible long filenames. | Responsive styles implemented; visual review pending. |
| UI-07 | Keyboard access, meaningful focus, semantic controls, associated errors, contrast ≥4.5:1, text statuses, restrained announcements and reduced-motion support. | Labels/headers/skip link/focus styles/live regions/reduced-motion CSS implemented. Return-to-origin focus and full browser/contrast/announcement review remain. |
| UI-08 | Typed fixtures/transitions separated from presentation, explicit preview labeling and selectable scenarios. | `preview.ts` owns fixtures/transitions; shell owns timer. Complete scenario controls during acceptance. |
| UI-09 | SSScribe/navy branding, theme toggle on signed-in/out surfaces and stored theme preference. | Implemented; cross-theme review pending. |

**M1 gate:** demonstrate UI-01–UI-09, close gaps or agree deferrals, complete browser/keyboard/responsive/theme review, add focused interaction tests, run lint/build and obtain explicit UI approval before M2.

## M2 — connected local requirements

### API and authentication

| ID | Acceptance criteria |
|---|---|
| API-01 | Small typed `/api` client, Pydantic request/response models, stable IDs, UTC timestamps and predictable errors. Proposed envelope: `{"error":{"code":"…","message":"…"}}`. API failures render actionable errors. Preserve health response. |
| AUTH-01 | Fixed-user adapter inside FastAPI with sign-in/me/sign-out. Protect recording/upload/transcript/retry/cancel with credentials/ownership checks and 401 when signed out. Refresh restores the active session. Sign-out handles active transfer, clears protected views and stops UI polling; backend work continues. |
| API-02 | OpenAPI contracts for reads, authorization, streamed transfer, completion, retry and cancellation. Include run ID/options/upload state so unfinished submissions are visible. Storage keys and external Speech IDs remain private metadata. |

Health is implemented. Finalize the following proposed contracts with run-aware DTOs before their delivery slices:

| Method / route | Response and behavior |
|---|---|
| `GET /api/health` | 200 `{"status":"OK!"}`. |
| `GET /api/files` | 200 list including run ID/options and incomplete uploads; may evolve to run-oriented reads. |
| `GET /api/files/{file_id}` | 200 run/file state, 404 unknown; supports pre-transfer records. |
| `GET /api/files/{file_id}/transcript` | 200 stored text/ID/time, 404 unknown file, 409 incomplete. |
| `POST /api/uploads/authorize` | 201 creates run/upload metadata and saves options before transfer; returns run/upload IDs, restricted local transport URL/method and constraints. |
| Storage upload URL, route pending | Raw streamed transfer to the separate storage mock. Proposed 204 stored, 404 unknown authorization, 413 oversized, 415 unsupported type. Validate actual bytes/claimed length. |
| `POST /api/uploads/complete` | 202 verifies stored bytes, finalizes existing run/file and creates one ready SQL job. Missing/incomplete bytes: 409. Repeated confirmation returns the same IDs/current state across restarts. |
| `POST /api/files/{file_id}/retry` | 202 marks eligible failed processing ready with the same recording/options. Unknown: 404; wrong state/concurrent duplicate: 409. |
| `/api/auth/sign-in`, `/api/auth/me`, `/api/auth/sign-out` | Proposed POST/GET/POST routes for the local fixed-user session. |
| Upload restart/cancel, routes pending | Restart transfers from zero with reselection as needed. Persist cancellation and clean partials/abandoned objects. |

### Transfer and persistence

| ID | Acceptance criteria |
|---|---|
| UP-01 | Enforce non-empty MP3/WAV and the agreed actual-byte limit in UI/storage. Proposed MIME policy: matching `audio/mpeg`, `audio/wav` or `audio/x-wav`; empty MIME can use permitted extension; reject contradictory metadata. Test exact limit/one byte over using synthetic streams or small injected limits. |
| UP-02 | Single-request streaming to generated temporary paths with bounded memory, actual-length validation, disk/disconnect handling and atomic storage finalization before SQL readiness. Clean abandoned objects/partials and recover stale uploads while preserving healthy slow transfers. |
| UP-03 | Shell upload manager preserves transfer across internal navigation. Begin creates run, starts transfer and opens History. Show measured bytes/progress, then finalizing until confirmation. Warn on leaving; interruption requires restart/reselection. Reconcile lost confirmation before resending. |
| DATA-01 | SQLAlchemy/SQLite runs, files, jobs and transcripts with relationships, saved options, upload/failure state, private storage keys, claims/submission-start, attempts, Speech IDs, due times, errors and unfinished imports. Persist readable text as SQLite `TEXT`, later Azure SQL `NVARCHAR(MAX)`. Commit transcript/completion together. Preserve bytes/records across restart. |
| DATA-02 | Seed labeled deterministic completed/retriable failed examples idempotently. Speech mock owns sample results; FastAPI imports them. |
| DATA-03 | Add Git exclusions for DB/upload/partial/sidecar files before generating persistence. Keep local data, secrets, environments, dependencies and build output out of Git. |

Proposed local stores: `backend/data/app.db`, `backend/data/uploads/`. Deliver startup, seed/reset and cleanup instructions alongside implementation. Persist object keys as durable identity and resolve fresh access URLs when needed.

### Jobs, integration and quality

| ID | Acceptance criteria |
|---|---|
| JOB-01 | Asynchronous SQL job states queued→processing→completed/failed, separate from upload stages. FastAPI loops query due work, conditionally claim submission, call Speech, save Speech IDs, poll status, download results and import readable text/errors. SQL retains workflow/scheduling state. |
| JOB-02 | Deterministic Speech mock results and a failed example that succeeds on retry. Preserve run/file/options, clear stale errors and increment attempts at durable submission-start. Resume monitoring with the existing attempt/ID. |
| JOB-03 | Supervised lifespan loops inside one FastAPI process/worker/instance initially. Clean shutdown, startup recovery, conditional claims, uncertain-submission reconciliation and idempotent imports. Persist due times/attempts/errors. Use async HTTP/waits and short task-scoped SQL transactions committed before network calls. Add SQL leases before scale-out and enable App Service Always On on a supported plan. |
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

Replace local storage/Speech HTTP mocks and SQLite through their adapters. Session/access contracts, cleanup intervals and connected file/duration/options policy remain open. See [architecture](IMPLEMENTATION_PLAN.md#architecture-diagrams) and [call sequences](API_DATA_FLOW.md).

## P1 follow-ups

- **NEXT-01:** filename search and status filters with distinct empty/no-match states.
- **NEXT-02:** copy/plain-text download of retrieved transcripts with failure feedback.
- **NEXT-03:** search within a transcript.
