import Link from 'next/link'
import { PageHeader, StatCard, Card, Section } from '@/components/ui'
import SegmentDonut from '@/components/SegmentDonut'
import type { Seg } from '@/lib/chart'
import { requireProfile, canSeeFinance } from '@/lib/auth'
import { listTrips, listVehicles, listFuel, listOrganizations, listContractors, listDrivers, listInvoices, listExpenses } from '@/lib/db'
import { nairobiToday } from '@/lib/nairobi-date'
import { shiftCalendarDay } from '@/lib/record-search'

export const dynamic = 'force-dynamic'

type Level = 'ok' | 'warn' | 'info'
interface Check { label: string; count: number; total: number; level: Level; detail: string; href: string }

export default async function DataHealthPage() {
  const profile = await requireProfile()
  const finance = canSeeFinance(profile.role)
  const today = nairobiToday()

  const [trips, vehicles, fuel, orgs, contractors, drivers, invoices, expenses] = await Promise.all([
    listTrips('2000-01-01', '2100-01-01'), listVehicles(), listFuel('2000-01-01', '2100-01-01'),
    listOrganizations(), listContractors(), listDrivers(), finance ? listInvoices() : Promise.resolve([]),
    finance ? listExpenses('2000-01-01', today) : Promise.resolve([]),
  ])

  const completed = trips.filter((t) => t.status === 'completed')
  const checks: Check[] = []
  const add = (label: string, bad: number, total: number, detail: string, href: string, infoOnly = false) =>
    checks.push({ label, count: bad, total, level: bad === 0 ? 'ok' : infoOnly ? 'info' : 'warn', detail, href })

  // Trips
  add('Trips missing a client name', trips.filter((t) => !t.client_name || t.client_name.trim() === '').length, trips.length, 'Every trip should name the passenger.', '/trips')
  add('Trips missing a route (from/to)', trips.filter((t) => !t.pickup || !t.dropoff).length, trips.length, 'Pickup and drop-off power route analytics.', '/trips')
  add('Completed trips with no fare', completed.filter((t) => !(Number(t.amount) > Number(t.express_charges || 0))).length, completed.length, 'Fare means the amount left after pass-through expressway tolls.', '/trips')
  add('Completed trips with no vehicle', completed.filter((t) => !t.vehicle_id).length, completed.length, 'Needed for per-vehicle profit & fuel efficiency.', '/dispatch')
  add('Completed trips with no driver', completed.filter((t) => !t.driver_id).length, completed.length, 'Needed for driver accountability.', '/dispatch')
  add('Trips with no client organization', trips.filter((t) => !t.organization_id).length, trips.length, 'Client link powers revenue-by-client.', '/trips', true)

  // Date anomalies
  const badDates = trips.filter((t) => t.trip_date < '2015-01-01' || (t.status === 'completed' && t.trip_date > today)).length
  add('Trips with an implausible date', badDates, trips.length, 'Before 2015, or marked complete before the journey date. Future bookings are valid.', '/trips')

  // True duplicate trips (same slip + date + client) — the real double-import signal.
  // (Slip numbers alone repeat legitimately across months, so don't flag those.)
  const sig = new Map<string, number>()
  for (const t of trips) if (t.slip_no) {
    const k = `${t.slip_no}|${t.trip_date}|${(t.client_name || '').toLowerCase()}`
    sig.set(k, (sig.get(k) ?? 0) + 1)
  }
  const trueDup = [...sig.values()].filter((n) => n > 1).length
  add('Duplicate trips (same slip, date & client)', trueDup, trips.length, 'Likely double import.', '/trips')

  // Vehicles
  const owned = vehicles.filter((v) => v.ownership === 'owned')
  add('Owned vehicles missing purchase info', owned.filter((v) => !(Number(v.purchase_price) > 0)).length, owned.length, 'Needed for payback & loan tracking.', '/vehicles')

  // Fuel
  add('Fuel entries with no amount', fuel.filter((f) => !(Number(f.amount) > 0)).length, fuel.length, 'Zero-amount fuel adds noise.', '/fuel')

  if (finance) {
    const recentCompleted = completed.filter((t) => t.trip_date >= shiftCalendarDay(today, -60) && t.trip_date <= today)
    add('Recent account journeys awaiting an invoice', recentCompleted.filter((t) => t.payment === 'account' && !t.invoice_id).length,
      recentCompleted.length, 'Review completed account work from the last 60 days. Older trips may have been billed before trip links existed.', '/receivables')
    add('Invoices with an invalid payment balance', invoices.filter((i) => Number(i.amount) < 0 || Number(i.amount_paid) < 0 || Number(i.amount_paid) > Number(i.amount)).length,
      invoices.length, 'A paid total must stay between zero and the invoice amount.', '/receivables')
    add('Invoices without a due date', invoices.filter((i) => !i.due_date).length,
      invoices.length, 'Without a due date, overdue reports cannot flag the balance.', '/receivables', true)
    const casualIds = new Set(vehicles.filter((v) => v.ownership === 'casual_hire').map((v) => v.id))
    const casualTrips = completed.filter((t) => t.vehicle_id && casualIds.has(t.vehicle_id))
    add('Partner journeys missing hire cost', casualTrips.filter((t) => !(Number(t.hire_cost) > 0)).length,
      casualTrips.length, 'Completed journeys in casual-hire vehicles need the partner cost to avoid overstated profit.', '/trips')
    const invoiceById = new Map(invoices.map((i) => [i.id, i]))
    const linkedTrips = trips.filter((t) => t.invoice_id)
    add('Invoiced trips with a different contractor', linkedTrips.filter((t) => invoiceById.get(t.invoice_id!)?.contractor_id !== t.contractor_id).length,
      linkedTrips.length, 'A linked journey must belong to the same contractor as its invoice.', '/receivables')
    const recentMonths = new Set(recentCompleted.map((t) => t.trip_date.slice(0, 7)))
    const wageMonths = new Set(expenses.filter((e) => e.category === 'Driver Wages' && Number(e.amount) > 0).map((e) => e.expense_date.slice(0, 7)))
    add('Recent earning months without recorded wages', [...recentMonths].filter((month) => !wageMonths.has(month)).length,
      recentMonths.size, 'Confirm whether wages were paid or intentionally zero before treating profit as final.', '/expenses', true)
  }

  const issues = checks.filter((c) => c.level === 'warn')
  const infos = checks.filter((c) => c.level === 'info')
  const clean = checks.filter((c) => c.level === 'ok')

  const summary = issues.length === 0
    ? 'All clear.'
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
    ...(finance ? [{ label: 'Invoices', value: invoices.length }] : []),
  ]

  return (
    <>
      <PageHeader title="Data health" />

      <Section title="Summary">
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
              {summary}
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
