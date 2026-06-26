'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import NavProgress from '@/components/NavProgress'
import DemoUserSwitch from '@/components/DemoUserSwitch'
import type { Profile } from '@/lib/types'

type NavItem = { href: string; label: string; icon: string; financeOnly?: boolean }

const NAV: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: '◧', financeOnly: true },
  { href: '/dispatch', label: 'Dispatch', icon: '🧭' },
  { href: '/flights', label: 'Flights', icon: '✈' },
  { href: '/trips', label: 'Trips', icon: '➜' },
  { href: '/fuel', label: 'Fuel', icon: '⛽' },
  { href: '/services', label: 'Servicing', icon: '🔧' },
  { href: '/vehicles', label: 'Fleet', icon: '🚐' },
  { href: '/drivers', label: 'Drivers', icon: '👤' },
  { href: '/routes', label: 'Routes & rates', icon: '🗺' },
  { href: '/compliance', label: 'Compliance', icon: '🛡' },
  { href: '/expenses', label: 'Expenses', icon: '💸', financeOnly: true },
  { href: '/goals', label: 'Targets & P&L', icon: '🎯', financeOnly: true },
  { href: '/billing', label: 'Billing', icon: '🧾', financeOnly: true },
  { href: '/reports', label: 'Reports', icon: '📈', financeOnly: true },
  { href: '/backup', label: 'Backup', icon: '💾', financeOnly: true },
  { href: '/settings', label: 'Settings', icon: '⚙' },
]

export default function AppShell({
  profile, canFinance, devMode, children,
}: { profile: Profile; canFinance: boolean; devMode: boolean; children: React.ReactNode }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const items = NAV.filter((i) => !i.financeOnly || canFinance)

  // Close the drawer whenever the route changes
  useEffect(() => { setOpen(false) }, [pathname])

  const activeLabel = items.find((i) => (i.href === '/' ? pathname === '/' : pathname.startsWith(i.href)))?.label ?? 'Menu'

  return (
    <div className="app-layout">
      <NavProgress />
      <div className={`sidebar-backdrop${open ? ' show' : ''}`} onClick={() => setOpen(false)} />

      <aside className={`app-sidebar${open ? ' open' : ''}`}>
        <div style={{ padding: '22px 20px 18px' }}>
          <div className="font-display" style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.14em', color: 'var(--accent-mid)', textTransform: 'uppercase' }}>
            Absolute Comfort
          </div>
          <div className="font-display" style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-0.02em', marginTop: 2 }}>
            Travel Ops
          </div>
        </div>

        <nav className="scroll-thin" style={{ flex: 1, padding: '4px 12px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
          {items.map((item) => {
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
            return (
              <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className={`nav-link${active ? ' nav-active' : ''}`}>
                <span style={{ width: 18, textAlign: 'center', fontSize: 14 }}>{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div style={{ padding: 14, borderTop: '1px solid var(--border)' }}>
          {devMode && <DemoUserSwitch activeRole={profile.role} />}
          <div style={{ fontSize: 13, fontWeight: 600 }}>{profile.full_name ?? 'User'}</div>
          <div style={{ fontSize: 12, color: 'var(--ink3)', textTransform: 'capitalize', marginBottom: 10 }}>{profile.role}</div>
          <form action="/auth/signout" method="post">
            <button type="submit" className="btn-ghost" style={{ width: '100%', padding: '8px', fontSize: 13, cursor: 'pointer' }}>
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <main className="app-main">
        {/* Mobile top bar with hamburger */}
        <div className="mobile-topbar">
          <button aria-label="Menu" onClick={() => setOpen(true)} style={{
            width: 40, height: 40, borderRadius: 9, border: '1px solid var(--border-med)',
            background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', gap: 4, cursor: 'pointer', flexShrink: 0,
          }}>
            <Bar /><Bar /><Bar />
          </button>
          <div style={{ minWidth: 0 }}>
            <div className="font-display" style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.12em', color: 'var(--accent-mid)', textTransform: 'uppercase' }}>
              Absolute Comfort
            </div>
            <div className="font-display" style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.1 }}>{activeLabel}</div>
          </div>
        </div>

        {devMode && (
          <div style={{
            background: 'var(--gold-light)', color: 'var(--gold)', fontSize: 13, fontWeight: 600,
            textAlign: 'center', padding: '7px 16px', borderBottom: '1px solid var(--border)',
          }}>
            Demo mode — sample data, not saved.
          </div>
        )}

        <div className="page-pad">{children}</div>
      </main>
    </div>
  )
}

function Bar() {
  return <span style={{ width: 17, height: 2, background: 'var(--ink)', borderRadius: 2 }} />
}
