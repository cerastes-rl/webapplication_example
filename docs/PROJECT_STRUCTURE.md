# SSScribe project structure

Maintained files, responsibilities and common editing locations. See [README](../README.md) for startup, [frontend guide](../frontend/README.md) for review and [implementation plan](IMPLEMENTATION_PLAN.md) for future work.

## Quick orientation

- **`frontend/`:** React UI preview with in-memory runs and simulated progress.
- **`backend/`:** health/auth API and a separate standalone Speech mock.
- **`docs/`:** requirements, architecture, delivery plan and research.
- **`.devcontainer/`, `.vscode/`, `.github/`:** development and repository configuration.

## Maintained files and directories

Paths are relative to the repository root.

```text
SSScribe/                            Repository root (actual checkout name may differ)
|--- README.md                       Overview, capabilities, startup and verification
|--- AGENTS.md                       Coding-agent constraints and maintenance rules
|--- .gitignore                      Repository-wide ignore rules
|
|--- frontend/                       React + TypeScript + Vite UI
|    |--- README.md                  Preview usage, scenarios and review checklist
|    |--- package.json               Dependencies and dev/build/lint/preview scripts
|    |--- pnpm-lock.yaml             Resolved dependency versions; managed by pnpm
|    |--- tests/auth.test.ts         Auth-client checks using Node's built-in test runner
|    |--- .gitignore                 Additional frontend-specific ignore rules
|    |--- .oxlintrc.json              Existing Oxlint plugins and rules
|    |--- index.html                 HTML entry, page title, description and favicon link
|    |--- vite.config.ts             Vite/React setup, port 5173 and /api proxy
|    |--- tsconfig.json              TypeScript project references
|    |--- tsconfig.app.json          Browser/application TypeScript configuration
|    |--- tsconfig.node.json         Tooling/Vite TypeScript configuration
|    |
|    |--- src/                       Source bundled by Vite
|    |    |--- main.tsx              Loads global CSS and mounts App in StrictMode
|    |    |--- App.tsx               App shell, auth, navigation and preview state
|    |    |--- components/           UI components, one file per component
|    |    |    |--- Brand.tsx        SSScribe logo
|    |    |    |--- EmptyState.tsx   Empty/error state presentation
|    |    |    |--- HistoryPage.tsx  History table, counts and preview controls
|    |    |    |--- Icon.tsx         Shared inline SVG icons
|    |    |    |--- RunDetail.tsx    Run information and sample transcript
|    |    |    |--- SignInForm.tsx   Sign-in form and session feedback
|    |    |    |--- StatusBadge.tsx  Run status label
|    |    |    |--- UploadPage.tsx   File picker, options and validation
|    |    |--- preview.ts            Types, fixtures, sample text and transition helper
|    |    |--- api/auth.ts           Typed auth requests and session response validation
|    |    |--- index.css             Global defaults and light/dark theme tokens
|    |    |--- App.css               Layout, component styles and responsive rules
|    |    |--- assets/               Static image and SVG assets
|    |         |--- hero.png
|    |         |--- react.svg
|    |         |--- vite.svg
|    |
|    |--- public/                    Static assets served without module imports
|         |--- favicon.svg           Favicon referenced by index.html
|         |--- icons.svg             Starter icon sprite
|
|--- backend/                        Python/FastAPI application API and standalone mock
|    |--- main.py                    FastAPI app, health, auth router and HTTP errors
|    |--- database.py                Explicit SQLite initialization command
|    |--- schema.sql                 Accepted single-table runs schema
|    |--- auth.py                    Austin/John sessions and reusable current-user dependency
|    |--- tests/test_auth.py         Standard-library auth tests over real HTTP
|    |--- speech_mock.py             Separate batch mock: submit, timed states, result files and expiry
|    |--- data/blobs/audio/example*   Version-controlled text fixtures, including example1.txt–example5.txt
|    |--- requirements.txt           Pinned Python runtime dependencies
|
|--- docs/                           Project documentation
|    |--- PROJECT_STRUCTURE.md       This guide: paths, responsibilities and editing map
|    |--- REQUIREMENTS.md            Behavior, coverage/gaps and acceptance criteria
|    |--- IMPLEMENTATION_PLAN.md     Target architecture, Speech API flow, Azure deployment and optional Functions/queue scaling
|    |--- LOCAL_IMPLEMENTATION_PLAN.md  Local delivery slices, contracts, recovery and checks
|    |--- API_DATA_FLOW.md           Planned end-state call sequences, triggers, schedules and recovery
|    |--- UI_RESEARCH.md             Public-product research and design rationale
|    |--- notes.md                   Informal demo feedback
|
|--- .devcontainer/                  VS Code development-container configuration
|    |--- devcontainer.json          Python image, Node/pnpm feature and forwarded ports
|    |--- devcontainer-lock.json     Locked feature resolution; generated by dev tooling
|    |--- start-dev.sh               Optional helper to start Vite, the API and Speech mock
|
|--- .vscode/
|    |--- tasks.json                 VS Code startup tasks for Vite, FastAPI, Speech mock and database initialization
|
|--- .github/
     |--- dependabot.yml             Automated dependency-update configuration
```

