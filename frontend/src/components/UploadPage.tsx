import { useState } from 'react'
import type { FormEvent } from 'react'
import { formatSize, MAX_FILE_SIZE } from '../run'
import type { Run } from '../run'
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
    if (!/\.(mp3|wav|txt)$/i.test(next.name))
      setError('Choose an MP3 or WAV audio file.')
    else if (next.size === 0)
      setError('This file is empty. Please choose another recording.')
    else if (next.size > MAX_FILE_SIZE)
      setError('This file exceeds the 1 GB limit.')
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
          <h1>Upload a recording</h1>
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
              <h3>{file ? file.name : 'Select a recording'}</h3>
              <p>
                {file
                  ? formatSize(file.size)
                  : 'Choose an audio recording to get started.'}
              </p>
              <label className="button secondary file-button">
                {file ? 'Change file' : 'Choose file'}
                <input
                  type="file"
                  accept=".mp3,.wav,.txt,audio/mpeg,audio/wav,audio/x-wav,text/plain"
                  aria-label="Choose audio file"
                  aria-describedby="file-guidance file-error"
                  onChange={(event) =>
                    validate(event.target.files?.[0] ?? null)
                  }
                />
              </label>
              <small id="file-guidance">
                MP3 or WAV · Up to 1 GB
              </small>
            </div>
            <p id="file-error" className="field-error" role="alert">
              {error}
            </p>
          </section>
          <section className="panel form-panel">
            <div className="section-heading">
              <span className="step-number">2</span>
              <h2>Transcription settings</h2>
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
              </label>
              <label className="field">
                Recording language
                <select defaultValue="English">
                  <option>English</option>
                </select>
              </label>
            </div>
            <div className="option-list">
              <label className="checkbox-row">
                <span>Speaker labels</span>
                <input
                  type="checkbox"
                  checked={labels}
                  onChange={(event) => setLabels(event.target.checked)}
                />
              </label>
              <label className="checkbox-row">
                <span>Timestamps</span>
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
            <div className="submit-action">
              <span className="step-number">3</span>
              <button className="button primary" type="submit">
                <Icon name="upload" size={17} />
                Begin upload
              </button>
            </div>
          </div>
        </form>
        <aside className="upload-aside">
          <h2>Instructions</h2>
          <ol>
            <li>
              <strong>Choose your audio</strong>
              <span>Select a recording from your device.</span>
            </li>
            <li>
              <strong>Transcription settings</strong>
              <span>Choose the speaker count, language, speaker labels and timestamps.</span>
            </li>
            <li>
              <strong>Begin upload</strong>
              <span>Select Begin upload to submit your recording.</span>
            </li>
          </ol>
        </aside>
      </div>
    </>
  )
}
