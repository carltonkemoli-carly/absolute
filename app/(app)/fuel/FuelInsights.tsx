import { kes, fmtDate } from '@/lib/format'

export type VehFuel = {
  id: string
  plate: string
  model: string | null
  fuelCost: number
  litres: number
  km: number
  kmpl: number | null
  trips: number
  rev: number
  fuelPct: number | null
  driverNames: string[]
  washesMonth: number
  lastWash: string | null
}

function pct(x: number | null): string {
  return x === null ? '—' : `${Math.round(x * 100)}%`
}

export default function FuelInsights({ rows, avgKmpl }: { rows: VehFuel[]; avgKmpl: number }) {
  if (rows.length === 0) {
    return <div className="card" style={{ padding: 28, textAlign: 'center', color: 'var(--ink3)', marginBottom: 18 }}>No fuel or trips this month yet.</div>
  }
  const top = rows[0]
  const thirsty = (r: VehFuel) => r.kmpl !== null && avgKmpl > 0 && r.kmpl < avgKmpl * 0.7

  return (
    <>
      {/* Spotlight: the highest-fuel vehicle, with the "why" */}
      <div className="card" style={{ padding: 20, marginBottom: 16, borderLeft: '3px solid var(--gold)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Highest fuel this month</div>
            <div className="font-display" style={{ fontSize: 24, fontWeight: 700, marginTop: 2 }}>{top.plate} <span style={{ fontSize: 15, color: 'var(--ink3)', fontWeight: 500 }}>{top.model ?? ''}</span></div>
          </div>
          <div className="font-display" style={{ fontSize: 28, fontWeight: 700, color: 'var(--ink)' }}>{kes(top.fuelCost)}</div>
        </div>

        <div className="grid-stats" style={{ marginTop: 16, gap: 10 }}>
          <Mini label="Trips" value={String(top.trips)} />
          <Mini label="Distance" value={`${top.km.toLocaleString()} km`} />
          <Mini label="km / litre" value={top.kmpl ? top.kmpl.toFixed(1) : '—'} tone={thirsty(top) ? 'var(--danger)' : undefined} />
          <Mini label="Revenue earned" value={kes(top.rev)} />
          <Mini label="Fuel ÷ revenue" value={pct(top.fuelPct)} tone={top.fuelPct && top.fuelPct > 0.3 ? 'var(--danger)' : 'var(--accent)'} />
          <Mini label="Washes" value={String(top.washesMonth)} tone={top.washesMonth === 0 ? 'var(--danger)' : undefined} />
        </div>

        <div style={{ marginTop: 14, fontSize: 13.5, color: 'var(--ink2)', lineHeight: 1.5 }}>
          <strong>Why:</strong> it covered the most ground — <strong>{top.km.toLocaleString()} km</strong> over <strong>{top.trips} trips</strong>, earning {kes(top.rev)}. Fuel is <strong>{pct(top.fuelPct)}</strong> of what it made{top.fuelPct && top.fuelPct > 0.3 ? ' — on the high side, worth watching.' : ' — reasonable.'}
          {top.driverNames.length > 0 && <> Driven by {top.driverNames.join(', ')}.</>}
          {thirsty(top) && <span style={{ color: 'var(--danger)', fontWeight: 600 }}> ⚠ Low km/litre vs the fleet — possible fuel waste or leakage.</span>}
        </div>
      </div>

      {/* Per-vehicle breakdown */}
      <div className="card" style={{ overflowX: 'auto', marginBottom: 16 }}>
        <table className="zebra" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5, minWidth: 820 }}>
          <thead>
            <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
              <Th>Vehicle</Th><Th right>Trips</Th><Th right>km</Th><Th right>km/l</Th><Th right>Fuel</Th><Th right>Revenue</Th><Th right>Fuel÷rev</Th><Th right>Washes</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ padding: '11px 14px' }}><strong>{r.plate}</strong><div style={{ fontSize: 11.5, color: 'var(--ink3)' }}>{r.driverNames.slice(0, 2).join(', ') || '—'}</div></td>
                <Td right>{r.trips}</Td>
                <Td right>{r.km.toLocaleString()}</Td>
                <Td right><span style={{ color: thirsty(r) ? 'var(--danger)' : 'var(--ink)', fontWeight: 600 }}>{r.kmpl ? r.kmpl.toFixed(1) : '—'}{thirsty(r) ? ' ⚠' : ''}</span></Td>
                <Td right><strong>{kes(r.fuelCost)}</strong></Td>
                <Td right>{kes(r.rev)}</Td>
                <Td right><span style={{ color: r.fuelPct && r.fuelPct > 0.3 ? 'var(--danger)' : 'var(--ink2)' }}>{pct(r.fuelPct)}</span></Td>
                <Td right><span style={{ color: r.washesMonth === 0 ? 'var(--danger)' : 'var(--ink)', fontWeight: r.washesMonth === 0 ? 600 : 400 }}>{r.washesMonth}</span></Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Car wash insight */}
      <div className="card" style={{ padding: 18, marginBottom: 16 }}>
        <div className="font-display" style={{ fontSize: 15, fontWeight: 600, marginBottom: 10 }}>🧼 Car wash — keeping cars presentable</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
          {rows.map((r) => {
            const neglected = r.washesMonth === 0
            return (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 9, background: neglected ? 'var(--danger-light)' : 'var(--surface2)' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{r.plate}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink3)' }}>last wash {r.lastWash ? fmtDate(r.lastWash) : 'never'}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, color: neglected ? 'var(--danger)' : 'var(--accent)' }}>{r.washesMonth}×</div>
                  <div style={{ fontSize: 11, color: neglected ? 'var(--danger)' : 'var(--ink3)' }}>{neglected ? 'not washed!' : 'this month'}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}

function Mini({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '10px 12px' }}>
      <div style={{ fontSize: 11, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      <div className="font-display" style={{ fontSize: 18, fontWeight: 700, marginTop: 3, color: tone ?? 'var(--ink)' }}>{value}</div>
    </div>
  )
}
function Th({ children, right }: { children?: React.ReactNode; right?: boolean }) {
  return <th style={{ padding: '11px 14px', fontSize: 12, fontWeight: 600, color: 'var(--ink2)', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: right ? 'right' : 'left' }}>{children}</th>
}
function Td({ children, right }: { children?: React.ReactNode; right?: boolean }) {
  return <td style={{ padding: '11px 14px', textAlign: right ? 'right' : 'left' }}>{children}</td>
}
