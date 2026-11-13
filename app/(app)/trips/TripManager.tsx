'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { Badge } from '@/components/ui'
import { RecordToolbar } from '@/components/RecordToolbar'
import TripViewTools from '@/components/TripViewTools'
import { EMPTY_TRIP_FILTERS, filterTrips, TRIP_STATUS_LABELS, type TripFilterState } from '@/lib/trip-filters'
import './trips-workspace.css'
import DataTable, { type Column } from '@/components/DataTable'
import { kes, kesPlain, fmtDate } from '@/lib/format'
import type { Contractor, Driver, Organization, Trip, Vehicle } from '@/lib/types'
import { saveTrip, deleteTrip, attributeTrip } from './actions'

type Lookups = {
  contractors: Contractor[]
  organizations: Organization[]
  vehicles: Vehicle[]
  drivers: Driver[]
}

export default function TripManager({
  trips, lookups, defaultDate, storageKey,
}: { trips: Trip[]; lookups: Lookups; defaultDate: string; storageKey?: string }) {
  const [editing, setEditing] = useState<Trip | 'new' | null>(null)
  const [filters, setFilters] = useState<TripFilterState>({ ...EMPTY_TRIP_FILTERS })

  const { contractors, organizations, vehicles, drivers } = lookups
  const name = (arr: { id: string; name?: string; plate?: string }[], id: string | null) => {
    const f = arr.find((x) => x.id === id)
    return f ? (f.name ?? f.plate ?? '—') : '—'
  }

  const filtered = useMemo(() => filterTrips(trips, filters, lookups), [trips, filters, lookups])
  function changeFilter<Key extends keyof TripFilterState>(key: Key, value: TripFilterState[Key]) {
    setFilters(current => ({ ...current, [key]: value }))
  }
  const chips = [
    filters.query.trim() ? { key: 'query' as const, label: `Search: ${filters.query.trim()}` } : null,
    filters.status ? { key: 'status' as const, label: TRIP_STATUS_LABELS[filters.status] } : null,
    filters.contractorId ? { key: 'contractorId' as const, label: `Contractor: ${name(contractors, filters.contractorId)}` } : null,
    filters.driverId ? { key: 'driverId' as const, label: `Driver: ${name(drivers, filters.driverId)}` } : null,
    filters.vehicleId ? { key: 'vehicleId' as const, label: `Vehicle: ${name(vehicles, filters.vehicleId)}` } : null,
    filters.assignment !== 'all' ? { key: 'assignment' as const, label: filters.assignment === 'assigned' ? 'Vehicle & driver assigned' : 'Needs assignment' } : null,
  ].filter((chip): chip is NonNullable<typeof chip> => chip !== null)
  function clearFilters() { setFilters({ ...EMPTY_TRIP_FILTERS }) }

  // Attribution coverage — how many trips have both a vehicle & driver.
  const attributed = trips.filter((t) => t.vehicle_id && t.driver_id).length
  const coverage = trips.length > 0 ? attributed / trips.length : 0

  const columns: Column<Trip>[] = [
    { label: 'Date', nowrap: true, render: (t) => fmtDate(t.trip_date) },
    { label: 'Client', role: 'primary', render: (t) => (
      <>
        <strong>{t.client_name}</strong>
        {isRecent(t.created_at) && <span style={{ marginLeft: 6, fontSize: 10.5, fontWeight: 700, color: 'var(--gold)', background: 'var(--gold-light)', padding: '1px 6px', borderRadius: 99, verticalAlign: 'middle' }}>NEW</span>}
        {t.slip_no && <div style={{ fontSize: 12, color: 'var(--ink3)', fontWeight: 400 }}>#{t.slip_no}</div>}
      </>
    ) },
    { label: 'Route', render: (t) => (
      <>
        {(t.pickup || '—')} → {(t.dropoff || '—')}
        {t.notes && <div style={{ fontSize: 12, color: 'var(--ink3)' }}>{t.notes}</div>}
      </>
    ) },
    { label: 'Status', render: (t) => <Badge tone={t.status === 'completed' ? 'green' : t.status === 'cancelled' ? 'red' : t.status === 'booked' ? 'gold' : 'neutral'}>{TRIP_STATUS_LABELS[t.status]}</Badge> },
    { label: 'Organization', render: (t) => name(organizations, t.organization_id) },
    { label: 'Via', render: (t) => name(contractors, t.contractor_id) },
    { label: 'Assigned to', render: (t) => <InlineAssign key={`${t.id}:${t.vehicle_id}:${t.driver_id}`} trip={t} vehicles={vehicles} drivers={drivers} /> },
    { label: 'Express', align: 'right', render: (t) => (t.express_charges ? kes(t.express_charges) : '—') },
    { label: 'Amount', align: 'right', render: (t) => (
      <>
        <strong>{kes(t.amount)}</strong>
        {t.express_charges > 0 && <div style={{ fontSize: 11.5, color: 'var(--ink3)', whiteSpace: 'normal' }}>fare {kesPlain(t.amount - t.express_charges)} · exp {kesPlain(t.express_charges)}</div>}
        {t.payment === 'cash' && <div><Badge tone="gold">cash</Badge></div>}
      </>
    ) },
    { label: '', role: 'actions', render: (t) => (
      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
        <button onClick={() => setEditing(t)} style={linkBtn}>Edit</button>
        <DeleteTripButton trip={t}/>

      </div>
    ) },
  ]

  return (
    <>
      <RecordToolbar
        search={filters.query} onSearchChange={value => changeFilter('query', value)}
        searchLabel="Search trips" searchPlaceholder="Client, route, reference, driver or vehicle…"
        count={filtered.length} countLabel={filtered.length === 1 ? 'trip' : 'trips'}
        filterSummary={chips.length ? `${chips.length} active ${chips.length === 1 ? 'filter' : 'filters'}` : undefined}
        onClearFilters={chips.length ? clearFilters : undefined}
        action={<button className="btn-primary tw-new-button" type="button" onClick={() => setEditing(editing === 'new' ? null : 'new')}>{editing === 'new' ? 'Close new trip' : '+ New trip'}</button>}
      >
        <div className="tw-filters">
          <label>Status<select className="input" value={filters.status} onChange={event => changeFilter('status', event.target.value as TripFilterState['status'])}><option value="">All statuses</option>{Object.entries(TRIP_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Contractor<select className="input" value={filters.contractorId} onChange={event => changeFilter('contractorId', event.target.value)}><option value="">All contractors</option>{contractors.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label>Driver<select className="input" value={filters.driverId} onChange={event => changeFilter('driverId', event.target.value)}><option value="">All drivers</option>{drivers.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label>Vehicle<select className="input" value={filters.vehicleId} onChange={event => changeFilter('vehicleId', event.target.value)}><option value="">All vehicles</option>{vehicles.map(item => <option key={item.id} value={item.id}>{item.plate}</option>)}</select></label>
          <label>Assignment<select className="input" value={filters.assignment} onChange={event => changeFilter('assignment', event.target.value as TripFilterState['assignment'])}><option value="all">All assignments</option><option value="assigned">Vehicle & driver assigned</option><option value="unassigned">Needs assignment</option></select></label>
        </div>
      </RecordToolbar>
      {chips.length > 0 && <div className="tw-filter-chips" aria-label="Active trip filters">{chips.map(chip => <button key={chip.key} type="button" className="tw-filter-chip" aria-label={`Remove ${chip.label} filter`} onClick={() => changeFilter(chip.key, chip.key === 'assignment' ? 'all' : '')}>{chip.label}<span aria-hidden="true">×</span></button>)}<button className="tw-clear-filters" type="button" onClick={clearFilters}>Clear all</button></div>}
      <TripViewTools filters={filters} onApply={setFilters} rows={filtered} lookups={lookups} storageKey={storageKey}/>
      <p className="tw-result-summary" role="status" aria-live="polite">Showing {filtered.length} of {trips.length} {trips.length === 1 ? 'trip' : 'trips'} in this period.</p>

      {trips.length > 0 && (
        <div className="card" style={{ padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13.5 }}>
            <strong>{attributed}</strong> of <strong>{trips.length}</strong> trips tagged with vehicle & driver
          </span>
          <div style={{ flex: 1, minWidth: 140, height: 7, background: 'var(--surface2)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.round(coverage * 100)}%`, background: coverage >= 0.9 ? 'var(--accent)' : 'var(--gold)', borderRadius: 99, transition: 'width .3s' }} />
          </div>
          <span style={{ fontSize: 12.5, color: 'var(--ink3)' }}>{Math.round(coverage * 100)}% tagged with vehicle &amp; driver</span>
        </div>
      )}

      {editing && (
        <TripForm
          key={editing === 'new' ? 'new' : editing.id}
          trip={editing === 'new' ? null : editing}
          lookups={lookups}
          defaultDate={defaultDate}
          onDone={() => setEditing(null)}
        />
      )}

      <DataTable
        rows={filtered} rowKey={(t) => t.id} minWidth={900}
        empty={trips.length ? 'No trips match these filters. Clear a filter to see more records.' : 'No trips for this month. Use New trip or import a trip sheet to get started.'}
        rowClass={(t) => (isRecent(t.created_at) ? 'row-new' : undefined)}
        columns={columns}
      />
    </>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 150, opacity: pending ? 0.55 : 1 }}>
      <select value={drv} disabled={pending} onChange={onDriver} style={assignSel} aria-label={`Driver for ${trip.client_name}`}>
        <option value="">+ driver…</option>
        {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
      </select>
      <select value={veh} disabled={pending} onChange={onVehicle} style={{ ...assignSel, color: veh ? 'var(--ink2)' : 'var(--ink3)' }} aria-label={`Vehicle for ${trip.client_name}`}>
        <option value="">+ vehicle…</option>
        {vehicles.map((v) => <option key={v.id} value={v.id}>{v.plate}</option>)}
      </select>
      {pending && <span className="tw-inline-saving" role="status">Saving assignment…</span>}
      {error && <span className="tw-inline-error" role="alert">{error}</span>}
    </div>
  )
}

function DeleteTripButton({ trip }: { trip: Trip }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  return <div className="tw-delete-action"><button type="button" style={{ ...linkBtn, color: 'var(--danger)' }} disabled={pending} onClick={() => {
    if (!confirm(`Delete the trip for ${trip.client_name}?`)) return
    const data = new FormData(); data.set('id', trip.id)
    setError('')
    startTransition(async () => {
      try { await deleteTrip(data) }
      catch (failure) { setError(failure instanceof Error ? failure.message : 'The trip could not be deleted.') }
    })
  }}>{pending ? 'Deleting…' : 'Delete'}</button>{error && <span className="tw-inline-error" role="alert">{error}</span>}</div>
}

function isRecent(createdAt: string | null | undefined): boolean {
  if (!createdAt) return false
  const t = new Date(createdAt).getTime()
  return Number.isFinite(t) && Date.now() - t < 12 * 60 * 60 * 1000
}

function TripForm({ trip, lookups, defaultDate, onDone }: { trip: Trip | null; lookups: Lookups; defaultDate: string; onDone: () => void }) {
  const { contractors, organizations, vehicles, drivers } = lookups
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const panel = useRef<HTMLDivElement>(null)
  useEffect(() => { panel.current?.querySelector<HTMLInputElement>('[name="trip_date"]')?.focus() }, [])
  return (
    <div ref={panel} className="card tw-record-form">
      <div className="tw-record-form-heading"><div><span>Trips / {trip ? 'Edit record' : 'New record'}</span><h2>{trip ? trip.client_name : 'New trip'}</h2></div><span className="tw-record-type">Trip record</span></div>
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
            <input name="trip_date" type="date" className="input" required defaultValue={trip?.trip_date ?? defaultDate} />
          </label>
          <label className="field tw-client-field"><span>Client name *</span>
            <input name="client_name" className="input" required defaultValue={trip?.client_name ?? ''} />
          </label>
          <label className="field"><span>Slip / ticket no.</span>
            <input name="slip_no" className="input" defaultValue={trip?.slip_no ?? ''} />
          </label>
          <label className="field"><span>From</span>
            <input name="pickup" className="input" defaultValue={trip?.pickup ?? ''} placeholder="JKIA" />
          </label>
          <label className="field"><span>Pickup time</span>
            <input name="pickup_time" type="time" className="input" defaultValue={trip?.pickup_time ?? ''} />
          </label>
          <label className="field"><span>To</span>
            <input name="dropoff" className="input" defaultValue={trip?.dropoff ?? ''} placeholder="Westlands" />
          </label>
          <label className="field"><span>Organization</span>
            <select name="organization_id" className="input" defaultValue={trip?.organization_id ?? ''}>
              <option value="">—</option>{organizations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </label>
          <label className="field"><span>Via (contractor)</span>
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
          <label className="field"><span>Express charges (KES)</span>
            <input name="express_charges" type="number" step="1" className="input" defaultValue={trip?.express_charges ?? 0} />
          </label>
          <label className="field"><span>Voucher no.</span>
            <input name="voucher_no" className="input" defaultValue={trip?.voucher_no ?? ''} />
          </label>
          <label className="field"><span>Hire cost (KES, casual hire)</span>
            <input name="hire_cost" type="number" step="1" className="input" defaultValue={trip?.hire_cost || ''} placeholder="paid to vehicle owner" />
          </label>
          <label className="field"><span>Amount (KES) *</span>
            <input name="amount" type="number" step="1" className="input" required defaultValue={trip?.amount ?? ''} />
          </label>
          <label className="field"><span>Payment</span>
            <select name="payment" className="input" defaultValue={trip?.payment ?? 'account'}>
              <option value="account">On account</option><option value="cash">Cash</option>
            </select>
          </label>
          <label className="field"><span>Notes</span>
            <input name="notes" className="input" defaultValue={trip?.notes ?? ''} placeholder="Via Expressway" />
          </label>
          <input type="hidden" name="status" value={trip?.status ?? 'completed'} />
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
const assignSel: React.CSSProperties = { fontSize: 12.5, padding: '3px 6px', border: '1px solid var(--border)', borderRadius: 7, background: 'var(--surface)', color: 'var(--ink2)', cursor: 'pointer', maxWidth: 160 }
