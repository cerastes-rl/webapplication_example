# SSScribe UI research and recommendations

## Research scope

Reviewed public product pages on 2026-11-07 using live HTTP retrieval. This is a feature/content review, not an authenticated product trial or a visual usability audit. Vendor accuracy, security, pricing, and speed claims were not independently verified and are not prototype requirements.

| Source | Observed patterns | Takeaway for this project |
|---|---|---|
| [Otter](https://otter.ai/) | Searchable transcripts, speaker recognition, summaries, file imports, and sharing/integrations | Make recordings easy to find and transcripts easy to scan. Defer meeting bots, AI chat, and integrations. |
| [Descript transcription](https://www.descript.com/transcription) | Text-based editing, captions, translation, filler-word removal | A readable document-style transcript is valuable; a full media editor is a different product and outside this MVP. |
| [Sonix features](https://sonix.ai/features) | File upload, speaker identification, word timing, audio-linked transcript editor, organization/search, export and collaboration | Build a clear upload-to-transcript journey first. Speaker/timestamp presentation can use explicitly labeled sample data; audio synchronization and collaboration can wait. |

These sources inspire the recommendations below; dashboard status/retry/accessibility recommendations are project-specific design judgments, not claims that every vendor implements them identically.

## Current design and implementation

The public-page observations above remain research, not claims of implemented features. Subsequent product decisions established **SSScribe**, navy-blue accents, light/dark themes, and a persistent application shell with two sidebar destinations. A frontend-only preview of that design now exists; [requirements](REQUIREMENTS.md) records coverage/gaps and the [frontend guide](../frontend/README.md) explains how to review it.

```text
Header: Logo / SSScribe | Dark mode | Local demo | User | Sign out
Sidebar: Upload | History
Upload: Choose MP3/WAV | Requested speakers | Settings | Begin upload
History: Run ID / Filename | Submitted | Size | Speakers | Settings | Status | Action
Detail: Back to History | Metadata/options | Status | Sample transcript / Retry
Sign-in: Fixed development identity (no actual authentication)
```

History includes active simulated uploads, not just completed files. Begin upload navigates immediately to History; the shared browser timer continues across internal navigation. Theme preference persists locally; runs reset on reload. All progress/results are simulated and no bytes are transmitted. The current size check is **4 GB (4,000,000,000 bytes)**, not a claim of a working large-file transport.

On narrow screens the implemented shell reflows and History uses a locally scrollable table; cards are an optional later refinement, not the current design. Transcript detail is a separate view. Full browser/keyboard/light/dark accessibility review is still pending.

### Must have for the local MVP

- Clear "Local demo — no real transcription" notice and mock identity/sign-out flow.
- Run list with Run ID, filename, submission date, size, requested speakers/settings and text-labeled uploading/finalizing/queued/processing/completed/failed/cancelled states.
- Dedicated single-file Upload page, visible supported formats/size limit, requested speakers/settings, validation messages, submit state, immediate History navigation and eventual queued confirmation. Never suggest a file was persisted during the UI-only preview.
- Distinguish byte upload from asynchronous processing. Today's preview explicitly labels simulated percentages. The connected MVP must measure transfer progress and show finalizing until the server confirms storage; never invent transcription percentages or completion estimates. Start with a streamed single-request transfer, accepting full restart after interruption; defer chunking/resume.
- Read-only transcript with useful spacing, metadata, and an explicit sample-result label. Speaker labels/timestamps are optional sample formatting, not actual audio analysis.
- A helpful failed-job message with retry and preserved filename/context.
- Loading, empty, backend-unavailable, not-yet-complete, and not-found states, with actionable recovery.
- Responsive layout, semantic controls, visible focus, accessible status announcements, adequate contrast in both themes, and status conveyed by more than color. SSScribe's top-bar theme toggle is available on sign-in as well as signed-in pages.

### Small follow-ups after the core flow works

- Filename search and status filters; show "no matches" separately from "no recordings".
- Copy transcript and plain-text download, using the retrieved transcript rather than generated client-side content. Report clipboard/download failures appropriately.
- Search within a transcript.

### Deliberately defer

- Synchronized audio playback/waveforms and timestamp seeking (requires a real media-serving contract and trustworthy timings).
- Transcript editing/version history, subtitle export, translation, and actual speaker recognition.
- AI summaries/chat, meeting recording/bots, real-time transcription, collaboration, public sharing, and integrations.
- Billing, usage quotas, real OAuth, cloud infrastructure, production security claims, and chunked/resumable/parallel uploads.

## Delivery principle

The current milestone is a clearly marked, temporary UI preview using typed presentation fixtures outside components. Use it to validate layout and states, not to claim working uploads or persistence. Next replace that preview data boundary with a small typed `/api` client talking to FastAPI's local mock services. Once connected, FastAPI/SQLite must be authoritative for records, statuses, and transcripts; do not retain a hidden frontend fallback dataset.
