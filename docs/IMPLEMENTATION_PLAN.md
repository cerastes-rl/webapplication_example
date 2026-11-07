# SSScribe incremental implementation plan

## Scope and baseline

This is a delivery plan, not a claim of implemented functionality. [Requirements](REQUIREMENTS.md) define acceptance; [UI research](UI_RESEARCH.md) informs presentation; [AGENTS.md](../AGENTS.md) supplies implementation constraints. Requirement IDs below refer to `REQUIREMENTS.md`.

The **SSScribe frontend preview is implemented for review**, using React 19/TypeScript/Vite, plain CSS, Oxlint, navy-blue accents and light/dark themes. It has a persistent shell, Upload/History navigation, run details, a mock identity and browser-only lifecycle simulation. It starts signed in on History; no file bytes are read or transferred. `backend/main.py` still only exposes `GET /api/health` (`{"status":"OK!"}`). There is no typed API client, backend auth, persistence, seeding or worker. `frontend/package.json` has `dev`, `build`, `lint`, `preview`, **no test script**; no committed automated application suite exists. Backend requirements lack SQLAlchemy/TestClient tooling. Existing `.gitignore` still needs application-data exclusions before persistence is generated.

### Progress and immediate next work

| Stage | Current state |
|---|---|
| Steps 1–2: shell/History and details | Implemented in `src/App.tsx` and `src/components.tsx`; browser/focus review pending. |
| Step 3: preview interactions | Upload/options, mock sign-in/out, cancel, processing retry and shared timer implemented; fixtures/transitions are in `src/preview.ts`. Not yet the proposed async data-source abstraction. |
| Theme/branding | SSScribe, navy accents and top-bar dark-mode toggle implemented. Theme tokens live in `src/index.css`; preference uses localStorage key `ssscribe-theme`, falling back initially to system preference. |
| Step 4: acceptance | Lint/build and ad hoc lifecycle assertions have passed. Browser/light/dark/accessibility review, committed interaction tests and complete scenario controls remain. UI approval has not been recorded. |
| Steps 5–10 | Planned only; do not start backend integration before UI approval. |

Current scenario controls cover normal/empty/error History and a 1.5-second loading state. Begin upload/retry exposes active states; there is no dedicated missing-run, upload-failure or retry-failure selector. The History table scrolls locally on narrow screens. Focus moves to main on navigation, not back to the originating row. These are review/gap items, not claims of finished acceptance. See the [frontend guide](../frontend/README.md) for the reproducible walkthrough.

The detailed slices below retain their original incremental intent. Proposed paths/refactors are future suggestions where they differ from the actual files listed above; do not create unnecessary new modules just to match the original sketch.

Keep pnpm, the Python `backend/.venv` and requirements workflow, React StrictMode, and the current Vite `/api` proxy to `http://localhost:8000`. Keep ports 5173/8000 and `main:app` startup compatibility. No separate Node server, large UI/state framework, cloud calls or orchestration. Proposed paths are suggestions, not a mandate to build every abstraction up front. Each numbered step should be a small independently reviewable change; split larger steps into tests/service/UI commits if needed.

**Sequence:** static dashboard → read-only transcript → preview interactions → full UI scenario/accessibility review → **stop for UI approval** → read API integration spike → SQLite-backed reads → mock session → real uploads → asynchronous jobs → connected acceptance. Backend completeness is not a prerequisite for UI work.

## Resolved product and architecture decisions

The following records resolved product decisions, aligned with the requirements and UI research. Shell/navigation/themes and simulated interactions are implemented as noted above; real transfer, SQL persistence and worker behavior remain targets. Requirement IDs link to current acceptance criteria, not a claim that all criteria pass.

### Application shell and site map

The signed-in application has a persistent top banner and left navigation panel. The banner contains the logo at the far left, SSScribe title, dark-mode toggle, local-demo indicator, current identity, and a sign-out button at the far right. Use navy accents with theme tokens for every surface/control. The theme toggle also remains available on sign-in, remembers preference when storage is available, and does not persist run data. Sign-out remains available on Upload, History and run details; it is not shown as an authenticated action on the sign-in screen. The sidebar has exactly two primary destinations: **Upload** and **History**, with a visible active-page indication. On narrow screens, navigation may collapse/reflow while remaining accessible.

