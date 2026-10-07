import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/ui'
import MonthNav from '@/components/MonthNav'
import PrintButton from '@/components/PrintButton'
import { requireProfile, canSeeFinance } from '@/lib/auth'
import { listTrips, listFuel, listExpenses, listServices, listDrivers, listVehicles, listOrganizations, listContractors, listRoutes } from '@/lib/db'
import { monthRange, MONTH_NAMES, isoDate } from '@/lib/format'
import { periodPL, profitHeadline } from '@/lib/finance'
import { stickyPeriod } from '@/lib/period'
import type { Trip, Route } from '@/lib/types'
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

  const orgName = (id: string | null) => organizations.find((o) => o.id === id)?.name ?? 'Direct / none'
  const conName = (id: string | null) => contractors.find((c) => c.id === id)?.name ?? '—'
  const driverName = (id: string | null) => drivers.find((d) => d.id === id)?.name ?? 'Unassigned'
  const plate = (id: string | null) => vehicles.find((v) => v.id === id)?.plate ?? 'Unassigned'

  const sum = <T,>(a: T[], f: (x: T) => number) => a.reduce((s, x) => s + f(x), 0)

  // ---- headline P&L (canonical — same numbers and wording as the dashboard) ----
  const ym = start.slice(0, 7)
  const pl = periodPL({ trips: winTrips, fuel: winFuel, expenses: winExp, services: winSvc, vehicles }, [ym])
  const headline = profitHeadline(pl)
  const revenue = pl.revenue
  const fuelTotal = pl.fuel

  // Comparing a month still in progress against a whole month always reads as a
  // crash. When the selected month is the current one, measure last month only up
  // to the same day, so it is like-for-like.
  const prev = monthRange(year, month - 1)
  const todayIso = isoDate(new Date())
  const partial = todayIso >= start && todayIso <= end
  const prevCutoff = partial ? prev.start.slice(0, 8) + todayIso.slice(8, 10) : prev.end
  const prevRev = sum(
    winTrips.filter((t) => t.trip_date >= prev.start && t.trip_date <= prevCutoff),
    amt,
  )
  const prevLabel = partial ? 'vs same point last month' : 'vs last month'

  // ---- 6-month trend (revenue + net) ----
  const trend: { label: string; revenue: number; net: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const r = monthRange(year, month - i)
    const mpl = periodPL({ trips: winTrips, fuel: winFuel, expenses: winExp, services: winSvc, vehicles }, [r.start.slice(0, 7)])
    const d = new Date(r.start + 'T12:00:00Z')
    trend.push({ label: `${MONTH_NAMES[d.getUTCMonth()].slice(0, 3)} ${String(d.getUTCFullYear()).slice(2)}`, revenue: mpl.revenue, net: mpl.net })
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

  // ---- per-vehicle & per-driver (REAL attribution only) ----
  function revGroupOf(items: Trip[], keyOf: (t: Trip) => string, labelOf: (k: string) => string) {
    const m = new Map<string, { label: string; revenue: number; trips: number }>()
    for (const t of items) {
      const k = keyOf(t)
      const g = m.get(k) ?? { label: labelOf(k), revenue: 0, trips: 0 }
      g.revenue += amt(t); g.trips++; m.set(k, g)
    }
    return [...m.values()]
  }
  const byVehicle = revGroupOf(trips.filter((t) => t.vehicle_id), (t) => t.vehicle_id as string, plate)
  const byDriver = revGroupOf(trips.filter((t) => t.driver_id), (t) => t.driver_id as string, driverName)
  const attrCoverage = trips.length ? trips.filter((t) => t.vehicle_id).length / trips.length : 0

  const fleetFuelPct = revenue > 0 ? fuelTotal / revenue : 0

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
        pl={{ revenue, fuel: fuelTotal, costs: pl.costs, net: pl.net, prevRev, prevLabel, fuelPct: Math.round(fleetFuelPct * 100), costsComplete: pl.costsComplete, profitLabel: headline.label, profitHint: headline.hint }}
        trend={trend}
        byClient={byClient} byRoute={byRoute} byContractor={byContractor} dow={dowMap}
        byVehicle={byVehicle} byDriver={byDriver} attrCoverage={attrCoverage}
      />
      <div style={{ marginTop: 18 }}>
        <PricingCheck matched={matched} underRecovery={underRecovery} overCharge={overCharge} rows={priceRows} unmatched={unmatchedTop} />
      </div>
    </>
  )
}
