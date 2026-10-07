import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/ui'
import { requireProfile, canSeeFinance } from '@/lib/auth'
import { listTrips, listFuel, listServices, listExpenses, listVehicles, latestTripMonth } from '@/lib/db'
import { monthRange, MONTH_NAMES, isoDate } from '@/lib/format'
import { periodPL, combinePL, type PL } from '@/lib/finance'
import ReportsView, { type MonthRow } from './ReportsView'

export const dynamic = 'force-dynamic'

const MONTHS_BACK = 6

export default async function ReportsPage() {
  const profile = await requireProfile()
  if (!canSeeFinance(profile.role)) redirect('/trips')

  // Anchor the window on the latest month that has data (not an empty current month).
  const latest = await latestTripMonth(isoDate(new Date()))
  const base = latest ? new Date(latest.year, latest.month, 1) : new Date()
  const first = new Date(base.getFullYear(), base.getMonth() - (MONTHS_BACK - 1), 1)
  const { start } = monthRange(first.getFullYear(), first.getMonth())
  const { end } = monthRange(base.getFullYear(), base.getMonth())

  const [trips, fuel, services, expenses, vehicles] = await Promise.all([
    listTrips(start, end), listFuel(start, end), listServices(), listExpenses(start, end), listVehicles(),
  ])
  const input = { trips, fuel, expenses, services, vehicles }

  // Every figure here comes from the canonical P&L — one per month, then combined
  // for the period headline, so Reports can never drift from the dashboard.
  const months: MonthRow[] = []
  const parts: PL[] = []
  for (let i = MONTHS_BACK - 1; i >= 0; i--) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1)
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const pl = periodPL(input, [ym])
    parts.push(pl)
    months.push({
      ym,
      label: `${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${String(d.getFullYear()).slice(2)}`,
      revenue: pl.revenue,
      fuel: pl.fuel,
      service: pl.servicing,
      expenses: pl.wages + pl.otherExpenses,
      express: pl.express,
      profit: pl.net,
      margin: pl.margin,
      index: pl.revenue > 0 ? pl.fuel / pl.revenue : 0,
      trips: trips.filter((t) => t.trip_date.slice(0, 7) === ym).length,
    })
  }
  const period = combinePL(parts)

  // Month-over-month, like-for-like. If the latest month is still running,
  // measure the one before it only up to the same day — otherwise a part month
  // always reads as a collapse.
  const todayIso = isoDate(new Date())
  const latestRow = months[months.length - 1]
  const previous = months[months.length - 2]
  const partial = latestRow ? todayIso.slice(0, 7) === latestRow.ym : false
  let delta: number | null = null
  if (latestRow && previous) {
    const cutoff = partial ? `${previous.ym}-${todayIso.slice(8, 10)}` : `${previous.ym}-31`
    const prevRev = trips
      .filter((t) => t.trip_date.slice(0, 7) === previous.ym && t.trip_date <= cutoff)
      .reduce((a, t) => a + Number(t.amount), 0)
    if (prevRev > 0) delta = ((latestRow.revenue - prevRev) / prevRev) * 100
  }

  return (
    <>
      <PageHeader title="Reports & Trends" subtitle="How money is moving — last 6 months of activity" />
      <ReportsView
        months={months}
        costsComplete={period.costsComplete}
        delta={delta}
        deltaLabel={partial ? 'vs same point last month' : 'vs prior month'}
      />
    </>
  )
}
