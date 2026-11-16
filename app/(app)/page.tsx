import Link from 'next/link'
import { redirect } from 'next/navigation'
import MonthNav from '@/components/MonthNav'
import QuickActions from '@/components/QuickActions'
import Sparkline from '@/components/Sparkline'
import { PageHeader, KpiCard } from '@/components/ui'
import { requireProfile, canSeeFinance } from '@/lib/auth'
import { listTrips, listFuel, listVehicles, listDrivers, listContractors, listDocuments, listServices, listExpenses, listInvoices, listUnassignedTrips } from '@/lib/db'
import { buildAttention } from '@/lib/attention'
import { buildAlerts } from '@/lib/alerts'
import { CHART_COLORS, STATUS_COLORS } from '@/lib/chart'
import { agingBuckets, debtors, change, comparisonWindow } from '@/lib/dashboard'
import { monthRange, kes, MONTH_NAMES } from '@/lib/format'
import { nairobiToday } from '@/lib/nairobi-date'
import { shiftCalendarDay } from '@/lib/record-search'
import { stickyPeriod } from '@/lib/period'
import { isEarnedTrip, periodPL, profitHeadline } from '@/lib/finance'
import type { Trip } from '@/lib/types'
import './dashboard.css'

export const dynamic = 'force-dynamic'

const MONTHS_BACK = 6

