export type HistoryViewState = {
  search: string
  pageSize: number
  page: number
  sort: {
    column: 'created' | 'size'
    direction: 'ascending' | 'descending'
  }
}

export const initialHistoryView: HistoryViewState = {
  search: '',
  pageSize: 10,
  page: 1,
  sort: { column: 'created', direction: 'descending' }
}
