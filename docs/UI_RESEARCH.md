# Transcription UI research and recommendations

## Research scope

Reviewed public product pages on 2026-11-07 using live HTTP retrieval. This is a feature/content review, not an authenticated product trial or a visual usability audit. Vendor accuracy, security, pricing, and speed claims were not independently verified and are not prototype requirements.

| Source | Observed patterns | Takeaway for this project |
|---|---|---|
| [Otter](https://otter.ai/) | Searchable transcripts, speaker recognition, summaries, file imports, and sharing/integrations | Make recordings easy to find and transcripts easy to scan. Defer meeting bots, AI chat, and integrations. |
| [Descript transcription](https://www.descript.com/transcription) | Text-based editing, captions, translation, filler-word removal | A readable document-style transcript is valuable; a full media editor is a different product and outside this MVP. |
| [Sonix features](https://sonix.ai/features) | File upload, speaker identification, word timing, audio-linked transcript editor, organization/search, export and collaboration | Build a clear upload-to-transcript journey first. Speaker/timestamp presentation can use explicitly labeled sample data; audio synchronization and collaboration can wait. |

These sources inspire the recommendations below; dashboard status/retry/accessibility recommendations are project-specific design judgments, not claims that every vendor implements them identically.

## Recommended first UI

Keep the application to three surfaces: a mock sign-in screen, a recordings dashboard with an upload area, and a transcript detail view. Prefer a single-column reading experience over a complex media-editor workspace.

```text
Header: App name | Local demo badge | Development user | Sign out
Dashboard: Recordings                              [Upload recording]
           Filename | Uploaded | Size | Status | Open / Retry
Detail:    [Back to recordings] Filename, metadata, status
           Readable sample transcript (speaker labels if available)
           Incomplete/error state with a clear next action
```

On narrow screens use recording cards and a separate detail view rather than a squeezed table/split pane. Keep the upload button and navigation keyboard-accessible.

### Must have for the local MVP

- Clear "Local demo — no real transcription" notice and mock identity/sign-out flow.
- Recording list with filename, upload date, size, and text-labeled queued/processing/completed/failed badges.
- Single-file picker, visible supported formats/size limit, validation messages, submit state, and queued confirmation. Never suggest a file was persisted during the UI-only preview.
- Distinguish byte upload from asynchronous processing; use indeterminate progress when the implementation cannot measure real bytes. Do not invent transcription percentages or completion estimates.
- Read-only transcript with useful spacing, metadata, and an explicit sample-result label. Speaker labels/timestamps are optional sample formatting, not actual audio analysis.
- A helpful failed-job message with retry and preserved filename/context.
- Loading, empty, backend-unavailable, not-yet-complete, and not-found states, with actionable recovery.
- Responsive layout, semantic controls, visible focus, accessible status announcements, adequate contrast, and status conveyed by more than color.

### Small follow-ups after the core flow works

- Filename search and status filters; show "no matches" separately from "no recordings".
- Copy transcript and plain-text download, using the retrieved transcript rather than generated client-side content. Report clipboard/download failures appropriately.
- Search within a transcript.

### Deliberately defer

- Synchronized audio playback/waveforms and timestamp seeking (requires a real media-serving contract and trustworthy timings).
- Transcript editing/version history, subtitle export, translation, and actual speaker recognition.
- AI summaries/chat, meeting recording/bots, real-time transcription, collaboration, public sharing, and integrations.
- Billing, usage quotas, real OAuth, cloud infrastructure, and production security claims.

## Delivery principle

Start with a clearly marked, temporary UI preview using typed presentation fixtures outside components. Use it to validate layout and states, not to claim working uploads or persistence. Next replace that preview data boundary with a small typed `/api` client talking to FastAPI's local mock services. Once connected, FastAPI/SQLite must be authoritative for records, statuses, and transcripts; do not retain a hidden frontend fallback dataset.
