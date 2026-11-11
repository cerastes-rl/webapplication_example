import { useRef } from 'react'
import type { ReactElement } from 'react'
import { matchesHistoryFilter } from '../history.ts'
import type { HistoryFilter, HistoryViewState } from '../history.ts'
import { formatDate, formatSize } from '../run.ts'
import type { Run, UploadProgress } from '../run.ts'
import { EmptyState } from './EmptyState.tsx'
import { Icon } from './Icon.tsx'
import { SortableHeader } from './SortableHeader.tsx'
import { StatusBadge } from './StatusBadge.tsx'

type HistoryPageProps = {
  runs: Run[]
  view: HistoryViewState
  onViewChange: (view: HistoryViewState) => void
  onUpload: () => void
  onOpen: (id: number) => void
  upload: UploadProgress | null
  loading: boolean
  notice: string
  onRefresh: () => void
  onCancel: (id: number) => void
}

export function HistoryPage({
  runs,
  view,
  onViewChange,
  onUpload,
  onOpen,
  upload,
  onRefresh,
  loading,
  notice,
  onCancel
}: HistoryPageProps): ReactElement {
  const searchInput = useRef<HTMLInputElement>(null)
  const { search, pageSize, page, sort, filter } = view
  function changeSort(column: 'created' | 'size') {
    onViewChange({
      ...view,
      page: 1,
      sort: {
        column,
        direction: sort.column === column && sort.direction === 'descending'
          ? 'ascending'
          : 'descending'
      }
    })
  }
  const query = search.trim().toLowerCase()
  const matchingRuns = runs.filter((run) => run.filename.toLowerCase().includes(query) && matchesHistoryFilter(run, filter)).sort((a, b) => {
    const difference = sort.column === 'created'
      ? Date.parse(a.created_at) - Date.parse(b.created_at)
      : (a.size_bytes ?? 0) - (b.size_bytes ?? 0)
    return (sort.direction === 'ascending' ? difference : -difference)
      || a.run_id - b.run_id
  })
  const pageCount = Math.max(1, Math.ceil(matchingRuns.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const start = (currentPage - 1) * pageSize
  const visibleRuns = matchingRuns.slice(start, start + pageSize)
  const completed = runs.filter((run) => matchesHistoryFilter(run, 'completed')).length
  const inProgress = runs.filter((run) => matchesHistoryFilter(run, 'in_progress')).length

  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Your Transcriptions</h1>
          <p>Track recording uploads, transcription progress and completed transcripts.</p>
        </div>
        <div className="history-actions">
          {notice && <span className="history-notice" role="status">{notice}</span>}
          <div className="history-refresh">
            {loading && <span className="history-loading" role="status">Refreshing saved recordings…</span>}
            <button className="button secondary" onClick={onRefresh}>Refresh</button>
          </div>
          <button className="button primary" onClick={onUpload}>
            <Icon name="upload" size={17} />
            Upload recording
          </button>
        </div>
      </div>
      <section className="panel history-panel" aria-label="Your Transcriptions">
        <div className="table-toolbar">
          <div className="table-heading-controls">
            <div className="history-search">
              <input
                ref={searchInput}
                aria-label="Search filenames"
                type="search"
                placeholder="Search filenames"
                value={search}
                onChange={(event) => {
                  onViewChange({ ...view, search: event.target.value, page: 1 })
                }}
              />
              {search && (
                <button
                  type="button"
                  className="clear-search"
                  aria-label="Clear search"
                  title="Clear search"
                  onClick={() => {
                    onViewChange({ ...view, search: '', page: 1 })
                    searchInput.current?.focus()
                  }}
                >
                  <Icon name="reset" size={18} />
                </button>
              )}
            </div>
            <div className="history-filters" role="group" aria-label="Filter recordings by status">
              {([
                ['all', 'All recordings', runs.length],
                ['completed', 'Ready to read', completed],
                ['in_progress', 'In progress', inProgress]
              ] satisfies [HistoryFilter, string, number][]).map(([value, label, count]) => (
                <button
                  key={value}
                  type="button"
                  className={`button ${filter === value ? 'primary' : 'secondary'} history-filter`}
                  aria-pressed={filter === value}
                  onClick={() => onViewChange({ ...view, filter: value, page: 1 })}
                >
                  {label} <span>{count}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="table-pagination">
            <label className="page-size-control">
              Recordings per page
              <select
                value={pageSize}
                onChange={(event) => {
                  onViewChange({ ...view, pageSize: Number(event.target.value), page: 1 })
                }}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </label>
            <span role="status">
              {matchingRuns.length === 0 ? 0 : start + 1}–{Math.min(start + pageSize, matchingRuns.length)} of {matchingRuns.length}
            </span>
            <nav className="pagination-controls" aria-label="Your Transcriptions pages">
              <button
                className="button secondary history-action"
                disabled={currentPage === 1}
                onClick={() => onViewChange({ ...view, page: currentPage - 1 })}
              >
                Previous
              </button>
              <span>Page {currentPage} of {pageCount}</span>
              <button
                className="button secondary history-action"
                disabled={currentPage === pageCount}
                onClick={() => onViewChange({ ...view, page: currentPage + 1 })}
              >
                Next
              </button>
            </nav>
          </div>
        </div>
        {runs.length === 0 && (
          <EmptyState
            title="A fresh start for your recordings"
            action={
              <button className="button primary" onClick={onUpload}>
                Upload your first recording
              </button>
            }
          >
            Your uploads and transcripts will appear here.
          </EmptyState>
        )}
        {runs.length > 0 && matchingRuns.length === 0 && (
          <EmptyState
            title="No matching recordings"
            action={
              <button className="button secondary" onClick={() => {
                onViewChange({ ...view, search: '', filter: 'all', page: 1 })
              }}>
                Clear filters
              </button>
            }
          >
            Try another filename or clear the filters.
          </EmptyState>
        )}
        {matchingRuns.length > 0 && (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Recording / Run ID</th>
                  <SortableHeader label="Submitted" direction={sort.column === 'created' ? sort.direction : 'none'} onSort={() => changeSort('created')} />
                  <SortableHeader label="Size" direction={sort.column === 'size' ? sort.direction : 'none'} onSort={() => changeSort('size')} />
                  <th scope="col">Speakers</th>
                  <th scope="col">Settings</th>
                  <th scope="col">Upload status</th>
                  <th scope="col">Transcription status</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {visibleRuns.map((run) => (
                  <tr key={run.run_id}>
                    <td>
                      <div className="recording-cell">
                        <span className="file-icon">
                          <Icon name="audio" />
                        </span>
                        <div>
                          <button
                            className="filename-button"
                            onClick={() => onOpen(run.run_id)}
                          >
                            {run.filename}
                          </button>
                          <span className="run-id">{run.run_id}</span>
                        </div>
                      </div>
                    </td>
                    <td>{formatDate(run.created_at)}</td>
                    <td className="nowrap">{formatSize(run.size_bytes)}</td>
                    <td>{run.requested_speakers ?? 'Auto'}</td>
                    <td>
                      <div className="row-settings">
                        <span>{run.language === 'en-US' ? 'English' : run.language}</span>
                        <small>
                          {run.include_speaker_labels ? 'Speaker labels' : 'No labels'} ·{' '}
                          {run.include_timestamps ? 'Timestamps' : 'No timestamps'}
                        </small>
                      </div>
                    </td>
                    <td>
                      <StatusBadge status={upload?.run_id === run.run_id && upload.progress === 100 ? 'finalizing' : run.upload_stage} />
                      {upload?.run_id === run.run_id && (
                        <div className="row-progress">
                          <progress
                            max={100}
                            value={upload.progress}
                            aria-label={`Upload progress for ${run.filename}`}
                          />
                          <small>{upload.progress}%</small>
                        </div>
                      )}
                    </td>
                    <td>
                      <StatusBadge status={run.transcription_stage} />
                    </td>
                    <td>
                      {['uploading', 'failed'].includes(run.upload_stage) ? (
                        <button className="button secondary history-action" onClick={() => onCancel(run.run_id)}>Cancel</button>
                      ) : (
                        <button className="button secondary history-action"
                          aria-label={`View transcript for ${run.filename}`}
                          disabled={run.transcription_stage !== 'completed'} onClick={() => onOpen(run.run_id)}>
                          View transcript
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