### Frontend responsibilities in more detail

| File | Responsibility |
|---|---|
| `src/main.tsx` | Imports global styles and mounts `App` in React StrictMode. |
| `src/App.tsx` | Shell, navigation, theme, session restore/sign-in/sign-out, shared preview state/actions, History view state across internal navigation and lifecycle timer. |
| `src/components/SignInForm.tsx` | Sign-in form, session-check message and auth feedback; receives state and callbacks from App. |
| `src/components/HistoryPage.tsx` | History table, summary counts, upload/transcription statuses, action buttons, filename search, Submitted/Size sorting and 10/25/50-row pagination controls in the top toolbar; receives runs, persistent view state and action callbacks from App. |
| `src/components/UploadPage.tsx` | File/options state, validation and new preview run submission. |
| `src/components/RunDetail.tsx` | Transcript panel, recording metadata, separate upload/transcription statuses, saved settings, state-specific actions and identical plain-text display/Copy/Download through `transcriptText`; Download starts a standard browser download. |
| `src/components/Brand.tsx`, `Icon.tsx`, `StatusBadge.tsx`, `EmptyState.tsx` | Shared UI components. |
| `src/assets/` | Static images and SVG files available for module imports. |
| `src/api/auth.ts` | Typed sign-in/session/sign-out requests and response/error handling. Validates user response fields; the backend owns allowed identities. |
| `src/config.ts` | Development footer version and temporary History example count. |
| `src/preview.ts` | Run/status types, size limit, four base fixtures plus configurable temporary pagination examples, shared transcript, formatting, plain-text `transcriptText` formatting, shared `getRunStatuses` mapping and `advanceRuns`. |
| `src/index.css` | Theme tokens, global styles, focus/reduced-motion rules and control defaults. |
| `src/App.css` | Shell, History, forms, details, sign-in, theme toggle and responsive component styles. |

### Configuration and tooling

- **Frontend commands:** `pnpm dev`, `pnpm lint`, `pnpm build` (`tsc -b && vite build`) and `pnpm preview`. Update dependency resolution through pnpm.
- **Vite:** React plugin, port 5173 and `/api` proxy to `http://localhost:8000`. `public/` files are served at root paths; imported source assets are bundled.
- **Backend:** `main.py` exports `app` for `uvicorn main:app`. `requirements.txt` pins FastAPI/Uvicorn/Pydantic and supporting dependencies. Use `backend/.venv` and pip requirements.
- **Dev container:** Python image with Node/pnpm, ports 5173/8000/8002. On creation, `postCreateCommand` creates/reuses the venv and installs requirements. Rebuild to apply setup changes; rerun pip after requirements changes. The lockfile records resolved feature metadata.
- **Startup:** `.vscode/tasks.json` defines folder-open tasks for Vite, the API, Speech mock and **Initialize Database** (`.venv/bin/python database.py` from `backend/`). Database initialization runs once per folder open and preserves existing rows. Speech runs on port 8002 without reload to preserve in-memory jobs during code edits. `.devcontainer/start-dev.sh` starts missing services and logs to `.devcontainer/logs/` (`speech-mock.log` for Speech). It installs requirements when creating a missing venv. Install frontend dependencies with pnpm and update existing venvs explicitly.
- **Checks:** `.oxlintrc.json` owns lint rules; `tsconfig*.json` owns TypeScript configuration.
- **Repository automation:** `.github/dependabot.yml` configures dependency updates.

