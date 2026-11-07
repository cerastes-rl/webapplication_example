# Local transcription prototype requirements

## Purpose and current baseline

Build a small, usable local demonstration of the recording-to-transcript journey, **UI first**, then connect it to FastAPI mock services. This document specifies intended behavior, not completed functionality. [AGENTS.md](../AGENTS.md) remains the implementation constraint source; [UI research](UI_RESEARCH.md) provides design rationale, not additional mandatory product scope.

Repository inspection at this review found:

- `frontend/src/App.tsx` is the React/Vite starter counter and links, with starter CSS; there is no transcription UI, typed API client, or mock sign-in yet.
- `backend/main.py` only implements `GET /api/health`, returning `{"status":"OK!"}`. No file, upload, transcript, auth, or job endpoints exist.
- React/TypeScript, pnpm, Oxlint, FastAPI/Uvicorn and the Vite `/api` proxy to port 8000 are configured. Dev-container ports are 5173 and 8000.
- SQLAlchemy is not yet in `backend/requirements.txt`; SQLite models, persistent storage, seeding and a worker are not implemented. No application test suite is present.

## Scope, priorities and delivery gates

- **P0 / M1 — UI-only preview:** validate three surfaces (mock sign-in, recordings dashboard/upload, transcript detail) without needing new backend endpoints. Temporary typed presentation fixtures outside components are permitted **only in this milestone**. Explicitly label all simulated actions; no claim of uploading, persistence, authentication security, or transcription.
- **P0 / M2 — Connected local MVP:** replace the preview boundary with a small typed `/api` client and FastAPI-backed services. FastAPI/SQLite become authoritative for records, statuses and transcripts; actual uploaded bytes persist locally. M1 is not the connected MVP or the AGENTS definition of done.
- **P1 / after M2:** small usability improvements, only after the core flow is verified. Not release gates for M1 or M2.

M1 can be reviewed with fixture scenarios before implementing database, upload or worker behavior. M2 must not silently fall back to fixtures on API failure. Both milestones retain React/TypeScript/Vite, pnpm/Oxlint, the existing Python venv/requirements workflow and `/api` proxy. Use existing dependencies and simple component separation first; do not introduce a separate JavaScript server or a large UI/state framework.

### Non-goals

No real speech recognition, OAuth/Entra integration, Azure credentials/resources, real SAS tokens, production deployment/security claims, Redis, Celery or Docker orchestration. Defer waveform/playback synchronization, transcript editing/versioning, actual diarization, subtitle export, translation, summaries/chat, meeting bots, collaboration, public sharing, integrations, billing and quotas. The mock is for local development, not exposure to untrusted users.

## M1 requirements — UI preview

| ID | Priority | Requirement and acceptance criteria |
|---|---|---|
| UI-01 | P0 / M1 | Show a persistent “Local demo — no real transcription” notice. Offer mock sign-in as a fixed development identity, display that identity after sign-in, and return to sign-in on sign-out. Signed-out users do not see recording details. All of this is clearly presentation-only in M1. |
| UI-02 | P0 / M1 | Dashboard lists filename, uploaded date, human-readable size, and text-labeled `queued`, `processing`, `completed`, `failed` status. Fixtures cover every status. Each row/card opens the corresponding detail; failed records offer retry without losing filename/context. |
| UI-03 | P0 / M1 | Provide a labeled single-file picker, visible format/size guidance, selected-file summary and explicit submit action. Show validation, pending, simulated queued confirmation and failure states. Disable duplicate submission while pending. State that preview files are not uploaded or saved; never report successful persistence. |
| UI-04 | P0 / M1 | Completed detail shows filename, metadata and a readable, read-only transcript with an explicit sample-result label. Incomplete detail shows status instead of invented transcript content; failed detail gives a helpful message and retry action. Back navigation returns to the dashboard. Optional speaker labels/timestamps must be labeled sample formatting. |
| UI-05 | P0 / M1 | Make loading, empty list, unavailable/error with retry, missing recording, not-yet-complete transcript, upload validation/error, and retry-pending states independently reproducible through temporary preview scenarios. Empty list offers upload; unavailable state does not masquerade as empty. |
| UI-06 | P0 / M1 | At 320px and desktop widths, controls and transcript remain usable without page-wide horizontal scrolling; narrow screens may use recording cards rather than a squeezed table. Long filenames wrap/truncate accessibly without hiding the full name from assistive technology. |
| UI-07 | P0 / M1 | Use semantic headings, buttons, labeled inputs and table headers where applicable. Keyboard users can sign in, choose/submit a file, open details, retry, go back and sign out with visible focus and no trap. Navigation moves focus meaningfully; modal use, if any, includes focus return. Status is not color-only; normal text contrast is at least 4.5:1. Announce significant asynchronous results/errors without announcing every poll. Validation is associated with the input; motion respects reduced-motion preferences. |
| UI-08 | P0 / M1 | Keep typed fixtures and preview behavior outside presentation components behind an explicit temporary data boundary. A developer can select all required scenarios without changing component markup. Fixtures are neither authoritative storage nor a hidden API fallback; label preview mode and document that reload may reset it. |

