import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/ui'
import { requireFinance } from '@/lib/auth'
import { listContractors, listOrganizations, listTrips } from '@/lib/db'
import { kes } from '@/lib/format'
import { nairobiToday } from '@/lib/nairobi-date'
import { shiftCalendarDay, tripMonthHref } from '@/lib/record-search'
import '../../record-detail.css'

export const dynamic = 'force-dynamic'
export default async function ClientRecordPage({ params }: { params: Promise<{ id: string }> }) {
  await requireFinance()
  const { id } = await params
  const today = nairobiToday()
  const from = shiftCalendarDay(today, -89)
  const to = shiftCalendarDay(today, 30)
  const [organizations, contractors, allTrips] = await Promise.all([listOrganizations(), listContractors(), listTrips(from, to)])
  const organization = organizations.find(item => item.id === id)
  if (!organization) notFound()
  const contractor = contractors.find(item => item.id === organization.contractor_id)
  const trips = allTrips.filter(trip => trip.organization_id === id).sort((a,b) => b.trip_date.localeCompare(a.trip_date))
  const completed = trips.filter(trip => trip.status === 'completed')
  const billed = trips.filter(trip => trip.invoice_id)
  const total = completed.reduce((sum, trip) => sum + Number(trip.amount || 0), 0)
  return <div className="record-detail-page"><PageHeader title={organization.name} subtitle="Client organization" action={<Link className="btn-ghost" href="/clients">← All clients</Link>}/>
    <div className="record-detail-hero card"><div><span className="record-detail-kicker">CLIENT ORGANIZATION</span><h2>{organization.name}</h2><p>{contractor ? `Associated contractor: ${contractor.name}` : 'No contractor associated with this organization'}</p></div><span className={`record-detail-status status-${organization.active ? 'active' : 'retired'}`}>{organization.active ? 'Active' : 'Inactive'}</span></div>
    <div className="record-detail-metrics"><article className="card"><span>Journeys in view</span><strong>{trips.length}</strong><small>{from} to {to}</small></article><article className="card"><span>Completed journeys</span><strong>{completed.length}</strong><small>In this date window</small></article><article className="card"><span>Linked to invoices</span><strong>{billed.length}</strong><small>Trip records linked to an invoice</small></article><article className="card"><span>Earned trip value</span><strong>{kes(total)}</strong><small>Completed work in this date window</small></article></div>
    <section className="card record-detail-panel"><header><h3>Journeys for {organization.name}</h3><Link href="/trips">All trips →</Link></header>{trips.length ? <ul>{trips.slice(0, 30).map(trip => <li key={trip.id}><Link href={tripMonthHref(trip.trip_date)}><div><strong>{trip.client_name}</strong><p>{trip.trip_date}{trip.pickup_time ? ` · ${trip.pickup_time} EAT` : ''} · {trip.pickup || 'Pickup pending'} → {trip.dropoff || 'Destination pending'}</p></div><small>{kes(Number(trip.amount))} · {trip.status.replace('_',' ')} ↗</small></Link></li>)}</ul> : <p className="record-detail-empty">No journeys for this organization in this date window.</p>}</section><p className="record-detail-caption">Trip value is shown for this organization’s journey records. An invoice for the associated contractor may include journeys for other organizations.</p>
  </div>
}
