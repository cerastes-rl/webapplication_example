# SSScribe UI research and recommendations

## Research scope

Public product-page review recorded on 2026-11-07. These references informed the upload-to-transcript layout and reading experience.

| Source | Observed patterns | Project takeaway |
|---|---|---|
| [Otter](https://otter.ai/) | Searchable transcripts, speakers, summaries, file imports and sharing | Make recordings easy to find and transcripts easy to scan. |
| [Descript transcription](https://www.descript.com/transcription) | Text-based editing, captions and translation | Give transcript text a readable document layout. |
| [Sonix features](https://sonix.ai/features) | Upload, speakers, word timing, organization, search and export | Keep the upload-to-transcript journey clear and show useful metadata. |

## Current design

SSScribe uses navy accents, light/dark themes and a persistent shell. The React preview implements this layout with in-memory runs, simulated progress and shared sample text. See [requirements](REQUIREMENTS.md) for coverage and [frontend guide](../frontend/README.md) for review steps.

```text
Header: Logo / SSScribe | Theme | Local demo | User | Sign out
Navigation: Upload | History
Upload: MP3/WAV | Requested speakers | Settings | Begin upload
History: Run ID / Filename | Submitted | Size | Speakers | Settings | Status | Action
Details: Back to History | Metadata/options | Status | Sample transcript / Retry
Sign-in: Fixed development identity
```

Begin upload opens History immediately. The shared timer continues across internal navigation. Reload resets runs while retaining theme preference. The picker validates non-empty MP3/WAV files up to **4,000,000,000 bytes** by extension/size.

Narrow layouts reflow navigation and contain table scrolling. Browser, keyboard, responsive and cross-theme accessibility review is pending.

## Core experience

- Clear preview/sample labeling and a development sign-in/out flow.
- History includes active, completed, failed and cancelled submissions with saved settings and actionable states.
- Dedicated Upload page with file guidance, options, validation and immediate History navigation.
- Connected uploads show measured transfer progress followed by finalizing until storage verification. Interrupted transfers restart from zero.
- Readable transcript details with spacing, metadata and speaker/timestamp presentation.
- Useful failure messages with retry and preserved recording context.
- Distinct loading, empty, unavailable, incomplete and missing-record states with recovery actions.
- Semantic controls, visible focus, text statuses, restrained announcements, adequate contrast and reduced-motion support.
- Theme toggle available across signed-in/out pages.

## Follow-ups

- Filename search and status filters with distinct empty/no-match states.
- Copy/plain-text transcript download with failure feedback.
- Search within a transcript.

## Delivery

Use typed presentation fixtures to review the UI. After UI approval, connect a typed `/api` client to FastAPI. The connected milestone stores authoritative records and transcripts in SQLite, streams audio through the storage mock and imports deterministic results from the Speech mock. FastAPI's SQL-driven background loops own submission, monitoring and recovery.
