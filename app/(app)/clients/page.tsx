import { redirect } from 'next/navigation'
import { PageHeader, StatCard } from '@/components/ui'
import PrintButton from '@/components/PrintButton'
import { Bars } from '@/components/Bars'
import { requireProfile, canSeeFinance } from '@/lib/auth'
import { listTrips, listOrganizations } from '@/lib/db'
import { kes, fmtDate, isoDate } from '@/lib/format'

export const dynamic = 'force-dynamic'

export default async function ClientsPage() {
  const profile = await requireProfile()
  if (!canSeeFinance(profile.role)) redirect('/trips')

  const today = isoDate(new Date())
  const [trips, orgs] = await Promise.all([listTrips('2000-01-01', today), listOrganizations()])
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
      <PageHeader title="Clients" subtitle="Who your revenue depends on — and how concentrated it is" action={<PrintButton />} />

      <div className="grid-stats" style={{ marginBottom: 16 }}>
        <StatCard label="Active clients" value={String(clients.length)} hint="with logged trips" />
        <StatCard label="Top client" value={top?.name ?? '—'} hint={top ? `${Math.round(top.share * 100)}% of revenue` : undefined} accent={concentrated ? 'var(--gold)' : 'var(--accent)'} />
        <StatCard label="Top 3 share" value={`${Math.round(top3 * 100)}%`} hint="of all revenue" accent={top3 > 0.6 ? 'var(--gold)' : 'var(--accent)'} />
        <StatCard label="Total revenue" value={kes(totalRev)} hint="all clients" />
      </div>

      {concentrated && (
        <div className="card" style={{ padding: '13px 16px', marginBottom: 16, background: 'var(--gold-light)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 16 }}>⚠</span>
          <div style={{ fontSize: 13.5, color: 'var(--ink)' }}>
            <strong>Concentration risk:</strong> {Math.round((top?.share ?? 0) * 100)}% of your revenue comes from <strong>{top?.name}</strong>. Losing this account would hit hard — worth building up the next tier of clients.
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 18, marginBottom: 16 }}>
        <div className="font-display" style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Revenue by client (all-time)</div>
        <Bars
          items={clients.slice(0, 12).map((c) => ({ label: c.name, value: c.revenue, sub: `${Math.round(c.share * 100)}%` }))}
          max={Math.max(1, ...clients.map((c) => c.revenue))} format={kes} accent="var(--accent)" />
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
              <Th>Client</Th><Th right>Revenue</Th><Th right>Share</Th><Th right>Trips</Th><Th right>Avg fare</Th><Th>Top route</Th><Th>Last trip</Th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => {
              const ds = daysSince(c.lastTrip)
              const stale = ds != null && ds > 45
              return (
                <tr key={c.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <Td><strong>{c.name}</strong></Td>
                  <Td right>{kes(c.revenue)}</Td>
                  <Td right>{Math.round(c.share * 100)}%</Td>
                  <Td right>{c.trips}</Td>
                  <Td right>{kes(c.avgFare)}</Td>
                  <Td><span style={{ color: 'var(--ink2)' }}>{c.topRoute}</span></Td>
                  <Td><span style={{ color: stale ? 'var(--danger)' : 'var(--ink2)' }}>{c.lastTrip ? `${fmtDate(c.lastTrip)}${stale ? ` · ${ds}d ago` : ''}` : '—'}</span></Td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--ink3)', marginTop: 10 }}>Clients with no trip in 45+ days are flagged red — a nudge to check in before they lapse.</p>
    </>
  )
}

function Th({ children, right }: { children?: React.ReactNode; right?: boolean }) {
  return <th style={{ padding: '10px 12px', fontSize: 11.5, fontWeight: 600, color: 'var(--ink2)', textTransform: 'uppercase', letterSpacing: '0.03em', textAlign: right ? 'right' : 'left' }}>{children}</th>
}
function Td({ children, right }: { children?: React.ReactNode; right?: boolean }) {
  return <td style={{ padding: '10px 12px', textAlign: right ? 'right' : 'left', whiteSpace: 'nowrap' }}>{children}</td>
}
