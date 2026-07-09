'use client'

import { kes } from '@/lib/format'

export interface MonthRow {
  ym: string
  label: string
  revenue: number
  fuel: number
  service: number
  expenses: number
  express: number
  profit: number
  margin: number
  index: number
  trips: number
}

export default function ReportsView({ months }: { months: MonthRow[] }) {
  const maxRevenue = Math.max(1, ...months.map((m) => m.revenue))
  const latest = months[months.length - 1]
  const prev = months[months.length - 2]
  const delta = latest && prev && prev.revenue ? ((latest.revenue - prev.revenue) / prev.revenue) * 100 : null

  return (
    <div>
      <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <button className="btn-ghost" style={{ padding: '8px 16px', fontSize: 13.5, cursor: 'pointer' }} onClick={() => window.print()}>
          🖨 Print / Save as PDF
        </button>
      </div>

      <div className="grid-stats" style={{ marginBottom: 18 }}>
        <Stat label="Latest month revenue" value={kes(latest?.revenue ?? 0)} hint={delta === null ? latest?.label : `${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta).toFixed(0)}% vs prior`} tone={delta !== null && delta < 0 ? 'var(--danger)' : 'var(--accent)'} />
        <Stat label="Gross profit" value={kes(latest?.profit ?? 0)} hint={`${((latest?.margin ?? 0) * 100).toFixed(0)}% · before wages/insurance/loans`} tone={(latest?.profit ?? 0) < 0 ? 'var(--danger)' : 'var(--accent)'} />
        <Stat label="Fuel index" value={`${((latest?.index ?? 0) * 100).toFixed(1)}%`} tone={(latest?.index ?? 0) > 0.3 ? 'var(--danger)' : 'var(--accent)'} />
        <Stat label="6-month revenue" value={kes(months.reduce((a, m) => a + m.revenue, 0))} />
      </div>

      {/* Revenue vs profit bars */}
      <div className="card" style={{ padding: 18, marginBottom: 16 }}>
        <div className="font-display" style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Revenue &amp; profit — last {months.length} months</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 18, height: 220, paddingBottom: 8 }}>
          {months.map((m) => (
            <div key={m.ym} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: '100%' }}>
                <div title={`Revenue ${kes(m.revenue)}`} style={{ width: 16, height: `${(m.revenue / maxRevenue) * 100}%`, background: 'var(--accent-mid)', borderRadius: '4px 4px 0 0' }} />
                <div title={`Profit ${kes(m.profit)}`} style={{ width: 16, height: `${(Math.max(0, m.profit) / maxRevenue) * 100}%`, background: 'var(--gold)', borderRadius: '4px 4px 0 0' }} />
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink2)', fontWeight: 500 }}>{m.label}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 18, marginTop: 8, fontSize: 12.5, color: 'var(--ink2)' }}>
          <Legend color="var(--accent-mid)" text="Revenue" />
          <Legend color="var(--gold)" text="Gross profit (revenue − fuel)" />
        </div>
      </div>

      {/* Monthly table */}
      <div className="card" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
          <thead>
            <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
              <Th>Month</Th><Th right>Trips</Th><Th right>Revenue</Th><Th right>Fuel</Th><Th right>Gross profit</Th><Th right>Margin</Th><Th right>Fuel index</Th>
            </tr>
          </thead>
          <tbody>
            {months.map((m) => (
              <tr key={m.ym} style={{ borderTop: '1px solid var(--border)' }}>
                <Td><strong>{m.label}</strong></Td>
                <Td right>{m.trips}</Td>
                <Td right>{kes(m.revenue)}</Td>
                <Td right>{kes(m.fuel)}</Td>
                <Td right><strong style={{ color: m.profit < 0 ? 'var(--danger)' : 'var(--ink)' }}>{kes(m.profit)}</strong></Td>
                <Td right><span style={{ color: m.margin < 0 ? 'var(--danger)' : 'var(--ink2)', fontWeight: 600 }}>{(m.margin * 100).toFixed(0)}%</span></Td>
                <Td right><span style={{ color: m.index > 0.35 ? 'var(--danger)' : 'var(--accent)', fontWeight: 600 }}>{(m.index * 100).toFixed(1)}%</span></Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <style>{`@media print { .no-print { display: none } aside { display: none } }`}</style>
    </div>
  )
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <div className="card" style={{ padding: '16px 18px' }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink2)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      <div className="font-display" style={{ fontSize: 24, fontWeight: 700, marginTop: 6, color: tone ?? 'var(--ink)' }}>{value}</div>
      {hint && <div style={{ fontSize: 12.5, color: 'var(--ink3)', marginTop: 4 }}>{hint}</div>}
    </div>
  )
}
function Legend({ color, text }: { color: string; text: string }) {
  return <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 11, height: 11, borderRadius: 3, background: color }} />{text}</span>
}
function Th({ children, right }: { children?: React.ReactNode; right?: boolean }) {
  return <th style={{ padding: '11px 14px', fontSize: 12, fontWeight: 600, color: 'var(--ink2)', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: right ? 'right' : 'left' }}>{children}</th>
}
function Td({ children, right }: { children?: React.ReactNode; right?: boolean }) {
  return <td style={{ padding: '11px 14px', textAlign: right ? 'right' : 'left' }}>{children}</td>
}
