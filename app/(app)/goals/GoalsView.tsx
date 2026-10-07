'use client'

import { useMemo, useState } from 'react'
import { kes, kesPlain } from '@/lib/format'
import SegmentDonut, { type Seg } from '@/components/SegmentDonut'
import { saveTargets } from './actions'

export type CostLine = { category: string; amount: number; cap: number | null }

const COST_COLORS = ['#BC3E22', '#C9A227', '#2F9E8F', '#3E7CB1', '#7A5FB0', '#D98A3D', '#2C7A53', '#9A6A4B', '#5C8A72', '#A8527C']

export default function GoalsView({
  period, revenue, costs, revenueTarget, profitTarget, profitLabel, profitHint, costsComplete,
}: {
  period: string; revenue: number; costs: CostLine[]; revenueTarget: number; profitTarget: number
  profitLabel: string; profitHint: string; costsComplete: boolean
}) {
  const [cuts, setCuts] = useState<Record<string, number>>({})
  const [editing, setEditing] = useState(false)

  const totalCost = costs.reduce((a, c) => a + c.amount, 0)
  const netProfit = revenue - totalCost
  const margin = revenue > 0 ? netProfit / revenue : 0

  const projectedCost = useMemo(
    () => costs.reduce((a, c) => a + c.amount * (1 - (cuts[c.category] ?? 0) / 100), 0),
    [costs, cuts],
  )
  const projNet = revenue - projectedCost
  const projMargin = revenue > 0 ? projNet / revenue : 0
  const anyCut = Object.values(cuts).some((v) => v > 0)

  const costSegs: Seg[] = costs
    .filter((c) => c.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .map((c, i) => ({ label: c.category, value: c.amount, color: COST_COLORS[i % COST_COLORS.length] }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Headline */}
      <div className="grid-stats">
        <Stat label="Revenue" value={kes(revenue)} hint={revenueTarget ? `${pct(revenue / revenueTarget)} of ${kes(revenueTarget)} target` : 'no target set'} tone="var(--accent)" />
        <Stat label="Total costs" value={kes(totalCost)} hint={`${pct(revenue > 0 ? totalCost / revenue : 0)} of revenue`} />
        <Stat label={profitLabel} value={kes(netProfit)} hint={profitTarget ? `${pct(profitTarget > 0 ? netProfit / profitTarget : 0)} of ${kes(profitTarget)} target` : profitHint} tone={netProfit < 0 ? 'var(--danger)' : costsComplete ? 'var(--accent)' : 'var(--gold)'} />
        <Stat label={costsComplete ? 'Net margin' : 'Margin before wages'} value={pct(margin)} tone={margin < 0.1 ? 'var(--danger)' : costsComplete ? 'var(--accent)' : 'var(--gold)'} />
      </div>

      <div className={costSegs.length > 0 ? 'grid-2' : undefined}>
        {costSegs.length > 0 && (
          <Card title="Where the money goes">
            <SegmentDonut data={costSegs} centerValue={kesPlain(totalCost)} centerLabel="Ksh costs" centerSize={18} money />
          </Card>
        )}
        <Card title="Profit & Loss">
          <Row label="Revenue" value={kes(revenue)} strong />
          <div style={{ height: 6 }} />
          {costs.map((c) => (
            <Row key={c.category} label={c.category} value={`(${kes(c.amount)})`} sub={pct(revenue > 0 ? c.amount / revenue : 0)} />
          ))}
          <div style={{ borderTop: '1px solid var(--border)', margin: '8px 0' }} />
          <Row label="Total costs" value={`(${kes(totalCost)})`} />
          <Row label={profitLabel} value={kes(netProfit)} strong tone={netProfit < 0 ? 'var(--danger)' : costsComplete ? 'var(--accent)' : 'var(--gold)'} />
          <Row label={costsComplete ? 'Net margin' : 'Margin before wages'} value={pct(margin)} sub="" />
        </Card>
      </div>

      {/* Goals */}
      <Card title="Goals this quarter">
        <Goal label="Revenue" actual={revenue} target={revenueTarget} higherIsBetter />
        <Goal label={profitLabel} actual={netProfit} target={profitTarget} higherIsBetter />
        <div style={{ height: 8 }} />
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink2)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>Spend caps</div>
        {costs.filter((c) => c.cap !== null).length === 0 && <div style={{ fontSize: 13.5, color: 'var(--ink3)' }}>No spend caps set. Use “Edit targets”.</div>}
        {costs.filter((c) => c.cap !== null).map((c) => <Goal key={c.category} label={c.category} actual={c.amount} target={c.cap as number} />)}
      </Card>

      {/* What-if */}
      <Card title="What-if — model a spend cut">
        <div style={{ fontSize: 13.5, color: 'var(--ink2)', marginBottom: 14 }}>
          Drag a slider to see what happens to profit if you reduce spend on an item. Nothing is saved — it’s just for planning.
        </div>
        <div className="grid-2" style={{ gap: 24 }}>
          <div>
            {costs.map((c) => {
              const cut = cuts[c.category] ?? 0
              const newAmt = c.amount * (1 - cut / 100)
              return (
                <div key={c.category} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, marginBottom: 3 }}>
                    <span style={{ fontWeight: 600 }}>{c.category}</span>
                    <span style={{ color: cut > 0 ? 'var(--accent)' : 'var(--ink3)' }}>
                      −{cut}% → {kes(newAmt)}
                    </span>
                  </div>
                  <input type="range" min={0} max={50} step={5} value={cut}
                    onChange={(e) => setCuts((s) => ({ ...s, [c.category]: Number(e.target.value) }))}
                    style={{ width: '100%', accentColor: 'var(--accent-mid)' }} />
                </div>
              )
            })}
            {anyCut && (
              <button className="btn-ghost" style={{ padding: '6px 14px', fontSize: 13, cursor: 'pointer', marginTop: 4 }} onClick={() => setCuts({})}>Reset</button>
            )}
          </div>
          <div style={{ background: 'var(--surface2)', borderRadius: 12, padding: 18, alignSelf: 'start' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink2)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Projected {profitLabel.toLowerCase()}</div>
            <div className="font-display" style={{ fontSize: 30, fontWeight: 700, margin: '6px 0 2px', color: projNet < 0 ? 'var(--danger)' : 'var(--accent)' }}>{kes(projNet)}</div>
            <div style={{ fontSize: 13.5, color: 'var(--ink2)' }}>
              margin {pct(projMargin)}
              {anyCut && <span style={{ color: 'var(--accent)', fontWeight: 600 }}> · {projNet >= netProfit ? '+' : ''}{kes(projNet - netProfit)} vs now</span>}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--ink3)', marginTop: 10 }}>Saving {kes(totalCost - projectedCost)} in costs.</div>
          </div>
        </div>
      </Card>

      {/* Targets editor */}
      <Card title="Targets" action={<button className="btn-ghost" style={{ padding: '6px 14px', fontSize: 13, cursor: 'pointer' }} onClick={() => setEditing((v) => !v)}>{editing ? 'Close' : 'Edit targets'}</button>}>
        {!editing ? (
          <div style={{ fontSize: 13.5, color: 'var(--ink2)' }}>
            Revenue target {revenueTarget ? kes(revenueTarget) : '—'} · Profit target {profitTarget ? kes(profitTarget) : '—'} · {costs.filter((c) => c.cap !== null).length} spend cap(s). Click “Edit targets” to change them for this quarter.
          </div>
        ) : (
          <form action={async (fd) => { await saveTargets(fd); setEditing(false) }}>
            <input type="hidden" name="period" value={period} />
            <div className="grid-form">
              <label className="field"><span>Revenue target (KES)</span>
                <input name="revenue_target" type="number" step="1" className="input" defaultValue={revenueTarget || ''} />
              </label>
              <label className="field"><span>Net profit target (KES)</span>
                <input name="profit_target" type="number" step="1" className="input" defaultValue={profitTarget || ''} />
              </label>
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink2)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '16px 0 8px' }}>Spend caps per category (0 = none)</div>
            <div className="grid-form">
              {costs.map((c) => (
                <label key={c.category} className="field"><span>{c.category}</span>
                  <input name={`cap_${c.category}`} type="number" step="1" className="input" defaultValue={c.cap ?? ''} placeholder={`spent ${kes(c.amount)}`} />
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button type="submit" className="btn-primary" style={{ padding: '9px 20px', fontSize: 14, cursor: 'pointer' }}>Save targets</button>
              <button type="button" className="btn-ghost" style={{ padding: '9px 18px', fontSize: 14, cursor: 'pointer' }} onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </form>
        )}
      </Card>
    </div>
  )
}

