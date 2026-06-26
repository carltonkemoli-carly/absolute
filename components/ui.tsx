import type { ReactNode } from 'react'

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
    <div className="card card-hover" style={{ padding: '16px 18px' }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink2)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      <div className="font-display" style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', marginTop: 6, color: accent ?? 'var(--ink)' }}>{value}</div>
      {hint && <div style={{ fontSize: 12.5, color: 'var(--ink3)', marginTop: 4 }}>{hint}</div>}
    </div>
  )
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
