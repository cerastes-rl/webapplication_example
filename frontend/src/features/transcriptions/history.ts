import type { Run } from './run.ts'

export type HistoryFilter = 'all' | 'completed' | 'in_progress'

export function matchesHistoryFilter(run: Pick<Run, 'upload_stage' | 'transcription_stage'>, filter: HistoryFilter): boolean {
  if (filter === 'completed') return run.transcription_stage === 'completed'
  if (filter === 'in_progress') return run.upload_stage === 'uploading' || ['queued', 'running', 'importing'].includes(run.transcription_stage)
  return true
}

export type HistoryViewState = {
  filter: HistoryFilter
  search: string
  pageSize: number
  page: number
  sort: {
    column: 'created' | 'size'
    direction: 'ascending' | 'descending'
  }
}

export const initialHistoryView: HistoryViewState = {
  filter: 'all',
  search: '',
  pageSize: 10,
  page: 1,
  sort: { column: 'created', direction: 'descending' }
}
