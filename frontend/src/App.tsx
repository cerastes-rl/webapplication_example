import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { version as APP_VERSION } from '../package.json'
import { getCurrentUser, signIn, signOut as endSession } from './api/auth.ts'
import type { User } from './api/auth.ts'
import { authorizeUpload, cancelUpload, completeUpload, failUpload, getTranscript, listRecordings, putFile } from './api/recordings.ts'
import type { UploadSettings } from './api/recordings.ts'
import { Brand } from './components/Brand.tsx'
import { EmptyState } from './components/EmptyState.tsx'
import { HistoryPage } from './components/HistoryPage.tsx'
import { Icon } from './components/Icon.tsx'
import { RunDetail } from './components/RunDetail.tsx'
import { SignInForm } from './components/SignInForm.tsx'
import { UploadPage } from './components/UploadPage.tsx'
import { initialHistoryView } from './history.ts'
import type { Run, UploadProgress } from './run.ts'
import './App.css'

type Page = 'history' | 'upload' | 'detail'
function App(): ReactNode {
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
  const [page, setPage] = useState<Page>('upload')
  const [historyView, setHistoryView] = useState(initialHistoryView)
  const [runs, setRuns] = useState<Run[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [notice, setNotice] = useState('')
  const main = useRef<HTMLElement>(null)
  const session = useRef(0)
  const historyRequest = useRef<AbortController | null>(null)
  const [upload, setUpload] = useState<(UploadProgress & { controller: AbortController }) | null>(null)
  const [dataLoading, setDataLoading] = useState(true)
  const [dataError, setDataError] = useState('')

  const loadHistory = useCallback(async (): Promise<void> => {
    historyRequest.current?.abort()
    const controller = new AbortController()
    historyRequest.current = controller
    const generation = session.current
    try {
      const records = await listRecordings(controller.signal)
      if (!controller.signal.aborted && generation === session.current)
        setRuns((current) => records.map((record) => ({
          ...record, transcript: current.find((run) => run.run_id === record.run_id)?.transcript
        })))
    } catch (error) {
      if (!controller.signal.aborted && generation === session.current)
        setDataError(error instanceof Error ? error.message : 'Could not load History.')
    } finally {
      if (!controller.signal.aborted && generation === session.current) setDataLoading(false)
    }
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    getCurrentUser(controller.signal)
      .then((current) => {
        if (!controller.signal.aborted) {
          setUser(current)
          if (current) void loadHistory()
        }
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
    return () => { controller.abort(); historyRequest.current?.abort() }
  }, [loadHistory])
  const selectedRun = runs.find((run) => run.run_id === selected)
  useEffect(() => {
    if (!user || page !== 'detail' || selectedRun?.transcription_stage !== 'completed' || selectedRun.transcript !== undefined) return
    const controller = new AbortController()
    getTranscript(selectedRun.run_id, controller.signal).then((transcript) => {
      if (!controller.signal.aborted)
        setRuns((current) => current.map((run) => run.run_id === selectedRun.run_id ? { ...run, transcript } : run))
    }).catch((error) => {
      if (!controller.signal.aborted) setDataError(error.message)
    })
    return () => controller.abort()
  }, [user, page, selectedRun])
  const transferController = upload?.controller
  useEffect(() => () => transferController?.abort(), [transferController])
  useEffect(() => () => { session.current += 1 }, [])
  useEffect(() => { main.current?.focus() }, [page, signedIn, authLoading])
  const uploadInProgress = upload !== null
  useEffect(() => {
    if (!uploadInProgress) return
    function warn(event: BeforeUnloadEvent) {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [uploadInProgress])

  function refreshHistory(): void {
    setDataLoading(true)
    setDataError('')
    void loadHistory()
  }
  function navigate(next: Page): void {
    setPage(next)
    setNotice('')
    setDataError('')
    if (next === 'history') refreshHistory()
  }
  function resetWorkspace(): void {
    session.current += 1
    historyRequest.current?.abort()
    upload?.controller.abort()
    setUpload(null)
    setRuns([])
    setDataLoading(true)
    setDataError('')
    setHistoryView(initialHistoryView)
    setSelected(null)
    setPage('upload')
    setNotice('')
    setAccessKey('')
    setAuthError('')
  }
  async function submitSignIn(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (authBusy) return
    setAuthBusy(true)
    setAuthError('')
    try {
      const current = await signIn(accessKey)
      resetWorkspace()
      setUser(current)
      refreshHistory()
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Could not sign in.')
    } finally {
      setAuthBusy(false)
    }
  }
  function saveRun(run: Run): void {
    setRuns((current) => [run, ...current.filter((item) => item.run_id !== run.run_id)])
  }
  async function beginUpload(file: File, settings: UploadSettings): Promise<void> {
    if (upload || !user || authBusy) return
    const controller = new AbortController()
    const signal = controller.signal
    const generation = session.current
    let id: number | null = null
    let sent = false
    setUpload({ controller, run_id: null, progress: 0 })
    setNotice('')
    try {
      const { run, upload_url, headers } = await authorizeUpload(file, settings, signal)
      if (signal.aborted || generation !== session.current) return
      id = run.run_id
      setUpload({ controller, run_id: id, progress: 0 })
      saveRun(run)
      setPage('history')
      refreshHistory()
      await putFile(file, upload_url, headers, signal, (progress) => {
        if (!signal.aborted && generation === session.current)
          setUpload({ controller, run_id: id, progress })
      })
      sent = true
      saveRun(await completeUpload(id, signal))
      setNotice('')
    } catch (error) {
      if (signal.aborted || generation !== session.current) return
      if (id !== null && !sent) {
        try {
          const failed = await failUpload(id)
          if (!signal.aborted && generation === session.current) saveRun(failed)
        } catch { /* The original row stays in History. */ }
      }
      if (!signal.aborted && generation === session.current)
        setNotice(`${error instanceof Error ? error.message : 'Upload failed.'} Select the file again to start a new upload.`)
    } finally {
      if (generation === session.current) {
        setUpload((current) => current?.controller === controller ? null : current)
        refreshHistory()
      }
    }
  }
  async function cancel(id: number): Promise<void> {
    if (!window.confirm('Cancel this upload? Select the file again to start a new run.')) return
    const generation = session.current
    if (upload?.run_id === id) upload.controller.abort()
    try {
      const run = await cancelUpload(id)
      if (generation === session.current) {
        saveRun(run)
        setNotice('Upload cancelled.')
      }
    } catch (error) {
      if (generation === session.current) setNotice(error instanceof Error ? error.message : 'Cancellation could not be confirmed.')
    } finally {
      if (generation === session.current) refreshHistory()
    }
  }
  async function signOut(): Promise<void> {
    if (authBusy) return
    if (upload && !window.confirm('Stop the active upload and sign out?')) return
    setAuthBusy(true)
    upload?.controller.abort()
    try {
      if (upload && upload.run_id !== null) await cancelUpload(upload.run_id)
      await endSession()
      setUser(null)
      resetWorkspace()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not sign out.')
      refreshHistory()
    } finally {
      setAuthBusy(false)
    }
  }

  function renderPage(): ReactNode {
    if (page === 'upload') return <UploadPage onBegin={beginUpload} busy={upload !== null || authBusy} />
    if (page === 'history') return (
      <HistoryPage
        runs={runs}
        view={historyView}
        onViewChange={setHistoryView}
        onUpload={() => navigate('upload')}
        onRefresh={refreshHistory}
        loading={dataLoading}
        notice={notice}
        onOpen={(id) => {
          setSelected(id)
          navigate('detail')
        }}
        upload={upload}
        onCancel={cancel}
      />
    )
    if (!selectedRun) return (
      <EmptyState
        title="Run not found"
        action={
          <button className="button secondary" onClick={() => navigate('history')}>Back to History</button>
        }
      >
        This recording is not available for the current user.
      </EmptyState>
    )
    if (selectedRun.transcription_stage === 'completed' && selectedRun.transcript === undefined)
      return <p role="status">Loading stored transcript…</p>
    return (
      <RunDetail
        run={selectedRun}
        onBack={() => navigate('history')}
        progress={upload?.run_id === selectedRun.run_id ? upload.progress : undefined}
        onCancel={() => cancel(selectedRun.run_id)}
      />
    )
  }
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="topbar">
        <Brand />
        <div className="upload-banner" role="status">
          {signedIn && upload && <>
            <strong>{upload.run_id === null ? 'Preparing upload…' : upload.progress === 100 ? 'Finalizing upload…' : `Uploading… ${upload.progress}%`}</strong>
            <span>Keep the application open until the upload finishes.</span>
          </>}
        </div>
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
              <p>Files and run history are saved by the local services.</p>
              <span className="version">OIGScribe / {APP_VERSION}</span>
            </div>
          </aside>
          <main className="main-content" id="main" ref={main} tabIndex={-1}>
            {page !== 'history' && <div className="notification" role="status">{notice}</div>}
            {dataError && <div role="alert">{dataError} {page !== 'history' && <button className="button secondary" onClick={refreshHistory}>Refresh</button>}</div>}
            {renderPage()}
            <footer className="page-footer">
              <span>OIGScribe version {APP_VERSION} · Development</span>
            </footer>
          </main>
        </div>
      )}
    </>
  )
}
export default App
