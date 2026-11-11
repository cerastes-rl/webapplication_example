import type { ReactNode } from 'react'

type SidebarProps = {
  children: ReactNode
  appName: string
  version: string
  description: string
}

export function Sidebar({ children, appName, version, description }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="workspace-label">WORKSPACE</div>
      <nav aria-label="Main navigation">{children}</nav>
      <div className="sidebar-bottom">
        <span className="local-dot" /> Built for local exploration
        <p>{description}</p>
        <span className="version">{appName} / {version}</span>
      </div>
    </aside>
  )
}
