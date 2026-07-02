'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import NavProgress from '@/components/NavProgress'
import DemoUserSwitch from '@/components/DemoUserSwitch'
import NavIcon from '@/components/NavIcon'
import type { Profile } from '@/lib/types'

type NavItem = { href: string; label: string; icon: string; financeOnly?: boolean }
type NavGroup = { title: string; items: NavItem[] }

// Grouped navigation — fewer, clearer sections instead of one long flat list.
const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Overview',
    items: [{ href: '/', label: 'Dashboard', icon: 'dashboard', financeOnly: true }],
  },
  {
    title: 'Operations',
    items: [
      { href: '/dispatch', label: 'Dispatch', icon: 'dispatch' },
      { href: '/flights', label: 'Flights', icon: 'flights' },
      { href: '/trips', label: 'Trips', icon: 'trips' },
    ],
  },
  {
    title: 'Fleet',
    items: [
      { href: '/vehicles', label: 'Fleet', icon: 'fleet' },
      { href: '/drivers', label: 'Drivers', icon: 'drivers' },
      { href: '/fuel', label: 'Fuel', icon: 'fuel' },
      { href: '/services', label: 'Servicing', icon: 'servicing' },
      { href: '/routes', label: 'Routes & rates', icon: 'routes' },
      { href: '/compliance', label: 'Compliance', icon: 'compliance' },
    ],
  },
  {
    title: 'Finance',
    items: [
      { href: '/insights', label: 'Insights', icon: 'insights', financeOnly: true },
      { href: '/clients', label: 'Clients', icon: 'clients', financeOnly: true },
      { href: '/payback', label: 'Vehicle payback', icon: 'payback', financeOnly: true },
      { href: '/receivables', label: 'Receivables', icon: 'receivables', financeOnly: true },
      { href: '/expressway', label: 'Expressway', icon: 'expressway', financeOnly: true },
      { href: '/billing', label: 'Billing', icon: 'billing', financeOnly: true },
      { href: '/expenses', label: 'Expenses', icon: 'expenses', financeOnly: true },
      { href: '/goals', label: 'Targets & P&L', icon: 'goals', financeOnly: true },
      { href: '/reports', label: 'Reports', icon: 'reports', financeOnly: true },
    ],
  },
  {
    title: 'System',
    items: [
      { href: '/data-health', label: 'Data health', icon: 'health' },
      { href: '/backup', label: 'Backup', icon: 'backup', financeOnly: true },
      { href: '/settings', label: 'Settings', icon: 'settings' },
    ],
  },
]

const ALL_ITEMS = NAV_GROUPS.flatMap((g) => g.items)

export default function AppShell({
  profile, canFinance, devMode, children,
}: { profile: Profile; canFinance: boolean; devMode: boolean; children: React.ReactNode }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  // Filter finance-gated items, then drop any group left empty.
  const groups = NAV_GROUPS
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.financeOnly || canFinance) }))
    .filter((g) => g.items.length > 0)

  // Close the drawer whenever the route changes
  useEffect(() => { setOpen(false) }, [pathname])

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href))
  const activeLabel = ALL_ITEMS.filter((i) => !i.financeOnly || canFinance).find((i) => isActive(i.href))?.label ?? 'Menu'

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

        <nav className="scroll-thin" style={{ flex: 1, padding: '4px 12px 12px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
          {groups.map((group) => (
            <div key={group.title} style={{ marginTop: 14 }}>
              <div className="nav-section">{group.title}</div>
              {group.items.map((item) => (
                <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className={`nav-link${isActive(item.href) ? ' nav-active' : ''}`}>
                  <NavIcon name={item.icon} />
                  {item.label}
                </Link>
              ))}
            </div>
          ))}
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
