# AGENTS.md — SSScribe

## Objective

Build a working local mock of an authenticated speech-to-text application. Prioritize a usable React UI, realistic API contracts and replaceable service adapters.

## Repository conventions

- Implement the bare minimum requested. Do not add speculative safeguards, fields, adapters or infrastructure. Prefer direct functions and explain a necessary scope change before making it.

- `frontend/`: React + TypeScript + Vite, **pnpm**, existing **Oxlint** configuration and plain CSS.
- `backend/`: Python + FastAPI + Uvicorn, existing virtual environment and `requirements.txt` workflow.
- Preserve Vite's `/api` proxy to port 8000 and dev-container ports 5173/8000.
- Inspect the repository before changing files and reuse established conventions.
- Keep dependencies minimal. Express, additional Node backends, Docker orchestration, Redis, Celery and live Azure integrations are prohibited for the local prototype.
- Keep secrets, local data, audio, `.venv/`, `node_modules/` and build output out of Git.

## Current milestone

The local upload slice is connected through queued state. UI/auth review was approved on 2026-11-09; connected browser/accessibility and responsive review remain pending.

- `App.tsx` owns navigation, session state, API-backed History and one active-upload object. `run.ts` uses the API's fields and numeric run IDs directly; `history.ts` owns frontend search/sort/page preferences. Components stay one file per component; clients stay under `src/api/`.
- Connected uploads accept non-empty TXT up to **1,000,000 bytes inclusive**, English, Automatic/1–10 speakers, labels/timestamps default on. Begin upload creates a row, PUTs bytes directly to storage and POSTs completion; the API HEAD-verifies bytes before queuing.
- `GET /api/runs` returns all owned rows; frontend controls pagination. Load History after sign-in/session restoration, on entering History, after mutations and on Refresh. Opening Upload/details should not reload the whole list.
- Failed/interrupted uploads require reselection and a new submission. Cancellation aborts the local transfer and conditionally persists cancellation before DELETE. No preview fixtures, Check upload controls, fake attempt counters, request IDs, deduplication indexes or automatic creation retries.
- The single runs table stores `upload_stage` and `transcription_stage`. Initialize it explicitly through `backend/src/database.py` or the retained VS Code task. FastAPI must not initialize or upgrade it; no automatic legacy-schema conversion.
- Root `services/` holds independent storage (8001) and Speech (8002) mocks sharing `backend/.venv`. Storage supports only PUT/HEAD/DELETE. Retain Speech's timed processing and 30-minute terminal-job expiry; files persist. Data remains under ignored `backend/data/`.
- Austin/John keys and stable IDs are exactly `austin` and `john`. HttpOnly-cookie sessions live in memory; API restart requires sign-in without deleting records. Theme persists under `ssscribe-theme` where available. Stale responses must not restore signed-out data.
- Use `.vscode/tasks.json` for automatic startup; no duplicate startup shell helper. Declare only direct Python dependencies in `requirements.txt`.

## Planned connected architecture

The single [implementation plan](docs/IMPLEMENTATION_PLAN.md) separates current behavior from the next Speech integration slice and production direction. Add processing functions only when requested. Preserve service boundaries and use short SQL operations separate from HTTP calls. The simple storage interface cannot fence a late PUT; automatic orphan cleanup remains deferred.

## Sequence diagrams and explanations

- Use one Mermaid `sequenceDiagram` for the complete requested flow, including related entry points such as sign-in and page refresh/session restoration.
- Split phases inside that diagram with clearly labeled `Note over` sections (for example, `PART 1 - Page load or refresh` and `PART 2 - Manual sign-in`). Use `autonumber`, descriptive participants and `alt`/`opt` branches for success, errors and conditional actions.
- Trace the actual function calls, helpers, HTTP requests/proxy routing, backend handlers, state/session changes and return paths. Distinguish implemented behavior from planned work.
- Follow the diagram with a compact table linking components/functions to their current source files and line numbers. Read the code first to verify those references.
- Present the diagram in a fenced `mermaid` block in chat. Keep a single combined diagram unless the user requests otherwise.
- Explain unfamiliar frontend concepts patiently in conversation, using concrete code references. Keep the implementation idiomatic and consistent with the existing React/TypeScript template; an explanation request is not a refactoring request.

## Documentation maintenance

- Review root `README.md` and `docs/PROJECT_STRUCTURE.md` when files, responsibilities, setup, configuration, architecture, behavior or persistence boundaries change. Update each where affected.
- Write simple, direct descriptions of what the project does. Omit comparisons with excluded features or discarded architectures.
- Separate current behavior, planned work, open decisions and acceptance tasks with clear headings/status labels.
- Keep README concise and link to detailed guides. Document maintained source separately from generated/local files and proposed paths.
- Verify documented paths/links and run `git diff --check` before finishing.
