import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/ui'
import MonthNav from '@/components/MonthNav'
import { requireProfile, canSeeFinance } from '@/lib/auth'
import { listTrips, listFuel, listExpenses, listServices, listDrivers, listVehicles, listOrganizations, listContractors } from '@/lib/db'
import { monthRange, MONTH_NAMES } from '@/lib/format'
import { stickyPeriod } from '@/lib/period'
import type { Trip, FuelEntry, Expense } from '@/lib/types'
import InsightsView from './InsightsView'

export const dynamic = 'force-dynamic'

const amt = (t: Trip) => Number(t.amount) || 0

export default async function InsightsPage({
  searchParams,
}: { searchParams: Promise<{ y?: string; m?: string }> }) {
  const profile = await requireProfile()
  if (!canSeeFinance(profile.role)) redirect('/trips')

  const sp = await searchParams
  const { year, month } = await stickyPeriod(sp)
  const { start, end } = monthRange(year, month)
  const winStart = monthRange(year, month - 5).start

  const [winTrips, winFuel, winExp, winSvc, drivers, vehicles, organizations, contractors] = await Promise.all([
    listTrips(winStart, end), listFuel(winStart, end), listExpenses(winStart, end), listServices(),
    listDrivers(), listVehicles(), listOrganizations(), listContractors(),
  ])

  const inMonth = (d: string) => d >= start && d <= end
  const trips = winTrips.filter((t) => inMonth(t.trip_date))
  const fuel = winFuel.filter((f) => inMonth(f.fuel_date))
  const exp = winExp.filter((e) => inMonth(e.expense_date))
  const svc = winSvc.filter((s) => inMonth(s.service_date))

  const orgName = (id: string | null) => organizations.find((o) => o.id === id)?.name ?? 'Direct / none'
  const conName = (id: string | null) => contractors.find((c) => c.id === id)?.name ?? '—'
  const driverName = (id: string | null) => drivers.find((d) => d.id === id)?.name ?? 'Unassigned'
  const plate = (id: string | null) => vehicles.find((v) => v.id === id)?.plate ?? 'Unassigned'

  const sum = <T,>(a: T[], f: (x: T) => number) => a.reduce((s, x) => s + f(x), 0)

  // ---- headline P&L ----
  const revenue = sum(trips, amt)
  const fuelTotal = sum(fuel, (f) => Number(f.amount) || 0)
  const expTotal = sum(exp, (e) => Number(e.amount) || 0)
  const svcTotal = sum(svc, (s) => Number(s.cost) || 0)
  const net = revenue - fuelTotal - expTotal - svcTotal
  const prev = monthRange(year, month - 1)
  const prevRev = sum(winTrips.filter((t) => t.trip_date >= prev.start && t.trip_date <= prev.end), amt)

  // ---- 6-month trend (revenue + net) ----
  const trend: { label: string; revenue: number; net: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const r = monthRange(year, month - i)
    const mt = winTrips.filter((t) => t.trip_date >= r.start && t.trip_date <= r.end)
    const mf = winFuel.filter((f) => f.fuel_date >= r.start && f.fuel_date <= r.end)
    const me = winExp.filter((e) => e.expense_date >= r.start && e.expense_date <= r.end)
    const ms = winSvc.filter((s) => s.service_date >= r.start && s.service_date <= r.end)
    const rev = sum(mt, amt)
    const d = new Date(r.start + 'T12:00:00Z')
    trend.push({ label: `${MONTH_NAMES[d.getUTCMonth()].slice(0, 3)} ${String(d.getUTCFullYear()).slice(2)}`, revenue: rev, net: rev - sum(mf, (x) => Number(x.amount) || 0) - sum(me, (x) => Number(x.amount) || 0) - sum(ms, (x) => Number(x.cost) || 0) })
  }

  // ---- revenue leaderboards ----
  function revGroup(keyOf: (t: Trip) => string, labelOf: (k: string) => string) {
    const m = new Map<string, { label: string; revenue: number; trips: number }>()
    for (const t of trips) {
      const k = keyOf(t)
      const g = m.get(k) ?? { label: labelOf(k), revenue: 0, trips: 0 }
      g.revenue += amt(t); g.trips++; m.set(k, g)
    }
    return [...m.values()]
  }
  const byClient = revGroup((t) => t.organization_id ?? 'none', orgName)
  const byRoute = revGroup((t) => `${(t.pickup || '?').trim()} → ${(t.dropoff || '?').trim()}`, (k) => k)
  const byContractor = revGroup((t) => t.contractor_id ?? 'none', conName)
  const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const dowMap = DOW.map((day) => ({ label: day, revenue: 0, trips: 0 }))
  for (const t of trips) { const i = (new Date(t.trip_date + 'T12:00:00Z').getUTCDay() + 6) % 7; dowMap[i].revenue += amt(t); dowMap[i].trips++ }

  // ---- per-vehicle profit + fuel efficiency ----
  const fleetFuelPct = revenue > 0 ? fuelTotal / revenue : 0
  const perVehicle = vehicles.map((v) => {
    const vt = trips.filter((t) => t.vehicle_id === v.id)
    const vf = fuel.filter((f) => f.vehicle_id === v.id)
    const ve = exp.filter((e) => e.vehicle_id === v.id)
    const vs = svc.filter((s) => s.vehicle_id === v.id)
    const rev = sum(vt, amt)
    const fu = sum(vf, (x) => Number(x.amount) || 0)
    const vex = sum(ve, (x) => Number(x.amount) || 0)
    const vsc = sum(vs, (x) => Number(x.cost) || 0)
    const fuelPct = rev > 0 ? fu / rev : 0
    return {
      label: v.plate, trips: vt.length, revenue: rev, fuel: fu,
      contribution: rev - fu - vex - vsc,
      fuelPct: Math.round(fuelPct * 100),
      flag: rev > 0 && fleetFuelPct > 0 && fuelPct > fleetFuelPct * 1.25, // burns >25% more fuel per shilling than fleet avg
    }
  }).filter((v) => v.trips > 0)

  // ---- per-driver ----
  const perDriver = drivers.map((d) => {
    const dt = trips.filter((t) => t.driver_id === d.id)
    return { label: d.name, trips: dt.length, revenue: sum(dt, amt) }
  }).filter((d) => d.trips > 0)

  return (
    <>
      <PageHeader title="Business insights" subtitle="Where the money comes from, which vehicles earn, and where it leaks" action={<MonthNav year={year} month={month} />} />
      <InsightsView
        period={`${MONTH_NAMES[month]} ${year}`}
        pl={{ revenue, fuel: fuelTotal, expenses: expTotal, net, prevRev, fuelPct: Math.round(fleetFuelPct * 100) }}
        trend={trend}
        byClient={byClient} byRoute={byRoute} byContractor={byContractor} dow={dowMap}
        perVehicle={perVehicle} perDriver={perDriver}
      />
    </>
  )
}
