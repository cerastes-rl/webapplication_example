import { formatDate, formatSize, sampleTranscript } from '../preview'
import type { Run } from '../preview'
import { EmptyState } from './EmptyState'
import { StatusBadge } from './StatusBadge'

export function RunDetail({
  run,
  onBack,
  onRetry,
  onCancel
}: {
  run: Run
  onBack: () => void
  onRetry: () => void
  onCancel: () => void
}) {
  return (
    <>
      <button className="back-button" onClick={onBack}>
        ← Back to History
      </button>
      <div className="page-heading">
        <div>
          <span className="eyebrow">RUN DETAILS · {run.id}</span>
          <h1 className="filename-heading">{run.filename}</h1>
          <p>
            {formatDate(run.created)} <span className="dot-separator">·</span>{' '}
            {formatSize(run.size)}
          </p>
        </div>
        <StatusBadge status={run.status} />
      </div>
      <div className="detail-layout">
        <section className="panel transcript-panel">
          <div className="panel-title">
            <h2>Transcript</h2>
            <span className="subtle-tag">SAMPLE RESULT</span>
          </div>
          {run.status === 'completed' ? (
            <>
              <div className="transcript-notice">
                Illustrative sample text — not derived from this recording.
                Timestamps and speaker names are examples.
              </div>
              <div className="transcript">
                {sampleTranscript.map((segment, i) => (
                  <div className="transcript-segment" key={segment.time}>
                    {(run.labels || run.timestamps) && (
                      <div className="segment-label">
                        {run.labels && (
                          <strong>
                            {run.speakers === 1 ? 'Speaker 1' : segment.speaker}
                          </strong>
                        )}
                        {run.timestamps && <span>{segment.time}</span>}
                      </div>
                    )}
                    <p key={i}>{segment.text}</p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyState
              title={
                run.status === 'failed'
                  ? 'This run needs another try'
                  : run.status === 'cancelled'
                    ? 'Upload cancelled'
                    : 'Your transcript is on its way'
              }
            >
              {run.error ??
                (run.status === 'uploading'
                  ? `Simulated upload is ${run.progress}% complete. You can navigate away within the app.`
                  : run.status === 'cancelled'
                    ? 'Choose your file again on the Upload page to start a new preview.'
                    : 'This preview will update automatically. No real transcription is performed.')}
            </EmptyState>
          )}
          {run.status === 'uploading' && (
            <div className="detail-progress">
              <progress
                max={100}
                value={run.progress}
                aria-label="Simulated upload progress"
              />
              <button className="button secondary" onClick={onCancel}>
                Cancel preview upload
              </button>
            </div>
          )}
          {run.status === 'failed' && (
            <div className="detail-progress">
              <button className="button primary" onClick={onRetry}>
                Retry processing
              </button>
            </div>
          )}
        </section>
        <aside className="panel settings-panel">
          <h2>Run information</h2>
          <dl>
            <dt>Run ID</dt>
            <dd className="mono">{run.id}</dd>
            <dt>Requested speakers</dt>
            <dd>{run.speakers ?? 'Automatic'}</dd>
            <dt>Language</dt>
            <dd>{run.language}</dd>
            <dt>Speaker labels</dt>
            <dd>{run.labels ? 'Enabled' : 'Disabled'}</dd>
            <dt>Timestamps</dt>
            <dd>{run.timestamps ? 'Enabled' : 'Disabled'}</dd>
            <dt>Processing attempts</dt>
            <dd>{run.attempts}</dd>
          </dl>
          <p className="settings-note">
            Options are saved in preview memory only. They do not perform real
            audio analysis.
          </p>
        </aside>
      </div>
    </>
  )
}
