import { useState } from 'react'
import { formatDate, formatSize } from '../../run'
import type { Run } from '../../run'
import { EmptyState } from './EmptyState'
import { StatusBadge } from './StatusBadge'

export function RunDetail({
  run,
  onBack,
  progress,
  onCancel
}: {
  run: Run
  onBack: () => void
  progress?: number
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
  const uploadMessages = {
    uploading: ['Uploading file', progress === undefined ? 'This upload did not finish. Select the file again to start a new run.' : `${progress}% sent to storage.`],
    completed: ['File saved', ''],
    failed: ['Upload failed', run.error_message ?? 'Select the file again to start a new upload.'],
    cancelled: ['Upload cancelled', 'Select the file again to start a new upload.']
  }
  const transcriptionMessages = {
    not_started: ['Transcription not started', ''],
    queued: ['Transcription queued', 'Speech has accepted the job and has not started processing it yet.'],
    running: ['Transcription in progress', 'The transcript will appear here when processing completes.'],
    importing: ['Importing transcript', ''],
    completed: ['Transcript ready', ''],
    failed: ['Transcription failed', run.error_message ?? 'Transcription could not finish.'],
    submission_uncertain: ['Submission uncertain', run.error_message ?? 'The submission could not be confirmed.']
  }
  const [stateTitle, stateDescription] = run.upload_stage === 'completed'
    ? transcriptionMessages[run.transcription_stage] : uploadMessages[run.upload_stage]
  return (
    <>
      <button className="back-button" onClick={onBack}>
        ← Back to History
      </button>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{run.run_id}</span>
          <h1 className="filename-heading">{run.filename}</h1>
          <p>
            {formatDate(run.created_at)} <span className="dot-separator">·</span>{' '}
            {formatSize(run.size_bytes)}
          </p>
        </div>
      </div>
      <div className="detail-layout">
        <section className="panel transcript-panel">
          <div className="panel-title">
            <h2>Transcript</h2>
            {run.transcription_stage === 'completed' && (
              <div className="transcript-actions">
                <p className="export-message" role="status">{exportMessage}</p>
                <button className="button secondary" onClick={copyTranscript}>Copy</button>
                <button className="button secondary" onClick={downloadTranscript}>Download</button>
              </div>
            )}
          </div>
          {run.transcription_stage === 'completed' ? (
            <pre className="transcript">{transcript}</pre>
          ) : (
            <EmptyState title={stateTitle}>
              {stateDescription}
            </EmptyState>
          )}
          {['uploading', 'failed'].includes(run.upload_stage) && (
            <div className="detail-progress">
              {progress !== undefined && <progress max={100} value={progress} aria-label="Upload progress" />}
              <button className="button secondary" onClick={onCancel}>
                Cancel upload
              </button>
            </div>
          )}

        </section>
        <aside className="panel settings-panel">
          <h2>Recording details</h2>
          <dl>
            <dt>Run ID</dt>
            <dd className="mono">{run.run_id}</dd>
            <dt>Upload status</dt>
            <dd><StatusBadge status={progress === 100 ? 'finalizing' : run.upload_stage} /></dd>
            <dt>Transcription status</dt>
            <dd><StatusBadge status={run.transcription_stage} /></dd>
            <dt>Submitted</dt>
            <dd>{formatDate(run.created_at)}</dd>
            <dt>File size</dt>
            <dd>{formatSize(run.size_bytes)}</dd>
          </dl>
          <h2 className="settings-heading">Transcription settings</h2>
          <dl>
            <dt>Number of speakers</dt>
            <dd>{run.requested_speakers ?? 'Automatic'}</dd>
            <dt>Language</dt>
            <dd>{run.language === 'en-US' ? 'English' : run.language}</dd>
            <dt>Speaker labels</dt>
            <dd>{run.include_speaker_labels ? 'Enabled' : 'Disabled'}</dd>
            <dt>Timestamps</dt>
            <dd>{run.include_timestamps ? 'Enabled' : 'Disabled'}</dd>
          </dl>
        </aside>
      </div>
    </>
  )
}
