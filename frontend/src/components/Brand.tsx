import { Wordmark } from './Wordmark'

export function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
        <i />
      </span>
      <Wordmark />
    </div>
  )
}
