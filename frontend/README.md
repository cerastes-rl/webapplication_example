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

- **Shell:** logo/title, navy accents, local-demo badge, user, sign-out and Upload/History navigation.
- **Theme:** top-bar toggle available on every page, including sign-in. Starts from stored preference or system settings, then saves the selected theme as `ssscribe-theme` where storage is available.
- **Upload:** MP3/WAV picker validates extension and size. Accepted size is greater than zero and at most **4,000,000,000 bytes**. Requested speakers are Unknown/Automatic or 1–10. Language is English. Speaker labels/timestamps default on.
- **Begin upload:** adds an in-memory run and navigates to History. The shared timer continues across internal navigation.
- **History:** Run ID, filename, submission time, size, speakers, settings, status and actions. Initial fixtures contain three completed runs and one retriable failure. Cancel is available while uploading.
- **Details:** read-only shared sample transcript, options, status and attempt count. Speaker/timestamp toggles control sample presentation.
- **Sign-out:** confirms cancellation of uploading/finalizing runs, revokes the backend session and resets preview state. A failed sign-out shows an error so it can be retried. Signing in again starts the shared sample runs afresh; SQL filtering by user is not implemented yet.
- **Preview states:** select normal, empty or connection-error History. Refresh shows a 1.5-second loading state. Scenario changes preserve the underlying runs.

The timer ticks every 1.3 seconds. Upload progress increases by eight percentage points per tick, followed by finalizing → queued → processing → completed on successive ticks. Retry increments the sample attempt count and resumes at queued.

Reloading resets preview runs, page and form choices, then restores identity from the backend session. Restarting FastAPI requires signing in again. Leaving Upload before submission resets the form. Theme preference is retained separately. An active simulated transfer enables a best-effort browser leave warning.

## Review status

**Local auth — complete.** The user approved the sign-in, session refresh and sign-out interaction review on 2026-11-09.

Broader browser, keyboard, responsive and cross-theme acceptance review is pending. Remaining review work includes return-to-origin focus, status announcements and explicit missing-run/upload-failure/retry-failure scenario controls. Main receives focus on page changes.

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
5. Open completed details and verify speaker/timestamp presentation. Check empty, error, loading and recovery states.
6. Sign in as Austin and John, reject an invalid key, reload to restore the session, then sign out/in during upload and check cancellation confirmation. Stop/restart the API to verify connection errors and invalidated sessions.
7. Toggle theme on History, Upload, details and sign-in. Reload and verify theme persistence.
8. Review at 320px and desktop widths. Check table scrolling, long filenames, labels, skip link, focus, announcements and contrast in both themes.

`pnpm test:auth` uses Node's built-in test runner for the auth client: session restoration, invalid keys/responses, backend outages, abort handling and sign-out. Browser interaction tests remain planned as part of UI acceptance.

## Source layout

| File | Responsibility |
|---|---|
| [src/main.tsx](src/main.tsx) | React entry point. |
| [src/App.tsx](src/App.tsx) | Application shell, authentication, navigation and preview state. |
| [src/components/SignInForm.tsx](src/components/SignInForm.tsx) | Sign-in form, session-check message and auth feedback. |
| [src/components/HistoryPage.tsx](src/components/HistoryPage.tsx) | History table, summary counts and preview-state controls. |
| [src/components/UploadPage.tsx](src/components/UploadPage.tsx) | File picker, options and upload form validation. |
| [src/components/RunDetail.tsx](src/components/RunDetail.tsx) | Run information and sample transcript. |
| `src/components/Icon.tsx`, `Brand.tsx`, `StatusBadge.tsx`, `EmptyState.tsx` | Shared UI components. |
| [src/assets/](src/assets/) | Static images and SVG assets imported by source code. |
| [src/api/auth.ts](src/api/auth.ts) | Auth requests and response handling. |
| [src/preview.ts](src/preview.ts) | Run types, fixtures, formatting and simulated transitions. |
| `src/App.css`, `src/index.css` | Component styles and global theme tokens. |

Keep one component per file in `src/components/` and import components directly. The folder stays shallow while the app is small.

`App.tsx` keeps shared state and event handlers; the screen components receive values and callbacks through props.

Sign-in follows `SignInForm.onSubmit` → `App.submitSignIn()` → `api/auth.signIn()` → Python `auth.sign_in()`.

The [implementation plan](../docs/IMPLEMENTATION_PLAN.md) describes remaining UI acceptance and connected recording API integration. Local authentication and its user interaction review are complete; broader UI acceptance remains pending.
