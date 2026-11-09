import { version as APP_VERSION } from '../package.json'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { getCurrentUser, signIn, signOut as endSession } from './api/auth'
import type { User } from './api/auth'
import { Brand } from './components/Brand'
import { EmptyState } from './components/EmptyState'
import { Icon } from './components/Icon'
import { RunDetail } from './components/RunDetail'
import { UploadPage } from './components/UploadPage'
import { advanceRuns, initialRuns } from './preview'
import type { Run } from './run'
import { initialHistoryView } from './history'
import { HistoryPage } from './components/HistoryPage'
import { SignInForm } from './components/SignInForm'
import './App.css'

type Page = 'history' | 'upload' | 'detail'
function App() {
  const [darkMode, setDarkMode] = useState(() => {
    try {
      const saved = localStorage.getItem('ssscribe-theme')
      if (saved === 'dark' || saved === 'light') return saved === 'dark'
    } catch {
      /* Theme selection also works when storage is unavailable. */
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })
  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light'
    try {
      localStorage.setItem('ssscribe-theme', darkMode ? 'dark' : 'light')
    } catch {
      /* Nonessential preference. */
    }
  }, [darkMode])
  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState('')
  const [accessKey, setAccessKey] = useState('')
  const signedIn = user !== null
  useEffect(() => {
    const controller = new AbortController()
    getCurrentUser(controller.signal)
      .then((current) => {
        if (!controller.signal.aborted) setUser(current)
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setAuthError(
            error instanceof Error
              ? error.message
              : 'Could not check your session.'
          )
      })
      .finally(() => {
        if (!controller.signal.aborted) setAuthLoading(false)
      })
    return () => controller.abort()
  }, [])
  const [page, setPage] = useState<Page>('upload')
  const [historyView, setHistoryView] = useState(initialHistoryView)
  const [runs, setRuns] = useState<Run[]>(initialRuns)
  const [selected, setSelected] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const main = useRef<HTMLElement>(null)
  const hasActive = runs.some((run) =>
    ['uploading', 'finalizing', 'queued', 'processing'].includes(run.status)
  )
  useEffect(() => {
    if (!signedIn || authBusy || !hasActive) return
    const timer = window.setInterval(() => setRuns(advanceRuns), 1300)
    return () => window.clearInterval(timer)
  }, [signedIn, authBusy, hasActive])
  useEffect(() => {
    main.current?.focus()
  }, [page, signedIn, authLoading])
  const uploading = runs.some(
    (run) => run.status === 'uploading' || run.status === 'finalizing'
  )
  useEffect(() => {
    if (!uploading) return
    function warn(event: BeforeUnloadEvent) {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [uploading])
  function navigate(next: Page) {
    setPage(next)
    setNotice('')
  }
  function resetWorkspace() {
    setRuns(initialRuns)
    setHistoryView(initialHistoryView)
    setSelected(null)
    setPage('upload')
    setNotice('')
    setAccessKey('')
    setAuthError('')
  }
  async function submitSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (authBusy) return
    setAuthBusy(true)
    setAuthError('')
    try {
      const current = await signIn(accessKey)
      resetWorkspace()
      setUser(current)
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : 'Could not sign in. Try again.'
      )
    } finally {
      setAuthBusy(false)
    }
  }
  async function signOut() {
    if (authBusy) return
    if (
      uploading &&
      !window.confirm(
        'Stop your simulated upload and sign out? No file has been saved.'
      )
    )
      return
    setRuns((current) =>
      current.map((run) =>
        ['uploading', 'finalizing'].includes(run.status)
          ? { ...run, status: 'cancelled' }
          : run
      )
    )
    setAuthBusy(true)
    try {
      await endSession()
      setUser(null)
      resetWorkspace()
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : 'Could not sign out. Try again.'
      )
    } finally {
      setAuthBusy(false)
    }
  }
  function retry(id: string) {
    setRuns((current) =>
      current.map((run) =>
        run.id === id && run.status === 'failed'
          ? {
              ...run,
              status: 'queued',
              error: undefined,
              attempts: run.attempts + 1
            }
          : run
      )
    )
    setNotice('Processing retry queued. This is a simulation.')
  }
  function cancel(id: string) {
    const run = runs.find((item) => item.id === id)
    if (!run || run.status !== 'uploading') return
    if (!window.confirm(`Cancel the upload of "${run.filename}"? You will need to select the file again to restart.`)) return
    setRuns((current) =>
      current.map((run) =>
        run.id === id && run.status === 'uploading' ? { ...run, status: 'cancelled' } : run
      )
    )
    setNotice('Preview upload cancelled. No file bytes were transferred.')
  }
  const selectedRun = runs.find((run) => run.id === selected)
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="topbar">
        <Brand />
        <div className="header-right">
          <button
            className="theme-toggle"
            type="button"
            aria-label="Dark mode"
            aria-pressed={darkMode}
            title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            onClick={() => setDarkMode((current) => !current)}
          >
            <Icon name={darkMode ? 'sun' : 'moon'} size={17} />
            <span className="theme-toggle-label">Dark mode</span>
            <span className="theme-switch" aria-hidden="true">
              <span />
            </span>
          </button>
          <span className="demo-pill">
            <span />
            LOCAL DEMO
          </span>
          {signedIn && (
            <>
              <div className="identity">
                <span className="avatar">{user?.name.charAt(0)}</span>
                <span>
                  {user?.name}
                  <small>Local user</small>
                </span>
              </div>
              <button className="signout" onClick={signOut} disabled={authBusy}>
                <Icon name="logout" size={17} />
                <span>{authBusy ? 'Signing out…' : 'Sign out'}</span>
              </button>
            </>
          )}
        </div>
      </header>
      {!signedIn ? (
        <main className="signin-wrap" id="main" tabIndex={-1} ref={main}>
          <SignInForm
            accessKey={accessKey}
            loading={authLoading}
            busy={authBusy}
            error={authError}
            onAccessKeyChange={setAccessKey}
            onSubmit={submitSignIn}
          />
        </main>
      ) : (
        <div className="workspace">
          <aside className="sidebar">
            <div className="workspace-label">WORKSPACE</div>
            <nav aria-label="Main navigation">
              <button
                className={page === 'upload' ? 'nav-item active' : 'nav-item'}
                aria-current={page === 'upload' ? 'page' : undefined}
                onClick={() => navigate('upload')}
              >
                <Icon name="upload" />
                Upload
              </button>
              <button
                className={page !== 'upload' ? 'nav-item active' : 'nav-item'}
                aria-current={page !== 'upload' ? 'page' : undefined}
                onClick={() => navigate('history')}
              >
                <Icon name="history" />
                History<span className="nav-count">{runs.length}</span>
              </button>
            </nav>
            <div className="sidebar-bottom">
              <span className="local-dot" /> Built for local exploration
              <p>Your files stay on your device in this UI preview.</p>
              <span className="version">SSScribe / {APP_VERSION}</span>
            </div>
          </aside>
          <main className="main-content" id="main" ref={main} tabIndex={-1}>
            <div className="notification" role="status">
              {notice}
            </div>
            {page === 'upload' ? (
              <UploadPage
                onBegin={(run) => {
                  setRuns((current) => [run, ...current])
                  setPage('history')
                  setNotice(
                    'Preview started. Progress is simulated; no file bytes are uploaded or saved.'
                  )
                }}
              />
            ) : page === 'detail' ? (
              selectedRun ? (
                <RunDetail
                  run={selectedRun}
                  onBack={() => navigate('history')}
                  onRetry={() => retry(selectedRun.id)}
                  onCancel={() => cancel(selectedRun.id)}
                />
              ) : (
                <EmptyState
                  title="Run not found"
                  action={
                    <button
                      className="button secondary"
                      onClick={() => navigate('history')}
                    >
                      Back to History
                    </button>
                  }
                >
                  This recording is not available in the current preview.
                </EmptyState>
              )
            ) : (
              <HistoryPage
                runs={runs}
                view={historyView}
                onViewChange={setHistoryView}
                onUpload={() => navigate('upload')}
                onOpen={(id) => {
                  setSelected(id)
                  navigate('detail')
                }}
                onRetry={retry}
                onCancel={cancel}
              />
            )}
            <footer className="page-footer">
              <span>SSScribe version {APP_VERSION} · Development</span>
            </footer>
          </main>
        </div>
      )}
    </>
  )
}
export default App
