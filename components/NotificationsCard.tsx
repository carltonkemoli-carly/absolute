'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { AttentionItem } from '@/lib/attention'
import type { BusinessAlert } from '@/lib/alerts'

type Level = 'critical' | 'warning' | 'info'
type Row = { level: Level; title: string; detail: string; href: string }

const META: Record<Level, { color: string; icon: string }> = {
  critical: { color: 'var(--danger)', icon: '⛔' },
  warning: { color: 'var(--gold)', icon: '⚠' },
  info: { color: 'var(--accent)', icon: 'ℹ' },
}

export default function NotificationsCard({ attention, alerts }: { attention: AttentionItem[]; alerts: BusinessAlert[] }) {
  const [open, setOpen] = useState(false)

  const rows: Row[] = [
    ...alerts.map((a) => ({ level: a.level, title: a.title, detail: a.detail, href: a.href })),
    ...attention.map((a) => ({
      level: (a.severity === 'expired' ? 'critical' : 'warning') as Level,
      title: `${a.subject} — ${a.kind === 'service' ? 'Service due' : a.label}`,
      detail: a.detail,
      href: a.kind === 'service' ? '/services' : '/compliance',
    })),
  ]
  const order: Record<Level, number> = { critical: 0, warning: 1, info: 2 }
  rows.sort((a, b) => order[a.level] - order[b.level])

  const crit = rows.filter((r) => r.level === 'critical').length
  const warn = rows.filter((r) => r.level === 'warning').length
  const info = rows.filter((r) => r.level === 'info').length
  const total = rows.length

  if (total === 0) {
    return (
      <div className="card" style={{ padding: '11px 16px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <span style={{ fontSize: 15 }}>✅</span>
        <span style={{ fontSize: 13.5, color: 'var(--ink2)' }}>All clear — nothing needs your attention right now.</span>
      </div>
    )
  }

  const accent = crit > 0 ? 'var(--danger)' : warn > 0 ? 'var(--gold)' : 'var(--accent)'
  const summary = [crit && `${crit} urgent`, warn && `${warn} warning${warn === 1 ? '' : 's'}`, info && `${info} note${info === 1 ? '' : 's'}`].filter(Boolean).join(' · ')

  return (
    <div className="card" style={{ marginBottom: 18, overflow: 'hidden', borderLeft: `3px solid ${accent}` }}>
      <button onClick={() => setOpen((o) => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 13, padding: '12px 16px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
        <span style={{ position: 'relative', fontSize: 17, lineHeight: 1, flexShrink: 0 }}>🔔
          <span style={{ position: 'absolute', top: -7, right: -9, background: accent, color: '#fff', fontSize: 10, fontWeight: 700, minWidth: 16, height: 16, borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>{total}</span>
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontWeight: 700, fontSize: 14 }}>{total} thing{total === 1 ? '' : 's'} need{total === 1 ? 's' : ''} your attention</span>
          <span style={{ display: 'block', fontSize: 12.5, color: 'var(--ink3)', marginTop: 1 }}>{summary}</span>
        </span>
        <span style={{ fontSize: 13, color: accent, fontWeight: 700, whiteSpace: 'nowrap' }}>{open ? 'Hide ▲' : 'View ▾'}</span>
      </button>

      {open && (
        <div style={{ borderTop: '1px solid var(--border)' }}>
          {rows.map((r, i) => {
            const m = META[r.level]
            return (
              <Link key={i} href={r.href} style={{ display: 'flex', gap: 11, padding: '11px 16px', borderTop: i ? '1px solid var(--border)' : 'none', alignItems: 'flex-start' }}>
                <span style={{ color: m.color, fontSize: 14, width: 16, textAlign: 'center', flexShrink: 0 }}>{m.icon}</span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600 }}>{r.title}</span>
                  <span style={{ display: 'block', fontSize: 12.5, color: 'var(--ink3)', marginTop: 1 }}>{r.detail}</span>
                </span>
                <span style={{ color: 'var(--ink3)', fontSize: 15, flexShrink: 0 }}>›</span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
