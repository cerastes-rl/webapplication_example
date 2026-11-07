# SSScribe requirements

## Scope and current baseline

This document separates **current frontend coverage** from **target acceptance criteria**. [Implementation plan](IMPLEMENTATION_PLAN.md) describes delivery; [UI research](UI_RESEARCH.md) explains design rationale; [AGENTS.md](../AGENTS.md) governs implementation constraints.

- **M1 — UI preview, implemented for review:** React/TypeScript/Vite, plain CSS, navy accents, dark/light themes, persistent shell, Upload/History navigation, run details, simulated lifecycle and mock identity. Typed fixtures/sample text live in `frontend/src/preview.ts`; shell/timers are in `App.tsx`, presentation in `components.tsx`.
- **M1 acceptance is not complete:** no committed application tests; browser, keyboard, responsive and accessibility review is pending. Some scenarios/recovery details below remain gaps, not completed features.
- **Backend today:** `GET /api/health` only, returning `{"status":"OK!"}`. No API client, backend auth, uploads, SQLite/SQLAlchemy models, seed logic or worker exists. Vite's `/api` proxy and forwarded 5173/8000 ports are preserved.
- **M2 — connected local MVP, planned:** FastAPI/SQLite become authoritative, actual audio persists locally, and a worker generates deterministic sample transcripts. M1 alone does not satisfy this milestone.
- **P1:** optional improvements after M2. No Azure account/credentials or real transcription is required for either local milestone.

Stop for explicit UI approval before backend integration. Keep existing pnpm/Oxlint and Python venv/requirements workflows; no separate JavaScript server, large UI/state framework or cloud infrastructure.

## Resolved product behavior

### Application structure

- Product name: **SSScribe**. Navy-blue accents, light/dark themes and a keyboard-accessible top-bar theme toggle available even while signed out. Theme initializes from stored choice or system preference and is stored under `ssscribe-theme` if localStorage is available; it is not user/job persistence.
- Persistent banner: logo/title, local-demo indicator, development identity and far-right sign-out. Narrow layouts may hide supplemental identity/badge text while retaining core controls and a clear preview notice.
- Signed-in sidebar has **Upload** and **History** only; run details open from History. On mobile the navigation reflows above content. Navigation currently uses React state, not URL routes/deep links.
- Upload page: single-file picker, size/format guidance, requested speaker count, language, speaker labels, timestamps and Begin upload.
- History: all submissions, including uploading runs. Columns include Run ID/filename, submitted time, size, requested speakers, settings, status and actions. Settings are currently grouped in one column. Small screens use a locally scrollable table.
- Details: full run metadata/options, current state, sample transcript when complete, error/retry when failed and Back to History. No storage path is exposed.

### Current policy and lifecycle

The current UI accepts a **non-empty `.mp3` or `.wav` file up to 4 GB (4,000,000,000 bytes inclusive)**. It checks extension/size only; the picker lists MIME hints but does not verify audio content or contradictory MIME metadata. These checks must become authoritative server validation in M2. The former 25 MiB proposal is no longer applicable.

Speaker choices are Unknown/Automatic (default) or 1–10, language is English only, and speaker labels/timestamps default on. These are current UI choices; production service support/ranges must be checked during future integration. All settings are sample presentation metadata, not actual audio recognition.

Current simulation:

```text
Begin upload -> in-memory run -> History
uploading -> finalizing -> queued -> processing -> completed
uploading -> cancelled
seeded processing failure -> retry -> queued -> processing -> completed
```

The shell advances active runs every 1.3 seconds, adding 8 percentage points per uploading tick. Queued/processing each advance on a subsequent tick; these are illustrative timings. All completed runs use the same sample text. Cancellation is available during uploading; finalizing currently has no separate cancel action. No bytes are read/transmitted. Reload resets runs, page, form and mock identity; the preview starts signed in on History with three completed runs and one failed run. Sign-out cancels uploading/finalizing runs after confirmation, hides details, and pauses other simulation until sign-in. This differs deliberately from the future independent backend worker.

A **run** represents one submission and its saved options. In M2 create a stable Run ID before bytes transfer, distinguish run/upload state from processing job state, and retain run identity/options on processing retry. A future re-run with different options creates a new run. Exact upload-retry/cancel routes and run DTO shapes remain to be settled before M2 coding.

## M1 — UI requirements and coverage

“Implemented” below means present in source, not a claim of completed browser/accessibility certification.

