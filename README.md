# SSScribe — Transcription workspace

SSScribe is currently a **frontend-only UI preview** for submitting recordings, following run progress, and reading sample transcripts. It uses navy-blue accents and an optional dark theme. **No file bytes are uploaded or saved, no API is called by the UI, and no speech recognition is performed.** No Azure account or credentials are needed.

## Documentation

- [Frontend guide](frontend/README.md): controls, preview scenarios, file boundaries and manual review checklist.
- [Requirements](docs/REQUIREMENTS.md): current implementation coverage and connected-MVP acceptance criteria.
- [Implementation plan](docs/IMPLEMENTATION_PLAN.md): resolved decisions, progress, review gate and future backend steps.
- [UI research](docs/UI_RESEARCH.md): public product references and design rationale.
- [Agent instructions](AGENTS.md): implementation constraints.

## What works today

- Persistent SSScribe banner, Upload/History navigation, development identity and mock sign-out/sign-in. The preview initially opens signed in on History.
- Dedicated Upload page: MP3/WAV picker, non-empty file and **4 GB (4,000,000,000 bytes)** size validation, requested speakers (Automatic or 1–10), English language, speaker-label and timestamp options (both enabled by default).
- Begin upload creates an in-memory Run ID and navigates to History. Simulated progress continues during internal navigation: uploading → finalizing → queued → processing → completed.
- History displays Run ID/filename, submitted time, size, requested speakers, settings, status and actions. Four initial fixtures include three completed examples and one retriable processing failure. Cancelled runs remain visible.
- Read-only sample transcript and run details. All recordings share illustrative text, unrelated to their audio. Options control sample speaker-label/timestamp presentation, not audio analysis.
- Preview controls for empty/error History and a short loading state; cancel simulated uploads and retry the failed example.
- Mock sign-out hides recording views and warns before cancelling an active simulated upload. Queued/processing simulation pauses while signed out; signing back in resumes it.
- Dark-mode toggle on every screen. First use follows system preference; the selected theme is saved under `ssscribe-theme` in localStorage when available. Only that preference persists.
- Responsive shell and locally scrollable History table on small screens, labeled controls, skip link, focus styles and reduced-motion support. Browser/accessibility acceptance review is still pending.

Reloading resets run data, form selections, navigation and mock sign-in state to the initial preview. There is no routing/deep-link support, real authentication, database, stored audio, or persistent transcript yet. The file picker checks extension and size, not audio contents or authoritative MIME validity.

## Run the UI (backend not required)

Use the development container's Node.js/pnpm environment:

```bash
cd frontend
pnpm install                     # first run / dependency changes
pnpm dev --host 0.0.0.0 --port 5173 --strictPort
```

Open **http://localhost:5173**. Existing VS Code tasks/dev-container startup may already have started it; do not launch a duplicate server. The Vite `/api` proxy to port 8000 remains configured for future integration, but the current UI does not use it.

### Checks

```bash
cd frontend
pnpm lint
pnpm build                       # TypeScript check + Vite production build
```

Lint/build and ad hoc preview-lifecycle assertions passed during frontend implementation. There is **no committed automated application test suite or `pnpm test` script**. Visual, keyboard, responsive and dark/light browser review remains necessary; see the [frontend checklist](frontend/README.md#checks). Do not treat build success as UI approval.

## Optional backend (health only)

```bash
cd backend
python -m venv .venv             # first run only; reuse existing venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

- `GET http://localhost:8000/api/health` → `{"status":"OK!"}`.
- FastAPI OpenAPI UI: http://localhost:8000/docs.
- No auth/file/upload/run/transcript/job routes exist yet. SQLAlchemy is not in requirements.

The dev container forwards 5173/8000. `.vscode/tasks.json` defines automatic startup tasks; `.devcontainer/start-dev.sh` also checks those ports before starting servers and writes logs under `.devcontainer/logs/`. Its backend dependency install runs only when creating a missing venv, so update an existing environment explicitly after requirements changes. The helper does not install frontend dependencies.

## Repository layout

```text
frontend/
  src/App.tsx           # Shell, theme, navigation and preview session/timer
  src/components.tsx    # Shared visuals, Upload and run details
  src/preview.ts        # Typed fixtures, sample transcript and transitions
  src/App.css           # Layout/component styles
  src/index.css         # Theme tokens and global styles
backend/
  main.py               # FastAPI health endpoint only
  requirements.txt      # Current Python runtime dependencies
docs/                   # Requirements, implementation plan and UI research
```

Project documentation is in `docs/`; development configuration is in `.devcontainer/` and `.vscode/`. No `backend/data/` directory or reset/seed command is implemented.

## Next milestone: connected local mock (not implemented)

**Review and approve the UI before backend integration.** Then replace the preview boundary with a typed FastAPI client. API failure must show an error, never silently fall back to frontend fixtures.

| Responsibility | Current preview | Planned connected local MVP | Eventual production |
|---|---|---|---|
| UI | React/TypeScript/Vite, pnpm, Oxlint | Same UI with typed API client | Azure Static Web Apps |
| Authentication | Presentation-only identity | Fixed-user mock backend session | Microsoft Entra ID |
| Run/file/job metadata | React memory | SQLite via SQLAlchemy | Azure SQL / SQL Server |
| Audio | Not read or transferred | Streaming local file adapter | Private Azure Blob Storage |
| Queue/transcription | Browser timer/sample text | SQLite jobs, local runner, fake adapter | Azure Queue Storage/worker and Azure transcription service |
| Transcript | Shared frontend sample | SQLite `TEXT` | Azure SQL `NVARCHAR(MAX)` |
| Backend hosting | Health-only FastAPI | FastAPI/Uvicorn | Azure App Service |

The connected flow creates a stable run and saves options **before** transfer, streams a single request to disk with bounded memory, and shows measured progress in History. Internal navigation must not cancel transfer. Refresh/close/network loss can interrupt it; retry starts at zero and may require file reselection. No resumable/chunked/parallel upload or automatic retry is planned initially. Finalizing remains separate from queued until storage is verified. Backend jobs then continue without the browser.

Store provider/object keys internally in SQL; do not expose filesystem paths, private Blob locations or credentials in History/API DTOs. Save readable transcript text in SQL. Optional future raw result JSON/exports may live in Blob Storage with SQL references. Azure integration must arrange supported private-blob access and asynchronous job submission/result retrieval; no Azure SDKs or cloud calls are implemented now.

Proposed local persistence paths are `backend/data/app.db` and `backend/data/uploads/`. Add Git exclusions for DBs, sidecars, uploads and partial files **before generating them**; current ignore rules do not cover these paths. Seed/reset/cleanup commands and worker recovery behavior must be documented when they actually exist. Never commit local data, credentials, venvs, dependencies or generated builds.
