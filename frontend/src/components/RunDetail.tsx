import { useState } from 'react'
import { formatDate, formatSize, getRunStatuses } from '../run'
import type { Run } from '../run'
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
  const transcript = run.transcript ?? ''
  const [exportMessage, setExportMessage] = useState('')
  async function copyTranscript() {
    try {
      await navigator.clipboard.writeText(transcript)
      setExportMessage('Transcript copied.')
    } catch {
      setExportMessage('Could not copy the transcript. Try downloading it instead.')
    }
  }
  function downloadTranscript() {
    try {
      const blob = new Blob([transcript], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${run.filename.replace(/\.[^.]+$/, '')}_transcript.txt`
      document.body.append(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setExportMessage('Transcript download started.')
    } catch {
      setExportMessage('Could not download the transcript. Please try again.')
    }
  }
  const statuses = getRunStatuses(run)
  const stateMessages = {
    uploading: ['Uploading recording', `Upload is ${run.progress}% complete.`],
    finalizing: ['Finalizing upload', 'The recording is being prepared for transcription.'],
    queued: ['Transcription queued', 'Transcription will begin when the recording is ready to process.'],
    processing: ['Transcription in progress', 'The transcript will appear here when processing completes.'],
    failed: ['Transcription failed', run.error ?? 'Transcription could not finish. Retry to process this recording again.'],
    cancelled: ['Upload cancelled', 'Select the recording again on the Upload page to start a new upload.'],
    completed: ['Transcript ready', '']
  }
  const [stateTitle, stateDescription] = stateMessages[run.status]
  return (
    <>
      <button className="back-button" onClick={onBack}>
        ← Back to History
      </button>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{run.id}</span>
          <h1 className="filename-heading">{run.filename}</h1>
          <p>
            {formatDate(run.created)} <span className="dot-separator">·</span>{' '}
            {formatSize(run.size)}
          </p>
        </div>
      </div>
      <div className="detail-layout">
        <section className="panel transcript-panel">
          <div className="panel-title">
            <h2>Transcript</h2>
            {run.status === 'completed' && (
              <div className="transcript-actions">
                <p className="export-message" role="status">{exportMessage}</p>
                <button className="button secondary" onClick={copyTranscript}>Copy</button>
                <button className="button secondary" onClick={downloadTranscript}>Download</button>
              </div>
            )}
          </div>
          {run.status === 'completed' ? (
            <pre className="transcript">{transcript}</pre>
          ) : (
            <EmptyState title={stateTitle}>
              {stateDescription}
            </EmptyState>
          )}
          {run.status === 'uploading' && (
            <div className="detail-progress">
              <progress
                max={100}
                value={run.progress}
                aria-label="Upload progress"
              />
              <button className="button secondary" onClick={onCancel}>
                Cancel upload
              </button>
            </div>
          )}
          {run.status === 'failed' && (
            <div className="detail-progress">
              <button className="button primary" onClick={onRetry}>
                Retry
              </button>
            </div>
          )}
        </section>
        <aside className="panel settings-panel">
          <h2>Recording details</h2>
          <dl>
            <dt>Run ID</dt>
            <dd className="mono">{run.id}</dd>
            <dt>Upload status</dt>
            <dd><StatusBadge status={statuses.upload} /></dd>
            <dt>Transcription status</dt>
            <dd><StatusBadge status={statuses.transcription} /></dd>
            <dt>Submitted</dt>
            <dd>{formatDate(run.created)}</dd>
            <dt>File size</dt>
            <dd>{formatSize(run.size)}</dd>
            <dt>Processing attempts</dt>
            <dd>{run.attempts}</dd>
          </dl>
          <h2 className="settings-heading">Transcription settings</h2>
          <dl>
            <dt>Number of speakers</dt>
            <dd>{run.speakers ?? 'Automatic'}</dd>
            <dt>Language</dt>
            <dd>{run.language}</dd>
            <dt>Speaker labels</dt>
            <dd>{run.labels ? 'Enabled' : 'Disabled'}</dd>
            <dt>Timestamps</dt>
            <dd>{run.timestamps ? 'Enabled' : 'Disabled'}</dd>
          </dl>
        </aside>
      </div>
    </>
  )
}
