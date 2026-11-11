import type { ReactNode, Ref } from 'react'
import { Sidebar } from './components/shared/Sidebar'
import { TopBanner } from './components/shared/TopBanner'

type DefaultLayoutProps = {
  appName: string
  version: string
  description: string
  brand: ReactNode
  user: { name: string } | null
  signingOut: boolean
  onSignOut: () => void
  navigation: ReactNode
  mainRef: Ref<HTMLElement>
  children: ReactNode
}

// Shared app structure; each app supplies its content and actions.
export function DefaultLayout({
  appName, version, description, brand, user, signingOut,
  onSignOut, navigation, mainRef, children
}: DefaultLayoutProps) {
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <TopBanner brand={brand} user={user} signingOut={signingOut} onSignOut={onSignOut} />
      {user ? (
        <div className="workspace">
          <Sidebar appName={appName} version={version} description={description}>
            {navigation}
          </Sidebar>
          <main className="main-content" id="main" ref={mainRef} tabIndex={-1}>
            {children}
            <footer className="page-footer">
              <span>{appName} version {version} · Development</span>
            </footer>
          </main>
        </div>
      ) : (
        <main className="signin-wrap" id="main" ref={mainRef} tabIndex={-1}>
          {children}
        </main>
      )}
    </>
  )
}
