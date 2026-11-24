import Link from 'next/link'
import { notFound } from 'next/navigation'
import MonthNav from '@/components/MonthNav'
import Sparkline from '@/components/Sparkline'
import { PageHeader, KpiCard, Badge } from '@/components/ui'
import { requireOperations, canSeeFinance } from '@/lib/auth'
import { listDocuments, listDrivers, listTrips, listVehicles } from '@/lib/db'
import { comparisonWindow, change } from '@/lib/dashboard'
import { averageTripsPerDriver, driverMonth, driverTagging } from '@/lib/driver-stats'
import { kes, fmtDate, monthRange, MONTH_NAMES, waNumber } from '@/lib/format'
import { nairobiToday } from '@/lib/nairobi-date'
import { tripMonthHref } from '@/lib/record-search'
import { stickyPeriod } from '@/lib/period'
import { TRIP_STATUS_LABELS } from '@/lib/trip-filters'
import './driver-record.css'

export const dynamic = 'force-dynamic'

const MONTHS_BACK = 6

export default async function DriverRecordPage({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ y?: string; m?: string }> }) {
  const profile = await requireOperations()
  const { id } = await params
  const { year, month } = await stickyPeriod(await searchParams)
  const selected = monthRange(year, month)
  const previous = monthRange(year, month - 1)
  const windowStart = monthRange(year, month - (MONTHS_BACK - 1)).start
  const today = nairobiToday()

  const [drivers, vehicles, trips, documents] = await Promise.all([
    listDrivers(), listVehicles(), listTrips(windowStart, selected.end), listDocuments(),
  ])
  const driver = drivers.find((item) => item.id === id)
  if (!driver) notFound()

  const finance = canSeeFinance(profile.role)
  const monthName = MONTH_NAMES[month]
  const now = driverMonth(trips, id, selected.start, selected.end)
  const { cutoff, partial } = comparisonWindow(selected, previous, today)
  const before = driverMonth(trips, id, previous.start, cutoff)
  const series = Array.from({ length: MONTHS_BACK }, (_, index) => {
    const range = monthRange(year, month - (MONTHS_BACK - 1 - index))
    return driverMonth(trips, id, range.start, range.end).completed
  })
  const daysInMonth = Number(selected.end.slice(8, 10))
  const tagging = driverTagging(trips, selected.start, selected.end)
  const average = averageTripsPerDriver(trips, selected.start, selected.end)
  const plate = (vehicleId: string | null) => vehicles.find((vehicle) => vehicle.id === vehicleId)?.plate ?? 'Unknown vehicle'
  const monthTrips = trips
    .filter((trip) => trip.driver_id === id && trip.trip_date >= selected.start && trip.trip_date <= selected.end && trip.status !== 'cancelled')
    .sort((a, b) => b.trip_date.localeCompare(a.trip_date) || (b.pickup_time ?? '').localeCompare(a.pickup_time ?? ''))
  const docs = documents.filter((doc) => doc.owner_kind === 'driver' && doc.driver_id === id)
    .sort((a, b) => (a.expiry_date ?? '9999').localeCompare(b.expiry_date ?? '9999'))
  const whatsapp = waNumber(driver.phone)

  return (
    <div className="driver-page">
      <PageHeader
        title={driver.name}
        subtitle={[driver.phone, driver.license_no ? `Licence ${driver.license_no}` : null].filter(Boolean).join(' · ') || 'Driver record'}
        action={<div className="driver-head-actions"><MonthNav year={year} month={month} /><Link className="btn-ghost" href="/drivers">← All drivers</Link></div>}
      />

      <div className="grid-stats driver-kpis">
        <KpiCard
          label={`Completed trips, ${monthName}`} value={String(now.completed)}
          delta={change(now.completed, before.completed)} deltaNote={partial ? 'vs same point last month' : 'vs last month'}
          sub={average > 0 ? `The average driver did ${average.toFixed(1)}` : undefined}
          chart={<Sparkline values={series} partial={partial} color="var(--chart-7)" label="Completed trips, last six months" />}
        />
        <KpiCard label="Fares earned" value={kes(now.fares)} tone="var(--accent)" sub={now.completed ? `${kes(now.avgFare)} a trip, tolls excluded` : 'No completed trips'} />
        <KpiCard label="Days worked" value={String(now.daysWorked)} sub={`of ${daysInMonth} days${now.daysWorked ? ` · ${(now.completed / now.daysWorked).toFixed(1)} trips a day` : ''}`} />
        <KpiCard label="Jobs still open" value={String(now.open)} tone={now.open ? 'var(--gold)' : undefined} sub={now.open ? 'Booked, assigned or on the road' : 'Nothing waiting'} href={now.open ? '/dispatch' : undefined} />
      </div>

      {tagging.completed > 0 && tagging.tagged < tagging.completed && (
        <p className="driver-note">
          Only trips tagged with a driver are counted. {tagging.completed - tagging.tagged} of {tagging.completed} completed trips in {monthName} have no driver, so every driver&rsquo;s figures are a little low. <Link href="/trips">Tag trips →</Link>
        </p>
      )}

      <div className="driver-grid">
        <section className="card driver-panel" aria-labelledby="driver-trips">
          <header><h2 id="driver-trips">Trips in {monthName}</h2><Link href={tripMonthHref(selected.start)}>All trips →</Link></header>
          {monthTrips.length === 0 ? <p className="driver-empty">No trips are tagged to {driver.name.split(' ')[0]} this month.</p> : (
            <ul className="driver-trips">
              {monthTrips.slice(0, 15).map((trip) => (
                <li key={trip.id}>
                  <div>
                    <strong>{trip.client_name}</strong>
                    <small>{fmtDate(trip.trip_date)}{trip.pickup_time ? ` · ${trip.pickup_time}` : ''} · {trip.pickup || 'Pickup to confirm'} → {trip.dropoff || 'Destination to confirm'}{trip.vehicle_id ? ` · ${plate(trip.vehicle_id)}` : ''}</small>
                  </div>
                  <div className="driver-trip-end">
                    <Badge tone={trip.status === 'completed' ? 'green' : 'blue'}>{TRIP_STATUS_LABELS[trip.status]}</Badge>
                    <b>{kes(Math.max(0, Number(trip.amount) - Number(trip.express_charges || 0)))}</b>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {monthTrips.length > 15 && <p className="driver-more">Showing 15 of {monthTrips.length} trips.</p>}
        </section>

        <div className="driver-side">
          <section className="card driver-panel" aria-labelledby="driver-cars">
            <header><h2 id="driver-cars">Vehicles driven</h2></header>
            {now.vehicles.length === 0 ? <p className="driver-empty">No completed trips with a vehicle yet.</p> : (
              <ul className="driver-cars">
                {now.vehicles.map((entry) => (
                  <li key={entry.id}>
                    <Link href={`/vehicles/${encodeURIComponent(entry.id)}`}>{plate(entry.id)}</Link>
                    <span className="driver-bar"><i style={{ width: `${(entry.trips / now.vehicles[0].trips) * 100}%` }} /></span>
                    <b>{entry.trips}</b>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card driver-panel" aria-labelledby="driver-docs">
            <header><h2 id="driver-docs">Licence and documents</h2><Link href="/compliance">Compliance →</Link></header>
            {docs.length === 0 ? <p className="driver-empty">No documents are recorded for this driver.</p> : (
              <ul className="driver-docs">
                {docs.map((doc) => {
                  const expired = doc.expiry_date && doc.expiry_date < today
                  return (
                    <li key={doc.id}>
                      <div><strong>{doc.doc_type}</strong><small>{doc.expiry_date ? `Expires ${fmtDate(doc.expiry_date)}` : 'No expiry date recorded'}</small></div>
                      <Badge tone={expired ? 'red' : 'neutral'}>{expired ? 'Expired' : 'Recorded'}</Badge>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <section className="card driver-panel" aria-labelledby="driver-about">
            <header><h2 id="driver-about">Details</h2></header>
            <dl className="driver-details">
              <div><dt>Status</dt><dd><Badge tone={driver.status === 'active' ? 'green' : 'neutral'}>{driver.status}</Badge></dd></div>
              <div><dt>Usual vehicle</dt><dd>{driver.default_vehicle_id ? plate(driver.default_vehicle_id) : '·'}</dd></div>
              {finance && <div><dt>Monthly wage</dt><dd>{driver.monthly_wage > 0 ? kes(driver.monthly_wage) : '·'}</dd></div>}
              {driver.phone && <div><dt>Phone</dt><dd><a href={`tel:${driver.phone}`}>{driver.phone}</a>{whatsapp && <> · <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer">WhatsApp</a></>}</dd></div>}
            </dl>
          </section>
        </div>
      </div>
    </div>
  )
}
