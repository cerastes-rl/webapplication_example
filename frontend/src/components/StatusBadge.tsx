import type { Run } from '../run'

export function StatusBadge({ status }: { status: Run['upload_stage'] | Run['transcription_stage'] | 'finalizing' }) {
  return (
    <span className={`status ${status.replaceAll('_', '-')}`}>
      <span className="status-dot" />
      {status.charAt(0).toUpperCase() + status.slice(1).replaceAll('_', ' ')}
    </span>
  )
}
