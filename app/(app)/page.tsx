import Link from 'next/link'
import { redirect } from 'next/navigation'
import { PageHeader, StatCard, Card, EmptyState, Section } from '@/components/ui'
import MonthNav from '@/components/MonthNav'
import NotificationsCard from '@/components/NotificationsCard'
import QuickActions from '@/components/QuickActions'
import SegmentDonut, { type Seg } from '@/components/SegmentDonut'
import { requireProfile, canSeeFinance } from '@/lib/auth'
import { listTrips, listFuel, listVehicles, listDrivers, listContractors, listOrganizations, listDocuments, listServices, listExpenses, listInvoices } from '@/lib/db'
import { OWNERSHIP_LABELS, type Invoice } from '@/lib/types'
import { buildAttention } from '@/lib/attention'
import { buildAlerts } from '@/lib/alerts'
import { monthRange, kes, kesPlain, MONTH_NAMES, isoDate } from '@/lib/format'
import { stickyPeriod } from '@/lib/period'
import { monthlyPL, profitHeadline } from '@/lib/finance'
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

  // ---- Financial headlines (canonical P&L: gross until real costs logged) ----
  const pl = monthlyPL({ trips, fuel, expenses, services: services.filter((s) => s.service_date >= start && s.service_date <= end), vehicles })
  const headline = profitHeadline(pl)
  const revenue = pl.revenue
  const express = pl.express
  const fuelTotal = pl.fuel
  const index = revenue > 0 ? fuelTotal / revenue : 0
  const netRevenue = pl.netRevenue

  const today = isoDate(new Date())
  const outstanding = invoices.reduce((s, i) => s + due(i), 0)
  const overdue = invoices.reduce((s, i) => s + (due(i) > 0 && i.due_date && i.due_date < today ? due(i) : 0), 0)

  // ---- Palette: colour lives in the data, chrome stays neutral ----
  const CHART = ['#2C7A53', '#C9A227', '#2F9E8F', '#BC3E22', '#3E7CB1', '#7A5FB0', '#D98A3D']
  const GREEN = '#2C7A53', GOLD = '#C9A227', TEAL = '#2F9E8F', RED = '#BC3E22'

  // Revenue by contractor (currency donut)
  const contractorRev: Seg[] = contractors
    .map((c, i) => ({ label: c.name, value: sum(trips.filter((t) => t.contractor_id === c.id), (t) => t.amount), color: CHART[i % CHART.length] }))
    .filter((s) => s.value > 0).sort((a, b) => b.value - a.value)

  // Fleet mix by ownership (count donut with ring badges)
  const fleetMix: Seg[] = ([['owned', GREEN], ['monthly_hire', GOLD], ['casual_hire', TEAL]] as const)
    .map(([o, color]) => ({ label: OWNERSHIP_LABELS[o], value: vehicles.filter((v) => v.ownership === o).length, color }))

  // Trips by contractor this month (count donut)
  const tripsByContractor: Seg[] = contractors
    .map((c, i) => ({ label: c.name, value: trips.filter((t) => t.contractor_id === c.id).length, color: CHART[i % CHART.length] }))
    .filter((s) => s.value > 0).sort((a, b) => b.value - a.value)

  // Receivables status (count donut)
  let paidN = 0, overdueN = 0, openN = 0
  for (const i of invoices) {
    if (due(i) <= 0) { if (Number(i.amount) > 0) paidN++; continue }
    if (i.due_date && i.due_date < today) overdueN++; else openN++
  }
  const receivablesMix: Seg[] = [
    { label: 'Paid', value: paidN, color: GREEN },
    { label: 'Outstanding', value: openN, color: GOLD },
    { label: 'Overdue', value: overdueN, color: RED },
  ]

  // Compliance status (count donut) — by document expiry
  const in30 = isoDate(new Date(Date.now() + 30 * 864e5))
  let okN = 0, expiringN = 0, expiredN = 0
  for (const d of documents) {
    if (d.expiry_date && d.expiry_date < today) expiredN++
    else if (d.expiry_date && d.expiry_date <= in30) expiringN++
    else okN++
  }
  const complianceMix: Seg[] = [
    { label: 'Valid', value: okN, color: GREEN },
    { label: 'Expiring soon', value: expiringN, color: GOLD },
    { label: 'Expired', value: expiredN, color: RED },
  ]

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

      <Section title="My business">
        <div className="grid-stats" style={{ marginBottom: 16 }}>
          <StatCard label="Revenue billed" value={kes(revenue)} hint={`net ${kes(netRevenue)} (excl. expressway)`} accent="var(--accent)" />
          <StatCard label={headline.label} value={kes(headline.value)}
            hint={revenue > 0 ? `${pct(headline.margin)} margin · ${headline.hint}` : 'revenue − fuel'}
            accent="var(--accent)" />
          <StatCard label="Fuel-to-sales index" value={pct(index)}
            hint={index > 0.3 ? 'High — check fuel use' : 'Healthy'} accent={index > 0.3 ? 'var(--danger)' : 'var(--accent)'} />
          <StatCard label="Expressway charges" value={kes(express)} hint="reimbursable" accent="var(--gold)" />
          <Link href="/receivables" style={{ textDecoration: 'none', color: 'inherit' }}>
            <StatCard label="Outstanding" value={kes(outstanding)}
              hint={overdue > 0 ? `${kes(overdue)} overdue →` : outstanding > 0 ? 'owed to you →' : 'all collected'}
              accent={overdue > 0 ? 'var(--danger)' : outstanding > 0 ? 'var(--gold)' : 'var(--accent)'} />
          </Link>
          <StatCard label="Trips" value={String(trips.length)} hint="this month" />
        </div>

        <div className="grid-2">
          <Card title="Revenue by contractor">
            {contractorRev.length === 0 ? <Empty /> : (
              <SegmentDonut data={contractorRev} centerValue={kesPlain(revenue)} centerLabel="Ksh billed" centerSize={19} money />
            )}
          </Card>
          <Card title="Fleet">
            {vehicles.length === 0 ? <Empty /> : (
              <SegmentDonut data={fleetMix} centerValue={String(vehicles.length)} centerLabel="vehicles" badges />
            )}
          </Card>
        </div>
      </Section>

      {/* Compact, clearly-visible notifications + one-click daily tasks */}
      <NotificationsCard attention={attention} alerts={alerts} />
      <QuickActions />

      <Section title="Operations">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
          <Card title="Trips by contractor">
            {tripsByContractor.length === 0 ? <Empty /> : (
              <SegmentDonut data={tripsByContractor} centerValue={String(trips.length)} centerLabel="this month" badges />
            )}
          </Card>
          <Card title="Receivables">
            {invoices.length === 0 ? <Empty msg="No invoices yet" /> : (
              <SegmentDonut data={receivablesMix} centerValue={String(invoices.length)} centerLabel="invoices" badges />
            )}
          </Card>
          <Card title="Compliance">
            {documents.length === 0 ? <Empty msg="No documents tracked" /> : (
              <SegmentDonut data={complianceMix} centerValue={String(documents.length)} centerLabel="documents" badges />
            )}
          </Card>
        </div>
      </Section>
    </>
  )
}

// outstanding balance on one invoice
function due(i: Invoice): number {
  return Math.max(0, Number(i.amount) - Number(i.amount_paid))
}
function sum<T>(rows: T[], f: (r: T) => number): number {
  return rows.reduce((s, r) => s + Number(f(r) || 0), 0)
}
function pct(x: number): string {
  return `${(x * 100).toFixed(1)}%`
}

function Empty({ msg }: { msg?: string }) {
  return <EmptyState message={msg ?? 'No data this month — pick another month above, or log some trips.'} />
}