```text
Sign-in
    |
    v
Signed-in application shell
|--- Top banner: logo | SSScribe | Dark mode | local demo | user | Sign out
|--- Sidebar
|    |--- Upload
|    |--- History
|
|--- Upload page
|    |--- Choose one file; filename, size and validation
|    |--- Number of speakers and transcription settings
|    |--- Begin upload
|
|--- History page
|    |--- All submitted runs, including active uploads
|    |--- Status/progress and available actions
|    |--- Open run details / completed transcript
|
|--- Run details (opened from History, not a third sidebar item)
     |--- Full metadata, saved options, status and errors
     |--- Read-only transcript when completed
     |--- Appropriate retry action and Back to History
```

Upload collects the file, requested speaker count and settings before submission. Current controls are Unknown/Automatic (default) or 1–10 speakers, English only, and speaker labels/timestamps (both default on). Future service support and allowed ranges need validation during integration. Save selected options even though local transcription is simulated. Do not imply that options cause genuine diarization, timing or language recognition in the mock.

History includes **all runs**, not just completed uploads. Desktop columns are Run ID, filename, submitted date/time, size, requested speaker count, settings (individual columns where space permits), status and actions. Current preview shows its complete short Run ID in the combined filename/ID column and details. Future longer stable IDs may be shortened in the table with full value in details; internal storage locations are never columns. Narrow layouts can use cards or place settings in details. Loading, empty, unavailable and no-longer-found states remain distinct. Run details expose full ID, requested settings, relevant timestamps, attempt count and helpful failure information. Search/filter/pagination and transcript copy/download remain later improvements.

### Run identity, lifecycle and navigation

A **run** is one file submission plus its saved transcription options. Create its stable `run_id` in SQL before transferring bytes so History can display it immediately. Keep `file_id`/storage metadata separate from processing job/attempt metadata. Processing retries retain the Run ID, stored recording and options; a future re-run with different settings creates a new run rather than rewriting historical options. Upload retries restart the transfer and may retain the run through a fresh upload authorization; the exact retry endpoint is an implementation contract decision.

```text
Begin upload -> create run -> start transfer -> navigate to History
                                  |
                                  v
                             Uploading
                                  |
                                  v
                    Finalizing (server confirmation)
                                  |
                                  v
                         Queued -> Processing -> Completed
                            failures -> Failed + failure stage
```

`uploading` is a run/upload state, not a transcription job state. Keep job states `queued`, `processing`, `completed`, `failed`; add a public run/upload state and `failure_stage` to distinguish transfer from processing failures. Finalizing may be a transient UI/upload stage, not a new job state. The preview already represents cancellation as `cancelled` and finalizing as `finalizing`; keep explicit outcomes in the eventual run DTO rather than silently removing rows. Its single browser `Run` type combines stages for presentation; M2 must introduce persisted upload/job distinctions and failure stage.

### Rudimentary large-file upload policy

- **Maximum file size: 4 GB (4,000,000,000 bytes inclusive).** The current picker enforces this decimal limit and a non-empty MP3/WAV extension allowlist. M2 must enforce the same limit on actual received bytes. Browser validation alone does not establish real 4 GB transfer support.
- Start with one single-request transfer per upload. No chunking, resume, parallel chunks or automatic retry. An interrupted transfer restarts from byte zero; after reload the user may need to select the file again.
- A shared upload manager in the persistent application shell owns the request and selected `File`, not the Upload page. Internal navigation to History or details must not abort it. Once the run is created and transfer starts, navigate to History and show it there.
- Use measured browser upload progress (e.g. XMLHttpRequest upload events), showing percentage and transferred/total bytes. Do not buffer the whole file in JavaScript. At 100% bytes sent, show finalizing until the backend confirms storage; sent bytes alone do not mean a durable queued recording. Preview-mode progress is explicitly simulated.
- Stream request bytes incrementally into a generated temporary file on the backend; never read 4 GB into memory. Enforce claimed size, actual byte count and the maximum, and handle insufficient disk space/write failure. Review Vite/proxy/server request limits and timeouts for the chosen local transport. Production hosting limits will need a separate review.
- Offer Cancel upload and explicit retry after failure. Do not confuse an upload retry (re-send bytes) with a processing retry (reuse stored bytes). A lost confirmation response should first be reconciled with server state before sending bytes again.
- Refresh, leaving the website, closing the tab/browser, connection loss or device sleep can interrupt a transfer. Tab switching usually allows it to continue but is not guaranteed on suspended devices. Use best-effort browser leave warnings; they cannot guarantee protection. Sign-out during transfer warns and cancels it before clearing the UI. Backend jobs already queued continue without the browser.
- Detect request disconnects and mark failed/interrupted transfers when possible. Recover stale uploading runs after backend restart, clean partial files, and allow explicit retry. Do not leave runs permanently uploading. Document a simple stale-upload rule that does not expire a healthy long-running 4 GB transfer. No background uploading after browser closure is promised.

