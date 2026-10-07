import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/ui'
import QuarterNav from '@/components/QuarterNav'
import { requireProfile, canSeeFinance } from '@/lib/auth'
import { listTrips, listFuel, listServices, listExpenses, listTargets, listVehicles } from '@/lib/db'
import { quarterRange, resolveQuarter, periodKey, quarterLabel } from '@/lib/format'
import { periodPL, profitHeadline } from '@/lib/finance'
import { COST_CATEGORIES } from '@/lib/types'
import GoalsView, { type CostLine } from './GoalsView'

export const dynamic = 'force-dynamic'

export default async function GoalsPage({
  searchParams,
}: { searchParams: Promise<{ y?: string; q?: string }> }) {
  const profile = await requireProfile()
  if (!canSeeFinance(profile.role)) redirect('/trips')

  const sp = await searchParams
  const { year, quarter } = resolveQuarter(sp.y, sp.q)
  const { start, end } = quarterRange(year, quarter)
  const period = periodKey(year, quarter)

  const [trips, fuel, services, expenses, targets, vehicles] = await Promise.all([
    listTrips(start, end), listFuel(start, end), listServices(), listExpenses(start, end), listTargets(period), listVehicles(),
  ])

  // Canonical P&L, costed month by month across the quarter so a monthly hire fee
  // is counted once per month — same engine as the dashboard and Reports.
  const now = new Date()
  const months = [0, 1, 2]
    .map((i) => new Date(year, (quarter - 1) * 3 + i, 1))
    .filter((d) => d <= now)
    .map((d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  const pl = periodPL({ trips, fuel, expenses, services, vehicles }, months)
  const headline = profitHeadline(pl)

  const revenue = pl.revenue
  const fuelCost = pl.fuel
  const serviceCost = pl.servicing
  const hireCost = pl.hire

  const expByCat = new Map<string, number>()
  for (const e of expenses) expByCat.set(e.category, (expByCat.get(e.category) ?? 0) + Number(e.amount))

  const capByCat = new Map<string, number>()
  let revenueTarget = 0
  let profitTarget = 0
  for (const t of targets) {
    if (t.kind === 'revenue') revenueTarget = Number(t.amount)
    else if (t.kind === 'profit') profitTarget = Number(t.amount)
    else if (t.kind === 'spend_cap' && t.category) capByCat.set(t.category, Number(t.amount))
  }

  const amountFor = (cat: string): number =>
    cat === 'Fuel' ? fuelCost
      : cat === 'Servicing' ? serviceCost
        : cat === 'Vehicle Hire' ? hireCost
          : (expByCat.get(cat) ?? 0)

  // Include any category that has spend or a cap set
  const costs: CostLine[] = COST_CATEGORIES
    .map((cat) => ({ category: cat, amount: amountFor(cat), cap: capByCat.has(cat) ? (capByCat.get(cat) as number) : null }))
    .filter((c) => c.amount > 0 || c.cap !== null)

  return (
    <>
      <PageHeader title="Targets & P&L" subtitle={`How money moved in ${quarterLabel(year, quarter)} — and how you're tracking to goal`} action={<QuarterNav year={year} quarter={quarter} />} />
      <GoalsView
        period={period}
        revenue={revenue}
        costs={costs}
        revenueTarget={revenueTarget}
        profitTarget={profitTarget}
        profitLabel={headline.label}
        profitHint={headline.hint}
        costsComplete={pl.costsComplete}
      />
    </>
  )
}
