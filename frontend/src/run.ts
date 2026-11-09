export type Status =
  | 'uploading'
  | 'finalizing'
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'
export const MAX_FILE_SIZE = 1_000_000_000

export interface Run {
  id: string
  filename: string
  size: number
  created: string
  speakers: number | null
  language: string
  labels: boolean
  timestamps: boolean
  status: Status
  progress: number
  attempts: number
  transcript?: string
  error?: string
}
export function formatSize(bytes: number) {
  return bytes >= 1_000_000_000
    ? `${(bytes / 1_000_000_000).toFixed(1)} GB`
    : `${(bytes / 1_000_000).toFixed(1)} MB`
}
export function formatDate(date: string) {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(date))
}

export function getRunStatuses(run: Run): {
  upload: Status
  transcription: Status | 'waiting' | 'not-started'
} {
  if (run.status === 'uploading' || run.status === 'finalizing')
    return { upload: run.status, transcription: 'waiting' }
  if (run.status === 'cancelled')
    return { upload: 'cancelled', transcription: 'not-started' }
  return { upload: 'completed', transcription: run.status }
}
