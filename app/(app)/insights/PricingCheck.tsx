import Link from 'next/link'
import { kes } from '@/lib/format'
import DataTable from '@/components/DataTable'

type PriceRow = { route: string; trips: number; card: number; actual: number; deltaPct: number; totalVar: number }
type Unmatched = { area: string; trips: number; revenue: number }

export default function PricingCheck({
  matched, underRecovery, overCharge, rows, unmatched,
}: {
  matched: number
  underRecovery: number
  overCharge: number
  rows: PriceRow[]
  unmatched: Unmatched[]
}) {
  const under = rows.filter((r) => r.totalVar < -1)
  return (
    <div className="card" style={{ padding: 18 }}>
      <div className="font-display" style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Rate-card pricing check</div>
      <p style={{ fontSize: 12.5, color: 'var(--ink3)', margin: '0 0 14px' }}>
        Each airport trip’s net fare (amount − expressway) vs your JKIA rate card for that area &amp; vehicle class.
        Contract rates can legitimately differ. Treat this as a review, not a rule.
      </p>

      {matched === 0 ? (
        <div style={{ fontSize: 13.5, color: 'var(--ink3)' }}>
          No trips this month matched a JKIA route on your rate card. Add rates on <Link href="/routes" style={{ color: 'var(--accent)' }}>Routes &amp; rates</Link> to enable this.
        </div>
      ) : (
        <>
          <div className="grid-stats" style={{ marginBottom: 14 }}>
            <Mini label="Trips checked" value={String(matched)} />
            <Mini label="Under-charged" value={kes(underRecovery)} tone={underRecovery > 0 ? 'var(--danger)' : 'var(--ok)'} hint="below card rate" />
            <Mini label="Over card" value={kes(overCharge)} tone="var(--ink)" hint="charged above card" />
          </div>

          {under.length > 0 && (
            <>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink2)', margin: '2px 0 8px' }}>Routes charged below the card</div>
              <div style={{ marginBottom: 14 }}>
                <DataTable rows={under.slice(0, 12)} rowKey={(r) => r.route} empty="No routes are charged below the card." columns={[
                  { label: 'Route', role: 'primary', render: (r) => <strong>{r.route}</strong> },
                  { label: 'Trips', align: 'right', render: (r) => r.trips },
                  { label: 'Card', align: 'right', render: (r) => kes(r.card) },
                  { label: 'Avg charged', align: 'right', render: (r) => kes(r.actual) },
                  { label: 'Below card', align: 'right', render: (r) => <span style={{ color: 'var(--danger)', fontWeight: 600 }}>{r.deltaPct.toFixed(0)}%</span> },
                  { label: 'Month gap', align: 'right', render: (r) => <span style={{ color: 'var(--danger)', fontWeight: 600 }}>{kes(r.totalVar)}</span> },
                ]} />
              </div>
            </>
          )}

          {unmatched.length > 0 && (
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink2)', margin: '2px 0 8px' }}>Busy areas not on your rate card</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {unmatched.map((u) => (
                  <Link key={u.area} href="/routes" style={{ fontSize: 12.5, padding: '5px 11px', borderRadius: 'var(--radius-pill)', background: 'var(--surface2)' }}>
                    {u.area} · <strong>{u.trips}</strong> trips · {kes(u.revenue)}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Mini({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <div style={{ padding: '12px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--surface2)' }}>
      <div style={{ fontSize: 11.5, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      <div className="font-display" style={{ fontSize: 19, fontWeight: 700, marginTop: 3, color: tone ?? 'var(--ink)' }}>{value}</div>
      {hint && <div style={{ fontSize: 11.5, color: 'var(--ink3)', marginTop: 2 }}>{hint}</div>}
    </div>
  )
}
