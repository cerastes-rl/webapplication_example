# SSScribe frontend

React + TypeScript + Vite, plain CSS and Oxlint. Auth and user-owned History use FastAPI/SQLite. File bytes upload directly to the standalone storage mock. The backend submits completed uploads to Speech, polls jobs and imports transcripts. Refresh History to see changes.

## Run

```bash
cd frontend
pnpm install
pnpm dev --host 0.0.0.0 --port 5173 --strictPort
```

Start the [API](../README.md#run-the-api) , [storage mock](../README.md#run-the-standalone-storage-mock) and [Speech mock](../README.md#run-the-standalone-speech-mock), then open http://localhost:5173. Vite proxies `/api` to port 8000. See [connected URL/CORS configuration](../README.md#connected-upload-configuration) for forwarded ports.

## Current behavior

- Session restoration or exact `austin`/`john` access-key sign-in. Sign-in opens Upload; History contains only that user's persisted records, initially empty.
- TXT files, greater than zero and at most **1,000,000 bytes inclusive**. English; Automatic or 1–10 speakers; labels/timestamps default on. Options are saved for later processing.
- Upload controls use audio terminology and display a 1 GB limit. The local mock still accepts only non-empty TXT fixtures up to 1,000,000 bytes inclusive, with generic format/size validation messages.
- Begin upload creates a run, opens History, PUTs the File directly to storage via XHR, reports measured progress and HEAD-verifies completion through the API. The shell owns the request across internal navigation; a second transfer is disabled while one is active.
- History shows refresh progress to the left of Refresh while loading. Upload progress appears in the top banner with a reminder to keep the application open, and disappears when the upload ends. Upload errors and cancellation notices remain beside Refresh.
- History supports search, sorting, 10/25/50-row pages and Refresh. It loads on sign-in, entering History, after mutations and on Refresh; backend processing runs independently; automatic frontend refresh is deferred.
- An inactive uploading/failed run offers Cancel. Restarting a transfer requires file reselection and a new submission. Partial uploads do not resume.
- Sign-out confirms stopping an active transfer and requests cancellation before ending the session. Errors remain visible for retry. Browser reload warns during an active transfer; after reload the saved row remains in History and can be cancelled.
- Details show saved options and application state. Existing completed transcripts are fetched separately; display, Copy and Download use the identical stored text. Processing retry is deferred.
- Theme persists under `ssscribe-theme`. Page/form/search state resets on reload/sign-in/out; records remain in SQLite. API restart invalidates sessions, preserving data.

## Checks

```bash
pnpm lint
pnpm test
pnpm build
```

Node's built-in test runner covers auth, metadata contracts, whole-list reads, upload errors, single-attempt upload creation and XHR bytes/progress/abort. Browser interaction/accessibility checks remain follow-up validation:

1. Upload a small TXT file with custom settings; navigate during transfer, then Refresh History to follow queued/running/completed stages and open the saved transcript.
2. Reload, sign out/in and restart the API; verify records/settings persist and Austin/John stay isolated.
3. Validate missing/empty/non-TXT files, exact 1 MB and one byte over.
4. Throttle a transfer, cancel it and check that it stays cancelled. Stop storage/API to review errors, then reselect the file and start a new submission.
5. Review keyboard navigation, focus, announcements, both themes, long filenames and mobile layouts. The previous UI/auth review was approved on 2026-11-09; connected-flow browser review is pending.

## Source layout

| File | Responsibility |
|---|---|
| [src/main.tsx](src/main.tsx) | React entry point. |
| [src/App.tsx](src/App.tsx) | Shell, auth, navigation, API-backed History and shell-owned transfer lifetime. |
| [src/components/SignInForm.tsx](src/components/SignInForm.tsx) | Sign-in form, session-check message and auth feedback. |
| [src/components/SortableHeader.tsx](src/components/SortableHeader.tsx) | Shared sortable table heading. |
| [src/components/HistoryPage.tsx](src/components/HistoryPage.tsx) | History table, summary counts, upload/transcription statuses and action buttons. |
| [src/components/UploadPage.tsx](src/components/UploadPage.tsx) | File picker, options and upload form validation. |
| [src/components/RunDetail.tsx](src/components/RunDetail.tsx) | Run information and stored transcript. |
| `src/components/Icon.tsx`, `Brand.tsx`, `StatusBadge.tsx`, `EmptyState.tsx` | Shared UI components. |
| [src/api/auth.ts](src/api/auth.ts) | Auth requests and response handling. |
| [src/api/recordings.ts](src/api/recordings.ts) | Direct API run types, recording requests and XHR upload/progress/abort. |
| [package.json](package.json) | Dependencies, scripts and the version displayed in the footer/sidebar. |
| [src/run.ts](src/run.ts) | Run contract, upload limit, date/size formatting and direct upload/transcription stages. |
| [src/history.ts](src/history.ts) | History view preferences and defaults. |
| `src/App.css`, `src/index.css` | Component styles and global theme tokens. |

Keep one component per file in `src/components/` and import components directly. The folder stays shallow while the app is small.

`App.tsx` keeps shared state and event handlers; the screen components receive values and callbacks through props.

Sign-in follows `SignInForm.onSubmit` → `App.submitSignIn()` → `api/auth.signIn()` → Python `auth.sign_in()`.

The [local implementation plan](../docs/IMPLEMENTATION_PLAN.md) describes implemented uploads/Speech processing and pending validation. Local authentication and its user interaction review are complete; the user also approved the current UI on 2026-11-09, with responsive layout review deferred.
