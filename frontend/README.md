# SSScribe frontend preview

React + TypeScript + Vite, plain CSS and Oxlint. Sign-in uses the FastAPI backend; runs, options and simulated progress remain in browser memory. Theme preference persists in localStorage.

## Run

```bash
cd frontend
pnpm install
pnpm dev --host 0.0.0.0 --port 5173 --strictPort
```

Start the [API](../README.md#run-the-api), then open http://localhost:5173. Vite's `/api` proxy targets port 8000 for auth requests.

## Explore

On load, the UI checks the backend session. Without a session, enter exactly `austin` or `john` in the access-key field. Successful sign-in opens **History** and displays Austin or John. Invalid keys and an unavailable backend show an error that can be retried.

- **Sign-in:** SSScribe title, application description and access-key form. No sample keys or implementation notes are displayed.
- **Shell:** logo/title, `#15263B` primary accents in both themes, local-demo badge, user, sign-out and Upload/History navigation.
- **Theme:** top-bar toggle available on every page, including sign-in. Starts from stored preference or system settings, then saves the selected theme as `ssscribe-theme` where storage is available.
- **Upload layout:** recording picker and Transcription settings panels, with a matching three-step Instructions column and a numbered Begin upload action. The repeated main preview banner has been removed; the preview note remains beside Begin upload.
- **Upload:** MP3/WAV picker validates extension and size; `.txt` is also accepted silently while the displayed MP3/WAV guidance stays unchanged. Accepted size is greater than zero and at most **1 GB (1,000,000,000 bytes inclusive)**. Requested speakers are Unknown/Automatic or 1–10. Language is English. Speaker labels/timestamps default on.
- **Begin upload:** adds an in-memory run and navigates to History. The shared timer continues across internal navigation.
- **History:** Run ID, filename, submission time, size, speakers, settings, separate upload/transcription statuses and labeled View transcript/Retry/Cancel buttons. Initial fixtures contain four base runs plus 60 temporary examples for pagination review, including completed, failed and cancelled runs. Set `EXTRA_HISTORY_EXAMPLES` in `src/preview.ts` to 0 to restore the base fixtures. Cancel is available while uploading and asks for confirmation. Submission dates include the year. The top table toolbar places the search field to the left of its title, showing All recordings or Filtered recordings with the matching count. It includes case-insensitive filename search across all recordings, with a circular-arrow Clear search button inside the field and a Clear search action when no results match. Filtering resets to page 1 and updates result counts; summary cards still describe all recordings. It also offers 10 (default), 25 or 50 recordings per page, range counts and Previous/Next controls; changing page size resets to page 1. Submitted and Size headers sort all recordings before pagination; click again to reverse direction. Default order is newest first, and changing the sort returns to page 1. Page size, current page, search and sort persist across internal navigation through shell-owned state; reload and sign-in/out reset them.
- **Details:** transcript panel beside Recording details and Transcription settings. Upload and transcription statuses match History. Active, failed and cancelled runs show direct state messages with Retry or Cancel upload actions where applicable. Saved speaker/timestamp options control the shared sample transcript presentation; repeated preview notices are omitted. Completed transcripts offer Copy and Download; the component reads `run.transcript` verbatim for display, clipboard and download. Preview fixtures create the sample text ahead of rendering as plain text in `[HH:MM:SS] Speaker 1: text` format, respecting the saved speaker/timestamp settings. Download starts a standard browser download named `<original-title>_transcript.txt`. Clipboard failures show an actionable message.
- **Sign-out:** confirms cancellation of uploading/finalizing runs, revokes the backend session and resets preview state. A failed sign-out shows an error so it can be retried. Signing in again starts the shared sample runs afresh; SQL filtering by user is not implemented yet.

The timer ticks every 1.3 seconds. Upload progress increases by eight percentage points per tick, followed by finalizing → queued → processing → completed on successive ticks. Retry increments the sample attempt count and resumes at queued.

Reloading resets preview runs, page and form choices, then restores identity from the backend session. Restarting FastAPI requires signing in again. Leaving Upload before submission resets the form. Theme preference is retained separately. An active simulated transfer enables a best-effort browser leave warning.

## Review status

**Local auth — complete.** The user approved the sign-in, session refresh and sign-out interaction review on 2026-11-09.

**Current UI — complete for this scope; user approved on 2026-11-09.** Responsive layout review is deferred. Browser, keyboard and cross-theme checks remain follow-up validation. Remaining review work includes return-to-origin focus, status announcements and explicit missing-run/upload-failure/retry-failure scenario controls. Main receives focus on page changes.

## Checks

```bash
pnpm lint
pnpm test:auth
pnpm build
```

Manual review checklist:

1. Navigate Upload → History → details → History with mouse and keyboard.
2. Select an MP3/WAV, set options and begin. Check immediate History navigation and the full simulated lifecycle across internal navigation.
3. Validate missing file, unsupported extension, empty file, exact size boundary and one byte over the limit.
4. Cancel an uploading run and retry the failed fixture.
5. Open completed details and verify speaker/timestamp presentation. Check that View transcript stays disabled until transcription completes.
6. Sign in as Austin and John, reject an invalid key, reload to restore the session, then sign out/in during upload and check cancellation confirmation. Stop/restart the API to verify connection errors and invalidated sessions.
7. Toggle theme on History, Upload, details and sign-in. Reload and verify theme persistence.
8. Review at 320px and desktop widths. Check table scrolling, long filenames, labels, skip link, focus, announcements and contrast in both themes.

`pnpm test:auth` uses Node's built-in test runner for the auth client: session restoration, invalid keys/responses, backend outages, abort handling and sign-out. Browser interaction tests remain planned as follow-up validation.

## Source layout

| File | Responsibility |
|---|---|
| [src/main.tsx](src/main.tsx) | React entry point. |
| [src/App.tsx](src/App.tsx) | Application shell, authentication, navigation and preview state. |
| [src/components/SignInForm.tsx](src/components/SignInForm.tsx) | Sign-in form, session-check message and auth feedback. |
| [src/components/SortableHeader.tsx](src/components/SortableHeader.tsx) | Shared sortable table heading. |
| [src/components/HistoryPage.tsx](src/components/HistoryPage.tsx) | History table, summary counts, upload/transcription statuses and action buttons. |
| [src/components/UploadPage.tsx](src/components/UploadPage.tsx) | File picker, options and upload form validation. |
| [src/components/RunDetail.tsx](src/components/RunDetail.tsx) | Run information and sample transcript. |
| `src/components/Icon.tsx`, `Brand.tsx`, `StatusBadge.tsx`, `EmptyState.tsx` | Shared UI components. |
| [src/api/auth.ts](src/api/auth.ts) | Auth requests and response handling. |
| [package.json](package.json) | Dependencies, scripts and the version displayed in the footer/sidebar. |
| [src/run.ts](src/run.ts) | Run contract, upload limit, date/size formatting and stage badges. |
| [src/history.ts](src/history.ts) | History view preferences and defaults. |
| [src/preview.ts](src/preview.ts) | Temporary fixtures, sample transcript creation and simulated transitions. |
| `src/App.css`, `src/index.css` | Component styles and global theme tokens. |

Keep one component per file in `src/components/` and import components directly. The folder stays shallow while the app is small.

`App.tsx` keeps shared state and event handlers; the screen components receive values and callbacks through props.

Sign-in follows `SignInForm.onSubmit` → `App.submitSignIn()` → `api/auth.signIn()` → Python `auth.sign_in()`.

The [implementation plan](../docs/IMPLEMENTATION_PLAN.md) describes connected recording API integration and remaining validation. Local authentication and its user interaction review are complete; the user also approved the current UI on 2026-11-09, with responsive layout review deferred.
