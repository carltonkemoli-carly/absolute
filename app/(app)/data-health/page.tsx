import Link from 'next/link'
import { PageHeader, StatCard, Card, Section } from '@/components/ui'
import SegmentDonut from '@/components/SegmentDonut'
import type { Seg } from '@/lib/chart'
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

  // True duplicate trips (same slip + date + client) — the real double-import signal.
  // (Slip numbers alone repeat legitimately across months, so don't flag those.)
  const sig = new Map<string, number>()
  for (const t of trips) if (t.slip_no) {
    const k = `${t.slip_no}|${t.trip_date}|${(t.client_name || '').toLowerCase()}`
    sig.set(k, (sig.get(k) ?? 0) + 1)
  }
  const trueDup = [...sig.values()].filter((n) => n > 1).length
  add('Duplicate trips (same slip, date & client)', trueDup, trips.length, 'Almost always a double import — remove the extras.', '/trips')

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

  // Part-to-whole of the checks themselves — how much of the audit is clean.
  const resultMix: Seg[] = [
    { label: 'Healthy', value: clean.length, color: '#2C7A53' },
    { label: 'Worth a look', value: infos.length, color: '#C9A227' },
    { label: 'Needs attention', value: issues.length, color: '#BC3E22' },
  ]

  const covered: { label: string; value: number }[] = [
    { label: 'Trips', value: trips.length },
    { label: 'Vehicles', value: vehicles.length },
    { label: 'Fuel entries', value: fuel.length },
    { label: 'Clients', value: orgs.length },
    { label: 'Contractors', value: contractors.length },
    { label: 'Drivers', value: drivers.length },
  ]

  return (
    <>
      <PageHeader title="Data health" subtitle="Catch bad data before it distorts your reports" />

      <Section title="Data health overview">
        <div className="grid-stats" style={{ marginBottom: 16 }}>
          <StatCard label="Checks run" value={String(checks.length)} hint="across every record" />
          <StatCard label="Needs attention" value={String(issues.length)}
            hint={issues.length > 0 ? 'fix these first' : 'nothing broken'}
            accent={issues.length > 0 ? 'var(--danger)' : 'var(--accent)'} />
          <StatCard label="Worth a look" value={String(infos.length)}
            hint={infos.length > 0 ? 'not urgent' : 'nothing pending'}
            accent={infos.length > 0 ? 'var(--gold)' : 'var(--accent)'} />
          <StatCard label="Healthy" value={String(clean.length)} hint="passing cleanly" accent="var(--accent)" />
        </div>

        <div className="grid-2">
          <Card title="Check results">
            <SegmentDonut data={resultMix} centerValue={String(checks.length)} centerLabel="checks" badges />
          </Card>
          <Card title="What's covered">
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>
              <span style={{ fontSize: 17, marginRight: 8 }}>{issues.length === 0 ? '✅' : '🩺'}</span>{summary}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {covered.map((c) => (
                <div key={c.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderTop: '1px solid var(--border)', paddingTop: 7 }}>
                  <span style={{ color: 'var(--ink2)' }}>{c.label}</span>
                  <span style={{ fontWeight: 600 }}>{c.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </Section>

      {issues.length > 0 && <CheckList title="Needs attention">{issues.map((c, i) => <Row key={i} c={c} />)}</CheckList>}
      {infos.length > 0 && <CheckList title="Worth a look">{infos.map((c, i) => <Row key={i} c={c} />)}</CheckList>}
      {clean.length > 0 && <CheckList title="Healthy">{clean.map((c, i) => <Row key={i} c={c} />)}</CheckList>}
    </>
  )
}

// A Section band wrapping the checks as one flush-edged card.
function CheckList({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Section title={title}>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>{children}</div>
    </Section>
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
