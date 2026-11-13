import Link from 'next/link'
import { requireOperations } from '@/lib/auth'
import { listDocuments, listDrivers, listTrips, listUnassignedTrips, listVehicles } from '@/lib/db'
import type { ComplianceDoc, Trip, TripStatus } from '@/lib/types'
import { nairobiToday, isCalendarDate } from '@/lib/nairobi-date'
import './workday.css'

export const dynamic = 'force-dynamic'

const STATUS_LABEL: Record<TripStatus, string> = {
  booked: 'Awaiting assignment', assigned: 'Assigned', dispatched: 'Dispatched',
  confirmed: 'Confirmed', enroute: 'On the road', completed: 'Completed', cancelled: 'Cancelled',
}

function validDay(value: string | undefined): value is string {
  return typeof value === 'string' && isCalendarDate(value) && value >= '1900-01-01' && value <= '2100-12-31'
}
function shiftDay(value: string, offset: number): string {
  const [year, month, day] = value.split('-').map(Number)
  const shifted = new Date(Date.UTC(year, month - 1, day + offset))
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}`
}
function dayLabel(value: string, weekday = true): string {
  const [year, month, day] = value.split('-').map(Number)
  return new Intl.DateTimeFormat('en-KE', { timeZone: 'UTC', ...(weekday ? { weekday: 'long' as const } : {}), day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(Date.UTC(year, month - 1, day)))
}
function dateDistance(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000)
}
function comparePickup(a: Trip, b: Trip): number {
  return (a.pickup_time || '99:99').localeCompare(b.pickup_time || '99:99') || a.client_name.localeCompare(b.client_name)
}

export default async function WorkdayPage({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  const profile = await requireOperations()
  const sp = await searchParams
  const today = nairobiToday()
  const day = validDay(sp.d) ? sp.d : today
  const [trips, pending, drivers, vehicles, documents] = await Promise.all([
    listTrips(day, day), listUnassignedTrips(4), listDrivers(), listVehicles(), listDocuments(),
  ])
  const driverNames = new Map(drivers.map(driver => [driver.id, driver.name]))
  const vehicleNames = new Map(vehicles.map(vehicle => [vehicle.id, vehicle.plate]))
  const scheduled = trips.filter(trip => trip.status !== 'cancelled')
  const open = scheduled.filter(trip => trip.status !== 'completed').sort(comparePickup)
  const needAssignment = open.filter(trip => trip.status === 'booked' || !trip.driver_id || !trip.vehicle_id)
  const active = scheduled.filter(trip => ['assigned', 'dispatched', 'confirmed', 'enroute'].includes(trip.status))
  const completed = scheduled.filter(trip => trip.status === 'completed')
  const cancelled = trips.length - scheduled.length
  const attention = documents.filter(doc => !doc.attended && validDay(doc.expiry_date ?? undefined) && dateDistance(today, doc.expiry_date!) <= 30)
    .sort((a, b) => (a.expiry_date ?? '').localeCompare(b.expiry_date ?? ''))
  const dispatchHref = `/dispatch?d=${day}`
  const [year, month] = day.split('-').map(Number)
  const tripsHref = `/trips?y=${year}&m=${month - 1}`
  const backlogDay = validDay(pending.trips[0]?.trip_date) ? pending.trips[0].trip_date : day
  const displayName = profile.full_name?.split(' ')[0] || 'Team'
  const documentOwner = (doc: ComplianceDoc) => doc.owner_kind === 'vehicle'
    ? vehicleNames.get(doc.vehicle_id ?? '') || 'Vehicle not recorded'
    : driverNames.get(doc.driver_id ?? '') || 'Driver not recorded'

  return <div className="workday-page">
    <header className="workday-header">
      <div><p className="workday-kicker">OPERATIONS / DAILY WORKSPACE</p><h1>Today’s work</h1><p className="workday-subtitle">{displayName}, here is the work for {day === today ? 'today' : 'your selected date'}. All pickup times are EAT.</p></div>
      <div className="workday-header-actions"><Link className="btn-ghost" href={tripsHref}>Trip records</Link><Link className="btn-primary" href={dispatchHref}>Open dispatch <span aria-hidden="true">↗</span></Link></div>
    </header>

    <section className="workday-datebar" aria-label="Workday date">
      <div className="workday-date-copy"><strong>{dayLabel(day)}</strong><span>{day === today ? 'Today in Nairobi' : 'Selected workday'}{cancelled > 0 ? ` · ${cancelled} cancelled ${cancelled === 1 ? 'job' : 'jobs'}` : ''}</span></div>
      <div className="workday-date-controls"><Link className="workday-day-arrow" href={`/workday?d=${shiftDay(day, -1)}`} aria-label="Previous workday">‹</Link><form action="/workday" className="workday-date-form"><label className="workday-sr-only" htmlFor="workday-date">Choose workday</label><input className="input" id="workday-date" name="d" type="date" defaultValue={day} min="1900-01-01" max="2100-12-31" required/><button type="submit" className="btn-ghost">View day</button></form><Link className="workday-day-arrow" href={`/workday?d=${shiftDay(day, 1)}`} aria-label="Next workday">›</Link>{day !== today && <Link className="workday-today" href="/workday">Today</Link>}</div>
    </section>

    <div className="workday-metrics">
      {[
        { label: 'Scheduled jobs', count: scheduled.length, detail: 'All jobs for this workday', className: 'scheduled' },
        { label: 'Need assignment', count: needAssignment.length, detail: 'Driver or vehicle to confirm', className: 'assignment' },
        { label: 'Active jobs', count: active.length, detail: 'Assigned through to on the road', className: 'active' },
        { label: 'Completed', count: completed.length, detail: 'Marked complete for this day', className: 'completed' },
      ].map(metric => <Link href={dispatchHref} className={`workday-metric workday-metric-${metric.className}`} key={metric.label}><span>{metric.label}</span><strong>{metric.count}</strong><small>{metric.detail}</small><i aria-hidden="true">↗</i></Link>)}
    </div>

    <div className="workday-columns">
      <section className="card workday-jobs" aria-labelledby="workday-jobs-title">
        <div className="workday-panel-heading"><div><p className="workday-kicker">THE SELECTED DAY</p><h2 id="workday-jobs-title">Jobs to run <span>{open.length}</span></h2></div><Link href={dispatchHref}>Manage jobs <span aria-hidden="true">→</span></Link></div>
        {open.length ? <ol className="workday-job-list">{open.map(trip => <li key={trip.id} className="workday-job"><div className="workday-pickup"><strong>{trip.pickup_time || 'To confirm'}</strong><span>{trip.pickup_time ? 'EAT pickup' : 'Pickup time'}</span></div><div className="workday-job-detail"><div className="workday-job-top"><Link href={dispatchHref}>{trip.client_name}</Link><span className={`workday-status workday-status-${trip.status}`}>{STATUS_LABEL[trip.status]}</span></div><p className="workday-route"><span>{trip.pickup || 'Pickup to confirm'}</span><span aria-hidden="true">→</span><span>{trip.dropoff || 'Destination to confirm'}</span></p><div className="workday-assignment"><span data-missing={!trip.driver_id || undefined}>{trip.driver_id ? driverNames.get(trip.driver_id) || 'Driver not recorded' : 'Driver unassigned'}</span><span aria-hidden="true">·</span><span data-missing={!trip.vehicle_id || undefined}>{trip.vehicle_id ? vehicleNames.get(trip.vehicle_id) || 'Vehicle not recorded' : 'Vehicle unassigned'}</span>{trip.flight_no && <span className="workday-flight">Flight {trip.flight_no}</span>}</div></div></li>)}</ol> : <div className="workday-empty"><span aria-hidden="true">✓</span><h3>{completed.length ? 'No open jobs left for this day.' : 'No jobs to run for this day.'}</h3><p>{completed.length ? `${completed.length} ${completed.length === 1 ? 'job is' : 'jobs are'} marked complete. Review the dispatch record or choose another date.` : 'Check another date, or add a booking through the trip records.'}</p><Link href={completed.length ? dispatchHref : tripsHref} className="btn-ghost">{completed.length ? 'View dispatch record' : 'Open trip records'}</Link></div>}
      </section>

      <aside className="workday-sidebar">
        <section className="workday-backlog card" aria-labelledby="workday-backlog-title"><div className="workday-panel-heading"><div><p className="workday-kicker">ACROSS ALL DATES</p><h2 id="workday-backlog-title">Unassigned bookings</h2></div><strong className="workday-backlog-count">{pending.total}</strong></div>{pending.trips.length ? <><ul className="workday-pending-list">{pending.trips.map(trip => <li key={trip.id}><Link href={`/dispatch?d=${trip.trip_date}`}><strong>{trip.client_name}</strong><span>{dayLabel(trip.trip_date, false)}{trip.pickup_time ? ` · ${trip.pickup_time}` : ''}</span></Link></li>)}</ul><Link href={`/dispatch?d=${backlogDay}`} className="workday-panel-link">Open pending queue <span aria-hidden="true">→</span></Link></> : <p className="workday-panel-empty">No booked jobs are waiting in the unassigned queue.</p>}</section>

        <section className="workday-attention card" aria-labelledby="workday-attention-title"><div className="workday-panel-heading"><div><p className="workday-kicker">CURRENT DOCUMENTS</p><h2 id="workday-attention-title">Compliance attention</h2></div><span className="workday-attention-count">{attention.length}</span></div><p className="workday-attention-note">Expired or due within 30 days of {dayLabel(today, false)}. Followed-up documents are excluded.</p>{attention.length ? <><ul className="workday-document-list">{attention.slice(0, 4).map(doc => { const days = dateDistance(today, doc.expiry_date!); return <li key={doc.id}><div><strong>{doc.doc_type}</strong><span>{documentOwner(doc)}</span></div><small data-expired={days < 0 || undefined}>{days < 0 ? 'Expired' : days === 0 ? 'Due today' : `Due in ${days} days`}</small></li> })}</ul><Link href="/compliance" className="workday-panel-link">Review documents <span aria-hidden="true">→</span></Link></> : <p className="workday-panel-empty">No unattended documents are expired or due within the next 30 days.</p>}</section>

        <div className="workday-route-motif" aria-hidden="true"><svg viewBox="0 0 300 100" focusable="false"><defs><linearGradient id="workday-plane" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#edf1fb"/><stop offset="1" stopColor="#d9e3f6"/></linearGradient></defs><path d="m20 55 90-42 168 39-90 43z" fill="url(#workday-plane)"/><path d="m20 55 90-42 168 39v7l-90 42-168-39z" fill="#354da4" fillOpacity=".08"/><path d="m67 52 58-20 98 23-56 21z" stroke="#354da4" strokeWidth="1.3" fill="none"/><path d="m67 52 67 16 89-13" stroke="#a2d729" strokeWidth="3" fill="none" strokeLinecap="round"/><g fill="#354da4" stroke="white" strokeWidth="2"><circle cx="67" cy="52" r="5"/><circle cx="134" cy="68" r="5"/><circle cx="223" cy="55" r="5"/></g></svg><span>One view of the day’s work.</span></div>
      </aside>
    </div>
  </div>
}
