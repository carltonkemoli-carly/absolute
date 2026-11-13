'use client'

import { useId, type ReactNode } from 'react'

export type RecordToolbarProps = {
  search?: string
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string
  searchLabel?: string
  count?: number
  countLabel?: string
  children?: ReactNode
  action?: ReactNode
  views?: { value: string; label: string }[]
  activeView?: string
  onViewChange?: (value: string) => void
  filterSummary?: string
  onClearFilters?: () => void
}

// A shared control surface for records. The caller owns query/filter/view state.
export function RecordToolbar({
  search, onSearchChange, searchPlaceholder = 'Search records…', searchLabel = 'Search records',
  count, countLabel = 'records', children, action, views, activeView, onViewChange,
  filterSummary, onClearFilters,
}: RecordToolbarProps) {
  const searchId = useId()
  return <div className="record-toolbar">
    <div className="record-toolbar-main">
      {onSearchChange && <label className="record-search" htmlFor={searchId}>
        <span className="workspace-sr-only">{searchLabel}</span>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/></svg>
        <input id={searchId} type="search" value={search ?? ''} onChange={event => onSearchChange(event.target.value)} placeholder={searchPlaceholder}/>
      </label>}
      <div className="record-toolbar-controls">{children}</div>
      {(views?.length || action) ? <div className="record-toolbar-actions">
        {views && onViewChange && <div className="record-views" role="group" aria-label="Record view">{views.map(view => <button type="button" key={view.value} aria-pressed={activeView === view.value} onClick={() => onViewChange(view.value)}>{view.label}</button>)}</div>}
        {action}
      </div> : null}
    </div>
    {(count !== undefined || filterSummary) && <div className="record-toolbar-summary">
      {count !== undefined && <span role="status">{count.toLocaleString('en-KE')} {countLabel}</span>}
      {filterSummary && <span className="record-filter-summary">{filterSummary}</span>}
      {onClearFilters && filterSummary && <button type="button" onClick={onClearFilters}>Clear filters</button>}
    </div>}
  </div>
}
export default RecordToolbar
