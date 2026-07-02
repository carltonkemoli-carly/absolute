import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/ui'
import { requireProfile, canSeeFinance } from '@/lib/auth'
import { listTrips, listFuel, listServices, listExpenses, latestTripMonth } from '@/lib/db'
import { monthRange, MONTH_NAMES, isoDate } from '@/lib/format'
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

  const [trips, fuel, services, expenses] = await Promise.all([
    listTrips(start, end), listFuel(start, end), listServices(), listExpenses(start, end),
  ])

  const months: MonthRow[] = []
  for (let i = MONTHS_BACK - 1; i >= 0; i--) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1)
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const mt = trips.filter((t) => t.trip_date.slice(0, 7) === ym)
    const mf = fuel.filter((f) => f.fuel_date.slice(0, 7) === ym)
    const ms = services.filter((s) => s.service_date.slice(0, 7) === ym)
    const me = expenses.filter((e) => e.expense_date.slice(0, 7) === ym)
    const revenue = mt.reduce((a, t) => a + Number(t.amount), 0)
    const fuelCost = mf.reduce((a, f) => a + Number(f.amount), 0)
    const serviceCost = ms.reduce((a, s) => a + Number(s.cost), 0)
    const expenseCost = me.reduce((a, e) => a + Number(e.amount), 0)
    const express = mt.reduce((a, t) => a + Number(t.express_charges), 0)
    const profit = revenue - fuelCost - serviceCost - expenseCost
    months.push({
      ym,
      label: `${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${String(d.getFullYear()).slice(2)}`,
      revenue,
      fuel: fuelCost,
      service: serviceCost,
      expenses: expenseCost,
      express,
      profit,
      margin: revenue > 0 ? profit / revenue : 0,
      index: revenue > 0 ? fuelCost / revenue : 0,
      trips: mt.length,
    })
  }

  return (
    <>
      <PageHeader title="Reports & Trends" subtitle="How money is moving — last 6 months of activity" />
      <ReportsView months={months} />
    </>
  )
}
