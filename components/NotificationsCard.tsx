'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { AttentionItem } from '@/lib/attention'
import type { BusinessAlert } from '@/lib/alerts'

type Level = 'critical' | 'warning' | 'info'
type Row = { level: Level; title: string; detail: string; href: string }

const TONE: Record<Level, string> = {
  critical: 'var(--danger)',
  warning: 'var(--gold)',
  info: 'var(--accent)',
}

export default function NotificationsCard({ attention, alerts }: { attention: AttentionItem[]; alerts: BusinessAlert[] }) {
  const [open, setOpen] = useState(false)

  const rows: Row[] = [
    ...alerts.map((a) => ({ level: a.level, title: a.title, detail: a.detail, href: a.href })),
    ...attention.map((a) => ({
      level: (a.severity === 'expired' ? 'critical' : a.severity === 'soon' ? 'warning' : 'info') as Level,
      title: `${a.label} · ${a.subject}`,
      detail: a.detail,
      href: a.kind === 'service' ? '/services' : '/compliance',
    })),
  ]

  const crit = rows.filter((r) => r.level === 'critical').length
  const warn = rows.filter((r) => r.level === 'warning').length
  const info = rows.filter((r) => r.level === 'info').length
  const total = rows.length

  if (total === 0) {
    return (
      <div className="card" style={{ padding: '11px 16px', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <Dot tone="var(--accent)" />
        <span style={{ fontSize: 13.5, color: 'var(--ink2)' }}>Nothing needs your attention.</span>
      </div>
    )
  }

  const accent = crit > 0 ? 'var(--danger)' : warn > 0 ? 'var(--gold)' : 'var(--accent)'
  const summary = [crit && `${crit} urgent`, warn && `${warn} warning${warn === 1 ? '' : 's'}`, info && `${info} note${info === 1 ? '' : 's'}`]
    .filter(Boolean).join(' · ')

  return (
    <div className="card" style={{ marginBottom: 18, overflow: 'hidden', borderLeft: `3px solid ${accent}` }}>
      <button onClick={() => setOpen((o) => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '13px 16px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
        <Dot tone={accent} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontWeight: 600, fontSize: 14 }}>{total} item{total === 1 ? '' : 's'} to review</span>
          <span style={{ display: 'block', fontSize: 12.5, color: 'var(--ink3)', marginTop: 1 }}>{summary}</span>
        </span>
        <span style={{ fontSize: 12.5, color: 'var(--ink2)', fontWeight: 600, whiteSpace: 'nowrap' }}>{open ? 'Hide' : 'View'}</span>
      </button>

      {open && (
        <div style={{ borderTop: '1px solid var(--border)' }}>
          {rows.map((r, i) => (
            <Link key={i} href={r.href} style={{ display: 'flex', gap: 12, padding: '11px 16px', borderTop: i ? '1px solid var(--border)' : 'none', alignItems: 'flex-start', textDecoration: 'none', color: 'inherit' }}>
              <span style={{ marginTop: 6 }}><Dot tone={TONE[r.level]} size={7} /></span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600 }}>{r.title}</span>
                <span style={{ display: 'block', fontSize: 12.5, color: 'var(--ink3)', marginTop: 1 }}>{r.detail}</span>
              </span>
              <span style={{ color: 'var(--ink3)', fontSize: 15, flexShrink: 0 }}>›</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

// A plain colour-coded dot — the whole status read at a glance, without a bell
// icon or an emoji doing the signalling.
function Dot({ tone, size = 9 }: { tone: string; size?: number }) {
  return <span style={{ display: 'inline-block', width: size, height: size, borderRadius: 99, background: tone, flexShrink: 0 }} />
}