### Storage boundaries: local now, Azure later

| Responsibility | Planned connected local implementation (not present today) | Eventual production equivalent |
|---|---|---|
| Metadata/run state | SQLite through SQLAlchemy | Azure SQL / SQL Server |
| Audio bytes | Local filesystem storage adapter | Private Azure Blob Storage |
| Queue/worker | Persisted SQLite jobs and one lightweight runner | Azure Queue Storage and worker |
| Authentication | Fixed-identity mock session | Microsoft Entra ID |
| Transcription | Fake adapter returning deterministic sample text | Azure transcription service adapter |

Store `storage_provider` and an object key/reference in SQL. Configuration resolves that key to a local root or Blob container; do not use original filenames as filesystem paths. Storage locations and service job IDs are backend-only metadata, excluded from History and public DTOs. Do not persist expiring SAS URLs as the durable identity of a recording or expose private storage credentials. In the local-only upload authorization response, a development upload URL is a transport endpoint, not disclosure of the underlying storage path or an Azure SAS.

After upload verification, the worker resolves the stored recording reference and saved options and calls the transcription adapter. The future local fake adapter produces sample text unrelated to uploaded audio; today the browser simply renders a shared sample fixture. In production the adapter must use the chosen Azure API's supported mechanism for reading the private blob, submit work, persist the external job ID, and retrieve completion/results asynchronously. Authentication/access details and Azure product limits remain future integration decisions, not current cloud setup work.

### Transcript persistence decision

**Store readable transcript text in SQL initially.** Use SQLite `TEXT` through SQLAlchemy locally; use Unicode-capable `NVARCHAR(MAX)` in Azure SQL/SQL Server rather than assuming `VARCHAR(MAX)` is appropriate for all transcript languages. A 4 GB audio limit does not imply similarly sized transcript text.

Associate a transcript with its run (and relevant job/file references), storing its ID, text and creation timestamp. Save transcript and completed state transactionally. FastAPI returns the stored text to the detail view; no result file is required for the first implementation.

A future hybrid design may retain readable text in SQL while keeping the original Azure result JSON, detailed word timings/confidence data and generated exports in Blob Storage, referenced from SQL. That is optional future work, not a requirement to duplicate all results now. Keep artifact storage decisions behind backend services so the UI remains unchanged.

### Delivery and acceptance implications

The UI-first sequence and explicit approval gate remain unchanged. The shell, History, details and dedicated Upload page now exist; finish scenario gaps and browser review before integrating the backend. Connected acceptance must additionally verify:

- Begin upload creates a visible run before bytes finish transferring; selected options persist and are displayed correctly.
- Upload continues across internal navigation; progress is measured in connected mode and finalizing is distinct from queued.
- Streaming has bounded memory usage; exact size limit/one-byte-over checks use synthetic streams or injected small limits in routine tests, plus a documented optional large-file smoke test rather than allocating 4 GB in every test.
- Interruption, cancellation, disk failure and restart produce recoverable states with partial-file cleanup; retry begins at zero. Healthy slow transfers are not falsely expired.
- Storage paths/keys and external service identifiers stay out of user-facing responses; completed sample text persists in SQL and survives restarts.

## 1. First visible slice: static recordings dashboard — implemented for review

**Requirements:** initial UI-01 notice, UI-02, UI-06–UI-08 (partial, not M1 completion).

- Delivered in `frontend/src/App.tsx`, `App.css`, `index.css`: persistent SSScribe/theme/user/sign-out banner, Upload/History navigation, explicit preview/no-real-transcription notice and History. Mock sign-in/out is now implemented too.
- Typed examples live in `src/preview.ts`; `StatusBadge` and shared visuals are in `src/components.tsx`, rather than the originally suggested separate component/type directories. History includes Run ID, filename, date, size, requested speakers/settings and statuses. Upload/retry now exercises the active states.
- Semantic table headers and native controls are implemented; narrow History uses local horizontal scrolling rather than cards. No router, component library or API dependency was introduced. Review long filenames, responsive layout and keyboard operation before accepting this slice.

