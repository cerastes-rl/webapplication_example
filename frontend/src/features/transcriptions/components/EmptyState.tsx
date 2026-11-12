import type { ReactNode } from 'react'
import { Icon } from '../../../components/shared/Icon'

export function EmptyState({
  title,
  children,
  action
}: {
  title: string
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon name="audio" size={28} />
      </span>
      <h2>{title}</h2>
      <p>{children}</p>
      {action}
    </div>
  )
}
