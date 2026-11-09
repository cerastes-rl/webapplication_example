import { EXTRA_HISTORY_EXAMPLES } from './config'

export type Status =
  | 'uploading'
  | 'finalizing'
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'
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
  error?: string
}
export const MAX_FILE_SIZE = 1_000_000_000
export const sampleTranscript = [
  {
    speaker: 'Speaker 1',
    time: '00:00:00',
    text: 'Thanks for joining today. Let’s walk through the project priorities and make sure we have a shared understanding of the next steps.'
  },
  {
    speaker: 'Speaker 2',
    time: '00:00:12',
    text: 'The first priority is a clear, simple experience. Someone should be able to upload a recording, follow its progress, and find the transcript without needing any instructions.'
  },
  {
    speaker: 'Speaker 1',
    time: '00:00:28',
    text: 'Agreed. We’ll start with the core workflow, gather feedback, and then consider additional features. Keeping the first version focused will help us learn what actually matters.'
  },
  {
    speaker: 'Speaker 2',
    time: '00:00:43',
    text: 'That sounds good. Let’s review the initial design together and capture any changes before moving on to the next phase.'
  }
]
export const initialRuns: Run[] = [
  {
    id: 'RUN-2026-0042',
    filename: 'Product discovery session.mp3',
    size: 48_200_000,
    created: '2026-11-07T09:42:00Z',
    speakers: 2,
    language: 'English',
    labels: true,
    timestamps: true,
    status: 'completed',
    progress: 100,
    attempts: 1
  },
  {
    id: 'RUN-2026-0041',
    filename: 'Weekly team sync.wav',
    size: 124_500_000,
    created: '2026-11-07T09:15:00Z',
    speakers: 4,
    language: 'English',
    labels: true,
    timestamps: false,
    status: 'completed',
    progress: 100,
    attempts: 1
  },
  {
    id: 'RUN-2026-0040',
    filename: 'Customer interview — Alex.mp3',
    size: 32_800_000,
    created: '2026-11-06T14:30:00Z',
    speakers: 2,
    language: 'English',
    labels: true,
    timestamps: true,
    status: 'failed',
    progress: 100,
    attempts: 1,
    error:
      'Transcription could not finish. Retry to process this recording again.'
  },
  {
    id: 'RUN-2026-0039',
    filename: 'Research notes.wav',
    size: 18_600_000,
    created: '2026-11-06T10:05:00Z',
    speakers: null,
    language: 'English',
    labels: false,
    timestamps: true,
    status: 'completed',
    progress: 100,
    attempts: 1
  },
  // Temporary, deterministic examples for reviewing every pagination size.
  ...Array.from({ length: EXTRA_HISTORY_EXAMPLES }, (_, index): Run => {
    const number = index + 1
    const status = index % 9 === 0 ? 'failed' : index % 11 === 0 ? 'cancelled' : 'completed'
    const topics = ['Project review', 'Customer interview', 'Team meeting', 'Research session', 'Planning discussion']
    return {
      id: `RUN-2026-${String(999 - index).padStart(4, '0')}`,
      filename: `${topics[index % topics.length]} ${String(number).padStart(2, '0')}.${index % 2 === 0 ? 'mp3' : 'wav'}`,
      size: 12_000_000 + index * 3_700_000,
      created: new Date(Date.UTC(2026, 10, 5, 16) - index * 3_600_000).toISOString(),
      speakers: index % 5 === 0 ? null : index % 6 + 1,
      language: 'English',
      labels: index % 3 !== 0,
      timestamps: index % 4 !== 0,
      status,
      progress: status === 'cancelled' ? 32 : 100,
      attempts: 1,
      ...(status === 'failed' ? { error: 'Transcription could not finish. Retry to process this recording again.' } : {})
    }
  })
]
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
export function advanceRuns(runs: Run[]): Run[] {
  return runs.map((run) => {
    if (run.status === 'uploading') {
      const progress = Math.min(100, run.progress + 8)
      return {
        ...run,
        progress,
        status: progress === 100 ? 'finalizing' : 'uploading'
      }
    }
    if (run.status === 'finalizing') return { ...run, status: 'queued' }
    if (run.status === 'queued') return { ...run, status: 'processing' }
    if (run.status === 'processing') return { ...run, status: 'completed' }
    return run
  })
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

export type HistoryViewState = {
  search: string
  pageSize: number
  page: number
  sort: {
    column: 'created' | 'size'
    direction: 'ascending' | 'descending'
  }
}

export const initialHistoryView: HistoryViewState = {
  search: '',
  pageSize: 10,
  page: 1,
  sort: { column: 'created', direction: 'descending' }
}

export function transcriptText(run: Run): string {
  return sampleTranscript.map((segment) => {
    const timestamp = run.timestamps ? `[${segment.time}] ` : ''
    const speaker = run.labels ? `${run.speakers === 1 ? 'Speaker 1' : segment.speaker}: ` : ''
    return `${timestamp}${speaker}${segment.text}`
  }).join('\n\n')
}
