'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import NavProgress from '@/components/NavProgress'
import DemoUserSwitch from '@/components/DemoUserSwitch'
import NavIcon from '@/components/NavIcon'
import type { Profile } from '@/lib/types'

type NavItem = { href: string; label: string; icon: string; financeOnly?: boolean }
type NavGroup = { title: string; description: string; icon: string; items: NavItem[] }

const NAV_GROUPS: NavGroup[] = [
  { title: 'Operations', description: 'Daily work, trips and dispatch', icon: 'dispatch', items: [
    { href: '/workday', label: 'Today’s work', icon: 'dashboard' },
    { href: '/dispatch', label: 'Dispatch', icon: 'dispatch' },
    { href: '/trips', label: 'Trips', icon: 'trips' },
    { href: '/search', label: 'Find records', icon: 'health' },
    { href: '/attention', label: 'Needs attention', icon: 'compliance' },
    { href: '/quote', label: 'Quote a fare', icon: 'quote' },
  ] },
  { title: 'Fleet', description: 'Vehicles, people and maintenance', icon: 'fleet', items: [
    { href: '/vehicles', label: 'Vehicles', icon: 'fleet' },
    { href: '/drivers', label: 'Drivers', icon: 'drivers' },
    { href: '/fuel', label: 'Fuel', icon: 'fuel' },
    { href: '/services', label: 'Servicing', icon: 'servicing' },
    { href: '/routes', label: 'Routes & rates', icon: 'routes' },
    { href: '/compliance', label: 'Compliance', icon: 'compliance' },
  ] },
  { title: 'Contacts', description: 'Clients and transport suppliers', icon: 'clients', items: [
    { href: '/suppliers', label: 'Suppliers', icon: 'clients', financeOnly: true },
    { href: '/clients', label: 'Clients', icon: 'clients', financeOnly: true },
  ] },
  { title: 'Finance', description: 'Invoices, costs and business reports', icon: 'receivables', items: [
    { href: '/', label: 'Dashboard', icon: 'dashboard', financeOnly: true },
    { href: '/insights', label: 'Insights', icon: 'insights', financeOnly: true },
    { href: '/receivables', label: 'Receivables', icon: 'receivables', financeOnly: true },
    { href: '/expressway', label: 'Expressway', icon: 'expressway', financeOnly: true },
    { href: '/expenses', label: 'Expenses', icon: 'expenses', financeOnly: true },
    { href: '/goals', label: 'Targets & P&L', icon: 'goals', financeOnly: true },
    { href: '/payback', label: 'Vehicle payback', icon: 'payback', financeOnly: true },
    { href: '/reports', label: 'Reports', icon: 'reports', financeOnly: true },
  ] },
  { title: 'Settings', description: 'Company settings and data tools', icon: 'settings', items: [
    { href: '/data-health', label: 'Data health', icon: 'health' },
    { href: '/backup', label: 'Backup', icon: 'backup', financeOnly: true },
    { href: '/settings', label: 'Settings', icon: 'settings' },
  ] },
]

