import type { Status } from '../preview'

export function StatusBadge({ status }: { status: Status | 'waiting' | 'not-started' }) {
  return (
    <span className={`status ${status}`}>
      <span className="status-dot" />
      {status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' ')}
    </span>
  )
}
