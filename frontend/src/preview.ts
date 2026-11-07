export type Status = 'uploading' | 'finalizing' | 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled'
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
export const MAX_FILE_SIZE = 4_000_000_000
export const sampleTranscript = [
  { speaker: 'Speaker 1', time: '00:00', text: 'Thanks for joining today. Let’s walk through the project priorities and make sure we have a shared understanding of the next steps.' },
  { speaker: 'Speaker 2', time: '00:12', text: 'The first priority is a clear, simple experience. Someone should be able to upload a recording, follow its progress, and find the transcript without needing any instructions.' },
  { speaker: 'Speaker 1', time: '00:28', text: 'Agreed. We’ll start with the core workflow, gather feedback, and then consider additional features. Keeping the first version focused will help us learn what actually matters.' },
  { speaker: 'Speaker 2', time: '00:43', text: 'That sounds good. Let’s review the initial design together and capture any changes before moving on to the next phase.' },
]
export const initialRuns: Run[] = [
  { id: 'RUN-2026-0042', filename: 'Product discovery session.mp3', size: 48_200_000, created: '2026-11-07T09:42:00Z', speakers: 2, language: 'English', labels: true, timestamps: true, status: 'completed', progress: 100, attempts: 1 },
  { id: 'RUN-2026-0041', filename: 'Weekly team sync.wav', size: 124_500_000, created: '2026-11-07T09:15:00Z', speakers: 4, language: 'English', labels: true, timestamps: false, status: 'completed', progress: 100, attempts: 1 },
  { id: 'RUN-2026-0040', filename: 'Customer interview — Alex.mp3', size: 32_800_000, created: '2026-11-06T14:30:00Z', speakers: 2, language: 'English', labels: true, timestamps: true, status: 'failed', progress: 100, attempts: 1, error: 'The simulated transcription could not finish. Your recording is available; try processing it again.' },
  { id: 'RUN-2026-0039', filename: 'Research notes.wav', size: 18_600_000, created: '2026-11-06T10:05:00Z', speakers: null, language: 'English', labels: false, timestamps: true, status: 'completed', progress: 100, attempts: 1 },
]
export function formatSize(bytes: number) {
  return bytes >= 1_000_000_000 ? `${(bytes / 1_000_000_000).toFixed(1)} GB` : `${(bytes / 1_000_000).toFixed(1)} MB`
}
export function formatDate(date: string) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(date))
}
export function advanceRuns(runs: Run[]): Run[] {
  return runs.map(run => {
    if (run.status === 'uploading') {
      const progress = Math.min(100, run.progress + 8)
      return { ...run, progress, status: progress === 100 ? 'finalizing' : 'uploading' }
    }
    if (run.status === 'finalizing') return { ...run, status: 'queued' }
    if (run.status === 'queued') return { ...run, status: 'processing' }
    if (run.status === 'processing') return { ...run, status: 'completed' }
    return run
  })
}
