import { useRef } from 'react'
import { SortableHeader } from './SortableHeader'
import { EmptyState } from './EmptyState'
import { Icon } from './Icon'
import { StatusBadge } from './StatusBadge'
import { formatDate, formatSize } from '../run'
import type { Run, UploadProgress } from '../run'
import type { HistoryViewState } from '../history'

type HistoryPageProps = {
  runs: Run[]
  view: HistoryViewState
  onViewChange: (view: HistoryViewState) => void
  onUpload: () => void
  onOpen: (id: number) => void
  upload: UploadProgress | null
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
  onCancel
}: HistoryPageProps) {
  const searchInput = useRef<HTMLInputElement>(null)
  const { search, pageSize, page, sort } = view
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
  const matchingRuns = runs.filter((run) => run.filename.toLowerCase().includes(query))
  const sortedRuns = [...matchingRuns].sort((a, b) => {
    const difference = sort.column === 'created'
      ? Date.parse(a.created_at) - Date.parse(b.created_at)
      : (a.size_bytes ?? 0) - (b.size_bytes ?? 0)
    return (sort.direction === 'ascending' ? difference : -difference)
      || a.run_id - b.run_id
  })
  const pageCount = Math.max(1, Math.ceil(matchingRuns.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const start = (currentPage - 1) * pageSize
  const visibleRuns = sortedRuns.slice(start, start + pageSize)
  const completed = runs.filter((run) => run.transcription_stage === 'completed').length
  const inProgress = runs.filter((run) => run.upload_stage === 'uploading' || ['queued', 'running', 'importing'].includes(run.transcription_stage)).length

  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Recording history</h1>
          <p>Track recording uploads, transcription progress and completed transcripts.</p>
        </div>
        <button className="button secondary" onClick={onRefresh}>Refresh</button>
        <button className="button primary" onClick={onUpload}>
          <Icon name="upload" size={17} />
          Upload recording
        </button>
      </div>
      <div className="stats-grid">
        <div className="stat-card">
          <span>Total recordings</span>
          <strong>{runs.length.toString().padStart(2, '0')}</strong>
        </div>
        <div className="stat-card">
          <span>Ready to read</span>
          <strong>
            {completed.toString().padStart(2, '0')}
            <span className="stat-indicator">
              <Icon name="check" size={18} />
            </span>
          </strong>
        </div>
        <div className="stat-card">
          <span>In progress</span>
          <strong>{inProgress.toString().padStart(2, '0')}</strong>
        </div>
      </div>
      <section className="panel history-panel" aria-label="Recording history">
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
                  <Icon name="circle-arrow" size={18} />
                </button>
              )}
            </div>
            <div>
              <h2>
                {query ? 'Filtered recordings' : 'All recordings'} <span>{matchingRuns.length}</span>
              </h2>
              <p>Open a run for its settings and transcript.</p>
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
            <nav className="pagination-controls" aria-label="Recording history pages">
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
        {runs.length === 0 ? (
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
        ) : matchingRuns.length === 0 ? (
          <EmptyState
            title="No matching recordings"
            action={
              <button className="button secondary" onClick={() => {
                onViewChange({ ...view, search: '', page: 1 })
              }}>
                Clear search
              </button>
            }
          >
            Try another filename or clear the search.
          </EmptyState>
        ) : (
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
