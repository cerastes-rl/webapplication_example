export const MAX_FILE_SIZE = 1_000_000

// Fields match the public API. Transcript text is loaded separately.
export interface Run {
  run_id: number
  filename: string
  size_bytes: number | null
  created_at: string
  updated_at: string
  requested_speakers: number | null
  language: string
  include_speaker_labels: boolean
  include_timestamps: boolean
  upload_stage: 'uploading' | 'completed' | 'failed' | 'cancelled'
  transcription_stage: 'not_started' | 'queued' | 'running' | 'importing' | 'completed' | 'failed' | 'submission_uncertain'
  error_message: string | null
  transcript?: string
}

export type UploadProgress = { run_id: number | null; progress: number }

export function formatSize(bytes: number | null): string {
  if (bytes === null) return 'Unknown'
  return bytes >= 1_000_000_000
    ? `${(bytes / 1_000_000_000).toFixed(1)} GB`
    : `${(bytes / 1_000_000).toFixed(1)} MB`
}

export function formatDate(date: string): string {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  }).format(new Date(date))
}
