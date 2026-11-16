import { redirect } from 'next/navigation'
import Link from 'next/link'
import { PageHeader, StatCard, Card, Section } from '@/components/ui'
import PrintButton from '@/components/PrintButton'
import DataTable from '@/components/DataTable'
import { Bars } from '@/components/Bars'
import SegmentDonut from '@/components/SegmentDonut'
import { topSegments } from '@/lib/chart'
import { requireProfile, canSeeFinance } from '@/lib/auth'
import { listTrips, listOrganizations } from '@/lib/db'
import { kes, kesPlain, fmtDate, isoDate } from '@/lib/format'
import { isEarnedTrip } from '@/lib/finance'

export const dynamic = 'force-dynamic'

export default async function ClientsPage() {
  const profile = await requireProfile()
  if (!canSeeFinance(profile.role)) redirect('/trips')

  const today = isoDate(new Date())
  const [allTrips, orgs] = await Promise.all([listTrips('2000-01-01', today), listOrganizations()])
  const trips = allTrips.filter(isEarnedTrip)
  const sum = <T,>(a: T[], f: (x: T) => number) => a.reduce((s, x) => s + f(x), 0)
  const totalRev = sum(trips, (t) => Number(t.amount) || 0)

  const clients = orgs.map((o) => {
    const ct = trips.filter((t) => t.organization_id === o.id)
    const revenue = sum(ct, (t) => Number(t.amount) || 0)
    const routeCount = new Map<string, number>()
    for (const t of ct) { const k = `${(t.pickup || '?').trim()} → ${(t.dropoff || '?').trim()}`; routeCount.set(k, (routeCount.get(k) ?? 0) + 1) }
    const topRoute = [...routeCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'
    const lastTrip = ct.map((t) => t.trip_date).sort().slice(-1)[0] ?? null
    const months = new Set(ct.map((t) => t.trip_date.slice(0, 7))).size
    return {
      id: o.id, name: o.name, revenue, trips: ct.length,
      share: totalRev > 0 ? revenue / totalRev : 0,
      avgFare: ct.length ? revenue / ct.length : 0,
      topRoute, lastTrip, months,
    }
  }).filter((c) => c.trips > 0).sort((a, b) => b.revenue - a.revenue)

  const top = clients[0]
  const top3 = clients.slice(0, 3).reduce((s, c) => s + c.share, 0)
  const concentrated = (top?.share ?? 0) > 0.3
  const daysSince = (d: string | null) => (d ? Math.round((Date.parse(today) - Date.parse(d)) / 86400000) : null)

  return (
    <>
      <PageHeader title="Clients" action={<PrintButton />} />

      <Section title="This month">
        <div className="grid-stats">
          <StatCard label="Active clients" value={String(clients.length)} hint="with logged trips" />
          <StatCard label="Top client" value={top?.name ?? '—'} hint={top ? `${Math.round(top.share * 100)}% of revenue` : undefined} accent={concentrated ? 'var(--gold)' : 'var(--ok)'} />
          <StatCard label="Top 3 share" value={`${Math.round(top3 * 100)}%`} hint="of all revenue" accent={top3 > 0.6 ? 'var(--gold)' : 'var(--ok)'} />
          <StatCard label="Total revenue" value={kes(totalRev)} hint="all clients" />
        </div>
      </Section>

      {concentrated && (
        <div className="card" style={{ padding: '13px 16px', marginBottom: 16, background: 'var(--gold-light)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span style={{ width: 8, height: 8, borderRadius: 99, background: 'var(--gold)', flexShrink: 0, marginTop: 6 }} aria-hidden="true" />
          <div style={{ fontSize: 13.5, color: 'var(--ink)' }}>
            <strong>Concentration risk.</strong> {Math.round((top?.share ?? 0) * 100)}% of your revenue comes from <strong>{top?.name}</strong>. Worth building up the next tier of clients.
          </div>
        </div>
      )}

      <Section title="All time">
        <div className="grid-2">
          <Card title="Revenue concentration">
            {clients.length === 0
              ? <p style={{ fontSize: 13.5, color: 'var(--ink3)' }}>No client revenue yet.</p>
              : <SegmentDonut data={topSegments(clients.map((c) => ({ label: c.name, value: c.revenue })), 6)} centerValue={kesPlain(totalRev)} centerLabel="Ksh total" centerSize={18} money />}
          </Card>
          <Card title="Top clients">
            <Bars
              items={clients.slice(0, 10).map((c) => ({ label: c.name, value: c.revenue, sub: `${Math.round(c.share * 100)}%` }))}
              max={Math.max(1, ...clients.map((c) => c.revenue))} format={kes} accent="var(--accent)" />
          </Card>
        </div>
      </Section>

      <DataTable rows={clients} rowKey={(c) => c.id} minWidth={760} empty="No client trips are recorded yet." columns={[
        { label: 'Client', role: 'primary', render: (c) => <Link href={`/clients/${encodeURIComponent(c.id)}`} className="client-record-link"><strong>{c.name}</strong></Link> },
        { label: 'Revenue', align: 'right', render: (c) => kes(c.revenue) },
        { label: 'Share', align: 'right', render: (c) => `${Math.round(c.share * 100)}%` },
        { label: 'Trips', align: 'right', render: (c) => c.trips },
        { label: 'Avg fare', align: 'right', render: (c) => kes(c.avgFare) },
        { label: 'Top route', render: (c) => <span style={{ color: 'var(--ink2)' }}>{c.topRoute}</span> },
        { label: 'Last trip', nowrap: true, render: (c) => {
          const ds = daysSince(c.lastTrip)
          const stale = ds != null && ds > 45
          return <span style={{ color: stale ? 'var(--danger)' : 'var(--ink2)' }}>{c.lastTrip ? `${fmtDate(c.lastTrip)}${stale ? ` · ${ds}d ago` : ''}` : '—'}</span>
        } },
      ]} />
      <p style={{ fontSize: 12.5, color: 'var(--ink3)', marginTop: 10 }}>Red = no trip in 45+ days.</p>
    </>
  )
}
