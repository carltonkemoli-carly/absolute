import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/ui'
import MonthNav from '@/components/MonthNav'
import { requireProfile, canSeeFinance } from '@/lib/auth'
import { listTrips, listDrivers, listVehicles, listOrganizations } from '@/lib/db'
import { monthRange, MONTH_NAMES } from '@/lib/format'
import { stickyPeriod } from '@/lib/period'
import type { Trip } from '@/lib/types'
import ExpresswayInsights from './ExpresswayInsights'

export const dynamic = 'force-dynamic'

const ex = (t: Trip) => Number(t.express_charges) || 0
const isExpress = (t: Trip) => ex(t) > 0

export default async function ExpresswayPage({
  searchParams,
}: { searchParams: Promise<{ y?: string; m?: string }> }) {
  const profile = await requireProfile()
  if (!canSeeFinance(profile.role)) redirect('/trips')

  const sp = await searchParams
  const { year, month } = await stickyPeriod(sp)
  const { start, end } = monthRange(year, month)

  // 6-month window (for the trend) ending at the selected month
  const windowStart = monthRange(year, month - 5).start
  const [windowTrips, drivers, vehicles, organizations] = await Promise.all([
    listTrips(windowStart, end), listDrivers(), listVehicles(), listOrganizations(),
  ])

  const driverName = (id: string | null) => drivers.find((d) => d.id === id)?.name ?? 'Unassigned'
  const plate = (id: string | null) => vehicles.find((v) => v.id === id)?.plate ?? 'Unassigned'
  const orgName = (id: string | null) => organizations.find((o) => o.id === id)?.name ?? '—'

  const monthTrips = windowTrips.filter((t) => t.trip_date >= start && t.trip_date <= end)
  const expressTrips = monthTrips.filter(isExpress)

  // ---- month-over-month ----
  const prev = monthRange(year, month - 1)
  const prevExpress = windowTrips.filter((t) => t.trip_date >= prev.start && t.trip_date <= prev.end && isExpress(t))
  const totalToll = sum(expressTrips, ex)
  const prevToll = sum(prevExpress, ex)

  // ---- 6-month trend ----
  const trend: { label: string; toll: number; count: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const r = monthRange(year, month - i)
    const mt = windowTrips.filter((t) => t.trip_date >= r.start && t.trip_date <= r.end && isExpress(t))
    const d = new Date(r.start + 'T12:00:00Z')
    trend.push({ label: `${MONTH_NAMES[d.getUTCMonth()].slice(0, 3)} ${String(d.getUTCFullYear()).slice(2)}`, toll: sum(mt, ex), count: mt.length })
  }

  // ---- group helper: id/key → {label,count,toll, totalTrips} ----
  function group<T>(items: Trip[], keyOf: (t: Trip) => string, labelOf: (k: string) => string, allForShare?: Trip[]) {
    const m = new Map<string, { key: string; label: string; count: number; toll: number; total: number }>()
    for (const t of items) {
      const k = keyOf(t)
      const g = m.get(k) ?? { key: k, label: labelOf(k), count: 0, toll: 0, total: 0 }
      g.count++; g.toll += ex(t); m.set(k, g)
    }
    if (allForShare) for (const t of allForShare) { const k = keyOf(t); const g = m.get(k); if (g) g.total++ }
    return [...m.values()]
  }

  const byDriver = group(expressTrips, (t) => t.driver_id ?? 'none', driverName, monthTrips)
  const byVehicle = group(expressTrips, (t) => t.vehicle_id ?? 'none', plate, monthTrips)
  const byOrg = group(expressTrips, (t) => t.organization_id ?? 'none', orgName)
  const byRoute = group(expressTrips, (t) => `${(t.pickup || '?').trim()} → ${(t.dropoff || '?').trim()}`, (k) => k)

  // ---- day of week (Mon..Sun) ----
  const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const dow = DOW.map((day) => ({ day, count: 0, toll: 0 }))
  for (const t of expressTrips) {
    const idx = (new Date(t.trip_date + 'T12:00:00Z').getUTCDay() + 6) % 7 // Mon=0
    dow[idx].count++; dow[idx].toll += ex(t)
  }

  // ---- direction (to/from JKIA) ----
  const dir = { to: { count: 0, toll: 0 }, from: { count: 0, toll: 0 }, other: { count: 0, toll: 0 } }
  for (const t of expressTrips) {
    const to = /jkia/i.test(t.dropoff || ''), from = /jkia/i.test(t.pickup || '')
    const bucket = to ? dir.to : from ? dir.from : dir.other
    bucket.count++; bucket.toll += ex(t)
  }

  // ---- toll bands (entry/exit station proxy) ----
  const bandMap = new Map<number, number>()
  for (const t of expressTrips) bandMap.set(ex(t), (bandMap.get(ex(t)) ?? 0) + 1)
  const bands = [...bandMap.entries()].map(([amount, count]) => ({ amount, count })).sort((a, b) => a.amount - b.amount)

  return (
    <>
      <PageHeader
        title="Expressway insights"
        subtitle="Who uses the expressway, on which routes, and how the toll bill is trending"
        action={<MonthNav year={year} month={month} />}
      />
      <ExpresswayInsights
        period={`${MONTH_NAMES[month]} ${year}`}
        stats={{
          totalTrips: monthTrips.length,
          expressCount: expressTrips.length,
          totalToll, prevToll,
          avgToll: expressTrips.length ? Math.round(totalToll / expressTrips.length) : 0,
        }}
        trend={trend}
        byDriver={byDriver}
        byVehicle={byVehicle}
        byOrg={byOrg}
        byRoute={byRoute}
        dow={dow}
        direction={dir}
        bands={bands}
      />
    </>
  )
}

function sum(arr: Trip[], f: (t: Trip) => number): number {
  return arr.reduce((s, t) => s + f(t), 0)
}
