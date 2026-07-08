'use client'

import { useState } from 'react'
import { StatCard } from '@/components/ui'
import { Bars, SectionTitle } from '@/components/Bars'
import { kes } from '@/lib/format'

type Group = { key: string; label: string; count: number; toll: number; total: number }
type Trend = { label: string; toll: number; count: number }
type Dir = { count: number; toll: number }

export default function ExpresswayInsights({
  period, stats, trend, byOrg, byRoute, dow, direction, bands, hours, timedCount, reimbursement,
}: {
  period: string
  stats: { totalTrips: number; expressCount: number; totalToll: number; prevToll: number; avgToll: number }
  trend: Trend[]
  byOrg: Group[]; byRoute: Group[]
  dow: { day: string; count: number; toll: number }[]
  direction: { to: Dir; from: Dir; other: Dir }
  bands: { amount: number; count: number }[]
  hours: { h: number; count: number; toll: number }[]
  timedCount: number
  reimbursement: { label: string; toll: number; count: number; billed: boolean }[]
}) {
  const [rankBy, setRankBy] = useState<'toll' | 'trips'>('toll')
  const metric = (g: { toll: number; count: number }) => (rankBy === 'toll' ? g.toll : g.count)
  const fmt = (v: number) => (rankBy === 'toll' ? kes(v) : `${v} trip${v === 1 ? '' : 's'}`)
  const sortG = (a: Group, b: Group) => metric(b) - metric(a)

  const pct = stats.totalTrips ? Math.round((stats.expressCount / stats.totalTrips) * 100) : 0
  const delta = stats.prevToll > 0 ? Math.round(((stats.totalToll - stats.prevToll) / stats.prevToll) * 100) : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Overview */}
      <div className="grid-stats">
        <StatCard label="Expressway tolls" value={kes(stats.totalToll)}
          hint={delta === null ? period : `${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta)}% vs last month`}
          accent={delta !== null && delta > 0 ? 'var(--gold)' : 'var(--accent)'} />
        <StatCard label="Expressway trips" value={String(stats.expressCount)} hint={`${pct}% of ${stats.totalTrips} trips`} />
        <StatCard label="Average toll" value={kes(stats.avgToll)} hint="per expressway trip" />
        <StatCard label="Non-expressway" value={String(stats.totalTrips - stats.expressCount)} hint="trips with no toll" />
      </div>

      {/* Trend */}
      <div className="card" style={{ padding: 18 }}>
        <SectionTitle>Toll spend — last 6 months</SectionTitle>
        <Bars items={trend.map((t) => ({ label: t.label, value: t.toll, sub: `${t.count}` }))}
          max={Math.max(1, ...trend.map((t) => t.toll))} format={kes} accent="var(--gold)" />
      </div>

      {/* Rank toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 13, color: 'var(--ink2)' }}>Rank by:</span>
        <div style={{ display: 'inline-flex', border: '1px solid var(--border-med)', borderRadius: 'var(--radius-pill)', overflow: 'hidden' }}>
          {(['toll', 'trips'] as const).map((k) => (
            <button key={k} onClick={() => setRankBy(k)} style={{
              padding: '6px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none',
              background: rankBy === k ? 'var(--accent)' : 'transparent', color: rankBy === k ? 'var(--on-accent)' : 'var(--ink2)',
            }}>{k === 'toll' ? 'Toll spend' : 'Trip count'}</button>
          ))}
        </div>
      </div>


      {/* Clients & routes */}
      <div className="grid-2">
        <div className="card" style={{ padding: 18 }}>
          <SectionTitle>By client (reimbursable)</SectionTitle>
          <p style={tip}>These tolls are billed back — make sure each client is invoiced for them.</p>
          <Bars items={[...byOrg].sort(sortG).slice(0, 10).map((g) => ({ label: g.label, value: metric(g), sub: `${g.count} trips` }))}
            max={Math.max(1, ...byOrg.map(metric))} format={fmt} accent="var(--accent-mid)" />
        </div>
        <div className="card" style={{ padding: 18 }}>
          <SectionTitle>Top expressway routes</SectionTitle>
          <Bars items={[...byRoute].sort(sortG).slice(0, 10).map((g) => ({ label: g.label, value: metric(g), sub: `${g.count} trips` }))}
            max={Math.max(1, ...byRoute.map(metric))} format={fmt} accent="var(--accent-mid)" />
        </div>
      </div>

      {/* Day of week + direction + bands */}
      <div className="grid-2">
        <div className="card" style={{ padding: 18 }}>
          <SectionTitle>Busiest days (expressway)</SectionTitle>
          <Bars items={dow.map((d) => ({ label: d.day, value: metric(d), sub: '' }))}
            max={Math.max(1, ...dow.map(metric))} format={fmt} accent="var(--gold)" />
        </div>
        <div className="card" style={{ padding: 18 }}>
          <SectionTitle>Direction & entry points</SectionTitle>
          <Bars items={[
            { label: 'To JKIA', value: metric(direction.to), sub: kes(direction.to.toll) },
            { label: 'From JKIA', value: metric(direction.from), sub: kes(direction.from.toll) },
            ...(direction.other.count ? [{ label: 'Other', value: metric(direction.other), sub: kes(direction.other.toll) }] : []),
          ]} max={Math.max(1, metric(direction.to), metric(direction.from), metric(direction.other))} format={fmt} accent="var(--accent)" />
          <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <div style={{ fontSize: 12.5, color: 'var(--ink2)', marginBottom: 8 }}>Toll bands (each = a different entry/exit station)</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {bands.map((b) => (
                <span key={b.amount} style={{ fontSize: 12.5, padding: '4px 10px', borderRadius: 'var(--radius-pill)', background: 'var(--surface2)' }}>
                  {kes(b.amount)} · <strong>{b.count}×</strong>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Reimbursement — tolls are billed back to the contractor */}
      <div className="card" style={{ padding: 18 }}>
        <SectionTitle>Toll reimbursement (billed to contractor)</SectionTitle>
        <p style={tip}>Every toll is recoverable. This flags tolls fronted but not yet invoiced for {period}.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {reimbursement.map((r, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 'var(--radius-sm)', background: r.billed ? 'var(--surface2)' : 'var(--danger-light)' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{r.label}</div>
                <div style={{ fontSize: 12.5, color: 'var(--ink3)' }}>{r.count} expressway trips</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="font-display" style={{ fontWeight: 700 }}>{kes(r.toll)}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: r.billed ? 'var(--accent)' : 'var(--danger)' }}>
                  {r.billed ? '✓ invoiced' : '⚠ not invoiced'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Busiest hours */}
      <div className="card" style={{ padding: 18 }}>
        <SectionTitle>Busiest hours (expressway)</SectionTitle>
        {timedCount > 0 ? (
          <>
            <p style={tip}>{timedCount} of {stats.expressCount} expressway trips have a pickup time.</p>
            <Bars
              items={hours.filter((h) => h.count > 0).map((h) => ({ label: `${String(h.h).padStart(2, '0')}:00`, value: metric(h), sub: '' }))}
              max={Math.max(1, ...hours.map(metric))} format={fmt} accent="var(--accent-mid)" />
          </>
        ) : (
          <p style={{ fontSize: 13.5, color: 'var(--ink3)' }}>
            No pickup times recorded yet. Add a <strong>Pickup time</strong> when logging trips (it’s on the trip form now) or include a time column in your import — this chart fills in automatically.
          </p>
        )}
      </div>
    </div>
  )
}

const tip: React.CSSProperties = { fontSize: 12.5, color: 'var(--ink3)', margin: '-4px 0 12px' }
