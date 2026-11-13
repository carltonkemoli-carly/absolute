import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/ui'
import { requireOperations, canSeeFinance } from '@/lib/auth'
import { listDocuments, listServices, listTrips, listVehicles } from '@/lib/db'
import { kes } from '@/lib/format'
import { nairobiToday } from '@/lib/nairobi-date'
import { shiftCalendarDay, tripMonthHref } from '@/lib/record-search'
import { OWNERSHIP_LABELS } from '@/lib/types'
import '../../record-detail.css'

export const dynamic = 'force-dynamic'
export default async function VehicleRecordPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireOperations()
  const { id } = await params
  const today = nairobiToday()
  const from = shiftCalendarDay(today, -89)
  const to = shiftCalendarDay(today, 30)
  const [vehicles, allTrips, allServices, allDocuments] = await Promise.all([
    listVehicles(), listTrips(from, to), listServices(), listDocuments(),
  ])
  const vehicle = vehicles.find(item => item.id === id)
  if (!vehicle) notFound()
  const trips = allTrips.filter(trip => trip.vehicle_id === id).sort((a, b) => b.trip_date.localeCompare(a.trip_date))
  const services = allServices.filter(item => item.vehicle_id === id).slice(0, 8)
  const documents = allDocuments.filter(item => item.owner_kind === 'vehicle' && item.vehicle_id === id).sort((a,b) => (a.expiry_date || '').localeCompare(b.expiry_date || ''))
  const finance = canSeeFinance(profile.role)
  return <div className="record-detail-page">
    <PageHeader title={vehicle.plate} subtitle={[vehicle.model, vehicle.vehicle_type].filter(Boolean).join(' · ') || 'Vehicle record'} action={<Link className="btn-ghost" href="/vehicles">← All vehicles</Link>}/>
    <div className="record-detail-hero card"><div><span className="record-detail-kicker">FLEET RECORD</span><h2>{vehicle.plate}</h2><p>{vehicle.model || 'Model not recorded'} · {vehicle.vehicle_type || 'Class not recorded'}</p></div><span className={`record-detail-status status-${vehicle.status}`}>{vehicle.status.replace('_', ' ')}</span></div>
    <div className="record-detail-metrics"><article className="card"><span>Ownership</span><strong>{OWNERSHIP_LABELS[vehicle.ownership]}</strong><small>{vehicle.owner_name || 'No separate owner recorded'}</small></article><article className="card"><span>Capacity recorded</span><strong>{vehicle.capacity ?? '—'}</strong><small>Confirm passenger and luggage fit for each trip.</small></article><article className="card"><span>Journeys in view</span><strong>{trips.length}</strong><small>{from} to {to}</small></article>{finance && <article className="card"><span>Monthly hire</span><strong>{kes(Number(vehicle.monthly_fee))}</strong><small>Current vehicle record</small></article>}</div>
    {vehicle.notes && <section className="record-detail-note card"><h3>Vehicle note</h3><p>{vehicle.notes}</p></section>}
    <div className="record-detail-grid"><section className="card record-detail-panel"><header><h3>Recent and upcoming journeys</h3><Link href="/trips">Trips →</Link></header>{trips.length ? <ul>{trips.slice(0, 20).map(trip => <li key={trip.id}><Link href={tripMonthHref(trip.trip_date)}><div><strong>{trip.client_name}</strong><p>{trip.trip_date}{trip.pickup_time ? ` · ${trip.pickup_time} EAT` : ''} · {trip.pickup || 'Pickup pending'} → {trip.dropoff || 'Destination pending'}</p></div><small>{trip.status.replace('_',' ')} ↗</small></Link></li>)}</ul> : <p className="record-detail-empty">No trips for this vehicle in this date window.</p>}</section>
      <div className="record-detail-side"><section className="card record-detail-panel"><header><h3>Compliance</h3><Link href="/compliance">Open compliance →</Link></header>{documents.length ? <ul>{documents.slice(0, 8).map(doc => <li key={doc.id}><div><strong>{doc.doc_type}</strong><p>{doc.expiry_date ? `Expires ${doc.expiry_date}` : 'Expiry date not recorded'}</p></div><small>{doc.expiry_date && doc.expiry_date < today ? 'Expired' : 'Recorded'}</small></li>)}</ul> : <p className="record-detail-empty">No vehicle documents recorded.</p>}</section><section className="card record-detail-panel"><header><h3>Servicing</h3><Link href="/services">Open servicing →</Link></header>{services.length ? <ul>{services.map(service => <li key={service.id}><div><strong>{service.service_type || 'Service'}</strong><p>{service.service_date}{service.description ? ` · ${service.description}` : ''}</p></div>{finance && <small>{kes(Number(service.cost))}</small>}</li>)}</ul> : <p className="record-detail-empty">No service records yet.</p>}</section></div></div>
  </div>
}
