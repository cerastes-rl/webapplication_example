import type { FormEvent } from 'react'
import { Icon } from './Icon'
import { Wordmark } from './Wordmark'

type SignInFormProps = {
  accessKey: string
  loading: boolean
  busy: boolean
  error: string
  onAccessKeyChange: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

export function SignInForm({
  accessKey,
  loading,
  busy,
  error,
  onAccessKeyChange,
  onSubmit
}: SignInFormProps) {
  return (
    <div className="panel signin-card">
      <h1><Wordmark /></h1>
      <p>
        An application to upload user recordings, track transcription progress, and view transcripts.
      </p>
      {loading ? (
        <p role="status">Checking your session…</p>
      ) : (
        <form className="signin-form" onSubmit={onSubmit} aria-busy={busy}>
          <label className="field" htmlFor="access-key">
            Access key
            <input
              id="access-key"
              type="password"
              autoComplete="current-password"
              value={accessKey}
              onChange={(event) => onAccessKeyChange(event.target.value)}
              required
              maxLength={32}
              disabled={busy}
              aria-describedby="auth-error"
            />
          </label>
          <p id="auth-error" className="field-error" role="alert">
            {error}
          </p>
          <button className="button primary" type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'} <Icon name="arrow" size={16} />
          </button>
        </form>
      )}
    </div>
  )
}
