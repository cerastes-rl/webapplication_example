import { useState } from 'react'
import type { FormEvent } from 'react'
import { formatSize, MAX_FILE_SIZE } from '../run'
import type { UploadSettings } from '../api/recordings'
import { Icon } from './Icon'

export function UploadPage({ onBegin, busy }: { onBegin: (file: File, settings: UploadSettings) => void; busy: boolean }) {
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
    if (!/\.txt$/i.test(next.name))
      setError('Choose a TXT file for the local mock.')
    else if (next.size === 0)
      setError('This file is empty. Please choose another recording.')
    else if (next.size > MAX_FILE_SIZE)
      setError('This file exceeds the 1 MB local limit.')
    else setError('')
  }
  function submit(event: FormEvent) {
    event.preventDefault()
    if (!file) {
      setError('Choose a TXT file before beginning.')
      return
    }
    if (error) return
    if (busy) return
    onBegin(file, {
      requested_speakers: speakers === 'auto' ? null : Number(speakers),
      include_speaker_labels: labels,
      include_timestamps: timestamps
    })
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Upload a text file</h1>
        </div>
      </div>
      <div className="upload-layout">
        <form onSubmit={submit} noValidate>
          <section className="panel form-panel">
            <div className="section-heading">
              <span className="step-number">1</span>
              <div>
                <h2>Choose your text file</h2>
                <p>Use a text fixture for the local mock.</p>
              </div>
            </div>
            <div className={`file-picker ${error ? 'invalid' : ''}`}>
              <span className="upload-symbol">
                <Icon name="upload" size={30} />
              </span>
              <h3>{file ? file.name : 'Select a text file'}</h3>
              <p>
                {file
                  ? formatSize(file.size)
                  : 'Choose a text file to get started.'}
              </p>
              <label className="button secondary file-button">
                {file ? 'Change file' : 'Choose file'}
                <input
                  type="file"
                  accept=".txt,text/plain"
                  aria-label="Choose text file"
                  aria-describedby="file-guidance file-error"
                  onChange={(event) =>
                    validate(event.target.files?.[0] ?? null)
                  }
                />
              </label>
              <small id="file-guidance">
                TXT · Up to 1 MB
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
            <p>Files are saved and transcribed locally. Refresh History to see progress and results.</p>
            <div className="submit-action">
              <span className="step-number">3</span>
              <button className="button primary" type="submit" disabled={busy}>
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
              <strong>Choose your text file</strong>
              <span>Select a text file from your device.</span>
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