**M1 acceptance gate:** demonstrate UI-01–UI-08 using preview scenarios without a backend. Complete a keyboard-only walkthrough and narrow/desktop layout review; run `pnpm lint` and `pnpm build`. Record UI issues before starting connected behavior. Passing M1 does not mean a file was stored or transcribed.

## M2 requirements — connected local MVP

### API and mock authentication

| ID | Priority | Requirement and acceptance criteria |
|---|---|---|
| API-01 | P0 / M2 | Keep all browser backend calls in a small typed client using `/api`. Use Pydantic request/response models, stable opaque IDs, UTC timestamps and predictable JSON errors (proposed shape: `{"error":{"code":"…","message":"…"}}`). Invalid requests, missing records and state conflicts are distinguishable; network errors preserve useful context and offer retry. Preserve the existing health response. |
| AUTH-01 | P0 / M2 | A clearly named mock auth adapter supplies one fixed development identity. Provide sign-in, current-user and sign-out behavior; proposed routes are `POST /api/auth/sign-in`, `GET /api/auth/me`, `POST /api/auth/sign-out`. A simple local session is sufficient, not OAuth. File/upload/transcript/retry routes require that mock session and return 401 when signed out. Refresh restores an active session; sign-out clears displayed user data and stops polling without deleting persisted recordings. This is not production authorization or multi-tenant isolation. |
| API-02 | P0 / M2 | Implement the route contracts below and document final JSON shapes in FastAPI OpenAPI. Frontend does not read SQLite or local storage directly and never manufactures authoritative job states/transcripts. Unavailable backend shows an error, not fixture records. |

Required route behavior (proposed status codes to adopt consistently):

| Method and route | Success | Expected failures / contract |
|---|---|---|
| `GET /api/health` | 200, existing health JSON | Public local health check. |
| `GET /api/files` | 200, list including file metadata and current job status | Empty list is a successful response. |
| `GET /api/files/{file_id}` | 200, file metadata and current job state | 404 for unknown ID. |
| `GET /api/files/{file_id}/transcript` | 200, stored transcript text, ID and creation time | 404 unknown file; 409 if known but not completed. |
| `POST /api/uploads/authorize` | 201, upload ID, local transport/method, upload URL and constraints | Validate proposed filename/type/size. Response explicitly identifies local storage, never an Azure SAS. |
| `PUT /api/dev/uploads/{upload_id}` (proposed development transport) | 204, bytes stored locally | Unknown authorization: 404; invalid format: 415; over limit: 413. Check actual received bytes, not just claimed size. |
| `POST /api/uploads/complete` | 202, file ID and queued job | Require a successfully stored, validated upload. Reject absent/incomplete bytes with 409. Repeated confirmation returns the same file/job rather than duplicates. |
| `POST /api/files/{file_id}/retry` | 202, same file and queued job state | 404 unknown file; 409 unless failed. Duplicate/concurrent retries must not create multiple active jobs. |

The development upload route is a proposed local transport choice, not an implemented endpoint. Keep authorization/storage/confirmation behind replaceable interfaces so a future direct-to-Blob transport does not require changing presentation components. Final DTO details and local session mechanism can be settled before M2 implementation without expanding product scope.

### Upload and persistence

**Proposed MVP upload policy:** one non-empty file per submission; `.mp3` (`audio/mpeg`) or `.wav` (`audio/wav`, with `audio/x-wav` accepted as an alias); maximum **25 MiB (26,214,400 bytes)** inclusive. This is a proposed default to confirm before M1 upload work, not an existing capability. If revised, change this single policy and align UI guidance, picker, API validation and tests together. Browser MIME may be absent: document a consistent extension/MIME fallback policy before implementation; do not claim deep audio validation or decoding.

