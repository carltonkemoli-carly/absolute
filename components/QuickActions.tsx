import Link from 'next/link'
import NavIcon from '@/components/NavIcon'

const ACTIONS = [
  { href: '/dispatch', label: 'Dispatch board', icon: 'dispatch' },
  { href: '/trips', label: 'Log / import trips', icon: 'trips' },
  { href: '/quote', label: 'Quote a fare', icon: 'quote' },
  { href: '/fuel', label: 'Record fuel', icon: 'fuel' },
  { href: '/receivables', label: 'Invoices', icon: 'receivables' },
]

export default function QuickActions() {
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
      {ACTIONS.map((a) => (
        <Link
          key={a.href}
          href={a.href}
          className="card card-hover"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '10px 15px', fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}
        >
          <span style={{ color: 'var(--accent-mid)', display: 'inline-flex' }}><NavIcon name={a.icon} /></span>
          {a.label}
        </Link>
      ))}
    </div>
  )
}
