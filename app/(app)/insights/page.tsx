import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/ui'
import MonthNav from '@/components/MonthNav'
import PrintButton from '@/components/PrintButton'
import { requireProfile, canSeeFinance } from '@/lib/auth'
import { listTrips, listFuel, listExpenses, listServices, listDrivers, listVehicles, listOrganizations, listContractors, listRoutes } from '@/lib/db'
import { monthRange, MONTH_NAMES } from '@/lib/format'
import { stickyPeriod } from '@/lib/period'
import type { Trip, FuelEntry, Expense, Route } from '@/lib/types'
import InsightsView from './InsightsView'
import PricingCheck from './PricingCheck'

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

  const [winTrips, winFuel, winExp, winSvc, drivers, vehicles, organizations, contractors, routes] = await Promise.all([
    listTrips(winStart, end), listFuel(winStart, end), listExpenses(winStart, end), listServices(),
    listDrivers(), listVehicles(), listOrganizations(), listContractors(), listRoutes(),
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
  const monthlyHireFees = sum(vehicles.filter((v) => v.ownership === 'monthly_hire'), (v) => Number(v.monthly_fee) || 0)
  const hireOf = (ts: typeof trips) => monthlyHireFees + sum(ts, (t) => Number(t.hire_cost) || 0)

  const revenue = sum(trips, amt)
  const fuelTotal = sum(fuel, (f) => Number(f.amount) || 0)
  const expTotal = sum(exp, (e) => Number(e.amount) || 0)
  const svcTotal = sum(svc, (s) => Number(s.cost) || 0)
  const hireTotal = hireOf(trips)
  const net = revenue - fuelTotal - expTotal - svcTotal - hireTotal
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
    const mnet = rev - sum(mf, (x) => Number(x.amount) || 0) - sum(me, (x) => Number(x.amount) || 0) - sum(ms, (x) => Number(x.cost) || 0) - hireOf(mt)
    trend.push({ label: `${MONTH_NAMES[d.getUTCMonth()].slice(0, 3)} ${String(d.getUTCFullYear()).slice(2)}`, revenue: rev, net: mnet })
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
    const vhire = (v.ownership === 'monthly_hire' ? Number(v.monthly_fee) || 0 : 0) + sum(vt, (t) => Number(t.hire_cost) || 0)
    const fuelPct = rev > 0 ? fu / rev : 0
    return {
      label: v.plate, trips: vt.length, revenue: rev, fuel: fu,
      contribution: rev - fu - vex - vsc - vhire,
      fuelPct: Math.round(fuelPct * 100),
      flag: rev > 0 && fleetFuelPct > 0 && fuelPct > fleetFuelPct * 1.25, // burns >25% more fuel per shilling than fleet avg
    }
  }).filter((v) => v.trips > 0)

  // ---- per-driver ----
  const perDriver = drivers.map((d) => {
    const dt = trips.filter((t) => t.driver_id === d.id)
    return { label: d.name, trips: dt.length, revenue: sum(dt, amt) }
  }).filter((d) => d.trips > 0)

  // ---- rate-card pricing check ----
  // Compare each trip's net fare (amount − expressway toll) to the JKIA rate card
  // for that area + vehicle class. Surfaces under-charging and pricing gaps.
  const norm = (s: string | null) => (s ?? '').toUpperCase().replace(/\s+/g, ' ').trim()
  const cardByArea = new Map<string, { route: Route; areaLabel: string }>()
  for (const r of routes) {
    const p = norm(r.pickup), d = norm(r.dropoff)
    const area = p === 'JKIA' ? d : d === 'JKIA' ? p : d
    const areaLabel = norm(r.pickup) === 'JKIA' ? r.dropoff : r.pickup
    if (area && area !== 'JKIA' && !cardByArea.has(area)) cardByArea.set(area, { route: r, areaLabel })
  }
  const classPrice = (r: Route, vtype: string | null) => {
    const t = (vtype ?? '').toLowerCase()
    const p = t.includes('van') ? r.price_van : t.includes('bus') ? r.price_bus : t.includes('wagon') ? r.price_wagon : r.price_saloon
    return Number(p) || Number(r.price_saloon) || 0
  }
  const vType = (id: string | null) => vehicles.find((v) => v.id === id)?.vehicle_type ?? null
  const priceAgg = new Map<string, { route: string; count: number; actual: number; expected: number }>()
  const unmatched = new Map<string, { area: string; trips: number; revenue: number }>()
  let matched = 0, underRecovery = 0, overCharge = 0
  for (const t of trips) {
    const P = norm(t.pickup), D = norm(t.dropoff)
    const area = P === 'JKIA' ? D : D === 'JKIA' ? P : ''
    if (!area) continue // not a JKIA airport trip → card doesn't apply
    const net = (Number(t.amount) || 0) - (Number(t.express_charges) || 0)
    const hit = cardByArea.get(area)
    if (!hit) {
      const u = unmatched.get(area) ?? { area, trips: 0, revenue: 0 }
      u.trips++; u.revenue += Number(t.amount) || 0; unmatched.set(area, u)
      continue
    }
    const expected = classPrice(hit.route, vType(t.vehicle_id))
    if (expected <= 0) continue
    matched++
    if (net < expected) underRecovery += expected - net
    else overCharge += net - expected
    const g = priceAgg.get(area) ?? { route: `JKIA ↔ ${hit.areaLabel}`, count: 0, actual: 0, expected: 0 }
    g.count++; g.actual += net; g.expected += expected; priceAgg.set(area, g)
  }
  const priceRows = [...priceAgg.values()]
    .map((g) => ({ route: g.route, trips: g.count, card: g.expected / g.count, actual: g.actual / g.count, deltaPct: g.expected > 0 ? (g.actual / g.expected - 1) * 100 : 0, totalVar: g.actual - g.expected }))
    .sort((a, b) => a.totalVar - b.totalVar)
  const unmatchedTop = [...unmatched.values()].sort((a, b) => b.trips - a.trips).slice(0, 8)

  return (
    <>
      <PageHeader title="Business insights" subtitle="Where the money comes from, which vehicles earn, and where it leaks" action={<div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><MonthNav year={year} month={month} /><PrintButton /></div>} />
      <InsightsView
        period={`${MONTH_NAMES[month]} ${year}`}
        pl={{ revenue, fuel: fuelTotal, expenses: expTotal, net, prevRev, fuelPct: Math.round(fleetFuelPct * 100) }}
        trend={trend}
        byClient={byClient} byRoute={byRoute} byContractor={byContractor} dow={dowMap}
        perVehicle={perVehicle} perDriver={perDriver}
      />
      <div style={{ marginTop: 18 }}>
        <PricingCheck matched={matched} underRecovery={underRecovery} overCharge={overCharge} rows={priceRows} unmatched={unmatchedTop} />
      </div>
    </>
  )
}
