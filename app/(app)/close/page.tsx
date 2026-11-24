import Link from 'next/link'
import { redirect } from 'next/navigation'
import MonthNav from '@/components/MonthNav'
import { PageHeader, KpiCard } from '@/components/ui'
import { requireProfile, canSeeFinance } from '@/lib/auth'
import { listDrivers, listExpenses, listFuel, listInvoices, listServices, listTrips, listVehicles } from '@/lib/db'
import { monthCloseChecks, closeSummary, type CloseCheck } from '@/lib/month-close'
import { monthlyPL, profitHeadline } from '@/lib/finance'
import { kes, monthRange, MONTH_NAMES } from '@/lib/format'
import { nairobiToday } from '@/lib/nairobi-date'
import { stickyPeriod } from '@/lib/period'
import './close.css'

export const dynamic = 'force-dynamic'

export default async function MonthClosePage({ searchParams }: { searchParams: Promise<{ y?: string; m?: string }> }) {
  const profile = await requireProfile()
  if (!canSeeFinance(profile.role)) redirect('/workday')

  const { year, month } = await stickyPeriod(await searchParams)
  const { start, end } = monthRange(year, month)
  const today = nairobiToday()
  const monthName = `${MONTH_NAMES[month]} ${year}`

  const [trips, fuel, expenses, services, drivers, vehicles, invoices] = await Promise.all([
    listTrips(start, end), listFuel(start, end), listExpenses(start, end), listServices(), listDrivers(), listVehicles(), listInvoices(),
  ])
  const checks = monthCloseChecks({ trips, fuel, expenses, drivers, invoices, today })
  const summary = closeSummary(checks, today, end)
  const pl = monthlyPL({ trips, fuel, expenses, services: services.filter((service) => service.service_date >= start && service.service_date <= end), vehicles })
  const headline = profitHeadline(pl)

  const todo = checks.filter((check) => check.state !== 'ok').sort((a, b) => (a.state === b.state ? 0 : a.state === 'bad' ? -1 : 1))
  const done = checks.filter((check) => check.state === 'ok')

  const verdict = summary.ready
    ? summary.monthOver
      ? { tone: 'ok', title: `${monthName} is ready to rely on`, text: 'Every check below passes. The figures can go in a report or to your accountant.' }
      : { tone: 'ok', title: 'Nothing is missing so far', text: `${monthName} is still running, so the figures can still change.` }
    : {
        tone: summary.bad ? 'bad' : 'warn',
        title: summary.bad
          ? `${summary.bad} ${summary.bad === 1 ? 'thing' : 'things'} to fix before relying on ${monthName}`
          : `${summary.warn} ${summary.warn === 1 ? 'thing' : 'things'} to look at in ${monthName}`,
        text: `Profit is only as complete as the records behind it.${summary.monthOver ? '' : ' The month is still running, so some of this may simply not have happened yet.'}`,
      }

  return (
    <div className="close-page">
      <PageHeader title="Month close" subtitle="Is this month's profit complete enough to trust?" action={<MonthNav year={year} month={month} />} />

      <section className="card close-verdict" data-tone={verdict.tone} aria-live="polite">
        <span className="close-mark" aria-hidden="true">{verdict.tone === 'ok' ? '✓' : summary.bad ? '!' : '·'}</span>
        <div>
          <h2>{verdict.title}</h2>
          <p>{verdict.text}</p>
        </div>
      </section>

      <div className="grid-stats close-kpis">
        <KpiCard label="Earned revenue" value={kes(pl.revenue)} sub={pl.express > 0 ? `${kes(pl.netRevenue)} fares + ${kes(pl.express)} tolls` : 'Completed trips only'} />
        <KpiCard label="Costs recorded" value={kes(pl.costs)} sub={pl.loggedCosts.length ? pl.loggedCosts.join(', ') : 'None yet'} />
        <KpiCard label={headline.label} value={kes(pl.net)} tone={pl.net < 0 ? 'var(--danger)' : summary.ready ? 'var(--ok)' : 'var(--gold)'} sub={pl.netRevenue > 0 ? `${(pl.margin * 100).toFixed(1)}% of fares${summary.ready ? '' : ', not final'}` : headline.hint} />
      </div>

      {todo.length > 0 && (
        <section aria-labelledby="close-todo">
          <h2 id="close-todo" className="close-heading">To do</h2>
          <ul className="close-list">{todo.map((check) => <CheckRow key={check.key} check={check} />)}</ul>
        </section>
      )}
      {done.length > 0 && (
        <section aria-labelledby="close-done">
          <h2 id="close-done" className="close-heading">Done</h2>
          <ul className="close-list">{done.map((check) => <CheckRow key={check.key} check={check} />)}</ul>
        </section>
      )}
    </div>
  )
}

function CheckRow({ check }: { check: CloseCheck }) {
  return (
    <li className="card close-row" data-state={check.state}>
      <span className="close-dot" aria-hidden="true" />
      <div className="close-text">
        <strong>{check.title}<span className="workspace-sr-only"> ({check.state === 'ok' ? 'passed' : check.state === 'bad' ? 'needs fixing' : 'worth a look'})</span></strong>
        <p>{check.detail}</p>
      </div>
      {check.state !== 'ok' && <Link href={check.href} className="btn-ghost close-fix">{check.action}</Link>}
    </li>
  )
}
