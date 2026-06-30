import { redirect } from 'next/navigation'
import { PageHeader, StatCard, Card } from '@/components/ui'
import MonthNav from '@/components/MonthNav'
import AttentionPanel from '@/components/AttentionPanel'
import Donut from '@/components/Donut'
import { requireProfile, canSeeFinance } from '@/lib/auth'
import { listTrips, listFuel, listVehicles, listDrivers, listContractors, listOrganizations, listDocuments, listServices, listExpenses } from '@/lib/db'
import { OWNERSHIP_LABELS } from '@/lib/types'
import { buildAttention } from '@/lib/attention'
import { monthRange, kes } from '@/lib/format'
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

  const [trips, fuel, vehicles, drivers, contractors, organizations, documents, services, expenses] = await Promise.all([
    listTrips(start, end), listFuel(start, end), listVehicles(), listDrivers(), listContractors(), listOrganizations(), listDocuments(), listServices(), listExpenses(start, end),
  ])
  const attention = buildAttention(documents, services, vehicles, drivers)

  const revenue = sum(trips, (t) => t.amount)
  const express = sum(trips, (t) => t.express_charges)
  const fuelTotal = sum(fuel, (f) => f.amount)
  const index = revenue > 0 ? fuelTotal / revenue : 0

  // Revenue per contractor
  const perContractor = group(contractors, trips, (t) => t.contractor_id, (rows) => sum(rows, (t) => t.amount))
    .sort((a, b) => b.value - a.value)

  // Per-vehicle profitability: revenue minus its direct costs (fuel, service,
  // hire, vehicle-tagged expenses) = contribution. Plus fuel efficiency (km/l).
  const perVehicle = vehicles.map((v) => {
    const vt = trips.filter((t) => t.vehicle_id === v.id)
    const vf = fuel.filter((f) => f.vehicle_id === v.id)
    const rev = sum(vt, (t) => t.amount)
    const fu = sum(vf, (f) => f.amount)
    const litres = sum(vf, (f) => Number(f.litres) || 0)
    const km = sum(vt, (t) => Number(t.distance_km) || 0)
    const kmpl = litres > 0 ? km / litres : null
    const svc = sum(services.filter((s) => s.vehicle_id === v.id && s.service_date >= start && s.service_date <= end), (s) => s.cost)
    const hire = (v.ownership === 'monthly_hire' ? Number(v.monthly_fee) : 0) + sum(vt, (t) => Number(t.hire_cost) || 0)
    const vexp = sum(expenses.filter((e) => e.vehicle_id === v.id), (e) => e.amount)
    const contribution = rev - fu - svc - hire - vexp
    return { id: v.id, label: v.plate, ownership: v.ownership, trips: vt.length, rev, fuel: fu, kmpl, hire, contribution }
  }).filter((r) => r.trips > 0 || r.fuel > 0).sort((a, b) => b.contribution - a.contribution)

  const kmplVals = perVehicle.map((v) => v.kmpl).filter((x): x is number => x != null && x > 0)
  const avgKmpl = kmplVals.length ? kmplVals.reduce((a, b) => a + b, 0) / kmplVals.length : 0

  const distanceKm = sum(trips, (t) => Number(t.distance_km) || 0)

  // Per-driver: trips, revenue
  const perDriver = drivers.map((d) => {
    const dt = trips.filter((t) => t.driver_id === d.id)
    return { id: d.id, label: d.name, trips: dt.length, rev: sum(dt, (t) => t.amount) }
  }).filter((r) => r.trips > 0).sort((a, b) => b.rev - a.rev)

  // Top organizations
  const perOrg = group(organizations, trips, (t) => t.organization_id, (rows) => sum(rows, (t) => t.amount))
    .filter((r) => r.value > 0).sort((a, b) => b.value - a.value).slice(0, 6)

  const maxContractor = Math.max(1, ...perContractor.map((c) => c.value))

  // Expressway is billed but passed through (Absolute doesn't keep it)
  const netRevenue = revenue - express

  // Cost breakdown for the month (for the donut + cost mix)
  const CHART = ['var(--accent)', 'var(--gold)', 'var(--accent-mid)', '#84A98C', '#C9A227', '#6B8F71', '#B07A3C']
  const serviceMonth = sum(services.filter((s) => s.service_date >= start && s.service_date <= end), (s) => s.cost)
  const hireMonth = sum(vehicles.filter((v) => v.ownership === 'monthly_hire'), (v) => Number(v.monthly_fee)) + sum(trips, (t) => Number(t.hire_cost) || 0)
  const wagesMonth = sum(expenses.filter((e) => e.category === 'Driver Wages'), (e) => e.amount)
  const otherExpMonth = sum(expenses.filter((e) => e.category !== 'Driver Wages'), (e) => e.amount)
  const totalCostMonth = fuelTotal + hireMonth + wagesMonth + serviceMonth + otherExpMonth
  const costSlices = [
    { label: 'Fuel', value: fuelTotal, color: CHART[0] },
    { label: 'Vehicle Hire', value: hireMonth, color: CHART[1] },
    { label: 'Driver Wages', value: wagesMonth, color: CHART[2] },
    { label: 'Servicing', value: serviceMonth, color: CHART[3] },
    { label: 'Other', value: otherExpMonth, color: CHART[4] },
  ]
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

      <AttentionPanel items={attention} />

      <div className="grid-stats" style={{ marginBottom: 18 }}>
        <StatCard label="Revenue billed" value={kes(revenue)} hint={`net ${kes(netRevenue)} (excl. expressway)`} accent="var(--accent)" />
        <StatCard label="Fuel" value={kes(fuelTotal)} hint={`${fuel.length} fill-ups`} />
        <StatCard label="Fuel-to-sales index" value={pct(index)}
          hint={index > 0.3 ? 'High — check fuel use' : 'Healthy'} accent={index > 0.3 ? 'var(--danger)' : 'var(--accent)'} />
        <StatCard label="Expressway charges" value={kes(express)} hint="reimbursable" accent="var(--gold)" />
        <StatCard label="Distance covered" value={`${distanceKm.toLocaleString()} km`} hint={`${trips.length} trips`} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 16, marginBottom: 16 }}>
        <Card title="Revenue by contractor">
          {contractorSlices.length === 0 ? <Empty /> : <Donut data={contractorSlices} centerValue={kes(revenue)} centerLabel="billed" />}
        </Card>
        <Card title="Cost breakdown">
          {totalCostMonth === 0 ? <Empty /> : <Donut data={costSlices} centerValue={kes(totalCostMonth)} centerLabel="costs" />}
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

      <Card title="Per vehicle — profitability & fuel efficiency" pad={false}>
        <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5, minWidth: 720 }}>
          <thead>
            <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
              <Th>Vehicle</Th><Th right>Trips</Th><Th right>km/l</Th><Th right>Revenue</Th><Th right>Fuel</Th><Th right>Hire</Th><Th right>Contribution</Th>
            </tr>
          </thead>
          <tbody>
            {perVehicle.length === 0 && <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: 'var(--ink3)' }}>No activity this month.</td></tr>}
            {perVehicle.map((v) => {
              const thirsty = v.kmpl !== null && avgKmpl > 0 && v.kmpl < avgKmpl * 0.7
              return (
                <tr key={v.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <Td>
                    <strong>{v.label}</strong>
                    <div style={{ fontSize: 11.5, color: v.ownership === 'owned' ? 'var(--ink3)' : 'var(--gold)' }}>{OWNERSHIP_LABELS[v.ownership]}</div>
                  </Td>
                  <Td right>
                    <span title={thirsty ? 'Well below fleet average — check for fuel waste/theft' : undefined}
                      style={{ fontWeight: 600, color: v.kmpl === null ? 'var(--ink3)' : thirsty ? 'var(--danger)' : 'var(--ink)' }}>
                      {v.kmpl === null ? '—' : `${v.kmpl.toFixed(1)}${thirsty ? ' ⚠' : ''}`}
                    </span>
                  </Td>
                  <Td right>{kes(v.rev)}</Td>
                  <Td right>{kes(v.fuel)}</Td>
                  <Td right>{v.hire ? kes(v.hire) : '—'}</Td>
                  <Td right><strong style={{ color: v.contribution < 0 ? 'var(--danger)' : 'var(--accent)' }}>{kes(v.contribution)}</strong></Td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>
      </Card>

      <div style={{ height: 16 }} />

      <Card title="Per driver — trips & revenue" pad={false}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
          <thead>
            <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
              <Th>Driver</Th><Th right>Trips</Th><Th right>Revenue</Th>
            </tr>
          </thead>
          <tbody>
            {perDriver.length === 0 && <tr><td colSpan={3} style={{ padding: 24, textAlign: 'center', color: 'var(--ink3)' }}>No activity this month.</td></tr>}
            {perDriver.map((d) => (
              <tr key={d.id} style={{ borderTop: '1px solid var(--border)' }}>
                <Td><strong>{d.label}</strong></Td>
                <Td right>{d.trips}</Td>
                <Td right>{kes(d.rev)}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
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
function Empty() { return <div style={{ color: 'var(--ink3)', fontSize: 14, padding: '8px 0' }}>No data this month.</div> }
function Th({ children, right }: { children?: React.ReactNode; right?: boolean }) {
  return <th style={{ padding: '11px 16px', fontSize: 12, fontWeight: 600, color: 'var(--ink2)', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: right ? 'right' : 'left' }}>{children}</th>
}
function Td({ children, right }: { children?: React.ReactNode; right?: boolean }) {
  return <td style={{ padding: '11px 16px', textAlign: right ? 'right' : 'left' }}>{children}</td>
}
