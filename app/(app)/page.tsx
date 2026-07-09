import { redirect } from 'next/navigation'
import { PageHeader, StatCard, Card } from '@/components/ui'
import MonthNav from '@/components/MonthNav'
import NotificationsCard from '@/components/NotificationsCard'
import QuickActions from '@/components/QuickActions'
import EmptyState from '@/components/EmptyState'
import Donut from '@/components/Donut'
import { requireProfile, canSeeFinance } from '@/lib/auth'
import { listTrips, listFuel, listVehicles, listDrivers, listContractors, listOrganizations, listDocuments, listServices, listExpenses, listInvoices } from '@/lib/db'
import { OWNERSHIP_LABELS } from '@/lib/types'
import { buildAttention } from '@/lib/attention'
import { buildAlerts } from '@/lib/alerts'
import { monthRange, kes, MONTH_NAMES, isoDate } from '@/lib/format'
import { stickyPeriod } from '@/lib/period'
import type { Trip } from '@/lib/types'

export default async function DashboardPage({
  searchParams,
}: { searchParams: Promise<{ y?: string; m?: string }> }) {
  const profile = await requireProfile()
  // Office/driver roles don't see finance — send them to Trips.
  if (!canSeeFinance(profile.role)) redirect('/trips')

  const sp = await searchParams
  const { year, month } = await stickyPeriod(sp)
  const { start, end } = monthRange(year, month)

  const [trips, fuel, vehicles, drivers, contractors, organizations, documents, services, expenses, invoices] = await Promise.all([
    listTrips(start, end), listFuel(start, end), listVehicles(), listDrivers(), listContractors(), listOrganizations(), listDocuments(), listServices(), listExpenses(start, end), listInvoices(),
  ])
  const attention = buildAttention(documents, services, vehicles, drivers)
  const alerts = buildAlerts({ vehicles, trips, fuel, expenses, services: services.filter((s) => s.service_date >= start && s.service_date <= end), invoices, contractors, today: isoDate(new Date()), monthLabel: `${MONTH_NAMES[month]} ${year}`, monthStart: start, monthEnd: end })

  const revenue = sum(trips, (t) => t.amount)
  const express = sum(trips, (t) => t.express_charges)
  const fuelTotal = sum(fuel, (f) => f.amount)
  const index = revenue > 0 ? fuelTotal / revenue : 0

  // Revenue per contractor
  const perContractor = group(contractors, trips, (t) => t.contractor_id, (rows) => sum(rows, (t) => t.amount))
    .sort((a, b) => b.value - a.value)

  // Top organizations
  const perOrg = group(organizations, trips, (t) => t.organization_id, (rows) => sum(rows, (t) => t.amount))
    .filter((r) => r.value > 0).sort((a, b) => b.value - a.value).slice(0, 6)

  const maxContractor = Math.max(1, ...perContractor.map((c) => c.value))

  // Expressway is billed but passed through (Absolute doesn't keep it)
  const netRevenue = revenue - express

  const CHART = ['var(--accent)', 'var(--gold)', 'var(--accent-mid)', '#84A98C', '#C9A227', '#6B8F71', '#B07A3C']
  const contractorSlices = perContractor.map((c, i) => ({ label: c.label, value: c.value, color: CHART[i % CHART.length] }))
  const fleetMix = (['owned', 'monthly_hire', 'casual_hire'] as const)
    .map((o, i) => ({ label: OWNERSHIP_LABELS[o], value: vehicles.filter((v) => v.ownership === o).length, color: CHART[i] }))

  const hour = Number(new Date().toLocaleString('en-GB', { timeZone: 'Africa/Nairobi', hour: '2-digit', hour12: false }))
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = profile.full_name?.split(' ')[0] ?? ''

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={`${greeting}${firstName ? `, ${firstName}` : ''} · here's how the company is doing`}
        action={<MonthNav year={year} month={month} />}
      />

      {/* Numbers first — that's what a dashboard is for */}
      <div className="grid-stats" style={{ marginBottom: 18 }}>
        <StatCard label="Revenue billed" value={kes(revenue)} hint={`net ${kes(netRevenue)} (excl. expressway)`} accent="var(--accent)" />
        <StatCard label="Gross profit" value={kes(revenue - fuelTotal)}
          hint={revenue > 0 ? `${pct((revenue - fuelTotal) / revenue)} margin · before wages, insurance & loans` : 'revenue − fuel'}
          accent="var(--accent)" />
        <StatCard label="Fuel-to-sales index" value={pct(index)}
          hint={index > 0.3 ? 'High — check fuel use' : 'Healthy'} accent={index > 0.3 ? 'var(--danger)' : 'var(--accent)'} />
        <StatCard label="Expressway charges" value={kes(express)} hint="reimbursable" accent="var(--gold)" />
        <StatCard label="Trips" value={String(trips.length)} hint="this month" />
      </div>

      {/* Compact, clearly-visible notifications — expand to act on them */}
      <NotificationsCard attention={attention} alerts={alerts} />

      {/* One-click access to the common daily tasks */}
      <QuickActions />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 16, marginBottom: 16 }}>
        <Card title="Revenue by contractor">
          {contractorSlices.length === 0 ? <Empty /> : <Donut data={contractorSlices} centerValue={kes(revenue)} centerLabel="billed" />}
        </Card>
        <Card title="Fleet mix">
          <Donut data={fleetMix} centerValue={String(vehicles.length)} centerLabel="vehicles" />
        </Card>
      </div>

      <div className="grid-2" style={{ marginBottom: 16 }}>
        <Card title="Revenue per contractor">
          {perContractor.length === 0 ? <Empty /> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {perContractor.map((c) => (
                <div key={c.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600 }}>{c.label}</span><span>{kes(c.value)}</span>
                  </div>
                  <div style={{ height: 8, background: 'var(--surface2)', borderRadius: 99 }}>
                    <div style={{ height: '100%', width: `${(c.value / maxContractor) * 100}%`, background: 'var(--accent-mid)', borderRadius: 99 }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Top organizations">
          {perOrg.length === 0 ? <Empty /> : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
              <tbody>
                {perOrg.map((o) => (
                  <tr key={o.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 0' }}>{o.label}</td>
                    <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 600 }}>{kes(o.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

    </>
  )
}

function sum<T>(rows: T[], f: (r: T) => number): number {
  return rows.reduce((s, r) => s + Number(f(r) || 0), 0)
}
function group<T extends { id: string; name: string }>(
  entities: T[], trips: Trip[], key: (t: Trip) => string | null, agg: (rows: Trip[]) => number,
): { id: string; label: string; value: number }[] {
  return entities.map((e) => ({ id: e.id, label: e.name, value: agg(trips.filter((t) => key(t) === e.id)) }))
}
function pct(x: number): string {
  return `${(x * 100).toFixed(1)}%`
}
function Empty() { return <EmptyState icon="📊" title="No data this month" hint="Pick another month above, or log some trips." /> }
function Th({ children, right }: { children?: React.ReactNode; right?: boolean }) {
  return <th style={{ padding: '11px 16px', fontSize: 12, fontWeight: 600, color: 'var(--ink2)', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: right ? 'right' : 'left' }}>{children}</th>
}
function Td({ children, right }: { children?: React.ReactNode; right?: boolean }) {
  return <td style={{ padding: '11px 16px', textAlign: right ? 'right' : 'left' }}>{children}</td>
}