export default function AppShell({ profile, canFinance, devMode, children }: {
  profile: Profile; canFinance: boolean; devMode: boolean; children: React.ReactNode
}) {
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [appsOpen, setAppsOpen] = useState(false)
  const [moduleSearch, setModuleSearch] = useState('')
  const [compact, setCompact] = useState(false)
  const launcherRef = useRef<HTMLDivElement>(null)
  const launcherButtonRef = useRef<HTMLButtonElement>(null)
  const launcherSearchRef = useRef<HTMLInputElement>(null)
  const drawerButtonRef = useRef<HTMLButtonElement>(null)
  const sidebarRef = useRef<HTMLElement>(null)

  const groups = NAV_GROUPS.map(group => ({ ...group, items: group.items.filter(item => !item.financeOnly || canFinance) })).filter(group => group.items.length > 0)
  const isActive = (href: string) => href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`)
  const currentGroup = groups.find(group => group.items.some(item => isActive(item.href))) ?? groups[0]
  const currentItem = currentGroup.items.find(item => isActive(item.href))
  const activeLabel = currentItem?.label ?? 'Workspace'
  const homeHref = canFinance ? '/' : '/workday'
  const initials = (profile.full_name ?? 'Staff').split(/\s+/).filter(Boolean).slice(0, 2).map(name => name[0]).join('').toUpperCase()
  const search = moduleSearch.trim().toLowerCase()
  const matchingGroups = groups.map(group => ({ ...group, items: group.items.filter(item => `${group.title} ${item.label}`.toLowerCase().includes(search)) })).filter(group => group.items.length > 0)

  // A route can change through browser history as well as our own links.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setDrawerOpen(false); setAppsOpen(false); setModuleSearch('') }, [pathname])
  useEffect(() => {
    const media = window.matchMedia('(max-width: 860px)')
    const update = () => { setCompact(media.matches); if (!media.matches) setDrawerOpen(false) }
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  useEffect(() => {
    if (!appsOpen) return
    launcherSearchRef.current?.focus()
    function outside(event: PointerEvent) {
      if (!launcherRef.current?.contains(event.target as Node)) setAppsOpen(false)
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [appsOpen])
  useEffect(() => {
    if (!drawerOpen && !appsOpen) return
    function keydown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        if (appsOpen) { setAppsOpen(false); launcherButtonRef.current?.focus() }
        else { setDrawerOpen(false); drawerButtonRef.current?.focus() }
      }
      if (event.key === 'Tab' && drawerOpen && compact) {
        const controls = sidebarRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]')
        if (!controls?.length) return
        const first = controls[0], last = controls[controls.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', keydown)
    return () => document.removeEventListener('keydown', keydown)
  }, [appsOpen, drawerOpen, compact])
  useEffect(() => {
    if (!drawerOpen || !compact) return
    sidebarRef.current?.querySelector<HTMLElement>('[data-close-drawer]')?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [drawerOpen, compact])

  function navigate() { setDrawerOpen(false); setAppsOpen(false); setModuleSearch('') }

  return <div className="app-layout workspace-layout">
    <NavProgress/>
    {drawerOpen && <button className="sidebar-backdrop show workspace-backdrop" type="button" tabIndex={-1} aria-label="Close navigation overlay" onClick={() => setDrawerOpen(false)}/>}
    <aside ref={sidebarRef} className={`app-sidebar workspace-sidebar${drawerOpen ? ' open' : ''}`} aria-label="Workspace navigation" role={compact && drawerOpen ? 'dialog' : undefined} aria-modal={compact && drawerOpen ? true : undefined} inert={compact && !drawerOpen}>
      <div className="workspace-brand-row"><Link className="workspace-brand" href={homeHref} onClick={navigate}><span className="workspace-brand-identity"><Image src="/brand/absolute-comfort.svg" width={181} height={39} alt="Absolute Comfort Travel" unoptimized/><small>OPERATIONS WORKSPACE</small></span></Link><button className="workspace-close" data-close-drawer type="button" aria-label="Close navigation" onClick={() => { setDrawerOpen(false); drawerButtonRef.current?.focus() }}>×</button></div>
      <div className="workspace-module-title"><span className="workspace-module-icon"><NavIcon name={currentGroup.icon}/></span><div><small>CURRENT WORKSPACE</small><strong>{currentGroup.title}</strong></div></div>
      <nav className="workspace-local-nav scroll-thin" aria-label={`${currentGroup.title} navigation`}>{currentGroup.items.map(item => <Link key={item.href} href={item.href} onClick={navigate} aria-current={isActive(item.href) ? 'page' : undefined} className={`nav-link${isActive(item.href) ? ' nav-active' : ''}`}><NavIcon name={item.icon}/><span>{item.label}</span>{isActive(item.href) && <span className="workspace-active-dot" aria-hidden="true"/>}</Link>)}</nav>
      <div className="workspace-switch-links"><div className="nav-section">Workspaces</div>{groups.map(group => <Link href={group.items[0].href} key={group.title} onClick={navigate} aria-current={currentGroup.title === group.title ? 'true' : undefined}><NavIcon name={group.icon}/><span>{group.title}</span><span aria-hidden="true">›</span></Link>)}</div>
      <div className="workspace-sidebar-footer">{devMode && <DemoUserSwitch activeRole={profile.role}/>}<div className="workspace-user"><span className="workspace-avatar" aria-hidden="true">{initials}</span><span><strong>{profile.full_name ?? 'Staff member'}</strong><small>{profile.role}</small></span></div><form action="/auth/signout" method="post"><button type="submit" className="workspace-signout">Sign out</button></form></div>
    </aside>
    <main className="app-main workspace-main">
      <div className="workspace-topbar no-print">
        <button ref={drawerButtonRef} type="button" className="workspace-mobile-menu" aria-label="Open navigation" aria-expanded={drawerOpen} onClick={() => setDrawerOpen(true)}><span/><span/><span/></button>
        <div className="workspace-launcher" ref={launcherRef}><button ref={launcherButtonRef} className="workspace-app-button" type="button" aria-expanded={appsOpen} aria-controls="workspace-apps" aria-haspopup="dialog" onClick={() => setAppsOpen(open => !open)}><NavIcon name="dashboard"/><span>Apps</span><span className="workspace-chevron" aria-hidden="true">⌄</span></button>
          {appsOpen && <div id="workspace-apps" role="dialog" aria-modal="false" aria-label="Choose a workspace or page" className="workspace-app-panel"><div className="workspace-app-panel-head"><strong>Your workspace</strong><button type="button" aria-label="Close app switcher" onClick={() => { setAppsOpen(false); launcherButtonRef.current?.focus() }}>×</button></div><label className="workspace-module-search"><span className="workspace-sr-only">Find a workspace or page</span><input ref={launcherSearchRef} type="search" placeholder="Find a workspace or page…" value={moduleSearch} onChange={event => setModuleSearch(event.target.value)}/></label><div className="workspace-app-grid">{matchingGroups.map(group => <section key={group.title} className="workspace-app-group"><Link className="workspace-app-tile" href={group.items[0].href} onClick={navigate}><span className="workspace-tile-icon"><NavIcon name={group.icon}/></span><span><strong>{group.title}</strong><small>{group.description}</small></span></Link><div className="workspace-app-pages">{group.items.map(item => <Link key={item.href} href={item.href} onClick={navigate}>{item.label}</Link>)}</div></section>)}</div>{matchingGroups.length === 0 && <p className="workspace-no-results">No pages match “{moduleSearch}”. Try trips, fleet or settings.</p>}</div>}
        </div>
        <nav className="workspace-breadcrumbs" aria-label="Breadcrumb"><ol><li><Link href={homeHref}>Workspace</Link></li><li><span>{currentGroup.title}</span></li><li><span aria-current="page">{activeLabel}</span></li>{currentItem && pathname !== currentItem.href && <li><span>Record details</span></li>}</ol></nav>
        <div className="workspace-topbar-end"><Link className="workspace-today-link" href="/workday">Today’s work</Link><span className="workspace-timezone">EAT · KES</span><span className="workspace-topbar-role">{profile.role}</span></div>
      </div>
      {devMode && <div className="workspace-demo-banner"><span className="workspace-demo-dot" aria-hidden="true"/>Demo workspace · synthetic data. Changes stay in this demo.</div>}
      <div className="page-pad workspace-page-pad" id="workspace-content">{children}</div>
    </main>
  </div>
}
