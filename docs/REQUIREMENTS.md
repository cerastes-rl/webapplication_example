# SSScribe requirements

The [implementation matrix](IMPLEMENTATION_PLAN.md#local-implementation-matrix) records local coverage and Azure/live equivalents. The [API/data flow](API_DATA_FLOW.md) traces the current calls; [README](../README.md) provides startup and checks.

## Current local behavior

| Area | Requirement and implemented coverage |
|---|---|
| Identity | Exact `austin`/`john` keys establish in-memory HttpOnly-cookie sessions. Browser refresh restores the session; API restart requires sign-in. Protected run routes enforce ownership; unknown and other-owner IDs return 404. |
| Workspace | React state selects Upload, History and details. The shell owns session, History and one active upload. Light/dark preference persists under `ssscribe-theme` where available. |
| Input | Accept one non-empty TXT file up to **1,000,000 bytes inclusive**. Save English, Automatic/1–10 speakers and labels/timestamps (default on) before transfer. Speaker/label/timestamp preferences are saved metadata; locale is sent to Speech. Speaker/timestamp output is not implemented. |
| Transfer | Create one run, PUT bytes directly to storage using XHR, show measured progress, then ask the API to HEAD-verify the exact size. Internal navigation preserves the transfer. Each new submission creates a new row without automatic creation retry. |
| Cancellation and interruption | Abort the local transfer and conditionally persist cancellation before DELETE. Failed/interrupted transfers require reselection and a new run. Completed/cancelled uploads cannot be overwritten by late upload state updates. A late PUT can still leave orphaned bytes. |
| History | Read all owned runs after sign-in/restoration, on entering History, after mutations and on Refresh. React handles filename search, time/size sorting and pagination. Opening Upload/details does not reload the list. Stale responses cannot restore signed-out data. |
| Persistence | One SQLite `runs` table stores ownership, source/options, upload/transcription stages, private storage/Speech identifiers, transcript, errors and UTC timestamps. Explicit initialization creates missing tables and preserves rows; FastAPI does not initialize or upgrade SQL. |
| Background processing | One lifespan worker runs an ordinary sequential loop in a background thread: submit, poll and import selections in run-ID order, then wait two seconds using a stop event. Short SQL operations finish before HTTP calls; HTTP runs off the API event loop. Shutdown finishes the current run and stops before the next one. |
| Recovery | Persist `submission_uncertain` before submitting; confirmed jobs save provider ID/status. Resume saved active jobs and imports after API restart. Retry transient poll/download errors on later cycles; missing jobs/results or malformed transcript data fail. Uncertain submissions are not automatically resubmitted. |
| Transcript | Import readable `combinedRecognizedPhrases[].display` text and completion atomically. Fetch stored text separately for details; display/copy/download it verbatim. |
| Storage mock | Independent PUT/HEAD/DELETE service on :8001, backed by persistent local files. Stream into temporary files, verify actual length and atomically replace the destination. Original filenames are storage keys, so same-name uploads overwrite bytes across users. |
| Speech mock | Independent service on :8002. Read UTF-8 text, append one fixed sentence, produce result/report JSON; support submit, status, paginated List Files and downloads. Jobs wait 10 seconds, run 20 seconds, then finish. Terminal job records expire after 30 minutes; files persist. Restart clears jobs. |
| API contracts | Pydantic models, numeric run IDs and predictable `{error: {code, message}}` errors. Protected responses use `Cache-Control: no-store`. Normal run responses omit private storage/Speech IDs and transcript bodies. See the [route table](IMPLEMENTATION_PLAN.md#application-contracts). |
| Development | React/TypeScript/Vite with pnpm, Oxlint and plain CSS; FastAPI/Uvicorn and the shared Python venv/requirements. VS Code tasks start services and initialize SQL. Keep runtime data, secrets, dependencies and build output out of Git. |

Upload stages are `uploading`, `completed`, `failed` and `cancelled`. Transcription stages are `not_started`, `queued`, `running`, `importing`, `completed`, `failed` and `submission_uncertain`. The raw provider status remains separate in `speech_status`.

## Acceptance status

The UI/auth interaction review was approved on **2026-11-09**. Connected browser interaction, keyboard/accessibility, contrast, theme and responsive review remain pending; CSS/semantic controls alone do not complete that review.

Automated coverage includes authentication/ownership, whole-list and transcript reads, upload policy boundaries, streamed bytes/progress/abort, guarded completion/cancellation, outages, worker transitions/failures and restart recovery. Real-HTTP tests exercise upload through transcript import. Run the [documented lint/test/build checks](../README.md#checks).

Remaining connected acceptance tasks:

- Exercise sign-in/restore/sign-out, upload, internal navigation, Refresh and completed transcript export in a browser.
- Review interrupted uploads, lost confirmation, service outages, cancellation and stale-response behavior through the UI.
- Verify keyboard access, focus behavior, labels/error announcements and reduced-motion behavior.
- Review 320px and desktop layouts, long filenames, contained table scrolling and both themes; verify normal-text contrast of at least 4.5:1.

## Planned work

- Manual processing retry and reconciliation of uncertain submissions.
- Automatic History refresh while backend processing changes; the mechanism remains open.
- Status filters and transcript search. Filename search and transcript copy/download already work.
- Live audio policy, production Speech option mapping and speaker/timestamp output.
- Source/result retention and orphan cleanup policy.
- Azure deployment, production authentication, signed storage access and live service adapters.

Production direction and unresolved decisions belong in the [implementation plan](IMPLEMENTATION_PLAN.md).
