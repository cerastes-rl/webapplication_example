import { useRef } from 'react'
import { EmptyState } from './EmptyState'
import { Icon } from './Icon'
import { StatusBadge } from './StatusBadge'
import { formatDate, formatSize, getRunStatuses } from '../preview'
import type { Run, HistoryViewState } from '../preview'

type HistoryPageProps = {
  runs: Run[]
  view: HistoryViewState
  onViewChange: (view: HistoryViewState) => void
  onUpload: () => void
  onOpen: (id: string) => void
  onRetry: (id: string) => void
  onCancel: (id: string) => void
}

export function HistoryPage({
  runs,
  view,
  onViewChange,
  onUpload,
  onOpen,
  onRetry,
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
      ? Date.parse(a.created) - Date.parse(b.created)
      : a.size - b.size
    return (sort.direction === 'ascending' ? difference : -difference)
      || a.id.localeCompare(b.id)
  })
  const pageCount = Math.max(1, Math.ceil(matchingRuns.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const start = (currentPage - 1) * pageSize
  const visibleRuns = sortedRuns.slice(start, start + pageSize)
  const completed = runs.filter((run) => run.status === 'completed').length

  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Recording history</h1>
          <p>Track recording uploads, transcription progress and completed transcripts.</p>
        </div>
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
          <strong>
            {runs
              .filter((run) =>
                ['uploading', 'finalizing', 'queued', 'processing'].includes(
                  run.status
                )
              )
              .length.toString()
              .padStart(2, '0')}
          </strong>
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
                  <th scope="col" aria-sort={sort.column === 'created' ? sort.direction : 'none'}>
                    <button className="sort-button" onClick={() => changeSort('created')}>
                      Submitted
                      <span aria-hidden="true"><Icon name={sort.column === 'created' ? sort.direction === 'ascending' ? 'arrow-up' : 'arrow-down' : 'sort'} size={14} /></span>
                    </button>
                  </th>
                  <th scope="col" aria-sort={sort.column === 'size' ? sort.direction : 'none'}>
                    <button className="sort-button" onClick={() => changeSort('size')}>
                      Size
                      <span aria-hidden="true"><Icon name={sort.column === 'size' ? sort.direction === 'ascending' ? 'arrow-up' : 'arrow-down' : 'sort'} size={14} /></span>
                    </button>
                  </th>
                  <th scope="col">Speakers</th>
                  <th scope="col">Settings</th>
                  <th scope="col">Upload status</th>
                  <th scope="col">Transcription status</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {visibleRuns.map((run) => (
                  <tr key={run.id}>
                    <td>
                      <div className="recording-cell">
                        <span className="file-icon">
                          <Icon name="audio" />
                        </span>
                        <div>
                          <button
                            className="filename-button"
                            onClick={() => onOpen(run.id)}
                          >
                            {run.filename}
                          </button>
                          <span className="run-id">{run.id}</span>
                        </div>
                      </div>
                    </td>
                    <td>{formatDate(run.created)}</td>
                    <td className="nowrap">{formatSize(run.size)}</td>
                    <td>{run.speakers ?? 'Auto'}</td>
                    <td>
                      <div className="row-settings">
                        <span>{run.language}</span>
                        <small>
                          {run.labels ? 'Speaker labels' : 'No labels'} ·{' '}
                          {run.timestamps ? 'Timestamps' : 'No timestamps'}
                        </small>
                      </div>
                    </td>
                    <td>
                      <StatusBadge status={getRunStatuses(run).upload} />
                      {run.status === 'uploading' && (
                        <div className="row-progress">
                          <progress
                            max={100}
                            value={run.progress}
                            aria-label={`Simulated upload progress for ${run.filename}`}
                          />
                          <small>{run.progress}% · simulated</small>
                        </div>
                      )}
                    </td>
                    <td>
                      <StatusBadge status={getRunStatuses(run).transcription} />
                    </td>
                    <td>
                      {run.status === 'failed' ? (
                        <button
                          className="button secondary history-action"
                          onClick={() => onRetry(run.id)}
                        >
                          Retry
                        </button>
                      ) : run.status === 'uploading' ? (
                        <button
                          className="button secondary history-action"
                          onClick={() => onCancel(run.id)}
                        >
                          Cancel
                        </button>
                      ) : (
                        <button
                          className="button secondary history-action"
                          aria-label={`View transcript for ${run.filename}`}
                          disabled={run.status !== 'completed'}
                          onClick={() => onOpen(run.id)}
                        >
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