**Deliverable/test:** dashboard viewable with only Vite running. Review at 320px and desktop, long-name rendering, status text, headings and focus styles; run lint/build. **Gate:** agree on the list hierarchy and spacing before adding more state. This slice deliberately does not satisfy all UI-01/UI-02 interactions.

## 2. Small read-only transcript slice — implemented for review

**Requirements:** UI-02 detail navigation, UI-04, UI-06–UI-08.

- Delivered as `RunDetail` in `src/components.tsx`; selection is an ID in `App.tsx`. Navigation uses a page-state switch without deep links or browser history integration.
- Completed details show metadata and readable sample text; incomplete views show state, and failed details offer retry. The shared sample transcript in `src/preview.ts` is intentionally the same for every run, unrelated to audio; settings only change its label/timestamp presentation.
- Back navigation exists and main receives focus on page changes. Return-to-origin row focus and heading-specific focus remain review/follow-up items. Do not claim per-recording transcripts or audio recognition.

**Deliverable/test:** keyboard open/back walkthrough for completed, queued, processing and failed examples; long transcript wraps without page-wide scrolling. Lint/build pass. **Gate:** review this minimal dashboard-to-document journey before adding auth/upload complexity.

## 3. Complete presentation-only interactions — implemented with remaining gaps

**Requirements:** UI-01–UI-05, UI-08; continue UI-06/UI-07.

Implement these as separate reviewable changes, not one large screen rewrite:

1. **Preview boundary/scenarios:** fixtures/transitions are already separated in `src/preview.ts`; `App.tsx` owns the timer/state and normal/empty/error selector. Add explicit missing-run, upload-failure and retry-failure controls if needed to close UI-05. The proposed async source interface is a future integration seam, not an existing module. Keep unavailable distinct from empty.
2. **Mock sign-in preview:** implemented inline in `App.tsx`, with a fixed identity, hidden signed-out details and clear mock labeling. Sign-out clears selection, confirms/cancels uploading/finalizing runs and pauses the remaining timer; sign-in resumes queued/processing simulation. Backend-independent execution is future M2 behavior, not today's browser behavior.
3. **Upload preview:** implemented as `UploadPage` in `src/components.tsx`, with policy constant in `src/preview.ts`. Preserve the implemented speaker/settings controls and decimal 4 GB MP3/WAV policy. Begin upload creates a preview run, starts explicitly simulated progress and navigates to History, where uploading/finalizing/queued and failure/cancellation scenarios are visible. Disable duplicate submission. Say explicitly “Preview only — file not uploaded or saved”; reload may reset everything. Do not send bytes or claim persistence. Empty state offers access to this form.
4. **Retry preview:** list/detail actions requeue the failed example, preserve run/options and remove stale error text. Transition logic is in `preview.ts`, driven by the shell timer. Repeated retry has no effect once queued. Explicit retry-failure scenario remains to be added; current retry always proceeds to completion.

**Deliverable/test:** documented scenario names and how to select them without changing markup; every UI-05 state independently reproducible. Check absent/empty file, unsupported type, exact size boundary/one byte over, duplicate submission and sign-out during a pending simulation. Lint/build after each slice. **Gate:** sign-in, Upload, History and details work without FastAPI and every simulated action is visibly labeled.

## 4. Finish M1 scenarios and accessibility — STOP / UI approval gate

**Requirements:** all UI-01–UI-09, including SSScribe/navy branding and the persisted light/dark theme preference.

- Complete responsive styling and all preview error/retry states before adding any backend routes. Add focused interaction tests under `frontend/src/` for sign-in visibility, file validation/pending behavior, detail selection/back and retry. Recommended tooling, only when these tests are introduced: Vitest + React Testing Library + a DOM environment; add a documented `test` script then. Do not add a second linter or an end-to-end framework just to render the first slices.
- Perform a keyboard-only journey through sign-in, picker/submit, list/detail, retry, back and sign-out. Verify meaningful focus, no traps, semantic controls/headings/labels, associated input errors, full accessible filenames, text status labels, contrast ≥4.5:1, reduced-motion support and restrained live announcements. Use the dedicated Upload page within the persistent shell rather than an upload modal.
- Review 320px and desktop, long names/transcripts and every scenario in both light and dark themes; verify the top-bar toggle on sign-in too. Loading, empty, unavailable and missing-file states must remain distinct. Record remaining issues and review evidence in the implementation PR/review notes; explain preview startup/scenario selection in README.

