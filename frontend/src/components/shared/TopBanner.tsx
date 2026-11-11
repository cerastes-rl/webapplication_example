import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Icon } from './Icon'

type TopBannerProps = {
  brand: ReactNode
  user: { name: string } | null
  signingOut: boolean
  onSignOut: () => void
}

export function TopBanner({ brand, user, signingOut, onSignOut }: TopBannerProps) {
  return (
    <header className="topbar">
      {brand}
      <div className="header-right">
        <span className="demo-pill"><span />LOCAL DEMO</span>
        <ThemeToggle />
        {user && <>
          <UserIdentity name={user.name} />
          <SignOutButton busy={signingOut} onSignOut={onSignOut} />
        </>}
      </div>
    </header>
  )
}

function SignOutButton({ busy, onSignOut }: { busy: boolean; onSignOut: () => void }) {
  return (
    <button className="button secondary" onClick={onSignOut} disabled={busy}>
      <Icon name="logout" size={17} />
      <span>{busy ? 'Signing out…' : 'Sign out'}</span>
    </button>
  )
}

function ThemeToggle() {
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

  return (
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
  )
}

function UserIdentity({ name }: { name: string }) {
  return (
    <div className="identity">
      <span className="avatar">{name.charAt(0)}</span>
      <span>{name}<small>Local user</small></span>
    </div>
  )
}
