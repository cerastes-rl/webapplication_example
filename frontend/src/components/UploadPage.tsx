import { useState } from 'react'
import type { FormEvent } from 'react'
import { formatSize, MAX_FILE_SIZE } from '../preview'
import type { Run } from '../preview'
import { Icon } from './Icon'

export function UploadPage({ onBegin }: { onBegin: (run: Run) => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [speakers, setSpeakers] = useState('auto')
  const [labels, setLabels] = useState(true)
  const [timestamps, setTimestamps] = useState(true)
  const [error, setError] = useState('')
  function validate(next: File | null) {
    setFile(next)
    if (!next) {
      setError('')
      return
    }
    if (!/\.(mp3|wav)$/i.test(next.name))
      setError('Choose an MP3 or WAV audio file.')
    else if (next.size === 0)
      setError('This file is empty. Please choose another recording.')
    else if (next.size > MAX_FILE_SIZE)
      setError('This file exceeds the 4 GB limit (4,000,000,000 bytes).')
    else setError('')
  }
  function submit(event: FormEvent) {
    event.preventDefault()
    if (!file) {
      setError('Choose an audio file before beginning.')
      return
    }
    if (error) return
    onBegin({
      id: `RUN-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      filename: file.name,
      size: file.size,
      created: new Date().toISOString(),
      speakers: speakers === 'auto' ? null : Number(speakers),
      language: 'English',
      labels,
      timestamps,
      status: 'uploading',
      progress: 0,
      attempts: 1
    })
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR WORKSPACE</span>
          <h1>Upload a recording</h1>
          <p>From spoken words to something you can work with.</p>
        </div>
      </div>
      <div className="upload-layout">
        <form onSubmit={submit} noValidate>
          <section className="panel form-panel">
            <div className="section-heading">
              <span className="step-number">1</span>
              <div>
                <h2>Choose your audio</h2>
                <p>Start with a recording from your device.</p>
              </div>
            </div>
            <div className={`file-picker ${error ? 'invalid' : ''}`}>
              <span className="upload-symbol">
                <Icon name="upload" size={30} />
              </span>
              <h3>{file ? file.name : 'Your next transcript starts here'}</h3>
              <p>
                {file
                  ? formatSize(file.size)
                  : 'Choose an audio recording to get started.'}
              </p>
              <label className="button secondary file-button">
                {file ? 'Change file' : 'Choose file'}
                <input
                  type="file"
                  accept=".mp3,.wav,audio/mpeg,audio/wav,audio/x-wav"
                  aria-label="Choose audio file"
                  aria-describedby="file-guidance file-error"
                  onChange={(event) =>
                    validate(event.target.files?.[0] ?? null)
                  }
                />
              </label>
              <small id="file-guidance">
                MP3 or WAV · Up to 4 GB (4,000,000,000 bytes)
              </small>
            </div>
            <p id="file-error" className="field-error" role="alert">
              {error}
            </p>
          </section>
          <section className="panel form-panel">
            <div className="section-heading">
              <span className="step-number">2</span>
              <div>
                <h2>Make it yours</h2>
                <p>Set your transcription preferences.</p>
              </div>
            </div>
            <div className="form-grid">
              <label className="field">
                Number of speakers
                <select
                  value={speakers}
                  onChange={(event) => setSpeakers(event.target.value)}
                >
                  <option value="auto">Unknown / Automatic</option>
                  {Array.from({ length: 10 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {i + 1} {i === 0 ? 'speaker' : 'speakers'}
                    </option>
                  ))}
                </select>
                <small>Requested count, not detected speakers.</small>
              </label>
              <label className="field">
                Recording language
                <select defaultValue="English">
                  <option>English</option>
                </select>
                <small>More languages can be added later.</small>
              </label>
            </div>
            <div className="option-list">
              <label className="checkbox-row">
                <span>
                  <strong>Speaker labels</strong>
                  <small>Separate the conversation by speaker.</small>
                </span>
                <input
                  type="checkbox"
                  checked={labels}
                  onChange={(event) => setLabels(event.target.checked)}
                />
              </label>
              <label className="checkbox-row">
                <span>
                  <strong>Timestamps</strong>
                  <small>Add time markers to the transcript.</small>
                </span>
                <input
                  type="checkbox"
                  checked={timestamps}
                  onChange={(event) => setTimestamps(event.target.checked)}
                />
              </label>
            </div>
          </section>
          <div className="submit-row">
            <p>Preview only. No file bytes are uploaded or saved.</p>
            <button className="button primary" type="submit">
              <Icon name="upload" size={17} />
              Begin upload
            </button>
          </div>
        </form>
        <aside className="upload-aside">
          <span className="eyebrow">A LITTLE CLARITY</span>
          <h2>
            Less listening back.
            <br />
            More moving forward.
          </h2>
          <p>Your recordings and their progress live together in History.</p>
          <ol>
            <li>
              <strong>Choose a recording</strong>
              <span>Add your audio and preferences.</span>
            </li>
            <li>
              <strong>Follow its progress</strong>
              <span>Move between pages while the preview runs.</span>
            </li>
            <li>
              <strong>Read your transcript</strong>
              <span>Open a completed run to explore sample text.</span>
            </li>
          </ol>
          <div className="aside-note">
            <strong>This is a UI preview</strong>
            <p>
              Progress and transcripts are simulated. Settings are kept for this
              session only. Reloading resets the demo.
            </p>
          </div>
        </aside>
      </div>
    </>
  )
}
