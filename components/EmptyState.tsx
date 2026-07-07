import Link from 'next/link'

// Friendly, consistent empty state with an optional call-to-action.
export default function EmptyState({
  icon = '📭', title, hint, cta,
}: {
  icon?: string
  title: string
  hint?: string
  cta?: { href: string; label: string }
}) {
  return (
    <div style={{ textAlign: 'center', padding: '30px 18px' }}>
      <div style={{ fontSize: 26, marginBottom: 8, opacity: 0.6 }}>{icon}</div>
      <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--ink2)' }}>{title}</div>
      {hint && <div style={{ fontSize: 13, color: 'var(--ink3)', marginTop: 4, maxWidth: 380, marginInline: 'auto' }}>{hint}</div>}
      {cta && (
        <Link href={cta.href} className="btn-primary" style={{ display: 'inline-block', marginTop: 14, padding: '8px 16px', fontSize: 13.5 }}>
          {cta.label}
        </Link>
      )}
    </div>
  )
}
