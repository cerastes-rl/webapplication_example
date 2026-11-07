# SSScribe frontend preview

React + TypeScript + Vite, with plain CSS and the project's existing Oxlint configuration. This milestone is **frontend only**: no backend connection, API calls, file transfer, audio/run persistence, or speech recognition is used. Theme preference is the only browser-persisted state.

## Run

```bash
cd frontend
pnpm install
pnpm dev --host 0.0.0.0
```

Open http://localhost:5173. The FastAPI server is not required. The existing `/api` Vite proxy remains unchanged for future integration.

## Explore

The preview opens signed in as the fixed development user, on **History**.

- **Persistent shell:** SSScribe logo/title, navy-blue accents, local-demo badge, user, sign-out, and Upload/History sidebar.
- **Theme:** the top-bar Dark mode toggle works on every page, including sign-in. It defaults to your system preference, then remembers an explicit selection in localStorage where available. Only the theme preference persists; preview recordings still reset on reload.
- **Upload:** choose an MP3/WAV, select requested speakers (Unknown/Automatic by default, or 1–10), and toggle speaker labels/timestamps (both default on). English is the only language option. Validation checks filename extension and size, not MIME consistency or decoded audio. Validation rejects empty, unsupported, and over-4-GB files (decimal 4,000,000,000 bytes).
- **Begin upload:** adds a session-only run and navigates to History. Progress is explicitly simulated; selected file bytes are never read or transmitted. Simulation continues across internal page navigation.
- **History:** Run ID, filename, submission time, size, requested speakers, saved settings, status, and actions. Uploads can be cancelled. The initial fixtures contain three completed examples and one failed example, which can be retried. These are browser fixtures, not database seeds. Completed runs open sample transcripts.
- **Run details:** read-only sample transcript, saved options, status and attempt count. Labels/timestamps are illustrative, not inferred from audio.
- **Sign out:** returns to mock sign-in and hides run information; warns before cancelling an active preview upload. Signing back in restores this session's data. Background simulation is paused while signed out in this UI-only version.
- **Preview state selector:** demonstrate normal, empty and connection-error history. The refresh icon demonstrates a short loading state. These do not make network requests; changing the displayed scenario does not delete runs.

Reloading resets run data, mock sign-in state, selected page and form choices; it opens signed in on History again. Leaving Upload before submission also resets that form because it unmounts. Theme preference is retained separately where browser storage permits. No actual authentication or durability is claimed. Browser leave warnings while a simulated upload is active are best-effort.

## Current limitations and review status

- Navigation is React state only, without URL routes, deep links or browser Back/Forward page history.
- The shell timer advances every 1.3 seconds: upload progress increases by 8 points, then finalizing/queued/processing each advance on a later tick. This is not real byte progress or processing throughput. It stops when there are no active runs or the user signs out.
- All completed recordings share the same sample transcript. Speaker/timestamp display toggles affect presentation only; specified speaker counts are not actual detection results.
- Cancel is offered during uploading; finalizing has no separate cancel button. Sign-out handles both stages. Retrying the example failure increments its illustrative attempt count immediately; future server accounting will be authoritative.
- Only normal/empty/error History are selectable scenarios; refresh shows 1.5-second loading. A missing-run fallback exists but has no scenario selector; upload-failure/retry-failure scenarios are not implemented.
- Focus moves to main on page changes, not back to the originating History row. Comprehensive focus/announcement/contrast and cross-theme browser review is pending, not certified by the build.
- Preview controls remain visible in this frontend-only build. Remove them from connected mode; never silently use them as API fallbacks.
- No actual 4 GB transfer has been implemented or tested. Selecting a file only checks its metadata; future streaming support requires separate server/proxy/disk testing.

## Checks

```bash
pnpm lint
pnpm build
```

Manual review checklist:

1. Navigate Upload → History → run details → History with mouse and keyboard.
2. Select a small MP3/WAV, set options, and begin. Check immediate History navigation, uploading progress, finalizing, queued, processing and completion. Navigate internally during progress.
3. Cancel an active simulated upload; retry the seeded processing failure.
4. Open completed details and verify speaker/timestamp preferences affect presentation. Check empty and error states, recovery and loading.
5. Sign out/in, including during upload; confirm protected views are hidden while signed out.
6. Toggle dark mode on History, Upload, details and sign-in. Reload to check preference persistence. Verify dropdowns, progress, errors, statuses and keyboard focus in both themes.
7. Review at 320px and desktop widths; use the scrollable table for all columns on narrow screens. Check visible keyboard focus, form labels, long filenames, and skip link.

No browser automation dependencies have been added. A lint/build pass is not a substitute for the manual browser review above.

## File boundaries

- `src/preview.ts`: typed session-only fixtures, sample text, formatting helpers, and deterministic lifecycle transitions.
- `src/components.tsx`: shared visuals, Upload page, and run details.
- `src/App.tsx`: persistent shell, page navigation, session state and preview lifecycle timer.
- `src/App.css`, `src/index.css`: responsive styling and global defaults.

The preview data is not an API fallback. A future integration milestone must replace this boundary with the typed FastAPI client and authoritative persisted state. See [implementation plan](../docs/IMPLEMENTATION_PLAN.md) for scope and the UI approval gate.