**Acceptance gate:** lint/build and newly added focused tests pass; reviewer demonstrates UI-01–UI-09 with FastAPI stopped. **STOP: obtain explicit user/reviewer UI approval before step 5 or other connected/backend work.** Unresolved usability/accessibility issues are fixed here, not deferred until backend integration. M1 approval does not mean audio was uploaded, saved or transcribed.

## Typed preview seam and recommended contracts

Settle only the read types needed for steps 1–2 initially. Expand at the relevant step; do not build a generic repository/provider framework. The following are **recommendations to confirm**, not already-final contracts or new requirements:

### Small data boundary

- Export plain TypeScript DTOs and a narrow async source interface: initially `listFiles`, `getFile`, `getTranscript`; later add `signIn`, `getCurrentUser`, `signOut`, `authorizeUpload`, `uploadBytes`, `completeUpload`, `retryFile` as needed. Components receive data/actions and render state, rather than import fixtures or call `fetch`.
- Preview source satisfies the same semantics with deterministic scenarios and disposable memory. No localStorage database, pretend persisted uploads or synthetic authoritative timestamps generated in connected components.
- In step 5, implement `src/api/client.ts` and `src/data/apiSource.ts`. One explicit app-composition choice selects preview or API source. API exceptions **never** switch sources. Connected builds must not load preview fixtures/scenario controls; remove preview imports from the connected entry path. Preview may remain as an explicitly separate development-only review mode, never an automatic fallback.
- Use relative `/api` requests, `AbortSignal` and a typed error carrying HTTP status/code/message; handle non-JSON/network failures gracefully. TypeScript types are not runtime validation; check essential response structure and use backend Pydantic/OpenAPI as the contract reference. Avoid code generation/dependencies initially.

### Suggested DTOs / HTTP decisions

| DTO / operation | Recommended shape or decision |
|---|---|
| `JobStatus` / run state | Job states remain `'queued' | 'processing' | 'completed' | 'failed'`. Persist run/upload state before transfer, including uploading and transfer failures; expose `run_id`, requested speakers/settings and failure stage in History DTOs. Finalize cancellation/finalizing representation before coding. |
| `FileDto` | `id`, `filename`, `content_type`, actual `size_bytes`, UTC ISO `created_at`, `uploader_id`, `is_example`, `job: JobDto`. No object path or absolute filesystem location. |
| `JobDto` | `id`, `status`, `attempts`, `created_at`, nullable `started_at`, `finished_at`, `error_message`. Recommend one current job row per file; retry requeues it and worker claim increments attempts. Document that attempts counts started attempts. |
| `TranscriptDto` | `id`, `file_id`, `text`, `created_at`, `is_sample: true`. Plain text is sufficient; optional speaker/timestamp formatting remains labeled sample data. |
| Read responses | `GET /files` → `{files: FileDto[]}` in stable newest-first order (ID tie-break); detail → `FileDto`; transcript → `TranscriptDto`. No pagination needed for this small demo. Unknown file 404; known non-completed transcript 409. |
| Errors | `{"error":{"code":"…","message":"…"}}`, optional field details. Normalize validation exceptions too: 422 metadata validation, 401 session required, 404 missing resource, 409 state conflict, 413 too large, 415 unsupported format. Preserve public health JSON exactly. |
| Session | `UserDto: {id, display_name, email}`; sign-in/me → `{user: UserDto}` (200), sign-out → 204. Recommend opaque HttpOnly SameSite=Lax local cookie and in-memory session registry. Browser refresh restores a session; backend restart may require sign-in again, without losing recordings. Local HTTP cookie is not production security. |
| Upload authorization | Input `{filename, content_type, size_bytes, speaker_count, settings}`; persist a run before transfer; 201 → `{run_id, upload_id, transport: 'local', method: 'PUT', upload_url, constraints: {max_size_bytes, allowed_extensions}}`. URL is relative `/api/dev/uploads/{upload_id}`, not a SAS token; never expose paths. |
| Byte transfer / completion | PUT stores bytes then returns 204. Complete input `{upload_id}` → 202 `{file: FileDto}` with queued job. Repeated confirmation returns the same IDs/current state, not a fresh queued claim. Retry → 202 `{file: FileDto}`, only from failed. |

