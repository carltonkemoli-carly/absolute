import Link from 'next/link'
import { PageHeader } from '@/components/ui'
import { requireProfile } from '@/lib/auth'
import { listTrips, listVehicles, listFuel, listOrganizations, listContractors, listDrivers } from '@/lib/db'
import { isoDate } from '@/lib/format'

export const dynamic = 'force-dynamic'

type Level = 'ok' | 'warn' | 'info'
interface Check { label: string; count: number; total: number; level: Level; detail: string; href: string }

export default async function DataHealthPage() {
  await requireProfile()
  const today = isoDate(new Date())

  const [trips, vehicles, fuel, orgs, contractors, drivers] = await Promise.all([
    listTrips('2000-01-01', '2100-01-01'), listVehicles(), listFuel('2000-01-01', '2100-01-01'),
    listOrganizations(), listContractors(), listDrivers(),
  ])

  const completed = trips.filter((t) => t.status === 'completed')
  const checks: Check[] = []
  const add = (label: string, bad: number, total: number, detail: string, href: string, infoOnly = false) =>
    checks.push({ label, count: bad, total, level: bad === 0 ? 'ok' : infoOnly ? 'info' : 'warn', detail, href })

  // Trips
  add('Trips missing a client name', trips.filter((t) => !t.client_name || t.client_name.trim() === '').length, trips.length, 'Every trip should name the passenger.', '/trips')
  add('Trips missing a route (from/to)', trips.filter((t) => !t.pickup || !t.dropoff).length, trips.length, 'Pickup and drop-off power route analytics.', '/trips')
  add('Trips with no amount', trips.filter((t) => !(Number(t.amount) > 0)).length, trips.length, 'Zero-amount trips distort revenue.', '/trips')
  add('Completed trips with no vehicle', completed.filter((t) => !t.vehicle_id).length, completed.length, 'Needed for per-vehicle profit & fuel efficiency.', '/dispatch')
  add('Completed trips with no driver', completed.filter((t) => !t.driver_id).length, completed.length, 'Needed for driver accountability.', '/dispatch')
  add('Trips with no client organization', trips.filter((t) => !t.organization_id).length, trips.length, 'Client link powers revenue-by-client.', '/trips', true)

  // Date anomalies
  const badDates = trips.filter((t) => t.trip_date < '2015-01-01' || t.trip_date > today).length
  add('Trips with an impossible date', badDates, trips.length, 'Before 2015 or in the future — usually an import date bug.', '/trips')

  // Duplicate slips
  const slipCounts = new Map<string, number>()
  for (const t of trips) if (t.slip_no) slipCounts.set(t.slip_no, (slipCounts.get(t.slip_no) ?? 0) + 1)
  const dupSlips = [...slipCounts.values()].filter((n) => n > 1).length
  add('Duplicate slip numbers', dupSlips, slipCounts.size, 'Same slip on multiple trips can mean a double import.', '/trips')

  // Vehicles
  const owned = vehicles.filter((v) => v.ownership === 'owned')
  add('Owned vehicles missing purchase info', owned.filter((v) => !(Number(v.purchase_price) > 0)).length, owned.length, 'Needed for payback & loan tracking.', '/vehicles')

  // Fuel
  add('Fuel entries with no amount', fuel.filter((f) => !(Number(f.amount) > 0)).length, fuel.length, 'Zero-amount fuel adds noise.', '/fuel')

  const issues = checks.filter((c) => c.level === 'warn')
  const infos = checks.filter((c) => c.level === 'info')
  const clean = checks.filter((c) => c.level === 'ok')

  const summary = issues.length === 0
    ? 'All clear — your data looks healthy.'
    : `${issues.length} issue${issues.length === 1 ? '' : 's'} to review across ${trips.length} trips.`

  return (
    <>
      <PageHeader title="Data health" subtitle="Catch bad data before it distorts your reports" />

      <div className="card" style={{ padding: 16, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 20 }}>{issues.length === 0 ? '✅' : '🩺'}</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{summary}</div>
          <div style={{ fontSize: 12.5, color: 'var(--ink3)' }}>{trips.length} trips · {vehicles.length} vehicles · {fuel.length} fuel entries · {orgs.length} clients · {contractors.length} contractors · {drivers.length} drivers</div>
        </div>
      </div>

      {issues.length > 0 && <Section title="Needs attention">{issues.map((c, i) => <Row key={i} c={c} />)}</Section>}
      {infos.length > 0 && <Section title="Worth a look">{infos.map((c, i) => <Row key={i} c={c} />)}</Section>}
      {clean.length > 0 && <Section title="Healthy">{clean.map((c, i) => <Row key={i} c={c} />)}</Section>}
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div className="font-display" style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px 2px' }}>{title}</div>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>{children}</div>
    </div>
  )
}
function Row({ c }: { c: Check }) {
  const color = c.level === 'warn' ? 'var(--danger)' : c.level === 'info' ? 'var(--gold)' : 'var(--accent)'
  const icon = c.level === 'warn' ? '⚠' : c.level === 'info' ? 'ℹ' : '✓'
  return (
    <Link href={c.href} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderTop: '1px solid var(--border)' }}>
      <span style={{ color, fontSize: 15, width: 16, textAlign: 'center' }}>{icon}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 14, fontWeight: 500 }}>{c.label}</span>
        <span style={{ display: 'block', fontSize: 12.5, color: 'var(--ink3)' }}>{c.detail}</span>
      </span>
      <span style={{ fontWeight: 700, color, fontSize: 14, whiteSpace: 'nowrap' }}>{c.count > 0 ? `${c.count}` : 'OK'}{c.count > 0 && c.total > 0 ? <span style={{ color: 'var(--ink3)', fontWeight: 400, fontSize: 12 }}> / {c.total}</span> : null}</span>
    </Link>
  )
}
