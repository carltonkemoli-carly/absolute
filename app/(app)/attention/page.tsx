import Link from 'next/link'
import { PageHeader } from '@/components/ui'
import { requireOperations, canSeeFinance } from '@/lib/auth'
import { listDocuments, listDrivers, listInvoices, listTrips, listUnassignedTrips, listVehicles } from '@/lib/db'
import { nairobiToday } from '@/lib/nairobi-date'
import { deriveAttention, shiftCalendarDay } from '@/lib/record-search'
import { kes } from '@/lib/format'
import './attention.css'

export const dynamic = 'force-dynamic'
export default async function AttentionPage() {
  const profile = await requireOperations()
  const finance = canSeeFinance(profile.role)
  const today = nairobiToday()
  const lastDay = shiftCalendarDay(today, 6)
  const [pending, trips, documents, vehicles, drivers, invoices] = await Promise.all([
    listUnassignedTrips(8), listTrips(today, lastDay), listDocuments(), listVehicles(), listDrivers(), finance ? listInvoices() : Promise.resolve([]),
  ])
  const issues = deriveAttention(trips, documents, invoices, today, finance)
  const vehicleNames = new Map(vehicles.map(vehicle => [vehicle.id, vehicle.plate]))
  const driverNames = new Map(drivers.map(driver => [driver.id, driver.name]))
  const cards = [
    {href:'#booked-backlog',label:'Booked backlog',count:pending.total,hint:'Across all dates'},
    {href:'#missing-assignments',label:'Missing assignments',count:issues.missingAssignments.length,hint:'Today and the next six days'},
    {href:'#expired-documents',label:'Expired documents',count:issues.expiredDocuments.length,hint:'Current document records'},
    ...(finance ? [{href:'#overdue-invoices',label:'Overdue invoices',count:issues.overdueInvoices.length,hint:'Unsettled and past due'}] : []),
  ]
  return <div className="attention-page"><PageHeader title="Needs attention" subtitle={`Current records as of ${today} · Nairobi dates. These are work queues, not sent notifications.`} action={<Link href="/workday" className="btn-ghost attention-back">Today’s work</Link>}/>
    <div className="attention-metrics">{cards.map(card=><a href={card.href} key={card.href} className="card attention-metric"><span>{card.label}</span><strong>{card.count}</strong><small>{card.hint}</small><i aria-hidden="true">↗</i></a>)}</div>
    <p className="attention-scope">A job can appear in both the backlog and missing-assignment queue. Counts are separate checks, not a combined total.</p>
    <div className="attention-grid">
      <section id="booked-backlog" className="card attention-panel"><header><div><p>ACROSS ALL DATES</p><h2>Booked backlog <span>{pending.total}</span></h2></div><Link href="/dispatch">Dispatch →</Link></header>{pending.trips.length ? <><ul>{pending.trips.map(trip=><li key={trip.id}><Link href={`/dispatch?d=${trip.trip_date}`}><div><strong>{trip.client_name}</strong><p>{trip.trip_date}{trip.pickup_time ? ` · ${trip.pickup_time} EAT` : ''} · {trip.pickup || 'Pickup to confirm'} → {trip.dropoff || 'Destination to confirm'}</p></div><span>Assign ↗</span></Link></li>)}</ul><p className="attention-panel-note">Showing {pending.trips.length} of {pending.total} booked jobs. Open Dispatch to review the pending queue.</p></> : <Empty>No booked jobs are waiting in the queue.</Empty>}</section>
      <section id="missing-assignments" className="card attention-panel"><header><div><p>{today} TO {lastDay}</p><h2>Missing assignments <span>{issues.missingAssignments.length}</span></h2></div></header>{issues.missingAssignments.length ? <><ul>{issues.missingAssignments.slice(0,15).map(trip=><li key={trip.id}><Link href={`/dispatch?d=${trip.trip_date}`}><div><strong>{trip.client_name}</strong><p>{trip.trip_date}{trip.pickup_time ? ` · ${trip.pickup_time} EAT` : ''}</p><small>{!trip.driver_id ? 'Driver missing' : 'Driver assigned'} · {!trip.vehicle_id ? 'Vehicle missing' : 'Vehicle assigned'}</small></div><span>Review ↗</span></Link></li>)}</ul>{issues.missingAssignments.length>15&&<p className="attention-panel-note">Showing the first 15 of {issues.missingAssignments.length} jobs. Use Dispatch for the relevant dates to review the rest.</p>}</> : <Empty>All open jobs in the next seven days have a driver and vehicle recorded.</Empty>}</section>
      <section id="expired-documents" className="card attention-panel"><header><div><p>CURRENT COMPLIANCE RECORDS</p><h2>Expired documents <span>{issues.expiredDocuments.length}</span></h2></div><Link href="/compliance">Compliance →</Link></header>{issues.expiredDocuments.length ? <><ul>{issues.expiredDocuments.slice(0,15).map(document=><li key={document.id}><Link href="/compliance"><div><strong>{document.doc_type}</strong><p>{document.owner_kind === 'vehicle' ? vehicleNames.get(document.vehicle_id || '') || 'Vehicle not recorded' : driverNames.get(document.driver_id || '') || 'Driver not recorded'} · Expired {document.expiry_date}</p>{document.attended&&<small>Follow-up recorded; expiry date is still past.</small>}</div><span>Review ↗</span></Link></li>)}</ul>{issues.expiredDocuments.length>15&&<p className="attention-panel-note">Showing the first 15 expired records. Review the full list in Compliance.</p>}</> : <Empty>No current document records have an expiry date before today.</Empty>}</section>
      {finance&&<section id="overdue-invoices" className="card attention-panel"><header><div><p>FINANCE ACCESS</p><h2>Overdue invoices <span>{issues.overdueInvoices.length}</span></h2></div><Link href="/receivables">Receivables →</Link></header>{issues.overdueInvoices.length ? <><ul>{issues.overdueInvoices.slice(0,15).map(invoice=><li key={invoice.id}><Link href={`/receivables/${encodeURIComponent(invoice.id)}`}><div><strong>{invoice.invoice_no || 'Invoice without a number'}</strong><p>{invoice.period_label || 'Period not recorded'} · Due {invoice.due_date}</p><small>{kes(Math.max(0,Number(invoice.amount)-Number(invoice.amount_paid)))} outstanding</small></div><span>Open ↗</span></Link></li>)}</ul>{issues.overdueInvoices.length>15&&<p className="attention-panel-note">Showing the first 15 overdue invoices. Open Receivables for the full list.</p>}</> : <Empty>No unsettled invoice records are past their due date.</Empty>}</section>}
    </div>
  </div>
}
function Empty({children}:{children:React.ReactNode}){return <p className="attention-empty">{children}</p>}