**Upload policy:** non-empty single `.mp3`/`.wav` file, maximum **4 GB (≤4,000,000,000 bytes)**, matching current UI checks. The following server MIME/metadata normalization is still a recommendation to implement; it is not performed by today's extension/size validator. Normalize MIME case/parameters; allow `audio/mpeg`, `audio/wav` and `audio/x-wav` alias only with matching extension. If browser MIME is empty, infer from a permitted extension; reject contradictory non-empty MIME rather than silently overriding. Apply the same rules to authorization/actual transfer, check claimed versus received length, and reject empty/over-limit bytes. This is metadata validation, not audio decoding or a security scanner. Confirm and document policy once, then align UI/server tests. Synthetic seed records are marked examples, not purported uploaded audio.

## 5. Short read-only FastAPI integration spike (after UI approval)

**Requirements:** API-01/API-02 read subset, INT-01 error/selection behavior; not M2 completion.

- Add Pydantic DTOs in `backend/schemas.py` and read handlers/services (`backend/routes/files.py`, `services/recordings.py` as useful). Preserve health and `main:app`. Implement list/detail/transcript using **temporary explicitly labeled static read responses only**.
- Wire the typed API source to the approved list/detail UI through the unchanged proxy. Disable unavailable connected auth/upload/retry actions with an honest integration-spike explanation; do not simulate server mutations. Test 404, incomplete 409, unavailable server and request races when switching details.
- Add isolated read contract tests in `backend/tests/test_reads.py`; recommend standard-library `unittest` plus FastAPI TestClient, adding `httpx` to a small `backend/requirements-dev.txt` when needed. Validate Pydantic/OpenAPI shapes against frontend types.

**Deliverable/gate:** real browser network requests display read data and errors, never frontend fallback records. Review JSON shapes. **Time-box to this step:** static backend fixtures are an integration aid only, removed in step 6; no in-memory production-like write store or claim of persistence. Until step 7, unprotected reads are also an explicitly incomplete local spike, not final auth behavior.

## 6. Replace static reads with authoritative SQLite persistence

**Requirements:** DATA-01–DATA-03, API-01/API-02 read behavior, initial QA-01.

- Add SQLAlchemy through `backend/requirements.txt`, then `backend/database.py`, `models.py`, `services/recordings.py`, `seed.py`. Keep synchronous SQLite operations short; use request/worker-scoped sessions, not a shared global session.
- Create runs/files/jobs/transcripts, including saved speaker count/settings, run/upload lifecycle, internal storage provider/object key and readable transcript `TEXT`; add durable upload-authorization metadata when step 8 needs it. Use foreign keys/uniqueness (one current job and transcript per file) and atomic writes. Simple create-tables initialization is enough for the prototype; document any explicit dev reset rather than silently destroying data.
- Recommend `backend/data/app.db` and `backend/data/uploads/`; add root ignore coverage before generating any DB/bytes, including partials and SQLite sidecars. Generated object keys never use the original filename as a path.
- Seed stable IDs once: a labeled completed synthetic example with transcript and a failed example that can succeed on retry. Mark these as examples without pretending seed audio was received. Remove static route response fixtures; all read handlers now query SQLite.

**Deliverable/test:** temporary-directory SQLite tests for list/detail/transcript, seed idempotency, relationships and persistence across app recreation. Inspect public DTOs for path leakage. **Gate:** restart keeps data without duplicate seeds; no connected read path uses static fixture lists. Worker/upload work is still deferred.

## 7. Connect the mock session

**Requirements:** AUTH-01, UI-01 connected behavior, API-01/API-02, INT-01, QA-01.

- Add a clearly named `MockAuthAdapter` (`backend/adapters/auth.py`), auth routes and a shared required-user dependency on all file/upload/transcript/retry routes. Health and sign-in remain public. Use the confirmed session recommendation above; sign-out invalidates the session server-side.
- Replace preview identity actions in API mode; check `/auth/me` at startup before loading records. A 401 clears protected display state; sign-out aborts requests/stops polls and prevents late responses repopulating details. No OAuth or localStorage token scheme is needed.

