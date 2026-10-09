'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { kes } from '@/lib/format'
import { saveSupplierTargets } from './actions'

// Target vs actual for one supplier, with the goal editable in place — the
// numbers and the thing they are measured against live together.
export default function SupplierTargets({
  contractorId, contractorName, period, periodLabel, pace,
  revenueTarget, revenueActual, tripsTarget, tripsActual,
}: {
  contractorId: string; contractorName: string; period: string; periodLabel: string
  pace: number // how much of the month has elapsed; 1 once the month is over
  revenueTarget: number; revenueActual: number
  tripsTarget: number; tripsActual: number
}) {
  const [editing, setEditing] = useState(false)
  const hasTargets = revenueTarget > 0 || tripsTarget > 0

  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
        <div className="font-display" style={{ fontSize: 15, fontWeight: 600 }}>Target · {periodLabel}</div>
        <button className="btn-ghost" style={{ padding: '5px 12px', fontSize: 12.5, cursor: 'pointer' }} onClick={() => setEditing((v) => !v)}>
          {editing ? 'Cancel' : hasTargets ? 'Edit' : 'Set a target'}
        </button>
      </div>

      {!editing && !hasTargets && (
        <p style={{ fontSize: 13.5, color: 'var(--ink3)', margin: 0 }}>
          No target set for {contractorName} this month. Setting one is how you tell whether the account is growing or quietly shrinking.
        </p>
      )}

      {!editing && hasTargets && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {revenueTarget > 0 && <Goal label="Revenue" actual={revenueActual} target={revenueTarget} pace={pace} format={kes} />}
          {tripsTarget > 0 && <Goal label="Trips" actual={tripsActual} target={tripsTarget} pace={pace} format={(n) => `${Math.round(n)}`} />}
        </div>
      )}

      {editing && (
        <form
          action={async (fd) => { await saveSupplierTargets(fd); setEditing(false); toast.success(`Target saved for ${contractorName}.`) }}
          style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}
        >
          <input type="hidden" name="contractor_id" value={contractorId} />
          <input type="hidden" name="period" value={period} />
          <label className="field"><span>Revenue target (KES)</span>
            <input name="revenue_target" type="number" step="1" className="input" defaultValue={revenueTarget || ''} placeholder="e.g. 900000" />
          </label>
          <label className="field"><span>Trips target</span>
            <input name="trips_target" type="number" step="1" className="input" defaultValue={tripsTarget || ''} placeholder="e.g. 110" />
          </label>
          <button type="submit" className="btn-primary" style={{ padding: '9px 18px', fontSize: 14, cursor: 'pointer' }}>Save</button>
        </form>
      )}
    </div>
  )
}

// Judged against where the month has actually reached, not against the full month.
// A third of the way through, a third of the target is on track — showing that as
// "33%" in red would make every account look like it is failing until month end.
function Goal({ label, actual, target, pace, format }: {
  label: string; actual: number; target: number; pace: number; format: (n: number) => string
}) {
  const pct = target > 0 ? actual / target : 0
  const expected = target * pace
  const partial = pace < 1
  const tone = pct >= 1 ? 'var(--accent)'
    : actual >= expected ? 'var(--accent)'
      : actual >= expected * 0.7 ? 'var(--gold)' : 'var(--danger)'
  const note = pct >= 1 ? 'Target met'
    : partial
      ? actual >= expected
        ? `Ahead of pace — ${format(expected)} expected by today`
        : `${format(expected - actual)} behind today's pace of ${format(expected)}`
      : `${format(target - actual)} short`

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4, gap: 8 }}>
        <span style={{ fontWeight: 500 }}>{label}</span>
        <span style={{ color: 'var(--ink2)' }}>
          {format(actual)} / {format(target)} <span style={{ fontWeight: 700, color: tone }}>{Math.round(pct * 100)}%</span>
        </span>
      </div>
      <div style={{ position: 'relative', height: 8, borderRadius: 6, background: 'var(--surface2)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(100, Math.round(pct * 100))}%`, background: tone, borderRadius: 6, transition: 'width .4s var(--ease)' }} />
        {/* Where the month has reached — the line the bar should be keeping up with. */}
        {partial && (
          <span style={{ position: 'absolute', top: -2, bottom: -2, left: `${Math.min(100, pace * 100)}%`, width: 2, background: 'var(--ink3)', opacity: 0.55 }} />
        )}
      </div>
      <div style={{ fontSize: 12, color: 'var(--ink3)', marginTop: 3 }}>{note}</div>
    </div>
  )
}
