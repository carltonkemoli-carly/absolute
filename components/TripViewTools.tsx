'use client'

import { useEffect, useId, useState } from 'react'
import type { FormEvent } from 'react'
import type { Contractor, Driver, Trip, Vehicle } from '@/lib/types'
import type { TripFilterState } from '@/lib/trip-filters'
import { decodeSavedTripViews, encodeSavedTripViews, exportTripsCsv, sameSavedTripFilters, savedTripFilters, type SavedTripView } from '@/lib/trip-export'
import '@/app/trip-view-tools.css'

type Props = {
  filters: TripFilterState
  onApply: (filters: TripFilterState) => void
  rows: Trip[]
  lookups: { contractors: Contractor[]; drivers: Driver[]; vehicles: Vehicle[] }
  storageKey?: string
}
export default function TripViewTools({ filters, onApply, rows, lookups, storageKey }: Props) {
  const id = useId()
  const [views, setViews] = useState<SavedTripView[]>([])
  const [loadedKey, setLoadedKey] = useState<string | undefined>(undefined)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const currentViews = loadedKey === storageKey ? views : []
  const matchingView = currentViews.find(view => sameSavedTripFilters(view.filters, savedTripFilters(filters)))

  useEffect(() => {
    // The saved views are external browser state and must be loaded after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setViews([]); setError(''); setNotice(''); setSaving(false); setName(''); setLoadedKey(undefined)
    if (!storageKey) return
    try {
      const parsed = decodeSavedTripViews(window.localStorage.getItem(storageKey))
      setViews(parsed.views)
      if (parsed.invalid) setError('Saved views could not be read. You can save a new view to start again on this browser.')
    } catch { setError('This browser is not allowing saved views. You can still filter and export trips.') }
    setLoadedKey(storageKey)
  }, [storageKey])

  function persist(next: SavedTripView[]): boolean {
    if (!storageKey) return false
    try {
      window.localStorage.setItem(storageKey, encodeSavedTripViews(next))
      setViews(next); setError('')
      return true
    } catch {
      setError('This browser could not save your views. Your filters are still available for this visit.')
      return false
    }
  }
  function saveView(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const title = name.trim().replace(/\s+/g, ' ')
    if (!title || title.length > 40) { setError('Give the view a name of up to 40 characters.'); return }
    const duplicate = currentViews.find(view => view.name.toLocaleLowerCase() === title.toLocaleLowerCase())
    if (duplicate) { setError('A saved view already has that name. Choose another name or remove the old view.'); return }
    if (currentViews.length >= 8) { setError('You can keep up to eight views. Remove one before saving another.'); return }
    const view: SavedTripView = { id: window.crypto.randomUUID(), name: title, filters: savedTripFilters(filters) }
    if (persist([...currentViews, view])) { setSaving(false); setName(''); setNotice(`Saved “${title}” on this browser.`) }
  }
  function applyView(viewId: string) {
    const view = currentViews.find(item => item.id === viewId)
    if (!view) return
    onApply({ ...view.filters, query: '' })
    setNotice(`Applied “${view.name}”. Search text has been cleared.`); setError('')
  }
  function removeView() {
    if (!matchingView) return
    if (persist(currentViews.filter(view => view.id !== matchingView.id))) setNotice(`Removed “${matchingView.name}” from this browser.`)
  }
  function downloadCsv() {
    if (!rows.length) return
    setError('')
    try {
      const csv = exportTripsCsv(rows, lookups)
      const url = window.URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }))
      const anchor = document.createElement('a')
      anchor.href = url; anchor.download = 'absolute-comfort-trips.csv'
      document.body.appendChild(anchor); anchor.click(); anchor.remove()
      window.setTimeout(() => window.URL.revokeObjectURL(url), 1000)
      setNotice(`CSV prepared with ${rows.length} ${rows.length === 1 ? 'trip' : 'trips'} from these results.`)
    } catch { setError('The CSV could not be prepared. Please try again.') }
  }

  return <div className="trip-view-tools">
    <div className="tvt-main">
      {storageKey && <><label className="tvt-view-select" htmlFor={`${id}-views`}>Saved views<select id={`${id}-views`} className="input" value={matchingView?.id ?? ''} disabled={loadedKey !== storageKey || !currentViews.length} onChange={event => applyView(event.target.value)} aria-describedby={`${id}-storage-note`}><option value="">Choose a saved view</option>{currentViews.map(view => <option key={view.id} value={view.id}>{view.name}</option>)}</select></label><button type="button" className="btn-ghost" disabled={loadedKey !== storageKey || currentViews.length >= 8} onClick={() => { setSaving(value => !value); setError(''); setNotice('') }} aria-expanded={saving} aria-controls={`${id}-save`}>{saving ? 'Close save view' : 'Save view'}</button>{matchingView && <button type="button" className="tvt-remove" onClick={removeView}>Remove saved view</button>}</>}
      <button type="button" className="btn-ghost tvt-export" onClick={downloadCsv} disabled={!rows.length}>Export CSV <span>{rows.length.toLocaleString('en-KE')}</span></button>
    </div>
    {storageKey && <p id={`${id}-storage-note`} className="tvt-storage-note">Saved on this browser for your account. Only filters are saved; search text and trip records are not stored.</p>}
    {saving && storageKey && <form className="tvt-save-form" id={`${id}-save`} onSubmit={saveView}><label htmlFor={`${id}-name`}>View name<input id={`${id}-name`} className="input" value={name} onChange={event => setName(event.target.value)} required maxLength={40} placeholder="e.g. Unassigned airport jobs" autoFocus/></label><button className="btn-primary" type="submit">Save filters</button><button className="btn-ghost" type="button" onClick={() => setSaving(false)}>Cancel</button></form>}
    {error && <p className="tvt-error" role="alert">{error}</p>}
    {notice && <p className="tvt-notice" role="status">{notice}</p>}
  </div>
}
