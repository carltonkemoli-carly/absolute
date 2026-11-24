'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import toast from 'react-hot-toast'
import { Badge } from '@/components/ui'
import TripViewTools from '@/components/TripViewTools'
import DataTable, { CARD_ONLY, ROW_SELECTED, type Column } from '@/components/DataTable'
import { EMPTY_TRIP_FILTERS, filterTrips, TRIP_STATUS_LABELS, type TripFilterState } from '@/lib/trip-filters'
import { kes, kesPlain, fmtDate } from '@/lib/format'
import type { BookingDraft } from '@/lib/quote-draft'
import type { Contractor, Driver, Organization, Trip, TripStatus, Vehicle } from '@/lib/types'
import { saveTrip, deleteTrip, attributeTrip, bulkAssignTrips, bulkCompleteTrips } from './actions'
import './trips-workspace.css'

type Lookups = {
  contractors: Contractor[]
  organizations: Organization[]
  vehicles: Vehicle[]
  drivers: Driver[]
}

// A month can hold several hundred trips. Thirty to a page keeps the list a
// sensible length on a phone, where every row is a card.
const PAGE_SIZE = 30
// The server accepts this many trips per bulk request; larger selections are sent in turn.
const BULK_CHUNK = 500

const STATUS_TONE: Record<TripStatus, 'green' | 'blue' | 'gold' | 'red'> = {
  booked: 'gold', assigned: 'blue', dispatched: 'blue', confirmed: 'blue', enroute: 'blue', completed: 'green', cancelled: 'red',
}