function pct(x: number): string { return `${Math.round(x * 100)}%` }

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <div className="card" style={{ padding: '16px 18px' }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink2)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      <div className="font-display" style={{ fontSize: 24, fontWeight: 700, marginTop: 6, color: tone ?? 'var(--ink)' }}>{value}</div>
      {hint && <div style={{ fontSize: 12.5, color: 'var(--ink3)', marginTop: 4 }}>{hint}</div>}
    </div>
  )
}

function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
        <div className="font-display" style={{ fontSize: 15, fontWeight: 600 }}>{title}</div>
        {action}
      </div>
      <div style={{ padding: 18 }}>{children}</div>
    </div>
  )
}

function Row({ label, value, sub, strong, tone }: { label: string; value: string; sub?: string; strong?: boolean; tone?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '4px 0' }}>
      <span style={{ fontSize: 14, fontWeight: strong ? 700 : 500, color: tone ?? 'var(--ink)' }}>{label}</span>
      <span style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
        {sub ? <span style={{ fontSize: 12, color: 'var(--ink3)' }}>{sub}</span> : null}
        <span className="font-display" style={{ fontSize: strong ? 16 : 14, fontWeight: strong ? 700 : 500, color: tone ?? 'var(--ink)' }}>{value}</span>
      </span>
    </div>
  )
}

function Goal({ label, actual, target, higherIsBetter }: { label: string; actual: number; target: number; higherIsBetter?: boolean }) {
  const ratio = target > 0 ? actual / target : 0
  // For caps (spend), over target is bad. For revenue/profit, under is "still working toward".
  const color = higherIsBetter
    ? (ratio >= 1 ? 'var(--accent)' : 'var(--gold)')
    : (ratio >= 1 ? 'var(--danger)' : ratio >= 0.85 ? 'var(--gold)' : 'var(--accent-mid)')
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, marginBottom: 4 }}>
        <span style={{ fontWeight: 600 }}>{label}</span>
        <span style={{ color: 'var(--ink2)' }}>{kes(actual)}{target > 0 ? ` / ${kes(target)}` : ''} {target > 0 && <strong style={{ color }}>{Math.round(ratio * 100)}%</strong>}</span>
      </div>
      <div style={{ height: 8, background: 'var(--surface2)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(100, Math.max(0, ratio * 100))}%`, background: color, borderRadius: 99 }} />
      </div>
    </div>
  )
}