export default async function DashboardPage({
  searchParams,
}: { searchParams: Promise<{ y?: string; m?: string }> }) {
  const profile = await requireProfile()
  // Office staff start with the day's operational work; finance remains role-gated.
  if (!canSeeFinance(profile.role)) redirect('/workday')

  const sp = await searchParams
  const { year, month } = await stickyPeriod(sp)
  const selected = monthRange(year, month)
  const previous = monthRange(year, month - 1)
  const windowStart = monthRange(year, month - (MONTHS_BACK - 1)).start
  const today = nairobiToday()
  const monthName = MONTH_NAMES[month]

  const [winTrips, winFuel, winExpenses, services, vehicles, drivers, contractors, documents, invoices, pending, recentTrips] = await Promise.all([
    listTrips(windowStart, selected.end), listFuel(windowStart, selected.end), listExpenses(windowStart, selected.end),
    listServices(), listVehicles(), listDrivers(), listContractors(), listDocuments(), listInvoices(), listUnassignedTrips(1),
    // Same 60-day window Receivables uses, so "not yet invoiced" agrees on both pages.
    listTrips(shiftCalendarDay(today, -60), today),
  ])

  const sum = <T,>(rows: T[], f: (row: T) => number) => rows.reduce((s, row) => s + (Number(f(row)) || 0), 0)
  const inRange = (date: string, start: string, end: string) => date >= start && date <= end

  // ---- Six months through the one P&L engine ----
  const all = { trips: winTrips, fuel: winFuel, expenses: winExpenses, services, vehicles }
  const series = Array.from({ length: MONTHS_BACK }, (_, index) => {
    const range = monthRange(year, month - (MONTHS_BACK - 1 - index))
    const pl = periodPL(all, [range.start.slice(0, 7)])
    const completed = winTrips.filter((trip) => isEarnedTrip(trip) && inRange(trip.trip_date, range.start, range.end)).length
    return { pl, completed }
  })
  const pl = series[MONTHS_BACK - 1].pl
  const headline = profitHeadline(pl)

  const trips = winTrips.filter((trip) => inRange(trip.trip_date, selected.start, selected.end))
  const earned = trips.filter(isEarnedTrip)
  const open = trips.filter((trip) => !isEarnedTrip(trip) && trip.status !== 'cancelled')

  // ---- Like-for-like comparison with last month ----
  const { cutoff, partial } = comparisonWindow(selected, previous, today)
  const previousEarned = winTrips.filter((trip) => isEarnedTrip(trip) && inRange(trip.trip_date, previous.start, cutoff))
  const compareNote = partial ? 'vs same point last month' : 'vs last month'
  const revenueChange = change(pl.revenue, sum(previousEarned, (trip) => trip.amount))
  const tripsChange = change(earned.length, previousEarned.length)

  // ---- Receivables: a running position, not a monthly flow ----
  const aging = agingBuckets(invoices, today)
  const outstanding = sum(aging, (bucket) => bucket.amount)
  const overdue = outstanding - aging[0].amount
  const overdueCount = sum(aging.slice(1), (bucket) => bucket.count)
  const owing = debtors(invoices, contractors, today)
  const agingMax = Math.max(1, ...aging.map((bucket) => bucket.amount))
  const AGING_COLORS = [CHART_COLORS[0], STATUS_COLORS.warn, CHART_COLORS[5], STATUS_COLORS.bad]

  // ---- Trips by day ----
  const daysInMonth = Number(selected.end.slice(8, 10))
  const days = Array.from({ length: daysInMonth }, (_, index) => {
    const date = `${selected.start.slice(0, 8)}${String(index + 1).padStart(2, '0')}`
    const onDay = trips.filter((trip) => trip.trip_date === date && trip.status !== 'cancelled')
    const done = onDay.filter(isEarnedTrip).length
    return { date, day: index + 1, done, open: onDay.length - done, total: onDay.length }
  })
  const busiest = days.reduce((best, day) => (day.total > best.total ? day : best), days[0])
  const dayMax = Math.max(1, busiest.total)
  const activeDays = days.filter((day) => day.total > 0).length

  // ---- Where the fares went ----
  const costs = [
    { label: 'Fuel', value: pl.fuel, color: CHART_COLORS[0], href: '/fuel' },
    { label: 'Driver wages', value: pl.wages, color: CHART_COLORS[4], href: '/expenses' },
    { label: 'Vehicle hire', value: pl.hire, color: CHART_COLORS[3], href: '/vehicles' },
    { label: 'Servicing', value: pl.servicing, color: CHART_COLORS[6], href: '/services' },
    { label: 'Other costs', value: pl.otherExpenses, color: CHART_COLORS[7], href: '/expenses' },
  ].filter((cost) => cost.value > 0)
  const profit = Math.max(0, pl.net)
  const barTotal = Math.max(pl.netRevenue, pl.costs, 1)
  const share = (value: number) => (pl.netRevenue > 0 ? `${Math.round((value / pl.netRevenue) * 100)}%` : '—')

  // ---- Suppliers and vehicles this month ----
  const bySupplier = rank(earned, (trip) => trip.contractor_id ?? '', (id) => contractors.find((c) => c.id === id)?.name ?? 'Direct / no supplier')
  const byVehicle = rank(earned.filter((trip) => trip.vehicle_id), (trip) => trip.vehicle_id as string, (id) => vehicles.find((v) => v.id === id)?.plate ?? 'Unknown vehicle')
  const untagged = earned.filter((trip) => !trip.vehicle_id).length

  // ---- What is waiting on a decision ----
  const attention = buildAttention(documents, services, vehicles, drivers)
  const expiredDocs = attention.filter((item) => item.severity === 'expired').length
  const dueDocs = attention.filter((item) => item.severity === 'soon').length
  const unbilled = recentTrips.filter((trip) => isEarnedTrip(trip) && !trip.invoice_id)
  const monthServices = services.filter((service) => inRange(service.service_date, selected.start, selected.end))
  const alerts = buildAlerts({
    vehicles, trips: earned, fuel: winFuel.filter((entry) => inRange(entry.fuel_date, selected.start, selected.end)),
    expenses: winExpenses.filter((expense) => inRange(expense.expense_date, selected.start, selected.end)),
    services: monthServices, invoices, contractors, today, monthLabel: `${monthName} ${year}`, monthStart: selected.start, monthEnd: selected.end,
  })
  type Tone = 'bad' | 'warn' | 'info'
  const queue: { tone: Tone; count?: number; title: string; detail: string; href: string }[] = []
  if (overdueCount > 0) queue.push({ tone: 'bad', count: overdueCount, title: `${plural(overdueCount, 'invoice')} overdue`, detail: `${kes(overdue)} past its due date`, href: '/receivables' })
  if (expiredDocs > 0) queue.push({ tone: 'bad', count: expiredDocs, title: expiredDocs === 1 ? '1 document or service has expired' : `${expiredDocs} documents or services have expired`, detail: 'Renew before the vehicle or driver goes out', href: '/compliance' })
  if (pending.total > 0) queue.push({ tone: 'warn', count: pending.total, title: `${plural(pending.total, 'booking')} without a driver or vehicle`, detail: 'Across all travel dates', href: '/dispatch' })
  if (dueDocs > 0) queue.push({ tone: 'warn', count: dueDocs, title: `${plural(dueDocs, 'renewal')} due within 30 days`, detail: 'Insurance, inspections, licences and services', href: '/compliance' })
  if (pl.revenue > 0 && !pl.costsComplete) queue.push({ tone: 'warn', title: `Wages not recorded for ${monthName}`, detail: 'Profit is shown before wages until they are entered', href: '/expenses' })
  for (const alert of alerts) queue.push({ tone: alert.level === 'critical' ? 'bad' : alert.level === 'warning' ? 'warn' : 'info', title: alert.title, detail: alert.detail, href: alert.href })
  if (unbilled.length > 0) queue.push({ tone: 'info', count: unbilled.length, title: `${plural(unbilled.length, 'completed trip')} not yet invoiced`, detail: `${kes(sum(unbilled, (trip) => trip.amount))} of work from the last 60 days`, href: '/receivables' })

  const subtitle = partial ? `${monthName} ${year} · month to date` : `${monthName} ${year}`

  return (
    <div className="dash">
      <PageHeader title="Dashboard" subtitle={subtitle} action={<MonthNav year={year} month={month} />} />

      <div className="dash-kpis">
        <KpiCard
          label="Earned revenue" value={kes(pl.revenue)} tone="var(--accent)"
          delta={revenueChange} deltaNote={compareNote}
          sub={pl.express > 0 ? `${kes(pl.netRevenue)} fares + ${kes(pl.express)} tolls` : revenueChange === null ? 'Completed trips only' : undefined}
          chart={<Sparkline values={series.map((m) => m.pl.revenue)} label="Revenue, last six months" partial={partial} />}
        />
        <KpiCard
          label={headline.label} value={kes(pl.net)} tone={pl.net < 0 ? 'var(--danger)' : pl.costsComplete ? 'var(--ok)' : 'var(--gold)'}
          sub={pl.netRevenue > 0 ? `${(pl.margin * 100).toFixed(1)}% of fares` : headline.hint}
          chart={<Sparkline values={series.map((m) => m.pl.net)} color={pl.net < 0 ? 'var(--danger)' : 'var(--chart-good)'} label="Profit, last six months" partial={partial} />}
        />
        <KpiCard
          label="Completed trips" value={String(earned.length)}
          delta={tripsChange} deltaNote={compareNote}
          sub={open.length > 0 ? `${open.length} still open this month` : tripsChange === null ? 'This month' : undefined}
          chart={<Sparkline values={series.map((m) => m.completed)} color="var(--chart-7)" label="Completed trips, last six months" partial={partial} />}
        />
        <KpiCard
          label="Owed to you" value={kes(outstanding)} tone={overdue > 0 ? 'var(--danger)' : outstanding > 0 ? 'var(--gold)' : 'var(--ink)'}
          href="/receivables"
          sub={overdue > 0 ? `${kes(overdue)} overdue · all dates` : outstanding > 0 ? 'Nothing overdue · all dates' : 'Everything collected'}
          chart={outstanding > 0 ? (
            <span className="dash-aging-mini" role="img" aria-label="Share of the balance by how late it is">
              {aging.map((bucket, index) => bucket.amount > 0 && <i key={bucket.key} style={{ flex: bucket.amount, background: AGING_COLORS[index] }} />)}
            </span>
          ) : undefined}
        />
      </div>

      {trips.length === 0 && (
        <div className="card dash-empty">
          <strong>No trips are recorded for {monthName} {year}.</strong>
          <span>Pick another month above, or <Link href="/trips">add trips</Link>. The receivables and work queue below are current whatever month is selected.</span>
        </div>
      )}
      {trips.length > 0 && earned.length === 0 && (
        <div className="card dash-empty">
          <strong>{plural(trips.length, 'trip')} booked, none completed yet.</strong>
          <span>Only completed trips count as revenue. Mark finished jobs complete in <Link href="/dispatch">Dispatch</Link>.</span>
        </div>
      )}

      <div className="dash-row dash-row-wide">
        <section className="card dash-panel" aria-labelledby="dash-days">
          <header className="dash-panel-head">
            <h2 id="dash-days">Trips by day</h2>
            <span>{trips.length > 0 ? `${activeDays} working ${activeDays === 1 ? 'day' : 'days'} · busiest ${busiest.day} ${monthName.slice(0, 3)} (${busiest.total})` : 'No trips this month'}</span>
          </header>
          <div className="dash-days-wrap">
            <div className="dash-days" style={{ gridTemplateColumns: `repeat(${daysInMonth}, minmax(0, 1fr))` }}>
              {days.map((day) => (
                <Link key={day.date} href={`/workday?d=${day.date}`} className="dash-day" data-today={day.date === today || undefined}
                  title={`${day.day} ${monthName}: ${day.done} completed${day.open ? `, ${day.open} still open` : ''}`}
                  aria-label={`${day.day} ${monthName}: ${day.done} completed, ${day.open} still open`}>
                  <span className="dash-day-track">
                    <span className="dash-day-bar" style={{ height: `${day.total ? Math.max(6, (day.total / dayMax) * 100) : 0}%` }}>
                      {day.open > 0 && <i style={{ flex: day.open, background: 'var(--chart-1)' }} />}
                      {day.done > 0 && <i style={{ flex: day.done, background: 'var(--chart-good)' }} />}
                    </span>
                  </span>
                  <span className="dash-day-num">{day.day}</span>
                </Link>
              ))}
            </div>
          </div>
          <div className="dash-legend">
            <span><i style={{ background: 'var(--chart-good)' }} />Completed</span>
            <span><i style={{ background: 'var(--chart-1)' }} />Still open</span>
            <span className="dash-legend-note">Select a day to open its work</span>
          </div>
        </section>

        <section className="card dash-panel" aria-labelledby="dash-queue">
          <header className="dash-panel-head">
            <h2 id="dash-queue">Needs a decision</h2>
            <Link href="/attention">All queues →</Link>
          </header>
          {queue.length === 0 ? (
            <p className="dash-quiet">Nothing is waiting on you.</p>
          ) : (
            <ul className="dash-queue">
              {queue.slice(0, 7).map((item, index) => (
                <li key={index}>
                  <Link href={item.href}>
                    <span className="dash-queue-mark" data-tone={item.tone}>{item.count ?? '!'}</span>
                    <span className="dash-queue-text"><strong>{item.title}</strong><small>{item.detail}</small></span>
                    <span className="dash-queue-go" aria-hidden="true">›</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="dash-row">
        <section className="card dash-panel" aria-labelledby="dash-money">
          <header className="dash-panel-head">
            <h2 id="dash-money">Where the fares went</h2>
            <span>{kes(pl.netRevenue)} in fares</span>
          </header>
          {pl.netRevenue <= 0 && pl.costs <= 0 ? (
            <p className="dash-quiet">No fares or costs are recorded for this month.</p>
          ) : (
            <>
              <div className="dash-stack" role="img" aria-label="Fares split between recorded costs and what is left">
                {costs.map((cost) => <i key={cost.label} style={{ width: `${(cost.value / barTotal) * 100}%`, background: cost.color }} title={`${cost.label}: ${kes(cost.value)}`} />)}
                {profit > 0 && <i style={{ width: `${(profit / barTotal) * 100}%`, background: 'var(--chart-good)' }} title={`Left over: ${kes(profit)}`} />}
              </div>
              <ul className="dash-lines">
                {costs.map((cost) => (
                  <li key={cost.label}>
                    <Link href={cost.href}><i style={{ background: cost.color }} /><span>{cost.label}</span><b>{kes(cost.value)}</b><em>{share(cost.value)}</em></Link>
                  </li>
                ))}
                <li className="dash-lines-total">
                  <div><i style={{ background: pl.net < 0 ? 'var(--chart-bad)' : 'var(--chart-good)' }} /><span>{pl.net < 0 ? 'Shortfall' : 'Left after recorded costs'}</span><b style={{ color: pl.net < 0 ? 'var(--danger)' : undefined }}>{kes(pl.net)}</b><em>{share(pl.net)}</em></div>
                </li>
              </ul>
              {!pl.costsComplete && pl.revenue > 0 && (
                <p className="dash-note">No wages are recorded for {monthName}, so the amount left is before wages. <Link href="/expenses">Record wages →</Link></p>
              )}
            </>
          )}
        </section>

        <section className="card dash-panel" aria-labelledby="dash-aging">
          <header className="dash-panel-head">
            <h2 id="dash-aging">Money owed to you</h2>
            <span>All invoices · as of today</span>
          </header>
          {outstanding <= 0 ? (
            <p className="dash-quiet">{invoices.length ? 'Every invoice is settled.' : 'No invoices have been raised yet.'}</p>
          ) : (
            <>
              <ul className="dash-aging">
                {aging.map((bucket, index) => (
                  <li key={bucket.key}>
                    <span>{bucket.label}</span>
                    <span className="dash-aging-bar"><i style={{ width: `${bucket.amount > 0 ? Math.max(2, (bucket.amount / agingMax) * 100) : 0}%`, background: AGING_COLORS[index] }} /></span>
                    <b>{kes(bucket.amount)}</b>
                    <em>{bucket.count || '—'}</em>
                  </li>
                ))}
              </ul>
              <ul className="dash-debtors">
                {owing.slice(0, 3).map((row) => (
                  <li key={row.contractorId ?? 'direct'}>
                    <Link href={row.contractorId ? `/suppliers?c=${row.contractorId}` : '/receivables'}>
                      <span><strong>{row.name}</strong><small>{row.oldestDaysLate > 0 ? `${kes(row.overdue)} overdue, up to ${row.oldestDaysLate} days late` : `${plural(row.invoices, 'invoice')}, none overdue`}</small></span>
                      <b>{kes(row.outstanding)}</b>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>

      <div className="dash-row">
        <section className="card dash-panel" aria-labelledby="dash-suppliers">
          <header className="dash-panel-head">
            <h2 id="dash-suppliers">Revenue by supplier</h2>
            <Link href="/suppliers">Suppliers →</Link>
          </header>
          <RankList rows={bySupplier} total={pl.revenue} empty="No completed trips this month." color="var(--chart-1)" />
        </section>

        <section className="card dash-panel" aria-labelledby="dash-fleet">
          <header className="dash-panel-head">
            <h2 id="dash-fleet">Revenue by vehicle</h2>
            <Link href="/payback">Payback →</Link>
          </header>
          <RankList rows={byVehicle} total={pl.revenue} empty="No completed trips are tagged to a vehicle this month." color="var(--chart-7)" />
          {untagged > 0 && (
            <p className="dash-note">{plural(untagged, 'completed trip')} {untagged === 1 ? 'has' : 'have'} no vehicle, so {untagged === 1 ? 'it is' : 'they are'} missing from this list. <Link href="/trips">Tag trips →</Link></p>
          )}
        </section>
      </div>

      <QuickActions />
    </div>
  )
}

type Ranked = { key: string; label: string; revenue: number; trips: number }

// Group earned trips, largest revenue first.
function rank(trips: Trip[], keyOf: (trip: Trip) => string, labelOf: (key: string) => string): Ranked[] {
  const groups = new Map<string, Ranked>()
  for (const trip of trips) {
    const key = keyOf(trip)
    const group = groups.get(key) ?? { key, label: labelOf(key), revenue: 0, trips: 0 }
    group.revenue += Number(trip.amount) || 0
    group.trips++
    groups.set(key, group)
  }
  return Array.from(groups.values()).sort((a, b) => b.revenue - a.revenue)
}

function RankList({ rows, total, empty, color }: { rows: Ranked[]; total: number; empty: string; color: string }) {
  if (rows.length === 0) return <p className="dash-quiet">{empty}</p>
  const max = Math.max(1, rows[0].revenue)
  return (
    <ul className="dash-rank">
      {rows.slice(0, 6).map((row) => (
        <li key={row.key} title={`${plural(row.trips, 'trip')} · ${total > 0 ? Math.round((row.revenue / total) * 100) : 0}% of revenue`}>
          <span>{row.label}</span>
          <span className="dash-rank-bar"><i style={{ width: `${Math.max(2, (row.revenue / max) * 100)}%`, background: color }} /></span>
          <b>{kes(row.revenue)}</b>
          <em>{plural(row.trips, 'trip')}</em>
        </li>
      ))}
    </ul>
  )
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}