## How the current app fits together

```text
Browser opens frontend/index.html
    |
    v
src/main.tsx -> imports index.css -> mounts App.tsx
    |
    |--- Theme: saved choice / initial system preference
    |            -> data-theme on <html> -> CSS theme variables
    |
    |--- Shell + React page state
    |    |--- History table and scenario controls (components/HistoryPage.tsx)
    |    |--- Upload form (components/UploadPage.tsx)
    |    |--- Run details / sample transcript (components/RunDetail.tsx)
    |    |--- Sign-in form (components/SignInForm.tsx)
    |
    |--- In-memory runs initialized from preview.ts
         |--- Begin upload -> new preview run -> History
         |--- App timer -> advanceRuns -> updated status/progress
         |--- Cancel / retry -> update in-memory run
         |--- Completed details -> shared illustrative transcript

Application API:
backend/main.py -> GET /api/health -> {"status":"OK!"}
                -> auth.py -> sign-in / me / sign-out -> in-memory cookie sessions
```

The app restores a backend session or opens the Austin/John access-key form. React state owns navigation; the shell timer continues across page changes. Leaving Upload resets the form. Sign-out confirms cancellation of simulated transfers, revokes the backend session and resets preview state. Reload restores initial preview runs/page and checks the backend session; theme preference persists under `ssscribe-theme`.

## Where do I change something?

All frontend paths in this table are relative to `frontend/` unless otherwise noted.

| Change | Start here |
|---|---|
| App name/logo | `src/components/Brand.tsx`, `src/components/SignInForm.tsx` (welcome), `src/App.tsx` (header/sidebar/footer), `index.html` (title/description), then relevant docs |
| Banner, navigation or which page opens first | `src/App.tsx`; layout in `src/App.css` |
| Navy palette, dark/light colors or focus color | Theme variables in `src/index.css` |
| Theme preference or top-bar toggle behavior | `src/App.tsx`; icons in `src/components/Icon.tsx`, toggle layout in `src/App.css` |
| Page spacing, typography or responsive layout | `src/App.css` and global rules in `src/index.css` |
| File picker, speakers, language and option fields | `src/components/UploadPage.tsx` |
| Upload size limit | `MAX_FILE_SIZE` in `src/preview.ts`; update guidance/error copy in `components/UploadPage.tsx` and documentation too |
| Extension validation | `UploadPage.validate()` in `src/components/UploadPage.tsx`; picker `accept` is only a convenience. MP3/WAV and silent `.txt` acceptance share the same size checks |
| History columns, summary counts or action buttons | `src/components/HistoryPage.tsx` |
| Application version in the development footer | `src/config.ts` |
| Sample runs, shared transcript, stage status mapping, date/size formatting | `src/preview.ts` |
| Simulation stages versus timing | Transition helper in `src/preview.ts`; interval, retry and cancellation in `src/App.tsx` |
| Transcript/details presentation | `src/components/RunDetail.tsx`; styles in `src/App.css` |
| Local sign-in/out | Form in `src/components/SignInForm.tsx`; session/events in `src/App.tsx`; requests in `src/api/auth.ts` |
| Browser metadata or favicon | `index.html`, `public/favicon.svg` |
| Frontend dependencies or package scripts | `package.json` and pnpm-managed `pnpm-lock.yaml` |
| Development proxy/port | `vite.config.ts`; align root startup docs, `.vscode/tasks.json` and helper configuration as applicable |
| Current Python endpoints | Repository-root `backend/main.py` |
| Python dependencies | Repository-root `backend/requirements.txt`, installed into existing venv |
| Startup/environment troubleshooting | Root README, `.vscode/tasks.json`, `.devcontainer/start-dev.sh`, `.devcontainer/devcontainer.json` |
| Product scope or implementation status | `docs/REQUIREMENTS.md`, `docs/IMPLEMENTATION_PLAN.md`, root/frontend READMEs |
| Planned service boundaries, callers or Azure Speech API flow | `docs/IMPLEMENTATION_PLAN.md` for service ownership; `docs/API_DATA_FLOW.md` for ordered Mermaid call sequences, exact Speech operation names, triggers and schedules |