| ID | Priority | Requirement and acceptance criteria |
|---|---|---|
| UP-01 | P0 / M2 | Validate the chosen policy in browser and authoritatively on server, including empty files and actual size limits. Reject unsupported types and contradictory supplied metadata with actionable errors. The picker is a convenience, not the validation boundary. Test the size boundary and one byte over it. |
| UP-02 | P0 / M2 | Transfer actual bytes and persist them through a local file storage adapter before confirming/enqueuing. Use generated safe object paths, not user filenames as paths; do not expose absolute paths in public DTOs. On failure show a recoverable error and do not falsely create a queued recording. Reject or clean up partial/invalid uploads; document cleanup of abandoned authorizations/files. |
| UP-03 | P0 / M2 | Distinguish byte transfer from queued/processing work. Use measured upload progress only if available, otherwise an indeterminate pending indicator. Never invent transcription percentages or ETAs. A successful confirmation refreshes/selects the returned server record. |
| DATA-01 | P0 / M2 | Persist through SQLAlchemy/SQLite: files (ID, filename, content type, actual size, local object path, uploader, created timestamp); jobs (ID, file ID, status, attempts, timestamps, error); transcripts (ID, file/job reference, text, optional original mock JSON, created timestamp). Reload and backend restart retain uploaded bytes, records and completed results. Keep schema setup proportional; no production migration system is required. |
| DATA-02 | P0 / M2 | Seed a small deterministic first-run demonstration including a readable completed example and a retriable failure. Restarting does not duplicate seed records. Clearly distinguish synthetic examples from user uploads; fake results must not imply analysis of uploaded content. |
| DATA-03 | P0 / M2 | Exclude SQLite DBs, uploaded/partial files, secrets, venvs, dependencies and builds from Git. Current ignore rules do not yet cover database/upload paths; add those exclusions when implementing persistence. Only store local data needed for the prototype. |

### Job simulation and integration

| ID | Priority | Requirement and acceptance criteria |
|---|---|---|
| JOB-01 | P0 / M2 | Persist asynchronous `queued → processing → completed` or `queued → processing → failed` transitions. Do not wait for fake transcription inside upload/complete requests. A lightweight local worker/periodic runner is enough; no Redis/Celery. Store sample output only on completion, persist errors on failure, and prevent concurrent processing of the same job. |
| JOB-02 | P0 / M2 | Use deterministic sample output and an explicit, documented failure scenario that succeeds on retry (a seeded failure is sufficient). Retrying increments attempt accounting, clears stale error state for the new attempt and preserves file identity/bytes. Successful completion has a retrievable transcript. Document simulation timing; exact delays are not a product requirement. |
| JOB-03 | P0 / M2 | Document and test single-process worker limitations and restart recovery. On startup recover interrupted `processing` jobs to a runnable state, without losing files or producing duplicate transcripts; resume queued work. Multiple backend processes are not required. |
| INT-01 | P0 / M2 | Replace M1 fixtures with API-backed behavior for every existing UI state. Poll conservatively (proposed every 3 seconds) while jobs are queued/processing, avoid overlapping requests, and stop when no jobs are active or the user signs out/unmounts. Handle request failures and stale responses without resetting selection or showing another file's transcript. |
| QA-01 | P0 / M2 | Add targeted API tests for auth, validation/error contracts, actual upload persistence, confirmation/retry duplicate handling, job transitions, transcript availability, seed idempotency and restart recovery. Add practical UI interaction tests for sign-in, upload errors/success, detail selection and retry; use isolated temporary storage in backend tests. Frontend lint/build and a complete local walkthrough must pass. |
| DOC-01 | P0 / M2 | Update README with actual startup, seed/reset procedure, storage paths, upload policy, failure/retry trigger, mock session behavior, worker limitations and future Azure adapter replacements. Describe implemented behavior separately from proposals. No credentials required. |

**M2 acceptance gate:** start Vite (5173) and FastAPI (8000) using the documented commands. Sign in, view seeded examples, upload an allowed audio file, observe queued/processing/completed states, read its labeled sample transcript, retry the deterministic failed example and observe completion. Verify signed-out API rejection, unsupported/oversized upload rejection, missing/incomplete detail handling and backend-unavailable recovery. Reload and restart FastAPI: uploaded bytes, metadata and completed transcript remain, seeds do not duplicate, interrupted jobs recover. Confirm connected mode never displays fallback fixture records. Repeat the M1 accessibility/responsive checks with live API states.

## P1 follow-ups (not milestone blockers)

| ID | Priority | Requirement and acceptance criteria |
|---|---|---|
| NEXT-01 | P1 / after M2 | Filename search/status filters distinguish “no matches” from “no recordings” and can be cleared. |
| NEXT-02 | P1 / after M2 | Copy transcript and plain-text download use the retrieved transcript, report failures and do not fabricate content. |
| NEXT-03 | P1 / after M2 | Transcript search highlights/navigates matches without changing the stored transcript. |

The [implementation plan](IMPLEMENTATION_PLAN.md) provides small UI-first delivery steps, an explicit UI approval gate and staged backend integration; this document sets behavior and acceptance gates rather than prescribing that task-by-task sequence.
