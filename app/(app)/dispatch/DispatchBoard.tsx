'use client'

import { useMemo, useState, useTransition } from 'react'
import type { FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import RecordToolbar from '@/components/RecordToolbar'
import { nairobiToday } from '@/lib/nairobi-date'
import { fmtTime, fmtDateTime, fmtDate, waNumber, isoDate, addDays } from '@/lib/format'
import type { Contractor, Driver, Organization, Trip, TripStatus, Vehicle } from '@/lib/types'
import { dispatchColumns, filterDispatchTrips, type DispatchStatusFilter } from '@/lib/dispatch-view'
import { setTripStatus, clearPendingTrips } from './actions'
import AssignForm from './AssignForm'
import './dispatch-workspace.css'

type Lookups = { drivers: Driver[]; vehicles: Vehicle[]; organizations: Organization[]; contractors: Contractor[] }
const LABELS: Record<TripStatus, string> = { booked: 'Unassigned', assigned: 'Assigned', dispatched: 'Dispatched', confirmed: 'Confirmed', enroute: 'En route', completed: 'Completed', cancelled: 'Cancelled' }
const HINTS: Record<TripStatus, string> = { booked: 'Choose driver and vehicle', assigned: 'Send the journey details', dispatched: 'Await driver confirmation', confirmed: 'Ready to set off', enroute: 'Journey in progress', completed: 'Closed jobs', cancelled: 'Not travelling' }
const STAGE_COLORS: Record<TripStatus, string> = { booked: 'var(--danger)', assigned: 'var(--gold)', dispatched: 'var(--accent-mid)', confirmed: 'var(--accent)', enroute: 'var(--accent)', completed: 'var(--ink3)', cancelled: 'var(--ink3)' }

export default function DispatchBoard({ day, trips, pendingTrips = [], pendingTotal = 0, lookups, canClearPending = false }: {
  day: string; trips: Trip[]; pendingTrips?: Trip[]; pendingTotal?: number; lookups: Lookups; canClearPending?: boolean
}) {
  const router = useRouter()
  const [showQueue, setShowQueue] = useState(false)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<DispatchStatusFilter>('all')
  const [view, setView] = useState('board')
  const [queueError, setQueueError] = useState<string | null>(null)
  const [clearing, startClear] = useTransition()
  const { drivers, vehicles, organizations, contractors } = lookups
  const driverName = (id: string | null) => drivers.find(driver => driver.id === id)?.name ?? ''
  const plate = (id: string | null) => vehicles.find(vehicle => vehicle.id === id)?.plate ?? ''
  const orgName = (id: string | null) => organizations.find(organization => organization.id === id)?.name ?? ''
  const contractorName = (id: string | null) => contractors.find(contractor => contractor.id === id)?.name ?? ''
  const visible = filterDispatchTrips(trips, query, status, trip => [driverName(trip.driver_id), plate(trip.vehicle_id), contractorName(trip.contractor_id), orgName(trip.organization_id)].join(' '))
  const columns = dispatchColumns(visible, status)
  const active = trips.filter(trip => !['completed', 'cancelled', 'booked'].includes(trip.status))
  // Advisory day-level hints only. Actual resource overlaps are checked server-side.
  const busyDrivers = active.flatMap(trip => trip.driver_id ? [trip.driver_id] : [])
  const busyVehicles = active.flatMap(trip => trip.vehicle_id ? [trip.vehicle_id] : [])
  const activeCount = trips.filter(trip => trip.status !== 'completed' && trip.status !== 'cancelled').length
  const completedCount = trips.filter(trip => trip.status === 'completed').length
  const pendingDays = useMemo(() => {
    const byDate = new Map<string, Trip[]>()
    for (const trip of pendingTrips.filter(trip => trip.trip_date !== day)) {
      const jobs = byDate.get(trip.trip_date) ?? []
      jobs.push(trip); byDate.set(trip.trip_date, jobs)
    }
    return [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [pendingTrips, day])

  function shiftDay(delta: number) {
    const [year, month, date] = day.split('-').map(Number)
    router.push(`/dispatch?d=${isoDate(addDays(new Date(year, month - 1, date), delta))}`)
  }
  function openToday() {
    const today = nairobiToday()
    router.push(`/dispatch?d=${today}`)
  }
  function onClearPending() {
    if (!confirm(`Delete all ${pendingTotal} unassigned jobs across every date? This cannot be undone. Check the queue before continuing.`)) return
    setQueueError(null)
    startClear(async () => {
      try {
        const count = await clearPendingTrips()
        toast.success(`Cleared ${count} unassigned job${count === 1 ? '' : 's'}.`)
        router.refresh()
      } catch (failure) {
        const message = failure instanceof Error ? failure.message : 'Could not clear the queue. Please try again.'
        setQueueError(message)
        toast.error(message)
      }
    })
  }
  function resetFilters() { setQuery(''); setStatus('all') }
  const hasFilters = !!query.trim() || status !== 'all'
  const commonActions = { lookups, busyDrivers, busyVehicles }

  return <div className="dispatch-workspace">
    <div className="dispatch-datebar">
      <div className="dispatch-date-controls"><button type="button" className="btn-ghost dispatch-day-arrow" onClick={() => shiftDay(-1)} aria-label="Previous day">‹</button><label htmlFor="dispatch-day" className="dispatch-day-label">Dispatch date<input id="dispatch-day" type="date" className="input" value={day} onChange={event => { if (event.target.value) router.push(`/dispatch?d=${event.target.value}`) }}/></label><button type="button" className="btn-ghost dispatch-day-arrow" onClick={() => shiftDay(1)} aria-label="Next day">›</button><button type="button" className="btn-ghost" onClick={openToday}>Today</button></div>
      <div className="dispatch-day-summary"><span><strong>{activeCount}</strong> active</span><span><strong>{completedCount}</strong> completed</span><span className="dispatch-timezone">EAT · Nairobi</span></div>
    </div>

    {pendingTotal > 0 && <div className="dispatch-queue-banner">
      <div><strong>{pendingTotal} unassigned job{pendingTotal === 1 ? '' : 's'}</strong><span>Across the booking queue</span></div>
      <button type="button" className="btn-ghost" onClick={() => setShowQueue(current => !current)} aria-expanded={showQueue} aria-controls="dispatch-pending-queue">{showQueue ? 'Hide queue' : 'View queue by date'}</button>
      {canClearPending && <button type="button" className="btn-ghost dispatch-clear-queue" onClick={onClearPending} disabled={clearing}>{clearing ? 'Clearing…' : 'Clear unassigned queue'}</button>}
    </div>}
    {queueError && <p className="dispatch-error" role="alert">{queueError}</p>}
    {showQueue && <section id="dispatch-pending-queue" className="dispatch-pending-panel" aria-label="Pending jobs by date">
      {pendingDays.length ? <><p>Bookings on other dates. Open a day to assign drivers.{pendingTrips.length < pendingTotal ? ' The queue preview is limited; more bookings may exist on other dates.' : ''}</p><div className="dispatch-pending-days">{pendingDays.map(([date, jobs]) => <button type="button" key={date} onClick={() => { router.push(`/dispatch?d=${date}`); setShowQueue(false) }}><span><strong>{fmtDate(date)}</strong><b>{jobs.length} job{jobs.length === 1 ? '' : 's'}</b></span><small>{jobs.slice(0, 3).map(job => job.client_name).join(', ')}{jobs.length > 3 ? `, +${jobs.length - 3} more` : ''}</small><em>Open day →</em></button>)}</div></> : <p>All jobs in this queue preview are on the selected date.</p>}
    </section>}

    <RecordToolbar search={query} onSearchChange={setQuery} searchLabel="Search dispatch jobs" searchPlaceholder="Client, route, flight, driver or vehicle…" count={visible.length} countLabel="jobs" views={[{ value: 'board', label: 'Board' }, { value: 'list', label: 'List' }]} activeView={view} onViewChange={setView} filterSummary={hasFilters ? 'Filtered jobs' : undefined} onClearFilters={hasFilters ? resetFilters : undefined}>
      <label className="dispatch-status-filter"><span>Status</span><select className="input" value={status} onChange={event => setStatus(event.target.value as DispatchStatusFilter)}><option value="all">All jobs</option><option value="active">Active jobs</option>{Object.entries(LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    </RecordToolbar>

    <div className="dispatch-view-heading"><h2>{fmtDate(day)}</h2><p>{view === 'board' ? 'Move jobs forward with the action on each card.' : 'Review the day’s jobs and open their actions.'}</p></div>
    {visible.length === 0 ? <div className="dispatch-empty card"><h3>{hasFilters ? 'No jobs match these filters.' : 'No jobs on this date.'}</h3><p>{hasFilters ? 'Try another search or clear the filters to see the full day.' : 'Choose another day or open the pending queue.'}</p>{hasFilters && <button type="button" className="btn-ghost" onClick={resetFilters}>Clear filters</button>}</div> : view === 'board' ? <>
      <p className="dispatch-scroll-hint">Scroll across to see each stage. Actions save through the server.</p>
      <div className="dispatch-board-scroll" role="region" aria-label="Dispatch workflow board" tabIndex={0}><div className="dispatch-kanban" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(270px, 1fr))` }}>{columns.map(stage => {
        const jobs = visible.filter(trip => trip.status === stage)
        return <section className="dispatch-column" key={stage} aria-label={`${LABELS[stage]} jobs`}><div className="dispatch-column-heading" style={{ borderTopColor: STAGE_COLORS[stage] }}><h3>{LABELS[stage]}<span>{jobs.length}</span></h3><p>{HINTS[stage]}</p></div><div className="dispatch-column-jobs">{jobs.length ? jobs.map(trip => <article key={trip.id} className="dispatch-job-card"><div className="dispatch-job-time">{pickupTime(trip)}<span>{trip.slip_no || trip.voucher_no || ''}</span></div><h4>{trip.client_name}</h4><p className="dispatch-job-route">{trip.pickup || 'Pickup to confirm'}<span aria-hidden="true">→</span>{trip.dropoff || 'Destination to confirm'}</p><p className="dispatch-job-client">{[contractorName(trip.contractor_id), orgName(trip.organization_id)].filter(Boolean).join(' · ') || 'Direct booking'}</p>{trip.flight_no && <p className="dispatch-job-flight">Flight {trip.flight_no}{trip.flight_time ? ` · ${fmtTime(trip.flight_time)}` : ''}</p>}<JobActions trip={trip} {...commonActions}/></article>) : <p className="dispatch-column-empty">No jobs in this stage</p>}</div></section>
      })}</div></div>
    </> : <div className="dispatch-list-wrap"><table className="dispatch-list"><caption className="dispatch-sr-only">Jobs for {fmtDate(day)}</caption><thead><tr><th>Pickup</th><th>Client & route</th><th>Driver / vehicle</th><th>Status</th><th>Actions</th></tr></thead><tbody>{visible.map(trip => <tr key={trip.id}><td data-label="Pickup"><strong>{pickupTime(trip)}</strong><small>{trip.slip_no || trip.voucher_no || trip.flight_no || '—'}</small></td><td data-label="Client & route"><strong>{trip.client_name}</strong><span>{trip.pickup || 'Pickup to confirm'} → {trip.dropoff || 'Destination to confirm'}</span><small>{[contractorName(trip.contractor_id), orgName(trip.organization_id)].filter(Boolean).join(' · ') || 'Direct booking'}</small></td><td data-label="Driver / vehicle"><strong>{driverName(trip.driver_id) || 'Unassigned'}</strong><span>{plate(trip.vehicle_id) || 'Vehicle to confirm'}</span></td><td data-label="Status"><span className="dispatch-status" style={{ color: STAGE_COLORS[trip.status] }}>{LABELS[trip.status]}</span></td><td data-label="Actions"><details className="dispatch-row-actions"><summary>{trip.status === 'booked' ? 'Assign job' : trip.status === 'completed' ? 'Job details' : 'Manage job'}</summary><JobActions trip={trip} {...commonActions}/></details></td></tr>)}</tbody></table></div>}
  </div>
}

function pickupTime(trip: Trip) { return trip.pickup_time ? `${trip.pickup_time} EAT` : trip.flight_time ? `${fmtTime(trip.flight_time)} EAT` : 'Time to confirm' }

function JobActions({ trip, lookups, busyDrivers, busyVehicles }: { trip: Trip; lookups: Lookups; busyDrivers: string[]; busyVehicles: string[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const driver = lookups.drivers.find(item => item.id === trip.driver_id)
  const vehicle = lookups.vehicles.find(item => item.id === trip.vehicle_id)
  const month = Number(trip.trip_date.slice(5, 7)) - 1
  const tripsHref = `/trips?y=${trip.trip_date.slice(0, 4)}&m=${month}`
  const message = `Hi ${driver?.name ?? ''}, trip for ${trip.client_name}: ${trip.pickup ?? ''} → ${trip.dropoff ?? ''}${trip.pickup_time ? ` at ${trip.pickup_time} EAT` : trip.flight_time ? ` at ${fmtTime(trip.flight_time)}` : ''}${trip.flight_no ? ` (flight ${trip.flight_no})` : ''}. Vehicle ${vehicle?.plate ?? ''}. Please confirm.`

  function changeStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const next = String(form.get('status'))
    if (next === 'cancelled' && !confirm(`Cancel the trip for ${trip.client_name}?`)) return
    setError(null)
    startTransition(async () => {
      try {
        await setTripStatus(form)
        toast.success(`Job ${LABELS[next as TripStatus].toLowerCase()}.`)
        router.refresh()
      } catch (failure) {
        setError(failure instanceof Error ? failure.message : 'Could not update this job. Please try again.')
      }
    })
  }
  function statusButton(status: TripStatus, label: string, primary = false) {
    return <form onSubmit={changeStatus} key={status}><input type="hidden" name="id" value={trip.id}/><input type="hidden" name="status" value={status}/><button type="submit" disabled={pending} className={primary ? 'btn-primary' : 'btn-ghost'}>{pending ? 'Saving…' : label}</button></form>
  }
  if (trip.status === 'booked') return <div className="dispatch-assignment"><p>Assign a driver and vehicle</p><AssignForm tripId={trip.id} drivers={lookups.drivers} vehicles={lookups.vehicles} busyDrivers={busyDrivers} busyVehicles={busyVehicles}/></div>
  return <div className="dispatch-job-actions">
    <div className="dispatch-resource"><strong>{vehicle?.plate || 'No vehicle'}</strong><span>{driver?.name || 'No driver'}</span></div>
    {trip.assigned_by && <p className="dispatch-assigned-by">By {trip.assigned_by}{trip.assigned_at ? ` · ${fmtDateTime(trip.assigned_at)}` : ''}</p>}
    {driver?.phone && trip.status !== 'cancelled' && <div className="dispatch-contact-links"><a href={`tel:${driver.phone.replace(/\s/g, '')}`}>Call driver</a><a href={`https://wa.me/${waNumber(driver.phone)}?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">WhatsApp</a><a href={`sms:${driver.phone.replace(/\s/g, '')}?body=${encodeURIComponent(message)}`}>SMS</a></div>}
    {trip.status === 'completed' ? <a className="dispatch-record-link" href={tripsHref}>Open trip records →</a> : <div className="dispatch-transition-actions">
      {trip.status === 'assigned' && <>{statusButton('dispatched', 'Mark dispatched', true)}{statusButton('booked', 'Unassign')}</>}
      {trip.status === 'dispatched' && <>{statusButton('confirmed', 'Driver confirmed', true)}{statusButton('assigned', 'Back to assigned')}</>}
      {trip.status === 'confirmed' && statusButton('enroute', 'Start trip', true)}
      {trip.status === 'enroute' && statusButton('completed', 'Complete trip', true)}
      {trip.status === 'cancelled' ? statusButton('booked', 'Restore to unassigned') : statusButton('cancelled', 'Cancel job')}
    </div>}
    {error && <p className="dispatch-error" role="alert">{error}</p>}
  </div>
}