**Deliverable/test:** unauthenticated protected route matrix returns 401; sign-in/read/refresh/sign-out works, stale cookie fails, persisted recordings survive sign-out. **Gate:** identity shown by UI comes from FastAPI, and session limitations are documented.

## 8. Actual local byte upload and queued confirmation

**Requirements:** UP-01–UP-03, DATA-01/DATA-03, API-01/API-02, QA-01.

- Introduce `LocalFileStorageAdapter` (`backend/adapters/storage.py`) with store/verify/delete methods and an upload service (`services/uploads.py`). Keep authorize, byte transfer and complete separate from UI and storage internals, preserving the future direct-to-Blob replacement point.
- Implement the confirmed authorize → PUT development transport → complete flow. A streaming PUT avoids adding multipart tooling. Enforce actual byte count while reading, validate metadata, write to a generated temporary path and atomically finalize after validation; clean up failed/partial writes. Reject nonexistent authorization, absent bytes, mismatched size/type and overflow correctly.
- Persist authorization/completion mapping so repeated confirmations after restart return the same file/job. Authorization first creates the visible run and pending file metadata. On completion, transactionally finalize that existing run/file, create its queued job and bind the upload ID exactly once; enforce uniqueness/conditional updates for concurrent requests. SQLite and filesystem are not one transaction: document cleanup/reconciliation for orphaned files if a DB write fails. Recommend deleting unconfirmed uploads/partials older than 24 hours on startup; never delete confirmed files. Keep state/byte integrity if authorization expires mid-transfer.
- Connect the dedicated Upload page through a shell-level upload manager; start a measured XMLHttpRequest transfer and navigate to History without cancelling it. Show bytes/percentage, Cancel, and a finalizing stage until server confirmation. Stream to disk with bounded memory, enforce the 4 GB maximum, and handle disconnect/disk failures. Recover stale uploading runs without expiring healthy long transfers; warn on sign-out/leave and clean partials. Confirmed queue state must come from the returned server record, not a client timer. Preserve useful failure context and allow safe retry of confirmation after a lost response. A retry of already stored bytes must not corrupt a confirmed object.

**Deliverable/test:** use small real test byte payloads under the documented metadata-only policy. Test empty, exact limit/one over, MIME alias/empty/mismatch, unknown/missing/partial bytes, safe filenames, failed writes and repeated/concurrent complete. Assert stored bytes equal sent bytes and persist across restart; no queued record on failed transfer. **Gate:** an upload genuinely exists locally before UI reports queued. Jobs may remain queued until step 9; label this intermediate limitation honestly.

## 9. Persisted asynchronous simulation, retry and recovery

**Requirements:** JOB-01–JOB-03, DATA-01/DATA-02, API-02 retry, QA-01.

- Add `SqliteJobQueueAdapter`, `FakeTranscriptionAdapter` and a small runner (`backend/adapters/jobs.py`, `transcription.py`, `worker.py`). Minimal service methods can be `enqueue`, `claim_next`, `complete`, `fail`, `retry_failed`, `recover_interrupted`; no plugin framework or external queue.
- Start/stop one runner via FastAPI lifespan. Use a background asyncio task with nonblocking waits and short DB transactions; do not hold request handlers or database locks during simulation. Conditional claims prevent double processing; worker owns its sessions. Persist processing before work, then transcript + completed status atomically, or a helpful failure message.
- Recommend visible short delays (e.g. 2 seconds queued, 4 seconds processing), documented as simulation only. Normal uploads produce deterministic sample text unrelated to audio contents. The seeded failed example completes when retried; no filename-dependent magic required.
- Retry accepts only failed state, preserves file/object identity, clears stale attempt errors/times and queues once; attempt count increments at claim. Conditional updates make concurrent retries conflict rather than creating two active jobs. If a repeated retry arrives after requeue, return 409 consistently.
- On startup recover interrupted processing jobs to queued, clear per-attempt stale state and resume queued records. Recommend recovered work counts as a new started attempt, with prior attempt already counted. Unique transcript-per-file plus transactional completion prevents duplicate results. Shutdown cancels the runner cleanly; recovery still handles abrupt exit. Explicitly support one backend process only, not multiple Uvicorn workers.

