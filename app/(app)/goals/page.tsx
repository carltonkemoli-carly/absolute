import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/ui'
import QuarterNav from '@/components/QuarterNav'
import { requireProfile, canSeeFinance } from '@/lib/auth'
import { listTrips, listFuel, listServices, listExpenses, listTargets, listVehicles } from '@/lib/db'
import { quarterRange, resolveQuarter, periodKey, quarterLabel } from '@/lib/format'
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

  const revenue = trips.reduce((a, t) => a + Number(t.amount), 0)
  const fuelCost = fuel.reduce((a, f) => a + Number(f.amount), 0)
  const serviceCost = services
    .filter((s) => s.service_date >= start && s.service_date <= end)
    .reduce((a, s) => a + Number(s.cost), 0)

  // Vehicle hire = monthly fees (for months elapsed in the quarter) + casual trip hire
  const now = new Date()
  const monthsElapsed = [0, 1, 2].filter((i) => new Date(year, (quarter - 1) * 3 + i, 1) <= now).length
  const monthlyHire = vehicles.filter((v) => v.ownership === 'monthly_hire').reduce((a, v) => a + Number(v.monthly_fee), 0)
  const tripHire = trips.reduce((a, t) => a + Number(t.hire_cost || 0), 0)
  const hireCost = monthlyHire * monthsElapsed + tripHire

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
      />
    </>
  )
}
