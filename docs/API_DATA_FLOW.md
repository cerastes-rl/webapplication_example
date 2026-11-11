# API calls and data flow

This is the **implemented local flow**: React/Vite, FastAPI, SQLite and the two HTTP mocks. See the [implementation matrix](IMPLEMENTATION_PLAN.md#local-implementation-matrix) for Azure/live equivalents and [application contracts](IMPLEMENTATION_PLAN.md#application-contracts) for routes.

Every browser `/api` request passes through Vite's proxy on :5173 to FastAPI on :8000; the diagram labels that shared route once. Browser file bytes go directly to storage :8001. The application worker calls Speech :8002. Protected API routes resolve the cookie session, and run operations check ownership. SQL connections close before service HTTP calls.

## Complete local sequence

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant UI as React App and API clients
    participant API as FastAPI :8000 via Vite /api proxy
    participant DB as SQLite runs table
    participant Storage as Storage mock :8001
    participant Worker as Application Speech worker
    participant Speech as Speech mock :8002

    Note over UI,Speech: PART 1 - Service startup and page load or refresh
    Note over API,DB: Explicit database.py / VS Code task initializes SQL before use
    API->>Worker: lifespan() starts run_worker(path, stop) in a background thread
    UI->>API: App session effect → getCurrentUser() → GET /api/auth/me
    API->>API: me() → get_current_user() reads HttpOnly session cookie
    alt Valid in-memory session
        API-->>UI: 200 User
        UI->>UI: setUser(); loadHistory()
    else No session or API restarted
        API-->>UI: 401 → getCurrentUser() returns null
        UI->>UI: Show SignInForm
    else Service/request error
        API-->>UI: Error → show auth error
    end

    Note over User,DB: PART 2 - Manual sign-in and History reads
    opt User submits the sign-in form
        User->>UI: submitSignIn(event)
        UI->>API: signIn(accessKey) → POST /api/auth/sign-in
        alt Exact austin or john key
            API->>API: sign_in(): replace old session token; set HttpOnly cookie
            API-->>UI: 200 User
            UI->>UI: resetWorkspace(); setUser(); refreshHistory()
        else Invalid key
            API-->>UI: 401 → display sign-in error
        end
    end
    opt Valid restore/sign-in, History entry, mutation or Refresh
        UI->>API: loadHistory() → listRecordings(signal) → GET /api/runs
        API->>DB: list_runs() → database.list_runs(path, user.id)
        DB-->>API: All owned public run fields, newest first
        API-->>UI: 200 Run[]
        UI->>UI: Ignore aborted/stale session response; setRuns(); local search/sort/page
    end

    Note over User,Storage: PART 3 - Create, transfer and confirm one TXT upload
    User->>UI: UploadPage validates file/options → beginUpload(file, settings)
    UI->>UI: Create AbortController; set one active upload
    UI->>API: authorizeUpload() → POST /api/uploads/authorize (metadata only)
    API->>DB: authorize() → create_upload(): INSERT owned run/options
    DB-->>API: New numeric run_id; uploading / not_started
    API-->>UI: 200 run, unsigned upload_url and PUT headers
    UI->>UI: saveRun(); open History; refreshHistory()
    UI->>Storage: putFile() → XHR PUT raw File, directly to :8001
    Storage->>Storage: put_blob(): stream temporary file; verify length; atomic replace
    alt PUT succeeds
        Storage-->>UI: 201; XHR reports measured upload progress
        UI->>API: completeUpload(id) → POST /api/uploads/complete
        API->>DB: complete() → upload_record(): owned current state
        API->>Storage: inspect_or_delete(key, HEAD)
        Storage-->>API: Content-Length or 404/error
        alt Exact stored size and upload still eligible
            API->>DB: update_upload(): conditional upload completed
            DB-->>API: Current run; transcription remains not_started
            API-->>UI: 200 Run → saveRun()
        else Missing/wrong bytes, cancellation or service error
            API-->>UI: 409/503 → display error; require reselection/new submission
        end
    else PUT fails
        Storage-->>UI: HTTP/network error
        UI->>API: failUpload(id) → POST /api/runs/{id}/upload-failed
        API->>DB: failed() → guarded update_upload(failed)
        API-->>UI: Current run or error; original row stays in History
    else User cancels during transfer
        User->>UI: cancel(id): confirm; abort active XHR
        UI->>API: cancelUpload(id) → POST /api/runs/{id}/cancel
        API->>DB: cancel() → guarded update_upload(cancelled)
        opt Cancellation persisted
            API->>Storage: inspect_or_delete(key, DELETE)
            Storage-->>API: 202 or missing blob; outages return 503
        end
        API-->>UI: Current cancelled run or error
    end
    UI->>UI: Clear active upload; refreshHistory() after mutation
    Note over UI,Storage: Interrupted/unconfirmed uploads require reselection; a late PUT can leave orphaned bytes

    Note over API,Speech: PART 4 - Background processing continues independently of the page
    loop Each cycle: submit pass, poll pass, import pass; wait two seconds
        Worker->>DB: process_cycle() → processing_runs(path, phase), ordered by run_id
        DB-->>Worker: Eligible runs for that phase
        opt Completed upload with not_started transcription and no job ID
            Worker->>DB: process_run(submit) → claim_submission(): submission_uncertain
            Worker->>Speech: speech_client.submit(run) → POST /speechtotext/transcriptions:submit
            alt Confirmed submission
                Speech-->>Worker: 201 job self/status
                Worker->>DB: save_speech_status(): save job ID, raw status and mapped stage
            else Known 4xx rejection except 408
                Worker->>DB: save_processing_error(): failed
            else Ambiguous outcome
                Worker->>DB: save_processing_error(): retain submission_uncertain
            end
        end
        Note over Storage,Speech: Speech reads shared local TXT path; its own timer advances jobs and writes result files
        opt Saved job has absent, NotStarted or Running status and is not failed
            Worker->>Speech: speech_client.poll(id) → GET /speechtotext/transcriptions/{id}
            Speech-->>Worker: NotStarted / Running / Succeeded / Failed
            Worker->>DB: save_speech_status(): queued / running / importing / failed
        end
        opt Succeeded job still importing
            Worker->>Speech: speech_client.transcript(id) → GET /speechtotext/transcriptions/{id}/files
            Speech-->>Worker: File kinds, contentUrl and optional @nextLink
            Worker->>Speech: Follow pagination until Transcription; GET links.contentUrl
            Speech-->>Worker: Transcript JSON
            Worker->>DB: save_transcript(): display text + completed in one update
        end
        Note over Worker,Speech: Transient poll/download errors retry later; missing jobs/results or malformed content fail
    end
    Note over API,Speech: API restart resumes saved jobs/imports; Speech restart clears its jobs; terminal jobs expire after 30 minutes, files persist

    Note over User,DB: PART 5 - Read completed transcript
    User->>UI: Refresh/enter History to load backend state; open completed run
    UI->>API: Detail effect → getTranscript(id, signal) → GET /api/runs/{id}/transcript
    API->>DB: get_transcript() → database.get_transcript(path, user.id, id)
    alt Owned run has completed transcript
        DB-->>API: Stored readable text
        API-->>UI: 200 run_id / transcript_text
        UI->>UI: Cache text on run; RunDetail displays/copies/downloads verbatim
    else Unknown/other-owner run or unavailable transcript
        API-->>UI: 404 / 409 → display error
    end

    Note over User,Speech: PART 6 - Sign-out and shutdown
    User->>UI: signOut(); confirm and abort any active upload
    opt Active upload has a run ID
        UI->>API: cancelUpload(id) before ending session
        API->>DB: Persist cancellation if eligible
        opt Cancellation persisted
            API->>Storage: DELETE stored blob
            Storage-->>API: Deleted/missing or service error
        end
        API-->>UI: Cancellation response
    end
    opt Cancellation succeeds or no active run
        UI->>API: endSession() → POST /api/auth/sign-out
        API->>API: sign_out(): revoke in-memory token; delete cookie
        API-->>UI: 204
        UI->>UI: setUser(null); resetWorkspace(); abort requests/clear protected state
    end
    Note over UI,API: Sign-out errors leave the session visible; aborted/stale requests cannot restore cleared data
    Note over API,Worker: On API shutdown: set stop event; finish current run; await worker
```

## Source map

Line links identify the functions behind the diagram.

| Responsibility / functions | Source |
|---|---|
| Session restoration, `loadHistory`, navigation and workspace state | [App.tsx:23](../frontend/src/App.tsx#L23) |
| `submitSignIn`, `beginUpload`, `cancel`, `signOut` | [App.tsx:135](../frontend/src/App.tsx#L135) |
| `getCurrentUser`, `signIn`, `signOut` HTTP calls | [api/auth.ts:47](../frontend/src/api/auth.ts#L47) |
| `listRecordings`, upload/transcript requests and XHR `putFile` | [api/recordings.ts:28](../frontend/src/api/recordings.ts#L28) |
| `/api` proxy to :8000 | [vite.config.ts:10](../frontend/vite.config.ts#L10) |
| App lifespan and worker startup/shutdown | [main.py:16](../backend/main.py#L16) |
| `get_current_user`, `sign_in`, `me`, `sign_out` | [auth.py:29](../backend/api/auth.py#L29) |
| `list_runs`, `get_transcript` routes | [runs.py:49](../backend/api/runs.py#L49) |
| `authorize`, `complete`, `cancel`, `failed` routes | [uploads.py:45](../backend/api/uploads.py#L45) |
| Owned reads, upload transitions and processing SQL helpers | [database.py:48](../backend/src/database.py#L48) |
| `process_run`, `process_cycle`, `run_worker` | [processing.py:14](../backend/src/processing.py#L14) |
| `submit`, `poll`, `transcript` HTTP calls and extraction | [speech_client.py:31](../backend/src/speech_client.py#L31) |
| `blob_url`, `inspect_or_delete` | [storage_client.py:13](../backend/src/storage_client.py#L13) |
| Streaming `put_blob`, `head_blob`, `delete_blob` | [storage_mock.py:61](../services/storage_mock.py#L61) |
| Speech timers, result writing and submit/status/files routes | [speech_mock.py:78](../services/speech_mock.py#L78) |
| Transcript display, copy and download | [RunDetail.tsx:7](../frontend/src/components/scribe/RunDetail.tsx#L7) |

## Planned live adapter

The application owns runs, state transitions and readable transcript storage. Azure Speech owns audio recognition. Preserve the current submit → status → List Files → content download boundary when replacing the mock.

Before live use, verify Microsoft's [submission contract](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/batch-transcription-create), [results contract](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/batch-transcription-get), [audio access](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/batch-transcription-audio-data) and [polling guidance](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/batch-transcription#best-practices-for-improving-performance). The local two-second cycle serves the timed mock; production polling must follow service guidance.

API version, source authorization, supported input/options, output formatting, worker hosting, retention and production identity integration remain open. Manual retry/reconciliation and automatic frontend refresh are planned; no retry route or browser polling exists in the current flow.