**Deliverable/test:** deterministic worker tests with controlled ticks/clock rather than long sleeps: all transitions, failure→retry→completion, duplicate claims/retries, transcript unavailable until completion, recovery of processing/queued work, no duplicate transcript. **Gate:** requests return promptly, statuses/errors/results survive restart, and files are never lost in recovery.

## 10. Finish connected behavior and M2 acceptance

**Requirements:** INT-01, QA-01, DOC-01; recheck all M1/M2 P0 IDs.

- Add conservative non-overlapping polling (recommend 3 seconds) only while signed in with active queued/processing jobs. Stop on no active jobs, sign-out or unmount. Retry transient errors without a tight loop; expose explicit recovery. Keep selection stable, abort/ignore stale detail requests and never display another file's transcript. Handle job completion in an open detail view.
- Remove temporary spike labels/static read data and any connected preview imports; keep sample-result and local-demo labels. Connected API outages always show errors. Test sign-out during upload/poll and rapid detail changes.
- Finish focused UI/API interaction coverage; update README to actual commands, storage/seed/reset behavior, session/restart limitations, format policy, simulation timings, deterministic retry example, cleanup and future Azure replacement points. Document stopping backend before destructive local reset. Keep P1 search/copy/download out of this gate.

**Final end-to-end checklist (no Azure credentials):**

1. Start FastAPI and Vite on 8000/5173; public health remains unchanged. Signed-out protected requests return 401; UI hides details.
2. Sign in, see labeled seed examples, open a completed transcript, and back out with keyboard focus preserved.
3. Begin upload with speaker count/settings; verify immediate History navigation and a stable visible Run ID, measured uploading progress continuing across internal navigation, finalizing→queued→processing→completed, actual stored bytes and the retrievable SQL-backed labeled sample result. No invented upload/transcription percentages.
4. Retry seeded failure; same file/bytes, incremented attempt, one queued job and eventual completed transcript.
5. Verify unsupported, empty, oversized and contradictory metadata rejection; missing ID, incomplete transcript, duplicate confirmation/retry, upload failure and backend-unavailable recovery.
6. Reload browser and restart FastAPI; bytes, metadata and transcripts remain; seeds do not duplicate. Interrupt processing and verify recovery. Session may require sign-in after backend restart under the recommended in-memory session policy.
7. Stop backend while signed in: error, **no fixtures**. Sign out during requests: no stale protected content/polling. Repeat all UI-06/UI-07 narrow-screen, keyboard and announcement checks against API states.
8. Run the documented tests/lint/build and `git diff --check`; inspect Git status for generated data/secrets. Record reviewer acceptance of M2; M1 approval alone is not completion.

## Commands and verification discipline

These commands are verified **against repository configuration**, not executed as part of this docs-only task. Do not infer a test suite exists today.

```bash
# From repository root; existing package scripts
cd frontend
pnpm dev --host 0.0.0.0 --port 5173 --strictPort
# In a separate frontend terminal when validating implementation:
pnpm lint
pnpm build                 # tsc -b && vite build

# From repository root; reuse the existing virtual environment
cd backend
.venv/bin/python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

`.vscode/tasks.json` and `.devcontainer/start-dev.sh` already use these startup forms. Check whether servers are already running before starting duplicates. Vite proxies `/api`; do not replace the proxy with a second JS server or direct browser DB access. Dev-container ports are already forwarded. README contains first-run environment/dependency setup; update dependencies through pnpm and the existing Python requirements workflow only when implementing the relevant step. The startup helper installs Python requirements only when creating a missing venv, so existing environments must be updated explicitly after dependency changes.

**Proposed test commands, only after adding the tooling/tests in steps 4–5:** `cd frontend && pnpm test --run` for the new Vitest script; `cd backend && .venv/bin/python -m unittest discover -s tests -v` for unittest/TestClient tests. Add `httpx` to the documented dev requirements and use isolated temporary DB/storage with worker timing controlled by tests. SQLAlchemy is a later runtime dependency; no multipart package is needed with the recommended raw PUT transport. Confirm package compatibility with the dev container's Python version when adding dependencies. Do not document nonexistent commands as currently available.

For documentation-only updates, check links, source consistency and `git diff --check`; no dependency installs or server startup is needed. Existing lint/build checks are available, but proposed test commands above are not yet configured.
