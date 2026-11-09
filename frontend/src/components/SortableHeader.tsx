import type { HistoryViewState } from '../history'
import { Icon } from './Icon'

export function SortableHeader({ label, direction, onSort }: {
  label: string
  direction: HistoryViewState['sort']['direction'] | 'none'
  onSort: () => void
}) {
  const icon = direction === 'none' ? 'sort' : direction === 'ascending' ? 'arrow-up' : 'arrow-down'
  return (
    <th scope="col" aria-sort={direction}>
      <button className="sort-button" onClick={onSort}>
        {label}
        <span aria-hidden="true"><Icon name={icon} size={14} /></span>
      </button>
    </th>
  )
}
