import Link from 'next/link'
import { redirect } from 'next/navigation'
import MonthNav from '@/components/MonthNav'
import NotificationsCard from '@/components/NotificationsCard'
import QuickActions from '@/components/QuickActions'
import SegmentDonut, { type Seg } from '@/components/SegmentDonut'
import { requireProfile, canSeeFinance } from '@/lib/auth'
import { listTrips, listFuel, listVehicles, listDrivers, listContractors, listDocuments, listServices, listExpenses, listInvoices, listUnassignedTrips } from '@/lib/db'
import { OWNERSHIP_LABELS, type Invoice } from '@/lib/types'
import { buildAttention } from '@/lib/attention'
import { buildAlerts } from '@/lib/alerts'
import { monthRange, kes, kesPlain, MONTH_NAMES } from '@/lib/format'
import { nairobiToday } from '@/lib/nairobi-date'
import { shiftCalendarDay } from '@/lib/record-search'
import { stickyPeriod } from '@/lib/period'
import { isEarnedTrip, monthlyPL, profitHeadline } from '@/lib/finance'
import './dashboard.css'

export default async function DashboardPage({
  searchParams,
}: { searchParams: Promise<{ y?: string; m?: string }> }) {
  const profile = await requireProfile()
  // Office staff start with the day’s operational work; finance remains role-gated.
  if (!canSeeFinance(profile.role)) redirect('/workday')

  const sp = await searchParams
  const { year, month } = await stickyPeriod(sp)
  const { start, end } = monthRange(year, month)

  const [trips, fuel, vehicles, drivers, contractors, documents, services, expenses, invoices, pending] = await Promise.all([
    listTrips(start, end), listFuel(start, end), listVehicles(), listDrivers(), listContractors(), listDocuments(), listServices(), listExpenses(start, end), listInvoices(), listUnassignedTrips(1),
  ])
  const today = nairobiToday()
  const attention = buildAttention(documents, services, vehicles, drivers)
  const alerts = buildAlerts({ vehicles, trips, fuel, expenses, services: services.filter((s) => s.service_date >= start && s.service_date <= end), invoices, contractors, today, monthLabel: `${MONTH_NAMES[month]} ${year}`, monthStart: start, monthEnd: end })

  // ---- Financial headlines from one P&L calculation ----
  const pl = monthlyPL({ trips, fuel, expenses, services: services.filter((s) => s.service_date >= start && s.service_date <= end), vehicles })
  const earnedTrips = trips.filter(isEarnedTrip)
  const headline = profitHeadline(pl)
  const revenue = pl.revenue
  const express = pl.express
  const fuelTotal = pl.fuel
  const netRevenue = pl.netRevenue
  const index = netRevenue > 0 ? fuelTotal / netRevenue : 0

  const outstanding = invoices.reduce((s, i) => s + due(i), 0)
  const overdue = invoices.reduce((s, i) => s + (due(i) > 0 && i.due_date && i.due_date < today ? due(i) : 0), 0)

  // ---- Palette: colour lives in the data, chrome stays neutral ----
  const CHART = ['#2C7A53', '#C9A227', '#2F9E8F', '#BC3E22', '#3E7CB1', '#7A5FB0', '#D98A3D']
  const GREEN = '#2C7A53', GOLD = '#C9A227', TEAL = '#2F9E8F', RED = '#BC3E22'

  // Revenue by contractor (currency donut)
  const contractorRev: Seg[] = contractors
    .map((c, i) => ({ label: c.name, value: sum(earnedTrips.filter((t) => t.contractor_id === c.id), (t) => t.amount), color: CHART[i % CHART.length] }))
    .concat([{ label: 'Direct / no contractor', value: sum(earnedTrips.filter((t) => !t.contractor_id), (t) => t.amount), color: CHART[contractors.length % CHART.length] }])
    .filter((s) => s.value > 0).sort((a, b) => b.value - a.value)

  // Fleet mix by ownership (count donut with ring badges)
  const fleetMix: Seg[] = ([['owned', GREEN], ['monthly_hire', GOLD], ['casual_hire', TEAL]] as const)
    .map(([o, color]) => ({ label: OWNERSHIP_LABELS[o], value: vehicles.filter((v) => v.ownership === o).length, color }))

  // Trips by contractor this month (count donut)
  const tripsByContractor: Seg[] = contractors
    .map((c, i) => ({ label: c.name, value: trips.filter((t) => t.contractor_id === c.id).length, color: CHART[i % CHART.length] }))
    .concat([{ label: 'Direct / no contractor', value: trips.filter((t) => !t.contractor_id).length, color: CHART[contractors.length % CHART.length] }])
    .filter((s) => s.value > 0).sort((a, b) => b.value - a.value)

  // Receivables status (count donut)
  let paidN = 0, overdueN = 0, openN = 0
  for (const i of invoices) {
    if (due(i) <= 0) { if (Number(i.amount) > 0) paidN++; continue }
    if (i.due_date && i.due_date < today) overdueN++; else openN++
  }
  const receivablesMix: Seg[] = [
    { label: 'Paid', value: paidN, color: GREEN },
    { label: 'Outstanding', value: openN, color: GOLD },
    { label: 'Overdue', value: overdueN, color: RED },
  ]

  // Compliance status (count donut) — by document expiry
  const in30 = shiftCalendarDay(today, 30)
  let okN = 0, expiringN = 0, expiredN = 0
  for (const d of documents) {
    if (d.expiry_date && d.expiry_date < today) expiredN++
    else if (d.expiry_date && d.expiry_date <= in30) expiringN++
    else okN++
  }
  const complianceMix: Seg[] = [
    { label: 'Valid', value: okN, color: GREEN },
    { label: 'Expiring soon', value: expiringN, color: GOLD },
    { label: 'Expired', value: expiredN, color: RED },
  ]

  // Real daily work makes the selected month tangible and gives the owner a
  // direct route from a pattern in the chart to the jobs behind it.
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const rhythm = Array.from({ length: daysInMonth }, (_, index) => {
    const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(index + 1).padStart(2, '0')}`
    const dayTrips = trips.filter((trip) => trip.trip_date === date && trip.status !== 'cancelled')
    return { date, day: index + 1, completed: dayTrips.filter(isEarnedTrip).length, upcoming: dayTrips.filter((trip) => !isEarnedTrip(trip)).length }
  })
  const busiest = rhythm.reduce((best, day) => day.completed + day.upcoming > best.completed + best.upcoming ? day : best, rhythm[0])
  const maxDailyTrips = Math.max(1, ...rhythm.map((day) => day.completed + day.upcoming))


  return <div className="executive-dashboard">
    <div className="ed-period-bar"><div><span className="ed-kicker">MANAGEMENT / DASHBOARD</span><strong>{MONTH_NAMES[month]} {year}</strong></div><MonthNav year={year} month={month}/></div>

    <header className="ed-hero"><div className="ed-hero-main"><p className="ed-kicker">ABSOLUTE COMFORT TRAVEL / BUSINESS VIEW</p><h1>Keep the whole journey in view.</h1><p>Trips, collections and the work that needs a decision. Start with the day, then look deeper when you need to.</p><div className="ed-hero-actions"><Link href="/workday" className="ed-primary-action">Open today’s work <span aria-hidden="true">↗</span></Link><Link href="/dispatch" className="ed-secondary-action">Dispatch board <span aria-hidden="true">→</span></Link></div></div><div className="ed-hero-side"><span className="ed-side-kicker">COLLECTION POSITION · ALL DATES</span><strong>{kes(outstanding)}</strong><p>{overdue > 0 ? `${kes(overdue)} is past its due date` : outstanding > 0 ? 'No overdue balance recorded' : 'No outstanding balance recorded'}</p><Link href="/receivables">Review receivables <span aria-hidden="true">↗</span></Link><svg aria-hidden="true" viewBox="0 0 320 108" focusable="false"><path d="m9 74 91-50 97 25 113-37"/><path d="m9 74 91-50 97 25 113-37"/><g><circle cx="9" cy="74" r="5"/><circle cx="100" cy="24" r="5"/><circle cx="197" cy="49" r="5"/><circle cx="310" cy="12" r="5"/></g></svg></div></header>

    <section className="ed-section" aria-labelledby="ed-performance"><div className="ed-section-head"><div><p className="ed-kicker">THE SELECTED MONTH</p><h2 id="ed-performance">Business performance</h2></div><span>{MONTH_NAMES[month]} {year} · Nairobi time</span></div><div className="ed-metrics">
      <article className="ed-metric ed-metric-revenue"><span className="ed-metric-number">01 / EARNED REVENUE</span><strong>{kes(revenue)}</strong><p>{express > 0 ? `${kes(netRevenue)} fares + ${kes(express)} expressway` : 'Completed journeys this month'}</p></article>
      <article className={`ed-metric ${headline.value < 0 ? 'ed-metric-negative' : ''}`}><span className="ed-metric-number">02 / {headline.label.toUpperCase()}</span><strong>{kes(headline.value)}</strong><p>{revenue > 0 ? `${pct(headline.margin)} margin` : headline.hint}</p></article>
      <article className="ed-metric"><span className="ed-metric-number">03 / COMPLETED JOURNEYS</span><strong>{earnedTrips.length}</strong><p>{trips.length - earnedTrips.length} other trip records this month</p></article>
      <article className="ed-metric"><span className="ed-metric-number">04 / FUEL INDEX</span><strong>{pct(index)}</strong><p>{revenue > 0 ? `${kes(fuelTotal)} fuel against completed work` : `${kes(fuelTotal)} fuel recorded`}</p></article>
    </div></section>

    <section className="ed-section" aria-labelledby="ed-rhythm-title">
      <div className="ed-section-head"><div><p className="ed-kicker">THE JOURNEY RHYTHM</p><h2 id="ed-rhythm-title">A month in motion</h2></div><span>Choose a day to open its workboard</span></div>
      <div className="ed-rhythm-panel">
        <div className="ed-rhythm-main">
          <div className="ed-rhythm-legend"><span><i className="ed-rhythm-key ed-rhythm-key-done"/>Completed</span><span><i className="ed-rhythm-key ed-rhythm-key-open"/>Still in progress</span></div>
          <div className="ed-rhythm-scroll"><div className="ed-rhythm-chart" aria-label={`Journey activity in ${MONTH_NAMES[month]} ${year}`}>
            {rhythm.map((day) => {
              const count = day.completed + day.upcoming
              return <Link href={`/workday?d=${day.date}`} key={day.date} className="ed-rhythm-day" data-today={day.date === today || undefined}
                aria-label={`${day.date}: ${day.completed} completed, ${day.upcoming} still in progress`} title={`${day.date} · ${day.completed} completed · ${day.upcoming} in progress`}>
                <span className="ed-rhythm-track"><span className="ed-rhythm-bar" style={{ height: `${count ? Math.max(8, count / maxDailyTrips * 100) : 0}%` }}>
                  {day.completed > 0 && <i className="ed-rhythm-done" style={{ flex: day.completed }} />}
                  {day.upcoming > 0 && <i className="ed-rhythm-open" style={{ flex: day.upcoming }} />}
                </span></span><span className="ed-rhythm-date">{day.day}</span>
              </Link>
            })}
          </div></div>
        </div>
        <div className="ed-rhythm-aside"><span className="ed-kicker">BUSIEST RECORDED DAY</span><strong>{busiest.completed + busiest.upcoming > 0 ? String(busiest.day).padStart(2, '0') : '—'}</strong><p>{busiest.completed + busiest.upcoming > 0 ? `${busiest.completed + busiest.upcoming} ${busiest.completed + busiest.upcoming === 1 ? 'journey' : 'journeys'} on ${MONTH_NAMES[month]} ${busiest.day}` : 'No journeys have been logged for this month.'}</p>{busiest.completed + busiest.upcoming > 0 && <Link href={`/workday?d=${busiest.date}`}>View this day <span aria-hidden="true">↗</span></Link>}</div>
      </div>
    </section>

    <section className="ed-section" aria-labelledby="ed-decisions"><div className="ed-section-head"><div><p className="ed-kicker">YOUR WORK QUEUES</p><h2 id="ed-decisions">Where to focus next</h2></div><Link href="/attention">Open attention centre <span aria-hidden="true">→</span></Link></div><div className="ed-queue-grid">
      <Link href="/dispatch" className="ed-queue-card"><span>01 / DISPATCH</span><strong>{pending.total}</strong><h3>Unassigned bookings</h3><p>Across all travel dates</p><i aria-hidden="true">↗</i></Link>
      <Link href="/receivables" className="ed-queue-card"><span>02 / COLLECTIONS</span><strong>{overdueN}</strong><h3>Overdue invoices</h3><p>{overdue > 0 ? `${kes(overdue)} to follow up` : 'No overdue invoice balance'}</p><i aria-hidden="true">↗</i></Link>
      <Link href="/compliance" className="ed-queue-card"><span>03 / COMPLIANCE</span><strong>{expiredN + expiringN}</strong><h3>Expired or due soon</h3><p>Document expiries in the next 30 days</p><i aria-hidden="true">↗</i></Link>
    </div></section>

    {trips.length === 0 && <section className="ed-empty-month"><div><span className="ed-kicker">NO JOURNEYS IN THIS MONTH</span><h2>A quiet month in the records.</h2><p>No trips are logged for {MONTH_NAMES[month]} {year}. Choose another month or add a trip when the journey details are ready.</p></div><Link href="/trips">Open trip records <span aria-hidden="true">→</span></Link></section>}
    {trips.length > 0 && earnedTrips.length === 0 && <section className="ed-empty-month"><div><span className="ed-kicker">NO COMPLETED JOURNEYS</span><h2>Bookings are waiting to become earned work.</h2><p>Only completed journeys count toward revenue. Confirm finished trips in Dispatch to update this month’s figures.</p></div><Link href="/dispatch">Open dispatch <span aria-hidden="true">→</span></Link></section>}

    <section className="ed-section" aria-labelledby="ed-insights"><div className="ed-section-head"><div><p className="ed-kicker">THE DETAIL BEHIND THE NUMBERS</p><h2 id="ed-insights">Business mix</h2></div><span>Live records · no estimates</span></div><div className="ed-insights-grid">
      <article className="ed-insight-card"><header><h3>Revenue by contractor</h3><span>Selected month</span></header>{contractorRev.length ? <SegmentDonut data={contractorRev} centerValue={kesPlain(revenue)} centerLabel="Ksh earned" centerSize={19} money/> : <div className="ed-insight-empty"><p>No completed-trip revenue is recorded in this month.</p><Link href="/trips">Review trips →</Link></div>}</article>
      <article className="ed-insight-card"><header><h3>Fleet ownership</h3><span>Current fleet</span></header>{vehicles.length ? <SegmentDonut data={fleetMix} centerValue={String(vehicles.length)} centerLabel="vehicles" badges/> : <div className="ed-insight-empty"><p>No vehicles are recorded yet.</p><Link href="/vehicles">Open fleet →</Link></div>}</article>
      <article className="ed-insight-card"><header><h3>Invoice position</h3><span>All dates</span></header>{invoices.length ? <SegmentDonut data={receivablesMix} centerValue={String(invoices.length)} centerLabel="invoices" badges/> : <div className="ed-insight-empty"><p>No invoices are recorded yet.</p><Link href="/receivables">Open receivables →</Link></div>}</article>
      <article className="ed-insight-card"><header><h3>Compliance</h3><span>Current documents</span></header>{documents.length ? <SegmentDonut data={complianceMix} centerValue={String(documents.length)} centerLabel="documents" badges/> : <div className="ed-insight-empty"><p>No documents are tracked yet.</p><Link href="/compliance">Open compliance →</Link></div>}</article>
    </div></section>

    {tripsByContractor.length > 0 && <section className="ed-section ed-trip-sources" aria-labelledby="ed-trip-sources"><div className="ed-section-head"><div><p className="ed-kicker">JOURNEY SOURCES</p><h2 id="ed-trip-sources">Trips by contractor</h2></div></div><div className="ed-insight-card"><SegmentDonut data={tripsByContractor} centerValue={String(trips.length)} centerLabel="this month" badges/></div></section>}
    <div className="ed-alerts"><NotificationsCard attention={attention} alerts={alerts}/></div>
    <div className="ed-quick-actions"><QuickActions/></div>
  </div>
}

// outstanding balance on one invoice
function due(i: Invoice): number {
  return Math.max(0, Number(i.amount) - Number(i.amount_paid))
}
function sum<T>(rows: T[], f: (r: T) => number): number {
  return rows.reduce((s, r) => s + Number(f(r) || 0), 0)
}
function pct(x: number): string {
  return `${(x * 100).toFixed(1)}%`
}
