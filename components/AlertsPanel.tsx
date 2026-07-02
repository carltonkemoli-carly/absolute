import Link from 'next/link'
import type { BusinessAlert } from '@/lib/alerts'

const STYLE: Record<BusinessAlert['level'], { bg: string; color: string; icon: string }> = {
  critical: { bg: 'var(--danger-light)', color: 'var(--danger)', icon: '⛔' },
  warning: { bg: 'var(--gold-light)', color: 'var(--gold)', icon: '⚠' },
  info: { bg: 'var(--accent-light)', color: 'var(--accent)', icon: 'ℹ' },
}

export default function AlertsPanel({ alerts }: { alerts: BusinessAlert[] }) {
  if (alerts.length === 0) {
    return (
      <div className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 18 }}>✅</span>
        <span style={{ fontSize: 14, color: 'var(--ink2)' }}>No issues flagged this month — every car is pulling its weight.</span>
      </div>
    )
  }
  return (
    <div className="card" style={{ padding: 18 }}>
      <div className="font-display" style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>
        Needs your attention <span style={{ color: 'var(--ink3)', fontWeight: 500 }}>· {alerts.length}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {alerts.map((a, i) => {
          const s = STYLE[a.level]
          return (
            <Link key={i} href={a.href} style={{ display: 'flex', gap: 11, padding: '11px 13px', borderRadius: 'var(--radius-sm)', background: s.bg, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 15, lineHeight: 1.3 }}>{s.icon}</span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: s.color }}>{a.title}</span>
                <span style={{ display: 'block', fontSize: 12.5, color: 'var(--ink2)', marginTop: 2 }}>{a.detail}</span>
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
