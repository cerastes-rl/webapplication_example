# SSScribe frontend preview

React + TypeScript + Vite, plain CSS and Oxlint. Runs, options and simulated progress live in browser memory. Theme preference persists in localStorage.

## Run

```bash
cd frontend
pnpm install
pnpm dev --host 0.0.0.0 --port 5173 --strictPort
```

Open http://localhost:5173. Vite's `/api` proxy targets port 8000 for the connected milestone.

## Explore

The preview opens signed in as the development user on **History**.

- **Shell:** logo/title, navy accents, local-demo badge, user, sign-out and Upload/History navigation.
- **Theme:** top-bar toggle available on every page, including sign-in. Starts from stored preference or system settings, then saves the selected theme as `ssscribe-theme` where storage is available.
- **Upload:** MP3/WAV picker validates extension and size. Accepted size is greater than zero and at most **4,000,000,000 bytes**. Requested speakers are Unknown/Automatic or 1–10. Language is English. Speaker labels/timestamps default on.
- **Begin upload:** adds an in-memory run and navigates to History. The shared timer continues across internal navigation.
- **History:** Run ID, filename, submission time, size, speakers, settings, status and actions. Initial fixtures contain three completed runs and one retriable failure. Cancel is available while uploading.
- **Details:** read-only shared sample transcript, options, status and attempt count. Speaker/timestamp toggles control sample presentation.
- **Sign-out:** confirms cancellation of uploading/finalizing runs, hides records and pauses other simulation. Sign-in restores the current session's runs and resumes the timer.
- **Preview states:** select normal, empty or connection-error History. Refresh shows a 1.5-second loading state. Scenario changes preserve the underlying runs.

The timer ticks every 1.3 seconds. Upload progress increases by eight percentage points per tick, followed by finalizing → queued → processing → completed on successive ticks. Retry increments the sample attempt count and resumes at queued.

Reloading resets runs, identity, page and form choices. Leaving Upload before submission resets the form. Theme preference is retained separately. An active simulated transfer enables a best-effort browser leave warning.

## Review status

Browser, keyboard, responsive and cross-theme acceptance review is pending. Remaining review work includes return-to-origin focus, status announcements and explicit missing-run/upload-failure/retry-failure scenario controls. Main receives focus on page changes.

## Checks

```bash
pnpm lint
pnpm build
```

Manual review checklist:

1. Navigate Upload → History → details → History with mouse and keyboard.
2. Select an MP3/WAV, set options and begin. Check immediate History navigation and the full simulated lifecycle across internal navigation.
3. Validate missing file, unsupported extension, empty file, exact size boundary and one byte over the limit.
4. Cancel an uploading run and retry the failed fixture.
5. Open completed details and verify speaker/timestamp presentation. Check empty, error, loading and recovery states.
6. Sign out/in, including during upload, and check record visibility and cancellation confirmation.
7. Toggle theme on History, Upload, details and sign-in. Reload and verify theme persistence.
8. Review at 320px and desktop widths. Check table scrolling, long filenames, labels, skip link, focus, announcements and contrast in both themes.

Focused application interaction tests are planned as part of UI acceptance.

## File boundaries

- `src/preview.ts`: typed fixtures, sample text, formatting helpers and lifecycle transitions.
- `src/components.tsx`: shared visuals, Upload and details.
- `src/App.tsx`: shell, navigation, theme, mock session, History and lifecycle timer.
- `src/App.css`: layout and component styles.
- `src/index.css`: theme tokens and global styles.

The [implementation plan](../docs/IMPLEMENTATION_PLAN.md) describes the UI approval gate and subsequent typed FastAPI client integration.
