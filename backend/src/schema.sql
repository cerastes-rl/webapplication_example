CREATE TABLE IF NOT EXISTS runs (
    run_id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    size_bytes INTEGER CHECK (size_bytes > 0),
    storage_key TEXT NOT NULL,
    language TEXT NOT NULL DEFAULT 'en-US',
    requested_speakers INTEGER CHECK (requested_speakers BETWEEN 1 AND 10),
    include_speaker_labels INTEGER NOT NULL DEFAULT 1
        CHECK (include_speaker_labels IN (0, 1)),
    include_timestamps INTEGER NOT NULL DEFAULT 1
        CHECK (include_timestamps IN (0, 1)),
    upload_stage TEXT NOT NULL DEFAULT 'uploading'
        CHECK (upload_stage IN ('uploading', 'completed', 'failed', 'cancelled')),
    transcription_stage TEXT NOT NULL DEFAULT 'not_started' CHECK (transcription_stage IN (
        'not_started', 'queued', 'running', 'importing',
        'completed', 'failed', 'submission_uncertain'
    )),
    speech_job_id TEXT,
    speech_status TEXT CHECK (speech_status IN (
        'NotStarted', 'Running', 'Succeeded', 'Failed'
    )),
    transcript_text TEXT,
    error_message TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
