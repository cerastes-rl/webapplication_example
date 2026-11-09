import { EmptyState } from './EmptyState'
import { Icon } from './Icon'
import { StatusBadge } from './StatusBadge'
import { formatDate, formatSize } from '../preview'
import type { Run } from '../preview'

type HistoryPageProps = {
  runs: Run[]
  scenario: string
  loading: boolean
  onScenarioChange: (value: string) => void
  onRefresh: () => void
  onUpload: () => void
  onOpen: (id: string) => void
  onRetry: (id: string) => void
  onCancel: (id: string) => void
}

export function HistoryPage({
  runs,
  scenario,
  loading,
  onScenarioChange,
  onRefresh,
  onUpload,
  onOpen,
  onRetry,
  onCancel
}: HistoryPageProps) {
  const shownRuns = scenario === 'empty' ? [] : runs
  const completed = runs.filter((run) => run.status === 'completed').length

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR WORKSPACE</span>
          <h1>
            Recording history<span className="heading-dot">.</span>
          </h1>
          <p>Every conversation, all in one place.</p>
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
          <small>Your workspace, at a glance</small>
        </div>
        <div className="stat-card">
          <span>Ready to read</span>
          <strong>
            {completed.toString().padStart(2, '0')}
            <span className="stat-indicator">
              <Icon name="check" size={18} />
            </span>
          </strong>
          <small>Completed sample transcripts</small>
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
          <small>Uploads and processing runs</small>
        </div>
      </div>
      <section className="panel history-panel" aria-label="Recording history">
        <div className="table-toolbar">
          <div>
            <h2>
              All recordings <span>{shownRuns.length}</span>
            </h2>
            <p>Open a run for its settings and transcript.</p>
          </div>
          <div className="toolbar-controls">
            <label className="scenario-control">
              Preview state
              <select
                value={scenario}
                onChange={(event) => onScenarioChange(event.target.value)}
              >
                <option value="normal">Example recordings</option>
                <option value="empty">Empty history</option>
                <option value="error">Connection error</option>
              </select>
            </label>
            <button
              className="refresh-button"
              aria-label="Preview loading state"
              onClick={onRefresh}
            >
              <Icon name="history" size={18} />
            </button>
          </div>
        </div>
        {loading ? (
          <div className="empty-state" role="status">
            <span className="loading-ring" />
            <h2>Loading recordings…</h2>
            <p>Simulated loading state.</p>
          </div>
        ) : scenario === 'error' ? (
          <EmptyState
            title="Couldn’t load your recordings"
            action={
              <button
                className="button secondary"
                onClick={() => {
                  onScenarioChange('normal')
                  onRefresh()
                }}
              >
                Try again
              </button>
            }
          >
            This is a preview of a connection error, not a real API request.
          </EmptyState>
        ) : shownRuns.length === 0 ? (
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
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Recording / Run ID</th>
                  <th scope="col">Submitted</th>
                  <th scope="col">Size</th>
                  <th scope="col">Speakers</th>
                  <th scope="col">Settings</th>
                  <th scope="col">Status</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {shownRuns.map((run) => (
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
                      <StatusBadge status={run.status} />
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
                      {run.status === 'failed' ? (
                        <button
                          className="text-button"
                          onClick={() => onRetry(run.id)}
                        >
                          Retry
                        </button>
                      ) : run.status === 'uploading' ? (
                        <button
                          className="text-button"
                          onClick={() => onCancel(run.id)}
                        >
                          Cancel
                        </button>
                      ) : (
                        <button
                          className="open-button"
                          aria-label={`Open ${run.filename}`}
                          onClick={() => onOpen(run.id)}
                        >
                          <Icon name="arrow" size={17} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="table-footer">
          <span>Shared sample recordings · This session only</span>
          <span>SQL history filtering is planned.</span>
        </div>
      </section>
      <div className="history-footnote">
        <Icon name="audio" size={16} />
        <p>
          Good conversations deserve a second look. Select a completed recording
          to read its sample transcript.
        </p>
      </div>
    </>
  )
}
