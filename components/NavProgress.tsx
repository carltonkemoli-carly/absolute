'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

// A thin top progress bar that appears the instant an internal link is clicked
// and disappears once the new route has rendered — so navigation always feels
// responsive even when the server takes a moment.
export default function NavProgress() {
  const pathname = usePathname()
  const [active, setActive] = useState(false)

  // Route changed → navigation finished
  useEffect(() => { setActive(false) }, [pathname])

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = (e.target as HTMLElement)?.closest?.('a')
      if (!a) return
      const href = a.getAttribute('href')
      if (!href || a.target === '_blank' || href.startsWith('http') || href.startsWith('#')) return
      const dest = new URL(a.href, location.href)
      if (dest.pathname !== location.pathname) setActive(true)
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])

  return (
    <div aria-hidden style={{
      position: 'fixed', top: 0, left: 0, right: 0, height: 3, zIndex: 100,
      pointerEvents: 'none', opacity: active ? 1 : 0,
      transition: active ? 'opacity .1s' : 'opacity .3s .1s',
    }}>
      <div style={{
        height: '100%', background: 'var(--accent-mid)',
        width: active ? '92%' : '0%',
        transition: active ? 'width 8s cubic-bezier(0.1,0.7,0.1,1)' : 'none',
        boxShadow: '0 0 8px var(--accent-mid)',
      }} />
    </div>
  )
}
