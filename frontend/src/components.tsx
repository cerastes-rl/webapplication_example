import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { formatDate, formatSize, MAX_FILE_SIZE, sampleTranscript } from './preview'
import type { Run, Status } from './preview'

export function Icon({ name, size = 20 }: { name: 'upload' | 'history' | 'audio' | 'arrow' | 'logout' | 'check' | 'sun' | 'moon'; size?: number }) {
  const paths = {
    upload: <><path d="M12 16V3m-5 5 5-5 5 5" /><path d="M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5" /></>,
    history: <><path d="M3 11a9 9 0 1 1 2.5 7M3 4v7h7" /><path d="M12 7v5l3 2" /></>,
    audio: <><path d="M8 3h7l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h2Z" /><path d="M14 3v5h5M9 13v3m3-5v7m3-5v3" /></>,
    arrow: <path d="m9 5 7 7-7 7" />,
    logout: <><path d="M9 4H4v16h5m5-13 5 5-5 5m-6-5h11" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    moon: <path d="M20 14a8 8 0 0 1-10-10 8.5 8.5 0 1 0 10 10Z" />,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}
export function Brand() {
  return <div className="brand"><span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /><i /></span><span>SSScribe<span className="brand-dot">.</span></span></div>
}
export function StatusBadge({ status }: { status: Status }) {
  return <span className={`status ${status}`}><span className="status-dot" />{status.charAt(0).toUpperCase() + status.slice(1)}</span>
}
export function EmptyState({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return <div className="empty-state"><span className="empty-icon"><Icon name="audio" size={28} /></span><h2>{title}</h2><p>{children}</p>{action}</div>
}
export function UploadPage({ onBegin }: { onBegin: (run: Run) => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [speakers, setSpeakers] = useState('auto')
  const [labels, setLabels] = useState(true)
  const [timestamps, setTimestamps] = useState(true)
  const [error, setError] = useState('')
  function validate(next: File | null) {
    setFile(next)
    if (!next) { setError(''); return }
    if (!/\.(mp3|wav)$/i.test(next.name)) setError('Choose an MP3 or WAV audio file.')
    else if (next.size === 0) setError('This file is empty. Please choose another recording.')
    else if (next.size > MAX_FILE_SIZE) setError('This file exceeds the 4 GB limit (4,000,000,000 bytes).')
    else setError('')
  }
  function submit(event: FormEvent) {
    event.preventDefault()
    if (!file) { setError('Choose an audio file before beginning.'); return }
    if (error) return
    onBegin({ id: `RUN-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, filename: file.name, size: file.size, created: new Date().toISOString(), speakers: speakers === 'auto' ? null : Number(speakers), language: 'English', labels, timestamps, status: 'uploading', progress: 0, attempts: 1 })
  }
  return <>
    <div className="page-heading"><div><span className="eyebrow">YOUR WORKSPACE</span><h1>Upload a recording</h1><p>From spoken words to something you can work with.</p></div></div>
    <div className="upload-layout"><form onSubmit={submit} noValidate>
      <section className="panel form-panel"><div className="section-heading"><span className="step-number">1</span><div><h2>Choose your audio</h2><p>Start with a recording from your device.</p></div></div>
        <div className={`file-picker ${error ? 'invalid' : ''}`}><span className="upload-symbol"><Icon name="upload" size={30} /></span><h3>{file ? file.name : 'Your next transcript starts here'}</h3><p>{file ? formatSize(file.size) : 'Choose an audio recording to get started.'}</p><label className="button secondary file-button">{file ? 'Change file' : 'Choose file'}<input type="file" accept=".mp3,.wav,audio/mpeg,audio/wav,audio/x-wav" aria-label="Choose audio file" aria-describedby="file-guidance file-error" onChange={event => validate(event.target.files?.[0] ?? null)} /></label><small id="file-guidance">MP3 or WAV · Up to 4 GB (4,000,000,000 bytes)</small></div>
        <p id="file-error" className="field-error" role="alert">{error}</p>
      </section>
      <section className="panel form-panel"><div className="section-heading"><span className="step-number">2</span><div><h2>Make it yours</h2><p>Set your transcription preferences.</p></div></div>
        <div className="form-grid"><label className="field">Number of speakers<select value={speakers} onChange={event => setSpeakers(event.target.value)}><option value="auto">Unknown / Automatic</option>{Array.from({ length: 10 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1} {i === 0 ? 'speaker' : 'speakers'}</option>)}</select><small>Requested count, not detected speakers.</small></label><label className="field">Recording language<select defaultValue="English"><option>English</option></select><small>More languages can be added later.</small></label></div>
        <div className="option-list"><label className="checkbox-row"><span><strong>Speaker labels</strong><small>Separate the conversation by speaker.</small></span><input type="checkbox" checked={labels} onChange={event => setLabels(event.target.checked)} /></label><label className="checkbox-row"><span><strong>Timestamps</strong><small>Add time markers to the transcript.</small></span><input type="checkbox" checked={timestamps} onChange={event => setTimestamps(event.target.checked)} /></label></div>
      </section>
      <div className="submit-row"><p>Preview only. No file bytes are uploaded or saved.</p><button className="button primary" type="submit"><Icon name="upload" size={17} />Begin upload</button></div>
    </form><aside className="upload-aside"><span className="eyebrow">A LITTLE CLARITY</span><h2>Less listening back.<br />More moving forward.</h2><p>Your recordings and their progress live together in History.</p><ol><li><strong>Choose a recording</strong><span>Add your audio and preferences.</span></li><li><strong>Follow its progress</strong><span>Move between pages while the preview runs.</span></li><li><strong>Read your transcript</strong><span>Open a completed run to explore sample text.</span></li></ol><div className="aside-note"><strong>This is a UI preview</strong><p>Progress and transcripts are simulated. Settings are kept for this session only. Reloading resets the demo.</p></div></aside></div>
  </>
}
export function RunDetail({ run, onBack, onRetry, onCancel }: { run: Run; onBack: () => void; onRetry: () => void; onCancel: () => void }) {
  return <><button className="back-button" onClick={onBack}>← Back to History</button><div className="page-heading"><div><span className="eyebrow">RUN DETAILS · {run.id}</span><h1 className="filename-heading">{run.filename}</h1><p>{formatDate(run.created)} <span className="dot-separator">·</span> {formatSize(run.size)}</p></div><StatusBadge status={run.status} /></div>
    <div className="detail-layout"><section className="panel transcript-panel"><div className="panel-title"><h2>Transcript</h2><span className="subtle-tag">SAMPLE RESULT</span></div>{run.status === 'completed' ? <><div className="transcript-notice">Illustrative sample text — not derived from this recording. Timestamps and speaker names are examples.</div><div className="transcript">{sampleTranscript.map((segment, i) => <div className="transcript-segment" key={segment.time}>{(run.labels || run.timestamps) && <div className="segment-label">{run.labels && <strong>{run.speakers === 1 ? 'Speaker 1' : segment.speaker}</strong>}{run.timestamps && <span>{segment.time}</span>}</div>}<p key={i}>{segment.text}</p></div>)}</div></> : <EmptyState title={run.status === 'failed' ? 'This run needs another try' : run.status === 'cancelled' ? 'Upload cancelled' : 'Your transcript is on its way'}>{run.error ?? (run.status === 'uploading' ? `Simulated upload is ${run.progress}% complete. You can navigate away within the app.` : run.status === 'cancelled' ? 'Choose your file again on the Upload page to start a new preview.' : 'This preview will update automatically. No real transcription is performed.')}</EmptyState>}
    {run.status === 'uploading' && <div className="detail-progress"><progress max={100} value={run.progress} aria-label="Simulated upload progress" /><button className="button secondary" onClick={onCancel}>Cancel preview upload</button></div>}{run.status === 'failed' && <div className="detail-progress"><button className="button primary" onClick={onRetry}>Retry processing</button></div>}</section>
    <aside className="panel settings-panel"><h2>Run information</h2><dl><dt>Run ID</dt><dd className="mono">{run.id}</dd><dt>Requested speakers</dt><dd>{run.speakers ?? 'Automatic'}</dd><dt>Language</dt><dd>{run.language}</dd><dt>Speaker labels</dt><dd>{run.labels ? 'Enabled' : 'Disabled'}</dd><dt>Timestamps</dt><dd>{run.timestamps ? 'Enabled' : 'Disabled'}</dd><dt>Processing attempts</dt><dd>{run.attempts}</dd></dl><p className="settings-note">Options are saved in preview memory only. They do not perform real audio analysis.</p></aside></div></>
}
