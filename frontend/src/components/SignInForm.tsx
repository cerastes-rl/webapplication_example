import type { FormEvent } from 'react'
import { Icon } from './Icon'

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
      <span className="eyebrow">WELCOME TO SSScribe</span>
      <h1>
        A little more clarity.
        <br />
        One recording at a time.
      </h1>
      <p>
        Upload recordings, follow their progress, and bring your conversations
        into focus.
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
              aria-describedby="access-key-hint auth-error"
            />
          </label>
          <p id="access-key-hint">
            Enter <strong>austin</strong> or <strong>john</strong>.
          </p>
          <p id="auth-error" className="field-error" role="alert">
            {error}
          </p>
          <button className="button primary" type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'} <Icon name="arrow" size={16} />
          </button>
        </form>
      )}
      <small>
        Local sign-in. History and uploads use shared sample data.
        <br />
        User-specific SQL history will be added later.
      </small>
    </div>
  )
}
