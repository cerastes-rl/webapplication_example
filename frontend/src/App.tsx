import { useEffect, useRef, useState } from 'react'
import { Brand, EmptyState, Icon, RunDetail, StatusBadge, UploadPage } from './components'
import { advanceRuns, formatDate, formatSize, initialRuns } from './preview'
import type { Run } from './preview'
import './App.css'

type Page = 'history' | 'upload' | 'detail'
function App() {
  const [darkMode, setDarkMode] = useState(() => {
    try {
      const saved = localStorage.getItem('ssscribe-theme')
      if (saved === 'dark' || saved === 'light') return saved === 'dark'
    } catch { /* Theme selection also works when storage is unavailable. */ }
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })
  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light'
    try { localStorage.setItem('ssscribe-theme', darkMode ? 'dark' : 'light') } catch { /* Nonessential preference. */ }
  }, [darkMode])
  const [signedIn, setSignedIn] = useState(true)
  const [page, setPage] = useState<Page>('history')
  const [runs, setRuns] = useState<Run[]>(initialRuns)
  const [selected, setSelected] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [scenario, setScenario] = useState('normal')
  const [loading, setLoading] = useState(false)
  const main = useRef<HTMLElement>(null)
  const hasActive = runs.some(run => ['uploading', 'finalizing', 'queued', 'processing'].includes(run.status))
  useEffect(() => {
    if (!signedIn || !hasActive) return
    const timer = window.setInterval(() => setRuns(advanceRuns), 1300)
    return () => window.clearInterval(timer)
  }, [signedIn, hasActive])
  useEffect(() => {
    main.current?.focus()
  }, [page, signedIn])
  useEffect(() => {
    if (!loading) return
    const timer = window.setTimeout(() => setLoading(false), 1500)
    return () => window.clearTimeout(timer)
  }, [loading])
  const uploading = runs.some(run => run.status === 'uploading' || run.status === 'finalizing')
  useEffect(() => {
    if (!uploading) return
    function warn(event: BeforeUnloadEvent) { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [uploading])
  function navigate(next: Page) { setPage(next); setNotice('') }
  function signOut() {
    if (uploading && !window.confirm('Stop your simulated upload and sign out? No file has been saved.')) return
    setRuns(current => current.map(run => ['uploading', 'finalizing'].includes(run.status) ? { ...run, status: 'cancelled' } : run))
    setSignedIn(false); setSelected(null); setNotice(''); setPage('history')
  }
  function retry(id: string) {
    setRuns(current => current.map(run => run.id === id && run.status === 'failed' ? { ...run, status: 'queued', error: undefined, attempts: run.attempts + 1 } : run))
    setNotice('Processing retry queued. This is a simulation.')
  }
  function cancel(id: string) {
    setRuns(current => current.map(run => run.id === id ? { ...run, status: 'cancelled' } : run))
    setNotice('Preview upload cancelled. No file bytes were transferred.')
  }
  const selectedRun = runs.find(run => run.id === selected)
  const shownRuns = scenario === 'empty' ? [] : runs
  const completed = runs.filter(run => run.status === 'completed').length
  return <>
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="topbar"><Brand /><div className="header-right"><button className="theme-toggle" type="button" aria-label="Dark mode" aria-pressed={darkMode} title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'} onClick={() => setDarkMode(current => !current)}><Icon name={darkMode ? 'sun' : 'moon'} size={17} /><span className="theme-toggle-label">Dark mode</span><span className="theme-switch" aria-hidden="true"><span /></span></button><span className="demo-pill"><span />LOCAL DEMO</span>{signedIn && <><div className="identity"><span className="avatar">DU</span><span>Development user<small>Personal workspace</small></span></div><button className="signout" onClick={signOut}><Icon name="logout" size={17} /><span>Sign out</span></button></>}</div></header>
    {!signedIn ? <main className="signin-wrap" id="main" tabIndex={-1} ref={main}><div className="panel signin-card"><span className="eyebrow">WELCOME TO SSScribe</span><h1>A little more clarity.<br />One recording at a time.</h1><p>Upload recordings, follow their progress, and bring your conversations into focus.</p><button className="button primary" onClick={() => setSignedIn(true)}>Sign in as development user <Icon name="arrow" size={16} /></button><small>Mock sign-in only. No account or credentials needed.<br />No files are uploaded. No real transcription is performed.</small></div></main> : <div className="workspace">
      <aside className="sidebar"><div className="workspace-label">WORKSPACE</div><nav aria-label="Main navigation"><button className={page === 'upload' ? 'nav-item active' : 'nav-item'} aria-current={page === 'upload' ? 'page' : undefined} onClick={() => navigate('upload')}><Icon name="upload" />Upload</button><button className={page !== 'upload' ? 'nav-item active' : 'nav-item'} aria-current={page !== 'upload' ? 'page' : undefined} onClick={() => navigate('history')}><Icon name="history" />History<span className="nav-count">{runs.length}</span></button></nav><div className="sidebar-bottom"><span className="local-dot" /> Built for local exploration<p>Your files stay on your device in this UI preview.</p><span className="version">SSScribe / PREVIEW 01</span></div></aside>
      <main className="main-content" id="main" ref={main} tabIndex={-1}><div className="preview-banner"><span className="info-symbol" aria-hidden="true">i</span><p><strong>A preview, not a processor.</strong> No real transcription. Files are not uploaded or saved; demo changes reset on reload.</p><span className="preview-label">UI PREVIEW</span></div><div className="notification" role="status">{notice}</div>
        {page === 'upload' ? <UploadPage onBegin={run => { setRuns(current => [run, ...current]); setScenario('normal'); setPage('history'); setNotice('Preview started. Progress is simulated; no file bytes are uploaded or saved.') }} /> : page === 'detail' ? selectedRun ? <RunDetail run={selectedRun} onBack={() => navigate('history')} onRetry={() => retry(selectedRun.id)} onCancel={() => cancel(selectedRun.id)} /> : <EmptyState title="Run not found" action={<button className="button secondary" onClick={() => navigate('history')}>Back to History</button>}>This recording is not available in the current preview.</EmptyState> : <>
          <div className="page-heading"><div><span className="eyebrow">YOUR WORKSPACE</span><h1>Recording history<span className="heading-dot">.</span></h1><p>Every conversation, all in one place.</p></div><button className="button primary" onClick={() => navigate('upload')}><Icon name="upload" size={17} />Upload recording</button></div>
          <div className="stats-grid"><div className="stat-card"><span>Total recordings</span><strong>{runs.length.toString().padStart(2, '0')}</strong><small>Your workspace, at a glance</small></div><div className="stat-card"><span>Ready to read</span><strong>{completed.toString().padStart(2, '0')}<span className="stat-indicator"><Icon name="check" size={18} /></span></strong><small>Completed sample transcripts</small></div><div className="stat-card"><span>In progress</span><strong>{runs.filter(run => ['uploading', 'finalizing', 'queued', 'processing'].includes(run.status)).length.toString().padStart(2, '0')}</strong><small>Uploads and processing runs</small></div></div>
          <section className="panel history-panel" aria-label="Recording history"><div className="table-toolbar"><div><h2>All recordings <span>{shownRuns.length}</span></h2><p>Open a run for its settings and transcript.</p></div><div className="toolbar-controls"><label className="scenario-control">Preview state<select value={scenario} onChange={event => setScenario(event.target.value)}><option value="normal">Example recordings</option><option value="empty">Empty history</option><option value="error">Connection error</option></select></label><button className="refresh-button" aria-label="Preview loading state" onClick={() => setLoading(true)}><Icon name="history" size={18} /></button></div></div>
            {loading ? <div className="empty-state" role="status"><span className="loading-ring" /><h2>Loading recordings…</h2><p>Simulated loading state.</p></div> : scenario === 'error' ? <EmptyState title="Couldn’t load your recordings" action={<button className="button secondary" onClick={() => { setScenario('normal'); setLoading(true) }}>Try again</button>}>This is a preview of a connection error, not a real API request.</EmptyState> : shownRuns.length === 0 ? <EmptyState title="A fresh start for your recordings" action={<button className="button primary" onClick={() => navigate('upload')}>Upload your first recording</button>}>Your uploads and transcripts will appear here.</EmptyState> : <div className="table-scroll"><table><thead><tr><th scope="col">Recording / Run ID</th><th scope="col">Submitted</th><th scope="col">Size</th><th scope="col">Speakers</th><th scope="col">Settings</th><th scope="col">Status</th><th scope="col">Action</th></tr></thead><tbody>{shownRuns.map(run => <tr key={run.id}><td><div className="recording-cell"><span className="file-icon"><Icon name="audio" /></span><div><button className="filename-button" onClick={() => { setSelected(run.id); navigate('detail') }}>{run.filename}</button><span className="run-id">{run.id}</span></div></div></td><td>{formatDate(run.created)}</td><td className="nowrap">{formatSize(run.size)}</td><td>{run.speakers ?? 'Auto'}</td><td><div className="row-settings"><span>{run.language}</span><small>{run.labels ? 'Speaker labels' : 'No labels'} · {run.timestamps ? 'Timestamps' : 'No timestamps'}</small></div></td><td><StatusBadge status={run.status} />{run.status === 'uploading' && <div className="row-progress"><progress max={100} value={run.progress} aria-label={`Simulated upload progress for ${run.filename}`} /><small>{run.progress}% · simulated</small></div>}</td><td>{run.status === 'failed' ? <button className="text-button" onClick={() => retry(run.id)}>Retry</button> : run.status === 'uploading' ? <button className="text-button" onClick={() => cancel(run.id)}>Cancel</button> : <button className="open-button" aria-label={`Open ${run.filename}`} onClick={() => { setSelected(run.id); navigate('detail') }}><Icon name="arrow" size={17} /></button>}</td></tr>)}</tbody></table></div>}
            <div className="table-footer"><span>Demo recordings · This session only</span><span>Private by design. Simulated for now.</span></div></section>
          <div className="history-footnote"><Icon name="audio" size={16} /><p>Good conversations deserve a second look. Select a completed recording to read its sample transcript.</p></div>
        </>}
        <footer className="page-footer"><span>SSScribe — make every word count.</span><span>Frontend preview · No API connected</span></footer>
      </main>
    </div>}
  </>
}
export default App