| ID | Requirement / acceptance criteria | Current coverage |
|---|---|---|
| UI-01 | Clear local-demo/no-real-transcription notice; fixed-user sign-in/out; hide records signed out; persistent shell, logo/title and sign-out. | Implemented. Starts signed in for easier review, not a secure session. |
| UI-02 | History includes Run ID, metadata, requested speakers/settings, uploading/finalizing/queued/processing/completed/failed/cancelled states and open/retry/cancel actions as appropriate. | Implemented. Three completed and one failed fixture; active states follow Begin upload/retry. |
| UI-03 | Dedicated Upload page validates file choice/size/format, saves options in preview memory, starts a labeled simulated run and navigates immediately to History. No persistence claims; prevent duplicate pending submission. | Implemented navigation/validation/simulation; page unmounts on successful submit. No actual transfer-failure scenario or server-pending submission yet. |
| UI-04 | Read-only labeled sample transcript for completed runs; incomplete state instead of fabricated completion; error/retry and Back to History. | Implemented. Shared sample text; timestamps/labels honor display toggles, not recording content. |
| UI-05 | Independently reproduce loading, empty, unavailable/error recovery, missing run, incomplete transcript, upload failure/validation and retry-pending states. | Partial. Selector supports normal/empty/error; refresh simulates loading for 1.5 seconds. Upload/retry exercises active states; missing-run fallback exists but has no scenario control. Explicit upload-failure and retry-failure controls remain. |
| UI-06 | At 320px and desktop widths, shell/form/details are usable without page-wide overflow; full long filenames remain accessible. | Responsive styles and scrollable table implemented; visual review pending. Cards are optional, not required. |
| UI-07 | Keyboard operation, meaningful focus, semantic headings/controls, associated errors, contrast ≥4.5:1, status not color-only, restrained announcements and reduced-motion support. | Labels, table headers, skip link, focus styles, notice/error live regions and reduced-motion CSS exist. Main receives focus on page change. Return-to-origin focus, complete announcements and full keyboard/contrast review remain acceptance work. |
| UI-08 | Keep typed sample data/transition logic outside presentation markup; explicitly label preview; no hidden API fallback. All required scenarios selectable without editing markup. | Fixtures/transition helper separated in `preview.ts`; shell owns timer/state. No async source/API seam yet; not all scenarios selectable. |
| UI-09 | SSScribe/navy branding and accessible dark-mode toggle across signed-in/out surfaces; persist theme only if browser storage permits. | Implemented. Cross-theme browser/contrast checks pending. |

**M1 gate:** demonstrate UI-01–UI-09 with FastAPI stopped, close the listed gaps or explicitly agree on deferrals, complete keyboard/narrow/desktop/light/dark review, run `pnpm lint`/`pnpm build`, and obtain UI approval before M2. No committed automated app suite or `pnpm test` command exists; practical interaction tests are planned.

## M2 — connected local MVP requirements (not implemented)

### API and authentication

| ID | Acceptance criteria |
|---|---|
| API-01 | Small typed `/api` client, Pydantic request/response models, stable IDs, UTC timestamps, predictable JSON errors. Proposed envelope: `{"error":{"code":"…","message":"…"}}`. Preserve public health response. No frontend fallback fixtures on error. |
| AUTH-01 | Fixed-user mock auth adapter with sign-in/me/sign-out (proposed `/api/auth/sign-in`, `/api/auth/me`, `/api/auth/sign-out`). Protect recording/upload/transcript/retry/cancel operations with 401 when signed out. Refresh restores active session; sign-out clears protected UI and stops polling without deleting records. Warn/cancel active transfer on sign-out; already queued backend work continues. Not production authorization. |
| API-02 | Implement/document read, authorization, streamed transfer, completion and retry contracts in OpenAPI. Include stable Run ID, saved options and upload state so unfinished submissions are visible. Internal storage keys/paths and external service IDs are never public DTO fields. |

Only health below exists. Other routes/status codes are proposals to finalize consistently with run-aware History:

| Method / route | Intended behavior |
|---|---|
| `GET /api/health` | Existing public 200 `{"status":"OK!"}`. |
| `GET /api/files` | 200 list including run ID/options and incomplete uploads; may evolve to run-oriented read routes before integration. Empty is success, not unavailable. |
| `GET /api/files/{file_id}` | 200 run/file state, 404 unknown. Model must allow pre-transfer records. |
| `GET /api/files/{file_id}/transcript` | 200 stored text/ID/time, 404 unknown file, 409 known but not completed. |
| `POST /api/uploads/authorize` | 201 creates persistent run/upload metadata before transfer; returns Run ID/upload ID, local transport URL/method and constraints. Save requested options. Not an Azure SAS. |
| `PUT /api/dev/uploads/{upload_id}` | Proposed raw streaming transfer; 204 stored, 404 unknown authorization, 413 oversized, 415 unsupported type. Validate actual bytes/claimed length. |
| `POST /api/uploads/complete` | 202 binds verified stored bytes to existing run/file and enqueues once. Missing/incomplete bytes: 409. Repeated confirmation returns same IDs/current state across restarts. |
| `POST /api/files/{file_id}/retry` | 202 queues failed processing against same recording/options, 404 unknown, 409 wrong state/concurrent duplicate. |
| Upload retry / cancel | Exact routes pending. Retry starts transfer from zero, may require reselection; cancel has an explicit persisted outcome and cleans partials. |

### Transfer and persistence

