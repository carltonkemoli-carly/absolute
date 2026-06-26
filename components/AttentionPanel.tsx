import Link from 'next/link'
import type { AttentionItem } from '@/lib/attention'

export default function AttentionPanel({ items }: { items: AttentionItem[] }) {
  const expired = items.filter((i) => i.severity === 'expired').length
  const soon = items.filter((i) => i.severity === 'soon').length

  return (
    <div className="card" style={{ marginBottom: 16, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: items.length ? '1px solid var(--border)' : 'none' }}>
        <div className="font-display" style={{ fontSize: 15, fontWeight: 600 }}>
          Attention {expired > 0 && <span style={{ color: 'var(--danger)' }}>· {expired} overdue</span>}{soon > 0 && <span style={{ color: 'var(--gold)' }}> · {soon} due soon</span>}
        </div>
        <Link href="/compliance" className="btn-ghost" style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-mid)', padding: '6px 13px', whiteSpace: 'nowrap' }}>Manage →</Link>
      </div>
      {items.length === 0 ? (
        <div style={{ padding: 18, fontSize: 14, color: 'var(--ink2)' }}>✓ Nothing expiring soon. All documents and services are up to date.</div>
      ) : (
        <div>
          {items.slice(0, 8).map((i, idx) => {
            const c = i.severity === 'expired' ? 'var(--danger)' : 'var(--gold)'
            const bg = i.severity === 'expired' ? 'var(--danger-light)' : 'var(--gold-light)'
            return (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 18px', borderTop: idx ? '1px solid var(--border)' : 'none' }}>
                <span style={{ width: 8, height: 8, borderRadius: 99, background: c, flexShrink: 0 }} />
                <span style={{ fontWeight: 600, minWidth: 110 }}>{i.subject}</span>
                <span style={{ flex: 1, color: 'var(--ink2)', fontSize: 13.5 }}>
                  {i.kind === 'service' ? 'Service due' : i.label}
                </span>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: c, background: bg, padding: '2px 9px', borderRadius: 99 }}>{i.detail}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
