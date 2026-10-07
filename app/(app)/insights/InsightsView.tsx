'use client'

import { useState } from 'react'
import { StatCard } from '@/components/ui'
import { Bars, SectionTitle } from '@/components/Bars'
import { kes } from '@/lib/format'

type Rev = { label: string; revenue: number; trips: number }

export default function InsightsView({
  period, pl, trend, byClient, byRoute, byContractor, dow, byVehicle, byDriver, attrCoverage,
}: {
  period: string
  pl: { revenue: number; fuel: number; costs: number; net: number; prevRev: number; prevLabel: string; fuelPct: number; costsComplete: boolean; profitLabel: string; profitHint: string }
  trend: { label: string; revenue: number; net: number }[]
  byClient: Rev[]; byRoute: Rev[]; byContractor: Rev[]; dow: Rev[]
  byVehicle: Rev[]; byDriver: Rev[]; attrCoverage: number
}) {
  const [by, setBy] = useState<'revenue' | 'trips'>('revenue')
  const val = (g: Rev) => (by === 'revenue' ? g.revenue : g.trips)
  const fmt = (v: number) => (by === 'revenue' ? kes(v) : `${v} trip${v === 1 ? '' : 's'}`)
  const sortR = (a: Rev, b: Rev) => val(b) - val(a)

  const delta = pl.prevRev > 0 ? Math.round(((pl.revenue - pl.prevRev) / pl.prevRev) * 100) : null
  const margin = pl.revenue > 0 ? Math.round((pl.net / pl.revenue) * 100) : 0
  const profitLabel = pl.profitLabel
  const profitHint = `${margin}% · ${pl.profitHint}`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Headline P&L */}
      <div className="grid-stats">
        <StatCard label="Revenue" value={kes(pl.revenue)} hint={delta === null ? period : `${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta)}% ${pl.prevLabel}`} accent={delta !== null && delta < 0 ? 'var(--danger)' : 'var(--accent)'} />
        <StatCard label={profitLabel} value={kes(pl.net)} hint={profitHint} accent={pl.costsComplete ? 'var(--accent)' : 'var(--gold)'} />
        <StatCard label="Fuel-to-sales" value={`${pl.fuelPct}%`} hint={`${kes(pl.fuel)} fuel`} accent={pl.fuelPct > 32 ? 'var(--gold)' : 'var(--accent)'} />
        <StatCard label="Costs logged" value={kes(pl.costs)} hint={pl.costsComplete ? 'every cost behind the figure above' : 'wages still missing'} />
      </div>

      {/* Trend */}
      <div className="card" style={{ padding: 18 }}>
        <SectionTitle>Revenue &amp; {pl.costsComplete ? 'net' : 'before-wages'} profit — last 6 months</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {trend.map((t, i) => {
            const max = Math.max(1, ...trend.map((x) => x.revenue))
            const m = t.revenue > 0 ? Math.round((t.net / t.revenue) * 100) : 0
            return (
              <div key={i}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 3 }}>
                  <span style={{ fontWeight: 500 }}>{t.label}</span>
                  <span style={{ color: 'var(--ink2)' }}>{kes(t.revenue)} <span style={{ color: t.net >= 0 ? 'var(--accent)' : 'var(--danger)' }}>· {kes(t.net)} ({m}%)</span></span>
                </div>
                <div style={{ height: 8, borderRadius: 6, background: 'var(--surface2)', overflow: 'hidden', position: 'relative' }}>
                  <div style={{ height: '100%', width: `${(t.revenue / max) * 100}%`, background: 'var(--accent-light)', position: 'absolute' }} />
                  <div style={{ height: '100%', width: `${(Math.max(0, t.net) / max) * 100}%`, background: 'var(--accent)', position: 'absolute', borderRadius: 6 }} />
                </div>
              </div>
            )
          })}
        </div>
        <p style={{ fontSize: 12, color: 'var(--ink3)', marginTop: 8 }}>Light bar = revenue · solid = {pl.costsComplete ? 'net profit (after all logged costs)' : 'profit before wages (wages not logged yet)'}.</p>
      </div>

      {/* Rank toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 13, color: 'var(--ink2)' }}>Rank by:</span>
        <div style={{ display: 'inline-flex', border: '1px solid var(--border-med)', borderRadius: 'var(--radius-pill)', overflow: 'hidden' }}>
          {(['revenue', 'trips'] as const).map((k) => (
            <button key={k} onClick={() => setBy(k)} style={{ padding: '6px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', background: by === k ? 'var(--accent)' : 'transparent', color: by === k ? 'var(--on-accent)' : 'var(--ink2)' }}>
              {k === 'revenue' ? 'Revenue' : 'Trip count'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid-2">
        <div className="card" style={{ padding: 18 }}>
          <SectionTitle>Top clients</SectionTitle>
          <Bars items={[...byClient].sort(sortR).slice(0, 10).map((g) => ({ label: g.label, value: val(g), sub: `${g.trips} trips` }))}
            max={Math.max(1, ...byClient.map(val))} format={fmt} accent="var(--accent-mid)" />
        </div>
        <div className="card" style={{ padding: 18 }}>
          <SectionTitle>Top routes</SectionTitle>
          <Bars items={[...byRoute].sort(sortR).slice(0, 10).map((g) => ({ label: g.label, value: val(g), sub: `${g.trips} trips` }))}
            max={Math.max(1, ...byRoute.map(val))} format={fmt} accent="var(--accent-mid)" />
        </div>
        <div className="card" style={{ padding: 18 }}>
          <SectionTitle>By day of week</SectionTitle>
          <Bars items={dow.map((g) => ({ label: g.label, value: val(g), sub: '' }))}
            max={Math.max(1, ...dow.map(val))} format={fmt} accent="var(--gold)" />
        </div>
      </div>

      {byContractor.length > 1 && (
        <div className="card" style={{ padding: 18 }}>
          <SectionTitle>By contractor</SectionTitle>
          <Bars items={[...byContractor].sort(sortR).map((g) => ({ label: g.label, value: val(g), sub: `${g.trips} trips` }))}
            max={Math.max(1, ...byContractor.map(val))} format={fmt} accent="var(--accent-mid)" />
        </div>
      )}

      {/* Fleet & drivers — real attribution only */}
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, margin: '2px 2px 10px' }}>
          <span className="font-display" style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Fleet &amp; drivers</span>
          <span style={{ fontSize: 12, color: 'var(--ink3)' }}>{Math.round(attrCoverage * 100)}% of trips assigned</span>
        </div>
        {byVehicle.length === 0 ? (
          <div className="card" style={{ padding: 20, fontSize: 13.5, color: 'var(--ink2)' }}>
            No trips are assigned to a vehicle or driver this month yet. Assign them on the <a href="/trips" style={{ color: 'var(--accent-mid)', fontWeight: 600 }}>Trips</a> page and per-car / per-driver earnings appear here.
          </div>
        ) : (
          <div className="grid-2">
            <div className="card" style={{ padding: 18 }}>
              <SectionTitle>By vehicle</SectionTitle>
              <Bars items={[...byVehicle].sort(sortR).slice(0, 10).map((g) => ({ label: g.label, value: val(g), sub: `${g.trips} trips` }))}
                max={Math.max(1, ...byVehicle.map(val))} format={fmt} accent="var(--accent)" />
            </div>
            <div className="card" style={{ padding: 18 }}>
              <SectionTitle>By driver</SectionTitle>
              <Bars items={[...byDriver].sort(sortR).slice(0, 10).map((g) => ({ label: g.label, value: val(g), sub: `${g.trips} trips` }))}
                max={Math.max(1, ...byDriver.map(val))} format={fmt} accent="var(--gold)" />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

