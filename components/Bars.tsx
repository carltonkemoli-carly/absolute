// Shared horizontal bar list + section title for the analytics pages
// (Insights, Expressway) so they stay visually identical.

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="font-display" style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>{children}</div>
}

export function Bars({ items, max, format, accent, emptyText = 'No data this month.' }: {
  items: { label: string; value: number; sub: string }[]
  max: number
  format: (v: number) => string
  accent: string
  emptyText?: string
}) {
  if (!items.some((i) => i.value > 0)) return <div style={{ color: 'var(--ink3)', fontSize: 13.5 }}>{emptyText}</div>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      {items.map((it, i) => (
        <div key={i}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 3, gap: 8 }}>
            <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.label}</span>
            <span style={{ color: 'var(--ink2)', whiteSpace: 'nowrap' }}>{format(it.value)}{it.sub ? <span style={{ color: 'var(--ink3)' }}> · {it.sub}</span> : null}</span>
          </div>
          <div style={{ height: 7, borderRadius: 6, background: 'var(--surface2)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.max(2, (it.value / max) * 100)}%`, background: accent, borderRadius: 6, transition: 'width .4s var(--ease)' }} />
          </div>
        </div>
      ))}
    </div>
  )
}