## Generated and machine-local directories

| Path | Purpose / handling |
|---|---|
| `.git/` | Git history and repository metadata. |
| `frontend/node_modules/` | Installed packages. Ignored; recreate with pnpm. |
| `frontend/dist/` | Generated production build. Ignored; recreate with `pnpm build`. |
| `backend/.venv/` | Local Python environment. Ignored; recreate with venv/pip. |
| `backend/__pycache__/`, `*.pyc` | Generated Python bytecode, ignored. |
| `backend/data/databases/app.db` | Local SQLite runs table, created with `backend/.venv/bin/python backend/database.py`; database and sidecars ignored. |
| `backend/data/` | Local stores are ignored except `example*` files directly inside `blobs/audio/`. `blobs/audio/` contains local text sources and `blobs/transcripts/` can hold Speech mock results. Job expiry never deletes files. |
| `.devcontainer/logs/` | Helper logs (`vite.log`, `uvicorn.log`), ignored. |
| Other editor caches / TypeScript build metadata | Tool output; handled by the applicable ignore rules. |

Root `.gitignore` and `frontend/.gitignore` define exclusions. Only `example*` files directly inside `backend/data/blobs/audio/` are allowed through the data exclusions; generated results and other local files stay ignored.

## Standalone Speech mock

`backend/speech_mock.py` runs on port 8002 with existing Python dependencies and no storage service. It owns an in-memory job dictionary and a lifespan maintenance task. Submissions use local paths under `backend/data/blobs/` in `contentUrls` and `properties.destinationContainerUrl`. After simulated processing, it reads UTF-8 text, appends a fixed sentence and writes result/report JSON to the destination/job-ID directory. List Files returns metadata/download URLs with `skip`/`top` pagination and `@nextLink`, without reading contents. The same app serves downloads at `/blobs/`. File work runs in a thread; jobs are processed sequentially. Job metadata expires after 30 minutes or restart; files remain. See [startup and limitations](../README.md#run-the-standalone-speech-mock). Durable jobs and production storage adapters remain later work.

## Planned connected structure

The [local architecture status table](LOCAL_IMPLEMENTATION_PLAN.md#1-small-local-architecture) tracks implemented components. Auth and its typed frontend client are complete; the user approved the auth interaction review and current UI on 2026-11-09. Responsive layout review is deferred; connected workflow integration and validation remain planned. Future modules cover recording routes/client, SQLAlchemy models, upload/storage adapters, a Speech client and lifespan-managed SQL polling loops. Separate storage and Speech HTTP mocks own audio and simulated service jobs/results. Main FastAPI owns application SQL and business logic.

The current database is `backend/data/databases/app.db`, initialized by `backend/database.py` manually or through the VS Code folder-open task from `backend/schema.sql`. It contains the accepted single `runs` table with sequential IDs, ownership, file metadata, options, application and Speech statuses, transcript, error and UTC timestamps. Application updates must set `updated_at`. Initialization preserves existing rows and does not perform schema migrations. API/worker/UI integration is pending; the older multi-table and scheduling-field proposals are future planning references. `backend/data/uploads/` remains proposed. Local data and database sidecars are already ignored. See the [local implementation plan](LOCAL_IMPLEMENTATION_PLAN.md) for candidate modules, contracts and delivery order, and the [architecture plan](IMPLEMENTATION_PLAN.md) for the Azure end state.

See the [frontend source layout](../frontend/README.md#source-layout) for module responsibilities and the sign-in call path.

## Keeping this guide useful

When paths, responsibilities, startup commands or implementation boundaries change, update this guide and the root README in the same change. Keep the README concise and link here for the detailed map. Document maintained files and common navigation tasks. Separate implemented source, generated/local output and planned additions. Follow the [maintenance instructions](../AGENTS.md) and verify local links/paths before finishing.
