import Link from 'next/link'
import { PageHeader } from '@/components/ui'
import { requireOperations, canSeeFinance } from '@/lib/auth'
import { listContractors, listDrivers, listInvoices, listOrganizations, listRoutes, listTrips, listVehicles } from '@/lib/db'
import { nairobiToday } from '@/lib/nairobi-date'
import { searchRecords, shiftCalendarDay } from '@/lib/record-search'
import './search-workspace.css'

export const dynamic = 'force-dynamic'
export default async function RecordSearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const profile = await requireOperations()
  const sp = await searchParams
  const raw = typeof sp.q === 'string' ? sp.q.trim() : ''
  const query = raw.slice(0, 100)
  const valid = raw.length >= 2 && raw.length <= 100
  const finance = canSeeFinance(profile.role)
  const today = nairobiToday()
  const start = shiftCalendarDay(today, -89)
  // Opening search does not scan records until a valid query is submitted.
  const source = valid ? await Promise.all([
    listTrips(start, today), listVehicles(), listDrivers(), listOrganizations(), listContractors(), listRoutes(), finance ? listInvoices() : Promise.resolve([]),
  ]) : null
  const groups = source ? searchRecords(query, { trips: source[0], vehicles: source[1], drivers: source[2], organizations: source[3], contractors: source[4], routes: source[5], invoices: source[6] }, finance) : []
  const total = groups.reduce((sum, group) => sum + group.total, 0)

  return <div className="record-search-page"><PageHeader title="Find a record" subtitle="Search across the records you can access." action={<Link className="btn-ghost record-search-back" href="/workday">Today’s work</Link>}/>
    <form action="/search" className="record-search-form card"><label htmlFor="record-query">Name, reference, registration or route</label><div><input id="record-query" className="input" name="q" type="search" minLength={2} maxLength={100} defaultValue={query} placeholder="e.g. a passenger, invoice number or KDA 123A" required autoComplete="off"/><button className="btn-primary" type="submit">Search records</button></div><p>Trip records: {start} to {today} · Nairobi dates. Other record types use their current records.{finance ? ' Invoices are included for your finance role.' : ' Financial records are excluded from your results.'}</p></form>
    {raw && !valid && <p className="record-search-message" role="alert">Enter between 2 and 100 characters to search.</p>}
    {!raw && <div className="record-search-start card"><span aria-hidden="true">⌕</span><h2>Start with a detail you know.</h2><p>Find recent trips by passenger or reference, a vehicle by registration, or a driver by name. Trip links open the relevant month’s records.</p><div className="record-search-types"><span>Trips</span><span>Vehicles</span><span>Drivers</span><span>Routes</span>{finance && <><span>Clients</span><span>Contractors</span><span>Invoices</span></>}</div></div>}
    {valid && <><div className="record-search-result-heading"><h2>{total ? `${total} matching ${total === 1 ? 'record' : 'records'}` : 'No matching records'}</h2><p>For “{query}”{total ? ' · up to 20 results per type' : '. Try a shorter name or a different reference.'}</p></div>{groups.map(group => <section key={group.key} className="record-search-group card"><header><h3>{group.label}</h3><span>{group.items.length} of {group.total}</span></header><ul>{group.items.map(item => <li key={item.id}><Link href={item.href}><div><strong>{item.title}</strong><p>{item.summary}</p></div><span className="record-search-result-meta">{item.badge && <small>{item.badge.replace(/_/g, ' ')}</small>}<span aria-hidden="true">↗</span></span></Link></li>)}</ul></section>)}</>}
  </div>
}