export default function TripManager({
  trips, lookups, defaultDate, storageKey, quoteDraft,
}: { trips: Trip[]; lookups: Lookups; defaultDate: string; storageKey?: string; quoteDraft?: BookingDraft | null }) {
  const [editing, setEditing] = useState<Trip | 'new' | null>(quoteDraft ? 'new' : null)
  const [filters, setFilters] = useState<TripFilterState>({ ...EMPTY_TRIP_FILTERS })
  const [filtersOpen, setFiltersOpen] = useState(false) // phone only; on a laptop the filters are always shown
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<string>>(() => new Set())

  const { contractors, organizations, vehicles, drivers } = lookups
  const name = (arr: { id: string; name?: string; plate?: string }[], id: string | null) => {
    const f = arr.find((x) => x.id === id)
    return f ? (f.name ?? f.plate ?? '—') : '—'
  }

  const filtered = useMemo(() => filterTrips(trips, filters, lookups), [trips, filters, lookups])
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const current = Math.min(page, pages)
  const pageRows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)

  // Only trips still in the filtered list count as selected, so a bulk action
  // can never touch a row the user can no longer see.
  const chosen = useMemo(() => filtered.filter((trip) => selected.has(trip.id)), [filtered, selected])
  const pageSelected = pageRows.filter((trip) => selected.has(trip.id)).length
  const allOnPage = pageRows.length > 0 && pageSelected === pageRows.length

  function applyFilters(next: TripFilterState) { setFilters(next); setPage(1) }
  function changeFilter<Key extends keyof TripFilterState>(key: Key, value: TripFilterState[Key]) {
    applyFilters({ ...filters, [key]: value })
  }
  const activeFilters = [filters.status, filters.contractorId, filters.driverId, filters.vehicleId, filters.assignment !== 'all' ? 'x' : ''].filter(Boolean).length
  const isFiltered = activeFilters > 0 || filters.query.trim() !== ''

  function toggle(id: string) {
    setSelected((previous) => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  function togglePage() {
    setSelected((previous) => {
      const next = new Set(previous)
      for (const trip of pageRows) { if (allOnPage) next.delete(trip.id); else next.add(trip.id) }
      return next
    })
  }

  // Attribution coverage — how many trips have both a vehicle & driver.
  const attributed = trips.filter((t) => t.vehicle_id && t.driver_id).length
  const coverage = trips.length > 0 ? attributed / trips.length : 0

  const columns: Column<Trip>[] = [
    { label: 'Select', role: 'select',
      header: <SelectAll checked={allOnPage} some={pageSelected > 0 && !allOnPage} onChange={togglePage} />,
      render: (t) => <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggle(t.id)} aria-label={`Select the trip for ${t.client_name}`} /> },
    { label: 'Date', nowrap: true, card: 'hide', render: (t) => fmtDate(t.trip_date) },
    { label: 'Client', role: 'primary', render: (t) => (
      <>
        <strong>{t.client_name}</strong>
        {isRecent(t.created_at) && <span className="trips-new">NEW</span>}
        {t.slip_no && <div className="trips-sub trips-slip">#{t.slip_no}</div>}
        {/* On a phone the card headline carries the date, slip and status. */}
        <div className={`${CARD_ONLY} trips-card-meta`}>
          <span>{fmtDate(t.trip_date)}{t.pickup_time ? ` · ${t.pickup_time}` : ''}{t.slip_no ? ` · #${t.slip_no}` : ''}</span>
          <Badge tone={STATUS_TONE[t.status]}>{TRIP_STATUS_LABELS[t.status]}</Badge>
        </div>
      </>
    ) },
    { label: 'Route', render: (t) => (
      <>
        {(t.pickup || '—')} → {(t.dropoff || '—')}
        {t.notes && <div className="trips-sub">{t.notes}</div>}
      </>
    ) },
    { label: 'Status', card: 'hide', render: (t) => <Badge tone={STATUS_TONE[t.status]}>{TRIP_STATUS_LABELS[t.status]}</Badge> },
    { label: 'Client org', render: (t) => (
      <>
        {name(organizations, t.organization_id)}
        {t.contractor_id && <div className="trips-sub">via {name(contractors, t.contractor_id)}</div>}
      </>
    ) },
    { label: 'Driver & vehicle', render: (t) => <InlineAssign key={`${t.id}:${t.vehicle_id}:${t.driver_id}`} trip={t} vehicles={vehicles} drivers={drivers} /> },
    { label: 'Amount', align: 'right', render: (t) => (
      <>
        <strong>{kes(t.amount)}</strong>
        {t.express_charges > 0 && <div className="trips-sub" style={{ whiteSpace: 'normal' }}>fare {kesPlain(t.amount - t.express_charges)} · toll {kesPlain(t.express_charges)}</div>}
        {t.payment === 'cash' && <div><Badge tone="gold">cash</Badge></div>}
      </>
    ) },
    { label: '', role: 'actions', render: (t) => (
      <div className="trips-row-actions">
        <button type="button" onClick={() => setEditing(t)} style={linkBtn}>Edit</button>
        <DeleteTripButton trip={t} />
      </div>
    ) },
  ]

  return (
    <>
      <div className="card trips-bar">
        <div className="trips-bar-row">
          <label className="record-search trips-search">
            <span className="workspace-sr-only">Search trips</span>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></svg>
            <input type="search" value={filters.query} onChange={(event) => changeFilter('query', event.target.value)} placeholder="Client, route, slip, driver or vehicle…" />
          </label>
          <button type="button" className="btn-ghost trips-filter-toggle" aria-expanded={filtersOpen} aria-controls="trip-filters" onClick={() => setFiltersOpen((open) => !open)}>
            Filters{activeFilters > 0 ? ` · ${activeFilters}` : ''}
          </button>
          <button className="btn-primary trips-new-button" type="button" onClick={() => setEditing(editing === 'new' ? null : 'new')}>
            {editing === 'new' ? 'Close' : '+ New trip'}
          </button>
        </div>

        <div className="trips-filters" id="trip-filters" data-open={filtersOpen || undefined}>
          <select className="input" aria-label="Status" data-on={filters.status ? '' : undefined} value={filters.status} onChange={(event) => changeFilter('status', event.target.value as TripFilterState['status'])}>
            <option value="">All statuses</option>
            {Object.entries(TRIP_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select className="input" aria-label="Supplier" data-on={filters.contractorId ? '' : undefined} value={filters.contractorId} onChange={(event) => changeFilter('contractorId', event.target.value)}>
            <option value="">All suppliers</option>
            {contractors.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <select className="input" aria-label="Driver" data-on={filters.driverId ? '' : undefined} value={filters.driverId} onChange={(event) => changeFilter('driverId', event.target.value)}>
            <option value="">All drivers</option>
            {drivers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <select className="input" aria-label="Vehicle" data-on={filters.vehicleId ? '' : undefined} value={filters.vehicleId} onChange={(event) => changeFilter('vehicleId', event.target.value)}>
            <option value="">All vehicles</option>
            {vehicles.map((item) => <option key={item.id} value={item.id}>{item.plate}</option>)}
          </select>
          <select className="input" aria-label="Tagging" data-on={filters.assignment !== 'all' ? '' : undefined} value={filters.assignment} onChange={(event) => changeFilter('assignment', event.target.value as TripFilterState['assignment'])}>
            <option value="all">Tagged or not</option>
            <option value="assigned">Driver &amp; vehicle tagged</option>
            <option value="unassigned">Needs a driver or vehicle</option>
          </select>
          {isFiltered && <button type="button" className="trips-clear" onClick={() => applyFilters({ ...EMPTY_TRIP_FILTERS })}>Clear filters</button>}
        </div>

        <div className="trips-bar-foot">
          <span className="trips-count" role="status" aria-live="polite">
            <strong>{filtered.length.toLocaleString('en-KE')}</strong>
            {isFiltered ? ` of ${trips.length.toLocaleString('en-KE')} trips` : filtered.length === 1 ? ' trip' : ' trips'}
          </span>
          {trips.length > 0 && (
            <button type="button" className="trips-coverage" title="Show the trips that still need a driver or vehicle"
              onClick={() => applyFilters({ ...EMPTY_TRIP_FILTERS, assignment: 'unassigned' })}>
              <span className="trips-coverage-bar"><i style={{ width: `${Math.round(coverage * 100)}%`, background: coverage >= 0.9 ? 'var(--chart-good)' : 'var(--chart-warn)' }} /></span>
              {attributed === trips.length ? 'All tagged with driver & vehicle' : `${trips.length - attributed} not tagged with driver & vehicle`}
            </button>
          )}
          <TripViewTools compact filters={filters} onApply={applyFilters} rows={filtered} lookups={lookups} storageKey={storageKey} />
        </div>
      </div>

      {editing && (
        <TripForm
          key={editing === 'new' ? 'new' : editing.id}
          trip={editing === 'new' ? null : editing}
          lookups={lookups}
          defaultDate={defaultDate}
          draft={editing === 'new' ? quoteDraft : null}
          onDone={() => setEditing(null)}
        />
      )}

      <DataTable
        rows={pageRows} rowKey={(t) => t.id} minWidth={940}
        empty={trips.length ? 'No trips match these filters.' : 'No trips for this month. Add one with New trip, or import a trip sheet.'}
        rowClass={(t) => [isRecent(t.created_at) ? 'row-new' : '', selected.has(t.id) ? ROW_SELECTED : ''].filter(Boolean).join(' ') || undefined}
        columns={columns}
      />

      {pages > 1 && (
        <nav className="trips-pager" aria-label="Pages of trips">
          <button type="button" className="btn-ghost" disabled={current === 1} onClick={() => { setPage(current - 1); scrollToList() }}>‹ Previous</button>
          <span>{(current - 1) * PAGE_SIZE + 1}–{Math.min(current * PAGE_SIZE, filtered.length)} of {filtered.length.toLocaleString('en-KE')}</span>
          <button type="button" className="btn-ghost" disabled={current === pages} onClick={() => { setPage(current + 1); scrollToList() }}>Next ›</button>
        </nav>
      )}

      {chosen.length > 0 && (
        <BulkBar
          chosen={chosen} vehicles={vehicles} drivers={drivers}
          canSelectAll={allOnPage && chosen.length < filtered.length}
          total={filtered.length}
          onSelectAll={() => setSelected(new Set(filtered.map((trip) => trip.id)))}
          onClear={() => setSelected(new Set())}
        />
      )}
    </>
  )
}

function scrollToList() {
  document.querySelector('.trips-bar')?.scrollIntoView({ block: 'start', behavior: 'smooth' })
}

// Header checkbox: ticked when the whole page is selected, a dash when only part of it is.
function SelectAll({ checked, some, onChange }: { checked: boolean; some: boolean; onChange: () => void }) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { if (ref.current) ref.current.indeterminate = some }, [some])
  return <input ref={ref} type="checkbox" checked={checked} onChange={onChange} aria-label="Select every trip on this page" />
}

// Appears once trips are ticked. Tagging many finished trips with who drove them
// is the slow job this page exists for; this does a page of them in one go.
function BulkBar({ chosen, vehicles, drivers, canSelectAll, total, onSelectAll, onClear }: {
  chosen: Trip[]; vehicles: Vehicle[]; drivers: Driver[]
  canSelectAll: boolean; total: number; onSelectAll: () => void; onClear: () => void
}) {
  const [driver, setDriver] = useState('')
  const [vehicle, setVehicle] = useState('')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const ids = chosen.map((trip) => trip.id)
  const notCompleted = chosen.filter((trip) => trip.status !== 'completed' && trip.status !== 'cancelled').length

  function onDriver(value: string) {
    setDriver(value)
    // Picking a driver suggests their usual vehicle, as it does on a single row.
    const usual = drivers.find((item) => item.id === value)?.default_vehicle_id
    if (value && !vehicle && usual) setVehicle(usual)
  }

  function run(label: string, send: (batch: string[]) => Promise<{ updated: number }>) {
    setError('')
    startTransition(async () => {
      try {
        let updated = 0
        for (let index = 0; index < ids.length; index += BULK_CHUNK) updated += (await send(ids.slice(index, index + BULK_CHUNK))).updated
        toast.success(`${label} ${updated} ${updated === 1 ? 'trip' : 'trips'}.`)
        onClear()
      } catch (failure) {
        setError(failure instanceof Error ? failure.message : 'The change could not be saved. Please try again.')
      }
    })
  }

  return (
    <div className="trips-bulk" role="region" aria-label="Actions for the selected trips" aria-busy={pending}>
      <div className="trips-bulk-count">
        <strong>{chosen.length} selected</strong>
        {canSelectAll && <button type="button" onClick={onSelectAll} disabled={pending}>Select all {total}</button>}
        <button type="button" onClick={onClear} disabled={pending}>Clear</button>
      </div>
      <div className="trips-bulk-actions">
        <select className="input" aria-label="Driver for the selected trips" value={driver} disabled={pending} onChange={(event) => onDriver(event.target.value)}>
          <option value="">Driver…</option>
          {drivers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <select className="input" aria-label="Vehicle for the selected trips" value={vehicle} disabled={pending} onChange={(event) => setVehicle(event.target.value)}>
          <option value="">Vehicle…</option>
          {vehicles.map((item) => <option key={item.id} value={item.id}>{item.plate}</option>)}
        </select>
        <button type="button" className="btn-primary" disabled={pending || (!driver && !vehicle)}
          onClick={() => run('Tagged', (batch) => bulkAssignTrips(batch, vehicle || null, driver || null))}>
          {pending ? 'Saving…' : 'Tag trips'}
        </button>
        {notCompleted > 0 && (
          <button type="button" className="btn-ghost" disabled={pending}
            onClick={() => { if (confirm(`Mark ${notCompleted} ${notCompleted === 1 ? 'trip' : 'trips'} as completed? Completed trips count as revenue.`)) run('Completed', bulkCompleteTrips) }}>
            Mark completed
          </button>
        )}
      </div>
      {error && <p className="trips-bulk-error" role="alert">{error}</p>}
    </div>
  )
}

// Inline, one-tap attribution right in the table. Picking a driver auto-fills
// their usual vehicle (if the car is still blank), then saves immediately.
function InlineAssign({ trip, vehicles, drivers }: { trip: Trip; vehicles: Vehicle[]; drivers: Driver[] }) {
  const [veh, setVeh] = useState(trip.vehicle_id ?? '')
  const [drv, setDrv] = useState(trip.driver_id ?? '')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')

  function persist(nextVeh: string, nextDrv: string) {
    const previous = { veh, drv }
    setError('')
    startTransition(async () => {
      try { await attributeTrip(trip.id, nextVeh || null, nextDrv || null) }
      catch (failure) {
        setVeh(previous.veh); setDrv(previous.drv)
        setError(failure instanceof Error ? failure.message : 'Assignment could not be saved. Please try again.')
      }
    })
  }
  function onDriver(e: React.ChangeEvent<HTMLSelectElement>) {
    const d = e.target.value
    let v = veh
    if (d && !veh) {
      const dd = drivers.find((x) => x.id === d)
      if (dd?.default_vehicle_id) { v = dd.default_vehicle_id; setVeh(v) }
    }
    setDrv(d); persist(v, d)
  }
  function onVehicle(e: React.ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value
    setVeh(v); persist(v, drv)
  }

  return (
    <div className="trips-assign" style={{ opacity: pending ? 0.55 : 1 }}>
      <select value={drv} disabled={pending} onChange={onDriver} data-empty={drv ? undefined : ''} aria-label={`Driver for ${trip.client_name}`}>
        <option value="">+ driver…</option>
        {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
      </select>
      <select value={veh} disabled={pending} onChange={onVehicle} data-empty={veh ? undefined : ''} aria-label={`Vehicle for ${trip.client_name}`}>
        <option value="">+ vehicle…</option>
        {vehicles.map((v) => <option key={v.id} value={v.id}>{v.plate}</option>)}
      </select>
      {pending && <span className="tw-inline-saving" role="status">Saving…</span>}
      {error && <span className="tw-inline-error" role="alert">{error}</span>}
    </div>
  )
}

function DeleteTripButton({ trip }: { trip: Trip }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  return (
    <div className="tw-delete-action">
      <button type="button" style={{ ...linkBtn, color: 'var(--danger)' }} disabled={pending} onClick={() => {
        if (!confirm(`Delete the trip for ${trip.client_name}?`)) return
        const data = new FormData(); data.set('id', trip.id)
        setError('')
        startTransition(async () => {
          try { await deleteTrip(data) }
          catch (failure) { setError(failure instanceof Error ? failure.message : 'The trip could not be deleted.') }
        })
      }}>{pending ? 'Deleting…' : 'Delete'}</button>
      {error && <span className="tw-inline-error" role="alert">{error}</span>}
    </div>
  )
}

function isRecent(createdAt: string | null | undefined): boolean {
  if (!createdAt) return false
  const t = new Date(createdAt).getTime()
  return Number.isFinite(t) && Date.now() - t < 12 * 60 * 60 * 1000
}

function TripForm({ trip, lookups, defaultDate, draft, onDone }: { trip: Trip | null; lookups: Lookups; defaultDate: string; draft?: BookingDraft | null; onDone: () => void }) {
  const { contractors, organizations, vehicles, drivers } = lookups
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const panel = useRef<HTMLDivElement>(null)
  useEffect(() => { panel.current?.querySelector<HTMLInputElement>('[name="trip_date"]')?.focus() }, [])
  return (
    <div ref={panel} className="card tw-record-form">
      <div className="tw-record-form-heading"><div><span>{trip ? 'Edit trip' : draft ? 'Rate card draft' : 'New trip'}</span><h2>{trip ? trip.client_name : draft ? 'Review the booking' : 'Trip details'}</h2></div></div>
      {draft && <p className="tw-quote-draft-note">The route and amount came from the current rate card. Add the client, check the fare and vehicle availability, then save. The trip starts as booked.</p>}
      <form onSubmit={event => {
        event.preventDefault()
        if (pending) return
        const data = new FormData(event.currentTarget)
        if (!String(data.get('client_name') ?? '').trim()) { setError('Enter the client name.'); return }
        setError('')
        startTransition(async () => {
          try { await saveTrip(data); onDone() }
          catch (failure) { setError(failure instanceof Error ? failure.message : 'The trip could not be saved. Please try again.') }
        })
      }} aria-busy={pending}>
        <fieldset className="tw-form-fields" disabled={pending}><legend className="tw-sr-only">Trip details</legend>
        {trip && <input type="hidden" name="id" value={trip.id} />}
        <div className="grid-form">
          <label className="field"><span>Date *</span>
            <input name="trip_date" type="date" className="input" required defaultValue={trip?.trip_date ?? draft?.date ?? defaultDate} />
          </label>
          <label className="field tw-client-field"><span>Client name *</span>
            <input name="client_name" className="input" required defaultValue={trip?.client_name ?? ''} />
          </label>
          <label className="field"><span>Slip / ticket no.</span>
            <input name="slip_no" className="input" defaultValue={trip?.slip_no ?? ''} />
          </label>
          <label className="field"><span>From</span>
            <input name="pickup" className="input" defaultValue={trip?.pickup ?? draft?.pickup ?? ''} placeholder="JKIA" />
          </label>
          <label className="field"><span>Pickup time</span>
            <input name="pickup_time" type="time" className="input" defaultValue={trip?.pickup_time ?? ''} />
          </label>
          <label className="field"><span>To</span>
            <input name="dropoff" className="input" defaultValue={trip?.dropoff ?? draft?.dropoff ?? ''} placeholder="Westlands" />
          </label>
          {/* Only completed trips count as revenue, so the status is a choice, not a hidden default. */}
          <label className="field"><span>Status</span>
            <select name="status" className="input" defaultValue={trip?.status ?? 'booked'}>
              {Object.entries(TRIP_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="field"><span>Organization</span>
            <select name="organization_id" className="input" defaultValue={trip?.organization_id ?? ''}>
              <option value="">—</option>{organizations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </label>
          <label className="field"><span>Via (supplier)</span>
            <select name="contractor_id" className="input" defaultValue={trip?.contractor_id ?? ''}>
              <option value="">—</option>{contractors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="field"><span>Vehicle</span>
            <select name="vehicle_id" className="input" defaultValue={trip?.vehicle_id ?? ''}>
              <option value="">—</option>{vehicles.map((v) => <option key={v.id} value={v.id}>{v.plate}</option>)}
            </select>
          </label>
          <label className="field"><span>Driver</span>
            <select name="driver_id" className="input" defaultValue={trip?.driver_id ?? ''}>
              <option value="">—</option>{drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>
          <label className="field"><span>Amount (KES) *</span>
            <input name="amount" type="number" step="1" min="0" className="input" required defaultValue={trip?.amount ?? draft?.amount ?? ''} />
          </label>
          <label className="field"><span>Expressway tolls (KES)</span>
            <input name="express_charges" type="number" step="1" min="0" className="input" defaultValue={trip?.express_charges ?? draft?.toll ?? 0} />
          </label>
          <label className="field"><span>Hire cost (KES, casual hire)</span>
            <input name="hire_cost" type="number" step="1" min="0" className="input" defaultValue={trip?.hire_cost || ''} placeholder="paid to vehicle owner" />
          </label>
          <label className="field"><span>Payment</span>
            <select name="payment" className="input" defaultValue={trip?.payment ?? 'account'}>
              <option value="account">On account</option><option value="cash">Cash</option>
            </select>
          </label>
          <label className="field"><span>Voucher no.</span>
            <input name="voucher_no" className="input" defaultValue={trip?.voucher_no ?? ''} />
          </label>
          <label className="field"><span>Notes</span>
            <input name="notes" className="input" defaultValue={trip?.notes ?? draft?.notes ?? ''} placeholder="Via Expressway" />
          </label>
        </div>
        {error && <p className="tw-form-error" role="alert">{error}</p>}
        <div className="tw-form-actions">
          <button type="submit" className="btn-primary" style={{ padding: '9px 20px', fontSize: 14, cursor: 'pointer' }}>{pending ? 'Saving…' : trip ? 'Save changes' : 'Save trip'}</button>
          <button type="button" className="btn-ghost" style={{ padding: '9px 18px', fontSize: 14, cursor: 'pointer' }} onClick={onDone}>Cancel</button>
        </div>
        </fieldset>
      </form>
    </div>
  )
}

const linkBtn: React.CSSProperties = { background: 'none', border: 'none', color: 'var(--accent-mid)', fontWeight: 600, fontSize: 13, cursor: 'pointer', padding: 0 }
