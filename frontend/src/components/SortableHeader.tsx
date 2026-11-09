import type { ReactElement } from 'react'
import type { HistoryViewState } from '../history.ts'
import { Icon } from './Icon.tsx'

const sortIcons = { none: 'sort', ascending: 'arrow-up', descending: 'arrow-down' } as const

type SortableHeaderProps = {
  label: string
  direction: HistoryViewState['sort']['direction'] | 'none'
  onSort: () => void
}

export function SortableHeader({ label, direction, onSort }: SortableHeaderProps): ReactElement {
  return (
    <th scope="col" aria-sort={direction}>
      <button className="sort-button" onClick={onSort}>
        {label}
        <span aria-hidden="true"><Icon name={sortIcons[direction]} size={14} /></span>
      </button>
    </th>
  )
}
