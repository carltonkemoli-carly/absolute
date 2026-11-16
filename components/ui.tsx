import type { ReactNode } from 'react'
import Link from 'next/link'

// A labelled band grouping related cards — the dashboard's "My business" /
// "Operations" rhythm, shared so every page groups content the same way.
export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 26 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, margin: '0 0 12px 2px' }}>
        <h2 className="font-display" style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>{title}</h2>
        {action}
      </div>
      {children}
    </div>
  )
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 22, gap: 12, flexWrap: 'wrap' }}>
      <div>
        <h1 className="font-display" style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>{title}</h1>
        {subtitle && <p style={{ fontSize: 14, color: 'var(--ink2)', margin: '4px 0 0' }}>{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function StatCard({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: string }) {
  return (
    <div className="card card-hover" style={{ padding: '14px 16px' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      {/* Big numbers may wrap to a second line on a narrow card — that is
          better than hiding digits behind an ellipsis. */}
      <div className="font-display" style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', marginTop: 7, color: accent ?? 'var(--ink)' }}>{value}</div>
      {hint && <div style={{ fontSize: 12, color: 'var(--ink3)', marginTop: 4 }}>{hint}</div>}
    </div>
  )
}

// A headline figure with its direction of travel. `delta` is a fraction
// (0.12 = up 12%); pass null when there is nothing fair to compare with.
// `goodWhen` says which direction is good news, so a falling cost can be green.
// `chart` sits along the bottom edge: a Sparkline, or any slim visual.
export function KpiCard({
  label, value, tone, delta, deltaNote, goodWhen = 'up', sub, chart, href,
}: {
  label: string; value: string; tone?: string
  delta?: number | null; deltaNote?: string; goodWhen?: 'up' | 'down'
  sub?: ReactNode; chart?: ReactNode; href?: string
}) {
  const hasDelta = typeof delta === 'number' && Number.isFinite(delta)
  const rounded = hasDelta ? Math.round((delta as number) * 100) : 0
  const up = rounded > 0
  const good = goodWhen === 'up' ? up : !up
  const body = (
    <>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      {/* Sized from the card's own width, so a seven-figure amount still fits
          when the cards sit two-up on a phone. */}
      <div className="font-display" style={{ fontSize: 'clamp(17px, 10.5cqi, 27px)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.15, marginTop: 8, color: tone ?? 'var(--ink)', whiteSpace: 'nowrap' }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--ink3)', lineHeight: 1.5, marginTop: 6, flex: 1 }}>
        {hasDelta && (
          <div>
            {rounded === 0
              ? <span style={{ fontWeight: 600, color: 'var(--ink2)' }}>No change</span>
              : <span style={{ fontWeight: 700, color: good ? 'var(--ok)' : 'var(--danger)' }}>{up ? '▲' : '▼'} {Math.abs(rounded)}%</span>}
            {deltaNote && <span> {deltaNote}</span>}
          </div>
        )}
        {sub && <div>{sub}</div>}
      </div>
      {chart && <div style={{ marginTop: 10 }}>{chart}</div>}
    </>
  )
  const style = { padding: '15px 17px 14px', display: 'flex', flexDirection: 'column', color: 'inherit', textDecoration: 'none', minWidth: 0, containerType: 'inline-size' } as const
  return href
    ? <Link href={href} className="card card-hover" style={style}>{body}</Link>
    : <div className="card" style={style}>{body}</div>
}

export function Card({ title, action, children, pad = true }: { title?: string; action?: ReactNode; children: ReactNode; pad?: boolean }) {
  return (
    <div className="card">
      {title && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
          <div className="font-display" style={{ fontSize: 15, fontWeight: 600 }}>{title}</div>
          {action}
        </div>
      )}
      <div style={{ padding: pad ? 18 : 0 }}>{children}</div>
    </div>
  )
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div style={{ padding: '36px 18px', textAlign: 'center', color: 'var(--ink3)', fontSize: 14 }}>
      {message}
    </div>
  )
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'green' | 'gold' | 'red' }) {
  const tones: Record<string, { bg: string; fg: string }> = {
    neutral: { bg: 'var(--surface2)', fg: 'var(--ink2)' },
    green: { bg: 'var(--accent-light)', fg: 'var(--accent)' },
    gold: { bg: 'var(--gold-light)', fg: 'var(--gold)' },
    red: { bg: 'var(--danger-light)', fg: 'var(--danger)' },
  }
  const t = tones[tone]
  return (
    <span style={{ display: 'inline-block', padding: '2px 9px', borderRadius: 99, fontSize: 12, fontWeight: 600, background: t.bg, color: t.fg }}>
      {children}
    </span>
  )
}