| ID | Acceptance criteria |
|---|---|
| UP-01 | Enforce non-empty MP3/WAV and ≤4,000,000,000 actual bytes in browser/server. Proposed MIME policy: matching `audio/mpeg` or `audio/wav`/`audio/x-wav`; empty MIME may use permitted extension; reject contradictory non-empty MIME/metadata. This is not decoding/security scanning. Test exact boundary/one byte over without routine 4-GB allocation. |
| UP-02 | Rudimentary single-request upload, streamed incrementally to safe generated temporary path; bounded memory, disk-write failure handling, actual-length checks, atomic storage finalization before queueing. No chunking, resume, parallel chunks or automatic retries. Clean partials/abandoned objects and recover stale uploading runs without expiring healthy slow transfers. Never expose storage paths. |
| UP-03 | Shell-level upload manager survives internal page changes. Begin creates run, starts transfer and navigates to History. Show measured bytes/percentage, then finalizing until server confirmation; no invented processing percentage/ETA. Best-effort leave warning; refresh/close/network loss may interrupt and require full restart/reselection. Reconcile lost confirmation before resending. |
| DATA-01 | SQLAlchemy/SQLite records for runs (stable ID, requested speakers/settings, lifecycle, failure stage), files (metadata, uploader, internal storage provider/object key), jobs (status, attempts, timestamps/error) and transcripts (run/file/job relationship, text/time). Persist readable text as SQLite `TEXT`; future Azure SQL uses `NVARCHAR(MAX)`. Save transcript/completion atomically. Actual bytes/results survive reload/restart. |
| DATA-02 | Idempotently seed deterministic completed and retriable failed examples. Distinguish synthetic examples from actual uploads and sample results from audio analysis. Browser fixtures are not database seeds. |
| DATA-03 | Add ignored DB/upload/partial/sidecar paths before generating local persistence; never commit data, secrets, venvs, dependencies or build output. Current `.gitignore` lacks application-data exclusions. |

Proposed paths: `backend/data/app.db`, `backend/data/uploads/`. No such store, seed/reset/cleanup command or disk quota mechanism is implemented yet. Define these in README when delivered. Object keys are durable references, not expiring SAS URLs. Optional future raw result JSON/export artifacts may live in Blob Storage with SQL references; no separate transcript file is needed initially.

### Jobs, integration, quality

| ID | Acceptance criteria |
|---|---|
| JOB-01 | Durable asynchronous queued→processing→completed/failed with one lightweight local runner, not blocking request handlers. Processing states remain separate from uploading/finalizing/cancelled run states. Claim once, save result or useful error. No Redis/Celery. |
| JOB-02 | Deterministic sample output; documented failed example succeeds on retry. Retry preserves run/file/options, clears stale errors and increments processing attempts consistently. Proposed M2 accounting counts started attempts, unlike current illustrative browser accounting. |
| JOB-03 | Single-process worker with documented limitations, clean shutdown/startup recovery of interrupted processing/queued jobs, no lost files or duplicate transcripts. Work continues after browser sign-out/closure. |
| INT-01 | Replace preview state with backend authority. Conservative non-overlapping polling (proposed 3 seconds) while signed in with active runs, including uploads; stop when unnecessary/sign-out/unmount. Preserve selection; ignore stale responses. No hidden fixture fallback. |
| QA-01 | Tests for auth/contracts, actual streamed bytes, validation, interruption/cancel/cleanup, idempotent complete/retry, transitions/recovery, seeds and restart persistence. Isolate temp DB/storage, use controlled clocks and synthetic streams/small injected limits. UI coverage for navigation, upload/retry/errors, themes and sign-out races. Lint/build and manual walkthrough pass. |
| DOC-01 | Document actual startup, storage/seed/reset/cleanup, failure/retry trigger, session behavior, upload policy, worker limitations and future Azure adapters; distinguish implemented behavior from proposals. |

**M2 gate:** start Vite/FastAPI, sign in, view examples, start transfer and see History before completion, navigate internally without abort, verify finalizing/queued/processing/completed and stored sample transcript, retry failure and cancel upload. Reject invalid/oversized data and signed-out calls. Verify interruptions, missing/incomplete records, API outage (no fixtures), reload/restart persistence, idempotent seeds and recovery. Recheck M1 accessibility/themes with network-driven state. A 4 GB policy in today's picker is not proof that this future transport supports 4 GB end to end.

## Production direction (not local milestone work)

Keep adapter boundaries: local files → private Azure Blob Storage; SQLite → Azure SQL; mock identity → Entra; SQLite queue → Azure Queue Storage; fake inference → Azure transcription service. The future worker resolves private storage references, arranges supported service access, submits asynchronous work and stores internal external-job IDs to retrieve results. Do not add credentials, Azure SDKs or live integrations now.

## P1 / deferred

- **NEXT-01:** filename search/status filters with distinct no-match versus empty states.
- **NEXT-02:** copy/plain-text download of retrieved transcript, with failure feedback.
- **NEXT-03:** search within transcript without editing stored text.
- Defer playback/waveforms/synchronization, transcript editing/versioning, real diarization, translation/subtitles, summaries/chat, meeting bots, collaboration/public sharing, integrations, billing and quotas.
